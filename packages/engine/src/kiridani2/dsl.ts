// 霧谷の冒険者団 v2 — 効果 DSL（§8）の読み取り：形の確認（知らない op は例外）、条件の判定、mod の合計。
// 実行（do の手順）はエンジン（engine.ts の runOps）が行う。
import type { CardDef, Cond, Cost, Effect, Mod, Op, Race, Res, Season, StatKey } from './types';
import { RACES, RES } from './types';

export class DslError extends Error {
  constructor(msg: string) { super(msg); this.name = 'DslError'; }
}

export const WHEN_FIXED = new Set([
  'use', 'fight', 'win', 'lose', 'round_start', 'round_end', 'winter', 'game_end', 'setup',
  'build', 'hire', 'craft', 'sell', 'buy', 'trade', 'donate', 'spell', 'tame', 'play', 'passive', 'occ', 'quest', 'hit', 'injure',
]);
export const WHEN_PREFIX = ['use:', 'instead:', 'other:', 'win_race:'];

export const OP_KEYS = new Set([
  'gain', 'pay', 'convert', 'fame', 'power', 'guard', 'counter', 'loot', 'trophy', 'str', 'no_injury',
  'extra_worker', 'place_again', 'ignore_full', 'future', 'draw', 'hire', 'hire_free', 'tame', 'train', 'build', 'heal',
  'steal_gain', 'craft', 'occ', 'exchange', 'first', 'donate', 'fame_per', 'gain_per', 'others_gain',
  'power_per', 'lose', 'injure', 'scrap', 'shard', 'buy_card', 'draw_any',
]);
/** 戦闘中だけ意味のある op */
export const FIGHT_OPS = new Set(['power', 'guard', 'counter', 'loot', 'trophy', 'str', 'no_injury', 'tame', 'power_per']);
/** 選択肢を広げる op（最初の1つは置く場所の選択肢に広げ、2つ目からは実行のときに聞く） */
export const EXPAND_OPS = new Set(['craft', 'occ', 'build', 'exchange', 'train', 'scrap']);

export const MOD_KEYS = new Set([
  'market_qty', 'market_both', 'trade_count', 'accum_bonus', 'cost_discount', 'upkeep', 'donate_rate', 'base_guard', 'pet_power',
  'hand_limit', 'power', 'heal_discount', 'sell_bonus', 'bed_cap',
  'cost_extra', 'pet_cap', 'pet_bring', 'capture_ease', 'gold_mana', 'gold_cap', 'gold_div', 'sell_full', 'shard_need', 'ancient_look',
  'spell_return', 'comp_cap', 'occ_food', 'two_hand_armor', 'rage', 'no_atk_train', 'tool_yield', 'leader_no_weapon',
]);
export const COND_KEYS = new Set(['season', 'min', 'max', 'race', 'coop', 'k_min', 'k_max', 'boss', 'has', 'res_min', 't_min', 't_max']);
export const STAT_KEYS = new Set<StatKey>([
  'comps', 'occs', 'walls', 'beds', 'facilities', 'gear', 'pets', 'kills', 'races', 'trophies', 'hand', 'ancient', 'quests', 'skills',
  'injured', 'boss', 'coop', 'spells', 'donations', 'trades', 'year', 'round',
  'weapons', 'armors', 'tools', 'tomes', 'casts', 'shards', 'kinds', 'sold', 'gold', 'atk', 'def', 'dmg',
  'sent_atk', 'sent_wpow', 'sent_k', 'exposed', 'casts_round',
]);
/** 戦闘中だけ数える stat（fight の環境がないと 0） */
export const FIGHT_STATS = new Set<StatKey>(['sent_atk', 'sent_wpow', 'sent_k', 'exposed']);
const DRAW_FROM = new Set(['occ', 'item', 'equip', 'weapon', 'armor', 'tool', 'spell', 'ancient']);
const DRAW_ANY_FROM = new Set(['occ', 'weapon', 'armor', 'tool', 'spell']);

function checkCost(c: unknown, where: string) {
  if (!c || typeof c !== 'object') throw new DslError(`${where}: cost must be an object`);
  for (const [k, v] of Object.entries(c)) {
    if (!RES.includes(k as Res)) throw new DslError(`${where}: unknown resource "${k}"`);
    if (typeof v !== 'number') throw new DslError(`${where}: amount of ${k} must be a number`);
  }
}

export function validateWhen(w: string, where = 'when') {
  if (WHEN_FIXED.has(w)) return;
  const pre = WHEN_PREFIX.find((p) => w.startsWith(p));
  if (!pre || w.length === pre.length) throw new DslError(`${where}: unknown when "${w}"`);
  if (pre === 'win_race:' && !RACES.includes(w.slice(pre.length) as Race)) throw new DslError(`${where}: unknown race in "${w}"`);
}

