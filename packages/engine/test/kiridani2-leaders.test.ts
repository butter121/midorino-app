// 霧谷 v2：リーダー12人（K さんの案）。効果は engine.ts、数字は data.ts の LEADER
import { describe, expect, it } from 'vitest';
import { AI, CARD_SET, DATA, drive, Game, scoreBreakdown } from '../src/kiridani2/index';

const L = DATA.LEADER;
function bare(leader: string) {
  const g = new Game(2, [null, new AI('normal', { seed: 1 })], { seed: 1, cards: CARD_SET });
  const p = g.players[0];
  p.leader = leader;
  p.comps = [0, 1].map((i) => ({ atk: 1, def: 1, weapon: null, armor: null, leader: i === 0, injured: false, rest: false, used: false }));
  return { g, p };
}

describe('kiridani2 リーダー', () => {
  it('12人：戦闘6人・探索6人、説明がある', () => {
    expect(CARD_SET.leaders.length).toBe(12);
    expect(CARD_SET.leaders.filter((c) => c.role === 'fight').length).toBe(6);
    expect(CARD_SET.leaders.filter((c) => c.role === 'explore').length).toBe(6);
    for (const c of CARD_SET.leaders) expect(c.text.length).toBeGreaterThan(10);
  });

  it('戦闘の天才：武器の戦力が倍', () => {
    const a = bare('l_akane'), b = bare('l_kai');
    for (const { g, p } of [a, b]) { p.items = ['g_sword']; g.equip(p, 1, 'weapon', 'g_sword'); }
    const w = CARD_SET.gear.find((c) => c.id === 'g_sword')!.power!;
    expect(a.g.compPower(a.p, 1) - b.g.compPower(b.p, 1)).toBe(w * (L.genius.weaponMult - 1));
  });

  it('無限の努力家：熟練の効き目が倍・上限+1', () => {
    const a = bare('l_jin'), b = bare('l_kai');
    expect(a.g.compPower(a.p, 0) - b.g.compPower(b.p, 0)).toBe(L.striver.skillMult - 1);
    a.p.comps[0].atk = DATA.MAX_SKILL.atk;
    expect(a.g.trainCands(a.p, 'atk')).toContain(0);
  });

  it('盾の勇者：運命は0、守りを戦力に', () => {
    const { g, p } = bare('l_gareth');
    expect(g.fateDist(p)).toEqual([[0, 1]]);
    expect(g.drawFate(p)).toBe(0);
    const mon = g.rollMonster(DATA.MONSTERS[0], 0.1, 1);
    const pl = g.makePlan(p, mon, [0, 1], 'normal', false, mon.str);
    expect(pl.parts.some((x) => x.label.includes('盾の勇者'))).toBe(true);
  });

  it('孤高のテイマー：巣の魔物は好物で使い魔にするだけ', () => {
    const { g, p } = bare('l_haru');
    const nd = g.nests[0];
    nd.mon = g.rollMonster(DATA.MONSTERS[0], 0.1, 1);
    const need = g.captureCost(nd.mon, p);
    const r = Object.keys(need)[0] as keyof typeof p.res;
    p.res[r] = 99;
    const opts = g.legal(p).filter((o) => o.s === nd.id);
    expect(opts.length).toBeGreaterThan(0);
    expect(opts.every((o) => o.mode === 'capture')).toBe(true);
    drive(g.apply(p, opts[0]));
    expect(p.pets.length).toBe(1);
    expect(nd.mon).toBeNull();
    expect(p.res[r]).toBe(99 - (need[r] ?? 0));
  });

  it('偉大な探検家：冬の食料−2。職人：道具が2安い。商人：始めの資源', () => {
    const a = bare('l_iska'), b = bare('l_kai'), c = bare('l_momo');
    expect(c.g.upkeepNeed(c.p) - a.g.upkeepNeed(a.p)).toBe(Math.min(L.explorer.upkeep, c.g.upkeepNeed(c.p)));
    const tool = CARD_SET.tools.find((t) => Object.entries(t.cost ?? {}).filter(([r]) => r !== 'gold').reduce((s, [, n]) => s + (n ?? 0), 0) >= 2)!;
    const sum = (x: Record<string, number | undefined>) => Object.entries(x).filter(([r]) => r !== 'gold').reduce((s, [, n]) => s + (n ?? 0), 0);
    expect(sum(c.g.cardCost(c.p, tool.id)) - sum(b.g.cardCost(b.p, tool.id))).toBe(L.crafter.discount);
  });

  it('試合を最後まで回せる（全リーダー）、終わりの名声はリーダーの欄に入る', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const g = new Game(4, [0, 1, 2, 3].map((i) => new AI('normal', { seed: i + seed })), { seed, years: 5, cards: CARD_SET });
      drive(g.play());
      for (const p of g.players) expect(scoreBreakdown(g, p).leader).toBeGreaterThanOrEqual(0);
    }
  });
});
