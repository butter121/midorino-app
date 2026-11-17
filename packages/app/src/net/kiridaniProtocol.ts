// 霧谷の冒険者団：ホストと参加者のあいだのメッセージ（すべて JSON）。部屋の流れ（hello → 承認 → 開始）はミドリノと同じ。
// ゲーム中、参加者が送るのは「答え（Action）」と「取引の見込みの問い合わせ」だけ。ホストは席ごとに隠した出来事と問いを送る。
import type { Action, ActResult, Cost, GameEvent, OfferNote, OfferView, Prompt, TradeJudge } from '@midorino/engine/src/kiridani';
import type { LobbyMember } from './protocol';
import type { ChatMsg } from './chat';

export type KdLevel = 'novice' | 'mid' | 'expert';
export interface KdLobby { roomId: string; members: LobbyMember[]; started: boolean; seats: number; level: KdLevel }

/** 参加者 → ホスト */
export type KdToHost =
  | { t: 'hello'; name: string; memberId?: string; token?: string }
  | { t: 'act'; reqId: number; id: string; a: Action }
  | { t: 'judge'; reqId: number; b: number; give: Cost; get: Cost }
  /** 出来事が飛んだので、have 件目から送り直してほしい */
  | { t: 'sync'; have: number }
  /** チャット（stamp はひと言スタンプ）。返事は result で届く */
  | { t: 'chat'; reqId: number; text: string; stamp?: boolean };

/** ホスト → 参加者 */
export type KdToGuest =
  | { t: 'welcome'; memberId: string; token: string; status: LobbyMember['status'] }
  | { t: 'lobby'; lobby: KdLobby }
  /** from 件目からの出来事。last のときだけ問い・待っている席・人どうしの取引の申し込みとお知らせ（当事者だけ）が付く */
  | { t: 'game'; seat: number; names: string[]; from: number; evs: GameEvent[]; last: boolean; prompt?: Prompt | null; wait?: number[]; done?: boolean; offer?: OfferView | null; note?: OfferNote | null }
  | { t: 'result'; reqId: number; result: ActResult }
  | { t: 'judged'; reqId: number; j: TradeJudge }
  | { t: 'denied'; reason: string }
  /** チャット：reset のときはこれまでの分（つなぎ直し）、そうでなければ新しい分 */
  | { t: 'chat'; msgs: ChatMsg[]; reset?: boolean }
  /** ホストが部屋を閉じた */
  | { t: 'closed'; reason: string };

/** 1通に入れる出来事の数（PeerJS の1通を小さく保つ） */
export const EV_CHUNK = 250;
/** 受け取る1通の上限（盤面の写しが 20KB ほど） */
export const KD_MAX_MSG = 256 * 1024;
