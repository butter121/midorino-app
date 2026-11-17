// 霧谷の冒険者団 v2 — ルールエンジン（SPEC.md）。
// ・v1 と同じく、選択はジェネレーターの yield で外に出す（人間）か、その場で AI が答える。
// ・カードの効果はすべて §8 の DSL（dsl.ts で形を確かめ、ここの runOps / fire で実行）。カード固有の if 文は書かない。
// ・画面向けの出来事（GameEvent）は本物の盤面だけが出す（複製では E = null）。
import * as D from './data';
import { Rng } from './rng';
import {
  addCost, addMod, cardEffects, checkCond, cleanCost, costUnits, emptyMods, EXPAND_OPS, opKey, subCost, validateCard, validateEffect,
  type CondEnv, type FightEnv, type ModSum,
} from './dsl';
import type {
  AncientDef, CardDef, CardSet, Cost, Effect, EngineTag, FightMode, GameEvent, GearDef, Monster, MonsterType, Op, PowerPart, QuestDef,
  Race, Res, ScoreItem, ScoreRow, Season, SpaceDef, StageDef, StatKey,
} from './types';
import { RES } from './types';

const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter'];
const ITEM_KINDS = ['weapon', 'tool', 'spell'] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];
export type Ratio = Record<ItemKind, number>;

// ------------------------------------------------------------ 選択
export type Choice =
  | string
  | { m: 'sell' | 'buy'; r: Res; q: number }
  | { m: 'both'; sell: { r: Res; q: number }; buy: { r: Res; q: number } }
  | { m: 'item'; id: string };

/** 置く場所の選択肢。s＝マス（巣・'lair'・秘術は '@spell'）、i＝そのマスの何番目の手順（−1 は instead のカード効果） */
export interface Option {
  s: string;
  i: number;
  x?: Choice;
  k?: number;
  mode?: FightMode;
  join?: boolean;
  card?: string;
  e?: number;
}

export type CardWhy = 'leader' | 'occ' | 'item' | 'start_occ' | 'start_item' | 'quest' | 'draw' | 'refill_occ' | 'refill_item';
export type Req =
  | { k: 'card'; g: Game; p: Player; why: CardWhy; cards: string[]; kind?: string }
  | { k: 'ratio'; g: Game; p: Player; options: Ratio[] }
  | { k: 'kind'; g: Game; p: Player; options: ItemKind[]; left: Ratio }
  | { k: 'choose'; g: Game; p: Player; opts: Option[] }
  | { k: 'heal'; g: Game; p: Player; comp: number; cost: Cost }
  | { k: 'effect'; g: Game; p: Player; card: string; when: string; ops: Op[] }
  | { k: 'pick'; g: Game; p: Player; what: string; options: Choice[] };
export type Gen<T = void> = Generator<Req, T, any>;

export interface Brain {
  respond(req: Req): any;
  tradePhase?(g: Game, p: Player): void;
  judgeOffer?(g: Game, p: Player, give: Cost, get: Cost): boolean;
}

export function humanDefault(req: Req): any {
  switch (req.k) {
    case 'card': return req.cards[0];
    case 'ratio': return req.options[0];
    case 'kind': return req.options[0];
    case 'choose': return req.opts[0];
    case 'pick': return req.options[0];
    case 'heal': return true;
    case 'effect': return true;
  }
}
export const autoAnswer = (req: Req) => (req.p.ai ? req.p.ai.respond(req) : humanDefault(req));
export function drive<T>(gen: Gen<T>): T {
  let r = gen.next();
  while (!r.done) r = gen.next(autoAnswer(r.value));
  return r.value;
}

// ------------------------------------------------------------ プレイヤー
export interface Comp { atk: number; def: number; weapon: string | null; armor: string | null; leader: boolean; injured: boolean; rest: boolean; used: boolean }
export type FameSrc = 'trophy' | 'quest' | 'donate' | 'card' | 'effect' | 'dragon';

export class Player {
  pid: number;
  ai: Brain | null;
  leader: string | null = null;
  comps: Comp[] = [];
  res: Record<Res, number> = Object.fromEntries(RES.map((r) => [r, 0])) as Record<Res, number>;
  beds = D.START.beds;
  walls = 0;
  tools: string[] = [];
  occs: string[] = [];
  hand: string[] = [];
  items: string[] = [];
  ancient: string[] = [];
  pets = 0;
  kills = 0;
  races: Race[] = [];
  st = { boss: 0, coop: 0, weak: 0, spells: 0, donations: 0, trades: 0, fights: 0, wins: 0 };
  quests: string[] = [];
  secret: string | null = null;
  discontent = 0;
  raidLoss = 0;
  fame: Record<FameSrc, number> = { trophy: 0, quest: 0, donate: 0, card: 0, effect: 0, dragon: 0 };
  fate: number[] = [];
  limits: Record<string, number> = {};
  future: { round: number; gain: Cost }[] = [];
  extra = 0;
  ignoreFull = false;
  /** 秘術を play で使ったときの戦闘の op（そのラウンドの自分の戦闘すべてに効く） */
  rbuf: FightBuf = emptyBuf();
  /** このラウンドに最後に使ったマス（place_again 用） */
  lastSpace: { s: string; i: number } | null = null;
  tradesUsed = 0;
  ratio: Ratio = { weapon: 0, tool: 0, spell: 0 };
  /** AI が目指す強い動き（測定用。AI が書く） */
  target: EngineTag[] = [];
  /** 取ったカード（測定用） */
  picked: string[] = [];
  /** このラウンドにしたこと（測定用） */
  acts: string[] = [];
  history: string[][] = [];
  /** ラウンドの終わりの効果を持つカード（測定用） */
  cardHist: string[][] = [];
  /** 冬に食べさせられたか（測定用） */
  fed: boolean[] = [];

  constructor(pid: number, ai: Brain | null) { this.pid = pid; this.ai = ai; }

  clone(): Player {
    const q = new Player(this.pid, this.ai);
    q.leader = this.leader;
    q.comps = this.comps.map((c) => ({ ...c }));
    q.res = { ...this.res };
    q.beds = this.beds; q.walls = this.walls;
    q.tools = [...this.tools]; q.occs = [...this.occs]; q.hand = [...this.hand]; q.items = [...this.items]; q.ancient = [...this.ancient];
    q.pets = this.pets; q.kills = this.kills;
    q.races = [...this.races];
    q.st = { ...this.st };
    q.quests = [...this.quests];
    q.secret = this.secret; q.discontent = this.discontent; q.raidLoss = this.raidLoss;
    q.fame = { ...this.fame };
    q.fate = [...this.fate];
    q.limits = { ...this.limits };
    q.future = this.future.map((f) => ({ ...f }));
    q.extra = this.extra; q.ignoreFull = this.ignoreFull;
    q.rbuf = { ...this.rbuf };
    q.lastSpace = this.lastSpace;
    q.tradesUsed = this.tradesUsed;
    q.ratio = this.ratio;
    q.target = this.target;
    q.acts = [...this.acts];
    // history / fed / picked はラウンドの終わり・準備段階でしか増えないので、先読みの複製では共有する
    q.history = this.history; q.fed = this.fed; q.picked = this.picked; q.cardHist = this.cardHist;
    return q;
  }

  free(): number[] { const o: number[] = []; this.comps.forEach((c, i) => { if (!c.used && !c.rest) o.push(i); }); return o; }
  avail() { return this.free().length + this.extra; }
  /** 戦闘に出せる人数（もう1人置ける分は、休んでいない仲間がもう一度出る） */
  fightable() { return Math.min(this.free().length + this.extra, this.comps.filter((c) => !c.rest && !c.injured).length); }
}

export interface FightBuf { power: number; guard: number; counter: number; loot: number; trophy: number; str: number; noInj: number }
export const emptyBuf = (): FightBuf => ({ power: 0, guard: 0, counter: 0, loot: 0, trophy: 0, str: 0, noInj: 0 });

export function canPay(p: Player, c: Cost): boolean {
  for (const [r, n] of Object.entries(c)) if (p.res[r as Res] < (n as number)) return false;
  return true;
}
export function payRes(p: Player, c: Cost) { for (const [r, n] of Object.entries(c)) p.res[r as Res] -= n as number; }
export function gainRes(p: Player, c: Cost) { for (const [r, n] of Object.entries(c)) p.res[r as Res] += n as number; }
export const costValue = (c: Cost) => Object.entries(c).reduce((a, [r, n]) => a + D.RES_VAL[r as Res] * (n as number), 0);

// ------------------------------------------------------------ 盤面の部品
export interface SpaceSt { id: string; def: SpaceDef; stage?: string; optEffects?: Effect[]; stock: Cost; occ: number[] }
export interface NestSt { id: string; mon: Monster | null; groups: number; wait: { pid: number; idxs: number[] } | null }
export interface Plan extends FightBuf {
  pid: number; idxs: number[]; mode: FightMode; power: number; parts: PowerPart[]; guard: number; counter: number; loot: number; trophy: number;
  str: number; noInj: number; cost: Cost; boosts: string[]; spells: string[]; used: string[]; rearAll: boolean; weak: boolean;
}

export interface GameOptions {
  seed?: number;
  years?: number;
  cards: CardSet;
  /** 画面向けの出来事を出す（me は手札などを見せる席。観戦は −1） */
  events?: { me: number; names: string[] };
}

/** カード一式を読み込む（全カードの DSL を確かめる。知らない op は例外） */
export function loadCards(cs: CardSet) {
  const byId = new Map<string, CardDef>();
  for (const list of [cs.leaders, cs.occupations, cs.weapons, cs.tools, cs.spells, cs.gear, cs.stages]) {
    for (const c of list) {
      validateCard(c);
      if (byId.has(c.id)) throw new Error(`duplicate card id ${c.id}`);
      byId.set(c.id, c);
    }
  }
  for (const q of cs.quests) {
    validateEffect({ when: 'passive', mod: {}, if: q.need }, `${q.id}.need`);
  }
  return byId;
}

// ------------------------------------------------------------ ゲーム
export class Game {
  rng: Rng;
  n: number;
  years: number;
  R: number;
  cs: CardSet;
  byId: Map<string, CardDef>;
  quest: Map<string, QuestDef>;
  anc: Map<string, AncientDef>;
  players: Player[];
  spaces: SpaceSt[] = [];
  nests: NestSt[] = [];
  lairQ: { pid: number; idxs: number[]; mode: FightMode }[] = [];
  forecastQ: Monster[] = [];
  bossOf: Record<number, Monster> = {};
  bossTypes: MonsterType[] = [];
  bossFailedYear = new Set<number>();
  stageAt: Record<number, string> = {};
  monDeck: string[] = [];
  decks: { leader: string[]; occ: string[]; weapon: string[]; tool: string[]; spell: string[]; ancient: string[]; secret: string[] };
  gearStock: Record<string, number> = {};
  quests: { id: string; done: number[] }[] = [];
  first = 0;
  nextFirst: number | null = null;
  round = 0;
  uid = 0;
  over = false;
  errors: string[] = [];
  /** 先読み：運命カードを決め打ちする（AI の複製だけ） */
  forceFate: number | null = null;
  /** 先読み：最後の戦闘（運命を足す前の戦力と強さ） */
  lastClash: { base: number; strength: number; win: boolean } | null = null;
  E: GameEvent[] | null = null;
  me = -1;
  names: string[] = [];
  /** 測定：戦闘の運命（運の寄与の推定に使う） */
  fateLog: { pid: number; v: number }[] = [];
  monLog: { round: number; dev: number }[] = [];

