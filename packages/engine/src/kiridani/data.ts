// 霧谷の冒険者団 — ゲームデータ（Python 版 data.py の写し。数値は v0.1 の仮値で、エンジン側の調整に合わせて更新する）
// data.py から機械的に写したもの（tools/kiridani_data_to_ts.py）。id は data.py と完全に同じ（エンジン・絵の差し替えとも id で対応づける）。
/* eslint-disable */

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type Element = 'fire' | 'ice' | 'thunder' | 'light' | 'dark';
export type Res = 'wood' | 'iron' | 'herb' | 'mana' | 'food' | 'gold' | 'mat';
export type Race = 'beast' | 'spirit' | 'undead' | 'humanoid' | 'dragon';
export type Cost = Partial<Record<Res, number>>;

export interface ActionSpaceDef { id: string; name: string; accum?: Cost; give?: Cost; unlimited?: boolean; from_round?: number; min_p?: number }
export interface MonsterDef { id: string; name: string; year: number; str: number; counter: number; weak: Element | null; race: Race; loot: Cost; trophy: number; raid: number }
export interface CharacterDef { id: string; name: string; role: string; tags: string[] }
export interface OccupationDef { id: string; name: string; kind: 'occ'; tags: string[]; text: string; chars: string[]; quirk: boolean }
export type ItemKind = 'weapon' | 'tool' | 'spell';
export interface ItemDef { id: string; name: string; kind: ItemKind; tags: string[]; cost: Cost; fame: number; text: string; chars: string[]; quirk: boolean; power?: number; el?: Element; defense?: number; ironw?: boolean }
export type CardDef = OccupationDef | ItemDef;

export const NUM_ROUNDS = 12;
export const START_COMPANIONS = 2;
export const MAX_COMPANIONS = 5;
export const START_BEDS = 3;
export const BASE_PLOTS = 12;
export const START_FOOD = 3;
export const START_GOLD = 2;
export const UPKEEP = 2;
export const DISCONTENT = 3;
export const HIRE_FOOD = 2;
export const POWER_PER = 2;
export const MAX_SKILL = 2;
export const WEAKNESS_BONUS = 2;
export const TIDE_BONUS = 1;
export const NEST_CAP = 2;
export const FAME_PER_COMPANION = 2;
export const HERO_BONUS = 3;
export const GOLD_PER_FAME = 4;
export const MARKET_SPAN = 3;
export const MARKET_QTY = 3;
export const DRAGON_FAIL = 3;
export const SEASONS: Season[] = ["spring", "summer", "autumn", "winter"];
export const SEASON_JP: Record<Season, string> = {"spring": "春", "summer": "夏", "autumn": "秋", "winter": "冬"};
export const TIDE: Record<Season, Element> = {"spring": "thunder", "summer": "fire", "autumn": "light", "winter": "ice"};
export const ELEMENTS: Element[] = ["fire", "ice", "thunder", "light", "dark"];
export const EL_JP: Record<Element, string> = {"fire": "炎", "ice": "氷", "thunder": "雷", "light": "光", "dark": "闇"};
export const RES: Res[] = ["wood", "iron", "herb", "mana", "food", "gold", "mat"];
export const RES_JP: Record<Res, string> = {"wood": "木材", "iron": "鉄", "herb": "薬草", "mana": "魔石", "food": "食料", "gold": "金貨", "mat": "素材"};
export const SEAT_FOOD: Record<number, number[]> = {"3": [0, 1, 1], "4": [0, 1, 1, 2], "5": [0, 1, 1, 2, 2], "6": [0, 1, 1, 2, 2, 3]};
export const BED_COST: Cost = {"wood": 3};
export const WALL_COST: Cost = {"wood": 2, "iron": 1};
export const FATE_DECK: number[] = [-1, 0, 0, 1, 1, 2];
export const MARKET_BASE: Cost = {"mana": 3, "mat": 2};
export const FIXED_BUY: Cost = {"wood": 1, "iron": 2, "herb": 1, "food": 1};

