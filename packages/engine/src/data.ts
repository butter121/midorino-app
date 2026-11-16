// ミドリノ谷の四季 - カード・資材データ定義（Python版 data.py を1対1で移植。数値を変えるときは必ず両方を変える）

export const GOODS = ['grain', 'veg', 'sheep', 'pig', 'cattle', 'wood', 'clay', 'stone'] as const;
export const ANIMALS = ['sheep', 'pig', 'cattle'] as const;
export const CROPS = ['grain', 'veg'] as const;
export const RES = ['wood', 'clay', 'stone', 'grain', 'veg', 'sheep', 'pig', 'cattle', 'food', 'coin'] as const;
export type Good = (typeof GOODS)[number];
export type Animal = (typeof ANIMALS)[number];
export type Crop = (typeof CROPS)[number];
export type Res = (typeof RES)[number];
export type Cost = Partial<Record<Res, number>>;

export const JP: Record<Res, string> = {
  wood: '木材', clay: '粘土', stone: '石材', grain: '麦', veg: '野菜', sheep: '羊', pig: '豚',
  cattle: '牛', food: '食料', coin: 'コイン',
};

export const NUM_ROUNDS = 12;
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type Season = (typeof SEASONS)[number];
export const SEASON_JP: Record<Season, string> = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' };
export const FARM_PLOTS = 16;
export const MAX_FAMILY = 5;

// ---- 市場 ----
export const BASE_PRICE: Record<Good, number> = { grain: 2, veg: 3, sheep: 2, pig: 3, cattle: 4, wood: 1, clay: 1, stone: 2 };
export const PRICE_MIN = 1;
export const PRICE_SPAN = 4;
export const MARKET_BUY_LIMIT = 3;

// ---- 食料変換 ----
type CookTable = Record<'grain' | 'veg' | 'sheep' | 'pig' | 'cattle', number>;
export const RAW_FOOD: CookTable = { grain: 1, veg: 1, sheep: 1, pig: 1, cattle: 2 };
export const COOK_FOOD: CookTable = { grain: 2, veg: 3, sheep: 2, pig: 2, cattle: 3 };
export const BIG_COOK_FOOD: CookTable = { grain: 2, veg: 3, sheep: 2, pig: 3, cattle: 4 };
export const COIN_PER_FOOD = 2;
export const BEG_PENALTY = 3;
export const FEED_ADULT = 2;
export const FEED_BABY = 1;

// ---- 建築 ----
export type House = 'wood' | 'clay' | 'stone';
export const ROOM_COST: Record<House, Cost> = { wood: { wood: 4 }, clay: { clay: 4 }, stone: { stone: 4 } };
export const RENO_COST: Record<'clay' | 'stone', Cost> = { clay: { clay: 1 }, stone: { stone: 1 } };
export const RENO_FEE = { coin: 1 };
export const PASTURE_COST = { wood: 2 };
export const PASTURE_PER_PLOT = 2;
export const SOW_YIELD = { grain: 3, veg: 2 };
export const FIELD_SCORE_CAP = 6;
export const PASTURE_SCORE_CAP = 0;
export const DIVERSITY: Record<number, number> = { 3: 1, 4: 3, 5: 5 };

// ---- 開始資源（席順） ----
export const START_FOOD = 3;
export const SEAT_BONUS: Record<number, number[]> = { 3: [1, 1, 0], 4: [0, 2, 1, 1], 5: [1, 0, 3, 4, 7], 6: [2, 4, 4, 5, 2, 0] };
export const START_COIN = [2, 2, 2, 2, 2, 2];