  constructor(n: number, ais: (Brain | null)[], opts: GameOptions) {
    if (n < 2 || n > 6) throw new Error('players must be 2..6');
    this.rng = new Rng(opts.seed ?? 0);
    this.n = n;
    this.years = opts.years ?? 5;
    if (![5, 10, 15].includes(this.years)) throw new Error('years must be 5, 10 or 15');
    this.R = this.years * 4;
    this.cs = opts.cards;
    this.byId = loadCards(opts.cards);
    this.quest = new Map(opts.cards.quests.map((q) => [q.id, q]));
    this.anc = new Map();
    const ancDeck: string[] = [];
    for (const a of opts.cards.ancient) { this.anc.set(a.id, a); for (let i = 0; i < (a.copies ?? 3); i++) ancDeck.push(a.id); }
    this.players = Array.from({ length: n }, (_, i) => new Player(i, ais[i] ?? null));
    const rng = this.rng;
    this.decks = {
      leader: rng.shuffle(opts.cards.leaders.map((c) => c.id)),
      occ: rng.shuffle(opts.cards.occupations.map((c) => c.id)),
      weapon: rng.shuffle(opts.cards.weapons.map((c) => c.id)),
      tool: rng.shuffle(opts.cards.tools.map((c) => c.id)),
      spell: rng.shuffle(opts.cards.spells.map((c) => c.id)),
      ancient: rng.shuffle(ancDeck),
      secret: rng.shuffle(opts.cards.quests.filter((q) => q.secret).map((q) => q.id)),
    };
    const delta = n <= 3 ? -1 : n >= 5 ? 1 : 0;
    for (const gd of opts.cards.gear) this.gearStock[gd.id] = Math.max(1, gd.count + delta);
    const pub = opts.cards.quests.filter((q) => !q.secret).map((q) => q.id);
    this.quests = rng.sample(pub, Math.min(3, pub.length)).map((id) => ({ id, done: [] }));
    for (const s of D.SPACES) if ((s.min_p ?? 0) <= n) this.spaces.push({ id: s.id, def: s, stock: {}, occ: [] });
    this.nests = D.NESTS[n].map((id) => ({ id, mon: null, groups: 0, wait: null }));
    this.monDeck = rng.shuffle(D.MONSTERS.map((m) => m.id));
    this.bossTypes = rng.sample(D.BOSS_TYPES, 4);
    this.scheduleStages();
    if (opts.events) { this.E = []; this.me = opts.events.me; this.names = opts.events.names; }
  }

  // ------------------------------------------------------------ 段階カードの予定（§4）
  private scheduleStages() {
    const byStage: Record<number, StageDef[]> = {};
    for (const s of this.cs.stages) (byStage[s.stage] ??= []).push(s);
    // 段階1：R2〜R4 に3枚全部（順番はくじ）
    const s1 = this.rng.shuffle([...(byStage[1] ?? [])]);
    s1.slice(0, 3).forEach((c, i) => { this.stageAt[2 + i] = c.id; });
    // 段階2〜5：残りのラウンドを4等分し、その中で4枚を均等に
    const start = 5, rest = this.R - 4;
    for (let st = 2; st <= 5; st++) {
      const cand = this.rng.shuffle([...(byStage[st] ?? [])]).slice(0, 4);
      const lo = start + Math.floor((rest * (st - 2)) / 4);
      const hi = start + Math.floor((rest * (st - 1)) / 4);
      const span = hi - lo;
      cand.forEach((c, i) => {
        let r = lo + Math.floor((i * span) / cand.length);
        while (this.stageAt[r] && r < hi - 1) r++;
        if (!this.stageAt[r]) this.stageAt[r] = c.id;
      });
    }
  }

  // ------------------------------------------------------------ 複製（AI の先読み）
  clone(): Game {
    const g = Object.create(Game.prototype) as Game;
    g.rng = new Rng(this.rng.state ^ 0x5bd1e995);
    g.n = this.n; g.years = this.years; g.R = this.R; g.cs = this.cs; g.byId = this.byId; g.quest = this.quest; g.anc = this.anc;
    g.players = this.players.map((p) => p.clone());
    g.spaces = this.spaces.map((s) => ({ ...s, stock: { ...s.stock }, occ: [...s.occ] }));
    g.nests = this.nests.map((nd) => ({ ...nd, mon: nd.mon ? { ...nd.mon } : null, wait: nd.wait ? { ...nd.wait, idxs: [...nd.wait.idxs] } : null }));
    g.lairQ = this.lairQ.map((e) => ({ ...e, idxs: [...e.idxs] }));
    g.forecastQ = this.forecastQ.map((m) => ({ ...m }));
    g.bossOf = { ...this.bossOf };
    for (const k of Object.keys(g.bossOf)) g.bossOf[Number(k)] = { ...g.bossOf[Number(k)] };
    g.bossTypes = this.bossTypes;
    g.bossFailedYear = new Set(this.bossFailedYear);
    g.stageAt = this.stageAt;
    g.monDeck = [...this.monDeck];
    g.decks = { leader: [...this.decks.leader], occ: [...this.decks.occ], weapon: [...this.decks.weapon], tool: [...this.decks.tool], spell: [...this.decks.spell], ancient: [...this.decks.ancient], secret: [...this.decks.secret] };
    g.gearStock = { ...this.gearStock };
    g.quests = this.quests.map((q) => ({ id: q.id, done: [...q.done] }));
    g.first = this.first; g.nextFirst = this.nextFirst; g.round = this.round; g.uid = this.uid; g.over = this.over;
    g.errors = [];
    g.forceFate = null; g.lastClash = null;
    g.E = null; g.me = this.me; g.names = this.names;
    g.fateLog = []; g.monLog = [];
    return g;
  }

  // ------------------------------------------------------------ 情報
  get t() { return this.R <= 1 ? 0 : (Math.max(1, this.round) - 1) / (this.R - 1); }
  tAt(r: number) { return this.R <= 1 ? 0 : (r - 1) / (this.R - 1); }
  season(r = this.round): Season { return SEASONS[(Math.max(1, r) - 1) % 4]; }
  year(r = this.round) { return Math.floor((Math.max(1, r) - 1) / 4) + 1; }
  isWinter(r = this.round) { return r % 4 === 0; }
  bossYears() { return D.BOSS_YEARS[this.years]; }
  card(id: string): CardDef { const c = this.byId.get(id); if (!c) throw new Error(`unknown card ${id}`); return c; }
  space(id: string) { return this.spaces.find((s) => s.id === id); }
  nest(id: string) { return this.nests.find((n) => n.id === id); }
  emit(ev: GameEvent) { if (this.E) this.E.push(ev); }
  private *ask(req: Req): Gen<any> {
    if (req.p.ai) return req.p.ai.respond(req);
    return yield req;
  }

  /** 効果を持つカード（リーダー・出した職能・建てた道具・装備中の品物）。fightIdxs を渡すと装備は送った仲間の分だけ */
  activeCards(p: Player, fightIdxs?: number[]): string[] {
    const out: string[] = [];
    if (p.leader) out.push(p.leader);
    out.push(...p.occs, ...p.tools);
    p.comps.forEach((c, i) => {
      if (fightIdxs && !fightIdxs.includes(i)) return;
      if (c.weapon) out.push(c.weapon);
      if (c.armor) out.push(c.armor);
    });
    return out;
  }
  has(p: Player, id: string) { return this.activeCards(p).includes(id) || p.items.includes(id); }

  mods(p: Player): ModSum {
    const s = emptyMods();
    for (const id of this.activeCards(p)) {
      for (const e of cardEffects(this.card(id))) if (e.when === 'passive' && e.mod && checkCond(e.if, this.env(p))) addMod(s, e.mod);
    }
    return s;
  }

  stat(p: Player, k: StatKey): number {
    switch (k) {
      case 'comps': return p.comps.length;
      case 'occs': return p.occs.length;
      case 'walls': return p.walls;
      case 'beds': return p.beds;
      case 'facilities': return p.tools.length;
      case 'gear': return p.comps.reduce((a, c) => a + (c.weapon ? 1 : 0) + (c.armor ? 1 : 0), 0);
      case 'pets': return p.pets;
      case 'kills': return p.kills;
      case 'races': return p.races.length;
      case 'trophies': return p.fame.trophy;
      case 'hand': return p.hand.length;
      case 'ancient': return p.ancient.length;
      case 'quests': return p.quests.length;
      case 'skills': return p.comps.reduce((a, c) => a + c.atk + c.def, 0);
      case 'injured': return p.comps.filter((c) => c.injured).length;
      case 'boss': return p.st.boss;
      case 'coop': return p.st.coop;
      case 'weak': return p.st.weak;
      case 'spells': return p.st.spells;
      case 'donations': return p.st.donations;
      case 'trades': return p.st.trades;
      case 'year': return this.year();
      case 'round': return this.round;
    }
  }

  env(p: Player, fight?: FightEnv): CondEnv {
    return { stat: (k) => this.stat(p, k), season: this.season(), t: this.t, res: p.res, has: (id) => this.has(p, id), ...(fight ? { fight } : {}) };
  }

  private limitKey(card: string, e: number) { return `${card}#${e}`; }
  limitOk(p: Player, card: string, e: number, lim: Effect['limit']): boolean {
    if (!lim) return true;
    const v = p.limits[this.limitKey(card, e)];
    if (v === undefined) return true;
    if (lim === 'game') return false;
    if (lim === 'year') return v !== this.year();
    return v !== this.round;
  }
  markLimit(p: Player, card: string, e: number, lim: Effect['limit']) {
    if (!lim) return;
    p.limits[this.limitKey(card, e)] = lim === 'year' ? this.year() : this.round;
  }

  // ------------------------------------------------------------ 費用
  discount(p: Player, kind: string): Cost {
    let d: Cost = {};
    for (const cd of this.mods(p).cost_discount) if (cd.kind === kind || cd.kind === 'any') d = addCost(d, cd.res);
    return d;
  }
  cardCost(p: Player, id: string, extraDiscount: Cost = {}): Cost {
    const c = this.card(id);
    const kind = c.kind === 'gear' ? 'gear' : c.kind;
    return subCost(subCost(c.cost ?? {}, this.discount(p, kind)), extraDiscount);
  }
  /** ギルドで職能を出す費用（食料1、2枚目から2。カードの cost はその上乗せ） */
  occCost(p: Player, id?: string): Cost {
    const playedViaGuild = Math.max(0, p.occs.length - 1);
    const base = addCost({ food: D.OCC_FOOD[Math.min(playedViaGuild, 1)] }, id ? this.card(id).cost ?? {} : {});
    return subCost(base, this.discount(p, 'occ'));
  }
  bedCost(p: Player, disc: Cost = {}) { return subCost(subCost(D.BED_COST, this.discount(p, 'bed')), disc); }
  wallCost(p: Player, disc: Cost = {}) { return subCost(subCost(D.WALL_COST, this.discount(p, 'wall')), disc); }
  prereqOk(p: Player, id: string): boolean {
    const pr = this.card(id).prereq;
    if (!pr) return true;
    if (pr.occs !== undefined && p.occs.length < pr.occs) return false;
    if (pr.comps !== undefined && p.comps.length < pr.comps) return false;
    if (pr.walls !== undefined && p.walls < pr.walls) return false;
    if (pr.facilities !== undefined && p.tools.length < pr.facilities) return false;
    if (pr.kills !== undefined && p.kills < pr.kills) return false;
    if (pr.has !== undefined && !this.has(p, pr.has)) return false;
    return true;
  }
  bedCap(p: Player) { return p.beds + this.mods(p).bed_cap; }
  marketQty(p: Player) { return D.MARKET_QTY + this.mods(p).market_qty; }
  sellPrice(p: Player, r: Res) { return D.sellPrice(r) + this.mods(p).sell_bonus; }
  itemSell(id: string) {
    const c = this.card(id);
    if (c.sell !== undefined) return c.sell;
    const v = Object.entries(c.cost ?? {}).reduce((a, [r, n]) => a + D.BUY[r as Res] * (n as number), 0);
    return Math.max(1, Math.floor(v / 2));
  }
  storage(p: Player): string[] {
    const eq = [...p.comps.map((c) => c.weapon), ...p.comps.map((c) => c.armor)].filter(Boolean) as string[];
    const left = [...p.items];
    for (const e of eq) { const i = left.indexOf(e); if (i >= 0) left.splice(i, 1); }
    return left;
  }
  homeGuard(p: Player) { return p.walls + this.mods(p).base_guard; }
  fightGuardBase(p: Player) { return Math.floor(p.walls / D.WALLS_PER_GUARD) + this.mods(p).base_guard; }
  healCost(p: Player): Cost { return { herb: Math.max(0, D.HEAL_COST - this.mods(p).heal_discount) }; }

