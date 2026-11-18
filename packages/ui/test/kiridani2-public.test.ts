// 霧谷 v2：始めの先手（くじ）・全員の冬の食料・運命の山の残りが、出来事だけで画面の状態に入り、エンジンと一致する
import { describe, expect, it } from 'vitest';
import { AI, Kiridani2Session, applyAction2, syncEvent, type GameEvent } from '@midorino/engine/src/kiridani2';
import { answerToAction } from '@midorino/engine/src/kiridani2/uihelp';
import { applyEvent2, initialView2, upkeepNeed, winterFood, type Ev, type View2 } from '../src/kiridani2/view';

describe('霧谷 v2：公開の情報（先手・冬の食料・運命の山）', () => {
  it('出来事を当てるたびに、先手・全員の冬の食料・運命の山の残りがエンジンと同じ', () => {
    const s = new Kiridani2Session({ n: 4, seed: 21, years: 5, human: 0 });
    const ai = new AI('normal', { seed: 5 });
    let v: View2 = initialView2(0);
    let checked = 0, flips = 0;
    const same = () => {
      for (const p of s.g.players) {
        const pv = v.players[p.pid];
        expect(upkeepNeed(pv)).toBe(s.g.upkeepNeed(p));
        expect(winterFood(pv).have).toBe(p.res.food);
        expect(pv.fateLeft).toEqual([...p.fate].sort((a, b) => a - b));
      }
      checked++;
    };
    const push = (evs: GameEvent[]) => {
      // 合わせなしでも運命の山は出来事（春の混ぜ直し・めくり）だけで追える
      for (const e of evs) { v = applyEvent2(v, e as Ev); if (e.t === 'fate_flip') flips++; }
      if (evs.length) { v = applyEvent2(v, syncEvent(s.g)); if (v.round > 0) same(); }
    };
    push(s.start());
    expect(v.first).toBe(s.g.first);
    expect(v.log.some((l) => l.startsWith('先攻は'))).toBe(true);
    for (let i = 0; i < 20000 && !s.done; i++) push(applyAction2(s, answerToAction(s.waiting!, ai.respond(s.waiting!))));
    expect(s.done).toBe(true);
    expect(checked).toBeGreaterThan(20);
    expect(flips).toBeGreaterThan(0);
  });

  it('合わせが届く前でも、運命の山は春の混ぜ直しとめくった札から追える', () => {
    const s = new Kiridani2Session({ n: 3, seed: 4, years: 5, human: -1 });
    const evs = s.start();
    let v: View2 = initialView2(-1);
    for (const e of evs) {
      v = applyEvent2(v, e as Ev);
      if (e.t === 'round_end') for (const p of v.players) expect(p.fateLeft.length).toBeLessThanOrEqual(6);
    }
    const g = s.g;
    for (const p of g.players) expect(v.players[p.pid].fateLeft).toEqual([...p.fate].sort((a, b) => a - b));
  });
});
