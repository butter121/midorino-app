import { describe, expect, it } from 'vitest';
import {
  AI, ancientScore, CARD_SET, DATA, drive, DslError, Game, Kiridani2Session, loadCards, Rng, score, startSeat, tableScore, validateCard,
  type CardDef, type CardSet, type StageDef,
} from '../src/kiridani2/index';

const aiGame = (n: number, years: number, seed: number, level: 'novice' | 'normal' | 'strong' = 'normal') => {
  const ais = Array.from({ length: n }, (_, i) => new AI(level, { seed: seed * 10 + i }));
  const g = new Game(n, ais, { seed, years, cards: CARD_SET });
  const scores = drive(g.play());
  return { g, scores };
};

describe('kiridani2 乱数', () => {
  it('同じ種から同じ列', () => {
    const a = new Rng(42), b = new Rng(42);
    for (let i = 0; i < 100; i++) expect(a.random()).toBe(b.random());
  });
  it('切った正規分布は ±2.5σ に収まり、平均0・分散はほぼ1', () => {
    const r = new Rng(7);
    let s = 0, s2 = 0;
    const N = 20000;
    for (let i = 0; i < N; i++) {
      const z = r.truncNormal(0, 1.2, 2.5);
      expect(Math.abs(z)).toBeLessThanOrEqual(2.5 * 1.2 + 1e-12);
      s += z; s2 += z * z;
    }
    const mean = s / N, sd = Math.sqrt(s2 / N - mean * mean);
    expect(Math.abs(mean)).toBeLessThan(0.05);
    // ±2.5σ で切った正規分布の標準偏差は約 0.955σ（理論値：√(1 − 2·2.5·φ(2.5)/(2Φ(2.5)−1))）
    expect(sd / 1.2).toBeGreaterThan(0.92);
    expect(sd / 1.2).toBeLessThan(0.97);
  });
});

describe('kiridani2 効果 DSL', () => {
  const base = (effects: CardDef['effects']): CardDef => ({ id: 'x', kind: 'occ', name: 'x', engine: ['gather'], mech: 'boost', effects, text: '' });
  it('知らない op は例外', () => {
    expect(() => validateCard(base([{ when: 'use:forest', do: [{ teleport: 1 } as never] }]))).toThrow(DslError);
  });
  it('知らない when・mod・条件も例外', () => {
    expect(() => validateCard(base([{ when: 'sometimes' as never, do: [{ gain: { wood: 1 } }] }]))).toThrow(DslError);
    expect(() => validateCard(base([{ when: 'passive', mod: { warp: 1 } as never }]))).toThrow(DslError);
    expect(() => validateCard(base([{ when: 'win', if: { moon: true } as never, do: [{ fame: 1 }] }]))).toThrow(DslError);
    expect(() => validateCard(base([{ when: 'win', do: [{ gain: { gems: 1 } as never }] }]))).toThrow(DslError);
  });
  it('エンジンに渡すカードに知らない op があると読み込みで例外', () => {
    const bad: CardSet = { ...CARD_SET, occupations: [...CARD_SET.occupations, base([{ when: 'round_start', do: [{ summon: 'dragon' } as never] }])] };
    expect(() => loadCards(bad)).toThrow(DslError);
    expect(() => new Game(3, [null, null, null], { cards: bad })).toThrow(DslError);
  });
  it('全カードが読み込める', () => {
    const byId = loadCards(CARD_SET);
    expect(byId.size).toBeGreaterThan(50);
  });
});

describe('kiridani2 名声', () => {
  it('分野表：0は−1、しきい値ごとに1〜4点。年数でしきい値が伸びる', () => {
    expect(tableScore(0, [1, 4, 7, 10])).toBe(-1);
    expect(tableScore(4, [1, 4, 7, 10])).toBe(2);
    expect(tableScore(12, [1, 4, 7, 10])).toBe(4);
    expect(DATA.tableFor(10).kills).toEqual([2, 7, 12, 16]);
    expect(DATA.tableFor(15).kills).toEqual([2, 8, 14, 20]);
    expect(DATA.tableFor(15).races).toEqual([1, 3, 4, 5]);
  });
  it('遺物：同じ種類2つ＝3、3つ＝6、4つ＝9、5種そろい＝6（重複なし）', () => {
    const g = new Game(2, [null, null], { cards: CARD_SET });
    const p = g.players[0];
    const ids = [...g.anc.values()];
    const grp = (k: string) => ids.filter((a) => a.group === k).map((a) => a.id);
    const groups = [...new Set(ids.map((a) => a.group))];
    p.ancient = grp(groups[0]).slice(0, 2);
    expect(ancientScore(g, p)).toBe(3);
    p.ancient = grp(groups[0]).slice(0, 3);
    expect(ancientScore(g, p)).toBe(6);
    p.ancient = grp(groups[0]).slice(0, 4);
    expect(ancientScore(g, p)).toBe(9);
    p.ancient = groups.map((k) => grp(k)[0]);
    expect(ancientScore(g, p)).toBe(6);
    p.ancient = [...groups.map((k) => grp(k)[0]), grp(groups[0])[1]];
    expect(ancientScore(g, p)).toBe(6);
  });
});

