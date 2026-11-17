// 霧谷の冒険者団 v2 — 道具カード（60 枚。強い動き 1 つにつき主に 5 枚）
// 出し方：工房で費用を払って建てる（拠点の設備。施設として数える）。
import type { CardDef } from '../types';

export const TOOLS: CardDef[] = [
  // ---- hunt ----
  {
    id: 't_trophy_wall', kind: 'tool', name: '証の飾り棚', engine: ['hunt'], mech: 'endfame',
    cost: { wood: 2 }, fame: 1,
    effects: [
      { when: 'game_end', if: { min: { kills: 5 } }, do: [{ fame: 3 }] },
      { when: 'win', do: [{ gain: { gold: 1 } }], limit: 'year' },
    ],
    text: '名声1。魔物に勝つと金貨+1（1年に1回）。終わりに倒した魔物が5体以上なら名声+3。',
  },
  // ---- gather ----
  {
    id: 't_basket', kind: 'tool', name: '採集籠', engine: ['gather'], mech: 'boost',
    cost: { wood: 1 },
    effects: [{ when: 'passive', mod: { accum_bonus: { meadow: 1 } } }],
    text: '薬草の野を使うと、たまった分に加えてさらに1つ多く取れる。',
  },
  {
    id: 't_storehouse', kind: 'tool', name: '貯蔵庫', engine: ['gather', 'trade'], mech: 'convert',
    cost: { wood: 3 },
    effects: [
      { when: 'round_end', do: [{ convert: { from: { wood: 3 }, to: { gold: 3 } } }], limit: 'round' },
      { when: 'round_end', do: [{ pay: { wood: 2, herb: 2 } }, { fame: 1 }], limit: 'round' },
    ],
    text: 'ラウンドの終わりに、木材3を金貨3に替えてよい。また木材2・薬草2を蔵に納めて名声1（それぞれラウンド1回）。',
  },
  // ---- trade ----
  {
    id: 't_cart', kind: 'tool', name: '荷馬車', engine: ['trade'], mech: 'boost',
    cost: { wood: 2 }, fame: 1,
    effects: [{ when: 'passive', mod: { market_qty: 2 } }],
    text: '名声1。交換所で一度に扱える数+2。',
  },
  {
    id: 't_trading_house', kind: 'tool', name: '商館', engine: ['trade', 'ally'], mech: 'social',
    cost: { wood: 3, gold: 1 }, prereq: { occs: 1 },
    effects: [
      { when: 'passive', mod: { trade_count: 1 } },
      { when: 'sell', do: [{ fame: 1 }], limit: 'round' },
    ],
    text: '前提：職能1枚。1ラウンドにできる取引の回数+1。交換所で売ると名声+1（ラウンド1回）。',
  },
  // ---- fort ----
  {
    id: 't_quarry', kind: 'tool', name: '石切り場', engine: ['fort', 'gather'], mech: 'convert',
    cost: { wood: 2, iron: 1 },
    effects: [
      { when: 'passive', mod: { cost_discount: { kind: 'wall', res: { wood: 1 } } } },
      { when: 'use:mine', do: [{ build: 'wall', discount: { wood: 1 } }], limit: 'year' },
    ],
    text: '防壁は木材1安い。鉄の坑道を使ったあと、防壁を1つ建ててよい（さらに木材1安い。1年に1回）。',
  },
  // ---- smith ----
  {
    id: 't_anvil', kind: 'tool', name: '鍛冶場の金床', engine: ['smith'], mech: 'convert',
    cost: { iron: 2 },
    effects: [
      { when: 'craft', do: [{ gain: { iron: 1 } }], limit: 'round' },
      { when: 'craft', do: [{ fame: 1 }], limit: 'round' },
    ],
    text: '装備を作ると鉄1が戻り、名声+1（それぞれラウンド1回）。',
  },
  {
    id: 't_bellows', kind: 'tool', name: '大ふいご', engine: ['smith'], mech: 'action',
    cost: { wood: 2 },
    effects: [{ when: 'use:forge', do: [{ craft: 'any' }], limit: 'round' }],
    text: '鍛冶場を使ったあと、続けて装備をもう1つ作れる（費用は払う。ラウンド1回）。',
  },
  // ---- family ----
  {
    id: 't_dormitory', kind: 'tool', name: '大部屋', engine: ['family'], mech: 'boost',
    cost: { wood: 7 },
    effects: [
      { when: 'passive', mod: { bed_cap: 2 } },
      { when: 'hire', do: [{ gain: { food: 1 } }], limit: 'year' },
    ],
    text: '寝床2つぶんになる。仲間が増えると食料+1（1年に1回）。',
  },
  {
    id: 't_smokehouse', kind: 'tool', name: '燻製小屋', engine: ['family', 'hunt'], mech: 'convert',
    cost: { wood: 2, iron: 1 },
    effects: [{ when: 'round_end', do: [{ convert: { from: { mat: 2 }, to: { food: 2 } } }], limit: 'round' }],
    text: 'ラウンドの終わりに、素材2を食料2に替えてよい（ラウンド1回）。',
  },
  // ---- arcane ----
  {
    id: 't_mana_font', kind: 'tool', name: '魔力の泉水', engine: ['arcane'], mech: 'accrue',
    cost: { wood: 2, mana: 1 },
    effects: [{ when: 'round_start', if: { season: ['spring', 'autumn'] }, do: [{ gain: { mana: 1 } }] }],
    text: '春と秋のラウンドの始めに魔石+1。',
  },
  // ---- beast ----
  {
    id: 't_stable', kind: 'tool', name: '獣舎', engine: ['beast', 'family'], mech: 'accrue',
    cost: { wood: 3 },
    effects: [
      { when: 'round_start', if: { min: { pets: 1 } }, do: [{ gain: { food: 1 } }] },
      { when: 'round_start', if: { min: { pets: 3 } }, do: [{ gain: { mat: 1 } }] },
    ],
    text: 'ラウンドの始めに、使い魔が1体以上なら食料+1、3体以上ならさらに素材+1。',
  },
  // ---- quest ----
  {
    id: 't_safe', kind: 'tool', name: '小さな金庫', engine: ['quest', 'trade'], mech: 'accrue',
    cost: { iron: 1, wood: 1 },
    effects: [
      { when: 'round_end', if: { res_min: { gold: 4 } }, do: [{ gain: { gold: 1 } }] },
      { when: 'winter', if: { res_min: { gold: 8 } }, do: [{ fame: 1 }] },
    ],
    text: 'ラウンドの終わりに金貨4以上を持っていれば金貨+1。冬に金貨8以上を持っていれば名声+1。',
  },
  // ---- ally ----
  {
    id: 't_signal', kind: 'tool', name: '狼煙台', engine: ['ally'], mech: 'social',
    cost: { wood: 2 },
    effects: [
      { when: 'other:nest', do: [{ steal_gain: { food: 1 } }], limit: 'round' },
      { when: 'win', if: { coop: true }, do: [{ gain: { mat: 1 } }] },
    ],
    text: '他の人が巣を使うと食料1を得る（ラウンド1回）。共闘で勝つと素材+1。',
  },
  // ---- ruins ----
  {
    id: 't_dig_tools', kind: 'tool', name: '発掘道具', engine: ['ruins', 'gather'], mech: 'instead',
    cost: { wood: 1, iron: 1 },
    effects: [{ when: 'instead:mine', do: [{ draw: { from: 'ancient', look: 1, take: 1 } }, { gain: { iron: 1 } }], limit: 'year' }],
    text: '鉄の坑道に置いたとき、代わりに古代の品を1枚引き、鉄1を得られる（1年に1回）。',
  },
  // ================================================================ v2 拡張（45 枚）
  // ---- hunt ----
  {
    id: 't_war_drum', kind: 'tool', name: '陣太鼓', engine: ['hunt', 'ally'], mech: 'combat',
    cost: { wood: 2, mat: 1 },
    effects: [{ when: 'passive', mod: { power: 1 } }],
    text: '戦闘のたびに戦力+1。',
  },
  {
    id: 't_trophy_rack', kind: 'tool', name: '獲物の剥製棚', engine: ['hunt'], mech: 'endfame',
    cost: { wood: 2 },
    effects: [{ when: 'game_end', do: [{ fame_per: { stat: 'kills', per: 3, max: 4 } }] }],
    text: '終わりに倒した魔物3体につき名声+1（最大4）。',
  },
  {
    id: 't_hunting_hut', kind: 'tool', name: '狩りの番小屋', engine: ['hunt', 'beast'], mech: 'boost',
    cost: { wood: 3 },
    effects: [{ when: 'use:nest', do: [{ gain: { food: 1 } }], limit: 'round' }],
    text: '巣を使うと食料+1（ラウンド1回）。',
  },
  {
    id: 't_whetstone', kind: 'tool', name: '研ぎ場', engine: ['hunt', 'smith'], mech: 'combat',
    cost: { wood: 1, iron: 1 },
    effects: [
      { when: 'fight', do: [{ power: 1 }] },
      { when: 'craft', do: [{ fame: 1 }], limit: 'year' },
    ],
    text: '戦闘で戦力+1。1年に1回、装備を作ると名声+1。',
  },
  // ---- gather ----
  {
    id: 't_drying_rack', kind: 'tool', name: '干し場', engine: ['gather', 'family'], mech: 'convert',
    cost: { wood: 3 },
    effects: [{ when: 'round_end', do: [{ convert: { from: { herb: 3 }, to: { food: 2 } } }], limit: 'round' }],
    text: 'ラウンドの終わりに薬草3を食料2に替えてよい（ラウンド1回）。',
  },
  {
    id: 't_sawmill', kind: 'tool', name: '製材所', engine: ['gather', 'fort'], mech: 'boost',
    cost: { wood: 2, iron: 1 },
    effects: [
      { when: 'passive', mod: { accum_bonus: { forest: 1 } } },
      { when: 'passive', mod: { cost_discount: { kind: 'bed', res: { wood: 1 } } } },
    ],
    text: '古の森を使うと、たまった分に加えて木材1多く取れる。寝床は木材1安い。',
  },
  {
    id: 't_seedbed', kind: 'tool', name: '苗床', engine: ['gather', 'arcane'], mech: 'accrue',
    cost: { wood: 1, herb: 1 },
    effects: [{ when: 'round_start', if: { season: 'spring' }, do: [{ gain: { herb: 1 } }] }],
    text: '春のラウンドの始めに薬草+1。',
  },
  // ---- trade ----
  {
    id: 't_stall', kind: 'tool', name: '露店', engine: ['trade'], mech: 'instead',
    cost: { wood: 2 },
    effects: [{ when: 'instead:plaza', do: [{ exchange: true }] }],
    text: '広場に置いたとき、代わりに交換所と同じく売るか買うを1回してよい。',
  },
  {
    id: 't_counting_house', kind: 'tool', name: '勘定場', engine: ['trade', 'quest'], mech: 'boost',
    cost: { wood: 2, gold: 2 },
    effects: [
      { when: 'buy', do: [{ fame: 1 }], limit: 'year' },
      { when: 'sell', do: [{ gain: { gold: 1 } }], limit: 'round' },
    ],
    text: '交換所で売ると金貨+1（ラウンド1回）。交換所で買うと名声+1（1年に1回）。',
  },
  {
    id: 't_wholesaler', kind: 'tool', name: '問屋の倉', engine: ['trade', 'gather'], mech: 'convert',
    cost: { wood: 3 },
    effects: [
      { when: 'passive', mod: { market_qty: 1 } },
      { when: 'round_end', do: [{ convert: { from: { mat: 1 }, to: { gold: 3 } } }], limit: 'round' },
    ],
    text: '交換所で一度に扱える数+1。ラウンドの終わりに素材1を金貨3に替えてよい（ラウンド1回）。',
  },
  // ---- fort ----
  {
    id: 't_watchtower', kind: 'tool', name: '物見櫓', engine: ['fort'], mech: 'boost',
    cost: { wood: 3, iron: 1 }, fame: 1,
    effects: [{ when: 'passive', mod: { base_guard: 1 } }],
    text: '名声1。拠点の守り+1。',
  },
  {
    id: 't_moat', kind: 'tool', name: '堀', engine: ['fort', 'gather'], mech: 'boost',
    cost: { wood: 2, iron: 2 },
    effects: [
      { when: 'passive', mod: { base_guard: 1 } },
      { when: 'use:meadow', do: [{ gain: { food: 1 } }] },
    ],
    text: '拠点の守り+1。薬草の野を使うたび食料+1（堀の魚）。',
  },
  {
    id: 't_barracks', kind: 'tool', name: '兵舎', engine: ['fort', 'family'], mech: 'boost',
    cost: { wood: 5 },
    effects: [
      { when: 'passive', mod: { bed_cap: 1 } },
      { when: 'fight', do: [{ guard: 1 }] },
    ],
    text: '寝床1つぶんになる。戦闘で守り+1。',
  },
  {
    id: 't_lumberyard', kind: 'tool', name: '資材置き場', engine: ['fort', 'gather'], mech: 'action',
    cost: { wood: 2 },
    effects: [{ when: 'round_end', do: [{ build: 'wall' }], limit: 'year' }],
    text: 'ラウンドの終わりに防壁を1つ建ててよい（費用は払う。1年に1回）。',
  },
  // ---- smith ----
  {
    id: 't_furnace', kind: 'tool', name: '溶鉱炉', engine: ['smith', 'gather'], mech: 'convert',
    cost: { wood: 2, iron: 1 },
    effects: [{ when: 'round_end', do: [{ convert: { from: { wood: 2 }, to: { iron: 2 } } }], limit: 'round' }],
    text: 'ラウンドの終わりに木材2を鉄2に替えてよい（ラウンド1回）。',
  },
  {
    id: 't_armory', kind: 'tool', name: '武具庫', engine: ['smith', 'fort'], mech: 'endfame',
    cost: { wood: 3 },
    effects: [{ when: 'game_end', do: [{ fame_per: { stat: 'gear', per: 2, max: 4 } }] }],
    text: '終わりに持たせた装備2つにつき名声+1（最大4）。',
  },
  {
    id: 't_grinder', kind: 'tool', name: '研ぎ師の輪', engine: ['smith', 'trade'], mech: 'convert',
    cost: { wood: 1, iron: 1 },
    effects: [{ when: 'craft', do: [{ gain: { gold: 2 } }], limit: 'round' }, { when: 'craft', do: [{ fame: 1 }], limit: 'year' }],
    text: '装備を作ると金貨+2（ラウンド1回）。1年に1回、装備を作ると名声+1。',
  },
  // ---- family ----
  {
    id: 't_nursery', kind: 'tool', name: '子ども部屋', engine: ['family'], mech: 'accrue',
    cost: { wood: 4 },
    effects: [{ when: 'winter', if: { min: { comps: 5 } }, do: [{ gain: { food: 2 } }] }],
    text: '冬（維持費のあと）に、仲間が5人以上なら食料+2。',
  },
  {
    id: 't_long_table', kind: 'tool', name: '長い食卓', engine: ['family', 'ally'], mech: 'endfame',
    cost: { wood: 3 },
    effects: [{ when: 'winter', if: { min: { comps: 5 } }, do: [{ fame: 1 }] }],
    text: '冬に仲間が5人以上なら名声+1。',
  },
  {
    id: 't_well', kind: 'tool', name: '井戸', engine: ['family', 'gather'], mech: 'accrue',
    cost: { wood: 3, iron: 1 },
    effects: [{ when: 'round_start', if: { season: 'summer' }, do: [{ gain: { food: 1 } }] }],
    text: '夏のラウンドの始めに食料+1。',
  },
  // ---- arcane ----
  {
    id: 't_magic_circle', kind: 'tool', name: '魔法陣', engine: ['arcane'], mech: 'endfame',
    cost: { wood: 1, mana: 1 },
    effects: [{ when: 'spell', do: [{ fame: 1 }], limit: 'year' }],
    text: '秘術を使うと名声+1（1年に1回）。',
  },
  {
    id: 't_study', kind: 'tool', name: '書斎', engine: ['arcane', 'ruins'], mech: 'action',
    cost: { wood: 2 },
    effects: [{ when: 'round_start', if: { season: 'spring' }, do: [{ draw: { from: 'spell', look: 2, take: 1 } }] }],
    text: '春のラウンドの始めに、秘術の山から2枚見て1枚を手札に。',
  },
  {
    id: 't_crystal_garden', kind: 'tool', name: '水晶の庭', engine: ['arcane', 'gather'], mech: 'boost',
    cost: { wood: 2, herb: 1 },
    effects: [{ when: 'use:spring', do: [{ gain: { mana: 1 } }] }],
    text: '魔石の泉を使うたび魔石+1。',
  },
  {
    id: 't_mana_tower', kind: 'tool', name: '魔力の塔', engine: ['arcane', 'boss'], mech: 'combat',
    cost: { wood: 2, iron: 1, mana: 1 },
    effects: [{ when: 'fight', if: { min: { spells: 1 } }, do: [{ power: 1 }, { counter: -1 }] }],
    text: 'これまでに秘術を使っていれば、戦闘で戦力+1・反撃−1。',
  },
  // ---- beast ----
  {
    id: 't_kennel_yard', kind: 'tool', name: '犬舎', engine: ['beast', 'fort'], mech: 'boost',
    cost: { wood: 2 },
    effects: [
      { when: 'passive', mod: { pet_power: 1 } },
      { when: 'winter', if: { min: { pets: 1 } }, do: [{ gain: { gold: 1 } }] },
    ],
    text: '使い魔の戦力+1。冬に使い魔がいれば金貨+1（番犬の手間賃）。',
  },
  {
    id: 't_feed_store', kind: 'tool', name: '飼料小屋', engine: ['beast', 'gather'], mech: 'accrue',
    cost: { wood: 2 },
    effects: [{ when: 'winter', do: [{ gain_per: { stat: 'pets', per: 1, gain: { mat: 1 }, max: 3 } }] }],
    text: '冬に使い魔1体につき素材+1（最大3）。',
  },
  {
    id: 't_beast_pen', kind: 'tool', name: '囲い場', engine: ['beast'], mech: 'instead',
    cost: { wood: 4 },
    effects: [{ when: 'instead:plaza', do: [{ pay: { food: 4 } }, { tame: true }], limit: 'year' }],
    text: '広場に置いたとき、代わりに食料4を払って巣の獣1体を使い魔にできる（1年に1回）。',
  },
  {
    id: 't_saddlery', kind: 'tool', name: '鞍作り', engine: ['beast', 'hunt'], mech: 'combat',
    cost: { wood: 1, mat: 1 },
    effects: [{ when: 'fight', if: { min: { pets: 2 } }, do: [{ power: 1 }, { counter: -1 }] }],
    text: '使い魔が2体以上いれば、戦闘で戦力+1・反撃−1。',
  },
  // ---- quest ----
  {
    id: 't_notice_board', kind: 'tool', name: '掲示板', engine: ['quest'], mech: 'boost',
    cost: { wood: 2 },
    effects: [{ when: 'use:board', do: [{ gain: { food: 1, mat: 1 } }] }],
    text: '依頼板を使うたび食料1・素材1を得る。',
  },
  {
    id: 't_memento', kind: 'tool', name: '依頼の記念品', engine: ['quest'], mech: 'endfame',
    cost: { wood: 2 }, fame: 1,
    effects: [{ when: 'game_end', if: { min: { quests: 2 } }, do: [{ fame: 2 }] }],
    text: '名声1。終わりに共通の依頼を2つ以上達成していれば名声+2。',
  },
  {
    id: 't_messenger_post', kind: 'tool', name: '伝令所', engine: ['quest', 'ally'], mech: 'social',
    cost: { wood: 2, gold: 1 },
    effects: [
      { when: 'other:board', do: [{ steal_gain: { gold: 1 } }], limit: 'round' },
      { when: 'quest', do: [{ gain: { food: 2 } }] },
    ],
    text: '他の人が依頼板を使うと金貨1を得る（ラウンド1回）。共通の依頼を達成するたび食料+2。',
  },
  {
    id: 't_guild_office', kind: 'tool', name: 'ギルドの出張所', engine: ['quest', 'trade'], mech: 'accrue',
    cost: { wood: 2, iron: 2 },
    effects: [
      { when: 'quest', do: [{ fame: 1 }] },
      { when: 'round_start', if: { min: { quests: 1 } }, do: [{ gain: { gold: 1 } }] },
    ],
    text: '共通の依頼を達成するたび名声+1。共通の依頼を1つ以上達成していれば、ラウンドの始めに金貨+1。',
  },
  // ---- ally ----
  {
    id: 't_inn', kind: 'tool', name: '宿場', engine: ['ally', 'family'], mech: 'social',
    cost: { wood: 3 },
    effects: [
      { when: 'other:hall', do: [{ steal_gain: { food: 1 } }], limit: 'round' },
      { when: 'passive', mod: { trade_count: 1 } },
    ],
    text: '他の人が集会所を使うと食料1を得る（ラウンド1回）。1ラウンドにできる取引の回数+1。',
  },
  {
    id: 't_rally_point', kind: 'tool', name: '集合場', engine: ['ally', 'hunt'], mech: 'combat',
    cost: { wood: 2, iron: 1 },
    effects: [{ when: 'fight', if: { coop: true }, do: [{ power: 2 }] }],
    text: '共闘のとき戦力+2。',
  },
  {
    id: 't_shared_kitchen', kind: 'tool', name: '共同炊事場', engine: ['ally', 'family'], mech: 'social',
    cost: { wood: 2 },
    effects: [{ when: 'round_end', do: [{ gain: { food: 2 } }, { others_gain: { food: 1 } }], limit: 'round' }],
    text: 'ラウンドの終わりに食料+2。他の人全員も食料+1。',
  },
  {
    id: 't_trade_route', kind: 'tool', name: '交易路', engine: ['ally', 'trade'], mech: 'social',
    cost: { wood: 2, gold: 2 },
    effects: [
      { when: 'trade', do: [{ gain: { mat: 1 } }, { fame: 1 }], limit: 'year' },
      { when: 'other:market', do: [{ steal_gain: { gold: 1 } }], limit: 'round' },
    ],
    text: '取引が成立すると素材+1・名声+1（1年に1回）。他の人が交換所を使うと金貨1を得る（ラウンド1回）。',
  },
  // ---- ruins ----
  {
    id: 't_excavation', kind: 'tool', name: '発掘現場', engine: ['ruins'], mech: 'accrue',
    cost: { wood: 2, iron: 1 },
    effects: [{ when: 'round_start', if: { season: 'autumn' }, do: [{ draw: { from: 'ancient', look: 1, take: 1 } }] }],
    text: '秋のラウンドの始めに古代の品を1枚引く。',
  },
  {
    id: 't_gallery', kind: 'tool', name: '陳列室', engine: ['ruins', 'quest'], mech: 'endfame',
    cost: { wood: 3 }, fame: 1,
    effects: [{ when: 'game_end', if: { min: { ancient: 3 } }, do: [{ fame: 2 }] }],
    text: '名声1。終わりに古代の品が3つ以上なら名声+2。',
  },
  {
    id: 't_lens', kind: 'tool', name: '鑑定眼鏡', engine: ['ruins', 'trade'], mech: 'boost',
    cost: { iron: 1, mana: 1 },
    effects: [{ when: 'use:ruins', do: [{ gain: { gold: 2 } }] }],
    text: '遺跡の探索を使うたび金貨+2。',
  },
  {
    id: 't_rubbing_kit', kind: 'tool', name: '拓本道具', engine: ['ruins', 'arcane'], mech: 'instead',
    cost: { wood: 1, herb: 1 },
    effects: [{ when: 'instead:meadow', do: [{ draw: { from: 'ancient', look: 2, take: 1 } }], limit: 'year' }],
    text: '薬草の野に置いたとき、代わりに古代の品を2枚見て1枚取れる（1年に1回）。',
  },
  // ---- boss ----
  {
    id: 't_war_room', kind: 'tool', name: '作戦室', engine: ['boss', 'ally'], mech: 'combat',
    cost: { wood: 3 },
    effects: [
      { when: 'fight', if: { boss: true }, do: [{ power: 2 }] },
      { when: 'fight', if: { boss: true, coop: true }, do: [{ power: 1 }] },
      { when: 'win', if: { boss: true }, do: [{ gain: { food: 3 } }] },
    ],
    text: '主・古竜との戦闘で戦力+2（共闘ならさらに+1）。主・古竜を倒すと食料+3（凱旋の宴）。',
  },
  {
    id: 't_victory_shrine', kind: 'tool', name: '戦勝の祠', engine: ['boss'], mech: 'endfame',
    cost: { wood: 2, mana: 1 },
    effects: [
      { when: 'win', if: { boss: true }, do: [{ fame: 2 }] },
      { when: 'lose', if: { boss: true }, do: [{ fame: 1 }] },
      { when: 'game_end', do: [{ fame_per: { stat: 'boss', per: 1, max: 2 } }] },
    ],
    text: '主・古竜を倒すたび名声+2。主・古竜に負けても名声+1（挑んだ誉れ）。終わりに倒した主・古竜1体につき名声+1（最大2）。',
  },
  {
    id: 't_field_hospital', kind: 'tool', name: '野戦病院', engine: ['boss', 'family'], mech: 'boost',
    cost: { wood: 2, herb: 2 },
    effects: [
      { when: 'passive', mod: { heal_discount: 1 } },
      { when: 'lose', do: [{ heal: 1 }] },
      { when: 'win', if: { boss: true }, do: [{ heal: 2 }] },
    ],
    text: '負傷の回復が薬草1安い。負けたとき負傷した仲間1人を回復。主・古竜を倒すと負傷した仲間を2人まで回復。',
  },
  {
    id: 't_ballista', kind: 'tool', name: '大弩', engine: ['boss', 'fort'], mech: 'combat',
    cost: { wood: 3, iron: 1 },
    effects: [
      { when: 'fight', if: { boss: true }, do: [{ power: 3 }] },
      { when: 'game_end', do: [{ fame_per: { stat: 'boss', per: 1, max: 2 } }] },
    ],
    text: '主・古竜との戦闘で戦力+3。終わりに倒した主・古竜1体につき名声+1（最大2）。',
  },
  {
    id: 't_dragon_trap', kind: 'tool', name: '竜の罠', engine: ['boss', 'hunt'], mech: 'combat',
    cost: { iron: 2, mat: 1 },
    effects: [
      { when: 'fight', if: { race: 'dragon' }, do: [{ str: -2 }] },
      { when: 'fight', if: { boss: true }, do: [{ counter: -1 }, { str: -1 }] },
      { when: 'win', if: { race: 'dragon' }, do: [{ fame: 1 }] },
    ],
    text: '竜との戦闘で魔物の強さ−2。主・古竜との戦闘で魔物の強さ−1・反撃−1（竜の主なら両方）。竜に勝つたび名声+1。',
  },
];
