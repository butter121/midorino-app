// 霧谷の冒険者団 v2 — リーダー（30 人。強い動き 1 つにつき 2〜3 人）
// 効果は SPEC §8 の DSL。text は機械的な説明（ローカル LLM で清書する）。
import type { CardDef } from '../types';

export const LEADERS: CardDef[] = [
  {
    id: 'l_riku', kind: 'leader', name: '魔物狩りのリク', engine: ['hunt'], mech: 'combat',
    effects: [
      { when: 'setup', do: [{ gain: { iron: 2 } }] },
      { when: 'win', do: [{ loot: 2 }, { gain: { food: 1 } }], limit: 'round' },
      { when: 'fight', do: [{ power: 1 }] },
      { when: 'win', do: [{ fame: 1 }], limit: 'year' },
    ],
    text: '始めに鉄+2。魔物に勝つと戦利品+2・食料+1（ラウンド1回）。戦闘で戦力+1。1年に1回、魔物に勝つと名声+1。',
  },
  {
    id: 'l_toma', kind: 'leader', name: '森の弓使いトーマ', engine: ['gather'], mech: 'boost',
    effects: [
      { when: 'use:forest', do: [{ gain: { wood: 1 } }] },
      { when: 'use:meadow', do: [{ gain: { herb: 1 } }] },
    ],
    text: '古の森を使うたび木材+1。薬草の野を使うたび薬草+1。',
  },
  {
    id: 'l_leo', kind: 'leader', name: '闇市の商人レオ', engine: ['trade'], mech: 'social',
    effects: [
      { when: 'passive', mod: { market_qty: 1 } },
      { when: 'other:market', do: [{ steal_gain: { gold: 1 } }], limit: 'round' },
      { when: 'sell', do: [{ fame: 1 }], limit: 'year' },
    ],
    text: '交換所で扱える数+1。他の人が交換所を使うと金貨1を得る（ラウンド1回）。交換所で売ると名声+1（1年に1回）。',
  },
  {
    id: 'l_goro', kind: 'leader', name: '城塞の騎士ゴロウ', engine: ['fort'], mech: 'boost',
    effects: [
      { when: 'passive', mod: { base_guard: 1 } },
      { when: 'build', do: [{ gain: { wood: 1 } }], limit: 'round' },
      { when: 'build', do: [{ fame: 1 }], limit: 'year' },
    ],
    text: '拠点の守り+1。施設・寝床・防壁を建てると木材1が戻る（ラウンド1回）。1年に1回、建てると名声+1。',
  },
  {
    id: 'l_gan', kind: 'leader', name: 'ドワーフの鍛冶師ガン', engine: ['smith'], mech: 'convert',
    effects: [
      { when: 'setup', do: [{ gain: { iron: 2 } }] },
      { when: 'craft', do: [{ gain: { iron: 1 } }], limit: 'round' },
      { when: 'use:forge', do: [{ gain: { iron: 1, wood: 1 } }] },
      { when: 'craft', do: [{ fame: 1 }], limit: 'round' },
    ],
    text: '始めに鉄+2。装備を作ると鉄1が戻り、名声+1（それぞれラウンド1回）。鍛冶場を使うたび鉄1と木材1を得る。',
  },
  {
    id: 'l_momo', kind: 'leader', name: '野営の料理人モモ', engine: ['family'], mech: 'convert',
    effects: [
      { when: 'setup', do: [{ gain: { food: 2 } }] },
      { when: 'passive', mod: { upkeep: -1 } },
    ],
    text: '始めに食料+2。冬の維持費が食料1少ない。',
  },
  {
    id: 'l_mina', kind: 'leader', name: '土くれの魔導士ミナ', engine: ['arcane'], mech: 'accrue',
    effects: [
      { when: 'spell', do: [{ gain: { mana: 1 } }], limit: 'round' },
      { when: 'use:spring', do: [{ gain: { mana: 1 } }] },
      { when: 'spell', do: [{ fame: 1 }], limit: 'year' },
    ],
    text: '秘術を使うと魔石1が戻る（ラウンド1回）。魔石の泉を使うたび魔石+1。1年に1回、秘術を使うと名声+1。',
  },
  {
    id: 'l_haru', kind: 'leader', name: '獣使いのハル', engine: ['beast'], mech: 'instead',
    effects: [
      { when: 'instead:nest', if: { race: 'beast' }, do: [{ pay: { food: 3 } }, { tame: true }] },
      { when: 'passive', mod: { pet_power: 1 } },
      { when: 'tame', do: [{ fame: 1 }], limit: 'year' },
    ],
    text: '獣のいる巣に置いたとき、戦う代わりに食料3を払って使い魔にできる。使い魔の戦力+1。使い魔を得ると名声+1（1年に1回）。',
  },
  {
    id: 'l_jin', kind: 'leader', name: '賞金稼ぎのジン', engine: ['quest'], mech: 'boost',
    effects: [
      { when: 'use:board', do: [{ gain: { gold: 1 } }] },
      { when: 'use:board', do: [{ fame: 1 }], limit: 'year' },
      { when: 'win', do: [{ gain: { gold: 1 } }], limit: 'round' },
      { when: 'quest', do: [{ fame: 2 }] },
      { when: 'game_end', do: [{ fame_per: { stat: 'quests', per: 1, max: 2 } }] },
    ],
    text: '依頼板を使うたび金貨+1（1年に1回は名声+1も）。魔物に勝つと金貨+1（ラウンド1回）。共通の依頼を達成するたび名声+2。終わりに達成した共通の依頼1つにつき名声+1（最大2）。',
  },
  {
    id: 'l_aya', kind: 'leader', name: '旅の吟遊詩人アヤ', engine: ['ally'], mech: 'social',
    effects: [
      { when: 'fight', if: { coop: true }, do: [{ power: 2 }] },
      { when: 'trade', do: [{ gain: { gold: 1 } }], limit: 'round' },
    ],
    text: '共闘のとき戦力+2。取引が成立すると金貨+1（ラウンド1回）。',
  },
  {
    id: 'l_yuki', kind: 'leader', name: '星詠みの巫女ユキ', engine: ['ruins'], mech: 'instead',
    effects: [
      { when: 'instead:spring', do: [{ draw: { from: 'ancient', look: 2, take: 1 } }], limit: 'year' },
      { when: 'use:ruins', do: [{ gain: { mana: 1 } }] },
      { when: 'use:ruins', do: [{ fame: 1 }], limit: 'year' },
    ],
    text: '魔石の泉に置いたとき、魔石の代わりに古代の品を2枚見て1枚取れる（1年に1回）。遺跡の探索を使うたび魔石+1。1年に1回、遺跡の探索を使うと名声+1。',
  },
  {
    id: 'l_nana', kind: 'leader', name: '光の神官ナナ', engine: ['boss'], mech: 'combat',
    effects: [
      { when: 'fight', if: { boss: true }, do: [{ power: 3 }] },
      { when: 'fight', if: { t_min: 0.5 }, do: [{ power: 1 }] },
      { when: 'fight', do: [{ counter: -1 }] },
      { when: 'win', if: { boss: true }, do: [{ fame: 3 }, { gain: { food: 2 } }] },
      { when: 'lose', do: [{ heal: 1 }], limit: 'round' },
    ],
    text: '戦闘で反撃−1。試合の後半（進み具合5割から）の戦闘で戦力+1。主・古竜との戦闘で戦力+3、勝てば名声+3・食料+2。負けたとき負傷した仲間1人を回復（ラウンド1回）。',
  },
  // ================================================================ 2人目・3人目（v2 拡張）
  {
    id: 'l_kaede', kind: 'leader', name: '双剣のカエデ', engine: ['hunt', 'ally'], mech: 'combat',
    effects: [
      { when: 'setup', do: [{ gain: { wood: 2, food: 1 } }] },
      { when: 'fight', if: { k_min: 2 }, do: [{ power: 2 }] },
      { when: 'win', do: [{ gain: { mat: 1 } }], limit: 'round' },
      { when: 'win', if: { k_min: 2 }, do: [{ fame: 1 }], limit: 'year' },
    ],
    text: '始めに木材2・食料1を得る。2人以上で挑むと戦力+2。魔物に勝つと素材+1（ラウンド1回）。2人以上で勝つと名声+1（1年に1回）。',
  },
  {
    id: 'l_sora', kind: 'leader', name: '薬師のソラ', engine: ['gather', 'boss'], mech: 'boost',
    effects: [
      { when: 'use:meadow', do: [{ gain: { herb: 1 } }] },
      { when: 'passive', mod: { heal_discount: 1 } },
      { when: 'use:any_accum', do: [{ gain: { mat: 1 } }], limit: 'round' },
    ],
    text: '薬草の野を使うたび薬草+1。負傷の回復が薬草1安い。たまるマスを使うと素材+1（ラウンド1回）。',
  },
  {
    id: 'l_kin', kind: 'leader', name: '両替屋のキン', engine: ['trade'], mech: 'convert',
    effects: [
      { when: 'passive', mod: { sell_bonus: 1 } },
      { when: 'use:market', do: [{ fame: 1 }], limit: 'year' },
    ],
    text: '交換所の売値が1個につき金貨1高い。1年に1回、交換所を使うと名声+1。',
  },
  {
    id: 'l_otto', kind: 'leader', name: '隊商頭オットー', engine: ['trade', 'ally'], mech: 'social',
    effects: [
      { when: 'passive', mod: { market_both: true, trade_count: 1 } },
      { when: 'buy', do: [{ gain: { food: 1 } }], limit: 'round' },
    ],
    text: '交換所で、売ると買うを同じ手番でできる。1ラウンドにできる取引の回数+1。交換所で買うと食料+1（ラウンド1回）。',
  },
  {
    id: 'l_tetsu', kind: 'leader', name: '石垣のテツ', engine: ['fort', 'gather'], mech: 'endfame',
    effects: [
      { when: 'setup', do: [{ gain: { wood: 2 } }] },
      { when: 'passive', mod: { cost_discount: { kind: 'wall', res: { wood: 1 } }, base_guard: 1 } },
      { when: 'game_end', do: [{ fame_per: { stat: 'walls', per: 2, max: 3 } }] },
    ],
    text: '始めに木材+2。拠点の守り+1。防壁は木材1安い。終わりに防壁2つにつき名声+1（最大3）。',
  },
  {
    id: 'l_hagane', kind: 'leader', name: '刀匠ハガネ', engine: ['smith', 'hunt'], mech: 'convert',
    effects: [
      { when: 'setup', do: [{ gain: { iron: 1, wood: 1 } }] },
      { when: 'passive', mod: { cost_discount: { kind: 'weapon', res: { iron: 1 } } } },
      { when: 'craft', do: [{ gain: { gold: 2 } }], limit: 'round' },
      { when: 'craft', do: [{ fame: 1 }], limit: 'year' },
    ],
    text: '始めに鉄1・木材1を得る。武器（共通の装備・武具カード）を作る費用が鉄1安い。装備を作ると金貨+2（ラウンド1回）。1年に1回、装備を作ると名声+1。',
  },
  {
    id: 'l_bea', kind: 'leader', name: '鎧職人ベア', engine: ['smith', 'fort'], mech: 'endfame',
    effects: [
      { when: 'setup', do: [{ gain: { mat: 2 } }] },
      { when: 'passive', mod: { cost_discount: { kind: 'armor', res: { iron: 1, mat: 1 } } } },
      { when: 'craft', do: [{ gain: { mat: 1 } }], limit: 'round' },
      { when: 'craft', do: [{ fame: 1 }], limit: 'year' },
      { when: 'game_end', do: [{ fame_per: { stat: 'gear', per: 2, max: 3 } }] },
    ],
    text: '始めに素材+2。防具を作る費用が鉄1・素材1安い。装備を作ると素材+1（ラウンド1回）。1年に1回、装備を作ると名声+1。終わりに持たせた装備2つにつき名声+1（最大3）。',
  },
  {
    id: 'l_oba', kind: 'leader', name: '大家族のオバ', engine: ['family'], mech: 'boost',
    effects: [
      { when: 'passive', mod: { bed_cap: 1 } },
      { when: 'game_end', if: { min: { comps: 6 } }, do: [{ fame: 1 }] },
    ],
    text: '寝床が1つ多いものとして数える。終わりに仲間が6人なら名声+1。',
  },
  {
    id: 'l_ren', kind: 'leader', name: '時詠みのレン', engine: ['arcane', 'ruins'], mech: 'accrue',
    effects: [
      { when: 'setup', do: [{ draw: { from: 'spell', look: 3, take: 1 } }] },
      { when: 'round_start', if: { season: 'spring' }, do: [{ gain: { mana: 1 } }] },
      { when: 'spell', do: [{ gain: { herb: 1 } }], limit: 'round' },
    ],
    text: '始めに秘術の山から3枚見て1枚を手札に。春のラウンドの始めに魔石+1。秘術を使うと薬草+1（ラウンド1回）。',
  },
  {
    id: 'l_kuro', kind: 'leader', name: '狼連れのクロ', engine: ['beast', 'hunt'], mech: 'combat',
    effects: [
      { when: 'passive', mod: { pet_power: 1 } },
      { when: 'fight', if: { min: { pets: 1 } }, do: [{ counter: -1 }] },
      { when: 'tame', do: [{ gain: { food: 2 } }] },
      { when: 'win_race:beast', do: [{ gain: { food: 1 } }, { fame: 1 }], limit: 'year' },
    ],
    text: '使い魔の戦力+1。使い魔がいれば戦闘で反撃−1。使い魔を得るたび食料+2。獣に勝つと食料+1・名声+1（1年に1回）。',
  },
  {
    id: 'l_fuu', kind: 'leader', name: '鷹の目のフウ', engine: ['beast', 'ruins'], mech: 'instead',
    effects: [
      { when: 'instead:spring', do: [{ pay: { food: 2 } }, { tame: true }], limit: 'year' },
      { when: 'use:ruins', do: [{ gain: { food: 1, mat: 1 } }] },
    ],
    text: '魔石の泉に置いたとき、代わりに食料2を払って巣の獣1体を使い魔にできる（1年に1回）。遺跡の探索を使うたび食料1・素材1を得る。',
  },
  {
    id: 'l_shin', kind: 'leader', name: '書記官シン', engine: ['quest', 'family'], mech: 'action',
    effects: [
      { when: 'quest', do: [{ fame: 1 }, { gain: { food: 2 } }] },
      { when: 'use:board', do: [{ draw: { from: 'occ', look: 2, take: 1 } }], limit: 'year' },
      { when: 'occ', do: [{ gain: { gold: 1 } }], limit: 'round' },
    ],
    text: '共通の依頼を達成するたび名声+1・食料+2。依頼板を使うと職能の山から2枚見て1枚を手札に（1年に1回）。職能を出すと金貨+1（ラウンド1回）。',
  },
  {
    id: 'l_maru', kind: 'leader', name: '便利屋マル', engine: ['quest', 'gather'], mech: 'boost',
    effects: [
      { when: 'use:board', do: [{ gain: { food: 1, mat: 1 } }] },
      { when: 'instead:board', do: [{ gain: { wood: 1, iron: 1, herb: 1 } }] },
    ],
    text: '依頼板を使うたび食料1・素材1を得る。依頼板に置いたとき、金貨の代わりに木材1・鉄1・薬草1を得てもよい。',
  },
  {
    id: 'l_tsubasa', kind: 'leader', name: '傭兵団長ツバサ', engine: ['ally', 'boss'], mech: 'combat',
    effects: [
      { when: 'fight', if: { coop: true }, do: [{ counter: -2 }, { no_injury: 1 }] },
      { when: 'fight', if: { boss: true }, do: [{ power: 1 }] },
      { when: 'win', if: { coop: true }, do: [{ fame: 1 }] },
    ],
    text: '共闘のとき反撃−2、負傷を1人防ぐ。主・古竜との戦闘で戦力+1。共闘で勝つたび名声+1。',
  },
  {
    id: 'l_hina', kind: 'leader', name: '調停者ヒナ', engine: ['ally', 'trade'], mech: 'social',
    effects: [
      { when: 'other:nest', do: [{ steal_gain: { gold: 1 } }], limit: 'round' },
      { when: 'fight', if: { coop: true }, do: [{ power: 1 }] },
      { when: 'win', if: { coop: true }, do: [{ gain: { gold: 2, food: 1 } }] },
    ],
    text: '他の人が巣に置くと金貨1を得る（ラウンド1回）。共闘のとき戦力+1、勝てば金貨2・食料1。',
  },
  {
    id: 'l_akane', kind: 'leader', name: '遺跡荒らしアカネ', engine: ['ruins', 'hunt'], mech: 'combat',
    effects: [
      { when: 'use:ruins', do: [{ gain: { gold: 2 } }] },
      { when: 'win_race:undead', do: [{ draw: { from: 'ancient', look: 1, take: 1 } }], limit: 'year' },
      { when: 'fight', if: { race: ['undead', 'spirit'] }, do: [{ power: 1 }] },
    ],
    text: '遺跡の探索を使うたび金貨+2。不死・精霊との戦闘で戦力+1。不死に勝つと古代の品を1枚引く（1年に1回）。',
  },
  {
    id: 'l_gai', kind: 'leader', name: '竜騎士ガイ', engine: ['boss', 'beast'], mech: 'combat',
    effects: [
      { when: 'fight', if: { boss: true }, do: [{ power: 2 }] },
      { when: 'fight', if: { race: 'dragon' }, do: [{ power: 2 }] },
      { when: 'passive', mod: { pet_power: 1 } },
      { when: 'win', if: { boss: true }, do: [{ fame: 2 }] },
      { when: 'game_end', do: [{ fame_per: { stat: 'boss', per: 2, max: 2 } }] },
    ],
    text: '主・古竜との戦闘で戦力+2、竜との戦闘でさらに戦力+2。使い魔の戦力+1。主・古竜を倒すたび名声+2。終わりに倒した主・古竜2体につき名声+1（最大2）。',
  },
  {
    id: 'l_rin', kind: 'leader', name: '聖女リン', engine: ['boss', 'fort'], mech: 'combat',
    effects: [
      { when: 'fight', if: { boss: true }, do: [{ counter: -2 }, { guard: 2 }, { power: 2 }] },
      { when: 'fight', if: { t_min: 0.5 }, do: [{ power: 1 }] },
      { when: 'lose', do: [{ heal: 2 }], limit: 'round' },
      { when: 'win', if: { boss: true }, do: [{ fame: 3 }] },
      { when: 'passive', mod: { base_guard: 1 } },
    ],
    text: '拠点の守り+1。試合の後半（進み具合5割から）の戦闘で戦力+1。主・古竜との戦闘で戦力+2・守り+2・反撃−2、倒すたび名声+3。負けたとき負傷した仲間を2人まで回復（ラウンド1回）。',
  },
];
