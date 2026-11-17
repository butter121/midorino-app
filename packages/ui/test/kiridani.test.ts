import { describe, expect, it } from 'vitest';
import { SampleGame } from '../src/kiridani/sample/sim';
import { applyEvent, initialView } from '../src/kiridani/reduce';
import { AnimQueue, type Clock } from '../src/kiridani/anim/queue';
import { ROUND_BUDGET_MS } from '../src/kiridani/anim/timing';
import { SPEEDS } from '../src/kiridani/anim/timing';
import { cuesFor } from '../src/kiridani/sound';
import type { GameEvent } from '../src/kiridani/types';
import * as D from '../src/kiridani/data';

/** 偽の時計：setTimeout を貯めて、run() でまとめて進める */
function fakeClock() {
  let now = 0; const q: { at: number; fn: () => void; id: number }[] = []; let id = 0;
  const clock: Clock = {
    setTimeout: (fn, ms) => { q.push({ at: now + ms, fn, id: ++id }); return id; },
    clearTimeout: (h) => { const i = q.findIndex((x) => x.id === h); if (i >= 0) q.splice(i, 1); },
  };
  const run = () => { while (q.length) { q.sort((a, b) => a.at - b.at); const t = q.shift()!; now = t.at; t.fn(); } };
  return { clock, run, get now() { return now; } };
}

describe('霧谷：データ', () => {
  it('data.py と同じ数がそろっている', () => {
    expect(D.ACTIONS).toHaveLength(20);
    expect(D.MONSTERS).toHaveLength(30);
    expect(D.CHARACTERS).toHaveLength(12);
    expect(D.OCCUPATIONS).toHaveLength(30);
    expect(D.ITEMS).toHaveLength(30);
    expect(Object.keys(D.QUESTS)).toHaveLength(15);
    expect(D.seasonOf(4)).toBe('winter');
    expect(D.seasonOf(5)).toBe('spring');
  });
});

describe('霧谷：見本の試合', () => {
  for (const n of [3, 4, 5, 6]) {
    it(`${n}人で最後まで進み、画面の状態が矛盾しない`, () => {
      const g = new SampleGame(n, 11 + n);
      const evs = g.runToEnd();
      expect(g.done).toBe(true);
      expect(evs.at(-1)?.t).toBe('game_end');
      // 画面側（自分の席から見た状態）でも最後まで当てられる
      let v = initialView(0);
      for (const e of evs) v = applyEvent(v, e);
      expect(v.phase).toBe('final');
      expect(v.final).toHaveLength(n);
      for (const p of v.players) {
        for (const r of D.RES) expect(p.res[r]).toBeGreaterThanOrEqual(0);
        expect(p.hand.length + p.occupations.length + p.weapons.length + p.facilities.length + p.spellsUsed.length).toBeGreaterThanOrEqual(6);
      }
      // 自分以外の手札は見えない
      expect(v.players[1].hand.every((c) => c === '?')).toBe(true);
      const kinds = new Set(evs.map((e) => e.t));
      for (const t of ['draft_offer', 'draft_pick', 'char_pick', 'place', 'gather', 'combat_start', 'fate_flip', 'clash', 'counter', 'loot', 'trophy', 'raid', 'upkeep', 'weather', 'boss_appear', 'score'] as const) expect(kinds.has(t), t).toBe(true);
      // 全部の出来事に効果音の割り当てがあり、例外が出ない
      for (const e of evs) cuesFor(e, 0);
    });
  }
});

describe('霧谷：演出キュー', () => {
  it('順番どおりに再生し、演出中の操作は終わってから実行する', () => {
    const fc = fakeClock();
    const played: string[] = [];
    const q = new AnimQueue({ me: 0, clock: fc.clock, onEvent: (ev) => played.push(ev.t) });
    const evs: GameEvent[] = [{ t: 'turn', seat: 1 }, { t: 'place', seat: 1, space: 'forest', companion: 'c1-0' }, { t: 'gather', seat: 1, space: 'forest', gain: { wood: 3 } }];
    q.push(...evs);
    const done: string[] = [];
    q.submit(() => done.push(`input@${played.length}`));
    expect(done).toEqual([]);
    fc.run();
    expect(played).toEqual(['turn', 'place', 'gather']);
    expect(done).toEqual(['input@3']);
    q.submit(() => done.push('now'));
    expect(done).toEqual(['input@3', 'now']);
  });

  for (const speed of SPEEDS) {
    it(`6人でも1ラウンドの演出が約1分半以内（${speed}）`, () => {
      const evs = new SampleGame(6, 3).runToEnd();
      const fc = fakeClock();
      const q = new AnimQueue({ me: 0, speed, clock: fc.clock, onEvent: () => {} });
      q.push(...evs);
      fc.run();
      for (const [r, ms] of Object.entries(q.roundTotals)) if (Number(r) > 0) expect(ms, `round ${r}`).toBeLessThanOrEqual(ROUND_BUDGET_MS + 100);
    });
  }

  it('速さで短くなり、最小でも 0.2 秒は残る', () => {
    const ev: GameEvent = { t: 'gather', seat: 0, space: 'forest', gain: { wood: 3 } };
    const ms = SPEEDS.map((s) => new AnimQueue({ me: 0, speed: s, onEvent: () => {} }).plannedMs(ev));
    expect(ms[0]).toBeGreaterThan(ms[1]);
    expect(ms[1]).toBeGreaterThan(ms[2]);
    expect(ms[2]).toBe(200);
  });

  it('標準は以前より約1.5倍ゆっくり、速いは以前の標準くらい', () => {
    const ev: GameEvent = { t: 'gather', seat: 0, space: 'forest', gain: { wood: 3 } };
    const [normal, fast] = (['normal', 'fast'] as const).map((s) => new AnimQueue({ me: 0, speed: s, onEvent: () => {} }).plannedMs(ev));
    expect(normal).toBe(900);
    expect(fast).toBe(600);
    expect(ROUND_BUDGET_MS).toBe(90_000);
  });
});
