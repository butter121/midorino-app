// 霧谷の冒険者団 — 1試合を進める役（人間1席＋AI の席）。
// start() / answer() は「次に人間が選ぶ場面」か試合の終わりまで進め、その間に起きた出来事（GameEvent）を返す。
// 画面は出来事を useTable().push() に渡し、waiting（いま人間に聞いていること）を見て選択肢を出す。
import * as D from './data';
import type { Cost, Element, Res } from './data';
const { MON } = D;
import { AI, type Level } from './ai';
import { BASIC, Game, canPay, type FightPick, type Gen, type Opt, type Option, type Player, type Req } from './engine';
import type { GameEvent, PowerPart } from './types';

export interface SessionOptions {
  n: number;
  seed?: number;
  /** 人間の席（-1 なら AI だけで最後まで） */
  human?: number;
  /** 席ごとの AI の腕前（人間の席は無視） */
  levels?: Level[];
  names?: string[];
}

export class KiridaniSession {
  readonly g: Game;
  readonly human: number;
  private gen: Gen<number[]>;
  /** いま人間に聞いていること */
  waiting: Req | null = null;
  done = false;
  scores: number[] = [];
  private started = false;

  constructor(o: SessionOptions) {
    const seed = o.seed ?? 1;
    this.human = o.human ?? 0;
    const levels = o.levels ?? Array(o.n).fill('mid');
    const ais = Array.from({ length: o.n }, (_, i) => (i === this.human ? null : new AI(levels[i] ?? 'mid', { seed: seed * 100 + i })));
    const names = o.names ?? Array.from({ length: o.n }, (_, i) => (i === this.human ? 'あなた' : `AI${i + 1}`));
    this.g = new Game(o.n, ais, { seed, events: { me: this.human, names } });
    this.gen = this.g.play();
  }

  get player(): Player | null { return this.g.players[this.human] ?? null; }

  private run(answer?: unknown): GameEvent[] {
    if (this.done) return [];
    const r = this.started ? this.gen.next(answer) : this.gen.next();
    this.started = true;
    if (r.done) { this.done = true; this.waiting = null; this.scores = r.value; } else this.waiting = r.value;
    const out = this.g.E!.splice(0);
    return out;
  }

  /** 最初の選択まで進める */
  start(): GameEvent[] { return this.run(); }

  /** 人間の答えを渡し、次の選択まで進める */
  answer(a: unknown): GameEvent[] {
    if (!this.waiting) throw new Error('nothing to answer');
    const w = this.waiting;
    if (w.k === 'draft' && !w.cards.includes(a as string)) throw new Error('bad card');
    if (w.k === 'char' && !w.options.includes(a as string)) throw new Error('bad character');
    if (w.k === 'choose' && !w.opts.includes(a as Option)) throw new Error('bad option');
    return this.run(a);
  }

  // ---------------------------------------------------------- 人間の席だけの選び方（AI の道筋は通らない）
  /** 戦闘：巣・主の巣に何人で、何を使って挑むか（待ち伏せも）。エンジンが置けるか・払えるかを確かめる */
  fight(sel: FightPick): GameEvent[] {
    const w = this.waiting;
    if (!w || w.k !== 'choose') throw new Error('not your turn');
    const chk = this.g.check_pick(w.p, sel);
    if (!chk.ok) throw new Error(chk.error);
    this.g.pick = { pid: w.p.pid, boosts: [...sel.boosts], wait: !!sel.wait };
    return this.run([sel.sid, [sel.k, 'pick', chk.how]] as Option);
  }

  /** 市場：1種類を好きな数だけ売る／買う */
  market(sid: string, kind: 'buy' | 'sell', r: Res, q: number): GameEvent[] {
    const w = this.waiting;
    if (!w || w.k !== 'choose') throw new Error('not your turn');
    const err = this.g.check_market(w.p, sid, kind, r, q);
    if (err) throw new Error(err);
    return this.run([sid, [kind, r, q]] as Option);
  }

  /** このラウンドにした取引の数（人間の席） */
  private tradesDone: Record<number, number> = {};
  /** このラウンドにあと何回取引を持ちかけられるか（AI と同じ：1回、アヤ・行商の荷車で+1ずつ） */
  tradeLeft(): number {
    const p = this.player;
    if (!p || !this.waiting || this.waiting.k !== 'choose') return 0;
    const tries = 1 + (p.char === 'aya' ? 1 : 0) + (p.tools.includes('i15') ? 1 : 0);
    return Math.max(0, tries - (this.tradesDone[this.g.round] ?? 0));
  }

