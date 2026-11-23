// 霧谷の冒険者団 v2 — AI の評価の重みを、リーダーごとに自己対戦で調整する（進化戦略）。
//
//   npx vite-node tools/kiridani2/tune.ts l_akane            （1人分。結果を JSON で標準出力の最後の行に出す）
//   TUNE_GEN=10 TUNE_POP=8 TUNE_GAMES=12 TUNE_VAL=60 npx vite-node tools/kiridani2/tune.ts l_akane
//
// やり方
// - 重み（ai.ts の W：資源ごとの値打ち・手数・戦力・守り・防壁・手札・依頼・使い魔 など20個）に倍率をかける。倍率は exp(x)。
// - 調べるリーダーを1つの席に固定し、その席の AI だけ倍率を変える。ほかの席は今の重みの AI（リーダーはくじ）。
// - 1つの候補の値打ち＝その席の「名声 − 卓の平均」の平均（3人・5年、同じ世代では同じ種の試合で比べる）。
// - 世代ごとに x のまわりを対にずらした候補を作り（±ε）、順位で重みづけして x を動かす。
// - 最後に、調整した倍率と倍率なし（1倍）を別の種の試合で比べ、よかったときだけ採る。
import { AI, CARD_SET, drive, Game, score } from '../../packages/engine/src/kiridani2/index';
import type { WeightMul } from '../../packages/engine/src/kiridani2/ai_weights';
import { Rng } from '../../packages/engine/src/kiridani2/rng';

const LEADER = process.argv[2];
if (!LEADER || !CARD_SET.leaders.some((c) => c.id === LEADER)) throw new Error(`leader id: ${LEADER}`);
const env = (k: string, d: number) => Number(process.env[k] ?? d);
const GEN = env('TUNE_GEN', 10), POP = env('TUNE_POP', 8), GAMES = env('TUNE_GAMES', 12), VAL = env('TUNE_VAL', 60);
const N = env('TUNE_PLAYERS', 3), YEARS = env('TUNE_YEARS', 5), SIGMA = env('TUNE_SIGMA', 0.35), LR = env('TUNE_LR', 0.6);
const LEVEL = (process.env.TUNE_LEVEL ?? 'strong') as 'strong' | 'normal';

const RES_KEYS = ['wood', 'iron', 'herb', 'mana', 'food', 'gold', 'mat'] as const;
const KEYS = ['act', 'short', 'inj', 'perm', 'defn', 'wall', 'hand', 'played', 'quest', 'tag', 'loop', 'pet', 'ancient'] as const;
const DIM = RES_KEYS.length + KEYS.length;

function toMul(x: number[]): WeightMul {
  const m: WeightMul = { res: {} };
  RES_KEYS.forEach((r, i) => { m.res![r] = Math.exp(x[i]); });
  KEYS.forEach((k, i) => { m[k] = Math.exp(x[RES_KEYS.length + i]); });
  return m;
}

/** その席の「名声 − 卓の平均」の平均 */
function fitness(x: number[] | null, seeds: number[]): number {
  let tot = 0;
  for (const s of seeds) {
    const seat = s % N;
    const ais = Array.from({ length: N }, (_, i) => new AI(LEVEL, { seed: s * 31 + i, ...(i === seat && x ? { wmul: toMul(x), tuned: false } : i === seat ? { tuned: false } : {}) }));
    const leaders = Array.from({ length: N }, (_, i) => (i === seat ? LEADER : null));
    const g = new Game(N, ais, { seed: s, years: YEARS, cards: CARD_SET, leaders });
    const sc = drive(g.play());
    const mean = sc.reduce((a, b) => a + b, 0) / N;
    tot += score(g, g.players[seat]) - mean;
  }
  return tot / seeds.length;
}

const rng = new Rng(Array.from(LEADER).reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0);
let x = new Array(DIM).fill(0);
const t0 = Date.now();
const base0 = fitness(null, Array.from({ length: GAMES }, (_, i) => 900000 + i));
console.error(`${LEADER} start ${base0.toFixed(1)}`);
for (let gen = 0; gen < GEN; gen++) {
  const seeds = Array.from({ length: GAMES }, (_, i) => 1000 * (gen + 1) + i);
  const cands: { eps: number[]; f: number }[] = [];
  for (let k = 0; k < POP / 2; k++) {
    const eps = Array.from({ length: DIM }, () => rng.normal());
    for (const sg of [1, -1]) {
      const e = eps.map((v) => v * sg);
      cands.push({ eps: e, f: fitness(x.map((v, i) => v + SIGMA * e[i]), seeds) });
    }
  }
  // 順位で重みづけ（上から +0.5 … −0.5）
  const order = [...cands].sort((a, b) => b.f - a.f);
  const grad = new Array(DIM).fill(0);
  order.forEach((c, r) => { const u = 0.5 - r / (order.length - 1); for (let i = 0; i < DIM; i++) grad[i] += u * c.eps[i]; });
  x = x.map((v, i) => Math.max(-1.6, Math.min(1.6, v + LR * SIGMA * grad[i] / (POP / 2))));
  console.error(`${LEADER} gen ${gen + 1}/${GEN} best ${order[0].f.toFixed(1)} mean ${(cands.reduce((a, c) => a + c.f, 0) / cands.length).toFixed(1)} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
const vseeds = Array.from({ length: VAL }, (_, i) => 500000 + i);
const fTuned = fitness(x, vseeds), fBase = fitness(null, vseeds);
const keep = fTuned > fBase;
const out = { leader: LEADER, base: fBase, tuned: fTuned, keep, mul: keep ? toMul(x) : null, x, sec: (Date.now() - t0) / 1000 };
console.error(`${LEADER} val base ${fBase.toFixed(1)} tuned ${fTuned.toFixed(1)} keep ${keep}`);
console.log(JSON.stringify(out));
