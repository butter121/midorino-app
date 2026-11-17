// 霧谷の冒険者団 — ルールエンジン（Python 版 engine.py を1行ずつ写したもの）。
// ・数値はすべて data.ts（data.py から生成）から読む。
// ・乱数は rng.ts の MRandom（Python 側も同じ乱数に差し替えて記録を取り、結果が一致するのをテストで確かめる）。
// ・選択（ドラフト・キャラ・置く場所・使い魔にするか…）は人間なら yield で外に出し、AI ならその場で答える。
//   そのためゲームを進める関数はジェネレーター（function*）。AI の先読み（複製した盤面）では drive() で同期に回す。
// ・画面向けの出来事（GameEvent）は本物の盤面だけが出す（複製では this.E = null）。
import * as D from './data';
import type { Cost, Element, MonsterDef, Res, Season } from './data';
import { MRandom, pysumF } from './rng';
import type { GameEvent, PowerKind, PowerPart, ScoreItem, ScoreRow } from './types';

const {
  ACT, ACTIONS, BASE_PLOTS, BED_COST, BOSSES, BOSS_ROUNDS, CARDS, CHARACTERS, DRAFT_SHOW, FATE_DECK, FIXED_BUY, HIRE_FOOD, ITEMS,
  MARKETS, MARKET_BASE, MARKET_QTY, MARKET_SPAN, MAX_COMPANIONS, MAX_SKILL, MON, MONSTERS, NESTS, NEST_CAP, NUM_ROUNDS, OCC_IDS,
  ITEM_IDS, POWER_PER, QUESTS, QUEST_FAME, SEASONS, SEAT_FOOD, START_BEDS, START_COMPANIONS, START_FOOD, START_GOLD, TIDE, UPKEEP,
  WALL_COST, WEATHER, WEATHER_EL, WEAKNESS_BONUS, TIDE_BONUS,
} = D;

export type Opt = null | string | (string | number)[];
export type Option = [string, Opt];
export type Boost = [string, number, string | null];
export interface Plan {
  idxs: number[]; k: number; boosts: Boost[]; cost: Cost; els: Set<Element>; arrows: number; base: number; power: number;
  /** 画面用の戦力の内訳（本物の盤面だけ） */
  parts?: PowerPart[];
}
export interface Nest { mon: string | null; dmg: number; trap: number; slots: number; wait: { pid: number; plan: Plan } | null; trapper: number | null }
/** 人間の席の戦闘の選択：どの巣に何人で、何を使うか（boost_list の名前）、待ち伏せするか */
export interface FightPick { sid: string; k: number; boosts: string[]; wait?: boolean }
export interface LairEntry { pid: number; plan: Plan; idxs: number[] }

export const BASIC: Res[] = ['wood', 'iron', 'herb', 'mana', 'food', 'gold', 'mat'];
export const RES_VAL: Record<Res, number> = { wood: 0.4, iron: 0.6, herb: 0.45, mana: 0.9, food: 0.55, gold: 0.3, mat: 0.6 };
export const WEAPON_POWER: Record<string, number> = Object.fromEntries(ITEMS.filter((c) => c.kind === 'weapon').map((c) => [c.id, c.power ?? 0]));
export const WEAPON_EL: Record<string, Element> = Object.fromEntries(ITEMS.filter((c) => c.kind === 'weapon' && c.el).map((c) => [c.id, c.el!]));
export const WEAPON_DEF: Record<string, number> = Object.fromEntries(ITEMS.filter((c) => c.kind === 'weapon').map((c) => [c.id, c.defense ?? 0]));
export const REAR_CARDS = new Set(['o01', 'o02', 'o14', 'o30', 'i01']);
export const ITEMS_BY = Object.fromEntries(ITEMS.map((c) => [c.id, c]));

export const isDark = (m: MonsterDef) => m.race === 'undead' || m.weak === 'light';
export const isBeast = (m: MonsterDef) => m.race === 'beast';
export const compId = (seat: number, idx: number) => `c${seat}-${idx}`;

// ------------------------------------------------------------ 選択の問い合わせ
export type Req =
  | { k: 'draft'; g: Game; p: Player; cards: string[]; kind: 'occ' | 'item'; ingame: boolean }
  | { k: 'char'; g: Game; p: Player; options: string[] }
  | { k: 'choose'; g: Game; p: Player; opts: Option[] }
  | { k: 'hourglass'; g: Game; p: Player }
  | { k: 'tame'; g: Game; p: Player; m: MonsterDef }
  | { k: 'heal'; g: Game; p: Player }
  | { k: 'tan'; g: Game; p: Player }
  | { k: 'weather'; g: Game; p: Player }
  | { k: 'storm'; g: Game; p: Player; nr: number };
export type Gen<T = void> = Generator<Req, T, any>;

/** 席に座る者（AI）。人間の席は null で、選択は yield で外に出る */
export interface Brain {
  respond(req: Req): any;
  tradePhase?(g: Game, p: Player): void;
  marginals?(g: Game, p: Player): [Record<string, number>, Record<string, number>];
  accept?(g: Game, p: Player, give: Cost, get: Cost): boolean;
}

/** 人間の席の既定の答え（AI の先読みの中だけで使う。本物の盤面では人間に聞く） */
export function humanDefault(req: Req): any {
  switch (req.k) {
    case 'draft': return req.cards[0];
    case 'char': return req.options[0];
    case 'choose': return req.opts[0];
    case 'tame': return req.g.round <= 10;
    case 'weather': return null;
    default: return true;
  }
}
export const autoAnswer = (req: Req) => (req.p.ai ? req.p.ai.respond(req) : humanDefault(req));

/** ジェネレーターを同期で最後まで回す（人間の席には既定の答え） */
export function drive<T>(gen: Gen<T>): T {
  let r = gen.next();
  while (!r.done) r = gen.next(autoAnswer(r.value));
  return r.value;
}

// ------------------------------------------------------------ プレイヤー
export class Player {
  pid: number;
  ai: Brain | null;
  char: string | null = null;
  res: Record<Res, number> = Object.fromEntries(BASIC.map((r) => [r, 0])) as Record<Res, number>;
  skills: number[] = Array(START_COMPANIONS).fill(0);
  used = new Set<number>();
  rest = new Set<number>();
  injured = new Set<number>();
  extra = 0;
  beds = START_BEDS;
  walls = 0;
  tools: string[] = [];
  weapons: string[] = [];
  occs: string[] = [];
  hand: string[] = [];
  pets = 0;
  trophies = 0;
  quest_fame = 0;
  card_fame = 0;
  discontent = 0;
  unpaid = 0;
  st: Record<string, any> = { kills: 0, beast: 0, undead: 0, boss: 0, spells: 0, weak: 0, coop: 0, hires: 0 };
  yearly = new Set<string>();
  once = new Set<string>();
  fate: number[] = [...FATE_DECK];
  fights = 0;
  egg = 0;
  stats: Record<string, number> = {};
  char_opts: string[] = [];
  mana_round = 0;
  kills_log: [number, string][] = [];
  drafted: string[] = [];

  constructor(pid: number, ai: Brain | null) { this.pid = pid; this.ai = ai; }

  clone(): Player {
    const q = Object.create(Player.prototype) as Player;
    Object.assign(q, this);
    q.res = { ...this.res };
    q.skills = [...this.skills];
    q.used = new Set(this.used); q.rest = new Set(this.rest); q.injured = new Set(this.injured);
    q.tools = [...this.tools]; q.weapons = [...this.weapons]; q.occs = [...this.occs]; q.hand = [...this.hand];
    q.st = { ...this.st };
    q.yearly = new Set(this.yearly); q.once = new Set(this.once);
    q.fate = [...this.fate];
    return q;
  }

  has(c: string) { return this.occs.includes(c) || this.tools.includes(c) || this.weapons.includes(c); }
  get comps() { return this.skills.length; }
  free_idx(): number[] { const out: number[] = []; for (let i = 0; i < this.skills.length; i++) if (!this.used.has(i) && !this.rest.has(i)) out.push(i); return out; }
  avail() { return this.free_idx().length + this.extra; }
  bed_cap() { return this.beds + (this.tools.includes('i17') ? 2 : 0); }
  plots_used() { return this.beds + this.walls + this.tools.length; }
  skill_cap() { return MAX_SKILL + (this.occs.includes('o22') ? 1 : 0); }
}

// ------------------------------------------------------------ 支払い（o15 の代替払いを含む）
export function payPlan(p: Player, cost: Cost): Cost | null {
  const out: Record<string, number> = {};
  for (const [r, n] of Object.entries(cost)) if ((n as number) > 0) out[r] = (out[r] ?? 0) + (n as number);
  const have = p.res;
  if (p.occs.includes('o15')) {
    const shortH = Math.max(0, (out.herb ?? 0) - have.herb);
    if (shortH) {
      const m = Math.floor((shortH + 1) / 2);
      out.herb -= shortH;
      out.mana = (out.mana ?? 0) + m;
    }
    const shortM = Math.max(0, (out.mana ?? 0) - have.mana);
    if (shortM) {
      out.mana -= shortM;
      out.mat = (out.mat ?? 0) + shortM;
    }
  }
  for (const [r, n] of Object.entries(out)) if (have[r as Res] < n) return null;
  return out as Cost;
}
export const canPay = (p: Player, cost: Cost) => payPlan(p, cost) !== null;
export function pay(p: Player, cost: Cost): Cost {
  const plan = payPlan(p, cost);
  if (plan === null) throw new Error(`cannot pay ${JSON.stringify(cost)} ${JSON.stringify(p.res)}`);
  for (const [r, n] of Object.entries(plan)) p.res[r as Res] -= n as number;
  return plan;
}
export const costValue = (cost: Cost) => pysumF(Object.entries(cost).map(([r, n]) => RES_VAL[r as Res] * (n as number)));
export function add(p: Player, d: Cost, mult = 1) { for (const [r, n] of Object.entries(d)) p.res[r as Res] += (n as number) * mult; }
const addTo = (to: Record<string, number>, r: string, n: number) => { to[r] = (to[r] ?? 0) + n; };

// ------------------------------------------------------------ 得点
export interface Breakdown { trophies: number; quests: number; companions: number; cards: number; gold: number; discontent: number; raid: number; hero: number }
export function scoreBreakdown(p: Player, g: Game | null = null): Breakdown {
  const b: Breakdown = {
    trophies: p.trophies, quests: p.quest_fame, companions: p.comps * D.FAME_PER_COMPANION, cards: p.card_fame + cardEndFame(p),
    gold: Math.floor(p.res.gold / D.GOLD_PER_FAME), discontent: 0 - D.DISCONTENT * p.discontent, raid: 0 - p.unpaid, hero: 0,
  };
  if (g !== null && g.over) {
    const top = Math.max(...g.players.map((q) => q.trophies));
    b.hero = p.trophies > 0 && p.trophies === top ? D.HERO_BONUS : 0;
  }
  return b;
}
export function score(p: Player, g: Game | null = null): number {
  const b = scoreBreakdown(p, g);
  return b.trophies + b.quests + b.companions + b.cards + b.gold + b.discontent + b.raid + b.hero;
}
function cardEndFame(p: Player) {
  let f = 0;
  if (p.occs.includes('o09') && p.comps >= 4) f += 3;
  if (p.tools.includes('i17')) f += p.comps;
  if (p.egg >= 3) f += 6;
  return f;
}
export const SCORE_LABELS: Record<keyof Breakdown, string> = {
  trophies: '討伐の証', quests: '依頼', companions: '仲間', cards: 'カード', gold: '金貨', discontent: '不満', raid: '襲撃', hero: '英雄（証が最多）',
};

