// 霧谷の冒険者団 v2 — 画面のための見込み（盤面は変えない。複製の上で計算する）。
// 戦闘の勝つ見込み・必要な強さ・反撃と負傷の見込み、選択肢の短い説明。手元の試合でもオンラインの写しでも同じに動く。
import * as D from './data';
import { canPay, type Choice, type FightChip, type Game, type Option, type Player } from './engine';
import type { Cost, FightMode, Monster, PowerPart, Res } from './types';
import { RES } from './types';

export interface FightPreview {
  monster: Monster;
  /** 自分の戦力（後押し込み） */
  power: number;
  /** 共闘・主の巣で先に挑む人の戦力 */
  partner: number;
  /** 勝つのに要る合計（運命なし） */
  need: number;
  /** 勝つ見込み（0〜1） */
  pwin: number;
  /** 払うもの（士気・ポーション・秘術など） */
  cost: Cost;
  boosts: string[];
  /** 反撃と守り、負傷しそうな人数 */
  counter: number;
  guard: number;
  injuries: number;
  /** 送る仲間 */
  idxs: number[];
  /** 費用が払えない */
  short: boolean;
  /** 足せる後押し（士気・ポーション・カード・秘術）と、いま使うものの key（use の形） */
  chips: FightChip[];
  keys: string[];
  /** 戦力の内訳（仲間ごと・武器・使い魔・カードなど） */
  parts: PowerPart[];
  /** 運命の札の値と確率（運命を引く人の山） */
  fate: [number, number][];
  /** 運命なしで足りない分（これ以上の運命で勝つ） */
  fateNeed: number;
}

/** 巣・主の巣に k 人で mode で挑んだときの見込み */
export function previewFight(g0: Game, p0: Player, o: Option): FightPreview | null {
  const g = g0.clone();
  const p = g.players[p0.pid];
  const mode: FightMode = o.mode ?? 'normal';
  let mon: Monster | undefined;
  let acc = 0, accStr = 0;
  let fateOf: Player = p;
  let coop = false;
  if (o.s === 'lair') {
    mon = g.bossOf[g.round];
    if (!mon) return null;
    coop = g.lairQ.length > 0;
    for (const e of g.lairQ) {
      const q = g.players[e.pid];
      const pl = g.makePlan(q, mon, e.idxs, e.mode, true, mon.str - acc);
      acc += pl.power; accStr += pl.str;
    }
  } else {
    const nd = g.nest(o.s);
    mon = nd?.mon ?? undefined;
    if (!nd || !mon) return null;
    if (o.join && nd.wait) {
      coop = true;
      const q = g.players[nd.wait.pid];
      const pl = g.makePlan(q, mon, nd.wait.idxs, 'gamble', true, mon.str - mon.wounds);
      acc = pl.power; accStr = pl.str;
      fateOf = q;
    }
  }
  const need0 = mode === 'capture' ? g.captureNeed(p, mon) : mon.str - mon.wounds;
  const idxs = g.compsFor(p, o);
  const pl = g.makePlan(p, mon, idxs, mode === 'wait' ? 'wait' : mode, coop, need0 - acc, mode === 'wait' ? undefined : o.use);
  const strength = need0 + accStr + pl.str;
  const total = acc + pl.power;
  let pwin = 0;
  const fate = [...g.fateDist(fateOf)].sort((a, b) => a[0] - b[0]);
  if (o.s === 'lair') {
    // 主の巣は挑む全員が1枚ずつめくる（合計の分布）
    let dist = new Map<number, number>([[0, 1]]);
    for (const q of [...g.lairQ.map((e) => g.players[e.pid]), p]) {
      const nx = new Map<number, number>();
      for (const [s, a] of dist) for (const [v, b] of g.fateDist(q)) nx.set(s + v, (nx.get(s + v) ?? 0) + a * b);
      dist = nx;
    }
    for (const [v, pr] of dist) if (total + v >= strength) pwin += pr;
  } else for (const [v, pr] of fate) if (total + v >= strength) pwin += pr;
  const guard = g.defense(p, pl);
  const counter = Math.max(0, mon.counter + pl.counter);
  const injuries = g.mods(p).rage > 0 ? 0 : Math.max(0, Math.min(idxs.length, counter - guard - pl.noInj));
  return {
    monster: mon, power: pl.power, partner: acc, need: strength, pwin, cost: pl.cost, boosts: pl.boosts, counter, guard, injuries, idxs,
    short: !canPay(p, pl.cost), chips: pl.chips ?? [], keys: pl.keys ?? [], parts: pl.parts, fate, fateNeed: strength - total,
  };
}

