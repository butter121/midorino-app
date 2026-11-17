// 霧谷の冒険者団 — オンライン対戦の審判（ホストの端末で KiridaniSession を回す役）と、参加者側の盤面の写し。
// ・審判（KiridaniReferee）：人間の席が複数ある試合を進め、席ごとに「見てよい出来事」（手札・ドラフトの手は隠す）と
//   「いま選ぶこと」（Prompt：選択肢と、その席から見た盤面の写し）を作る。参加者から届くのは選んだ答え（Action）だけ。
// ・ドラフトとキャラ選びは全員が同時に選べる（エンジンは席順に聞くので、先に届いた答えは預かっておき、順番が来たら渡す）。
// ・盤面の写し（encodeGame / decodeGame）：他の席の手札・山札の順番・乱数を抜いた Game。参加者の端末で
//   トレイの見込み（fightChips / previewPick / marketQuote）をそのまま計算するのに使う（ShadowSession）。
// 通信の手段（PeerJS など）はここでは扱わない。
import * as D from './data';
import type { Cost, Res } from './data';
import { MRandom } from './rng';
import { BASIC, Game, Player, type FightPick, type Option, type Req } from './engine';
import { KiridaniSession, TRADE_MAX, type SeatSession, type TradeJudge } from './session';
import type { Level } from './ai';
import type { GameEvent } from './types';

// ------------------------------------------------------------ 答え・問い
/** 参加者の答え（すべて JSON） */
export type Action =
  | { t: 'card'; id: string }                                   // ドラフト・キャラ・遺跡のカード
  | { t: 'opt'; i: number }                                     // 置き場所の選択肢（Prompt.opts の番号）
  | { t: 'yes'; v: boolean }                                    // はい／いいえ（使い魔・手当て・砂時計など）
  | { t: 'weather'; w: string | null }                          // 天候の鈴
  | { t: 'fight'; sel: FightPick }                              // 戦闘のトレイ
  | { t: 'market'; sid: string; kind: 'buy' | 'sell'; r: Res; q: number }
  | { t: 'trade'; b: number; give: Cost; get: Cost }            // AI との取引（置き場所の選択は続く）
  | { t: 'offer'; b: number; give: Cost; get: Cost }            // 人への取引の申し込み（相手の返事を待つ）
  | { t: 'withdraw' }                                           // 申し込みの取り下げ（id は申し込みの番号）
  | { t: 'reply'; accept: boolean }                             // 申し込まれた人の返事（id は申し込みの番号）
  | { t: 'expire' };                                            // 時間切れ（審判の記録の読み直し用。席は -1）

/** 人どうしの取引の申し込み（申し込んだ人と、申し込まれた人にだけ送る） */
export interface OfferView {
  id: string;
  from: number;
  to: number;
  /** 申し込んだ人が渡すもの・受け取るもの */
  give: Cost;
  get: Cost;
  /** 返事の締め切りまでのミリ秒（送った時点） */
  ms: number;
  /** 見ている席の今の持ち物（申し込まれた人が、受けたあとの持ち物を見るため） */
  res: Record<Res, number>;
}
/** 取引の結果のお知らせ（当事者だけ） */
export interface OfferNote { id: string; text: string; ok: boolean }

/** 盤面の写し（JSON） */
export type Snapshot = Record<string, unknown>;

/** 1つの席への問い（Req から盤面の参照を抜き、写しを添えたもの） */
export interface Prompt {
  /** 問いの番号（古い答えを捨てるのに使う）。ドラフト・キャラは全員共通の番号 */
  id: string;
  seat: number;
  k: Req['k'];
  cards?: string[];
  kind?: 'occ' | 'item';
  ingame?: boolean;
  options?: string[];
  opts?: Option[];
  m?: D.MonsterDef;
  nr?: number;
  /** その席から見た盤面 */
  snap: Snapshot;
  /** 取引できる相手と、このラウンドの残り回数 */
  partners: number[];
  left: number;
  /** 返事待ちの自分の申し込み（あるあいだは置き場所を選べない） */
  offer?: OfferView;
}

