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

const x = (n: number) => `${n}倍`;
const def = (id: string, name: string, engine: EngineTag[], lines: string[]): CardDef => ({ ...L(id, name, engine, []), role: LEADER_ROLE[id], text: lines.join('\n') });

export const LEADERS: CardDef[] = [
  // ---- 戦闘
  def('l_akane', '武器狂いアカネ', ['hunt', 'smith'], [
    `武器の戦力と、武器の効果が${x(V.genius.weaponMult)}。`,
    `戦闘に勝ったとき、得る証が${x(V.genius.trophyMult)}（切り捨て。増えた分はリーダーの名声）。`,
  ]),
  def('l_jin', '修行の鬼ジン', ['hunt'], [
    `熟練の上限+${V.striver.skillCap}。熟練の効き目が${x(V.striver.skillMult)}。`,
    `戦闘に勝ったとき、送った仲間全員の熟練の合計÷${V.striver.fameDiv}の名声。`,
  ]),
  def('l_mina', '連唱魔女ミナ', ['arcane'], [
    `秘術を使ったあと、マナ鉱石${V.mage.mana}を得るか、秘術を${V.mage.draw}枚引く（1ラウンド${V.mage.perRound}回まで）。`,
    `戦闘に勝ったラウンドは、ラウンドの終わりに、そのラウンドで使った秘術1つごとに名声${V.mage.fame}。`,
  ]),
  def('l_gareth', '鉄壁ガレス', ['fort'], [
    `守りを戦力として数える。守りの値は${x(V.shield.guardMult)}。`,
    '運命カードの影響を受けない。',
    `戦闘に勝ったとき、守りが反撃を上回った数÷${V.shield.fameDiv}の名声。`,
  ]),
  def('l_haru', '餌付け師ハル', ['beast'], [
    '巣の魔物は倒せない。かわりに好物をあげて使い魔にできる（主・古竜は倒せるが、使い魔にはできない）。',
    `好物は魔物ごとに食料・木・鉄・薬草・マナ鉱石・素材のどれか1つ。強さ÷${V.tamer.favDiv}（切り上げ）個いる。`,
    `使い魔は1体ごとに戦力+${V.tamer.petPower}。持てる数は${3 + V.tamer.petCap}体。`,
    `年の終わりに、使い魔1体ごとに名声${V.tamer.fame}。`,
  ]),
  def('l_doran', '大物狩り山田', ['boss', 'hunt'], [
    '両手武器しか持てない。',
    `主・古竜と戦うとき、戦力${x(V.giant.bossMult)}。`,
    `主にいちばん貢献して勝ったとき名声+${V.giant.bossFame}、古竜なら名声+${V.giant.dragonFame}。`,
  ]),
  // ---- 探索
  def('l_iska', '遺物好きイスカ', ['ruins', 'quest'], [
    `冬に要る食料−${V.explorer.upkeep}。`,
    '冒険のまとまりのマスに、ほかの人がいても置ける。',
    `冒険のまとまりのマス（依頼板・古い発掘場・遺跡の探索など）の効果が${x(V.explorer.mult)}（切り捨て）。`,
    `遺物の修復の費用−${V.explorer.repairCut}（減らす資源は自分で選ぶ）。`,
    `試合の終わりに、修復した遺物の数×${V.explorer.ancientFame}の名声。`,
  ]),
  def('l_goro', '自宅警備員ゴロー', ['fort'], [
    '毎ラウンドの始めに、費用を払って防壁を作れる。',
    '冬に防いだ襲撃の数だけ名声。',
    `試合の終わりに、防壁1つごとに名声${V.guard.wallFame}（防いだ襲撃の合計が${V.guard.lowBlocked}以下なら${x(V.guard.lowMult)}）。`,
  ]),
  def('l_popo', '溜め込みポポ', ['gather'], [
    `マスで集める資源が${x(V.gatherer.mult)}（切り捨て）。`,
    `毎年の終わりに、持っている資源の数÷${V.gatherer.fameDiv}の名声。`,
  ]),
  def('l_momo', '押し売りモモ', ['trade'], [
    `取引に相手の了承がいらない。そのかわり1回の取引は1種類ずつ・同じ価値どうしで、金貨${V.swindler.tradeMax}枚分まで。`,
    `職能を出すとき、食料を${V.swindler.occFood}つ多く払う。`,
    `試合の終わりに、取引1回ごとに名声${V.swindler.fame}。`,
  ]),
  def('l_kai', '量産職人カイ', ['gather', 'fort'], [
    '工房にほかの人がいても使える。',
    `道具を作る費用が、資源・素材あわせて${V.crafter.discount}少ない。`,
    `道具を作るたびに名声+${V.crafter.fame}。`,
    `道具を作ったあと、山からランダムに${V.crafter.look}枚の道具を見て、1枚を手札に取る。`,
  ]),
  def('l_miro', '成金ミロ', ['trade'], [
    `試合の始めに、資源（木材・鉄・薬草・マナ鉱石・食料）を${V.merchant.start}個ずつ持つ。`,
    ...(V.merchant.sellBonus ? [`資源・素材の売値+${V.merchant.sellBonus}。`] : []),
    `試合の終わりに、持っている金貨÷${V.merchant.goldDiv}の名声。`,
  ]),
];
