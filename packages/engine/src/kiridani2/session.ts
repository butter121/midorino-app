// 霧谷の冒険者団 v2 — 1試合を進める役（人間の席＋AI の席）。v1 の KiridaniSession と同じ形。
// start() / answer() は「次に人間が選ぶ場面」か試合の終わりまで進め、その間に起きた出来事（GameEvent）を返す。
// 画面は出来事を順に再生し、waiting（いま人間に聞いていること）を見て選択肢を出す。
import { AI, type Level } from './ai';
import { CARD_SET } from './cards';
import { canPay, Game, sameOpt, slotOf, type Gen, type Option, type Player, type Req } from './engine';
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
  /** 準備段階の選択を人どうし同時に聞く（オンライン対戦の審判） */
  parallel?: boolean;
}

export interface TradeJudge { ok: boolean; accept: boolean; error?: string; human?: boolean }

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
/** 戦闘の後押しの選び（文字列の並び・多すぎない）。形が違えば undefined */
export function cleanUse(u: unknown): string[] | undefined {
  if (!Array.isArray(u) || u.length > 16 || !u.every((x) => typeof x === 'string' && x.length <= 40)) return undefined;
  return [...u];
}

/** 動かす仲間の選び（仲間の番号の並び・多すぎない）。形が違えば undefined */
export function cleanWho(u: unknown): number[] | undefined {
  if (!Array.isArray(u) || !u.length || u.length > 8 || !u.every((x) => Number.isInteger(x) && x >= 0 && x < 16)) return undefined;
  return [...u];
}

/** 試合に渡したもの（止まったときに最初から当て直すための記録） */
type Input =
  | { k: 'answer'; a: unknown }
  | { k: 'trade'; b: number; give: Cost; get: Cost }
  | { k: 'equip'; c: number; slot: 'weapon' | 'armor'; id: string | null }
  | { k: 'auto'; seat: number; on: boolean; level: Level }
  | { k: 'seat'; seat: number; a: unknown };

export class Kiridani2Session {
  /** 盤面（エンジンが例外を出したときは、最後の正しい場面まで当て直した新しい盤面に入れ替わる） */
  g: Game;
  readonly human: number;
  readonly humans: number[];
  readonly seed: number;
  private gen: Gen<number[]>;
  waiting: Req | null = null;
  done = false;
  scores: number[] = [];
  private started = false;
  private readonly o: SessionOptions;
  private readonly inputs: Input[] = [];

  constructor(o: SessionOptions) {
    this.o = o;
    this.seed = o.seed ?? 1;
    this.humans = o.humans ? [...o.humans] : (o.human ?? 0) >= 0 ? [o.human ?? 0] : [];
    this.human = this.humans[0] ?? -1;
    const levels = o.levels ?? Array(o.n).fill('normal');
    const ais = Array.from({ length: o.n }, (_, i) => (this.humans.includes(i) ? null : new AI(levels[i] ?? 'normal', { seed: this.seed * 100 + i })));
    const names = o.names ?? Array.from({ length: o.n }, (_, i) => (i === this.human ? 'あなた' : this.humans.includes(i) ? `P${i + 1}` : `AI${i + 1}`));
    this.g = new Game(o.n, ais, { seed: this.seed, years: o.years ?? 5, cards: o.cards ?? CARD_SET, events: { me: this.human, names } });
    this.g.parallelAsk = !!o.parallel;
    this.gen = this.g.play();
  }

  /** 同時の問い（multi）で、もう答えた席の答え */
  private partial = new Map<number, unknown>();
  /** この席にいま聞いていること（同時の問いなら、その席の分でまだ答えていないもの） */
  waitingOf(seat: number): Req | null {
    const w = this.waiting;
    if (!w) return null;
    if (w.k === 'multi') return this.partial.has(seat) ? null : w.reqs.find((r) => r.p.pid === seat) ?? null;
    return w.p.pid === seat ? w : null;
  }
  /** 席を指定して答える（同時の問いなら、全員そろったときに進む。そろうまでは出来事なし） */
  answerSeat(seat: number, a: unknown): GameEvent[] {
    const w = this.waiting;
    if (!w || w.k !== 'multi') { if (!w || w.p.pid !== seat) throw new Error('いまはこの席の番ではない'); return this.answer(a); }
    const raw = a;
    const out = this.answerPart(seat, a);
    this.inputs.push({ k: 'seat', seat, a: raw });
    return out;
  }
  private answerPart(seat: number, a: unknown): GameEvent[] {
    const w = this.waiting;
    if (!w || w.k !== 'multi') throw new Error('同時の問いではない');
    const sub = this.waitingOf(seat);
    if (!sub) throw new Error('この席はもう答えた');
    this.partial.set(seat, this.norm(sub, a));
    if (!w.reqs.every((r) => this.partial.has(r.p.pid))) return [];
    const all = w.reqs.map((r) => this.partial.get(r.p.pid));
    return this.run(all);
  }

