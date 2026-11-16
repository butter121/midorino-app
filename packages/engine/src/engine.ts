// ミドリノ谷の四季 - ルールエンジン（Python版 engine.py を1対1で移植）
// 状態はすべてJSONにそのまま保存できる「ただのオブジェクト」で持つ（サーバー保存・同期のため）。
import {
  ACT, ACTIONS, ACC_CLAY, ACC_STONE, ACC_WOOD, ANIMALS, BASE_PRICE, BASIC_IDS, BEG_PENALTY,
  BIG_COOK_FOOD, COIN_PER_FOOD, COOK_FOOD, DISPLAY_SIZE, DIVERSITY, FARM_PLOTS, FEED_ADULT,
  FEED_BABY, FIELD_SCORE_CAP, GOODS, IMPROVEMENTS, MARKET_BUY_LIMIT, MARKET_SPACES, MAX_FAMILY,
  NUM_ROUNDS, PASTURE_COST, PASTURE_PER_PLOT, PASTURE_SCORE_CAP, PRICE_MIN, PRICE_SPAN, RAW_FOOD,
  RENO_COST, RENO_FEE, RES, ROOM_COST, SEASONS, SEAT_BONUS, SOW_YIELD, START_COIN, START_FOOD,
  WEATHER_BY_ID, basicCopies,
  type Animal, type Cost, type Good, type House, type Res, type Season,
} from './data.js';

export type Field = [string | null, number];
export interface Player {
  pid: number; char: string; res: Record<Res, number>; rooms: number; house: House;
  fields: Field[]; pastures: number; family: number; born_year: number; avail: number;
  imps: string[]; begging: number; shield: number; ido_left: number; nana_used: boolean;
  trade_coin: number; once: string[]; yearly: string[];
}
export interface GameState {
  n: number; players: Player[]; spaces: string[];
  accum: Record<string, Cost>; occ: Record<string, number>; closed: string[];
  prices: Record<Good, number>;
  weather: string[];   // 隠し情報（12ラウンド分）
  deck: string[];      // 隠し情報（発展設備の山札。末尾から引く）
  display: string[]; stock: Record<string, number>;
  first: number; round: number; trades: number;
  logs: string[]; logOn: boolean; errors: string[];
}
// 手の選択肢。sid ごとに形が異なる（Python版と同じ形をJSON配列で表す）
export type SellBuy = [Good, number][];
export type Opt = null | number | string | number[] | [SellBuy, SellBuy];
export type Move = [string, Opt];

// ------------------------------------------------------------ Player
export function newPlayer(pid: number, char: string): Player {
  const res = Object.fromEntries(RES.map((r) => [r, 0])) as Record<Res, number>;
  return {
    pid, char, res, rooms: 2, house: 'wood', fields: [], pastures: 0, family: 2, born_year: 0,
    avail: 0, imps: [], begging: 0, shield: 0, ido_left: 0, nana_used: false, trade_coin: 0,
    once: [], yearly: [],
  };
}
export const clonePlayer = (p: Player): Player => ({
  ...p, res: { ...p.res }, fields: p.fields.map((f) => [f[0], f[1]] as Field),
  imps: [...p.imps], once: [...p.once], yearly: [...p.yearly],
});
export const has = (p: Player, imp: string) => p.imps.includes(imp);
const addTo = (arr: string[], x: string) => { if (!arr.includes(x)) arr.push(x); };
const ceilDiv = (a: number, b: number) => -Math.floor(-a / b);   // Python の -(-a // b)

export const freePlots = (p: Player) => FARM_PLOTS - p.rooms - p.fields.length - p.pastures;

export function cookRates(p: Player) {
  if (has(p, 'okamado')) return BIG_COOK_FOOD;
  if (has(p, 'kamado') || p.char === 'momo') return COOK_FOOD;
  return RAW_FOOD;
}
export function foodRate(p: Player, good: 'grain' | 'veg' | Animal) {
  let r = cookRates(p)[good];
  if (good === 'pig' && has(p, 'kunsei')) r += 1;
  return r;
}
export const sheepPerPlot = (p: Player) =>
  PASTURE_PER_PLOT + (p.char === 'haru' ? 1 : 0) + (has(p, 'inu') ? 1 : 0);

