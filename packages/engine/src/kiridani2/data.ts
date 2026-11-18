// 霧谷の冒険者団 v2 — エンジン側の定数（行動マス・魔物の型・主・分野表・相場）。
// カード（職能・品物・段階カード・依頼・古代の品・共通の装備）は cards/ にある（エンジンには CardSet で渡す）。
import type { Cost, MonsterType, Res, SpaceDef } from './types';

export const YEARS = [5, 10, 15] as const;
export type Years = (typeof YEARS)[number];

export const START = { comps: 2, beds: 3, food: 3, gold: 2, wood: 1, iron: 1 };
export const SEAT_FOOD: Record<number, number[]> = { 2: [0, 1], 3: [0, 1, 1], 4: [0, 1, 1, 2], 5: [0, 1, 1, 2, 2], 6: [0, 1, 1, 2, 2, 3] };
export const MAX_COMPS = 6;
export const MAX_SKILL = 2;
export const UPKEEP = 2;
/** 5人目からの仲間は維持費3（調整：大所帯を重くする） */
export const UPKEEP_BIG = { from: 5, food: 3 };
export function upkeepOf(comps: number) { return comps * UPKEEP + Math.max(0, comps - UPKEEP_BIG.from + 1) * (UPKEEP_BIG.food - UPKEEP); }
export const DISCONTENT = 3;
export const FAME_PER_COMP = 1;
export const GOLD_PER_FAME = 4;
/** 金貨の名声の上限（5年。POINT_SCALE 倍）。超えた分は8枚で1点 */
export const GOLD_FAME_CAP = 4;
export const FATE_DECK = [-1, 0, 0, 1, 1, 2];
export const POWER_PER = 2;
export const GUARD_PER = 1;
/** 防壁いくつで戦闘の守り+1 */
export const WALLS_PER_GUARD = 2;
/** 弱点を突いたときの戦力（実装メモ：仕様にないので小さく） */
export const WEAK_BONUS = 1;
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
export const OCC_FOOD = [1, 2];
export const QUEST_FAME = [4, 3, 2];
export const SECRET_FAME = 5;
/** 古竜：主と同じ式で t=1・格 grade・per[年数]（調整：仕様は強さ20固定）。証 trophy を割合で分け、参加者に join、負けると全員 −fail */
export const DRAGON = { grade: 3, per: { 5: 0.88, 10: 1.03, 15: 1.07 } as Record<number, number>, counter: 1, trophy: 14, join: 3, fail: 3 };
/** 主・古竜の戦いに参加しなかった（主の巣に仲間を送らなかった）人の名声（勝ち負けによらない） */
export const BOSS_ABSENT = 5;
export const TRADE_MAX = 3;

// ---- 交換所
export const BUY: Record<Res, number> = { wood: 1, iron: 2, herb: 1, food: 1, mana: 3, mat: 2, gold: 0 };
export const MARKET_QTY = 3;
/** 装備を売る値段＝費用（交換所の買値で数えた金貨）× この割合（調整：仕様は半分） */
export const ITEM_SELL_RATE = 0.8;
export const sellPrice = (r: Res) => Math.max(1, BUY[r] - 1);

// ---- 古代の品の組
export const ANCIENT_SAME = [0, 0, 2, 5];
export const ANCIENT_ALL = 6;

// ---- 分野表（5年基準。0は−1、1〜4点）
export const TABLE_BASE: Record<string, number[]> = {
  kills: [1, 4, 7, 10],
  races: [1, 3, 4, 5],
  facilities: [1, 2, 3, 4],
  walls: [1, 2, 3, 4],
  gear: [1, 3, 5, 7],
  occs: [1, 2, 3, 4],
  pets: [1, 2, 3, 4],
};
export const TABLE_JP: Record<string, string> = {
  kills: '倒した魔物', races: '倒した種族', facilities: '施設', walls: '防壁', gear: '持たせた装備', occs: '出した職能', pets: '使い魔',
};
export const TABLE_SCALE: Record<number, number> = { 5: 1, 10: 1.6, 15: 2 };
/** 終わりの点（分野表の点・仲間の点・金貨の上限）の倍率。試合中の名声はラウンド数に比例して増えるので、年数に比例させる（調整） */
export const POINT_SCALE: Record<number, number> = { 5: 1, 10: 2, 15: 3 };
/** 種族は5種しかないので伸ばさない（実装メモ） */
export const TABLE_NOSCALE = new Set(['races']);
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
export const REFILL_YEARS: Record<number, number[]> = { 5: [], 10: [4, 7], 15: [4, 7, 10, 13] };