const EL_LABEL: Record<Element, string> = { fire: '炎', ice: '氷', thunder: '雷', light: '光', dark: '闇' };
const BOOST_LABEL: Record<string, [PowerKind, string]> = {
  arrow: ['supply', '矢'], potion: ['supply', 'ポーション'], morale: ['supply', '士気'],
};

export interface GameOptions {
  seed?: number;
  weatherSeed?: number;
  chars?: string[];
  /** 画面向けの出来事を出す（me は手札などを見せる席。観戦は -1） */
  events?: { me: number; names: string[] };
}

// ------------------------------------------------------------ ゲーム
export class Game {
  rng: MRandom;
  n: number;
  players: Player[];
  spaces: string[];
  accum: Record<string, Record<string, number>>;
  occ: Record<string, number>;
  nest_ids: string[];
  nests = new Map<string, Nest>();
  prices: Record<string, number>;
  weather: string[];
  mdeck: Record<number, string[]>;
  bosses: Record<number, MonsterDef>;
  quests: string[];
  quest_done: Record<string, number[]>;
  lair: LairEntry[] = [];
  first = 0;
  round = 0;
  decisions = 0;
  close_calls = 0;
  trades = 0;
  errors: string[] = [];
  over = false;
  storm_set = new Set<string>();
  history: number[][] = [];
  occ_pool: string[];
  item_pool: string[];
  forced_chars?: string[];
  kills = 0;
  fights = 0;
  dragon: MonsterDef | null = null;
  last_need = 0;
  /** 画面向けの出来事（本物の盤面だけ） */
  E: GameEvent[] | null = null;
  /** 人間の席が戦闘の前に選んだ使うもの（mode 'pick' の戦闘で一度だけ読む。AI は使わない） */
  pick: { pid: number; boosts: string[]; wait: boolean } | null = null;
  me = -1;
  names: string[] = [];
  /** 画面が見ている名声（出来事で足した分）。score と合わせるのに使う */
  shownFame: number[] = [];
  /** 画面で負傷（休み）として見えている仲間 */
  shownHurt: Set<number>[] = [];
  private lastFate: { value: number; values: number[] } = { value: 0, values: [] };

  constructor(n: number, ais: (Brain | null)[], opts: GameOptions = {}) {
    this.rng = new MRandom(opts.seed ?? 0);
    this.n = n;
    this.players = Array.from({ length: n }, (_, i) => new Player(i, ais[i]));
    this.spaces = ACTIONS.filter((a) => (a.min_p ?? 0) <= n).map((a) => a.id);
    this.accum = Object.fromEntries(this.spaces.filter((s) => ACT[s].accum).map((s) => [s, {}]));
    this.occ = Object.fromEntries(this.spaces.map((s) => [s, 0]));
    this.nest_ids = [...NESTS[n]];
    this.prices = { ...(MARKET_BASE as Record<string, number>) };
    const wr = new MRandom(opts.weatherSeed ?? Math.floor(this.rng.random() * 4294967296));
    const decks = Object.fromEntries(SEASONS.map((s) => [s, wr.sample(WEATHER[s], WEATHER[s].length)])) as Record<Season, string[]>;
    this.weather = Array.from({ length: NUM_ROUNDS }, (_, r) => decks[SEASONS[r % 4]][Math.floor(r / 4)]);
    this.mdeck = {};
    for (const y of [1, 2, 3]) this.mdeck[y] = this.rng.sample(MONSTERS.filter((m) => m.year === y).map((m) => m.id), 10);
    this.bosses = {};
    for (const r of BOSS_ROUNDS) this.bosses[r] = this.rng.choice(BOSSES[r]);
    this.quests = this.rng.sample(Object.keys(QUESTS).sort(), 3);
    this.quest_done = Object.fromEntries(this.quests.map((q) => [q, []]));
    this.occ_pool = [...OCC_IDS];
    this.item_pool = [...ITEM_IDS];
    this.forced_chars = opts.chars;
    if (opts.events) {
      this.E = [];
      this.me = opts.events.me;
      this.names = opts.events.names;
      this.shownFame = Array(n).fill(0);
      this.shownHurt = Array.from({ length: n }, () => new Set<number>());
    }
  }

  // ------------------------------------------------------------ 出来事
  private emit(ev: GameEvent) {
    if (!this.E) return;
    this.E.push(ev);
    if (ev.t === 'play_card') { const c = CARDS[ev.card]; if (c && c.kind !== 'occ') this.shownFame[ev.seat] += (c as D.ItemDef).fame; }
    else if (ev.t === 'trophy' || ev.t === 'quest_done') this.shownFame[ev.seat] += ev.fame;
    else if (ev.t === 'fame') this.shownFame[ev.seat] += ev.amount;
    else if (ev.t === 'dragon_fail') for (let i = 0; i < this.n; i++) this.shownFame[i] -= ev.fame;
  }
  /** 画面の名声を今の得点に合わせる */
  private syncFame(reason: string) {
    if (!this.E) return;
    for (const p of this.players) {
      const d = score(p, this) - this.shownFame[p.pid];
      if (d) this.emit({ t: 'fame', seat: p.pid, amount: d, reason });
    }
  }
  private emitPay(p: Player, cost: Cost | null, space?: string) {
    if (!this.E || !cost) return;
    const c = Object.fromEntries(Object.entries(cost).filter(([, n]) => n)) as Cost;
    if (Object.keys(c).length) this.emit({ t: 'pay', seat: p.pid, cost: c, ...(space ? { space } : {}) });
  }

  // ------------------------------------------------------------ clone（AI 用）
  clone_for(pid: number, extra: number[] = []): Game {
    const g = Object.create(Game.prototype) as Game;
    Object.assign(g, this);
    g.accum = Object.fromEntries(Object.entries(this.accum).map(([k, v]) => [k, { ...v }]));
    g.occ = { ...this.occ };
    g.nests = new Map([...this.nests].map(([k, v]) => [k, { ...v }]));
    g.prices = { ...this.prices };
    g.weather = [...this.weather];
    g.lair = [...this.lair];
    g.quest_done = Object.fromEntries(Object.entries(this.quest_done).map(([k, v]) => [k, [...v]]));
    g.players = [...this.players];
    for (const i of new Set([pid, ...extra])) g.players[i] = this.players[i].clone();
    g.item_pool = [...this.item_pool];
    g.mdeck = Object.fromEntries(Object.entries(this.mdeck).map(([k, v]) => [k, [...v]]));
    g.rng = new MRandom(0);
    g.storm_set = new Set(this.storm_set);
    g.E = null;
    return g;
  }

  // ------------------------------------------------------------ 情報
  season(r?: number): Season { return SEASONS[((r || this.round) - 1) % 4]; }
  year(r?: number) { return Math.floor(((r || this.round) - 1) / 4) + 1; }
  cur_weather() { return this.weather[this.round - 1]; }
  tide(): Element { return this.cur_weather() === 'newmoon' ? 'dark' : TIDE[this.season()]; }
  active(sid: string) { return (ACT[sid].from_round ?? 1) <= this.round; }
  forecast(p: Player) {
    let f = D.FORECAST;
    if (p.char === 'yuki' || p.occs.includes('o05')) f = Math.max(f, 2);
    if (p.tools.includes('i14')) f = Math.max(f, 3);
    return f;
  }
  visible_spawns(p: Player): string[] {
    const k = this.forecast(p) * this.nest_ids.length;
    return this.round ? this.mdeck[this.year()].slice(0, k) : [];
  }
  nest(nid: string): Nest { return this.nests.get(nid)!; }

  /** 選択を問う：AI ならその場で答え、人間なら外に出す */
  private *ask(req: Req): Gen<any> {
    if (req.p.ai) return req.p.ai.respond(req);
    return yield req;
  }

  // ------------------------------------------------------------ セットアップ（ドラフト）
  *setup(): Gen {
    const rng = this.rng;
    this.emit({
      t: 'game_start', players: this.players.map((p) => ({ seat: p.pid, name: this.names[p.pid] ?? `P${p.pid + 1}` })), me: this.me,
      quests: this.quests, spaces: this.spaces, nests: this.nest_ids, market: { ...this.prices },
    });
    const chars = CHARACTERS.map((c) => c.id);
    rng.shuffle(chars);
    this.players.forEach((p, i) => {
      p.char_opts = chars.slice(2 * i, 2 * i + 2);
      if (this.forced_chars) p.char_opts = [this.forced_chars[i]];
    });
    for (const [kind, pool] of [['occ', this.occ_pool], ['item', this.item_pool]] as const) {
      for (let lap = 0; lap < 3; lap++) {
        rng.shuffle(pool);
        const shown: Record<number, string[]> = {};
        this.players.forEach((_, i) => { shown[i] = pool.slice(DRAFT_SHOW * i, DRAFT_SHOW * i + DRAFT_SHOW); });
        this.emit({ t: 'draft_offer', kind, lap: lap + 1, offers: shown });
        for (const p of this.players) {
          const c: string = yield* this.ask({ k: 'draft', g: this, p, cards: shown[p.pid], kind, ingame: false });
          p.hand.push(c);
          p.drafted.push(c);
          pool.splice(pool.indexOf(c), 1);
          this.emit({ t: 'draft_pick', seat: p.pid, kind, card: c });
        }
      }
    }
    this.emit({ t: 'char_offer', offers: Object.fromEntries(this.players.map((p) => [p.pid, p.char_opts])) });
    for (const p of this.players) {
      p.char = yield* this.ask({ k: 'char', g: this, p, options: p.char_opts });
      this.emit({ t: 'char_pick', seat: p.pid, char: p.char! });
      p.res.food = START_FOOD + SEAT_FOOD[this.n][p.pid];
      p.res.gold = START_GOLD;
      this.emit({ t: 'grant', seat: p.pid, gain: { food: p.res.food, gold: p.res.gold }, reason: '開始時' });
      const bonus = D.START_BONUS[p.char!] ?? {};
      add(p, bonus);
      if (Object.keys(bonus).length) this.emit({ t: 'grant', seat: p.pid, gain: bonus, reason: 'キャラ' });
      if (p.char === 'haru') {
        p.pets = D.HARU_START_PETS;
        for (let i = 0; i < p.pets; i++) this.emit({ t: 'familiar', seat: p.pid });
      }
    }
    this.syncFame('開始時');
  }

  // ------------------------------------------------------------ 進行
  *play(): Gen<number[]> {
    yield* this.setup();
    for (let r = 1; r <= NUM_ROUNDS; r++) {
      this.round = r;
      yield* this.start_round();
      yield* this.work_phase();
      yield* this.end_round();
      this.history.push(this.players.map((p) => score(p, this)));
    }
    this.over = true;
    if (this.E) this.emit({ t: 'score', rows: this.scoreRows() }), this.emit({ t: 'game_end' });
    return this.players.map((p) => score(p, this));
  }

  scoreRows(): ScoreRow[] {
    const rows = this.players.map((p) => {
      const b = scoreBreakdown(p, this);
      const items: ScoreItem[] = (Object.keys(SCORE_LABELS) as (keyof Breakdown)[]).map((k) => ({ key: k, label: SCORE_LABELS[k], fame: b[k] }));
      return { seat: p.pid, items, total: score(p, this), rank: 0 };
    });
    for (const r of rows) r.rank = 1 + rows.filter((x) => x.total > r.total).length;
    return rows;
  }