// ---- アクションスペース ----
export interface ActionDef {
  id: string; name: string; text?: string;
  accum?: Cost; give?: Cost; min_p?: number; from_round?: number; unlimited?: boolean;
}
export const ACTIONS: ActionDef[] = [
  { id: 'start', name: '寄り合い所', give: { food: 1, coin: 1 } },
  { id: 'forest', name: '森林', accum: { wood: 3 } },
  { id: 'claypit', name: '粘土坑', accum: { clay: 2 } },
  { id: 'quarry', name: '石切場', accum: { stone: 1 } },
  { id: 'river', name: '川辺', accum: { food: 2 } },
  { id: 'daylabor', name: '日雇い', give: { coin: 2 } },
  { id: 'seed', name: '種もみ屋', give: { grain: 1 } },
  { id: 'plow', name: '開墾', text: '畑を1区画作る' },
  { id: 'sow', name: '種まき', text: '空き畑に麦/野菜をまく' },
  { id: 'fence', name: '柵作り', text: '牧場区画を作る（1区画=木材2）' },
  { id: 'build', name: '増築', text: '部屋を作る（1部屋＝家の素材4）' },
  { id: 'workshop', name: '工房', text: '設備を1枚獲得' },
  { id: 'market', name: '市場', text: '相場で売買' },
  { id: 'sheep', name: '羊の放牧地', accum: { sheep: 1 } },
  { id: 'lane', name: 'あぜ道', give: { food: 1 }, unlimited: true, text: '何人でも置ける' },
  { id: 'family', name: '家族を増やす', from_round: 3, text: '空き部屋が必要' },
  { id: 'pig', name: '豚の放牧地', from_round: 5, accum: { pig: 1 } },
  { id: 'renovate', name: '改築', from_round: 5, text: '家の素材を格上げ＋設備1枚可' },
  { id: 'garden', name: '菜園', from_round: 5, give: { veg: 1 } },
  { id: 'family2', name: 'にぎやかな食卓', from_round: 8, text: '空き部屋が必要。家族を増やす' },
  { id: 'cattle', name: '牛の放牧地', from_round: 9, accum: { cattle: 1 } },
  { id: 'plowsow', name: '耕して蒔く', from_round: 9, text: '開墾してから種まき' },
  { id: 'forest2', name: '雑木林', min_p: 4, accum: { wood: 2 } },
  { id: 'market2', name: '露店市', min_p: 4, text: '市場と同じ' },
  { id: 'claypit2', name: '粘土の崖', min_p: 5, accum: { clay: 1 } },
  { id: 'plow2', name: '荒れ地の開墾', min_p: 5, text: '畑を1区画作る（能力・設備による追加はなし）' },
  { id: 'peddler', name: '行商', min_p: 5, give: { coin: 1, grain: 1 } },
  { id: 'forest3', name: '森の奥', min_p: 6, accum: { wood: 2 } },
  { id: 'marsh', name: '沼地', min_p: 6, accum: { food: 1 }, give: { coin: 1 } },
];
export const ACT: Record<string, ActionDef> = Object.fromEntries(ACTIONS.map((a) => [a.id, a]));
export const ACC_WOOD = new Set(['forest', 'forest2', 'forest3']);
export const ACC_CLAY = new Set(['claypit', 'claypit2']);
export const ACC_STONE = new Set(['quarry']);
export const MARKET_SPACES = new Set(['market', 'market2']);

// ---- キャラクター ----
export const CHARACTERS: Record<string, { name: string; text: string }> = {
  toma: { name: '木こりのトーマ', text: '木材が積み増されるスペース（森林・雑木林・森の奥）から取るたび木材+1' },
  mina: { name: '陶工のミナ', text: '「粘土坑」から取るたび粘土+1。土の部屋は1部屋2VP。かまど・大かまどの粘土コスト-1' },
  gan: { name: '鍛冶屋のガン', text: '開始時石材2。設備を獲得するとき、資材（木材・粘土・石材）の費用を合計3少なく払える' },
  leo: { name: '商人のレオ', text: '市場で売値=相場（差額なし）、買値=相場-1（最低1）。開始時コイン+2' },
  haru: { name: '羊飼いのハル', text: '開始時、牧場1区画と羊1。羊の放牧地から取るたび羊+1。羊は牧場1区画に3頭入る。羊は1頭1VP' },
  sana: { name: '農婦のサナ', text: '開始時麦1。種まきで畑1区画あたり+1（麦・野菜とも）' },
  yuki: { name: '天気読みのユキ', text: '天気を2ラウンド先まで見る。各年2回まで、自分への悪天候を無効化。開始時食料+3' },
  goro: { name: '大工のゴロウ', text: '開始時木材2。柵作りのたび木材1が不要' },
  aya: { name: '交渉人のアヤ', text: '取引の提案を手番ごとに2回まで。取引成立ごとにコイン+1（各ラウンド3まで）。開始時コイン+3。毎年春のはじめにコイン2' },
  momo: { name: '料理人のモモ', text: 'はじめから「かまど」と同じ食料変換ができる。冬越しの必要食料-1。川辺から取るたび食料+1。大かまどの粘土コスト-2' },
  riku: { name: '開墾者のリク', text: '各年1回、「開墾」で畑を1区画多く作れる' },
  nana: { name: '子守りのナナ', text: '最初の家族を増やすときだけ空き部屋不要。家族を増やすたび食料+1' },
};
export const CHARACTER_IDS = Object.keys(CHARACTERS);

