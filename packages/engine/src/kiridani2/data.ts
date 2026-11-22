// 霧谷の冒険者団 v2 — エンジン側の定数（行動マス・魔物の型・主・分野表・相場）。
// カード（職能・品物・段階カード・依頼・古代の品・共通の装備）は cards/ にある（エンジンには CardSet で渡す）。
import type { Cost, MonsterType, Res, SpaceDef } from './types';

export const YEARS = [5, 10, 15] as const;
export type Years = (typeof YEARS)[number];

export const START = { comps: 2, beds: 3, food: 3, gold: 2, wood: 1, iron: 1 };
export const SEAT_FOOD: Record<number, number[]> = { 2: [0, 1], 3: [0, 1, 1], 4: [0, 1, 1, 2], 5: [0, 1, 1, 2, 2], 6: [0, 1, 1, 2, 2, 3] };
export const MAX_COMPS = 6;
/** 熟練の上限（攻めは3まで、守りは2まで） */
export const MAX_SKILL: Record<'atk' | 'def', number> = { atk: 3, def: 2 };
export const UPKEEP = 2;
/** 5人目からの仲間は維持費3（調整：大所帯を重くする） */
export const UPKEEP_BIG = { from: 5, food: 3 };
export function upkeepOf(comps: number) { return comps * UPKEEP + Math.max(0, comps - UPKEEP_BIG.from + 1) * (UPKEEP_BIG.food - UPKEEP); }
export const DISCONTENT = 3;
export const FAME_PER_COMP = 1;
/** 金貨の名声：GOLD_PER_FAME 枚で1点、上限なし */
export const GOLD_PER_FAME = 3;
export const FATE_DECK = [-1, 0, 0, 1, 1, 2];
/** 仲間1人の素の戦力（再設計：2→1。武器の比重を上げる） */
export const POWER_PER = 1;
export const GUARD_PER = 1;
/** 防壁いくつで戦闘の守り+1 */
export const WALLS_PER_GUARD = 2;
/** 1つの巣に置ける組の数（v1 NEST_CAP） */
export const NEST_CAP = 2;
/** 1回に送れる仲間の数 */
export const MAX_SEND = 3;
export const BED_COST: Cost = { wood: 4 };
export const WALL_COST: Cost = { wood: 2, iron: 1 };
/** 回復の費用（薬草2で即回復） */
export const HEAL_COST = 2;
/** 守って戦う */
export const GUARD_MODE = { power: -2, counter: -2 };
/** 戦闘の後押し：士気（食料1で+1、送った人数まで）、ポーション（薬草2で+1、1回） */
export const MORALE: [Cost, number] = [{ food: 1 }, 1];
export const POTION: [Cost, number] = [{ herb: 2 }, 1];
/** ギルドで職能を出す費用（1枚目・2枚目から） */
export const OCC_FOOD = [1, 2, 3, 3, 4, 5];
export const QUEST_FAME = [4, 3, 2];
export const SECRET_FAME = 5;
/** 古竜：主と同じ式で t=1・格 grade・per[年数]（調整：仕様は強さ20固定）。証 trophy を割合で分け、参加者に join、負けると全員 −fail */
export const DRAGON = { grade: 3, per: { 5: 0.88, 10: 1.03, 15: 1.07 } as Record<number, number>, counter: 1, trophy: 14, join: 3, fail: 3 };
/** 主・古竜の戦いに参加しなかった（主の巣に仲間を送らなかった）人の名声（勝ち負けによらない） */
export const BOSS_ABSENT = 5;
/** 主・古竜の強さにかける人数（人数が多いほど強いが、1人あたりの戦力は人数が多いと下がるので、人数そのままよりゆるく） */
export const BOSS_N: Record<number, number> = { 1: 1, 2: 2, 3: 2.7, 4: 3.2, 5: 3.7, 6: 4.2 };
export const TRADE_MAX = 3;
/** 討伐の証：魔物の証＝round(強さ ÷ div ＋ ゆらぎ ＋ 主なら boss・古竜なら dragon)。共闘は倒した人数で等分。
 *  名声＝持っている証の合計 ÷ fameDiv（四捨五入） */
