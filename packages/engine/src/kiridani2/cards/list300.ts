// 霧谷の冒険者団 v2 — 職能・品物 300 枚（K さんのリスト「職能・品物の案」。リーダー12人×職能・武器・防具・道具・秘術 各5枚）。
// text はリストの効果の文そのまま。効果はエンジンの DSL で書き、エンジンにない仕組みは近い効果で代わりにしている（下の「近い効果」の印）。
// 武器・防具の魔石の段階は重さで決まる（初級＝light・中級＝mid・上級＝heavy）。両手武器は two_hand。
import type { CardDef, Cost, EngineTag, Res } from '../types';
import { W, A, T, S, TM, O, on, fight, win, hit, play, end, passive, powPer, famePer } from './mk';

const X = (c: CardDef, text: string): CardDef => ({ ...c, text });
const L = { weight: 'light' as const }, M = { weight: 'mid' as const }, H = { weight: 'heavy' as const };
const H2 = { weight: 'heavy' as const, two_hand: true }, M2 = { weight: 'mid' as const, two_hand: true }, L2 = { weight: 'light' as const, two_hand: true };
const ANY: Res[] = ['wood', 'iron', 'herb', 'food', 'mana', 'mat'];
const pick = (n: number) => ({ gain_pick: { n, from: ANY } });
const g = (c: Cost) => ({ gain: c });
const once = 'game' as const, rnd = 'round' as const, yr = 'year' as const;
const spring = { season: 'spring' as const };

// ================================================================ 武器狂いアカネ（ak）
const AK: EngineTag[] = ['hunt', 'smith'];
const ak: CardDef[] = [
  X(O('o_ak1', '武器の目利き', AK, [on('occ', [{ draw: { from: 'weapon', look: 3, take: 1 } }], undefined, once)]), '出したとき、武器の山を3枚見て1枚を手札に取る。'),
  X(O('o_ak2', '武器鍛冶の徒弟', AK, [passive({ cost_discount: { kind: 'weapon', res: { iron: 1 } } })]), '武器を作る費用−1。'),
  // 近い効果：2本目の軽い武器のかわりに、武器を持っていれば戦力+1
  X(O('o_ak3', '二刀の心得', AK, [fight([{ power: 1 }], { min: { weapons: 1 } })]), '武器の重さが軽い武器を2本まで持てる。'),
  X(O('o_ak4', '賞金稼ぎ', AK, [win([g({ gold: 2 })])]), '魔物を倒したとき、金貨を2得る'),
  X(O('o_ak5', '丸太投げ名人', AK, [fight([{ pay: { wood: 1 } }, { power: 1 }]), fight([{ pay: { wood: 1 } }, { power: 1 }])]), '魔物と戦う時、木を1消費して攻撃力を1追加できる(2回まで)'),
  X(W('w_ak1', '武勲の短剣', AK, { iron: 1 }, 1, [win([{ trophy: 1 }])], L), '戦力+1。勝つと証+1。'),
  X(W('w_ak2', '略奪の斧', AK, { iron: 2, wood: 1 }, 2, [win([{ loot: 1 }])], M), '戦力+2。勝つと戦利品+1。'),
  X(W('w_ak3', '吸血の剣', AK, { iron: 2, herb: 1 }, 2, [win([{ heal: 1 }])], M), '戦力+2。勝つと負傷を1つ治す。'),
  X(W('w_ak4', '雷の槍', AK, { iron: 2, mana: 1 }, 3, [], M), '戦力+3。'),
  X(W('w_ak5', '重剛の大剣', AK, { iron: 4, mana: 2 }, 6, [], H2), '戦力+6。'),
  // 近い効果：武器をもう1本のかわりに戦力+1
  X(A('a_ak1', '剣帯', AK, { mat: 1 }, 0, [fight([{ power: 1 }], { min: { weapons: 1 } })], L), '守り+0。武器を1本多く持てる。'),
  X(A('a_ak2', '衝撃吸収の鎖帷子', AK, { iron: 1, mat: 1 }, 1, [fight([{ counter: -1 }])], L), '守り+1。反撃−1。'),
  // 近い効果：1体でも倒していれば戦力+1
  X(A('a_ak3', '連勝の兜', AK, { iron: 2 }, 2, [fight([{ power: 1 }], { min: { kills: 1 } })], M), '守り+2。勝った次の戦闘は戦力+1。'),
  X(A('a_ak4', '狩り装束', AK, { mat: 2 }, 1, [on('use:nest', [g({ food: 1 })])], M), '守り+1。巣のマスで食料+1。'),
  X(A('a_ak5', '鋼板の鎧', AK, { iron: 3, mat: 2 }, 4, [], H), '守り+4。'),
  X(T('t_ak1', '砥石', AK, { wood: 1, iron: 1 }, [fight([powPer('weapons', 1, 1, 3)])]), '武器1本につき戦力+1。'),
  X(T('t_ak2', '武器の鋳型', AK, { wood: 2, iron: 1 }, [passive({ cost_discount: { kind: 'weapon', res: { iron: 1 } } })]), '武器を作るとき費用−1。'),
  X(T('t_ak3', '救護テント', AK, { wood: 3 }, [on('round_start', [{ heal: 1 }])]), 'ラウンドの始めに負傷を1つ治す。'),
  // 近い効果：印のかわりに、戦闘で鉄1を払って戦力+2（1ラウンド1回）
  X(T('t_ak4', '鍛え直しの炉', AK, { wood: 2, iron: 2 }, [fight([{ pay: { iron: 1 } }, { power: 2 }], undefined, rnd)]), '鉄1を払って、武器1本に戦力+1の印をつける（最大2）。'),
  X(T('t_ak5', '証の陳列棚', AK, { wood: 2 }, [end([famePer('trophies', 3)])]), '証3つごとに名声+1。'),
  X(S('s_ak1', '刃の祝福', AK, { mana: 1 }, [fight([{ power: 2 }])], L), 'この戦闘で武器の戦力+2。'),
  // 近い効果：武器の効果をもう一度のかわりに戦力+2・証+1
  X(S('s_ak2', '二度斬り', AK, { mana: 2 }, [fight([{ power: 2 }, { trophy: 1 }])], M), 'この戦闘で武器の効果をもう一度起こす。'),
  // 近い効果：このラウンド仲間をもう1人置け、埋まった巣にも置ける
  X(S('s_ak3', '追撃', AK, { mana: 3 }, [play([{ extra_worker: 1 }, { ignore_full: true }])], H), '勝ったあと、同じ仲間でほかの巣の魔物とも戦える。'),
  X(TM('s_ak4', '研ぎ澄まし', AK, { mana: 2, iron: 1 }, 1, { mana: 1 }, [fight([{ power: 1 }])]), 'この戦闘で武器の戦力+1。'),
  // 近い効果：引き直しのかわりに戦力+1
  X(TM('s_ak5', '運命返し', AK, { mana: 2 }, 1, { mana: 1 }, [fight([{ power: 1 }])]), '運命カードを1回引き直す。(発動は運命カードが確定してから)'),
];

