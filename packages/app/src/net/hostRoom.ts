// ホスト：部屋を開き、参加者の接続を受け、審判（referee）でゲームを進めて、各席に見てよい情報だけを送る。
import Peer, { type DataConnection } from 'peerjs';
import { createMatch, handle, viewFor, type Command, type Level, type MatchState, type Result, type Seat } from '@midorino/engine';
import { MAX_MSG, PEER_PREFIX, peerOptions, randomHex, type LobbyMember, type LobbyState, type ToGuest, type ToHost } from './protocol';

interface Member extends LobbyMember { token: string; conn: DataConnection | null }
interface Saved { roomId: string; members: Omit<Member, 'conn' | 'online'>[]; match: MatchState | null; maxPlayers: number }
const KEY = 'midorino.host';

export class HostRoom {
  roomId: string;
  members: Member[] = [];
  match: MatchState | null = null;
  maxPlayers = 6;
  peer: Peer | null = null;
  status: 'connecting' | 'open' | 'error' = 'connecting';
  error = '';
  private listeners = new Set<() => void>();

  constructor(hostName: string, saved?: Saved) {
    if (saved) {
      this.roomId = saved.roomId;
      this.members = saved.members.map((m) => ({ ...m, conn: null, online: m.status === 'host' || m.status === 'ai' }));
      this.match = saved.match;
      this.maxPlayers = saved.maxPlayers;
    } else {
      this.roomId = randomHex(16);
      this.members = [{ id: randomHex(8), name: hostName, status: 'host', online: true, token: randomHex(16), conn: null }];
    }
  }

  static resume(): HostRoom | null {
    try {
      const s = localStorage.getItem(KEY);
      if (!s) return null;
      const saved = JSON.parse(s) as Saved;
      return new HostRoom('', saved);
    } catch { return null; }
  }
  static clear() { try { localStorage.removeItem(KEY); } catch { /* 無視 */ } }

  get me() { return this.members[0]; }
  get mySeat() { return this.match ? this.match.seats.findIndex((s) => s.id === this.me.id) : -1; }

