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
  | 'occ' | 'quest' | 'hit' | 'injure' | 'repair'
  /** 運命カードをめくったあと（引き直しなど）・仲間の熟練が上がったとき（その仲間の装備だけが効く）・手番の前に使えるカードの行動 */
  | 'fate' | 'trained' | 'act'
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
  | 'casts_round'
  /** 壊れたままの遺物の数・直前の冬に防いだ襲撃・持っている資源の合計（金貨を除く） */
  | 'broken' | 'blocked' | 'res_total'
  /** 使い魔の種類の数・同じ種類の使い魔のいちばん多い数・このラウンドに戦った回数・戦闘中：送った仲間の守りの合計 */
  | 'pet_types' | 'pet_same' | 'fights_round' | 'sent_guard';

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
  /** 自分の印（flag の op でつけたもの）がある */
  flag?: string;
  /** 直前の自分の戦闘に勝った（true）／負けた・まだ戦っていない（false） */
  last_win?: boolean;
  /** 使ったマスがこれではない（use:any の効果で使う） */
  space_not?: string;
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
  /** 壊れた遺物を1つ修復する（費用は遺物ごと） */
  repair?: boolean;
  /** 遺物の山から n 枚引く（壊れた状態で手元に） */
  relic?: number;
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
  /** 好きな資源を n 個（1つずつ選ぶ。同じ種類でもよい） */
  gain_pick?: { n: number; from: Res[] };
  /** このラウンドに取引をあと n 回できる */
  trade_bonus?: number;
  /** この冬の襲撃の守り +n */
  ward?: number;
  /** すべてのたまるマスに資源を1つずつ足す */
  accum_add?: number;
  draw_any?: { from: ('occ' | 'weapon' | 'armor' | 'tool' | 'spell')[]; look: number; take: number };
  // ---- 300枚のリストで足したもの（リストの効果をそのまま動かすため）
  /** build のとき：費用の上乗せ（突貫大工の2つ目） */
  surcharge?: Cost;
  /** build のとき：費用のいちばん多い資源を n 個足す（工房長の2つ目） */
  extra_units?: number;
  /** 自分に印をつける（k の数を n 足す。max まで）。`r:` で始まる印はラウンドの始めに消える */
  flag?: { k: string; n?: number; max?: number };
  /** 戦闘中：送った仲間の武器の効果（戦闘・勝ったとき）をもう一度起こす */
  weapon_again?: boolean;
  /** 運命カードを引き直す（fate の効果） */
  refate?: boolean;
  /** 武器1本に戦力+1の印（1本に max まで） */
  mark_weapon?: number;
  /** 勝ったとき：送った仲間全員の熟練+1（攻めか守りを選ぶ） */
  train_sent?: boolean;
  /** trained の効果：上がった熟練を、ほかの仲間1人にも同じだけ */
  train_copy?: boolean;
  /** 戦闘中：仲間1人の熟練+n（この戦闘だけ。戦力に熟練の倍率がかかる） */
  skill_boost?: number;
  /** 仲間1人の熟練（攻め・守り）を、もう1人に写す（高いほうに合わせる。下がらない） */
  skill_copy?: boolean;
  /** 戦闘中：共闘の相手の守りを自分の守りにも足す */
  ally_guard?: boolean;
  /** tame の効果：使い魔にした魔物の戦利品も受け取る */
  loot_tamed?: boolean;
  /** 巣の魔物1体に印をつける（ほかの人はその魔物と戦えない） */
  reserve?: boolean;
  /** 戦闘中（主）：ほかの人の戦力を半分として数える（戦利品・魔石の分け方と、主を倒した手柄） */
  hog?: boolean;
  /** 名声 n 以下の壊れた遺物1つを費用なしで修復する */
  repair_free?: number;
  /** 遺物を look 枚見て1枚取り、すぐに費用 −cut で修復できる */
  relic_fix?: { look: number; cut: number };
  /** 遺物の山の上 n 枚を見て、好きな順に並べ替える */
  relic_sort?: number;
  /** 使ったたまるマスに、資源を n 個置いて残す（山から） */
  accum_seed?: number;
  /** ほかのたまるマス1つから資源を n 個取る */
  accum_take?: number;
  /** マス1つをこのラウンド、ほかの人が使えないようにする（accum＝たまるマスだけ） */
  block?: 'accum' | 'any';
  /** ほかの人1人の手札を見て、1枚を山に戻させる */
  peek_discard?: boolean;
  /** ほかの人1人は次のラウンド交換所を使えない */
  market_ban?: boolean;
  /** 好きな資源を n 個払う（1つずつ選ぶ） */
  pay_pick?: { n: number; from: Res[] };
  /** 印の数 × mult の名声（max まで） */
  fame_flag?: { k: string; mult: number; max?: number };
  /** 建てた道具1つを複製する */
  dup_tool?: boolean;
  /** このラウンド（round）か、次に起きるまで、when のときに do をする */
  later?: { when: string; do: Op[]; round?: boolean };
  /** 投資：去年預けた金貨を rate 倍（切り捨て）で受け取り、今年の分を預ける */
  invest?: number;
  /** 金貸し：ほかの人1人に amt を貸す。rounds ラウンド後に back を返す（返せなければ名声 −fame） */
  lend?: { amt: number; back: number; rounds: number; fame: number };
  /** 勝ったとき：戦利品を価値の表どおりに金貨で受け取れる */
  loot_gold?: boolean;
  /** このラウンド、価値の表で好きな1つの価値+1 */
  value_up?: boolean;
  /** このラウンド、好きな資源1種類を交換所で買えるのは自分だけ */
  buy_ban?: boolean;
  /** 取引で受け取ったのがこの資源なら、さらに1つ */
  trade_skim?: Res[];
}

