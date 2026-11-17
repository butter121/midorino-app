// 霧谷の冒険者団 v2 — リーダー（初回 12 人。強い動き 1 つにつき 1 人）
// 効果は SPEC §8 の DSL。text は機械的な説明（ローカル LLM で清書する）。
import type { CardDef } from '../types';

export const LEADERS: CardDef[] = [
  {
    id: 'l_riku', kind: 'leader', name: '魔物狩りのリク', engine: ['hunt'], mech: 'combat',
    effects: [
      { when: 'win', do: [{ loot: 1 }], limit: 'round' },
      { when: 'fight', do: [{ power: 1 }] },
    ],
    text: '魔物に勝つと戦利品+1（ラウンド1回）。戦闘で戦力+1。',
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
    ],
    text: '交換所で扱える数+1。他の人が交換所を使うと金貨1を得る（ラウンド1回）。',
  },
  {
    id: 'l_goro', kind: 'leader', name: '城塞の騎士ゴロウ', engine: ['fort'], mech: 'boost',
    effects: [
      { when: 'passive', mod: { base_guard: 1 } },
      { when: 'build', do: [{ gain: { wood: 1 } }], limit: 'round' },
    ],
    text: '拠点の守り+1。施設・寝床・防壁を建てると木材1が戻る（ラウンド1回）。',
  },
  {
    id: 'l_gan', kind: 'leader', name: 'ドワーフの鍛冶師ガン', engine: ['smith'], mech: 'convert',
    effects: [
      { when: 'craft', do: [{ gain: { iron: 1 } }], limit: 'round' },
      { when: 'use:mine', do: [{ convert: { from: { iron: 2 }, to: { gold: 3 } } }] },
    ],
    text: '装備を作ると鉄1が戻る（ラウンド1回）。鉄の坑道を使ったあと、鉄2を金貨3に替えてよい。',
  },
  {
    id: 'l_momo', kind: 'leader', name: '野営の料理人モモ', engine: ['family'], mech: 'convert',
    effects: [
      { when: 'passive', mod: { upkeep: -1 } },
      { when: 'hire', do: [{ gain: { food: 1 } }] },
    ],
    text: '冬の維持費が食料1少ない。仲間が増えるたび食料+1。',
  },
  {
    id: 'l_mina', kind: 'leader', name: '土くれの魔導士ミナ', engine: ['arcane'], mech: 'accrue',
    effects: [
      { when: 'spell', do: [{ gain: { mana: 1 } }], limit: 'round' },
      { when: 'use:spring', do: [{ gain: { mana: 1 } }] },
    ],
    text: '秘術を使うと魔石1が戻る（ラウンド1回）。魔石の泉を使うたび魔石+1。',
  },
  {
    id: 'l_haru', kind: 'leader', name: '獣使いのハル', engine: ['beast'], mech: 'instead',
    effects: [
      { when: 'instead:nest', if: { race: 'beast' }, do: [{ pay: { food: 3 } }, { tame: true }] },
      { when: 'passive', mod: { pet_power: 1 } },
    ],
    text: '獣のいる巣に置いたとき、戦う代わりに食料3を払って使い魔にできる。使い魔の戦力+1。',
  },
  {
    id: 'l_jin', kind: 'leader', name: '賞金稼ぎのジン', engine: ['quest'], mech: 'boost',
    effects: [
      { when: 'use:board', do: [{ gain: { gold: 1 } }] },
      { when: 'win', do: [{ gain: { gold: 1 } }], limit: 'round' },
    ],
    text: '依頼板を使うたび金貨+1。魔物に勝つと金貨+1（ラウンド1回）。',
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
    ],
    text: '魔石の泉に置いたとき、魔石の代わりに古代の品を2枚見て1枚取れる（1年に1回）。遺跡の探索を使うたび魔石+1。',
  },
  {
    id: 'l_nana', kind: 'leader', name: '光の神官ナナ', engine: ['boss'], mech: 'combat',
    effects: [
      { when: 'fight', if: { boss: true }, do: [{ power: 2 }, { counter: -1 }] },
      { when: 'lose', do: [{ heal: 1 }], limit: 'round' },
    ],
    text: '主・古竜との戦闘で戦力+2、反撃−1。負けたとき負傷した仲間1人を回復（ラウンド1回）。',
  },
];
