// PeerJS で Net（transport.ts）を作る。ホストは部屋の ID で待ち受け、参加者は ID につなぐ。
import Peer, { type DataConnection } from 'peerjs';
import { PEER_PREFIX, peerOptions } from './protocol';
import { Pipe, type Net } from './transport';

/** 霧谷の部屋の ID（ミドリノの部屋とは別の名前空間） */
const KD_PREFIX = PEER_PREFIX.replace('midorino', 'kiridani');

function attach(p: Pipe, dc: DataConnection) {
  p.setOut((s) => { try { if (dc.open) dc.send(s); } catch { /* 切断中 */ } }, () => dc.close());
  dc.on('open', () => p.fireOpen());
  dc.on('data', (raw) => { if (typeof raw === 'string') p.fireData(raw); });
  dc.on('close', () => p.fireClose());
  dc.on('error', () => p.fireClose());
  if (dc.open) p.fireOpen();
}

const errText = (e: unknown) => {
  const type = (e as { type?: string }).type;
  if (type === 'peer-unavailable') return 'ホストが見つかりません（ホストが部屋を開いているか確認してください）';
  if (type === 'unavailable-id') return '同じ部屋がほかの画面で開いています';
  if (type === 'network' || type === 'server-error' || type === 'socket-error') return '通信サーバーにつながりません';
  return `通信エラー（${type ?? e}）`;
};

export function peerNet(): Net {
  let guest: Peer | null = null;
  let current: { pipe: Pipe; onError: (m: string) => void } | null = null;
  return {
    listen(roomId, h) {
      const peer = new Peer(KD_PREFIX + roomId, peerOptions());
      peer.on('open', () => h.onStatus('open'));
      peer.on('error', (e) => h.onStatus('error', errText(e)));
      peer.on('disconnected', () => { setTimeout(() => { if (!peer.destroyed && peer.disconnected) peer.reconnect(); }, 2000); });
      peer.on('connection', (dc) => { const p = new Pipe(); attach(p, dc); h.onConn(p); });
      return { close: () => peer.destroy() };
    },
    dial(roomId, h) {
      const pipe = new Pipe();
      current = { pipe, onError: h.onError };
      const go = () => { if (current?.pipe === pipe && !pipe.closed) attach(pipe, guest!.connect(KD_PREFIX + roomId, { reliable: true })); };
      if (!guest || guest.destroyed) {
        guest = new Peer(peerOptions());
        guest.on('open', () => go());
        guest.on('error', (e) => { const c = current; if (c) { c.onError(errText(e)); c.pipe.fireClose(); } });
      } else if (guest.disconnected) { guest.once('open', go); guest.reconnect(); }
      else if (guest.open) go();
      else guest.once('open', go);
      return pipe;
    },
  };
}