export const TROPHY = { div: 2.5, boss: 7.5, dragon: 15, fameDiv: 2.5 };
/** 魔石：魔物が必ず落とす。段階（初級・中級・上級）は強さで決まる。段階の幅＝その試合で巣の魔物がいちばん強くなる場合の強さ ÷ 3（主・古竜を除く）。
 *  数は段階の中の下半分で1、上半分で2（ゆらぎ noise を足す）。主・古竜は上級。戦闘が終わるまで見えない。共闘は貢献の割合（最低1）。
 *  ゲームの終わりに 1つ fame[段階] の名声。武器・防具を作るときに、重さ（軽い・中・重い）に合う段階の魔石を1つ払う */
export const STONE = { fame: [1, 2, 4], max: 2, noise: 0.15, jp: ['初級', '中級', '上級'] };
export const WEIGHT_TIER: Record<string, number> = { light: 0, mid: 1, heavy: 2 };

// ---- 交換所
/** 交換所の価値の表（金貨に換えた値）。売るのも買うのもこの値。2つを交換するときもこの重みで（出した価値まで受け取れる） */
export const VALUE: Record<Res, number> = { wood: 1, iron: 2, herb: 1, food: 1, mana: 3, mat: 2, gold: 1 };
export const BUY: Record<Res, number> = { ...VALUE, gold: 0 };
export const MARKET_QTY = 3;
/** 装備を売る値段＝費用（交換所の買値で数えた金貨）× この割合（調整：仕様は半分） */
export const ITEM_SELL_RATE = 0.8;
export const sellPrice = (r: Res) => BUY[r];

// ---- 古代の遺物：修復した遺物の名声（カードの fame）の年数の倍率（遺物は24枚しかないので、長い試合でも数が伸びにくい分を補う）
export const ANCIENT_SCALE: Record<number, number> = { 5: 1, 10: 1.4, 15: 2.2 };

// ---- 再設計で足した決まり
/** 準備で取る品物の数（武器・防具・道具・秘術の割合の合計） */
export const ITEM_COUNT = 6;
/** 使い魔：捕まえにくさ（格 −1/0/+1）・捕まえる食料＝強さ÷foodDiv（切り上げ）・戦力＝強さ÷powerDiv（切り上げ）・持てる数・連れて行ける数 */
export const CAPTURE = { ease: { '-1': 1, '0': 2, '1': 4 } as Record<string, number>, foodDiv: 4, powerDiv: 4, powerMax: 4, cap: 3, bring: 1 };
/** 傭兵（戦闘の後押し）：金貨2で戦力+1、送った人数まで */
export const MERC: [Cost, number] = [{ gold: 2 }, 1];
/** 足りない資源を金貨で：作る・建てる・職能を出すとき、1回に max 個まで、買値+premium の金貨で */
export const GOLD_SUB = { max: 2, premium: 1 };
/** 冬の食料が足りないとき、金貨 n 枚で食料1の代わり */
export const WINTER_GOLD = 2;
/** 武器・防具・道具・秘術を全部使っている（持たせた武器・防具、建てた道具、唱えた秘術が1つ以上）：名声（5年の値） */
export const FOUR_KINDS_FAME = 2;
/** 主・古竜に勝った人：好きな品物の山から look 枚見て1枚。主を倒すと遺物も1枚 */
export const BOSS_DRAW = 2;
/** 主・古竜に勝った人がもらう食料（宴） */
export const BOSS_FOOD = 2;
/** 共通の依頼を達成した人：職能か好きな品物の山から look 枚見て1枚 */
export const QUEST_DRAW = 2;

