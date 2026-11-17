// 霧谷の冒険者団 v2 — 武具カード（初回 15 枚。うち防具 5 枚は kind 'armor'）
// 作り方：鍛冶場（武器）・訓練場（防具）。共通の装備より尖った効果にする（SPEC §5）。
import type { CardDef } from '../types';

export const WEAPONS: CardDef[] = [
  // ---- hunt ----
  {
    id: 'w_trophy_axe', kind: 'weapon', name: '首狩りの大斧', engine: ['hunt'], mech: 'combat',
    cost: { iron: 3 }, slot: 'weapon', two_hand: true, power: 3,
    effects: [{ when: 'win', do: [{ trophy: 1 }], limit: 'round' }],
    text: '両手持ち。戦力+3。持ち手が出た戦闘に勝つと証+1（ラウンド1回）。',
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
    effects: [{ when: 'fight', if: { min: { spells: 2 } }, do: [{ power: 2 }] }],
    text: '後衛。戦力+1、属性を選べる。これまでに秘術を2回以上使っていれば、さらに戦力+2。',
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
    effects: [{ when: 'win', do: [{ draw: { from: 'ancient', look: 1, take: 1 } }], limit: 'year' }],
    text: '光。戦力+2。持ち手が出た戦闘に勝つと古代の品を1枚引く（1年に1回）。',
  },
  // ---- boss ----
  {
    id: 'w_dragonslayer', kind: 'weapon', name: '竜殺しの大剣', engine: ['boss'], mech: 'combat',
    cost: { iron: 4, mana: 1 }, slot: 'weapon', two_hand: true, power: 2, vs_race: 'dragon',
    effects: [{ when: 'fight', if: { boss: true }, do: [{ power: 4 }] }],
    text: '両手持ち。戦力+2。主・古竜との戦闘ではさらに戦力+4。',
  },
  {
    id: 'a_dragon_scale', kind: 'armor', name: '竜鱗の盾', engine: ['boss', 'fort'], mech: 'combat',
    cost: { iron: 2, mat: 2 }, slot: 'armor', guard: 1,
    effects: [{ when: 'fight', if: { boss: true }, do: [{ guard: 2 }, { no_injury: 1 }] }],
    text: '守り+1。主・古竜との戦闘ではさらに守り+2、負傷を1人防ぐ。',
  },
  {
    id: 'w_holy_lance', kind: 'weapon', name: '聖騎士の槍', engine: ['boss'], mech: 'endfame',
    cost: { iron: 2, gold: 2 }, slot: 'weapon', leader_only: true, power: 3,
    effects: [{ when: 'win', if: { boss: true }, do: [{ fame: 2 }] }],
    text: 'リーダー専用。戦力+3。主を倒すたび名声+2。',
  },
];