// ---- 設備カード ----
export interface ImpDef { name: string; cost: Cost; vp: number; basic?: boolean; text: string }
export const IMPROVEMENTS: Record<string, ImpDef> = {
  kamado: { name: 'かまど', cost: { clay: 2 }, vp: 1, basic: true, text: 'いつでも食料変換：麦2・野菜3・羊2・豚2・牛3' },
  okamado: { name: '大かまど', cost: { clay: 4, stone: 1 }, vp: 2, basic: true, text: 'いつでも食料変換：麦2・野菜3・羊2・豚3・牛4（かまどを返して粘土2で獲得も可）' },
  ishigama: { name: '石窯', cost: { clay: 2, stone: 2 }, vp: 2, basic: true, text: '冬越しのとき麦を3つまで、1つにつき食料4に変換できる' },
  ido: { name: '井戸', cost: { wood: 1, stone: 3 }, vp: 2, basic: true, text: '獲得後5ラウンド、ラウンド開始時に食料1' },
  kura: { name: '貯蔵庫', cost: { wood: 3, clay: 1 }, vp: 2, basic: true, text: '自分の畑は作物を減らす悪天候の影響を受けない' },
  teoshi: { name: '手押し車', cost: { wood: 1 }, vp: 1, text: '木材・粘土・石材が積み増されるスペースから取るたび、その資材+1' },
  suki: { name: '改良鋤', cost: { wood: 1 }, vp: 1, text: '「開墾」で作る畑+1区画' },
  taihi: { name: '堆肥小屋', cost: { wood: 1, clay: 1 }, vp: 1, text: '種まきで畑1区画あたり+1' },
  onshitsu: { name: '温室', cost: { wood: 1, clay: 1 }, vp: 1, text: '夏の収穫で野菜畑1区画につき野菜+1（最大2）' },
  youmou: { name: '羊毛小屋', cost: { wood: 3 }, vp: 1, text: '秋の終わりに羊2頭につきコイン1' },
  kunsei: { name: '燻製小屋', cost: { wood: 1, clay: 2 }, vp: 1, text: '豚を食料にするとき1頭につき食料+1' },
  chichi: { name: '搾乳場', cost: { wood: 2, clay: 1 }, vp: 1, text: '秋の終わりに牛1頭につき食料1（最大3）' },
  kaju: { name: '果樹園', cost: { wood: 2 }, vp: 2, text: '秋の終わりに食料2' },
  hachi: { name: '養蜂箱', cost: { wood: 1, clay: 1 }, vp: 1, text: '夏の終わりに食料1とコイン1' },
  yagura: { name: '物見やぐら', cost: { wood: 3 }, vp: 1, text: '各年1回、自分への悪天候を無効化' },
  keiryo: { name: '計量所', cost: { wood: 1, stone: 2 }, vp: 2, text: '市場で売るとき、売った種類1つにつきコイン+1' },
  souko: { name: '倉庫', cost: { wood: 2, clay: 2 }, vp: 1, text: '市場で買える個数+2' },
  ushigoya: { name: '牛舎', cost: { wood: 2 }, vp: 1, text: '牛を2頭まで飼える（牧場不要）' },
  butagoya: { name: '豚小屋', cost: { wood: 2 }, vp: 1, text: '豚を2頭まで飼える（牧場不要）' },
  inu: { name: '牧羊犬', cost: { coin: 2 }, vp: 0, text: '羊は牧場1区画に+1頭多く入る' },
  yurikago: { name: '揺りかご', cost: { wood: 2 }, vp: 1, text: '家族を増やすたび食料+2' },
  shokutaku: { name: '大きな食卓', cost: { wood: 2, clay: 1 }, vp: 2, text: '冬越しの必要食料-1' },
  ishidatami: { name: '石畳の庭', cost: { stone: 3 }, vp: 3, text: '効果なし' },
  chokoku: { name: '彫像', cost: { stone: 2, clay: 1, coin: 2 }, vp: 4, text: '効果なし' },
  suiro: { name: '水路', cost: { clay: 2, stone: 1 }, vp: 1, text: '夏の収穫で麦畑1区画につき麦+1（最大2）' },
  shushi: { name: '種子袋', cost: { coin: 1 }, vp: 0, text: '獲得時に麦1と野菜1' },
  kyoka: { name: '交易許可証', cost: { coin: 1 }, vp: 1, text: '取引の提案+1回。取引成立時コイン+1（各ラウンド1まで）' },
  bofu: { name: '防風林', cost: { wood: 2 }, vp: 1, text: '台風・長雨の影響を受けない' },
  makigoya: { name: '薪小屋', cost: { wood: 3 }, vp: 1, text: '大雪・寒波の影響を受けない' },
};
export const BASIC_IDS = Object.keys(IMPROVEMENTS).filter((k) => IMPROVEMENTS[k].basic);
export const DEV_IDS = Object.keys(IMPROVEMENTS).filter((k) => !IMPROVEMENTS[k].basic);
export const DISPLAY_SIZE = 4;