export function plotsNeeded(p: Player, counts: Record<Animal, number>) {
  const per: Record<Animal, number> = { sheep: sheepPerPlot(p), pig: PASTURE_PER_PLOT, cattle: PASTURE_PER_PLOT };
  const rem = { ...counts };
  if (has(p, 'butagoya')) rem.pig = Math.max(0, rem.pig - 2);
  if (has(p, 'ushigoya')) rem.cattle = Math.max(0, rem.cattle - 2);
  const base = Object.fromEntries(ANIMALS.map((t) => [t, ceilDiv(rem[t], per[t])])) as Record<Animal, number>;
  const tot = ANIMALS.reduce((s, t) => s + base[t], 0);
  let best = tot;
  for (const t of ANIMALS) {   // 家の中でペット1頭
    if (rem[t] > 0) best = Math.min(best, tot - base[t] + ceilDiv(rem[t] - 1, per[t]));
  }
  return best;
}
export const animalCounts = (p: Player): Record<Animal, number> =>
  ({ sheep: p.res.sheep, pig: p.res.pig, cattle: p.res.cattle });
export const animalsFit = (p: Player, counts = animalCounts(p)) => plotsNeeded(p, counts) <= p.pastures;
export const grainTotal = (p: Player) => p.res.grain + p.fields.reduce((s, [k, n]) => s + (k === 'grain' ? n : 0), 0);
export const vegTotal = (p: Player) => p.res.veg + p.fields.reduce((s, [k, n]) => s + (k === 'veg' ? n : 0), 0);

export function pay(p: Player, cost: Cost) {
  for (const [r, n] of Object.entries(cost)) p.res[r as Res] -= n!;
}
export const canPay = (p: Player, cost: Cost) =>
  Object.entries(cost).every(([r, n]) => p.res[r as Res] >= n!);

export interface ScoreBreakdown {
  fields: number; pastures: number; grain: number; veg: number; sheep: number; pig: number;
  cattle: number; diversity: number; house: number; family: number; imps: number; coin: number;
  empty: number; begging: number;
}
export function scoreBreakdown(p: Player): { total: number; breakdown: ScoreBreakdown } {
  const g = grainTotal(p), v = vegTotal(p);
  const s = p.res.sheep, pg = p.res.pig, ca = p.res.cattle;
  const kinds = [g, v, s, pg, ca].filter((x) => x > 0).length;
  const b: ScoreBreakdown = {
    fields: Math.min(FIELD_SCORE_CAP, p.fields.length),
    pastures: Math.min(PASTURE_SCORE_CAP, p.pastures),
    grain: Math.floor(g / 2),
    veg: v,
    sheep: p.char === 'haru' ? s : Math.floor(s / 2),
    pig: pg,
    cattle: ca * 2,
    diversity: DIVERSITY[kinds] ?? 0,
    house: p.rooms * { wood: 0, clay: p.char === 'mina' ? 2 : 1, stone: 2 }[p.house],
    family: p.family * 3,
    imps: p.imps.reduce((t, i) => t + IMPROVEMENTS[i].vp, 0),
    coin: Math.floor(p.res.coin / 4),
    empty: freePlots(p) ? -freePlots(p) : 0,
    begging: p.begging ? -BEG_PENALTY * p.begging : 0,
  };
  const total = Object.values(b).reduce((x, y) => x + y, 0);
  return { total, breakdown: b };
}
export const score = (p: Player) => scoreBreakdown(p).total;

// ------------------------------------------------------------ Game
export interface Setup { n: number; chars: string[]; weather: string[]; deck: string[] }

