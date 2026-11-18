// 霧谷の冒険者団 v2 — 古代の品（SPEC §7・§9）。4種×各3枚＝12枚。
// 組の名声（エンジンが数える）：同じ種類2つ＝名声2、3つ＝名声5。4種そろい（各1つ）＝名声6。
// 1枚は1つの組にしか数えない（重複不可）。
import type { AncientDef } from '../types';

const SET_TEXT = '同じ種類2つで名声2、3つで名声5。4種を1つずつそろえると名声6（1枚は1つの組にだけ数える）。';

export const ANCIENT_SET_FAME = { pair: 2, triple: 5, rainbow: 6 } as const;

export const ANCIENT: AncientDef[] = [
  // 王冠（crown）
  { id: 'an_crown_1', kind: 'ancient', name: '古王の宝冠', group: 'crown', copies: 1, text: `種類：王冠。${SET_TEXT}` },
  { id: 'an_crown_2', kind: 'ancient', name: '古王の笏', group: 'crown', copies: 1, text: `種類：王冠。${SET_TEXT}` },
  { id: 'an_crown_3', kind: 'ancient', name: '古王の印章', group: 'crown', copies: 1, text: `種類：王冠。${SET_TEXT}` },
  // 石版（tablet）
  { id: 'an_tablet_1', kind: 'ancient', name: '星図の石版', group: 'tablet', copies: 1, text: `種類：石版。${SET_TEXT}` },
  { id: 'an_tablet_2', kind: 'ancient', name: '霧文字の石版', group: 'tablet', copies: 1, text: `種類：石版。${SET_TEXT}` },
  { id: 'an_tablet_3', kind: 'ancient', name: '割れた碑文', group: 'tablet', copies: 1, text: `種類：石版。${SET_TEXT}` },
  // 竜の像（idol）
  { id: 'an_idol_1', kind: 'ancient', name: '竜の牙の像', group: 'idol', copies: 1, text: `種類：竜の像。${SET_TEXT}` },
  { id: 'an_idol_2', kind: 'ancient', name: '竜の眼の像', group: 'idol', copies: 1, text: `種類：竜の像。${SET_TEXT}` },
  { id: 'an_idol_3', kind: 'ancient', name: '竜の翼の像', group: 'idol', copies: 1, text: `種類：竜の像。${SET_TEXT}` },
  // 器（vessel）
  { id: 'an_vessel_1', kind: 'ancient', name: '霧の聖杯', group: 'vessel', copies: 1, text: `種類：器。${SET_TEXT}` },
  { id: 'an_vessel_2', kind: 'ancient', name: '魔石の香炉', group: 'vessel', copies: 1, text: `種類：器。${SET_TEXT}` },
  { id: 'an_vessel_3', kind: 'ancient', name: '月の水差し', group: 'vessel', copies: 1, text: `種類：器。${SET_TEXT}` },
];