// ---- 行動マス（始めから＋人数で増える）
export const SPACES: SpaceDef[] = [
  { id: 'forest', name: '古の森', accum: { wood: 3 }, options: [[]] },
  { id: 'mine', name: '鉄の坑道', accum: { iron: 3 }, options: [[]] },
  { id: 'meadow', name: '薬草の野', accum: { herb: 3 }, options: [[]] },
  { id: 'spring', name: '魔石の泉', accum: { mana: 1 }, options: [[{ gain: { mat: 1 } }]] },
  { id: 'hunt', name: '狩場', accum: { food: 3 }, options: [[]] },
  { id: 'board', name: '依頼板', options: [[{ gain: { gold: 2 } }]] },
  { id: 'guild', name: 'ギルド', options: [[{ occ: 1 }]] },
  { id: 'forge', name: '鍛冶場', options: [[{ craft: 'weapon' }]] },
  { id: 'workshop', name: '工房', options: [[{ build: 'any' }]] },
  { id: 'market', name: '交換所', options: [[{ exchange: true }]] },
  { id: 'plaza', name: '広場', cap: 0, options: [[{ gain: { food: 1 } }], [{ gain: { mat: 1 } }]] },
  { id: 'hall', name: '集会所', options: [[{ first: true }, { gain: { food: 1 } }], [{ first: true }, { donate: { pay: { gold: 6 }, fame: 2 } }]] },
  { id: 'grove', name: '雑木林', accum: { wood: 2 }, min_p: 4, options: [[]] },
  { id: 'market2', name: '小さな交換所', min_p: 4, options: [[{ exchange: true }]] },
  { id: 'deepmine', name: '深い坑道', accum: { iron: 1 }, min_p: 5, options: [[]] },
  { id: 'peddler', name: '行商', min_p: 5, options: [[{ gain: { gold: 1, food: 1 } }]] },
  { id: 'herb2', name: '霧の沢', accum: { herb: 1 }, min_p: 6, options: [[]] },
  { id: 'outpost', name: '見張り小屋', min_p: 6, options: [[{ gain: { food: 1, gold: 1 } }]] },
];
export const SPACE: Record<string, SpaceDef> = Object.fromEntries(SPACES.map((s) => [s.id, s]));

export const NESTS: Record<number, string[]> = {
  2: ['nest_forest', 'nest_cave'],
  3: ['nest_forest', 'nest_cave', 'nest_swamp'],
  4: ['nest_forest', 'nest_cave', 'nest_swamp'],
  5: ['nest_forest', 'nest_cave', 'nest_swamp', 'nest_mount'],
  6: ['nest_forest', 'nest_cave', 'nest_swamp', 'nest_mount'],
};
export const NEST_JP: Record<string, string> = { nest_forest: '森の巣', nest_cave: '洞窟', nest_swamp: '沼の巣', nest_mount: '山の巣', lair: '主の巣' };

