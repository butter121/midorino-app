// 霧谷の冒険者団 v2 — 秘術カード（初回 15 枚）
// 使い方：自分の手番の前に手札から 1 枚、cost（魔石など）を払って使う（when: 'play'、使い切り）。
// 'play' 以外のタイミングの秘術は「その時に手札から使う」もので、limit: 'game'（使い切り）を付ける。
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
    effects: [{ when: 'play', do: [{ pay: { food: 4 } }, { hire_free: 1 }] }],
    text: '食料4を払い、寝床なしで仲間を1人増やす。',
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
];