  /** 取引の相手（取引する AI の席） */
  tradePartners(): number[] {
    return this.g.players.filter((o) => o.pid !== this.human && o.ai instanceof AI && o.ai.trade_on).map((o) => o.pid);
  }

  /** 取引の提案が成り立つか、相手の AI が受けるか（AI の取引の評価をそのまま使い、乱数は使わない） */
  judgeTrade(b: number, give: Cost, get: Cost): TradeJudge {
    const p = this.player;
    const g = this.g;
    const clean = (c: Cost) => Object.fromEntries(Object.entries(c).filter(([, n]) => n)) as Cost;
    give = clean(give); get = clean(get);
    const units = (c: Cost) => Object.values(c).reduce((a, n) => a + (n as number), 0);
    const fail = (error: string): TradeJudge => ({ ok: false, accept: false, gain: 0, error });
    if (!p || !this.waiting || this.waiting.k !== 'choose') return fail('あなたの番に持ちかけられる');
    if (this.tradeLeft() <= 0) return fail('このラウンドの取引は終わり');
    const o = g.players[b];
    if (!o || o === p || !(o.ai instanceof AI)) return fail('相手がいない');
    if (!o.ai.trade_on) return fail('この相手は取引しない');
    if (!units(give) || !units(get)) return fail('渡すものと受け取るものを選ぶ');
    if (units(give) > TRADE_MAX || units(get) > TRADE_MAX) return fail(`片側${TRADE_MAX}個まで`);
    for (const r of Object.keys(give)) if (r in get) return fail('同じ資源を渡して受け取ることはできない');
    for (const [r, n] of Object.entries(give)) if (!BASIC.includes(r as Res) || p.res[r as Res] < (n as number)) return fail('渡すものが足りない');
    for (const [r, n] of Object.entries(get)) if (!BASIC.includes(r as Res) || o.res[r as Res] < (n as number)) return fail('相手の持ち物が足りない');
    // 相手から見ると get を渡して give を受け取る
    const j = o.ai.judge_offer(g, o, get, give);
    return { ok: true, accept: j.accept, gain: j.gain };
  }

  /** 取引する（相手が受けたときだけ。置き場所の選択は続く） */
  trade(b: number, give: Cost, get: Cost): GameEvent[] {
    const j = this.judgeTrade(b, give, get);
    if (!j.ok) throw new Error(j.error);
    if (!j.accept) throw new Error('相手が断った');
    const w = this.waiting as Extract<Req, { k: 'choose' }>;
    const clean = (c: Cost) => Object.fromEntries(Object.entries(c).filter(([, n]) => n)) as Cost;
    this.g.trade(w.p, this.g.players[b], clean(give), clean(get));
    this.tradesDone[this.g.round] = (this.tradesDone[this.g.round] ?? 0) + 1;
    // 持ち物が変わったので選べる行動を数え直す
    this.waiting = { ...w, opts: this.g.legal(w.p) };
    return this.g.E!.splice(0);
  }

  /** 人間の席も AI と同じ考えで答えて最後まで（テスト・お任せ用） */
  autoplay(level: Level = 'mid'): GameEvent[] {
    const helper = new AI(level, { seed: 7 });
    const out: GameEvent[] = [...(this.started ? [] : this.start())];
    while (!this.done) out.push(...this.answer(helper.respond(this.waiting!)));
    return out;
  }
}

// ------------------------------------------------------------ 画面向け：選択肢の説明と戦闘の見込み
export const MODE_JP: Record<string, string> = { safe: '確実に', gamble: '賭ける', chip: '削るだけ', wait: '待ち伏せ' };
export const MODE_TEXT: Record<string, string> = {
  safe: '一番悪い運命でも勝てるだけ、矢・薬・秘術を使う',
  gamble: '運命が +1 なら勝てるところまで使う',
  chip: '何も使わずに挑む（負けても傷を残せる）',
  wait: 'この巣で共闘の相手を待つ。来なければラウンドの終わりに単独で戦う',
};

export interface FightPreview { power: number; partner: number; need: number; pwin: number; boosts: string[]; cost: Cost; monster: string }