/** 新しいゲーム。weather（12枚）と deck（山札、末尾から引く）はサーバーが乱数で決めて渡す */
export function newGame(setup: Setup, log = false): GameState {
  const { n, chars } = setup;
  const spaces = ACTIONS.filter((a) => (a.min_p ?? 0) <= n).map((a) => a.id);
  const deck = [...setup.deck];
  const display: string[] = [];
  for (let i = 0; i < DISPLAY_SIZE; i++) display.push(deck.pop()!);
  const g: GameState = {
    n, players: chars.map((c, i) => newPlayer(i, c)), spaces,
    accum: Object.fromEntries(spaces.filter((s) => ACT[s].accum).map((s) => [s, {}])),
    occ: Object.fromEntries(spaces.map((s) => [s, 0])),
    closed: [], prices: { ...BASE_PRICE }, weather: [...setup.weather], deck, display,
    stock: basicCopies(n), first: 0, round: 0, trades: 0, logs: [], logOn: log, errors: [],
  };
  g.players.forEach((p, i) => {
    p.res.food = START_FOOD + SEAT_BONUS[n][i];
    p.res.coin = START_COIN[i];
    const c = p.char;
    if (c === 'goro') p.res.wood += 2;
    if (c === 'gan') p.res.stone += 2;
    if (c === 'leo') p.res.coin += 2;
    if (c === 'haru') { p.res.sheep += 1; p.pastures += 1; }
    if (c === 'sana') p.res.grain += 1;
    if (c === 'yuki') p.res.food += 3;
    if (c === 'aya') p.res.coin += 3;
  });
  return g;
}

/** 1ラウンド目の配置前のラウンド番号 */
function log(g: GameState, msg: string) { if (g.logOn) g.logs.push(msg); }

export const season = (g: GameState, r?: number): Season => SEASONS[((r || g.round) - 1) % 4];
export const curWeather = (g: GameState) => g.weather[g.round - 1];
export const isActive = (g: GameState, sid: string) => (ACT[sid].from_round ?? 1) <= g.round;
export const roundsLeft = (g: GameState) => NUM_ROUNDS - g.round;

/** AI の先読み用：pid のプレイヤーだけ複製した状態（Python版 clone_for と同じ） */
export function cloneFor(g: GameState, pid: number): GameState {
  const c: GameState = {
    ...g,
    accum: Object.fromEntries(Object.entries(g.accum).map(([k, v]) => [k, { ...v }])),
    occ: { ...g.occ }, prices: { ...g.prices }, display: [...g.display], deck: [...g.deck],
    stock: { ...g.stock }, players: [...g.players], logOn: false, logs: g.logs, errors: g.errors,
  };
  c.players[pid] = clonePlayer(g.players[pid]);
  return c;
}
export const cloneGame = (g: GameState): GameState => structuredClone(g);

// ------------------------------------------------------------ 悪天候の防御
export function isProtected(g: GameState, p: Player, wid: string) {
  const w = WEATHER_BY_ID[wid];
  if (w.crop && has(p, 'kura')) return true;
  if ((wid === 'taifu' || wid === 'nagaame') && has(p, 'bofu')) return true;
  if ((wid === 'oyuki' || wid === 'kanpa') && has(p, 'makigoya')) return true;
  if (p.shield > 0) {
    p.shield -= 1;
    log(g, `  P${p.pid} は ${w.name} を無効化`);
    return true;
  }
  return false;
}

// ------------------------------------------------------------ 進行
export function startRound(g: GameState) {
  const w = curWeather(g);
  log(g, `=== ラウンド${g.round} 天候:${WEATHER_BY_ID[w].name}`);
  if (season(g) === 'spring') {
    for (const p of g.players) {
      p.yearly = [];
      p.shield = (p.char === 'yuki' ? 2 : 0) + (has(p, 'yagura') ? 1 : 0);
    }
  }
  for (const s of Object.keys(g.accum)) {
    if (isActive(g, s)) {
      for (const [r, n] of Object.entries(ACT[s].accum!)) {
        g.accum[s][r as Res] = (g.accum[s][r as Res] ?? 0) + n!;
      }
    }
  }
  const bonusTable: Record<string, [string, Res, number][]> = {
    yoshun: [['forest', 'wood', 1], ['claypit', 'clay', 1]],
    yukidoke: [['river', 'food', 2]], yudachi: [['quarry', 'stone', 1]],
    mosho: [['river', 'food', 2]], wataridori: [['river', 'food', 3]],
  };
  for (const [s, r, n] of bonusTable[w] ?? []) g.accum[s][r] = (g.accum[s][r] ?? 0) + n;
  const shiftTable: Record<string, [Good, number][]> = {
    hanabie: [['veg', 1]], hideri: [['grain', 2], ['veg', 1]], mosho: [['sheep', -1]],
    hosaku: [['grain', -1], ['veg', -1]], kanpa: [['wood', 2]],
  };
  for (const [gd, d] of shiftTable[w] ?? []) {
    g.prices[gd] = Math.min(BASE_PRICE[gd] + PRICE_SPAN, Math.max(PRICE_MIN, g.prices[gd] + d));
  }
  g.closed = w === 'fubuki' ? ['quarry'] : [];
  for (const s of Object.keys(g.occ)) g.occ[s] = 0;
  for (const p of g.players) {
    p.avail = p.family;
    p.trade_coin = 0;
    p.once = [];
    if (p.char === 'aya' && season(g) === 'spring') p.res.coin += 2;
    if (p.ido_left > 0) { p.ido_left -= 1; p.res.food += 1; }
  }
}