  *start_round(): Gen {
    const r = this.round, w = this.cur_weather();
    if (this.E) {
      this.emit({ t: 'round_start', round: r, season: this.season(), tide: this.tide(), first: this.first, seasonChanged: true });
    }
    if (this.season() === 'spring') {
      for (const p of this.players) {
        p.yearly = new Set();
        p.fate = [...FATE_DECK];
        if (p.occs.includes('o12')) { p.fate.splice(p.fate.indexOf(Math.min(...p.fate)), 1); p.fate.push(1); }
        this.emit({ t: 'fate_shuffle', seat: p.pid, deck: [...p.fate] });
      }
      const br = r + 3;
      if (this.bosses[br]) this.emit({ t: 'boss_reveal', candidates: BOSSES[br].map((b) => b.id), boss: this.bosses[br].id, round: br });
    }
    if (this.E) {
      const viewer = this.players[this.me] ?? this.players[0];
      this.emit({ t: 'weather', weather: w, forecast: this.weather.slice(r, r + this.forecast(viewer)) });
    }
    // 積み増し
    const adds: Record<string, Record<string, number>> = {};
    for (const s of Object.keys(this.accum)) {
      if (this.active(s)) {
        for (const [res, n] of Object.entries(ACT[s].accum!)) { addTo(this.accum[s], res, n as number); addTo(adds[s] ??= {}, res, n as number); }
      }
    }
    const bonusTable: Record<string, Record<string, [string, number]>> = {
      sprout: { forest: ['wood', 1], meadow: ['herb', 1] }, thaw: { hunt: ['food', 1], mine: ['iron', 1] },
      harvestmoon: { hunt: ['food', 3] }, surge: { spring: ['mana', 1] },
    };
    for (const [s, [res, n]] of Object.entries(bonusTable[w] ?? {})) {
      if (this.accum[s]) { addTo(this.accum[s], res, n); addTo(adds[s] ??= {}, res, n); }
    }
    if (w === 'drought' && this.accum.hunt) {
      const before = this.accum.hunt.food ?? 0;
      this.accum.hunt.food = Math.max(0, before - 2);
      addTo(adds.hunt ??= {}, 'food', this.accum.hunt.food - before);
    }
    this.emit({ t: 'refill', adds: adds as Record<string, Cost> });
    if (w === 'surge') {
      this.prices.mana = Math.max(1, this.prices.mana - 1);
      this.emit({ t: 'market_reset', market: { ...this.prices } });
    }
    for (const s of Object.keys(this.occ)) this.occ[s] = 0;
    // 巣に魔物
    const y = this.year();
    const nests = [...this.nest_ids, ...(w === 'fog' ? ['nest_fog'] : [])];
    let spawnLeft = this.nest_ids.length - 1 + D.SPAWN_EXTRA + (w === 'fog' ? 1 : 0);
    for (const nid of nests) {
      const nd = this.nests.get(nid);
      if (nd === undefined || nd.mon === null) {
        if (this.mdeck[y].length && spawnLeft > 0) {
          spawnLeft -= 1;
          const mon = this.mdeck[y].shift()!;
          this.nests.set(nid, { mon, dmg: 0, trap: nd?.trap ?? 0, slots: 0, wait: null, trapper: nd?.trapper ?? null });
          this.emit({ t: 'monster_spawn', nest: nid, monster: mon });
        } else {
          this.nests.set(nid, { mon: null, dmg: 0, trap: 0, slots: 0, wait: null, trapper: null });
        }
      } else {
        nd.slots = 0;
        nd.wait = null;
      }
    }
    if (BOSS_ROUNDS.includes(r)) this.emit({ t: 'boss_appear', boss: this.bosses[r].id });
    this.lair = [];
    for (const p of this.players) {
      p.used = new Set();
      // 負傷の回復（薬草1）。払えなければ休み
      p.rest = new Set();
      const healed: number[] = [];
      for (const i of [...p.injured].sort((a, b) => a - b)) {
        if (p.res.herb >= 1) { p.res.herb -= 1; healed.push(i); this.emit({ t: 'heal', seat: p.pid, companion: compId(p.pid, i), cost: { herb: 1 } }); }
        else if (p.occs.includes('o15') && p.res.mana >= 1) { p.res.mana -= 1; healed.push(i); this.emit({ t: 'heal', seat: p.pid, companion: compId(p.pid, i), cost: { mana: 1 } }); }
        else p.rest.add(i);
      }
      if (this.E) {
        const hurt = this.shownHurt[p.pid];
        for (const i of [...hurt]) if (!p.rest.has(i) && !healed.includes(i)) this.emit({ t: 'recover', seat: p.pid, companion: compId(p.pid, i) });
        this.shownHurt[p.pid] = new Set(p.rest);
      }
      p.injured = new Set();
      p.once = new Set();
      p.extra = 0;
      p.fights = 0;
      p.mana_round = 0;
      if (p.tools.includes('i11') && (p.st.furnace ?? 0) < 6) {
        p.res.mana += 1;
        p.st.furnace = (p.st.furnace ?? 0) + 1;
        this.emit({ t: 'produce', seat: p.pid, facility: 'i11', gain: { mana: 1 } });
      }
      if (p.occs.includes('o05')) {
        if (p.res.gold >= 1) { p.res.gold -= 1; this.emitPay(p, { gold: 1 }); }
      }
      if (p.occs.includes('o26')) {
        if (p.res.herb >= 1) { p.res.herb -= 1; this.emitPay(p, { herb: 1 }); }
        else if (p.res.food >= 1) { p.res.food -= 1; this.emitPay(p, { food: 1 }); }
        else {
          const fi = p.free_idx();
          if (fi.length) {
            p.rest.add(fi[0]);
            if (this.E) { this.emit({ t: 'injury', seat: p.pid, companion: compId(p.pid, fi[0]) }); this.shownHurt[p.pid].add(fi[0]); }
          }
        }
      }
      if (p.tools.includes('i16') && !p.yearly.has('i16')) {
        const idx = this.train_target(p);
        if (idx !== null) {
          p.skills[idx] += 1;
          p.yearly.add('i16');
          this.emit({ t: 'train', seat: p.pid, companion: compId(p.pid, idx) });
        }
      }
      // 罠師：木材4以上なら自動で罠
      if (p.occs.includes('o18') && p.res.wood >= 4) {
        const cand = [...this.nests].filter(([, nd]) => nd.mon && !nd.trap).map(([nid]) => nid);
        if (cand.length) {
          const key = (x: string) => MON[this.nest(x).mon!].str - this.nest(x).dmg;
          let nid = cand[0];
          for (const x of cand) if (key(x) > key(nid)) nid = x;
          p.res.wood -= 2;
          this.nest(nid).trap = 2;
          this.nest(nid).trapper = p.pid;
          this.emitPay(p, { wood: 2 });
          this.emit({ t: 'trap', seat: p.pid, nest: nid, amount: 2 });
        }
      }
      // 時渡りの砂時計
      if (p.hand.includes('i20') && r >= 2) {
        const c = this.spell_cost(p, { mana: 3 });
        if (canPay(p, c) && (yield* this.ask({ k: 'hourglass', g: this, p }))) {
          const paid = pay(p, c);
          this.spell_used(p, 'i20');
          p.extra += 1;
          this.emit({ t: 'spell', seat: p.pid, card: 'i20' });
          this.emitPay(p, paid);
        }
      }
    }
    this.syncFame('ラウンド開始');
  }

  *work_phase(): Gen {
    const order = Array.from({ length: this.n }, (_, i) => (this.first + i) % this.n);
    let guard = 0;
    while (order.some((i) => this.players[i].avail() > 0)) {
      guard += 1;
      if (guard > 50) { this.errors.push('work loop guard'); break; }
      for (const i of order) {
        const p = this.players[i];
        if (p.avail() <= 0) continue;
        if (p.ai?.tradePhase) p.ai.tradePhase(this, p);
        const opts = this.legal(p);
        this.emit({ t: 'turn', seat: p.pid });
        const [sid, opt]: Option = yield* this.ask({ k: 'choose', g: this, p, opts });
        yield* this.apply(p, sid, opt);
        this.decisions += 1;
        const key = sid.startsWith('nest') ? 'nest' : sid;
        p.stats[key] = (p.stats[key] ?? 0) + 1;
        this.check_quests(p);
        this.syncFame('');
      }
    }
    // 待ち伏せのまま誰も来なかった巣は単独で戦う
    for (const [nid, nd] of this.nests) {
      if (nd.wait) {
        const w = nd.wait;
        nd.wait = null;
        const p = this.players[w.pid];
        yield* this.resolve(p, nid, w.plan, null);
        this.check_quests(p);
      }
    }
    if (BOSS_ROUNDS.includes(this.round)) yield* this.resolve_lair();
    this.syncFame('');
  }

  *end_round(): Gen {
    const s = this.season(), w = this.cur_weather(), r = this.round;
    if (s === 'spring' || s === 'summer' || s === 'autumn') {
      for (const p of this.players) if (p.tools.includes('i12')) { p.res.herb += 2; this.emit({ t: 'produce', seat: p.pid, facility: 'i12', gain: { herb: 2 } }); }
    }
    // 霧の巣の魔物は霧とともに消える
    if (this.nests.has('nest_fog')) { this.nests.delete('nest_fog'); this.emit({ t: 'monster_leave', nest: 'nest_fog' }); }
    if (s === 'winter') this.winter(w);
    for (const g of Object.keys(this.prices)) {
      const b = (MARKET_BASE as Record<string, number>)[g];
      this.prices[g] += Number(b > this.prices[g]) - Number(b < this.prices[g]);
    }
    this.emit({ t: 'market_reset', market: { ...this.prices } });
    for (const p of this.players) {
      if (p.occs.includes('o25') && p.res.mat >= 3 && (yield* this.ask({ k: 'tan', g: this, p }))) {
        p.res.mat -= 3;
        p.card_fame += 2;
        this.emitPay(p, { mat: 3 });
        this.emit({ t: 'fame', seat: p.pid, amount: 2, reason: '皮なめし' });
      }
      // 天候の鈴
      if (p.hand.includes('i21') && r < NUM_ROUNDS) {
        const c = this.spell_cost(p, (CARDS['i21'] as D.ItemDef).cost as Record<string, number>);
        if (canPay(p, c)) {
          const nw: string | null = yield* this.ask({ k: 'weather', g: this, p });
          if (nw) {
            const paid = pay(p, c);
            this.spell_used(p, 'i21');
            this.weather[r] = nw;
            this.emit({ t: 'spell', seat: p.pid, card: 'i21' });
            this.emitPay(p, paid);
            this.emit({ t: 'weather_set', seat: p.pid, round: r + 1, weather: nw });
          }
        }
      }
      // 嵐呼びの巫女：年1回、次の天候を嵐に
      if (p.occs.includes('o16') && r < NUM_ROUNDS && this.year(r + 1) === this.year() && !this.storm_set.has(`o16:${this.year()}`)) {
        if (yield* this.ask({ k: 'storm', g: this, p, nr: r + 1 })) {
          this.weather[r] = 'storm';
          this.storm_set.add(`o16:${this.year()}`);
          this.emit({ t: 'weather_set', seat: p.pid, round: r + 1, weather: 'storm' });
        }
      }
      this.check_quests(p);
    }
    this.syncFame('ラウンドの終わり');
    this.emit({ t: 'round_end' });
    this.first = (this.first + 1) % this.n;
    if (r < NUM_ROUNDS) this.emit({ t: 'first_pass', seat: this.first });
    for (const p of this.players) {
      for (const [k, v] of Object.entries(p.res)) if (v < 0) this.errors.push(`R${r} P${p.pid}: ${k} 負 (${v})`);
      if (p.plots_used() > BASE_PLOTS) this.errors.push(`R${r} P${p.pid}: 区画オーバー`);
    }
  }