// ================================================================ 修行の鬼ジン（jn）
const JN: EngineTag[] = ['hunt', 'family'];
const jn: CardDef[] = [
  X(O('o_jn1', '指南役', JN, [on('use:training', [{ train: 'any' }])]), '訓練のマスを使うと、もう1人の仲間も同じ熟練+1。'),
  X(O('o_jn2', '見取り稽古', JN, [on('other:training', [{ pay: { food: 1 } }, { train: 'any' }])]), 'ほかの人が訓練のマスを使ったとき、食料1を払えば自分の仲間1人も同じ熟練+1。'),
  // 近い効果：訓練のマスを使ったあと、薬草1を食料1に換えられる
  X(O('o_jn3', '薬膳の修行僧', JN, [on('use:training', [{ convert: { from: { herb: 1 }, to: { food: 1 } } }])]), '熟練を上げる時、食料ではなく薬草でも上げることができる'),
  X(O('o_jn4', '隊長', JN, [passive({ send_cap: 1 })]), '戦闘に送れる仲間+1。'),
  X(O('o_jn5', '朝稽古', JN, [on('round_start', [{ pay: { food: 1 } }, { train: 'any' }], undefined, rnd)]), 'ラウンドの始めに、食料1で仲間1人の熟練+1（1ラウンド1回）。'),
  X(W('w_jn1', '稽古用の木刀', JN, { wood: 1 }, 1, [win([{ train: 'any' }])], L), '戦力+1。これを持って勝つと熟練+1。'),
  X(W('w_jn2', '腕前の剣', JN, { iron: 2 }, 1, [fight([powPer('sent_atk', 2, 1, 3)])], M), '戦力+1。持ち主の熟練2ごとに戦力+1。'),
  // 近い効果：共闘のかわりに2人以上で勝つと熟練+1
  X(W('w_jn3', '連携の双剣', JN, { iron: 2, wood: 1 }, 2, [win([{ train: 'any' }], { k_min: 2 })], M), '戦力+2。共闘で勝つと、送った仲間全員の熟練+1。'),
  X(W('w_jn4', '重りの槍', JN, { iron: 3 }, 1, [on('use:training', [{ train: 'any' }])], M), '戦力+1。持っている間、訓練のマスの熟練+1。'),
  X(W('w_jn5', '達人の刀', JN, { iron: 4, mana: 1 }, 3, [fight([{ power: 3 }], { min: { sent_atk: 3 } })], H2), '戦力+3。熟練が上限の仲間が持つと戦力+3。'),
  X(A('a_jn1', '道着', JN, { mat: 1 }, 1, [on('use:training', [{ train: 'any' }])], L), '守り+1。訓練のマスで熟練+1多く上がる。'),
  // 近い効果：訓練のマスを使うと負傷を1つ治す
  X(A('a_jn2', '根性の鉢巻', JN, { herb: 1 }, 1, [on('use:training', [{ heal: 1 }])], L), '守り+1。負傷していても訓練のマスを使える。'),
  // 近い効果：年の始めに仲間1人の熟練+1
  X(A('a_jn3', '伝承の羽織', JN, { mat: 2 }, 2, [on('round_start', [{ train: 'any' }], spring, yr)], M), '守り+2。年に1回、持ち主の熟練の上昇値をそのまま他の仲間にコピーできる。'),
  X(A('a_jn4', '厚手の鎖帷子', JN, { iron: 2, mat: 1 }, 2, [fight([{ counter: -1 }])], M), '守り+2。反撃−1。'),
  X(A('a_jn5', '不屈の鎧', JN, { iron: 3, mat: 2 }, 3, [on('lose', [famePer('sent_atk', 2)])], H), '守り+3。負けても、送った仲間の熟練の合計の半分の名声。'),
  // 近い効果：広場（何人でも置ける）で、食料1を払って熟練+1できる
  X(T('t_jn1', '道場', JN, { wood: 3, iron: 1 }, [on('instead:plaza', [{ pay: { food: 1 } }, { train: 'any' }])]), '自分だけが使える訓練のマスを1つ持つ。'),
  X(T('t_jn2', '底上げの的', JN, { wood: 2 }, [on('round_start', [{ train: 'any' }])]), 'ラウンドの始めに、熟練がいちばん低い仲間の熟練+1。'),
  X(T('t_jn3', '兵舎', JN, { wood: 3, iron: 1 }, [passive({ bed_cap: 1 })]), '仲間を持てる数+1。'),
  X(T('t_jn4', '奥義書の書庫', JN, { wood: 2, mana: 1 }, [passive({ skill_cap: 1 })]), '熟練の上限+1。'),
  X(T('t_jn5', '食堂', JN, { wood: 2, food: 1 }, [passive({ upkeep: -1 })]), '冬の食料−1。熟練に'),
  // 近い効果：熟練+2のかわりに戦力+2
  X(S('s_jn1', '覚醒', JN, { mana: 1 }, [fight([{ power: 2 }])], L), 'この戦闘だけ、仲間1人の熟練+2。'),
  // 近い効果：仲間1人の熟練+1を2回
  X(S('s_jn2', '伝授', JN, { mana: 2 }, [play([{ train: 'any' }, { train: 'any' }])], M), '仲間1人の熟練を、もう1人に写す。'),
  // 近い効果：このラウンド仲間をもう1人置ける
  X(S('s_jn3', '総力戦', JN, { mana: 2 }, [play([{ extra_worker: 1 }])], M), 'この戦闘に仲間をもう1人送れる。'),
  X(TM('s_jn4', '特訓', JN, { mana: 2, food: 1 }, 1, { mana: 1, food: 1 }, [play([{ train: 'any' }])]), '仲間1人の熟練+1。'),
  X(TM('s_jn5', '手当て', JN, { mana: 2, herb: 1 }, 1, { mana: 1 }, [play([{ heal: 1 }])]), '負傷を1つ治す。'),
];

// ================================================================ 連唱魔女ミナ（mn）
const MN: EngineTag[] = ['arcane'];
const mn: CardDef[] = [
  // 近い効果：ラウンドで最初の秘術を使ったあとマナ鉱石1
  X(O('o_mn1', '詠唱短縮', MN, [on('spell', [g({ mana: 1 })], undefined, rnd)]), 'ラウンドで最初に使う秘術の費用−1。'),
  X(O('o_mn2', '写本師', MN, [passive({ spell_return: 1 })]), '使った秘術を、マナ鉱石1で手札に戻せる（1ラウンド1回）。'),
  X(O('o_mn3', '魔法剣士', MN, [fight([{ power: 2 }], { min: { casts_round: 1 } })]), '秘術を使った戦闘では戦力+2。'),
  X(O('o_mn4', '魔導書集め', MN, [on('occ', [{ draw: { from: 'spell', look: 2, take: 2 } }], undefined, once)]), '出したとき、秘術の山から2枚取る。'),
  // 近い効果：広場に置くとマナ鉱石2
  X(O('o_mn5', '瞑想家', MN, [on('use:plaza', [g({ mana: 2 })])]), '仲間を1人マスに置かずに休ませると、マナ鉱石2。'),
  X(W('w_mn1', '詠唱の短杖', MN, { wood: 1 }, 1, [fight([{ power: 1 }], { min: { casts_round: 1 } })], L), '戦力+1。秘術を使った戦闘では戦力+1。'),
  X(W('w_mn2', '吸魔の短剣', MN, { iron: 1, mana: 1 }, 1, [win([g({ mana: 1 })])], L), '戦力+1。勝つとマナ鉱石1。'),
  X(W('w_mn3', '共鳴の杖', MN, { wood: 2, mana: 1 }, 1, [fight([powPer('casts_round', 1, 1, 3)])], M), '戦力+1。このラウンドに使った秘術1つごとに戦力+1（最大3）。'),
  X(W('w_mn4', '呪文食いの剣', MN, { iron: 2, mana: 1 }, 2, [win([{ draw: { from: 'spell', look: 1, take: 1 } }])], M), '戦力+2。勝つと秘術を1枚引く。'),
  X(W('w_mn5', '大魔導の杖', MN, { wood: 2, mana: 3 }, 3, [passive({ cost_discount: { kind: 'spell', res: { mana: 1 } } })], H2), '戦力+3。秘術の費用−1。'),
  X(A('a_mn1', '魔導士のローブ', MN, { mat: 1 }, 1, [on('round_start', [g({ mana: 1 })], spring)], L), '守り+1。年の始めにマナ鉱石1。'),
  // 近い効果：ラウンドの始めに薬草2をマナ鉱石1に換えられる
  X(A('a_mn2', '薬草の護符', MN, { herb: 1 }, 1, [on('round_start', [{ convert: { from: { herb: 2 }, to: { mana: 1 } } }])], L), '守り+1。秘術の費用を薬草で払える（マナ鉱石1＝薬草2）。'),
  X(A('a_mn3', '結界の外套', MN, { mat: 2, mana: 1 }, 2, [fight([{ counter: -1 }], { min: { casts_round: 1 } })], M), '守り+2。秘術を使った戦闘では反撃−1。'),
  X(A('a_mn4', '星詠みの冠', MN, { iron: 1, mana: 1 }, 1, [on('round_start', [{ draw: { from: 'spell', look: 3, take: 1 } }])], M), '守り+1。ラウンドに1回、秘術の山の上3枚を見て1枚取り、残りを下に戻す。'),
  X(A('a_mn5', '重ね掛けの法衣', MN, { mat: 2, mana: 2 }, 3, [fight([{ guard: 1 }], { min: { casts_round: 1 } }), fight([{ guard: 1 }], { min: { casts_round: 2 } }), fight([{ guard: 1 }], { min: { casts_round: 3 } })], H), '守り+3。この戦闘で使った秘術1つごとに守り+1。'),
  X(T('t_mn1', '魔力の泉', MN, { wood: 2, mana: 1 }, [on('round_start', [g({ mana: 1 })])]), 'ラウンドの始めにマナ鉱石1。'),
  X(T('t_mn2', '書斎', MN, { wood: 3 }, [on('round_start', [{ draw: { from: 'spell', look: 3, take: 1 } }], spring)]), '年の初めに秘術を3枚引き、その中から1枚選ぶ'),
  X(T('t_mn3', '還元の魔法陣', MN, { wood: 2, iron: 1 }, [on('spell', [g({ mana: 2 })], { min: { casts_round: 3 } }, rnd)]), '1ラウンドに秘術を3つ以上使ったら、マナ鉱石2を受け取る。'),
  X(T('t_mn4', '錬金炉', MN, { iron: 2 }, [on('round_start', [{ convert: { from: { herb: 2 }, to: { mana: 1 } } }])]), '薬草2をマナ鉱石1に換えられる（いつでも）。'),
  X(T('t_mn5', '豊穣の水晶玉', MN, { iron: 1, mana: 1 }, [on('spell', [g({ food: 1 })], undefined, rnd)]), '秘術を使用すると食料+1(1ラウンド1回)'),
  X(TM('s_mn1', '火花', MN, { mana: 1 }, 1, {}, [fight([{ power: 1 }])]), 'この戦闘で戦力+1。'),
  X(TM('s_mn2', '魔力の矢', MN, { mana: 2 }, 2, { mana: 1 }, [fight([{ power: 2 }])]), 'この戦闘で戦力+2。'),
  // 近い効果：マナ鉱石2を得る（次の秘術の費用に）
  X(S('s_mn3', '連鎖詠唱', MN, { mana: 1 }, [play([g({ mana: 2 })])], L), '次に使う秘術の費用なし。'),
  X(S('s_mn4', '魔導書の招来', MN, { mana: 1 }, [play([{ draw: { from: 'spell', look: 2, take: 2 } }])], L), '秘術の山から2枚引く。'),
  X(S('s_mn5', '大火球', MN, { mana: 3 }, [fight([{ power: 5 }])], H), 'この戦闘で戦力+5。'),
];

