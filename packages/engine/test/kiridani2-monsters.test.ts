// 霧谷 v2：魔物・主・古竜の強さ（data.ts の MON_ROLL・DRAGON）、主・古竜に参加しなかった人の罰
import { describe, expect, it } from 'vitest';
import { AI, CARD_SET, DATA, drive, Game, type GameEvent } from '../src/kiridani2/index';

const game = (n: number, years: number, seed = 1) => new Game(n, Array.from({ length: n }, (_, i) => new AI('normal', { seed: i })), { seed, years, cards: CARD_SET });
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const rolls = (g: Game, kind: 'nest' | 'boss' | 'dragon', t: number, N = 400) => {
  const type = kind === 'nest' ? DATA.MONSTERS.find((m) => m.grade === 0)! : kind === 'boss' ? DATA.BOSS_TYPES[0] : DATA.ANCIENT_DRAGON;
  return Array.from({ length: N }, () => g.rollMonster(type, t, 1, kind));
};

describe('kiridani2 魔物の強さ', () => {
  it('巣の魔物は t とともに強くなり、長い試合ほど傾きが大きい', () => {
    const g5 = game(4, 5), g15 = game(4, 15);
    const e = avg(rolls(g5, 'nest', 0.1).map((m) => m.str)), l5 = avg(rolls(g5, 'nest', 0.9).map((m) => m.str)), l15 = avg(rolls(g15, 'nest', 0.9).map((m) => m.str));
    const R = DATA.MON_ROLL;
    expect(e).toBeCloseTo(R.base - R.ease.base + (R.slope[5] - R.ease.slope[5]) * 0.1, 0);
    expect(l5).toBeGreaterThan(e + 6);
    expect(l15).toBeGreaterThan(l5 + 3);
    expect(rolls(g5, 'nest', 0.5).every((m) => !m.boss)).toBe(true);
  });

  it('主は人数が多いほど強く（BOSS_N 倍）、巣の魔物の数倍', () => {
    const b2 = avg(rolls(game(2, 10), 'boss', 0.5).map((m) => m.str)), b4 = avg(rolls(game(4, 10), 'boss', 0.5).map((m) => m.str));
    const nest = avg(rolls(game(4, 10), 'nest', 0.5).map((m) => m.str));
    expect(b4).toBeGreaterThan(3 * nest);
    expect(b4 - 3).toBeCloseTo((DATA.BOSS_N[4] / DATA.BOSS_N[2]) * (b2 - 3), -1);
    const m = rolls(game(4, 10), 'boss', 0.5, 1)[0];
    expect(m.boss).toBe(true);
    expect('rage' in m).toBe(false);
  });

  it('古竜は主より強く（20 固定ではない）、証は強さ÷2.5＋15 前後。魔石は上級で2', () => {
    const g = game(4, 10);
    const d = rolls(g, 'dragon', 1);
    expect(avg(d.map((m) => m.str))).toBeGreaterThan(avg(rolls(g, 'boss', 0.8).map((m) => m.str)));
    expect(d.every((m) => Math.abs(m.trophy - (m.str / DATA.TROPHY.div + DATA.TROPHY.dragon)) <= 2 && m.raid === 0 && !('rage' in m))).toBe(true);
    expect(d.every((m) => m.stones === 2 && m.stoneTier === 2)).toBe(true);
  });

  it('荒ぶりはない：clash に rage は出ず、同じ種なら同じ試合になる', () => {
    const run = () => { const g = game(4, 5, 7); g.E = []; drive(g.play()); return g; };
    const a = run(), b = run();
    expect((a.E as GameEvent[]).some((e) => e.t === 'clash' && 'rage' in e)).toBe(false);
    expect(JSON.stringify(a.fightLog)).toBe(JSON.stringify(b.fightLog));
    expect(a.players.map((p) => p.fame.absent)).toEqual(b.players.map((p) => p.fame.absent));
  });

  for (const kind of ['boss', 'dragon'] as const) {
    it(`${kind === 'boss' ? '主' : '古竜'}に参加しなかった人は名声 −${DATA.BOSS_ABSENT}（参加した人は減らない）`, () => {
      const g = game(4, 5, 2);
      const r = 4;
      g.round = r;
      g.bossOf[r] = g.rollMonster(kind === 'boss' ? DATA.BOSS_TYPES[0] : DATA.ANCIENT_DRAGON, 0.5, 1, kind);
      g.E = [];
      g.lairQ = [{ pid: 1, idxs: [], mode: 'normal' }];
      drive(g.resolveLair());
      const reason = kind === 'boss' ? '主に参加しなかった' : '古竜に参加しなかった';
      const evs = (g.E as GameEvent[]).filter((e): e is Extract<GameEvent, { t: 'fame' }> => e.t === 'fame' && e.reason === reason);
      expect(evs.map((e) => e.seat).sort()).toEqual([0, 2, 3]);
      expect(evs.every((e) => e.amount === -DATA.BOSS_ABSENT)).toBe(true);
      for (const p of g.players) expect(p.fame.absent).toBe(p.pid === 1 ? 0 : -DATA.BOSS_ABSENT);
      expect(g.scoreRows()[0].items.find((x) => x.key === 'absent')?.fame).toBe(-DATA.BOSS_ABSENT);
    });
  }

  it('誰も主の巣に送らなければ全員 −BOSS_ABSENT（古竜はさらに −DRAGON.fail）', () => {
    const g = game(3, 5, 4);
    g.round = 20;
    g.bossOf[20] = g.rollMonster(DATA.ANCIENT_DRAGON, 1, 5, 'dragon');
    drive(g.resolveLair());
    for (const p of g.players) { expect(p.fame.absent).toBe(-DATA.BOSS_ABSENT); expect(p.fame.dragon).toBe(-DATA.DRAGON.fail); }
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