  // ------------------------------------------------------------ 魔物
  private drawType(): MonsterType {
    if (!this.monDeck.length) this.monDeck = this.rng.shuffle(D.MONSTERS.map((m) => m.id));
    return D.MON[this.monDeck.shift()!];
  }
  rollMonster(type: MonsterType, t: number, year: number, boss = false): Monster {
    const R = D.MON_ROLL;
    const z = this.rng.truncNormal(0, R.sd, R.clip);
    const n = this.rng.truncNormal(0, R.lootSd, R.lootClip);
    this.monLog.push({ round: this.round, dev: z });
    const str = Math.max(1, Math.round(R.base + R.slope * t + type.grade + z));
    const lootN = Math.max(0, Math.round(str / 2 + n));
    const loot: Cost = {};
    for (let i = 0; i < lootN; i++) { const r = type.loot[i % type.loot.length]; loot[r] = (loot[r] ?? 0) + 1; }
    return {
      uid: ++this.uid, type: type.id, name: type.name, race: type.race, weak: type.weak, str, counter: Math.round(str / 3), loot,
      trophy: Math.max(1, Math.round(str / 2.5 + n)), raid: Math.round(str / 4), boss, year, wounds: 0,
    };
  }
  private refillForecast() {
    const nr = this.round + 1;
    if (nr > this.R) { this.forecastQ = []; return; }
    while (this.forecastQ.length < this.nests.length) this.forecastQ.push(this.rollMonster(this.drawType(), this.tAt(nr), this.year(nr)));
    this.emit({ t: 'monster_forecast', monsters: this.forecastQ.map((m) => ({ ...m })) });
  }

  // ------------------------------------------------------------ 進行
  *play(): Gen<number[]> {
    yield* this.setup();
    for (let r = 1; r <= this.R; r++) {
      this.round = r;
      yield* this.startRound();
      yield* this.workPhase();
      yield* this.endRound();
    }
    for (const p of this.players) yield* this.fire(p, 'game_end', {});
    this.over = true;
    const rows = this.scoreRows();
    this.emit({ t: 'score', rows });
    this.emit({ t: 'game_end' });
    return this.players.map((p) => score(this, p));
  }

  // ------------------------------------------------------------ 準備段階（§2）
  *setup(): Gen {
    const rng = this.rng;
    this.emit({
      t: 'game_start', players: this.players.map((p) => ({ seat: p.pid, name: this.names[p.pid] ?? `P${p.pid + 1}` })), me: this.me,
      years: this.years, rounds: this.R, spaces: this.spaces.map((s) => s.id), nests: this.nests.map((n) => n.id), quests: this.quests.map((q) => q.id),
    });
    // 1. リーダー：最後の手番の人から
    for (let i = this.n - 1; i >= 0; i--) {
      const p = this.players[i];
      const show = this.decks.leader.splice(0, Math.min(5, this.decks.leader.length));
      this.emit({ t: 'leader_offer', seat: p.pid, cards: [...show] });
      const c: string = yield* this.ask({ k: 'card', g: this, p, why: 'leader', cards: show });
      if (!show.includes(c)) throw new Error('bad leader');
      p.leader = c;
      this.decks.leader.push(...show.filter((x) => x !== c));
      rng.shuffle(this.decks.leader);
      this.emit({ t: 'leader_pick', seat: p.pid, card: c });
    }
    // 2. 職能×3
    for (let lap = 0; lap < 3; lap++) {
      for (const p of this.players) yield* this.draftOne(p, 'occ', 'occ');
    }
    // 3〜4. 割合と品物×5
    const ratios: Ratio[] = [];
    for (let w = 0; w <= 5; w++) for (let t = 0; t <= 5 - w; t++) ratios.push({ weapon: w, tool: t, spell: 5 - w - t });
    for (const p of this.players) {
      const ra: Ratio = yield* this.ask({ k: 'ratio', g: this, p, options: ratios });
      p.ratio = { ...ra };
      this.emit({ t: 'ratio', seat: p.pid, ratio: { ...ra } });
    }
    for (const p of this.players) {
      const left: Ratio = { ...p.ratio };
      for (let j = 0; j < 5; j++) {
        const kinds = ITEM_KINDS.filter((k) => left[k] > 0 && this.decks[k].length > 0);
        if (!kinds.length) break;
        const kind: ItemKind = kinds.length === 1 ? kinds[0] : yield* this.ask({ k: 'kind', g: this, p, options: kinds, left: { ...left } });
        left[kind] -= 1;
        yield* this.draftOne(p, kind, 'item');
      }
    }
    // 5. 始めの2枚（費用なし）
    for (const p of this.players) {
      const occs = p.hand.filter((c) => this.card(c).kind === 'occ');
      if (occs.length) {
        const c: string = yield* this.ask({ k: 'card', g: this, p, why: 'start_occ', cards: occs });
        yield* this.playOcc(p, c, true);
      }
      const items = p.hand.filter((c) => ['weapon', 'armor', 'tool'].includes(this.card(c).kind));
      if (items.length) {
        const c: string = yield* this.ask({ k: 'card', g: this, p, why: 'start_item', cards: items });
        yield* this.playItem(p, c, true);
      }
    }
    // 6. 秘密依頼
    for (const p of this.players) {
      const show = this.decks.secret.splice(0, Math.min(2, this.decks.secret.length));
      if (!show.length) continue;
      const c: string = yield* this.ask({ k: 'card', g: this, p, why: 'quest', cards: show });
      p.secret = c;
      this.decks.secret.push(...show.filter((x) => x !== c));
      this.emit({ t: 'secret_quest', seat: p.pid, quest: p.pid === this.me ? c : '?' });
    }
    // 始めの持ち物
    for (const p of this.players) {
      p.comps = [];
      for (let i = 0; i < D.START.comps; i++) p.comps.push(newComp(i === 0));
      p.beds = D.START.beds;
      const g0: Cost = { food: D.START.food + (D.SEAT_FOOD[this.n][p.pid] ?? 0), gold: D.START.gold, wood: D.START.wood, iron: D.START.iron };
      gainRes(p, g0);
      this.emit({ t: 'grant', seat: p.pid, gain: g0, reason: '開始時' });
      this.autoEquip(p);
      yield* this.fire(p, 'setup', {});
    }
    this.round = 0;
    this.refillForecast();
  }

  /** 山から5枚見て1枚（残りは戻して混ぜる） */
  private *draftOne(p: Player, deck: 'occ' | ItemKind, why: CardWhy): Gen {
    const d = this.decks[deck];
    const show = d.splice(0, Math.min(5, d.length));
    if (!show.length) return;
    this.emit({ t: 'draft_offer', seat: p.pid, kind: deck, cards: p.pid === this.me || this.me < 0 ? [...show] : show.map(() => '?') });
    const c: string = yield* this.ask({ k: 'card', g: this, p, why, cards: show, kind: deck });
    if (!show.includes(c)) throw new Error('bad pick');
    p.hand.push(c);
    p.picked.push(c);
    d.push(...show.filter((x) => x !== c));
    this.rng.shuffle(d);
    this.emit({ t: 'draft_pick', seat: p.pid, kind: deck, card: p.pid === this.me || this.me < 0 ? c : '?' });
  }

  // ------------------------------------------------------------ ラウンドの始め（§3.1）
  *startRound(): Gen {
    const r = this.round, y = this.year();
    this.emit({ t: 'round_start', round: r, year: y, season: this.season(), progress: this.t, first: this.first });
    if (this.season() === 'spring') {
      for (const p of this.players) p.fate = this.rng.shuffle([...D.FATE_DECK]);
      const bi = this.bossYears().indexOf(y);
      if (bi >= 0) {
        const wr = y * 4;
        const b = this.rollMonster(this.bossTypes[bi], this.tAt(wr), y, true);
        this.bossOf[wr] = b;
        this.emit({ t: 'boss_reveal', boss: { ...b }, round: wr });
      }
      if (y === this.years) {
        const wr = y * 4;
        const t0 = D.ANCIENT_DRAGON;
        this.bossOf[wr] = {
          uid: ++this.uid, type: t0.id, name: t0.name, race: t0.race, weak: t0.weak, str: D.DRAGON.str, counter: D.DRAGON.counter, loot: { mana: 3, gold: 3 },
          trophy: D.DRAGON.trophy, raid: 0, boss: true, year: y, wounds: 0,
        };
        this.emit({ t: 'boss_reveal', boss: { ...this.bossOf[wr] }, round: wr });
      }
      if (D.REFILL_YEARS[this.years].includes(y)) {
        for (const p of this.players) {
          yield* this.draftOne(p, 'occ', 'refill_occ');
          for (let j = 0; j < 2; j++) {
            const kinds = ITEM_KINDS.filter((k) => this.decks[k].length > 0);
            if (!kinds.length) break;
            const kind: ItemKind = kinds.length === 1 ? kinds[0] : yield* this.ask({ k: 'kind', g: this, p, options: kinds, left: { weapon: 1, tool: 1, spell: 1 } });
            yield* this.draftOne(p, kind, 'refill_item');
          }
        }
      }
    }
    // 段階カード
    const sc = this.stageAt[r];
    if (sc) {
      const st = this.card(sc) as StageDef;
      const opts = st.effects.filter((e) => e.when === 'use' || e.when === `use:${st.id}`);
      this.spaces.push({
        id: st.id, stage: st.id, stock: {}, occ: [], optEffects: opts,
        def: { id: st.id, name: st.name, cap: st.cap ?? 1, ...(st.accum ? { accum: st.accum } : {}), options: opts.map((e) => e.do ?? []) },
      });
      this.emit({ t: 'stage_reveal', card: st.id, stage: st.stage });
    }
    // たまるマス
    const adds: Record<string, Cost> = {};
    for (const s of this.spaces) if (s.def.accum) { s.stock = addCost(s.stock, s.def.accum); adds[s.id] = { ...s.def.accum }; }
    this.emit({ t: 'refill', adds });
    for (const s of this.spaces) s.occ = [];
    for (const p of this.players) {
      p.extra = 0; p.ignoreFull = false; p.tradesUsed = 0; p.acts = []; p.rbuf = emptyBuf(); p.lastSpace = null;
      for (const c of p.comps) c.used = false;
      // 蓄積効果
      const due = p.future.filter((f) => f.round === r);
      p.future = p.future.filter((f) => f.round > r);
      for (const f of due) { gainRes(p, f.gain); this.emit({ t: 'future', seat: p.pid, gain: f.gain }); }
      this.autoEquip(p);
      yield* this.fire(p, 'round_start', {});
    }
    // 魔物の出現（予告されていたもの）と次の予告
    for (const nd of this.nests) {
      nd.groups = 0; nd.wait = null;
      if (!nd.mon && this.forecastQ.length) {
        nd.mon = this.forecastQ.shift()!;
        nd.mon.year = y;
        this.emit({ t: 'monster_spawn', nest: nd.id, monster: { ...nd.mon } });
      }
    }
    this.lairQ = [];
    this.nextFirst = null;
    this.refillForecast();
  }

