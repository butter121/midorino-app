// 参加者：ホストにつなぎ、自分用の情報（view）を受け取り、操作をホストに送る。切れたら自動でつなぎ直す。
import Peer, { type DataConnection } from 'peerjs';
import type { Command, MatchView, Result } from '@midorino/engine';
import { MAX_MSG, PEER_PREFIX, peerOptions, type LobbyState, type ToGuest, type ToHost } from './protocol';

const keyFor = (roomId: string) => `midorino.guest.${roomId}`;

export class GuestClient {
  status: 'connecting' | 'waiting' | 'joined' | 'denied' | 'offline' = 'connecting';
  reason = '';
  lobby: LobbyState | null = null;
  view: MatchView | null = null;
  memberId: string | null = null;
  private token: string | null = null;
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private reqId = 0;
  private pending = new Map<number, (r: Result) => void>();
  private listeners = new Set<() => void>();
  private retry = 0;
  private closed = false;

  constructor(public roomId: string, public name: string) {
    try {
      const s = localStorage.getItem(keyFor(roomId));
      if (s) { const { memberId, token } = JSON.parse(s); this.memberId = memberId; this.token = token; }
    } catch { /* 無視 */ }
  }

  subscribe(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private changed() { this.listeners.forEach((f) => f()); }

  connect() {
    this.closed = false;
    this.peer = new Peer(peerOptions());
    this.peer.on('open', () => this.dial());
    this.peer.on('error', (e) => {
      const type = (e as { type?: string }).type;
      if (type === 'peer-unavailable') { this.status = 'offline'; this.reason = 'ホストが見つかりません（ホストがアプリを開いているか確認してください）'; }
      else { this.status = 'offline'; this.reason = `通信エラー（${type ?? e}）`; }
      this.changed();
      this.scheduleRetry();
    });
  }

  private dial() {
    if (!this.peer || this.closed) return;
    const conn = this.peer.connect(PEER_PREFIX + this.roomId, { reliable: true });
    this.conn = conn;
    conn.on('open', () => {
      this.retry = 0;
      const hello: ToHost = { t: 'hello', name: this.name, ...(this.memberId && this.token ? { memberId: this.memberId, token: this.token } : {}) };
      conn.send(JSON.stringify(hello));
    });
    conn.on('data', (raw) => {
      if (typeof raw !== 'string' || raw.length > 4 * MAX_MSG) return;
      let msg: ToGuest;
      try { msg = JSON.parse(raw); } catch { return; }
      this.onMessage(msg);
    });
    conn.on('close', () => {
      if (this.closed || this.status === 'denied') return;
      this.status = 'offline'; this.reason = 'ホストとの接続が切れました。つなぎ直しています…';
      this.changed();
      this.scheduleRetry();
    });
  }

  private scheduleRetry() {
    if (this.closed || this.status === 'denied') return;
    const wait = Math.min(15000, 1000 * 2 ** this.retry++);
    setTimeout(() => {
      if (this.closed) return;
      if (!this.peer || this.peer.destroyed) this.connect();
      else if (this.peer.disconnected) this.peer.reconnect();
      else this.dial();
    }, wait);
  }

  private onMessage(msg: ToGuest) {
    switch (msg.t) {
      case 'welcome':
        this.memberId = msg.memberId; this.token = msg.token;
        try { localStorage.setItem(keyFor(this.roomId), JSON.stringify({ memberId: msg.memberId, token: msg.token })); } catch { /* 無視 */ }
        this.status = msg.status === 'joined' ? 'joined' : 'waiting';
        break;
      case 'lobby': this.lobby = msg.lobby; break;
      case 'view': this.view = msg.view; break;
      case 'result': this.pending.get(msg.reqId)?.(msg.result); this.pending.delete(msg.reqId); break;
      case 'denied':
        this.status = 'denied'; this.reason = msg.reason;
        try { localStorage.removeItem(keyFor(this.roomId)); } catch { /* 無視 */ }
        break;
    }
    this.changed();
  }

  send(cmd: Command): Promise<Result> {
    return new Promise((resolve) => {
      if (!this.conn?.open) { resolve({ ok: false, error: '接続が切れています' }); return; }
      const reqId = ++this.reqId;
      this.pending.set(reqId, resolve);
      this.conn.send(JSON.stringify({ t: 'cmd', cmd, reqId } satisfies ToHost));
      setTimeout(() => { if (this.pending.delete(reqId)) resolve({ ok: false, error: '応答がありません' }); }, 10000);
    });
  }

  close() { this.closed = true; this.peer?.destroy(); }
}
