// 霧谷の冒険者団 v2 — オンライン対戦の審判（ホストの端末で Kiridani2Session を回す役）と、参加者側の盤面の写し。
// v1（../kiridani/net.ts）と同じ形：
// ・審判（Kiridani2Referee）：人間の席が複数ある試合を進め、席ごとに「見てよい出来事」（手札・ドラフトの手・秘密依頼は隠す）と
//   「いま選ぶこと」（Prompt：選択肢と、その席から見た盤面の写し）を作る。参加者から届くのは選んだ答え（Action）だけ。
// ・v2 の準備段階は、山から見せるカードが前の人の選び（戻して混ぜる）で変わるので、全員同時には選べない。席順に聞く。
// ・盤面の写し（encodeGame / decodeGame）：他の席の手札・秘密依頼・山札の順番・先の主と段階カード・乱数を抜いた Game。
//   参加者の端末で見込み（戦闘の勝つ見込み・交換所の値段）をそのまま計算するのに使う（ShadowSession）。
import { CARD_SET } from './cards';
import { Game, loadCards, Player, type Choice, type ItemKind, type Option, type Ratio, type Req } from './engine';
import { Rng } from './rng';
import { Kiridani2Session, type TradeJudge } from './session';
import type { Level } from './ai';
import type { CardDef, Cost, GameEvent, Res } from './types';
import { RES } from './types';

// ------------------------------------------------------------ 答え・問い
/** 参加者の答え（すべて JSON） */
export type Action =
  | { t: 'card'; id: string }                                   // リーダー・職能・品物・始めの2枚・秘密依頼・引くカード
  | { t: 'ratio'; v: Ratio }                                    // 武具・道具・秘術の割合（合計5）
  | { t: 'kind'; v: ItemKind }                                  // 次に引く品物の種類
  | { t: 'opt'; i: number; use?: string[] }                                   // 置き場所の選択肢（Prompt.opts の番号）
  | { t: 'pick'; i: number }                                    // 細かい選択（Prompt.options の番号）
  | { t: 'yes'; v: boolean }                                    // はい／いいえ（回復・効果を使うか）
  | { t: 'trade'; b: number; give: Cost; get: Cost }            // AI との取引（置き場所の選択は続く）
  | { t: 'offer'; b: number; give: Cost; get: Cost }            // 人への取引の申し込み
  | { t: 'withdraw' }
  | { t: 'reply'; accept: boolean }
  | { t: 'expire' }
  | { t: 'away'; v: boolean };

export interface OfferView { id: string; from: number; to: number; give: Cost; get: Cost; ms: number; res: Record<Res, number> }
export interface OfferNote { id: string; text: string; ok: boolean }
export type Snapshot = Record<string, unknown>;

/** 持ち物と名声の合わせ（エンジンは払いの一部を出来事にしないので、出来事のまとまりの終わりに付ける。画面だけが使う） */
export interface SyncEvent { t: 'sync'; res: Record<Res, number>[]; fame: number[] }
export type NetEvent = GameEvent | SyncEvent;
/** いまの盤面から合わせの出来事を作る */
export function syncEvent(g: Game): SyncEvent {
  return {
    t: 'sync',
    res: g.players.map((p) => ({ ...p.res })),
    fame: g.players.map((p) => Object.values(p.fame).reduce((a, n) => a + n, 0) - p.discontent * 3 - p.raidLoss),
  };
}
export type ActResult = { ok: true } | { ok: false; error: string };

/** 1つの席への問い（Req から盤面の参照を抜き、写しを添えたもの） */
export interface Prompt {
  id: string;
  seat: number;
  k: Req['k'];
  /** card：何のために選ぶか・見せるカード・山の種類 */
  why?: Extract<Req, { k: 'card' }>['why'];
  cards?: string[];
  kind?: string;
  /** ratio：選べる割合 */
  ratios?: Ratio[];
  /** kind：選べる種類と、残りの割合 */
  kinds?: ItemKind[];
  ratioLeft?: Ratio;
  /** choose：置き場所の選択肢 */
  opts?: Option[];
  /** heal：回復する仲間と費用 */
  comp?: number;
  cost?: Cost;
  /** effect：使うか聞く効果 */
  card?: string;
  when?: string;
  ops?: unknown[];
  /** pick：何を選ぶかと選択肢 */
  what?: string;
  options?: Choice[];
  snap: Snapshot;
  /** 取引できる相手と、このラウンドの残り回数 */
  partners: number[];
  left: number;
  offer?: OfferView;
}

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

