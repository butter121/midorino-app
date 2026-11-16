// カタログ用の見本の局面：AI同士で途中まで進めた本物の状態
import { AI, TUNED_W, apply, legal, newGame, nextActor, randomSetup, startRound, endRound, type GameState } from '@midorino/engine';

export function sampleGame(n: number, round: number, placements: number, seed = 7) {
  const g: GameState = newGame(randomSetup(n, seed));
  const ais = g.players.map((_, i) => new AI('mid', TUNED_W, seed * 100 + i));
  const by: Record<string, number[]> = {};
  let last: number | null = null;
  for (let r = 1; r <= round; r++) {
    g.round = r; startRound(g); last = null;
    for (const k of Object.keys(by)) delete by[k];
    let count = 0;
    for (let pid = nextActor(g, last); pid !== null; pid = nextActor(g, last)) {
      if (r === round && count === placements) break;
      const p = g.players[pid];
      const opts = legal(g, p);
      const [sid, opt] = ais[pid].choose(g, p, opts);
      apply(g, p, sid, opt); p.avail -= 1; last = pid; count++;
      (by[sid] ??= []).push(pid);
    }
    if (r < round) endRound(g);
  }
  const next = nextActor(g, last);
  return { g, by, turn: next ?? 0 };
}