// ---- アクションスペース ----
export const ACTIONS: ActionSpaceDef[] = [
  {"id": "forest", "name": "古の森", "accum": {"wood": 3}},
  {"id": "mine", "name": "鉄の坑道", "accum": {"iron": 2}},
  {"id": "meadow", "name": "薬草の野", "accum": {"herb": 2}},
  {"id": "spring", "name": "魔石の泉", "accum": {"mana": 1}},
  {"id": "hunt", "name": "狩場", "accum": {"food": 3}},
  {"id": "board", "name": "依頼板", "give": {"gold": 2}},
  {"id": "guild", "name": "ギルドで登用"},
  {"id": "forge", "name": "鍛冶場"},
  {"id": "workshop", "name": "工房"},
  {"id": "market", "name": "市場"},
  {"id": "plaza", "name": "広場", "give": {"food": 1}, "unlimited": true},
  {"id": "tavern", "name": "酒場で募集", "from_round": 3},
  {"id": "training", "name": "訓練場", "from_round": 5},
  {"id": "ruins", "name": "遺跡の探索", "from_round": 5},
  {"id": "grove", "name": "雑木林", "accum": {"wood": 2}, "min_p": 4},
  {"id": "market2", "name": "露店", "min_p": 4},
  {"id": "deepmine", "name": "深い坑道", "accum": {"iron": 1}, "min_p": 5},
  {"id": "peddler", "name": "行商", "give": {"gold": 1, "food": 1}, "min_p": 5},
  {"id": "herb2", "name": "霧の沢", "accum": {"herb": 1}, "min_p": 6},
  {"id": "outpost", "name": "見張り小屋", "give": {"food": 1, "gold": 1}, "min_p": 6},
];
export const ACT: Record<string, ActionSpaceDef> = Object.fromEntries(ACTIONS.map((a) => [a.id, a]));
export const MARKETS = new Set(["market", "market2"]);
export const NESTS: Record<number, string[]> = {"3": ["nest_forest", "nest_cave", "nest_swamp"], "4": ["nest_forest", "nest_cave", "nest_swamp"], "5": ["nest_forest", "nest_cave", "nest_swamp", "nest_mount"], "6": ["nest_forest", "nest_cave", "nest_swamp", "nest_mount"]};
export const NEST_JP: Record<string, string> = {"nest_forest": "森の巣", "nest_cave": "洞窟", "nest_swamp": "沼の巣", "nest_mount": "山の巣", "lair": "主の巣"};

