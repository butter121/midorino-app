// 霧谷の冒険者団 v2 — 秘術カード（60 枚。強い動き 1 つにつき主に 5 枚）
// 使い方：自分の手番の前に手札から 1 枚、cost（魔石など）を払って使う（when: 'play'、使い切り）。
// 'play' 以外のタイミングの秘術は「その時に手札から使う」もので、limit: 'game'（使い切り）を付ける。
// 手札から使えるのは 'play' と 'fight'（戦闘の後押しとして自動で選ばれる）だけ。
// 戦闘の op（power など）を 'play' で使ったときは、そのラウンドの自分の戦闘に効く。
import type { CardDef } from '../types';

export const SPELLS: CardDef[] = [
  // ---- hunt ----
  {
    id: 's_lure', kind: 'spell', name: '誘いの香', engine: ['hunt'], mech: 'action',
    cost: { mana: 1, herb: 1 },
    effects: [{ when: 'play', do: [{ ignore_full: true }, { str: -1 }] }],
    text: 'このラウンド、定員の埋まった巣にも仲間を置ける。そのラウンドの自分の戦闘で魔物の強さ−1。',
  },
  // ---- gather ----
  {
    id: 's_harvest', kind: 'spell', name: '豊穣の祈り', engine: ['gather'], mech: 'accrue',
    cost: { mana: 1 },
    effects: [{ when: 'play', do: [{ future: { rounds: [1, 2, 3], gain: { wood: 1, herb: 1 } } }] }],
    text: '次の3ラウンドの始めに、木材1と薬草1が届く。',
  },
  // ---- trade ----
  {
    id: 's_haggle', kind: 'spell', name: '値切りの呪い', engine: ['trade'], mech: 'convert',
    cost: { mana: 1 },
    effects: [{ when: 'play', do: [{ convert: { from: { mat: 2 }, to: { gold: 5 } } }, { exchange: true }] }],
    text: '素材2を金貨5に替えてよい。そのあと交換所で売るか買うを1回してよい（マスに置かずに）。',
  },
  // ---- fort ----
  {
    id: 's_ward', kind: 'spell', name: '迎撃の結界', engine: ['fort'], mech: 'convert',
    cost: { mana: 1 },
    effects: [{ when: 'play', do: [{ build: 'wall', discount: { wood: 2, iron: 1 } }, { fame: 1 }] }],
    text: '防壁を1つ建てる（木材2・鉄1安い）。名声+1。',
  },
  // ---- family ----
  {
    id: 's_horn', kind: 'spell', name: '召集の角笛', engine: ['family'], mech: 'action',
    cost: { mana: 1 },
    effects: [{ when: 'play', do: [{ pay: { food: 5 } }, { hire_free: 1 }] }],
    text: '食料5を払い、寝床なしで仲間を1人増やす。',
  },
  // ---- arcane ----
  {
    id: 's_teleport', kind: 'spell', name: '転移の符', engine: ['arcane'], mech: 'action',
    cost: { mana: 2 },
    effects: [{ when: 'play', do: [{ place_again: true }] }],
    text: 'この手番、すでに自分が使ったマスにもう一度置ける（定員を無視）。',
  },
  {
    id: 's_hourglass', kind: 'spell', name: '時渡りの砂時計', engine: ['arcane', 'family'], mech: 'action',
    cost: { mana: 3 },
    effects: [{ when: 'play', do: [{ extra_worker: 1 }] }],
    text: 'このラウンド、仲間をもう1人ぶん置ける。',
  },
  // ---- beast ----
  {
    id: 's_call', kind: 'spell', name: '獣寄せの笛', engine: ['beast'], mech: 'instead',
    cost: { mana: 1, food: 1 },
    effects: [{ when: 'play', do: [{ tame: true }] }],
    text: '巣にいる獣1体を、戦わずに使い魔にする（仲間を置かなくてよい）。',
  },
  // ---- quest ----
  {
    id: 's_writ', kind: 'spell', name: '依頼の代行状', engine: ['quest'], mech: 'convert',
    cost: { mana: 1 },
    effects: [{ when: 'play', if: { min: { quests: 1 } }, do: [{ pay: { gold: 3 } }, { fame: 3 }] }],
    text: '依頼を1つ以上達成していれば、金貨3を払って名声+3。',
  },
  {
    id: 's_reward', kind: 'spell', name: '報奨の約束', engine: ['quest', 'trade'], mech: 'accrue',
    cost: { mana: 1 },
    effects: [{ when: 'play', do: [{ future: { rounds: [1, 2, 3, 4], gain: { gold: 1 } } }] }],
    text: '次の4ラウンドの始めに、金貨1ずつ届く。',
  },
  // ---- ally ----
  {
    id: 's_pact', kind: 'spell', name: '盟約の印', engine: ['ally', 'boss'], mech: 'combat',
    cost: { mana: 1 },
    effects: [{ when: 'fight', if: { coop: true }, do: [{ power: 3 }, { trophy: 1 }], limit: 'game' }],
    text: '共闘の戦闘中に手札から使う：戦力+3、勝てば証+1。使い切り。',
  },
  // ---- ruins ----
  {
    id: 's_decipher', kind: 'spell', name: '解読の呪文', engine: ['ruins', 'arcane'], mech: 'action',
    cost: { mana: 2 },
    effects: [{ when: 'play', do: [{ draw: { from: 'ancient', look: 3, take: 1 } }] }],
    text: '古代の品の山から3枚見て1枚取る。',
  },
  {
    id: 's_compass', kind: 'spell', name: '古代の羅針盤', engine: ['ruins'], mech: 'action',
    cost: { mana: 1 },
    effects: [{ when: 'play', do: [{ draw: { from: 'item', look: 4, take: 1 } }, { gain: { mat: 1 } }] }],
    text: '品物の山（武具・道具・秘術）から4枚見て1枚を手札に。素材+1。',
  },
  // ---- boss ----
  {
    id: 's_dragonbane', kind: 'spell', name: '竜殺しの秘薬', engine: ['boss'], mech: 'combat',
    cost: { mana: 2, herb: 2 },
    effects: [{ when: 'fight', if: { boss: true }, do: [{ power: 6 }], limit: 'game' }],
    text: '主・古竜との戦闘中に手札から使う：戦力+6。使い切り。',
  },
  {
    id: 's_barrier', kind: 'spell', name: '結界', engine: ['boss', 'fort'], mech: 'combat',
    cost: { mana: 2 },
    effects: [{ when: 'play', do: [{ counter: -9 }, { no_injury: 2 }] }],
    text: 'このラウンドの自分の戦闘で、反撃をすべて0にし、負傷を2人まで防ぐ。',
  },
  // ================================================================ v2 拡張（45 枚）
  // ---- hunt ----
  {
    id: 's_bloodlust', kind: 'spell', name: '血の昂ぶり', engine: ['hunt'], mech: 'combat',
    cost: { mana: 1 },
    effects: [{ when: 'play', do: [{ power: 3 }] }],
    text: 'このラウンドの自分の戦闘で戦力+3。',
  },
  {
    id: 's_war_cry', kind: 'spell', name: '鬨の声', engine: ['hunt', 'ally'], mech: 'combat',
    cost: { mana: 1 },
    effects: [{ when: 'fight', do: [{ power: 2 }, { loot: 2 }], limit: 'game' }],
    text: '戦闘中に手札から使う：戦力+2、勝てば戦利品+2。使い切り。',
  },
  {
    id: 's_flash', kind: 'spell', name: '閃光の符', engine: ['hunt'], mech: 'combat',
    cost: { mana: 1, herb: 1 },
    effects: [{ when: 'play', do: [{ str: -2 }, { counter: -1 }] }],
    text: 'このラウンドの自分の戦闘で、魔物の強さ−2・反撃−1。',
  },
  {
    id: 's_second_blade', kind: 'spell', name: '二の太刀', engine: ['hunt', 'boss'], mech: 'action',
    cost: { mana: 2 },
    effects: [{ when: 'play', do: [{ extra_worker: 1 }, { ignore_full: true }] }],
    text: 'このラウンド、仲間をもう1人ぶん置ける。定員の埋まったマス・巣にも1回置ける。',
  },
  // ---- gather ----
  {
    id: 's_sprout_song', kind: 'spell', name: '芽吹きの歌', engine: ['gather'], mech: 'accrue',
    cost: { mana: 1 },
    effects: [{ when: 'play', do: [{ gain: { wood: 2, herb: 2 } }] }],
    text: '木材2と薬草2を得る。',
  },
  {
    id: 's_kind_rain', kind: 'spell', name: '慈雨', engine: ['gather', 'family'], mech: 'accrue',
    cost: { mana: 1 },
    effects: [{ when: 'play', do: [{ future: { rounds: [1, 2], gain: { food: 2 } } }] }],
    text: '次の2ラウンドの始めに、食料2ずつ届く。',
  },
  {
    id: 's_ore_sense', kind: 'spell', name: '鉱脈探し', engine: ['gather', 'smith'], mech: 'accrue',
    cost: { mana: 1 },
    effects: [{ when: 'play', do: [{ gain: { iron: 3 } }] }],
    text: '鉄3を得る。',
  },
  {
    id: 's_abundance', kind: 'spell', name: '豊作', engine: ['gather'], mech: 'accrue',
    cost: { mana: 1 },
    effects: [{ when: 'play', do: [{ gain_per: { stat: 'facilities', per: 1, gain: { wood: 1, herb: 1 }, max: 3 } }] }],
    text: '施設1つにつき木材1・薬草1を得る（最大3回）。',
  },
  // ---- trade ----
  {
    id: 's_golden_touch', kind: 'spell', name: '黄金の手', engine: ['trade', 'smith'], mech: 'convert',
    cost: { mana: 1 },
    effects: [{ when: 'play', do: [{ convert: { from: { iron: 2 }, to: { gold: 6 } } }] }],
    text: '鉄2を金貨6に替えてよい。',
  },
  {
    id: 's_market_day', kind: 'spell', name: '市の日', engine: ['trade'], mech: 'action',
    cost: { mana: 1 },
    effects: [{ when: 'play', do: [{ exchange: true }, { exchange: true }] }],
    text: '交換所と同じく、売るか買うを2回してよい（マスに置かずに）。',
  },
  {
    id: 's_smuggle', kind: 'spell', name: '抜け荷', engine: ['trade', 'ally'], mech: 'accrue',
    cost: { mana: 1 },
    effects: [{ when: 'play', do: [{ gain: { mat: 2, gold: 2 } }] }],
    text: '素材2と金貨2を得る。',
  },
  {
    id: 's_appraisal', kind: 'spell', name: '鑑定の呪文', engine: ['trade', 'ruins'], mech: 'action',
    cost: { mana: 1 },
    effects: [{ when: 'play', do: [{ gain: { gold: 2 } }, { draw: { from: 'item', look: 2, take: 1 } }] }],
    text: '金貨2を得て、品物の山から2枚見て1枚を手札に。',
  },
  // ---- fort ----
  {
    id: 's_stoneskin', kind: 'spell', name: '石の肌', engine: ['fort', 'boss'], mech: 'combat',
    cost: { mana: 1 },
    effects: [{ when: 'play', do: [{ guard: 3 }, { no_injury: 1 }] }],
    text: 'このラウンドの自分の戦闘で守り+3、負傷を1人防ぐ。',
  },
  {
    id: 's_earthwork', kind: 'spell', name: '土塁起こし', engine: ['fort'], mech: 'action',
    cost: { mana: 2 },
    effects: [{ when: 'play', do: [{ build: 'wall', discount: { wood: 2, iron: 1 } }, { build: 'wall', discount: { wood: 2 } }] }],
    text: '防壁を1つ建てる（木材2・鉄1安い）。続けて、もう1つ建ててよい（木材2安い）。',
  },
  {
    id: 's_sanctuary', kind: 'spell', name: '聖域', engine: ['fort', 'quest'], mech: 'endfame',
    cost: { mana: 1 },
    effects: [{ when: 'play', do: [{ fame_per: { stat: 'walls', per: 2, max: 3 } }] }],
    text: '防壁2つにつき名声+1（最大3）。',
  },
  {
    id: 's_reinforce', kind: 'spell', name: '補強工事', engine: ['fort', 'gather'], mech: 'action',
    cost: { mana: 1 },
    effects: [{ when: 'play', do: [{ build: 'any', discount: { wood: 2 } }] }],
    text: '寝床・防壁・施設を1つ建てる（木材2安い）。',
  },
  // ---- smith ----
  {
    id: 's_quench', kind: 'spell', name: '焼き入れの秘法', engine: ['smith'], mech: 'action',
    cost: { mana: 1 },
    effects: [{ when: 'play', do: [{ craft: 'any' }, { fame: 1 }] }],
    text: '装備を1つ作る（費用は払う。マスに置かずに）。名声+1。',
  },
  {
    id: 's_forge_fire', kind: 'spell', name: '炉の火', engine: ['smith', 'gather'], mech: 'accrue',
    cost: { mana: 1 },
    effects: [{ when: 'play', do: [{ gain: { iron: 2 } }, { future: { rounds: [1, 2], gain: { iron: 1 } } }] }],
    text: '鉄2を得る。次の2ラウンドの始めに鉄1ずつ届く。',
  },
  {
    id: 's_enchant', kind: 'spell', name: '付与術', engine: ['smith', 'arcane'], mech: 'action',
    cost: { mana: 2 },
    effects: [{ when: 'play', do: [{ draw: { from: 'weapon', look: 3, take: 1 } }, { power: 2 }] }],
    text: '武具の山から3枚見て1枚を手札に。このラウンドの自分の戦闘で戦力+2。',
  },
  {
    id: 's_mend', kind: 'spell', name: '修繕の呪文', engine: ['smith', 'fort'], mech: 'action',
    cost: { mana: 1 },
    effects: [{ when: 'play', do: [{ craft: 'armor' }, { heal: 1 }] }],
    text: '防具を1つ作る（費用は払う。マスに置かずに）。負傷した仲間1人を回復。',
  },
  {
    id: 's_masterstroke', kind: 'spell', name: '会心の一打', engine: ['smith', 'hunt'], mech: 'combat',
    cost: { mana: 1 },
    effects: [{ when: 'fight', if: { min: { gear: 3 } }, do: [{ power: 4 }], limit: 'game' }],
    text: '持たせた装備が3つ以上のとき、戦闘中に手札から使う：戦力+4。使い切り。',
  },
  // ---- family ----
  {
    id: 's_feast', kind: 'spell', name: '宴', engine: ['family', 'ally'], mech: 'social',
    cost: { mana: 1 },
    effects: [{ when: 'play', do: [{ gain: { food: 4 } }, { others_gain: { food: 1 } }] }],
    text: '食料4を得る。他の人全員も食料1を得る。',
  },
  {
    id: 's_blessing', kind: 'spell', name: '子宝の祈り', engine: ['family'], mech: 'action',
    cost: { mana: 2 },
    effects: [{ when: 'play', do: [{ pay: { food: 4 } }, { hire: 1 }] }],
    text: '食料4を払い、仲間を1人雇う（寝床が要る）。',
  },
  {
    id: 's_lullaby', kind: 'spell', name: '子守唄', engine: ['family', 'boss'], mech: 'action',
    cost: { mana: 1 },
    effects: [{ when: 'play', do: [{ heal: 2 }, { gain: { food: 1 } }] }],
    text: '負傷した仲間を2人まで回復する。食料1を得る。',
  },
  {
    id: 's_tutelage', kind: 'spell', name: '手ほどき', engine: ['family', 'fort'], mech: 'action',
    cost: { mana: 1 },
    effects: [{ when: 'play', do: [{ train: 'any' }, { train: 'any' }] }],
    text: '仲間に熟練+1を2回つける（攻めか守り。同じ仲間でもよい）。',
  },
  // ---- arcane ----
  {
    id: 's_mana_surge', kind: 'spell', name: '魔力の奔流', engine: ['arcane'], mech: 'convert',
    cost: { herb: 2 },
    effects: [{ when: 'play', do: [{ gain: { mana: 3 } }] }],
    text: '薬草2で使う。魔石3を得る。',
  },
  {
    id: 's_scry', kind: 'spell', name: '遠見の術', engine: ['arcane', 'ruins'], mech: 'action',
    cost: { mana: 1 },
    effects: [{ when: 'play', do: [{ draw: { from: 'spell', look: 3, take: 2 } }] }],
    text: '秘術の山から3枚見て2枚を手札に。',
  },
  {
    id: 's_magic_bolt', kind: 'spell', name: '魔弾', engine: ['arcane'], mech: 'combat',
    cost: { mana: 2 },
    effects: [{ when: 'fight', do: [{ power: 4 }], limit: 'game' }],
    text: '戦闘中に手札から使う：戦力+4。使い切り。',
  },
  // ---- beast ----
  {
    id: 's_beast_speech', kind: 'spell', name: '獣の言葉', engine: ['beast'], mech: 'instead',
    cost: { mana: 2 },
    effects: [{ when: 'play', do: [{ tame: true }, { gain: { mat: 1 } }] }],
    text: '巣にいる獣1体を、戦わずに使い魔にする。素材1を得る。',
  },
  {
    id: 's_pack_howl', kind: 'spell', name: '群れの遠吠え', engine: ['beast'], mech: 'combat',
    cost: { mana: 1 },
    effects: [{ when: 'play', if: { min: { pets: 1 } }, do: [{ power: 3 }, { counter: -1 }] }],
    text: '使い魔がいるときに使える。このラウンドの自分の戦闘で戦力+3・反撃−1。',
  },
  {
    id: 's_wild_bounty', kind: 'spell', name: '獣の恵み', engine: ['beast', 'gather'], mech: 'accrue',
    cost: { mana: 1 },
    effects: [{ when: 'play', do: [{ gain_per: { stat: 'pets', per: 1, gain: { food: 1, mat: 1 }, max: 3 } }] }],
    text: '使い魔1体につき食料1・素材1を得る（最大3回）。',
  },
  {
    id: 's_beast_heart', kind: 'spell', name: '獣の心', engine: ['beast'], mech: 'combat',
    cost: { mana: 1 },
    effects: [{ when: 'fight', if: { race: 'beast' }, do: [{ power: 3 }, { counter: -2 }], limit: 'game' }],
    text: '獣との戦闘中に手札から使う：戦力+3・反撃−2。使い切り。',
  },
  // ---- quest ----
  {
    id: 's_contract', kind: 'spell', name: '契約書', engine: ['quest', 'trade'], mech: 'accrue',
    cost: { mana: 1 },
    effects: [{ when: 'play', do: [{ gain: { gold: 3 } }, { future: { rounds: [2], gain: { gold: 2 } } }] }],
    text: '金貨3を得る。2ラウンド後の始めに金貨2が届く。',
  },
  {
    id: 's_recommendation', kind: 'spell', name: '推薦状', engine: ['quest', 'family'], mech: 'action',
    cost: { mana: 1 },
    effects: [{ when: 'play', do: [{ occ: 1 }, { gain: { food: 1 } }] }],
    text: '手札の職能を1枚出す（費用は払う。マスに置かずに）。食料1を得る。',
  },
  {
    id: 's_bounty_mark', kind: 'spell', name: '賞金の印', engine: ['quest'], mech: 'combat',
    cost: { mana: 1 },
    effects: [{ when: 'fight', do: [{ trophy: 2 }, { power: 1 }], limit: 'game' }],
    text: '戦闘中に手札から使う：戦力+1、勝てば証+2。使い切り。',
  },
  // ---- ally ----
  {
    id: 's_rally', kind: 'spell', name: '結集の号令', engine: ['ally'], mech: 'combat',
    cost: { mana: 1 },
    effects: [{ when: 'play', do: [{ power: 2 }, { guard: 2 }] }],
    text: 'このラウンドの自分の戦闘で戦力+2・守り+2。',
  },
  {
    id: 's_kinship', kind: 'spell', name: '絆の誓い', engine: ['ally', 'family'], mech: 'combat',
    cost: { mana: 1 },
    effects: [{ when: 'fight', if: { coop: true }, do: [{ power: 3 }, { no_injury: 2 }], limit: 'game' }],
    text: '共闘の戦闘中に手札から使う：戦力+3、負傷を2人まで防ぐ。使い切り。',
  },
  {
    id: 's_gift', kind: 'spell', name: '贈り物', engine: ['ally', 'trade'], mech: 'social',
    cost: { mana: 1 },
    effects: [{ when: 'play', do: [{ gain: { gold: 2, food: 2 } }, { others_gain: { food: 1 } }, { fame: 1 }] }],
    text: '金貨2・食料2を得て名声+1。他の人全員も食料1を得る。',
  },
  {
    id: 's_shared_sight', kind: 'spell', name: '共有の視界', engine: ['ally', 'quest'], mech: 'action',
    cost: { mana: 1 },
    effects: [{ when: 'play', do: [{ ignore_full: true }, { power: 1 }] }],
    text: 'このラウンド、定員の埋まったマス・巣にも1回置ける。自分の戦闘で戦力+1。',
  },
  // ---- ruins ----
  {
    id: 's_unseal', kind: 'spell', name: '封印解き', engine: ['ruins'], mech: 'action',
    cost: { mana: 1, herb: 1 },
    effects: [{ when: 'play', do: [{ draw: { from: 'ancient', look: 1, take: 1 } }, { gain: { gold: 2 } }] }],
    text: '古代の品を1枚引き、金貨2を得る。',
  },
  {
    id: 's_echo', kind: 'spell', name: '古の残響', engine: ['ruins', 'arcane'], mech: 'endfame',
    cost: { mana: 1 },
    effects: [{ when: 'play', if: { min: { ancient: 2 } }, do: [{ fame_per: { stat: 'ancient', per: 1, max: 3 } }] }],
    text: '古代の品を2つ以上持っているときに使える。古代の品1つにつき名声+1（最大3）。',
  },
  {
    id: 's_ward_breaker', kind: 'spell', name: '結界破り', engine: ['ruins', 'boss'], mech: 'combat',
    cost: { mana: 1 },
    effects: [{ when: 'fight', if: { race: ['undead', 'spirit'] }, do: [{ str: -3 }], limit: 'game' }],
    text: '不死・精霊との戦闘中に手札から使う：魔物の強さ−3。使い切り。',
  },
  // ---- boss ----
  {
    id: 's_heroic_oath', kind: 'spell', name: '英雄の誓い', engine: ['boss'], mech: 'combat',
    cost: { mana: 1 },
    effects: [{ when: 'fight', if: { boss: true }, do: [{ power: 4 }, { trophy: 1 }], limit: 'game' }],
    text: '主・古竜との戦闘中に手札から使う：戦力+4、勝てば証+1。使い切り。',
  },
  {
    id: 's_last_stand', kind: 'spell', name: '背水の陣', engine: ['boss', 'fort'], mech: 'combat',
    cost: { mana: 1 },
    effects: [{ when: 'fight', if: { boss: true }, do: [{ guard: 3 }, { no_injury: 2 }, { power: 2 }], limit: 'game' }],
    text: '主・古竜との戦闘中に手札から使う：戦力+2・守り+3、負傷を2人まで防ぐ。使い切り。',
  },
  {
    id: 's_holy_light', kind: 'spell', name: '聖なる光', engine: ['boss', 'arcane'], mech: 'combat',
    cost: { mana: 2 },
    effects: [{ when: 'fight', if: { race: ['undead', 'dragon'] }, do: [{ power: 4 }], limit: 'game' }],
    text: '不死・竜との戦闘中に手札から使う：戦力+4。使い切り。',
  },
];