/** passive の修正（mod）。知らないキーはエンジンが例外にする */
export interface Mod {
  market_qty?: number;
  market_both?: boolean;
  trade_count?: number;
  accum_bonus?: Partial<Record<string, number>>;
  cost_discount?: { kind: 'weapon' | 'armor' | 'tool' | 'spell' | 'occ' | 'gear' | 'bed' | 'wall' | 'two_hand' | 'any'; res: Cost };
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
  /** マナ鉱石の代わりに金貨を払える（マナ鉱石1につき金貨この数） */
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
  /** 使い切りの秘術を唱えたあと、マナ鉱石1で手札に戻せる（ラウンドにこの枚数まで） */
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
  // ---- 300枚のリストで足したもの
  /** 熟練の上限 +n */
  skill_cap?: number;
  /** 作るときの魔石の段階を1つ下げる（weapon・armor・two_hand） */
  stone_down?: 'weapon' | 'armor' | 'two_hand';
  /** 1回に送れる仲間 +n */
  send_cap?: number;
  /** 使い魔にする費用（好物・食料）−n（最低1） */
  fav_cut?: number;
  /** 遺物の修復の費用 −n（減らす資源は選ぶ） */
  repair_cut?: number;
  /** 冬の襲撃の守り +n（戦闘の守りには入らない） */
  home_guard?: number;
  /** 冒険のまとまりのマスに、ほかの人がいても置ける */
  adv_free?: boolean;
  /** 全員の冬の襲撃を倍にする（切り捨て） */
  raid_mult?: number;
  /** 溜め込みポポ：年の終わりの名声で資源を +n として数える */
  hoard_bonus?: number;
  /** 溜め込みポポ：年の終わりの名声の割る数をこれにする */
  hoard_div?: number;
  /** 主・古竜に参加しなくても減点なし */
  no_absent?: boolean;
  /** 押し売りモモ：1回の取引の上限 +n */
  trade_max?: number;
  /** 冬の食料を金貨 n 枚で1つの代わりに払える */
  winter_gold?: number;
  // ---- 300枚のリストをそのまま動かすために足したもの
  /** 仲間1人が軽い武器を2本まで持てる */
  dual_light?: boolean;
  /** これを着た仲間は武器を1本多く持てる（着た仲間だけ） */
  wear_weapon2?: boolean;
  /** 仲間1人が軽い防具をもう1つ着られる */
  dual_armor_light?: boolean;
  /** 熟練を上げるときの食料を薬草で払える */
  train_herb?: boolean;
  /** これを着た仲間は、休みでも訓練のマスに置ける（着た仲間だけ） */
  rest_train?: boolean;
  /** ラウンドで最初に使う秘術の費用 −n */
  first_spell_cut?: number;
  /** 仲間1人をマスに置かずに休ませると得るもの（1ラウンド1回） */
  rest_gain?: Cost;
  /** 秘術のマナ鉱石を薬草で払える（マナ鉱石1＝薬草 n） */
  herb_mana?: number;
  /** 好物1つを、好物でない資源 n 個で払える */
  fav_alt?: number;
  /** 使い魔にするとき好物の数 −n（1ラウンド1回） */
  fav_cut_round?: number;
  /** 巣で、次に出る魔物と入れ替えて戦える（次の魔物を見て選ぶ） */
  nest_peek?: boolean;
  /** 主も使い魔にできる（好物は n 倍。古竜は除く） */
  boss_tame?: number;
  /** 両手武器の戦力 +n */
  two_hand_power?: number;
  /** 修復の費用の素材1つを金貨 n で払える */
  repair_gold?: number;
  /** 防壁 n つとして数える */
  wall_count?: number;
  /** 取引で出す資源を1つ少なくできる（1ラウンド1回） */
  trade_cut?: number;
  /** 交換所で魔石を買うとき n 安い */
  stone_buy_cut?: number;
  /** ほかの人がいるマスにも置け、その人と取引を1回する（1ラウンド1回） */
  squeeze?: boolean;
  /** 負傷を治す薬草1つを金貨 n で払える */
  heal_gold?: number;
  /** 交換所の交換で受け取る数 +n（1ラウンド1回） */
  market_plus?: number;
  /** ほかの人が、金貨を払って価値の表どおりに資源を買える（取引とは別枠） */
  stall?: boolean;
  /** 自分だけが使えるマス（そのマスと同じことができる。1ラウンド1回） */
  own_space?: string;
}

