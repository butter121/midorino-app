// 霧谷の冒険者団 v2 — 型の約束（カードデータ・エンジン・画面の共通）。SPEC.md §8 の形をそのまま型にしたもの。
// カードデータ（cards/*.ts）はこのファイルだけを import して書く。形は変えない（足すときは任意のフィールドで足す）。

// ------------------------------------------------------------ 基本
export type Res = 'wood' | 'iron' | 'herb' | 'mana' | 'food' | 'gold' | 'mat';
export type Cost = Partial<Record<Res, number>>;
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type Element = 'fire' | 'ice' | 'thunder' | 'light' | 'dark';
export type Race = 'beast' | 'spirit' | 'undead' | 'humanoid' | 'dragon';
export const RES: Res[] = ['wood', 'iron', 'herb', 'mana', 'food', 'gold', 'mat'];
export const RACES: Race[] = ['beast', 'spirit', 'undead', 'humanoid', 'dragon'];
export const ELEMENTS: Element[] = ['fire', 'ice', 'thunder', 'light', 'dark'];

/** 強い動き（engine タグ） */
export type EngineTag =
  | 'hunt' | 'gather' | 'trade' | 'fort' | 'smith' | 'family' | 'arcane' | 'beast' | 'quest' | 'ally' | 'ruins' | 'boss' | 'bridge';
export const ENGINES: EngineTag[] = ['hunt', 'gather', 'trade', 'fort', 'smith', 'family', 'arcane', 'beast', 'quest', 'ally', 'ruins', 'boss', 'bridge'];

/** 効果の型 */
export type Mech = 'boost' | 'instead' | 'combat' | 'accrue' | 'convert' | 'social' | 'endfame' | 'action';

export type CardKind = 'occ' | 'weapon' | 'armor' | 'tool' | 'spell' | 'leader' | 'gear' | 'stage' | 'ancient' | 'quest';

// ------------------------------------------------------------ 効果 DSL（§8）
/**
 * いつ効くか。
 * - `use:<space>` そのマスを使ったあと（`nest`＝どの巣でも、`any_accum`＝たまるマスのどれか）。段階カードのマスでは `use` だけでもよい（＝そのマス）
 * - `instead:<space>` そのマスに置いたとき、通常の効果の代わりに選べる
 * - `fight` / `win` / `lose` / `win_race:<race>`
 * - `round_start` / `round_end` / `winter` / `game_end` / `setup`（準備段階の終わりに1回。リーダーの始めの持ち物など）
 * - `build` / `hire` / `craft` / `sell` / `buy` / `trade` / `donate` / `spell` / `tame`
 * - `occ`（ギルドなどで職能を出した）/ `quest`（共通の依頼を達成した）
 * - `other:<space>` 他の人がそのマスを使ったとき
 * - `play` 秘術：手番の前に手札から使う（使い切り）
 * - `passive` 常に効く修正（do の代わりに mod）
 */
export type When =
  | `use:${string}` | 'use'
  | `instead:${string}`
  | 'fight' | 'win' | 'lose' | `win_race:${Race}`
  | 'round_start' | 'round_end' | 'winter' | 'game_end' | 'setup'
  | 'build' | 'hire' | 'craft' | 'sell' | 'buy' | 'trade' | 'donate' | 'spell' | 'tame'
  | 'occ' | 'quest'
  | `other:${string}`
  | 'play'
  | 'passive';

/** 数で見る条件の対象（min / max に使う） */
export type StatKey =
  | 'comps' | 'occs' | 'walls' | 'beds' | 'facilities' | 'gear' | 'pets' | 'kills' | 'races' | 'trophies'
  | 'hand' | 'ancient' | 'quests' | 'skills' | 'injured' | 'boss' | 'coop' | 'weak' | 'spells' | 'donations' | 'trades'
  | 'year' | 'round';