/** 写しに入れない Game のフィールド（カードの定義は参加者の端末で組み立て直す） */
const G_SKIP = new Set(['rng', 'E', 'players', 'cs', 'byId', 'quest', 'anc', 'bossTypes', 'monDeck', 'decks', 'errors', 'fateLog', 'monLog', 'stageAt', 'bossOf', 'forceFate', 'lastClash']);
/** 写しに入れない Player のフィールド（測定用の記録・AI） */
const P_SKIP = new Set(['ai', 'history', 'cardHist', 'fed', 'acts', 'picked', 'target']);

let cardsCache: { byId: Map<string, CardDef>; quest: Game['quest']; anc: Game['anc'] } | null = null;
function cardMaps() {
  if (!cardsCache) {
    const byId = loadCards(CARD_SET);
    cardsCache = { byId, quest: new Map(CARD_SET.quests.map((q) => [q.id, q])), anc: new Map(CARD_SET.ancient.map((a) => [a.id, a])) };
  }
  return cardsCache;
}

/** seat の席から見た盤面（他の席の手札・秘密依頼、山札の中身と順番、先の主と段階カード、運命の山の順番、乱数は入れない） */
export function encodeGame(g: Game, seat: number): Snapshot {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(g)) if (!G_SKIP.has(k)) out[k] = enc(v);
  // 山は枚数だけ
  out.deckSizes = Object.fromEntries(Object.entries(g.decks).map(([k, d]) => [k, d.length]));
  // 段階カード・主は今のラウンドまでに明かされたものだけ
  out.stageAt = Object.fromEntries(Object.entries(g.stageAt).filter(([r]) => Number(r) <= g.round));
  const year = g.round ? g.year() : 0;
  out.bossOf = enc(Object.fromEntries(Object.entries(g.bossOf).filter(([r]) => Math.ceil(Number(r) / 4) <= year)));
  out.players = g.players.map((p) => {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(p)) if (!P_SKIP.has(k)) o[k] = enc(v);
    // 運命の山は中身だけ（順番は次にめくる札が分かってしまう）
    o.fate = [...p.fate].sort((a, b) => a - b);
    if (p.pid !== seat) {
      o.hand = p.hand.map(() => '?');
      o.secret = null;
    }
    o.isAI = !!p.ai;
    return o;
  });
  return out;
}

/** 写しから Game を組み立てる（AI はいない。見込みの計算と選べる行動の確認だけに使う） */
export function decodeGame(s: Snapshot): Game {
  const g = Object.create(Game.prototype) as Game;
  const { players, deckSizes, ...rest } = s as { players: Record<string, unknown>[]; deckSizes?: Record<string, number> } & Record<string, unknown>;
  Object.assign(g, dec(rest));
  const m = cardMaps();
  g.cs = CARD_SET; g.byId = m.byId; g.quest = m.quest; g.anc = m.anc;
  const hidden = (n: number) => Array.from({ length: n }, () => '?');
  const ds = deckSizes ?? {};
  g.decks = { leader: hidden(ds.leader ?? 0), occ: hidden(ds.occ ?? 0), weapon: hidden(ds.weapon ?? 0), tool: hidden(ds.tool ?? 0), spell: hidden(ds.spell ?? 0), ancient: hidden(ds.ancient ?? 0), secret: hidden(ds.secret ?? 0) };
  g.players = players.map((o) => {
    const p = Object.create(Player.prototype) as Player;
    const { isAI: _a, ...fields } = o;
    Object.assign(p, dec(fields));
    p.ai = null;
    p.history = []; p.cardHist = []; p.fed = []; p.acts = []; p.picked = []; p.target = [];
    return p;
  });
  g.rng = new Rng(0);
  g.E = null;
  g.errors = [];
  g.bossTypes = [];
  g.monDeck = [];
  g.fateLog = []; g.monLog = [];
  g.forceFate = null; g.lastClash = null;
  return g;
}