export interface Effect {
  when: When;
  if?: Cond;
  do?: Op[];
  mod?: Mod;
  /** round2＝2ラウンドに1回 */
  limit?: 'round' | 'round2' | 'year' | 'game' | null;
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
  /** 0＝始めから盤面にある場所。1〜5＝その段階でめくる */
  stage: 0 | 1 | 2 | 3 | 4 | 5;
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
  /** 種類（4種） */
  group: string;
  /** 枚数（省略は1） */
  copies?: number;
  /** 修復したときの名声（試合の終わり） */
  fame: number;
  /** 修復の費用 */
  repair: Cost;
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
  /** 落とす魔石の数と段階（0 初級・1 中級・2 上級。戦闘が終わるまで見えない） */
  stones: number;
  stoneTier: number;
  raid: number;
  boss: boolean;
  /** 出た年（冬の襲撃の対象） */
  year: number;
  wounds: number;
}

export interface SpaceDef {
  id: string;
  name: string;
  /** このマスでできること（画面の説明） */
  text?: string;
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
/** 装備の枠（weapon2・armor2 は2本目・2つ目） */
export type Slot = 'weapon' | 'armor' | 'weapon2' | 'armor2';
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
  | { t: 'equip'; seat: Seat; companion: number; slot: Slot; card: string | null }
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
  | { t: 'trade'; a: Seat; b: Seat; give: Cost; get: Cost; /** 押し売りモモ：渡した魔石の段階（0〜2）。give のかわり */ stone?: number }
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
  | { t: 'trophy'; seat: Seat; monster: string; fame: number; trophies?: number; stones?: number; stoneTier?: number }
  | { t: 'stone_use'; seat: Seat; tier: number }
  | { t: 'repair'; seat: Seat; card: string; cost: Cost }
  | { t: 'tame'; seat: Seat; monster: string; power?: number }
  | { t: 'release'; seat: Seat; monster: string }
  | { t: 'learn'; seat: Seat; card: string }
  | { t: 'shards'; seat: Seat; amount: number; total: number }
  | { t: 'curio'; cards: string[] }
  | { t: 'scrap'; seat: Seat; card: string }
  | { t: 'wait'; seat: Seat; nest: string }
  | { t: 'combat_end' }
  /** 手札の1枚を山に戻させられた */
  | { t: 'discard'; seat: Seat; card: string }
  /** カードの効果で起きたこと（ふさいだマス・印・貸し付けなど。ログ用） */
  | { t: 'note'; seat: Seat; card: string; text: string }
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
