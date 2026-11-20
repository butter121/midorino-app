// 霧谷の冒険者団 v2 — 依頼（SPEC §9）。
// 共通の依頼（secret: false）：試合ごとに3枚。先着で名声 4・3・2。
// 秘密依頼（secret: true）：準備段階で2枚見て1枚。達成で fame（4〜6）。強い動きごとに1枚以上。
import type { QuestDef } from '../types';

export const QUESTS: QuestDef[] = [
  // ---------------- 共通の依頼
  { id: 'q_kill4', kind: 'quest', name: '魔物退治', secret: false, need: { min: { kills: 4 } }, text: '魔物を4体倒す。' },
  { id: 'q_races3', kind: 'quest', name: '谷の生き物調べ', secret: false, need: { min: { races: 3 } }, text: '3種類の種族の魔物を倒す。' },
  { id: 'q_boss', kind: 'quest', name: '主の討伐', secret: false, need: { min: { boss: 1 } }, text: '主を1体倒す（共闘でもよい）。' },
  { id: 'q_comp4', kind: 'quest', name: '仲間集め', secret: false, need: { min: { comps: 4 } }, text: '仲間を4人にする。' },
  { id: 'q_fac3', kind: 'quest', name: '拠点づくり', secret: false, need: { min: { tools: 3 } }, text: '道具を3つ建てる。' },
  { id: 'q_wall3', kind: 'quest', name: '城壁の完成', secret: false, need: { min: { walls: 3 } }, text: '防壁を3つ建てる。' },
  { id: 'q_gear4', kind: 'quest', name: '装備の支度', secret: false, need: { min: { gear: 4 } }, text: '仲間に装備を合わせて4つ持たせる。' },
  { id: 'q_occ3', kind: 'quest', name: '腕利きぞろい', secret: false, need: { min: { occs: 3 } }, text: '職能を3枚出す。' },
  { id: 'q_spell3', kind: 'quest', name: '秘術の研究', secret: false, need: { min: { casts: 4 } }, text: '秘術を4回唱える。' },
  { id: 'q_kinds4', kind: 'quest', name: '品物の目利き', secret: false, need: { min: { kinds: 4 } }, text: '武器・防具・道具・秘術を全部使う（持たせた武器・防具、建てた道具、唱えた秘術）。' },
  { id: 'q_sold6', kind: 'quest', name: '市場の常連', secret: false, need: { min: { sold: 6 } }, text: '交換所などで6回売る。' },
  { id: 'q_gold10', kind: 'quest', name: '軍資金', secret: false, need: { res_min: { gold: 10 } }, text: '金貨を10枚持つ。' },
  { id: 'q_coop2', kind: 'quest', name: '肩を並べて', secret: false, need: { min: { coop: 2 } }, text: '共闘で魔物を2体倒す。' },
  { id: 'q_pet2', kind: 'quest', name: '獣の友', secret: false, need: { min: { pets: 2 } }, text: '使い魔を2体持つ。' },
  { id: 'q_ancient3', kind: 'quest', name: '遺物の収集', secret: false, need: { min: { ancient: 3 } }, text: '古代の品を3つ持つ。' },
  { id: 'q_skill3', kind: 'quest', name: '鍛錬', secret: false, need: { min: { skills: 3 } }, text: '熟練を合わせて3つつける。' },

  // ---------------- 秘密依頼
  { id: 'sq_hunt', kind: 'quest', name: '百戦錬磨', secret: true, fame: 5, need: { min: { kills: 7 } }, text: '魔物を7体倒す。' },
  { id: 'sq_gather', kind: 'quest', name: '蔵いっぱいの恵み', secret: true, fame: 4, need: { res_min: { wood: 6, herb: 4 } }, text: '木材6と薬草4を同時に持つ。' },
  { id: 'sq_trade', kind: 'quest', name: '名の知れた商人', secret: true, fame: 5, need: { min: { sold: 10 } }, text: '交換所などで10回売る。' },
  { id: 'sq_fort', kind: 'quest', name: '難攻不落', secret: true, fame: 5, need: { min: { walls: 4, tools: 3 } }, text: '防壁4つと道具3つを持つ。' },
  { id: 'sq_smith', kind: 'quest', name: '名工の誉れ', secret: true, fame: 5, need: { min: { gear: 6 } }, text: '仲間に装備を合わせて6つ持たせる。' },
  { id: 'sq_family', kind: 'quest', name: '大所帯の長', secret: true, fame: 5, need: { min: { comps: 6 } }, text: '仲間を6人にする。' },
  { id: 'sq_arcane', kind: 'quest', name: '大魔導の道', secret: true, fame: 5, need: { min: { casts: 10 } }, text: '秘術を10回唱える。' },
  { id: 'sq_beast', kind: 'quest', name: '獣の群れの主', secret: true, fame: 5, need: { min: { pets: 3 } }, text: '使い魔を3体持つ。' },
  { id: 'sq_quest', kind: 'quest', name: '依頼の達人', secret: true, fame: 4, need: { min: { quests: 2 } }, text: '共通の依頼を2つ達成する。' },
  { id: 'sq_ally', kind: 'quest', name: '盟友', secret: true, fame: 5, need: { min: { coop: 3 } }, text: '共闘で魔物を3体倒す。' },
  { id: 'sq_ruins', kind: 'quest', name: '古代の探究者', secret: true, fame: 5, need: { min: { ancient: 5 } }, text: '遺物を5つ持つ。' },
  { id: 'sq_boss', kind: 'quest', name: '主殺し', secret: true, fame: 6, need: { min: { boss: 2 } }, text: '主・古竜を合わせて2体倒す（共闘でもよい）。' },
  { id: 'sq_pious', kind: 'quest', name: '敬虔な寄進者', secret: true, fame: 4, need: { min: { donations: 3 } }, text: '寄進を3回する。' },
  { id: 'sq_balance', kind: 'quest', name: '万能の団', secret: true, fame: 6, need: { min: { races: 4, occs: 3 } }, text: '4種類の種族を倒し、職能を3枚出す。' },
];