export const snapIsAI = (s: Snapshot, seat: number) => !!(s.players as { isAI?: boolean }[])[seat]?.isAI;

// ------------------------------------------------------------ 出来事を席ごとに隠す
/** 出来事を seat の席から見てよい形にする */
export function redactEvent<E extends NetEvent>(ev: E, seat: number): E;
export function redactEvent(ev: NetEvent, seat: number): NetEvent {
  switch (ev.t) {
    case 'game_start': return { ...ev, me: seat };
    case 'leader_offer': case 'draft_offer': return ev.seat === seat ? ev : { ...ev, cards: ev.cards.map(() => '?') };
    case 'draft_pick': return ev.seat === seat ? ev : { ...ev, card: '?' };
    case 'draw': return ev.seat === seat || ev.from === 'ancient' ? ev : { ...ev, card: '?' };
    case 'secret_quest': return ev.seat === seat ? ev : { ...ev, quest: '?' };
    default: return ev;
  }
}

/** 出来事が他の席の隠し事を含まないか（テスト用） */
export function leaksFor(ev: NetEvent, seat: number): boolean {
  if (ev.t === 'draft_offer' || ev.t === 'leader_offer') return ev.seat !== seat && ev.cards.some((c) => c !== '?');
  if (ev.t === 'draft_pick') return ev.seat !== seat && ev.card !== '?';
  if (ev.t === 'draw') return ev.seat !== seat && ev.from !== 'ancient' && ev.card !== '?';
  if (ev.t === 'secret_quest') return ev.seat !== seat && ev.quest !== '?';
  return false;
}

// ------------------------------------------------------------ 審判
export interface RefereeOptions {
  n: number;
  seed: number;
  /** 5・10・15 年 */
  years?: number;
  offerTimeoutMs?: number;
  now?: () => number;
  humans: number[];
  /** AI の腕前（v1 の名前 mid / expert も受け付ける） */
  levels?: (Level | 'mid' | 'expert')[];
  names: string[];
}

const LEVEL_V2: Record<string, Level> = { mid: 'normal', expert: 'strong', novice: 'novice', normal: 'normal', strong: 'strong', random: 'random' };
export const toLevel2 = (l: string | undefined): Level => LEVEL_V2[l ?? 'normal'] ?? 'normal';

const isCost = (c: unknown): c is Cost => !!c && typeof c === 'object' && Object.entries(c as object).every(([r, n]) => RES.includes(r as Res) && Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 20);
const clean = (c: Cost) => Object.fromEntries(Object.entries(c).filter(([, n]) => n)) as Cost;

