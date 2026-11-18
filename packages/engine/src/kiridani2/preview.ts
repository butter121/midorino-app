// 霧谷の冒険者団 v2 — 画面のための見込み（盤面は変えない。複製の上で計算する）。
// 戦闘の勝つ見込み・必要な強さ・反撃と負傷の見込み、選択肢の短い説明。手元の試合でもオンラインの写しでも同じに動く。
import * as D from './data';
import { canPay, type Choice, type Game, type Option, type Player } from './engine';
import type { Cost, FightMode, Monster, Res } from './types';
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
}

/** 巣・主の巣に k 人で mode で挑んだときの見込み */
export function previewFight(g0: Game, p0: Player, o: Option): FightPreview | null {
  const g = g0.clone();
  const p = g.players[p0.pid];
  const k = o.k ?? 1;
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
  const need0 = mon.str - mon.wounds;
  const idxs = g.pickComps(p, k);
  const pl = g.makePlan(p, mon, idxs, mode === 'wait' ? 'wait' : mode, coop, need0 - acc);
  const strength = need0 + accStr + pl.str;
  const total = acc + pl.power;
  let pwin = 0;
  for (const [v, pr] of g.fateDist(fateOf)) if (total + v >= strength) pwin += pr;
  const guard = g.defense(p, pl);
  const counter = Math.max(0, mon.counter + pl.counter);
  const injuries = pl.rearAll ? 0 : Math.max(0, Math.min(idxs.length, counter - guard - pl.noInj));
  return {
    monster: mon, power: pl.power, partner: acc, need: strength, pwin, cost: pl.cost, boosts: pl.boosts, counter, guard, injuries, idxs,
    short: !canPay(p, pl.cost),
  };
}

const RES_JP: Record<Res, string> = D.RES_JP;
const costJP = (c: Cost) => RES.filter((r) => c[r]).map((r) => `${RES_JP[r]}${c[r]}`).join('・');

/** 細かい選択（交換所・作る装備・建てるもの・熟練など）の短い説明 */
export function choiceLabel(g: Game, p: Player | null, x: Choice): { title: string; detail?: string; card?: string; cost?: Cost } {
  if (typeof x === 'string') {
    if (x === 'bed') return { title: '寝床を建てる', detail: '仲間を増やせる数+1', cost: p ? g.bedCost(p) : D.BED_COST };
    if (x === 'wall') return { title: '防壁を建てる', detail: '冬の襲撃を1ずつ防ぐ・戦闘の守り（2つで+1）', cost: p ? g.wallCost(p) : D.WALL_COST };
    if (x === 'atk') return { title: '攻めの熟練+1', detail: '仲間1人の戦力+1' };
    if (x === 'def') return { title: '守りの熟練+1', detail: '仲間1人の守り+1' };
    if (g.byId.has(x)) {
      const c = g.card(x);
      const cost = p ? (c.kind === 'occ' ? g.occCost(p, x) : g.cardCost(p, x)) : c.cost ?? {};
      const stock = c.kind === 'gear' ? `（残り${g.gearStock[x] ?? 0}）` : '';
      return { title: `${c.name}${stock}`, detail: c.text, card: x, cost };
    }
    const nd = g.nest(x);
    if (nd?.mon) return { title: `${nd.mon.name}を使い魔にする`, detail: `${D.NEST_JP[x] ?? x}・強さ${nd.mon.str}` };
    return { title: x };
  }
  if (x.m === 'sell') return { title: `${RES_JP[x.r]}を${x.q}つ売る`, detail: `金貨+${(p ? g.sellPrice(p, x.r) : D.sellPrice(x.r)) * x.q}` };
  if (x.m === 'buy') return { title: `${RES_JP[x.r]}を${x.q}つ買う`, detail: `金貨-${D.BUY[x.r] * x.q}` };
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
  if (o.i === -1 && o.card) {
    const c = g.card(o.card);
    const sub = o.x !== undefined ? choiceLabel(g, p, o.x) : null;
    return { title: sub ? `${c.name}：${sub.title}` : `${c.name}の効果を使う`, detail: sub?.detail ?? c.text, card: sub?.card ?? o.card, cost: sub?.cost };
  }
  if (o.x !== undefined) return choiceLabel(g, p, o.x);
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
    case 'tame': return '獣を使い魔に';
    case 'donate': { const d = v as { pay: Cost; fame: number }; return `${costJP(d.pay)}で名声${d.fame}`; }
    case 'craft': return v === 'armor' ? '防具を作る' : v === 'weapon' ? '武器を作る' : '装備を作る';
    case 'build': return '建てる';
    case 'train': return '熟練+1';
    case 'occ': return '職能を出す';
    case 'exchange': return '売り買い';
    case 'gain_per': { const g = v as { gain: Cost }; return `${costJP(g.gain)}（数に応じて）`; }
    case 'fame_per': return '名声（数に応じて）';
    case 'others_gain': return `他の人全員が${costJP(v)}を得る`;
    default: return '';
  }
}
const DRAW_JP: Record<string, string> = { occ: '職能', item: '品物', weapon: '武具', tool: '道具', spell: '秘術', ancient: '古代の品' };