/** 巣・主の巣に置いたときの見込み（盤面の複製で計算するので本物は変わらない） */
export function previewFight(g: Game, p: Player, sid: string, opt: Opt): FightPreview | null {
  if (!Array.isArray(opt) || !(sid.startsWith('nest') || sid === 'lair')) return null;
  const [k, mode, how] = opt as [number, string, string];
  const nd0 = sid === 'lair' ? null : g.nest(sid);
  const extra = nd0?.wait ? [nd0.wait.pid] : [];
  const g2 = g.clone_for(p.pid, extra);
  const p2 = g2.players[p.pid];
  const idxs = g2.take_worker(p2, k, true);
  let plan, partner = 0, need: number, monster: string;
  if (sid === 'lair') {
    const m = g2.bosses[g2.round];
    monster = m.id;
    plan = g2.make_plan(p2, m, idxs, mode, null, 0, false, true);
    need = m.str - g2.lair.reduce((a, e) => a + e.plan.power, 0) - plan.power;
  } else {
    const nd = g2.nest(sid);
    const m = MON[nd.mon!];
    monster = m.id;
    if (nd.wait) {
      const q = g2.players[nd.wait.pid];
      partner = nd.wait.plan.power + (q.weapons.includes('i10') ? 2 : 0) + (p2.char === 'aya' ? D.AYA_COOP : 0);
      plan = g2.make_plan(p2, m, idxs, mode, nd, partner, true);
      if (q.char === 'aya') plan.power += D.AYA_COOP;
    } else {
      plan = g2.make_plan(p2, m, idxs, mode, nd);
      if (how === 'i23' && !plan.boosts.some((b) => b[0] === 'i23')) {
        const c = g2.spell_cost(p2, { mana: 2 });
        const tot: Record<string, number> = { ...(plan.cost as Record<string, number>) };
        for (const [r, n] of Object.entries(c)) tot[r] = (tot[r] ?? 0) + (n as number);
        if (canPay(p2, tot as Cost)) { plan.boosts.push(['i23', 2, 'i23']); plan.els.add('dark'); plan.cost = tot as Cost; plan.power = plan.base + 2 + plan.boosts.slice(0, -1).reduce((a, b) => a + b[1], 0) + g2.elem_bonus(p2, m, plan.els); }
      }
    }
    need = g2.eff_str(p2, m, nd) - plan.power - partner;
  }
  const dist = g2.fate_dist(p2);
  let pwin = 0;
  for (const [v, pr] of dist) if (v >= need) pwin += pr;
  const names: Record<string, string> = { arrow: '矢', potion: 'ポーション', morale: '士気' };
  return {
    power: plan.power, partner, need, pwin, monster,
    boosts: plan.boosts.map(([nm]) => names[nm] ?? D.CARDS[nm]?.name ?? nm),
    cost: Object.fromEntries(Object.entries(plan.cost).filter(([, n]) => n)) as Cost,
  };
}

const RJ = (r: string) => D.RES_JP[r as Res] ?? r;
export const costJP = (c: Cost) => Object.entries(c).filter(([, n]) => n).map(([r, n]) => `${RJ(r)}${n}`).join('・');

/** 1つの選択肢の短い説明（画面のボタン用） */
export function describeOption(g: Game, p: Player, [sid, opt]: Option): { title: string; detail?: string; card?: string } {
  const a = D.ACT[sid];
  if (sid === 'guild') return { title: `${D.CARDS[opt as string].name}を出す`, detail: `食料${g.occ_cost(p).food}`, card: opt as string };
  if (sid === 'forge') return { title: `${D.CARDS[opt as string].name}を作る`, detail: costJP(g.weapon_cost(p, opt as string)), card: opt as string };
  if (sid === 'workshop') {
    const o = opt as (string | number)[];
    if (o[0] === 'tool') return { title: `${D.CARDS[o[1] as string].name}を建てる`, detail: costJP((D.CARDS[o[1] as string] as D.ItemDef).cost), card: o[1] as string };
    if (o[0] === 'bed') return { title: '寝床を建てる', detail: costJP(D.BED_COST) };
    const wc = g.wall_cost(p);
    return { title: `防壁を${o[1]}つ建てる`, detail: costJP(Object.fromEntries(Object.entries(wc).map(([r, n]) => [r, (n as number) * (o[1] as number)]))) };
  }
  if (D.MARKETS.has(sid)) {
    const [kind, r, q] = opt as [string, string, number];
    if (kind === 'sell') return { title: `${RJ(r)}を${q}売る`, detail: `金貨+${g.sell_price(p, r) * q}` };
    return { title: `${RJ(r)}を${q}買う`, detail: `金貨-${g.buy_price(p, r) * q}` };
  }
  if (sid.startsWith('nest') || sid === 'lair') {
    const [k, mode, how] = opt as [number, string, string];
    const nd = sid === 'lair' ? null : g.nest(sid);
    const join = !!nd?.wait;
    const t = `${k}人で・${join ? '共闘に加わる（' + MODE_JP[mode] + '）' : MODE_JP[mode]}${how === 'o14' ? '（影の斥候で）' : how === 'i23' ? '（影分身の呪符で）' : ''}`;
    return { title: t, detail: join ? `${g.names[nd!.wait!.pid] ?? ''}が待っている。${MODE_TEXT[mode]}` : MODE_TEXT[mode] };
  }
  return { title: a?.name ?? sid };
}

