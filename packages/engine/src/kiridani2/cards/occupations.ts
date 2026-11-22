// 霧谷の冒険者団 v2 — 職能（80 枚）。出すとずっと効く（回数の制限なし）。名声に直接つながる効果を多くし、
// 武器・防具・道具・秘術のどれとも組めるようにした。ギルドで出す（食料1、2枚目から2。カードの cost はその上乗せ）。
// 手に入れる道：準備で3枚、依頼板・ギルドで山から見て取る、依頼の達成、好きな山から引く効果。
import type { CardDef } from '../types';
import { O, fight, win, hit, on, end, passive, powPer, famePer } from './mk';
import { withText } from './text';

const ALL_OCCUPATIONS: CardDef[] = withText([
  // ---- 武器と組む
  O('o_swordmaster', '剣術師範', ['hunt', 'smith'], [fight([powPer('sent_wpow', 3, 1, 2)]), end([famePer('weapons', 2, 3)])]),
  O('o_weaponsmith', '武器鍛冶', ['smith'], [passive({ cost_discount: { kind: 'weapon', res: { iron: 1 } } }), end([famePer('weapons', 2, 2)])]),
  O('o_duelist', '決闘者', ['hunt'], [fight([{ power: 2 }], { k_max: 1 }), win([{ fame: 1 }], { k_max: 1 })]),
  O('o_veteran', '古強者', ['hunt'], [win([{ fame: 1 }], { min: { weapons: 2 } })]),
  O('o_armsdealer', '武器商', ['trade', 'smith'], [on('craft', [{ gain: { gold: 1 } }]), on('sell', [{ gain: { gold: 1 } }])]),
  O('o_runesmith', '刻印師', ['smith', 'arcane'], [fight([powPer('sent_wpow', 2, 1, 2)], { min: { casts_round: 1 } })]),
  O('o_spellblade', '魔法剣士', ['arcane', 'hunt'], [fight([powPer('weapons', 1, 1, 2)], { min: { tomes: 1 } })]),
  // ---- 防具と組む
  O('o_shieldbearer', '盾持ち', ['fort'], [fight([powPer('armors', 1, 1, 3), { guard: 1 }])]),
  O('o_martyr', '殉教者', ['boss', 'quest'], [on('injure', [{ fame: 1 }])]),
  O('o_thorn_knight', '茨の騎士', ['boss', 'fort'], [hit([famePer('dmg', 1, 2)])]),
  O('o_armorer', '防具職人', ['smith', 'fort'], [passive({ cost_discount: { kind: 'armor', res: { iron: 1 } } }), end([famePer('armors', 1, 4)])]),
  O('o_sentinel', '番兵', ['fort'], [fight([{ guard: 1 }]), hit([{ gain: { herb: 1 } }])]),
  O('o_berserker', '狂戦士', ['hunt', 'boss'], [passive({ rage: 3 }), fight([{ guard: -1 }])], { weight: 'curse' }),
  // ---- 道具と組む
  O('o_engineer', '技師', ['fort', 'gather'], [on('build', [{ fame: 1 }])]),
  O('o_inventor', '発明家', ['fort', 'gather'], [passive({ cost_discount: { kind: 'tool', res: { wood: 1 } } }), end([famePer('tools', 2, 3)])]),
  O('o_quartermaster', '補給係', ['gather'], [passive({ tool_yield: 1 })]),
  O('o_trapper', '罠師', ['fort', 'hunt'], [fight([powPer('tools', 1, 1, 3)])]),
  O('o_toolmaster', '道具の匠', ['fort', 'arcane'], [on('build', [{ gain: { mana: 1 } }])]),
  // ---- 秘術と組む
  O('o_sage', '賢者', ['arcane'], [end([famePer('casts', 3, 6)])]),
  O('o_mage', '魔術師', ['arcane'], [on('round_start', [{ gain: { mana: 1 } }])]),
  O('o_scholar', '学者', ['arcane'], [passive({ spell_return: 1 })]),
  O('o_battle_mage', '戦闘魔導士', ['arcane', 'hunt'], [fight([powPer('casts_round', 1, 1, 3)])]),
  O('o_enchanter', '付与術師', ['arcane'], [fight([{ power: 1 }], { min: { tomes: 1 } }), end([famePer('tomes', 1, 3)])]),
  O('o_alchemist', '錬金術師', ['arcane', 'gather'], [on('round_start', [{ convert: { from: { herb: 2 }, to: { mana: 1 } } }])]),
  O('o_seer', '占い師', ['arcane', 'bridge'], [on('round_start', [{ pay: { mana: 1 } }, { draw: { from: 'item', look: 2, take: 1 } }])]),
  // ---- 使い魔（どの魔物でも）
  O('o_beast_tamer', '獣使い', ['beast'], [passive({ pet_power: 1 }), on('tame', [{ gain: { mat: 1 } }])]),
  O('o_breeder', '育て屋', ['beast', 'family'], [passive({ pet_cap: 1 }), on('round_start', [{ gain_per: { stat: 'pets', per: 2, gain: { food: 1 }, max: 2 } }])]),
  O('o_falconer', '鷹匠', ['beast', 'hunt'], [passive({ pet_bring: 1 })]),
  O('o_beast_lord', '獣の王', ['beast'], [on('tame', [{ fame: 1 }]), end([famePer('pets', 1, 3)])]),
  O('o_beast_armor', '獣甲師', ['beast', 'smith'], [on('tame', [{ gain: { mat: 2 } }])]),
  // ---- 金貨・商い
  O('o_merchant', '行商人', ['trade', 'gather'], [on('use:any_accum', [{ exchange: true }])]),
  O('o_banker', '金貸し', ['trade'], [passive({ gold_cap: 3 })]),
  O('o_moneychanger', '両替屋', ['trade'], [passive({ sell_full: true })], { cost: { gold: 2 } }),
  O('o_peddler', '担ぎ商い', ['trade'], [on('sell', [{ fame: 1 }])]),
  O('o_patron', '後援者', ['trade', 'quest'], [on('donate', [{ fame: 1 }])]),
  O('o_tax_collector', '徴税人', ['trade', 'family'], [on('winter', [{ gain_per: { stat: 'comps', per: 2, gain: { gold: 1 }, max: 3 } }])]),
  O('o_smuggler', '密輸人', ['trade', 'ally'], [passive({ sell_bonus: 1 }), on('trade', [{ gain: { gold: 1 } }])]),
  O('o_steward', '執事', ['trade'], [on('round_end', [{ pay: { gold: 3 } }, { fame: 1 }])], { cost: { gold: 2 } }),
  O('o_miser', '守銭奴', ['trade'], [passive({ gold_cap: 5, market_qty: -1 })], { weight: 'curse' }),
  // ---- 遺物
  O('o_archaeologist', '考古学者', ['ruins'], [passive({ shard_need: 1 })]),
  O('o_relic_hunter', '遺物狩り', ['ruins', 'hunt'], [win([{ shard: 1 }])]),
  O('o_curator', '学芸員', ['ruins'], [end([famePer('ancient', 2, 4)])]),
  O('o_explorer', '探検家', ['ruins', 'arcane'], [on('use:dig', [{ gain: { mana: 1 } }]), passive({ ancient_look: 1 })]),
  O('o_relic_trader', '古物商', ['ruins', 'trade'], [on('use:curio', [{ shard: 1 }])]),
  // ---- 戦い
  O('o_hunter', '狩人', ['hunt'], [win([{ loot: 1 }])]),
  O('o_bounty', '賞金稼ぎ', ['hunt', 'trade'], [win([{ gain: { gold: 1 } }])]),
  O('o_champion', '闘士', ['hunt'], [fight([{ power: 1 }]), end([famePer('kills', 4, 4)])]),
  O('o_tactician', '軍師', ['ally', 'family'], [fight([{ power: 2 }], { k_min: 3 })]),
  O('o_scavenger', '屑拾い', ['hunt', 'smith'], [on('lose', [{ gain: { mat: 2 } }]), win([{ gain: { mat: 1 } }])]),
  O('o_dragon_hunter', '竜狩り', ['boss'], [fight([{ power: 3 }], { boss: true }), win([{ fame: 2 }], { boss: true })]),
  O('o_herald', '伝令', ['boss', 'quest'], [fight([{ counter: -2 }], { boss: true }), win([{ fame: 3 }], { boss: true })]),
  O('o_war_priest', '戦の司祭', ['boss', 'quest'], [win([{ heal: 1 }]), on('donate', [{ gain: { herb: 1 } }])]),
  // ---- 仲間・暮らし
  O('o_matron', '寮母', ['family'], [passive({ bed_cap: 1 }), on('hire', [{ gain: { food: 1 } }])]),
  O('o_drill_sergeant', '鬼教官', ['family', 'hunt'], [end([famePer('skills', 3, 4)])]),
  O('o_cook', '料理番', ['family'], [passive({ upkeep: -1 })]),
  O('o_recruiter', '募兵官', ['family'], [on('hire', [{ gain: { food: 1 } }])]),
  O('o_woodcutter', '木こり', ['gather'], [on('use:forest', [{ gain: { wood: 1 } }])]),
  O('o_miner', '鉱夫', ['gather', 'smith'], [on('use:mine', [{ gain: { iron: 1 } }])]),
  O('o_herbalist', '薬師', ['gather', 'boss'], [on('use:meadow', [{ gain: { herb: 1 } }]), passive({ heal_discount: 1 })]),
  O('o_fisher', '漁師', ['family', 'gather'], [on('use:hunt', [{ gain: { food: 1 } }])]),
  O('o_mana_digger', 'マナ鉱石掘り', ['arcane', 'gather'], [on('use:spring', [{ gain: { mana: 1 } }])]),
  O('o_fortifier', '築城家', ['fort'], [end([famePer('walls', 1, 5)]), on('build', [{ gain: { food: 1 } }])]),
  O('o_guard_captain', '衛兵隊長', ['fort'], [passive({ base_guard: 1 }), on('winter', [famePer('walls', 2, 3)])]),
  // ---- 依頼・共闘・つなぎ
  O('o_adventurer', '冒険者', ['quest'], [on('quest', [{ fame: 2 }])]),
  O('o_guild_clerk', 'ギルドの書記', ['quest', 'bridge'], [on('use:board', [{ gain: { gold: 1 } }])]),
  O('o_messenger', '飛脚', ['quest', 'bridge'], [on('use:guild', [{ gain: { food: 1 } }])]),
  O('o_diplomat', '外交官', ['ally', 'trade'], [on('trade', [{ fame: 1 }])]),
  O('o_comrade', '戦友', ['ally'], [fight([{ power: 2 }], { coop: true }), win([{ fame: 1 }], { coop: true })]),
  O('o_mediator', '仲裁人', ['ally', 'trade'], [passive({ trade_count: 1 })]),
  O('o_pilgrim', '巡礼者', ['quest', 'gather'], [on('donate', [{ gain: { herb: 2 } }]), passive({ donate_rate: { gold: 4 } })]),
  O('o_bard', '吟遊詩人', ['quest', 'ally'], [on('quest', [{ fame: 1 }]), on('trade', [{ fame: 1 }])]),
  // ---- 4種類すべて
  O('o_jack', '何でも屋', ['bridge'], [end([famePer('kinds', 1, 4)])]),
  O('o_collector', '収集家', ['bridge', 'smith'], [end([famePer('gear', 2, 3)])]),
  O('o_artisan', '職人頭', ['smith', 'fort'], [on('craft', [{ fame: 1 }]), on('build', [{ gain: { wood: 1 } }])]),
  O('o_supply', '兵站係', ['family', 'fort'], [on('winter', [{ gain_per: { stat: 'armors', per: 1, gain: { food: 1 }, max: 3 } }])]),
  O('o_polymath', '博識家', ['bridge', 'arcane'], [fight([powPer('kinds', 1, 1, 4)])]),
  // ---- 呪い（代わりに強い）
  O('o_noble', '没落貴族', ['quest', 'trade'], [passive({ upkeep: 1 })], { fame: 3, cost: { gold: 3 }, weight: 'curse' }),
  O('o_gambler', '博徒', ['trade', 'hunt'], [win([{ gain: { gold: 3 } }]), on('lose', [{ lose: { gold: 3 } }])], { weight: 'curse' }),
  O('o_glutton', '大食らい', ['hunt', 'family'], [passive({ upkeep: 2, power: 2 })], { weight: 'curse' }),
  O('o_hermit', '隠者', ['arcane', 'gather'], [passive({ comp_cap: -2 }), on('round_start', [{ gain: { mana: 1, herb: 1 } }])], { weight: 'curse' }),
]);

/** 使うのはこの30枚（ルール・難易度の見直しで絞った） */
const KEEP_OCCUPATIONS = new Set(['o_swordmaster', 'o_hunter', 'o_champion', 'o_dragon_hunter', 'o_herald', 'o_shieldbearer', 'o_armorer', 'o_weaponsmith', 'o_artisan', 'o_collector', 'o_inventor', 'o_engineer', 'o_toolmaster', 'o_mage', 'o_sage', 'o_battle_mage', 'o_beast_tamer', 'o_beast_lord', 'o_banker', 'o_smuggler', 'o_steward', 'o_archaeologist', 'o_curator', 'o_relic_hunter', 'o_adventurer', 'o_guild_clerk', 'o_matron', 'o_drill_sergeant', 'o_fortifier', 'o_guard_captain']);
export const OCCUPATIONS: CardDef[] = ALL_OCCUPATIONS.filter((c) => KEEP_OCCUPATIONS.has(c.id));