// ---- 魔物（各年10種） ----
export const MONSTERS: MonsterDef[] = [
  {"id": "rat", "name": "畑荒らしの大ネズミ", "year": 1, "str": 3, "counter": 1, "weak": "fire", "race": "beast", "loot": {"food": 1}, "trophy": 1, "raid": 1},
  {"id": "imp", "name": "霧の小鬼", "year": 1, "str": 4, "counter": 1, "weak": "light", "race": "spirit", "loot": {"mana": 1}, "trophy": 1, "raid": 1},
  {"id": "boar", "name": "牙猪", "year": 1, "str": 5, "counter": 2, "weak": "ice", "race": "beast", "loot": {"mat": 1, "food": 2}, "trophy": 2, "raid": 2},
  {"id": "skel", "name": "骸骨兵", "year": 1, "str": 4, "counter": 2, "weak": "light", "race": "undead", "loot": {"iron": 1, "mat": 1}, "trophy": 1, "raid": 1},
  {"id": "slime", "name": "沼スライム", "year": 1, "str": 4, "counter": 1, "weak": "fire", "race": "spirit", "loot": {"herb": 2}, "trophy": 1, "raid": 1},
  {"id": "wolf", "name": "はぐれ狼", "year": 1, "str": 5, "counter": 2, "weak": "fire", "race": "beast", "loot": {"mat": 1, "food": 1}, "trophy": 2, "raid": 2},
  {"id": "goblin", "name": "小鬼の盗賊", "year": 1, "str": 5, "counter": 1, "weak": "thunder", "race": "humanoid", "loot": {"gold": 3}, "trophy": 1, "raid": 2},
  {"id": "bat", "name": "吸血大コウモリ", "year": 1, "str": 3, "counter": 2, "weak": "light", "race": "beast", "loot": {"mat": 1}, "trophy": 1, "raid": 1},
  {"id": "wisp", "name": "鬼火", "year": 1, "str": 5, "counter": 1, "weak": "ice", "race": "spirit", "loot": {"mana": 2}, "trophy": 2, "raid": 1},
  {"id": "spider", "name": "洞窟大蜘蛛", "year": 1, "str": 6, "counter": 2, "weak": "fire", "race": "beast", "loot": {"mat": 2}, "trophy": 2, "raid": 2},
  {"id": "frog", "name": "沼の大蛙", "year": 2, "str": 6, "counter": 2, "weak": "fire", "race": "beast", "loot": {"mat": 1, "mana": 1}, "trophy": 2, "raid": 2},
  {"id": "golem", "name": "岩の巨人", "year": 2, "str": 8, "counter": 3, "weak": "thunder", "race": "spirit", "loot": {"iron": 2, "mana": 1}, "trophy": 3, "raid": 3},
  {"id": "ghoul", "name": "屍食鬼", "year": 2, "str": 7, "counter": 2, "weak": "light", "race": "undead", "loot": {"mat": 2}, "trophy": 2, "raid": 2},
  {"id": "harpy", "name": "嵐のハーピー", "year": 2, "str": 7, "counter": 2, "weak": "ice", "race": "beast", "loot": {"mat": 1, "gold": 2}, "trophy": 2, "raid": 2},
  {"id": "ogre", "name": "人喰い鬼", "year": 2, "str": 8, "counter": 3, "weak": "fire", "race": "humanoid", "loot": {"food": 3, "gold": 2}, "trophy": 3, "raid": 3},
  {"id": "wraith", "name": "嘆きの亡霊", "year": 2, "str": 7, "counter": 2, "weak": "light", "race": "undead", "loot": {"mana": 2}, "trophy": 2, "raid": 2},
  {"id": "salam", "name": "火蜥蜴", "year": 2, "str": 7, "counter": 3, "weak": "ice", "race": "beast", "loot": {"mat": 2, "mana": 1}, "trophy": 3, "raid": 2},
  {"id": "bandit", "name": "山賊の頭領", "year": 2, "str": 6, "counter": 2, "weak": "thunder", "race": "humanoid", "loot": {"gold": 4}, "trophy": 2, "raid": 3},
  {"id": "treant", "name": "怒れる古木", "year": 2, "str": 8, "counter": 2, "weak": "fire", "race": "spirit", "loot": {"wood": 4, "herb": 1}, "trophy": 3, "raid": 2},
  {"id": "icewolf", "name": "氷牙の狼群", "year": 2, "str": 7, "counter": 3, "weak": "fire", "race": "beast", "loot": {"mat": 2, "food": 2}, "trophy": 3, "raid": 3},
  {"id": "wyvern", "name": "飛竜の若者", "year": 3, "str": 10, "counter": 3, "weak": "ice", "race": "dragon", "loot": {"mat": 2, "mana": 2}, "trophy": 4, "raid": 3},
  {"id": "lich", "name": "墓所の死霊術師", "year": 3, "str": 10, "counter": 3, "weak": "light", "race": "undead", "loot": {"mana": 3}, "trophy": 4, "raid": 3},
  {"id": "troll", "name": "再生する大鬼", "year": 3, "str": 9, "counter": 4, "weak": "fire", "race": "humanoid", "loot": {"mat": 2, "food": 3}, "trophy": 3, "raid": 3},
  {"id": "basil", "name": "石化の大蛇", "year": 3, "str": 9, "counter": 3, "weak": "thunder", "race": "beast", "loot": {"mat": 3}, "trophy": 3, "raid": 3},
  {"id": "elem", "name": "雷の精霊", "year": 3, "str": 9, "counter": 3, "weak": "dark", "race": "spirit", "loot": {"mana": 3}, "trophy": 3, "raid": 2},
  {"id": "knight", "name": "亡国の黒騎士", "year": 3, "str": 11, "counter": 4, "weak": "light", "race": "undead", "loot": {"iron": 3, "gold": 3}, "trophy": 4, "raid": 4},
  {"id": "manti", "name": "人面獅子", "year": 3, "str": 10, "counter": 4, "weak": "ice", "race": "beast", "loot": {"mat": 3, "gold": 2}, "trophy": 4, "raid": 3},
  {"id": "witch", "name": "霧の魔女", "year": 3, "str": 9, "counter": 3, "weak": "thunder", "race": "humanoid", "loot": {"mana": 2, "herb": 2}, "trophy": 3, "raid": 3},
  {"id": "hydra", "name": "沼の多頭蛇", "year": 3, "str": 11, "counter": 4, "weak": "fire", "race": "dragon", "loot": {"mat": 4}, "trophy": 4, "raid": 4},
  {"id": "shade", "name": "影の獣", "year": 3, "str": 8, "counter": 3, "weak": "light", "race": "spirit", "loot": {"mat": 2, "mana": 1}, "trophy": 3, "raid": 2},
];
export const MON: Record<string, MonsterDef> = Object.fromEntries(MONSTERS.map((m) => [m.id, m]));

// ---- 主（ラウンド4・8は2候補から1体、12は古竜） ----
export const BOSSES: Record<number, MonsterDef[]> = {
  4: [
    {"id": "b_bear", "name": "森の大熊", "year": 1, "str": 8, "counter": 3, "weak": "fire", "race": "beast", "loot": {"mat": 2, "food": 4}, "trophy": 5, "raid": 3},
    {"id": "b_queen", "name": "蜘蛛の女王", "year": 1, "str": 8, "counter": 2, "weak": "fire", "race": "beast", "loot": {"mat": 3}, "trophy": 5, "raid": 3},
  ],
  8: [
    {"id": "b_wyrm", "name": "山の飛竜", "year": 2, "str": 12, "counter": 4, "weak": "ice", "race": "dragon", "loot": {"mat": 3, "mana": 2}, "trophy": 6, "raid": 4},
    {"id": "b_dullahan", "name": "首無し騎士", "year": 2, "str": 12, "counter": 4, "weak": "light", "race": "undead", "loot": {"iron": 3, "mana": 2}, "trophy": 6, "raid": 4},
  ],
  12: [
    {"id": "b_ancient", "name": "谷底の古竜", "year": 3, "str": 20, "counter": 4, "weak": null, "race": "dragon", "loot": {"mana": 3}, "trophy": 5, "raid": 0},
  ],
};
export const BOSS: Record<string, MonsterDef> = Object.fromEntries(Object.values(BOSSES).flat().map((m) => [m.id, m]));