/** 手番順（このラウンドの先手から時計回り） */
export const turnOrder = (g: GameState) => Array.from({ length: g.n }, (_, i) => (g.first + i) % g.n);

/** 次に置く人。after は直前に置いた人（ラウンド最初は null）。全員置き終わっていれば null */
export function nextActor(g: GameState, after: number | null): number | null {
  const order = turnOrder(g);
  if (!g.players.some((p) => p.avail > 0)) return null;
  let idx = after === null ? 0 : order.indexOf(after) + 1;
  for (let k = 0; k < g.n; k++) {
    const pid = order[(idx + k) % g.n];
    if (g.players[pid].avail > 0) return pid;
  }
  return null;
}

export function endRound(g: GameState) {
  const w = curWeather(g), s = season(g);
  if (w === 'osojimo') {
    for (const p of g.players) {
      if (p.fields.some(([k, n]) => k === 'grain' && n > 0) && !isProtected(g, p, w)) {
        for (const f of p.fields) if (f[0] === 'grain' && f[1] > 0) f[1] = Math.max(0, f[1] - 2);
      }
    }
  }
  if (s === 'summer') {
    for (const p of g.players) {
      harvest(g, p, s, w);
      if (has(p, 'hachi')) { p.res.food += 1; p.res.coin += 1; }
    }
  } else if (s === 'autumn') {
    for (const p of g.players) {
      if (w === 'taifu' && p.fields.some(([, n]) => n > 0) && !isProtected(g, p, w)) {
        for (const f of p.fields) if (f[1] > 0) f[1] -= 1;
      }
      harvest(g, p, s, w);
      breed(p, w);
      if (has(p, 'youmou')) p.res.coin += Math.floor(p.res.sheep / 2);
      if (has(p, 'chichi')) p.res.food += Math.min(3, p.res.cattle);
      if (has(p, 'kaju')) p.res.food += 2;
    }
  } else if (s === 'winter') {
    for (const p of g.players) feed(g, p, w);
    for (const p of g.players) p.born_year = 0;
    if (g.display.length) g.display.shift();
    while (g.display.length < DISPLAY_SIZE && g.deck.length) g.display.push(g.deck.pop()!);
  }
  for (const gd of GOODS) {
    const b = BASE_PRICE[gd];
    g.prices[gd] += Number(b > g.prices[gd]) - Number(b < g.prices[gd]);
  }
  for (const p of g.players) for (const f of p.fields) if (f[1] === 0) f[0] = null;
  g.first = (g.first + 1) % g.n;
  for (const p of g.players) {
    for (const [r, v] of Object.entries(p.res)) if (v < 0) g.errors.push(`R${g.round} P${p.pid}: ${r} が負 (${v})`);
    if (freePlots(p) < 0) g.errors.push(`R${g.round} P${p.pid}: 区画オーバー`);
    if (!animalsFit(p)) g.errors.push(`R${g.round} P${p.pid}: 家畜があふれている`);
  }
}

export function harvest(g: GameState, p: Player, s: Season, w: string) {
  let noGrain = (s === 'summer' && w === 'hideri') || (s === 'autumn' && w === 'nagaame');
  let noVeg = s === 'summer' && w === 'hideri';
  if (noGrain && p.fields.some(([k, n]) => (k === 'grain' || noVeg) && n > 0)) {
    noGrain = !isProtected(g, p, w);   // 注意：防いでも野菜の「収穫なし」は残る（Python版と同じ）
  } else {
    noGrain = noVeg = false;
  }
  const bonus = (s === 'summer' && w === 'megumi') || (s === 'autumn' && w === 'hosaku');
  let gf = 0, vf = 0;
  for (const f of p.fields) {
    const [k, n] = f;
    if (n <= 0) continue;
    if ((k === 'grain' && noGrain) || (k === 'veg' && noVeg)) continue;
    const take = Math.min(n, bonus ? 2 : 1);
    f[1] -= take;
    p.res[k as Res] += take + (bonus ? 1 : 0);
    if (k === 'grain') gf += 1; else vf += 1;
  }
  if (s === 'summer') {
    if (has(p, 'suiro')) p.res.grain += Math.min(2, gf);
    if (has(p, 'onshitsu')) p.res.veg += Math.min(2, vf);
  }
}