  // ------------------------------------------------------------ 手番（§3.2）
  *workPhase(): Gen {
    const order = Array.from({ length: this.n }, (_, i) => (this.first + i) % this.n);
    let guard = 0;
    while (order.some((i) => this.players[i].avail() > 0)) {
      if (++guard > 40) { this.errors.push('work loop guard'); break; }
      for (const i of order) {
        const p = this.players[i];
        if (p.avail() <= 0) continue;
        if (p.ai?.tradePhase) p.ai.tradePhase(this, p);
        this.emit({ t: 'turn', seat: p.pid });
        let opts = this.legal(p, true);
        let o: Option = yield* this.ask({ k: 'choose', g: this, p, opts });
        if (!opts.some((x) => sameOpt(x, o))) throw new Error(`illegal option ${JSON.stringify(o)}`);
        if (o.s === '@spell') {
          yield* this.apply(p, o);
          opts = this.legal(p, false);
          o = yield* this.ask({ k: 'choose', g: this, p, opts });
          if (!opts.some((x) => sameOpt(x, o))) throw new Error(`illegal option ${JSON.stringify(o)}`);
        }
        yield* this.apply(p, o);
        this.checkQuests(p);
      }
    }
    // 待ち伏せのまま誰も来なかった巣は単独で戦う（ラウンドの終わり）
    for (const nd of this.nests) {
      if (nd.wait && nd.mon) {
        const w = nd.wait;
        nd.wait = null;
        const p = this.players[w.pid];
        yield* this.fight(nd, [{ p, idxs: w.idxs, mode: 'gamble' }]);
        this.checkQuests(p);
      }
    }
    if (this.bossOf[this.round]) yield* this.resolveLair();
  }

  // ------------------------------------------------------------ ラウンドの終わり（§3.4）
  *endRound(): Gen {
    for (const p of this.players) yield* this.fire(p, 'round_end', {});
    // 仲間が戻る。負傷の回復判定（薬草2で即回復、払わなければ次のラウンド休み）
    for (const p of this.players) {
      for (const c of p.comps) { c.used = false; c.rest = false; }
      for (let i = 0; i < p.comps.length; i++) {
        const c = p.comps[i];
        if (!c.injured) continue;
        const cost = this.healCost(p);
        if (canPay(p, cost) && (yield* this.ask({ k: 'heal', g: this, p, comp: i, cost }))) {
          payRes(p, cost);
          c.injured = false;
          this.emit({ t: 'heal', seat: p.pid, companion: i, cost });
        } else { c.injured = false; c.rest = true; }
      }
    }
    if (this.isWinter()) yield* this.winter();
    for (const p of this.players) { this.checkQuests(p); p.history.push(p.acts); p.cardHist.push(this.activeCards(p)); }
    if (this.nextFirst !== null && this.nextFirst !== this.first) { this.first = this.nextFirst; this.emit({ t: 'first_pass', seat: this.first }); }
    this.emit({ t: 'round_end', round: this.round });
  }

  *winter(): Gen {
    this.emit({ t: 'winter_start' });
    const y = this.year();
    for (const p of this.players) {
      const need = Math.max(0, D.UPKEEP * p.comps.length + this.mods(p).upkeep);
      const paid = Math.min(need, p.res.food);
      p.res.food -= paid;
      const short = need - paid;
      const dis = Math.ceil(short / D.UPKEEP);
      p.discontent += dis;
      p.fed.push(dis === 0);
      this.emit({ t: 'upkeep', seat: p.pid, need, paid, discontent: dis });
    }
    // 襲撃：その年に出て倒されていない魔物（主も）の合計 − 拠点の守り
    let raid = 0;
    for (const nd of this.nests) if (nd.mon && nd.mon.year === y) raid += nd.mon.raid;
    if (this.bossFailedYear.has(y)) raid += this.bossOf[this.round]?.raid ?? 0;
    for (const p of this.players) {
      const blocked = Math.min(raid, this.homeGuard(p));
      const dmg = raid - blocked;
      p.raidLoss += dmg;
      if (raid) this.emit({ t: 'raid', seat: p.pid, damage: dmg, blocked });
      yield* this.fire(p, 'winter', {});
    }
    this.emit({ t: 'winter_end' });
  }

  // ------------------------------------------------------------ 選べる手
  legal(p: Player, spells = true): Option[] {
    const out: Option[] = [];
    if (spells) {
      for (const c of new Set(p.hand)) {
        const cd = this.card(c);
        if (cd.kind !== 'spell') continue;
        cd.effects.forEach((e, ei) => {
          if (e.when !== 'play' || !this.limitOk(p, c, ei, e.limit) || !checkCond(e.if, this.env(p))) return;
          const cost = addCost(this.cardCost(p, c), sumPays(e.do ?? []));
          if (!canPay(p, cost)) return;
          if (!this.expand(p, e.do ?? [], {}, false, this.cardCost(p, c)).length) return;
          out.push({ s: '@spell', i: ei, card: c });
        });
      }
    }
    const nfree = p.fightable();
    const hasComp = nfree > 0;
    if (p.avail() <= 0) return out;
    for (const s of this.spaces) {
      const cap = s.def.cap ?? 1;
      if (cap > 0 && s.occ.length >= cap && !p.ignoreFull) continue;
      s.def.options.forEach((ops, i) => {
        const eff = s.optEffects?.[i];
        if (eff) {
          if (!this.limitOk(p, s.id, i, eff.limit) || !checkCond(eff.if, this.env(p))) return;
        }
        if (!canPay(p, sumPays(ops))) return;
        for (const x of this.expand(p, ops)) out.push(x === undefined ? { s: s.id, i } : { s: s.id, i, x });
      });
      // instead:<space>
      for (const [card, ei, e] of this.effectsOf(p, `instead:${s.id}`)) {
        if (!canPay(p, sumPays(e.do ?? []))) continue;
        for (const x of this.expand(p, e.do ?? [])) out.push({ s: s.id, i: -1, card, e: ei, ...(x === undefined ? {} : { x }) });
      }
    }
    if (hasComp) {
      for (const nd of this.nests) {
        if (!nd.mon) continue;
        if (nd.wait) {
          if (nd.wait.pid === p.pid) continue;
          for (let k = 1; k <= Math.min(D.MAX_SEND, nfree); k++) for (const mode of ['normal', 'safe', 'gamble', 'guard'] as FightMode[]) out.push({ s: nd.id, i: 0, k, mode, join: true });
          continue;
        }
        if (nd.groups >= D.NEST_CAP && !p.ignoreFull) continue;
        for (let k = 1; k <= Math.min(D.MAX_SEND, nfree); k++) {
          for (const mode of ['normal', 'safe', 'gamble', 'chip', 'guard', 'wait'] as FightMode[]) {
            if (mode === 'wait' && (nd.groups > 0 || this.n < 2)) continue;
            out.push({ s: nd.id, i: 0, k, mode });
          }
        }
        for (const key of [`instead:nest`, `instead:${nd.id}`]) {
          for (const [card, ei, e] of this.effectsOf(p, key, { race: nd.mon.race, coop: false, k: 1, boss: false, weak: false })) {
            if (!canPay(p, sumPays(e.do ?? []))) continue;
            if ((e.do ?? []).some((op) => op.tame) && nd.mon.race !== 'beast') continue;
            out.push({ s: nd.id, i: -1, card, e: ei, k: 1 });
          }
        }
      }
      const boss = this.bossOf[this.round];
      if (boss && !this.lairQ.some((e) => e.pid === p.pid)) {
        for (let k = 1; k <= Math.min(D.MAX_SEND, nfree); k++) for (const mode of ['normal', 'safe', 'gamble', 'guard'] as FightMode[]) out.push({ s: 'lair', i: 0, k, mode });
      }
    }
    if (!out.some((o) => o.s !== '@spell')) out.push({ s: 'plaza', i: 0 });
    return out;
  }

  /** カードの効果のうち when が合い、条件・回数を満たすもの */
  effectsOf(p: Player, when: string, fight?: FightEnv, idxs?: number[]): [string, number, Effect][] {
    const out: [string, number, Effect][] = [];
    const env = this.env(p, fight);
    for (const c of this.activeCards(p, idxs)) {
      this.card(c).effects.forEach((e, i) => {
        if (e.when === when && this.limitOk(p, c, i, e.limit) && checkCond(e.if, env)) out.push([c, i, e]);
      });
    }
    return out;
  }

  /** 手順の中の「選ぶ op」を選択肢に広げる（選ぶものが無ければ [undefined]、できなければ []） */
  expand(p: Player, ops: Op[], disc: Cost = {}, nestCtx = false, extraPay: Cost = {}): (Choice | undefined)[] {
    const op = ops.find((o) => EXPAND_OPS.has(opKey(o)));
    const base = addCost(sumPays(ops), extraPay);
    const after = (c: Cost) => canPay(p, addCost(base, c));
    for (const o of ops) if ((o.hire || o.hire_free) && !this.canHire(p, !!o.hire_free)) return [];
    if (!nestCtx && ops.some((o) => o.tame) && !this.nests.some((nd) => nd.mon?.race === 'beast')) return [];
    if (!op) return [undefined];
    const k = opKey(op);
    const out: Choice[] = [];
    if (k === 'occ') {
      for (const c of new Set(p.hand)) if (this.card(c).kind === 'occ' && this.prereqOk(p, c) && after(this.occCost(p, c))) out.push(c);
    } else if (k === 'craft') {
      const want = op.craft!;
      for (const c of new Set(p.hand)) {
        const cd = this.card(c);
        const ok = (want === 'weapon' || want === 'any') && cd.kind === 'weapon' || (want === 'armor' || want === 'any') && cd.kind === 'armor';
        if (ok && this.prereqOk(p, c) && after(this.cardCost(p, c, disc))) out.push(c);
      }
      for (const gd of this.cs.gear) {
        const place = gd.place;
        const ok = (want === 'weapon' || want === 'any') && place === 'forge' || (want === 'armor' || want === 'any') && place === 'training';
        if (ok && (this.gearStock[gd.id] ?? 0) > 0 && after(this.cardCost(p, gd.id, disc))) out.push(gd.id);
      }
    } else if (k === 'build') {
      const b = op.build!;
      const d = op.discount ?? disc;
      if ((b === 'bed' || b === 'any') && after(this.bedCost(p, d))) out.push('bed');
      if ((b === 'wall' || b === 'any') && after(this.wallCost(p, d))) out.push('wall');
      if (b === 'facility' || b === 'any') for (const c of new Set(p.hand)) if (this.card(c).kind === 'tool' && this.prereqOk(p, c) && after(this.cardCost(p, c, d))) out.push(c);
    } else if (k === 'train') {
      const t = op.train!;
      for (const s of ['atk', 'def'] as const) if ((t === s || t === 'any') && p.comps.some((c) => c[s] < D.MAX_SKILL)) out.push(s);
    } else if (k === 'exchange') {
      const q = this.marketQty(p);
      const sells: { r: Res; q: number }[] = [], buys: { r: Res; q: number }[] = [];
      for (const r of RES) {
        if (r === 'gold') continue;
        for (let n = 1; n <= Math.min(q, p.res[r] - (base[r] ?? 0)); n++) sells.push({ r, q: n });
        for (let n = 1; n <= q; n++) if (after({ gold: D.BUY[r] * n })) buys.push({ r, q: n });
      }
      for (const s of sells) out.push({ m: 'sell', ...s });
      for (const b of buys) out.push({ m: 'buy', ...b });
      for (const id of new Set(this.storage(p))) out.push({ m: 'item', id });
      if (this.mods(p).market_both) {
        for (const s of sells) {
          if (s.q !== Math.min(q, p.res[s.r])) continue;
          const gold = p.res.gold + this.sellPrice(p, s.r) * s.q - (base.gold ?? 0);
          for (const b of buys) if (b.r !== s.r && D.BUY[b.r] * b.q <= gold) out.push({ m: 'both', sell: s, buy: b });
        }
      }
    }
    return out;
  }