// ---- 天候（各季節6枚） ----
export const WEATHER: Record<Season, string[]> = {"spring": ["calm", "storm", "sprout", "thaw", "fog", "newmoon"], "summer": ["calm", "heat", "storm", "harvestmoon", "surge", "drought"], "autumn": ["calm", "newmoon", "fog", "harvestmoon", "gale", "festival"], "winter": ["calm", "blizzard", "cold", "mild", "newmoon", "fair"]};
export const WEATHER_JP: Record<string, string> = {"calm": "穏やかな日", "storm": "嵐", "sprout": "芽吹き", "thaw": "雪解け", "fog": "濃霧", "newmoon": "新月", "heat": "猛暑", "harvestmoon": "豊穣の月", "surge": "魔力の奔流", "drought": "日照り", "gale": "強風", "festival": "収穫祭", "blizzard": "吹雪", "cold": "寒波", "mild": "暖冬", "fair": "冬の市"};
export const WEATHER_EL: Record<string, [Element, number]> = {"storm": ["thunder", 2], "heat": ["fire", 2], "newmoon": ["dark", 2], "blizzard": ["ice", 2]};

// ---- キャラクター12人 ----
export const CHARACTERS: CharacterDef[] = [
  {"id": "toma", "name": "トーマ", "role": "森の弓使い", "tags": ["rear", "trap", "wood"]},
  {"id": "mina", "name": "ミナ", "role": "土くれの魔導士", "tags": ["convert", "fire", "mana"]},
  {"id": "gan", "name": "ガン", "role": "ドワーフの鍛冶師", "tags": ["front", "iron"]},
  {"id": "leo", "name": "レオ", "role": "闇市の商人", "tags": ["dark", "gold", "trade"]},
  {"id": "haru", "name": "ハル", "role": "獣使い", "tags": ["beast", "food"]},
  {"id": "sana", "name": "サナ", "role": "薬草師", "tags": ["herb", "support"]},
  {"id": "yuki", "name": "ユキ", "role": "星詠みの巫女", "tags": ["fate", "thunder", "weather"]},
  {"id": "goro", "name": "ゴロウ", "role": "城塞の騎士", "tags": ["front", "wall"]},
  {"id": "aya", "name": "アヤ", "role": "旅の吟遊詩人", "tags": ["coop", "support", "trade"]},
  {"id": "momo", "name": "モモ", "role": "野営の料理人", "tags": ["food", "morale"]},
  {"id": "riku", "name": "リク", "role": "魔物狩り", "tags": ["chain", "dark", "front"]},
  {"id": "nana", "name": "ナナ", "role": "光の神官", "tags": ["companion", "light", "support"]},
];
export const CHAR: Record<string, CharacterDef> = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));