// ================================================================ 鉄壁ガレス（ga）
const GA: EngineTag[] = ['fort', 'boss'];
const ga: CardDef[] = [
  X(O('o_ga1', '防具職人', GA, [passive({ cost_discount: { kind: 'armor', res: { iron: 1 } } })]), '防具を作る費用の鉄−1。'),
  // 近い効果：防具を持っていれば守り+1
  X(O('o_ga2', '重装の心得', GA, [fight([{ guard: 1 }], { min: { armors: 1 } })]), '軽い防具をもう1つ着られる。'),
  // 近い効果：防具を2つ以上持たせていれば反撃−1
  X(O('o_ga3', '固い構え', GA, [fight([{ counter: -1 }], { min: { armors: 2 } })]), '守りが5以上なら反撃−1。'),
  X(O('o_ga4', '盾持ちの従者', GA, [fight([{ guard: 1 }], { coop: true })]), '共闘のとき、相手の守り+1、自分の守り+1。'),
  // 近い効果：訓練のマスを使ったら食料1を戻す
  X(O('o_ga5', '守りの自主練', GA, [on('use:training', [g({ food: 1 })], undefined, rnd)]), '守りの訓練時に、食料を使わなくて良い(2ラウンドに1回)'),
  X(W('w_ga1', '盾剣', GA, { iron: 1 }, 0, [], { ...L, guard: 1 }), '戦力+0。守り+1。'),
  X(W('w_ga2', '受け流しの短剣', GA, { iron: 1 }, 1, [fight([{ counter: -1 }])], L), '戦力+1。反撃−1。'),
  X(W('w_ga3', '盾付きの槍', GA, { iron: 2, wood: 1 }, 1, [], { ...M, guard: 2 }), '戦力+1。守り+2。'),
  X(W('w_ga4', '鎮めの棍', GA, { wood: 2, herb: 1 }, 1, [fight([{ counter: -2 }])], M), '戦力+1。反撃−2。'),
  X(W('w_ga5', '城門の大盾', GA, { iron: 4, wood: 2 }, 0, [], { ...H2, guard: 5 }), '戦力+0。守り+5。'),
  X(A('a_ga1', '革の小盾', GA, { mat: 1 }, 2, [], L), '守り+2。'),
  X(A('a_ga2', '鉄の大盾', GA, { iron: 3 }, 3, [], M), '守り+3。'),
  X(A('a_ga3', '跳ね返しの盾', GA, { iron: 2, mana: 1 }, 2, [fight([{ counter: -1 }])], M), '守り+2。反撃−1。'),
  X(A('a_ga4', '大食らいの全身鎧', GA, { iron: 5 }, 6, [passive({ upkeep: 1 })], H), '守り+6。冬の食料+1。'),
  X(A('a_ga5', '聖騎士の鎧', GA, { iron: 3, mana: 2 }, 4, [fight([{ counter: -1 }])], H), '守り+4。反撃−1。'),
  X(T('t_ga1', '鎧の手入れ台', GA, { wood: 2, iron: 1 }, [fight([{ guard: 1 }], { min: { armors: 1 } })]), '防具1つの守り+1。'),
  X(T('t_ga2', '防具の型紙', GA, { wood: 3, iron: 1 }, [passive({ stone_down: 'armor' })]), '防具を作るとき、魔石の段階を1つ下げて払える。'),
  X(T('t_ga3', '治療院', GA, { wood: 2, herb: 1 }, [passive({ heal_discount: 1 })]), '負傷を治す薬草−1。'),
  X(T('t_ga4', '防具の陳列棚', GA, { wood: 2 }, [end([famePer('armors', 1)])]), '試合の終わりに、防具1つごとに名声1。'),
  X(T('t_ga5', '製鉄所', GA, { wood: 2, iron: 1 }, [on('round_start', [g({ iron: 1 })])]), 'ラウンドの始めに鉄1。'),
  X(TM('s_ga1', '守護', GA, { mana: 2 }, 1, { mana: 1 }, [fight([{ guard: 2 }])]), 'この戦闘で守り+2。'),
  X(S('s_ga2', '鈍化', GA, { mana: 1 }, [fight([{ counter: -2 }])], L), '魔物の反撃−2。'),
  X(S('s_ga3', '石の肌', GA, { mana: 2 }, [fight([{ guard: 3 }])], M), 'この戦闘で守り+3。'),
  // 近い効果：守り+2
  X(S('s_ga4', '盾の誓い', GA, { mana: 2 }, [fight([{ guard: 2 }])], M), '共闘の相手の守りを、自分の守りにも足す。'),
  X(TM('s_ga5', '癒しの光', GA, { mana: 2, herb: 1 }, 1, { mana: 1 }, [play([{ heal: 1 }])]), '負傷を1つ治す。'),
];

