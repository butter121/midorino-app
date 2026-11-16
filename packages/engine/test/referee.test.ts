import { describe, expect, it } from 'vitest';
import {
  AI, createMatch, handle, legal, makeRng, viewFor, validateMarket, GOODS,
  type MatchState, type Seat,
} from '../src/index.js';

const humans = (n: number): Seat[] => Array.from({ length: n }, (_, i) => ({ name: `P${i}`, ai: null }));

/** 人間の席を AI の判断で操作して最後まで進める（審判が正しい手を全部通すか） */
function driveAll(m: MatchState, seed: number) {
  const rng = makeRng(seed);
  const brains = m.seats.map((_, i) => new AI('mid', undefined, seed + i));
  m.seats.forEach((s, i) => {
    if (!s.ai && m.phase === 'draft') expect(handle(m, i, { type: 'pickChar', char: m.draft.options[i][0] })).toEqual({ ok: true });
  });
  let guard = 0;
  while (m.phase === 'work') {
    expect(guard++).toBeLessThan(2000);
    const pid = m.turn!;
    const g = m.game!;
    const p = g.players[pid];
    // ときどき取引を提案して、相手（人間）が受ける/断る
    if (rng.next() < 0.3 && p.res.food > 0) {
      const to = (pid + 1) % m.seats.length;
      const r = handle(m, pid, { type: 'proposeTrade', to, give: { food: 1 }, get: { coin: 1 } });
      expect(r.ok).toBe(true);
      if (!m.seats[to].ai) {
        const id = m.offers[0].id;
        expect(viewFor(m, to).offers.map((o) => o.id)).toContain(id);
        expect(handle(m, to, { type: 'respondTrade', id, accept: rng.next() < 0.5 }).ok).toBe(true);
      }
    }
    // ときどき自由な市場の手（全部売る）
    if (rng.next() < 0.1 && legal(g, p).some(([s]) => s === 'market')) {
      const sells = GOODS.filter((gd) => p.res[gd] > 0).map((gd) => [gd, p.res[gd]] as [typeof gd, number]);
      if (sells.length && !validateMarket(g, pid, [sells, []])) {
        expect(handle(m, pid, { type: 'place', sid: 'market', opt: [sells, []] })).toEqual({ ok: true });
        continue;
      }
    }
    const [sid, opt] = brains[pid].choose(g, p, legal(g, p));
    expect(handle(m, pid, { type: 'place', sid, opt })).toEqual({ ok: true });
  }
}

describe('審判', () => {
  for (const n of [3, 4, 5, 6]) {
    it(`${n}人（全員人間）で最後まで進む`, () => {
      const m = createMatch(humans(n), 1234 + n);
      expect(m.phase).toBe('draft');
      driveAll(m, n);
      expect(m.phase).toBe('over');
      expect(m.game!.errors).toEqual([]);
      expect(m.result!.ranking).toHaveLength(n);
      // JSON で保存して戻せる
      expect(JSON.parse(JSON.stringify(m))).toEqual(m);
    });
  }

  it('人間2人＋AI2人で進む', () => {
    const seats: Seat[] = [{ name: 'K', ai: null }, { name: 'A', ai: 'expert' }, { name: 'B', ai: null }, { name: 'C', ai: 'mid' }];
    const m = createMatch(seats, 99);
    driveAll(m, 7);
    expect(m.phase).toBe('over');
    expect(m.game!.errors).toEqual([]);
  });

  it('不正な操作は通らない', () => {
    const m = createMatch(humans(3), 5);
    m.seats.forEach((_, i) => handle(m, i, { type: 'pickChar', char: m.draft.options[i][1] }));
    const turn = m.turn!;
    const other = (turn + 1) % 3;
    expect(handle(m, other, { type: 'place', sid: 'forest', opt: null }).ok).toBe(false);          // 手番でない
    expect(handle(m, turn, { type: 'place', sid: 'cattle', opt: null }).ok).toBe(false);           // まだ出ていない
    expect(handle(m, turn, { type: 'place', sid: 'build', opt: 3 }).ok).toBe(false);               // 資材不足
    expect(handle(m, turn, { type: 'place', sid: 'market', opt: [[['cattle', 5]], []] }).ok).toBe(false); // 持っていない
    expect(handle(m, turn, { type: 'place', sid: 'market', opt: [[], [['stone', 9]]] }).ok).toBe(false);  // 個数・コイン
    expect(handle(m, turn, { type: 'proposeTrade', to: other, give: { food: 99 }, get: {} }).ok).toBe(false);
    expect(handle(m, turn, { type: 'proposeTrade', to: other, give: { food: -1 } as any, get: {} }).ok).toBe(false);
    expect(handle(m, turn, { type: 'pickChar', char: 'toma' }).ok).toBe(false);
    expect(handle(m, turn, { type: 'place', sid: 'forest', opt: null })).toEqual({ ok: true });
    expect(viewFor(m, other).placements.forest).toEqual([turn]);
    expect(handle(m, turn, { type: 'place', sid: 'claypit', opt: null }).ok).toBe(false);          // 連続で置けない
  });

  it('隠し情報は見えない', () => {
    const m = createMatch(humans(4), 77);
    const v0 = viewFor(m, 0);
    expect(v0.draft!.options).toEqual(m.draft.options[0]);
    expect(JSON.stringify(v0)).not.toContain(JSON.stringify(m.draft.options[1]));
    m.seats.forEach((_, i) => handle(m, i, { type: 'pickChar', char: m.draft.options[i][0] }));
    for (let pid = 0; pid < 4; pid++) {
      const v = viewFor(m, pid);
      const until = m.game!.players[pid].char === 'yuki' ? 3 : 2;
      expect(v.game!.weather.filter((w) => w !== null)).toHaveLength(until);
      expect(v.game!.weather.slice(until).every((w) => w === null)).toBe(true);
      expect(v.game).not.toHaveProperty('deck');
      expect(v.game!.deckCount).toBe(m.game!.deck.length);
    }
  });
});