// ---- 職能カード30種 ----
export const OCCUPATIONS: OccupationDef[] = [
  {"id": "o01", "name": "見習い炎術士", "kind": "occ", "tags": ["fire", "mana", "rear"], "text": "魔石1で炎+2。炎の弱点で倒すと魔石1が戻る", "chars": ["mina"], "quirk": false},
  {"id": "o02", "name": "霜の射手", "kind": "occ", "tags": ["ice", "rear", "wood"], "text": "矢を使うと氷属性になり、反撃-1", "chars": ["toma"], "quirk": false},
  {"id": "o03", "name": "雷槍の傭兵", "kind": "occ", "tags": ["front", "gold", "thunder"], "text": "金貨2で戦力+3（春は金貨1）", "chars": ["yuki", "leo"], "quirk": false},
  {"id": "o04", "name": "聖堂の癒し手", "kind": "occ", "tags": ["herb", "light", "support"], "text": "戦闘後、負傷した仲間1人を無料で回復（各ラウンド1回）", "chars": ["nana", "sana"], "quirk": false},
  {"id": "o05", "name": "闇市の情報屋", "kind": "occ", "tags": ["dark", "trade"], "text": "2ラウンド先の魔物が見える。情報料として毎ラウンド金貨1", "chars": ["leo", "yuki"], "quirk": false},
  {"id": "o06", "name": "盾持ちの古参兵", "kind": "occ", "tags": ["front", "iron"], "text": "防御+2。共闘相手の防御+1", "chars": ["goro", "aya"], "quirk": false},
  {"id": "o07", "name": "魔獣の調教師", "kind": "occ", "tags": ["beast", "food"], "text": "獣を使い魔にできる。使い魔の戦力+1、上限+1", "chars": ["haru"], "quirk": false},
  {"id": "o08", "name": "薬草摘みの少女", "kind": "occ", "tags": ["herb", "support"], "text": "薬草を取るたび+1。冬に薬草2を食料2に", "chars": ["sana", "momo"], "quirk": false},
  {"id": "o09", "name": "酒場の看板娘", "kind": "occ", "tags": ["companion", "food", "support"], "text": "仲間を雇う食料が不要。仲間4人以上で名声+3", "chars": ["nana", "momo"], "quirk": false},
  {"id": "o10", "name": "鉱山のドワーフ", "kind": "occ", "tags": ["front", "iron"], "text": "鉄を取るたび+1。鉄の武具を出すと名声+1", "chars": ["gan"], "quirk": false},
  {"id": "o11", "name": "狂戦士", "kind": "occ", "tags": ["chain", "dark", "front"], "text": "戦力+3。勝っても必ず1人負傷", "chars": ["riku", "sana"], "quirk": false},
  {"id": "o12", "name": "星図の学者", "kind": "occ", "tags": ["fate", "thunder"], "text": "運命カードの「-1」を「+1」に替える", "chars": ["yuki"], "quirk": false},
  {"id": "o13", "name": "城壁の工兵", "kind": "occ", "tags": ["iron", "wall", "wood"], "text": "防壁を建てるたび名声+1。防壁1つで襲撃-2", "chars": ["goro"], "quirk": false},
  {"id": "o14", "name": "影の斥候", "kind": "occ", "tags": ["dark", "rear"], "text": "各年1回、定員の埋まった巣にも入れる", "chars": ["riku", "leo"], "quirk": false},
  {"id": "o15", "name": "竜骨の錬金術師", "kind": "occ", "tags": ["convert", "mana"], "text": "素材を魔石として、魔石1を薬草2として払える", "chars": ["mina", "sana"], "quirk": false},
  {"id": "o16", "name": "嵐呼びの巫女", "kind": "occ", "tags": ["thunder", "weather"], "text": "各年1回、次の天候を嵐に。嵐の日は戦力+2", "chars": ["yuki"], "quirk": false},
  {"id": "o17", "name": "光の聖騎士", "kind": "occ", "tags": ["front", "light"], "text": "亡者・闇に戦力+2。古竜戦に参加で名声+2", "chars": ["nana"], "quirk": false},
  {"id": "o18", "name": "罠師", "kind": "occ", "tags": ["trap", "wood"], "text": "木材2で巣に罠（強さ-2）。罠の巣で誰かが勝つと金貨1", "chars": ["toma"], "quirk": false},
  {"id": "o19", "name": "契約魔の主", "kind": "occ", "tags": ["dark", "mana"], "text": "魔石2で闇の使い魔（戦力+4）。新月は魔石1", "chars": ["mina", "riku"], "quirk": false},
  {"id": "o20", "name": "野営地の世話役", "kind": "occ", "tags": ["companion", "food"], "text": "冬の維持費を仲間2人ぶん減らす", "chars": ["momo"], "quirk": false},
  {"id": "o21", "name": "古地図の冒険家", "kind": "occ", "tags": ["gold", "trade"], "text": "遺跡の探索で3枚見て1枚", "chars": ["leo", "aya"], "quirk": false},
  {"id": "o22", "name": "双剣の剣士", "kind": "occ", "tags": ["chain", "front"], "text": "同じラウンド2回目の戦闘で+4。熟練の上限+1", "chars": ["riku"], "quirk": false},
  {"id": "o23", "name": "結界の守り手", "kind": "occ", "tags": ["light", "wall"], "text": "冬の襲撃-3。施設3つ以上で戦力+1", "chars": ["goro", "nana"], "quirk": false},
  {"id": "o24", "name": "交渉上手の仲介人", "kind": "occ", "tags": ["coop", "trade"], "text": "共闘で戦利品と証を両方が全部受け取る", "chars": ["aya"], "quirk": false},
  {"id": "o25", "name": "獣の皮なめし職人", "kind": "occ", "tags": ["beast", "mat"], "text": "獣を倒すと素材+2。素材3を名声2に（各ラウンド1回）", "chars": ["haru", "riku"], "quirk": false},
  {"id": "o26", "name": "呪われた勇者", "kind": "occ", "tags": ["dark", "front"], "text": "戦力+5。毎ラウンド食料1か薬草1を払わないと仲間1人が休む。古竜を倒すと名声+8", "chars": ["sana", "momo"], "quirk": true},
  {"id": "o27", "name": "賭博師", "kind": "occ", "tags": ["fate", "gold"], "text": "運命カードを2枚めくり合計を使う。年1回、山を戻して混ぜ直す", "chars": ["yuki", "leo"], "quirk": true},
  {"id": "o28", "name": "孤高の剣聖", "kind": "occ", "tags": ["chain", "front"], "text": "仲間3人以下の間、戦力+3。4人目を雇うと捨てる", "chars": ["riku", "gan"], "quirk": true},
  {"id": "o29", "name": "宝探しの鼠人", "kind": "occ", "tags": ["gold", "trade"], "text": "遺跡で1枚多く取れる。主の報酬が4枚から1枚", "chars": ["leo", "aya"], "quirk": false},
  {"id": "o30", "name": "氷雪の隠者", "kind": "occ", "tags": ["ice", "rear"], "text": "冬の戦闘で戦力+3。吹雪の年は襲撃なし", "chars": ["mina", "toma"], "quirk": false},
];

