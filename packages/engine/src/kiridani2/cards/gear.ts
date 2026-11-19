// 霧谷の冒険者団 v2 — 共通の装備（カードがなくても鍛冶場で作れる武器・防具。これも「装備」）。数は 4 人基準（3人は−1、5〜6人は+1）。
// 素の戦力が1になったので、武器の戦力を上げた（再設計）。
import type { GearDef } from '../types';
import { withText } from './text';

export const GEAR: GearDef[] = withText<GearDef>([
  {
    id: 'g_spear', kind: 'gear', name: '木の槍', engine: ['hunt', 'ally'], mech: 'combat',
    place: 'forge', count: 3, cost: { wood: 2 }, slot: 'weapon', power: 2,
    effects: [],
    text: '',
  },
  {
    id: 'g_sword', kind: 'gear', name: '鉄の剣', engine: ['hunt'], mech: 'combat',
    place: 'forge', count: 3, cost: { iron: 2, wood: 1 }, slot: 'weapon', power: 3,
    effects: [],
    text: '',
  },
  {
    id: 'g_bow', kind: 'gear', name: '長弓', engine: ['hunt'], mech: 'combat',
    place: 'forge', count: 2, cost: { wood: 2, mat: 1 }, slot: 'weapon', power: 2,
    effects: [{ when: 'win', do: [{ loot: 1 }], limit: 'round' }],
    text: '',
  },
  {
    id: 'g_staff', kind: 'gear', name: '魔石の杖', engine: ['arcane'], mech: 'combat',
    place: 'forge', count: 2, cost: { mana: 2 }, slot: 'weapon', power: 1,
    effects: [{ when: 'fight', if: { min: { casts_round: 1 } }, do: [{ power: 2 }] }],
    text: '',
  },
  {
    id: 'g_wshield', kind: 'gear', name: '木の盾', engine: ['fort'], mech: 'combat',
    place: 'forge', count: 3, cost: { wood: 2 }, slot: 'armor', guard: 1,
    effects: [],
    text: '',
  },
  {
    id: 'g_leather', kind: 'gear', name: '革鎧', engine: ['fort', 'hunt'], mech: 'combat',
    place: 'forge', count: 3, cost: { mat: 2 }, slot: 'armor', guard: 1,
    effects: [{ when: 'passive', mod: { heal_discount: 1 } }],
    text: '',
  },
  {
    id: 'g_ishield', kind: 'gear', name: '鉄の盾', engine: ['fort'], mech: 'combat',
    place: 'forge', count: 2, cost: { iron: 2 }, slot: 'armor', guard: 2,
    effects: [],
    text: '',
  },
  {
    id: 'g_mail', kind: 'gear', name: '鎖帷子', engine: ['fort', 'boss'], mech: 'combat',
    place: 'forge', count: 2, cost: { iron: 3, mat: 1 }, slot: 'armor', guard: 2,
    effects: [{ when: 'fight', do: [{ no_injury: 1 }] }],
    text: '',
  },
]);