describe('kiridani2 試合', () => {
  it('段階カードの予定：段階1は R2〜R4、段階2〜5は残りに16枚', () => {
    for (const years of [5, 10, 15]) {
      const g = new Game(3, [null, null, null], { seed: years, years, cards: CARD_SET });
      const rounds = Object.keys(g.stageAt).map(Number).sort((a, b) => a - b);
      expect(rounds.slice(0, 3)).toEqual([2, 3, 4]);
      expect(rounds.length).toBe(3 + 16);
      expect(Math.max(...rounds)).toBeLessThanOrEqual(g.R);
      const stageOf = (r: number) => (g.card(g.stageAt[r]) as StageDef).stage;
      for (let i = 1; i < rounds.length; i++) expect(stageOf(rounds[i])).toBeGreaterThanOrEqual(stageOf(rounds[i - 1]));
    }
  });

  it('同じ種なら同じ試合（出来事も名声も一致）', () => {
    const run = () => {
      const s = new Kiridani2Session({ n: 3, years: 5, seed: 11, human: -1, levels: ['novice', 'normal', 'strong'] });
      const ev = s.start();
      return { ev: JSON.stringify(ev), scores: s.scores };
    };
    const a = run(), b = run();
    expect(a.scores).toEqual(b.scores);
    expect(a.ev).toBe(b.ev);
    expect(a.scores.length).toBe(3);
  });

  it('始めの先手は種からくじ（同じ種なら同じ、席0とは限らない）。準備の順・食料の追加・手番もその順', () => {
    for (const n of [2, 3, 4, 5, 6]) {
      const firsts = new Set<number>();
      for (let seed = 1; seed <= 40; seed++) {
        const f = startSeat(seed, n);
        expect(f).toBe(startSeat(seed, n));
        expect(f).toBeGreaterThanOrEqual(0); expect(f).toBeLessThan(n);
        firsts.add(f);
      }
      expect(firsts.size).toBe(n);
    }
    const seed = [...Array(50).keys()].find((s) => startSeat(s, 4) === 2)!;
    const s = new Kiridani2Session({ n: 4, years: 5, seed, human: -1, levels: ['normal', 'normal', 'normal', 'normal'] });
    const ev = s.start();
    expect(ev[1]).toEqual({ t: 'first_player', seat: 2 });
    // リーダーも先手から配る（選ぶのは全員同時）
    expect(ev.filter((e) => e.t === 'leader_offer').map((e) => (e as { seat: number }).seat)).toEqual([2, 3, 0, 1]);
    // 職能の1巡目は先手から
    expect(ev.filter((e) => e.t === 'draft_offer').slice(0, 4).map((e) => (e as { seat: number }).seat)).toEqual([2, 3, 0, 1]);
    // 食料の追加は手番の順（先手が 0）
    const food = ev.filter((e) => e.t === 'grant' && (e as { reason: string }).reason === '開始時').map((e) => [(e as { seat: number }).seat, (e as { gain: { food: number } }).gain.food]);
    expect(Object.fromEntries(food)).toEqual({ 2: DATA.START.food + 0, 3: DATA.START.food + 1, 0: DATA.START.food + 1, 1: DATA.START.food + 2 });
    // 1ラウンド目の先手・最初の手番
    const rs = ev.find((e) => e.t === 'round_start') as { first: number };
    expect(rs.first).toBe(2);
    expect((ev.find((e) => e.t === 'turn') as { seat: number }).seat).toBe(2);
  });

  for (const years of [5, 10, 15]) {
    for (const n of [2, 3, 4]) {
      it(`${years}年・${n}人で AI だけで最後まで`, () => {
        const { g, scores } = aiGame(n, years, years * 7 + n);
        expect(g.errors).toEqual([]);
        expect(g.round).toBe(years * 4);
        expect(g.over).toBe(true);
        scores.forEach((x, i) => { expect(Number.isFinite(x)).toBe(true); expect(x).toBe(score(g, g.players[i])); });
        for (const p of g.players) {
          expect(p.comps.length).toBeGreaterThanOrEqual(2);
          expect(p.comps.length).toBeLessThanOrEqual(DATA.MAX_COMPS);
          for (const r of Object.values(p.res)) expect(r).toBeGreaterThanOrEqual(0);
          expect(p.target.length).toBeGreaterThan(0);
        }
      }, 60000);
    }
  }

  it('人間の席：選択肢から答えて最後まで進み、途中で AI に任せられる', () => {
    const s = new Kiridani2Session({ n: 3, years: 5, seed: 3, human: 0 });
    s.start();
    let steps = 0, checked = false;
    while (!s.done && steps < 60) {
      const w = s.waiting!;
      expect(w.p.pid).toBe(0);
      if (w.k === 'choose' && !checked) { expect(() => s.answer({ s: 'nowhere', i: 0 })).toThrow(); checked = true; }
      const a = w.k === 'card' ? w.cards[0] : w.k === 'ratio' || w.k === 'kind' || w.k === 'pick' ? w.options[0] : w.k === 'choose' ? w.opts[w.opts.length - 1] : true;
      s.answer(a);
      steps++;
    }
    expect(checked).toBe(true);
    s.setAuto(0, true, 'normal');
    expect(s.isAuto(0)).toBe(true);
    expect(s.done).toBe(true);
    expect(s.g.errors).toEqual([]);
  }, 60000);
});
