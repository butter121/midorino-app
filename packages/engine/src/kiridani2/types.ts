// 霧谷の冒険者団 v2 — 型の約束（カードデータ・エンジン・画面の共通）。SPEC.md §8 の形をそのまま型にしたもの。
// カードデータ（cards/*.ts）はこのファイルだけを import して書く。形は変えない（足すときは任意のフィールドで足す）。

// ------------------------------------------------------------ 基本
export type Res = 'wood' | 'iron' | 'herb' | 'mana' | 'food' | 'gold' | 'mat';
export type Cost = Partial<Record<Res, number>>;
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type Race = 'beast' | 'spirit' | 'undead' | 'humanoid' | 'dragon';
export const RES: Res[] = ['wood', 'iron', 'herb', 'mana', 'food', 'gold', 'mat'];
export const RACES: Race[] = ['beast', 'spirit', 'undead', 'humanoid', 'dragon'];

/** 強い動き（engine タグ） */
export type EngineTag =
  | 'hunt' | 'gather' | 'trade' | 'fort' | 'smith' | 'family' | 'arcane' | 'beast' | 'quest' | 'ally' | 'ruins' | 'boss' | 'bridge';
export const ENGINES: EngineTag[] = ['hunt', 'gather', 'trade', 'fort', 'smith', 'family', 'arcane', 'beast', 'quest', 'ally', 'ruins', 'boss', 'bridge'];

/** 効果の型 */
export type Mech = 'boost' | 'instead' | 'combat' | 'accrue' | 'convert' | 'social' | 'endfame' | 'action';

export type CardKind = 'occ' | 'weapon' | 'armor' | 'tool' | 'spell' | 'leader' | 'gear' | 'stage' | 'ancient' | 'quest' | 'pet';

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
 * - `play` 秘術：手番の前に手札から使う（使い切りは捨てる、tome の秘術は身につけたあと何度でも）
 * - `hit` 反撃で負傷する分（反撃−守り）が1以上だった（stat `dmg` がその値）
 * - `injure` 仲間が負傷した（1人ごと）
 * - `passive` 常に効く修正（do の代わりに mod）
 */
export type When =
  | `use:${string}` | 'use'
  | `instead:${string}`
  | 'fight' | 'win' | 'lose' | `win_race:${Race}`
  | 'round_start' | 'round_end' | 'winter' | 'game_end' | 'setup'
  | 'build' | 'hire' | 'craft' | 'sell' | 'buy' | 'trade' | 'donate' | 'spell' | 'tame'
  | 'occ' | 'quest' | 'hit' | 'injure'
  | `other:${string}`
  | 'play'
  | 'passive';