/** 効果の条件（すべて満たしたら効く）。知らないキーはエンジンが例外にする */
export interface Cond {
  season?: Season | Season[];
  min?: Partial<Record<StatKey, number>>;
  max?: Partial<Record<StatKey, number>>;
  /** 戦闘中：相手の種族 */
  race?: Race | Race[];
  /** 戦闘中：共闘（待ち伏せに加わった／加えた、主の巣に複数人） */
  coop?: boolean;
  /** 戦闘中：送った仲間の数がこれ以上 */
  k_min?: number;
  /** 戦闘中：送った仲間の数がこれ以下（一騎打ちなど） */
  k_max?: number;
  /** 戦闘中：主（古竜を含む） */
  boss?: boolean;
  /** 戦闘中：弱点を突いている */
  weak?: boolean;
  /** そのカードを持っている（出した職能・建てた道具・装備・リーダー） */
  has?: string;
  res_min?: Cost;
  /** 進み具合 t（0〜1）がこれ以上 */
  t_min?: number;
  t_max?: number;
}

/** 効果の手順（do の1要素は、このうち1つのキーだけを持つ） */
export interface Op {
  gain?: Cost;
  pay?: Cost;
  convert?: { from: Cost; to: Cost };
  fame?: number;
  // ---- 戦闘中だけ
  power?: number;
  guard?: number;
  counter?: number;
  loot?: number;
  trophy?: number;
  str?: number;
  no_injury?: number;
  // ---- 手番
  extra_worker?: number;
  place_again?: boolean;
  ignore_full?: boolean;
  future?: { rounds: number[]; gain: Cost };
  draw?: { from: 'occ' | 'item' | 'weapon' | 'tool' | 'spell' | 'ancient'; look: number; take: number };
  hire?: number;
  hire_free?: number;
  tame?: boolean;
  train?: 'atk' | 'def' | 'any';
  build?: 'wall' | 'bed' | 'facility' | 'any';
  /** build のときの値引き */
  discount?: Cost;
  heal?: number;
  steal_gain?: Cost;
  // ---- エンジンが足したもの（SPEC.md 実装メモ）
  /** 装備を1つ作る（weapon＝武具カードか共通の武器、armor＝防具、any） */
  craft?: 'weapon' | 'armor' | 'any';
  /** 手札の職能を1枚出す（ギルド。費用は食料1、2枚目から2。mod occ_discount で下がる） */
  occ?: number;
  /** 交換所で売るか買う（1種類、最大 market_qty 個） */
  exchange?: boolean;
  /** 先手になる */
  first?: boolean;
  /** 寄進：pay を払って fame を得る（donate_rate で値引き、donate の効果が効く） */
  donate?: { pay: Cost; fame: number };
  // ---- v2 拡張（カード 270 枚化で足したもの）
  /** 数に応じた名声：floor(stat / per) 点（max まで）。game_end では年数の倍率がかかる */
  fame_per?: { stat: StatKey; per: number; max?: number };
  /** 数に応じた資源：gain × floor(stat / per)（max 回まで） */
  gain_per?: { stat: StatKey; per: number; gain: Cost; max?: number };
  /** 他の人全員が得る（施し・おすそ分け。軽い対人） */
  others_gain?: Cost;
}

/** passive の修正（mod）。知らないキーはエンジンが例外にする */
export interface Mod {
  market_qty?: number;
  market_both?: boolean;
  trade_count?: number;
  accum_bonus?: Partial<Record<string, number>>;
  cost_discount?: { kind: 'weapon' | 'armor' | 'tool' | 'spell' | 'occ' | 'gear' | 'bed' | 'wall' | 'any'; res: Cost };
  upkeep?: number;
  donate_rate?: Cost;
  base_guard?: number;
  pet_power?: number;
  hand_limit?: number;
  // ---- エンジンが足したもの
  /** 戦闘のたびに戦力（fight の power と同じ。条件なしで足したいとき） */
  power?: number;
  /** 回復の薬草を安く */
  heal_discount?: number;
  /** 売値を上げる（1個あたり） */
  sell_bonus?: number;
  /** 寝床の数を足す（寝床として数える） */
  bed_cap?: number;
}

export interface Effect {
  when: When;
  if?: Cond;
  do?: Op[];
  mod?: Mod;
  limit?: 'round' | 'year' | 'game' | null;
}