export type ActResult = { ok: true } | { ok: false; error: string };

// ------------------------------------------------------------ 盤面の写し
const enc = (v: unknown): unknown => {
  if (v instanceof Set) return { $set: [...v].map(enc) };
  if (v instanceof Map) return { $map: [...v].map(([k, x]) => [k, enc(x)]) };
  if (Array.isArray(v)) return v.map(enc);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)]));
  return v;
};
const dec = (v: unknown): any => {
  if (Array.isArray(v)) return v.map(dec);
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (Array.isArray(o.$set) && Object.keys(o).length === 1) return new Set(o.$set.map(dec));
    if (Array.isArray(o.$map) && Object.keys(o).length === 1) return new Map((o.$map as [unknown, unknown][]).map(([k, x]) => [k, dec(x)]));
    return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, dec(x)]));
  }
  return v;
};

const G_SKIP = new Set(['rng', 'E', 'players', 'pick', 'lastFate', 'occ_pool', 'item_pool', 'mdeck', 'weather', 'bosses', 'errors']);
const P_SKIP = new Set(['ai']);

/** seat の席から見た盤面（他の席の手札・山札の順番・先の天候と主・乱数は入れない） */
export function encodeGame(g: Game, seat: number): Snapshot {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(g)) if (!G_SKIP.has(k)) out[k] = enc(v);
  const me = g.players[seat];
  out.players = g.players.map((p) => {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(p)) if (!P_SKIP.has(k)) o[k] = enc(v);
    if (p.pid !== seat) {
      o.hand = p.hand.map(() => '?');
      o.drafted = [];
      if (!p.char) o.char_opts = [];
    }
    o.isAI = !!p.ai;
    return o;
  });
  out.occ_pool = g.occ_pool.map(() => '?');
  out.item_pool = g.item_pool.map(() => '?');
  // 見えている魔物の予告だけ（今年の山の先頭）
  out.mdeck = g.round ? { [g.year()]: me ? g.visible_spawns(me) : [] } : {};
  // 天候：今のラウンドまでと、この席に見えている予報
  const f = g.round + (me ? g.forecast(me) : D.FORECAST);
  out.weather = g.weather.map((w, i) => (i < f ? w : ''));
  // 主：予告された年まで（春に今年の主が分かる）
  const year = g.round ? g.year() : 0;
  out.bosses = Object.fromEntries(Object.entries(g.bosses).filter(([r]) => Math.ceil(Number(r) / 4) <= year));
  return out;
}

/** 写しから Game を組み立てる（AI はいない。見込みの計算と選べる行動の確認だけに使う） */
export function decodeGame(s: Snapshot): Game {
  const g = Object.create(Game.prototype) as Game;
  const { players, ...rest } = s as { players: Record<string, unknown>[] } & Record<string, unknown>;
  Object.assign(g, dec(rest));
  g.players = players.map((o) => {
    const p = Object.create(Player.prototype) as Player;
    const { isAI: _a, ...fields } = o;
    Object.assign(p, dec(fields));
    p.ai = null;
    return p;
  });
  g.rng = new MRandom(0);
  g.E = null;
  g.pick = null;
  g.errors = [];
  return g;
}

/** 写しで AI の席か */
export const snapIsAI = (s: Snapshot, seat: number) => !!(s.players as { isAI?: boolean }[])[seat]?.isAI;

// ------------------------------------------------------------ 出来事を席ごとに隠す
/** 出来事を seat の席から見てよい形にする（round は今のラウンド＝天候の予報の長さに使う） */
export function redactEvent(ev: GameEvent, seat: number, g: Game, round: number): GameEvent {
  switch (ev.t) {
    case 'game_start': return { ...ev, me: seat };
    case 'draft_offer': return { ...ev, offers: { [seat]: ev.offers[seat] ?? [] } };
    case 'char_offer': return { ...ev, offers: Object.fromEntries(Object.keys(ev.offers).map((k) => [k, Number(k) === seat ? ev.offers[Number(k)] : []])) };
    case 'draft_pick': return ev.seat === seat ? ev : { ...ev, card: '?' };
    case 'draw': return ev.seat === seat ? ev : { ...ev, card: '?' };
    case 'weather': {
      const p = g.players[seat];
      return { ...ev, forecast: g.weather.slice(round, round + (p ? g.forecast(p) : D.FORECAST)) };
    }
    default: return ev;
  }
}