// ---- 品物カード30種（武具・道具・秘術） ----
export const ITEMS: ItemDef[] = [
  {"id": "i01", "name": "樫の長弓", "kind": "weapon", "tags": ["rear", "wood"], "cost": {"wood": 2}, "fame": 0, "text": "戦力+1。矢を1本多く使える", "chars": ["toma"], "quirk": false, "power": 1},
  {"id": "i02", "name": "ドワーフの大剣", "kind": "weapon", "tags": ["front", "iron"], "cost": {"iron": 4}, "fame": 1, "text": "戦力+3", "chars": ["gan"], "quirk": false, "power": 3, "ironw": true},
  {"id": "i03", "name": "炎刃の短剣", "kind": "weapon", "tags": ["fire"], "cost": {"iron": 2, "mana": 1}, "fame": 0, "text": "炎+2。夏は+1", "chars": ["mina"], "quirk": false, "power": 2, "el": "fire", "ironw": true},
  {"id": "i04", "name": "氷晶の杖", "kind": "weapon", "tags": ["ice", "mana"], "cost": {"wood": 1, "mana": 2}, "fame": 1, "text": "氷+2。反撃-1", "chars": ["mina", "toma"], "quirk": false, "power": 2, "el": "ice"},
  {"id": "i05", "name": "雷鳴の戦槌", "kind": "weapon", "tags": ["iron", "thunder"], "cost": {"iron": 2, "mana": 1}, "fame": 1, "text": "雷+2。嵐の日は+4", "chars": ["yuki"], "quirk": false, "power": 2, "el": "thunder", "ironw": true},
  {"id": "i06", "name": "聖印の大盾", "kind": "weapon", "tags": ["front", "light"], "cost": {"iron": 3}, "fame": 1, "text": "防御+2。光属性", "chars": ["goro", "nana"], "quirk": false, "power": 0, "el": "light", "defense": 2, "ironw": true},
  {"id": "i07", "name": "黒曜の大鎌", "kind": "weapon", "tags": ["dark", "front"], "cost": {"iron": 1, "mana": 1, "mat": 1}, "fame": 1, "text": "闇+2。素材+1", "chars": ["riku"], "quirk": false, "power": 2, "el": "dark", "ironw": true},
  {"id": "i08", "name": "魔獣骨の鎧", "kind": "weapon", "tags": ["beast", "front"], "cost": {"mat": 3}, "fame": 2, "text": "防御+3。使い魔1体につき戦力+1", "chars": ["haru"], "quirk": false, "power": 0, "defense": 3},
  {"id": "i09", "name": "捕獲の投げ網", "kind": "weapon", "tags": ["beast", "trap", "wood"], "cost": {"wood": 2}, "fame": 0, "text": "戦力+1。獣の強さ-2。獣を使い魔にでき、食料-1", "chars": ["haru", "toma"], "quirk": false, "power": 1},
  {"id": "i10", "name": "吟遊詩人のリュート", "kind": "weapon", "tags": ["coop", "support"], "cost": {"wood": 2, "gold": 2}, "fame": 1, "text": "共闘のとき両者の戦力+2", "chars": ["aya"], "quirk": false, "power": 0},
  {"id": "i11", "name": "魔導炉", "kind": "tool", "tags": ["mana"], "cost": {"iron": 2, "wood": 1}, "fame": 1, "text": "毎ラウンド開始時に魔石1（6ラウンド）", "chars": ["mina"], "quirk": false},
  {"id": "i12", "name": "薬草園", "kind": "tool", "tags": ["herb"], "cost": {"wood": 2}, "fame": 1, "text": "春・夏・秋の終わりに薬草2", "chars": ["sana"], "quirk": false},
  {"id": "i13", "name": "野戦炊事場", "kind": "tool", "tags": ["food", "morale"], "cost": {"wood": 3}, "fame": 1, "text": "維持費-1。毎戦闘で士気+1", "chars": ["momo"], "quirk": false},
  {"id": "i14", "name": "物見の塔", "kind": "tool", "tags": ["fate", "wall"], "cost": {"wood": 3, "iron": 1}, "fame": 2, "text": "3ラウンド先まで見る。襲撃-1", "chars": ["yuki", "goro"], "quirk": false},
  {"id": "i15", "name": "交易の荷馬車", "kind": "tool", "tags": ["gold", "trade"], "cost": {"wood": 2}, "fame": 2, "text": "市場の個数+2", "chars": ["leo", "aya"], "quirk": false},
  {"id": "i16", "name": "訓練場", "kind": "tool", "tags": ["chain", "front"], "cost": {"wood": 2, "iron": 1}, "fame": 1, "text": "毎年1回、無料で熟練+1", "chars": ["riku", "gan"], "quirk": false},
  {"id": "i17", "name": "兵舎", "kind": "tool", "tags": ["companion"], "cost": {"wood": 5}, "fame": 1, "text": "寝床2つぶん。仲間1人につき名声+1", "chars": ["nana"], "quirk": false},
  {"id": "i18", "name": "鍛冶場の金床", "kind": "tool", "tags": ["iron"], "cost": {"iron": 2}, "fame": 1, "text": "武具を出すたび鉄1が戻る", "chars": ["gan"], "quirk": false},
  {"id": "i19", "name": "火球の巻物", "kind": "spell", "tags": ["fire", "mana"], "cost": {"mana": 2}, "fame": 0, "text": "炎+4", "chars": ["mina"], "quirk": false, "power": 4, "el": "fire"},
  {"id": "i20", "name": "時渡りの砂時計", "kind": "spell", "tags": ["mana"], "cost": {"mana": 3}, "fame": 0, "text": "仲間をもう1人置ける", "chars": ["riku", "mina"], "quirk": false},
  {"id": "i21", "name": "天候の鈴", "kind": "spell", "tags": ["weather"], "cost": {"mana": 1}, "fame": 0, "text": "次の天候を好きなものに", "chars": ["yuki"], "quirk": false},
  {"id": "i22", "name": "帰還の羽根", "kind": "spell", "tags": ["light", "support"], "cost": {"mana": 1}, "fame": 0, "text": "負けても負傷せず、仲間が戻る", "chars": ["nana", "sana"], "quirk": false},
  {"id": "i23", "name": "影分身の呪符", "kind": "spell", "tags": ["dark"], "cost": {"mana": 2}, "fame": 0, "text": "定員を無視して巣に入り、戦力+2", "chars": ["riku", "leo"], "quirk": false, "power": 2, "el": "dark"},
  {"id": "i24", "name": "竜殺しの秘薬", "kind": "spell", "tags": ["dragon", "herb"], "cost": {"mana": 2, "herb": 2}, "fame": 0, "text": "主・古竜との戦闘で戦力+6", "chars": ["sana", "nana"], "quirk": false, "power": 6},
  {"id": "i25", "name": "契約の羊皮紙", "kind": "spell", "tags": ["coop", "trade"], "cost": {"gold": 2}, "fame": 0, "text": "このラウンドの共闘で証を両方が受け取る", "chars": ["aya"], "quirk": false},
  {"id": "i26", "name": "生贄の魔剣", "kind": "weapon", "tags": ["dark", "front"], "cost": {"iron": 2, "mana": 2}, "fame": 1, "text": "戦力+3。戦闘のたび1人負傷。主を倒すと名声+3", "chars": ["sana", "nana"], "quirk": true, "power": 3, "el": "dark", "ironw": true},
  {"id": "i27", "name": "竜の卵", "kind": "tool", "tags": ["dragon", "food"], "cost": {"food": 1}, "fame": 0, "text": "毎冬食料1。最後まで育てると古竜戦+6、名声+6", "chars": ["momo", "haru"], "quirk": true},
  {"id": "i28", "name": "黄金の誓約書", "kind": "spell", "tags": ["gold", "trade"], "cost": {"mana": 1}, "fame": 0, "text": "金貨2枚ごとに戦力+1。勝てば倍返し、負ければ失う", "chars": ["leo", "aya"], "quirk": true},
  {"id": "i29", "name": "携帯鍛冶炉", "kind": "tool", "tags": ["front", "iron"], "cost": {"iron": 1, "wood": 1}, "fame": 1, "text": "戦闘中に鉄1で戦力+2", "chars": ["gan", "goro"], "quirk": false},
  {"id": "i30", "name": "聖水の小瓶", "kind": "spell", "tags": ["herb", "light"], "cost": {"herb": 1, "mana": 1}, "fame": 0, "text": "亡者・闇の魔物の強さ-3", "chars": ["nana", "sana"], "quirk": false, "power": 0},
];
export const CARDS: Record<string, CardDef> = Object.fromEntries([...OCCUPATIONS, ...ITEMS].map((c) => [c.id, c]));
export const OCC_IDS = OCCUPATIONS.map((c) => c.id);
export const ITEM_IDS = ITEMS.map((c) => c.id);

