// 霧谷 v2：魔物・主・古竜の強さ（data.ts の MON_ROLL・DRAGON）と荒ぶり、主の巣の勝つ見込み
import { describe, expect, it } from 'vitest';
import { AI, CARD_SET, DATA, drive, Game, rageDist } from '../src/kiridani2/index';

const game = (n: number, years: number, seed = 1) => new Game(n, Array.from({ length: n }, (_, i) => new AI('normal', { seed: i })), { seed, years, cards: CARD_SET });
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const rolls = (g: Game, kind: 'nest' | 'boss' | 'dragon', t: number, N = 400) => {
  const type = kind === 'nest' ? DATA.MONSTERS.find((m) => m.grade === 0)! : kind === 'boss' ? DATA.BOSS_TYPES[0] : DATA.ANCIENT_DRAGON;
  return Array.from({ length: N }, () => g.rollMonster(type, t, 1, kind));
};

describe('kiridani2 魔物の強さ', () => {
  it('巣の魔物は t とともに強くなり、長い試合ほど傾きが大きい。荒ぶりはない', () => {
    const g5 = game(4, 5), g15 = game(4, 15);
    const e = avg(rolls(g5, 'nest', 0.1).map((m) => m.str)), l5 = avg(rolls(g5, 'nest', 0.9).map((m) => m.str)), l15 = avg(rolls(g15, 'nest', 0.9).map((m) => m.str));
    expect(e).toBeCloseTo(DATA.MON_ROLL.base + DATA.MON_ROLL.slope[5] * 0.1, 0);
    expect(l5).toBeGreaterThan(e + 8);
    expect(l15).toBeGreaterThan(l5 + 3);
    expect(rolls(g5, 'nest', 0.5).every((m) => !m.rage && !m.boss)).toBe(true);
  });

  it('主は人数に比例して強く、巣の魔物の数倍。荒ぶりを持つ', () => {
    const b2 = avg(rolls(game(2, 10), 'boss', 0.5).map((m) => m.str)), b4 = avg(rolls(game(4, 10), 'boss', 0.5).map((m) => m.str));
    const nest = avg(rolls(game(4, 10), 'nest', 0.5).map((m) => m.str));
    expect(b4).toBeGreaterThan(3 * nest);
    expect(b4 - 3).toBeCloseTo(2 * (b2 - 3), -1);
    const m = rolls(game(4, 10), 'boss', 0.5, 1)[0];
    expect(m.boss).toBe(true);
    expect(m.rage).toBeCloseTo(m.str * DATA.MON_ROLL.boss.rage, 0);
  });

  it('古竜は主より強く（20 固定ではない）、証は DRAGON.trophy', () => {
    const g = game(4, 10);
    const d = rolls(g, 'dragon', 1);
    expect(avg(d.map((m) => m.str))).toBeGreaterThan(avg(rolls(g, 'boss', 0.8).map((m) => m.str)));
    expect(d.every((m) => m.trophy === DATA.DRAGON.trophy && m.raid === 0 && (m.rage ?? 0) > 0)).toBe(true);
  });

  it('荒ぶりの分布は確率の合計が1で、0 を中心に対称', () => {
    for (const sd of [0, 1.5, 4, 8.3]) {
      const d = rageDist(sd);
      expect(d.reduce((a, [, p]) => a + p, 0)).toBeCloseTo(1, 9);
      expect(d.reduce((a, [v, p]) => a + v * p, 0)).toBeCloseTo(0, 6);
      if (sd) expect(Math.max(...d.map(([v]) => Math.abs(v)))).toBeLessThanOrEqual(Math.round(DATA.MON_ROLL.clip * sd));
    }
  });

  it('戦闘は fightLog に残る（主・古竜に誰も挑まなければ skip）。古竜は最後の冬に出る', () => {
    const g = game(4, 5, 3);
    drive(g.play());
    expect(g.fightLog.some((f) => f.kind === 'nest')).toBe(true);
    const big = g.fightLog.filter((f) => f.kind !== 'nest');
    expect(big.length).toBe(DATA.BOSS_YEARS[5].length + 1);
    const dr = big.find((f) => f.kind === 'dragon')!;
    expect(dr.round).toBe(20);
    for (const f of g.fightLog) if (f.mode !== 'skip') expect(f.win).toBe(f.total >= f.str);
  });
});