const RES_JP: Record<Res, string> = D.RES_JP;
const costJP = (c: Cost) => RES.filter((r) => c[r]).map((r) => `${RES_JP[r]}${c[r]}`).join('・');

/** 細かい選択（交換所・作る装備・建てるもの・熟練など）の短い説明 */
export function choiceLabel(g: Game, p: Player | null, x: Choice): { title: string; detail?: string; card?: string; cost?: Cost } {
  if (typeof x === 'string') {
    if (x === 'bed') return { title: '寝床を建てる', detail: '仲間を増やせる数+1', cost: p ? g.bedCost(p) : D.BED_COST };
    if (x === 'wall') return { title: '防壁を建てる', detail: '冬の襲撃を1ずつ防ぐ・戦闘の守り（2つで+1）', cost: p ? g.wallCost(p) : D.WALL_COST };
    if (x === 'atk') return { title: '攻めの熟練+1', detail: `選んだ仲間1人の戦力+1（${D.MAX_SKILL.atk}まで）` };
    if (x === 'def') return { title: '守りの熟練+1', detail: `選んだ仲間1人の守り+1（${D.MAX_SKILL.def}まで）` };
    if (x === 'skip') return { title: '何もしない' };
    if (x.startsWith('res:')) return { title: `${RES_JP[x.slice(4) as Res]}を1つ得る`, detail: '好きな資源を1つずつ選ぶ' };
    if (x === 'mage:mana') return { title: `マナ鉱石を${D.LEADER.mage.mana}つ得る`, detail: '連唱魔女ミナ' };
    if (x === 'mage:draw') return { title: `秘術を${D.LEADER.mage.draw}枚引く`, detail: '連唱魔女ミナ' };
    { const a = g.anc.get(x.split('~')[0]); if (a) { const rv = p ? g.repairOf(p, x) : null; return { title: `${a.name}を修復する`, detail: `試合の終わりに名声${a.fame}`, cost: rv?.cost ?? a.repair }; } }
    if (x.startsWith('tr:')) { const i = Number(x.slice(3)); return { title: p?.comps[i]?.leader ? 'リーダー' : `仲間${i + 1}` }; }
    if (g.byId.has(x)) {
      const c = g.card(x);
      const cost = p ? (c.kind === 'occ' ? g.occCost(p, x) : g.cardCost(p, x)) : c.cost ?? {};
      const stock = c.kind === 'gear' ? `（残り${g.gearStock[x] ?? 0}）` : '';
      const stat = [c.power ? `戦力+${c.power}` : '', c.guard ? `守り+${c.guard}` : '', c.two_hand ? '両手' : ''].filter(Boolean).join('・');
      return { title: `${c.name}${stock}`, detail: [stat, c.text].filter(Boolean).join('。') || undefined, card: x, cost };
    }
    const nd = g.nest(x);
    if (nd?.mon) return { title: `${nd.mon.name}を使い魔にする`, detail: `${D.NEST_JP[x] ?? x}・強さ${nd.mon.str}` };
    return { title: x };
  }
  if (x.m === 'sell') return { title: `${RES_JP[x.r]}を${x.q}つ売る`, detail: `金貨+${(p ? g.sellPrice(p, x.r) : D.sellPrice(x.r)) * x.q}` };
  if (x.m === 'buy') return { title: `${RES_JP[x.r]}を${x.q}つ買う`, detail: `金貨-${D.BUY[x.r] * x.q}` };
  if (x.m === 'stone') { const st = `${D.STONE.jp[x.tier]}魔石`; return x.dir === 'sell' ? { title: `${st}1つを${RES_JP[x.r]}${x.q}に換える` } : { title: `${RES_JP[x.r]}${x.q}を${st}1つに換える` }; }
  if (x.m === 'item') return { title: `${g.byId.get(x.id)?.name ?? x.id}を売る`, detail: `金貨+${g.itemSell(x.id)}`, card: x.id };
  if (x.m !== 'both') return { title: '?' };
  return { title: `${RES_JP[x.sell.r]}${x.sell.q}を売り、${RES_JP[x.buy.r]}${x.buy.q}を買う`, detail: `売値${costJP({ gold: g.sellPrice(p!, x.sell.r) * x.sell.q })}` };
}

