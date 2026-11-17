// 通信の手段（ホストと参加者のあいだの1本の線）。本番は PeerJS（peerNet.ts）、テストは同じ JS の中でつなぐ memoryNet。
// 霧谷のホスト・参加者（kiridaniHost.ts / kiridaniGuest.ts）はこの形だけを使う。

/** 1本の接続。文字列（JSON）だけを送る */
export interface Conn {
  readonly open: boolean;
  send(data: string): void;
  close(): void;
  onOpen(fn: () => void): void;
  onData(fn: (data: string) => void): void;
  onClose(fn: () => void): void;
}

export interface Net {
  /** ホストとして部屋を開く */
  listen(roomId: string, h: { onConn: (c: Conn) => void; onStatus: (s: 'open' | 'error', msg?: string) => void }): { close(): void };
  /** 参加者として部屋につなぐ（つながらなければ onError のあと close が届く） */
  dial(roomId: string, h: { onError: (msg: string) => void }): Conn;
}

/** 線の片側（受け手を後から付けられる） */
export class Pipe implements Conn {
  open = false;
  closed = false;
  private o: (() => void)[] = [];
  private d: ((s: string) => void)[] = [];
  private c: (() => void)[] = [];
  constructor(private out: (s: string) => void = () => {}, private shut: () => void = () => {}) {}
  setOut(out: (s: string) => void, shut: () => void) { this.out = out; this.shut = shut; }
  send(s: string) { if (this.open) this.out(s); }
  close() { if (this.closed) return; this.shut(); this.fireClose(); }
  onOpen(fn: () => void) { this.o.push(fn); }
  onData(fn: (s: string) => void) { this.d.push(fn); }
  onClose(fn: () => void) { this.c.push(fn); }
  fireOpen() { if (this.closed) return; this.open = true; this.o.forEach((f) => f()); }
  fireData(s: string) { if (this.open) this.d.forEach((f) => f(s)); }
  fireClose() { if (this.closed) return; this.closed = true; this.open = false; this.c.forEach((f) => f()); }
}

/** 同じ JS の中だけでつなぐ（テスト用）。届くのは次の tick（本物の通信と同じく非同期） */
export function memoryNet() {
  const rooms = new Map<string, { onConn: (c: Conn) => void; conns: Set<Pipe> }>();
  const later = (f: () => void) => setTimeout(f, 0);
  const net: Net & { kill(roomId: string): void; drop(roomId: string): void; rooms: typeof rooms } = {
    rooms,
    listen(roomId, h) {
      const room = { onConn: h.onConn, conns: new Set<Pipe>() };
      rooms.set(roomId, room);
      later(() => h.onStatus('open'));
      return { close: () => { if (rooms.get(roomId) === room) rooms.delete(roomId); room.conns.forEach((c) => c.close()); } };
    },
    dial(roomId, h) {
      const a = new Pipe();
      later(() => {
        const room = rooms.get(roomId);
        if (!room) { h.onError('ホストが見つかりません'); a.fireClose(); return; }
        const b = new Pipe();
        a.setOut((s) => later(() => b.fireData(s)), () => later(() => b.fireClose()));
        b.setOut((s) => later(() => a.fireData(s)), () => later(() => a.fireClose()));
        room.conns.add(b);
        b.onClose(() => room.conns.delete(b));
        room.onConn(b);
        b.fireOpen();
        later(() => a.fireOpen());
      });
      return a;
    },
    /** ホストが消える（部屋も閉じる） */
    kill(roomId) { const r = rooms.get(roomId); rooms.delete(roomId); r?.conns.forEach((c) => c.close()); },
    /** 接続だけ切る（部屋は残る：参加者の再接続のテスト） */
    drop(roomId) { rooms.get(roomId)?.conns.forEach((c) => c.close()); },
  };
  return net;
}