// ---- 分野表（5年基準。0は−1、1〜4点）
export const TABLE_BASE: Record<string, number[]> = {
  kills: [1, 4, 7, 10],
  races: [1, 3, 4, 5],
  weapons: [1, 2, 3, 4],
  armors: [1, 2, 3, 4],
  tools: [1, 3, 5, 7],
  spells: [1, 3, 5, 8],
  walls: [1, 2, 3, 4],
  occs: [1, 2, 3, 4],
  pets: [1, 2, 3, 4],
};
export const TABLE_JP: Record<string, string> = {
  kills: '倒した魔物', races: '倒した種族', weapons: '持たせた武器', armors: '持たせた防具', tools: '道具', spells: '唱えた秘術', walls: '防壁', occs: '出した職能', pets: '使い魔',
};
export const TABLE_SCALE: Record<number, number> = { 5: 1, 10: 1.6, 15: 2 };
/** 終わりの点（分野表の点・仲間の点・金貨の上限）の倍率。試合中の名声はラウンド数に比例して増えるので、年数に比例させる（調整） */
export const POINT_SCALE: Record<number, number> = { 5: 1, 10: 2, 15: 3 };
/** 種族は5種しかない・使い魔は持てる数が決まっているので伸ばさない */
export const TABLE_NOSCALE = new Set(['races', 'pets', 'boss', 'quests', 'ancient']);
const tableCache = new Map<number, Record<string, number[]>>();
export function tableFor(years: number): Record<string, number[]> {
  let t = tableCache.get(years);
  if (!t) {
    const s = TABLE_SCALE[years] ?? 1;
    t = Object.fromEntries(Object.entries(TABLE_BASE).map(([k, v]) => [k, TABLE_NOSCALE.has(k) ? v : v.map((x) => Math.ceil(x * s - 1e-9))]));
    tableCache.set(years, t);
  }
  return t;
}

// ---- 主・補充の時期（年）
export const BOSS_YEARS: Record<number, number[]> = { 5: [1, 2, 3, 4], 10: [2, 4, 6, 8], 15: [3, 6, 9, 12] };
/**
 * リーダーの効果の数字（効果そのものは engine.ts の LEAD の決まりのとおり。ここは値だけ変える）。
 * 効果はリーダー本人だけでなく、その人の駒（仲間）全員に効く。割り算の端数は切り捨て。
 */
export const LEADER = {
  /** 戦闘の天才：武器の戦力と武器の効果を weaponMult 倍、勝ったときの証を trophyMult 倍 */
  genius: { weaponMult: 2, effectMult: 2, trophyMult: 3 },
  /** 無限の努力家：熟練の上限 +skillCap、熟練の効き目 skillMult 倍、勝つと送った仲間の熟練の合計 ÷ fameDiv の名声 */
  striver: { skillCap: 1, skillMult: 3, fameDiv: 1 },
  /** 最高の魔術師：秘術を使ったあとマナ鉱石 mana か秘術 draw 枚（1ラウンド perRound 回まで）。勝つとその戦闘で使った秘術 1枚につき fame */
  mage: { perRound: 2, mana: 1, draw: 1, fame: 9 },
  /** 盾の勇者：守りを戦力として数える（guardMult 倍）、運命の影響なし、勝つと（守り − 反撃）÷ fameDiv の名声 */
  shield: { guardMult: 3, fameDiv: 0.6 },
  /** 孤高のテイマー：好物の数＝切り上げ(強さ ÷ favDiv)、使い魔1体の戦力 petPower、持てる使い魔 +petCap、ラウンドの終わりに使い魔1体ごとに fame（主・古竜は使い魔にできない） */
  tamer: { favDiv: 4, petCap: 7, fame: 4, petPower: 2 },
  /** 巨人狩り山田：主・古竜と戦うとき戦力 bossMult 倍。一番貢献して勝つと主 bossFame・古竜 dragonFame */
  giant: { bossMult: 3, bossFame: 10, dragonFame: 20 },
  /** 偉大な探検家：冬の食料 −upkeep、冒険マスにほかの人がいても置ける、冒険マスの効果 mult 倍、遺物の修復の費用 −repairCut（減らす資源は自分で選ぶ）、終わりに修復した遺物1つにつき ancientFame */
  explorer: { upkeep: 2, mult: 2, ancientFame: 8, repairCut: 2 },
  /** 自宅警備員：冬に防いだ襲撃1につき blockedFame、終わりに防壁1つにつき wallFame（防いだ襲撃の合計が lowBlocked 以下ならさらに lowMult 倍になるよう足す） */
  guard: { blockedFame: 1, wallFame: 2, lowBlocked: 10, lowMult: 2 },
  /** 採集家：マスで集める資源 mult 倍、毎年の終わりに持っている資源の合計 ÷ fameDiv の名声 */
  gatherer: { mult: 2, fameDiv: 11 },
  /** 詐欺師：相手の了承なしに取引（出す数＝受け取る数）、終わりに取引1回につき fame */
  swindler: { fame: 2 },
  /** 職人：道具の費用 −discount（資源・素材あわせて）、道具を作るたび fame、作ったあと山から look 枚の道具を見て1枚取る */
  crafter: { discount: 2, fame: 4, look: 3 },
  /** 伝説の商人：始めに資源（木材・鉄・薬草・マナ鉱石・食料）を start 個ずつ、売値 +sellBonus、終わりに金貨 ÷ goldDiv の名声 */
  merchant: { start: 10, sellBonus: 0, goldDiv: 3 },
};
/** テイマーの好物（魔物の種類ごと。食材・資源・素材から） */
export const FAV_RES = ['food', 'wood', 'iron', 'herb', 'mana', 'mat'] as const;