/** 置く場所の選択肢の短い説明 */
export function optionLabel(g: Game, p: Player | null, o: Option): { title: string; detail?: string; card?: string; cost?: Cost } {
  if (o.s === '@spell') {
    const c = g.card(o.card!);
    return { title: `${c.name}を使う`, detail: c.text, card: o.card, cost: p ? g.cardCost(p, o.card!) : c.cost };
  }
  if (o.s === '@learn') {
    const c = g.card(o.card!);
    return { title: `${c.name}を身につける`, detail: c.text, card: o.card, cost: p ? g.learnCost(p, o.card!) : c.tome?.learn };
  }
  if (o.i === -1 && o.card) {
    const c = g.card(o.card);
    const sub = o.x !== undefined ? choiceLabel(g, p, o.x) : null;
    return { title: sub ? `${c.name}：${sub.title}` : `${c.name}の効果を使う`, detail: sub?.detail ?? c.text, card: sub?.card ?? o.card, cost: sub?.cost };
  }
  if (o.x !== undefined) return choiceLabel(g, p, o.x);
  if (o.mode === 'capture') {
    const nd = g.nest(o.s);
    if (nd?.mon) return { title: `${nd.mon.name}に好物をあげて使い魔にする`, detail: `${D.NEST_JP[o.s] ?? o.s}・強さ${nd.mon.str}`, cost: g.captureCost(nd.mon, p ?? undefined) };
  }
  const sp = g.space(o.s);
  if (!sp) return { title: o.s };
  const ops = sp.def.options[o.i] ?? [];
  const eff = sp.optEffects?.[o.i];
  const st = sp.stage ? g.byId.get(sp.stage) : undefined;
  const parts = ops.map((op) => opText(op as Record<string, unknown>)).filter(Boolean);
  if (sp.def.accum) parts.unshift(`たまった${costJP(sp.stock) || '資源'}を取る`);
  const title = parts.join('・') || sp.def.name;
  return { title, detail: eff && st ? st.text : undefined };
}

const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
/** 効果の手順（do）を「→」でつないだ短い説明（払う→得る の順のまま） */
export function opsText(ops: unknown[]): string {
  return ops.map((op) => opText(op as Record<string, unknown>)).filter(Boolean).join(' → ');
}
/** 効果が働くとき（when）の短い説明 */
export function whenText(when: string, name: (id: string) => string = (id) => id): string {
  const [w, a] = when.split(':');
  const arg = a && name(a);
  const JP: Record<string, string> = {
    use: '使う', fight: '戦うとき', win: '勝ったとき', lose: '負けたとき', round_start: 'ラウンドの始め', round_end: 'ラウンドの終わり', winter: '冬',
    game_end: '試合の終わり', setup: '準備', build: '建てたとき', hire: '仲間を雇ったとき', craft: '装備を作ったとき', sell: '売ったとき', buy: '買ったとき',
    trade: '取引したとき', donate: '寄進したとき', spell: '秘術を使ったとき', tame: '使い魔にしたとき', play: '出したとき', passive: 'いつも', occ: '職能を出したとき', quest: '依頼を達成したとき',
  };
  if (w === 'use' && arg) return `${arg}を使うとき`;
  if (w === 'instead' && arg) return `${arg}の代わりに`;
  if (w === 'other' && arg) return `ほかの人が${arg}を使ったとき`;
  if (w === 'win_race' && arg) return `${arg}に勝ったとき`;
  return JP[w] ?? when;
}

