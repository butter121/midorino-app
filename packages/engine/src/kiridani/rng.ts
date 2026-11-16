// 霧谷の冒険者団：Python 版と同じ列を出す乱数（mulberry32）。
// tools/kiridani/prng.py と1行ずつ同じ手順（shuffle・sample・choice・randrange・gauss）。
export class MRandom {
  private a = 0;
  private gaussNext: number | null = null;

  constructor(seed = 0) { this.seed(seed); }

  seed(seed = 0) { this.a = seed >>> 0; this.gaussNext = null; }

  random(): number {
    this.a = (this.a + 0x6d2b79f5) >>> 0;
    let t = this.a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  randbelow(n: number): number { return Math.floor(this.random() * n); }
  randrange(n: number): number { return this.randbelow(n); }
  choice<T>(seq: readonly T[]): T { return seq[this.randbelow(seq.length)]; }

  shuffle<T>(x: T[]): void {
    for (let i = x.length - 1; i >= 1; i--) {
      const j = this.randbelow(i + 1);
      const t = x[i]; x[i] = x[j]; x[j] = t;
    }
  }

  sample<T>(population: readonly T[], k: number): T[] {
    const pool = [...population];
    const n = pool.length;
    if (k > n) throw new Error('sample larger than population');
    const res: T[] = [];
    for (let i = 0; i < k; i++) {
      const j = this.randbelow(n - i);
      res.push(pool[j]);
      pool[j] = pool[n - i - 1];
    }
    return res;
  }

  gauss(mu = 0, sigma = 1): number {
    let z = this.gaussNext;
    this.gaussNext = null;
    if (z === null) {
      const x2pi = this.random() * 2 * Math.PI;
      const g2rad = Math.sqrt(-2.0 * Math.log(1.0 - this.random()));
      z = Math.cos(x2pi) * g2rad;
      this.gaussNext = Math.sin(x2pi) * g2rad;
    }
    return mu + z * sigma;
  }
}

/** Python 3.12+ の sum()（小数は Neumaier の補正つき）。中身がすべて小数のときに使う */
export function pysumF(xs: readonly number[]): number {
  if (!xs.length) return 0;
  let f = xs[0];
  let c = 0;
  for (let i = 1; i < xs.length; i++) {
    const x = xs[i];
    const t = f + x;
    if (Math.abs(f) >= Math.abs(x)) c += (f - t) + x; else c += (x - t) + f;
    f = t;
  }
  return c !== 0 && Number.isFinite(c) ? f + c : f;
}

// ---- erf（fdlibm s_erf.c。glibc も同じ係数） ----
const erx = 8.45062911510467529297e-01, efx = 1.28379167095512586316e-01, efx8 = 1.02703333676410069053e+00;
const pp0 = 1.28379167095512558561e-01, pp1 = -3.25042107247001499370e-01, pp2 = -2.84817495755985104766e-02, pp3 = -5.77027029648944159157e-03, pp4 = -2.37630166566501626084e-05;
const qq1 = 3.97917223959155352819e-01, qq2 = 6.50222499887672944485e-02, qq3 = 5.08130628187576562776e-03, qq4 = 1.32494738004321644526e-04, qq5 = -3.96022827877536812320e-06;
const pa0 = -2.36211856075265944077e-03, pa1 = 4.14856118683748331666e-01, pa2 = -3.72207876035701323847e-01, pa3 = 3.18346619901161753674e-01, pa4 = -1.10894694282396677476e-01, pa5 = 3.54783043256182359371e-02, pa6 = -2.16637559486879084300e-03;
const qa1 = 1.06420880400844228286e-01, qa2 = 5.40397917702171048937e-01, qa3 = 7.18286544141962662868e-02, qa4 = 1.26171219808761642112e-01, qa5 = 1.36370839120290507362e-02, qa6 = 1.19844998467991074170e-02;
const ra0 = -9.86494403484714822705e-03, ra1 = -6.93858572707181764372e-01, ra2 = -1.05586262253232909814e+01, ra3 = -6.23753324503260060396e+01, ra4 = -1.62396669462573470355e+02, ra5 = -1.84605092906711035994e+02, ra6 = -8.12874355063065934246e+01, ra7 = -9.81432934416914548592e+00;
const sa1 = 1.96512716674392571292e+01, sa2 = 1.37657754143519042600e+02, sa3 = 4.34565877475229228821e+02, sa4 = 6.45387271733267880336e+02, sa5 = 4.29008140027567833386e+02, sa6 = 1.08635005541779435134e+02, sa7 = 6.57024977031928170135e+00, sa8 = -6.04244152148580987438e-02;
const rb0 = -9.86494292470009928597e-03, rb1 = -7.99283237680523006574e-01, rb2 = -1.77579549177547519889e+01, rb3 = -1.60636384855821916062e+02, rb4 = -6.37566443368389627722e+02, rb5 = -1.02509513161107724954e+03, rb6 = -4.83519191608651397019e+02;
const sb1 = 3.03380607434824582924e+01, sb2 = 3.25792512996573918826e+02, sb3 = 1.53672958608443695994e+03, sb4 = 3.19985821950859553908e+03, sb5 = 2.55305040643316442583e+03, sb6 = 4.74528541206955367215e+02, sb7 = -2.24409524465858183362e+01;

const f64 = new Float64Array(1);
const u32 = new Uint32Array(f64.buffer);
const HI = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1 ? 1 : 0; // little endian → 上位語は [1]

export function erf(x: number): number {
  if (Number.isNaN(x)) return x;
  f64[0] = x;
  const hx = u32[HI] | 0;
  const ix = hx & 0x7fffffff;
  if (ix >= 0x7ff00000) return x > 0 ? 1 : -1;
  if (ix < 0x3feb0000) {
    if (ix < 0x3e300000) {
      if (ix < 0x00800000) return 0.125 * (8.0 * x + efx8 * x);
      return x + efx * x;
    }
    const z = x * x;
    const r = pp0 + z * (pp1 + z * (pp2 + z * (pp3 + z * pp4)));
    const s = 1 + z * (qq1 + z * (qq2 + z * (qq3 + z * (qq4 + z * qq5))));
    return x + x * (r / s);
  }
  if (ix < 0x3ff40000) {
    const s = Math.abs(x) - 1;
    const P = pa0 + s * (pa1 + s * (pa2 + s * (pa3 + s * (pa4 + s * (pa5 + s * pa6)))));
    const Q = 1 + s * (qa1 + s * (qa2 + s * (qa3 + s * (qa4 + s * (qa5 + s * qa6)))));
    return hx >= 0 ? erx + P / Q : -erx - P / Q;
  }
  if (ix >= 0x40180000) return hx >= 0 ? 1 - 1e-300 : 1e-300 - 1;
  const ax = Math.abs(x);
  const s = 1 / (ax * ax);
  let R: number, S: number;
  if (ix < 0x4006db6e) {
    R = ra0 + s * (ra1 + s * (ra2 + s * (ra3 + s * (ra4 + s * (ra5 + s * (ra6 + s * ra7))))));
    S = 1 + s * (sa1 + s * (sa2 + s * (sa3 + s * (sa4 + s * (sa5 + s * (sa6 + s * (sa7 + s * sa8)))))));
  } else {
    R = rb0 + s * (rb1 + s * (rb2 + s * (rb3 + s * (rb4 + s * (rb5 + s * rb6)))));
    S = 1 + s * (sb1 + s * (sb2 + s * (sb3 + s * (sb4 + s * (sb5 + s * (sb6 + s * sb7))))));
  }
  f64[0] = ax; u32[1 - HI] = 0;
  const z = f64[0];
  const r = Math.exp(-z * z - 0.5625) * Math.exp((z - ax) * (z + ax) + R / S);
  return hx >= 0 ? 1 - r / ax : r / ax - 1;
}