export function breed(p: Player, w: string) {
  let double = w === 'akibare';
  for (const t of ['cattle', 'pig', 'sheep'] as Animal[]) {
    if (p.res[t] >= 2) {
      const c = animalCounts(p);
      c[t] += 1;
      if (animalsFit(p, c)) {
        p.res[t] += 1;
        if (double) {
          c[t] += 1;
          if (animalsFit(p, c)) { p.res[t] += 1; double = false; }
        }
      }
    }
  }
}

export function feedNeed(p: Player, w: string) {
  const adults = p.family - p.born_year;
  let need = FEED_ADULT * adults + FEED_BABY * p.born_year;
  if (w === 'dantou') need -= adults;
  if (has(p, 'shokutaku')) need -= 1;
  if (p.char === 'momo') need -= 1;
  return Math.max(0, need);
}

export function feed(g: GameState, p: Player, w: string) {
  let need = feedNeed(p, w);
  if (w === 'oyuki' && !isProtected(g, p, w)) need += p.family;
  if (w === 'kanpa' && !isProtected(g, p, w)) {
    const paid = Math.min(2, p.res.wood);
    p.res.wood -= paid;
    need += 2 * (2 - paid);
  }
  payFood(g, p, need);
}

/** 不足分を最も失点の少ない方法で自動変換（アプリの自動支払い） */
export function payFood(g: GameState, p: Player, need: number) {
  if (has(p, 'ishigama')) {
    const k = Math.min(3, p.res.grain, Math.max(0, ceilDiv(need - p.res.food, 4)));
    p.res.grain -= k;
    p.res.food += 4 * k;
  }
  while (p.res.food < need) {
    const base = score(p);
    let best: [number, string, number] | null = null;
    for (const gd of ['grain', 'veg', 'sheep', 'pig', 'cattle'] as const) {
      if (p.res[gd] > 0) {
        p.res[gd] -= 1;
        const loss = base - score(p);
        p.res[gd] += 1;
        const rate = foodRate(p, gd);
        const key = (loss + 0.05) / rate;
        if (best === null || key < best[0]) best = [key, gd, rate];
      }
    }
    if (p.res.coin >= COIN_PER_FOOD) {
      p.res.coin -= COIN_PER_FOOD;
      const loss = base - score(p);
      p.res.coin += COIN_PER_FOOD;
      const key = (loss + 0.05) / 1;
      if (best === null || key < best[0]) best = [key, 'coin', 1];
    }
    if (best === null || best[0] > BEG_PENALTY) break;
    const [, gd, rate] = best;
    p.res[gd as Res] -= gd === 'coin' ? COIN_PER_FOOD : 1;
    p.res.food += rate;
  }
  if (p.res.food >= need) {
    p.res.food -= need;
  } else {
    p.begging += need - p.res.food;
    log(g, `  P${p.pid} 食料不足 ${need - p.res.food}`);
    p.res.food = 0;
  }
}

/** 置き場のない家畜は自動で食料にする */
export function houseAnimals(p: Player) {
  while (!animalsFit(p)) {
    for (const t of ANIMALS) {
      if (p.res[t] > 0) {
        p.res[t] -= 1;
        p.res.food += foodRate(p, t);
        break;
      }
    }
  }
}

// ------------------------------------------------------------ 合法手
export function plowN(g: GameState, p: Player, sid: string) {
  let n = 1 + (p.char === 'riku' && sid === 'plow' && !p.yearly.includes('riku') ? 1 : 0)
    + (curWeather(g) === 'hareten' ? 1 : 0);
  if (sid === 'plow' && has(p, 'suki')) n += 1;
  return Math.min(n, freePlots(p));
}