// ---- 魔物の型（v1 の30種＋追加18種。格は v1 の年ごとの強さの順で −1/0/+1）
const M = (id: string, name: string, race: MonsterType['race'], weak: MonsterType['weak'], loot: Res[], grade: number): MonsterType => ({ id, name, race, weak, loot, grade });
export const MONSTERS: MonsterType[] = [
  M('rat', '畑荒らしの大ネズミ', 'beast', 'fire', ['food'], -1),
  M('imp', '霧の小鬼', 'spirit', 'light', ['mana'], 0),
  M('boar', '牙猪', 'beast', 'ice', ['mat', 'food'], 1),
  M('skel', '骸骨兵', 'undead', 'light', ['iron', 'mat'], 0),
  M('slime', '沼スライム', 'spirit', 'fire', ['herb'], 0),
  M('wolf', 'はぐれ狼', 'beast', 'fire', ['mat', 'food'], 1),
  M('goblin', '小鬼の盗賊', 'humanoid', 'thunder', ['gold'], 1),
  M('bat', '吸血大コウモリ', 'beast', 'light', ['mat'], -1),
  M('wisp', '鬼火', 'spirit', 'ice', ['mana'], 1),
  M('spider', '洞窟大蜘蛛', 'beast', 'fire', ['mat'], 1),
  M('frog', '沼の大蛙', 'beast', 'fire', ['mat', 'mana'], -1),
  M('golem', '岩の巨人', 'spirit', 'thunder', ['iron', 'mana'], 1),
  M('ghoul', '屍食鬼', 'undead', 'light', ['mat'], 0),
  M('harpy', '嵐のハーピー', 'beast', 'ice', ['mat', 'gold'], 0),
  M('ogre', '人喰い鬼', 'humanoid', 'fire', ['food', 'gold'], 1),
  M('wraith', '嘆きの亡霊', 'undead', 'light', ['mana'], 0),
  M('salam', '火蜥蜴', 'beast', 'ice', ['mat', 'mana'], 0),
  M('bandit', '山賊の頭領', 'humanoid', 'thunder', ['gold'], -1),
  M('treant', '怒れる古木', 'spirit', 'fire', ['wood', 'herb'], 1),
  M('icewolf', '氷牙の狼群', 'beast', 'fire', ['mat', 'food'], 0),
  M('wyvern', '飛竜の若者', 'dragon', 'ice', ['mat', 'mana'], 0),
  M('lich', '墓所の死霊術師', 'undead', 'light', ['mana'], 0),
  M('troll', '再生する大鬼', 'humanoid', 'fire', ['mat', 'food'], -1),
  M('basil', '石化の大蛇', 'beast', 'thunder', ['mat'], -1),
  M('elem', '雷の精霊', 'spirit', 'dark', ['mana'], -1),
  M('knight', '亡国の黒騎士', 'undead', 'light', ['iron', 'gold'], 1),
  M('manti', '人面獅子', 'beast', 'ice', ['mat', 'gold'], 0),
  M('witch', '霧の魔女', 'humanoid', 'thunder', ['mana', 'herb'], -1),
  M('hydra', '沼の多頭蛇', 'dragon', 'fire', ['mat'], 1),
  M('shade', '影の獣', 'spirit', 'light', ['mat', 'mana'], -1),
  // 追加の18種（格・種族・弱点・戦利品の割合は上の30種に近づけた：格 −1×5・0×7・+1×6）
  M('mole', '鉄喰いの大土竜', 'beast', 'thunder', ['iron', 'food'], -1),
  M('owl', '霧梟', 'beast', 'fire', ['mat'], -1),
  M('mushroom', '胞子の茸人', 'spirit', 'fire', ['herb', 'mana'], -1),
  M('scarecrow', '彷徨う案山子', 'undead', 'fire', ['wood', 'food'], -1),
  M('kobold', '坑道のコボルド', 'humanoid', 'light', ['iron', 'gold'], -1),
  M('stag', '霧角の大鹿', 'beast', 'ice', ['food', 'mat'], 0),
  M('crab', '岩甲羅の大蟹', 'beast', 'thunder', ['mat', 'food'], 0),
  M('mimic', '宝箱もどき', 'spirit', 'light', ['gold'], 0),
  M('banshee', '泣き女の霊', 'undead', 'light', ['mana'], 0),
  M('lizardman', '沼の蜥蜴人', 'humanoid', 'ice', ['herb', 'gold'], 0),
  M('drake', '火吹きの竜仔', 'dragon', 'ice', ['mat', 'mana'], 0),
  M('wasp', '刺し蜂の群れ', 'beast', 'fire', ['herb', 'mat'], 0),
  M('bear', '月牙の熊', 'beast', 'fire', ['food', 'mat'], 1),
  M('scorpion', '砂岩の大蠍', 'beast', 'ice', ['mat', 'iron'], 1),
  M('gargoyle', '石像鬼', 'spirit', 'thunder', ['iron', 'mana'], 1),
  M('mummy', '眠らぬ木乃伊', 'undead', 'fire', ['mat', 'gold'], 1),
  M('orcchief', '牙の戦頭', 'humanoid', 'fire', ['iron', 'food'], 1),
  M('wyrmling', '雷鱗の小竜', 'dragon', 'dark', ['mana', 'mat'], 1),
];
export const MON: Record<string, MonsterType> = Object.fromEntries(MONSTERS.map((m) => [m.id, m]));

