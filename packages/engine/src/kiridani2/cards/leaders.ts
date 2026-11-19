// 霧谷の冒険者団 v2 — リーダー（50 人）。武器・防具・道具・秘術のうち1〜2種類を使うと強くなる。
// それぞれに決まりを破る力（尖った固有の能力）があり、強いものには欠点もつけた。
// ほかの人の動きを止める効果は持たせない（他人のマスを使うたびに得をする効果もなし）。
import type { CardDef } from '../types';
import { L, fight, win, hit, on, end, passive, powPer, famePer } from './mk';
import { withText } from './text';

export const LEADERS: CardDef[] = withText([
  // ---- 武器
  L('l_akane', '双剣のアカネ', ['hunt', 'smith'], [on('setup', [{ draw: { from: 'weapon', look: 3, take: 1 } }]), fight([powPer('sent_wpow', 2, 1, 3)])]),
  L('l_riku', '魔物狩りのリク', ['hunt'], [win([{ loot: 1 }]), fight([{ power: 1 }], { min: { weapons: 1 } })]),
  L('l_vera', '剣闘士ヴェラ', ['hunt'], [win([{ trophy: 1 }], { min: { weapons: 1 } }, 'round')]),
  L('l_shion', '影のシオン', ['hunt'], [fight([{ power: 3 }, { counter: -1 }], { k_max: 1 })]),
  L('l_doran', '竜騎士ドラン', ['boss', 'hunt'], [fight([{ power: 4 }], { boss: true }), win([{ fame: 4 }], { boss: true })]),
  L('l_zack', '傭兵隊長ザック', ['trade', 'hunt'], [fight([{ pay: { gold: 2 } }, { power: 3 }]), on('setup', [{ gain: { gold: 3 } }])]),
  // ---- 防具
  L('l_bard', '怒れるバルド', ['boss', 'hunt'], [passive({ rage: 4 }), fight([powPer('armors', 1, 1, 2)])]),
  L('l_gareth', '鉄壁のガレス', ['fort'], [fight([powPer('def', 1, 1, 4)]), passive({ base_guard: 1 })]),
  L('l_tetsu', '鉄の掟テツ', ['fort', 'boss'], [passive({ no_atk_train: true }), fight([powPer('def', 1, 2, 6)])]),
  L('l_ivy', '茨の魔女アイビー', ['boss', 'fort'], [hit([famePer('dmg', 1, 2)]), fight([{ power: 2 }, { guard: -1 }])]),
  L('l_bram', '墓守ブラム', ['boss', 'arcane'], [on('injure', [{ fame: 1 }], undefined, 'round'), fight([powPer('injured', 1, 1, 3)])]),
  L('l_nana', '癒し手ナナ', ['boss', 'gather'], [passive({ heal_discount: 1 }), on('injure', [{ gain: { herb: 1 } }]), hit([{ gain: { herb: 1 } }], undefined, 'round')]),
  // ---- 武器と防具
  L('l_kai', '鍛冶師カイ', ['smith'], [on('craft', [{ fame: 1 }], undefined, 'round'), passive({ cost_discount: { kind: 'armor', res: { iron: 1 } } }), passive({ cost_discount: { kind: 'weapon', res: { iron: 1 } } }), end([famePer('gear', 2, 4)])]),
  L('l_sola', '太陽の騎士ソラ', ['hunt', 'fort'], [fight([{ power: 2 }], { min: { weapons: 1, armors: 1 } }), end([famePer('gear', 3, 3)])]),
  L('l_orga', '巨人オルガ', ['hunt', 'fort'], [passive({ two_hand_armor: true }), fight([{ power: 2 }], { k_max: 1 })]),
  L('l_gan', 'ドワーフのガン', ['smith', 'gather'], [on('use:forge', [{ gain: { iron: 1, wood: 1 } }]), on('craft', [{ gain: { iron: 1 } }], undefined, 'round')]),
  L('l_bern', '盾の兄弟ベルン', ['ally', 'fort'], [fight([{ guard: 2 }, { power: 1 }], { coop: true }), passive({ trade_count: 1 })]),
  // ---- 道具
  L('l_popo', '小さな発明家ポポ', ['fort', 'gather'], [on('setup', [{ draw: { from: 'tool', look: 3, take: 1 } }]), passive({ cost_discount: { kind: 'tool', res: { wood: 1 } } }), on('build', [{ gain: { iron: 1 } }], undefined, 'round')]),
  L('l_toma', '森の弓使いトーマ', ['gather'], [on('use:forest', [{ gain: { wood: 1 } }]), on('use:meadow', [{ gain: { herb: 1 } }]), passive({ tool_yield: 1 })]),
  L('l_goro', '城塞の騎士ゴロウ', ['fort'], [passive({ base_guard: 1 }), on('build', [{ fame: 1 }], { min: { walls: 1 } }, 'round'), on('winter', [{ gain_per: { stat: 'walls', per: 1, gain: { food: 1 }, max: 3 } }]), passive({ cost_discount: { kind: 'wall', res: { wood: 1 } } })]),
  L('l_hugo', '大工のフーゴ', ['fort', 'family'], [passive({ cost_discount: { kind: 'bed', res: { wood: 2 } } }), on('build', [{ fame: 1 }], undefined, 'year')]),
  L('l_sig', '開拓者シグ', ['fort', 'gather'], [on('setup', [{ gain: { wood: 4 } }]), on('build', [{ gain: { wood: 1 } }], undefined, 'round')]),
  L('l_dax', '解体屋ダックス', ['trade', 'fort'], [on('round_start', [{ scrap: { gain_per_cost: { gold: 1 } } }]), passive({ cost_discount: { kind: 'tool', res: { iron: 1 } } })]),
  // ---- 秘術
  L('l_sera', '星読みのセラ', ['arcane'], [on('round_start', [{ gain: { mana: 1 } }]), fight([powPer('casts_round', 1, 1, 3)]), end([famePer('casts', 4, 4)])]),
  L('l_mina', '魔女ミナ', ['arcane'], [passive({ spell_return: 1 }), on('round_start', [{ gain: { mana: 1 } }]), on('setup', [{ draw: { from: 'spell', look: 3, take: 1 } }])]),
  L('l_ruri', '瑠璃の巫女ルリ', ['arcane', 'quest'], [on('setup', [{ gain: { mana: 2 } }]), on('spell', [{ fame: 1 }], undefined, 'round')]),
  L('l_nora', '書庫番ノラ', ['arcane'], [on('setup', [{ draw: { from: 'spell', look: 4, take: 2 } }]), on('round_start', [{ gain: { mana: 1 } }], { min: { tomes: 1 } })]),
  L('l_pia', '見習い魔導士ピア', ['arcane', 'trade'], [passive({ gold_mana: 3 }), on('setup', [{ gain: { mana: 2 } }])]),
  // ---- 道具と秘術・武器と秘術
  L('l_rei', '錬金術師レイ', ['arcane', 'gather'], [on('round_start', [{ convert: { from: { herb: 1 }, to: { mana: 1 } } }]), on('build', [{ gain: { mana: 1 } }], undefined, 'round')]),
  L('l_lira', '魔弓のリラ', ['arcane', 'hunt'], [fight([powPer('sent_wpow', 1, 1, 3)], { min: { casts_round: 1 } })]),
  L('l_kiri', '霧の案内人キリ', ['ruins', 'arcane'], [on('setup', [{ gain: { mana: 2 } }]), on('spell', [{ shard: 1 }], undefined, 'year')]),
  // ---- 使い魔
  L('l_haru', '獣王ハル', ['beast'], [passive({ pet_bring: 2, capture_ease: 2, leader_no_weapon: true })]),
  L('l_fina', '狩猟番フィナ', ['beast', 'hunt'], [passive({ capture_ease: 1 }), on('tame', [{ gain: { mat: 2 } }])]),
  L('l_rook', '番犬使いルーク', ['beast', 'fort'], [passive({ pet_power: 1 }), fight([powPer('pets', 1, 1, 2)], { min: { armors: 1 } })]),
  // ---- 商い（金貨を名声に）
  L('l_miro', '大商人ミロ', ['trade'], [passive({ sell_full: true, gold_cap: 4 }), passive({ cost_extra: { kind: 'weapon', res: { iron: 1 } } }), passive({ cost_extra: { kind: 'armor', res: { mat: 1 } } })]),
  L('l_leo', '宝石商レオ', ['trade', 'arcane'], [passive({ gold_mana: 2 }), on('spell', [{ gain: { gold: 1 } }], undefined, 'round')]),
  L('l_ollie', '運び屋オリー', ['trade', 'ally'], [passive({ market_qty: 1, trade_count: 1 })]),
  L('l_gil', '金庫番ギル', ['trade'], [on('winter', [{ gain_per: { stat: 'gold', per: 5, gain: { gold: 1 }, max: 3 } }])]),
  // ---- 遺物集め
  L('l_iska', '発掘王女イスカ', ['ruins'], [passive({ shard_need: 1, ancient_look: 1, comp_cap: -1 }), on('setup', [{ shard: 1 }])]),
  L('l_yuki', '語り部ユキ', ['ruins', 'quest'], [on('quest', [{ shard: 1 }]), end([famePer('ancient', 3, 2)])]),
  L('l_kuro', '黒猫のクロ', ['ruins', 'trade'], [on('use:curio', [{ shard: 1 }]), on('use:dig', [{ gain: { gold: 1 } }])]),
  // ---- 仲間・依頼・共闘
  L('l_momo', '鍋番のモモ', ['family'], [passive({ upkeep: -1 }), on('hire', [{ gain: { food: 1 } }])]),
  L('l_tom', '若き指揮官トム', ['family', 'hunt'], [fight([powPer('sent_atk', 1, 1, 3)])]),
  L('l_jin', '賞金首のジン', ['quest', 'hunt'], [on('quest', [{ gain: { gold: 3 } }, { fame: 1 }]), win([{ gain: { gold: 1 } }], undefined, 'round')]),
  L('l_aya', '歌姫アヤ', ['ally'], [fight([{ power: 3 }], { coop: true }), on('trade', [{ fame: 1 }], undefined, 'round')]),
  L('l_celia', '聖女セリア', ['quest', 'trade'], [passive({ donate_rate: { gold: 4 } }), on('donate', [{ fame: 1 }])]),
  L('l_elma', '古竜の巫女エルマ', ['boss'], [fight([{ counter: -3 }, { power: 2 }], { boss: true }), end([famePer('boss', 1, 4)])]),
  L('l_mei', '薬草摘みのメイ', ['gather'], [on('use:meadow', [{ gain: { herb: 2 } }])]),
  // ---- 欠点のあるリーダー
  L('l_gai', '堕ちた英雄ガイ', ['hunt', 'boss'], [fight([{ power: 4 }]), passive({ upkeep: 2 }), win([{ fame: 1 }], undefined, 'round')], { weight: 'curse' }),
  L('l_ash', '灰の放浪者アッシュ', ['gather', 'bridge'], [passive({ comp_cap: -1 }), on('round_start', [{ gain: { wood: 1, iron: 1, herb: 1 } }])], { weight: 'curse' }),
]);