// ------------------------------------------------------------ 取引・戦闘の選択（人間の席）
/** 人間からの取引の上限（片側の個数）。AI どうしは 1:1・2:1・1:2 */
export const TRADE_MAX = 3;
export interface TradeJudge { ok: boolean; accept: boolean; gain: number; error?: string }

export interface FightChip {
  /** 画面の中で一意（同じ名前が2つあるときは #1 など） */
  key: string;
  /** エンジンでの名前（boost_list の名前） */
  name: string;
  label: string;
  power: number;
  cost: Cost;
  el?: Element;
  /** 使うと捨てる秘術カード */
  card?: string;
  /** 外せない（影分身の呪符で満員の巣に入るとき） */
  locked?: boolean;
  /** 弱点・潮・天候に合う属性なら、その分の見込み */
  bonus?: string;
  /** 矢・ポーション・士気の説明 */
  src?: string;
}

export const BOOST_JP: Record<string, string> = { arrow: '矢', potion: 'ポーション', morale: '士気' };
const BOOST_SRC: Record<string, string> = { arrow: '木材で放つ', potion: '薬草で作る', morale: '食料でふるい立つ' };

/** 戦闘で使えるもの（タップでオン・オフする札） */
export function fightChips(g: Game, p: Player, sid: string): FightChip[] {
  const boss = sid === 'lair';
  const m = boss ? g.bosses[g.round] : MON[g.nest(sid).mon!];
  const how = g.legal(p).find((o) => o[0] === sid && Array.isArray(o[1]))?.[1] as (string | number)[] | undefined;
  const seen: Record<string, number> = {};
  const tide = g.tide();
  const we = D.WEATHER_EL[g.cur_weather()];
  return g.boost_list(p, m, boss).map(([nm, pw, cost, el, card]) => {
    seen[nm] = (seen[nm] ?? 0) + 1;
    const bon: string[] = [];
    if (el && m.weak === el) bon.push(`弱点+${D.WEAKNESS_BONUS}`);
    if (el && tide === el) bon.push(`潮+${D.TIDE_BONUS}`);
    if (el && we && we[0] === el) bon.push(`天候+${we[1]}`);
    return {
      key: `${nm}#${seen[nm]}`, name: nm,
      label: BOOST_JP[nm] ?? D.CARDS[nm]?.name ?? nm,
      power: pw, cost: Object.fromEntries(Object.entries(cost).filter(([, n]) => n)) as Cost,
      ...(el ? { el } : {}), ...(card ? { card } : {}),
      ...(nm === 'i23' && how?.[2] === 'i23' ? { locked: true } : {}),
      ...(bon.length ? { bonus: bon.join('・') } : {}),
      ...(BOOST_SRC[nm] ? { src: BOOST_SRC[nm] } : {}),
    } as FightChip;
  });
}

export interface PickPreview {
  ok: boolean;
  error?: string;
  monster: string;
  boss: boolean;
  /** 自分の戦力（内訳 parts の合計） */
  power: number;
  parts: PowerPart[];
  /** 待ち伏せしている相手の戦力（共闘のとき） */
  partner: number;
  /** 主の巣に先に置いた人たちの戦力 */
  others: number;
  /** 魔物の強さ（傷・罠・天候を引いたあと） */
  strength: number;
  /** 運命でいくつ以上が出れば勝てるか */
  need: number;
  pwin: number;
  /** 運命の山（残り） */
  fate: number[];
  cost: Cost;
  counter: number;
  defense: number;
  /** 反撃で負傷する見込みの人数 */
  injuries: number;
  /** 何人で置けるか */
  ks: number[];
  /** 待ち伏せを選べるか */
  waitOk: boolean;
  /** 待ち伏せている人（共闘に加わる） */
  joining?: number;
}

