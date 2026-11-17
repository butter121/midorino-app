// 霧谷の冒険者団 v2 — 職能カード（初回 15 枚）
// 出し方：ギルド（食料1、2枚目以降は食料2）。cost はその上乗せ分。
import type { CardDef } from '../types';

export const OCCUPATIONS: CardDef[] = [
  // ---- hunt ----
  {
    id: 'o_butcher', kind: 'occ', name: '解体職人', engine: ['hunt'], mech: 'boost',
    effects: [
      { when: 'win', do: [{ loot: 1 }] },
      { when: 'win_race:beast', do: [{ gain: { food: 1 } }] },
    ],
    text: '魔物に勝つたび戦利品+1。獣に勝つとさらに食料+1。',
  },
  // ---- gather ----
  {
    id: 'o_lumberjack', kind: 'occ', name: '木こり', engine: ['gather'], mech: 'boost',
    effects: [
      { when: 'use:forest', do: [{ gain: { wood: 1 } }] },
      { when: 'use:any_accum', do: [{ gain: { food: 1 } }], limit: 'round' },
    ],
    text: '古の森を使うたび木材+1。たまるマスを使うと食料+1（ラウンド1回）。',
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
    effects: [{ when: 'passive', mod: { market_both: true } }],
    text: '交換所で、売ると買うを同じ手番でできる。',
  },
  {
    id: 'o_broker', kind: 'occ', name: '仲買人', engine: ['trade', 'ally'], mech: 'social',
    effects: [
      { when: 'trade', do: [{ gain: { gold: 1 } }] },
      { when: 'passive', mod: { trade_count: 1 } },
    ],
    text: '取引が成立するたび金貨+1。1ラウンドにできる取引の回数+1。',
  },
  // ---- fort ----
  {
    id: 'o_engineer', kind: 'occ', name: '城壁の工兵', engine: ['fort'], mech: 'endfame',
    effects: [
      { when: 'build', do: [{ fame: 1 }], limit: 'year' },
      { when: 'passive', mod: { cost_discount: { kind: 'wall', res: { iron: 1 } } } },
    ],
    text: '防壁は鉄1安い。施設・寝床・防壁を建てると名声+1（1年に1回）。',
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
    ],
    text: '前提：職能1枚。装備を作るたび金貨+1。防具を作る費用が素材1安い。',
  },
  // ---- family ----
  {
    id: 'o_innkeeper', kind: 'occ', name: '宿屋の主人', engine: ['family'], mech: 'instead',
    effects: [{ when: 'instead:hunt', do: [{ pay: { food: 2 } }, { hire: 1 }], limit: 'year' }],
    text: '狩場に置いたとき、食料を取る代わりに食料2を払って仲間を1人雇える（寝床が要る。1年に1回）。',
  },
  {
    id: 'o_matron', kind: 'occ', name: '寮母', engine: ['family'], mech: 'endfame',
    prereq: { occs: 2 },
    effects: [
      { when: 'instead:plaza', do: [{ gain: { food: 2 } }] },
      { when: 'game_end', if: { min: { comps: 5 } }, do: [{ fame: 2 }] },
    ],
    text: '前提：職能2枚。広場に置いたとき、代わりに食料2を得られる。終わりに仲間5人以上なら名声+2。',
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
      { when: 'use:board', do: [{ gain: { gold: 1 } }] },
      { when: 'other:board', do: [{ steal_gain: { food: 1 } }], limit: 'round' },
    ],
    text: '依頼板を使うたび金貨+1。他の人が依頼板を使うと食料1を得る（ラウンド1回）。',
  },
  // ---- ally ----
  {
    id: 'o_mediator', kind: 'occ', name: '交渉上手の仲介人', engine: ['ally'], mech: 'combat',
    effects: [{ when: 'win', if: { coop: true }, do: [{ trophy: 1 }, { loot: 1 }] }],
    text: '共闘で勝つと証+1・戦利品+1（自分の取り分に足す）。',
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
];