export interface Prereq {
  occs?: number;
  comps?: number;
  walls?: number;
  facilities?: number;
  kills?: number;
  has?: string;
}

/** カード（職能・武具・防具・道具・秘術・リーダー・共通の装備・段階カード） */
export interface CardDef {
  id: string;
  kind: CardKind;
  name: string;
  engine: EngineTag[];
  mech: Mech;
  cost?: Cost;
  prereq?: Prereq;
  fame?: number;
  slot?: 'weapon' | 'armor' | null;
  two_hand?: boolean;
  /** 後衛：反撃の対象にならない */
  rear?: boolean;
  leader_only?: boolean;
  power?: number;
  guard?: number;
  /** 'any' は属性を選べる（魔石の杖） */
  el?: Element | 'any' | null;
  vs_race?: Race | null;
  effects: Effect[];
  /** passive の修正の短縮形（effects に {when:'passive', mod} を書くのと同じ） */
  mods?: Mod;
  /** 交換所の売値（金貨）。無ければ費用の半分 */
  sell?: number;
  text: string;
}

/** 共通の装備（§5 の表） */
export interface GearDef extends CardDef {
  kind: 'gear';
  /** 作る場所 */
  place: 'forge' | 'training';
  /** 4人での数（3人は−1、5〜6人は+1） */
  count: number;
}

/** 段階カード（新しい行動マスになる） */
export interface StageDef extends CardDef {
  kind: 'stage';
  stage: 1 | 2 | 3 | 4 | 5;
  /** 定員（省略は1。0は定員なし） */
  cap?: number;
  /** たまるマスなら毎ラウンド足すもの */
  accum?: Cost;
  // effects の `use` / `use:<自分の id>` は「このマスでできること」。複数あれば選択肢（どれか1つ）
}

/** 古代の品（4種×各3枚） */
export interface AncientDef {
  id: string;
  kind: 'ancient';
  name: string;
  /** 種類（4種） */
  group: string;
  /** 枚数（省略は3） */
  copies?: number;
  text: string;
}

/** 依頼（共通は先着 4・3・2、秘密は fame） */
export interface QuestDef {
  id: string;
  kind: 'quest';
  name: string;
  secret: boolean;
  /** 秘密依頼の名声（4〜6） */
  fame?: number;
  /** 達成の条件（Cond の min / max / res_min / has を使う） */
  need: Cond;
  text: string;
}

/** カード一式（エンジンに渡す） */
export interface CardSet {
  leaders: CardDef[];
  occupations: CardDef[];
  weapons: CardDef[];
  tools: CardDef[];
  spells: CardDef[];
  gear: GearDef[];
  stages: StageDef[];
  quests: QuestDef[];
  ancient: AncientDef[];
}

// ------------------------------------------------------------ 魔物・行動マス（エンジン側のデータ）
export interface MonsterType {
  id: string;
  name: string;
  race: Race;
  weak: Element | null;
  /** 戦利品の種類（個数はくじで決まり、ここに並べた順に配る） */
  loot: Res[];
  /** 格（−1/0/+1、主は+3） */
  grade: number;
}

/** 盤上に出た魔物（くじで数値が決まったもの） */
export interface Monster {
  uid: number;
  type: string;
  name: string;
  race: Race;
  weak: Element | null;
  str: number;
  counter: number;
  loot: Cost;
  trophy: number;
  raid: number;
  boss: boolean;
  /** 出た年（冬の襲撃の対象） */
  year: number;
  wounds: number;
}

export interface SpaceDef {
  id: string;
  name: string;
  accum?: Cost;
  /** 定員（省略1、0＝無制限） */
  cap?: number;
  min_p?: number;
  /** 置いたときにすること（どれか1つを選ぶ。1つなら選ぶ必要なし） */
  options: Op[][];
}

// ------------------------------------------------------------ 出来事（画面はこれを見る）
export type Seat = number;
export type FightMode = 'normal' | 'safe' | 'gamble' | 'chip' | 'wait' | 'guard';

export interface PowerPart { kind: string; label: string; value: number; seat?: Seat; ref?: string }

export interface ScoreItem { key: string; label: string; fame: number }
export interface ScoreRow { seat: Seat; items: ScoreItem[]; total: number; rank: number }

