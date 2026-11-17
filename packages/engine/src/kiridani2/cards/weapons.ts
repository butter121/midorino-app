// 霧谷の冒険者団 v2 — 武具カード（60 枚。武器と防具（kind 'armor'）。強い動き 1 つにつき主に 5 枚）
// 作り方：鍛冶場（武器）・訓練場（防具）。共通の装備より尖った効果にする（SPEC §5）。
import type { CardDef } from '../types';

export const WEAPONS: CardDef[] = [
  // ---- hunt ----
  {
    id: 'w_trophy_axe', kind: 'weapon', name: '首狩りの大斧', engine: ['hunt'], mech: 'combat',
    cost: { iron: 3 }, slot: 'weapon', two_hand: true, power: 3,
    effects: [{ when: 'win', do: [{ trophy: 1 }], limit: 'year' }],
    text: '両手持ち。戦力+3。持ち手が出た戦闘に勝つと証+1（1年に1回）。',
  },
  {
    id: 'w_hunter_bow', kind: 'weapon', name: '狩人の短弓', engine: ['hunt', 'family'], mech: 'boost',
    cost: { wood: 2 }, slot: 'weapon', rear: true, power: 1,
    effects: [
      { when: 'win', do: [{ gain: { food: 2 } }], limit: 'round' },
      { when: 'use:hunt', do: [{ gain: { food: 1 } }] },
    ],
    text: '後衛。戦力+1。持ち手が出た戦闘に勝つと食料+2（ラウンド1回）。狩場を使うたび食料+1。',
  },
  // ---- fort ----
  {
    id: 'a_tower_shield', kind: 'armor', name: '護りの大盾', engine: ['fort', 'boss'], mech: 'combat',
    cost: { iron: 2, wood: 2 }, slot: 'armor', guard: 2,
    effects: [{ when: 'fight', do: [{ counter: -1 }] }],
    text: '守り+2。持ち手が出た戦闘で反撃−1。',
  },
  {
    id: 'a_rampart_helm', kind: 'armor', name: '城兵の兜', engine: ['fort'], mech: 'boost',
    cost: { iron: 1, mat: 1 }, slot: 'armor', guard: 1,
    effects: [{ when: 'passive', mod: { base_guard: 1 } }],
    text: '守り+1。持っている間、拠点の守り+1（冬の襲撃と巣の反撃に効く）。',
  },
  // ---- smith ----
  {
    id: 'w_masterwork', kind: 'weapon', name: '名工の銘刀', engine: ['smith'], mech: 'endfame',
    cost: { iron: 3, mat: 1 }, slot: 'weapon', power: 2, fame: 1,
    effects: [{ when: 'game_end', if: { min: { gear: 5 } }, do: [{ fame: 3 }] }],
    text: '名声1。戦力+2。終わりに持たせた装備が5つ以上なら名声+3。',
  },
  // ---- arcane ----
  {
    id: 'w_runestaff', kind: 'weapon', name: '刻印の杖', engine: ['arcane', 'hunt'], mech: 'combat',
    cost: { wood: 1, mana: 2 }, slot: 'weapon', rear: true, power: 1, el: 'any',
    effects: [{ when: 'fight', if: { min: { spells: 1 } }, do: [{ power: 2 }] }],
    text: '後衛。戦力+1、属性を選べる。これまでに秘術を1回以上使っていれば、さらに戦力+2。',
  },
  // ---- beast ----
  {
    id: 'w_net', kind: 'weapon', name: '捕獲の投げ網', engine: ['beast'], mech: 'instead',
    cost: { wood: 2, mat: 1 }, slot: 'weapon', power: 1,
    effects: [{ when: 'instead:nest', if: { race: 'beast' }, do: [{ pay: { food: 2 } }, { tame: true }] }],
    text: '戦力+1。持ち手を獣のいる巣に置いたとき、戦う代わりに食料2を払って使い魔にできる。',
  },
  {
    id: 'w_whip', kind: 'weapon', name: '獣使いの鞭', engine: ['beast', 'hunt'], mech: 'combat',
    cost: { mat: 2 }, slot: 'weapon', power: 1, vs_race: 'beast',
    effects: [{ when: 'fight', if: { race: 'beast' }, do: [{ counter: -2 }, { power: 1 }] }],
    text: '戦力+1。獣との戦闘では、さらに戦力+1・反撃−2。',
  },
  // ---- quest ----
  {
    id: 'w_commission', kind: 'weapon', name: '依頼主の剣', engine: ['quest', 'hunt'], mech: 'boost',
    cost: { gold: 3 }, slot: 'weapon', power: 1,
    effects: [{ when: 'win', do: [{ gain: { gold: 2 } }], limit: 'round' }],
    text: '金貨で作れる。戦力+1。持ち手が出た戦闘に勝つと金貨+2（ラウンド1回）。',
  },
  // ---- ally ----
  {
    id: 'w_link_spear', kind: 'weapon', name: '連携の槍', engine: ['ally'], mech: 'combat',
    cost: { wood: 2, iron: 1 }, slot: 'weapon', power: 1,
    effects: [{ when: 'fight', if: { coop: true }, do: [{ power: 2 }, { counter: -1 }] }],
    text: '戦力+1。共闘のとき、さらに戦力+2・反撃−1。',
  },
  {
    id: 'a_guard_mantle', kind: 'armor', name: '護り手の外套', engine: ['ally', 'fort'], mech: 'combat',
    cost: { mat: 2 }, slot: 'armor', guard: 1,
    effects: [{ when: 'fight', if: { coop: true }, do: [{ guard: 2 }, { no_injury: 1 }] }],
    text: '守り+1。共闘のとき、さらに守り+2、負傷を1人防ぐ。',
  },
  // ---- ruins ----
  {
    id: 'w_relic_blade', kind: 'weapon', name: '遺跡の古剣', engine: ['ruins', 'hunt'], mech: 'combat',
    cost: { iron: 1, mana: 1 }, slot: 'weapon', power: 2, el: 'light',
    effects: [
      { when: 'win', do: [{ draw: { from: 'ancient', look: 2, take: 1 } }], limit: 'year' },
      { when: 'win_race:undead', do: [{ trophy: 1 }] },
    ],
    text: '光。戦力+2。持ち手が出た戦闘に勝つと古代の品を2枚見て1枚取る（1年に1回）。不死に勝つと証+1。',
  },
  // ---- boss ----
  {
    id: 'w_dragonslayer', kind: 'weapon', name: '竜殺しの大剣', engine: ['boss'], mech: 'combat',
    cost: { iron: 4, mana: 1 }, slot: 'weapon', two_hand: true, power: 3, vs_race: 'dragon',
    effects: [
      { when: 'fight', if: { boss: true }, do: [{ power: 4 }] },
      { when: 'win', if: { boss: true }, do: [{ fame: 2 }] },
    ],
    text: '両手持ち。戦力+3。主・古竜との戦闘ではさらに戦力+4。持ち手が出た戦闘で主・古竜を倒すと名声+2。',
  },
  {
    id: 'a_dragon_scale', kind: 'armor', name: '竜鱗の盾', engine: ['boss', 'fort'], mech: 'combat',
    cost: { iron: 2, mat: 2 }, slot: 'armor', guard: 1,
    effects: [{ when: 'fight', if: { boss: true }, do: [{ guard: 2 }, { no_injury: 1 }] }],
    text: '守り+1。主・古竜との戦闘ではさらに守り+2、負傷を1人防ぐ。',
  },
  {
    id: 'w_holy_lance', kind: 'weapon', name: '聖騎士の槍', engine: ['boss'], mech: 'endfame',
    cost: { iron: 2, gold: 2 }, slot: 'weapon', leader_only: true, power: 2,
    effects: [{ when: 'win', if: { boss: true }, do: [{ fame: 2 }] }],
    text: 'リーダー専用。戦力+2。主・古竜を倒すたび名声+2。',
  },
  // ================================================================ v2 拡張（45 枚）
  // ---- hunt ----
  {
    id: 'w_twin_blades', kind: 'weapon', name: '双剣', engine: ['hunt', 'ally'], mech: 'combat',
    cost: { iron: 2 }, slot: 'weapon', power: 2,
    effects: [{ when: 'fight', if: { k_min: 2 }, do: [{ power: 1 }] }],
    text: '戦力+2。2人以上で挑むとさらに戦力+1。',
  },
  {
    id: 'w_crossbow', kind: 'weapon', name: '石弓', engine: ['hunt', 'smith'], mech: 'combat',
    cost: { wood: 2, iron: 1 }, slot: 'weapon', rear: true, power: 2,
    effects: [{ when: 'win', do: [{ loot: 1 }], limit: 'round' }],
    text: '後衛。戦力+2。持ち手が出た戦闘に勝つと戦利品+1（ラウンド1回）。',
  },
  {
    id: 'a_hunter_coat', kind: 'armor', name: '狩人の革外套', engine: ['hunt', 'beast'], mech: 'combat',
    cost: { mat: 2 }, slot: 'armor', guard: 1,
    effects: [
      { when: 'fight', do: [{ counter: -1 }] },
      { when: 'win_race:beast', do: [{ gain: { food: 1, mat: 1 } }] },
    ],
    text: '守り+1。持ち手が出た戦闘で反撃−1。獣に勝つと食料1・素材1を得る。',
  },
  // ---- gather ----
  {
    id: 'w_woodaxe', kind: 'weapon', name: '木こりの斧', engine: ['gather', 'family'], mech: 'boost',
    cost: { wood: 1, iron: 1 }, slot: 'weapon', power: 1,
    effects: [{ when: 'use:forest', do: [{ gain: { wood: 1 } }] }],
    text: '戦力+1。古の森を使うたび木材+1。',
  },
  {
    id: 'w_sickle', kind: 'weapon', name: '草刈り鎌', engine: ['gather', 'family'], mech: 'boost',
    cost: { iron: 1 }, slot: 'weapon', power: 1,
    effects: [
      { when: 'use:meadow', do: [{ gain: { herb: 1 } }] },
      { when: 'use:plaza', do: [{ gain: { food: 1 } }] },
    ],
    text: '戦力+1。薬草の野を使うたび薬草+1。広場を使うたび食料+1。',
  },
  {
    id: 'w_pickaxe', kind: 'weapon', name: 'つるはし', engine: ['gather', 'smith'], mech: 'boost',
    cost: { wood: 1, iron: 1 }, slot: 'weapon', power: 1,
    effects: [{ when: 'use:mine', do: [{ gain: { iron: 1 } }] }],
    text: '戦力+1。鉄の坑道を使うたび鉄+1。',
  },
  {
    id: 'a_forager_vest', kind: 'armor', name: '採集者の胴着', engine: ['gather'], mech: 'boost',
    cost: { mat: 1 }, slot: 'armor', guard: 1,
    effects: [{ when: 'use:any_accum', do: [{ gain: { mat: 1 } }], limit: 'round' }],
    text: '守り+1。たまるマスを使うと素材+1（ラウンド1回）。',
  },
  {
    id: 'w_sprout_staff', kind: 'weapon', name: '芽吹きの杖', engine: ['gather', 'arcane'], mech: 'accrue',
    cost: { wood: 2, mana: 1 }, slot: 'weapon', rear: true, power: 1,
    effects: [{ when: 'round_start', if: { season: 'spring' }, do: [{ gain: { wood: 1, herb: 1, food: 1 } }] }],
    text: '後衛。戦力+1。春のラウンドの始めに木材1・薬草1・食料1を得る。',
  },
  // ---- trade ----
  {
    id: 'w_merchant_rapier', kind: 'weapon', name: '商人の細剣', engine: ['trade'], mech: 'boost',
    cost: { gold: 4 }, slot: 'weapon', power: 2,
    effects: [{ when: 'sell', do: [{ gain: { gold: 1 } }], limit: 'round' }],
    text: '金貨で作れる。戦力+2。交換所で売ると金貨+1（ラウンド1回）。',
  },
  {
    id: 'w_gilded_sword', kind: 'weapon', name: '金の飾り剣', engine: ['trade', 'smith'], mech: 'convert',
    cost: { iron: 1, gold: 3 }, slot: 'weapon', power: 1, fame: 1, sell: 7,
    effects: [],
    text: '名声1。戦力+1。交換所で金貨7で売れる。',
  },
  {
    id: 'a_merchant_cloak', kind: 'armor', name: '行商の外套', engine: ['trade'], mech: 'boost',
    cost: { mat: 1, gold: 2 }, slot: 'armor', guard: 1,
    effects: [{ when: 'passive', mod: { market_qty: 1 } }],
    text: '守り+1。持っている間、交換所で一度に扱える数+1。',
  },
  {
    id: 'w_scale_blade', kind: 'weapon', name: '天秤の刃', engine: ['trade', 'ally'], mech: 'boost',
    cost: { iron: 1, gold: 2 }, slot: 'weapon', power: 2,
    effects: [
      { when: 'buy', do: [{ gain: { mat: 1 } }], limit: 'round' },
      { when: 'trade', do: [{ gain: { gold: 1 } }] },
    ],
    text: '戦力+2。交換所で買うと素材+1（ラウンド1回）。取引が成立するたび金貨+1。',
  },
  {
    id: 'a_coin_mail', kind: 'armor', name: '銭鎧', engine: ['trade', 'fort'], mech: 'endfame',
    cost: { iron: 2, gold: 2 }, slot: 'armor', guard: 2,
    effects: [{ when: 'game_end', if: { res_min: { gold: 6 } }, do: [{ fame: 2 }] }],
    text: '守り+2。終わりに金貨6以上を持っていれば名声+2。',
  },
  // ---- fort ----
  {
    id: 'a_gate_shield', kind: 'armor', name: '城門の大盾', engine: ['fort'], mech: 'endfame',
    cost: { wood: 3, iron: 1 }, slot: 'armor', guard: 2,
    effects: [{ when: 'game_end', if: { min: { walls: 3 } }, do: [{ fame: 2 }] }],
    text: '守り+2。終わりに防壁が3つ以上なら名声+2。',
  },
  {
    id: 'a_brigandine', kind: 'armor', name: '鋲打ちの胴', engine: ['fort', 'smith'], mech: 'combat',
    cost: { iron: 3, mat: 1 }, slot: 'armor', guard: 2,
    effects: [{ when: 'fight', if: { min: { walls: 2 } }, do: [{ guard: 1 }, { power: 1 }] }],
    text: '守り+2。防壁が2つ以上あれば、持ち手が出た戦闘でさらに守り+1・戦力+1。',
  },
  {
    id: 'w_halberd', kind: 'weapon', name: '城兵の矛槍', engine: ['fort', 'ally'], mech: 'combat',
    cost: { wood: 2, iron: 2 }, slot: 'weapon', two_hand: true, power: 2, guard: 1,
    effects: [{ when: 'fight', do: [{ counter: -1 }] }],
    text: '両手持ち。戦力+2・守り+1。持ち手が出た戦闘で反撃−1。',
  },
  // ---- smith ----
  {
    id: 'w_tempered', kind: 'weapon', name: '焼き入れの剣', engine: ['smith', 'boss'], mech: 'combat',
    cost: { iron: 3 }, slot: 'weapon', power: 3, sell: 5,
    effects: [],
    text: '戦力+3。交換所で金貨5で売れる。',
  },
  {
    id: 'w_forge_hammer', kind: 'weapon', name: '鍛冶の大槌', engine: ['smith'], mech: 'boost',
    cost: { iron: 2, wood: 1 }, slot: 'weapon', two_hand: true, power: 2,
    effects: [
      { when: 'use:forge', do: [{ gain: { iron: 1 } }] },
      { when: 'craft', do: [{ fame: 1 }], limit: 'year' },
    ],
    text: '両手持ち。戦力+2。鍛冶場を使うたび鉄+1。1年に1回、装備を作ると名声+1。',
  },
  {
    id: 'a_master_plate', kind: 'armor', name: '名工の板金鎧', engine: ['smith', 'boss'], mech: 'combat',
    cost: { iron: 4, mat: 1 }, slot: 'armor', guard: 3, fame: 2,
    effects: [],
    text: '名声2。守り+3。',
  },
  {
    id: 'w_prototype', kind: 'weapon', name: '試作の剣', engine: ['smith', 'trade'], mech: 'convert',
    cost: { iron: 1, wood: 1 }, slot: 'weapon', power: 1, sell: 4,
    effects: [{ when: 'craft', do: [{ gain: { wood: 1 } }], limit: 'round' }],
    text: '戦力+1。交換所で金貨4で売れる。装備を作ると木材+1（ラウンド1回）。',
  },
  // ---- family ----
  {
    id: 'w_kitchen_knife', kind: 'weapon', name: '肉切り包丁', engine: ['family', 'gather'], mech: 'convert',
    cost: { iron: 1 }, slot: 'weapon', power: 1,
    effects: [{ when: 'round_end', do: [{ convert: { from: { mat: 2 }, to: { food: 3 } } }], limit: 'round' }],
    text: '戦力+1。ラウンドの終わりに素材2を食料3に替えてよい（ラウンド1回）。',
  },
  {
    id: 'a_crest_cloak', kind: 'armor', name: '家紋の外套', engine: ['family'], mech: 'endfame',
    cost: { mat: 2 }, slot: 'armor', guard: 1,
    effects: [{ when: 'game_end', if: { min: { comps: 4 } }, do: [{ fame: 1 }] }],
    text: '守り+1。終わりに仲間が4人以上なら名声+1。',
  },
  {
    id: 'w_practice_sword', kind: 'weapon', name: '稽古刀', engine: ['family', 'fort'], mech: 'boost',
    cost: { wood: 2 }, slot: 'weapon', power: 1,
    effects: [{ when: 'hire', do: [{ train: 'atk' }], limit: 'year' }],
    text: '戦力+1。仲間が増えると、仲間1人に攻めの熟練+1（1年に1回）。',
  },
  {
    id: 'w_heirloom', kind: 'weapon', name: '家宝の剣', engine: ['family', 'boss'], mech: 'endfame',
    cost: { iron: 2, gold: 1 }, slot: 'weapon', power: 2, fame: 1,
    effects: [{ when: 'game_end', if: { min: { comps: 5 } }, do: [{ fame: 1 }] }],
    text: '名声1。戦力+2。終わりに仲間が5人以上なら名声+1。',
  },
  {
    id: 'a_padded_coat', kind: 'armor', name: '綿入れ', engine: ['family', 'gather'], mech: 'accrue',
    cost: { mat: 1, food: 1 }, slot: 'armor', guard: 1,
    effects: [{ when: 'winter', if: { min: { comps: 5 } }, do: [{ gain: { food: 1 } }] }],
    text: '守り+1。冬（維持費のあと）に仲間が5人以上なら食料+1。',
  },
  // ---- arcane ----
  {
    id: 'w_fire_wand', kind: 'weapon', name: '炎の杖', engine: ['arcane', 'ruins'], mech: 'combat',
    cost: { wood: 1, mana: 1 }, slot: 'weapon', rear: true, power: 1, el: 'fire',
    effects: [{ when: 'fight', if: { weak: true }, do: [{ power: 1 }] }],
    text: '後衛。火。戦力+1。弱点を突くとさらに戦力+1。',
  },
  {
    id: 'w_crystal_staff', kind: 'weapon', name: '水晶の杖', engine: ['arcane'], mech: 'accrue',
    cost: { wood: 1, mana: 2 }, slot: 'weapon', rear: true, power: 1,
    effects: [{ when: 'spell', do: [{ gain: { mana: 1 } }], limit: 'round' }],
    text: '後衛。戦力+1。秘術を使うと魔石1が戻る（ラウンド1回）。',
  },
  {
    id: 'a_mage_robe', kind: 'armor', name: '魔導衣', engine: ['arcane'], mech: 'boost',
    cost: { mat: 1, mana: 1 }, slot: 'armor', guard: 1,
    effects: [{ when: 'passive', mod: { cost_discount: { kind: 'spell', res: { mana: 1 } } } }],
    text: '守り+1。持っている間、秘術の費用が魔石1安い。',
  },
  {
    id: 'w_thunder_rod', kind: 'weapon', name: '雷の杖', engine: ['arcane', 'boss'], mech: 'combat',
    cost: { iron: 1, mana: 2 }, slot: 'weapon', power: 2, el: 'thunder',
    effects: [{ when: 'fight', if: { min: { spells: 3 } }, do: [{ power: 2 }] }],
    text: '雷。戦力+2。これまでに秘術を3回以上使っていれば、さらに戦力+2。',
  },
  // ---- beast ----
  {
    id: 'w_rider_lance', kind: 'weapon', name: '騎獣の槍', engine: ['beast'], mech: 'combat',
    cost: { wood: 2, iron: 1 }, slot: 'weapon', power: 1,
    effects: [{ when: 'fight', if: { min: { pets: 2 } }, do: [{ power: 2 }] }],
    text: '戦力+1。使い魔が2体以上いれば、さらに戦力+2。',
  },
  {
    id: 'a_fur_cloak', kind: 'armor', name: '獣皮の外套', engine: ['beast'], mech: 'boost',
    cost: { mat: 2 }, slot: 'armor', guard: 1,
    effects: [
      { when: 'tame', do: [{ fame: 1 }], limit: 'year' },
      { when: 'fight', if: { race: 'beast' }, do: [{ guard: 1 }] },
    ],
    text: '守り+1。獣との戦闘でさらに守り+1。使い魔を得ると名声+1（1年に1回）。',
  },
  {
    id: 'w_bait_pole', kind: 'weapon', name: '餌付けの竿', engine: ['beast', 'family'], mech: 'instead',
    cost: { wood: 1, food: 1 }, slot: 'weapon', power: 1,
    effects: [{ when: 'instead:nest', if: { race: 'beast' }, do: [{ pay: { food: 2, mat: 1 } }, { tame: true }] }],
    text: '戦力+1。持ち手を獣のいる巣に置いたとき、戦う代わりに食料2・素材1を払って使い魔にできる。',
  },
  // ---- quest ----
  {
    id: 'w_bounty_saber', kind: 'weapon', name: '賞金首の曲刀', engine: ['quest'], mech: 'combat',
    cost: { iron: 2 }, slot: 'weapon', power: 2,
    effects: [{ when: 'win_race:humanoid', do: [{ fame: 1 }, { gain: { gold: 2 } }] }],
    text: '戦力+2。人型に勝つと名声+1・金貨+2。',
  },
  {
    id: 'a_courier_boots', kind: 'armor', name: '早馬の長靴', engine: ['quest', 'trade'], mech: 'boost',
    cost: { mat: 1, gold: 1 }, slot: 'armor', guard: 1,
    effects: [{ when: 'use:board', do: [{ place_again: true }], limit: 'year' }],
    text: '守り+1。依頼板を使うと、もう一度依頼板の効果を受ける（1年に1回）。',
  },
  {
    id: 'w_guild_blade', kind: 'weapon', name: 'ギルドの剣', engine: ['quest'], mech: 'endfame',
    cost: { iron: 1, gold: 3 }, slot: 'weapon', power: 2,
    effects: [{ when: 'game_end', do: [{ fame_per: { stat: 'quests', per: 1, max: 2 } }] }],
    text: '戦力+2。終わりに達成した共通の依頼1つにつき名声+1（最大2）。',
  },
  {
    id: 'a_medal_mail', kind: 'armor', name: '勲章の鎧', engine: ['quest', 'boss'], mech: 'boost',
    cost: { iron: 2, gold: 2 }, slot: 'armor', guard: 2,
    effects: [
      { when: 'quest', do: [{ fame: 1 }] },
      { when: 'win', if: { boss: true }, do: [{ gain: { gold: 3 } }] },
    ],
    text: '守り+2。共通の依頼を達成するたび名声+1。持ち手が出た戦闘で主・古竜を倒すと金貨+3。',
  },
  // ---- ally ----
  {
    id: 'w_banner_spear', kind: 'weapon', name: '軍旗の槍', engine: ['ally'], mech: 'combat',
    cost: { wood: 2, mat: 1 }, slot: 'weapon', power: 1,
    effects: [{ when: 'fight', if: { coop: true }, do: [{ power: 1 }, { trophy: 1 }] }],
    text: '戦力+1。共闘のとき、さらに戦力+1、勝てば証+1。',
  },
  {
    id: 'a_twin_shield', kind: 'armor', name: '並び盾', engine: ['ally', 'fort'], mech: 'combat',
    cost: { wood: 2, iron: 1 }, slot: 'armor', guard: 1,
    effects: [{ when: 'fight', if: { k_min: 2 }, do: [{ guard: 2 }] }],
    text: '守り+1。2人以上で挑むと、さらに守り+2。',
  },
  {
    id: 'w_rope_dart', kind: 'weapon', name: '縄鏢', engine: ['ally', 'beast'], mech: 'combat',
    cost: { iron: 1, mat: 1 }, slot: 'weapon', rear: true, power: 1,
    effects: [{ when: 'fight', if: { coop: true }, do: [{ counter: -2 }, { power: 1 }] }],
    text: '後衛。戦力+1。共闘のとき、さらに戦力+1・反撃−2。',
  },
  // ---- ruins ----
  {
    id: 'w_ancient_spear', kind: 'weapon', name: '古代の槍', engine: ['ruins'], mech: 'combat',
    cost: { iron: 1, mana: 1, mat: 1 }, slot: 'weapon', power: 2,
    effects: [{ when: 'fight', if: { min: { ancient: 2 } }, do: [{ power: 2 }] }],
    text: '戦力+2。古代の品を2つ以上持っていれば、さらに戦力+2。',
  },
  {
    id: 'a_relic_ward', kind: 'armor', name: '遺物の護符鎧', engine: ['ruins', 'arcane'], mech: 'boost',
    cost: { mana: 1, mat: 1 }, slot: 'armor', guard: 1,
    effects: [{ when: 'use:ruins', do: [{ gain: { mana: 1, herb: 1 } }] }],
    text: '守り+1。遺跡の探索を使うたび魔石1・薬草1を得る。',
  },
  {
    id: 'w_explorer_whip', kind: 'weapon', name: '探検家の鞭', engine: ['ruins', 'trade'], mech: 'boost',
    cost: { wood: 1, mat: 1 }, slot: 'weapon', power: 1,
    effects: [{ when: 'use:ruins', do: [{ gain: { gold: 1, mat: 1 } }] }],
    text: '戦力+1。遺跡の探索を使うたび金貨1・素材1を得る。',
  },
  {
    id: 'a_tomb_guard', kind: 'armor', name: '墓守の鎧', engine: ['ruins', 'boss'], mech: 'combat',
    cost: { iron: 2, mat: 1 }, slot: 'armor', guard: 2,
    effects: [{ when: 'win_race:undead', do: [{ draw: { from: 'ancient', look: 1, take: 1 } }], limit: 'year' }],
    text: '守り+2。持ち手が出た戦闘で不死に勝つと古代の品を1枚引く（1年に1回）。',
  },
  // ---- boss ----
  {
    id: 'w_giant_breaker', kind: 'weapon', name: '巨人砕き', engine: ['boss', 'smith'], mech: 'combat',
    cost: { iron: 4 }, slot: 'weapon', two_hand: true, power: 3,
    effects: [
      { when: 'fight', if: { boss: true }, do: [{ power: 2 }] },
      { when: 'win', if: { boss: true }, do: [{ trophy: 1 }] },
    ],
    text: '両手持ち。戦力+3。主・古竜との戦闘ではさらに戦力+2、勝てば証+1。',
  },
  {
    id: 'a_aegis', kind: 'armor', name: '古の聖盾', engine: ['boss', 'fort'], mech: 'combat',
    cost: { iron: 3, mana: 1 }, slot: 'armor', guard: 2,
    effects: [{ when: 'fight', if: { boss: true }, do: [{ counter: -2 }, { no_injury: 1 }, { power: 1 }] }],
    text: '守り+2。主・古竜との戦闘では戦力+1・反撃−2、負傷を1人防ぐ。',
  },
];