// ================================================================ 餌付け師ハル（ha）
const HA: EngineTag[] = ['beast'];
const ha: CardDef[] = [
  X(O('o_ha1', '餌付け名人', HA, [passive({ fav_cut: 1 })]), '好物の数−1（最低1）。'),
  // 近い効果：使い魔にしたあと好きな資源1
  X(O('o_ha2', '獣の通訳', HA, [on('tame', [pick(1)])]), '好物でない資源2つを、好物1つとして払える。'),
  X(O('o_ha3', '獣舎番', HA, [passive({ pet_cap: 1 })]), '持てる使い魔+1。'),
  X(O('o_ha4', '群れの指揮官', HA, [fight([powPer('pets', 1)])]), '使い魔1体につき基礎戦力+1'),
  X(O('o_ha5', '群れの世話係', HA, [on('round_start', [g({ food: 1 })], { min: { pets: 2 } })]), '使い魔が2体以上なら、ラウンドの始めに食料1。'),
  // 近い効果：使い魔にしたあと好きな資源1（1ラウンド1回）
  X(W('w_ha1', '調教の鞭', HA, { wood: 1 }, 1, [on('tame', [pick(1)], undefined, rnd)], L), '戦力+1。使い魔にするとき好物の数−1（1ラウンド1回）。'),
  // 近い効果：捕まえやすさ+1
  X(W('w_ha2', '誘いの笛', HA, { wood: 1, mana: 1 }, 0, [passive({ capture_ease: 1 })], L), '戦力+0。巣のマスで魔物をもう1体見られる。'),
  X(W('w_ha3', '獣使いの槍', HA, { iron: 2 }, 2, [fight([powPer('pets', 1, 1, 3)])], M), '戦力+2。使い魔1体ごとに戦力+1（最大3）。'),
  // 近い効果：使い魔にすると素材2
  X(W('w_ha4', '捕獲網の投げ槍', HA, { iron: 1, wood: 2 }, 1, [on('tame', [g({ mat: 2 })])], M), '戦力+1。使い魔にした魔物の戦利品も受け取れる。'),
  X(W('w_ha5', '獣王の牙', HA, { iron: 3, mana: 2 }, 3, [passive({ pet_power: 1 })], H2), '戦力+3。使い魔それぞれの戦力+1。'),
  X(A('a_ha1', '獣皮のマント', HA, { mat: 1 }, 1, [passive({ upkeep: -1 })], L), '守り+1。冬の食料−1。'),
  X(A('a_ha2', '餌袋', HA, { mat: 1 }, 1, [on('use:nest', [g({ food: 1 })])], L), '守り+1。巣のマスを使うと食料+1。'),
  X(A('a_ha3', '群れ守りの革鎧', HA, { mat: 2 }, 2, [fight([{ counter: -1 }], { min: { pets: 2 } })], M), '守り+2。使い魔が2体以上なら反撃−1。'),
  // 近い効果：使い魔3体以上で年の終わりに名声3
  X(A('a_ha4', '多種の紋章', HA, { iron: 1, mat: 1 }, 2, [on('winter', [{ fame: 3 }], { min: { pets: 3 } })], M), '守り+2。年の終わりに、使い魔の種類が3つ以上なら名声+3。'),
  // 近い効果：主・古竜と戦うとき戦力+2
  X(A('a_ha5', '竜騎士の鎧', HA, { iron: 3, mat: 2 }, 3, [fight([{ power: 2 }], { boss: true })], H), '守り+3。主も使い魔にできる（好物は3倍）。使い魔にする場合、参加した全員戦って倒した扱いになる。'),
  X(T('t_ha1', '大きな檻', HA, { wood: 3 }, [passive({ pet_cap: 1 })]), '持てる使い魔+1。'),
  X(T('t_ha2', '餌場', HA, { wood: 2, food: 1 }, [on('round_start', [g({ food: 1 })])]), 'ラウンドの始めに食料1。'),
  X(T('t_ha3', '薬草園', HA, { wood: 2 }, [on('round_start', [g({ herb: 1 })])]), 'ラウンドの始めに薬草1。'),
  // 近い効果：捕まえやすさ+2
  X(T('t_ha4', '落とし穴', HA, { wood: 2, iron: 1 }, [passive({ capture_ease: 2 })]), '巣の魔物1体に印をつけておく。他のプレイヤーはその魔物と戦闘できない。(1回限り)'),
  // 近い効果：使い魔2体以上で年の終わりに名声3
  X(T('t_ha5', 'つがいの小屋', HA, { wood: 3, food: 2 }, [on('winter', [{ fame: 3 }], { min: { pets: 2 } })]), '年の終わりに、同じ種類の使い魔が2体いれば名声+3。'),
  X(S('s_ha1', '魅了', HA, { mana: 1 }, [play([{ tame: true }])], L), '戦力5以下の巣の魔物1体を、好物なしで使い魔にする。'),
  X(TM('s_ha2', '獣の絆', HA, { mana: 2 }, 1, { mana: 1 }, [fight([{ power: 2 }], { min: { pets: 1 } })]), 'この戦闘で使い魔1体の戦力+2。'),
  X(S('s_ha3', '野生の解放', HA, { mana: 2 }, [fight([powPer('pets', 1, 2)])], M), 'この戦闘で使い魔の戦力が2倍。'),
  X(TM('s_ha4', '餌の創造', HA, { mana: 2 }, 1, { mana: 1 }, [play([g({ food: 2 })])]), '食料2。'),
  // 近い効果：好きな資源2
  X(S('s_ha5', '好物の香り', HA, { mana: 2 }, [play([pick(2)])], M), 'このラウンド、魔物を捕まえるのに必要な費用-2'),
];

// ================================================================ 大物狩り山田（ya）
const YA: EngineTag[] = ['boss', 'hunt'];
const ya: CardDef[] = [
  // 近い効果：武器を持っていれば戦力+1
  X(O('o_ya1', '大剣使い', YA, [fight([{ power: 1 }], { min: { weapons: 1 } })]), '両手武器の戦力+1。'),
  X(O('o_ya2', '怪力', YA, [passive({ stone_down: 'two_hand' })]), '両手武器を作るとき、魔石の段階を1つ下げて払える。'),
  X(O('o_ya3', '鉄の運び屋', YA, [passive({ cost_discount: { kind: 'two_hand', res: { iron: 2 } } })]), '両手武器の費用の鉄−2。'),
  X(O('o_ya4', '盾も持つ大男', YA, [passive({ two_hand_armor: true })]), '両手武器を持っていても盾を所持できる'),
  X(O('o_ya5', '一騎打ちの心得', YA, [fight([{ power: 2 }], { boss: true })]), '主や古竜と戦う時、戦力+2'),
  X(W('w_ya1', '丸太の棍', YA, { wood: 3 }, 3, [], L2), '戦力+3。'),
  X(W('w_ya2', '鉄塊の大剣', YA, { iron: 4 }, 4, [], M2), '戦力+4。'),
  X(W('w_ya3', '主狩りの斧', YA, { iron: 4, mat: 1 }, 3, [fight([{ power: 2 }], { boss: true })], M2), '戦力+3。主や古竜と戦うときさらに+2。'),
  X(W('w_ya4', '巨岩割りの大剣', YA, { iron: 5, mana: 2 }, 6, [], H2), '戦力+6。'),
  X(W('w_ya5', '主殺しの呪い大槌', YA, { iron: 3, mana: 1 }, 7, [fight([{ power: -7 }], { boss: false })], H2), '戦力+7。巣の魔物とは戦えない（主と古竜だけ）。'),
  X(A('a_ya1', '巨人の革帯', YA, { mat: 1 }, 1, [fight([{ power: 1 }], { min: { weapons: 1 } })], L), '守り+1。両手武器の戦力+1。'),
  X(A('a_ya2', '野営の外套', YA, { mat: 1, herb: 1 }, 1, [passive({ upkeep: -1 })], L), '守り+1。冬の食料−1。'),
  X(A('a_ya3', '鋼の胸当て', YA, { iron: 2, mat: 1 }, 2, [], M), '守り+2。'),
  X(A('a_ya4', '王殺しの兜', YA, { iron: 2, mana: 1 }, 2, [fight([{ counter: -2 }], { boss: true })], M), '守り+2。主や古竜の反撃−2。'),
  X(A('a_ya5', '竜狩りの鱗鎧', YA, { iron: 3, mat: 2 }, 3, [fight([{ power: 2 }], { boss: true, race: 'dragon' })], H), '守り+3。古竜と戦うとき戦力+2。'),
  X(T('t_ya1', '両手剣の鍛錬台', YA, { wood: 3, iron: 2 }, [fight([{ power: 2 }], { min: { weapons: 1 } })]), '両手武器1本の戦力+2。'),
  X(T('t_ya2', '鉄鉱の露天掘り', YA, { wood: 2, iron: 1 }, [on('round_start', [g({ iron: 1 })])]), 'ラウンドの始めに鉄1。'),
  X(T('t_ya3', '攻城台', YA, { wood: 3, iron: 1 }, [fight([{ power: 2 }], { boss: true })]), '主や古竜と戦うとき戦力+2。'),
  X(T('t_ya4', '決戦の宿営地', YA, { wood: 2, food: 2 }, [fight([{ no_injury: 3 }], { boss: true })]), '主や古竜に挑んだ仲間は、負けても負傷しない。'),
  X(T('t_ya5', '大物狩りの記録', YA, { wood: 2 }, [win([{ fame: 2 }], { boss: true })]), '主か古竜を倒すたびに名声+2。'),
  X(S('s_ya1', '巨人の力', YA, { mana: 2 }, [fight([{ power: 3 }])], M), 'この戦闘で戦力+3。'),
  X(S('s_ya2', '弱点看破', YA, { mana: 2 }, [fight([{ str: -3 }], { boss: true })], M), '主か古竜の戦力−3。'),
  // 近い効果：主・古竜と戦うとき戦力+2
  X(S('s_ya3', '手柄の独り占め', YA, { mana: 1 }, [fight([{ power: 2 }], { boss: true })], L), 'この主との戦いで、ほかの人の戦力を半分として数える。'),
  // 近い効果：鉄1を得る
  X(TM('s_ya4', '重さ消し', YA, { mana: 2 }, 1, { mana: 1 }, [play([g({ iron: 1 })])]), '次に作る両手武器の魔石の段階を1つ下げる。'),
  X(TM('s_ya5', '鼓舞', YA, { mana: 3 }, 1, { mana: 1 }, [play([{ heal: 6 }])]), '負傷をすべて治す。'),
];