export function validateCond(c: Cond, where = 'if') {
  for (const k of Object.keys(c)) if (!COND_KEYS.has(k)) throw new DslError(`${where}: unknown condition "${k}"`);
  for (const k of ['min', 'max'] as const) {
    const m = c[k];
    if (m) for (const s of Object.keys(m)) if (!STAT_KEYS.has(s as StatKey)) throw new DslError(`${where}.${k}: unknown stat "${s}"`);
  }
  if (c.res_min) checkCost(c.res_min, `${where}.res_min`);
}

/** do の1要素のキー（build＋discount と train＋fresh だけは2つ持てる） */
export function opKey(op: Op, where = 'do'): string {
  const keys = Object.keys(op);
  const main = keys.filter((k) => k !== 'discount' && k !== 'fresh');
  if (main.length !== 1) throw new DslError(`${where}: an op must have exactly one key (got ${keys.join(',') || 'none'})`);
  const k = main[0];
  if (!OP_KEYS.has(k)) throw new DslError(`${where}: unknown op "${k}"`);
  if (keys.includes('discount') && k !== 'build') throw new DslError(`${where}: discount is only for build`);
  if (keys.includes('fresh') && k !== 'train') throw new DslError(`${where}: fresh is only for train`);
  return k;
}

export function validateOp(op: Op, where = 'do') {
  const k = opKey(op, where);
  const v = (op as Record<string, unknown>)[k];
  switch (k) {
    case 'power_per': {
      const f = v as Op['power_per'];
      if (!f || !STAT_KEYS.has(f.stat)) throw new DslError(`${where}: power_per.stat "${f?.stat}"`);
      if (typeof f.per !== 'number' || f.per <= 0) throw new DslError(`${where}: power_per.per`);
      break;
    }
    case 'lose': checkCost(v, `${where}.lose`); break;
    case 'injure': case 'shard': if (typeof v !== 'number') throw new DslError(`${where}: ${k} must be a number`); break;
    case 'scrap': { const sc = v as Op['scrap']; if (!sc || typeof sc !== 'object') throw new DslError(`${where}: scrap`); if (sc.gain_per_cost) checkCost(sc.gain_per_cost, `${where}.scrap.gain_per_cost`); break; }
    case 'buy_card': { const b = v as Op['buy_card']; if (!b || typeof b.count !== 'number' || typeof b.price !== 'number') throw new DslError(`${where}: buy_card`); break; }
    case 'draw_any': { const d = v as Op['draw_any']; if (!d || !Array.isArray(d.from) || !d.from.every((f) => DRAW_ANY_FROM.has(f))) throw new DslError(`${where}: draw_any.from`); break; }
    case 'fame_per': case 'gain_per': {
      const f = v as { stat: string; per: number; gain?: Cost; max?: number };
      if (!f || !STAT_KEYS.has(f.stat as StatKey)) throw new DslError(`${where}: ${k}.stat "${f?.stat}"`);
      if (typeof f.per !== 'number' || f.per <= 0) throw new DslError(`${where}: ${k}.per`);
      if (k === 'gain_per') checkCost(f.gain, `${where}.gain_per.gain`);
      break;
    }
    case 'gain': case 'pay': case 'steal_gain': case 'others_gain': checkCost(v, `${where}.${k}`); break;
    case 'convert': { const c = v as Op['convert']; if (!c) throw new DslError(`${where}: convert`); checkCost(c.from, `${where}.convert.from`); checkCost(c.to, `${where}.convert.to`); break; }
    case 'future': { const f = v as Op['future']; if (!f || !Array.isArray(f.rounds)) throw new DslError(`${where}: future.rounds`); checkCost(f.gain, `${where}.future.gain`); break; }
    case 'draw': { const d = v as Op['draw']; if (!d || !DRAW_FROM.has(d.from)) throw new DslError(`${where}: draw.from "${d?.from}"`); break; }
    case 'train': if (!['atk', 'def', 'any'].includes(v as string)) throw new DslError(`${where}: train "${v}"`); break;
    case 'build': if (!['wall', 'bed', 'facility', 'any'].includes(v as string)) throw new DslError(`${where}: build "${v}"`); if (op.discount) checkCost(op.discount, `${where}.discount`); break;
    case 'craft': if (!['weapon', 'armor', 'any'].includes(v as string)) throw new DslError(`${where}: craft "${v}"`); break;
    case 'donate': { const d = v as Op['donate']; if (!d) throw new DslError(`${where}: donate`); checkCost(d.pay, `${where}.donate.pay`); break; }
    default: break;
  }
}

