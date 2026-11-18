// 霧谷 v2：最終画面の「名声の移り変わり」の点（View2.fameHist）が出来事だけから作れるか（参加者・再開でも同じ出来事が届くので同じ点になる）
import { describe, expect, it } from 'vitest';
import { AI, Kiridani2Session, applyAction2, syncEvent, type GameEvent } from '@midorino/engine/src/kiridani2';
import { answerToAction } from '@midorino/engine/src/kiridani2/uihelp';
import { applyEvent2, initialView2, type Ev } from '../src/kiridani2/view';
import { famePoints } from '../src/kiridani2/fameGraph';

/** ひとり用の画面と同じ流れ（人間の席を AI が答え、まとまりの終わりに合わせを付ける）で最後まで */
function play(seed: number, n: number, years: number): { evs: Ev[]; s: Kiridani2Session } {
  const s = new Kiridani2Session({ n, seed, years, human: 0 });
  const ai = new AI('normal', { seed: 7 });
  const evs: Ev[] = [];
  const push = (e: GameEvent[]) => { evs.push(...e); if (e.length) evs.push(syncEvent(s.g)); };
  push(s.start());
  for (let i = 0; i < 20000 && !s.done; i++) push(applyAction2(s, answerToAction(s.waiting!, ai.respond(s.waiting!))));
  return { evs, s };
}

describe('霧谷 v2：名声の移り変わり', () => {
  for (const [seed, n, years] of [[3, 4, 5], [8, 3, 10]] as const) {
    it(`${n}人・${years}年：始まり＋全ラウンド＋集計の点がそろい、集計は最終得点と同じ`, () => {
      const { evs, s } = play(seed, n, years);
      expect(s.done).toBe(true);
      let v = initialView2(0);
      for (const e of evs) v = applyEvent2(v, e);
      expect(v.phase).toBe('final');
      expect(v.fameHist.map((h) => h.round)).toEqual(Array.from({ length: years * 4 + 1 }, (_, i) => i));
      for (const h of v.fameHist) expect(h.fame.length).toBe(n);
      const pts = famePoints(v, v.final);
      expect(pts.length).toBe(years * 4 + 2);
      const last = pts[pts.length - 1];
      expect(last.final).toBe(true);
      expect(last.fame).toEqual(v.final!.slice().sort((a, b) => a.seat - b.seat).map((r) => r.total));
      // 冬の季節は4ラウンドごと
      expect(v.fameHist.filter((h) => h.season === 'winter').map((h) => h.round)).toEqual(Array.from({ length: years }, (_, i) => (i + 1) * 4));
      // 途中から読み込み直しても（出来事の前半を一度に当てても）同じ点になる
      let w = initialView2(0);
      const cut = Math.floor(evs.length / 2);
      for (const e of evs.slice(0, cut)) w = applyEvent2(w, e);
      for (const e of evs.slice(cut)) w = applyEvent2(w, e);
      expect(w.fameHist).toEqual(v.fameHist);
    });
  }
});
