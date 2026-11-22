// 霧谷の冒険者団 v2 — 古代の遺物（4種×6枚＝24枚）。引くと壊れた状態で手元に来る。
// 工房か古い発掘場で repair（修復の費用）を払うと直り、試合の終わりに fame（3〜6）の名声。直していない遺物は0点。
// 入手：古い発掘場・主を倒す・段階のマスの効果。ギルドで売ると金貨（data.ts の RELIC_SELL）。
import type { AncientDef, Cost } from '../types';

const G: [string, string, [string, number, Cost][]][] = [
  ['cup', '盃', [
    ['霧の盃', 3, { mana: 1, herb: 1 }], ['祈りの盃', 3, { mana: 1, herb: 1 }], ['月の盃', 4, { mana: 1, herb: 2 }],
    ['星読みの盃', 4, { mana: 1, herb: 2 }], ['竜血の盃', 5, { mana: 2, herb: 2 }], ['古王の聖盃', 6, { mana: 2, herb: 3 }]]],
  ['vessel', '器', [
    ['素焼きの壺', 3, { wood: 1, mat: 1 }], ['香の器', 3, { wood: 1, mat: 1 }], ['月の水差し', 4, { wood: 2, mat: 1 }],
    ['魔紋の鉢', 4, { wood: 2, mat: 1 }], ['星の皿', 5, { wood: 2, mat: 2 }], ['霧王の香炉', 6, { wood: 3, mat: 2 }]]],
  ['idol', '像', [
    ['小さな守り像', 3, { iron: 1, mat: 1 }], ['狐の像', 3, { iron: 1, mat: 1 }], ['竜の眼の像', 4, { iron: 2, mat: 1 }],
    ['巨人の像', 4, { iron: 2, mat: 1 }], ['竜の翼の像', 5, { iron: 2, mat: 2 }], ['竜王の像', 6, { iron: 3, mat: 2 }]]],
  ['crown', '王冠', [
    ['銅の冠', 3, { iron: 1, mana: 1 }], ['星の髪飾り', 3, { iron: 1, mana: 1 }], ['古王の印章', 4, { iron: 1, mana: 2 }],
    ['古王の首飾り', 4, { iron: 1, mana: 2 }], ['古王の笏', 5, { iron: 2, mana: 2 }], ['古王の宝冠', 6, { iron: 2, mana: 3 }]]],
];

const RJ: Record<string, string> = { wood: '木材', iron: '鉄', herb: '薬草', mana: 'マナ鉱石', mat: '素材', food: '食料', gold: '金貨' };
const costText = (c: Cost) => Object.entries(c).map(([r, n]) => `${RJ[r]}${n}`).join('・');

export const ANCIENT: AncientDef[] = G.flatMap(([group, jp, list]) =>
  list.map(([name, fame, repair], i) => ({
    id: `an_${group}_${i + 1}`, kind: 'ancient' as const, name, group, copies: 1, fame, repair,
    text: `種類：${jp}。壊れた状態で手に入る。工房か古い発掘場で${costText(repair)}を払って修復すると、試合の終わりに名声${fame}。`,
  })));
