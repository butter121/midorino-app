import { describe, expect, it } from 'vitest';
import { playAIGame, randomSetup } from '../src/index.js';

describe('AI同士の対戦（TypeScript版）', () => {
  for (const n of [3, 4, 5, 6]) {
    it(`${n}人で最後まで進み、矛盾が出ない`, () => {
      for (let s = 0; s < 5; s++) {
        const { g, scores } = playAIGame(randomSetup(n, s), Array(n).fill(s % 2 ? 'expert' : 'mid'), s);
        expect(g.errors).toEqual([]);
        expect(g.round).toBe(12);
        scores.forEach((x) => expect(Number.isFinite(x)).toBe(true));
      }
    });
  }
});
