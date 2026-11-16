// AIプレイヤー（Python版 ai.py の移植）。ヒューリスティック評価＋1手先読み。
// 評価関数 evaluate は Python 版と数値が一致することをテストで確認している。乱数（ノイズ）は別系統。
import {
  COIN_PER_FOOD, FEED_ADULT, FEED_BABY, MAX_FAMILY, NUM_ROUNDS, RAW_FOOD, RES, ROOM_COST, ANIMALS,
  type Cost, type Res,
} from './data.js';
import {
  apply, clonePlayer, cloneFor, cookRates, grainTotal, houseAnimals, score, trade,
  type GameState, type Move, type Player,
} from './engine.js';

export type Weights = Record<string, number>;
export const DEFAULT_W: Weights = {
  act: 1.2, fv: 0.7, short: 2.0,
  wood: 0.35, clay: 0.35, stone: 0.6, coin: 0.12,
  grain: 0.3, veg: 0.3, sheep: 0.3, pig: 0.3, cattle: 0.3,
  efield: 1.0, pcap: 0.25, room: 2.0, cook: 0.8, imp: 0.5, breed: 0.6, roomprog: 1.5,
  stonehouse: 0.0, fam: 0.0,
};
/** バランステストで調整済みの重み（best_w.json） */
export const TUNED_W: Weights = {
  act: 2.752, fv: 1.051, short: 0.728, wood: 0.7, clay: 0.252, stone: 0.2, coin: 0.0, grain: 0.3,
  veg: 0.2, sheep: 0.748, pig: 0.8, cattle: 0.3, efield: 0.35, pcap: 0.475, room: 8, cook: 0.56,
  imp: 0.63, breed: 0.6, roomprog: 3, stonehouse: 0.2, fam: 10,
};

const ONGOING = new Set(['teoshi', 'suki', 'taihi', 'onshitsu', 'youmou', 'kunsei', 'chichi', 'kaju', 'hachi',
  'yagura', 'keiryo', 'souko', 'ushigoya', 'butagoya', 'inu', 'yurikago', 'shokutaku',
  'suiro', 'kyoka', 'bofu', 'makigoya', 'kura', 'ido', 'ishigama']);

const pymod = (a: number, b: number) => ((a % b) + b) % b;

export function wintersLeft(g: GameState) {
  return [4, 8, 12].filter((w) => w >= g.round).length;
}

export function evaluate(g: GameState, p: Player, W: Weights) {
  const rl = NUM_ROUNDS - g.round;
  const dec = Math.min(1.0, rl / 3.0);
  let v = score(p);
  const res = p.res;
  v += pymod(grainTotal(p), 2) * 0.4 + pymod(res.sheep, 2) * 0.4 + pymod(res.coin, 4) * 0.2;
  v += W.fam * p.family * rl / 8.0;
  v += W.act * (p.avail + rl * p.family - 0);
  const wl = wintersLeft(g);
  const needNext = wl ? (FEED_ADULT * (p.family - p.born_year) + FEED_BABY * p.born_year) : 0;
  const needAll = needNext + FEED_ADULT * p.family * Math.max(0, wl - 1);
  const rates = cookRates(p);
  const cookable = (['grain', 'veg', 'sheep', 'pig', 'cattle'] as const).reduce((s, k) => s + res[k] * rates[k], 0);
  v -= W.fv * Math.max(0, needAll - res.food);
  v += 0.1 * Math.max(0, res.food - needAll);
  const near = Math.max(0, needNext - res.food - 0.6 * cookable - res.coin / COIN_PER_FOOD);
  const urgency = 1.0 + (g.round % 4 ? g.round % 4 : 4) / 2.0;
  v -= W.short * near * urgency / 3.0;
  for (const r of ['wood', 'clay', 'stone'] as const) v += W[r] * res[r] * dec;
  v += W.coin * res.coin * dec;
  for (const r of ['grain', 'veg', 'sheep', 'pig', 'cattle'] as const) v += W[r] * Math.min(res[r], 4) * dec;
  const empty = p.fields.filter((f) => f[1] === 0).length;
  v += W.efield * Math.min(empty, res.grain + res.veg + 1) * dec;
  const cap = p.pastures * 2 + 1;
  v += W.pcap * Math.max(0, Math.min(4, cap - (res.sheep + res.pig + res.cattle))) * dec;
  if (p.family < MAX_FAMILY && rl >= 2) v += W.room * Math.min(1, p.rooms - p.family);
  if (p.family < MAX_FAMILY && p.rooms <= p.family && rl >= 2) {
    const [[mr, mc]] = Object.entries(ROOM_COST[p.house]);
    v += W.roomprog * Math.min(1.0, res[mr as Res] / mc!);
  }
  if (p.house !== 'stone' && rl >= 1) {
    const nxt = p.house === 'wood' ? 'clay' : 'stone';
    v += W.stonehouse * Math.min(1.0, res[nxt] / (2 * p.rooms));
  }
  for (const t of ANIMALS) if (res[t] >= 2) v += W.breed * dec;
  if (rates !== RAW_FOOD) v += W.cook * wl;
  v += W.imp * p.imps.filter((i) => ONGOING.has(i)).length * (rl / 4.0);
  return v;
}