export class Kiridani2Referee {
  readonly s: Kiridani2Session;
  readonly humans: number[];
  readonly n: number;
  readonly rules = 2 as const;
  readonly log: NetEvent[] = [];
  readonly logs: NetEvent[][];
  private decision = 0;
  private listeners = new Set<() => void>();
  readonly history: [number, string, Action][] = [];
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
    this.s = new Kiridani2Session({ n: o.n, seed: o.seed, years: o.years ?? 5, humans: o.humans, levels: (o.levels ?? []).map(toLevel2), names: o.names });
    // 出来事はすべて見える形で受け取り、席ごとに隠す
    this.s.g.me = -1;
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
    this.changed();
  }

  private take(evs: GameEvent[]) {
    this.decision++;
    for (let ev of evs) {
      // 秘密依頼は本人にだけ見せる（エンジンは me=-1 だと伏せて出すので、ここで中身を入れる）
      if (ev.t === 'secret_quest') ev = { ...ev, quest: this.s.g.players[ev.seat]?.secret ?? '?' };
      this.log.push(ev);
      for (let i = 0; i < this.n; i++) this.logs[i].push(redactEvent(ev, i));
    }
    if (evs.length) {
      const sy = syncEvent(this.s.g);
      this.log.push(sy);
      for (let i = 0; i < this.n; i++) this.logs[i].push(sy);
    }
  }

  waitingSeats(): number[] { return this.humans.filter((x) => this.prompt(x) !== null); }

  prompt(seat: number): Prompt | null {
    const s = this.s, w = s.waiting;
    if (!w || w.p.pid !== seat || !this.humans.includes(seat) || s.isAuto(seat)) return null;
    const out: Prompt = { id: `n${this.decision}`, seat, k: w.k, snap: encodeGame(s.g, seat), partners: [], left: 0 };
    switch (w.k) {
      case 'card': Object.assign(out, { why: w.why, cards: [...w.cards], ...(w.kind ? { kind: w.kind } : {}) }); break;
      case 'ratio': out.ratios = w.options; break;
      case 'kind': out.kinds = [...w.options]; out.ratioLeft = { ...w.left }; break;
      case 'choose':
        out.opts = w.opts; out.partners = s.tradePartners(); out.left = s.tradeLeft();
        if (this.offer?.from === seat) out.offer = this.offerFor(seat)!;
        break;
      case 'heal': out.comp = w.comp; out.cost = w.cost; break;
      case 'effect': out.card = w.card; out.when = w.when; out.ops = w.ops; break;
      case 'pick': out.what = w.what; out.options = w.options; break;
    }
    return out;
  }

  replay(history: [number, string, Action][]) {
    for (const [seat, id, a] of history) this.act(seat, id, a);
  }

  act(seat: number, id: string, a: Action): ActResult {
    if (!a || typeof a !== 'object') return { ok: false, error: '形式が正しくありません' };
    const r = this.act1(seat, id, a);
    if (r.ok) this.history.push([seat, id, a]);
    return r;
  }

  private act1(seat: number, id: string, a: Action): ActResult {
    const of = this.offer;
    if (a.t === 'away') {
      const who = Number(id);
      if (seat !== -1 || !this.humans.includes(who)) return { ok: false, error: '形式が正しくありません' };
      return this.setAway1(who, a.v === true);
    }
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
      this.take(applyAction(this.s, a));
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
    this.changed();
    return { ok: true };
  }

  // ---------------------------------------------------------- 退室・復帰
  get away(): number[] { return this.humans.filter((x) => this.s.isAuto(x)); }
  isAway(seat: number) { return this.s.isAuto(seat); }

  setAway(seat: number, v: boolean): boolean {
    if (!this.humans.includes(seat) || this.s.isAuto(seat) === v || this.s.done) return false;
    return this.act(-1, String(seat), { t: 'away', v }).ok;
  }

  private setAway1(seat: number, v: boolean): ActResult {
    if (this.s.isAuto(seat) === v) return { ok: false, error: 'もうそうなっています' };
    if (v) {
      const of = this.offer;
      if (of && (of.from === seat || of.to === seat)) this.closeOffer(of.from === seat ? 'withdraw' : 'decline');
    }
    try {
      const asked = v && this.s.waiting?.p.pid === seat;
      const evs = this.s.setAuto(seat, v, 'novice');
      if (asked) this.take(evs);
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
    const j = this.s.judgeTrade(a.b, clean(a.give), clean(a.get));
    if (!j.ok) return { ok: false, error: j.error ?? '取引できません' };
    this.offer = { id: `t${++this.offerSeq}`, from: seat, to: a.b, give: clean(a.give), get: clean(a.get), deadline: this.now() + this.offerMs };
    this.decision++;
    if (this.offerMs > 0 && typeof setTimeout !== 'undefined') {
      const oid = this.offer.id;
      this.offerTimer = setTimeout(() => this.expire(oid), this.offerMs);
    }
    this.changed();
    return { ok: true };
  }

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
        const why = e instanceof Error ? e.message : String(e);
        note(of.from, `取引は成立しませんでした（${why}）`);
        note(of.to, `取引は成立しませんでした（${why}）`);
      }
    } else if (how === 'decline') note(of.from, `${nt}が取引を断りました`);
    else if (how === 'withdraw') note(of.to, `${nf}が取引の申し込みを取り下げました`);
    else { note(of.from, `${nt}から返事がなく、取引は成立しませんでした`); note(of.to, '時間切れで、取引の申し込みは流れました'); }
    this.decision++;
  }

  offerFor(seat: number): OfferView | null {
    const of = this.offer;
    if (!of || (seat !== of.from && seat !== of.to)) return null;
    return { id: of.id, from: of.from, to: of.to, give: of.give, get: of.get, ms: Math.max(0, of.deadline - this.now()), res: { ...this.s.g.players[seat].res } };
  }
  noteFor(seat: number): OfferNote | null { return this.notes.get(seat) ?? null; }

  judge(seat: number, b: number, give: Cost, get: Cost): TradeJudge {
    const w = this.s.waiting;
    if (!w || w.p.pid !== seat || w.k !== 'choose') return { ok: false, accept: false, error: 'あなたの番に持ちかけられる' };
    if (!isCost(give) || !isCost(get) || !Number.isInteger(b)) return { ok: false, accept: false, error: '形式が正しくありません' };
    return this.s.judgeTrade(b, clean(give), clean(get));
  }
}