/**
 * 行動マスのまとまり（盤面で同じ役割のマスを並べる。探検家の「冒険マス」は adventure）。段階カードのマスも出たらここで分ける。
 * 載っていない id はカードの強い動きの種類で分け（SPACE_GROUP_BY_TAG）、それも無ければ「冒険」。
 */
export const SPACE_GROUPS: { id: string; jp: string; ids: string[] }[] = [
  { id: 'gather', jp: '資源を集める', ids: ['forest', 'grove', 'mine', 'deepmine', 'meadow', 'herb2', 'spring', 'hunt', 'plaza', 'lodge', 'bazaar', 'explore'] },
  { id: 'craft', jp: '作る・建てる', ids: ['forge', 'workshop', 'training', 'drill', 'walls', 'upgrade', 'bigforge', 'clearing'] },
  { id: 'trade', jp: '取引・お金', ids: ['guild', 'market', 'market2', 'peddler', 'outpost', 'caravan', 'tradepost', 'temple', 'envoy', 'treasury'] },
  { id: 'people', jp: '仲間・家族', ids: ['hall', 'tavern', 'family', 'hero', 'recommend'] },
  { id: 'adventure', jp: '冒険', ids: ['board', 'ruins', 'library', 'altar', 'kennel', 'raid', 'pilgrim', 'prepare', 'infirmary', 'triumph'] },
];
export const SPACE_GROUP_BY_TAG: Record<string, string> = { gather: 'gather', smith: 'craft', fort: 'craft', trade: 'trade', family: 'people', bridge: 'people' };

/** 準備のドラフト：束の数と1束の枚数（職能・品物の種類ごとに 5枚×6束） */
export const PACKS = 6;
export const PACK_SIZE = 5;
export const REFILL_YEARS: Record<number, number[]> = { 5: [3], 10: [4, 7], 15: [4, 7, 10, 13] };

