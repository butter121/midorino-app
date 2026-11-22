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
export const ITEM_KINDS = ['weapon', 'armor', 'tool', 'spell'] as const;
/** リーダーの効果（K さんの案。効果は変えず、数字だけ data.ts の LEADER で変える）。値はカードの id */
export const LEAD = {
  genius: 'l_akane', striver: 'l_jin', mage: 'l_mina', shield: 'l_gareth', tamer: 'l_haru', giant: 'l_doran',
  explorer: 'l_iska', guard: 'l_goro', gatherer: 'l_popo', swindler: 'l_momo', crafter: 'l_kai', merchant: 'l_miro',
} as const;
export type LeadKey = keyof typeof LEAD;
/** 準備のドラフトの束（cards：残り、taken：誰かが1枚取った、held：持ったことのある席） */
export interface Pack { cards: string[]; taken: boolean; held: number[] }
export type ItemKind = (typeof ITEM_KINDS)[number];
export type Ratio = Record<ItemKind, number>;

// ------------------------------------------------------------ 選択
export type Choice =
  | string
  | { m: 'sell' | 'buy'; r: Res; q: number }
  | { m: 'both'; sell: { r: Res; q: number }; buy: { r: Res; q: number } }
  | { m: 'item'; id: string }
  /** 魔石を1つ出して同じ価値の資源1種類を受け取る（sell）／資源1種類を出して魔石を1つ受け取る（buy） */
  | { m: 'stone'; dir: 'sell' | 'buy'; tier: number; r: Res; q: number };

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
  /** 戦闘で使う後押しを自分で選ぶ（FightChip の key の並び。士気は仲間の数まで重ねられる）。ないときは mode の決め方（safe・gamble）で選ぶ */
  use?: string[];
  /** 動かす仲間を自分で選ぶ（仲間の番号。マスは1人、戦闘は k 人）。ないとき・使えないときはこれまでどおり（マスは空いている最初の仲間、戦闘は戦力の高い順） */
  who?: number[];
}

/** 戦闘で足せる後押し1つ（士気・ポーション・払うカードの効果・手札の秘術） */
export interface FightChip { key: string; name: string; label: string; cost: Cost; gain: number; card?: string; spell: boolean }

export type CardWhy = 'leader' | 'occ' | 'item' | 'start_occ' | 'start_item' | 'quest' | 'draw' | 'refill_occ' | 'refill_item' | 'curio';
export type Req =
  | { k: 'card'; g: Game; p: Player; why: CardWhy; cards: string[]; kind?: string }
  | { k: 'ratio'; g: Game; p: Player; options: Ratio[] }
  | { k: 'kind'; g: Game; p: Player; options: ItemKind[]; left: Ratio }
  | { k: 'choose'; g: Game; p: Player; opts: Option[] }
  | { k: 'heal'; g: Game; p: Player; comp: number; cost: Cost }
  | { k: 'effect'; g: Game; p: Player; card: string; when: string; ops: Op[]; ei?: number }
  | { k: 'pick'; g: Game; p: Player; what: string; options: Choice[] }
  /** 何人かの人に同時に聞く（準備段階。答えは reqs と同じ順の配列）。p は先頭の人 */
  | { k: 'multi'; g: Game; p: Player; reqs: Req[] };
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
    case 'multi': return req.reqs.map(humanDefault);
  }
}
export const autoAnswer = (req: Req): any => (req.k === 'multi' ? req.reqs.map(autoAnswer) : req.p.ai ? req.p.ai.respond(req) : humanDefault(req));
export function drive<T>(gen: Gen<T>): T {
  let r = gen.next();
  while (!r.done) r = gen.next(autoAnswer(r.value));
  return r.value;
}

// ------------------------------------------------------------ プレイヤー
export interface Comp { atk: number; def: number; weapon: string | null; armor: string | null; leader: boolean; injured: boolean; rest: boolean; used: boolean }
/** 使い魔（捕まえた魔物）。power＝戦闘に連れて行ったときの戦力、card＝固有の効果のカード（pet_<type>） */
export interface Pet { type: string; name: string; str: number; power: number; card: string }
export type FameSrc = 'trophy' | 'quest' | 'donate' | 'card' | 'effect' | 'dragon' | 'absent' | 'leader' | 'stone';

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
  pets: Pet[] = [];
  /** 身につけた（何度でも使える）秘術 */
  tomes: string[] = [];
  /** この手番に何度でもの秘術を使った回数 */
  tomeUses: Record<string, number> = {};
  /** 遺物の欠片 */
  shards = 0;
  /** 討伐の証の数（名声は合計 ÷ TROPHY.fameDiv の四捨五入） */
  trophies = 0;
  /** 天才で増えた分の証（リーダーの名声として数える） */
  bonusTrophies = 0;
  /** 魔石の数（[初級, 中級, 上級]。ゲームの終わりに名声。武器・防具を作るときに払う） */
  stones = [0, 0, 0];
  /** 壊れた遺物（修復すると ancient に移る） */
  broken: string[] = [];
  /** 怒り（mod rage：負傷のかわりにためた反撃） */
  rage = 0;
  /** この冬の襲撃の守り（秘術の ward。冬のあと 0 に戻る） */
  ward = 0;
  /** 直前の反撃で負傷する分（hit の効果の中で stat dmg） */
  lastDmg = 0;
  kills = 0;
  races: Race[] = [];
  st = { boss: 0, coop: 0, spells: 0, donations: 0, trades: 0, fights: 0, wins: 0, casts: 0, castsRound: 0, sold: 0, returns: 0, mageRound: 0, blocked: 0, mageWon: 0, blockedLast: 0 };
  quests: string[] = [];
  secret: string | null = null;
  discontent = 0;
  raidLoss = 0;
  fame: Record<FameSrc, number> = { trophy: 0, quest: 0, donate: 0, card: 0, effect: 0, dragon: 0, absent: 0, leader: 0, stone: 0 };
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
  ratio: Ratio = { weapon: 0, armor: 0, tool: 0, spell: 0 };
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
    q.pets = this.pets.map((x) => ({ ...x })); q.kills = this.kills;
    q.tomes = [...this.tomes]; q.tomeUses = { ...this.tomeUses }; q.shards = this.shards; q.trophies = this.trophies; q.bonusTrophies = this.bonusTrophies; q.stones = [...this.stones]; q.broken = [...this.broken]; q.rage = this.rage; q.ward = this.ward; q.lastDmg = this.lastDmg;
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
    // history / fed はラウンドの終わり・準備段階でしか増えないので、先読みの複製では共有する。
    // picked は手番中（引く・掘る）にも増えるので写す（先読みが本物を書きかえないように）
    q.history = this.history; q.fed = this.fed; q.picked = [...this.picked]; q.cardHist = this.cardHist;
    return q;
  }

  free(): number[] { const o: number[] = []; this.comps.forEach((c, i) => { if (!c.used && !c.rest) o.push(i); }); return o; }
  avail() { return this.free().length + this.extra; }
  /** 戦闘に出せる人数（もう1人置ける分は、休んでいない仲間がもう一度出る） */
  fightable() { return Math.min(this.free().length + this.extra, this.comps.filter((c) => !c.rest && !c.injured).length); }
}