  canHire(p: Player, free: boolean) {
    if (p.comps.length >= D.MAX_COMPS) return false;
    return free || p.comps.length < this.bedCap(p);
  }

  // ------------------------------------------------------------ 手を実行する
  *apply(p: Player, o: Option): Gen {
    if (o.s === '@spell') { yield* this.playSpell(p, o.card!, o.i); return; }
    const nd = this.nest(o.s);
    if (nd || o.s === 'lair') { yield* this.placeFight(p, o); return; }
    const sp = this.space(o.s);
    if (!sp) throw new Error(`unknown space ${o.s}`);
    this.useWorker(p, 1);
    sp.occ.push(p.pid);
    const cap = sp.def.cap ?? 1;
    if (cap > 0 && sp.occ.length > cap) p.ignoreFull = false;
    this.emit({ t: 'place', seat: p.pid, space: sp.id, companions: [], option: optLabel(o) });
    p.acts.push(`sp:${sp.id}`);
    if (o.i >= 0) p.lastSpace = { s: sp.id, i: o.i };
    if (sp.id === 'board') p.acts.push('board');
    if (sp.id === 'plaza') p.acts.push('plaza');
    if (o.i === -1) {
      const e = this.card(o.card!).effects[o.e!];
      this.markLimit(p, o.card!, o.e!, e.limit);
      this.emit({ t: 'effect', seat: p.pid, card: o.card!, when: e.when });
      yield* this.runOps(p, e.do ?? [], { space: sp.id, x: o.x, card: o.card });
    } else {
      if (sp.def.accum) {
        const bonus = this.mods(p).accum_bonus;
        const got: Cost = { ...sp.stock };
        for (const r of Object.keys(sp.def.accum)) if (bonus[sp.id]) got[r as Res] = (got[r as Res] ?? 0) + (bonus[sp.id] ?? 0);
        sp.stock = {};
        gainRes(p, got);
        this.emit({ t: 'gather', seat: p.pid, space: sp.id, gain: got });
        this.actGain(p, got);
        p.acts.push('accum');
      }
      const eff = sp.optEffects?.[o.i];
      if (eff) this.markLimit(p, sp.id, o.i, eff.limit);
      yield* this.runOps(p, sp.def.options[o.i], { space: sp.id, x: o.x, card: sp.stage, opIndex: o.i });
    }
    yield* this.fire(p, `use:${sp.id}`, { space: sp.id });
    if (sp.def.accum) yield* this.fire(p, 'use:any_accum', { space: sp.id });
    for (const q of this.players) if (q !== p) yield* this.fire(q, `other:${sp.id}`, { space: sp.id });
  }

  useWorker(p: Player, k: number): number[] {
    const fr = p.free();
    const idxs: number[] = [];
    for (let j = 0; j < k; j++) {
      if (fr.length) { const i = fr.shift()!; p.comps[i].used = true; idxs.push(i); } else if (p.extra > 0) p.extra -= 1;
    }
    return idxs;
  }

  /** 戦闘に送る仲間を選ぶ（戦力の高い順。足りなければ、もう1人置ける分で休んでいない仲間がもう一度） */
  pickComps(p: Player, k: number): number[] {
    const by = (a: number, b: number) => this.compPower(p, b) - this.compPower(p, a) || a - b;
    const fr = p.free().sort(by).slice(0, k);
    if (fr.length < k) {
      const again = p.comps.map((_, i) => i).filter((i) => !fr.includes(i) && !p.comps[i].rest && !p.comps[i].injured).sort(by);
      fr.push(...again.slice(0, Math.min(k - fr.length, p.extra)));
    }
    return fr;
  }
  /** 戦闘に送った仲間を使ったことにする */
  useComps(p: Player, idxs: number[]) {
    for (const i of idxs) { if (!p.comps[i].used) p.comps[i].used = true; else p.extra = Math.max(0, p.extra - 1); }
  }
  compPower(p: Player, i: number) {
    const c = p.comps[i];
    return D.POWER_PER + c.atk + (c.weapon ? this.card(c.weapon).power ?? 0 : 0);
  }

  actGain(p: Player, c: Cost) {
    if ((c.food ?? 0) > 0) p.acts.push('food');
    if ((c.mana ?? 0) > 0) p.acts.push('mana');
  }

  // ------------------------------------------------------------ 効果の実行（§8 do）
  *runOps(p: Player, ops: Op[], ctx: OpCtx): Gen {
    let xUsed = false;
    const buf: FightBuf = ctx.plan ?? p.rbuf;
    for (const op of ops) {
      const k = opKey(op);
      let x: Choice | undefined;
      if (EXPAND_OPS.has(k)) {
        if (!xUsed && ctx.x !== undefined) { x = ctx.x; xUsed = true; }
        else {
          const xs = this.expand(p, [op]);
          if (!xs.length || xs[0] === undefined) continue;
          x = xs.length === 1 ? xs[0] : yield* this.ask({ k: 'pick', g: this, p, what: k, options: xs as Choice[] });
          xUsed = true;
        }
      }
      switch (k) {
        case 'gain': gainRes(p, op.gain!); this.emit({ t: 'gain', seat: p.pid, gain: op.gain!, reason: ctx.card ?? ctx.space ?? '' }); this.actGain(p, op.gain!); break;
        case 'pay': if (!canPay(p, op.pay!)) return; payRes(p, op.pay!); this.emit({ t: 'pay', seat: p.pid, cost: op.pay!, reason: ctx.card ?? ctx.space ?? '' }); break;
        case 'convert': {
          const cv = op.convert!;
          if (!canPay(p, cv.from)) break;
          payRes(p, cv.from); gainRes(p, cv.to);
          this.emit({ t: 'pay', seat: p.pid, cost: cv.from, reason: 'convert' });
          this.emit({ t: 'gain', seat: p.pid, gain: cv.to, reason: 'convert' });
          this.actGain(p, cv.to);
          break;
        }
        case 'fame': p.fame.effect += op.fame!; this.emit({ t: 'fame', seat: p.pid, amount: op.fame!, reason: ctx.card ?? '' }); break;
        case 'power': buf.power += op.power!; break;
        case 'guard': buf.guard += op.guard!; break;
        case 'counter': buf.counter += op.counter!; break;
        case 'loot': buf.loot += op.loot!; break;
        case 'trophy': buf.trophy += op.trophy!; break;
        case 'str': buf.str += op.str!; break;
        case 'no_injury': buf.noInj += op.no_injury!; break;
        case 'extra_worker': p.extra += op.extra_worker!; break;
        case 'ignore_full': p.ignoreFull = true; break;
        case 'place_again': {
          if (ctx.again) break;
          const tgt = ctx.space ? { s: ctx.space, i: ctx.opIndex ?? 0 } : p.lastSpace;
          const sp = tgt ? this.space(tgt.s) : undefined;
          if (!sp || !tgt) break;
          if (sp.def.accum) { gainRes(p, sp.def.accum); this.emit({ t: 'gather', seat: p.pid, space: sp.id, gain: { ...sp.def.accum } }); this.actGain(p, sp.def.accum); }
          const sub = sp.def.options[tgt.i] ?? [];
          if (!canPay(p, sumPays(sub))) break;
          const xs = this.expand(p, sub);
          if (!xs.length) break;
          const x = xs.length === 1 ? xs[0] : yield* this.ask({ k: 'pick', g: this, p, what: 'again', options: xs as Choice[] });
          yield* this.runOps(p, sub, { ...ctx, space: sp.id, opIndex: tgt.i, x, again: true });
          break;
        }
        case 'future': for (const r of op.future!.rounds) p.future.push({ round: this.round + r, gain: { ...op.future!.gain } }); break;
        case 'draw': yield* this.drawCards(p, op.draw!.from, op.draw!.look, op.draw!.take); break;
        case 'hire': case 'hire_free': {
          const free = k === 'hire_free';
          const cnt = (op.hire ?? op.hire_free)!;
          for (let j = 0; j < cnt; j++) {
            if (!this.canHire(p, free)) break;
            const c = newComp(false);
            c.used = true;
            p.comps.push(c);
            p.acts.push('hire');
            this.emit({ t: 'hire', seat: p.pid, companion: p.comps.length - 1 });
            this.autoEquip(p);
            yield* this.fire(p, 'hire', {});
          }
          break;
        }
        case 'tame': {
          let nd = ctx.nest ? this.nest(ctx.nest) : undefined;
          if (!nd) {
            const cand = this.nests.filter((n) => n.mon?.race === 'beast').map((n) => n.id);
            if (!cand.length) break;
            const nid: string = cand.length === 1 ? cand[0] : yield* this.ask({ k: 'pick', g: this, p, what: 'tame', options: cand });
            nd = this.nest(nid);
          }
          if (!nd?.mon || nd.mon.race !== 'beast') break;
          this.emit({ t: 'tame', seat: p.pid, monster: nd.mon.type });
          nd.mon = null;
          p.pets += 1;
          p.acts.push('tame');
          yield* this.fire(p, 'tame', {});
          break;
        }
        case 'train': {
          const s = (x === 'atk' || x === 'def' ? x : op.train === 'any' ? 'atk' : op.train) as 'atk' | 'def';
          const idx = this.trainTarget(p, s);
          if (idx === null) break;
          p.comps[idx][s] += 1;
          p.acts.push('train');
          this.emit({ t: 'train', seat: p.pid, companion: idx, stat: s });
          this.autoEquip(p);
          break;
        }
        case 'build': {
          const what = typeof x === 'string' ? x : op.build;
          const d = op.discount ?? {};
          if (what === 'bed') { const c = this.bedCost(p, d); if (!canPay(p, c)) break; payRes(p, c); p.beds += 1; this.emit({ t: 'build', seat: p.pid, kind: 'bed' }); }
          else if (what === 'wall') { const c = this.wallCost(p, d); if (!canPay(p, c)) break; payRes(p, c); p.walls += 1; this.emit({ t: 'build', seat: p.pid, kind: 'wall' }); }
          else if (what && p.hand.includes(what) && this.card(what).kind === 'tool') {
            const c = this.cardCost(p, what, d);
            if (!canPay(p, c)) break;
            payRes(p, c);
            yield* this.playItem(p, what, true);
          } else break;
          p.acts.push('build');
          yield* this.fire(p, 'build', {});
          break;
        }
        case 'craft': {
          const id = typeof x === 'string' ? x : null;
          if (!id) break;
          const c = this.cardCost(p, id);
          if (!canPay(p, c)) break;
          payRes(p, c);
          if (this.card(id).kind === 'gear') {
            this.gearStock[id] -= 1;
            p.items.push(id);
            this.emit({ t: 'craft', seat: p.pid, card: id });
            this.autoEquip(p);
          } else yield* this.playItem(p, id, true);
          p.acts.push('craft');
          yield* this.fire(p, 'craft', {});
          break;
        }
        case 'occ': {
          const id = typeof x === 'string' ? x : null;
          if (!id) break;
          const c = this.occCost(p, id);
          if (!canPay(p, c)) break;
          payRes(p, c);
          yield* this.playOcc(p, id, true);
          p.acts.push('occ');
          break;
        }
        case 'exchange': {
          if (!x || typeof x === 'string') break;
          p.acts.push('exchange');
          if (x.m === 'sell' || x.m === 'both') {
            const s = x.m === 'both' ? x.sell : (x as { r: Res; q: number });
            if (p.res[s.r] < s.q) break;
            const gold = this.sellPrice(p, s.r) * s.q;
            p.res[s.r] -= s.q; p.res.gold += gold;
            this.emit({ t: 'market', seat: p.pid, kind: 'sell', res: s.r, qty: s.q, gold });
            p.acts.push('sell');
            yield* this.fire(p, 'sell', {});
          }
          if (x.m === 'buy' || x.m === 'both') {
            const b = x.m === 'both' ? x.buy : (x as { r: Res; q: number });
            const gold = D.BUY[b.r] * b.q;
            if (p.res.gold < gold) break;
            p.res.gold -= gold; p.res[b.r] += b.q;
            this.emit({ t: 'market', seat: p.pid, kind: 'buy', res: b.r, qty: b.q, gold });
            this.actGain(p, { [b.r]: b.q });
            p.acts.push('buy');
            yield* this.fire(p, 'buy', {});
          }
          if (x.m === 'item') {
            const i = p.items.indexOf(x.id);
            if (i < 0 || !this.storage(p).includes(x.id)) break;
            p.items.splice(i, 1);
            const gold = this.itemSell(x.id);
            p.res.gold += gold;
            if (this.card(x.id).kind === 'gear') this.gearStock[x.id] = (this.gearStock[x.id] ?? 0) + 1;
            this.emit({ t: 'market', seat: p.pid, kind: 'sell', res: x.id, qty: 1, gold });
            p.acts.push('sell');
            yield* this.fire(p, 'sell', {});
          }
          break;
        }
        case 'first': this.nextFirst = p.pid; break;
        case 'donate': {
          const dn = op.donate!;
          const rate = this.mods(p).donate_rate ?? {};
          const cost: Cost = {};
          for (const [r, n] of Object.entries(dn.pay)) cost[r as Res] = rate[r as Res] !== undefined ? Math.min(n as number, rate[r as Res]!) : (n as number);
          if (!canPay(p, cost)) break;
          payRes(p, cost);
          p.fame.donate += dn.fame;
          p.st.donations += 1;
          p.acts.push('donate');
          this.emit({ t: 'donate', seat: p.pid, cost, fame: dn.fame });
          yield* this.fire(p, 'donate', {});
          break;
        }
        case 'heal': {
          let n = op.heal!;
          for (const c of p.comps) if (n > 0 && (c.injured || c.rest)) { c.injured = false; c.rest = false; n--; this.emit({ t: 'heal', seat: p.pid, companion: p.comps.indexOf(c), cost: {} }); }
          break;
        }
        case 'steal_gain': gainRes(p, op.steal_gain!); this.emit({ t: 'gain', seat: p.pid, gain: op.steal_gain!, reason: ctx.card ?? 'other' }); break;
        default: throw new Error(`unknown op ${k}`);
      }
    }
  }

