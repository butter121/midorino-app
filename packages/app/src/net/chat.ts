// 霧谷の冒険者団：オンライン対戦のチャット（ホストが受け取り、整えて全員に配る）。ゲームの状態・審判の記録には入らない。
export interface ChatMsg {
  /** ホストが付ける通し番号 */
  id: number;
  /** 色に使う席（ゲーム中の席。待合室では参加者の並び順で、始まったあとの席と同じ） */
  seat: number;
  name: string;
  text: string;
  /** ホストの時計（ミリ秒） */
  at: number;
  /** ひと言スタンプ */
  stamp?: boolean;
}

export const CHAT_MAX_LEN = 100;
export const CHAT_KEEP = 100;
export const CHAT_RATE = { count: 5, ms: 10_000 };
export const CHAT_STAMPS = ['よろしく！', 'ナイス！', 'ありがとう', 'ちょっと待って', 'ごめん'];

/** 文字を整える：制御文字・向きを変える文字を除き、空白をまとめ、前後を削って 100 文字まで。空なら null */
export function sanitizeChat(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁯﻿]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return null;
  return [...s].slice(0, CHAT_MAX_LEN).join('');
}

/** 人ごとの送信の回数制限（ms のあいだに count 通まで） */
export class ChatLimiter {
  private sent = new Map<string, number[]>();
  constructor(private count = CHAT_RATE.count, private ms = CHAT_RATE.ms) {}
  allow(key: string, now: number): boolean {
    const xs = (this.sent.get(key) ?? []).filter((t) => now - t < this.ms);
    if (xs.length >= this.count) { this.sent.set(key, xs); return false; }
    xs.push(now);
    this.sent.set(key, xs);
    return true;
  }
}
