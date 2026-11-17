// 霧谷の冒険者団 v2 — 職能カード（60 枚。強い動き 1 つにつき主に 5 枚）
// 出し方：ギルド（食料1、2枚目以降は食料2）。cost はその上乗せ分。
import type { CardDef } from '../types';

export const OCCUPATIONS: CardDef[] = [
  // ---- hunt ----
  {
    id: 'o_butcher', kind: 'occ', name: '解体職人', engine: ['hunt'], mech: 'boost',
    effects: [
      { when: 'win', do: [{ loot: 1 }] },
      { when: 'win_race:beast', do: [{ gain: { food: 1 } }] },
      { when: 'win', do: [{ fame: 1 }], limit: 'year' },
    ],
    text: '魔物に勝つたび戦利品+1。獣に勝つとさらに食料+1。1年に1回、魔物に勝つと名声+1。',
  },
  // ---- gather ----
  {
    id: 'o_lumberjack', kind: 'occ', name: '木こり', engine: ['gather'], mech: 'boost',
    effects: [
      { when: 'use:forest', do: [{ gain: { wood: 1 } }] },
    ],
    text: '古の森を使うたび木材+1。',
  },
  {
    id: 'o_miner', kind: 'occ', name: '坑夫', engine: ['gather', 'smith'], mech: 'boost',
    effects: [
      { when: 'use:mine', do: [{ gain: { iron: 1 } }] },
      { when: 'winter', do: [{ convert: { from: { iron: 1 }, to: { food: 2 } } }] },
    ],
    text: '鉄の坑道を使うたび鉄+1。冬に鉄1を食料2に替えてよい。',
  },
  // ---- trade ----
  {
    id: 'o_peddler', kind: 'occ', name: '行商人', engine: ['trade', 'hunt'], mech: 'convert',
    effects: [
      { when: 'passive', mod: { market_both: true } },
      { when: 'use:market', do: [{ gain: { gold: 1 } }] },
    ],
    text: '交換所で、売ると買うを同じ手番でできる。交換所を使うたび金貨+1。',
  },
  {
    id: 'o_broker', kind: 'occ', name: '仲買人', engine: ['trade', 'ally'], mech: 'social',
    effects: [
      { when: 'trade', do: [{ gain: { gold: 1 } }] },
      { when: 'passive', mod: { trade_count: 1 } },
      { when: 'sell', do: [{ gain: { gold: 1 } }], limit: 'round' },
    ],
    text: '取引が成立するたび金貨+1。1ラウンドにできる取引の回数+1。交換所で売ると金貨+1（ラウンド1回）。',
  },
  // ---- fort ----
  {
    id: 'o_engineer', kind: 'occ', name: '城壁の工兵', engine: ['fort'], mech: 'endfame',
    effects: [
      { when: 'build', if: { min: { walls: 2 } }, do: [{ fame: 1 }], limit: 'year' },
      { when: 'passive', mod: { cost_discount: { kind: 'wall', res: { wood: 1 } } } },
    ],
    text: '防壁は木材1安い。防壁が2つ以上あれば、施設・寝床・防壁を建てると名声+1（1年に1回）。',
  },
  // ---- smith ----
  {
    id: 'o_smith', kind: 'occ', name: '鉄打ち匠', engine: ['smith'], mech: 'convert',
    effects: [
      { when: 'passive', mod: { cost_discount: { kind: 'weapon', res: { iron: 1 } } } },
      { when: 'craft', do: [{ fame: 1 }], limit: 'round' },
    ],
    text: '武器（共通の装備・武具カード）を作る費用が鉄1安い。装備を作ると名声+1（ラウンド1回）。',
  },
  {
    id: 'o_armorer', kind: 'occ', name: '鎧師', engine: ['smith', 'fort'], mech: 'boost',
    prereq: { occs: 1 },
    effects: [
      { when: 'craft', do: [{ gain: { gold: 1 } }] },
      { when: 'passive', mod: { cost_discount: { kind: 'armor', res: { mat: 1 } } } },
      { when: 'craft', do: [{ fame: 1 }], limit: 'year' },
    ],
    text: '前提：職能1枚。装備を作るたび金貨+1。防具を作る費用が素材1安い。1年に1回、装備を作ると名声+1。',
  },
  // ---- family ----
  {
    id: 'o_innkeeper', kind: 'occ', name: '宿屋の主人', engine: ['family'], mech: 'instead',
    effects: [{ when: 'instead:hunt', do: [{ pay: { food: 4 } }, { hire: 1 }], limit: 'year' }],
    text: '狩場に置いたとき、食料を取る代わりに食料4を払って仲間を1人雇える（寝床が要る。1年に1回）。',
  },
  {
    id: 'o_matron', kind: 'occ', name: '寮母', engine: ['family'], mech: 'endfame',
    prereq: { occs: 2 },
    effects: [
      { when: 'instead:plaza', do: [{ gain: { food: 2 } }] },
      { when: 'game_end', if: { min: { comps: 5 } }, do: [{ fame: 1 }] },
    ],
    text: '前提：職能2枚。広場に置いたとき、代わりに食料2を得られる。終わりに仲間5人以上なら名声+1。',
  },
  // ---- arcane ----
  {
    id: 'o_apprentice', kind: 'occ', name: '魔導の弟子', engine: ['arcane'], mech: 'action',
    effects: [{ when: 'use:spring', do: [{ draw: { from: 'spell', look: 2, take: 1 } }], limit: 'year' }],
    text: '魔石の泉を使うと、秘術の山から2枚見て1枚を手札に（1年に1回）。',
  },
  // ---- beast ----
  {
    id: 'o_tamer', kind: 'occ', name: '魔獣の調教師', engine: ['beast'], mech: 'boost',
    effects: [
      { when: 'tame', do: [{ gain: { mat: 1 } }, { fame: 1 }] },
      { when: 'passive', mod: { pet_power: 1 } },
    ],
    text: '使い魔を得るたび素材+1・名声+1。使い魔の戦力+1。',
  },
  // ---- quest ----
  {
    id: 'o_bounty', kind: 'occ', name: '賞金首の掲示係', engine: ['quest', 'trade'], mech: 'social',
    effects: [
      { when: 'use:board', do: [{ gain: { gold: 2 } }] },
      { when: 'other:board', do: [{ steal_gain: { food: 1 } }], limit: 'round' },
      { when: 'quest', do: [{ fame: 1 }] },
    ],
    text: '依頼板を使うたび金貨+2。他の人が依頼板を使うと食料1を得る（ラウンド1回）。共通の依頼を達成するたび名声+1。',
  },
  // ---- ally ----
  {
    id: 'o_mediator', kind: 'occ', name: '交渉上手の仲介人', engine: ['ally'], mech: 'combat',
    effects: [
      { when: 'fight', if: { coop: true }, do: [{ power: 1 }] },
      { when: 'win', if: { coop: true }, do: [{ trophy: 1 }, { loot: 1 }] },
      { when: 'other:nest', do: [{ steal_gain: { food: 1 } }], limit: 'round' },
    ],
    text: '共闘のとき戦力+1。共闘で勝つと証+1・戦利品+1（自分の取り分に足す）。他の人が巣に置くと食料1を得る（ラウンド1回）。',
  },
  // ---- ruins ----
  {
    id: 'o_cartographer', kind: 'occ', name: '古地図の冒険家', engine: ['ruins'], mech: 'boost',
    effects: [
      { when: 'use:ruins', do: [{ gain: { gold: 1 } }] },
      { when: 'instead:ruins', do: [{ draw: { from: 'ancient', look: 3, take: 1 } }] },
    ],
    text: '遺跡の探索を使うたび金貨+1。遺跡の探索では、代わりに古代の品を3枚見て1枚取ってもよい。',
  },
  // ================================================================ v2 拡張（45 枚）
  // ---- hunt ----
  {
    id: 'o_gladiator', kind: 'occ', name: '剣闘士', engine: ['hunt'], mech: 'combat',
    effects: [
      { when: 'fight', if: { k_max: 1 }, do: [{ power: 3 }] },
      { when: 'win', if: { k_max: 1 }, do: [{ fame: 1 }], limit: 'year' },
    ],
    text: '1人で挑むと戦力+3。1人で勝つと名声+1（1年に1回）。',
  },
  {
    id: 'o_monster_scholar', kind: 'occ', name: '魔物学者', engine: ['hunt', 'arcane'], mech: 'combat',
    effects: [
      { when: 'fight', if: { weak: true }, do: [{ power: 1 }] },
      { when: 'win', if: { weak: true }, do: [{ trophy: 1 }] },
    ],
    text: '弱点を突くと戦力+1。弱点を突いて勝つと証+1。',
  },
  {
    id: 'o_skinner', kind: 'occ', name: '皮剥ぎ職人', engine: ['hunt', 'trade'], mech: 'convert',
    effects: [
      { when: 'win', do: [{ gain: { mat: 1, food: 1 } }], limit: 'round' },
      { when: 'win', do: [{ convert: { from: { mat: 2 }, to: { gold: 4 } } }], limit: 'round' },
    ],
    text: '魔物に勝つと素材1・食料1を得る。そのあと素材2を金貨4に替えてよい（それぞれラウンド1回）。',
  },
  {
    id: 'o_trapper', kind: 'occ', name: '罠師', engine: ['hunt', 'beast'], mech: 'boost',
    effects: [
      { when: 'use:hunt', do: [{ gain: { mat: 1 } }] },
      { when: 'fight', if: { race: 'beast' }, do: [{ str: -1 }] },
    ],
    text: '狩場を使うたび素材+1。獣との戦闘では魔物の強さ−1。',
  },
  // ---- gather ----
  {
    id: 'o_herbalist', kind: 'occ', name: '薬草師', engine: ['gather', 'boss'], mech: 'boost',
    effects: [
      { when: 'use:meadow', do: [{ gain: { herb: 1 } }] },
      { when: 'passive', mod: { heal_discount: 1 } },
      { when: 'round_end', do: [{ pay: { herb: 2 } }, { fame: 1 }], limit: 'year' },
    ],
    text: '薬草の野を使うたび薬草+1。負傷の回復が薬草1安い。ラウンドの終わりに薬草2を納めて名声+1にしてよい（1年に1回）。',
  },
  {
    id: 'o_forager', kind: 'occ', name: '野草摘み', engine: ['gather', 'family'], mech: 'instead',
    effects: [{ when: 'instead:plaza', do: [{ gain: { herb: 1, food: 1 } }] }],
    text: '広場に置いたとき、代わりに薬草1と食料1を得られる。',
  },
  {
    id: 'o_gleaner', kind: 'occ', name: '落ち穂拾い', engine: ['gather'], mech: 'social',
    effects: [
      { when: 'other:forest', do: [{ steal_gain: { wood: 1 } }], limit: 'round' },
      { when: 'other:meadow', do: [{ steal_gain: { herb: 1 } }], limit: 'round' },
      { when: 'other:mine', do: [{ steal_gain: { iron: 1 } }], limit: 'round' },
    ],
    text: '他の人が古の森を使うと木材1、薬草の野なら薬草1、鉄の坑道なら鉄1を得る（それぞれラウンド1回）。',
  },
  // ---- trade ----
  {
    id: 'o_moneychanger', kind: 'occ', name: '両替商', engine: ['trade'], mech: 'convert',
    effects: [{ when: 'passive', mod: { sell_bonus: 1 } }],
    text: '交換所の売値が1個につき金貨1高い。',
  },
  {
    id: 'o_appraiser', kind: 'occ', name: '目利き', engine: ['trade', 'smith'], mech: 'instead',
    effects: [{ when: 'instead:market', do: [{ pay: { mat: 2 } }, { gain: { gold: 4 } }, { fame: 1 }] }],
    text: '交換所に置いたとき、代わりに素材2を納めて金貨4と名声1を得られる。',
  },
  {
    id: 'o_moneylender', kind: 'occ', name: '金貸し', engine: ['trade', 'quest'], mech: 'convert',
    effects: [
      { when: 'winter', do: [{ pay: { gold: 5 } }, { fame: 2 }] },
      { when: 'round_start', if: { res_min: { gold: 3 } }, do: [{ gain: { gold: 1 } }] },
    ],
    text: 'ラウンドの始めに金貨3以上あれば金貨+1。冬に金貨5を払って名声+2にしてよい。',
  },
  // ---- fort ----
  {
    id: 'o_mason', kind: 'occ', name: '石工', engine: ['fort', 'gather'], mech: 'boost',
    effects: [
      { when: 'passive', mod: { cost_discount: { kind: 'wall', res: { wood: 1 } } } },
      { when: 'use:workshop', do: [{ gain: { wood: 1 } }] },
    ],
    text: '防壁は木材1安い。工房を使うたび木材+1。',
  },
  {
    id: 'o_sentry', kind: 'occ', name: '見張り番', engine: ['fort'], mech: 'accrue',
    effects: [
      { when: 'passive', mod: { base_guard: 1 } },
      { when: 'winter', if: { min: { walls: 2 } }, do: [{ gain: { gold: 2 } }] },
    ],
    text: '拠点の守り+1。冬に防壁が2つ以上あれば金貨+2。',
  },
  {
    id: 'o_carpenter', kind: 'occ', name: '大工', engine: ['fort', 'family'], mech: 'instead',
    effects: [{ when: 'instead:forest', do: [{ build: 'any', discount: { wood: 1 } }] }],
    text: '古の森に置いたとき、木材を取る代わりに寝床・防壁・施設を1つ建ててよい（木材1安い）。',
  },
  {
    id: 'o_garrison', kind: 'occ', name: '守備隊長', engine: ['fort', 'boss'], mech: 'endfame',
    effects: [
      { when: 'fight', do: [{ guard: 1 }, { counter: -1 }] },
      { when: 'game_end', do: [{ fame_per: { stat: 'walls', per: 2, max: 3 } }] },
    ],
    text: '戦闘で守り+1・反撃−1。終わりに防壁2つにつき名声+1（最大3）。',
  },
  // ---- smith ----
  {
    id: 'o_tinker', kind: 'occ', name: '修理屋', engine: ['smith', 'trade'], mech: 'convert',
    effects: [
      { when: 'passive', mod: { cost_discount: { kind: 'armor', res: { iron: 1 } } } },
      { when: 'sell', do: [{ gain: { iron: 1 } }], limit: 'round' },
      { when: 'game_end', do: [{ fame_per: { stat: 'gear', per: 3, max: 2 } }] },
    ],
    text: '防具を作る費用が鉄1安い。交換所で売ると鉄+1（ラウンド1回）。終わりに持たせた装備3つにつき名声+1（最大2）。',
  },
  {
    id: 'o_weaponsmith', kind: 'occ', name: '武器職人', engine: ['smith', 'hunt'], mech: 'instead',
    effects: [
      { when: 'instead:market', do: [{ craft: 'any' }] },
      { when: 'game_end', do: [{ fame_per: { stat: 'gear', per: 2, max: 3 } }] },
    ],
    text: '交換所に置いたとき、代わりに装備を1つ作れる（費用は払う）。終わりに持たせた装備2つにつき名声+1（最大3）。',
  },
  {
    id: 'o_forge_apprentice', kind: 'occ', name: '鍛冶見習い', engine: ['smith', 'family'], mech: 'boost',
    effects: [
      { when: 'use:forge', do: [{ train: 'atk' }], limit: 'year' },
      { when: 'craft', do: [{ gain: { food: 1 } }], limit: 'round' },
    ],
    text: '鍛冶場を使うと仲間1人に攻めの熟練+1（1年に1回）。装備を作ると食料+1（ラウンド1回）。',
  },
  // ---- family ----
  {
    id: 'o_midwife', kind: 'occ', name: '産婆', engine: ['family'], mech: 'boost',
    effects: [{ when: 'hire', do: [{ gain: { food: 1 } }], limit: 'year' }],
    text: '仲間が増えると食料+1（1年に1回）。',
  },
  {
    id: 'o_tutor', kind: 'occ', name: '家庭教師', engine: ['family', 'fort'], mech: 'instead',
    effects: [{ when: 'instead:hall', do: [{ pay: { food: 2 } }, { first: true }, { train: 'any' }] }],
    text: '集会所に置いたとき、代わりに食料2を払って先手になり、仲間1人に熟練+1（攻めか守り）。',
  },
  {
    id: 'o_cook', kind: 'occ', name: '炊き出し係', engine: ['family', 'ally'], mech: 'social',
    effects: [{ when: 'winter', do: [{ pay: { food: 2 } }, { fame: 1 }, { others_gain: { food: 1 } }] }],
    text: '冬に食料2を払って炊き出しをしてよい：名声+1、他の人全員が食料1を得る。',
  },
  // ---- arcane ----
  {
    id: 'o_alchemist', kind: 'occ', name: '錬金術師', engine: ['arcane', 'gather'], mech: 'convert',
    effects: [{ when: 'round_end', do: [{ convert: { from: { herb: 2 }, to: { mana: 1 } } }], limit: 'round' }],
    text: 'ラウンドの終わりに薬草2を魔石1に替えてよい（ラウンド1回）。',
  },
  {
    id: 'o_rune_carver', kind: 'occ', name: '刻印師', engine: ['arcane', 'smith'], mech: 'boost',
    effects: [
      { when: 'craft', do: [{ gain: { mana: 1 } }], limit: 'round' },
      { when: 'fight', if: { min: { spells: 1 } }, do: [{ power: 1 }] },
      { when: 'craft', do: [{ fame: 1 }], limit: 'year' },
    ],
    text: '装備を作ると魔石+1（ラウンド1回）。1年に1回、装備を作ると名声+1。これまでに秘術を使っていれば、戦闘で戦力+1。',
  },
  {
    id: 'o_sage', kind: 'occ', name: '賢者', engine: ['arcane'], mech: 'action',
    effects: [
      { when: 'spell', do: [{ draw: { from: 'spell', look: 1, take: 1 } }], limit: 'year' },
      { when: 'game_end', do: [{ fame_per: { stat: 'spells', per: 3, max: 2 } }] },
    ],
    text: '秘術を使うと秘術の山から1枚引く（1年に1回）。終わりに使った秘術3回につき名声+1（最大2）。',
  },
  {
    id: 'o_mana_scholar', kind: 'occ', name: '魔石学者', engine: ['arcane', 'trade'], mech: 'convert',
    effects: [
      { when: 'spell', do: [{ gain: { gold: 1 } }], limit: 'round' },
      { when: 'use:spring', do: [{ gain: { herb: 1 } }] },
    ],
    text: '秘術を使うと金貨+1（ラウンド1回）。魔石の泉を使うたび薬草+1。',
  },
  // ---- beast ----
  {
    id: 'o_whisperer', kind: 'occ', name: '獣語り', engine: ['beast'], mech: 'instead',
    effects: [{ when: 'instead:hunt', do: [{ pay: { food: 3 } }, { tame: true }], limit: 'year' }],
    text: '狩場に置いたとき、代わりに食料3を払って巣の獣1体を使い魔にできる（1年に1回）。',
  },
  {
    id: 'o_shepherd', kind: 'occ', name: '牧人', engine: ['beast', 'family'], mech: 'accrue',
    effects: [{ when: 'round_start', do: [{ gain_per: { stat: 'pets', per: 2, gain: { food: 1 }, max: 2 } }] }],
    text: 'ラウンドの始めに、使い魔2体につき食料+1（最大2）。',
  },
  {
    id: 'o_falconer', kind: 'occ', name: '鷹匠', engine: ['beast', 'hunt'], mech: 'combat',
    effects: [{ when: 'fight', if: { min: { pets: 1 } }, do: [{ power: 1 }, { counter: -1 }] }],
    text: '使い魔がいれば、戦闘で戦力+1・反撃−1。',
  },
  {
    id: 'o_breeder', kind: 'occ', name: '繁殖家', engine: ['beast'], mech: 'endfame',
    effects: [
      { when: 'tame', do: [{ gain: { food: 1 } }] },
      { when: 'game_end', do: [{ fame_per: { stat: 'pets', per: 1, max: 3 } }] },
    ],
    text: '使い魔を得るたび食料+1。終わりに使い魔1体につき名声+1（最大3）。',
  },
  // ---- quest ----
  {
    id: 'o_herald', kind: 'occ', name: '触れ役', engine: ['quest', 'ally'], mech: 'boost',
    effects: [
      { when: 'quest', do: [{ gain: { gold: 3 } }] },
      { when: 'use:board', do: [{ gain: { food: 1 } }] },
    ],
    text: '共通の依頼を達成するたび金貨+3。依頼板を使うたび食料+1。',
  },
  {
    id: 'o_clerk', kind: 'occ', name: 'ギルドの書記', engine: ['quest'], mech: 'action',
    effects: [
      { when: 'use:board', do: [{ draw: { from: 'occ', look: 2, take: 1 } }], limit: 'year' },
      { when: 'occ', do: [{ fame: 1 }], limit: 'year' },
    ],
    text: '依頼板を使うと職能の山から2枚見て1枚を手札に（1年に1回）。職能を出すと名声+1（1年に1回）。',
  },
  {
    id: 'o_handyman', kind: 'occ', name: '何でも屋', engine: ['quest', 'gather'], mech: 'instead',
    effects: [{ when: 'instead:board', do: [{ gain: { wood: 1, iron: 1, herb: 1 } }] }],
    text: '依頼板に置いたとき、金貨の代わりに木材1・鉄1・薬草1を得てもよい。',
  },
  {
    id: 'o_assessor', kind: 'occ', name: '査定役', engine: ['quest'], mech: 'endfame',
    effects: [
      { when: 'game_end', do: [{ fame_per: { stat: 'quests', per: 1, max: 3 } }] },
      { when: 'win', do: [{ gain: { gold: 1 } }], limit: 'round' },
    ],
    text: '魔物に勝つと金貨+1（ラウンド1回）。終わりに達成した共通の依頼1つにつき名声+1（最大3）。',
  },
  // ---- ally ----
  {
    id: 'o_shield_bearer', kind: 'occ', name: '盾持ち', engine: ['ally', 'fort'], mech: 'combat',
    effects: [
      { when: 'fight', if: { coop: true }, do: [{ guard: 2 }] },
      { when: 'win', if: { coop: true }, do: [{ fame: 1 }], limit: 'year' },
    ],
    text: '共闘のとき守り+2。共闘で勝つと名声+1（1年に1回）。',
  },
  {
    id: 'o_drillmaster', kind: 'occ', name: '連携教官', engine: ['ally', 'hunt'], mech: 'combat',
    effects: [
      { when: 'fight', if: { k_min: 2 }, do: [{ power: 1 }] },
      { when: 'win', if: { k_min: 2 }, do: [{ fame: 1 }], limit: 'year' },
    ],
    text: '2人以上で挑むと戦力+1。2人以上で勝つと名声+1（1年に1回）。',
  },
  {
    id: 'o_quartermaster', kind: 'occ', name: '補給係', engine: ['ally', 'trade'], mech: 'social',
    effects: [
      { when: 'trade', do: [{ gain: { food: 1 } }] },
      { when: 'win', if: { coop: true }, do: [{ gain: { food: 2 } }] },
      { when: 'other:nest', do: [{ steal_gain: { food: 1 } }], limit: 'year' },
    ],
    text: '取引が成立するたび食料+1。共闘で勝つと食料+2。他の人が巣に置くと食料1を得る（1年に1回）。',
  },
  {
    id: 'o_envoy', kind: 'occ', name: '使節', engine: ['ally', 'quest'], mech: 'endfame',
    effects: [
      { when: 'fight', if: { coop: true }, do: [{ power: 1 }] },
      { when: 'win', if: { coop: true }, do: [{ fame: 1 }, { gain: { gold: 1 } }] },
      { when: 'game_end', if: { min: { coop: 2 } }, do: [{ fame: 1 }] },
    ],
    text: '共闘のとき戦力+1、勝てば名声+1・金貨+1。終わりに共闘で2体以上倒していれば名声+1。',
  },
  // ---- ruins ----
  {
    id: 'o_archaeologist', kind: 'occ', name: '考古学者', engine: ['ruins'], mech: 'boost',
    effects: [{ when: 'use:ruins', do: [{ draw: { from: 'ancient', look: 1, take: 1 } }], limit: 'year' }],
    text: '遺跡の探索を使うと、さらに古代の品を1枚引く（1年に1回）。',
  },
  {
    id: 'o_curator', kind: 'occ', name: '学芸員', engine: ['ruins', 'quest'], mech: 'endfame',
    effects: [
      { when: 'use:ruins', do: [{ gain: { mana: 1 } }] },
      { when: 'game_end', if: { min: { ancient: 3 } }, do: [{ fame: 2 }] },
    ],
    text: '遺跡の探索を使うたび魔石+1。終わりに古代の品が3つ以上なら名声+2。',
  },
  {
    id: 'o_treasure_hunter', kind: 'occ', name: '宝探し', engine: ['ruins', 'quest'], mech: 'combat',
    effects: [
      { when: 'win_race:undead', do: [{ draw: { from: 'ancient', look: 1, take: 1 } }], limit: 'year' },
      { when: 'win', do: [{ gain: { gold: 1 } }], limit: 'round' },
    ],
    text: '魔物に勝つと金貨+1（ラウンド1回）。不死に勝つと古代の品を1枚引く（1年に1回）。',
  },
  {
    id: 'o_linguist', kind: 'occ', name: '古語学者', engine: ['ruins', 'arcane'], mech: 'instead',
    effects: [{ when: 'instead:spring', do: [{ draw: { from: 'item', look: 3, take: 1 } }, { gain: { mana: 1 } }], limit: 'year' }],
    text: '魔石の泉に置いたとき、代わりに品物の山から3枚見て1枚を手札にし、魔石1を得られる（1年に1回）。',
  },
  // ---- boss ----
  {
    id: 'o_dragon_hunter', kind: 'occ', name: '竜狩り', engine: ['boss', 'hunt'], mech: 'combat',
    effects: [
      { when: 'fight', if: { race: 'dragon' }, do: [{ power: 2 }] },
      { when: 'fight', if: { boss: true }, do: [{ power: 2 }] },
      { when: 'fight', if: { t_min: 0.5 }, do: [{ power: 1 }] },
      { when: 'win', if: { race: 'dragon' }, do: [{ fame: 2 }] },
    ],
    text: '竜との戦闘で戦力+2。主・古竜との戦闘で戦力+2（竜の主なら両方）。試合の後半（進み具合5割から）の戦闘で戦力+1。竜に勝つたび名声+2。',
  },
  {
    id: 'o_strategist', kind: 'occ', name: '軍師', engine: ['boss', 'ally'], mech: 'combat',
    effects: [
      { when: 'fight', if: { boss: true }, do: [{ power: 2 }, { counter: -1 }] },
      { when: 'fight', if: { t_min: 0.5 }, do: [{ power: 1 }] },
      { when: 'win', if: { boss: true }, do: [{ fame: 1 }] },
      { when: 'game_end', do: [{ fame_per: { stat: 'boss', per: 1, max: 3 } }] },
    ],
    text: '主・古竜との戦闘で戦力+2・反撃−1。試合の後半（進み具合5割から）の戦闘で戦力+1。主・古竜を倒すたび名声+1。終わりに倒した主・古竜1体につき名声+1（最大3）。',
  },
  {
    id: 'o_field_medic', kind: 'occ', name: '従軍医', engine: ['boss', 'family'], mech: 'boost',
    effects: [
      { when: 'round_end', do: [{ heal: 1 }], limit: 'round' },
      { when: 'fight', if: { boss: true }, do: [{ no_injury: 1 }] },
    ],
    text: 'ラウンドの終わりに負傷した仲間1人を薬草なしで回復。主・古竜との戦闘で負傷を1人防ぐ。',
  },
  {
    id: 'o_oathkeeper', kind: 'occ', name: '誓約の騎士', engine: ['boss'], mech: 'endfame',
    effects: [
      { when: 'win', if: { boss: true }, do: [{ fame: 2 }] },
      { when: 'game_end', do: [{ fame_per: { stat: 'boss', per: 1, max: 3 } }] },
    ],
    text: '主・古竜を倒すたび名声+2。終わりに倒した主・古竜1体につき名声+1（最大3）。',
  },
  {
    id: 'o_siege_master', kind: 'occ', name: '攻城長', engine: ['boss', 'fort'], mech: 'combat',
    effects: [
      { when: 'fight', if: { boss: true }, do: [{ str: -2 }, { guard: 1 }] },
      { when: 'win', if: { boss: true }, do: [{ fame: 1 }] },
      { when: 'game_end', do: [{ fame_per: { stat: 'boss', per: 1, max: 2 } }] },
    ],
    text: '主・古竜との戦闘で魔物の強さ−2・守り+1。主・古竜を倒すたび名声+1。終わりに倒した主・古竜1体につき名声+1（最大2）。',
  },
];