export function sowOpts(p: Player, empty: number): [number, number][] {
  const out: [number, number][] = [];
  for (let gr = 0; gr <= Math.min(p.res.grain, empty); gr++) {
    for (let v = 0; v <= Math.min(p.res.veg, empty - gr); v++) {
      if (gr + v > 0) out.push([gr, v]);
    }
  }
  return out;
}

export const roomCost = (p: Player): Cost => ({ ...ROOM_COST[p.house] });
export const fenceCost = (p: Player, k: number) => PASTURE_COST.wood * k - (p.char === 'goro' ? 1 : 0);
export function renoCost(p: Player): Cost {
  const nxt = p.house === 'wood' ? 'clay' : 'stone';
  const [[r, n]] = Object.entries(RENO_COST[nxt]);
  return { [r]: n! * p.rooms, coin: RENO_FEE.coin };
}

export function impCost(p: Player, imp: string): Cost {
  const c: Cost = { ...IMPROVEMENTS[imp].cost };
  if ((imp === 'kamado' || imp === 'okamado') && p.char === 'mina') c.clay = (c.clay ?? 0) - 1;
  if (imp === 'okamado' && p.char === 'momo') c.clay = (c.clay ?? 0) - 2;
  if (p.char === 'gan') {   // 設備の資材コスト合計3減（多い資材から。同数なら石材→粘土→木材の順）
    for (let i = 0; i < 3; i++) {
      const mats = (['stone', 'clay', 'wood'] as const).filter((r) => (c[r] ?? 0) > 0);
      if (mats.length) {
        let r = mats[0];
        for (const m of mats) if (c[m]! > c[r]!) r = m;
        c[r] = c[r]! - 1;
      }
    }
  }
  return c;
}

export function impOpts(g: GameState, p: Player): string[] {
  const out: string[] = [];
  for (const imp of BASIC_IDS) {
    if ((g.stock[imp] ?? 0) > 0 && !has(p, imp)) {
      if (canPay(p, impCost(p, imp))) out.push(imp);
      else if (imp === 'okamado' && has(p, 'kamado') && p.res.clay >= 2) out.push('okamado_x');
    }
  }
  for (const imp of g.display) {
    if (!has(p, imp) && canPay(p, impCost(p, imp))) out.push(imp);
  }
  return out;
}

export function sellPrice(g: GameState, p: Player, gd: Good) {
  let pr = g.prices[gd] - (p.char === 'leo' ? 0 : 1);
  if (curWeather(g) === 'fuyunoichi') pr += 1;
  return Math.max(1, pr);
}
export const buyPrice = (g: GameState, p: Player, gd: Good) =>
  Math.max(1, g.prices[gd] - (p.char === 'leo' ? 1 : 0));
export function sellValue(g: GameState, p: Player, sells: SellBuy) {
  let v = sells.reduce((s, [gd, q]) => s + sellPrice(g, p, gd) * q, 0);
  if (has(p, 'keiryo')) v += sells.length;
  return v;
}
export const marketBuyLimit = (p: Player) => MARKET_BUY_LIMIT + (has(p, 'souko') ? 2 : 0);

/** AI 用の代表的な市場の手（Python版 market_opts と同じ。人間の手は validateMarket で判定） */
export function marketOpts(g: GameState, p: Player): [SellBuy, SellBuy][] {
  const sells: SellBuy[] = [[]];
  for (const gd of GOODS) {
    const n = p.res[gd];
    if (n >= 1) {
      sells.push([[gd, 1]]);
      if (n >= 2) sells.push([[gd, n]]);
      if (n >= 4) sells.push([[gd, Math.floor(n / 2)]]);
    }
  }
  const lim = marketBuyLimit(p);
  const out: [SellBuy, SellBuy][] = [];
  for (const s of sells) {
    const coin = p.res.coin + sellValue(g, p, s);
    const sold = new Set(s.map(([gd]) => gd));
    if (s.length) out.push([s, []]);
    for (const gd of GOODS) {
      if (sold.has(gd)) continue;
      const pr = buyPrice(g, p, gd);
      for (let q = 1; q <= lim; q++) {
        if (pr * q > coin) break;
        if (s.length && pr * q <= p.res.coin) continue;
        out.push([s, [[gd, q]]]);
      }
    }
  }
  return out;
}