export function validateMod(m: Mod, where = 'mod') {
  for (const k of Object.keys(m)) if (!MOD_KEYS.has(k)) throw new DslError(`${where}: unknown mod "${k}"`);
  if (m.cost_discount) checkCost(m.cost_discount.res, `${where}.cost_discount.res`);
  if (m.donate_rate) checkCost(m.donate_rate, `${where}.donate_rate`);
  if (m.cost_extra) checkCost(m.cost_extra.res, `${where}.cost_extra.res`);
}

export function validateEffect(e: Effect, where = 'effect') {
  validateWhen(e.when, `${where}.when`);
  if (e.if) validateCond(e.if, `${where}.if`);
  if (e.when === 'passive') {
    if (!e.mod) throw new DslError(`${where}: passive needs mod`);
    validateMod(e.mod, `${where}.mod`);
  } else {
    if (!Array.isArray(e.do)) throw new DslError(`${where}: do must be an array`);
    e.do.forEach((op, i) => validateOp(op, `${where}.do[${i}]`));
  }
  if (e.limit != null && !['round', 'year', 'game'].includes(e.limit)) throw new DslError(`${where}: unknown limit "${e.limit}"`);
}

/** カード1枚の形を確かめる（知らない when / op / mod / 条件は例外） */
export function validateCard(c: CardDef) {
  const where = c.id ?? '?';
  if (!c.id || !c.kind || !c.name) throw new DslError(`${where}: id/kind/name required`);
  if (!Array.isArray(c.effects)) throw new DslError(`${where}: effects must be an array`);
  c.effects.forEach((e, i) => validateEffect(e, `${where}.effects[${i}]`));
  if (c.mods) validateMod(c.mods, `${where}.mods`);
  if (c.cost) checkCost(c.cost, `${where}.cost`);
}

/** カードの効果（mods の短縮形も passive として並べる） */
export function cardEffects(c: CardDef): Effect[] {
  return c.mods ? [...c.effects, { when: 'passive', mod: c.mods }] : c.effects;
}

// ------------------------------------------------------------ 条件
export interface FightEnv {
  race: Race; coop: boolean; k: number; boss: boolean;
  /** 送った仲間の攻めの熟練の合計・武器の戦力の合計、守りを超える反撃 */
  atk?: number; wpow?: number; exposed?: number;
}
export interface CondEnv {
  stat(k: StatKey): number;
  season: Season;
  t: number;
  res: Record<Res, number>;
  has(id: string): boolean;
  fight?: FightEnv;
}

export function checkCond(c: Cond | undefined, env: CondEnv): boolean {
  if (!c) return true;
  for (const k of Object.keys(c)) {
    switch (k) {
      case 'season': { const s = c.season!; if (Array.isArray(s) ? !s.includes(env.season) : s !== env.season) return false; break; }
      case 'min': for (const [s, n] of Object.entries(c.min!)) { if (!STAT_KEYS.has(s as StatKey)) throw new DslError(`unknown stat "${s}"`); if (env.stat(s as StatKey) < (n as number)) return false; } break;
      case 'max': for (const [s, n] of Object.entries(c.max!)) { if (!STAT_KEYS.has(s as StatKey)) throw new DslError(`unknown stat "${s}"`); if (env.stat(s as StatKey) > (n as number)) return false; } break;
      case 'race': { if (!env.fight) return false; const r = c.race!; if (Array.isArray(r) ? !r.includes(env.fight.race) : r !== env.fight.race) return false; break; }
      case 'coop': if (!env.fight || env.fight.coop !== c.coop) return false; break;
      case 'k_min': if (!env.fight || env.fight.k < c.k_min!) return false; break;
      case 'k_max': if (!env.fight || env.fight.k > c.k_max!) return false; break;
      case 'boss': if (!env.fight || env.fight.boss !== c.boss) return false; break;
      case 'has': if (!env.has(c.has!)) return false; break;
      case 'res_min': for (const [r, n] of Object.entries(c.res_min!)) if (env.res[r as Res] < (n as number)) return false; break;
      case 't_min': if (env.t < c.t_min! - 1e-9) return false; break;
      case 't_max': if (env.t > c.t_max! + 1e-9) return false; break;
      default: throw new DslError(`unknown condition "${k}"`);
    }
  }
  return true;
}

