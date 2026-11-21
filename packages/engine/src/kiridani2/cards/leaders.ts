// 霧谷の冒険者団 v2 — リーダー（12 人。K さんの案）。戦闘6人・探索6人。
// 効果の決まりは engine.ts（LEAD と is(p, …) の場所）にあり、数字は data.ts の LEADER で変える。
// 効果はリーダー本人だけでなく、その人の駒（仲間）全員に効く。ここではカードの名前・種類・説明だけを持つ。
import { LEADER as V } from '../data';
import type { CardDef, EngineTag } from '../types';
import { L } from './mk';

/** リーダーの種類（戦闘6人・探索6人）。準備では1人に戦闘1枚と探索1枚を見せる */
export const LEADER_ROLE: Record<string, 'fight' | 'explore'> = {
  l_akane: 'fight', l_jin: 'fight', l_mina: 'fight', l_gareth: 'fight', l_haru: 'fight', l_doran: 'fight',
  l_iska: 'explore', l_goro: 'explore', l_popo: 'explore', l_momo: 'explore', l_kai: 'explore', l_miro: 'explore',
};

const x = (n: number) => (n === 2 ? '2倍' : n === 3 ? '3倍' : `${n}倍`);
const def = (id: string, name: string, engine: EngineTag[], lines: string[]): CardDef => ({ ...L(id, name, engine, []), role: LEADER_ROLE[id], text: lines.join('\n') });

export const LEADERS: CardDef[] = [
  // ---- 戦闘
  def('l_akane', '戦闘の天才', ['hunt', 'smith'], [
    `武器の戦力と、武器の効果が${x(V.genius.weaponMult)}。`,
    `戦闘に勝ったとき、得る証が${x(V.genius.trophyMult)}。`,
  ]),
  def('l_jin', '無限の努力家', ['hunt'], [
    `熟練の上限+${V.striver.skillCap}。熟練の効き目が${x(V.striver.skillMult)}。`,
    `戦闘に勝ったとき、送った仲間全員の熟練の合計÷${V.striver.fameDiv}の名声。`,
  ]),
  def('l_mina', '最高の魔術師', ['arcane'], [
    `秘術を使ったあと、魔石${V.mage.mana}を得るか、秘術を${V.mage.draw}枚引く（1ラウンド${V.mage.perRound}回まで）。`,
    `戦闘に勝ったとき、その戦闘で使った秘術の数だけ名声。`,
  ]),
  def('l_gareth', '盾の勇者', ['fort'], [
    '守りを戦力として数える。',
    '運命カードの影響を受けない。',
    `戦闘に勝ったとき、守りが反撃を上回った数÷${V.shield.fameDiv}の名声。`,
  ]),
  def('l_haru', '孤高のテイマー', ['beast'], [
    '巣の魔物を倒せない。巣の魔物と戦うかわりに、好物をあげて使い魔にできる（主・古竜は倒せる）。',
    `好物は魔物ごとに決まった食料・資源・素材で、強さ÷${V.tamer.favDiv}（切り上げ）個いる。`,
    'ラウンドの終わりに、使い魔の数だけ名声。',
  ]),
  def('l_doran', '巨人狩り山田', ['boss', 'hunt'], [
    '両手武器しか持てない。',
    `主・古竜と戦うとき、戦力${x(V.giant.bossMult)}。`,
    `主にいちばん貢献して勝ったとき名声+${V.giant.bossFame}、古竜なら名声+${V.giant.dragonFame}。`,
  ]),
  // ---- 探索
  def('l_iska', '偉大な探検家', ['ruins', 'quest'], [
    `冬に要る食料−${V.explorer.upkeep}。`,
    `冒険のマスに置くと、その効果が${x(V.explorer.mult)}。`,
    `試合の終わりに、古代の遺物の数×${V.explorer.ancientFame}の名声。`,
  ]),
  def('l_goro', '自宅警備員', ['fort'], [
    '毎ラウンドの始めに、費用を払って防壁を作れる。',
    '冬に防いだ襲撃の数だけ名声。',
    `試合の終わりに、防壁の数だけ名声（防いだ襲撃の合計が${V.guard.lowBlocked}以下なら${x(V.guard.lowMult)}）。`,
  ]),
  def('l_popo', '採集家', ['gather'], [
    `マスで集める資源が${x(V.gatherer.mult)}。`,
    `毎年の終わりに、持っている資源の数÷${V.gatherer.fameDiv}の名声。`,
  ]),
  def('l_momo', '詐欺師', ['trade'], [
    '取引に相手の了承がいらない（出す数と受け取る数は同じ）。',
    '試合の終わりに、取引した回数だけ名声。',
  ]),
  def('l_kai', '器用な職人', ['gather', 'fort'], [
    '工房にほかの人がいても使える。',
    `道具を作る費用が、資源・素材あわせて${V.crafter.discount}少ない。`,
    `道具を作るたびに名声+${V.crafter.fame}。`,
    `道具を作ったあと、山からランダムに${V.crafter.look}枚の道具を見て、1枚を手札に取る。`,
  ]),
  def('l_miro', '伝説の商人', ['trade'], [
    `試合の始めに、資源・素材を${V.merchant.start}個ずつ持つ。`,
    `資源・素材の売値+${V.merchant.sellBonus}。`,
    `試合の終わりに、持っている金貨÷${V.merchant.goldDiv}の名声。`,
  ]),
];
