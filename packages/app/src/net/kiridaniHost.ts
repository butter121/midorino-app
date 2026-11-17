// 霧谷の冒険者団：ホスト。部屋を開き、参加申請を承認し、始めると自分の端末で審判（KiridaniReferee）を回す。
// 各席には見てよい出来事と問いだけを送り、届いた答えを審判に渡す。空いた席は AI。
// 試合の記録（種と答えの順番）を保存しておき、ホストが画面を読み込み直しても同じ試合に戻れる。
import { KiridaniReferee, type Action, type ActResult, type Cost, type Prompt, type TradeJudge } from '@midorino/engine/src/kiridani';
import { randomHex, type LobbyMember } from './protocol';
import { EV_CHUNK, KD_MAX_MSG, type KdLevel, type KdLobby, type KdToGuest, type KdToHost } from './kiridaniProtocol';
import type { Conn, Net } from './transport';
import { CHAT_KEEP, CHAT_STAMPS, ChatLimiter, sanitizeChat, type ChatMsg } from './chat';

interface Member extends LobbyMember { token: string; conn: Conn | null; sent: number }
export interface KdGame { seed: number; n: number; seats: string[]; names: string[]; level: KdLevel }
interface Saved { roomId: string; members: Omit<Member, 'conn' | 'online' | 'sent'>[]; seats: number; level: KdLevel; game: KdGame | null; actions: [number, string, Action][] }

export const KD_HOST_KEY = 'kiridani.host';
const AI_NAMES = ['ハヤテ', 'コトネ', 'ジン', 'ルリ', 'タケル', 'ミオ'];

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
const defaultStore = (): Store => { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } };

export class KdHostRoom {
  roomId: string;
  members: Member[] = [];
  seats = 4;
  level: KdLevel = 'mid';
  game: KdGame | null = null;
  referee: KiridaniReferee | null = null;
  status: 'connecting' | 'open' | 'error' = 'connecting';
  error = '';
  private server: { close(): void } | null = null;
  private listeners = new Set<() => void>();
  private store: Store;
  /** チャット（最後の CHAT_KEEP 件。ゲームの状態・記録には入らない） */
  chat: ChatMsg[] = [];
  private chatSeq = 0;
  private limiter = new ChatLimiter();
  private clock: () => number;
  /** 人どうしの取引の返事を待つ長さ（テスト用。既定は審判の 60 秒） */
  private offerMs?: number;

  constructor(private net: Net, hostName: string, opts: { saved?: Saved; store?: Store; seed?: number; offerTimeoutMs?: number; now?: () => number } = {}) {
    this.clock = opts.now ?? (() => Date.now());
    this.offerMs = opts.offerTimeoutMs;
    this.store = opts.store === undefined ? defaultStore() : opts.store;
    const s = opts.saved;
    if (s) {
      this.roomId = s.roomId;
      this.members = s.members.map((m) => ({ ...m, conn: null, sent: 0, online: m.status === 'host' }));
      this.seats = s.seats; this.level = s.level;
      if (s.game) this.begin(s.game, s.actions);
    } else {
      this.roomId = randomHex(16);
      this.members = [{ id: randomHex(8), name: hostName || 'ホスト', status: 'host', online: true, token: randomHex(16), conn: null, sent: 0 }];
    }
  }

  static resume(net: Net, store: Store = defaultStore()): KdHostRoom | null {
    try {
      const raw = store?.getItem(KD_HOST_KEY);
      if (!raw) return null;
      return new KdHostRoom(net, '', { saved: JSON.parse(raw) as Saved, store });
    } catch { return null; }
  }

  static clearSaved(store: Store = defaultStore()) { try { store?.removeItem(KD_HOST_KEY); } catch { /* 無視 */ } }

  get me() { return this.members[0]; }
  /** ホストの席（いつも 0） */
  get mySeat() { return this.game ? this.game.seats.indexOf(this.me.id) : -1; }

