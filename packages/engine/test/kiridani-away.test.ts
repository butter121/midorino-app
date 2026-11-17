// 霧谷：途中退室した人の席を弱い AI が代わりに動かし、戻ったら人に返す
import { describe, expect, it } from 'vitest';
import { KiridaniReferee, ShadowSession, simpleAnswer, type Prompt } from '../src/kiridani';

const NAMES = ['ホスト', 'ゲスト1', 'ゲスト2', 'AI4'];

function step(ref: KiridaniReferee) {
  for (const seat of ref.waitingSeats()) {
    const pr = ref.prompt(seat);
    if (!pr) continue;
    const wire = JSON.parse(JSON.stringify(pr)) as Prompt;
    expect(ref.act(seat, wire.id, simpleAnswer(new ShadowSession(wire)))).toEqual({ ok: true });
  }
}

/** 決めた手数で席 1 を退室させ、のちに戻す */
function play(seed: number, leaveAt: number, backAt: number) {
  const ref = new KiridaniReferee({ n: 4, seed, humans: [0, 1, 2], names: NAMES, offerTimeoutMs: 0 });
  ref.start();
  let steps = 0;
  const awaySteps: boolean[] = [];
  while (!ref.done) {
    if (steps === leaveAt) expect(ref.setAway(1, true)).toBe(true);
    if (steps === backAt) expect(ref.setAway(1, false)).toBe(true);
    if (ref.isAway(1)) { expect(ref.prompt(1)).toBeNull(); expect(ref.waitingSeats()).not.toContain(1); }
    awaySteps.push(ref.isAway(1));
    step(ref);
    if (++steps > 5000) throw new Error('終わらない');
  }
  return { ref, awaySteps };
}

describe('霧谷：途中退室と復帰', () => {
  it('退室中は席 1 に問いが来ず、試合は最後まで進む。戻ると再び問いが来る', () => {
    const { ref, awaySteps } = play(4, 5, 20);
    expect(ref.done).toBe(true);
    expect(awaySteps.slice(5, 20).every(Boolean)).toBe(true);
    expect(awaySteps.slice(20).some(Boolean)).toBe(false);
    // 戻ったあとに席 1 も答えている
    const after = ref.history.slice(ref.history.findIndex(([s, id, a]) => s === -1 && id === '1' && a.t === 'away' && !a.v));
    expect(after.some(([s]) => s === 1)).toBe(true);
  });

  it('ドラフトの最中に退室しても、AI が代わりに選んで先へ進む', () => {
    const { ref } = play(7, 0, 10_000);
    expect(ref.done).toBe(true);
    expect(ref.history.filter(([s]) => s === 1)).toEqual([]);
  });

  it('記録を読み直すと、退室・復帰も含めて同じ試合になる（ホストの読み込み直し）', () => {
    const { ref } = play(12, 6, 18);
    const again = new KiridaniReferee({ n: 4, seed: 12, humans: [0, 1, 2], names: NAMES, offerTimeoutMs: 0 });
    again.start();
    again.replay(JSON.parse(JSON.stringify(ref.history)));
    expect(again.done).toBe(true);
    expect(again.scores).toEqual(ref.scores);
  });

  it('退室した人への取引の申し込みは流れる', () => {
    const ref = new KiridaniReferee({ n: 4, seed: 3, humans: [0, 1, 2], names: NAMES, offerTimeoutMs: 0 });
    ref.start();
    let steps = 0;
    while (!ref.done && steps++ < 3000) {
      const seat = ref.waitingSeats()[0];
      const pr = seat === undefined ? null : ref.prompt(seat);
      if (pr && pr.k === 'choose' && pr.left > 0) {
        const me = ref.g.players[seat], to = pr.partners.find((b) => b !== seat && [0, 1, 2].includes(b));
        const give = (['food', 'mat', 'mana', 'herb'] as const).find((r) => me.res[r] > 0);
        if (to !== undefined && give) {
          const get = (['food', 'mat', 'mana', 'herb'] as const).find((r) => r !== give && ref.g.players[to].res[r] > 0);
          if (get && ref.act(seat, pr.id, { t: 'offer', b: to, give: { [give]: 1 }, get: { [get]: 1 } }).ok) {
            expect(ref.offer?.to).toBe(to);
            expect(ref.setAway(to, true)).toBe(true);
            expect(ref.offer).toBeNull();
            expect(ref.noteFor(seat)?.ok).toBe(false);
            return;
          }
        }
      }
      step(ref);
    }
    throw new Error('取引の場面がなかった');
  });
});
