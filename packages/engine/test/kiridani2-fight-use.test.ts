// 霧谷 v2：戦闘の後押しを自分で選ぶ（Option.use）。選択式の戦闘トレイ（v1 と同じ）がエンジンに渡す形
import { describe, expect, it } from 'vitest';
import { AI, Kiridani2Session, applyAction2, cleanUse, previewFight, type Action2, type GameEvent, type Option } from '../src/kiridani2/index';
import { answerToAction } from '../src/kiridani2/uihelp';

const NAMES = ['あなた', 'ハヤテ', 'コトネ', 'ジン'];
/** 人間の席が巣で戦える場面まで AI の答えで進める（士気を払える食料があるとき） */
function toFight(seed: number, hist: Action2[] = []) {
  const s = new Kiridani2Session({ n: 4, seed, years: 5, human: 0, levels: Array(4).fill('normal'), names: NAMES });
  const helper = new AI('normal', { seed: 99 });
  s.start();
  for (const a of hist) applyAction2(s, a);
  while (!s.done) {
    const w = s.waiting!;
    if (w.k === 'choose' && s.g.round >= 2 && w.p.res.food >= 2 && w.opts.some((o) => o.s.startsWith('nest') && o.k === 1 && o.mode === 'normal')) return { s, hist };
    const a = answerToAction(w, helper.respond(w));
    applyAction2(s, a); hist.push(a);
  }
  throw new Error('no fight');
}
const pays = (evs: GameEvent[]) => evs.filter((e) => e.t === 'pay' && e.seat === 0 && e.reason === 'fight');

describe('kiridani2 戦闘の後押しを選ぶ（use）', () => {
  it('previewFight：use に士気を足すと戦力+1・食料1を払う。ない key は無視', () => {
    const { s } = toFight(5);
    const w = s.waiting as Extract<typeof s.waiting, { k: 'choose' }>;
    const o = w.opts.find((x) => x.s.startsWith('nest') && x.k === 1 && x.mode === 'normal')!;
    const p = s.player!;
    const base = previewFight(s.g, p, { ...o, use: [] })!;
    expect(base.keys).toEqual([]);
    expect(base.chips.some((c) => c.key === 'morale')).toBe(true);
    const one = previewFight(s.g, p, { ...o, use: ['morale'] })!;
    expect(one.power).toBe(base.power + 1);
    expect(one.cost.food).toBe(1);
    expect(one.keys).toEqual(['morale']);
    // 1人なら士気は1つまで。知らない key は飛ばす
    const many = previewFight(s.g, p, { ...o, use: ['morale', 'morale', 'nope'] })!;
    expect(many.keys).toEqual(['morale']);
    // 「確実に」のおまかせは、選べる後押しの中から選ぶ
    const safe = previewFight(s.g, p, w.opts.find((x) => x.s === o.s && x.k === 1 && x.mode === 'safe')!)!;
    for (const k of safe.keys) expect(safe.chips.map((c) => c.key)).toContain(k);
  });

  it('答えに use を付けると、その後押しだけを使って戦う（払うもの・戦力の内訳）', () => {
    const { s } = toFight(5);
    const w = s.waiting as Extract<typeof s.waiting, { k: 'choose' }>;
    const i = w.opts.findIndex((x) => x.s.startsWith('nest') && x.k === 1 && x.mode === 'normal');
    const evs = applyAction2(s, { t: 'opt', i, use: ['morale'] });
    const paid = pays(evs);
    expect(paid.length).toBe(1);
    expect((paid[0] as Extract<GameEvent, { t: 'pay' }>).cost.food).toBe(1);
    const pw = evs.find((e) => e.t === 'power') as Extract<GameEvent, { t: 'power' }>;
    expect(pw.parts.some((x) => x.label === '士気')).toBe(true);
  });

  it('use が空なら何も払わない（mode normal と同じ）。形の違う use は無視して mode のまま', () => {
    const a = toFight(5), b = toFight(5);
    const wa = a.s.waiting as Extract<typeof a.s.waiting, { k: 'choose' }>;
    const i = wa.opts.findIndex((x) => x.s.startsWith('nest') && x.k === 1 && x.mode === 'normal');
    const ea = applyAction2(a.s, { t: 'opt', i, use: [] });
    const eb = applyAction2(b.s, { t: 'opt', i, use: 'morale' as never });
    expect(pays(ea)).toEqual([]);
    expect(JSON.stringify(ea)).toBe(JSON.stringify(eb));
    expect(cleanUse('x')).toBeUndefined();
    expect(cleanUse(Array(20).fill('morale'))).toBeUndefined();
    expect(cleanUse(['morale', 'potion'])).toEqual(['morale', 'potion']);
  });

  it('待ち伏せの選択肢には use を付けない（戦うときに決める）。同じ答えの記録から同じ試合になる', () => {
    const { s, hist } = toFight(5);
    const w = s.waiting as Extract<typeof s.waiting, { k: 'choose' }>;
    const wo = w.opts.find((x: Option) => x.mode === 'wait');
    if (wo) expect(previewFight(s.g, s.player!, { ...wo, use: [] })).toEqual(previewFight(s.g, s.player!, wo));
    const i = w.opts.findIndex((x) => x.s.startsWith('nest') && x.k === 1 && x.mode === 'normal');
    const a: Action2 = { t: 'opt', i, use: ['morale'] };
    applyAction2(s, a);
    const again = new Kiridani2Session({ n: 4, seed: 5, years: 5, human: 0, levels: Array(4).fill('normal'), names: NAMES });
    again.start();
    for (const x of [...hist, a]) applyAction2(again, x);
    expect(again.g.players.map((p) => p.res)).toEqual(s.g.players.map((p) => p.res));
    expect(again.g.players.map((p) => p.comps.map((c) => c.injured))).toEqual(s.g.players.map((p) => p.comps.map((c) => c.injured)));
  });
});