// ---- 行動マス（始めから＋人数で増える）
export const SPACES: SpaceDef[] = [
  { id: 'forest', name: '古の森', accum: { wood: 3 }, options: [[]] },
  { id: 'mine', name: '鉄の坑道', accum: { iron: 3 }, options: [[]] },
  { id: 'meadow', name: '薬草の野', accum: { herb: 3 }, options: [[]] },
  { id: 'spring', name: 'マナ鉱石の泉', accum: { mana: 1 }, options: [[]] },
  { id: 'hunt', name: '狩場', accum: { food: 3 }, options: [[]] },
  { id: 'board', name: '依頼板', options: [[{ gain: { gold: 2 } }], [{ draw: { from: 'occ', look: 2, take: 1 } }]] },
  { id: 'guild', name: 'ギルド', options: [[{ occ: 1 }], [{ draw: { from: 'occ', look: 3, take: 1 } }]] },
  { id: 'forge', name: '鍛冶場', options: [[{ craft: 'any' }], [{ draw: { from: 'equip', look: 2, take: 1 } }]] },
  { id: 'workshop', name: '工房', options: [[{ build: 'any' }], [{ draw: { from: 'tool', look: 2, take: 1 } }], [{ repair: true }]] },
  { id: 'market', name: '交換所', cap: 2, options: [[{ exchange: true }]] },
  { id: 'curio', name: '掘り出し市', cap: 1, cap4: 2, options: [[{ buy_card: { count: 2, price: 1 } }]] },
  { id: 'dig', name: '古い発掘場', options: [[{ relic: 1 }], [{ repair: true }]] },
  { id: 'plaza', name: '広場', cap: 0, options: [[{ gain: { food: 1 } }]] },
  { id: 'hall', name: '集会所', options: [[{ first: true }, { gain: { food: 1 } }], [{ first: true }, { donate: { pay: { gold: 6 }, fame: 2 } }]] },
  { id: 'grove', name: '雑木林', accum: { wood: 2 }, min_p: 4, options: [[]] },
  { id: 'market2', name: '小さな交換所', min_p: 4, options: [[{ exchange: true }]] },
  { id: 'deepmine', name: '深い坑道', accum: { iron: 1 }, min_p: 5, options: [[]] },
  { id: 'peddler', name: '行商', min_p: 5, options: [[{ gain: { gold: 1, food: 1 } }]] },
  { id: 'herb2', name: '霧の沢', accum: { herb: 1 }, min_p: 6, options: [[]] },
  { id: 'outpost', name: '見張り小屋', min_p: 6, options: [[{ gain: { food: 1, gold: 1 } }]] },
];
export const SPACE: Record<string, SpaceDef> = Object.fromEntries(SPACES.map((s) => [s.id, s]));

/** 巣は人数と同じ数（人数が多いときに魔物が足りなくならないように） */
export const NESTS: Record<number, string[]> = {
  2: ['nest_forest', 'nest_cave'],
  3: ['nest_forest', 'nest_cave', 'nest_swamp'],
  4: ['nest_forest', 'nest_cave', 'nest_swamp', 'nest_mount'],
  5: ['nest_forest', 'nest_cave', 'nest_swamp', 'nest_mount', 'nest_ruins'],
  6: ['nest_forest', 'nest_cave', 'nest_swamp', 'nest_mount', 'nest_ruins', 'nest_plain'],
};
export const NEST_JP: Record<string, string> = { nest_forest: '森の巣', nest_cave: '洞窟', nest_swamp: '沼の巣', nest_mount: '山の巣', nest_ruins: '廃墟の巣', nest_plain: '荒野の巣', lair: '主の巣' };

