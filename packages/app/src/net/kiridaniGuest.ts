// 霧谷の冒険者団：参加者。ホストにつなぎ、自分の席の出来事と問いを受け取り、答えをホストに送る。
// 切れたら自動でつなぎ直す（読み込み直しても、保存した合言葉で同じ席に戻る）。ホストが部屋を閉じたら知らせる。
import type { Action, ActResult, Cost, GameEvent, OfferNote, OfferView, Prompt, TradeJudge } from '@midorino/engine/src/kiridani';
import { KD_MAX_MSG, type KdLobby, type KdToGuest, type KdToHost } from './kiridaniProtocol';
import type { Conn, Net } from './transport';

const keyFor = (roomId: string) => `kiridani.guest.${roomId}`;
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
const defaultStore = (): Store => { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } };

export class KdGuestClient {
  status: 'connecting' | 'waiting' | 'joined' | 'denied' | 'offline' | 'closed' = 'connecting';
  reason = '';
  lobby: KdLobby | null = null;
  memberId: string | null = null;
  seat = -1;
  names: string[] = [];
  events: GameEvent[] = [];
  prompt: Prompt | null = null;
  wait: number[] = [];
  done = false;
  /** 人どうしの取引の申し込み（自分が申し込んだ・申し込まれた） */
  offer: OfferView | null = null;
  /** 取引の結果のお知らせ */
  note: OfferNote | null = null;
  private token: string | null = null;
  private conn: Conn | null = null;
  private reqId = 0;
  private pending = new Map<number, (r: unknown) => void>();
  private listeners = new Set<() => void>();
  private retry = 0;
  private closed = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private store: Store;

  constructor(private net: Net, public roomId: string, public name: string, opts: { store?: Store; retryMs?: number } = {}) {
    this.store = opts.store === undefined ? defaultStore() : opts.store;
    this.retryMs = opts.retryMs ?? 1000;
    try {
      const s = this.store?.getItem(keyFor(roomId));
      if (s) { const { memberId, token, name: nm } = JSON.parse(s); this.memberId = memberId; this.token = token; if (!name && nm) this.name = nm; }
    } catch { /* 無視 */ }
  }
  private retryMs: number;

  /** この部屋に前に入ったことがあるか（読み込み直し） */
  get known() { return !!(this.memberId && this.token); }
  get started() { return this.seat >= 0; }

  subscribe(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private changed() { this.listeners.forEach((f) => f()); }

  connect() {
    if (this.closed || this.conn) return;
    const conn = this.net.dial(this.roomId, { onError: (m) => { this.reason = m; } });
    this.conn = conn;
    conn.onOpen(() => {
      this.retry = 0;
      const hello: KdToHost = { t: 'hello', name: this.name, ...(this.memberId && this.token ? { memberId: this.memberId, token: this.token } : {}) };
      conn.send(JSON.stringify(hello));
    });
    conn.onData((raw) => {
      if (this.conn !== conn || typeof raw !== 'string' || raw.length > KD_MAX_MSG) return;
      let msg: KdToGuest;
      try { msg = JSON.parse(raw); } catch { return; }
      this.onMessage(msg);
    });
    conn.onClose(() => {
      if (this.conn !== conn) return;
      this.conn = null;
      for (const f of this.pending.values()) f(null);
      this.pending.clear();
      if (this.closed || this.status === 'denied' || this.status === 'closed') return;
      this.status = 'offline';
      if (!this.reason) this.reason = 'ホストとの接続が切れました。つなぎ直しています…';
      this.changed();
      this.scheduleRetry();
    });
  }

  private scheduleRetry() {
    if (this.closed || this.timer) return;
    const wait = Math.min(15000, this.retryMs * 2 ** this.retry++);
    this.timer = setTimeout(() => { this.timer = null; if (!this.closed) this.connect(); }, wait);
  }

  private onMessage(msg: KdToGuest) {
    switch (msg.t) {
      case 'welcome':
        this.memberId = msg.memberId; this.token = msg.token; this.reason = '';
        try { this.store?.setItem(keyFor(this.roomId), JSON.stringify({ memberId: msg.memberId, token: msg.token, name: this.name })); } catch { /* 無視 */ }
        this.status = msg.status === 'joined' ? 'joined' : 'waiting';
        break;
      case 'lobby': this.lobby = msg.lobby; break;
      case 'game': {
        this.seat = msg.seat; this.names = msg.names;
        const have = this.events.length;
        if (msg.from > have) { this.conn?.send(JSON.stringify({ t: 'sync', have } satisfies KdToHost)); return; }
        const add = msg.evs.slice(have - msg.from);
        if (add.length) this.events = [...this.events, ...add];
        if (msg.last) {
          const p = msg.prompt ?? null;
          // 同じ問いなら同じものを使い続ける（開いているトレイを閉じない）
          if (!p || !this.prompt || p.id !== this.prompt.id) this.prompt = p;
          this.wait = msg.wait ?? [];
          this.done = !!msg.done;
          const of = msg.offer ?? null;
          if (!of || !this.offer || of.id !== this.offer.id) this.offer = of;
          const nt = msg.note ?? null;
          if (!nt || !this.note || nt.id !== this.note.id || nt.text !== this.note.text) this.note = nt;
        }
        break;
      }
      case 'result': case 'judged': {
        const f = this.pending.get(msg.reqId);
        this.pending.delete(msg.reqId);
        f?.(msg.t === 'result' ? msg.result : msg.j);
        return;
      }
      case 'denied':
        this.status = 'denied'; this.reason = msg.reason;
        try { this.store?.removeItem(keyFor(this.roomId)); } catch { /* 無視 */ }
        break;
      case 'closed':
        this.status = 'closed'; this.reason = msg.reason;
        try { this.store?.removeItem(keyFor(this.roomId)); } catch { /* 無視 */ }
        this.closed = true;
        this.conn?.close();
        break;
    }
    this.changed();
  }

  private request<T>(body: Record<string, unknown>, fail: T): Promise<T> {
    return new Promise((resolve) => {
      const conn = this.conn;
      if (!conn?.open) { resolve(fail); return; }
      const reqId = ++this.reqId;
      this.pending.set(reqId, (r) => resolve((r as T) ?? fail));
      conn.send(JSON.stringify({ ...body, reqId }));
      setTimeout(() => { if (this.pending.delete(reqId)) resolve(fail); }, 10000);
    });
  }

  act(id: string, a: Action): Promise<ActResult> {
    return this.request<ActResult>({ t: 'act', id, a }, { ok: false, error: 'ホストに届きませんでした' });
  }
  judge(b: number, give: Cost, get: Cost): Promise<TradeJudge> {
    return this.request<TradeJudge>({ t: 'judge', b, give, get }, { ok: false, accept: false, gain: 0, error: 'ホストに届きませんでした' });
  }

  close() {
    this.closed = true;
    if (this.timer) clearTimeout(this.timer);
    this.conn?.close();
  }
}
