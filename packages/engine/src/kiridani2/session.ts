// 霧谷の冒険者団 v2 — 1試合を進める役（人間の席＋AI の席）。v1 の KiridaniSession と同じ形。
// start() / answer() は「次に人間が選ぶ場面」か試合の終わりまで進め、その間に起きた出来事（GameEvent）を返す。
// 画面は出来事を順に再生し、waiting（いま人間に聞いていること）を見て選択肢を出す。
import { AI, type Level } from './ai';
import { CARD_SET } from './cards';
import { canPay, Game, sameOpt, type Gen, type Option, type Player, type Req } from './engine';
import type { CardSet, Cost, GameEvent, Res } from './types';
import { RES } from './types';
import * as D from './data';

export interface SessionOptions {
  n: number;
  /** 5・10・15 年（既定 5） */
  years?: number;
  seed?: number;
  /** 人間の席（−1 なら AI だけで最後まで） */
  human?: number;
  /** 人間の席が複数のとき（オンライン対戦）。指定すると human より優先 */
  humans?: number[];
  /** 席ごとの AI の腕前（人間の席は無視） */
  levels?: Level[];
  names?: string[];
  /** カード一式（既定は cards/ の全カード） */
  cards?: CardSet;
}

export interface TradeJudge { ok: boolean; accept: boolean; error?: string; human?: boolean }

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
/** 戦闘の後押しの選び（文字列の並び・多すぎない）。形が違えば undefined */
export function cleanUse(u: unknown): string[] | undefined {
  if (!Array.isArray(u) || u.length > 16 || !u.every((x) => typeof x === 'string' && x.length <= 40)) return undefined;
  return [...u];
}

export class Kiridani2Session {
  readonly g: Game;
  readonly human: number;
  readonly humans: number[];
  readonly seed: number;
  private gen: Gen<number[]>;
  waiting: Req | null = null;
  done = false;
  scores: number[] = [];
  private started = false;

  constructor(o: SessionOptions) {
    this.seed = o.seed ?? 1;
    this.humans = o.humans ? [...o.humans] : (o.human ?? 0) >= 0 ? [o.human ?? 0] : [];
    this.human = this.humans[0] ?? -1;
    const levels = o.levels ?? Array(o.n).fill('normal');
    const ais = Array.from({ length: o.n }, (_, i) => (this.humans.includes(i) ? null : new AI(levels[i] ?? 'normal', { seed: this.seed * 100 + i })));
    const names = o.names ?? Array.from({ length: o.n }, (_, i) => (i === this.human ? 'あなた' : this.humans.includes(i) ? `P${i + 1}` : `AI${i + 1}`));
    this.g = new Game(o.n, ais, { seed: this.seed, years: o.years ?? 5, cards: o.cards ?? CARD_SET, events: { me: this.human, names } });
    this.gen = this.g.play();
  }

  /** いま選んでいる人間の席（待っていなければ最初の人間の席） */
  get player(): Player | null { return this.waiting?.p ?? this.g.players[this.human] ?? null; }
  /** いま選ぶ番の席（−1 なら誰も選んでいない） */
  get seat(): number { return this.waiting?.p.pid ?? -1; }

  private run(answer?: unknown): GameEvent[] {
    if (this.done) return [];
    const r = this.started ? this.gen.next(answer) : this.gen.next();
    this.started = true;
    if (r.done) { this.done = true; this.waiting = null; this.scores = r.value; } else this.waiting = r.value;
    return this.g.E!.splice(0);
  }

  /** 最初の選択まで進める */
  start(): GameEvent[] { return this.run(); }

  /** 人間の答えを渡し、次の選択まで進める。答えは waiting の選択肢の中のもの（同じ形の値でもよい） */
  answer(a: unknown): GameEvent[] {
    const w = this.waiting;
    if (!w) throw new Error('nothing to answer');
    switch (w.k) {
      case 'card': if (!w.cards.includes(a as string)) throw new Error('bad card'); break;
      case 'ratio': { const m = w.options.find((x) => same(x, a)); if (!m) throw new Error('bad ratio'); a = m; break; }
      case 'kind': if (!w.options.includes(a as never)) throw new Error('bad kind'); break;
      case 'pick': { const m = w.options.find((x) => same(x, a)); if (m === undefined) throw new Error('bad pick'); a = m; break; }
      case 'choose': {
        const m = w.opts.find((x) => sameOpt(x, a as Option));
        if (!m) throw new Error('bad option');
        // 戦闘の後押しを自分で選んだとき（巣・主の巣だけ。待ち伏せは戦うときに決める）
        const use = cleanUse((a as Option).use);
        a = use && m.k && m.mode !== 'wait' && m.i >= 0 ? { ...m, use } : m;
        break;
      }
      case 'heal': case 'effect': a = !!a; break;
    }
    return this.run(a);
  }
  /** answer の別名 */
  respond(a: unknown): GameEvent[] { return this.answer(a); }