/** 出来事が他の席の隠し事を含まないか（テスト用：手札・ドラフトの手） */
export function leaksFor(ev: GameEvent, seat: number): boolean {
  if (ev.t === 'draft_offer') return Object.keys(ev.offers).some((k) => Number(k) !== seat);
  if (ev.t === 'char_offer') return Object.entries(ev.offers).some(([k, v]) => Number(k) !== seat && v.length > 0);
  if (ev.t === 'draft_pick' || ev.t === 'draw') return ev.seat !== seat && ev.card !== '?';
  return false;
}

// ------------------------------------------------------------ 審判
export interface RefereeOptions {
  n: number;
  seed: number;
  /** 人どうしの取引の返事を待つ長さ（ミリ秒。既定 60 秒、0 なら時間切れなし） */
  offerTimeoutMs?: number;
  /** 時計（テスト用） */
  now?: () => number;
  /** 人間の席 */
  humans: number[];
  levels?: Level[];
  names: string[];
}

const isCost = (c: unknown): c is Cost => !!c && typeof c === 'object' && Object.entries(c as object).every(([r, n]) => BASIC.includes(r as Res) && Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 20);

export class KiridaniReferee {
  readonly s: KiridaniSession;
  readonly humans: number[];
  readonly n: number;
  /** 起きた出来事すべて（隠す前） */
  readonly log: GameEvent[] = [];
  /** 席ごとの見てよい出来事 */
  readonly logs: GameEvent[][];
  private decision = 0;
  private round = 0;
  /** 同時に選ぶ場面（ドラフトの1周・キャラ選び） */
  private open: { id: string; k: 'draft' | 'char'; kind?: 'occ' | 'item'; offers: Record<number, string[]>; picked: Set<number> } | null = null;
  /** 順番が来る前に届いた答え */
  private early = new Map<number, string>();
  private listeners = new Set<() => void>();
  /** 受け付けた答えの記録（同じ種で順に渡すと同じところまで進む：ホストの読み込み直し） */
  readonly history: [number, string, Action][] = [];
  /** 返事待ちの人どうしの取引 */
  offer: { id: string; from: number; to: number; give: Cost; get: Cost; deadline: number } | null = null;
  private offerSeq = 0;
  private offerTimer: ReturnType<typeof setTimeout> | null = null;
  private notes = new Map<number, OfferNote>();
  private readonly offerMs: number;
  private readonly now: () => number;

  constructor(o: RefereeOptions) {
    this.offerMs = o.offerTimeoutMs ?? 60_000;
    this.now = o.now ?? (() => Date.now());
    this.n = o.n;
    this.humans = [...o.humans];
    this.s = new KiridaniSession({ n: o.n, seed: o.seed, humans: o.humans, levels: o.levels, names: o.names });
    this.logs = Array.from({ length: o.n }, () => []);
  }

  get done() { return this.s.done; }
  get scores() { return this.s.scores; }
  get g() { return this.s.g; }