// ---- 魔物の型（v1 の30種＋追加18種。格は v1 の年ごとの強さの順で −1/0/+1）
const M = (id: string, name: string, race: MonsterType['race'], loot: Res[], grade: number): MonsterType => ({ id, name, race, loot, grade });
export const MONSTERS: MonsterType[] = [
  M('rat', '畑荒らしの大ネズミ', 'beast', ['food'], -1),
  M('imp', '霧の小鬼', 'spirit', ['mana'], 0),
  M('boar', '牙猪', 'beast', ['mat', 'food'], 1),
  M('skel', '骸骨兵', 'undead', ['iron', 'mat'], 0),
  M('slime', '沼スライム', 'spirit', ['herb'], 0),
  M('wolf', 'はぐれ狼', 'beast', ['mat', 'food'], 1),
  M('goblin', '小鬼の盗賊', 'humanoid', ['gold'], 1),
  M('bat', '吸血大コウモリ', 'beast', ['mat'], -1),
  M('wisp', '鬼火', 'spirit', ['mana'], 1),
  M('spider', '洞窟大蜘蛛', 'beast', ['mat'], 1),
  M('frog', '沼の大蛙', 'beast', ['mat', 'mana'], -1),
  M('golem', '岩の巨人', 'spirit', ['iron', 'mana'], 1),
  M('ghoul', '屍食鬼', 'undead', ['mat'], 0),
  M('harpy', '嵐のハーピー', 'beast', ['mat', 'gold'], 0),
  M('ogre', '人喰い鬼', 'humanoid', ['food', 'gold'], 1),
  M('wraith', '嘆きの亡霊', 'undead', ['mana'], 0),
  M('salam', '火蜥蜴', 'beast', ['mat', 'mana'], 0),
  M('bandit', '山賊の頭領', 'humanoid', ['gold'], -1),
  M('treant', '怒れる古木', 'spirit', ['wood', 'herb'], 1),
  M('icewolf', '氷牙の狼群', 'beast', ['mat', 'food'], 0),
  M('wyvern', '飛竜の若者', 'dragon', ['mat', 'mana'], 0),
  M('lich', '墓所の死霊術師', 'undead', ['mana'], 0),
  M('troll', '再生する大鬼', 'humanoid', ['mat', 'food'], -1),
  M('basil', '石化の大蛇', 'beast', ['mat'], -1),
  M('elem', '雷の精霊', 'spirit', ['mana'], -1),
  M('knight', '亡国の黒騎士', 'undead', ['iron', 'gold'], 1),
  M('manti', '人面獅子', 'beast', ['mat', 'gold'], 0),
  M('witch', '霧の魔女', 'humanoid', ['mana', 'herb'], -1),
  M('hydra', '沼の多頭蛇', 'dragon', ['mat'], 1),
  M('shade', '影の獣', 'spirit', ['mat', 'mana'], -1),
  // 追加の18種（格・種族・弱点・戦利品の割合は上の30種に近づけた：格 −1×5・0×7・+1×6）
  M('mole', '鉄喰いの大土竜', 'beast', ['iron', 'food'], -1),
  M('owl', '霧梟', 'beast', ['mat'], -1),
  M('mushroom', '胞子の茸人', 'spirit', ['herb', 'mana'], -1),
  M('scarecrow', '彷徨う案山子', 'undead', ['wood', 'food'], -1),
  M('kobold', '坑道のコボルド', 'humanoid', ['iron', 'gold'], -1),
  M('stag', '霧角の大鹿', 'beast', ['food', 'mat'], 0),
  M('crab', '岩甲羅の大蟹', 'beast', ['mat', 'food'], 0),
  M('mimic', '宝箱もどき', 'spirit', ['gold'], 0),
  M('banshee', '泣き女の霊', 'undead', ['mana'], 0),
  M('lizardman', '沼の蜥蜴人', 'humanoid', ['herb', 'gold'], 0),
  M('drake', '火吹きの竜仔', 'dragon', ['mat', 'mana'], 0),
  M('wasp', '刺し蜂の群れ', 'beast', ['herb', 'mat'], 0),
  M('bear', '月牙の熊', 'beast', ['food', 'mat'], 1),
  M('scorpion', '砂岩の大蠍', 'beast', ['mat', 'iron'], 1),
  M('gargoyle', '石像鬼', 'spirit', ['iron', 'mana'], 1),
  M('mummy', '眠らぬ木乃伊', 'undead', ['mat', 'gold'], 1),
  M('orcchief', '牙の戦頭', 'humanoid', ['iron', 'food'], 1),
  M('wyrmling', '雷鱗の小竜', 'dragon', ['mana', 'mat'], 1),
];
export const MON: Record<string, MonsterType> = Object.fromEntries(MONSTERS.map((m) => [m.id, m]));

