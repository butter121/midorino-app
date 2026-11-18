// 霧谷 v2：止まらない画面
// - 画面が出し方を知らない問いでも、選択肢を全部並べるシート（fallbackSheet2）で答えられる
// - 再入室・再開では、これまでの出来事を演出なしで一気に当てる（catchUp2）
import { describe, expect, it } from 'vitest';
import { AI, Kiridani2Session, applyAction2, type Action2 } from '@midorino/engine/src/kiridani2';
import { answerToAction } from '@midorino/engine/src/kiridani2/uihelp';
import { actionable2, fallbackSheet2, uiFor2 } from '../src/kiridani2/seat';
import { catchUp2 } from '../src/kiridani2/online2';

const seat = (s: Kiridani2Session) => ({ g: s.g, player: s.player, waiting: s.waiting, tradePartners: () => s.tradePartners(), tradeLeft: () => s.tradeLeft(), judgeTrade: s.judgeTrade.bind(s) });

describe('kiridani2 止まらない画面', () => {
  it('どの問いも画面で答えられる。全部並べるシートの答えはそのまま受け付けられる', () => {
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 3; seed++) {
      const s = new Kiridani2Session({ n: 3, seed, years: 5, human: 0 });
      const helper = new AI('normal', { seed: 5 });
      s.start();
      let i = 0;
      while (!s.done) {
        const sv = seat(s) as never;
        expect(actionable2(sv, uiFor2(sv)), `${s.waiting!.k}`).toBe(true);
        kinds.add(s.waiting!.k);
        const fb = fallbackSheet2(sv)!;
        expect(fb.items.length).toBeGreaterThan(0);
        // ときどき全部並べるシートの最初の選択肢で答える（choose はほかのマスを壊さないよう AI の答えにする）
        const a: Action2 = s.waiting!.k !== 'choose' && i++ % 3 === 0 ? fb.toAction(fb.items[0].id) : answerToAction(s.waiting!, helper.respond(s.waiting!));
        applyAction2(s, a);
      }
    }
    expect([...kinds]).toEqual(expect.arrayContaining(['card', 'ratio', 'choose']));
  });

  it('選べるものが盤面に出ない問いは「答えられない」と分かる（全部並べるシートを出す）', () => {
    const s = new Kiridani2Session({ n: 3, seed: 2, years: 5, human: 0 });
    s.start();
    while (s.waiting!.k !== 'choose') applyAction2(s, answerToAction(s.waiting!, new AI('normal', { seed: 1 }).respond(s.waiting!)));
    const sv = { ...seat(s), waiting: { ...s.waiting!, opts: (s.waiting as { opts: { s: string }[] }).opts.filter((o) => o.s === '@nothing') } } as never;
    expect(actionable2(sv, uiFor2(sv))).toBe(false);
  });

  it('再入室：最初に受け取った出来事は演出せずに当てる。途中は2ラウンド以上たまったときだけ', () => {
    const ev = (t: string) => ({ t });
    expect(catchUp2(0, [ev('game_start'), ev('leader_offer'), ev('sync')])).toBe(false);
    expect(catchUp2(0, [ev('game_start'), ...Array(30).fill(ev('draft_pick'))])).toBe(true);
    expect(catchUp2(0, [ev('round_start'), ev('turn')])).toBe(true);
    expect(catchUp2(120, [ev('turn'), ev('place'), ev('round_start'), ev('turn')])).toBe(false);
    expect(catchUp2(120, [ev('round_start'), ev('turn'), ev('round_start')])).toBe(true);
  });
});
