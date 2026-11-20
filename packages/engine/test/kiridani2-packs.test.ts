// 霧谷 v2：準備のドラフト（リーダーは戦闘1枚・探索1枚、職能・品物は5枚×6束を回す）
import { describe, expect, it } from 'vitest';
import { AI, CARD_SET, DATA, drive, Game, Kiridani2Session, type GameEvent } from '../src/kiridani2/index';

const run = (n: number, seed: number, years = 5) => {
  const s = new Kiridani2Session({ n, years, seed, human: -1, levels: Array(n).fill('normal') });
  const ev: GameEvent[] = [...s.start()];
  return { s, ev };
};
type Offer = Extract<GameEvent, { t: 'draft_offer' }>;
const role = (id: string) => CARD_SET.leaders.find((c) => c.id === id)?.role;

describe('kiridani2 準備のドラフト', () => {
  for (const n of [2, 3, 4, 5, 6]) {
    it(`${n}人：リーダーは戦闘1枚・探索1枚、誰とも重ならない`, () => {
      const { ev } = run(n, 7);
      const offers = ev.filter((e): e is Extract<GameEvent, { t: 'leader_offer' }> => e.t === 'leader_offer');
      expect(offers.length).toBe(n);
      for (const o of offers) expect(o.cards.map(role).sort()).toEqual(['explore', 'fight']);
      const all = offers.flatMap((o) => o.cards);
      expect(new Set(all).size).toBe(all.length);
    });

    it(`${n}人：職能は3周とも、自分が持ったことのない束から。まだ取られていない束を先に渡す`, () => {
      for (const seed of [1, 2, 3]) {
        const { ev } = run(n, seed);
        const occ = ev.filter((e): e is Offer => e.t === 'draft_offer' && e.kind === 'occ').slice(0, 3 * n);
        expect(occ.length).toBe(3 * n);
        const seen = new Map<number, string[][]>();
        occ.forEach((o) => {
          const prev = seen.get(o.seat) ?? [];
          // 束のカードは前に見た束の一部ではない（同じ束を2度持たない）
          for (const q of prev) expect(o.cards.every((c) => q.includes(c))).toBe(false);
          seen.set(o.seat, [...prev, o.cards]);
        });
        // 取られていない束が残っている間は5枚の束が渡る：使った束の数 = min(6, 周ごとの人数の合計)
        const fives = occ.filter((o) => o.cards.length === DATA.PACK_SIZE).length;
        expect(fives).toBe(Math.min(DATA.PACKS, 3 * n));
      }
    });
  }

  it('年の途中では職能は足さず、品物2枚を全員同時に選ぶ（5年なら3年目の春）', () => {
    const n = 3;
    const g = new Game(n, Array.from({ length: n }, (_, i) => new AI('normal', { seed: i })), { seed: 4, years: 5, cards: CARD_SET });
    const ev: GameEvent[] = [];
    g.E = ev;
    drive(g.play());
    const offers = ev.filter((e): e is Offer => e.t === 'draft_offer');
    expect(offers.filter((o) => o.kind === 'occ').length).toBe(3 * n);
    const rs = ev.findIndex((e) => e.t === 'round_start' && e.year === DATA.REFILL_YEARS[5][0] && e.season === 'spring');
    const later = ev.slice(rs).filter((e): e is Offer => e.t === 'draft_offer');
    expect(later.length).toBe(2 * n);
    expect(later.every((o) => o.kind !== 'occ')).toBe(true);
  });
});