/** 主の型（v1 の4種＋追加6種。格+3） */
export const BOSS_TYPES: MonsterType[] = [
  M('b_bear', '森の大熊', 'beast', 'fire', ['mat', 'food'], 3),
  M('b_queen', '蜘蛛の女王', 'beast', 'fire', ['mat'], 3),
  M('b_wyrm', '山の飛竜', 'dragon', 'ice', ['mat', 'mana'], 3),
  M('b_dullahan', '首無し騎士', 'undead', 'light', ['iron', 'mana'], 3),
  M('b_lichking', '霧の死霊王', 'undead', 'light', ['mana', 'gold'], 3),
  M('b_giant', '谷の大巨人', 'humanoid', 'thunder', ['iron', 'food'], 3),
  // 追加の4種（どれも格+3。1試合に出る主は4種のくじなので強さの釣り合いは変わらない）
  M('b_elder', '千年樹の守り主', 'spirit', 'fire', ['wood', 'herb'], 3),
  M('b_storm', '嵐を呼ぶ雷鳥', 'beast', 'ice', ['mat', 'mana'], 3),
  M('b_warlord', '鬼の大将', 'humanoid', 'thunder', ['iron', 'gold'], 3),
  M('b_mire', '底なし沼の大蛇竜', 'dragon', 'fire', ['mat', 'herb'], 3),
];
export const ANCIENT_DRAGON: MonsterType = M('b_ancient', '谷底の古竜', 'dragon', null, ['mana', 'gold'], 3);
export const BOSS: Record<string, MonsterType> = Object.fromEntries([...BOSS_TYPES, ANCIENT_DRAGON].map((m) => [m.id, m]));

// ---- 魔物の数値（§6）
export const MON_ROLL = {
  /** 強さの元 s＝base + slope[年数]·t + 格 + N(0, sd²)（|N|≤clip·sd）。長い試合ほど仲間・装備が育つので傾きを年数で変える（調整：仕様は 5 + 8t） */
  base: 6, slope: { 5: 14, 10: 18, 15: 21 } as Record<number, number>, sd: 1.2, clip: 2.5, lootSd: 0.5, lootClip: 2,
  /** 証＝round(s/trophyDiv + n)、反撃＝round(s/counterDiv)（調整：仕様は 2.5 と 3。強さを上げたので反撃は割る数を大きく） */
  trophyDiv: 5.5, counterDiv: 3.2,
  /** 冬の襲撃＝round(s/raidDiv)（調整：仕様は 4。防壁を持たない動きが襲撃で負けすぎるので弱めた。強さを上げたので 5→14。主に負けたときは +boss.raid） */
  raidDiv: 14,
  /** 空いた巣に予告の魔物が入る確率（調整：毎ラウンド全部は埋まらない） */
  spawnP: 0.85,
  /**
   * 主：強さの元は傾き slope[年数] で s と同じに作り、強さ＝round((s − 格) × per[年数] × 人数) ＋ 格。全員で挑む前提の強さ（4人・10年で巣の魔物の約4倍）。
   * 証・戦利品・反撃・襲撃は s から（証×trophy、戦利品×loot、反撃+counter、襲撃+raid）。
   * 主の巣・古竜の証の分け方は戦力の割合（最低 minShare。巣の共闘は最低 0.5）。尻馬に乗るだけの参加で証を稼げないように。
   */
  boss: { slope: { 5: 12, 10: 15, 15: 18 } as Record<number, number>, per: { 5: 0.78, 10: 1, 15: 1 } as Record<number, number>, trophy: 6, minShare: 0.25, loot: 1.5, counter: 0, raid: 2 },
};
/** AI・評価用の資源の目安 */
export const RES_VAL: Record<Res, number> = { wood: 0.4, iron: 0.6, herb: 0.45, mana: 0.9, food: 0.55, gold: 0.3, mat: 0.6 };
export const RES_JP: Record<Res, string> = { wood: '木材', iron: '鉄', herb: '薬草', mana: '魔石', food: '食料', gold: '金貨', mat: '素材' };