// ---- 乱数（再現可能な軽量PRNG） ----
export function makeRng(seed: number) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = (mu: number, sigma: number) => {
    const u = 1 - next(), w = next();
    return mu + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * w);
  };
  const choice = <T>(a: T[]) => a[Math.floor(next() * a.length)];
  const shuffle = <T>(a: T[]) => {
    const b = [...a];
    for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
    return b;
  };
  return { next, gauss, choice, shuffle };
}
export type Rng = ReturnType<typeof makeRng>;

export type Level = 'random' | 'novice' | 'mid' | 'expert';
const NOISE: Record<Level, number> = { random: 0, novice: 1.5, mid: 0.6, expert: 0.1 };

export class AI {
  W: Weights;
  noise: number;
  rng: Rng;
  tradeOn: boolean;
  constructor(public level: Level = 'mid', W?: Weights, seed = 1, tradeOn = true) {
    this.W = { ...DEFAULT_W, ...(level === 'novice' ? {} : W ?? {}) };
    this.noise = NOISE[level];
    this.rng = makeRng(seed);
    this.tradeOn = tradeOn && level !== 'random';
  }

  choose(g: GameState, p: Player, opts: Move[]): Move {
    if (this.level === 'random') {
      const sids = [...new Set(opts.map(([s]) => s))].sort();
      const sid = this.rng.choice(sids);
      return this.rng.choice(opts.filter((o) => o[0] === sid));
    }
    let best: Move | null = null, bv = -1e9;
    for (const [sid, opt] of opts) {
      const g2 = cloneFor(g, p.pid);
      const p2 = g2.players[p.pid];
      apply(g2, p2, sid, structuredClone(opt));
      p2.avail -= 1;
      const v = evaluate(g2, p2, this.W) + this.rng.gauss(0, this.noise);
      if (v > bv) { best = [sid, opt]; bv = v; }
    }
    return best!;
  }

  marginals(g: GameState, p: Player) {
    const base = evaluate(g, p, this.W);
    const plus: Partial<Record<Res, number>> = {}, minus: Partial<Record<Res, number>> = {};
    for (const r of RES) {
      p.res[r] += 1;
      plus[r] = evaluate(g, p, this.W) - base;
      p.res[r] -= 1;
      if (p.res[r] > 0) {
        p.res[r] -= 1;
        minus[r] = base - evaluate(g, p, this.W);
        p.res[r] += 1;
      }
    }
    return { plus, minus };
  }

  tradeGain(g: GameState, p: Player, give: Cost, get: Cost) {
    const base = evaluate(g, p, this.W);
    const q = clonePlayer(p);
    for (const [r, n] of Object.entries(give)) q.res[r as Res] -= n!;
    for (const [r, n] of Object.entries(get)) q.res[r as Res] += n!;
    if (Object.values(q.res).some((v) => v < 0)) return -99;
    const g2 = cloneFor(g, p.pid);
    g2.players[p.pid] = q;
    houseAnimals(q);
    return evaluate(g2, q, this.W) - base;
  }

  /** 相手 p が give を渡し get を求める提案を、自分が受けるか */
  accept(g: GameState, p: Player, give: Cost, get: Cost) {
    if (!this.tradeOn) return false;
    const thr = this.level === 'expert' ? 0.3 : 0.0;
    return this.tradeGain(g, p, give, get) + this.rng.gauss(0, this.noise * 0.3) > thr;
  }

  /** 自分の手番の最初に出す取引提案の候補（良い順）。相手の AI は ais[pid] で与える */
  tradeCandidates(g: GameState, p: Player, ais: (AI | null)[]) {
    const { plus: mp, minus: mm } = this.marginals(g, p);
    const cand: [number, Player, Cost, Cost][] = [];
    for (const o of g.players) {
      if (o === p) continue;
      const oai = ais[o.pid];
      if (!oai) continue;
      const { plus: omp, minus: omm } = oai.marginals(g, o);
      for (const x of Object.keys(mm) as Res[]) {
        for (const y of Object.keys(omm) as Res[]) {
          if (x === y) continue;
          for (const [nx, ny] of [[1, 1], [2, 1], [1, 2], [3, 1], [1, 3]]) {
            if (p.res[x] < nx || o.res[y] < ny) continue;
            const mine = ny * mp[y]! - nx * mm[x]!;
            const theirs = nx * omp[x]! - ny * omm[y]!;
            if (mine > 0.4 && theirs > 0.2) cand.push([mine, o, { [x]: nx }, { [y]: ny }]);
          }
        }
      }
    }
    cand.sort((a, b) => b[0] - a[0]);
    return cand.slice(0, 6);
  }

  /** AI 同士の対戦用：取引フェイズを自動で行う（Python版 trade_phase と同じ手順） */
  tradePhase(g: GameState, p: Player, ais: (AI | null)[]) {
    if (!this.tradeOn || p.avail !== p.family) return;
    const tries = 1 + (p.char === 'aya' ? 1 : 0) + (p.imps.includes('kyoka') ? 1 : 0);
    let done = 0;
    for (const [, o, give, get] of this.tradeCandidates(g, p, ais)) {
      if (done >= tries) break;
      const [[gx, gn]] = Object.entries(give);
      const [[ry, rn]] = Object.entries(get);
      if (p.res[gx as Res] < gn! || o.res[ry as Res] < rn!) continue;
      if (this.tradeGain(g, p, give, get) <= 0.3) continue;
      if (ais[o.pid]!.accept(g, o, get, give)) { trade(g, p, o, give, get); done += 1; }
    }
  }
}
