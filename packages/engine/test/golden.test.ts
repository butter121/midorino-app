// Python版エンジン（正）の記録を TypeScript 版で再生し、合法手・各手の結果・ラウンドごとの状態・最終得点が
// 完全に一致することを確かめる。記録は tools/trace_golden.py で作る。
import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  setScoringMode, apply, endRound, legal, newGame, nextActor, scoreBreakdown, startRound, trade,
  type GameState, type Player,
} from '../src/index.js';
import { evaluate, DEFAULT_W } from '../src/ai.js';

const file = new URL('../../../golden/golden.json', import.meta.url);
const games: any[] = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];

const pstate = (p: Player) => ({ ...p, imps: [...p.imps].sort(), once: [...p.once].sort(), yearly: [...p.yearly].sort() });
const gstate = (g: GameState) => ({
  round: g.round, first: g.first, accum: g.accum, occ: g.occ, closed: [...g.closed].sort(), prices: g.prices,
  display: g.display, deck: g.deck, stock: g.stock, players: g.players.map(pstate),
});
const evals = (g: GameState) => g.players.map((p) => evaluate(g, p, DEFAULT_W));
function sameState(g: GameState, rec: any, msg: string) {
  const { evals: ev, ...rest } = rec;
  expect(gstate(g), msg).toEqual(rest);
  evals(g).forEach((v, k) => expect(v, `${msg} 評価値P${k}`).toBeCloseTo(ev[k], 5));
}

setScoringMode('legacy');   // Python 版の得点計算（豚・牛の取り違えあり）で比較する

describe('Python版との完全一致', () => {
  it('記録がある', () => expect(games.length).toBeGreaterThan(0));
  games.forEach((rec, gi) => {
    it(`ゲーム${gi}（${rec.setup.n}人）`, () => {
      const { setup, events } = rec;
      const g = newGame({ n: setup.n, chars: setup.chars, weather: setup.weather, deck: [...setup.deck, ...[...setup.display].reverse()] });
      expect(g.display).toEqual(setup.display);
      sameState(g, setup.init, '初期状態');
      let i = 0;
      for (let r = 1; r <= 12; r++) {
        g.round = r;
        startRound(g);
        expect(events[i].t).toBe('start');
        sameState(g, events[i++].state, `R${r} 開始`);
        let last: number | null = null;
        for (;;) {
          const pid = nextActor(g, last);
          if (pid === null) break;
          const p = g.players[pid];
          while (events[i].t === 'trade') {
            const e = events[i++];
            expect(e.a).toBe(pid);
            trade(g, g.players[e.a], g.players[e.b], e.give, e.get);
            expect(pstate(g.players[e.a])).toEqual(e.pa);
            expect(pstate(g.players[e.b])).toEqual(e.pb);
          }
          const e = events[i++];
          expect(e.t).toBe('move');
          expect(e.pid, `R${r} 手番`).toBe(pid);
          expect(legal(g, p), `R${r} P${pid} 合法手`).toEqual(e.legal);
          apply(g, p, e.sid, e.opt);
          expect(pstate(p), `R${r} P${pid} ${e.sid}`).toEqual(e.after);   // 記録は avail を減らす前
          p.avail -= 1;
          expect(g.prices).toEqual(e.prices);
          expect(g.display).toEqual(e.display);
          expect(g.stock).toEqual(e.stock);
          last = pid;
        }
        endRound(g);
        expect(events[i].t).toBe('end');
        sameState(g, events[i++].state, `R${r} 終了`);
      }
      expect(i).toBe(events.length);
      expect(g.players.map(scoreBreakdown)).toEqual(rec.final);
      expect(g.errors).toEqual(rec.errors);
    });
  });
});