  winter(w: string) {
    const y = this.year();
    this.emit({ t: 'winter_start' });
    for (const p of this.players) {
      const need = this.upkeep(p, w);
      if (p.occs.includes('o08')) {
        while (p.res.food < need && p.res.herb >= 2) {
          p.res.herb -= 2;
          p.res.food += D.O08_FOOD;
          this.emitPay(p, { herb: 2 });
          this.emit({ t: 'grant', seat: p.pid, gain: { food: D.O08_FOOD }, reason: '薬草摘みの少女' });
        }
      }
      if (p.res.food >= need) {
        p.res.food -= need;
        this.emit({ t: 'upkeep', seat: p.pid, need, paid: need, discontent: 0 });
      } else {
        const miss = need - p.res.food;
        p.discontent += miss;
        this.emit({ t: 'upkeep', seat: p.pid, need, paid: p.res.food, discontent: miss });
        p.res.food = 0;
      }
      if (p.tools.includes('i27') && p.egg < 3) {
        if (p.res.food >= 1) { p.res.food -= 1; p.egg += 1; this.emitPay(p, { food: 1 }); }
        else { p.tools.splice(p.tools.indexOf('i27'), 1); p.egg = 0; this.emit({ t: 'discard', seat: p.pid, card: 'i27' }); }
      }
    }
    // 襲撃（残った魔物と主）
    const raiders: { nest: string; m: MonsterDef }[] = [];
    for (const [nid, nd] of this.nests) if (nd.mon) raiders.push({ nest: nid, m: MON[nd.mon] });
    for (const mid of this.mdeck[y].slice(0, D.RAID_FROM_DECK)) raiders.push({ nest: 'deck', m: MON[mid] });
    let raid = 0;
    for (const x of raiders) raid += x.m.raid;
    if (this.dragon !== null) { raid += this.dragon.raid; raiders.push({ nest: 'lair', m: this.dragon }); }
    this.dragon = null;
    for (const p of this.players) {
      let d = this.raid_damage(p, raid, w);
      if (this.E && raid > 0) {
        // 合計の軽減を魔物の順に割り振って見せる
        let block = raid - d;
        for (const x of raiders) {
          const b = Math.min(block, x.m.raid);
          block -= b;
          this.emit({ t: 'raid', seat: p.pid, monster: x.m.id, nest: x.nest, damage: x.m.raid - b, blocked: b, lost: {} });
        }
      }
      if (d > 0 && D.RAID_PAYABLE) {
        for (const res of ['food', 'gold', 'wood', 'herb'] as Res[]) {
          const t = Math.min(d, p.res[res]);
          p.res[res] -= t;
          d -= t;
        }
      }
      p.unpaid += Math.max(0, d);
    }
    for (const [nid, nd] of this.nests) {
      if (nd.mon) this.emit({ t: 'monster_leave', nest: nid });
      this.nests.set(nid, { mon: null, dmg: 0, trap: 0, slots: 0, wait: null, trapper: null });
    }
    this.syncFame('冬越し');
    this.emit({ t: 'winter_end' });
  }

  raid_damage(p: Player, raid: number, w: string | null = null) {
    if (raid <= 0) return 0;
    if (p.occs.includes('o30') && w === 'blizzard') return 0;
    let red = p.occs.includes('o13') ? p.walls * 2 : Math.floor(p.walls / D.RAID_WALLS);
    red += (p.char === 'goro' ? 1 : 0) + (p.tools.includes('i14') ? 1 : 0) + (p.occs.includes('o23') ? 3 : 0);
    return Math.max(0, raid - red);
  }

  upkeep(p: Player, w: string) {
    let need = UPKEEP * p.comps;
    if (p.tools.includes('i13')) need -= 1;
    if (p.char === 'momo') need -= 1;
    if (p.occs.includes('o20')) need -= 2 * UPKEEP;
    if (w === 'blizzard') need += 1;
    if (w === 'cold') need += 2;
    if (w === 'mild') need -= 1;
    return Math.max(0, need);
  }

  // ------------------------------------------------------------ 依頼
  quest_ok(p: Player, q: string): boolean {
    const s = p.st;
    switch (q) {
      case 'q_kill4': return s.kills >= 4;
      case 'q_beast2': return s.beast >= 2;
      case 'q_undead2': return s.undead >= 2;
      case 'q_boss': return s.boss >= 1;
      case 'q_comp4': return p.comps >= 4;
      case 'q_fac3': return p.tools.length >= 3;
      case 'q_wall3': return p.walls >= 3;
      case 'q_weap3': return p.weapons.length >= 3;
      case 'q_occ3': return p.occs.length >= 3;
      case 'q_spell2': return s.spells >= 2;
      case 'q_weak3': return s.weak >= 3;
      case 'q_gold10': return p.res.gold >= 10;
      case 'q_coop2': return s.coop >= 2;
      case 'q_mat6': return p.res.mat >= 6;
      case 'q_skill3': return p.skills.reduce((a, b) => a + b, 0) >= 3;
    }
    throw new Error(q);
  }

  check_quests(p: Player) {
    for (const q of this.quests) {
      const d = this.quest_done[q];
      if (!d.includes(p.pid) && d.length < 3 && this.quest_ok(p, q)) {
        const fame = QUEST_FAME[d.length];
        p.quest_fame += fame;
        d.push(p.pid);
        this.emit({ t: 'quest_done', quest: q, seat: p.pid, fame });
      }
    }
  }

  // ------------------------------------------------------------ 合法手
  spell_cost(p: Player, cost: Cost): Cost {
    const c = { ...cost };
    if (p.char === 'mina' && (p.mana_round === 0 || D.MINA_DISCOUNT_ALWAYS) && (c.mana ?? 0) > 0) c.mana! -= 1;
    return c;
  }

  spell_used(p: Player, cid: string) {
    p.hand.splice(p.hand.indexOf(cid), 1);
    p.st.spells += 1;
    p.st.spell_ids = [...(p.st.spell_ids ?? []), cid];
    if (p.char === 'mina' && 'mana' in ITEMS_BY[cid].cost) p.mana_round = 1;
  }

  weapon_cost(p: Player, cid: string): Cost {
    const c: Record<string, number> = { ...((CARDS[cid] as D.ItemDef).cost as Record<string, number>) };
    if (p.char === 'gan') {
      for (let t = 0; t < 2; t++) {
        const mats = Object.keys(c).filter((r) => c[r] > 0 && r !== 'gold');
        if (mats.length) {
          let r = mats[0];
          for (const x of mats) if (c[x] > c[r] || (c[x] === c[r] && RES_VAL[x as Res] > RES_VAL[r as Res])) r = x;
          c[r] -= 1;
        }
      }
    }
    return c as Cost;
  }

  wall_cost(p: Player): Cost {
    const c = { ...WALL_COST };
    if (p.char === 'goro') c.wood! -= 1;
    return c;
  }

  occ_cost(p: Player): Cost { return { food: !p.occs.length ? D.OCC_FOOD[0] : D.OCC_FOOD[1] }; }

  train_target(p: Player): number | null {
    let best: number | null = null;
    for (let i = 0; i < p.comps; i++) {
      if (p.skills[i] >= p.skill_cap()) continue;
      if (best === null || p.skills[i] > p.skills[best]) best = i;
    }
    return best;
  }

  market_opts(p: Player): (string | number)[][] {
    const qty = MARKET_QTY + (p.tools.includes('i15') ? 2 : 0);
    const out: (string | number)[][] = [];
    for (const g of ['mana', 'mat'] as Res[]) {
      const n = Math.min(qty, p.res[g]);
      const qs = n >= 1 ? (n === 1 ? [1] : [1, n]) : [];
      for (const q of qs) if (q >= 1) out.push(['sell', g, q]);
    }
    for (const g of ['mana', 'mat', 'wood', 'iron', 'herb', 'food'] as Res[]) {
      const pr = this.buy_price(p, g);
      for (let q = 1; q <= qty; q++) {
        if (pr * q > p.res.gold) break;
        if (q === 1 || q === 2 || q === qty || q === Math.floor(p.res.gold / pr)) out.push(['buy', g, q]);
      }
    }
    return out;
  }

  sell_price(p: Player, g: string) {
    let pr = this.prices[g] - D.SELL_SPREAD + (p.char === 'leo' ? 1 : 0);
    if (this.cur_weather() === 'fair') pr += 1;
    if (p.char === 'leo' && g === 'mat') pr += 1;
    return Math.max(1, pr);
  }

  buy_price(p: Player, g: string) {
    if (g in this.prices) return Math.max(1, this.prices[g] - (p.char === 'leo' ? 1 : 0));
    return (FIXED_BUY as Record<string, number>)[g];
  }

  nest_open(p: Player, nid: string): string | null {
    const nd = this.nests.get(nid);
    if (!nd || nd.mon === null) return null;
    if (nd.slots < NEST_CAP) return 'ok';
    if (p.occs.includes('o14') && !p.yearly.has('o14')) return 'o14';
    if (p.hand.includes('i23')) return 'i23';
    return null;
  }

  legal(p: Player): Option[] {
    const out: Option[] = [];
    const av = p.avail();
    const r = this.round;
    for (const s of this.spaces) {
      const a = ACT[s];
      if (!this.active(s)) continue;
      if (!a.unlimited && this.occ[s] > 0) continue;
      if (s === 'guild') {
        if (canPay(p, this.occ_cost(p))) for (const cid of p.hand) if (cid.startsWith('o') && !(cid === 'o28' && p.comps >= 4)) out.push([s, cid]);
      } else if (s === 'forge') {
        for (const cid of p.hand) if (CARDS[cid].kind === 'weapon' && canPay(p, this.weapon_cost(p, cid))) out.push([s, cid]);
      } else if (s === 'workshop') {
        const free = BASE_PLOTS - p.plots_used();
        if (free > 0) {
          for (const cid of p.hand) if (CARDS[cid].kind === 'tool' && canPay(p, (CARDS[cid] as D.ItemDef).cost)) out.push([s, ['tool', cid]]);
          if (canPay(p, BED_COST) && p.bed_cap() < MAX_COMPANIONS) out.push([s, ['bed']]);
          const wc = this.wall_cost(p);
          if (canPay(p, wc)) {
            out.push([s, ['wall', 1]]);
            if (free >= 2 && canPay(p, Object.fromEntries(Object.entries(wc).map(([k, v]) => [k, 2 * (v as number)])))) out.push([s, ['wall', 2]]);
          }
        }
      } else if (MARKETS.has(s)) {
        for (const o of this.market_opts(p)) out.push([s, o]);
      } else if (s === 'tavern') {
        let fc = p.occs.includes('o09') ? 0 : HIRE_FOOD;
        const nanaFree = p.char === 'nana' && !('nana_bed' in p.st);
        const bedOk = p.comps < p.bed_cap() || (D.NANA_FREE_BED && nanaFree);
        if (nanaFree && D.NANA_FIRST_FREE_FOOD) fc = 0;
        if (p.comps < MAX_COMPANIONS && bedOk && p.res.food >= fc && r < NUM_ROUNDS) out.push([s, null]);
      } else if (s === 'training') {
        if (this.train_target(p) !== null) out.push([s, null]);
      } else if (s === 'ruins') {
        if (this.item_pool.length) out.push([s, null]);
      } else out.push([s, null]);
    }
    for (const nid of [...this.nests.keys()]) {
      const how = this.nest_open(p, nid);
      if (!how) continue;
      const nd = this.nest(nid);
      if (nd.wait && nd.wait.pid === p.pid) continue;
      for (const k of [1, 2]) {
        if (k > av) continue;
        if (nd.wait) { for (const mode of ['safe', 'gamble']) out.push([nid, [k, mode, how]]); }
        else for (const mode of ['safe', 'gamble', 'chip', 'wait']) {
          if (mode === 'wait' && how !== 'ok') continue;
          out.push([nid, [k, mode, how]]);
        }
      }
    }
    if (BOSS_ROUNDS.includes(r) && this.lair.every((e) => e.pid !== p.pid)) {
      for (const k of [1, 2]) if (k <= av) { out.push(['lair', [k, 'safe', 'ok']]); out.push(['lair', [k, 'chip', 'ok']]); }
    }
    if (!out.length) out.push(['plaza', null]);
    return out;
  }