  // ---------------------------------------------------------- 取引（v1 と同じ：自分の手番に、各ラウンド1回＋カードの分）
  tradeLeft(): number {
    const p = this.player;
    if (!p || !this.waiting || this.waiting.k !== 'choose') return 0;
    return Math.max(0, this.g.tradeLimit(p) - p.tradesUsed);
  }
  tradePartners(): number[] {
    const me = this.player?.pid ?? this.human;
    return this.g.players.filter((o) => o.pid !== me && ((o.ai instanceof AI && o.ai.trade_on) || this.isHuman(o.pid))).map((o) => o.pid);
  }
  isHuman(seat: number): boolean { return this.humans.includes(seat) && !this.g.players[seat]?.ai; }

  judgeTrade(b: number, give: Cost, get: Cost): TradeJudge {
    const p = this.player;
    const fail = (error: string): TradeJudge => ({ ok: false, accept: false, error });
    if (!p || !this.waiting || this.waiting.k !== 'choose') return fail('あなたの番に持ちかけられる');
    if (this.tradeLeft() <= 0) return fail('このラウンドの取引は終わり');
    const o = this.g.players[b];
    if (!o) return fail('相手がいない');
    for (const r of Object.keys(give)) if (!RES.includes(r as Res) || (get as Record<string, number>)[r]) return fail('同じ資源を渡して受け取ることはできない');
    const err = this.g.tradeOk(p, o, give, get);
    if (err) return fail(err);
    if (this.isHuman(b)) return { ok: true, accept: true, human: true };
    if (!(o.ai instanceof AI) || !o.ai.trade_on) return fail('この相手は取引しない');
    return { ok: true, accept: o.ai.judgeOffer(this.g, o, give, get) };
  }

  /** AI と取引する（相手が受けたときだけ。置き場所の選択は続く） */
  trade(b: number, give: Cost, get: Cost): GameEvent[] {
    const j = this.judgeTrade(b, give, get);
    if (!j.ok) throw new Error(j.error);
    if (j.human) throw new Error('人との取引は申し込んで、相手が受けたときに成立する');
    if (!j.accept) throw new Error('相手が断った');
    return this.applyTrade(b, give, get);
  }
  /** 人どうしの取引（相手の人が受けたあと。審判が呼ぶ） */
  tradeHuman(b: number, give: Cost, get: Cost): GameEvent[] {
    if (!this.isHuman(b)) throw new Error('相手が人ではない');
    const j = this.judgeTrade(b, give, get);
    if (!j.ok) throw new Error(j.error);
    return this.applyTrade(b, give, get);
  }
  private applyTrade(b: number, give: Cost, get: Cost): GameEvent[] {
    const w = this.waiting as Extract<Req, { k: 'choose' }>;
    this.g.trade(w.p, this.g.players[b], give, get);
    this.waiting = { ...w, opts: this.g.legal(w.p, w.opts.some((o) => o.s === '@spell')) };
    return this.g.E!.splice(0);
  }

  /** 人間の席を AI に任せる／人に戻す（退室中の代行）。いま聞いている途中なら AI がすぐ答えて次へ進める */
  setAuto(seat: number, on: boolean, level: Level = 'novice'): GameEvent[] {
    const p = this.g.players[seat];
    if (!p || !this.humans.includes(seat) || on === !!p.ai) return [];
    if (!on) { p.ai = null; return []; }
    const ai = new AI(level, { seed: (this.seed * 100 + seat) * 7 + 3 });
    p.ai = ai;
    if (this.done || !this.waiting || this.waiting.p.pid !== seat) return [];
    return this.run(ai.respond(this.waiting));
  }
  isAuto(seat: number): boolean { return this.humans.includes(seat) && !!this.g.players[seat]?.ai; }

  /** 人間の席も AI と同じ考えで答えて最後まで（テスト・お任せ用） */
  autoplay(level: Level = 'normal'): GameEvent[] {
    const helper = new AI(level, { seed: 7 });
    const out: GameEvent[] = [...(this.started ? [] : this.start())];
    while (!this.done) out.push(...this.answer(helper.respond(this.waiting!)));
    return out;
  }
}

/** 交換所の値段（この人から見た売値・買値と、1回で動かせる数） */
export function marketQuote(g: Game, p: Player): { sell: Partial<Record<Res, number>>; buy: Partial<Record<Res, number>>; qty: number; both: boolean } {
  const sell: Partial<Record<Res, number>> = {}, buy: Partial<Record<Res, number>> = {};
  for (const r of RES) if (r !== 'gold') { sell[r] = g.sellPrice(p, r); buy[r] = D.BUY[r]; }
  return { sell, buy, qty: g.marketQty(p), both: g.mods(p).market_both };
}

export { canPay };
