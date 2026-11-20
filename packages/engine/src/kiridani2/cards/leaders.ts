// 霧谷の冒険者団 v2 — リーダー（12 人）。1人1つの「強い動き」を持ち、その動きをするたびに名声が入る（永続の名声）。
// 職能・品物はこの12の動きを助けるように選んである。ほかの人の動きを止める効果は持たせない。
import type { CardDef } from '../types';
import { L, fight, win, on, end, passive, powPer, famePer } from './mk';
import { withText } from './text';

/** リーダーの種類（戦闘6人・探索6人）。準備では1人に戦闘1枚と探索1枚を見せる */
export const LEADER_ROLE: Record<string, 'fight' | 'explore'> = {
  l_akane: 'fight', l_doran: 'fight', l_gareth: 'fight', l_haru: 'fight', l_mina: 'fight', l_goro: 'fight',
  l_kai: 'explore', l_popo: 'explore', l_miro: 'explore', l_iska: 'explore', l_jin: 'explore', l_momo: 'explore',
};
function withRole(cs: CardDef[]): CardDef[] { for (const c of cs) c.role = LEADER_ROLE[c.id]; return cs; }

export const LEADERS: CardDef[] = withRole(withText([
  // 武器で討伐：武器を持たせた仲間ほど強く、勝つたびに名声
  L('l_akane', '双剣のアカネ', ['hunt', 'smith'], [on('setup', [{ draw: { from: 'weapon', look: 3, take: 1 } }]), fight([powPer('sent_wpow', 2, 1, 3)]), win([{ fame: 1 }], undefined, 'round')]),
  // 主狩り：主にめっぽう強く、主に勝つと大きな名声
  L('l_doran', '竜騎士ドラン', ['boss', 'hunt'], [fight([{ power: 5 }, { counter: -2 }], { boss: true }), win([{ fame: 4 }], { boss: true }), win([{ fame: 1 }], undefined, 'year')]),
  // 守り：防具の数がそのまま戦力に。反撃を受け止めるたびに名声
  L('l_gareth', '鉄壁のガレス', ['fort'], [fight([powPer('armors', 1, 1, 4)]), passive({ base_guard: 1 }), win([{ fame: 1 }], { min: { armors: 2 } }, 'round')]),
  // 鍛冶：鍛冶場で2つ作れる。作るたびに名声
  L('l_kai', '鍛冶師カイ', ['smith'], [on('use:forge', [{ craft: 'any' }]), passive({ cost_discount: { kind: 'weapon', res: { iron: 1 } } }), on('craft', [{ fame: 1 }], undefined, 'round')]),
  // 道具：工房で2つ建てられる。建てるたびに名声
  L('l_popo', '小さな発明家ポポ', ['gather', 'fort'], [on('setup', [{ draw: { from: 'tool', look: 3, take: 1 } }]), on('use:workshop', [{ build: 'facility' }]), passive({ cost_discount: { kind: 'tool', res: { wood: 1 } } }), on('build', [{ fame: 1 }], undefined, 'round')]),
  // 秘術：毎ラウンド魔石。使い切りの秘術を手札に戻せる。唱えるたびに名声
  L('l_mina', '魔女ミナ', ['arcane'], [on('round_start', [{ gain: { mana: 1 } }]), passive({ spell_return: 1 }), on('spell', [{ fame: 1 }], undefined, 'round')]),
  // 獣使い：狩場で獣を仲間にできる。使い魔が強く、仲間にするたびに名声
  L('l_haru', '獣王ハル', ['beast'], [on('use:hunt', [{ tame: true }]), passive({ pet_power: 1, pet_cap: 1 }), on('tame', [{ fame: 1 }])]),
  // 商い：売値＝買値、扱える数+1。売るたびに名声
  L('l_miro', '大商人ミロ', ['trade'], [passive({ sell_full: true, market_qty: 1, gold_cap: 4 }), on('sell', [{ fame: 1 }], undefined, 'round')]),
  // 遺物集め：欠片が少なくてすむ。遺物の数だけ名声
  L('l_iska', '発掘王女イスカ', ['ruins'], [passive({ shard_need: 1, ancient_look: 1 }), on('setup', [{ shard: 1 }]), on('use:dig', [{ shard: 1 }]), end([famePer('ancient', 1, 5)])]),
  // 依頼：依頼を達成すると大きく得る。依頼板を使うたびに名声
  L('l_jin', '賞金首のジン', ['quest', 'hunt'], [on('quest', [{ gain: { gold: 3 } }, { fame: 2 }]), on('use:board', [{ fame: 1 }], undefined, 'round'), win([{ gain: { gold: 1 } }], undefined, 'round')]),
  // 大所帯：維持費が安く寝床がいらない分だけ人を増やせる。人数が多いと毎ラウンド名声
  L('l_momo', '鍋番のモモ', ['family'], [passive({ upkeep: -1, bed_cap: 1 }), on('hire', [{ gain: { food: 2 } }]), on('round_end', [{ fame: 1 }], { min: { comps: 4 } })]),
  // 防壁：防壁が戦力と食料に。建てるたびに名声
  L('l_goro', '城塞の騎士ゴロウ', ['fort'], [fight([powPer('walls', 1, 1, 4)]), passive({ cost_discount: { kind: 'wall', res: { wood: 1 } } }), on('build', [{ fame: 1 }], { min: { walls: 1 } }, 'round'), on('winter', [{ gain_per: { stat: 'walls', per: 1, gain: { food: 1 }, max: 3 } }])]),
]));

