// 霧谷の冒険者団 v2 — カードを短く書くための小さな道具（再設計のカード用）
import type { CardDef, CardKind, Cond, Cost, Effect, EngineTag, Mech, Mod, Op, StatKey } from '../types';

type Lim = Effect['limit'];
/** when・do・条件・回数 */
export const on = (when: string, d: Op[], cond?: Cond, limit?: Lim): Effect => ({ when: when as Effect['when'], do: d, ...(cond ? { if: cond } : {}), ...(limit ? { limit } : {}) });
export const fight = (d: Op[], cond?: Cond, limit?: Lim) => on('fight', d, cond, limit);
export const win = (d: Op[], cond?: Cond, limit?: Lim) => on('win', d, cond, limit);
export const hit = (d: Op[], cond?: Cond, limit?: Lim) => on('hit', d, cond, limit);
export const play = (d: Op[], cond?: Cond) => on('play', d, cond);
export const end = (d: Op[], cond?: Cond) => on('game_end', d, cond);
export const passive = (mod: Mod, cond?: Cond): Effect => ({ when: 'passive', mod, ...(cond ? { if: cond } : {}) });
/** 数に応じた名声・戦力 */
export const famePer = (stat: StatKey, per: number, max?: number): Op => ({ fame_per: { stat, per, ...(max !== undefined ? { max } : {}) } });
export const powPer = (stat: StatKey, per: number, mult = 1, max?: number): Op => ({ power_per: { stat, per, ...(mult !== 1 ? { mult } : {}), ...(max !== undefined ? { max } : {}) } });

export interface X { fame?: number; two_hand?: boolean; leader_only?: boolean; guard?: number; power?: number; weight?: CardDef['weight']; mech?: Mech; mods?: Mod; prereq?: CardDef['prereq'] }
export function mk(kind: CardKind, id: string, name: string, engine: EngineTag[], cost: Cost, effects: Effect[], x: X = {}): CardDef {
  const slot = kind === 'weapon' ? 'weapon' : kind === 'armor' ? 'armor' : undefined;
  return { id, kind, name, engine, mech: x.mech ?? 'combat', cost, ...(slot ? { slot } : {}), effects, text: '', ...x } as CardDef;
}
/** 武器（戦力 pw） */
export const W = (id: string, name: string, engine: EngineTag[], cost: Cost, pw: number, effects: Effect[] = [], x: X = {}) => mk('weapon', id, name, engine, cost, effects, { power: pw, ...x });
/** 防具（守り gd） */
export const A = (id: string, name: string, engine: EngineTag[], cost: Cost, gd: number, effects: Effect[] = [], x: X = {}) => mk('armor', id, name, engine, cost, effects, { guard: gd, ...x });
/** 道具 */
export const T = (id: string, name: string, engine: EngineTag[], cost: Cost, effects: Effect[], x: X = {}) => mk('tool', id, name, engine, cost, effects, { mech: 'boost', ...x });
/** 使い切りの秘術（唱える魔石 mana） */
export const S = (id: string, name: string, engine: EngineTag[], cost: Cost, effects: Effect[], x: X = {}) => mk('spell', id, name, engine, cost, effects, { mech: 'boost', ...x });
/** 何度でもの秘術（身につける learn、1手番に uses 回、唱える cost） */
export const TM = (id: string, name: string, engine: EngineTag[], learn: Cost, uses: number, cost: Cost, effects: Effect[], x: X = {}): CardDef =>
  ({ ...mk('spell', id, name, engine, cost, effects, { mech: 'boost', ...x }), tome: { learn, uses } });
/** 職能 */
export const O = (id: string, name: string, engine: EngineTag[], effects: Effect[], x: X & { cost?: Cost } = {}) => mk('occ', id, name, engine, x.cost ?? {}, effects, { mech: 'boost', ...x });
/** リーダー */
export const L = (id: string, name: string, engine: EngineTag[], effects: Effect[], x: X = {}) => mk('leader', id, name, engine, {}, effects, { mech: 'boost', ...x });