  subscribe(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private changed() { this.save(); this.listeners.forEach((f) => f()); }
  private save() {
    try {
      const saved: Saved = { roomId: this.roomId, seats: this.seats, level: this.level, game: this.game, actions: this.referee?.history ?? [], members: this.members.map(({ conn: _c, online: _o, sent: _s, ...m }) => m) };
      this.store?.setItem(KD_HOST_KEY, JSON.stringify(saved));
    } catch { /* 保存できない環境 */ }
  }

  open() {
    if (this.server) return;
    this.server = this.net.listen(this.roomId, {
      onConn: (c) => this.accept(c),
      onStatus: (s, msg) => { this.status = s; this.error = msg ?? ''; this.changed(); },
    });
    this.changed();
  }

  /** 部屋を閉じる（参加者に知らせてから） */
  close(reason = 'ホストが部屋を閉じました') {
    for (const m of this.members) if (m.conn) this.send(m.conn, { t: 'closed', reason });
    const srv = this.server;
    this.server = null;
    setTimeout(() => srv?.close(), 300);
    try { this.store?.removeItem(KD_HOST_KEY); } catch { /* 無視 */ }
    this.listeners.forEach((f) => f());
  }

  lobby(): KdLobby {
    return { roomId: this.roomId, started: !!this.game, seats: this.seats, level: this.level, members: this.members.map(({ id, name, status, online }) => ({ id, name, status, online })) };
  }

  private accept(conn: Conn) {
    let member: Member | null = null;
    conn.onData((raw) => {
      if (typeof raw !== 'string' || raw.length > 16 * 1024) return;
      let msg: KdToHost;
      try { msg = JSON.parse(raw); } catch { return; }
      if (!msg || typeof msg !== 'object') return;
      if (msg.t === 'hello') { member = this.hello(conn, msg); return; }
      if (msg.t === 'chat' && member && member.conn === conn) {
        // 承認待ちの人にも「話せない」と返す（say が確かめる）
        this.send(conn, { t: 'result', reqId: Number(msg.reqId) || 0, result: this.say(member.id, msg.text, !!msg.stamp) });
        return;
      }
      if (!member || member.status !== 'joined' || member.conn !== conn) return;
      if (msg.t === 'act') {
        const result = this.act(member.id, String(msg.id), msg.a);
        this.send(conn, { t: 'result', reqId: Number(msg.reqId) || 0, result });
      } else if (msg.t === 'judge') {
        this.send(conn, { t: 'judged', reqId: Number(msg.reqId) || 0, j: this.judge(member.id, Number(msg.b), msg.give, msg.get) });
      } else if (msg.t === 'sync') {
        member.sent = Math.max(0, Math.min(Number(msg.have) || 0, member.sent));
        this.pushGame(member);
      }
    });
    conn.onClose(() => {
      if (member && member.conn === conn) { member.conn = null; member.online = false; this.broadcast(); this.changed(); }
    });
  }

  private hello(conn: Conn, msg: Extract<KdToHost, { t: 'hello' }>): Member | null {
    const name = String(msg.name ?? '').trim().slice(0, 8) || 'ゲスト';
    if (msg.memberId && msg.token) {
      const m = this.members.find((x) => x.id === msg.memberId);
      if (m && m.token === msg.token && m.status !== 'host') {
        if (m.conn && m.conn !== conn) m.conn.close();
        m.conn = conn; m.online = true; m.sent = 0;
        this.send(conn, { t: 'welcome', memberId: m.id, token: m.token, status: m.status });
        this.send(conn, { t: 'chat', msgs: this.chat, reset: true });
        this.broadcast();
        this.changed();
        return m;
      }
    }
    if (this.game) { this.send(conn, { t: 'denied', reason: '試合はもう始まっています' }); return null; }
    if (this.humans().length >= 6) { this.send(conn, { t: 'denied', reason: '満員です' }); return null; }
    if (this.members.filter((m) => m.status === 'waiting').length >= 6) { this.send(conn, { t: 'denied', reason: '承認待ちの人が多すぎます' }); return null; }
    const m: Member = { id: randomHex(8), name, status: 'waiting', online: true, token: randomHex(16), conn, sent: 0 };
    this.members.push(m);
    this.send(conn, { t: 'welcome', memberId: m.id, token: m.token, status: 'waiting' });
    this.broadcast();
    this.changed();
    return m;
  }

  // ---- チャット ----
  /** 色に使う席（参加者の並び順＝始まったあとの席） */
  private chatSeat(id: string) { return this.game ? this.game.seats.indexOf(id) : this.humans().findIndex((m) => m.id === id); }

  /** 発言を受け付け、整えて全員に配る（承認済みの人とホストだけ・回数制限あり） */
  say(memberId: string, raw: unknown, stamp = false): ActResult {
    const m = this.members.find((x) => x.id === memberId);
    if (!m || (m.status !== 'host' && m.status !== 'joined')) return { ok: false, error: '参加してから話せます' };
    const text = sanitizeChat(raw);
    if (!text) return { ok: false, error: '何も書かれていません' };
    const now = this.clock();
    if (!this.limiter.allow(m.id, now)) return { ok: false, error: '少し待ってから送ってください' };
    const msg: ChatMsg = { id: ++this.chatSeq, seat: this.chatSeat(m.id), name: m.name, text, at: now, ...(stamp && CHAT_STAMPS.includes(text) ? { stamp: true } : {}) };
    this.chat = [...this.chat, msg].slice(-CHAT_KEEP);
    for (const x of this.members) if (x.conn && (x.status === 'joined')) this.send(x.conn, { t: 'chat', msgs: [msg] });
    this.listeners.forEach((f) => f());
    return { ok: true };
  }
  hostSay(text: string, stamp = false) { return this.say(this.me.id, text, stamp); }

  private humans() { return this.members.filter((m) => m.status === 'host' || m.status === 'joined'); }

  // ---- ホストの操作 ----
  approve(id: string, ok: boolean) {
    const i = this.members.findIndex((m) => m.id === id && m.status === 'waiting');
    if (i < 0 || this.game) return;
    const m = this.members[i];
    if (ok && this.humans().length < 6) {
      m.status = 'joined';
      if (this.humans().length > this.seats) this.seats = this.humans().length;
      if (m.conn) { this.send(m.conn, { t: 'welcome', memberId: m.id, token: m.token, status: 'joined' }); this.send(m.conn, { t: 'chat', msgs: this.chat, reset: true }); }
    } else {
      if (m.conn) { const c = m.conn; this.send(c, { t: 'denied', reason: 'ホストが参加を見送りました' }); setTimeout(() => c.close(), 500); }
      this.members.splice(i, 1);
    }
    this.broadcast();
    this.changed();
  }
  kick(id: string) {
    if (this.game) return;
    const i = this.members.findIndex((m) => m.id === id && m.status !== 'host');
    if (i < 0) return;
    const m = this.members[i];
    if (m.conn) { const c = m.conn; this.send(c, { t: 'denied', reason: '部屋から外れました' }); setTimeout(() => c.close(), 500); }
    this.members.splice(i, 1);
    this.broadcast();
    this.changed();
  }
  setSeats(n: number) { if (this.game) return; this.seats = Math.max(3, Math.min(6, Math.max(n, this.humans().length))); this.broadcast(); this.changed(); }
  setLevel(l: KdLevel) { if (this.game) return; this.level = l; this.broadcast(); this.changed(); }

  /** 始める（空いた席は AI）。seed はテスト用 */
  start(seed?: number): string | null {
    if (this.game) return null;
    for (const m of this.members.filter((x) => x.status === 'waiting')) this.approve(m.id, false);
    const humans = this.humans();
    const n = Math.max(3, this.seats, humans.length);
    const used = new Set(humans.map((m) => m.name));
    const ai = AI_NAMES.filter((x) => !used.has(x));
    const game: KdGame = {
      seed: seed ?? (crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000) + 1,
      n, level: this.level,
      seats: Array.from({ length: n }, (_, i) => humans[i]?.id ?? ''),
      names: Array.from({ length: n }, (_, i) => humans[i]?.name ?? ai[i - humans.length] ?? `AI${i + 1}`),
    };
    this.begin(game, []);
    this.broadcast();
    this.changed();
    return null;
  }

  private begin(game: KdGame, actions: [number, string, Action][]) {
    this.game = game;
    const humans = game.seats.map((id, i) => (id ? i : -1)).filter((i) => i >= 0);
    const ref = new KiridaniReferee({ n: game.n, seed: game.seed, humans, offerTimeoutMs: this.offerMs, levels: Array(game.n).fill(game.level), names: game.names });
    ref.start();
    // 読み込み直し：同じ答えを同じ順に渡して、同じところまで進める
    ref.replay(actions);
    this.referee = ref;
    ref.subscribe(() => { this.pushAll(); this.changed(); });
  }

  // ---- 試合中 ----
  private seatOf(memberId: string) { return this.game ? this.game.seats.indexOf(memberId) : -1; }

  act(memberId: string, id: string, a: Action): ActResult {
    const ref = this.referee, seat = this.seatOf(memberId);
    if (!ref || seat < 0) return { ok: false, error: '席がありません' };
    const r = ref.act(seat, id, a);
    if (r.ok) this.save();
    return r;
  }
  judge(memberId: string, b: number, give: Cost, get: Cost): TradeJudge {
    const ref = this.referee, seat = this.seatOf(memberId);
    if (!ref || seat < 0) return { ok: false, accept: false, gain: 0, error: '席がありません' };
    return ref.judge(seat, b, give, get);
  }

  /** ホスト自身の席の答え */
  hostAct(id: string, a: Action) { return this.act(this.me.id, id, a); }
  hostJudge(b: number, give: Cost, get: Cost) { return this.judge(this.me.id, b, give, get); }
  prompt(seat: number): Prompt | null { return this.referee?.prompt(seat) ?? null; }
  offerFor(seat: number) { return this.referee?.offerFor(seat) ?? null; }
  noteFor(seat: number) { return this.referee?.noteFor(seat) ?? null; }

  private send(conn: Conn, msg: KdToGuest) {
    try {
      const s = JSON.stringify(msg);
      if (conn.open && s.length <= KD_MAX_MSG) conn.send(s);
    } catch { /* 切断中 */ }
  }

  /** 参加者に、まだ送っていない出来事と、いまの問いを送る */
  private pushGame(m: Member) {
    const ref = this.referee, g = this.game;
    if (!ref || !g || !m.conn || m.status !== 'joined') return;
    const seat = g.seats.indexOf(m.id);
    if (seat < 0) return;
    const log = ref.logs[seat];
    let from = m.sent;
    do {
      const evs = log.slice(from, from + EV_CHUNK);
      const last = from + evs.length >= log.length;
      this.send(m.conn, { t: 'game', seat, names: g.names, from, evs, last, ...(last ? { prompt: ref.prompt(seat), wait: ref.waitingSeats(), done: ref.done, offer: ref.offerFor(seat), note: ref.noteFor(seat) } : {}) });
      from += evs.length;
    } while (from < log.length);
    m.sent = log.length;
  }
  private pushAll() { for (const m of this.members) this.pushGame(m); }

  /** 全員に部屋の様子（と試合中なら各自の情報）を送る */
  broadcast() {
    const lobby = this.lobby();
    for (const m of this.members) {
      if (!m.conn) continue;
      this.send(m.conn, { t: 'lobby', lobby });
      this.pushGame(m);
    }
  }
}
