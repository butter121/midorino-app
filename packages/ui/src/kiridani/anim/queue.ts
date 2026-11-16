// 演出キュー：出来事を順番に1つずつ再生する。
// - 速さは3段階（標準・速い・最小）。途中で変えても次の出来事から効く
// - 1ラウンドの合計が予算（約1分）を超えそうなら、残りの出来事を自動で縮める
// - 演出中の操作は submit() で預かり、キューが空になった瞬間に順に実行する
// - React などには依存しない（時計は差し替え可能：テストでは偽の時計を使う）
import type { GameEvent, Seat } from '../types';
import { ROUND_BUDGET_MS, compress, compressFactor, eventMs, minMs, type Speed } from './timing';

export interface Clock {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(h: unknown): void;
}
const realClock: Clock = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (h) => globalThis.clearTimeout(h as number),
};

export interface QueueOptions {
  me: Seat;
  speed?: Speed;
  budgetMs?: number;
  clock?: Clock;
  /** 出来事の再生を始めるとき（ここで状態を進め、ms の長さの演出を出す） */
  onEvent: (ev: GameEvent, ms: number) => void;
  /** キューが空になったとき */
  onIdle?: () => void;
}

export class AnimQueue {
  private q: GameEvent[] = [];
  private inputs: (() => void)[] = [];
  private timer: unknown = null;
  private spentRound = 0;
  private myCombat = false;
  speed: Speed;
  readonly budget: number;
  /** ラウンドごとに実際に使った時間（テスト・表示用） */
  readonly roundTotals: Record<number, number> = {};
  private round = 0;

  constructor(private opts: QueueOptions) {
    this.speed = opts.speed ?? 'normal';
    this.budget = opts.budgetMs ?? ROUND_BUDGET_MS;
  }

  private get clock() { return this.opts.clock ?? realClock; }
  get busy() { return this.timer !== null || this.q.length > 0; }
  get pending() { return this.q.length; }

  setSpeed(s: Speed) { this.speed = s; }
  setMe(me: Seat) { this.opts.me = me; }

  push(...evs: GameEvent[]) {
    this.q.push(...evs);
    if (this.timer === null) this.next();
  }

  /** 操作を預ける。演出中でなければ今すぐ実行する */
  submit(action: () => void) {
    if (!this.busy) action();
    else this.inputs.push(action);
  }

  /** いまの演出を打ち切って次へ（タップで早送り） */
  skip() {
    if (this.timer === null) return;
    this.clock.clearTimeout(this.timer);
    this.timer = null;
    this.next();
  }

  /** 残りを全部すぐに当てる（演出なし） */
  flush() {
    if (this.timer !== null) { this.clock.clearTimeout(this.timer); this.timer = null; }
    while (this.q.length) this.opts.onEvent(this.q.shift()!, 0);
    this.drainInputs();
  }

  clear() {
    if (this.timer !== null) this.clock.clearTimeout(this.timer);
    this.timer = null; this.q = []; this.inputs = [];
  }

  /** ある出来事の、いまの設定での長さ（縮める前） */
  rawMs(ev: GameEvent) {
    return eventMs(ev, this.speed, this.opts.me, this.myCombat);
  }

  /** 次の出来事を何ミリ秒で見せるか（予算による圧縮込み） */
  plannedMs(ev: GameEvent): number {
    const ms = this.rawMs(ev);
    const rest: { ms: number; min: number }[] = [];
    for (const e of [ev, ...this.q]) {
      if (e !== ev && e.t === 'round_start') break;
      rest.push({ ms: this.rawMs(e), min: minMs(e.t) });
    }
    const f = compressFactor(this.spentRound, rest, this.budget);
    return compress(ms, minMs(ev.t), f);
  }

  private next() {
    this.timer = null;
    const ev = this.q.shift();
    if (!ev) { this.drainInputs(); return; }
    if (ev.t === 'round_start') { this.spentRound = 0; this.round = ev.round; }
    if (ev.t === 'combat_start') this.myCombat = ev.seats.includes(this.opts.me);
    const ms = this.plannedMs(ev);
    if (ev.t === 'combat_end') this.myCombat = false;
    this.spentRound += ms;
    this.roundTotals[this.round] = (this.roundTotals[this.round] ?? 0) + ms;
    this.opts.onEvent(ev, ms);
    if (ms <= 0) { this.next(); return; }
    this.timer = this.clock.setTimeout(() => this.next(), ms);
  }

  private drainInputs() {
    while (this.inputs.length && !this.busy) this.inputs.shift()!();
    if (!this.busy) this.opts.onIdle?.();
  }
}
