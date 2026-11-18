// 霧谷の冒険者団 v2 — 乱数（v1 と同じ mulberry32）。正規分布は Box–Muller、±2.5σ を超えたら引き直す。
export class Rng {
  private a = 0;

  constructor(seed = 0) { this.seed(seed); }

  seed(seed = 0) { this.a = seed >>> 0; }
  /** 状態（複製・保存用） */
  get state() { return this.a; }
  set state(v: number) { this.a = v >>> 0; }

  random(): number {
    this.a = (this.a + 0x6d2b79f5) >>> 0;
    let t = this.a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(n: number): number { return Math.floor(this.random() * n); }
  choice<T>(seq: readonly T[]): T { return seq[this.int(seq.length)]; }

  shuffle<T>(x: T[]): T[] {
    for (let i = x.length - 1; i >= 1; i--) {
      const j = this.int(i + 1);
      const t = x[i]; x[i] = x[j]; x[j] = t;
    }
    return x;
  }

  sample<T>(population: readonly T[], k: number): T[] {
    const pool = [...population];
    const n = pool.length;
    if (k > n) throw new Error('sample larger than population');
    const res: T[] = [];
    for (let i = 0; i < k; i++) {
      const j = this.int(n - i);
      res.push(pool[j]);
      pool[j] = pool[n - i - 1];
    }
    return res;
  }

  /** 標準正規（Box–Muller の cos 側だけを使う。キャッシュしないので状態は a だけ） */
  normal(): number {
    const u1 = 1 - this.random();
    const u2 = this.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  /** N(mu, sigma²) を ±clip·σ で切ったもの（超えたら引き直し） */
  truncNormal(mu = 0, sigma = 1, clip = 2.5): number {
    for (;;) {
      const z = this.normal();
      if (Math.abs(z) <= clip) return mu + z * sigma;
    }
  }
}