/** 選んだ使うもので挑んだときの見込み（盤面の複製で計算するので本物は変わらない） */
export function previewPick(g: Game, p: Player, sel: FightPick): PickPreview {
  const sid = sel.sid;
  const boss = sid === 'lair';
  const legal = g.legal(p).filter((o) => o[0] === sid && Array.isArray(o[1])).map((o) => o[1] as (string | number)[]);
  const ks = [...new Set(legal.map((o) => o[0] as number))].sort();
  const waitOk = legal.some((o) => o[0] === sel.k && o[1] === 'wait');
  const chk = g.check_pick(p, sel);
  const nd0 = boss ? null : g.nest(sid);
  const g2 = g.clone_for(p.pid, nd0?.wait ? [nd0.wait.pid] : []);
  const p2 = g2.players[p.pid];
  const idxs = g2.take_worker(p2, sel.k, true);
  // 払えない選択でも見込みは出す（使うものなしで）
  g2.pick = { pid: p.pid, boosts: chk.ok ? [...sel.boosts] : [], wait: !!sel.wait };
  let plan, partner = 0, others = 0, strength: number, monster: string, partnerDef = 0;
  let joining: number | undefined;
  const coop = !!nd0?.wait;
  if (boss) {
    const m = g2.bosses[g2.round];
    monster = m.id;
    plan = g2.make_plan(p2, m, idxs, 'pick', null, 0, false, true);
    others = g2.lair.reduce((a, e) => a + e.plan.power, 0);
    strength = m.str;
  } else {
    const nd = g2.nest(sid);
    const m = MON[nd.mon!];
    monster = m.id;
    if (nd.wait) {
      const q = g2.players[nd.wait.pid];
      joining = q.pid;
      partner = nd.wait.plan.power + (q.weapons.includes('i10') ? 2 : 0) + (p2.char === 'aya' ? D.AYA_COOP : 0);
      plan = g2.make_plan(p2, m, idxs, 'pick', nd, partner, true);
      if (q.char === 'aya') plan.power += D.AYA_COOP;
      if (q.occs.includes('o06')) partnerDef = 1;
    } else plan = g2.make_plan(p2, m, idxs, 'pick', nd);
    strength = g2.eff_str(p2, m, nd);
  }
  const m = boss ? g2.bosses[g2.round] : MON[monster];
  g2.planParts(p2, m, plan, coop, boss);
  const parts = plan.parts ?? [];
  const sum = parts.reduce((a, x) => a + x.value, 0);
  if (sum !== plan.power) parts.push({ kind: 'char', label: 'アヤ：共闘', value: plan.power - sum, seat: p.pid });
  const need = strength - others - plan.power - partner;
  const dist = g2.fate_dist(p2);
  let pwin = 0;
  for (const [v, pr] of dist) if (v >= need) pwin += pr;
  const counter = g2.counter(p2, m, plan);
  const defense = g2.defense(p2, plan.k) + partnerDef;
  const over = counter - defense;
  let inj = over <= 0 ? 0 : over >= 3 ? 2 : 1;
  if (p2.occs.includes('o11') || p2.weapons.includes('i26')) inj = Math.max(inj, 1);
  inj = Math.min(inj, plan.idxs.length);
  if (inj && p2.occs.includes('o04') && !p2.once.has('o04')) inj -= 1;
  return {
    ok: chk.ok, ...(chk.ok ? {} : { error: chk.error }),
    monster, boss, power: plan.power, parts, partner, others, strength, need, pwin,
    fate: p.fate.length ? [...p.fate] : [...D.FATE_DECK],
    cost: Object.fromEntries(Object.entries(plan.cost).filter(([, n]) => n)) as Cost,
    counter, defense, injuries: inj, ks, waitOk, ...(joining !== undefined ? { joining } : {}),
  };
}

/** 市場の値段（この人から見た売値・買値と、1回で動かせる数） */
export function marketQuote(g: Game, p: Player): { sell: Partial<Record<Res, number>>; buy: Partial<Record<Res, number>>; qty: number } {
  const sell: Partial<Record<Res, number>> = {}, buy: Partial<Record<Res, number>> = {};
  for (const r of ['mana', 'mat'] as Res[]) sell[r] = g.sell_price(p, r);
  for (const r of ['mana', 'mat', 'wood', 'iron', 'herb', 'food'] as Res[]) buy[r] = g.buy_price(p, r);
  return { sell, buy, qty: D.MARKET_QTY + (p.tools.includes('i15') ? 2 : 0) };
}
