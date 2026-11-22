// 霧谷の冒険者団 v2 — 段階カード（SPEC §4）。めくると新しい行動マスになる。
// effects の `use` 1つ1つが「このマスでできること」の選択肢（複数あればどれか1つ）。if があれば満たすときだけ選べる。
// id はそのまま行動マスの id（カードの `use:<id>` / `instead:<id>` / `other:<id>` が指す）。
import type { StageDef, Op, Cond } from '../types';

const opt = (ops: Op[], cond?: Cond) => (cond ? { when: 'use' as const, if: cond, do: ops } : { when: 'use' as const, do: ops });

export const STAGES: StageDef[] = [
  // ---------------- 段階0（始めから盤面にある場所）
  {
    id: 'training', kind: 'stage', stage: 0, name: '訓練場', engine: ['fort', 'hunt'], mech: 'action',
    effects: [
      opt([{ pay: { food: 1 } }, { train: 'atk' }]),
      opt([{ pay: { food: 1 } }, { train: 'def' }]),
    ],
    text: '次のどれか：食料1で選んだ仲間1人の攻めの熟練+1（3まで）／食料1で守りの熟練+1（2まで）。',
  },
  {
    id: 'ruins', kind: 'stage', stage: 0, name: '遺跡の探索', engine: ['ruins'], mech: 'action',
    effects: [
      opt([{ draw_any: { from: ['weapon', 'armor', 'tool', 'spell'], look: 3, take: 1 } }]),
      opt([{ relic: 1 }]),
    ],
    text: '次のどれか：武器・防具・道具・秘術から山を1つ選び、3枚見て1枚を手札に／遺物を1枚引く。',
  },
  // ---------------- 段階1（最初の年 R2〜R4、3枚全部）
  {
    id: 'tavern', kind: 'stage', stage: 1, name: '酒場で募集', engine: ['family'], mech: 'action',
    effects: [opt([{ pay: { food: 3, gold: 1 } }, { hire: 1 }])],
    text: '食料3・金貨1を払い、仲間を1人雇う（寝床が要る）。',
  },
  {
    id: 'apprentice', kind: 'stage', stage: 1, name: '弟子入り', engine: ['bridge', 'family'], mech: 'action',
    effects: [
      opt([{ occ: 1 }, { draw: { from: 'occ', look: 3, take: 1 } }]),
      opt([{ draw: { from: 'occ', look: 3, take: 1 } }, { gain: { food: 1 } }]),
    ],
    text: '次のどれか：手札の職能を1枚出して（費用はギルドと同じ）、職能の山から3枚見て1枚を手札に／職能の山から3枚見て1枚を手札に、食料+1。',
  },
  {
    id: 'walls', kind: 'stage', stage: 1, name: '城壁の普請', engine: ['fort'], mech: 'action',
    effects: [opt([{ build: 'wall', discount: { wood: 1 } }])],
    text: '防壁を1つ建てる（木材1安い）。',
  },
  // ---------------- 段階2（候補5から4枚）
  {
    id: 'bazaar', kind: 'stage', stage: 2, name: '大市', engine: ['gather', 'smith'], mech: 'action',
    effects: [
      opt([{ gain: { wood: 1, iron: 1 } }]),
      opt([{ gain: { wood: 1, herb: 1 } }]),
      opt([{ gain: { iron: 1 } }]),
      opt([{ gain: { herb: 1, mana: 1 } }]),
      opt([{ gain: { food: 1 } }]),
      opt([{ gain: { wood: 1, mana: 1 } }]),
    ],
    text: '資源を1つずつ得る（木材＋鉄／木材＋薬草／鉄／薬草＋マナ鉱石／食料／木材＋マナ鉱石から1つ）。',
  },
  {
    id: 'family', kind: 'stage', stage: 2, name: '対家の家族', engine: ['family'], mech: 'action',
    effects: [opt([{ pay: { food: 4, gold: 1 } }, { hire_free: 1 }])],
    text: '食料4・金貨1を払い、寝床なしで仲間を1人増やす。',
  },
  {
    id: 'lodge', kind: 'stage', stage: 2, name: '狩人の小屋', engine: ['hunt', 'family'], mech: 'accrue',
    accum: { food: 2 },
    effects: [opt([{ gain: { food: 1 } }])],
    text: 'たまるマス（毎ラウンド食料+2）。たまった食料と、さらに食料1を得る。',
  },
  {
    id: 'library', kind: 'stage', stage: 2, name: '魔導書庫', engine: ['arcane'], mech: 'action',
    effects: [opt([{ draw: { from: 'spell', look: 2, take: 1 } }, { gain: { mana: 1 } }])],
    text: '秘術の山から2枚見て1枚を手札に。マナ鉱石+1。',
  },
  {
    id: 'kennel', kind: 'stage', stage: 2, name: '獣舎の開放', engine: ['beast'], mech: 'action',
    effects: [
      opt([{ tame: true }]),
      opt([{ gain: { food: 1 } }]),
    ],
    text: '次のどれか：巣にいる魔物1体を戦わずに使い魔にする（捕まえる食料＝強さ÷4は払う）／食料1を得る。',
  },
  // ---------------- 段階3（4枚全部）
  {
    id: 'raid', kind: 'stage', stage: 3, name: '討伐隊', engine: ['hunt', 'boss'], mech: 'action',
    effects: [opt([{ extra_worker: 1 }, { ignore_full: true }])],
    text: 'このラウンド、仲間をもう1人置ける。その仲間は定員の埋まった巣にも置ける（巣に2回挑める）。',
  },
  {
    id: 'tradepost', kind: 'stage', stage: 3, name: '交易所の拡張', engine: ['trade'], mech: 'accrue',
    accum: { gold: 1 },
    effects: [opt([{ exchange: true }])],
    text: 'たまるマス（毎ラウンド金貨+1）。たまった金貨を得て、売るか買うを1回する。',
  },
  {
    id: 'recommend', kind: 'stage', stage: 3, name: 'ギルドの推薦', engine: ['bridge'], mech: 'action',
    effects: [opt([{ occ: 1 }, { occ: 1 }])],
    text: '手札の職能を2枚まで出す（費用はギルドと同じ）。',
  },
  {
    id: 'bigforge', kind: 'stage', stage: 3, name: '大鍛冶場', engine: ['smith'], mech: 'action',
    effects: [opt([{ craft: 'any' }, { craft: 'any' }])],
    text: '装備を2つまで作る（費用はそれぞれ払う。武器・防具どちらでも）。',
  },
  // ---------------- 段階4（4枚全部）
  {
    id: 'hero', kind: 'stage', stage: 4, name: '英雄の招聘', engine: ['family', 'hunt'], mech: 'action',
    effects: [opt([{ pay: { food: 2, gold: 2 } }, { hire_free: 1 }, { train: 'any' }])],
    text: '食料2・金貨2を払い、寝床なしで仲間を1人増やし、その仲間に熟練+1（攻めか守り）。',
  },
  {
    id: 'treasury', kind: 'stage', stage: 4, name: '宝物庫', engine: ['ruins', 'trade'], mech: 'action',
    effects: [
      opt([{ relic: 1 }]),
      opt([{ gain: { gold: 4 } }]),
    ],
    text: '次のどれか：遺物を1枚引く／金貨4を得る。',
  },
  {
    id: 'envoy', kind: 'stage', stage: 4, name: '王都の使者', engine: ['quest', 'trade'], mech: 'convert',
    effects: [
      opt([{ donate: { pay: { gold: 4 }, fame: 2 } }]),
      opt([{ gain: { gold: 3 } }], { min: { quests: 1 } }),
    ],
    text: '次のどれか：金貨4を献上して名声2／依頼を1つ以上達成していれば金貨3を得る。',
  },
  {
    id: 'clearing', kind: 'stage', stage: 4, name: '土地の開拓', engine: ['fort', 'family'], mech: 'action',
    effects: [
      opt([{ build: 'bed', discount: { wood: 3 } }, { gain: { wood: 2 } }]),
      opt([{ build: 'facility', discount: { wood: 1 } }, { gain: { wood: 2 } }]),
    ],
    text: '木材2を得て、次のどれか：寝床を1つ建てる（木材3安い）／施設を1つ建てる（木材1安い）。',
  },
  // ---------------- 段階5（3枚全部）
  {
    id: 'prepare', kind: 'stage', stage: 5, name: '決戦の準備', engine: ['boss'], mech: 'action',
    effects: [opt([{ train: 'any' }, { gain: { herb: 2, mana: 1 } }])],
    text: '仲間1人に熟練+1（攻めか守り）。薬草2とマナ鉱石1を得る。',
  },
  {
    id: 'triumph', kind: 'stage', stage: 5, name: '凱旋', engine: ['hunt'], mech: 'endfame',
    effects: [
      { when: 'use' as const, if: { min: { races: 3 } }, do: [{ fame_per: { stat: 'races', per: 1 } }, { fame: -1 }], limit: 'game' as const },
      opt([{ gain: { food: 2 } }]),
    ],
    text: '次のどれか（名声は1試合に1回、年数の倍率がかかる）：倒した種族3種で名声2・4種で名声3・5種で名声4／食料2を得る。',
  },
  {
    id: 'infirmary', kind: 'stage', stage: 5, name: '救護所', engine: ['boss', 'hunt'], mech: 'action',
    effects: [opt([{ heal: 6 }, { gain: { herb: 1 } }])],
    text: '負傷した仲間を全員回復する。薬草+1。',
  },
];