function opText(op: Record<string, unknown>): string {
  const k = Object.keys(op)[0];
  const v = op[k] as never;
  switch (k) {
    case 'gain': return `${costJP(v)}を得る`;
    case 'pay': return `${costJP(v)}を払う`;
    case 'convert': return `${costJP((v as { from: Cost }).from)}→${costJP((v as { to: Cost }).to)}`;
    case 'fame': return `名声+${v}`;
    case 'first': return '先手になる';
    case 'hire': case 'hire_free': return `仲間+${v}`;
    case 'draw': { const d = v as { from: string; look: number; take: number }; return `${DRAW_JP[d.from] ?? d.from}を${d.look}枚見て${d.take}枚`; }
    case 'future': { const f = v as { rounds: number[]; gain: Cost }; return `次から${f.rounds.length}ラウンド${costJP(f.gain)}`; }
    case 'heal': return `負傷を${v}人回復`;
    case 'extra_worker': return 'もう1人置ける';
    case 'place_again': return 'もう一度使う';
    case 'tame': return '巣の魔物を戦わずに使い魔にする';
    case 'buy_card': { const b = v as { count: number; price: number }; return `品物を金貨${b.price}で${b.count}枚まで買う`; }
    case 'gain_pick': { const gp = v as { n: number }; return `好きな資源を${gp.n}つ`; }
    case 'draw_any': { const d = v as { from: string[]; look: number; take: number }; return `${d.from.map((f) => DRAW_JP[f] ?? f).join('・')}から山を1つ選び${d.look}枚見て${d.take}枚`; }
    case 'donate': { const d = v as { pay: Cost; fame: number }; return `${costJP(d.pay)}で名声${d.fame}`; }
    case 'craft': return v === 'armor' ? '防具を作る' : v === 'weapon' ? '武器を作る' : '武器か防具を作る';
    case 'build': return v === 'bed' ? '寝床を建てる' : v === 'wall' ? '防壁を建てる' : v === 'facility' ? '施設（道具）を建てる' : '寝床・防壁・施設のどれかを建てる';
    case 'train': return v === 'atk' ? '攻めの熟練+1' : v === 'def' ? '守りの熟練+1' : '熟練+1（攻めか守り）';
    case 'occ': return '職能を出す';
    case 'exchange': return '売るか買うを1回';
    case 'repair': return '遺物を修復';
    case 'relic': return `遺物を${v}枚引く`;
    case 'gain_per': { const g = v as { gain: Cost }; return `${costJP(g.gain)}（数に応じて）`; }
    case 'fame_per': return '名声（数に応じて）';
    case 'others_gain': return `他の人全員が${costJP(v)}を得る`;
    case 'power': return `戦力${sign(v)}`;
    case 'guard': return `守り${sign(v)}`;
    case 'counter': return `反撃${sign(v)}`;
    case 'loot': return `戦利品${sign(v)}`;
    case 'trophy': return `討伐の名声${sign(v)}`;
    case 'str': return `魔物の強さ${sign(v)}`;
    case 'no_injury': return `負傷を${v}人防ぐ`;
    case 'steal_gain': return `${costJP(v)}を得る`;
    case 'ignore_full': return '定員の埋まった巣にも置ける';
    default: return '';
  }
}
const DRAW_JP: Record<string, string> = { occ: '職能', item: '品物', weapon: '武器', armor: '防具', equip: '武器・防具', tool: '道具', spell: '秘術', ancient: '遺物' };