  /** いま選んでいる人間の席（待っていなければ最初の人間の席） */
  get player(): Player | null { return this.waiting?.p ?? this.g.players[this.human] ?? null; }
  /** いま選ぶ番の席（−1 なら誰も選んでいない） */
  get seat(): number { return this.waiting?.p.pid ?? -1; }

  /** エンジンが途中で例外を出して止まったとき、その理由（止まった試合は進められない） */
  fault: string | null = null;

  private run(answer?: unknown): GameEvent[] {
    if (this.done) return [];
    if (this.fault) throw new Error(`試合が止まっています：${this.fault}`);
    let r: IteratorResult<Req, number[]>;
    try {
      r = this.started ? this.gen.next(answer) : this.gen.next();
    } catch (e) {
      // 例外を出したジェネレーターはもう進まない（次の next は「終わり」を返してしまい、問いが消えたまま止まる）。
      // ここまでの記録を最初から当て直して、答える前の場面に戻す（その答えは受け付けなかったことにする）
      this.g.E?.splice(0);
      this.rollback(e instanceof Error ? e.message : String(e));
      throw e;
    }
    this.started = true;
    this.partial.clear();
    if (r.done) { this.done = true; this.waiting = null; this.scores = r.value; } else this.waiting = this.sane(r.value);
    return this.g.E!.splice(0);
  }

  /** 記録（inputs）を最初から当て直した新しい試合に入れ替える。当て直せなければ fault を残す */
  private rollback(why: string) {
    try {
      const f = new Kiridani2Session(this.o);
      f.g.me = this.g.me;
      if (this.started) f.start();
      for (const x of this.inputs) f.input(x);
      f.g.E?.splice(0);
      this.g = f.g; this.gen = f.gen; this.waiting = f.waiting; this.done = f.done; this.scores = f.scores; this.started = f.started; this.fault = null;
    } catch {
      this.fault = why;
    }
  }
  private input(x: Input): GameEvent[] {
    switch (x.k) {
      case 'answer': return this.answer(x.a);
      case 'trade': return this.applyTrade(x.b, x.give, x.get);
      case 'equip': return this.equip(x.c, x.slot, x.id);
      case 'auto': return this.setAuto(x.seat, x.on, x.level);
      case 'seat': return this.answerSeat(x.seat, x.a);
    }
  }

  /** 装備を手に入れたときの「誰に持たせる？」（pick equip:<id>）から、持たせると例外になる仲間を外す。
   *  同じ品をもう持っている仲間を選ぶと、エンジンの equip が「もう持っている」を投げて試合が止まっていた */
  private sane(w: Req): Req {
    if (w.k !== 'pick' || !w.what.startsWith('equip:')) return w;
    const id = w.what.slice(6), sl = slotOf(this.g.card(id));
    if (!sl) return w;
    const ok = w.options.filter((x) => { const m = /^eq:(\d+)$/.exec(String(x)); return !m || !this.g.equipError(w.p, Number(m[1]), sl, id); });
    return ok.length === w.options.length ? w : { ...w, options: ok };
  }

  /** 最初の選択まで進める */
  start(): GameEvent[] { return this.run(); }