// ================================================================ 遺物好きイスカ（is）
const IS: EngineTag[] = ['ruins', 'quest'];
const is_: CardDef[] = [
  X(O('o_is1', '考古学者', IS, [passive({ ancient_look: 1 })]), '遺物を引くとき1枚多く見る。'),
  // 近い効果：修復の費用−1
  X(O('o_is2', '修復師', IS, [passive({ repair_cut: 1 })]), '修復の費用の素材1つを金貨2で払える。'),
  X(O('o_is3', '斥候', IS, [on('use:adventure', [g({ gold: 1 })])]), '冒険のマスを使うと金貨+1。'),
  X(O('o_is4', '復元の名匠', IS, [on('repair', [{ fame: 1 }])]), '遺物を一つ修復するごとに、名声+1'),
  X(O('o_is5', '旅慣れた案内人', IS, [passive({ adv_free: true })]), '冒険のマスに、ほかの人がいても置ける。'),
  X(W('w_is1', '発掘の鶴嘴', IS, { iron: 1, wood: 1 }, 1, [win([{ relic: 1 }])], L), '戦力+1。勝つと遺物を1枚引く。'),
  X(W('w_is2', '藪払いの鉈', IS, { iron: 1 }, 1, [win([g({ mat: 1 })])], L), '戦力+1。勝つと素材+1。'),
  X(W('w_is3', '古代の剣', IS, { iron: 2, mat: 1 }, 2, [fight([powPer('ancient', 1, 1, 3)])], M), '戦力+2。直した遺物1つごとに戦力+1（最大3）。'),
  X(W('w_is4', '遺跡の弓', IS, { wood: 2, iron: 1 }, 2, [on('use:adventure', [pick(1)])], M), '戦力+2。冒険のマスで受け取る資源+1。'),
  X(W('w_is5', '古王の槍', IS, { iron: 4, mana: 2 }, 5, [win([{ relic: 1 }])], H2), '戦力+5。勝つと遺物を2枚見て1枚取る。'),
  X(A('a_is1', '旅の外套', IS, { herb: 1, mat: 1 }, 1, [passive({ upkeep: -1 })], L), '守り+1。冬の食料−1。'),
  X(A('a_is2', '探検帽', IS, { mat: 1 }, 1, [on('use:adventure', [pick(1)])], L), '守り+1。冒険のマスで受け取る資源+1。'),
  X(A('a_is3', '防塵の外衣', IS, { herb: 1, mat: 2 }, 2, [passive({ repair_cut: 1 })], M), '守り+2。修復の費用−1。'),
  X(A('a_is4', '発掘者の盾', IS, { iron: 2, mat: 1 }, 2, [passive({ ancient_look: 1 })], M), '守り+2。古い発掘場で遺物を1枚多く見る。'),
  X(A('a_is5', '古代の鎧', IS, { iron: 3, mat: 2, mana: 1 }, 3, [fight([{ guard: 1 }], { min: { ancient: 1 } }), fight([{ guard: 1 }], { min: { ancient: 2 } }), fight([{ guard: 1 }], { min: { ancient: 3 } })], H), '守り+3。直した遺物1つごとに守り+1。'),
  X(T('t_is1', '修復の作業台', IS, { wood: 2, iron: 1 }, [passive({ repair_cut: 1 })]), '修復の費用の素材−1。'),
  X(T('t_is2', '発掘隊のテント', IS, { wood: 3 }, [on('use:dig', [{ relic: 1 }])]), '古い発掘場で遺物を引くとき+1枚。'),
  X(T('t_is3', '地図の部屋', IS, { wood: 2, gold: 2 }, [on('use:adventure', [pick(1)])]), '冒険のマスで受け取る資源+1。'),
  X(T('t_is4', '遺物の目録', IS, { wood: 2 }, [end([famePer('broken', 1)])]), '試合の終わりに、壊れたままの遺物も1つ名声1で数える。'),
  X(T('t_is5', '携帯食の倉', IS, { wood: 2 }, [passive({ upkeep: -1 })]), '冬の食料−1。'),
  X(TM('s_is1', '遺物の声', IS, { mana: 3 }, 1, { mana: 1 }, [play([{ relic: 1 }])]), '遺物を1枚引く。'),
  // 近い効果：修復を1つする（費用は払う）
  X(S('s_is2', '復元の術', IS, { mana: 2 }, [play([{ repair: true }])], M), '名声4以下の壊れた遺物1つを費用なしで直す。'),
  X(S('s_is3', '道しるべ', IS, { mana: 1 }, [play([{ extra_worker: 1 }])], L), 'このラウンド、冒険のマスにもう1人置ける。(冒険のマスにだけ置ける仲間を一人追加)'),
  // 近い効果：遺物を1枚引き、修復を1つする（費用は払う）
  X(S('s_is4', '時の砂', IS, { mana: 3 }, [play([{ relic: 1 }, { repair: true }])], H), '遺物を3枚見て1枚取り、すぐに費用−2で直せる。'),
  // 近い効果：素材1を得る
  X(TM('s_is5', '鑑定', IS, { mana: 1 }, 1, {}, [play([g({ mat: 1 })])]), '遺物の山の上3枚を見て、好きな順に並べ替える。'),
];

// ================================================================ 自宅警備員ゴロー（go）
const GO: EngineTag[] = ['fort'];
const WALL_FREE = { wood: 9, iron: 9 };
const go: CardDef[] = [
  X(O('o_go1', '石工', GO, [passive({ cost_discount: { kind: 'wall', res: { wood: 1 } } })]), '防壁の費用の木材−1。'),
  X(O('o_go2', '夜警', GO, [passive({ home_guard: 1 })]), '冬の襲撃を1つ多く防ぐ。'),
  // 近い効果：ラウンドの始めに防壁を1つ建てられる（費用は払う）
  X(O('o_go3', '突貫大工', GO, [on('round_start', [{ build: 'wall' }])]), 'ラウンドの始めに防壁を2つまで作れる（2つ目は費用+1）。'),
  X(O('o_go4', '森の木材番', GO, [on('other:forest', [g({ wood: 1 })])]), 'ほかの人が古の森を使うたびに木材1。'),
  X(O('o_go5', '魔物呼び', GO, [passive({ raid_mult: 1.5 })]), '全員に対する襲撃の強さ1,5倍(切り捨て)'),
  X(W('w_go1', '見張りの弓', GO, { wood: 2 }, 1, [passive({ home_guard: 1 })], L), '戦力+1。冬の襲撃の守り+1。'),
  X(W('w_go2', '薪拾いの警棒', GO, { wood: 1 }, 1, [win([g({ wood: 1 })])], L), '戦力+1。勝つと木材+1。'),
  X(W('w_go3', '門番の槍', GO, { iron: 2, wood: 1 }, 2, [passive({ home_guard: 1 })], M), '戦力+2。冬の襲撃を1つ防ぐ。'),
  X(W('w_go4', '城壁の石弓', GO, { wood: 2, iron: 2 }, 2, [fight([powPer('walls', 3)])], M), '戦力+2。防壁3つごとに戦力+1。'),
  X(W('w_go5', '番兵の大斧', GO, { iron: 4, wood: 2 }, 4, [passive({ home_guard: 2 })], H2), '戦力+4。冬の襲撃の守り+2。'),
  // 近い効果：ラウンドの終わりに木材1
  X(A('a_go1', '留守番の上着', GO, { mat: 1 }, 1, [on('round_end', [g({ wood: 1 })])], L), '守り+1。仲間を戦闘に出さなかったラウンドの終わりに木材1。'),
  X(A('a_go2', '衛兵の兜', GO, { iron: 1 }, 1, [passive({ home_guard: 1 })], L), '守り+1。冬の襲撃の守り+1。'),
  X(A('a_go3', '門番の鎧', GO, { iron: 2, mat: 1 }, 2, [passive({ home_guard: 1 })], M), '守り+2。冬の襲撃の守り+1。'),
  X(A('a_go4', '石積みの籠手', GO, { iron: 3 }, 2, [passive({ cost_discount: { kind: 'wall', res: { iron: 1 } } })], M), '守り+2。防壁の費用−1。'),
  // 近い効果：冬の守り+1、試合の終わりに名声1
  X(A('a_go5', '城壁の盾', GO, { iron: 4, wood: 2 }, 4, [passive({ home_guard: 1 }), end([{ fame: 1 }])], H), '守り+4。防壁1つとして数える。'),
  X(T('t_go1', '物見櫓', GO, { wood: 3 }, [passive({ home_guard: 1 })]), '冬の襲撃を1つ防ぐ。'),
  X(T('t_go2', '堀', GO, { wood: 2, food: 2 }, [passive({ home_guard: 2 })]), '冬の襲撃の守り+2。'),
  X(T('t_go3', '材木置き場', GO, { wood: 2, iron: 1 }, [on('round_start', [g({ wood: 1 })])]), 'ラウンドの始めに木材+1。'),
  X(T('t_go4', '報奨の鐘楼', GO, { wood: 2, iron: 2 }, [on('winter', [{ gain_per: { stat: 'blocked', per: 1, gain: { gold: 1 } } }])]), '冬に防いだ襲撃1つごとに金貨1。'),
  X(T('t_go5', '城門', GO, { wood: 3, iron: 2 }, [passive({ home_guard: 3 }, { min: { walls: 5 } })]), '防壁が5つ以上なら、冬の襲撃の守り+3。'),
  X(S('s_go1', '結界', GO, { mana: 2 }, [play([{ ward: 2 }])], M), 'この冬の襲撃を2つ防ぐ。'),
  X(TM('s_go2', '石化の壁', GO, { mana: 3 }, 1, { mana: 1 }, [play([{ build: 'wall', discount: { wood: 9 } }])]), '木材を払わずに防壁を1つ建てる。'),
  X(TM('s_go3', '守りの祈り', GO, { mana: 2 }, 1, { mana: 1 }, [play([{ ward: 1 }])]), 'この冬の襲撃の守り+1（重ねられる）。'),
  X(S('s_go4', '突貫工事', GO, { mana: 2 }, [play([{ build: 'wall' }, { build: 'wall', discount: WALL_FREE }])], M), '防壁を2つ建てる。費用は1つ分。'),
  // 近い効果：食料4を得る
  X(S('s_go5', '籠城', GO, { mana: 3 }, [play([g({ food: 4 })])], H), 'この冬の食料がいらない。'),
];