/** 答えを Kiridani2Session に渡す（審判と、直接回すテストの両方で使う） */
export function applyAction(s: Kiridani2Session, a: Action): GameEvent[] {
  const w = s.waiting;
  if (!w) throw new Error('試合は終わっています');
  switch (a.t) {
    case 'card':
      if (w.k !== 'card') throw new Error('いまはカードを選ぶ場面ではありません');
      if (!w.cards.includes(String(a.id))) throw new Error('選べないカードです');
      return s.answer(String(a.id));
    case 'ratio':
      if (w.k !== 'ratio') throw new Error('いまは割合を選ぶ場面ではありません');
      return s.answer(a.v);
    case 'kind':
      if (w.k !== 'kind') throw new Error('いまは種類を選ぶ場面ではありません');
      return s.answer(a.v);
    case 'opt': {
      if (w.k !== 'choose') throw new Error('いまは置き場所を選ぶ場面ではありません');
      const o = Number.isInteger(a.i) ? w.opts[a.i] : undefined;
      if (!o) throw new Error('選べない行動です');
      return s.answer(a.use !== undefined ? { ...o, use: a.use } : o);
    }
    case 'pick': {
      if (w.k !== 'pick') throw new Error('いまは選ぶ場面ではありません');
      const x = Number.isInteger(a.i) ? w.options[a.i] : undefined;
      if (x === undefined) throw new Error('選べません');
      return s.answer(x);
    }
    case 'yes':
      if (w.k !== 'heal' && w.k !== 'effect') throw new Error('いまは「はい／いいえ」の場面ではありません');
      return s.answer(a.v === true);
    case 'trade':
      if (!isCost(a.give) || !isCost(a.get) || !Number.isInteger(a.b)) throw new Error('形式が正しくありません');
      return s.trade(a.b, clean(a.give), clean(a.get));
    default:
      throw new Error('知らない答えです');
  }
}

// ------------------------------------------------------------ 参加者側：問いから組み立てる席
/** 1つの席から見た「いま選ぶこと」と盤面。手元の Kiridani2Session と、オンラインの写し（ShadowSession）がこれになる */
export interface SeatSession2 {
  readonly g: Game;
  readonly player: Player | null;
  readonly waiting: Req | null;
  tradePartners(): number[];
  tradeLeft(): number;
  judgeTrade(b: number, give: Cost, get: Cost): TradeJudge & { pending?: boolean };
}