// ---- 共通の依頼（15種から3枚） ----
export const QUESTS: Record<string, string> = {"q_kill4": "魔物を4体倒す", "q_beast2": "獣を2体倒す", "q_undead2": "亡者を2体倒す", "q_boss": "主の討伐に勝つ", "q_comp4": "仲間を4人にする", "q_fac3": "施設を3つ建てる", "q_wall3": "防壁を3つ建てる", "q_weap3": "武具を3つ持つ", "q_occ3": "職能を3枚出す", "q_spell2": "秘術を2回使う", "q_weak3": "弱点を突いて3体倒す", "q_gold10": "金貨を10枚持つ", "q_coop2": "共闘で2体倒す", "q_mat6": "素材を6持つ", "q_skill3": "熟練を3つつける"};
export const QUEST_FAME: number[] = [4, 3, 2];

// ---- エンジン用の調整値（data.py の残りの定数をそのまま） ----
export const DEF_PER = 1;
export const FORECAST = 1;
export const REAR_DEF = 1;
export const POTION: [Cost, number] = [{"herb": 2}, 1];
export const MORALE: [Cost, number] = [{"food": 1}, 1];
export const OCC_FOOD: number[] = [1, 1];
export const RAID_WALLS = 1;
export const BOSS_ROUNDS: number[] = [4, 8, 12];
export const WINTER_ROUNDS: number[] = [4, 8, 12];
export const BOSS_SHARE = 1.0;
export const DRAGON_JOIN_FAME = 5;
export const RATING: Record<string, number> = {"i17": 1.8, "i06": 1.42, "o09": 1.35, "i02": 1.34, "o17": 1.26, "o21": 1.25, "o02": 1.23, "o04": 1.23, "o23": 1.22, "i04": 1.19, "o20": 1.16, "o30": 1.16, "o25": 1.15, "i12": 1.15, "i26": 1.15, "i08": 1.11, "o03": 1.11, "i29": 1.11, "i25": 1.08, "o26": 1.08, "i28": 1.07, "o29": 1.04, "i14": 1.02, "o06": 1.02, "o28": 1.01, "i01": 1.01, "o22": 1.0, "o12": 0.98, "o15": 0.98, "i05": 0.97, "i13": 0.96, "i22": 0.96, "i07": 0.95, "i30": 0.94, "o07": 0.93, "o13": 0.93, "o14": 0.9, "o01": 0.9, "i21": 0.86, "i24": 0.86, "o10": 0.83, "o18": 0.82, "o05": 0.81, "o16": 0.8, "o11": 0.77, "i16": 0.76, "o27": 0.76, "i15": 0.73, "i20": 0.73, "i23": 0.73, "o24": 0.72, "i03": 0.69, "i10": 0.69, "i19": 0.66, "i11": 0.62, "o19": 0.57, "i18": 0.46, "o08": 0.46, "i09": 0.33, "i27": 0.2};
export const O28_POWER = 3;
export const O22_POWER = 4;
export const O08_FOOD = 2;
export const YUKI_PER_YEAR = 4;
export const AYA_COOP = 2;
export const START_BONUS: Record<string, Cost> = {"leo": {"gold": 4}, "aya": {"gold": 5}, "mina": {"mana": 2}, "gan": {"iron": 2}, "yuki": {"mana": 2, "gold": 2}, "haru": {"food": 1}, "momo": {"food": 2}, "riku": {"mat": 2}};
export const TAME_KEEPS_TROPHY = true;
export const NANA_HIRE_FOOD = 1;
export const HARU_START_PETS = 1;
export const AYA_TRADE_GOLD = 2;
export const NANA_FREE_BED = false;
export const NANA_FIRST_FREE_FOOD = false;
export const RIKU_CHAIN = 4;
export const GORO_DEF = 1;
export const I26_BOSS_FAME = 1;
export const O17_DRAGON_FAME = 2;
export const CHAR_RATING: Record<string, number> = {"nana": 0.58, "goro": 0.42, "momo": 0.21, "aya": 0.14, "yuki": 0.13, "gan": 0.04, "leo": -0.06, "haru": -0.24, "toma": -0.25, "riku": -0.41, "sana": -0.42, "mina": -0.52};
export const RAID_PAYABLE = false;
export const COOP_SUPPORT_SHARE = 0.5;
export const RAID_FROM_DECK = 0;
export const SPAWN_EXTRA = 0;
export const DRAFT_SHOW = 3;
export const SELL_SPREAD = 0;
export const MINA_SPRING = 2;
export const MINA_DISCOUNT_ALWAYS = true;

// ---- 表示用の補助 ----
export const RACE_JP: Record<Race, string> = { beast: '獣', spirit: '精霊', undead: '亡者', humanoid: '人型', dragon: '竜' };
export const KIND_JP: Record<'occ' | ItemKind, string> = { occ: '職能', weapon: '武具', tool: '道具', spell: '秘術' };
/** 1年＝4ラウンド（春夏秋冬が1ラウンドずつ）。3年で12ラウンド */
export const seasonOf = (round: number): Season => SEASONS[(round - 1) % 4];
export const yearOf = (round: number): number => Math.floor((round - 1) / 4) + 1;
if (!NEST_JP.nest_fog) NEST_JP.nest_fog = '霧の巣';