// ================================================================ 溜め込みポポ（po）
const PO: EngineTag[] = ['gather'];
const po: CardDef[] = [
  X(O('o_po1', '木こり', PO, [passive({ accum_bonus: { forest: 1 } })]), '古の森を使うと木材+1。'),
  X(O('o_po2', '鉱夫', PO, [passive({ accum_bonus: { mine: 1 } })]), '鉄の坑道を使うと鉄+1。'),
  X(O('o_po3', '薬草摘み', PO, [passive({ accum_bonus: { meadow: 1 } })]), '薬草の野を使うと薬草+1。'),
  // 近い効果：たまるマスを使うと、2ラウンド後に好きな資源…のかわりに木材1を予約
  X(O('o_po4', '種まき人', PO, [on('use:any_accum', [{ future: { rounds: [1], gain: { wood: 1 } } }])]), 'たまるマスを使ったら、そのマスに資源を1つ置いて残す。'),
  // 近い効果：たまるマスを使うと好きな資源1（ほかのマスは減らない）
  X(O('o_po5', '根こそぎの採集人', PO, [on('use:any_accum', [pick(1)])]), 'たまるマスを使うと、ほかのたまるマスからも資源を1つ取る。(取ったほかのたまるマスの資源は-1)'),
  X(W('w_po1', '伐採斧', PO, { wood: 1, iron: 1 }, 1, [on('use:forest', [g({ wood: 1 })])], L), '戦力+1。古の森で木材+1。'),
  X(W('w_po2', '鉱夫の鶴嘴', PO, { iron: 2 }, 1, [on('use:mine', [g({ iron: 1 })])], L), '戦力+1。鉄の坑道で鉄+1。'),
  X(W('w_po3', '草刈り鎌', PO, { iron: 1 }, 1, [on('use:meadow', [g({ herb: 1 })])], L), '戦力+1。薬草の野で薬草+1。'),
  X(W('w_po4', '豊穣の杖', PO, { wood: 2, mana: 1 }, 1, [win([pick(2)])], M), '戦力+1。勝つと好きな資源2。'),
  X(W('w_po5', '剥ぎ取りの大鉈', PO, { iron: 3, wood: 1 }, 4, [win([{ loot: 1 }])], H2), '戦力+4。勝つと戦利品+1。'),
  X(A('a_po1', '採集袋', PO, { mat: 1 }, 1, [on('use:any_accum', [pick(1)])], L), '守り+1。たまるマスで1つ多く取る。'),
  X(A('a_po2', '作業着', PO, { herb: 1, mat: 1 }, 1, [passive({ upkeep: -1 })], L), '守り+1。冬の食料−1。'),
  X(A('a_po3', '鉱夫の兜', PO, { iron: 2 }, 2, [on('use:mine', [g({ iron: 1 })])], M), '守り+2。鉄の坑道で鉄+1。'),
  X(A('a_po4', '水増しの前掛け', PO, { mat: 2 }, 2, [passive({ hoard_bonus: 5 })], M), '守り+2。年の終わりの名声で、資源を+5として数える。'),
  X(A('a_po5', '大地の鎧', PO, { iron: 3, wood: 2, mat: 2 }, 3, [win([g({ wood: 1, iron: 1 })])], H), '守り+3。勝つと木材と鉄を1つずつ。'),
  X(T('t_po1', '大倉庫', PO, { wood: 3 }, [passive({ hoard_div: 9 })]), '(採集家専用)年の終わりの名声を、資源÷11でなく÷9で数える。'),
  X(T('t_po2', '水車', PO, { wood: 3, iron: 1 }, [on('round_start', [pick(1)])]), 'ラウンドの始めに好きな資源+1。'),
  X(T('t_po3', '保存庫', PO, { wood: 2, food: 1 }, [passive({ upkeep: -1 })]), '冬の食料−1。'),
  X(T('t_po4', '炭焼き窯', PO, { wood: 2, iron: 1 }, [on('round_start', [{ convert: { from: { wood: 2 }, to: { iron: 1 } } }])]), '木材2を鉄1に換えられる（ラウンド1回）。'),
  X(T('t_po5', '満杯の甕', PO, { wood: 1, food: 1 }, [on('winter', [pick(2)], { min: { res_total: 30 } })]), '年の終わりに、持っている資源が30以上なら好きな資源+2。'),
  // 近い効果：好きな資源1
  X(TM('s_po1', '豊作', PO, { mana: 2 }, 1, { mana: 1 }, [play([pick(1)])]), '次に使うたまるマスで資源+1。'),
  X(S('s_po2', '実りの雨', PO, { mana: 2 }, [play([{ accum_add: 1 }])], M), 'すべてのたまるマスに資源+1。'),
  // 近い効果：好きな資源3
  X(S('s_po3', '黄金の手', PO, { mana: 3 }, [play([pick(3)])], H), '次に使うたまるマスの資源が2倍（1.5倍のかわり）。'),
  X(S('s_po4', '大地の恵み', PO, { mana: 2 }, [play([g({ wood: 1, iron: 1, herb: 1 })])], M), '木材・鉄・薬草を1つずつ。'),
  // 近い効果：好きな資源1
  X(S('s_po5', '先回り', PO, { mana: 1 }, [play([pick(1)])], L), 'このラウンド、好きなたまるマス1つにほかの人は置けない。'),
];