export class ShadowSession implements SeatSession2 {
  readonly g: Game;
  readonly player: Player;
  readonly waiting: Req;
  private judged = new Map<string, TradeJudge>();
  private asking = new Set<string>();

  constructor(readonly prompt: Prompt, private ask?: (b: number, give: Cost, get: Cost) => Promise<TradeJudge>, private onJudged?: () => void) {
    this.g = decodeGame(prompt.snap);
    this.player = this.g.players[prompt.seat];
    const g = this.g, p = this.player, pr = prompt;
    switch (pr.k) {
      case 'card': this.waiting = { k: 'card', g, p, why: pr.why ?? 'draw', cards: pr.cards ?? [], ...(pr.kind ? { kind: pr.kind } : {}) }; break;
      case 'ratio': this.waiting = { k: 'ratio', g, p, options: pr.ratios ?? [] }; break;
      case 'kind': this.waiting = { k: 'kind', g, p, options: pr.kinds ?? [], left: pr.ratioLeft ?? { weapon: 0, tool: 0, spell: 0 } }; break;
      case 'choose': this.waiting = { k: 'choose', g, p, opts: pr.opts ?? [] }; break;
      case 'heal': this.waiting = { k: 'heal', g, p, comp: pr.comp ?? 0, cost: pr.cost ?? {} }; break;
      case 'effect': this.waiting = { k: 'effect', g, p, card: pr.card ?? '', when: pr.when ?? '', ops: (pr.ops ?? []) as never }; break;
      case 'pick': this.waiting = { k: 'pick', g, p, what: pr.what ?? '', options: pr.options ?? [] }; break;
    }
  }

  tradePartners() { return this.prompt.partners; }
  tradeLeft() { return this.prompt.left; }

  judgeTrade(b: number, give: Cost, get: Cost): TradeJudge & { pending?: boolean } {
    give = clean(give); get = clean(get);
    const fail = (error: string): TradeJudge => ({ ok: false, accept: false, error });
    const p = this.player, o = this.g.players[b];
    if (this.waiting.k !== 'choose') return fail('あなたの番に持ちかけられる');
    if (this.tradeLeft() <= 0) return fail('このラウンドの取引は終わり');
    if (!o || o === p || !this.prompt.partners.includes(b)) return fail('相手がいない');
    for (const r of Object.keys(give)) if (r in get) return fail('同じ資源を渡して受け取ることはできない');
    const err = this.g.tradeOk(p, o, give, get);
    if (err && err !== 'このラウンドの取引は終わり') return fail(err);
    if (!snapIsAI(this.prompt.snap, b)) return { ok: true, accept: true, human: true };
    const key = JSON.stringify([b, give, get]);
    const got = this.judged.get(key);
    if (got) return got;
    if (this.ask && !this.asking.has(key)) {
      this.asking.add(key);
      this.ask(b, give, get).then((j) => { this.judged.set(key, j); this.onJudged?.(); }, () => { this.asking.delete(key); });
    }
    return { ok: false, accept: false, error: '相手の返事を待っている…', pending: true };
  }
}

/** テスト・お任せ用：問いだけを見て答える簡単な決め方 */
export function simpleAnswer(sh: SeatSession2): Action {
  const w = sh.waiting!;
  switch (w.k) {
    case 'card': return { t: 'card', id: w.cards[w.cards.length - 1] };
    case 'ratio': return { t: 'ratio', v: w.options.find((r) => r.weapon === 2 && r.tool === 2) ?? w.options[0] };
    case 'kind': return { t: 'kind', v: w.options[0] };
    case 'choose': {
      // 巣があれば1人で確実に、なければ置けるマスの最初（秘術は使わない）
      let i = w.opts.findIndex((o) => o.s.startsWith('nest') && o.k === 1 && o.mode === 'safe');
      if (i < 0) i = w.opts.findIndex((o) => o.s !== '@spell');
      return { t: 'opt', i: Math.max(0, i) };
    }
    case 'pick': return { t: 'pick', i: 0 };
    case 'heal': case 'effect': return { t: 'yes', v: true };
  }
}