/** 数で見る条件の対象（min / max に使う） */
export type StatKey =
  | 'comps' | 'occs' | 'walls' | 'beds' | 'facilities' | 'gear' | 'pets' | 'kills' | 'races' | 'trophies'
  | 'hand' | 'ancient' | 'quests' | 'skills' | 'injured' | 'boss' | 'coop' | 'spells' | 'donations' | 'trades'
  | 'year' | 'round'
  // ---- 再設計で足したもの
  /** 持たせた武器・防具の数、建てた道具の数、身につけた秘術の数、唱えた回数（使い切り＋何度でも） */
  | 'weapons' | 'armors' | 'tools' | 'tomes' | 'casts'
  /** 遺物の欠片、使っている品物の種類（武器・防具・道具・秘術のうち 0〜4）、売った回数、金貨 */
  | 'shards' | 'kinds' | 'sold' | 'gold'
  /** 仲間の攻め・守りの熟練の合計 */
  | 'atk' | 'def'
  /** 直前の反撃で負傷する分（hit の効果の中で） */
  | 'dmg'
  /** 戦闘中だけ：送った仲間の攻めの熟練の合計・武器の戦力の合計・人数、守りを超える反撃（守りが足りない分） */
  | 'sent_atk' | 'sent_wpow' | 'sent_k' | 'exposed'
  /** このラウンドに唱えた回数 */
  | 'casts_round';

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
  draw?: { from: 'occ' | 'item' | 'equip' | 'weapon' | 'armor' | 'tool' | 'spell' | 'ancient'; look: number; take: number };
  hire?: number;
  hire_free?: number;
  tame?: boolean;
  train?: 'atk' | 'def' | 'any';
  /** train のとき：まだその熟練がない仲間（0）だけ、1段階目だけ上げる（若手の訓練） */
  fresh?: boolean;
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
  // ---- 再設計で足したもの
  /** 戦闘中：数に応じた戦力 floor(stat / per) × mult（max まで。mult は省略 1、負もよい） */
  power_per?: { stat: StatKey; per: number; mult?: number; max?: number };
  /** 資源を失う（足りなければあるだけ） */
  lose?: Cost;
  /** 自分の仲間を負傷させる（負傷していない仲間から） */
  injure?: number;
  /** 建てた道具を1つ壊す（山の下へ戻る）。gain_per_cost：壊した道具の費用1つにつき得るもの */
  scrap?: { gain_per_cost?: Cost; card?: string };
  /** 遺物の欠片を得る */
  shard?: number;
  /** 掘り出し市：並んだ品物から count 枚まで、1枚 price 金貨で手札に */
  buy_card?: { count: number; price: number };
  /** 山を選んでから引く（look 枚見て take 枚。from は選べる山） */
  draw_any?: { from: ('occ' | 'weapon' | 'armor' | 'tool' | 'spell')[]; look: number; take: number };
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
  // ---- 再設計で足したもの
  /** 費用を上げる（cost_discount の逆） */
  cost_extra?: { kind: 'weapon' | 'armor' | 'tool' | 'spell' | 'occ' | 'gear' | 'bed' | 'wall' | 'any'; res: Cost };
  /** 使い魔を持てる数（基本3） */
  pet_cap?: number;
  /** 戦闘に連れて行ける使い魔の数（基本1） */
  pet_bring?: number;
  /** 捕まえにくさを下げる */
  capture_ease?: number;
  /** 魔石の代わりに金貨を払える（魔石1につき金貨この数） */
  gold_mana?: number;
  /** 終わりの金貨の名声の上限を足す（5年の値。年数の倍率がかかる） */
  gold_cap?: number;
  /** 終わりの金貨の名声を割る（2＝半分） */
  gold_div?: number;
  /** 売値＝買値 */
  sell_full?: boolean;
  /** 遺物1枚に要る欠片の数を減らす（基本3） */
  shard_need?: number;
  /** 遺物を引くとき余分に見る枚数 */
  ancient_look?: number;
  /** 使い切りの秘術を唱えたあと、魔石1で手札に戻せる（ラウンドにこの枚数まで） */
  spell_return?: number;
  /** 仲間の上限を変える（負で減る） */
  comp_cap?: number;
  /** 職能を出す食料を足す */
  occ_food?: number;
  /** 両手武器を持っても防具を持てる */
  two_hand_armor?: boolean;
  /** 反撃で負傷しない。負傷する分を「怒り」としてため、次の戦闘で戦力に足す（rage まで） */
  rage?: number;
  /** 攻めの熟練を上げられない */
  no_atk_train?: boolean;
  /** 道具の効果で資源を得るとき、いちばん多い資源を1つ多く得る */
  tool_yield?: number;
  /** 武器を持てるのはリーダー以外 */
  leader_no_weapon?: boolean;
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
  leader_only?: boolean;
  /** リーダーの種類：戦闘（fight）か探索（explore）。準備では1人に1枚ずつ見せる */
  role?: 'fight' | 'explore';
  power?: number;
  guard?: number;
  /** 何度でも使える秘術：手札から learn を払って身につけ、そのあとは cost（唱える費用）を払えば1手番に uses 回まで使える */
  tome?: { learn: Cost; uses: number };
  /** 重さ（点検とAI用。light / mid / heavy / curse） */
  weight?: 'light' | 'mid' | 'heavy' | 'curse';
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
  place: 'forge';
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

/** 古代の品（遺物。5種×各4枚） */
export interface AncientDef {
  id: string;
  kind: 'ancient';
  name: string;
  /** 種類（5種） */
  group: string;
  /** 枚数（省略は4） */
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
  armors: CardDef[];
  tools: CardDef[];
  spells: CardDef[];
  /** 使い魔（魔物の型ごと。id は pet_<型>） */
  pets: CardDef[];
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
  /** たまるマス：毎ラウンド足す遺物の欠片 */
  shards?: number;
  /** 定員（省略1、0＝無制限） */
  cap?: number;
  /** 4人以上のときの定員 */
  cap4?: number;
  min_p?: number;
  /** 置いたときにすること（どれか1つを選ぶ。1つなら選ぶ必要なし） */
  options: Op[][];
}

// ------------------------------------------------------------ 出来事（画面はこれを見る）
export type Seat = number;
export type FightMode = 'normal' | 'safe' | 'gamble' | 'chip' | 'wait' | 'guard' | 'capture';

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
  | { t: 'trophy'; seat: Seat; monster: string; fame: number; trophies?: number }
  | { t: 'tame'; seat: Seat; monster: string; power?: number }
  | { t: 'release'; seat: Seat; monster: string }
  | { t: 'learn'; seat: Seat; card: string }
  | { t: 'shards'; seat: Seat; amount: number; total: number }
  | { t: 'curio'; cards: string[] }
  | { t: 'scrap'; seat: Seat; card: string }
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