  // ------------------------------------------------------------ 実行
  take_worker(p: Player, k = 1, best = false): number[] {
    const fi = p.free_idx();
    const sorted = [...fi].sort((a, b) => (best ? p.skills[b] - p.skills[a] : p.skills[a] - p.skills[b]));
    const got = sorted.slice(0, k);
    for (const i of got) p.used.add(i);
    const short = k - got.length;
    if (short > 0) p.extra -= short;
    return got;
  }
  /** 置いた仲間の出来事（足りない分は砂時計の追加の1人） */
  private emitPlace(p: Player, space: string, idxs: number[], k: number) {
    if (!this.E) return;
    for (const i of idxs) this.emit({ t: 'place', seat: p.pid, space, companion: compId(p.pid, i) });
    for (let j = idxs.length; j < k; j++) this.emit({ t: 'place', seat: p.pid, space, companion: `c${p.pid}-x` });
  }

  gain_take(p: Player, sid: string) {
    const got: Record<string, number> = { ...(this.accum[sid] ?? {}) };
    if (sid in this.accum) this.accum[sid] = {};
    for (const [res, n] of Object.entries(ACT[sid].give ?? {})) got[res] = (got[res] ?? 0) + (n as number);
    if (sid === 'plaza' && this.cur_weather() === 'festival') got.gold = (got.gold ?? 0) + 1;
    if (got.wood && p.char === 'toma') got.wood += 1;
    if (got.herb && p.char === 'sana') got.herb += 1;
    if (got.herb && p.occs.includes('o08')) got.herb += 1;
    if (got.iron && p.occs.includes('o10')) got.iron += 1;
    if (sid === 'spring' && p.char === 'mina') got.mana = (got.mana ?? 0) + D.MINA_SPRING;
    add(p, got as Cost);
    this.emit({ t: 'gather', seat: p.pid, space: sid, gain: got as Cost });
  }

  *apply(p: Player, sid: string, opt: Opt, fate: number | null = null): Gen {
    if (sid.startsWith('nest')) { yield* this.apply_nest(p, sid, opt as [number, string, string], fate); return; }
    if (sid === 'lair') {
      const [k, mode] = opt as [number, string, string];
      const idxs = this.take_worker(p, k, true);
      this.emitPlace(p, 'lair', idxs, k);
      const m = this.bosses[this.round];
      const plan = this.make_plan(p, m, idxs, mode, null, 0, false, true);
      this.pay_plan_boosts(p, plan);
      this.lair.push({ pid: p.pid, plan, idxs });
      return;
    }
    if (sid !== 'plaza') this.occ[sid] += 1;
    const idxs = this.take_worker(p, 1);
    this.emitPlace(p, sid, idxs, 1);
    if (sid in this.accum || ACT[sid].give) this.gain_take(p, sid);
    if (sid === 'guild') {
      const cid = opt as string;
      this.emitPay(p, pay(p, this.occ_cost(p)), sid);
      p.hand.splice(p.hand.indexOf(cid), 1);
      p.occs.push(cid);
      this.emit({ t: 'play_card', seat: p.pid, card: cid });
      if (cid === 'o12' && p.fate.includes(Math.min(...FATE_DECK))) {
        p.fate.splice(p.fate.indexOf(Math.min(...FATE_DECK)), 1); p.fate.push(1);
        this.emit({ t: 'fate_shuffle', seat: p.pid, deck: [...p.fate] });
      }
    } else if (sid === 'forge') {
      const cid = opt as string;
      this.emitPay(p, pay(p, this.weapon_cost(p, cid)), sid);
      p.hand.splice(p.hand.indexOf(cid), 1);
      p.weapons.push(cid);
      p.card_fame += (CARDS[cid] as D.ItemDef).fame;
      this.emit({ t: 'play_card', seat: p.pid, card: cid });
      if (p.tools.includes('i18')) { p.res.iron += 1; this.emit({ t: 'produce', seat: p.pid, facility: 'i18', gain: { iron: 1 } }); }
      if (p.occs.includes('o10') && (CARDS[cid] as D.ItemDef).ironw) { p.card_fame += 1; this.emit({ t: 'fame', seat: p.pid, amount: 1, reason: '鉱山のドワーフ' }); }
    } else if (sid === 'workshop') {
      const o = opt as (string | number)[];
      if (o[0] === 'tool') {
        const cid = o[1] as string;
        this.emitPay(p, pay(p, (CARDS[cid] as D.ItemDef).cost), sid);
        p.hand.splice(p.hand.indexOf(cid), 1);
        p.tools.push(cid);
        p.card_fame += (CARDS[cid] as D.ItemDef).fame;
        this.emit({ t: 'play_card', seat: p.pid, card: cid });
      } else if (o[0] === 'bed') {
        this.emitPay(p, pay(p, BED_COST), sid);
        p.beds += 1;
        this.emit({ t: 'build', seat: p.pid, kind: 'bed' });
      } else {
        for (let i = 0; i < (o[1] as number); i++) {
          this.emitPay(p, pay(p, this.wall_cost(p)), sid);
          p.walls += 1;
          this.emit({ t: 'build', seat: p.pid, kind: 'wall' });
          if (p.occs.includes('o13')) { p.card_fame += 1; this.emit({ t: 'fame', seat: p.pid, amount: 1, reason: '城壁の工兵' }); }
        }
      }
    } else if (MARKETS.has(sid)) {
      const [kind, g, q] = opt as [string, Res, number];
      if (kind === 'sell') {
        const pr = this.sell_price(p, g);
        p.res[g] -= q;
        p.res.gold += pr * q;
        this.prices[g] = Math.max(1, this.prices[g] - 1);
        this.emit({ t: 'market', seat: p.pid, buy: {}, sell: { [g]: q }, gold: pr * q, prices: { ...this.prices } });
      } else {
        const pr = this.buy_price(p, g);
        p.res.gold -= pr * q;
        p.res[g] += q;
        if (g in this.prices) this.prices[g] = Math.min((MARKET_BASE as Record<string, number>)[g] + MARKET_SPAN, this.prices[g] + 1);
        this.emit({ t: 'market', seat: p.pid, buy: { [g]: q }, sell: {}, gold: -pr * q, prices: { ...this.prices } });
      }
    } else if (sid === 'tavern') {
      let fc = p.occs.includes('o09') ? 0 : HIRE_FOOD;
      if (p.char === 'nana' && !('nana_bed' in p.st)) {
        if (!D.NANA_FREE_BED) {
          fc = D.NANA_FIRST_FREE_FOOD ? 0 : fc;
          p.st.nana_bed = 1;
        } else if (p.comps >= p.bed_cap()) p.st.nana_bed = 1;
      }
      p.res.food -= fc;
      this.emitPay(p, { food: fc }, sid);
      p.skills.push(0);
      p.rest.add(p.comps - 1);
      p.st.hires += 1;
      this.emit({ t: 'hire', seat: p.pid, companion: compId(p.pid, p.comps - 1) });
      if (p.char === 'nana') { p.res.food += D.NANA_HIRE_FOOD; this.emit({ t: 'grant', seat: p.pid, gain: { food: D.NANA_HIRE_FOOD }, reason: 'ナナ' }); }
      if (p.occs.includes('o28') && p.comps >= 4) { p.occs.splice(p.occs.indexOf('o28'), 1); this.emit({ t: 'discard', seat: p.pid, card: 'o28' }); }
    } else if (sid === 'training') {
      const i = this.train_target(p)!;
      p.skills[i] += 1;
      this.emit({ t: 'train', seat: p.pid, companion: compId(p.pid, i) });
    } else if (sid === 'ruins') {
      const look = p.occs.includes('o21') ? 3 : 2;
      const take = p.occs.includes('o29') ? 2 : 1;
      yield* this.reward_cards(p, look, take, 'ruins');
    }
  }

  *reward_cards(p: Player, look: number, take: number, from: 'ruins' | 'boss' = 'ruins'): Gen {
    if (!this.item_pool.length) return;
    const shown = this.rng.sample(this.item_pool, Math.min(look, this.item_pool.length));
    for (let t = 0; t < take; t++) {
      if (!shown.length) break;
      const c: string = yield* this.ask({ k: 'draft', g: this, p, cards: [...shown], kind: 'item', ingame: true });
      shown.splice(shown.indexOf(c), 1);
      this.item_pool.splice(this.item_pool.indexOf(c), 1);
      p.hand.push(c);
      this.emit({ t: 'draw', seat: p.pid, card: c, from });
    }
  }

  // ------------------------------------------------------------ 戦闘
  eff_str(p: Player, m: MonsterDef, nd: Nest | null = null, _boss = false) {
    let s = m.str - (nd ? nd.dmg + nd.trap : 0);
    if (this.cur_weather() === 'newmoon' && m.race === 'undead') s += 2;
    if (isBeast(m) && p.weapons.includes('i09')) s -= 2;
    return s;
  }

  counter(p: Player, m: MonsterDef, plan: Plan) {
    let c = m.counter + (this.cur_weather() === 'gale' ? 1 : 0);
    if (p.weapons.includes('i04')) c -= 1;
    if (plan.arrows && p.occs.includes('o02')) c -= 1;
    return c;
  }

  defense(p: Player, k: number) {
    let d = D.DEF_PER * k;
    if (p.char === 'goro') d += D.GORO_DEF;
    if (p.occs.includes('o06')) d += 2;
    for (const w of p.weapons) d += WEAPON_DEF[w] ?? 0;
    if ([...p.occs, ...p.weapons].some((c) => REAR_CARDS.has(c))) d += D.REAR_DEF;
    return d;
  }