  trainTarget(p: Player, s: 'atk' | 'def'): number | null {
    let best: number | null = null;
    p.comps.forEach((c, i) => { if (c[s] < D.MAX_SKILL && (best === null || c[s] < p.comps[best][s])) best = i; });
    return best;
  }

  /** when に合う効果をすべて実行する（pay・convert を含む効果は使うかどうか聞く） */
  *fire(p: Player, when: string, ctx: OpCtx, fight?: FightEnv, idxs?: number[]): Gen {
    for (const [card, ei, e] of this.effectsOf(p, when, fight, idxs)) {
      const ops = e.do ?? [];
      if (!canPay(p, sumPays(ops))) continue;
      const conv = ops.find((o) => o.convert);
      if (conv && !canPay(p, addCost(sumPays(ops), conv.convert!.from))) continue;
      const xs = this.expand(p, ops);
      if (!xs.length) continue;
      const optional = ops.some((o) => o.pay || o.convert) || xs[0] !== undefined;
      if (optional) {
        const yes: boolean = yield* this.ask({ k: 'effect', g: this, p, card, when, ops });
        if (!yes) continue;
      }
      const x = xs.length === 1 ? xs[0] : yield* this.ask({ k: 'pick', g: this, p, what: card, options: xs as Choice[] });
      this.markLimit(p, card, ei, e.limit);
      this.emit({ t: 'effect', seat: p.pid, card, when });
      yield* this.runOps(p, ops, { ...ctx, card, x });
    }
  }

  // ------------------------------------------------------------ カードを出す
  *playOcc(p: Player, id: string, _free: boolean): Gen {
    const i = p.hand.indexOf(id);
    if (i < 0) return;
    p.hand.splice(i, 1);
    p.occs.push(id);
    const c = this.card(id);
    p.fame.card += c.fame ?? 0;
    this.emit({ t: 'play_card', seat: p.pid, card: id });
  }
  *playItem(p: Player, id: string, _free: boolean): Gen {
    const i = p.hand.indexOf(id);
    if (i < 0) return;
    p.hand.splice(i, 1);
    const c = this.card(id);
    p.fame.card += c.fame ?? 0;
    if (c.kind === 'tool') { p.tools.push(id); this.emit({ t: 'build', seat: p.pid, kind: 'facility', card: id }); }
    else { p.items.push(id); this.emit({ t: 'craft', seat: p.pid, card: id }); this.autoEquip(p); }
    this.emit({ t: 'play_card', seat: p.pid, card: id });
  }
  *playSpell(p: Player, id: string, ei: number): Gen {
    const i = p.hand.indexOf(id);
    if (i < 0) return;
    const c = this.card(id);
    const e = c.effects[ei];
    const cost = this.cardCost(p, id);
    if (!canPay(p, cost)) return;
    payRes(p, cost);
    p.hand.splice(i, 1);
    p.fame.card += c.fame ?? 0;
    p.st.spells += 1;
    p.acts.push('spell');
    this.markLimit(p, id, ei, e.limit);
    this.emit({ t: 'spell', seat: p.pid, card: id });
    const xs = this.expand(p, e.do ?? []);
    const x = xs.length <= 1 ? xs[0] : yield* this.ask({ k: 'pick', g: this, p, what: id, options: xs as Choice[] });
    yield* this.runOps(p, e.do ?? [], { card: id, x, again: false });
    yield* this.fire(p, 'spell', {});
  }

  *drawCards(p: Player, from: string, look: number, take: number): Gen {
    const decks: string[][] = from === 'item' ? [this.decks.weapon, this.decks.tool, this.decks.spell]
      : from === 'ancient' ? [this.decks.ancient] : [this.decks[from as 'occ' | ItemKind]];
    const pool: [string, string[]][] = [];
    if (from === 'item') {
      const mixed: [string, string[]][] = [];
      for (const d of decks) for (const c of d) mixed.push([c, d]);
      this.rng.shuffle(mixed);
      pool.push(...mixed.slice(0, look));
      for (const [c, d] of pool) d.splice(d.indexOf(c), 1);
    } else {
      const d = decks[0];
      for (const c of d.splice(0, Math.min(look, d.length))) pool.push([c, d]);
    }
    for (let j = 0; j < take && pool.length; j++) {
      const cards = pool.map(([c]) => c);
      const c: string = cards.length === 1 ? cards[0] : yield* this.ask({ k: 'card', g: this, p, why: 'draw', cards, kind: from });
      const idx = cards.indexOf(c);
      if (idx < 0) throw new Error('bad draw');
      pool.splice(idx, 1);
      if (from === 'ancient') p.ancient.push(c); else { p.hand.push(c); p.picked.push(c); }
      p.acts.push('draw');
      this.emit({ t: 'draw', seat: p.pid, card: p.pid === this.me || this.me < 0 || from === 'ancient' ? c : '?', from });
    }
    for (const [c, d] of pool) d.push(c);
    for (const d of decks) this.rng.shuffle(d);
  }

  /** 装備の持ち替え（無料）：武器は戦力の高い順に熟練の高い仲間へ、防具は守りの高い順に */
  autoEquip(p: Player) {
    const before = p.comps.map((c) => [c.weapon, c.armor]);
    for (const c of p.comps) { c.weapon = null; c.armor = null; }
    const items = [...p.items].map((id) => this.card(id));
    const weapons = items.filter((c) => slotOf(c) === 'weapon');
    const armors = items.filter((c) => slotOf(c) === 'armor');
    weapons.sort((a, b) => (b.power ?? 0) - (a.power ?? 0) || (a.id < b.id ? -1 : 1));
    armors.sort((a, b) => (b.guard ?? 0) - (a.guard ?? 0) || (a.id < b.id ? -1 : 1));
    const byAtk = p.comps.map((_, i) => i).sort((a, b) => p.comps[b].atk - p.comps[a].atk || a - b);
    for (const w of weapons) {
      const cand = w.leader_only ? byAtk.filter((i) => p.comps[i].leader) : byAtk;
      const i = cand.find((j) => !p.comps[j].weapon);
      if (i !== undefined) p.comps[i].weapon = w.id;
    }
    const byDef = p.comps.map((_, i) => i).sort((a, b) => p.comps[b].def - p.comps[a].def || a - b);
    for (const a of armors) {
      const cand = a.leader_only ? byDef.filter((i) => p.comps[i].leader) : byDef;
      const i = cand.find((j) => !p.comps[j].armor && !(p.comps[j].weapon && this.card(p.comps[j].weapon!).two_hand));
      if (i !== undefined) p.comps[i].armor = a.id;
    }
    if (this.E) {
      p.comps.forEach((c, i) => {
        if (before[i]?.[0] !== c.weapon) this.emit({ t: 'equip', seat: p.pid, companion: i, slot: 'weapon', card: c.weapon });
        if (before[i]?.[1] !== c.armor) this.emit({ t: 'equip', seat: p.pid, companion: i, slot: 'armor', card: c.armor });
      });
    }
  }

  // ------------------------------------------------------------ 戦闘（§5・§6）
  fateMin(p: Player) { return p.fate.length ? Math.min(...p.fate) : Math.min(...D.FATE_DECK); }
  fateDist(p: Player): [number, number][] {
    const deck = p.fate.length ? p.fate : D.FATE_DECK;
    const m = new Map<number, number>();
    for (const v of deck) m.set(v, (m.get(v) ?? 0) + 1 / deck.length);
    return [...m.entries()];
  }
  drawFate(p: Player): number {
    if (!p.fate.length) p.fate = this.rng.shuffle([...D.FATE_DECK]);
    if (this.forceFate !== null) {
      const i = p.fate.indexOf(this.forceFate);
      if (i >= 0) p.fate.splice(i, 1);
      return this.forceFate;
    }
    const v = p.fate.pop()!;
    this.fateLog.push({ pid: p.pid, v });
    return v;
  }

