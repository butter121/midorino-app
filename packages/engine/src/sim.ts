// AI 同士で1ゲームを最後まで進める（1人練習・代打ち・動作確認用）
import { AI, makeRng, TUNED_W, type Level } from './ai.js';
import { DEV_IDS, NUM_ROUNDS, SEASONS, WEATHER, CHARACTER_IDS } from './data.js';
import { apply, endRound, legal, newGame, nextActor, score, startRound, type GameState, type Setup } from './engine.js';

/** 乱数から新しいゲームの初期設定（天候12枚・山札・キャラクター）を作る */
export function randomSetup(n: number, seed: number, chars?: string[]): Setup {
  const rng = makeRng(seed);
  const decks = Object.fromEntries(SEASONS.map((s) => [s, rng.shuffle(WEATHER[s])]));
  const weather = Array.from({ length: NUM_ROUNDS }, (_, r) => decks[SEASONS[r % 4]][Math.floor(r / 4)].id);
  return { n, chars: chars ?? rng.shuffle(CHARACTER_IDS).slice(0, n), weather, deck: rng.shuffle(DEV_IDS) };
}

export function playAIGame(setup: Setup, levels: Level[], seed = 1): { g: GameState; scores: number[] } {
  const g = newGame(setup);
  const ais = levels.map((lv, i) => new AI(lv, TUNED_W, seed * 100 + i));
  for (let r = 1; r <= NUM_ROUNDS; r++) {
    g.round = r;
    startRound(g);
    let last: number | null = null;
    for (let pid = nextActor(g, last); pid !== null; pid = nextActor(g, last)) {
      const p = g.players[pid];
      ais[pid].tradePhase(g, p, ais);
      const opts = legal(g, p);
      if (!opts.length) { g.errors.push(`R${r} P${pid}: 置ける場所がない`); p.avail -= 1; last = pid; continue; }
      const [sid, opt] = ais[pid].choose(g, p, opts);
      apply(g, p, sid, opt);
      p.avail -= 1;
      last = pid;
    }
    endRound(g);
  }
  return { g, scores: g.players.map(score) };
}