// ================================================================ 押し売りモモ（mo）
const MO: EngineTag[] = ['trade'];
const mo: CardDef[] = [
  // 近い効果：取引のあと好きな資源1（1ラウンド1回）
  X(O('o_mo1', '口八丁', MO, [on('trade', [pick(1)], undefined, rnd)]), '取引で出す資源を1つ少なくできる（1ラウンド1回）。'),
  X(O('o_mo2', '二枚舌', MO, [passive({ trade_count: 1 })]), '1ラウンドに取引を1回多くできる。'),
  X(O('o_mo3', '交換所の手配師', MO, [on('use:market', [{ trade_bonus: 1 }])]), '交換所を使うと、ついでに取引を1回できる。'),
  // 近い効果：取引のあと鉄1（1ラウンド1回）
  X(O('o_mo4', '上前はね', MO, [on('trade', [g({ iron: 1 })], undefined, rnd)]), '取引で受け取ったのが鉄かマナ鉱石なら、さらに1つ。'),
  // まだない：魔石の取引（効果なし）
  X(O('o_mo5', '魔石の闇商人', MO, []), '取引をする場合、魔石も取引できるようになる。'),
  X(W('w_mo1', '隠し短剣', MO, { iron: 1 }, 1, [win([{ trade_bonus: 1 }])], L), '戦力+1。勝つと取引を1回する。'),
  X(W('w_mo2', '毒の吹き矢', MO, { wood: 1, herb: 1 }, 1, [fight([{ counter: -1 }])], L), '戦力+1。魔物の反撃−1。'),
  X(W('w_mo3', '仕込み杖', MO, { wood: 1, iron: 2 }, 2, [fight([powPer('trades', 3, 1, 3)])], M), '戦力+2。取引3回ごとに戦力+1（最大3）。'),
  X(W('w_mo4', '盗賊の曲刀', MO, { iron: 2, mat: 1 }, 2, [win([{ trade_bonus: 2 }])], M), '戦力+2。勝つと取引を2回する。'),
  X(W('w_mo5', '分け前の大鎌', MO, { iron: 4, mana: 2 }, 4, [win([{ trade_bonus: 2 }], { coop: true })], H2), '戦力+4。共闘で勝つと、相手と取引を2回する。'),
  X(A('a_mo1', '変装の外套', MO, { mat: 1 }, 1, [passive({ trade_count: 1 })], L), '守り+1。1ラウンドに取引を1回多くできる。'),
  X(A('a_mo2', '煙玉の帯', MO, { herb: 1, mat: 1 }, 1, [fight([{ no_injury: 1 }], undefined, yr)], L), '守り+1。負けても負傷しない（1年1回）。'),
  X(A('a_mo3', '盗賊の革鎧', MO, { iron: 1, mat: 2 }, 2, [win([{ trade_bonus: 1 }])], M), '守り+2。勝つと取引を1回する。'),
  X(A('a_mo4', '抜き取りの衣', MO, { mana: 1, mat: 2 }, 2, [on('trade', [pick(1)], undefined, rnd)], M), '守り+2。取引で受け取る資源+1（1ラウンド1回）。'),
  X(A('a_mo5', '偽りの紋章鎧', MO, { iron: 3, mat: 2 }, 3, [passive({ no_absent: true })], H), '守り+3。主の巣に行かなくても不参加の減点を受けない。'),
  X(T('t_mo1', '闇市', MO, { wood: 2, gold: 2 }, [on('trade', [g({ gold: 1 })])]), '取引のたびに金貨1。'),
  X(T('t_mo2', '密輸倉', MO, { wood: 3 }, [passive({ trade_max: 1 })]), '取引時の価値が3金貨の制限の上限値+1'),
  // 近い効果：ラウンドの始めに、このラウンド取引をもう1回できる
  X(T('t_mo3', '抜け道', MO, { wood: 2, iron: 1 }, [on('round_start', [{ trade_bonus: 1 }])]), 'ほかの人がいるマスにも置ける。そのときその人と取引を1回する（1ラウンド1回）。'),
  // まだない：マスをふさぐ（効果なし）
  X(T('t_mo4', '通せんぼの柵', MO, { wood: 2, food: 2, iron: 3 }, []), 'ラウンドの始めに、好きなマス1つをそのラウンドほかの人が使えないようにする。'),
  X(T('t_mo5', '裏帳簿', MO, { wood: 2 }, [end([famePer('trades', 5)])]), '試合の終わりに、取引5回ごとに名声1。'),
  X(TM('s_mo1', 'すり替え', MO, { mana: 2 }, 1, { mana: 1 }, [play([{ trade_bonus: 1 }])]), '好きな人と取引を1回する。(毎手番の取引とは別)'),
  X(S('s_mo2', '連続詐欺', MO, { mana: 3 }, [play([{ trade_bonus: 2 }])], H), '違う人と取引を2回する。'),
  // まだない：マスをふさぐ・手札を見る・交換所を止める（効果なし）
  X(S('s_mo3', '偽の立て札', MO, { mana: 2 }, [], M), '1つマスを指定する、このラウンド、他の人はそのマスに仲間を置けない'),
  X(S('s_mo4', '盗み見', MO, { mana: 1 }, [], L), 'ほかの人1人の手札を見て、1枚を山に戻させる。'),
  X(S('s_mo5', '交換所の出禁', MO, { mana: 2 }, [], M), 'ほかの人1人は、次のラウンド交換所を使えない。'),
];

// ================================================================ 量産職人カイ（ka）
const KA: EngineTag[] = ['fort', 'gather'];
const ka: CardDef[] = [
  X(O('o_ka1', '大工', KA, [passive({ cost_discount: { kind: 'tool', res: { wood: 1 } } })]), '道具の費用の木材−1。'),
  // 近い効果：工房を使うともう1つ建てられる（費用は払う）
  X(O('o_ka2', '工房長', KA, [on('use:workshop', [{ build: 'any' }])]), '工房で道具を2つ作れる(2つ目は資源+2)。'),
  X(O('o_ka3', '発明家', KA, [on('build', [pick(1)])]), '道具を作ったあと、好きな資源1。'),
  // 近い効果：年の始めに1回、道具を1つ建てられる
  X(O('o_ka4', '出張職人', KA, [on('round_start', [{ build: 'facility' }], spring, yr)]), '年に1回、工房以外のマスに置いた仲間でも道具を1つ作れる。'),
  X(O('o_ka5', '部品集め', KA, [win([g({ wood: 1, iron: 1 })])]), '勝つと、戦利品のかわりに木材と鉄を1つずつ。'),
  X(W('w_ka1', '職人の金槌', KA, { iron: 1, wood: 1 }, 1, [passive({ cost_discount: { kind: 'tool', res: { wood: 1 } } })], L), '戦力+1。工房で作る道具の費用−1。'),
  X(W('w_ka2', '工具の剣', KA, { iron: 1, mat: 1 }, 1, [win([g({ wood: 1, iron: 1 })])], L), '戦力+1。勝つと木材と鉄を1つずつ。'),
  X(W('w_ka3', 'からくり弓', KA, { wood: 2, iron: 2 }, 2, [fight([{ power: 1 }], { min: { tools: 3 } })], M), '戦力+2。道具が3つ以上なら戦力+1。'),
  X(W('w_ka4', '発明の銃', KA, { iron: 2, mana: 1 }, 2, [fight([{ counter: -1 }])], M), '戦力+2。反撃−1。'),
  X(W('w_ka5', '道具づくしの大鎚', KA, { iron: 4, wood: 2 }, 4, [fight([powPer('tools', 1, 1, 4)])], H2), '戦力+4。道具1つごとに戦力+1（最大4）。'),
  X(A('a_ka1', '職人の前掛け', KA, { mat: 1 }, 1, [passive({ cost_discount: { kind: 'tool', res: { wood: 1 } } })], L), '守り+1。道具の費用−1（1ラウンド1回）。'),
  X(A('a_ka2', '作業手袋', KA, { mat: 1 }, 1, [on('build', [g({ wood: 1 })])], L), '守り+1。道具を作ると木材1。'),
  X(A('a_ka3', '歯車仕掛けの鎧', KA, { iron: 2, mana: 1 }, 2, [fight([{ guard: 1 }], { min: { tools: 3 } })], M), '守り+2。道具が3つ以上なら守り+1。'),
  X(A('a_ka4', '鋼の作業着', KA, { iron: 2, mat: 1 }, 2, [on('round_start', [g({ iron: 1 })], spring)], M), '守り+2。年の始めに鉄1。'),
  X(A('a_ka5', '匠の甲冑', KA, { iron: 3, wood: 2, mat: 1 }, 3, [passive({ cost_discount: { kind: 'tool', res: { iron: 1 } } })], H), '守り+3。道具の費用−1。'),
  X(T('t_ka1', '道具箱', KA, { wood: 1 }, [], { fame: 1 }), '名声1。'),
  X(T('t_ka2', '部品棚', KA, { wood: 2 }, [on('round_start', [g({ wood: 1 })])]), 'ラウンドの始めに木材1。'),
  X(T('t_ka3', 'からくり人形', KA, { iron: 2, mana: 1 }, [on('round_start', [g({ gold: 1 })])], { fame: 2 }), '名声2。ラウンドの始めに金貨1。'),
  // 近い効果：工房を使うたび、木材1・鉄1を払って名声2（1年1回、印の上限のかわり）
  X(T('t_ka4', '未完の大作', KA, { wood: 2 }, [on('use:workshop', [{ pay: { wood: 1, iron: 1 } }, { fame: 2 }], undefined, yr)]), '名声0。工房を使うたび、資源2つを乗せて印1。印の数×2の名声（最大10）。'),
  // 近い効果：道具を壊す条件はなし
  X(T('t_ka5', '黄金の時計台', KA, { wood: 3, iron: 3, gold: 2 }, [], { fame: 6 }), '名声6。'),
  X(TM('s_ka1', '設計図', KA, { mana: 2 }, 1, { mana: 1 }, [play([{ draw: { from: 'tool', look: 3, take: 1 } }])]), '道具のカードを3枚見て1枚取る。'),
  X(S('s_ka2', '魔法の工具', KA, { mana: 2 }, [play([{ build: 'facility', discount: { wood: 1, iron: 1 } }])], M), '次に作る道具の費用−2。'),
  X(S('s_ka3', '完成の閃き', KA, { mana: 3 }, [play([{ build: 'facility', discount: { wood: 9, iron: 9, herb: 9, mana: 9, food: 9, mat: 9, gold: 9 } }])], H), '名声2以下の道具を1つ、費用なしで建てる。'),
  // 近い効果：名声3
  X(S('s_ka4', '複製の術', KA, { mana: 5 }, [play([{ fame: 3 }])], H), '作った道具を一個複製する。'),
  // 近い効果：名声2
  X(S('s_ka5', '夜なべ', KA, { mana: 2 }, [play([{ fame: 2 }])], M), 'このラウンド、工房を使うと名声+2'),
];