  /** 戦力・守り・後押しの計画（盤面は変えない）。need は運命なしで勝つのに要る戦力の目安 */
  makePlan(p: Player, mon: Monster, idxs: number[], mode: FightMode, coop: boolean, need: number): Plan {
    const pl: Plan = { pid: p.pid, idxs, mode, power: 0, parts: [], guard: 0, counter: 0, loot: 0, trophy: 0, str: 0, noInj: 0, cost: {}, boosts: [], spells: [], used: [], rearAll: false, weak: false };
    for (const i of idxs) {
      const c = p.comps[i];
      const w = c.weapon ? this.card(c.weapon) : null;
      const v = D.POWER_PER + c.atk + (w?.power ?? 0);
      pl.power += v;
      pl.parts.push({ kind: 'companion', label: `仲間${i + 1}`, value: v, seat: p.pid, ...(w ? { ref: w.id } : {}) });
      const els = [w?.el, c.armor ? this.card(c.armor).el : null];
      if (mon.weak && els.some((e) => e === mon.weak || e === 'any')) pl.weak = true;
    }
    pl.rearAll = idxs.length > 0 && idxs.every((i) => { const w = p.comps[i].weapon; return !!w && !!this.card(w).rear; });
    const mods = this.mods(p);
    if (p.pets) { const v = p.pets * (1 + mods.pet_power); pl.power += v; pl.parts.push({ kind: 'familiar', label: '使い魔', value: v, seat: p.pid }); }
    const rb = p.rbuf;
    if (rb.power || rb.str || rb.counter || rb.guard || rb.noInj || rb.loot || rb.trophy) {
      pl.power += rb.power; pl.str += rb.str; pl.counter += rb.counter; pl.guard += rb.guard; pl.noInj += rb.noInj; pl.loot += rb.loot; pl.trophy += rb.trophy;
      if (rb.power) pl.parts.push({ kind: 'spell', label: '秘術', value: rb.power, seat: p.pid });
    }
    if (mods.power) { pl.power += mods.power; pl.parts.push({ kind: 'mod', label: 'カード', value: mods.power, seat: p.pid }); }
    if (pl.weak) { pl.power += D.WEAK_BONUS; pl.parts.push({ kind: 'weakness', label: '弱点', value: D.WEAK_BONUS, seat: p.pid }); }
    const fenv: FightEnv = { race: mon.race, coop, k: idxs.length, boss: mon.boss, weak: pl.weak };
    // 自動で効く fight の効果（pay なし）
    const optional: { name: string; cost: Cost; ops: Op[]; card: string; e: number; spell: boolean }[] = [];
    for (const [card, ei, e] of this.effectsOf(p, 'fight', fenv, idxs)) {
      const ops = e.do ?? [];
      const pays = sumPays(ops);
      if (costUnits(pays)) { optional.push({ name: card, cost: pays, ops, card, e: ei, spell: false }); continue; }
      const before = pl.power;
      applyFightOps(pl, ops);
      pl.used.push(`${card}#${ei}`);
      if (pl.power !== before) pl.parts.push({ kind: 'card', label: this.card(card).name, value: pl.power - before, seat: p.pid, ref: card });
    }
    if (mode === 'guard') { pl.power += D.GUARD_MODE.power; pl.counter += D.GUARD_MODE.counter; pl.parts.push({ kind: 'mode', label: '守って戦う', value: D.GUARD_MODE.power, seat: p.pid }); }
    // 後押し（士気・ポーション・払う効果・手札の秘術）
    for (let j = 0; j < idxs.length; j++) optional.push({ name: 'morale', cost: D.MORALE[0], ops: [{ power: D.MORALE[1] }], card: '', e: -1, spell: false });
    optional.push({ name: 'potion', cost: D.POTION[0], ops: [{ power: D.POTION[1] }], card: '', e: -1, spell: false });
    for (const c of new Set(p.hand)) {
      const cd = this.card(c);
      if (cd.kind !== 'spell') continue;
      cd.effects.forEach((e, ei) => {
        if (e.when !== 'fight' || !this.limitOk(p, c, ei, e.limit) || !checkCond(e.if, this.env(p, fenv))) return;
        optional.push({ name: c, cost: addCost(this.cardCost(p, c), sumPays(e.do ?? [])), ops: e.do ?? [], card: c, e: ei, spell: true });
      });
    }
    let target: number | null = null;
    if (mode === 'safe' || mode === 'wait') target = need - this.fateMin(p) + pl.str;
    else if (mode === 'gamble') target = need - 1 + pl.str;
    if (target !== null && pl.power < target) {
      const gainOf = (o: (typeof optional)[number]) => { const t: Plan = { ...pl, parts: [] }; t.power = 0; t.str = 0; applyFightOps(t, o.ops); return t.power - t.str; };
      const cand = optional.map((o) => ({ o, g: gainOf(o) })).filter((x) => x.g > 0).sort((a, b) => costValue(a.o.cost) / a.g - costValue(b.o.cost) / b.g);
      const chosen: typeof cand = [];
      let cost: Cost = {};
      let pw = pl.power;
      for (const c of cand) {
        if (pw >= target) break;
        const tot = addCost(cost, c.o.cost);
        if (!canPay(p, tot)) continue;
        cost = tot; pw += c.g; chosen.push(c);
      }
      if (pw >= target || mode === 'safe' || mode === 'wait') {
        for (const { o } of chosen) {
          const before = pl.power;
          applyFightOps(pl, o.ops);
          pl.boosts.push(o.name);
          if (o.spell) pl.spells.push(o.card);
          if (o.e >= 0) pl.used.push(`${o.card}#${o.e}`);
          pl.parts.push({ kind: o.spell ? 'spell' : o.card ? 'card' : 'boost', label: o.card ? this.card(o.card).name : o.name === 'morale' ? '士気' : 'ポーション', value: pl.power - before, seat: p.pid, ...(o.card ? { ref: o.card } : {}) });
        }
        pl.cost = cost;
      }
    }
    return pl;
  }

  defense(p: Player, pl: Plan): number {
    let d = this.fightGuardBase(p) + pl.guard;
    for (const i of pl.idxs) { const c = p.comps[i]; d += D.GUARD_PER + c.def + (c.armor ? this.card(c.armor).guard ?? 0 : 0) + (c.weapon ? this.card(c.weapon).guard ?? 0 : 0); }
    return d;
  }

  *placeFight(p: Player, o: Option): Gen {
    const k = o.k ?? 1;
    const idxs = this.pickComps(p, k);
    this.useComps(p, idxs);
    const nd0 = this.nest(o.s);
    if (nd0 && nd0.groups >= D.NEST_CAP) p.ignoreFull = false;
    for (const q of this.players) if (q !== p) yield* this.fire(q, 'other:nest', { nest: o.s });
    p.acts.push(`sp:${o.s === 'lair' ? 'lair' : 'nest'}`);
    this.emit({ t: 'place', seat: p.pid, space: o.s, companions: idxs, option: optLabel(o) });
    if (o.s === 'lair') { this.lairQ.push({ pid: p.pid, idxs, mode: o.mode ?? 'normal' }); return; }
    const nd = this.nest(o.s)!;
    nd.groups += 1;
    if (o.i === -1) {
      const e = this.card(o.card!).effects[o.e!];
      this.markLimit(p, o.card!, o.e!, e.limit);
      this.emit({ t: 'effect', seat: p.pid, card: o.card!, when: e.when });
      yield* this.runOps(p, e.do ?? [], { space: nd.id, nest: nd.id, card: o.card });
      for (const i of idxs) p.comps[i].used = true;
      yield* this.fire(p, 'use:nest', { nest: nd.id });
      return;
    }
    if (o.mode === 'wait') { nd.wait = { pid: p.pid, idxs }; this.emit({ t: 'wait', seat: p.pid, nest: nd.id }); return; }
    if (o.join && nd.wait) {
      const w = nd.wait;
      nd.wait = null;
      yield* this.fight(nd, [{ p: this.players[w.pid], idxs: w.idxs, mode: 'gamble' }, { p, idxs, mode: o.mode ?? 'normal' }]);
    } else yield* this.fight(nd, [{ p, idxs, mode: o.mode ?? 'normal' }]);
    yield* this.fire(p, 'use:nest', { nest: nd.id });
  }

  /** 巣の戦闘（1人か共闘の2人） */
  *fight(nd: NestSt, sides: { p: Player; idxs: number[]; mode: FightMode }[]): Gen {
    const mon = nd.mon!;
    const coop = sides.length > 1;
    const need0 = mon.str - mon.wounds;
    const plans: Plan[] = [];
    let acc = 0;
    for (const s of sides) {
      const pl = this.makePlan(s.p, mon, s.idxs, s.mode, coop, need0 - acc);
      plans.push(pl);
      acc += pl.power;
    }
    const res = yield* this.resolve(mon, sides.map((s) => s.p), plans, false);
    if (res.win) nd.mon = null;
    else if (res.wounds) mon.wounds += res.wounds;
  }

  *resolveLair(): Gen {
    const boss = this.bossOf[this.round];
    if (!boss) return;
    if (!this.lairQ.length) { this.failBoss(boss); return; }
    const plans: Plan[] = [];
    let acc = 0;
    const ps = this.lairQ.map((e) => this.players[e.pid]);
    this.lairQ.forEach((e, j) => {
      const pl = this.makePlan(ps[j], boss, e.idxs, e.mode, this.lairQ.length > 1, boss.str - acc);
      plans.push(pl);
      acc += pl.power;
    });
    const res = yield* this.resolve(boss, ps, plans, true);
    if (!res.win) this.failBoss(boss);
    this.lairQ = [];
  }
  private failBoss(boss: Monster) {
    this.bossFailedYear.add(this.year());
    if (boss.type === D.ANCIENT_DRAGON.id) {
      for (const p of this.players) { p.fame.dragon -= D.DRAGON.fail; this.emit({ t: 'fame', seat: p.pid, amount: -D.DRAGON.fail, reason: '古竜' }); }
    }
  }

