// 霧谷 v2 — 出来事ごとの演出の長さ（v1 の timing.ts と同じ考え。速さ・自分に関係するか・1ラウンドの予算は AnimQueue が扱う）
import { PACE, OTHERS_MUL, MIN_MS, type Speed } from '../kiridani/anim/timing';
import type { Ev, Seat } from './view';

const BASE: Record<string, number> = {
  sync: 0, game_start: 600, leader_offer: 500, leader_pick: 600, draft_offer: 300, draft_pick: 300, ratio: 0, secret_quest: 0, grant: 500,
  round_start: 800, stage_reveal: 1100, refill: 500, future: 400, equip: 0, monster_spawn: 500, monster_forecast: 0, boss_reveal: 1200,
  turn: 0, place: 400, gather: 600, gain: 400, pay: 300, effect: 300, play_card: 700, spell: 700, craft: 600, build: 500, hire: 700, train: 500,
  market: 600, trade: 700, donate: 600, draw: 500,
  combat_start: 500, power: 1000, fate_flip: 600, clash: 1000, counter: 300, injury: 500, heal: 400, loot: 600, trophy: 600, tame: 600, wait: 500, combat_end: 250,
  winter_start: 700, upkeep: 600, raid: 900, winter_end: 300, quest_done: 800, fame: 400, first_pass: 400, round_end: 300, score: 7000, game_end: 600,
};
const MIN_SPECIAL: Record<string, number> = { score: 2500, round_start: 350, clash: 300, stage_reveal: 400, boss_reveal: 400 };

export const minMs2 = (t: string) => MIN_SPECIAL[t] ?? ((BASE[t] ?? 0) === 0 ? 0 : MIN_MS);

const concerns = (ev: Ev, me: Seat) => {
  if (me < 0) return true;
  if ('seat' in ev) return ev.seat === me;
  if (ev.t === 'combat_start') return ev.seats.includes(me) || ev.monster.boss;
  return true;
};

export function eventMs2(ev: Ev, speed: Speed, me: Seat, inMyCombat = false): number {
  const base = Math.min(9000, Math.round((BASE[ev.t] ?? 0) * PACE));
  if (!base) return 0;
  const lo = minMs2(ev.t);
  if (speed === 'minimal') return lo;
  let ms = speed === 'fast' ? base / PACE : base;
  if (!concerns(ev, me) && !inMyCombat) ms *= OTHERS_MUL;
  return Math.max(lo, Math.round(ms));
}