  subscribe(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private changed() {
    this.save();
    this.listeners.forEach((f) => f());
  }
  private save() {
    try {
      const saved: Saved = {
        roomId: this.roomId, maxPlayers: this.maxPlayers, match: this.match,
        members: this.members.map(({ conn: _c, online: _o, ...m }) => m),
      };
      localStorage.setItem(KEY, JSON.stringify(saved));
    } catch { /* 保存できない環境 */ }
  }

  open() {
    this.peer = new Peer(PEER_PREFIX + this.roomId, peerOptions());
    this.peer.on('open', () => { this.status = 'open'; this.changed(); });
    this.peer.on('error', (e) => {
      this.error = String((e as { type?: string }).type ?? e);
      if (this.error === 'unavailable-id') this.error = '同じ部屋がほかの画面で開いています';
      this.status = 'error';
      this.changed();
    });
    this.peer.on('disconnected', () => { setTimeout(() => this.peer && !this.peer.destroyed && this.peer.reconnect(), 2000); });
    this.peer.on('connection', (conn) => this.accept(conn));
    this.changed();
  }

  close() { this.peer?.destroy(); this.peer = null; }

  lobby(): LobbyState {
    return {
      roomId: this.roomId, started: !!this.match, maxPlayers: this.maxPlayers,
      members: this.members.map(({ id, name, status, online }) => ({ id, name, status, online })),
    };
  }

  private accept(conn: DataConnection) {
    let member: Member | null = null;
    conn.on('data', (raw) => {
      if (typeof raw !== 'string' || raw.length > MAX_MSG) return;
      let msg: ToHost;
      try { msg = JSON.parse(raw); } catch { return; }
      if (!msg || typeof msg !== 'object') return;
      if (msg.t === 'hello') { member = this.hello(conn, msg); return; }
      if (msg.t === 'cmd' && member && member.status === 'joined') {
        const result = this.command(member.id, msg.cmd);
        this.send(conn, { t: 'result', reqId: Number(msg.reqId) || 0, result });
      }
    });
    conn.on('close', () => {
      if (member && member.conn === conn) { member.conn = null; member.online = false; this.broadcast(); this.changed(); }
    });
  }

  private hello(conn: DataConnection, msg: Extract<ToHost, { t: 'hello' }>): Member | null {
    const name = String(msg.name ?? '').trim().slice(0, 12) || 'ゲスト';
    if (msg.memberId && msg.token) {
      const m = this.members.find((x) => x.id === msg.memberId);
      if (m && m.token === msg.token && m.status !== 'host' && m.status !== 'ai') {
        m.conn?.close();
        m.conn = conn; m.online = true;
        this.send(conn, { t: 'welcome', memberId: m.id, token: m.token, status: m.status });
        this.broadcast();
        this.changed();
        return m;
      }
    }
    if (this.match) { this.send(conn, { t: 'denied', reason: 'ゲームはもう始まっています' }); return null; }
    if (this.members.filter((m) => m.status !== 'waiting').length >= this.maxPlayers) { this.send(conn, { t: 'denied', reason: '満員です' }); return null; }
    if (this.members.filter((m) => m.status === 'waiting').length >= 6) { this.send(conn, { t: 'denied', reason: '承認待ちの人が多すぎます' }); return null; }
    const m: Member = { id: randomHex(8), name, status: 'waiting', online: true, token: randomHex(16), conn };
    this.members.push(m);
    this.send(conn, { t: 'welcome', memberId: m.id, token: m.token, status: 'waiting' });
    this.broadcast();
    this.changed();
    return m;
  }

  // ---- ホストの操作 ----
  approve(id: string, ok: boolean) {
    const i = this.members.findIndex((m) => m.id === id && m.status === 'waiting');
    if (i < 0 || this.match) return;
    const m = this.members[i];
    if (ok && this.members.filter((x) => x.status !== 'waiting').length < this.maxPlayers) {
      m.status = 'joined';
      if (m.conn) this.send(m.conn, { t: 'welcome', memberId: m.id, token: m.token, status: 'joined' });
    } else {
      if (m.conn) { this.send(m.conn, { t: 'denied', reason: 'ホストが参加を見送りました' }); setTimeout(() => m.conn?.close(), 500); }
      this.members.splice(i, 1);
    }
    this.broadcast();
    this.changed();
  }
  kick(id: string) {
    if (this.match) return;
    const i = this.members.findIndex((m) => m.id === id && m.status !== 'host');
    if (i < 0) return;
    const m = this.members[i];
    if (m.conn) { this.send(m.conn, { t: 'denied', reason: '部屋から外れました' }); setTimeout(() => m.conn?.close(), 500); }
    this.members.splice(i, 1);
    this.broadcast();
    this.changed();
  }
  addAI(level: Level) {
    if (this.match || this.members.filter((m) => m.status !== 'waiting').length >= this.maxPlayers) return;
    const n = this.members.filter((m) => m.status === 'ai').length;
    this.members.push({ id: randomHex(8), name: `AI${n + 1}（${{ novice: 'やさしい', mid: 'ふつう', expert: 'つよい', random: 'でたらめ' }[level]}）`, status: 'ai', online: true, token: level, conn: null });
    this.broadcast();
    this.changed();
  }
  start(): string | null {
    const players = this.members.filter((m) => m.status !== 'waiting');
    if (players.length < 3) return '3人以上で始められます（AIを足すこともできます）';
    for (const m of this.members.filter((x) => x.status === 'waiting')) this.approve(m.id, false);
    const seats: Seat[] = players.map((m) => ({ name: m.name, id: m.id, ai: m.status === 'ai' ? (m.token as Level) : null }));
    this.match = createMatch(seats, crypto.getRandomValues(new Uint32Array(1))[0]);
    this.broadcast();
    this.changed();
    return null;
  }

  command(memberId: string, cmd: Command): Result {
    if (!this.match) return { ok: false, error: 'まだ始まっていません' };
    const seat = this.match.seats.findIndex((s) => s.id === memberId);
    if (seat < 0) return { ok: false, error: '席がありません' };
    if (!cmd || typeof cmd !== 'object') return { ok: false, error: '形式が正しくありません' };
    let r: Result;
    try { r = handle(this.match, seat, cmd); } catch { r = { ok: false, error: '処理できない操作です' }; }
    if (r.ok) { this.broadcast(); this.changed(); }
    return r;
  }

  private send(conn: DataConnection, msg: ToGuest) {
    try { if (conn.open) conn.send(JSON.stringify(msg)); } catch { /* 切断中 */ }
  }

  /** 全員に最新の情報を送る（ゲーム中は各自の席から見える情報だけ） */
  broadcast() {
    const lobby = this.lobby();
    for (const m of this.members) {
      if (!m.conn) continue;
      this.send(m.conn, { t: 'lobby', lobby });
      if (this.match && m.status === 'joined') {
        const seat = this.match.seats.findIndex((s) => s.id === m.id);
        if (seat >= 0) this.send(m.conn, { t: 'view', view: viewFor(this.match, seat) });
      }
    }
  }
}
