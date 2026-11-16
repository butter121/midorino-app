// ホストと参加者のあいだでやりとりするメッセージ。すべて JSON。
import type { Command, MatchView, Result } from '@midorino/engine';

export interface LobbyMember {
  id: string;                       // 参加者ID（ホストが発行。席の持ち主の確認に使う）
  name: string;
  status: 'host' | 'joined' | 'waiting' | 'ai';
  online: boolean;
}
export interface LobbyState { roomId: string; members: LobbyMember[]; started: boolean; maxPlayers: number }

/** 参加者 → ホスト */
export type ToHost =
  | { t: 'hello'; name: string; memberId?: string; token?: string }   // 初回は memberId/token なし
  | { t: 'cmd'; cmd: Command; reqId: number };

/** ホスト → 参加者 */
export type ToGuest =
  | { t: 'welcome'; memberId: string; token: string; status: LobbyMember['status'] }
  | { t: 'lobby'; lobby: LobbyState }
  | { t: 'view'; view: MatchView }
  | { t: 'result'; reqId: number; result: Result }
  | { t: 'denied'; reason: string };

export const PEER_PREFIX = 'midorino-v1-';
export const MAX_MSG = 64 * 1024;

export function randomHex(bytes: number) {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export function inviteUrl(roomId: string) {
  const base = location.origin + location.pathname;
  return `${base}#join=${roomId}`;     // # 以降はサーバーに送られない
}

export function roomFromHash(): string | null {
  const m = /join=([0-9a-f]{32})/.exec(location.hash);
  return m ? m[1] : null;
}

/** PeerJS の接続先。通常は PeerJS の無料公開サーバー。テストや自前サーバーのときだけ環境変数で切り替える */
export function peerOptions() {
  const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env;
  if (!env.VITE_PEER_HOST) return {};
  return { host: env.VITE_PEER_HOST, port: Number(env.VITE_PEER_PORT ?? 443), path: env.VITE_PEER_PATH ?? '/', secure: env.VITE_PEER_SECURE !== 'false' };
}