export function legal(g: GameState, p: Player): Move[] {
  const out: Move[] = [];
  for (const sid of g.spaces) {
    const a = ACT[sid];
    if (!isActive(g, sid) || g.closed.includes(sid)) continue;
    if (g.occ[sid] && !a.unlimited) continue;
    if (a.accum || ['start', 'daylabor', 'seed', 'lane', 'garden', 'peddler'].includes(sid)) {
      out.push([sid, null]);
    } else if (sid === 'plow2') {
      if (freePlots(p) > 0) out.push([sid, 1]);
    } else if (sid === 'plow') {
      const k = plowN(g, p, sid);
      if (k > 0) out.push([sid, k]);
    } else if (sid === 'sow') {
      const empty = p.fields.filter((f) => f[1] === 0).length;
      for (const o of sowOpts(p, empty)) out.push([sid, o]);
    } else if (sid === 'plowsow') {
      const k = plowN(g, p, sid);
      const empty = p.fields.filter((f) => f[1] === 0).length;
      for (const kk of k ? [0, k] : [0]) {
        for (const o of sowOpts(p, empty + kk)) out.push([sid, [kk, ...o]]);
      }
      if (k) out.push([sid, [k, 0, 0]]);
    } else if (sid === 'fence') {
      for (let k = 1; k <= freePlots(p); k++) {
        if (fenceCost(p, k) > p.res.wood) break;
        out.push([sid, k]);
      }
    } else if (sid === 'build') {
      const [[r, n]] = Object.entries(roomCost(p));
      const max = Math.min(freePlots(p), Math.floor(p.res[r as Res] / n!), 5 - p.rooms);
      for (let k = 1; k <= max; k++) out.push([sid, k]);
    } else if (sid === 'workshop') {
      for (const imp of impOpts(g, p)) out.push([sid, imp]);
    } else if (MARKET_SPACES.has(sid)) {
      for (const o of marketOpts(g, p)) out.push([sid, o]);
    } else if (sid === 'family' || sid === 'family2') {
      if (p.family < MAX_FAMILY && (p.rooms > p.family || (p.char === 'nana' && !p.nana_used))) out.push([sid, null]);
    } else if (sid === 'renovate') {
      if (p.house !== 'stone') {
        const cost = renoCost(p);
        if (canPay(p, cost)) {
          out.push([sid, null]);
          const q = clonePlayer(p);
          pay(q, cost);
          for (const imp of impOpts(g, q)) out.push([sid, imp]);
        }
      }
    }
  }
  return out;
}

// ------------------------------------------------------------ 実行
export function gain(p: Player, d: Cost) {
  for (const [r, n] of Object.entries(d)) p.res[r as Res] += n!;
}

export function acquire(g: GameState, p: Player, imp0: string) {
  let imp = imp0;
  if (imp === 'okamado_x') {
    p.imps = p.imps.filter((i) => i !== 'kamado');
    g.stock.kamado += 1;
    p.res.clay -= 2;
    imp = 'okamado';
  } else {
    pay(p, impCost(p, imp));
  }
  const di = g.display.indexOf(imp);
  if (di >= 0) {
    g.display.splice(di, 1);
    if (g.deck.length) g.display.push(g.deck.pop()!);
  } else {
    g.stock[imp] -= 1;
  }
  addTo(p.imps, imp);
  if (imp === 'shushi') { p.res.grain += 1; p.res.veg += 1; }
  if (imp === 'ido') p.ido_left = 5;
  if (imp === 'yagura' && season(g) !== 'winter') p.shield += 1;
  log(g, `  P${p.pid} 設備 ${IMPROVEMENTS[imp].name}`);
}

export function sow(g: GameState, p: Player, gr: number, v: number) {
  const extra = (has(p, 'taihi') ? 1 : 0) + (p.char === 'sana' ? 1 : 0) + (curWeather(g) === 'harusame' ? 2 : 0);
  for (const f of p.fields) {
    if (f[1] !== 0) continue;
    if (gr > 0) {
      f[0] = 'grain'; f[1] = SOW_YIELD.grain + extra; gr -= 1; p.res.grain -= 1;
    } else if (v > 0) {
      f[0] = 'veg'; f[1] = SOW_YIELD.veg + extra; v -= 1; p.res.veg -= 1;
    }
  }
}