export interface FightRec {
  round: number; t: number; kind: 'nest' | 'boss' | 'dragon'; str: number; base: number; total: number; win: boolean;
  addons: number; comps: number; sides: number; pids: number[]; /** 席ごとの証（pids と同じ並び） */ tro: number[]; mode: string;
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
export interface SpaceSt { id: string; def: SpaceDef; stage?: string; optEffects?: Effect[]; stock: Cost; occ: number[]; /** たまった遺物の欠片 */ shards?: number }
export interface NestSt { id: string; mon: Monster | null; groups: number; wait: { pid: number; idxs: number[] } | null }
export interface Plan extends FightBuf {
  pid: number; idxs: number[]; mode: FightMode; power: number; parts: PowerPart[]; guard: number; counter: number; loot: number; trophy: number;
  str: number; noInj: number; cost: Cost; boosts: string[]; spells: string[]; used: string[];
  /** 何度でもの秘術を後押しに使った回数（id ごと） */
  tomeUse: Record<string, number>;
  /** 連れて行った使い魔（pets の番号） */
  pets: number[];
  /** 怒りを使った */
  rage: number;
  /** 足せた後押し（chips）と、実際に使ったものの key */
  chips?: FightChip[]; keys?: string[];
}

export interface GameOptions {
  seed?: number;
  years?: number;
  cards: CardSet;
  /** 画面向けの出来事を出す（me は手札などを見せる席。観戦は −1） */
  events?: { me: number; names: string[] };
  /** 始めの先手（試しの試合だけ。省略すれば種からくじ：startSeat） */
  first?: number;
  /** 席ごとのリーダーを決めておく（測定・AI の調整用。null の席はふつうに選ぶ） */
  leaders?: (string | null)[];
}

/** 始めの先手（種から決まる。本体の乱数の流れとは別にして、ほかのくじは変えない） */
export function startSeat(seed: number, n: number): number {
  return new Rng(((seed >>> 0) ^ 0x9e3779b9) >>> 0).int(n);
}

/** カード一式を読み込む（全カードの DSL を確かめる。知らない op は例外） */
export function loadCards(cs: CardSet) {
  const byId = new Map<string, CardDef>();
  for (const list of [cs.leaders, cs.occupations, cs.weapons, cs.armors, cs.tools, cs.spells, cs.gear, cs.stages, cs.pets]) {
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
  lairQ: { pid: number; idxs: number[]; mode: FightMode; use?: string[] }[] = [];
  forecastQ: Monster[] = [];
  bossOf: Record<number, Monster> = {};
  bossTypes: MonsterType[] = [];
  bossFailedYear = new Set<number>();
  stageAt: Record<number, string> = {};
  monDeck: string[] = [];
  decks: { leader: string[]; occ: string[]; weapon: string[]; armor: string[]; tool: string[]; spell: string[]; ancient: string[]; secret: string[] };
  /** 掘り出し市に並んだ品物（種類ごとに1枚、空いたら山から） */
  curio: string[] = [];
  gearStock: Record<string, number> = {};
  quests: { id: string; done: number[] }[] = [];
  first = 0;
  nextFirst: number | null = null;
  /** 席ごとに決めておいたリーダー（GameOptions.leaders） */
  fixedLeaders: (string | null)[] = [];
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
  /** 人が2人以上いるとき、準備段階の選択を同時に聞く（オンライン対戦の審判が使う） */
  parallelAsk = false;
  names: string[] = [];
  /** 測定：戦闘の運命（運の寄与の推定に使う） */
  fateLog: { pid: number; v: number }[] = [];
  monLog: { round: number; dev: number }[] = [];
  /** 測定：戦闘ごとの記録（sim.ts の勝率・差・後押しの数）。skip＝主・古竜に誰も挑まなかった */
  fightLog: FightRec[] = [];

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
    for (const a of opts.cards.ancient) { this.anc.set(a.id, a); for (let i = 0; i < (a.copies ?? 1); i++) ancDeck.push(a.id); }
    this.players = Array.from({ length: n }, (_, i) => new Player(i, ais[i] ?? null));
    const rng = this.rng;
    this.decks = {
      leader: rng.shuffle(opts.cards.leaders.map((c) => c.id)),
      occ: rng.shuffle(opts.cards.occupations.map((c) => c.id)),
      weapon: rng.shuffle(opts.cards.weapons.map((c) => c.id)),
      armor: rng.shuffle(opts.cards.armors.map((c) => c.id)),
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
    // 段階0の場所（訓練場・遺跡の探索）は始めから置く
    for (const st of opts.cards.stages) if (st.stage === 0) this.addStageSpace(st);
    this.nests = D.NESTS[n].map((id) => ({ id, mon: null, groups: 0, wait: null }));
    this.monDeck = rng.shuffle(D.MONSTERS.map((m) => m.id));
    this.bossTypes = rng.sample(D.BOSS_TYPES, 4);
    this.scheduleStages();
    this.fixedLeaders = opts.leaders ?? [];
    this.first = opts.first !== undefined ? ((opts.first % n) + n) % n : startSeat(opts.seed ?? 0, n);
    if (opts.events) { this.E = []; this.me = opts.events.me; this.names = opts.events.names; }
  }

  /** 手番の順（先手から） */
  turnOrder(): Player[] { return Array.from({ length: this.n }, (_, i) => this.players[(this.first + i) % this.n]); }
  /** 手番の順の何番目か（先手＝0） */
  turnPos(pid: number): number { return (pid - this.first + this.n) % this.n; }
  /** 次の冬に要る食料（仲間の数・カードの修正込み） */
  upkeepNeed(p: Player): number { return Math.max(0, D.upkeepOf(p.comps.length) + this.mods(p).upkeep - (this.is(p, 'explorer') ? D.LEADER.explorer.upkeep : 0)); }

  /** 段階カードを行動マスとして盤面に置く */
  private addStageSpace(st: StageDef) {
    const opts = st.effects.filter((e) => e.when === 'use' || e.when === `use:${st.id}`);
    this.spaces.push({
      id: st.id, stage: st.id, stock: {}, occ: [], optEffects: opts,
      def: { id: st.id, name: st.name, cap: st.cap ?? 1, ...(st.accum ? { accum: st.accum } : {}), options: opts.map((e) => e.do ?? []) },
    });
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
    g.decks = { leader: [...this.decks.leader], occ: [...this.decks.occ], weapon: [...this.decks.weapon], armor: [...this.decks.armor], tool: [...this.decks.tool], spell: [...this.decks.spell], ancient: [...this.decks.ancient], secret: [...this.decks.secret] };
    g.curio = [...this.curio];
    g.gearStock = { ...this.gearStock };
    g.quests = this.quests.map((q) => ({ id: q.id, done: [...q.done] }));
    g.first = this.first; g.nextFirst = this.nextFirst; g.round = this.round; g.uid = this.uid; g.over = this.over;
    g.errors = [];
    g.forceFate = null; g.lastClash = null;
    g.E = null; g.me = this.me; g.names = this.names;
    g.fateLog = []; g.monLog = []; g.fightLog = [];
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
  /** 何人かに同時に聞く。AI はその場で答え、人は2人以上なら1つの multi にまとめる（parallelAsk のときだけ。ほかは順に聞く） */
  private *askAll(reqs: Req[]): Gen<any[]> {
    const out: any[] = new Array(reqs.length);
    const hum: number[] = [];
    reqs.forEach((r, i) => { if (r.p.ai) out[i] = r.p.ai.respond(r); else hum.push(i); });
    if (hum.length <= 1 || !this.parallelAsk) { for (const i of hum) out[i] = yield reqs[i]; return out; }
    const ans: any[] = yield { k: 'multi', g: this, p: reqs[hum[0]].p, reqs: hum.map((i) => reqs[i]) };
    hum.forEach((i, j) => { out[i] = ans[j]; });
    return out;
  }
  /** 選択肢から1つ選ぶ。人の席は1つしかなくても聞く（何ができるのか見てから決められるように）。AI の席は1つなら聞かない */
  private *askOne<T>(p: Player, opts: T[], req: Req): Gen<T> {
    if (opts.length === 1 && p.ai) return opts[0];
    return yield* this.ask(req);
  }

  /** 効果を持つカード（リーダー・出した職能・建てた道具・身につけた秘術・使い魔・装備中の品物）。
   *  fightIdxs を渡すと装備は送った仲間の分だけ、使い魔は連れて行った分だけ（fightPets） */
  activeCards(p: Player, fightIdxs?: number[], fightPets?: number[]): string[] {
    const out: string[] = [];
    if (p.leader) out.push(p.leader);
    out.push(...p.occs, ...p.tools, ...p.tomes);
    p.pets.forEach((pt, i) => { if (pt.card && (!fightIdxs || (fightPets ?? this.bringPets(p)).includes(i))) out.push(pt.card); });
    p.comps.forEach((c, i) => {
      if (fightIdxs && !fightIdxs.includes(i)) return;
      if (c.weapon) out.push(c.weapon);
      if (c.armor) out.push(c.armor);
    });
    return out;
  }
  /** 戦闘に連れて行く使い魔（前の仕組みに戻した：持っている使い魔は全部ついてくる） */
  bringPets(p: Player): number[] {
    return p.pets.map((_, i) => i);
  }
  petCap(p: Player) { return D.CAPTURE.cap + this.mods(p).pet_cap + (this.is(p, 'tamer') ? D.LEADER.tamer.petCap : 0); }
  /** マスの定員（0＝定員なし） */
  /** p のリーダーが k か */
  is(p: Player, k: LeadKey): boolean { return p.leader === LEAD[k]; }
  /** リーダーの効果で名声を得る */
  leadFame(p: Player, n: number, why: string) {
    if (n <= 0) return;
    p.fame.leader += n;
    this.emit({ t: 'fame', seat: p.pid, amount: n, reason: why });
  }
  /** 冒険マスか（盤面のまとまり「冒険」） */
  isAdventure(id: string): boolean {
    for (const g of D.SPACE_GROUPS) if (g.ids.includes(id)) return g.id === 'adventure';
    const tags = this.byId.has(id) ? this.card(id).engine : [];
    for (const t of tags) if (D.SPACE_GROUP_BY_TAG[t]) return false;
    return true;
  }
  /** テイマーの好物（魔物の種類ごとに決まった1種類） */
  favRes(mon: Monster): Res {
    const i = D.MONSTERS.findIndex((m) => m.id === mon.type);
    return D.FAV_RES[(i < 0 ? 0 : i) % D.FAV_RES.length] as Res;
  }
  capOf(s: SpaceSt) { return this.n >= 4 && s.def.cap4 !== undefined ? s.def.cap4 : s.def.cap ?? 1; }
  /** 使っている品物の種類（持たせた武器・防具、建てた道具、唱えた秘術） */
  kinds(p: Player) {
    const w = p.comps.some((c) => c.weapon), a = p.comps.some((c) => c.armor);
    return (w ? 1 : 0) + (a ? 1 : 0) + (p.tools.length ? 1 : 0) + (p.st.casts ? 1 : 0);
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
      case 'facilities': case 'tools': return p.tools.length;
      case 'gear': return p.comps.reduce((a, c) => a + (c.weapon ? 1 : 0) + (c.armor ? 1 : 0), 0);
      case 'weapons': return p.comps.filter((c) => c.weapon).length;
      case 'armors': return p.comps.filter((c) => c.armor).length;
      case 'pets': return p.pets.length;
      case 'tomes': return p.tomes.length;
      case 'casts': return p.st.casts;
      case 'casts_round': return p.st.castsRound;
      case 'shards': return p.shards;
      case 'kinds': return this.kinds(p);
      case 'sold': return p.st.sold;
      case 'gold': return p.res.gold;
      case 'atk': return p.comps.reduce((a, c) => a + c.atk, 0);
      case 'def': return p.comps.reduce((a, c) => a + c.def, 0);
      case 'dmg': return p.lastDmg;
      case 'sent_atk': case 'sent_wpow': case 'sent_k': case 'exposed': return 0;
      case 'kills': return p.kills;
      case 'races': return p.races.length;
      case 'trophies': return p.trophies;
      case 'hand': return p.hand.length;
      case 'ancient': return p.ancient.length;
      case 'quests': return p.quests.length;
      case 'skills': return p.comps.reduce((a, c) => a + c.atk + c.def, 0);
      case 'injured': return p.comps.filter((c) => c.injured).length;
      case 'boss': return p.st.boss;
      case 'coop': return p.st.coop;
      case 'spells': return p.st.spells;
      case 'donations': return p.st.donations;
      case 'trades': return p.st.trades;
      case 'year': return this.year();
      case 'round': return this.round;
      case 'broken': return p.broken.length;
      case 'blocked': return p.st.blockedLast;
      case 'res_total': return RES.reduce((a, r) => a + (r === 'gold' ? 0 : p.res[r]), 0);
    }
  }

  /** 条件の環境。thScale：終わりの効果で、数をこの倍率で割って比べる（しきい値を年数で伸ばすのと同じ） */
  env(p: Player, fight?: FightEnv, thScale = 1): CondEnv {
    const stat = (k: StatKey): number => {
      if (fight) {
        if (k === 'sent_atk') return fight.atk ?? 0;
        if (k === 'sent_wpow') return fight.wpow ?? 0;
        if (k === 'sent_k') return fight.k;
        if (k === 'exposed') return fight.exposed ?? 0;
      }
      const v = this.stat(p, k);
      return thScale !== 1 && !D.TABLE_NOSCALE.has(k) && k !== 'year' && k !== 'round' ? v / thScale : v;
    };
    return { stat, season: this.season(), t: this.t, res: p.res, has: (id) => this.has(p, id), ...(fight ? { fight } : {}) };
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
  extra(p: Player, kind: string): Cost {
    let d: Cost = {};
    for (const cd of this.mods(p).cost_extra) if (cd.kind === kind || cd.kind === 'any') d = addCost(d, cd.res);
    return d;
  }
  /** 種類の値引きと上乗せ（共通の装備は gear のほか、武器・防具の値引き・上乗せも効く） */
  private adjust(p: Player, cost: Cost, kinds: string[]): Cost {
    let c = { ...cost };
    for (const k of kinds) c = addCost(subCost(c, this.discount(p, k)), this.extra(p, k));
    return cleanCost(c);
  }
  cardCost(p: Player, id: string, extraDiscount: Cost = {}): Cost {
    const c = this.card(id);
    // 何度でもの秘術：手札にあるうちは身につける費用ではなく唱える費用（cost）で数える
    const kinds: string[] = [c.kind];
    if (c.kind === 'gear') { const sl = slotOf(c); if (sl) kinds.push(sl); }
    if (c.two_hand) kinds.push('two_hand');
    const out = subCost(this.adjust(p, c.cost ?? {}, kinds), extraDiscount);
    // 職人：道具の費用を資源・素材あわせて discount 減らす（多いものから）
    if (c.kind === 'tool' && this.is(p, 'crafter')) {
      for (let k = 0; k < D.LEADER.crafter.discount; k++) {
        const r = (Object.keys(out) as Res[]).filter((x) => x !== 'gold' && (out[x] ?? 0) > 0).sort((a2, b2) => (out[b2] ?? 0) - (out[a2] ?? 0))[0];
        if (!r) break;
        out[r] = (out[r] ?? 0) - 1;
      }
      return cleanCost(out);
    }
    return out;
  }
  learnCost(p: Player, id: string): Cost { return this.adjust(p, this.card(id).tome?.learn ?? {}, ['spell']); }
  /** ギルドで職能を出す費用（食料1、2枚目から2。カードの cost はその上乗せ） */
  occCost(p: Player, id?: string): Cost {
    const playedViaGuild = Math.max(0, p.occs.length - 1);
    const base = addCost({ food: D.OCC_FOOD[Math.min(playedViaGuild, D.OCC_FOOD.length - 1)] + this.mods(p).occ_food + (this.is(p, 'swindler') ? D.LEADER.swindler.occFood : 0) }, id ? this.card(id).cost ?? {} : {});
    return this.adjust(p, base, ['occ']);
  }
  bedCost(p: Player, disc: Cost = {}) { return subCost(this.adjust(p, D.BED_COST, ['bed']), disc); }
  wallCost(p: Player, disc: Cost = {}) { return subCost(this.adjust(p, D.WALL_COST, ['wall']), disc); }
  /** 足りない資源を金貨で払った費用（作る・建てる・職能。1回に GOLD_SUB.max 個まで、買値+premium）。マナ鉱石は gold_mana があれば金貨で。払えなければ null */
  goldPlan(p: Player, cost: Cost, base: Cost = {}): Cost | null {
    const need = addCost(base, cost);
    if (canPay(p, need)) return cost;
    const out: Cost = { ...cost };
    let subs = 0, gold = 0;
    const gm = this.mods(p).gold_mana;
    for (const r of RES) {
      if (r === 'gold') continue;
      const short = (need[r] ?? 0) - p.res[r];
      if (short <= 0) continue;
      const price = r === 'mana' && gm ? gm : D.BUY[r] + D.GOLD_SUB.premium;
      if (!(r === 'mana' && gm)) { subs += short; if (subs > D.GOLD_SUB.max) return null; }
      out[r] = (out[r] ?? 0) - short;
      gold += short * price;
    }
    out.gold = (out.gold ?? 0) + gold;
    const c = cleanCost(out);
    return canPay(p, addCost(base, c)) ? c : null;
  }
  /** 秘術の費用（マナ鉱石は gold_mana があれば金貨で払える。足りないマナ鉱石だけ）。払えなければ null */
  manaPlan(p: Player, cost: Cost, base: Cost = {}): Cost | null {
    if (canPay(p, addCost(base, cost))) return cost;
    const gm = this.mods(p).gold_mana;
    if (!gm) return null;
    const short = Math.max(0, (cost.mana ?? 0) + (base.mana ?? 0) - p.res.mana);
    const c = cleanCost({ ...cost, mana: (cost.mana ?? 0) - short, gold: (cost.gold ?? 0) + short * gm });
    return canPay(p, addCost(base, c)) ? c : null;
  }
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
  compCap(p: Player) { return D.MAX_COMPS + this.mods(p).comp_cap; }
  /** 交換所で扱える数（交換所に2人目として置いたときは −1。sp を渡す） */
  marketQty(p: Player, sp?: SpaceSt) { return Math.max(1, D.MARKET_QTY + this.mods(p).market_qty - (sp && sp.id === 'market' && sp.occ.some((x) => x !== p.pid) ? 1 : 0)); }
  sellPrice(p: Player, r: Res) { const m = this.mods(p); return (m.sell_full ? D.BUY[r] : D.sellPrice(r)) + m.sell_bonus + (this.is(p, 'merchant') ? D.LEADER.merchant.sellBonus : 0); }
  itemSell(id: string) {
    const c = this.card(id);
    if (c.sell !== undefined) return c.sell;
    const v = Object.entries(c.cost ?? {}).reduce((a, [r, n]) => a + D.BUY[r as Res] * (n as number), 0);
    return Math.max(1, Math.floor(v * D.ITEM_SELL_RATE));
  }
  storage(p: Player): string[] {
    const eq = [...p.comps.map((c) => c.weapon), ...p.comps.map((c) => c.armor)].filter(Boolean) as string[];
    const left = [...p.items];
    for (const e of eq) { const i = left.indexOf(e); if (i >= 0) left.splice(i, 1); }
    return left;
  }
  homeGuard(p: Player) { const m = this.mods(p); return p.walls + m.base_guard + m.home_guard + p.ward; }
  /** 1回に送れる仲間 */
  sendCap(p: Player) { return D.MAX_SEND + this.mods(p).send_cap; }
  fightGuardBase(p: Player) { return Math.floor(p.walls / D.WALLS_PER_GUARD) + this.mods(p).base_guard; }
  healCost(p: Player): Cost { return { herb: Math.max(0, D.HEAL_COST - this.mods(p).heal_discount) }; }

  // ------------------------------------------------------------ 魔物
  private drawType(): MonsterType {
    if (!this.monDeck.length) this.monDeck = this.rng.shuffle(D.MONSTERS.map((m) => m.id));
    return D.MON[this.monDeck.shift()!];
  }
  /** 魔物の強さなど（§6、調整は data.ts の MON_ROLL）。kind：巣の魔物・主・古竜 */
  rollMonster(type: MonsterType, t: number, year: number, kind: 'nest' | 'boss' | 'dragon' = 'nest'): Monster {
    const R = D.MON_ROLL;
    const z = this.rng.truncNormal(0, R.sd, R.clip);
    const n = this.rng.truncNormal(0, R.lootSd, R.lootClip);
    this.monLog.push({ round: this.round, dev: z });
    const slope = (kind === 'nest' ? R.slope : R.boss.slope)[this.years] ?? 15;
    const grade = kind === 'dragon' ? D.DRAGON.grade : type.grade;
    const s0 = Math.max(1, (kind === 'nest' ? R.base : R.boss.base) + slope * t + grade + z);
    const boss = kind !== 'nest';
    const per = kind === 'boss' ? R.boss.per[this.years] ?? 1 : kind === 'dragon' ? D.DRAGON.per[this.years] ?? 1 : 0;
    const str = boss ? Math.max(1, Math.round((s0 - grade) * per * (D.BOSS_N[this.n] ?? this.n)) + grade) : Math.max(1, Math.round(s0 - R.ease.base - (R.ease.slope[this.years] ?? 4) * t));
    const lootN = Math.max(0, Math.round((s0 / R.lootDiv) * (boss ? R.boss.loot : 1) + n));
    const loot: Cost = {};
    for (let i = 0; i < lootN; i++) { const r = type.loot[i % type.loot.length]; loot[r] = (loot[r] ?? 0) + 1; }
    const counter = Math.round(s0 / R.counterDiv) + (kind === 'boss' ? R.boss.counter : kind === 'dragon' ? D.DRAGON.counter : 0);
    const T = D.TROPHY;
    const trophy = Math.max(1, Math.round(str / T.div + n + (kind === 'dragon' ? T.dragon : kind === 'boss' ? T.boss : 0)));
    const band = this.maxNestStr() / 3;
    const stoneTier = boss ? 2 : Math.min(2, Math.floor(str / band));
    const frac = (str - stoneTier * band) / band + this.rng.truncNormal(0, D.STONE.noise, 2);
    const stones = boss ? D.STONE.max : Math.min(D.STONE.max, frac >= 0.5 ? 2 : 1);
    const raid = kind === 'dragon' ? 0 : Math.round(s0 / R.raidDiv) + (boss ? R.boss.raid : 0);
    return { uid: ++this.uid, type: type.id, name: type.name, race: type.race, str, counter, loot, trophy, stones, stoneTier, raid, boss, year, wounds: 0 };
  }
  /** その試合で巣の魔物がいちばん強くなる場合の強さ（最後のラウンド・いちばん格の高い魔物・ゆらぎ最大。主・古竜を除く） */
  maxNestStr(): number {
    const R = D.MON_ROLL;
    const g = Math.max(...D.MONSTERS.map((m) => m.grade));
    return Math.max(3, Math.round(R.base + (R.slope[this.years] ?? 15) + g + R.sd * R.clip - R.ease.base - (R.ease.slope[this.years] ?? 4)));
  }
  /** 遺物の修復のしかた。key は選択肢（ふつうは遺物の id。探検家は「id~減らす資源.減らす資源」で、減らす資源を選べる） */
  repairVariants(p: Player, id: string): { key: string; cost: Cost }[] {
    const a = this.anc.get(id);
    if (!a) return [];
    const cut = (this.is(p, 'explorer') ? D.LEADER.explorer.repairCut : 0) + this.mods(p).repair_cut;
    if (!cut) return [{ key: id, cost: a.repair }];
    const units: Res[] = [];
    for (const [r, n] of Object.entries(a.repair)) for (let k = 0; k < (n as number); k++) units.push(r as Res);
    if (units.length <= cut) return [{ key: `${id}~${units.join('.')}`, cost: {} }];
    const seen = new Map<string, Cost>();
    const pick = (from: number, left: number, took: Res[]) => {
      if (!left) {
        const k = [...took].sort().join('.');
        if (!seen.has(k)) { const c: Cost = { ...a.repair }; for (const r of took) c[r] = (c[r] ?? 0) - 1; seen.set(k, cleanCost(c)); }
        return;
      }
      for (let i = from; i < units.length; i++) pick(i + 1, left - 1, [...took, units[i]]);
    };
    pick(0, cut, []);
    return [...seen].map(([k, cost]) => ({ key: `${id}~${k}`, cost }));
  }
  repairOf(p: Player, key: string): { id: string; cost: Cost } | null {
    const id = key.split('~')[0];
    const v = this.repairVariants(p, id).find((x) => x.key === key);
    return v ? { id, cost: v.cost } : null;
  }
  /** 作るのに要る魔石の段階（武器・防具の重さ。なければ null） */
  stoneNeed(id: string, p?: Player): number | null {
    const c = this.card(id);
    if (c.kind !== 'weapon' && c.kind !== 'armor') return null;
    const t = D.WEIGHT_TIER[c.weight ?? ''];
    if (t === undefined) return null;
    const dn = p ? this.mods(p).stone_down : [];
    const down = dn.includes(c.kind) || (c.two_hand && dn.includes('two_hand')) ? 1 : 0;
    return Math.max(0, t - down);
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
    for (const p of this.players) yield* this.fire(p, 'game_end', { fameScale: D.POINT_SCALE[this.years] ?? 1, thScale: D.TABLE_SCALE[this.years] ?? 1 });
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
    // 始めの先手（くじ）。準備の順・食料の追加もこの順
    this.emit({ t: 'first_player', seat: this.first });
    const order = this.turnOrder();
    // 準備段階の選択は全員が同時に選ぶ（オンラインでは同時に聞く。カードは先手から順に配る）
    // 1. リーダー：1人に戦闘1枚・探索1枚を見せる（ほかの人と同じカードは見えない）。戦闘・探索が足りないときは残りから
    {
      const take = (role: 'fight' | 'explore') => {
        const d = this.decks.leader;
        const i = d.findIndex((c) => this.card(c).role === role);
        return i >= 0 ? d.splice(i, 1) : d.splice(0, 1);
      };
      const fixed = this.fixedLeaders;
      for (const id of fixed) { if (!id) continue; const j = this.decks.leader.indexOf(id); if (j >= 0) this.decks.leader.splice(j, 1); }
      const shows = order.map((p) => { const show = fixed[p.pid] ? [fixed[p.pid]!] : [...take('fight'), ...take('explore')]; this.emit({ t: 'leader_offer', seat: p.pid, cards: [...show] }); return show; });
      const picks: string[] = yield* this.askAll(order.map((p, i) => ({ k: 'card', g: this, p, why: 'leader', cards: shows[i] }) as Req));
      order.forEach((p, i) => {
        const c = picks[i];
        if (!shows[i].includes(c)) throw new Error('bad leader');
        p.leader = c;
        this.decks.leader.push(...shows[i].filter((x) => x !== c));
        this.emit({ t: 'leader_pick', seat: p.pid, card: c });
      });
      rng.shuffle(this.decks.leader);
    }
    // 2. 職能×3：山を5枚の束6つに分け、1周ごとに1人1束ずつ渡して全員同時に1枚。
    //    自分が持った束は二度と渡さず、まだ誰も取っていない束を先に渡す。残りは最後に山に戻す
    const packs: Partial<Record<'occ' | ItemKind, Pack[]>> = { occ: this.makePacks('occ') };
    for (let lap = 0; lap < 3; lap++) yield* this.draftPacks(order, order.map(() => 'occ' as const), packs, 'occ');
    // 3〜4. 割合と品物×ITEM_COUNT（武器・防具・道具・秘術）
    const ratios: Ratio[] = [];
    const N = D.ITEM_COUNT;
    for (let w = 0; w <= N; w++) for (let a = 0; a <= N - w; a++) for (let t = 0; t <= N - w - a; t++) ratios.push({ weapon: w, armor: a, tool: t, spell: N - w - a - t });
    const ras: Ratio[] = yield* this.askAll(order.map((p) => ({ k: 'ratio', g: this, p, options: ratios }) as Req));
    order.forEach((p, i) => { p.ratio = { ...ras[i] }; this.emit({ t: 'ratio', seat: p.pid, ratio: { ...ras[i] } }); });
    const left = new Map(order.map((p) => [p.pid, { ...p.ratio }]));
    for (const k of ITEM_KINDS) packs[k] = this.makePacks(k);
    for (let j = 0; j < D.ITEM_COUNT; j++) {
      // どの種類を取るか（全員同時）→ その種類の山から5枚ずつ配って全員同時に1枚
      const who: Player[] = [], reqs: Req[] = [], kindsOf: ItemKind[][] = [];
      for (const p of order) {
        const lf = left.get(p.pid)!;
        const kinds = ITEM_KINDS.filter((k) => lf[k] > 0 && this.packFor(p, k, packs));
        if (!kinds.length) continue;
        who.push(p); kindsOf.push(kinds);
        reqs.push({ k: 'kind', g: this, p, options: kinds, left: { ...lf } });
      }
      if (!who.length) break;
      const many = reqs.map((r, i) => (kindsOf[i].length > 1 ? i : -1)).filter((i) => i >= 0);
      const ans: ItemKind[] = yield* this.askAll(many.map((i) => reqs[i]));
      const kinds = who.map((_, i) => (kindsOf[i].length > 1 ? ans[many.indexOf(i)] : kindsOf[i][0]));
      who.forEach((p, i) => { if (!kindsOf[i].includes(kinds[i])) throw new Error('bad kind'); left.get(p.pid)![kinds[i]] -= 1; });
      yield* this.draftPacks(who, kinds, packs, 'item');
    }
    this.returnPacks(packs);
    // 5. 始めの2枚（費用なし）：職能を全員同時に選んで出し、次に品物を全員同時に選んで出す
    {
      const who = order.filter((p) => p.hand.some((c) => this.card(c).kind === 'occ'));
      const picks: string[] = yield* this.askAll(who.map((p) => ({ k: 'card', g: this, p, why: 'start_occ', cards: p.hand.filter((c) => this.card(c).kind === 'occ') }) as Req));
      for (let i = 0; i < who.length; i++) yield* this.playOcc(who[i], picks[i], true);
    }
    {
      // 準備で作れる武器・防具は軽いものだけ（中・重い・呪いの装備は試合が始まってから）
      const okStart = (c: string) => { const d = this.card(c); return d.kind === 'tool' || !!d.tome || ((d.kind === 'weapon' || d.kind === 'armor') && d.weight === 'light'); };
      const who = order.filter((p) => p.hand.some(okStart));
      const picks: string[] = yield* this.askAll(who.map((p) => ({ k: 'card', g: this, p, why: 'start_item', cards: p.hand.filter(okStart) }) as Req));
      for (let i = 0; i < who.length; i++) yield* this.playItem(who[i], picks[i], true);
    }
    // 6. 秘密依頼（2枚ずつ配って全員同時に1枚）
    {
      const who: Player[] = [], shows: string[][] = [];
      for (const p of order) {
        const show = this.decks.secret.splice(0, Math.min(2, this.decks.secret.length));
        if (!show.length) continue;
        who.push(p); shows.push(show);
      }
      const picks: string[] = yield* this.askAll(who.map((p, i) => ({ k: 'card', g: this, p, why: 'quest', cards: shows[i] }) as Req));
      who.forEach((p, i) => {
        const c = shows[i].includes(picks[i]) ? picks[i] : shows[i][0];
        p.secret = c;
        this.decks.secret.push(...shows[i].filter((x) => x !== c));
        this.emit({ t: 'secret_quest', seat: p.pid, quest: p.pid === this.me ? c : '?' });
      });
    }
    // 始めの持ち物
    for (const p of order) {
      p.comps = [];
      for (let i = 0; i < D.START.comps; i++) p.comps.push(newComp(i === 0));
      p.beds = D.START.beds;
      const g0: Cost = { food: D.START.food + (D.SEAT_FOOD[this.n][this.turnPos(p.pid)] ?? 0), gold: D.START.gold, wood: D.START.wood, iron: D.START.iron };
      if (this.is(p, 'merchant')) for (const r of ['wood', 'iron', 'herb', 'mana', 'food'] as const) g0[r] = (g0[r] ?? 0) + D.LEADER.merchant.start;
      gainRes(p, g0);
      this.emit({ t: 'grant', seat: p.pid, gain: g0, reason: '開始時' });
      if (p.ai) this.autoEquip(p);
      else for (const id of this.storage(p)) if (slotOf(this.card(id))) yield* this.gotGear(p, id);
      yield* this.fire(p, 'setup', {});
    }
    this.round = 0;
    this.refillCurio();
    this.refillForecast();
  }

  /** 掘り出し市の並び（武器・防具・道具・秘術を1枚ずつ。空いた種類だけ山から） */
  refillCurio() {
    if (!this.spaces.some((s) => s.id === 'curio')) return;
    const kinds = new Set(this.curio.map((c) => this.card(c).kind));
    for (const k of ITEM_KINDS) {
      if (kinds.has(k)) continue;
      const d = this.decks[k];
      if (d.length) this.curio.push(d.shift()!);
    }
    this.emit({ t: 'curio', cards: [...this.curio] });
  }
  /** 使い終えた・壊した・売ったカードを山の下へ戻す */
  recycle(id: string) {
    const k = this.card(id).kind;
    if (k === 'weapon' || k === 'armor' || k === 'tool' || k === 'spell' || k === 'occ') this.decks[k].push(id);
  }

  /** 山を混ぜて5枚の束を最大 PACKS 個作る（山からは抜く。returnPacks で戻す） */
  private makePacks(kind: 'occ' | ItemKind): Pack[] {
    const d = this.rng.shuffle(this.decks[kind]);
    const out: Pack[] = [];
    while (out.length < D.PACKS && d.length) out.push({ cards: d.splice(0, D.PACK_SIZE), taken: false, held: [] });
    return out;
  }
  /** 束に残ったカードを全部山に戻して混ぜる */
  private returnPacks(packs: Partial<Record<'occ' | ItemKind, Pack[]>>) {
    for (const [k, ps] of Object.entries(packs) as ['occ' | ItemKind, Pack[]][]) {
      for (const pk of ps) this.decks[k].push(...pk.cards);
      this.rng.shuffle(this.decks[k]);
    }
  }
  /** p がまだ持っていない、カードの残っている束があるか */
  private packFor(p: Player, kind: 'occ' | ItemKind, packs: Partial<Record<'occ' | ItemKind, Pack[]>>): boolean {
    return (packs[kind] ?? []).some((pk) => pk.cards.length && !pk.held.includes(p.pid));
  }
  /** 束の割り当て：1人1束・同じ束は2人に渡さない・自分が持った束は渡さない。
   *  まだ誰も取っていない束をできるだけ多く使う（同じ数ならくじ）。渡せない人は null */
  private assignPacks(ps: Player[], packs: Pack[]): (Pack | null)[] {
    const order = this.rng.shuffle(packs.map((_, i) => i));
    let best: (number | null)[] = ps.map(() => null), bestScore = -1;
    const cur: (number | null)[] = [];
    const used = new Set<number>();
    const score = () => cur.reduce<number>((a, i) => a + (i === null ? 0 : 100 + (packs[i].taken ? 0 : 1)), 0);
    const dfs = (j: number) => {
      if (j === ps.length) { const sc = score(); if (sc > bestScore) { bestScore = sc; best = [...cur]; } return; }
      // まだ取られていない束から試す
      const cand = order.filter((i) => !used.has(i) && packs[i].cards.length && !packs[i].held.includes(ps[j].pid)).sort((a, b) => Number(packs[a].taken) - Number(packs[b].taken));
      for (const i of cand) { used.add(i); cur.push(i); dfs(j + 1); cur.pop(); used.delete(i); }
      cur.push(null); dfs(j + 1); cur.pop();
    };
    dfs(0);
    return best.map((i) => (i === null ? null : packs[i]));
  }
  /** 何人かに束を1つずつ渡し（種類ごとに割り当て）、全員同時に1枚選ぶ。選ばれたカードは束から抜ける */
  private *draftPacks(ps: Player[], kinds: ('occ' | ItemKind)[], packs: Partial<Record<'occ' | ItemKind, Pack[]>>, why: CardWhy): Gen {
    const got: (Pack | null)[] = ps.map(() => null);
    for (const k of new Set(kinds)) {
      const idx = ps.map((_, i) => i).filter((i) => kinds[i] === k);
      const a = this.assignPacks(idx.map((i) => ps[i]), packs[k] ?? []);
      idx.forEach((i, j) => { got[i] = a[j]; });
    }
    const idx = ps.map((_, i) => i).filter((i) => got[i]);
    for (const i of idx) {
      const p = ps[i], pk = got[i]!;
      pk.held.push(p.pid);
      this.emit({ t: 'draft_offer', seat: p.pid, kind: kinds[i], cards: p.pid === this.me || this.me < 0 ? [...pk.cards] : pk.cards.map(() => '?') });
    }
    const picks: string[] = yield* this.askAll(idx.map((i) => ({ k: 'card', g: this, p: ps[i], why, cards: [...got[i]!.cards], kind: kinds[i] }) as Req));
    idx.forEach((i, j) => {
      const p = ps[i], pk = got[i]!, c = picks[j];
      const at = pk.cards.indexOf(c);
      if (at < 0) throw new Error('bad pick');
      pk.cards.splice(at, 1);
      pk.taken = true;
      p.hand.push(c);
      p.picked.push(c);
      this.emit({ t: 'draft_pick', seat: p.pid, kind: kinds[i], card: p.pid === this.me || this.me < 0 ? c : '?' });
    });
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
        const b = this.rollMonster(this.bossTypes[bi], this.tAt(wr), y, 'boss');
        this.bossOf[wr] = b;
        this.emit({ t: 'boss_reveal', boss: { ...b }, round: wr });
      }
      if (y === this.years) {
        const wr = y * 4;
        this.bossOf[wr] = this.rollMonster(D.ANCIENT_DRAGON, 1, y, 'dragon');
        this.emit({ t: 'boss_reveal', boss: { ...this.bossOf[wr] }, round: wr });
      }
      if (D.REFILL_YEARS[this.years].includes(y)) {
        // 品物を2枚足す（職能は足さない）。準備と同じく、種類も1枚も全員同時に選び、束で配る
        const ps = this.turnOrder();
        const packs: Partial<Record<'occ' | ItemKind, Pack[]>> = {};
        for (const k of ITEM_KINDS) packs[k] = this.makePacks(k);
        for (let j = 0; j < 2; j++) {
          const who: Player[] = [], reqs: Req[] = [], kindsOf: ItemKind[][] = [];
          for (const p of ps) {
            const kinds = ITEM_KINDS.filter((k) => this.packFor(p, k, packs));
            if (!kinds.length) continue;
            who.push(p); kindsOf.push(kinds);
            reqs.push({ k: 'kind', g: this, p, options: kinds, left: { weapon: 1, armor: 1, tool: 1, spell: 1 } });
          }
          if (!who.length) break;
          const many = reqs.map((_, i) => (kindsOf[i].length > 1 ? i : -1)).filter((i) => i >= 0);
          const ans: ItemKind[] = yield* this.askAll(many.map((i) => reqs[i]));
          const kinds = who.map((_, i) => (kindsOf[i].length > 1 ? ans[many.indexOf(i)] : kindsOf[i][0]));
          who.forEach((_, i) => { if (!kindsOf[i].includes(kinds[i])) throw new Error('bad kind'); });
          yield* this.draftPacks(who, kinds, packs, 'refill_item');
        }
        this.returnPacks(packs);
      }
    }
    // 段階カード
    const sc = this.stageAt[r];
    if (sc) {
      const st = this.card(sc) as StageDef;
      this.addStageSpace(st);
      this.emit({ t: 'stage_reveal', card: st.id, stage: st.stage });
    }
    // たまるマス
    const adds: Record<string, Cost> = {};
    for (const s of this.spaces) if (s.def.accum) { s.stock = addCost(s.stock, s.def.accum); adds[s.id] = { ...s.def.accum }; }
    for (const s of this.spaces) if (s.def.shards) s.shards = (s.shards ?? 0) + s.def.shards;
    this.emit({ t: 'refill', adds });
    for (const s of this.spaces) s.occ = [];
    this.refillCurio();
    for (const p of this.players) {
      p.extra = 0; p.ignoreFull = false; p.tradesUsed = 0; p.acts = []; p.rbuf = emptyBuf(); p.lastSpace = null; p.st.castsRound = 0; p.st.returns = 0; p.st.mageRound = 0;
      for (const c of p.comps) c.used = false;
      // 蓄積効果
      const due = p.future.filter((f) => f.round === r);
      p.future = p.future.filter((f) => f.round > r);
      for (const f of due) { gainRes(p, f.gain); this.emit({ t: 'future', seat: p.pid, gain: f.gain }); }
      this.autoEquip(p);
      yield* this.fire(p, 'round_start', {});
      // 自宅警備員：毎ラウンドの始めに防壁を作れる（費用は払う）
      if (this.is(p, 'guard') && this.goldPlan(p, this.wallCost(p))) {
        const x: string = yield* this.ask({ k: 'pick', g: this, p, what: 'guard', options: ['wall', 'skip'] });
        if (x === 'wall') yield* this.runOps(p, [{ build: 'wall' }], { x: 'wall' });
      }
    }
    // 魔物の出現（予告されていたもの）と次の予告
    for (const nd of this.nests) {
      nd.groups = 0; nd.wait = null;
      if (!nd.mon && this.forecastQ.length && this.rng.random() < D.MON_ROLL.spawnP) {
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
        // 秘術は1手番に何枚でも（何度でもの秘術はカードごとの回数まで）。そのあとマスに置く
        p.tomeUses = {};
        let o: Option;
        for (let n = 0; ; n++) {
          const opts = this.legal(p, n < 30);
          o = yield* this.ask({ k: 'choose', g: this, p, opts });
          if (!opts.some((x) => sameOpt(x, o))) throw new Error(`illegal option ${JSON.stringify(o)}`);
          if (o.s !== '@spell' && o.s !== '@learn') break;
          yield* this.apply(p, o);
        }
        yield* this.apply(p, o);
        // 共闘などで他の人の条件も同時に満たすことがあるので、全員をいっしょに確かめる
        yield* this.questsGen();
      }
    }
    // 待ち伏せのまま誰も来なかった巣は単独で戦う（ラウンドの終わり）
    for (const nd of this.nests) {
      if (nd.wait && nd.mon) {
        const w = nd.wait;
        nd.wait = null;
        const p = this.players[w.pid];
        yield* this.fight(nd, [{ p, idxs: w.idxs, mode: 'gamble' }]);
        yield* this.questsGen();
      }
    }
    if (this.bossOf[this.round]) yield* this.resolveLair();
  }

  // ------------------------------------------------------------ ラウンドの終わり（§3.4）
  *endRound(): Gen {
    for (const p of this.players) {
      // 連唱魔女ミナ：このラウンドに戦闘で勝っていれば、使った秘術1つごとに名声
      if (this.is(p, 'mage') && p.st.mageWon && p.st.castsRound) this.leadFame(p, p.st.castsRound * D.LEADER.mage.fame, '連唱魔女ミナ');
      p.st.mageWon = 0;
      yield* this.fire(p, 'round_end', {});
    }
    // 仲間が戻る。負傷の回復判定（薬草2で即回復、払わなければ次のラウンド休み）
    for (const p of this.players) {
      for (const c of p.comps) { c.used = false; c.rest = false; }
      for (let i = 0; i < p.comps.length; i++) {
        const c = p.comps[i];
        if (!c.injured) continue;
        const cost = this.healCost(p);
        if (canPay(p, cost) && (yield* this.ask({ k: 'heal', g: this, p, comp: i, cost }))) {
          this.spend(p, cost);
          c.injured = false;
          p.acts.push('heal');
          this.emit({ t: 'heal', seat: p.pid, companion: i, cost });
        } else { c.injured = false; c.rest = true; }
      }
    }
    if (this.isWinter()) yield* this.winter();
    yield* this.questsGen();
    for (const p of this.players) { p.history.push(p.acts); p.cardHist.push(this.activeCards(p)); }
    if (this.nextFirst !== null && this.nextFirst !== this.first) { this.first = this.nextFirst; this.emit({ t: 'first_pass', seat: this.first }); }
    this.emit({ t: 'round_end', round: this.round });
  }

  *winter(): Gen {
    this.emit({ t: 'winter_start' });
    const y = this.year();
    for (const p of this.players) {
      const need = this.upkeepNeed(p);
      let paid = Math.min(need, p.res.food);
      p.res.food -= paid;
      // 足りない食料は金貨 WINTER_GOLD 枚で1つの代わり（あるだけ）
      const wg = this.mods(p).winter_gold || D.WINTER_GOLD;
      const byGold = Math.min(need - paid, Math.floor(p.res.gold / wg));
      if (byGold > 0) { p.res.gold -= byGold * wg; paid += byGold; this.emit({ t: 'pay', seat: p.pid, cost: { gold: byGold * wg }, reason: 'winter' }); }
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
    // 魔物呼び：全員の襲撃を倍に（切り捨て）
    const rm = Math.max(1, ...this.players.map((q) => this.mods(q).raid_mult));
    if (rm > 1) raid = Math.floor(raid * rm);
    for (const p of this.players) {
      const blocked = Math.min(raid, this.homeGuard(p));
      p.st.blocked += blocked;
      p.st.blockedLast = blocked;
      if (this.is(p, 'guard')) this.leadFame(p, blocked * D.LEADER.guard.blockedFame, '自宅警備員ゴロー');
      const dmg = raid - blocked;
      p.raidLoss += dmg;
      if (raid) this.emit({ t: 'raid', seat: p.pid, damage: dmg, blocked });
      yield* this.fire(p, 'winter', {});
      p.ward = 0;
    }
    // 採集家：毎年の終わり（冬のあと）に、持っている資源の合計 ÷ fameDiv の名声
    for (const p of this.players) if (this.is(p, 'gatherer')) { const m = this.mods(p); this.leadFame(p, Math.floor((RES.reduce((a, r) => a + p.res[r], 0) + m.hoard_bonus) / (m.hoard_div || D.LEADER.gatherer.fameDiv)), '溜め込みポポ'); }
    for (const p of this.players) if (this.is(p, 'tamer')) this.leadFame(p, p.pets.length * D.LEADER.tamer.fame, '餌付け師ハル');
    this.emit({ t: 'winter_end' });
  }

  // ------------------------------------------------------------ 選べる手
  legal(p: Player, spells = true): Option[] {
    const out: Option[] = [];
    if (spells) {
      const castable = (c: string, ei: number, e: Effect) => {
        if (e.when !== 'play' || !this.limitOk(p, c, ei, e.limit) || !checkCond(e.if, this.env(p))) return false;
        const cost = this.manaPlan(p, this.cardCost(p, c), sumPays(e.do ?? []));
        if (!cost) return false;
        return this.expand(p, e.do ?? [], {}, false, addCost(cost, sumPays(e.do ?? []))).length > 0;
      };
      for (const c of new Set(p.hand)) {
        const cd = this.card(c);
        if (cd.kind !== 'spell') continue;
        if (cd.tome) {
          // 何度でもの秘術：まず身につける
          if (this.manaPlan(p, this.learnCost(p, c))) out.push({ s: '@learn', i: 0, card: c });
          continue;
        }
        cd.effects.forEach((e, ei) => { if (castable(c, ei, e)) out.push({ s: '@spell', i: ei, card: c }); });
      }
      for (const c of p.tomes) {
        const cd = this.card(c);
        if ((p.tomeUses[c] ?? 0) >= (cd.tome?.uses ?? 1)) continue;
        cd.effects.forEach((e, ei) => { if (castable(c, ei, e)) out.push({ s: '@spell', i: ei, card: c }); });
      }
    }
    const nfree = p.fightable();
    const hasComp = nfree > 0;
    if (p.avail() <= 0) return out;
    for (const s of this.spaces) {
      const cap = this.capOf(s);
      // 定員を無視して置く効果（ignore_full）は巣だけ。冒険のマスの相乗りは、もう1人置けるマス（討伐隊）には使えない（置き続けられてしまうので）
      if (cap > 0 && s.occ.length >= cap && !(s.id === 'workshop' && this.is(p, 'crafter')) && !((this.is(p, 'explorer') || this.mods(p).adv_free) && this.isAdventure(s.id) && !s.def.options.some((ops) => ops.some((op) => op.extra_worker)))) continue;
      s.def.options.forEach((ops, i) => {
        const eff = s.optEffects?.[i];
        if (eff) {
          if (!this.limitOk(p, s.id, i, eff.limit) || !checkCond(eff.if, this.env(p))) return;
        }
        if (!canPay(p, sumPays(ops))) return;
        for (const x of this.expand(p, ops, {}, false, {}, s)) out.push(x === undefined ? { s: s.id, i } : { s: s.id, i, x });
      });
      // instead:<space>
      for (const [card, ei, e] of this.effectsOf(p, `instead:${s.id}`)) {
        if (!canPay(p, sumPays(e.do ?? []))) continue;
        for (const x of this.expand(p, e.do ?? [], {}, false, {}, s)) out.push({ s: s.id, i: -1, card, e: ei, ...(x === undefined ? {} : { x }) });
      }
    }
    if (hasComp) {
      for (const nd of this.nests) {
        if (!nd.mon) continue;
        // 餌付け師ハル：巣の魔物は倒せない。好物を払って使い魔にする（主・古竜は倒せる）
        if (this.is(p, 'tamer')) {
          if ((nd.groups < D.NEST_CAP || p.ignoreFull) && canPay(p, this.captureCost(nd.mon, p))) out.push({ s: nd.id, i: 0, k: 1, mode: 'capture' });
          continue;
        }
        if (nd.wait) {
          if (nd.wait.pid === p.pid) continue;
          for (let k = 1; k <= Math.min(this.sendCap(p), nfree); k++) for (const mode of ['normal', 'safe', 'gamble', 'guard'] as FightMode[]) out.push({ s: nd.id, i: 0, k, mode, join: true });
          continue;
        }
        if (nd.groups >= D.NEST_CAP && !p.ignoreFull) continue;
        for (let k = 1; k <= Math.min(this.sendCap(p), nfree); k++) {
          for (const mode of ['normal', 'safe', 'gamble', 'chip', 'guard', 'wait'] as FightMode[]) {
            if (mode === 'wait' && (nd.groups > 0 || this.n < 2)) continue;
            out.push({ s: nd.id, i: 0, k, mode });
          }
        }
        for (const key of [`instead:nest`, `instead:${nd.id}`]) {
          for (const [card, ei, e] of this.effectsOf(p, key, { race: nd.mon.race, coop: false, k: 1, boss: false })) {
            if (!canPay(p, sumPays(e.do ?? []))) continue;
            if ((e.do ?? []).some((op) => op.tame) && (!this.canTame(nd.mon) || !canPay(p, addCost(sumPays(e.do ?? []), this.captureCost(nd.mon))))) continue;
            out.push({ s: nd.id, i: -1, card, e: ei, k: 1 });
          }
        }
      }
      const boss = this.bossOf[this.round];
      if (boss && !this.lairQ.some((e) => e.pid === p.pid)) {
        for (let k = 1; k <= Math.min(this.sendCap(p), nfree); k++) for (const mode of ['normal', 'safe', 'gamble', 'guard'] as FightMode[]) out.push({ s: 'lair', i: 0, k, mode });
      }
    }
    if (!out.some((o) => o.s !== '@spell' && o.s !== '@learn')) out.push({ s: 'plaza', i: 0 });
    return out;
  }

  /** カードの効果のうち when が合い、条件・回数を満たすもの */
  effectsOf(p: Player, when: string, fight?: FightEnv, idxs?: number[], thScale = 1): [string, number, Effect][] {
    const out: [string, number, Effect][] = [];
    const env = this.env(p, fight, thScale);
    for (const c of this.activeCards(p, idxs)) {
      this.card(c).effects.forEach((e, i) => {
        if (e.when === when && this.limitOk(p, c, i, e.limit) && checkCond(e.if, env)) out.push([c, i, e]);
      });
    }
    return out;
  }

  /** 手順の中の「選ぶ op」を選択肢に広げる（選ぶものが無ければ [undefined]、できなければ []） */
  expand(p: Player, ops: Op[], disc: Cost = {}, nestCtx = false, extraPay: Cost = {}, sp?: SpaceSt): (Choice | undefined)[] {
    const op = ops.find((o) => EXPAND_OPS.has(opKey(o)));
    const base = addCost(sumPays(ops), extraPay);
    // 作る・建てる・職能は、足りない資源を金貨で払える（goldPlan）
    const after = (c: Cost) => this.goldPlan(p, c, base) !== null;
    for (const o of ops) if ((o.hire || o.hire_free) && !this.canHire(p, !!o.hire_free)) return [];
    if (!nestCtx && ops.some((o) => o.tame) && !this.nests.some((nd) => nd.mon && this.canTame(nd.mon) && canPay(p, addCost(base, this.captureCost(nd.mon))))) return [];
    if (ops.some((o) => o.buy_card) && !this.curio.length) return [];
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
        const sn = this.stoneNeed(c, p);
        if (ok && this.prereqOk(p, c) && (sn === null || p.stones[sn] > 0) && after(this.cardCost(p, c, disc))) out.push(c);
      }
      for (const gd of this.cs.gear) {
        const sl = slotOf(gd);
        const ok = want === 'any' || want === sl;
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
      for (const s of ['atk', 'def'] as const) if ((t === s || t === 'any') && this.trainCands(p, s, !!op.fresh).length) out.push(s);
    } else if (k === 'scrap') {
      const want = op.scrap!.card;
      for (const c of new Set(p.tools)) if (!want || want === c || (want === 'self' && false)) out.push(c);
    } else if (k === 'repair') {
      for (const id of new Set(p.broken)) for (const v of this.repairVariants(p, id)) if (canPay(p, addCost(base, v.cost))) out.push(v.key);
    } else if (k === 'exchange') {
      const q = this.marketQty(p, sp);
      const sells: { r: Res; q: number }[] = [], buys: { r: Res; q: number }[] = [];
      for (const r of RES) {
        if (r === 'gold') continue;
        for (let n = 1; n <= Math.min(q, p.res[r] - (base[r] ?? 0)); n++) sells.push({ r, q: n });
        for (let n = 1; n <= q; n++) if (after({ gold: D.BUY[r] * n })) buys.push({ r, q: n });
      }
      for (const s of sells) out.push({ m: 'sell', ...s });
      for (const b of buys) out.push({ m: 'buy', ...b });
      for (const id of new Set(this.storage(p))) out.push({ m: 'item', id });
      // 資源1種類 ⇄ 別の資源1種類（同じ価値＝同じ数）
      for (const s of sells) for (const r of RES) if (r !== 'gold' && r !== s.r) out.push({ m: 'both', sell: s, buy: { r, q: s.q * D.VALUE[s.r] / D.VALUE[r] } });
      // 魔石は1つずつ、同じ価値の資源1種類と（3つの上限は魔石のときはない）
      for (let t = 0; t < D.STONE.value.length; t++) {
        const v = D.STONE.value[t];
        for (const r of RES) {
          if (p.stones[t] > 0) out.push({ m: 'stone', dir: 'sell', tier: t, r, q: v });
          if (p.res[r] - (base[r] ?? 0) >= v) out.push({ m: 'stone', dir: 'buy', tier: t, r, q: v });
        }
      }
    }
    return out;
  }

  canHire(p: Player, free: boolean) {
    if (p.comps.length >= this.compCap(p)) return false;
    return free || p.comps.length < this.bedCap(p);
  }

  // ------------------------------------------------------------ 手を実行する
  *apply(p: Player, o: Option): Gen {
    if (o.s === '@spell') { yield* this.playSpell(p, o.card!, o.i); return; }
    if (o.s === '@learn') { yield* this.learnSpell(p, o.card!); return; }
    const nd = this.nest(o.s);
    if (nd || o.s === 'lair') { yield* this.placeFight(p, o); return; }
    const sp = this.space(o.s);
    if (!sp) throw new Error(`unknown space ${o.s}`);
    const used = this.useWorker(p, 1, this.whoFor(p, o) ?? undefined);
    sp.occ.push(p.pid);
    const cap = this.capOf(sp);
    if (cap > 0 && sp.occ.length > cap) p.ignoreFull = false;
    this.emit({ t: 'place', seat: p.pid, space: sp.id, companions: used, option: optLabel(o) });
    p.acts.push(`sp:${sp.id}`);
    if (o.i >= 0) p.lastSpace = { s: sp.id, i: o.i };
    if (sp.id === 'board') p.acts.push('board');
    if (sp.id === 'plaza') p.acts.push('plaza');
    const adv = this.is(p, 'explorer') && this.isAdventure(sp.id);
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
        // 採集家は集める量が倍、探検家は冒険マスの効果が倍
        const gm = (this.is(p, 'gatherer') ? D.LEADER.gatherer.mult : 1) * (adv ? D.LEADER.explorer.mult : 1);
        if (gm > 1) for (const r of Object.keys(got)) got[r as Res] = Math.floor((got[r as Res] ?? 0) * gm);
        sp.stock = {};
        gainRes(p, got);
        this.emit({ t: 'gather', seat: p.pid, space: sp.id, gain: got });
        this.actGain(p, got);
        p.acts.push('accum');
      }
      if (sp.def.shards) {
        const n = Math.floor((sp.shards ?? 0) * (adv ? D.LEADER.explorer.mult : 1));
        sp.shards = 0;
        p.acts.push('accum');
        if (n) yield* this.gainShards(p, n);
      }
      const eff = sp.optEffects?.[o.i];
      if (eff) this.markLimit(p, sp.id, o.i, eff.limit);
      // 「試合で1回」の名声は年数の倍率をかける（凱旋など）
      const fameScale = eff?.limit === 'game' ? D.POINT_SCALE[this.years] ?? 1 : undefined;
      // 探検家の倍：もう1人置ける・先手などは倍にしない（無限に置けてしまうので）
      // 倍率が整数でないとき（1.5倍など）は、数（資源・名声・引く枚数など）に倍率をかけて切り捨て、1回だけ行う
      const mult = adv ? D.LEADER.explorer.mult : 1;
      const reps = Number.isInteger(mult) ? mult : 1;
      for (let t = 0; t < reps; t++) {
        let ops = t === 0 ? sp.def.options[o.i] : sp.def.options[o.i].filter((op) => !op.extra_worker && !op.ignore_full && !op.place_again && !op.first);
        if (!Number.isInteger(mult)) ops = ops.map((op) => scaleOp(op, mult));
        if (ops.length) yield* this.runOps(p, ops, { space: sp.id, x: o.x, card: sp.stage, opIndex: o.i, ...(fameScale ? { fameScale } : {}) });
      }
    }
    yield* this.fire(p, `use:${sp.id}`, { space: sp.id });
    if (sp.def.accum) yield* this.fire(p, 'use:any_accum', { space: sp.id });
    if (this.isAdventure(sp.id) && sp.id !== 'plaza') yield* this.fire(p, 'use:adventure', { space: sp.id });
    for (const q of this.players) if (q !== p) yield* this.fire(q, `other:${sp.id}`, { space: sp.id });
  }

  /** k 人置く（prefer＝選んだ仲間。空いていれば先に使う） */
  useWorker(p: Player, k: number, prefer?: number[]): number[] {
    const fr = p.free();
    for (const i of [...(prefer ?? [])].reverse()) { const j = fr.indexOf(i); if (j >= 0) { fr.splice(j, 1); fr.unshift(i); } }
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
  /** 選んだ仲間（Option.who）が、その選択肢で使えるか。使えるならその並び、使えない・選んでいないなら null。
   *  マス：空いている（使っていない・休んでいない）仲間1人。戦闘：k 人、休み・負傷でなく、もう使った仲間は「もう1人置ける」の数まで */
  whoFor(p: Player, o: Option): number[] | null {
    const who = o.who;
    if (!Array.isArray(who) || o.s === '@spell') return null;
    const fight = !!this.nest(o.s) || o.s === 'lair';
    if (who.length !== (fight ? o.k ?? 1 : 1)) return null;
    let again = 0;
    for (let j = 0; j < who.length; j++) {
      const i = who[j], c = p.comps[i];
      if (!Number.isInteger(i) || !c || who.indexOf(i) !== j || c.rest || (fight && c.injured)) return null;
      if (c.used) { if (!fight) return null; again++; }
    }
    return again <= p.extra ? [...who] : null;
  }
  /** 戦闘に送る仲間（選んだ仲間か、戦力の高い順） */
  compsFor(p: Player, o: Option): number[] { return this.whoFor(p, o) ?? this.pickComps(p, o.k ?? 1); }
  /** 戦闘に送った仲間を使ったことにする */
  useComps(p: Player, idxs: number[]) {
    for (const i of idxs) { if (!p.comps[i].used) p.comps[i].used = true; else p.extra = Math.max(0, p.extra - 1); }
  }
  compPower(p: Player, i: number) {
    const c = p.comps[i];
    return D.POWER_PER + c.atk * this.skillMult(p) + (c.weapon ? (this.card(c.weapon).power ?? 0) * this.weaponMult(p) : 0);
  }
  /** 熟練の効き目（努力家は倍） */
  skillMult(p: Player) { return this.is(p, 'striver') ? D.LEADER.striver.skillMult : 1; }
  /** 武器の戦力の倍率（天才は倍） */
  weaponMult(p: Player) { return this.is(p, 'genius') ? D.LEADER.genius.weaponMult : 1; }

  /** 測定用の手順の印：得た資源の種類 */
  actGain(p: Player, c: Cost) {
    for (const [r, n] of Object.entries(c)) if ((n as number) > 0 && !p.acts.includes(r)) p.acts.push(r);
  }
  /** 払う（測定用に pay:<資源> の印をつける） */
  spend(p: Player, c: Cost) {
    payRes(p, c);
    for (const [r, n] of Object.entries(c)) if ((n as number) > 0 && !p.acts.includes(`pay:${r}`)) p.acts.push(`pay:${r}`);
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
          x = yield* this.askOne(p, xs, { k: 'pick', g: this, p, what: k, options: xs as Choice[] });
          xUsed = true;
        }
      }
      switch (k) {
        case 'gain': {
          const g = { ...op.gain! };
          const ty = ctx.card && this.byId.has(ctx.card) && this.card(ctx.card).kind === 'tool' ? this.mods(p).tool_yield : 0;
          if (ty) { const top = (Object.entries(g) as [Res, number][]).filter(([r]) => r !== 'gold').sort((a, b) => b[1] - a[1])[0]; if (top) g[top[0]] = top[1] + ty; }
          gainRes(p, g); this.emit({ t: 'gain', seat: p.pid, gain: g, reason: ctx.card ?? ctx.space ?? '' }); this.actGain(p, g); break;
        }
        case 'pay': if (!canPay(p, op.pay!)) return; this.spend(p, op.pay!); this.emit({ t: 'pay', seat: p.pid, cost: op.pay!, reason: ctx.card ?? ctx.space ?? '' }); break;
        case 'convert': {
          const cv = op.convert!;
          if (!canPay(p, cv.from)) break;
          this.spend(p, cv.from); gainRes(p, cv.to);
          this.emit({ t: 'pay', seat: p.pid, cost: cv.from, reason: 'convert' });
          this.emit({ t: 'gain', seat: p.pid, gain: cv.to, reason: 'convert' });
          this.actGain(p, cv.to);
          break;
        }
        case 'fame': { const f = Math.round(op.fame! * (ctx.fameScale ?? 1)); p.fame.effect += f; this.emit({ t: 'fame', seat: p.pid, amount: f, reason: ctx.card ?? '' }); p.acts.push('fame'); break; }
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
          const x = yield* this.askOne(p, xs, { k: 'pick', g: this, p, what: 'again', options: xs as Choice[] });
          yield* this.runOps(p, sub, { ...ctx, space: sp.id, opIndex: tgt.i, x, again: true });
          break;
        }
        case 'future': for (const r of op.future!.rounds) p.future.push({ round: this.round + r, gain: { ...op.future!.gain } }); break;
        case 'draw': yield* this.drawCards(p, op.draw!.from, op.draw!.look, op.draw!.take); break;
        case 'gain_pick': {
          const gp = op.gain_pick!;
          const xs = gp.from.map((r) => `res:${r}`);
          const got: Cost = {};
          for (let j = 0; j < gp.n; j++) {
            const x: string = yield* this.askOne(p, xs, { k: 'pick', g: this, p, what: 'gain_pick', options: xs });
            const r = x.slice(4) as Res;
            if (!gp.from.includes(r)) throw new Error('bad res');
            got[r] = (got[r] ?? 0) + 1;
          }
          gainRes(p, got);
          this.emit({ t: 'gain', seat: p.pid, gain: got, reason: ctx.card ?? ctx.space ?? '' });
          this.actGain(p, got);
          break;
        }
        case 'draw_any': {
          const from = op.draw_any!.from.filter((f) => this.decks[f].length > 0);
          if (!from.length) break;
          const f: string = yield* this.askOne(p, from, { k: 'pick', g: this, p, what: 'deck', options: from });
          if (!from.includes(f as never)) throw new Error('bad deck');
          yield* this.drawCards(p, f, op.draw_any!.look, op.draw_any!.take);
          break;
        }
        case 'power_per': {
          const pp = op.power_per!;
          buf.power += perValue(this.env(p, ctx.fenv).stat(pp.stat), pp);
          break;
        }
        case 'lose': {
          const lost: Cost = {};
          for (const [r, n] of Object.entries(op.lose!)) { const v = Math.min(p.res[r as Res], n as number); if (v > 0) { p.res[r as Res] -= v; lost[r as Res] = v; } }
          if (costUnits(lost)) this.emit({ t: 'pay', seat: p.pid, cost: lost, reason: ctx.card ?? '' });
          break;
        }
        case 'injure': {
          let n = op.injure!;
          for (let i = p.comps.length - 1; i >= 0 && n > 0; i--) {
            const c = p.comps[i];
            if (c.injured || c.rest) continue;
            c.injured = true; n--;
            this.emit({ t: 'injury', seat: p.pid, companion: i });
            yield* this.fire(p, 'injure', {});
          }
          break;
        }
        case 'scrap': {
          const id = typeof x === 'string' ? x : null;
          if (!id) break;
          const i = p.tools.indexOf(id);
          if (i < 0) break;
          p.tools.splice(i, 1);
          this.recycle(id);
          this.emit({ t: 'scrap', seat: p.pid, card: id });
          const per = op.scrap!.gain_per_cost;
          if (per) { const got = addCost({}, per, costUnits(this.card(id).cost ?? {})); if (costUnits(got)) { gainRes(p, got); this.emit({ t: 'gain', seat: p.pid, gain: got, reason: ctx.card ?? '' }); this.actGain(p, got); } }
          break;
        }
        case 'shard': yield* this.gainShards(p, op.shard!); break;
        case 'buy_card': {
          const bc = op.buy_card!;
          for (let j = 0; j < bc.count; j++) {
            if (p.res.gold < bc.price || !this.curio.length) break;
            const opts = j === 0 ? [...this.curio] : [...this.curio, 'skip'];
            const c: string = yield* this.askOne(p, opts, { k: 'card', g: this, p, why: 'curio', cards: opts, kind: 'curio' });
            if (c === 'skip' || !this.curio.includes(c)) break;
            p.res.gold -= bc.price;
            this.curio.splice(this.curio.indexOf(c), 1);
            p.hand.push(c); p.picked.push(c); p.acts.push('draw', 'pay:gold');
            this.emit({ t: 'pay', seat: p.pid, cost: { gold: bc.price }, reason: 'curio' });
            this.emit({ t: 'draw', seat: p.pid, card: c, from: 'curio' });
          }
          this.refillCurio();
          break;
        }
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
          // 戦わずに使い魔にする（獣だけ。食料を払う）
          let nd = ctx.nest ? this.nest(ctx.nest) : undefined;
          if (!nd) {
            const cand = this.nests.filter((n) => n.mon && this.canTame(n.mon) && canPay(p, this.captureCost(n.mon))).map((n) => n.id);
            if (!cand.length) break;
            const nid: string = yield* this.askOne(p, cand, { k: 'pick', g: this, p, what: 'tame', options: cand });
            nd = this.nest(nid);
          }
          if (!nd?.mon || !this.canTame(nd.mon) || !canPay(p, this.captureCost(nd.mon))) break;
          const mon = nd.mon;
          nd.mon = null;
          yield* this.addPet(p, mon);
          break;
        }
        case 'train': {
          const s = (x === 'atk' || x === 'def' ? x : op.train === 'any' ? 'atk' : op.train) as 'atk' | 'def';
          const cands = this.trainCands(p, s, !!op.fresh);
          if (!cands.length) break;
          // 誰を鍛えるかは本人が選ぶ（いちばん熟練の低い仲間が先頭＝お任せのときの答え）
          const idx = Number(String(yield* this.askOne(p, cands.map((i) => `tr:${i}`), { k: 'pick', g: this, p, what: `train:${s}`, options: cands.map((i) => `tr:${i}`) })).slice(3));
          if (!cands.includes(idx)) throw new Error('bad train target');
          p.comps[idx][s] += 1;
          p.acts.push('train');
          this.emit({ t: 'train', seat: p.pid, companion: idx, stat: s });
          this.autoEquip(p);
          break;
        }
        case 'build': {
          const what = typeof x === 'string' ? x : op.build;
          const d = op.discount ?? {};
          if (what === 'bed') { const c = this.goldPlan(p, this.bedCost(p, d)); if (!c) break; this.spend(p, c); p.beds += 1; this.emit({ t: 'build', seat: p.pid, kind: 'bed' }); }
          else if (what === 'wall') { const c = this.goldPlan(p, this.wallCost(p, d)); if (!c) break; this.spend(p, c); p.walls += 1; this.emit({ t: 'build', seat: p.pid, kind: 'wall' }); }
          else if (what && p.hand.includes(what) && this.card(what).kind === 'tool') {
            const c = this.goldPlan(p, this.cardCost(p, what, d));
            if (!c) break;
            this.spend(p, c);
            yield* this.playItem(p, what, true);
            if (this.is(p, 'crafter')) {
              this.leadFame(p, D.LEADER.crafter.fame, '職人');
              // 道具を作ったあと、山からランダムに look 枚の道具を見て1枚を手札に（回数の制限なし）
              if (this.decks.tool.length) yield* this.runOps(p, [{ draw: { from: 'tool', look: D.LEADER.crafter.look, take: 1 } }], {});
            }
          } else break;
          p.acts.push('build');
          yield* this.fire(p, 'build', {});
          break;
        }
        case 'craft': {
          const id = typeof x === 'string' ? x : null;
          if (!id) break;
          const c = this.goldPlan(p, this.cardCost(p, id));
          if (!c) break;
          const sn = this.stoneNeed(id, p);
          if (sn !== null && p.stones[sn] <= 0) break;
          this.spend(p, c);
          if (sn !== null) { p.stones[sn] -= 1; this.emit({ t: 'stone_use', seat: p.pid, tier: sn }); }
          if (this.card(id).kind === 'gear') {
            this.gearStock[id] -= 1;
            p.items.push(id);
            this.emit({ t: 'craft', seat: p.pid, card: id });
            yield* this.gotGear(p, id);
          } else yield* this.playItem(p, id, true);
          p.acts.push('craft');
          yield* this.fire(p, 'craft', {});
          break;
        }
        case 'occ': {
          const id = typeof x === 'string' ? x : null;
          if (!id) break;
          const c = this.goldPlan(p, this.occCost(p, id));
          if (!c) break;
          this.spend(p, c);
          yield* this.playOcc(p, id, true);
          p.acts.push('occ');
          yield* this.fire(p, 'occ', {});
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
            p.st.sold += 1;
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
          if (x.m === 'stone') {
            if (x.dir === 'sell') {
              if (p.stones[x.tier] <= 0) break;
              p.stones[x.tier] -= 1; p.res[x.r] += x.q;
              this.emit({ t: 'stone_use', seat: p.pid, tier: x.tier });
              this.emit({ t: 'gain', seat: p.pid, gain: { [x.r]: x.q }, reason: 'market' });
              this.actGain(p, { [x.r]: x.q });
            } else {
              if (p.res[x.r] < x.q) break;
              p.res[x.r] -= x.q; p.stones[x.tier] += 1;
              this.emit({ t: 'pay', seat: p.pid, cost: { [x.r]: x.q }, reason: 'market' });
            }
            p.acts.push('stone');
          }
          if (x.m === 'item') {
            const i = p.items.indexOf(x.id);
            if (i < 0 || !this.storage(p).includes(x.id)) break;
            p.items.splice(i, 1);
            const gold = this.itemSell(x.id);
            p.res.gold += gold;
            if (this.card(x.id).kind === 'gear') this.gearStock[x.id] = (this.gearStock[x.id] ?? 0) + 1;
            else this.recycle(x.id);
            this.emit({ t: 'market', seat: p.pid, kind: 'sell', res: x.id, qty: 1, gold });
            p.acts.push('sell');
            p.st.sold += 1;
            yield* this.fire(p, 'sell', {});
          }
          break;
        }
        case 'relic': if (this.decks.ancient.length) yield* this.drawCards(p, 'ancient', op.relic! + this.mods(p).ancient_look, op.relic!); break;
        case 'repair': {
          const rv = typeof x === 'string' ? this.repairOf(p, x) : null;
          const i = rv ? p.broken.indexOf(rv.id) : -1;
          if (!rv || i < 0 || !canPay(p, rv.cost)) break;
          this.spend(p, rv.cost);
          p.broken.splice(i, 1); p.ancient.push(rv.id);
          p.acts.push('repair');
          this.emit({ t: 'repair', seat: p.pid, card: rv.id, cost: rv.cost });
          yield* this.fire(p, 'repair', {});
          break;
        }
        case 'first': this.nextFirst = p.pid; break;
        case 'donate': {
          const dn = op.donate!;
          const rate = this.mods(p).donate_rate ?? {};
          const cost: Cost = {};
          for (const [r, n] of Object.entries(dn.pay)) cost[r as Res] = rate[r as Res] !== undefined ? Math.min(n as number, rate[r as Res]!) : (n as number);
          if (!canPay(p, cost)) break;
          this.spend(p, cost);
          p.fame.donate += dn.fame;
          p.st.donations += 1;
          p.acts.push('donate');
          this.emit({ t: 'donate', seat: p.pid, cost, fame: dn.fame });
          yield* this.fire(p, 'donate', {});
          break;
        }
        case 'heal': {
          let n = op.heal!;
          for (const c of p.comps) if (n > 0 && (c.injured || c.rest)) { c.injured = false; c.rest = false; n--; p.acts.push('heal'); this.emit({ t: 'heal', seat: p.pid, companion: p.comps.indexOf(c), cost: {} }); }
          break;
        }
        case 'steal_gain': gainRes(p, op.steal_gain!); this.emit({ t: 'gain', seat: p.pid, gain: op.steal_gain!, reason: ctx.card ?? 'other' }); break;
        case 'fame_per': {
          const fp = op.fame_per!;
          const n = Math.min(fp.max ?? Infinity, Math.floor(this.env(p, undefined, ctx.thScale ?? 1).stat(fp.stat) / fp.per + 1e-9));
          if (n <= 0) break;
          const f = Math.round(n * (ctx.fameScale ?? 1));
          p.fame.effect += f; this.emit({ t: 'fame', seat: p.pid, amount: f, reason: ctx.card ?? '' }); p.acts.push('fame');
          break;
        }
        case 'gain_per': {
          const gp = op.gain_per!;
          const n = Math.min(gp.max ?? Infinity, Math.floor(this.stat(p, gp.stat) / gp.per));
          if (n <= 0) break;
          const got = addCost({}, gp.gain, n);
          gainRes(p, got); this.emit({ t: 'gain', seat: p.pid, gain: got, reason: ctx.card ?? '' }); this.actGain(p, got);
          break;
        }
        case 'others_gain': for (const q of this.players) if (q !== p) { gainRes(q, op.others_gain!); this.emit({ t: 'gain', seat: q.pid, gain: op.others_gain!, reason: ctx.card ?? 'other' }); } break;
        case 'trade_bonus': p.tradesUsed -= op.trade_bonus!; break;
        case 'ward': p.ward += op.ward!; break;
        case 'accum_add': for (const s of this.spaces) if (s.def.accum) { const r = Object.keys(s.def.accum)[0] as Res; s.stock = addCost(s.stock, { [r]: op.accum_add! }); } break;
        default: throw new Error(`unknown op ${k}`);
      }
    }
  }

  /** 熟練を上げられる仲間（いちばん熟練の低い仲間が先頭。fresh：まだその熟練がない仲間だけ） */
  trainCands(p: Player, s: 'atk' | 'def', fresh = false): number[] {
    const out: number[] = [];
    if (s === 'atk' && this.mods(p).no_atk_train) return out;
    const cap = D.MAX_SKILL[s] + (this.is(p, 'striver') ? D.LEADER.striver.skillCap : 0) + this.mods(p).skill_cap;
    p.comps.forEach((c, i) => { if (c[s] < cap && (!fresh || c[s] === 0)) out.push(i); });
    return out.sort((a, b) => p.comps[a][s] - p.comps[b][s] || a - b);
  }

  /** when に合う効果をすべて実行する（pay・convert を含む効果は使うかどうか聞く） */
  *fire(p: Player, when: string, ctx: OpCtx, fight?: FightEnv, idxs?: number[]): Gen {
    for (const [card, ei, e] of this.effectsOf(p, when, fight, idxs, ctx.thScale ?? 1)) {
      const ops = e.do ?? [];
      if (!canPay(p, sumPays(ops))) continue;
      const conv = ops.find((o) => o.convert);
      if (conv && !canPay(p, addCost(sumPays(ops), conv.convert!.from))) continue;
      const xs = this.expand(p, ops);
      if (!xs.length) continue;
      const optional = ops.some((o) => o.pay || o.convert) || xs[0] !== undefined;
      if (optional) {
        const yes: boolean = yield* this.ask({ k: 'effect', g: this, p, card, when, ops, ei });
        if (!yes) continue;
      }
      const x = xs.length === 1 && xs[0] === undefined ? undefined : yield* this.askOne(p, xs, { k: 'pick', g: this, p, what: card, options: xs as Choice[] });
      this.markLimit(p, card, ei, e.limit);
      this.emit({ t: 'effect', seat: p.pid, card, when });
      for (let t = 0; t < this.effMult(p, card); t++) yield* this.runOps(p, ops, { ...ctx, card, x, ...(fight ? { fenv: fight } : {}) });
    }
  }
  /** 戦闘に勝ったときのリーダーの名声（努力家・魔術師・鉄壁ガレス・巨人狩り） */
  private *leadWin(p: Player, mon: Monster, pl: Plan, plans: Plan[], boss: boolean): Gen {
    const L = D.LEADER;
    if (this.is(p, 'striver')) this.leadFame(p, Math.floor(pl.idxs.reduce((a, i) => a + p.comps[i].atk + p.comps[i].def, 0) / L.striver.fameDiv), '修行の鬼ジン');
    if (this.is(p, 'mage')) p.st.mageWon = 1;
    if (this.is(p, 'shield')) this.leadFame(p, Math.floor(Math.max(0, this.defense(p, pl) - Math.max(0, mon.counter + pl.counter)) / L.shield.fameDiv), '鉄壁ガレス');
    if (this.is(p, 'giant') && boss && plans.every((q) => q === pl || q.power < pl.power)) this.leadFame(p, mon.type === D.ANCIENT_DRAGON.id ? L.giant.dragonFame : L.giant.bossFame, '巨人狩り');
  }
  /** 秘術を使ったあと（魔術師：マナ鉱石か秘術1枚。1ラウンド perRound 回まで） */
  private *mageAfter(p: Player): Gen {
    const L = D.LEADER.mage;
    if (!this.is(p, 'mage') || p.st.mageRound >= L.perRound) return;
    p.st.mageRound += 1;
    const x: string = this.decks.spell.length ? yield* this.ask({ k: 'pick', g: this, p, what: 'mage', options: ['mage:mana', 'mage:draw'] }) : 'mage:mana';
    if (x === 'mage:draw' && this.decks.spell.length) yield* this.runOps(p, [{ draw: { from: 'spell', look: L.draw, take: L.draw } }], {});
    else { const g: Cost = { mana: L.mana }; gainRes(p, g); this.emit({ t: 'gain', seat: p.pid, gain: g, reason: '連唱魔女ミナ' }); }
  }
  /** カードの効果を何回かけるか（天才：武器の効果は倍） */
  effMult(p: Player, card: string): number { return this.is(p, 'genius') && this.byId.has(card) && this.card(card).kind === 'weapon' ? D.LEADER.genius.effectMult : 1; }

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
    else if (c.kind === 'spell') { p.tomes.push(id); this.emit({ t: 'learn', seat: p.pid, card: id }); return; }
    else { p.items.push(id); this.emit({ t: 'craft', seat: p.pid, card: id }); }
    this.emit({ t: 'play_card', seat: p.pid, card: id });
    if (c.kind !== 'tool') yield* this.gotGear(p, id);
  }
  /** 秘術を唱える（手番に何枚でも）。身につけた秘術はカードごとの回数まで、使い切りは使ったあと山の下へ */
  *playSpell(p: Player, id: string, ei: number): Gen {
    const c = this.card(id);
    const e = c.effects[ei];
    const tome = !!c.tome && p.tomes.includes(id);
    if (!tome && !p.hand.includes(id)) return;
    const cost = this.manaPlan(p, this.cardCost(p, id), sumPays(e.do ?? []));
    if (!cost) return;
    this.spend(p, cost);
    if (costUnits(cost)) this.emit({ t: 'pay', seat: p.pid, cost: cleanCost(cost), reason: 'spell' });
    if (tome) p.tomeUses[id] = (p.tomeUses[id] ?? 0) + 1;
    else { p.hand.splice(p.hand.indexOf(id), 1); p.fame.card += c.fame ?? 0; }
    this.countCast(p);
    this.markLimit(p, id, ei, e.limit);
    this.emit({ t: 'spell', seat: p.pid, card: id });
    const xs = this.expand(p, e.do ?? []);
    const x = xs.length <= 1 ? xs[0] : yield* this.ask({ k: 'pick', g: this, p, what: id, options: xs as Choice[] });
    yield* this.runOps(p, e.do ?? [], { card: id, x, again: false });
    if (!tome) this.spentSpell(p, id);
    yield* this.fire(p, 'spell', {});
    yield* this.mageAfter(p);
  }
  private countCast(p: Player) { p.st.spells += 1; p.st.casts += 1; p.st.castsRound += 1; p.acts.push('spell'); }
  /** 使い切りの秘術を使い終えた：spell_return があればマナ鉱石1で手札に戻す（ラウンドにその枚数まで）、なければ山の下へ */
  private spentSpell(p: Player, id: string) {
    if (p.st.returns < this.mods(p).spell_return && p.res.mana >= 1) {
      p.res.mana -= 1; p.st.returns += 1; p.hand.push(id);
      this.emit({ t: 'pay', seat: p.pid, cost: { mana: 1 }, reason: 'spell_return' });
      return;
    }
    this.recycle(id);
  }
  /** 何度でもの秘術を身につける（身につける費用を払い、手札から出す） */
  *learnSpell(p: Player, id: string): Gen {
    const i = p.hand.indexOf(id);
    if (i < 0 || !this.card(id).tome) return;
    const cost = this.manaPlan(p, this.learnCost(p, id));
    if (!cost) return;
    this.spend(p, cost);
    if (costUnits(cost)) this.emit({ t: 'pay', seat: p.pid, cost: cleanCost(cost), reason: 'learn' });
    p.hand.splice(i, 1);
    p.tomes.push(id);
    p.fame.card += this.card(id).fame ?? 0;
    p.acts.push('learn');
    this.emit({ t: 'learn', seat: p.pid, card: id });
  }

  // ------------------------------------------------------------ 使い魔・遺物の欠片
  /** 捕まえる食料（強さ÷foodDiv の切り上げ） */
  captureCost(mon: Monster, p?: Player): Cost {
    // 餌付け師ハル：魔物ごとの好物を、強さに応じた数だけ
    const cut = p ? this.mods(p).fav_cut : 0;
    if (p && this.is(p, 'tamer')) return { [this.favRes(mon)]: Math.max(1, Math.ceil(mon.str / D.LEADER.tamer.favDiv) - cut) };
    return { food: Math.max(1, Math.ceil(mon.str / D.CAPTURE.foodDiv) - cut) };
  }
  /** 捕まえるのに要る戦力（残りの強さ＋格ごとの捕まえにくさ − capture_ease） */
  captureNeed(p: Player, mon: Monster): number {
    const g = D.MON[mon.type]?.grade ?? 0;
    return Math.max(1, mon.str - mon.wounds + (D.CAPTURE.ease[String(g)] ?? 2) - this.mods(p).capture_ease);
  }
  /** 使い魔の戦力（前の仕組み：1体につき1。pet_power で増える） */
  petPower(_str: number) { return 1; }
  /** 使い魔にできる魔物（獣だけ。主は除く） */
  canTame(mon: Monster) { return mon.race === 'beast' && !mon.boss; }
  /** 使い魔にする（食料を払う。持てる数を超えたらいちばん弱い使い魔を放す） */
  *addPet(p: Player, mon: Monster): Gen {
    const cost = this.captureCost(mon, p);
    if (!canPay(p, cost)) return;
    this.spend(p, cost);
    this.emit({ t: 'pay', seat: p.pid, cost, reason: 'tame' });
    const id = `pet_${mon.type}`;
    const pet: Pet = { type: mon.type, name: mon.name, str: mon.str, power: this.is(p, 'tamer') ? D.LEADER.tamer.petPower : this.petPower(mon.str), card: this.byId.has(id) ? id : '' };
    p.pets.push(pet);
    p.acts.push('tame');
    this.emit({ t: 'tame', seat: p.pid, monster: mon.type, power: pet.power });
    while (p.pets.length > Math.max(0, this.petCap(p))) {
      let w = 0;
      p.pets.forEach((x, i) => { if (x.power < p.pets[w].power) w = i; });
      const [r] = p.pets.splice(w, 1);
      this.emit({ t: 'release', seat: p.pid, monster: r.type });
    }
    yield* this.fire(p, 'tame', {});
  }
  /** 遺物の欠片を得る。そろうたびに遺物を引く（1+ancient_look 枚見て1枚） */
  *gainShards(p: Player, n: number): Gen {
    if (n <= 0) return;
    // 欠片はなくした（品物カードを作り直すまで、欠片をくれる効果は何もしない）
    if (n >= 0) return;
    p.shards += n;
    this.emit({ t: 'shards', seat: p.pid, amount: n, total: p.shards });
    const need = Math.max(1, 3 - this.mods(p).shard_need);
    while (p.shards >= need && this.decks.ancient.length) {
      p.shards -= need;
      yield* this.drawCards(p, 'ancient', 1 + this.mods(p).ancient_look, 1);
    }
  }

  *drawCards(p: Player, from: string, look: number, take: number): Gen {
    const decks: string[][] = from === 'item' ? [this.decks.weapon, this.decks.armor, this.decks.tool, this.decks.spell]
      : from === 'equip' ? [this.decks.weapon, this.decks.armor]
      : from === 'ancient' ? [this.decks.ancient] : [this.decks[from as 'occ' | ItemKind]];
    const pool: [string, string[]][] = [];
    if (decks.length > 1) {
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
      const c: string = yield* this.askOne(p, cards, { k: 'card', g: this, p, why: 'draw', cards, kind: from });
      const idx = cards.indexOf(c);
      if (idx < 0) throw new Error('bad draw');
      pool.splice(idx, 1);
      if (from === 'ancient') p.broken.push(c); else { p.hand.push(c); p.picked.push(c); }
      p.acts.push('draw');
      this.emit({ t: 'draw', seat: p.pid, card: p.pid === this.me || this.me < 0 || from === 'ancient' ? c : '?', from });
    }
    for (const [c, d] of pool) d.push(c);
    for (const d of decks) this.rng.shuffle(d);
  }

  /** 装備の持ち替え（無料）：武器は戦力の高い順に熟練の高い仲間へ、防具は守りの高い順に。
   *  AI の席だけ（人の席は自分で持たせる：gotGear の問いと、手番の equip） */
  autoEquip(p: Player) {
    if (!p.ai) return;
    const before = p.comps.map((c) => [c.weapon, c.armor]);
    for (const c of p.comps) { c.weapon = null; c.armor = null; }
    const items = [...p.items].map((id) => this.card(id));
    const weapons = items.filter((c) => slotOf(c) === 'weapon');
    const armors = items.filter((c) => slotOf(c) === 'armor');
    weapons.sort((a, b) => (b.power ?? 0) - (a.power ?? 0) || (a.id < b.id ? -1 : 1));
    armors.sort((a, b) => (b.guard ?? 0) - (a.guard ?? 0) || (a.id < b.id ? -1 : 1));
    const m = this.mods(p);
    const byAtk = p.comps.map((_, i) => i).sort((a, b) => p.comps[b].atk - p.comps[a].atk || a - b).filter((i) => !(m.leader_no_weapon && p.comps[i].leader));
    for (const w of weapons) {
      const cand = w.leader_only ? byAtk.filter((i) => p.comps[i].leader) : byAtk;
      const i = cand.find((j) => !p.comps[j].weapon);
      if (i !== undefined) p.comps[i].weapon = w.id;
    }
    const byDef = p.comps.map((_, i) => i).sort((a, b) => p.comps[b].def - p.comps[a].def || a - b);
    for (const a of armors) {
      const cand = a.leader_only ? byDef.filter((i) => p.comps[i].leader) : byDef;
      const i = cand.find((j) => !p.comps[j].armor && (m.two_hand_armor || !(p.comps[j].weapon && this.card(p.comps[j].weapon!).two_hand)));
      if (i !== undefined) p.comps[i].armor = a.id;
    }
    if (this.E) {
      p.comps.forEach((c, i) => {
        if (before[i]?.[0] !== c.weapon) this.emit({ t: 'equip', seat: p.pid, companion: i, slot: 'weapon', card: c.weapon });
        if (before[i]?.[1] !== c.armor) this.emit({ t: 'equip', seat: p.pid, companion: i, slot: 'armor', card: c.armor });
      });
    }
  }

  /** その装備を持てる仲間（空いている枠が先、次に熟練の高い順）。two_hand の武器を持つ仲間は防具を持てない、leader_only はリーダーだけ */
  equipTargets(p: Player, id: string): number[] {
    const cd = this.card(id), sl = slotOf(cd);
    if (!sl) return [];
    const sk = sl === 'weapon' ? 'atk' : 'def';
    const m = this.mods(p);
    return p.comps.map((_, i) => i)
      .filter((i) => {
        const c = p.comps[i];
        if (sl === 'weapon' && m.leader_no_weapon && c.leader) return false;
        if (sl === 'weapon' && this.is(p, 'giant') && !cd.two_hand) return false;
        return (!cd.leader_only || c.leader) && (m.two_hand_armor || !(sl === 'armor' && c.weapon && this.card(c.weapon).two_hand));
      })
      .sort((a, b) => +!!p.comps[a][sl] - +!!p.comps[b][sl] || p.comps[b][sk] - p.comps[a][sk] || a - b);
  }
  /** 持たせられないなら理由（持たせられるなら null）。id＝null ははずす。倉庫か、ほかの仲間の同じ枠から持ってくる */
  equipError(p: Player, ci: number, slot: 'weapon' | 'armor', id: string | null): string | null {
    const c = p.comps[ci];
    if (!c || (slot !== 'weapon' && slot !== 'armor')) return 'その仲間はいない';
    if (id === null) return c[slot] ? null : 'もう何も持っていない';
    if (typeof id !== 'string' || !this.byId.has(id) || slotOf(this.card(id)) !== slot) return 'その枠には持てない';
    if (c[slot] === id) return 'もう持っている';
    if (!this.storage(p).includes(id) && !p.comps.some((x, j) => j !== ci && x[slot] === id)) return '倉庫にない';
    if (!this.equipTargets(p, id).includes(ci)) return this.card(id).leader_only ? 'リーダーだけが持てる' : slot === 'weapon' && this.is(p, 'giant') ? '両手武器しか持てない' : slot === 'weapon' ? 'リーダーは武器を持てない' : '両手武器を持っていると防具は持てない';
    return null;
  }
  /** 持たせる・はずす・持ち替える（無料）。前に持っていたものは倉庫へ。two_hand の武器を持たせると防具は倉庫へ */
  equip(p: Player, ci: number, slot: 'weapon' | 'armor', id: string | null) {
    const err = this.equipError(p, ci, slot, id);
    if (err) throw new Error(err);
    const set = (j: number, s: 'weapon' | 'armor', v: string | null) => { p.comps[j][s] = v; this.emit({ t: 'equip', seat: p.pid, companion: j, slot: s, card: v }); };
    if (id !== null && !this.storage(p).includes(id)) set(p.comps.findIndex((x, j) => j !== ci && x[slot] === id), slot, null);
    set(ci, slot, id);
    if (id && slot === 'weapon' && this.card(id).two_hand && p.comps[ci].armor && !this.mods(p).two_hand_armor) set(ci, 'armor', null);
  }
  /** 装備を手に入れたとき：AI は自動で持ち替え、人には誰に持たせるか聞く（"eq:<仲間の番号>" か、倉庫に置く "eq:-"） */
  *gotGear(p: Player, id: string): Gen {
    if (p.ai) { this.autoEquip(p); return; }
    const sl = slotOf(this.card(id));
    if (!sl || !this.storage(p).includes(id)) return;
    // 同じ装備（共通の装備は同じ id が何枚もある）をもう持っている仲間には持たせない（equip が「もう持っている」で弾く）
    const to = this.equipTargets(p, id).filter((i) => p.comps[i][sl] !== id);
    if (!to.length) return;
    const x: string = yield* this.ask({ k: 'pick', g: this, p, what: `equip:${id}`, options: [...to.map((i) => `eq:${i}`), 'eq:-'] });
    const ci = typeof x === 'string' && /^eq:\d+$/.test(x) ? Number(x.slice(3)) : -1;
    if (to.includes(ci)) this.equip(p, ci, sl, id);
  }

  // ------------------------------------------------------------ 戦闘（§5・§6）
  fateMin(p: Player) { if (this.is(p, 'shield')) return 0; return p.fate.length ? Math.min(...p.fate) : Math.min(...D.FATE_DECK); }
  fateDist(p: Player): [number, number][] {
    if (this.is(p, 'shield')) return [[0, 1]];
    const deck = p.fate.length ? p.fate : D.FATE_DECK;
    const m = new Map<number, number>();
    for (const v of deck) m.set(v, (m.get(v) ?? 0) + 1 / deck.length);
    return [...m.entries()];
  }
  drawFate(p: Player): number {
    if (this.is(p, 'shield')) return 0;
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

  /** 送った仲間の戦闘の環境（攻めの熟練・武器の戦力の合計、守りを超える反撃の見込み） */
  fightEnv(p: Player, mon: Monster, idxs: number[], coop: boolean, boss: boolean): FightEnv {
    let atk = 0, wpow = 0;
    for (const i of idxs) { const c = p.comps[i]; atk += c.atk; wpow += c.weapon ? this.card(c.weapon).power ?? 0 : 0; }
    const base: FightEnv = { race: mon.race, coop, k: idxs.length, boss, atk, wpow, exposed: 0 };
    base.exposed = Math.max(0, mon.counter - this.defenseOf(p, idxs));
    return base;
  }

  /** 戦力・守り・後押しの計画（盤面は変えない）。need は運命なしで勝つのに要る戦力の目安 */
  makePlan(p: Player, mon: Monster, idxs: number[], mode: FightMode, coop: boolean, need: number, use?: string[]): Plan {
    const pl: Plan = { pid: p.pid, idxs, mode, power: 0, parts: [], guard: 0, counter: 0, loot: 0, trophy: 0, str: 0, noInj: 0, cost: {}, boosts: [], spells: [], used: [], tomeUse: {}, pets: [], rage: 0, keys: [] };
    for (const i of idxs) {
      const c = p.comps[i];
      const w = c.weapon ? this.card(c.weapon) : null;
      const v = D.POWER_PER + c.atk * this.skillMult(p) + (w?.power ?? 0) * this.weaponMult(p);
      pl.power += v;
      pl.parts.push({ kind: 'companion', label: `仲間${i + 1}`, value: v, seat: p.pid, ...(w ? { ref: w.id } : {}) });
    }
    const mods = this.mods(p);
    if (idxs.length) {
      pl.pets = this.bringPets(p);
      for (const j of pl.pets) {
        const pt = p.pets[j];
        const v = pt.power + mods.pet_power;
        pl.power += v;
        pl.parts.push({ kind: 'familiar', label: pt.name, value: v, seat: p.pid, ...(pt.card ? { ref: pt.card } : {}) });
      }
    }
    if (p.rage > 0) { pl.rage = p.rage; pl.power += p.rage; pl.parts.push({ kind: 'rage', label: '怒り', value: p.rage, seat: p.pid }); }
    const rb = p.rbuf;
    if (rb.power || rb.str || rb.counter || rb.guard || rb.noInj || rb.loot || rb.trophy) {
      pl.power += rb.power; pl.str += rb.str; pl.counter += rb.counter; pl.guard += rb.guard; pl.noInj += rb.noInj; pl.loot += rb.loot; pl.trophy += rb.trophy;
      if (rb.power) pl.parts.push({ kind: 'spell', label: '秘術', value: rb.power, seat: p.pid });
    }
    if (mods.power) { pl.power += mods.power; pl.parts.push({ kind: 'mod', label: 'カード', value: mods.power, seat: p.pid }); }
    const fenv = this.fightEnv(p, mon, idxs, coop, mon.boss);
    const env = this.env(p, fenv);
    // 自動で効く fight の効果（pay なし）
    const optional: { name: string; cost: Cost; ops: Op[]; card: string; e: number; spell: boolean; tome?: boolean }[] = [];
    for (const [card, ei, e] of this.effectsOf(p, 'fight', fenv, idxs)) {
      if (p.tomes.includes(card)) continue;
      const ops = e.do ?? [];
      const pays = sumPays(ops);
      if (costUnits(pays)) { optional.push({ name: card, cost: pays, ops: this.effMult(p, card) > 1 ? Array.from({ length: this.effMult(p, card) }, () => ops).flat() : ops, card, e: ei, spell: false }); continue; }
      const before = pl.power;
      for (let t = 0; t < this.effMult(p, card); t++) applyFightOps(pl, ops, env);
      pl.used.push(`${card}#${ei}`);
      if (pl.power !== before) pl.parts.push({ kind: 'card', label: this.card(card).name, value: pl.power - before, seat: p.pid, ref: card });
    }
    if (mode === 'guard') { pl.power += D.GUARD_MODE.power; pl.counter += D.GUARD_MODE.counter; pl.parts.push({ kind: 'mode', label: '守って戦う', value: D.GUARD_MODE.power, seat: p.pid }); }
    // 後押し（士気・傭兵・ポーション・払う効果・手札の秘術・身につけた秘術）
    for (let j = 0; j < idxs.length; j++) optional.push({ name: 'morale', cost: D.MORALE[0], ops: [{ power: D.MORALE[1] }], card: '', e: -1, spell: false });
    for (let j = 0; j < idxs.length; j++) optional.push({ name: 'merc', cost: D.MERC[0], ops: [{ power: D.MERC[1] }], card: '', e: -1, spell: false });
    optional.push({ name: 'potion', cost: D.POTION[0], ops: [{ power: D.POTION[1] }], card: '', e: -1, spell: false });
    const spellOk = (c: string, ei: number, e: Effect) => e.when === 'fight' && this.limitOk(p, c, ei, e.limit) && checkCond(e.if, env);
    for (const c of new Set(p.hand)) {
      // 参加者の写しでは他の席の手札は伏せてある（'?'）。主の巣に先に送った人の見込みを出すときに通る
      if (!this.byId.has(c)) continue;
      const cd = this.card(c);
      if (cd.kind !== 'spell' || cd.tome) continue;
      cd.effects.forEach((e, ei) => { if (spellOk(c, ei, e)) optional.push({ name: c, cost: addCost(this.cardCost(p, c), sumPays(e.do ?? [])), ops: e.do ?? [], card: c, e: ei, spell: true }); });
    }
    for (const c of new Set(p.tomes)) {
      const cd = this.card(c);
      const left = (cd.tome?.uses ?? 1) - (p.tomeUses[c] ?? 0);
      for (let u = 0; u < left; u++) cd.effects.forEach((e, ei) => { if (spellOk(c, ei, e)) optional.push({ name: c, cost: addCost(this.cardCost(p, c), sumPays(e.do ?? [])), ops: e.do ?? [], card: c, e: ei, spell: true, tome: true }); });
    }
    const keyOf = (o: (typeof optional)[number]) => (o.card ? `${o.card}#${o.e}` : o.name);
    const labelOf = (o: (typeof optional)[number]) => (o.card ? this.card(o.card).name : o.name === 'morale' ? '士気' : o.name === 'merc' ? '傭兵' : 'ポーション');
    const gainOf = (o: (typeof optional)[number]) => { const t: Plan = { ...pl, parts: [] }; t.power = 0; t.str = 0; applyFightOps(t, o.ops, env); return t.power - t.str; };
    pl.chips = optional.map((o) => ({ key: keyOf(o), name: o.name, label: labelOf(o), cost: o.cost, gain: gainOf(o), ...(o.card ? { card: o.card } : {}), spell: o.spell }));
    let chosen: (typeof optional)[number][] = [];
    let cost: Cost = {};
    if (use && mode !== 'wait') {
      // 自分で選んだ後押し（払えないもの・ないものは飛ばす）
      const left = [...optional];
      for (const key of use) {
        const j = left.findIndex((o) => keyOf(o) === key);
        if (j < 0) continue;
        const tot = addCost(cost, left[j].cost);
        if (!canPay(p, tot)) continue;
        cost = tot; chosen.push(left[j]); left.splice(j, 1);
      }
    } else {
      let target: number | null = null;
      if (mode === 'safe' || mode === 'wait' || mode === 'capture') target = need - this.fateMin(p) + pl.str;
      else if (mode === 'gamble') target = need - 1 + pl.str;
      if (target !== null && pl.power < target) {
        const cand = optional.map((o) => ({ o, g: gainOf(o) })).filter((x) => x.g > 0).sort((a, b) => costValue(a.o.cost) / a.g - costValue(b.o.cost) / b.g);
        const pick: typeof optional = [];
        let pw = pl.power;
        for (const c of cand) {
          if (pw >= target) break;
          const tot = addCost(cost, c.o.cost);
          if (!canPay(p, tot)) continue;
          cost = tot; pw += c.g; pick.push(c.o);
        }
        if (pw >= target || mode === 'safe' || mode === 'wait' || mode === 'capture') chosen = pick;
        else cost = {};
      }
      // 自動で選ぶとき（AI）：勝てる見込みなら秘術も使う。
      // 連唱魔女ミナは使った秘術ごとに名声とマナ鉱石が返るので、払える秘術は全部。ほかの人は守りを超える反撃があれば、反撃を下げる・守る秘術を1つ
      if (mode !== 'wait' && mode !== 'capture') {
        const won = pl.power + chosen.reduce((a, o) => a + gainOf(o), 0) >= (target ?? need - 1 + pl.str);
        const left = optional.filter((o) => o.spell && !chosen.includes(o));
        const exposed = Math.max(0, mon.counter - this.defenseOf(p, idxs));
        for (const o of left) {
          const mage = this.is(p, 'mage') && won;
          const shield = exposed > 0 && o.ops.some((op) => (op.counter ?? 0) < 0 || (op.guard ?? 0) > 0 || (op.no_injury ?? 0) > 0);
          if (!mage && !shield) continue;
          const tot = addCost(cost, o.cost);
          if (!canPay(p, tot)) continue;
          cost = tot; chosen.push(o);
          if (!mage) break;
        }
      }
    }
    for (const o of chosen) {
      const before = pl.power;
      applyFightOps(pl, o.ops, env);
      pl.boosts.push(o.name);
      pl.keys!.push(keyOf(o));
      if (o.tome) pl.tomeUse[o.card] = (pl.tomeUse[o.card] ?? 0) + 1;
      else if (o.spell) pl.spells.push(o.card);
      if (o.e >= 0) pl.used.push(`${o.card}#${o.e}`);
      pl.parts.push({ kind: o.spell ? 'spell' : o.card ? 'card' : 'boost', label: labelOf(o), value: pl.power - before, seat: p.pid, ...(o.card ? { ref: o.card } : {}) });
    }
    // 鉄壁ガレス：守りを戦力として数える
    if (this.is(p, 'shield') && idxs.length) {
      const v = (this.defenseOf(p, idxs) + pl.guard) * D.LEADER.shield.guardMult;
      pl.power += v; pl.parts.push({ kind: 'mod', label: '鉄壁ガレス（守り）', value: v, seat: p.pid });
    }
    // 巨人狩り：主・古竜には戦力 bossMult 倍
    if (this.is(p, 'giant') && mon.boss && pl.power > 0) {
      const v = pl.power * (D.LEADER.giant.bossMult - 1);
      pl.power += v; pl.parts.push({ kind: 'mod', label: '巨人狩り', value: v, seat: p.pid });
    }
    pl.cost = cost;
    return pl;
  }

  defenseOf(p: Player, idxs: number[]): number {
    let d = this.fightGuardBase(p);
    for (const i of idxs) { const c = p.comps[i]; d += D.GUARD_PER + c.def * this.skillMult(p) + (c.armor ? this.card(c.armor).guard ?? 0 : 0) + (c.weapon ? this.card(c.weapon).guard ?? 0 : 0); }
    return d;
  }
  defense(p: Player, pl: Plan): number { return this.defenseOf(p, pl.idxs) + pl.guard; }

  *placeFight(p: Player, o: Option): Gen {
    const idxs = this.compsFor(p, o);
    this.useComps(p, idxs);
    const nd0 = this.nest(o.s);
    if (nd0 && nd0.groups >= D.NEST_CAP) p.ignoreFull = false;
    for (const q of this.players) if (q !== p) yield* this.fire(q, 'other:nest', { nest: o.s });
    p.acts.push(`sp:${o.s === 'lair' ? 'lair' : 'nest'}`);
    this.emit({ t: 'place', seat: p.pid, space: o.s, companions: idxs, option: optLabel(o) });
    if (o.s === 'lair') { this.lairQ.push({ pid: p.pid, idxs, mode: o.mode ?? 'normal', ...(o.use ? { use: [...o.use] } : {}) }); return; }
    const nd = this.nest(o.s)!;
    nd.groups += 1;
    if (o.mode === 'capture' && this.is(p, 'tamer') && nd.mon) {
      const mon = nd.mon;
      for (const i of idxs) p.comps[i].used = true;
      nd.mon = null;
      yield* this.addPet(p, mon);
      yield* this.fire(p, 'use:nest', { nest: nd.id });
      return;
    }
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
      yield* this.fight(nd, [{ p: this.players[w.pid], idxs: w.idxs, mode: 'gamble' }, { p, idxs, mode: o.mode ?? 'normal', use: o.use }]);
    } else yield* this.fight(nd, [{ p, idxs, mode: o.mode ?? 'normal', use: o.use }]);
    yield* this.fire(p, 'use:nest', { nest: nd.id });
  }

  /** 巣の戦闘（1人か共闘の2人） */
  *fight(nd: NestSt, sides: { p: Player; idxs: number[]; mode: FightMode; use?: string[] }[]): Gen {
    const mon = nd.mon!;
    const coop = sides.length > 1;
    const capture = !coop && sides[0].mode === 'capture';
    const need0 = capture ? this.captureNeed(sides[0].p, mon) : mon.str - mon.wounds;
    const plans: Plan[] = [];
    let acc = 0;
    for (const s of sides) {
      const pl = this.makePlan(s.p, mon, s.idxs, s.mode, coop, need0 - acc, s.use);
      plans.push(pl);
      acc += pl.power;
    }
    const res = yield* this.resolve(mon, sides.map((s) => s.p), plans, false, capture ? need0 : undefined);
    if (res.win) nd.mon = null;
    else if (res.wounds) mon.wounds += res.wounds;
  }

  *resolveLair(): Gen {
    const boss = this.bossOf[this.round];
    if (!boss) return;
    // 主・古竜に参加しなかった人（巣に仲間を送らなかった人）は名声 −BOSS_ABSENT（勝ち負けによらない）
    const absent = this.players.filter((p) => !this.lairQ.some((e) => e.pid === p.pid));
    if (!this.lairQ.length) { this.failBoss(boss); this.absentPenalty(boss, absent); return; }
    const plans: Plan[] = [];
    let acc = 0;
    const ps = this.lairQ.map((e) => this.players[e.pid]);
    this.lairQ.forEach((e, j) => {
      const pl = this.makePlan(ps[j], boss, e.idxs, e.mode, this.lairQ.length > 1, boss.str - acc, e.use);
      plans.push(pl);
      acc += pl.power;
    });
    const res = yield* this.resolve(boss, ps, plans, true);
    if (!res.win) this.failBoss(boss);
    this.lairQ = [];
    this.absentPenalty(boss, absent);
  }
  private absentPenalty(boss: Monster, absent: Player[]) {
    const reason = boss.type === D.ANCIENT_DRAGON.id ? '古竜に参加しなかった' : '主に参加しなかった';
    for (const p of absent) { if (this.mods(p).no_absent) continue; p.fame.absent -= D.BOSS_ABSENT; this.emit({ t: 'fame', seat: p.pid, amount: -D.BOSS_ABSENT, reason }); }
  }
  private failBoss(boss: Monster) {
    this.bossFailedYear.add(this.year());
    if (!this.lairQ.length) this.fightLog.push({ round: this.round, t: this.t, kind: boss.type === D.ANCIENT_DRAGON.id ? 'dragon' : 'boss', str: boss.str, base: 0, total: 0, win: false, addons: 0, comps: 0, sides: 0, pids: [], tro: [], mode: 'skip' });
    if (boss.type === D.ANCIENT_DRAGON.id) {
      for (const p of this.players) { p.fame.dragon -= D.DRAGON.fail; this.emit({ t: 'fame', seat: p.pid, amount: -D.DRAGON.fail, reason: '古竜' }); }
    }
  }

  /** 戦闘の解決：払う → 運命 → 勝ち負け → 戦利品・証 → 反撃 */
  *resolve(mon: Monster, ps: Player[], plans: Plan[], boss: boolean, captureNeed?: number): Gen<{ win: boolean; wounds: number }> {
    const capture = captureNeed !== undefined;
    const coop = ps.length > 1;
    this.emit({ t: 'combat_start', nest: boss ? 'lair' : '', monster: { ...mon }, seats: ps.map((p) => p.pid), mode: plans[0].mode });
    let total = 0, strAdj = 0;
    ps.forEach((p, j) => {
      const pl = plans[j];
      this.spend(p, pl.cost);
      if (costUnits(pl.cost)) this.emit({ t: 'pay', seat: p.pid, cost: cleanCost(pl.cost), reason: 'fight' });
      for (const c of pl.spells) { const i = p.hand.indexOf(c); if (i < 0) continue; p.hand.splice(i, 1); this.countCast(p); p.fame.card += this.card(c).fame ?? 0; this.emit({ t: 'spell', seat: p.pid, card: c }); this.spentSpell(p, c); }
      for (const [c, n] of Object.entries(pl.tomeUse)) { p.tomeUses[c] = (p.tomeUses[c] ?? 0) + n; for (let u = 0; u < n; u++) this.countCast(p); this.emit({ t: 'spell', seat: p.pid, card: c }); }
      if (pl.rage) p.rage = 0;
      for (const u of pl.used) { const [c, e] = u.split('#'); this.markLimit(p, c, Number(e), this.card(c).effects[Number(e)]?.limit); }
      total += pl.power;
      strAdj += pl.str;
      p.st.fights += 1;
      if (!p.acts.includes('fight')) p.acts.push('fight');
    });
    for (let j = 0; j < ps.length; j++) {
      const n = plans[j].spells.length + Object.values(plans[j].tomeUse).reduce((a, k) => a + k, 0);
      for (let u = 0; u < n; u++) yield* this.mageAfter(ps[j]);
    }
    this.emit({ t: 'power', parts: plans.flatMap((pl) => pl.parts), total });
    // 運命：主の巣は全員が1枚ずつ、巣は置いた人（共闘なら待っていた人）が1枚
    const flips = boss ? ps : [ps[0]];
    for (const p of flips) { const v = this.drawFate(p); total += v; this.emit({ t: 'fate_flip', seat: p.pid, value: v }); }
    const strength = (capture ? captureNeed! : mon.str - mon.wounds) + strAdj;
    const win = total >= strength;
    this.fightLog.push({
      round: this.round, t: this.t, kind: mon.type === D.ANCIENT_DRAGON.id ? 'dragon' : boss ? 'boss' : 'nest', str: strength,
      base: plans.reduce((a, pl) => a + pl.power, 0), total, win, addons: plans.reduce((a, pl) => a + pl.boosts.length, 0),
      comps: plans.reduce((a, pl) => a + pl.idxs.length, 0), sides: ps.length, pids: ps.map((p) => p.pid), tro: ps.map(() => 0), mode: plans[0].mode,
    });
    const rec = this.fightLog[this.fightLog.length - 1];
    this.lastClash = { base: plans.reduce((a, pl) => a + pl.power, 0), strength, win };
    this.emit({ t: 'clash', total, strength, result: win ? 'win' : 'lose' });
    let wounds = 0;
    const totPow = Math.max(1, plans.reduce((a, pl) => a + Math.max(0, pl.power), 0));
    for (let j = 0; j < ps.length; j++) {
      const p = ps[j], pl = plans[j];
      const share = coop ? Math.max(0, pl.power) / totPow : 1;
      const fenv = this.fightEnv(p, mon, pl.idxs, coop, boss);
      if (win && capture) {
        rec.tro[j] = 0;
        p.st.wins += 1;
        p.acts.push('win', 'capture');
        yield* this.addPet(p, mon);
      } else if (win) {
        // 勝ったときの効果（loot / trophy を足すものもあるので先に）
        // 主・古竜は年数によらず数が決まっているので、主に勝ったときの名声は年数の倍率をかける
        yield* this.fire(p, 'win', { plan: pl, ...(boss ? { fameScale: D.POINT_SCALE[this.years] ?? 1 } : {}) }, fenv, pl.idxs);
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
        this.actGain(p, loot);
        if (costUnits(loot)) this.emit({ t: 'loot', seat: p.pid, gain: loot });
        // 証：倒した人数で等分（四捨五入・最低1）＋自分のカードの分。天才は倍
        const tro = Math.max(1, Math.round(mon.trophy / ps.length)) + pl.trophy;
        const bonusTro = this.is(p, 'genius') ? Math.floor(tro * (D.LEADER.genius.trophyMult - 1)) : 0;
        if (bonusTro) { const b0 = trophyFame(p.bonusTrophies); p.bonusTrophies += bonusTro; this.leadFame(p, trophyFame(p.bonusTrophies) - b0, '武器狂いアカネ'); }
        // 魔石：共闘は貢献（戦力）の割合、最低1
        const st = coop ? Math.max(1, Math.round(mon.stones * share)) : mon.stones;
        p.stones[mon.stoneTier] += st;
        rec.tro[j] = tro + bonusTro;
        // 討伐の証：数を足し、合計 ÷ fameDiv（四捨五入）の増えた分だけ名声（古竜も証。参加の名声 join は別）
        const before = trophyFame(p.trophies);
        p.trophies += tro;
        const tf = trophyFame(p.trophies) - before;
        p.fame.trophy += tf;
        if (mon.type === D.ANCIENT_DRAGON.id) p.fame.dragon += D.DRAGON.join;
        this.emit({ t: 'trophy', seat: p.pid, monster: mon.type, fame: tf + (mon.type === D.ANCIENT_DRAGON.id ? D.DRAGON.join : 0), trophies: tro, stones: st, stoneTier: mon.stoneTier });
        p.kills += 1;
        yield* this.leadWin(p, mon, pl, plans, boss);
        if (!p.races.includes(mon.race)) p.races.push(mon.race);
        if (boss) p.st.boss += 1;
        if (coop) { p.st.coop += 1; p.acts.push('coop'); }
        p.st.wins += 1;
        p.acts.push('win', `win:${mon.race}`);
        if (boss) p.acts.push('boss');
        if (boss) {
          // 主・古竜に勝った：好きな品物の山から見て1枚、主なら遺物も1枚
          yield* this.runOps(p, [{ gain: { food: D.BOSS_FOOD } }, { draw_any: { from: [...ITEM_KINDS], look: D.BOSS_DRAW, take: 1 } }], {});
          if (mon.type !== D.ANCIENT_DRAGON.id && this.decks.ancient.length) yield* this.drawCards(p, 'ancient', 1 + this.mods(p).ancient_look, 1);
        }
      } else p.acts.push('lose');
      // 反撃
      if (pl.idxs.length) {
        const amount = Math.max(0, mon.counter + pl.counter);
        const def = this.defense(p, pl);
        this.emit({ t: 'counter', amount, defense: def });
        const over = Math.max(0, amount - def);
        p.lastDmg = over;
        // 反撃を受けた（守りを超えた分は stat dmg）。hit の効果は負傷より先
        if (amount > 0) yield* this.fire(p, 'hit', { plan: pl }, { ...fenv, exposed: over }, pl.idxs);
        let inj = Math.max(0, over - pl.noInj);
        const rage = this.mods(p).rage;
        if (rage > 0 && inj > 0) { p.rage = Math.min(rage, p.rage + inj); inj = 0; }
        for (const i of [...pl.idxs].reverse()) {
          if (inj <= 0) break;
          if (p.comps[i].injured) continue;
          p.comps[i].injured = true;
          inj--;
          this.emit({ t: 'injury', seat: p.pid, companion: i });
          yield* this.fire(p, 'injure', {}, fenv, pl.idxs);
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
    // 詐欺師だけ：1種類ずつ・同じ価値・金貨 tradeMax 枚分まで（ほかの人どうしの取引に制限はない。相手の了承で決まる）
    if (this.is(a, 'swindler')) {
      const kinds = (c: Cost) => Object.values(c).filter((n) => n).length;
      const val = (c: Cost) => Object.entries(c).reduce((s, [r, n]) => s + D.VALUE[r as Res] * (n ?? 0), 0);
      if (kinds(give) !== 1 || kinds(get) !== 1) return '1種類ずつ';
      if (val(give) !== val(get)) return '同じ価値どうし';
      const mx = D.LEADER.swindler.tradeMax + this.mods(a).trade_max;
      if (val(give) > mx) return `金貨${mx}枚分まで`;
    }
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
  /** 共通の依頼を確かめる（人ごとに達成した数を返す。呼ぶ側が when 'quest' を出す）。
   *  同じときに条件を満たした人（主を共闘で倒した・同じ冬に満たした など）は同着：全員がその順位の名声を得る。
   *  次に達成する人は、同着の人数ぶん後の順位になる（例：2人が同着1番なら、次の人は3番目の名声） */
  checkQuests(ps: Player[]): number[] {
    const done = ps.map(() => 0);
    for (const q of this.quests) {
      if (q.done.length >= D.QUEST_FAME.length) continue;
      const qd = this.quest.get(q.id)!;
      const hit = ps.map((p, i) => [p, i] as const).filter(([p]) => !q.done.includes(p.pid) && checkCond(qd.need, this.env(p)));
      if (!hit.length) continue;
      const fame = D.QUEST_FAME[q.done.length];
      for (const [p, i] of hit) {
        q.done.push(p.pid);
        p.quests.push(q.id);
        p.fame.quest += fame;
        p.acts.push('quest');
        this.emit({ t: 'quest_done', seat: p.pid, quest: q.id, fame });
        done[i]++;
      }
    }
    return done;
  }
  /** 全員（手番の順）の依頼をいっしょに確かめる */
  *questsGen(ps: Player[] = this.turnOrder()): Gen {
    const n = this.checkQuests(ps);
    for (let i = 0; i < ps.length; i++) for (let j = 0; j < n[i]; j++) {
      // 依頼を達成した：職能か好きな品物の山から見て1枚
      yield* this.runOps(ps[i], [{ draw_any: { from: ['occ', ...ITEM_KINDS], look: D.QUEST_DRAW, take: 1 } }], {});
      yield* this.fire(ps[i], 'quest', {});
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

export interface OpCtx { fenv?: FightEnv; fameScale?: number; thScale?: number; space?: string; nest?: string; x?: Choice; card?: string; plan?: Plan; again?: boolean; opIndex?: number }

/** power_per の値：floor(数 / per) × mult（max まで） */
export function perValue(v: number, pp: { per: number; mult?: number; max?: number }): number {
  const n = Math.floor(v / pp.per + 1e-9) * (pp.mult ?? 1);
  return Math.round(pp.max !== undefined ? Math.min(pp.max, n) : n);
}

export function slotOf(c: CardDef): 'weapon' | 'armor' | null {
  if (c.slot) return c.slot;
  if (c.kind === 'weapon') return 'weapon';
  if (c.kind === 'armor') return 'armor';
  if (c.kind === 'gear') return (c.power ?? 0) > 0 ? 'weapon' : (c.guard ?? 0) > 0 ? 'armor' : null;
  return null;
}

function newComp(leader: boolean): Comp { return { atk: 0, def: 0, weapon: null, armor: null, leader, injured: false, rest: false, used: false }; }

export function sumPays(ops: Op[]): Cost {
  let c: Cost = {};
  for (const o of ops) if (o.pay) c = addCost(c, o.pay);
  return c;
}

function applyFightOps(pl: Plan, ops: Op[], env?: CondEnv) {
  for (const o of ops) {
    if (o.power) pl.power += o.power;
    if (o.power_per && env) pl.power += perValue(env.stat(o.power_per.stat), o.power_per);
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
  trophy: '討伐の証', stone: '魔石', quest: '依頼', secret: '秘密依頼', donate: '寄進', ancient: '古代の品', card: 'カード', effect: '効果', dragon: '古竜', absent: '主・古竜に不参加',
  comps: '仲間', kinds: '4種の品物', gold: '金貨', discontent: '不満', raid: '襲撃', leader: 'リーダー',
};

/** 修復した遺物の名声の合計（壊れた遺物は0点） */
export function ancientScore(g: Game, p: Player): number {
  return p.ancient.reduce((a, id) => a + (g.anc.get(id)?.fame ?? 0), 0);
}

export function tableScore(v: number, th: number[]): number {
  let pts = -1;
  th.forEach((x, i) => { if (v >= x) pts = i + 1; });
  return pts;
}

export function scoreBreakdown(g: Game, p: Player): Record<string, number> {
  const b: Record<string, number> = {
    trophy: p.fame.trophy, quest: p.fame.quest, secret: 0, donate: p.fame.donate, ancient: Math.round(ancientScore(g, p) * (D.ANCIENT_SCALE[g.years] ?? 1)), card: p.fame.card,
    effect: p.fame.effect, dragon: p.fame.dragon, absent: p.fame.absent, stone: stoneFame(p),
  };
  const sc = D.POINT_SCALE[g.years] ?? 1;
  if (p.secret) { const q = g.quest.get(p.secret); if (q && checkCond(q.need, g.env(p))) b.secret = Math.round((q.fame ?? D.SECRET_FAME) * sc); }
  const th = D.tableFor(g.years);
  const vals: Record<string, number> = {
    kills: p.kills, races: p.races.length, weapons: g.stat(p, 'weapons'), armors: g.stat(p, 'armors'), tools: p.tools.length, spells: p.st.casts,
    walls: p.walls, occs: p.occs.length, pets: p.pets.length,
  };
  for (const [k, t] of Object.entries(th)) { const v = tableScore(vals[k] ?? 0, t); b[`table_${k}`] = v > 0 ? Math.round(v * sc) : v; }
  b.kinds = g.kinds(p) >= 4 ? Math.round(D.FOUR_KINDS_FAME * sc) : 0;
  b.comps = Math.round(p.comps.length * D.FAME_PER_COMP * sc);
  const m = g.mods(p);
  b.gold = goldFame(p.res.gold, g.years, m.gold_cap, m.gold_div);
  b.discontent = -p.discontent * D.DISCONTENT;
  b.raid = -p.raidLoss;
  b.leader = p.fame.leader + leaderEndFame(g, p);
  return b;
}
/** 試合の終わりのリーダーの名声（探検家・自宅警備員・詐欺師・成金ミロ） */
export function leaderEndFame(g: Game, p: Player): number {
  const L = D.LEADER;
  if (g.is(p, 'explorer')) return p.ancient.length * L.explorer.ancientFame;
  if (g.is(p, 'guard')) { const w = p.walls * L.guard.wallFame; return w + (p.st.blocked <= L.guard.lowBlocked ? w * (L.guard.lowMult - 1) : 0); }
  if (g.is(p, 'swindler')) return p.st.trades * L.swindler.fame;
  if (g.is(p, 'merchant')) return Math.floor(p.res.gold / L.merchant.goldDiv);
  return 0;
}
/** 金貨の名声：GOLD_PER_FAME 枚で1点、上限なし。gold_div で割る */
export function goldFame(gold: number, _years = 0, _capAdd = 0, div = 1): number {
  return Math.floor(Math.floor(gold / D.GOLD_PER_FAME) / Math.max(1, div));
}
export function score(g: Game, p: Player): number {
  return Object.values(scoreBreakdown(g, p)).reduce((a, n) => a + n, 0);
}
/** 魔石の名声：段階ごとに 数 × STONE.fame */
export function stoneFame(p: Player): number { return p.stones.reduce((a, n, i) => a + n * (D.STONE.fame[i] ?? 0), 0); }
/** 操作の数（得る資源・名声・引く枚数など）に倍率をかけて切り捨てる。払うもの・もう1人置けるなどはそのまま */
function scaleOp(op: Op, m: number): Op {
  const f = (n: number) => Math.floor(n * m);
  const fc = (c: Cost) => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, f(v as number)])) as Cost;
  const o: Op = { ...op };
  if (o.gain) o.gain = fc(o.gain);
  if (o.convert) o.convert = { from: o.convert.from, to: fc(o.convert.to) };
  for (const k of ['fame', 'relic', 'heal', 'loot', 'trophy', 'hire', 'hire_free'] as const) if (typeof o[k] === 'number' && (o[k] as number) > 0) (o as any)[k] = f(o[k] as number);
  if (o.draw) o.draw = { ...o.draw, take: f(o.draw.take), look: Math.max(o.draw.look, f(o.draw.take)) };
  if (o.gain_per) o.gain_per = { ...o.gain_per, gain: fc(o.gain_per.gain) };
  if (o.future) o.future = { ...o.future, gain: fc(o.future.gain) };
  return o;
}

/** 討伐の証の名声：合計 ÷ TROPHY.fameDiv（四捨五入） */
export function trophyFame(n: number): number { return Math.round(n / D.TROPHY.fameDiv + 1e-9); }