  subscribe(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private changed() { this.listeners.forEach((f) => f()); }

  start() {
    if (this.log.length) return;
    this.take(this.s.start());
    this.flush();
    this.changed();
  }

  private take(evs: GameEvent[]) {
    this.decision++;
    for (const ev of evs) {
      if (ev.t === 'round_start') this.round = ev.round;
      if (ev.t === 'draft_offer') { this.open = { id: `draft:${ev.kind}:${ev.lap}`, k: 'draft', kind: ev.kind, offers: ev.offers, picked: new Set() }; this.early.clear(); }
      else if (ev.t === 'char_offer') { this.open = { id: 'char', k: 'char', offers: ev.offers, picked: new Set() }; this.early.clear(); }
      else if ((ev.t === 'draft_pick' || ev.t === 'char_pick') && this.open) this.open.picked.add(ev.seat);
      else if (ev.t === 'round_start') this.open = null;
      this.log.push(ev);
      for (let i = 0; i < this.n; i++) this.logs[i].push(redactEvent(ev, i, this.s.g, this.round));
    }
  }

  /** 預かっている答えで進められるだけ進める */
  private flush() {
    for (;;) {
      const w = this.s.waiting;
      if (!w || (w.k !== 'char' && !(w.k === 'draft' && !w.ingame))) return;
      const a = this.early.get(w.p.pid);
      if (a === undefined) return;
      this.early.delete(w.p.pid);
      this.take(this.s.answer(a));
    }
  }

  /** いま答えを待っている席（同時に選ぶ場面では複数） */
  waitingSeats(): number[] {
    return this.humans.filter((x) => this.prompt(x) !== null);
  }

  /** seat の席への問い（なければ null） */
  prompt(seat: number): Prompt | null {
    const s = this.s, g = s.g, w = s.waiting;
    if (!w || !this.humans.includes(seat)) return null;
    const base = { seat, snap: encodeGame(g, seat), partners: [] as number[], left: 0 };
    const o = this.open;
    const simul = o && (w.k === 'char' || (w.k === 'draft' && !w.ingame));
    if (simul) {
      if (o.picked.has(seat) || this.early.has(seat)) return null;
      const cards = o.offers[seat] ?? [];
      if (o.k === 'draft') return { ...base, id: o.id, k: 'draft', cards, kind: o.kind, ingame: false };
      return { ...base, id: o.id, k: 'char', options: cards };
    }
    if (w.p.pid !== seat) return null;
    const id = `n${this.decision}`;
    const out: Prompt = { ...base, id, k: w.k };
    switch (w.k) {
      case 'draft': Object.assign(out, { cards: w.cards, kind: w.kind, ingame: w.ingame }); break;
      case 'char': out.options = w.options; break;
      case 'choose': out.opts = w.opts; out.partners = s.tradePartners(); out.left = s.tradeLeft(); if (this.offer?.from === seat) out.offer = this.offerFor(seat)!; break;
      case 'tame': out.m = w.m; break;
      case 'storm': out.nr = w.nr; break;
      default: break;
    }
    return out;
  }

  /** 受け付けた答えを記録から順に渡す（読み込み直し） */
  replay(history: [number, string, Action][]) {
    for (const [seat, id, a] of history) this.act(seat, id, a);
  }

  /** seat の席の答え。id は答えた問いの番号（取り下げ・返事・時間切れは申し込みの番号） */
  act(seat: number, id: string, a: Action): ActResult {
    if (!a || typeof a !== 'object') return { ok: false, error: '形式が正しくありません' };
    const r = this.act1(seat, id, a);
    if (r.ok) this.history.push([seat, id, a]);
    return r;
  }

  private act1(seat: number, id: string, a: Action): ActResult {
    const of = this.offer;
    if (a.t === 'reply' || a.t === 'withdraw' || a.t === 'expire') {
      if (!of || of.id !== id) return { ok: false, error: 'この申し込みはもう終わっています' };
      if (a.t === 'reply' && seat !== of.to) return { ok: false, error: 'あなたへの申し込みではありません' };
      if (a.t === 'withdraw' && seat !== of.from) return { ok: false, error: 'あなたの申し込みではありません' };
      if (a.t === 'expire' && seat !== -1) return { ok: false, error: '形式が正しくありません' };
      this.closeOffer(a.t === 'reply' ? (a.accept === true ? 'accept' : 'decline') : a.t === 'withdraw' ? 'withdraw' : 'timeout');
      this.changed();
      return { ok: true };
    }
    if (of && seat === of.from) return { ok: false, error: `${this.names[of.to]}の返事を待っています` };
    if (a.t === 'offer') return this.makeOffer(seat, id, a);
    const pr = this.prompt(seat);
    if (!pr) return { ok: false, error: 'いまはあなたの番ではありません' };
    if (pr.id !== id) return { ok: false, error: '画面が古くなっています' };
    try {
      const w = this.s.waiting!;
      if (w.p.pid !== seat) {
        // 同時に選ぶ場面で、まだエンジンの順番が来ていない席
        if (a.t !== 'card' || !(pr.cards ?? pr.options ?? []).includes(a.id)) return { ok: false, error: '選べないカードです' };
        this.early.set(seat, a.id);
        this.changed();
        return { ok: true };
      }
      const evs = applyAction(this.s, a);
      this.take(evs);
      this.flush();
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
    this.changed();
    return { ok: true };
  }

  // ---------------------------------------------------------- 人どうしの取引
  private get names() { return this.s.g.names; }

  private makeOffer(seat: number, id: string, a: Extract<Action, { t: 'offer' }>): ActResult {
    const pr = this.prompt(seat);
    if (!pr || pr.k !== 'choose') return { ok: false, error: 'あなたの番に申し込めます' };
    if (pr.id !== id) return { ok: false, error: '画面が古くなっています' };
    if (!isCost(a.give) || !isCost(a.get) || !Number.isInteger(a.b)) return { ok: false, error: '形式が正しくありません' };
    if (!this.s.isHuman(a.b)) return { ok: false, error: '相手が人ではありません' };
    const j = this.s.judgeTrade(a.b, a.give, a.get);
    if (!j.ok) return { ok: false, error: j.error ?? '取引できません' };
    const clean = (c: Cost) => Object.fromEntries(Object.entries(c).filter(([, n]) => n)) as Cost;
    this.offer = { id: `t${++this.offerSeq}`, from: seat, to: a.b, give: clean(a.give), get: clean(a.get), deadline: this.now() + this.offerMs };
    this.decision++;
    if (this.offerMs > 0 && typeof setTimeout !== 'undefined') {
      const oid = this.offer.id;
      this.offerTimer = setTimeout(() => this.expire(oid), this.offerMs);
    }
    this.changed();
    return { ok: true };
  }

  /** 締め切りを過ぎた申し込みを断ったことにする（タイマーから。テストでは直接呼ぶ） */
  expire(id?: string): boolean {
    const of = this.offer;
    if (!of || (id && of.id !== id)) return false;
    if (!id && this.now() < of.deadline) return false;
    return this.act(-1, of.id, { t: 'expire' }).ok;
  }

  private closeOffer(how: 'accept' | 'decline' | 'withdraw' | 'timeout') {
    const of = this.offer!;
    this.offer = null;
    if (this.offerTimer) { clearTimeout(this.offerTimer); this.offerTimer = null; }
    const nf = this.names[of.from], nt = this.names[of.to];
    const note = (seat: number, text: string, ok = false) => this.notes.set(seat, { id: of.id, text, ok });
    if (how === 'accept') {
      try {
        this.take(this.s.tradeHuman(of.to, of.give, of.get));
        note(of.from, `${nt}が取引を受けました`, true);
        note(of.to, `${nf}との取引が成立しました`, true);
        return;
      } catch (e) {
        // 受けたときにもう一度確かめて、成り立たなくなっていたら不成立
        const why = e instanceof Error ? e.message : String(e);
        note(of.from, `取引は成立しませんでした（${why}）`);
        note(of.to, `取引は成立しませんでした（${why}）`);
      }
    } else if (how === 'decline') {
      note(of.from, `${nt}が取引を断りました`);
    } else if (how === 'withdraw') {
      note(of.to, `${nf}が取引の申し込みを取り下げました`);
    } else {
      note(of.from, `${nt}から返事がなく、取引は成立しませんでした`);
      note(of.to, '時間切れで、取引の申し込みは流れました');
    }
    this.decision++;
  }

  /** seat の席に関わる申し込み（申し込んだ人・申し込まれた人だけ） */
  offerFor(seat: number): OfferView | null {
    const of = this.offer;
    if (!of || (seat !== of.from && seat !== of.to)) return null;
    return { id: of.id, from: of.from, to: of.to, give: of.give, get: of.get, ms: Math.max(0, of.deadline - this.now()), res: { ...this.s.g.players[seat].res } };
  }

  /** seat の席への最後のお知らせ（取引の結果） */
  noteFor(seat: number): OfferNote | null { return this.notes.get(seat) ?? null; }

  /** 取引の見込み（seat の番のときだけ） */
  judge(seat: number, b: number, give: Cost, get: Cost): TradeJudge {
    const w = this.s.waiting;
    if (!w || w.p.pid !== seat || w.k !== 'choose') return { ok: false, accept: false, gain: 0, error: 'あなたの番に持ちかけられる' };
    if (!isCost(give) || !isCost(get) || !Number.isInteger(b)) return { ok: false, accept: false, gain: 0, error: '形式が正しくありません' };
    return this.s.judgeTrade(b, give, get);
  }
}

/** 答えを KiridaniSession に渡す（審判と、直接回すテストの両方で使う） */
export function applyAction(s: KiridaniSession, a: Action): GameEvent[] {
  const w = s.waiting;
  if (!w) throw new Error('試合は終わっています');
  switch (a.t) {
    case 'card':
      if (w.k !== 'draft' && w.k !== 'char') throw new Error('いまはカードを選ぶ場面ではありません');
      return s.answer(String(a.id));
    case 'opt': {
      if (w.k !== 'choose') throw new Error('いまは置き場所を選ぶ場面ではありません');
      const o = w.opts[a.i];
      if (!Number.isInteger(a.i) || !o) throw new Error('選べない行動です');
      return s.answer(o);
    }
    case 'yes':
      if (!['tame', 'heal', 'tan', 'hourglass', 'storm'].includes(w.k)) throw new Error('いまは「はい／いいえ」の場面ではありません');
      return s.answer(a.v === true);
    case 'weather': {
      if (w.k !== 'weather') throw new Error('いまは天候を選ぶ場面ではありません');
      const next = D.SEASONS[s.g.round % 4];
      if (a.w !== null && !D.WEATHER[next].includes(String(a.w))) throw new Error('選べない天候です');
      return s.answer(a.w);
    }
    case 'fight': {
      const sel = a.sel;
      if (!sel || typeof sel.sid !== 'string' || !Number.isInteger(sel.k) || !Array.isArray(sel.boosts) || !sel.boosts.every((x) => typeof x === 'string')) throw new Error('形式が正しくありません');
      return s.fight({ sid: sel.sid, k: sel.k, boosts: [...sel.boosts], wait: !!sel.wait });
    }
    case 'market':
      if ((a.kind !== 'buy' && a.kind !== 'sell') || !BASIC.includes(a.r) || !Number.isInteger(a.q) || typeof a.sid !== 'string') throw new Error('形式が正しくありません');
      return s.market(a.sid, a.kind, a.r, a.q);
    case 'trade':
      if (!isCost(a.give) || !isCost(a.get) || !Number.isInteger(a.b)) throw new Error('形式が正しくありません');
      return s.trade(a.b, a.give, a.get);
    default:
      throw new Error('知らない答えです');
  }
}

// ------------------------------------------------------------ 参加者側：問いから組み立てる席
/** 問い（Prompt）の写しから作る SeatSession。取引の見込みはホストに問い合わせ（届くまでは「確かめ中」） */
export class ShadowSession implements SeatSession {
  readonly g: Game;
  readonly player: Player;
  readonly waiting: Req;
  private judged = new Map<string, TradeJudge>();
  private asking = new Set<string>();

  constructor(readonly prompt: Prompt, private ask?: (b: number, give: Cost, get: Cost) => Promise<TradeJudge>, private onJudged?: () => void) {
    this.g = decodeGame(prompt.snap);
    this.player = this.g.players[prompt.seat];
    const g = this.g, p = this.player;
    const pr = prompt;
    switch (pr.k) {
      case 'draft': this.waiting = { k: 'draft', g, p, cards: pr.cards ?? [], kind: pr.kind ?? 'occ', ingame: !!pr.ingame }; break;
      case 'char': this.waiting = { k: 'char', g, p, options: pr.options ?? [] }; break;
      case 'choose': this.waiting = { k: 'choose', g, p, opts: pr.opts ?? [] }; break;
      case 'tame': this.waiting = { k: 'tame', g, p, m: pr.m! }; break;
      case 'storm': this.waiting = { k: 'storm', g, p, nr: pr.nr ?? 0 }; break;
      default: this.waiting = { k: pr.k, g, p } as Req;
    }
  }

  tradePartners() { return this.prompt.partners; }
  tradeLeft() { return this.prompt.left; }

  judgeTrade(b: number, give: Cost, get: Cost): TradeJudge {
    const clean = (c: Cost) => Object.fromEntries(Object.entries(c).filter(([, n]) => n).sort()) as Cost;
    give = clean(give); get = clean(get);
    const units = (c: Cost) => Object.values(c).reduce((x, n) => x + (n as number), 0);
    const fail = (error: string): TradeJudge => ({ ok: false, accept: false, gain: 0, error });
    const p = this.player, o = this.g.players[b];
    // 手元で分かる形の確認（AI の考えはホストに聞く）
    if (this.waiting.k !== 'choose') return fail('あなたの番に持ちかけられる');
    if (this.tradeLeft() <= 0) return fail('このラウンドの取引は終わり');
    if (!o || o === p || !this.prompt.partners.includes(b)) return fail('相手がいない');
    if (!units(give) || !units(get)) return fail('渡すものと受け取るものを選ぶ');
    if (units(give) > TRADE_MAX || units(get) > TRADE_MAX) return fail(`片側${TRADE_MAX}個まで`);
    for (const r of Object.keys(give)) if (r in get) return fail('同じ資源を渡して受け取ることはできない');
    for (const [r, n] of Object.entries(give)) if (p.res[r as Res] < (n as number)) return fail('渡すものが足りない');
    for (const [r, n] of Object.entries(get)) if (o.res[r as Res] < (n as number)) return fail('相手の持ち物が足りない');
    if (!snapIsAI(this.prompt.snap, b)) return { ok: true, accept: true, gain: 0, human: true };
    const key = JSON.stringify([b, give, get]);
    const got = this.judged.get(key);
    if (got) return got;
    if (this.ask && !this.asking.has(key)) {
      this.asking.add(key);
      this.ask(b, give, get).then((j) => { this.judged.set(key, j); this.onJudged?.(); }, () => { this.asking.delete(key); });
    }
    return { ok: false, accept: false, gain: 0, error: '相手の返事を待っている…', pending: true };
  }
}

/** テスト・お任せ用：問いだけを見て答える簡単な決め方（直接回す試合と同じ答えになるよう、盤面は写しで確かめる） */
export function simpleAnswer(sh: SeatSession): Action {
  const w = sh.waiting!;
  switch (w.k) {
    case 'draft': return { t: 'card', id: w.cards[w.cards.length - 1] };
    case 'char': return { t: 'card', id: w.options[0] };
    case 'tame': return { t: 'yes', v: w.g.round <= 10 };
    case 'weather': return { t: 'weather', w: null };
    case 'choose': {
      const g = sh.g, p = sh.player!;
      // 戦闘はトレイと同じ道（使うものなし・1人）、市場は1つ売る、ほかは最初の選択肢
      const nest = w.opts.find((o) => (o[0].startsWith('nest') || o[0] === 'lair') && Array.isArray(o[1]) && (o[1] as unknown[])[0] === 1);
      if (nest && g.check_pick(p, { sid: nest[0], k: 1, boosts: [] }).ok) return { t: 'fight', sel: { sid: nest[0], k: 1, boosts: [] } };
      const mk = w.opts.find((o) => D.MARKETS.has(o[0]));
      if (mk) for (const r of ['mana', 'mat'] as Res[]) if (!g.check_market(p, mk[0], 'sell', r, 1)) return { t: 'market', sid: mk[0], kind: 'sell', r, q: 1 };
      return { t: 'opt', i: 0 };
    }
    default: return { t: 'yes', v: true };
  }
}