// ================================================================ 成金ミロ（mi）
const MI: EngineTag[] = ['trade'];
const mi: CardDef[] = [
  X(O('o_mi1', '両替商', MI, [passive({ sell_bonus: 1 })]), '交換所で売るとき金貨+1。'),
  X(O('o_mi2', '仲買人', MI, [passive({ market_qty: 1 })]), '交換所で一度に4つまで売り買いできる。'),
  // 近い効果：年の終わりに金貨4枚ごとに金貨1（最大4）
  X(O('o_mi3', '投資家', MI, [on('winter', [{ gain_per: { stat: 'gold', per: 4, gain: { gold: 1 }, max: 4 } }])]), '年の始めに、金貨を好きなだけこのカードに預ける。次の年の始めに1.5倍（切り捨て）で戻る。'),
  // 近い効果：年の終わりに金貨1
  X(O('o_mi4', '金貸し', MI, [on('winter', [g({ gold: 1 })])]), 'ほかの人に金貨3を貸せる。その人は2ラウンド後に金貨4を返す。返せなければその人は名声−2。'),
  X(O('o_mi5', '行商人', MI, [on('use:peddler', [g({ gold: 2 })])]), '行商のマスで金貨+2。'),
  X(W('w_mi1', '商人の護身剣', MI, { iron: 1, gold: 1 }, 1, [win([g({ gold: 2 })])], L), '戦力+1。勝つと金貨2。'),
  // 近い効果：勝つと金貨2
  X(W('w_mi2', '算盤の棍', MI, { wood: 2 }, 1, [win([g({ gold: 2 })])], L), '戦力+1。勝ったときの戦利品を、価値の表どおりに金貨で受け取れる。'),
  X(W('w_mi3', '傭兵の槍', MI, { gold: 6 }, 3, [], M), '戦力+3。'),
  X(W('w_mi4', '成金の鞭', MI, { mat: 1, gold: 4 }, 2, [fight([powPer('gold', 10, 1, 3)])], M), '戦力+2。持っている金貨10ごとに戦力+1（最大3）。'),
  X(W('w_mi5', '黄金の大剣', MI, { iron: 3, gold: 8 }, 5, [win([g({ gold: 3 })])], H2), '戦力+5。勝つと金貨3。'),
  X(A('a_mi1', '絹の外套', MI, { mat: 1, gold: 2 }, 1, [passive({ winter_gold: 1 })], L), '守り+1。冬の食料を金貨で払える（1つ金貨1）。'),
  X(A('a_mi2', '旅商人の帯', MI, { mat: 1 }, 1, [on('buy', [g({ gold: 1 })], undefined, rnd)], L), '守り+1。交換所で買うとき金貨−1（1回）。'),
  X(A('a_mi3', '金の胸当て', MI, { gold: 6 }, 2, [end([{ fame: 1 }])], M), '守り+2。試合の終わりに金貨3として数える。'),
  // 近い効果：負傷を治す薬草−1
  X(A('a_mi4', '護衛の鎧', MI, { iron: 2, gold: 3 }, 2, [passive({ heal_discount: 1 })], M), '守り+2。負傷を治す薬草を金貨2で払える。'),
  X(A('a_mi5', '豪商の甲冑', MI, { iron: 3, mat: 2, gold: 5 }, 4, [hit([{ pay: { gold: 3 } }, { no_injury: 3 }], { min: { dmg: 1 } })], H), '守り+4。負けたとき、金貨3を払えば負傷しない。'),
  X(T('t_mi1', '利子の金庫', MI, { wood: 2, iron: 2 }, [on('winter', [{ gain_per: { stat: 'gold', per: 5, gain: { gold: 1 }, max: 5 } }])]), '年の終わりに、金貨5ごとに金貨1（最大5）。'),
  X(T('t_mi2', '商館', MI, { wood: 3, iron: 1 }, [on('use:market', [{ exchange: true }])]), '交換所を使うとき、もう1回売り買いできる。'),
  X(T('t_mi3', '隊商の馬車', MI, { wood: 3, food: 2 }, [on('build', [{ future: { rounds: [1, 2, 3, 4], gain: { gold: 2 } } }], undefined, once)]), '次の4ラウンドの始めに金貨2ずつ。'),
  // 近い効果：交換所を使うと好きな資源1（1ラウンド1回）
  X(T('t_mi4', '天秤', MI, { iron: 1 }, [on('use:market', [pick(1)], undefined, rnd)]), '交換所の交換で受け取る数+1（1ラウンド1回）。'),
  // 近い効果：年の終わりに金貨2
  X(T('t_mi5', '市の屋台', MI, { wood: 2 }, [on('winter', [g({ gold: 2 })])]), 'ほかの人は、あなたに金貨を払って価値の表どおりに資源を買える(取引とは別枠)。'),
  X(TM('s_mi1', '金細工の術', MI, { mana: 3, gold: 2 }, 2, { mana: 1 }, [play([g({ gold: 2 })])]), '金貨+2。'),
  // 近い効果：金貨3を得る
  X(S('s_mi2', '値切り', MI, { mana: 1 }, [play([g({ gold: 3 })])], L), '次に作るものの費用を金貨で払うとき−3。'),
  // 近い効果：交換所の交換を1回
  X(S('s_mi3', '市場操作', MI, { mana: 1 }, [play([{ exchange: true }])], L), 'このラウンド、価値の表で好きな1つの価値+1。'),
  X(S('s_mi4', '錬金術', MI, { mana: 3 }, [play([{ convert: { from: { wood: 1, iron: 1, herb: 1 }, to: { gold: 8 } } }])], H), '資源3つを金貨8に換える。'),
  // まだない：買い占め（効果なし）
  X(S('s_mi5', '買い占め', MI, { mana: 2 }, [], M), 'このラウンド、好きな資源1種類を交換所で買えるのは自分だけ。'),
];

const ALL = [...ak, ...jn, ...mn, ...ga, ...ha, ...ya, ...is_, ...go, ...po, ...mo, ...ka, ...mi];
const byKind = (k: CardDef['kind']) => ALL.filter((c) => c.kind === k);
export const LIST_OCCUPATIONS = byKind('occ');
export const LIST_WEAPONS = byKind('weapon');
export const LIST_ARMORS = byKind('armor');
export const LIST_TOOLS = byKind('tool');
export const LIST_SPELLS = byKind('spell');
/** カードを考えたリーダー（id の2文字目から） */
export const LIST_LEADER: Record<string, string> = Object.fromEntries(ALL.map((c) => [c.id, c.id.split('_')[1].replace(/\d+$/, '')]));