  /** 人間の答えを渡し、次の選択まで進める。答えは waiting の選択肢の中のもの（同じ形の値でもよい） */
  answer(a: unknown): GameEvent[] {
    const raw = a;
    const out = this.answer1(a);
    this.inputs.push({ k: 'answer', a: raw });
    return out;
  }
  private answer1(a: unknown): GameEvent[] {
    const w = this.waiting;
    if (!w) throw new Error('nothing to answer');
    if (w.k === 'multi') {
      // まとめて答える（テスト・お任せ用）：席ごとの答えの配列
      if (!Array.isArray(a) || a.length !== w.reqs.length) throw new Error('bad answers');
      return this.run(w.reqs.map((r, i) => this.norm(r, a[i])));
    }
    return this.run(this.norm(w, a));
  }
  /** 答えを問いの選択肢と照らして、エンジンに渡す形にする（正しくなければ例外） */
  private norm(w: Req, a: unknown): unknown {
    switch (w.k) {
      case 'multi': throw new Error('bad answer');
      case 'card': if (!w.cards.includes(a as string)) throw new Error('bad card'); break;
      case 'ratio': { const m = w.options.find((x) => same(x, a)); if (!m) throw new Error('bad ratio'); a = m; break; }
      case 'kind': if (!w.options.includes(a as never)) throw new Error('bad kind'); break;
      case 'pick': { const m = w.options.find((x) => same(x, a)); if (m === undefined) throw new Error('bad pick'); a = m; break; }
      case 'choose': {
        const m = w.opts.find((x) => sameOpt(x, a as Option));
        if (!m) throw new Error('bad option');
        // 戦闘の後押しを自分で選んだとき（巣・主の巣だけ。待ち伏せは戦うときに決める）
        const use = cleanUse((a as Option).use);
        const raw = (a as Option).who;
        a = use && m.k && m.mode !== 'wait' && m.i >= 0 ? { ...m, use } : m;
        // 動かす仲間を選んだとき（使えない仲間なら答えにしない）
        if (raw !== undefined) {
          const who = cleanWho(raw);
          if (!who || !this.g.whoFor(w.p, { ...(a as Option), who })) throw new Error('その仲間は動かせない');
          a = { ...(a as Option), who };
        }
        break;
      }
      case 'heal': case 'effect': a = !!a; break;
    }
    return a;
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
    this.inputs.push({ k: 'trade', b, give, get });
    this.refreshOpts();
    return this.g.E!.splice(0);
  }

  // ---------------------------------------------------------- 装備（自分の手番に無料で持たせる・はずす・持ち替える）
  /** 装備を持たせる（id＝null ではずす）。置き場所の選択は続く */
  equip(companion: number, slot: 'weapon' | 'armor', id: string | null): GameEvent[] {
    const w = this.waiting;
    if (!w || w.k !== 'choose') throw new Error('装備は自分の番に持ち替えられる');
    // 同じ操作が2度届いた（連打・再送）ときは何もしない
    if (id !== null && w.p.comps[companion]?.[slot] === id) return [];
    if (id === null && w.p.comps[companion] && !w.p.comps[companion][slot]) return [];
    this.g.equip(w.p, companion, slot, id);
    this.inputs.push({ k: 'equip', c: companion, slot, id });
    this.refreshOpts();
    return this.g.E!.splice(0);
  }

  /** 置き場所の選択の途中で持ち物・装備が変わったとき、選べるものを今の盤面で作り直す。
   *  エンジンは ask に渡した配列（Req.opts）で答えを確かめるので、新しい配列にせず「同じ配列の中身」を入れ替える。
   *  （以前は新しい配列にしていたため、取引で払えるようになったマスを選ぶとエンジンが古い選択肢で弾いて
   *  "illegal option" を投げ、試合の進み役が止まっていた：盤面の選択が消えたまま何も選べず、再開もできない） */
  private refreshOpts() {
    const w = this.waiting as Extract<Req, { k: 'choose' }>;
    const fresh = this.g.legal(w.p, w.opts.some((o) => o.s === '@spell'));
    w.opts.splice(0, w.opts.length, ...fresh);
    // 画面が「問いが変わった」と分かるように、問いの入れ物は新しくする（opts は同じ配列）
    this.waiting = { ...w };
  }

  /** 人間の席を AI に任せる／人に戻す（退室中の代行）。いま聞いている途中なら AI がすぐ答えて次へ進める */
  setAuto(seat: number, on: boolean, level: Level = 'novice'): GameEvent[] {
    const p = this.g.players[seat];
    if (!p || !this.humans.includes(seat) || on === !!p.ai) return [];
    if (!on) { p.ai = null; this.inputs.push({ k: 'auto', seat, on, level }); return []; }
    const ai = new AI(level, { seed: (this.seed * 100 + seat) * 7 + 3 });
    p.ai = ai;
    const sub = this.done ? null : this.waitingOf(seat);
    const evs = !sub ? [] : this.waiting!.k === 'multi' ? this.answerPart(seat, ai.respond(sub)) : this.run(ai.respond(sub));
    this.inputs.push({ k: 'auto', seat, on, level });
    return evs;
  }
  isAuto(seat: number): boolean { return this.humans.includes(seat) && !!this.g.players[seat]?.ai; }

  /** 人間の席も AI と同じ考えで答えて最後まで（テスト・お任せ用） */
  autoplay(level: Level = 'normal'): GameEvent[] {
    const helper = new AI(level, { seed: 7 });
    const out: GameEvent[] = [...(this.started ? [] : this.start())];
    while (!this.done) { const w = this.waiting!; out.push(...this.answer(w.k === 'multi' ? w.reqs.map((r) => helper.respond(r)) : helper.respond(w))); }
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
