// 霧谷の冒険者団 v2 — 道具カード（初回 15 枚）
// 出し方：工房で費用を払って建てる（拠点の設備。施設として数える）。
import type { CardDef } from '../types';

export const TOOLS: CardDef[] = [
  // ---- hunt ----
  {
    id: 't_trophy_wall', kind: 'tool', name: '証の飾り棚', engine: ['hunt'], mech: 'endfame',
    cost: { wood: 2 }, fame: 1,
    effects: [
      { when: 'game_end', if: { min: { kills: 6 } }, do: [{ fame: 3 }] },
      { when: 'win', do: [{ gain: { gold: 1 } }], limit: 'year' },
    ],
    text: '名声1。魔物に勝つと金貨+1（1年に1回）。終わりに倒した魔物が6体以上なら名声+3。',
  },
  // ---- gather ----
  {
    id: 't_basket', kind: 'tool', name: '採集籠', engine: ['gather'], mech: 'boost',
    cost: { wood: 1 },
    effects: [{ when: 'passive', mod: { accum_bonus: { meadow: 1, forest: 1 } } }],
    text: '薬草の野と古の森は、ラウンドの始めにたまる量が1ずつ多い（あなたが取るときだけでなく盤面に足す）。',
  },
  {
    id: 't_storehouse', kind: 'tool', name: '貯蔵庫', engine: ['gather', 'trade'], mech: 'convert',
    cost: { wood: 3 },
    effects: [
      { when: 'round_end', do: [{ convert: { from: { wood: 3 }, to: { gold: 2 } } }], limit: 'round' },
      { when: 'round_end', do: [{ convert: { from: { herb: 3 }, to: { gold: 2 } } }], limit: 'round' },
    ],
    text: 'ラウンドの終わりに、木材3を金貨2に、薬草3を金貨2に替えてよい（それぞれラウンド1回）。',
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
      { when: 'sell', do: [{ gain: { gold: 1 } }], limit: 'round' },
    ],
    text: '前提：職能1枚。取引の回数+1。交換所で売ると金貨+1（ラウンド1回）。',
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
    effects: [{ when: 'craft', do: [{ gain: { iron: 1 } }], limit: 'round' }],
    text: '装備を作ると鉄1が戻る（ラウンド1回）。',
  },
  {
    id: 't_bellows', kind: 'tool', name: '大ふいご', engine: ['smith'], mech: 'action',
    cost: { wood: 2, mat: 1 },
    effects: [{ when: 'use:forge', do: [{ craft: 'any' }], limit: 'year' }],
    text: '鍛冶場を使ったあと、続けて装備をもう1つ作れる（費用は払う。1年に1回）。',
  },
  // ---- family ----
  {
    id: 't_dormitory', kind: 'tool', name: '大部屋', engine: ['family'], mech: 'boost',
    cost: { wood: 4 },
    effects: [
      { when: 'passive', mod: { bed_cap: 2 } },
      { when: 'hire', do: [{ gain: { food: 1 } }] },
    ],
    text: '寝床2つぶんになる。仲間が増えるたび食料+1。',
  },
  {
    id: 't_smokehouse', kind: 'tool', name: '燻製小屋', engine: ['family', 'hunt'], mech: 'convert',
    cost: { wood: 2, iron: 1 },
    effects: [{ when: 'round_end', do: [{ convert: { from: { mat: 2 }, to: { food: 3 } } }], limit: 'round' }],
    text: 'ラウンドの終わりに、素材2を食料3に替えてよい（ラウンド1回）。',
  },
  // ---- arcane ----
  {
    id: 't_mana_font', kind: 'tool', name: '魔力の泉水', engine: ['arcane'], mech: 'accrue',
    cost: { wood: 2, mana: 1 },
    effects: [{ when: 'round_start', if: { season: ['spring', 'summer', 'autumn'] }, do: [{ gain: { mana: 1 } }] }],
    text: '春・夏・秋のラウンドの始めに魔石+1（冬はなし）。',
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
    effects: [{ when: 'round_end', if: { res_min: { gold: 5 } }, do: [{ gain: { gold: 1 } }] }],
    text: 'ラウンドの終わりに金貨5以上を持っていれば金貨+1。',
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
];