  /** (名前, 戦力, 費用, 属性, 消費カード) の候補 */
  boost_list(p: Player, m: MonsterDef, boss: boolean): [string, number, Cost, Element | null, string | null][] {
    const b: [string, number, Cost, Element | null, string | null][] = [];
    const w = this.cur_weather();
    if (p.char === 'toma') {
      const n = 2 + (p.weapons.includes('i01') ? 1 : 0);
      for (let i = 0; i < n; i++) {
        let pw = 1;
        if (w === 'storm' && i === 0) pw = 0;
        if (w === 'gale' && i === 0) pw = 0;
        b.push(['arrow', pw, { wood: 1 }, p.occs.includes('o02') ? 'ice' : null, null]);
      }
    }
    const npot = p.char === 'sana' ? 2 : 1;
    for (let i = 0; i < npot; i++) b.push(['potion', p.char === 'sana' ? 2 : D.POTION[1], { ...D.POTION[0] }, null, null]);
    for (let i = 0; i < (p.char === 'momo' ? 2 : 1); i++) b.push(['morale', D.MORALE[1], { ...D.MORALE[0] }, null, null]);
    if (p.occs.includes('o01')) b.push(['o01', 2, { mana: 1 }, 'fire', null]);
    if (p.occs.includes('o03')) b.push(['o03', 3, { gold: this.season() === 'spring' ? 1 : 2 }, 'thunder', null]);
    if (p.occs.includes('o19')) b.push(['o19', 4, { mana: w === 'newmoon' ? 1 : 2 }, 'dark', null]);
    if (p.tools.includes('i29')) b.push(['i29', 2, { iron: 1 }, null, null]);
    const sc = (c: Cost) => this.spell_cost(p, c);
    if (p.hand.includes('i19')) b.push(['i19', 4, sc({ mana: 2 }), 'fire', 'i19']);
    if (p.hand.includes('i23')) b.push(['i23', 2, sc({ mana: 2 }), 'dark', 'i23']);
    if (p.hand.includes('i24') && boss) b.push(['i24', 6, sc({ mana: 2, herb: 2 }), null, 'i24']);
    if (p.hand.includes('i30') && (isDark(m) || (boss && m.race === 'undead'))) b.push(['i30', 3, sc({ herb: 1, mana: 1 }), null, 'i30']);
    if (p.hand.includes('i28') && p.res.gold >= 4) {
      const x = Math.min(4, Math.floor(p.res.gold / 2));
      b.push(['i28', x, { ...sc({ mana: 1 }), gold: 2 * x }, null, 'i28']);
    }
    return b;
  }

  base_power(p: Player, m: MonsterDef, idxs: number[], coop = false, boss = false, parts?: PowerPart[]): [number, Set<Element>] {
    const k = idxs.length;
    const sk = idxs.reduce((a, i) => a + p.skills[i], 0);
    let pw = POWER_PER * k + sk;
    const seat = p.pid;
    const P = (kind: PowerKind, label: string, value: number, ref?: string, el?: Element) => {
      if (parts && value) parts.push({ kind, label, value, seat, ...(ref ? { ref } : {}), ...(el ? { el } : {}) });
    };
    P('companion', `仲間×${k}`, POWER_PER * k);
    P('skill', '熟練', sk);
    const w = this.cur_weather(), s = this.season();
    const els = new Set<Element>();
    for (const wid of p.weapons) {
      pw += WEAPON_POWER[wid] ?? 0;
      let extra = 0;
      if (wid === 'i03' && s === 'summer') extra += 1;
      if (wid === 'i05' && w === 'storm') extra += 2;
      if (wid === 'i08') extra += p.pets;
      P('weapon', CARDS[wid].name, (WEAPON_POWER[wid] ?? 0) + extra, wid, WEAPON_EL[wid]);
      if (wid in WEAPON_EL) els.add(WEAPON_EL[wid]);
    }
    if (p.weapons.includes('i03') && s === 'summer') pw += 1;
    if (p.weapons.includes('i05') && w === 'storm') pw += 2;
    if (p.weapons.includes('i08')) pw += p.pets;
    const pet = p.pets * (p.occs.includes('o07') ? 3 : 2);
    pw += pet;
    P('familiar', `使い魔×${p.pets}`, pet);
    const o = p.occs;
    const occ = (id: string, v: number) => { pw += v; P('occ', CARDS[id].name, v, id); };
    if (o.includes('o11')) occ('o11', 3);
    if (o.includes('o26')) occ('o26', 5);
    if (o.includes('o28') && p.comps <= 3) occ('o28', D.O28_POWER);
    if (o.includes('o16') && w === 'storm') occ('o16', 2);
    if (o.includes('o17') && (isDark(m) || m.race === 'undead')) occ('o17', 2);
    if (p.fights >= 1) {
      if (o.includes('o22')) occ('o22', D.O22_POWER);
      if (p.char === 'riku') { pw += D.RIKU_CHAIN; P('char', 'リク：連戦', D.RIKU_CHAIN); }
    }
    if (o.includes('o23') && p.tools.length >= 3) occ('o23', 1);
    if (o.includes('o30') && s === 'winter') occ('o30', 3);
    if (p.tools.includes('i13')) { pw += 1; P('supply', CARDS.i13.name, 1, 'i13'); }
    if (coop && p.weapons.includes('i10')) { pw += 2; P('weapon', CARDS.i10.name + '（共闘）', 2, 'i10'); }
    if (boss && m.id === 'b_ancient' && p.egg >= 2 && p.tools.includes('i27')) { pw += 6; P('familiar', CARDS.i27.name, 6, 'i27'); }
    return [pw, els];
  }

  elem_bonus(p: Player, m: MonsterDef, els: Set<Element>, parts?: PowerPart[]) {
    let b = 0;
    if (m.weak && els.has(m.weak)) { b += WEAKNESS_BONUS; parts?.push({ kind: 'weakness', label: '弱点！', value: WEAKNESS_BONUS, el: m.weak, seat: p.pid }); }
    const tide = this.tide();
    if (els.has(tide)) { b += TIDE_BONUS; parts?.push({ kind: 'tide', label: '魔力の潮', value: TIDE_BONUS, el: tide, seat: p.pid }); }
    const we = WEATHER_EL[this.cur_weather()];
    if (we && els.has(we[0])) { b += we[1]; parts?.push({ kind: 'weather', label: '天候', value: we[1], el: we[0], seat: p.pid }); }
    if (p.char === 'nana' && els.has('light')) { b += 1; parts?.push({ kind: 'char', label: 'ナナ：光', value: 1, el: 'light', seat: p.pid }); }
    return b;
  }

  make_plan(p: Player, m: MonsterDef, idxs: number[], mode: string, nd: Nest | null = null, partner = 0, coop = false, boss = false): Plan {
    if (mode === 'pick') return this.pick_plan(p, m, idxs, coop, boss);
    const [base, els] = this.base_power(p, m, idxs, coop, boss);
    const es = this.eff_str(p, m, nd, boss);
    const plan: Plan = { idxs, k: idxs.length, boosts: [], cost: {}, els: new Set(els), arrows: 0, base, power: 0 };
    let cur = base + this.elem_bonus(p, m, els) + partner;
    let target: number;
    if (mode === 'safe' || mode === 'wait') target = es - this.fate_min(p);
    else if (mode === 'gamble') target = es - 1;
    else target = -99;
    if (mode === 'wait') target -= 2;
    const cands = this.boost_list(p, m, boss);
    let usedCost: Record<string, number> = {};
    while (cur < target && cands.length) {
      let best: [number, number, number, Record<string, number>] | null = null;
      for (let j = 0; j < cands.length; j++) {
        const [, pw, c, el, card] = cands[j];
        const tot: Record<string, number> = { ...usedCost };
        for (const [r_, n_] of Object.entries(c)) tot[r_] = (tot[r_] ?? 0) + (n_ as number);
        if (!canPay(p, tot as Cost)) continue;
        let gain = pw;
        if (el && !plan.els.has(el)) gain += this.elem_bonus(p, m, new Set([...plan.els, el])) - this.elem_bonus(p, m, plan.els);
        if (gain <= 0) continue;
        const v = (costValue(c) + (card ? 0.8 : 0)) / gain;
        if (best === null || v < best[0]) best = [v, j, gain, tot];
      }
      if (best === null) break;
      const [, j, gain, tot] = best;
      const [nm, pw, , el, card] = cands.splice(j, 1)[0];
      usedCost = tot;
      plan.boosts.push([nm, pw, card]);
      if (el) plan.els.add(el);
      if (nm === 'arrow') plan.arrows += 1;
      cur += gain;
    }
    plan.cost = usedCost as Cost;
    plan.power = cur - partner;
    if (this.E) this.planParts(p, m, plan, coop, boss);
    return plan;
  }

  /** 画面用：plan の戦力を内訳に分ける（合計は plan.power と同じ） */
  planParts(p: Player, m: MonsterDef, plan: Plan, coop: boolean, boss: boolean) {
    const parts: PowerPart[] = [];
    this.base_power(p, m, plan.idxs, coop, boss, parts);
    const arrows = plan.boosts.filter((b) => b[0] === 'arrow');
    if (arrows.length) parts.push({ kind: 'supply', label: `矢×${arrows.length}`, value: arrows.reduce((a, b) => a + b[1], 0), seat: p.pid });
    for (const [nm, pw, card] of plan.boosts) {
      if (nm === 'arrow' || !pw) continue;
      const lb = BOOST_LABEL[nm];
      if (lb) parts.push({ kind: lb[0], label: lb[1], value: pw, seat: p.pid });
      else parts.push({ kind: card ? 'spell' : nm.startsWith('o') ? 'occ' : 'weapon', label: CARDS[nm]?.name ?? nm, value: pw, ref: nm, seat: p.pid, ...(ITEMS_BY[nm]?.el ? { el: ITEMS_BY[nm].el } : {}) });
    }
    this.elem_bonus(p, m, plan.els, parts);
    const sum = parts.reduce((a, x) => a + x.value, 0);
    if (sum !== plan.power) parts.push({ kind: 'char', label: 'その他', value: plan.power - sum, seat: p.pid });
    plan.parts = parts;
  }

  // ------------------------------------------------------------ 人間の席：使うものを自分で選ぶ（AI の道筋には関わらない）
  /** 選んだ名前（boost_list の名前。矢・ポーション・士気は同じ名前を回数分）から、使うもの・費用・属性を決める。使えなければ例外 */
  pick_boosts(p: Player, m: MonsterDef, boss: boolean, names: string[]): { boosts: Boost[]; cost: Cost; els: Set<Element>; arrows: number; gain: number } {
    const cands = this.boost_list(p, m, boss);
    const used: Record<string, number> = {};
    const boosts: Boost[] = [];
    const els = new Set<Element>();
    let arrows = 0, gain = 0;
    for (const nm of names) {
      let j = -1;
      for (let i = 0; i < cands.length; i++) if (cands[i][0] === nm && (j < 0 || cands[i][1] > cands[j][1])) j = i;
      if (j < 0) throw new Error(`使えないもの：${nm}`);
      const [, pw, c, el, card] = cands.splice(j, 1)[0];
      for (const [r_, n_] of Object.entries(c)) used[r_] = (used[r_] ?? 0) + (n_ as number);
      boosts.push([nm, pw, card]);
      if (el) els.add(el);
      if (nm === 'arrow') arrows += 1;
      gain += pw;
    }
    if (!canPay(p, used as Cost)) throw new Error('資源が足りない');
    return { boosts, cost: used as Cost, els, arrows, gain };
  }

  /** mode 'pick'：this.pick の選択どおりに plan を作る（足りない・使えないなら例外） */
  pick_plan(p: Player, m: MonsterDef, idxs: number[], coop = false, boss = false): Plan {
    const sel = this.pick;
    if (!sel || sel.pid !== p.pid) throw new Error('使うものが選ばれていない');
    this.pick = null;
    const [base, els] = this.base_power(p, m, idxs, coop, boss);
    const b = this.pick_boosts(p, m, boss, sel.boosts);
    const plan: Plan = { idxs, k: idxs.length, boosts: b.boosts, cost: b.cost, els: new Set([...els, ...b.els]), arrows: b.arrows, base, power: 0 };
    plan.power = base + b.gain + this.elem_bonus(p, m, plan.els);
    if (this.E) this.planParts(p, m, plan, coop, boss);
    return plan;
  }

