// 霧谷の冒険者団 — 1試合を進める役（人間1席＋AI の席）。
// start() / answer() は「次に人間が選ぶ場面」か試合の終わりまで進め、その間に起きた出来事（GameEvent）を返す。
// 画面は出来事を useTable().push() に渡し、waiting（いま人間に聞いていること）を見て選択肢を出す。
import * as D from './data';
import type { Cost, Res } from './data';
const { MON } = D;
import { AI, type Level } from './ai';
import { Game, canPay, type Gen, type Opt, type Option, type Player, type Req } from './engine';
import type { GameEvent } from './types';

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
