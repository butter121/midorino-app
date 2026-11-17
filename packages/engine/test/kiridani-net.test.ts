// 霧谷：オンライン対戦の審判（席ごとに隠した出来事・問い・盤面の写し）
import { describe, expect, it } from 'vitest';
import { KiridaniReferee, KiridaniSession, ShadowSession, applyAction, decodeGame, encodeGame, fightChips, leaksFor, marketQuote, previewPick, simpleAnswer, type Prompt } from '../src/kiridani';

const NAMES = ['ホスト', 'ゲスト1', 'ゲスト2', 'AI4', 'AI5'];

/** 審判を、人間の席それぞれの「写し」だけを見て答えさせて最後まで回す */
function playReferee(n: number, seed: number, humans: number[], order: (seats: number[]) => number[] = (x) => x) {
  const ref = new KiridaniReferee({ n, seed, humans, names: NAMES.slice(0, n) });
  ref.start();
  let steps = 0;
  while (!ref.done) {
    const seats = order(ref.waitingSeats());
    expect(seats.length).toBeGreaterThan(0);
    for (const seat of seats) {
      const pr = ref.prompt(seat);
      if (!pr) continue;
      const wire = JSON.parse(JSON.stringify(pr)) as Prompt;
      const sh = new ShadowSession(wire);
      const r = ref.act(seat, wire.id, simpleAnswer(sh));
      expect(r).toEqual({ ok: true });
    }
    if (++steps > 5000) throw new Error('終わらない');
  }
  return ref;
}

/** 同じ答え方で KiridaniSession を直接回す */
function playDirect(n: number, seed: number, humans: number[]) {
  const s = new KiridaniSession({ n, seed, humans, names: NAMES.slice(0, n) });
  s.start();
  while (!s.done) applyAction(s, simpleAnswer(s));
  return s;
}

describe('霧谷：オンライン対戦の審判', () => {
  it('人間3席＋AI2席：写しだけで答えても、直接回した試合と同じ得点になる', () => {
    for (const seed of [3, 11]) {
      const ref = playReferee(5, seed, [0, 1, 2], (x) => [...x].reverse());
      const direct = playDirect(5, seed, [0, 1, 2]);
      expect(ref.scores).toEqual(direct.scores);
      expect(ref.log.filter((e) => e.t === 'combat_start').length).toBeGreaterThan(0);
    }
  });

  it('席ごとの出来事に、他の席の手札・ドラフトの手が入らない', () => {
    const ref = playReferee(4, 5, [0, 2]);
    for (let seat = 0; seat < 4; seat++) {
      expect(ref.logs[seat].length).toBe(ref.log.length);
      expect(ref.logs[seat].filter((e) => leaksFor(e, seat))).toEqual([]);
      const start = ref.logs[seat][0];
      expect(start.t === 'game_start' && start.me).toBe(seat);
    }
    // 隠す前の記録には他の席の手が入っている
    expect(ref.log.some((e) => leaksFor(e, 0))).toBe(true);
  });

  it('ドラフトとキャラ選びは同時に答えられ、順番が来る前の答えは預かる', () => {
    const ref = new KiridaniReferee({ n: 4, seed: 9, humans: [0, 1, 3], names: NAMES.slice(0, 4) });
    ref.start();
    expect(ref.waitingSeats()).toEqual([0, 1, 3]);
    const p3 = ref.prompt(3)!;
    expect(p3.k).toBe('draft');
    expect(ref.act(3, p3.id, { t: 'card', id: p3.cards![0] })).toEqual({ ok: true });
    expect(ref.prompt(3)).toBeNull();
    expect(ref.act(3, p3.id, { t: 'card', id: p3.cards![0] }).ok).toBe(false);
    // 席0・1が選ぶと、預かっていた席3の答えも入る
    for (const seat of [1, 0]) { const p = ref.prompt(seat)!; ref.act(seat, p.id, { t: 'card', id: p.cards![1] }); }
    const picks = ref.log.filter((e) => e.t === 'draft_pick');
    expect(picks.map((e) => e.t === 'draft_pick' && e.seat)).toEqual([0, 1, 2, 3]);
    expect(picks[3].t === 'draft_pick' && picks[3].card).toBe(p3.cards![0]);
    // 次の周の問いは新しい番号
    expect(ref.prompt(3)!.id).not.toBe(p3.id);
  });

  it('知らない答え・古い番号・ほかの席の番は断る', () => {
    const ref = new KiridaniReferee({ n: 3, seed: 2, humans: [0, 1], names: NAMES.slice(0, 3) });
    ref.start();
    const p = ref.prompt(0)!;
    expect(ref.act(0, p.id, { t: 'card', id: 'zzz' }).ok).toBe(false);
    expect(ref.act(0, 'n999', { t: 'card', id: p.cards![0] }).ok).toBe(false);
    expect(ref.act(2, p.id, { t: 'card', id: p.cards![0] }).ok).toBe(false);
    expect(ref.act(0, p.id, { t: 'opt', i: 0 } as never).ok).toBe(false);
    expect(ref.act(0, p.id, null as never).ok).toBe(false);
  });

  it('盤面の写し：他の席の手札は隠し、見込みの計算は本物と同じ', () => {
    const s = new KiridaniSession({ n: 4, seed: 4, humans: [0, 1] });
    s.start();
    let checked = 0;
    for (let i = 0; i < 3000 && !s.done && checked < 6; i++) {
      const w = s.waiting!;
      if (w.k === 'choose') {
        const seat = w.p.pid;
        const snap = JSON.parse(JSON.stringify(encodeGame(s.g, seat)));
        const g2 = decodeGame(snap);
        for (const q of g2.players) if (q.pid !== seat) expect(q.hand.every((c) => c === '?')).toBe(true);
        expect(g2.players[seat].hand).toEqual(w.p.hand);
        expect(g2.legal(g2.players[seat])).toEqual(s.g.legal(w.p));
        expect(marketQuote(g2, g2.players[seat])).toEqual(marketQuote(s.g, w.p));
        const nest = w.opts.find((o) => o[0].startsWith('nest') && Array.isArray(o[1]));
        if (nest) {
          const sel = { sid: nest[0], k: (nest[1] as number[])[0], boosts: [] as string[] };
          expect(fightChips(g2, g2.players[seat], nest[0])).toEqual(fightChips(s.g, w.p, nest[0]));
          expect(previewPick(g2, g2.players[seat], sel)).toEqual(previewPick(s.g, w.p, sel));
          checked++;
        }
      }
      applyAction(s, simpleAnswer(s));
    }
    expect(checked).toBeGreaterThan(0);
  });
});
