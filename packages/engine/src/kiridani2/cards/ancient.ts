// 霧谷の冒険者団 v2 — 古代の遺物（5種×各4枚＝20枚）。遺物の欠片3つで1枚引く（古い発掘場・不死や精霊に勝つ・主を倒す・カードの効果）。
// 組の名声（エンジンが数える）：同じ種類2つ＝名声2、3つ＝5、4つ＝8（5つめから1つ2点）。5種そろい（各1つ）＝名声6。
// 1枚は1つの組にしか数えない（重複不可）。
import type { AncientDef } from '../types';

const SET_TEXT = '同じ種類2つで名声2、3つで5、4つで8。5種を1つずつそろえると名声6（1枚は1つの組にだけ数える）。';

export const ANCIENT_SET_FAME = { pair: 2, triple: 5, quad: 8, rainbow: 6 } as const;

const G: [string, string, string[]][] = [
  ['crown', '王冠', ['古王の宝冠', '古王の笏', '古王の印章', '古王の首飾り']],
  ['tablet', '石版', ['星図の石版', '霧文字の石版', '割れた碑文', '祈りの粘土板']],
  ['idol', '竜の像', ['竜の牙の像', '竜の眼の像', '竜の翼の像', '竜の卵の像']],
  ['vessel', '器', ['霧の聖杯', '魔石の香炉', '月の水差し', '星の皿']],
  ['weapon', '古代の武具', ['錆びぬ剣', '黒曜の鏃', '巨人の籠手', '割れた聖盾']],
];

export const ANCIENT: AncientDef[] = G.flatMap(([group, jp, names]) =>
  names.map((name, i) => ({ id: `an_${group}_${i + 1}`, kind: 'ancient' as const, name, group, copies: 1, text: `種類：${jp}。${SET_TEXT}` })));