  /** 戦闘の解決：払う → 運命 → 勝ち負け → 戦利品・証 → 反撃 */
  *resolve(mon: Monster, ps: Player[], plans: Plan[], boss: boolean): Gen<{ win: boolean; wounds: number }> {
    const coop = ps.length > 1;
    this.emit({ t: 'combat_start', nest: boss ? 'lair' : '', monster: { ...mon }, seats: ps.map((p) => p.pid), mode: plans[0].mode });
    let total = 0, strAdj = 0;
    ps.forEach((p, j) => {
      const pl = plans[j];
      payRes(p, pl.cost);
      if (costUnits(pl.cost)) this.emit({ t: 'pay', seat: p.pid, cost: cleanCost(pl.cost), reason: 'fight' });
      for (const c of pl.spells) { const i = p.hand.indexOf(c); if (i >= 0) p.hand.splice(i, 1); p.st.spells += 1; p.fame.card += this.card(c).fame ?? 0; p.acts.push('spell'); this.emit({ t: 'spell', seat: p.pid, card: c }); }
      for (const u of pl.used) { const [c, e] = u.split('#'); this.markLimit(p, c, Number(e), this.card(c).effects[Number(e)]?.limit); }
      total += pl.power;
      strAdj += pl.str;
      p.st.fights += 1;
    });
    this.emit({ t: 'power', parts: plans.flatMap((pl) => pl.parts), total });
    // 運命：主の巣は全員が1枚ずつ、巣は置いた人（共闘なら待っていた人）が1枚
    const flips = boss ? ps : [ps[0]];
    for (const p of flips) { const v = this.drawFate(p); total += v; this.emit({ t: 'fate_flip', seat: p.pid, value: v }); }
    const strength = mon.str - mon.wounds + strAdj;
    const win = total >= strength;
    this.lastClash = { base: plans.reduce((a, pl) => a + pl.power, 0), strength, win };
    this.emit({ t: 'clash', total, strength, result: win ? 'win' : 'lose' });
    let wounds = 0;
    const totPow = Math.max(1, plans.reduce((a, pl) => a + Math.max(0, pl.power), 0));
    for (let j = 0; j < ps.length; j++) {
      const p = ps[j], pl = plans[j];
      const share = coop ? Math.max(0, pl.power) / totPow : 1;
      const fenv: FightEnv = { race: mon.race, coop, k: pl.idxs.length, boss, weak: pl.weak };
      if (win) {
        // 勝ったときの効果（loot / trophy を足すものもあるので先に）
        yield* this.fire(p, 'win', { plan: pl }, fenv, pl.idxs);
        yield* this.fire(p, `win_race:${mon.race}`, { plan: pl }, fenv, pl.idxs);
        // 戦利品（共闘は戦力の割合で分ける。端数は後から来た人）
        const units: Res[] = [];
        for (const [r, n] of Object.entries(mon.loot)) for (let u = 0; u < (n as number); u++) units.push(r as Res);
        const mine = !coop ? units.length : j === ps.length - 1 ? units.length - Math.floor(units.length * (1 - share)) : Math.floor(units.length * share);
        const pick = j === 0 ? units.slice(0, mine) : units.slice(units.length - mine);
        for (let u = 0; u < pl.loot; u++) pick.push(units[0] ?? 'mat');
        const loot: Cost = {};
        for (const r of pick) loot[r] = (loot[r] ?? 0) + 1;
        gainRes(p, loot);
        if (costUnits(loot)) this.emit({ t: 'loot', seat: p.pid, gain: loot });
        const tro = Math.max(1, Math.round((mon.trophy + pl.trophy) * (coop ? Math.max(share, 0.5) : 1)));
        if (mon.type === D.ANCIENT_DRAGON.id) { p.fame.dragon += tro + D.DRAGON.join; this.emit({ t: 'trophy', seat: p.pid, monster: mon.type, fame: tro + D.DRAGON.join }); }
        else { p.fame.trophy += tro; this.emit({ t: 'trophy', seat: p.pid, monster: mon.type, fame: tro }); }
        p.kills += 1;
        if (!p.races.includes(mon.race)) p.races.push(mon.race);
        if (boss) p.st.boss += 1;
        if (coop) { p.st.coop += 1; p.acts.push('coop'); }
        if (pl.weak) p.st.weak += 1;
        p.st.wins += 1;
        p.acts.push('win', `win:${mon.race}`);
        if (boss) p.acts.push('boss');
      } else p.acts.push('lose');
      // 反撃
      if (!pl.rearAll && pl.idxs.length) {
        const amount = Math.max(0, mon.counter + pl.counter);
        const def = this.defense(p, pl);
        this.emit({ t: 'counter', amount, defense: def });
        let inj = Math.max(0, amount - def) - pl.noInj;
        const front = pl.idxs.filter((i) => { const w = p.comps[i].weapon; return !(w && this.card(w).rear); });
        for (const i of [...front].reverse()) {
          if (inj <= 0) break;
          p.comps[i].injured = true;
          inj--;
          this.emit({ t: 'injury', seat: p.pid, companion: i });
        }
      }
      if (!win) yield* this.fire(p, 'lose', { plan: pl }, fenv, pl.idxs);
    }
    if (!win) {
      const chip = plans.some((pl) => pl.mode === 'chip');
      wounds = Math.min(Math.max(0, strength - 1), Math.max(1, Math.floor(total / 3)) + (chip ? 1 : 0));
    }
    this.emit({ t: 'combat_end' });
    return { win, wounds };
  }

  // ------------------------------------------------------------ 取引（§7）
  tradeLimit(p: Player) { return 1 + this.mods(p).trade_count; }
  tradeOk(a: Player, b: Player, give: Cost, get: Cost): string | null {
    if (a === b) return '相手がいない';
    if (a.tradesUsed >= this.tradeLimit(a)) return 'このラウンドの取引は終わり';
    if (!costUnits(give) || !costUnits(get)) return '渡すものと受け取るものを選ぶ';
    if (costUnits(give) > D.TRADE_MAX || costUnits(get) > D.TRADE_MAX) return `片側${D.TRADE_MAX}個まで`;
    if (!canPay(a, give)) return '渡すものが足りない';
    if (!canPay(b, get)) return '相手の持ち物が足りない';
    return null;
  }
  *tradeGen(a: Player, b: Player, give: Cost, get: Cost): Gen {
    payRes(a, give); gainRes(b, give); payRes(b, get); gainRes(a, get);
    a.tradesUsed += 1;
    a.st.trades += 1; b.st.trades += 1;
    a.acts.push('trade'); b.acts.push('trade');
    this.emit({ t: 'trade', a: a.pid, b: b.pid, give: cleanCost(give), get: cleanCost(get) });
    yield* this.fire(a, 'trade', {});
    yield* this.fire(b, 'trade', {});
  }
  /** 取引を同期で（効果の選択は既定の答え） */
  trade(a: Player, b: Player, give: Cost, get: Cost) { drive(this.tradeGen(a, b, give, get)); }

  // ------------------------------------------------------------ 依頼（§9）
  checkQuests(p: Player) {
    for (const q of this.quests) {
      if (q.done.includes(p.pid) || q.done.length >= D.QUEST_FAME.length) continue;
      const qd = this.quest.get(q.id)!;
      if (!checkCond(qd.need, this.env(p))) continue;
      const fame = D.QUEST_FAME[q.done.length];
      q.done.push(p.pid);
      p.quests.push(q.id);
      p.fame.quest += fame;
      this.emit({ t: 'quest_done', seat: p.pid, quest: q.id, fame });
    }
  }

  scoreRows(): ScoreRow[] {
    const rows = this.players.map((p) => {
      const b = scoreBreakdown(this, p);
      const items: ScoreItem[] = Object.entries(b).map(([key, fame]) => ({ key, label: SCORE_LABELS[key] ?? D.TABLE_JP[key.replace('table_', '')] ?? key, fame }));
      return { seat: p.pid, items, total: score(this, p), rank: 0 };
    });
    for (const r of rows) r.rank = 1 + rows.filter((x) => x.total > r.total).length;
    return rows;
  }
}

export interface OpCtx { space?: string; nest?: string; x?: Choice; card?: string; plan?: Plan; again?: boolean; opIndex?: number }

export function slotOf(c: CardDef): 'weapon' | 'armor' | null {
  if (c.slot) return c.slot;
  if (c.kind === 'weapon') return 'weapon';
  if (c.kind === 'armor') return 'armor';
  if (c.kind === 'gear') return (c.power ?? 0) > 0 || c.rear ? 'weapon' : (c.guard ?? 0) > 0 ? 'armor' : null;
  return null;
}

function newComp(leader: boolean): Comp { return { atk: 0, def: 0, weapon: null, armor: null, leader, injured: false, rest: false, used: false }; }

export function sumPays(ops: Op[]): Cost {
  let c: Cost = {};
  for (const o of ops) if (o.pay) c = addCost(c, o.pay);
  return c;
}
function applyFightOps(pl: Plan, ops: Op[]) {
  for (const o of ops) {
    if (o.power) pl.power += o.power;
    if (o.guard) pl.guard += o.guard;
    if (o.counter) pl.counter += o.counter;
    if (o.loot) pl.loot += o.loot;
    if (o.trophy) pl.trophy += o.trophy;
    if (o.str) pl.str += o.str;
    if (o.no_injury) pl.noInj += o.no_injury;
  }
}
export function sameOpt(a: Option, b: Option): boolean {
  return a.s === b.s && a.i === b.i && (a.k ?? 0) === (b.k ?? 0) && (a.mode ?? '') === (b.mode ?? '') && !!a.join === !!b.join
    && (a.card ?? '') === (b.card ?? '') && (a.e ?? -9) === (b.e ?? -9) && JSON.stringify(a.x ?? null) === JSON.stringify(b.x ?? null);
}
export function optLabel(o: Option): string {
  if (o.k) return `${o.k}:${o.mode}${o.join ? ':join' : ''}`;
  if (o.card) return `instead:${o.card}`;
  if (o.x === undefined) return String(o.i);
  return typeof o.x === 'string' ? o.x : JSON.stringify(o.x);
}

// ------------------------------------------------------------ 名声（§9）
export const SCORE_LABELS: Record<string, string> = {
  trophy: '討伐の証', quest: '依頼', secret: '秘密依頼', donate: '寄進', ancient: '古代の品', card: 'カード', effect: '効果', dragon: '古竜',
  comps: '仲間', gold: '金貨', discontent: '不満', raid: '襲撃',
};

export function ancientScore(g: Game, p: Player): number {
  const cnt: Record<string, number> = {};
  for (const a of p.ancient) { const grp = g.anc.get(a)?.group ?? a; cnt[grp] = (cnt[grp] ?? 0) + 1; }
  const groups = [...new Set([...g.anc.values()].map((a) => a.group))];
  const counts = groups.map((gr) => cnt[gr] ?? 0);
  const full = groups.length >= 4 ? Math.min(...counts) : 0;
  let best = 0;
  for (let k = 0; k <= full; k++) {
    let s = k * D.ANCIENT_ALL;
    for (const c of counts) s += D.ANCIENT_SAME[Math.min(3, c - k)] ?? 0;
    best = Math.max(best, s);
  }
  return best;
}

export function tableScore(v: number, th: number[]): number {
  let pts = -1;
  th.forEach((x, i) => { if (v >= x) pts = i + 1; });
  return pts;
}

export function scoreBreakdown(g: Game, p: Player): Record<string, number> {
  const b: Record<string, number> = {
    trophy: p.fame.trophy, quest: p.fame.quest, secret: 0, donate: p.fame.donate, ancient: ancientScore(g, p), card: p.fame.card,
    effect: p.fame.effect, dragon: p.fame.dragon,
  };
  if (p.secret) { const q = g.quest.get(p.secret); if (q && checkCond(q.need, g.env(p))) b.secret = q.fame ?? D.SECRET_FAME; }
  const th = D.tableFor(g.years);
  const vals: Record<string, number> = {
    kills: p.kills, races: p.races.length, facilities: p.tools.length, walls: p.walls, gear: g.stat(p, 'gear'), occs: p.occs.length, pets: p.pets,
  };
  for (const [k, t] of Object.entries(th)) b[`table_${k}`] = tableScore(vals[k], t);
  b.comps = p.comps.length * D.FAME_PER_COMP;
  b.gold = Math.floor(p.res.gold / D.GOLD_PER_FAME);
  b.discontent = -p.discontent * D.DISCONTENT;
  b.raid = -p.raidLoss;
  return b;
}
export function score(g: Game, p: Player): number {
  return Object.values(scoreBreakdown(g, p)).reduce((a, n) => a + n, 0);
}
