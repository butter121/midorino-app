// 演出の長さ（設計書「アニメーション仕様」の目安）と、速さ・自分に関係するか・1ラウンドの予算による調整
import type { EventType, GameEvent, Seat } from '../types';

export type Speed = 'normal' | 'fast' | 'minimal';
export const SPEEDS: Speed[] = ['normal', 'fast', 'minimal'];
export const SPEED_JP: Record<Speed, string> = { normal: '標準', fast: '速い', minimal: '最小' };

/** 以前の標準の長さ（ミリ秒）。0 はアニメなしで即時に状態だけ進める */
const BASE_V1: Record<EventType, number> = {
  game_start: 600,
  grant: 500, fate_shuffle: 0,
  draft_offer: 700, draft_pick: 400, char_offer: 700, char_pick: 700,
  round_start: 800, weather: 1000, boss_reveal: 900, monster_spawn: 500, monster_leave: 300, refill: 500, recover: 300,
  turn: 0, place: 400, gather: 600, pay: 300,
  play_card: 800, spell: 800, build: 500, hire: 800, train: 500, market: 600, draw: 600,
  combat_start: 500, power: 1000, fate_flip: 600, clash: 1000, hit: 400, counter: 300, injury: 500, heal: 400,
  loot: 600, trophy: 600, combat_end: 250,
  produce: 600, winter_start: 700, upkeep: 600, raid: 900, winter_end: 300,
  boss_appear: 2500, dragon_fail: 1200, quest_done: 800, fame: 400,
  market_reset: 400, round_end: 300, first_pass: 400,
  score: 7000, game_end: 600,
  familiar: 600, trap: 500, trade: 700, discard: 400, recall: 400, weather_set: 700, wait: 500,
};

/** 標準をゆっくりめにする倍率（「速い」がちょうど以前の標準になる） */
export const PACE = 1.5;
/** 集計は元から長いので伸ばしすぎない */
const PACE_CAP: Partial<Record<EventType, number>> = { score: 9000 };

/** 標準の長さ（ミリ秒）。0 はアニメなしで即時に状態だけ進める */
export const BASE_MS = Object.fromEntries(
  (Object.entries(BASE_V1) as [EventType, number][]).map(([t, ms]) => [t, Math.min(PACE_CAP[t] ?? Infinity, Math.round(ms * PACE))]),
) as Record<EventType, number>;

/** 最小の速さでも残す短い動き（「何が起きたか分かる」ための下限） */
export const MIN_MS = 200;
const MIN_SPECIAL: Partial<Record<EventType, number>> = { score: 2500, boss_appear: 700, round_start: 350, clash: 300, turn: 0 };
export const minMs = (t: EventType) => MIN_SPECIAL[t] ?? (BASE_MS[t] === 0 ? 0 : MIN_MS);

const SPEED_MUL: Record<Speed, number> = { normal: 1, fast: 1 / PACE, minimal: 0 };
/** 他の人の手番の演出は少し速めに流す */
export const OTHERS_MUL = 0.7;

/** 自分に関係する（しっかり見せる）出来事か */
export function concernsMe(ev: GameEvent, me: Seat): boolean {
  if (me < 0) return true;
  if ('seat' in ev) return ev.seat === me;
  if (ev.t === 'combat_start') return ev.seats.includes(me) || ev.boss;
  return true; // 全体の出来事（ラウンド開始・天候・集計など）
}

/** 1つの出来事の長さ（予算で縮める前） */
export function eventMs(ev: GameEvent, speed: Speed, me: Seat, inMyCombat = false): number {
  const base = BASE_MS[ev.t];
  if (base === 0) return 0;
  const lo = minMs(ev.t);
  if (speed === 'minimal') return lo;
  let ms = base * SPEED_MUL[speed];
  // 襲撃・横取り・取引など自分に関係するものは速めない
  if (!concernsMe(ev, me) && !inMyCombat) ms *= OTHERS_MUL;
  return Math.max(lo, Math.round(ms));
}

/** 1ラウンドの演出の上限（6人でも約1分半） */
export const ROUND_BUDGET_MS = 90_000;

/**
 * 予算に収まるよう縮める倍率。spent=このラウンドで既に使った時間, pending=残りの出来事の（縮める前の）長さと下限。
 * 下限ぶんは縮められないので、縮められる部分（ms - min）だけに倍率をかける。
 */
export function compressFactor(spent: number, pending: { ms: number; min: number }[], budget = ROUND_BUDGET_MS): number {
  const total = pending.reduce((a, x) => a + x.ms, 0);
  const floor = pending.reduce((a, x) => a + x.min, 0);
  const left = budget - spent;
  if (spent + total <= budget) return 1;
  if (left <= floor) return 0;
  return (left - floor) / Math.max(1, total - floor);
}

export const compress = (ms: number, min: number, f: number) => (ms <= min ? ms : Math.round(min + (ms - min) * f));