export type GameEvent =
  | { t: 'game_start'; players: { seat: Seat; name: string }[]; me: Seat; years: number; rounds: number; spaces: string[]; nests: string[]; quests: string[] }
  | { t: 'first_player'; seat: Seat }
  | { t: 'leader_offer'; seat: Seat; cards: string[] }
  | { t: 'leader_pick'; seat: Seat; card: string }
  | { t: 'draft_offer'; seat: Seat; kind: string; cards: string[] }
  | { t: 'draft_pick'; seat: Seat; kind: string; card: string }
  | { t: 'ratio'; seat: Seat; ratio: Record<string, number> }
  | { t: 'secret_quest'; seat: Seat; quest: string }
  | { t: 'grant'; seat: Seat; gain: Cost; reason: string }
  | { t: 'round_start'; round: number; year: number; season: Season; progress: number; first: Seat }
  | { t: 'stage_reveal'; card: string; stage: number }
  | { t: 'refill'; adds: Record<string, Cost> }
  | { t: 'future'; seat: Seat; gain: Cost }
  | { t: 'equip'; seat: Seat; companion: number; slot: 'weapon' | 'armor'; card: string | null }
  | { t: 'monster_spawn'; nest: string; monster: Monster }
  | { t: 'monster_forecast'; monsters: Monster[] }
  | { t: 'boss_reveal'; boss: Monster; round: number }
  | { t: 'turn'; seat: Seat }
  | { t: 'place'; seat: Seat; space: string; companions: number[]; option: string }
  | { t: 'gather'; seat: Seat; space: string; gain: Cost }
  | { t: 'gain'; seat: Seat; gain: Cost; reason: string }
  | { t: 'pay'; seat: Seat; cost: Cost; reason: string }
  | { t: 'effect'; seat: Seat; card: string; when: string }
  | { t: 'play_card'; seat: Seat; card: string }
  | { t: 'spell'; seat: Seat; card: string }
  | { t: 'craft'; seat: Seat; card: string }
  | { t: 'build'; seat: Seat; kind: 'bed' | 'wall' | 'facility'; card?: string }
  | { t: 'hire'; seat: Seat; companion: number }
  | { t: 'train'; seat: Seat; companion: number; stat: 'atk' | 'def' }
  | { t: 'market'; seat: Seat; kind: 'buy' | 'sell'; res: Res | string; qty: number; gold: number }
  | { t: 'trade'; a: Seat; b: Seat; give: Cost; get: Cost }
  | { t: 'donate'; seat: Seat; cost: Cost; fame: number }
  | { t: 'draw'; seat: Seat; card: string; from: string }
  | { t: 'combat_start'; nest: string; monster: Monster; seats: Seat[]; mode: FightMode }
  | { t: 'power'; parts: PowerPart[]; total: number }
  | { t: 'fate_flip'; seat: Seat; value: number }
  | { t: 'clash'; total: number; strength: number; result: 'win' | 'lose' }
  | { t: 'counter'; amount: number; defense: number }
  | { t: 'injury'; seat: Seat; companion: number }
  | { t: 'heal'; seat: Seat; companion: number; cost: Cost }
  | { t: 'loot'; seat: Seat; gain: Cost }
  | { t: 'trophy'; seat: Seat; monster: string; fame: number }
  | { t: 'tame'; seat: Seat; monster: string }
  | { t: 'wait'; seat: Seat; nest: string }
  | { t: 'combat_end' }
  | { t: 'winter_start' }
  | { t: 'upkeep'; seat: Seat; need: number; paid: number; discontent: number }
  | { t: 'raid'; seat: Seat; damage: number; blocked: number }
  | { t: 'winter_end' }
  | { t: 'quest_done'; seat: Seat; quest: string; fame: number }
  | { t: 'fame'; seat: Seat; amount: number; reason: string }
  | { t: 'first_pass'; seat: Seat }
  | { t: 'round_end'; round: number }
  | { t: 'score'; rows: ScoreRow[] }
  | { t: 'game_end' };

export type EventType = GameEvent['t'];