// ------------------------------------------------------------ mod の合計
export interface ModSum {
  market_qty: number; market_both: boolean; trade_count: number; accum_bonus: Record<string, number>;
  cost_discount: { kind: string; res: Cost }[]; upkeep: number; donate_rate: Cost | null; base_guard: number; pet_power: number;
  hand_limit: number; power: number; heal_discount: number; sell_bonus: number; bed_cap: number;
  cost_extra: { kind: string; res: Cost }[]; pet_cap: number; pet_bring: number; capture_ease: number; gold_mana: number; gold_cap: number;
  gold_div: number; sell_full: boolean; shard_need: number; ancient_look: number; spell_return: number; comp_cap: number; occ_food: number;
  two_hand_armor: boolean; rage: number; no_atk_train: boolean; tool_yield: number; leader_no_weapon: boolean;
}
export function emptyMods(): ModSum {
  return {
    market_qty: 0, market_both: false, trade_count: 0, accum_bonus: {}, cost_discount: [], upkeep: 0, donate_rate: null, base_guard: 0,
    pet_power: 0, hand_limit: 0, power: 0, heal_discount: 0, sell_bonus: 0, bed_cap: 0,
    cost_extra: [], pet_cap: 0, pet_bring: 0, capture_ease: 0, gold_mana: 0, gold_cap: 0, gold_div: 1, sell_full: false, shard_need: 0,
    ancient_look: 0, spell_return: 0, comp_cap: 0, occ_food: 0, two_hand_armor: false, rage: 0, no_atk_train: false, tool_yield: 0,
    leader_no_weapon: false,
  };
}
export function addMod(s: ModSum, m: Mod) {
  for (const k of Object.keys(m)) {
    switch (k) {
      case 'market_qty': s.market_qty += m.market_qty!; break;
      case 'market_both': s.market_both = s.market_both || !!m.market_both; break;
      case 'trade_count': s.trade_count += m.trade_count!; break;
      case 'accum_bonus': for (const [sp, n] of Object.entries(m.accum_bonus!)) s.accum_bonus[sp] = (s.accum_bonus[sp] ?? 0) + (n as number); break;
      case 'cost_discount': s.cost_discount.push(m.cost_discount!); break;
      case 'upkeep': s.upkeep += m.upkeep!; break;
      case 'donate_rate': s.donate_rate = { ...(s.donate_rate ?? {}), ...m.donate_rate! }; break;
      case 'base_guard': s.base_guard += m.base_guard!; break;
      case 'pet_power': s.pet_power += m.pet_power!; break;
      case 'hand_limit': s.hand_limit += m.hand_limit!; break;
      case 'power': s.power += m.power!; break;
      case 'heal_discount': s.heal_discount += m.heal_discount!; break;
      case 'sell_bonus': s.sell_bonus += m.sell_bonus!; break;
      case 'bed_cap': s.bed_cap += m.bed_cap!; break;
      case 'cost_extra': s.cost_extra.push(m.cost_extra!); break;
      case 'pet_cap': s.pet_cap += m.pet_cap!; break;
      case 'pet_bring': s.pet_bring += m.pet_bring!; break;
      case 'capture_ease': s.capture_ease += m.capture_ease!; break;
      case 'gold_mana': s.gold_mana = s.gold_mana ? Math.min(s.gold_mana, m.gold_mana!) : m.gold_mana!; break;
      case 'gold_cap': s.gold_cap += m.gold_cap!; break;
      case 'gold_div': s.gold_div *= m.gold_div!; break;
      case 'sell_full': s.sell_full = s.sell_full || !!m.sell_full; break;
      case 'shard_need': s.shard_need += m.shard_need!; break;
      case 'ancient_look': s.ancient_look += m.ancient_look!; break;
      case 'spell_return': s.spell_return += m.spell_return!; break;
      case 'comp_cap': s.comp_cap += m.comp_cap!; break;
      case 'occ_food': s.occ_food += m.occ_food!; break;
      case 'two_hand_armor': s.two_hand_armor = s.two_hand_armor || !!m.two_hand_armor; break;
      case 'rage': s.rage = Math.max(s.rage, m.rage!); break;
      case 'no_atk_train': s.no_atk_train = s.no_atk_train || !!m.no_atk_train; break;
      case 'tool_yield': s.tool_yield += m.tool_yield!; break;
      case 'leader_no_weapon': s.leader_no_weapon = s.leader_no_weapon || !!m.leader_no_weapon; break;
      default: throw new DslError(`unknown mod "${k}"`);
    }
  }
}

// ------------------------------------------------------------ 費用の計算
export function addCost(a: Cost, b: Cost, mult = 1): Cost {
  const o: Cost = { ...a };
  for (const [r, n] of Object.entries(b)) o[r as Res] = (o[r as Res] ?? 0) + (n as number) * mult;
  return o;
}
export function subCost(a: Cost, b: Cost): Cost {
  const o: Cost = {};
  for (const [r, n] of Object.entries(a)) { const v = Math.max(0, (n as number) - (b[r as Res] ?? 0)); if (v) o[r as Res] = v; }
  return o;
}
export function cleanCost(c: Cost): Cost {
  return Object.fromEntries(Object.entries(c).filter(([, n]) => n)) as Cost;
}
export const costUnits = (c: Cost) => Object.values(c).reduce((a, n) => a + (n as number), 0);