export function basicCopies(n: number): Record<string, number> {
  return { kamado: Math.floor((n + 1) / 2) + 1, okamado: 2, ishigama: 1, ido: 1, kura: 1 };
}

// ---- 天候カード ----
export interface WeatherDef { id: string; name: string; text: string; neg?: boolean; crop?: boolean }
export const WEATHER: Record<Season, WeatherDef[]> = {
  spring: [
    { id: 'harusame', name: '春雨', text: 'このラウンドの種まきは畑1区画あたり+2' },
    { id: 'osojimo', name: '遅霜', neg: true, crop: true, text: 'ラウンド終了時、作物の残る麦畑すべてから麦2を失う' },
    { id: 'yoshun', name: '陽春', text: '森林と粘土坑にさらに+1' },
    { id: 'yukidoke', name: '雪解け水', text: '川辺にさらに食料+2' },
    { id: 'hanabie', name: '花冷え', text: '野菜の相場+1' },
    { id: 'odayaka', name: '穏やかな日', text: '効果なし' },
  ],
  summer: [
    { id: 'hideri', name: '日照り', neg: true, crop: true, text: '夏の収穫は麦畑・野菜畑とも収穫なし。麦の相場+2、野菜の相場+1' },
    { id: 'megumi', name: '恵みの雨', text: '夏の収穫で畑1区画につき、畑からもう1つ取り、さらに場から同じ作物1を得る' },
    { id: 'yudachi', name: '夕立', text: '石切場にさらに石材+1' },
    { id: 'mosho', name: '猛暑', text: '川辺にさらに食料+2。羊の相場-1' },
    { id: 'hareten', name: '晴天続き', text: 'このラウンドの開墾は畑+1区画' },
    { id: 'odayaka', name: '穏やかな日', text: '効果なし' },
  ],
  autumn: [
    { id: 'hosaku', name: '豊作', text: '秋の収穫で畑1区画につき、畑からもう1つ取り、さらに場から同じ作物1を得る。麦・野菜の相場-1' },
    { id: 'taifu', name: '台風', neg: true, crop: true, text: '秋の収穫の前に、作物の載った畑すべてから作物1ずつ失う' },
    { id: 'nagaame', name: '長雨', neg: true, crop: true, text: '秋の収穫で麦畑は収穫なし' },
    { id: 'akibare', name: '秋晴れ', text: '繁殖で1種類だけ2頭生まれる' },
    { id: 'wataridori', name: '渡り鳥', text: '川辺にさらに食料+3' },
    { id: 'odayaka', name: '穏やかな日', text: '効果なし' },
  ],
  winter: [
    { id: 'oyuki', name: '大雪', neg: true, text: '冬越しで家族1人につき食料+1' },
    { id: 'kanpa', name: '寒波', neg: true, text: '冬越しで木材2を払う。足りない木材1につき食料+2。木材の相場+2' },
    { id: 'dantou', name: '暖冬', text: '冬越しで大人1人につき食料-1' },
    { id: 'fuyunoichi', name: '冬の市', text: 'このラウンド市場の売値+1' },
    { id: 'fubuki', name: '吹雪', text: 'このラウンド石切場は使えない' },
    { id: 'odayaka', name: '穏やかな日', text: '効果なし' },
  ],
};
export const WEATHER_BY_ID: Record<string, WeatherDef> = Object.fromEntries(
  Object.values(WEATHER).flat().map((w) => [w.id, w]),
);