  /** 人間の戦闘の選択が置けるか（置けるなら巣の入り方 how） */
  check_pick(p: Player, sel: FightPick): { ok: true; how: string } | { ok: false; error: string } {
    const { sid, k } = sel;
    if (!(sid.startsWith('nest') || sid === 'lair')) return { ok: false, error: '巣ではない' };
    const opts = this.legal(p).filter((o) => o[0] === sid && Array.isArray(o[1]) && o[1][0] === k);
    if (!opts.length) return { ok: false, error: `${k}人では置けない` };
    if (sel.wait && !opts.some((o) => (o[1] as (string | number)[])[1] === 'wait')) return { ok: false, error: '待ち伏せできない' };
    const how = (opts[0][1] as (string | number)[])[2] as string;
    if (how === 'i23' && !sel.boosts.includes('i23')) return { ok: false, error: '影分身の呪符が要る' };
    const m = sid === 'lair' ? this.bosses[this.round] : MON[this.nest(sid).mon!];
    try { this.pick_boosts(p, m, sid === 'lair', sel.boosts); } catch (e) { return { ok: false, error: (e as Error).message }; }
    return { ok: true, how };
  }

  /** 市場の売り買いを好きな数で（1回の行動で1種類だけ。市場の上限まで） */
  check_market(p: Player, sid: string, kind: 'buy' | 'sell', r: Res, q: number): string | null {
    if (!MARKETS.has(sid)) return '市場ではない';
    if (!this.legal(p).some((o) => o[0] === sid)) return 'この市場には置けない';
    const qty = MARKET_QTY + (p.tools.includes('i15') ? 2 : 0);
    if (!Number.isInteger(q) || q < 1 || q > qty) return `1〜${qty}個まで`;
    if (kind === 'sell') {
      if (r !== 'mana' && r !== 'mat') return '売れるのは魔石と素材だけ';
      if (p.res[r] < q) return '足りない';
    } else {
      if (!['mana', 'mat', 'wood', 'iron', 'herb', 'food'].includes(r)) return '買えない';
      if (this.buy_price(p, r) * q > p.res.gold) return '金貨が足りない';
    }
    return null;
  }

  pay_plan_boosts(p: Player, plan: Plan) {
    let paid: Cost | null = null;
    if (Object.keys(plan.cost).length) paid = pay(p, plan.cost);
    for (const [nm, , card] of plan.boosts) {
      if (card) {
        this.spell_used(p, card);
        this.emit({ t: 'spell', seat: p.pid, card, ...(ITEMS_BY[card]?.el ? { el: ITEMS_BY[card].el } : {}) });
      }
      void nm;
    }
    this.emitPay(p, paid);
  }

  fate_min(p: Player) {
    const d = p.fate.length ? p.fate : [...FATE_DECK];
    if (p.occs.includes('o27') && d.length >= 2) {
      const s = [...d].sort((a, b) => a - b);
      return s[0] + s[1];
    }
    const yy = p.st.yuki_y ?? [0, 0];
    if (p.char === 'yuki' && !(yy[0] === this.year() && yy[1] === 2) && d.length >= 2) return [...d].sort((a, b) => a - b)[1];
    return Math.min(...d);
  }