export function apply(g: GameState, p: Player, sid: string, opt: Opt) {
  const a = ACT[sid];
  g.occ[sid] += 1;
  log(g, ` P${p.pid} -> ${a.name} ${opt === null ? '' : JSON.stringify(opt)}`);
  if (a.accum) {
    const got = g.accum[sid];
    g.accum[sid] = {};
    gain(p, got);
    let bonusR: Res | null = null;
    if (ACC_WOOD.has(sid)) {
      bonusR = 'wood';
      if (p.char === 'toma') p.res.wood += 1;
    }
    if (ACC_CLAY.has(sid)) {
      bonusR = 'clay';
      if (p.char === 'mina' && sid === 'claypit') p.res.clay += 1;
    }
    if (ACC_STONE.has(sid)) bonusR = 'stone';
    if (sid === 'river' && p.char === 'momo') p.res.food += 1;
    if (sid === 'sheep' && p.char === 'haru') p.res.sheep += 1;
    if (bonusR && has(p, 'teoshi')) p.res[bonusR] += 1;
    if (Object.keys(got).some((r) => (ANIMALS as readonly string[]).includes(r))) houseAnimals(p);
  }
  if (a.give) {
    gain(p, a.give);
  } else if (sid === 'plow2') {
    p.fields.push([null, 0]);
  } else if (sid === 'plow') {
    const k = opt as number;
    for (let i = 0; i < k; i++) p.fields.push([null, 0]);
    if (p.char === 'riku' && k > 1 + (has(p, 'suki') ? 1 : 0) + (curWeather(g) === 'hareten' ? 1 : 0)) addTo(p.yearly, 'riku');
  } else if (sid === 'sow') {
    const [gr, v] = opt as number[];
    sow(g, p, gr, v);
  } else if (sid === 'plowsow') {
    const [k, gr, v] = opt as number[];
    for (let i = 0; i < k; i++) p.fields.push([null, 0]);
    sow(g, p, gr, v);
  } else if (sid === 'fence') {
    p.res.wood -= fenceCost(p, opt as number);
    p.pastures += opt as number;
  } else if (sid === 'build') {
    for (let i = 0; i < (opt as number); i++) pay(p, roomCost(p));
    p.rooms += opt as number;
  } else if (sid === 'workshop') {
    acquire(g, p, opt as string);
  } else if (MARKET_SPACES.has(sid)) {
    const [sells, buys] = opt as [SellBuy, SellBuy];
    p.res.coin += sellValue(g, p, sells);
    for (const [gd, q] of sells) {
      p.res[gd] -= q;
      g.prices[gd] = Math.max(PRICE_MIN, g.prices[gd] - (q >= 4 ? 2 : 1));
    }
    for (const [gd, q] of buys) {
      p.res.coin -= buyPrice(g, p, gd) * q;
      p.res[gd] += q;
      g.prices[gd] = Math.min(BASE_PRICE[gd] + PRICE_SPAN, g.prices[gd] + (q >= 3 ? 2 : 1));
    }
    houseAnimals(p);
  } else if (sid === 'family' || sid === 'family2') {
    if (p.rooms <= p.family) p.nana_used = true;
    p.family += 1;
    p.born_year += 1;
    if (p.char === 'nana') p.res.food += 1;
    if (has(p, 'yurikago')) p.res.food += 2;
  } else if (sid === 'renovate') {
    pay(p, renoCost(p));
    p.house = p.house === 'wood' ? 'clay' : 'stone';
    if (opt) acquire(g, p, opt as string);
  }
}

// ------------------------------------------------------------ 取引
/** a が give を渡し、b から get を受け取る（検証は呼び出し側） */
export function trade(g: GameState, a: Player, b: Player, give: Cost, get: Cost) {
  for (const [r, n] of Object.entries(give)) { a.res[r as Res] -= n!; b.res[r as Res] += n!; }
  for (const [r, n] of Object.entries(get)) { b.res[r as Res] -= n!; a.res[r as Res] += n!; }
  g.trades += 1;
  for (const p of [a, b]) {
    const lim = (p.char === 'aya' ? 3 : 0) + (has(p, 'kyoka') ? 1 : 0);
    if (p.trade_coin < lim) { p.trade_coin += 1; p.res.coin += 1; }
    houseAnimals(p);
  }
  log(g, `  取引 P${a.pid}->P${b.pid} 渡す${JSON.stringify(give)} 受取${JSON.stringify(get)}`);
}