/** 主の型（v1 の4種＋追加6種。格+3） */
export const BOSS_TYPES: MonsterType[] = [
  M('b_bear', '森の大熊', 'beast', ['mat', 'food'], 3),
  M('b_queen', '蜘蛛の女王', 'beast', ['mat'], 3),
  M('b_wyrm', '山の飛竜', 'dragon', ['mat', 'mana'], 3),
  M('b_dullahan', '首無し騎士', 'undead', ['iron', 'mana'], 3),
  M('b_lichking', '霧の死霊王', 'undead', ['mana', 'gold'], 3),
  M('b_giant', '谷の大巨人', 'humanoid', ['iron', 'food'], 3),
  // 追加の4種（どれも格+3。1試合に出る主は4種のくじなので強さの釣り合いは変わらない）
  M('b_elder', '千年樹の守り主', 'spirit', ['wood', 'herb'], 3),
  M('b_storm', '嵐を呼ぶ雷鳥', 'beast', ['mat', 'mana'], 3),
  M('b_warlord', '鬼の大将', 'humanoid', ['iron', 'gold'], 3),
  M('b_mire', '底なし沼の大蛇竜', 'dragon', ['mat', 'herb'], 3),
];
export const ANCIENT_DRAGON: MonsterType = M('b_ancient', '谷底の古竜', 'dragon', ['mana', 'gold'], 3);
export const BOSS: Record<string, MonsterType> = Object.fromEntries([...BOSS_TYPES, ANCIENT_DRAGON].map((m) => [m.id, m]));

// ---- 魔物の数値（§6）
export const MON_ROLL = {
  /** 強さの元 s＝base + slope[年数]·t + 格 + N(0, sd²)（|N|≤clip·sd）。長い試合ほど仲間・装備が育つので傾きを年数で変える（調整：仕様は 5 + 8t） */
  base: 8, slope: { 5: 15, 10: 20, 15: 23 } as Record<number, number>, sd: 1.2, clip: 2.5, lootSd: 0.5, lootClip: 2,
  /** 戦利品の個数＝round(s/lootDiv + n)（再設計：2→4。重い品物がすぐ作れないように） */
  lootDiv: 3.5,
  /** 証＝round(s/trophyDiv + n)、反撃＝round(s/counterDiv)（調整：仕様は 2.5 と 3。強さを上げたので反撃は割る数を大きく） */
  trophyDiv: 6.5, counterDiv: 3.2,
  /** 冬の襲撃＝round(s/raidDiv)（調整：仕様は 4。防壁を持たない動きが襲撃で負けすぎるので弱めた。強さを上げたので 5→14。主に負けたときは +boss.raid） */
  raidDiv: 14,
  /** 巣の魔物の強さだけ下げる分（戦利品・証・反撃・襲撃は s のまま）。強さ＝round(s − ease.base − ease.slope[年数]·t)。
   *  序盤の魔物の8割くらいを1人で倒せるように（シミュレーションで、1人が出せる戦力と運命で勝つ見込み5割以上） */
  ease: { base: 3.5, slope: { 5: 5, 10: 3, 15: 3 } as Record<number, number> },
  /** 空いた巣に予告の魔物が入る確率（調整：毎ラウンド全部は埋まらない） */
  spawnP: 0.85,
  /**
   * 主：強さの元は傾き slope[年数] で s と同じに作り、強さ＝round((s − 格) × per[年数] × 人数) ＋ 格。全員で挑む前提の強さ（4人・10年で巣の魔物の約4倍）。
   * 証・戦利品・反撃・襲撃は s から（証×trophy、戦利品×loot、反撃+counter、襲撃+raid）。
   * 主の巣・古竜の証の分け方は戦力の割合（最低 minShare。巣の共闘は最低 0.5）。尻馬に乗るだけの参加で証を稼げないように。
   */
  boss: { base: 6, slope: { 5: 12, 10: 15, 15: 18 } as Record<number, number>, per: { 5: 0.78, 10: 1, 15: 1 } as Record<number, number>, trophy: 6, minShare: 0.25, loot: 1.5, counter: 0, raid: 2 },
};
/** AI・評価用の資源の目安 */
export const RES_VAL: Record<Res, number> = { wood: 0.4, iron: 0.6, herb: 0.45, mana: 0.9, food: 0.55, gold: 0.3, mat: 0.6 };
export const RES_JP: Record<Res, string> = { wood: '木材', iron: '鉄', herb: '薬草', mana: 'マナ鉱石', food: '食料', gold: '金貨', mat: '素材' };