  /** {値: 確率}（挿入順は Python と同じ） */
  fate_dist(p: Player): Map<number, number> {
    const d = p.fate.length ? p.fate : [...FATE_DECK];
    const out = new Map<number, number>();
    const put = (v: number, x: number) => out.set(v, (out.get(v) ?? 0) + x);
    if (p.occs.includes('o27') && d.length >= 2) {
      const n = d.length;
      const tot = (n * (n - 1)) / 2;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) put(d[i] + d[j], 1 / tot);
      return out;
    }
    if (p.char === 'yuki' && this.yuki_left(p) > 0 && d.length >= 2) {
      const n = d.length;
      const tot = (n * (n - 1)) / 2;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) put(Math.max(d[i], d[j]), 1 / tot);
      return out;
    }
    for (const x of d) put(x, 1 / d.length);
    return out;
  }

  yuki_left(p: Player) {
    const [y, used] = p.st.yuki_y ?? [0, 0];
    return D.YUKI_PER_YEAR - (y === this.year() ? used : 0);
  }

  private resetFate(p: Player) {
    p.fate = [...FATE_DECK];
    if (p.occs.includes('o12')) { p.fate.splice(p.fate.indexOf(Math.min(...p.fate)), 1); p.fate.push(1); }
    this.emit({ t: 'fate_shuffle', seat: p.pid, deck: [...p.fate] });
  }

  draw_fate(p: Player, need: number | null = null): number {
    const done = (value: number, values: number[]) => { this.lastFate = { value, values }; return value; };
    if (!p.fate.length) this.resetFate(p);
    if (p.occs.includes('o27')) {
      if (p.fate.length < 2 || (!p.yearly.has('o27') && p.fate.reduce((a, b) => a + b, 0) / p.fate.length < 0.4)) {
        this.resetFate(p);
        p.yearly.add('o27');
      }
      const a = p.fate.splice(this.rng.randrange(p.fate.length), 1)[0];
      const hasB = p.fate.length > 0;
      const b = hasB ? p.fate.splice(this.rng.randrange(p.fate.length), 1)[0] : 0;
      return done(a + b, hasB ? [a, b] : [a]);
    }
    if (p.char === 'yuki' && p.fate.length >= 2 && this.yuki_left(p) > 0) {
      const [i, j] = this.rng.sample(Array.from({ length: p.fate.length }, (_, x) => x), 2);
      const a = p.fate[i], b = p.fate[j];
      if (need === null || a < need) {
        const [y, used] = p.st.yuki_y ?? [0, 0];
        p.st.yuki_y = [this.year(), (y === this.year() ? used : 0) + 1];
        const v = Math.max(a, b);
        p.fate.splice(p.fate.indexOf(v), 1);
        return done(v, [v]);
      }
      p.fate.splice(p.fate.indexOf(a), 1);
      return done(a, [a]);
    }
    const v = p.fate.splice(this.rng.randrange(p.fate.length), 1)[0];
    return done(v, [v]);
  }

  remove_fate(p: Player, v: number) {
    if (!p.fate.length) p.fate = [...FATE_DECK];
    if (p.occs.includes('o27')) {
      for (const x of [...p.fate]) {
        if (p.fate.length >= 2) { p.fate.splice(p.fate.indexOf(x), 1); break; }
      }
      if (p.fate.length) p.fate.pop();
      return;
    }
    const i = p.fate.indexOf(v);
    if (i >= 0) p.fate.splice(i, 1);
    else if (p.fate.length) p.fate.pop();
  }

  *apply_nest(p: Player, nid: string, opt: [number, string, string], fate: number | null = null): Gen {
    const [k, mode, how] = opt;
    const nd = this.nest(nid);
    const m = MON[nd.mon!];
    if (how === 'o14') p.yearly.add('o14');
    const pickWait = mode === 'pick' && !!this.pick?.wait;
    const idxs = this.take_worker(p, k, true);
    this.emitPlace(p, nid, idxs, k);
    nd.slots += 1;
    if (nd.wait) {
      const w = nd.wait;
      const q = this.players[w.pid];
      const partner = w.plan.power + (q.weapons.includes('i10') ? 2 : 0) + (p.char === 'aya' ? D.AYA_COOP : 0);
      const plan = this.make_plan(p, m, idxs, mode, nd, partner, true);
      if (q.char === 'aya') {
        plan.power += D.AYA_COOP;
        plan.parts?.push({ kind: 'char', label: 'アヤ：共闘', value: D.AYA_COOP, seat: q.pid });
      }
      this.pay_plan_boosts(p, plan);
      nd.wait = null;
      yield* this.resolve(p, nid, plan, [q, w.plan, partner], fate);
      return;
    }
    const plan = this.make_plan(p, m, idxs, mode, nd);
    if (how === 'i23' && !plan.boosts.some((b) => b[0] === 'i23')) {
      const c = this.spell_cost(p, { mana: 2 });
      const tot: Record<string, number> = { ...(plan.cost as Record<string, number>) };
      for (const [r_, n_] of Object.entries(c)) tot[r_] = (tot[r_] ?? 0) + (n_ as number);
      if (canPay(p, tot as Cost)) {
        plan.cost = tot as Cost;
        plan.boosts.push(['i23', 2, 'i23']);
        plan.els.add('dark');
        plan.power = plan.base + 2 + plan.boosts.slice(0, -1).reduce((a, b) => a + b[1], 0) + this.elem_bonus(p, m, plan.els);
        if (this.E) this.planParts(p, m, plan, false, false);
      }
    }
    this.pay_plan_boosts(p, plan);
    if (mode === 'wait' || (mode === 'pick' && pickWait)) {
      nd.wait = { pid: p.pid, plan };
      this.emit({ t: 'wait', seat: p.pid, nest: nid, power: plan.power });
      return;
    }
    yield* this.resolve(p, nid, plan, null, fate);
  }

  /** coop = [待っていた人, その人の plan, その人の戦力] */
  *resolve(p: Player, nid: string, plan: Plan, coop: [Player, Plan, number] | null, fate: number | null = null): Gen {
    const nd = this.nest(nid);
    const m = MON[nd.mon!];
    const es = this.eff_str(p, m, nd);
    const partner = coop ? coop[2] : 0;
    const power = plan.power + partner;
    const need = es - power;
    this.last_need = need;
    if (this.E) {
      const seats = coop ? [coop[0].pid, p.pid] : [p.pid];
      const shownStr = es + nd.dmg + nd.trap;
      this.emit({ t: 'combat_start', nest: nid, monster: m.id, seats, strength: shownStr, wounds: nd.dmg, boss: false });
      if (coop) {
        const partParts = (coop[1].parts ?? []).map((x) => ({ ...x }));
        const extra = partner - coop[1].power;
        if (extra) partParts.push({ kind: 'coop', label: '共闘の加勢', value: extra, seat: coop[0].pid });
        this.emit({ t: 'power', parts: partParts });
      }
      this.emit({ t: 'power', parts: plan.parts ?? [{ kind: 'companion', label: '戦力', value: plan.power, seat: p.pid }] });
      if (nd.trap) this.emit({ t: 'power', parts: [{ kind: 'trap', label: '罠', value: nd.trap }] });
    }
    const f = fate !== null ? fate : this.draw_fate(p, need);
    if (fate !== null) this.remove_fate(p, f);
    else if (this.E) this.emit({ t: 'fate_flip', seat: p.pid, value: f, ...(this.lastFate.values.length > 1 ? { values: this.lastFate.values } : {}) });
    const total = power + f;
    const win = total >= es;
    this.fights += 1;
    if (this.E) {
      const el = m.weak && plan.els.has(m.weak) ? m.weak : [...plan.els][0];
      this.emit({ t: 'clash', total: total + nd.trap, strength: es + nd.trap, result: win ? 'win' : 'lose', ...(el ? { el } : {}) });
      if (win) this.emit({ t: 'hit', amount: Math.max(1, es) });
    }
    const parts: [Player, Plan][] = [[p, plan], ...(coop ? [[coop[0], coop[1]] as [Player, Plan]] : [])];
    for (const [q, pl] of parts) {
      q.fights += 1;
      yield* this.injure(q, m, pl, win, coop && (q === p ? coop[0].occs : p.occs).includes('o06') ? 1 : 0);
    }
    if (win) {
      this.kills += 1;
      nd.mon = null;
      nd.dmg = 0;
      if (nd.trap) {
        const tp = nd.trapper;
        if (tp !== null) { this.players[tp].res.gold += 1; this.emit({ t: 'grant', seat: tp, gain: { gold: 1 }, reason: '罠' }); }
        nd.trap = 0;
        nd.trapper = null;
      }
      if (coop) {
        const q = coop[0];
        const full = p.occs.includes('o24') || q.occs.includes('o24');
        const bothTrophy = full || (p.hand.includes('i25') && p.res.gold >= 2);
        if (bothTrophy && !full && p.hand.includes('i25')) {
          p.res.gold -= 2;
          this.spell_used(p, 'i25');
          this.emit({ t: 'spell', seat: p.pid, card: 'i25' });
          this.emitPay(p, { gold: 2 });
        }
        const lead = plan.power >= coop[1].power ? p : q;
        for (const who of [p, q]) {
          const tro = who === lead || bothTrophy;
          yield* this.win_reward(who, m, who === p ? plan : coop[1], tro, !full, who === lead);
          who.st.coop += 1;
        }
      } else yield* this.win_reward(p, m, plan, true, false, false);
      this.emit({ t: 'monster_leave', nest: nid });
    } else {
      const dmg = Math.max(1, Math.floor(power / 2));
      nd.dmg += dmg;
      if (nd.trap) nd.trap = 0;
      this.emit({ t: 'hit', amount: dmg });
      for (const [q, pl] of parts) {
        if (q.hand.includes('i22')) {
          const c = this.spell_cost(q, { mana: 1 });
          if (canPay(q, c)) {
            const paid = pay(q, c);
            this.spell_used(q, 'i22');
            this.emit({ t: 'spell', seat: q.pid, card: 'i22', el: 'light' });
            this.emitPay(q, paid);
            for (const i of pl.idxs) {
              const was = q.injured.has(i);
              q.injured.delete(i);
              q.used.delete(i);
              if (this.E) {
                if (was) this.emit({ t: 'heal', seat: q.pid, companion: compId(q.pid, i) });
                this.emit({ t: 'recall', seat: q.pid, companion: compId(q.pid, i) });
              }
            }
          }
        }
      }
    }
    this.emit({ t: 'combat_end' });
  }

  *injure(q: Player, m: MonsterDef, pl: Plan, win: boolean, partnerBonus = 0): Gen {
    const def = this.defense(q, pl.k) + partnerBonus;
    const ctr = this.counter(q, m, pl);
    const over = ctr - def;
    let inj = over <= 0 ? 0 : over >= 3 ? 2 : 1;
    if (q.occs.includes('o11') || q.weapons.includes('i26')) inj = Math.max(inj, 1);
    inj = Math.min(inj, pl.idxs.length);
    let hurt = [...pl.idxs].sort((a, b) => q.skills[a] - q.skills[b]).slice(0, inj);
    this.emit({ t: 'counter', amount: ctr, defense: def });
    if (hurt.length && q.occs.includes('o04') && !q.once.has('o04')) {
      q.once.add('o04');
      hurt = hurt.slice(1);
    }
    if (q.char === 'sana') {
      while (hurt.length && q.res.herb >= 1 && (yield* this.ask({ k: 'heal', g: this, p: q }))) {
        q.res.herb -= 1;
        this.emitPay(q, { herb: 1 });
        hurt = hurt.slice(1);
      }
    }
    for (const i of hurt) {
      q.injured.add(i);
      if (this.E) { this.emit({ t: 'injury', seat: q.pid, companion: compId(q.pid, i) }); this.shownHurt[q.pid].add(i); }
    }
    void win;
  }

  *win_reward(p: Player, m: MonsterDef, plan: Plan, trophy = true, half = false, lead = false): Gen {
    let loot: Record<string, number> = { ...(m.loot as Record<string, number>) };
    if (p.char === 'riku') loot.mat = (loot.mat ?? 0) + 1;
    if (p.weapons.includes('i07')) loot.mat = (loot.mat ?? 0) + 1;
    if (p.occs.includes('o25') && isBeast(m)) loot.mat = (loot.mat ?? 0) + 2;
    if (half) loot = Object.fromEntries(Object.entries(loot).map(([r, n]) => [r, Math.floor((n + (lead ? 1 : 0)) / 2)]));
    let tamed = false;
    if (isBeast(m) && (p.char === 'haru' || p.occs.includes('o07') || p.weapons.includes('i09'))) {
      const cap = (p.char === 'haru' || p.weapons.includes('i09') ? 2 : 1) + (p.occs.includes('o07') ? 1 : 0);
      const fc = 3 - (p.weapons.includes('i09') ? 1 : 0);
      if (p.pets < cap && p.res.food >= fc && (yield* this.ask({ k: 'tame', g: this, p, m }))) {
        p.res.food -= fc;
        p.pets += 1;
        tamed = true;
        this.emitPay(p, { food: fc });
        this.emit({ t: 'familiar', seat: p.pid, monster: m.id });
      }
    }
    if (!tamed) {
      add(p, loot as Cost);
      if (this.E && Object.values(loot).some((x) => x)) this.emit({ t: 'loot', seat: p.pid, gain: Object.fromEntries(Object.entries(loot).filter(([, x]) => x)) as Cost });
    }
    if (trophy && (!tamed || D.TAME_KEEPS_TROPHY)) {
      p.trophies += m.trophy;
      this.emit({ t: 'trophy', seat: p.pid, monster: m.id, fame: m.trophy });
    } else if (half && !trophy) {
      const t = Math.floor(m.trophy * D.COOP_SUPPORT_SHARE + 0.5);
      p.trophies += t;
      this.emit({ t: 'trophy', seat: p.pid, monster: m.id, fame: t });
    }
    p.st.kills += 1;
    if (isBeast(m)) p.st.beast += 1;
    if (m.race === 'undead') p.st.undead += 1;
    if (m.weak && plan.els.has(m.weak)) {
      p.st.weak += 1;
      if (m.weak === 'fire' && p.occs.includes('o01') && plan.boosts.some((b) => b[0] === 'o01')) {
        p.res.mana += 1;
        this.emit({ t: 'grant', seat: p.pid, gain: { mana: 1 }, reason: CARDS.o01.name });
      }
    }
    for (const [nm, pw] of plan.boosts) {
      if (nm === 'i28') { p.res.gold += 4 * pw; this.emit({ t: 'grant', seat: p.pid, gain: { gold: 4 * pw }, reason: CARDS.i28.name }); }
    }
    p.kills_log.push([this.round, m.id]);
  }

  *resolve_lair(): Gen {
    const m = this.bosses[this.round];
    if (!this.lair.length) {
      if (this.round === 12) {
        for (const p of this.players) p.card_fame -= D.DRAGON_FAIL;
        this.emit({ t: 'dragon_fail', fame: D.DRAGON_FAIL });
      } else this.dragon = m;
      return;
    }
    let power = 0;
    let fates = 0;
    for (const e of this.lair) power += e.plan.power;
    if (this.E) {
      this.emit({ t: 'combat_start', nest: 'lair', monster: m.id, seats: this.lair.map((e) => e.pid), strength: m.str, wounds: 0, boss: true });
      for (const e of this.lair) this.emit({ t: 'power', parts: e.plan.parts ?? [{ kind: 'companion', label: '戦力', value: e.plan.power, seat: e.pid }] });
    }
    for (const e of this.lair) {
      const p = this.players[e.pid];
      const f = this.draw_fate(p, null);
      fates += f;
      if (this.E) this.emit({ t: 'fate_flip', seat: p.pid, value: f, ...(this.lastFate.values.length > 1 ? { values: this.lastFate.values } : {}) });
    }
    const win = power + fates >= m.str;
    this.emit({ t: 'clash', total: power + fates, strength: m.str, result: win ? 'win' : 'lose', ...(m.weak ? { el: m.weak } : {}) });
    this.emit({ t: 'hit', amount: win ? m.str : Math.max(1, Math.floor(power / 2)) });
    let top = this.lair[0];
    for (const e of this.lair) if (e.plan.power > top.plan.power) top = e;
    for (const e of this.lair) {
      const p = this.players[e.pid];
      p.fights += 1;
      yield* this.injure(p, m, e.plan, win);
      if (this.round === 12 && p.occs.includes('o17')) { p.card_fame += D.O17_DRAGON_FAME; this.emit({ t: 'fame', seat: p.pid, amount: D.O17_DRAGON_FAME, reason: CARDS.o17.name }); }
    }
    if (win) {
      this.kills += 1;
      for (const e of this.lair) {
        const p = this.players[e.pid];
        p.st.boss += 1;
        if (this.round === 12) {
          p.trophies += D.DRAGON_JOIN_FAME;
          this.emit({ t: 'trophy', seat: p.pid, monster: m.id, fame: D.DRAGON_JOIN_FAME });
          if (p.occs.includes('o26')) { p.card_fame += 8; this.emit({ t: 'fame', seat: p.pid, amount: 8, reason: CARDS.o26.name }); }
        } else {
          if (p.pid === top.pid) {
            p.trophies += m.trophy;
            add(p, m.loot);
            this.emit({ t: 'loot', seat: p.pid, gain: m.loot });
            this.emit({ t: 'trophy', seat: p.pid, monster: m.id, fame: m.trophy });
          } else {
            const t = Math.floor(m.trophy * D.BOSS_SHARE);
            p.trophies += t;
            this.emit({ t: 'trophy', seat: p.pid, monster: m.id, fame: t });
          }
          yield* this.reward_cards(p, p.occs.includes('o29') ? 4 : 3, 1, 'boss');
        }
        if (p.weapons.includes('i26')) { p.card_fame += D.I26_BOSS_FAME; this.emit({ t: 'fame', seat: p.pid, amount: D.I26_BOSS_FAME, reason: CARDS.i26.name }); }
      }
    } else if (this.round === 12) {
      for (const p of this.players) p.card_fame -= D.DRAGON_FAIL;
      this.emit({ t: 'dragon_fail', fame: D.DRAGON_FAIL });
    } else this.dragon = m;
    this.emit({ t: 'combat_end' });
  }

  // ------------------------------------------------------------ 取引
  trade(a: Player, b: Player, give: Cost, get: Cost) {
    for (const [r, n] of Object.entries(give)) { a.res[r as Res] -= n as number; b.res[r as Res] += n as number; }
    for (const [r, n] of Object.entries(get)) { b.res[r as Res] -= n as number; a.res[r as Res] += n as number; }
    this.emit({ t: 'trade', a: a.pid, b: b.pid, give, get });
    for (const x of [a, b]) {
      if (x.char === 'aya') { x.res.gold += D.AYA_TRADE_GOLD; this.emit({ t: 'grant', seat: x.pid, gain: { gold: D.AYA_TRADE_GOLD }, reason: 'アヤの取引' }); }
    }
    this.trades += 1;
  }

  weapon_els(p: Player): Set<Element> {
    return new Set(p.weapons.filter((w) => w in WEAPON_EL).map((w) => WEAPON_EL[w]));
  }
}

export { EL_LABEL };
