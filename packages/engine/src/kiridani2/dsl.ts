// 霧谷の冒険者団 v2 — 効果 DSL（§8）の読み取り：形の確認（知らない op は例外）、条件の判定、mod の合計。
// 実行（do の手順）はエンジン（engine.ts の runOps）が行う。
import type { CardDef, Cond, Cost, Effect, Mod, Op, Race, Res, Season, StatKey } from './types';
import { RACES, RES } from './types';

export class DslError extends Error {
  constructor(msg: string) { super(msg); this.name = 'DslError'; }
}

export const WHEN_FIXED = new Set([
  'use', 'fight', 'win', 'lose', 'round_start', 'round_end', 'winter', 'game_end', 'setup',
  'build', 'hire', 'craft', 'sell', 'buy', 'trade', 'donate', 'spell', 'tame', 'play', 'passive', 'occ', 'quest', 'hit', 'injure', 'repair',
  'fate', 'trained', 'act',
]);
export const WHEN_PREFIX = ['use:', 'instead:', 'other:', 'win_race:'];

export const OP_KEYS = new Set([
  'gain', 'pay', 'convert', 'fame', 'power', 'guard', 'counter', 'loot', 'trophy', 'str', 'no_injury',
  'extra_worker', 'place_again', 'ignore_full', 'future', 'draw', 'hire', 'hire_free', 'tame', 'train', 'build', 'heal',
  'steal_gain', 'craft', 'occ', 'exchange', 'first', 'donate', 'fame_per', 'gain_per', 'others_gain',
  'power_per', 'lose', 'injure', 'scrap', 'shard', 'buy_card', 'draw_any', 'gain_pick', 'repair', 'relic', 'trade_bonus', 'ward', 'accum_add',
  'flag', 'weapon_again', 'refate', 'mark_weapon', 'train_sent', 'train_copy', 'skill_boost', 'skill_copy', 'ally_guard', 'loot_tamed', 'reserve', 'hog',
  'repair_free', 'relic_fix', 'relic_sort', 'accum_seed', 'accum_take', 'block', 'peek_discard', 'market_ban', 'pay_pick', 'fame_flag', 'dup_tool', 'later',
  'invest', 'lend', 'loot_gold', 'value_up', 'buy_ban', 'trade_skim',
]);
/** 戦闘中だけ意味のある op */
export const FIGHT_OPS = new Set(['power', 'guard', 'counter', 'loot', 'trophy', 'str', 'no_injury', 'tame', 'power_per', 'weapon_again', 'skill_boost', 'ally_guard', 'hog']);
/** 選択肢を広げる op（最初の1つは置く場所の選択肢に広げ、2つ目からは実行のときに聞く） */
export const EXPAND_OPS = new Set([
  'craft', 'occ', 'build', 'exchange', 'train', 'scrap', 'repair',
  'repair_free', 'mark_weapon', 'block', 'peek_discard', 'market_ban', 'lend', 'value_up', 'buy_ban', 'accum_take', 'dup_tool', 'reserve',
]);

export const MOD_KEYS = new Set([
  'market_qty', 'market_both', 'trade_count', 'accum_bonus', 'cost_discount', 'upkeep', 'donate_rate', 'base_guard', 'pet_power',
  'hand_limit', 'power', 'heal_discount', 'sell_bonus', 'bed_cap',
  'cost_extra', 'pet_cap', 'pet_bring', 'capture_ease', 'gold_mana', 'gold_cap', 'gold_div', 'sell_full', 'shard_need', 'ancient_look',
  'spell_return', 'comp_cap', 'occ_food', 'two_hand_armor', 'rage', 'no_atk_train', 'tool_yield', 'leader_no_weapon',
  'skill_cap', 'stone_down', 'send_cap', 'fav_cut', 'repair_cut', 'home_guard', 'adv_free', 'raid_mult', 'hoard_bonus', 'hoard_div', 'no_absent', 'trade_max', 'winter_gold',
  'dual_light', 'wear_weapon2', 'dual_armor_light', 'train_herb', 'rest_train', 'first_spell_cut', 'rest_gain', 'herb_mana', 'fav_alt', 'fav_cut_round',
  'nest_peek', 'boss_tame', 'two_hand_power', 'repair_gold', 'wall_count', 'trade_cut', 'stone_buy_cut', 'squeeze', 'heal_gold', 'market_plus', 'stall', 'own_space',
]);
export const COND_KEYS = new Set(['season', 'min', 'max', 'race', 'coop', 'k_min', 'k_max', 'boss', 'has', 'res_min', 't_min', 't_max', 'flag', 'last_win', 'space_not']);
export const STAT_KEYS = new Set<StatKey>([
  'comps', 'occs', 'walls', 'beds', 'facilities', 'gear', 'pets', 'kills', 'races', 'trophies', 'hand', 'ancient', 'quests', 'skills',
  'injured', 'boss', 'coop', 'spells', 'donations', 'trades', 'year', 'round',
  'weapons', 'armors', 'tools', 'tomes', 'casts', 'shards', 'kinds', 'sold', 'gold', 'atk', 'def', 'dmg',
  'sent_atk', 'sent_wpow', 'sent_k', 'exposed', 'casts_round', 'broken', 'blocked', 'res_total',
  'pet_types', 'pet_same', 'fights_round', 'sent_guard',
]);
/** 戦闘中だけ数える stat（fight の環境がないと 0） */
export const FIGHT_STATS = new Set<StatKey>(['sent_atk', 'sent_wpow', 'sent_k', 'exposed', 'sent_guard']);
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

/** do の1要素のキー（build＋discount・surcharge・extra_units と train＋fresh だけは2つ以上持てる） */
const BUILD_SUB = ['discount', 'surcharge', 'extra_units'];
export function opKey(op: Op, where = 'do'): string {
  const keys = Object.keys(op);
  const main = keys.filter((k) => !BUILD_SUB.includes(k) && k !== 'fresh');
  if (main.length !== 1) throw new DslError(`${where}: an op must have exactly one key (got ${keys.join(',') || 'none'})`);
  const k = main[0];
  if (!OP_KEYS.has(k)) throw new DslError(`${where}: unknown op "${k}"`);
  if (keys.some((x) => BUILD_SUB.includes(x)) && k !== 'build') throw new DslError(`${where}: ${keys.filter((x) => BUILD_SUB.includes(x)).join(',')} is only for build`);
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
    case 'build': if (!['wall', 'bed', 'facility', 'any'].includes(v as string)) throw new DslError(`${where}: build "${v}"`); if (op.discount) checkCost(op.discount, `${where}.discount`); if (op.surcharge) checkCost(op.surcharge, `${where}.surcharge`); break;
    case 'craft': if (!['weapon', 'armor', 'any'].includes(v as string)) throw new DslError(`${where}: craft "${v}"`); break;
    case 'donate': { const d = v as Op['donate']; if (!d) throw new DslError(`${where}: donate`); checkCost(d.pay, `${where}.donate.pay`); break; }
    case 'flag': { const f = v as Op['flag']; if (!f || typeof f.k !== 'string' || !f.k) throw new DslError(`${where}: flag.k`); break; }
    case 'fame_flag': { const f = v as Op['fame_flag']; if (!f || typeof f.k !== 'string' || typeof f.mult !== 'number') throw new DslError(`${where}: fame_flag`); break; }
    case 'pay_pick': { const f = v as Op['pay_pick']; if (!f || typeof f.n !== 'number' || !Array.isArray(f.from) || !f.from.every((r) => RES.includes(r))) throw new DslError(`${where}: pay_pick`); break; }
    case 'trade_skim': if (!Array.isArray(v) || !(v as Res[]).every((r) => RES.includes(r))) throw new DslError(`${where}: trade_skim`); break;
    case 'block': if (v !== 'accum' && v !== 'any') throw new DslError(`${where}: block "${v}"`); break;
    case 'later': {
      const l = v as Op['later'];
      if (!l || !Array.isArray(l.do)) throw new DslError(`${where}: later.do`);
      validateWhen(l.when, `${where}.later.when`);
      l.do.forEach((o, i) => validateOp(o, `${where}.later.do[${i}]`));
      break;
    }
    case 'relic_fix': { const f = v as Op['relic_fix']; if (!f || typeof f.look !== 'number' || typeof f.cut !== 'number') throw new DslError(`${where}: relic_fix`); break; }
    case 'lend': { const f = v as Op['lend']; if (!f || typeof f.amt !== 'number' || typeof f.back !== 'number' || typeof f.rounds !== 'number') throw new DslError(`${where}: lend`); break; }
    default: break;
  }
}

export function validateMod(m: Mod, where = 'mod') {
  for (const k of Object.keys(m)) if (!MOD_KEYS.has(k)) throw new DslError(`${where}: unknown mod "${k}"`);
  if (m.cost_discount) checkCost(m.cost_discount.res, `${where}.cost_discount.res`);
  if (m.donate_rate) checkCost(m.donate_rate, `${where}.donate_rate`);
  if (m.cost_extra) checkCost(m.cost_extra.res, `${where}.cost_extra.res`);
  if (m.rest_gain) checkCost(m.rest_gain, `${where}.rest_gain`);
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
  if (e.limit != null && !['round', 'round2', 'year', 'game'].includes(e.limit)) throw new DslError(`${where}: unknown limit "${e.limit}"`);
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
  /** 送った仲間の守りの合計 */
  guard?: number;
}
export interface CondEnv {
  stat(k: StatKey): number;
  season: Season;
  t: number;
  res: Record<Res, number>;
  has(id: string): boolean;
  fight?: FightEnv;
  /** 自分の印の数（flag） */
  flag?(k: string): number;
  /** 直前の自分の戦闘に勝ったか */
  lastWin?: boolean;
  /** 使ったマス（use の効果のとき） */
  space?: string;
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
      case 'flag': if (!((env.flag?.(c.flag!) ?? 0) > 0)) return false; break;
      case 'last_win': if (!!env.lastWin !== c.last_win) return false; break;
      case 'space_not': if (env.space === undefined || env.space === c.space_not) return false; break;
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
  skill_cap: number; stone_down: string[]; send_cap: number; fav_cut: number; repair_cut: number; home_guard: number; adv_free: boolean;
  raid_mult: number; hoard_bonus: number; hoard_div: number; no_absent: boolean; trade_max: number; winter_gold: number;
  dual_light: boolean; wear_weapon2: boolean; dual_armor_light: boolean; train_herb: boolean; rest_train: boolean; first_spell_cut: number;
  rest_gain: Cost | null; herb_mana: number; fav_alt: number; fav_cut_round: number; nest_peek: boolean; boss_tame: number; two_hand_power: number;
  repair_gold: number; wall_count: number; trade_cut: number; stone_buy_cut: number; squeeze: boolean; heal_gold: number; market_plus: number;
  stall: boolean; own_space: string[];
}
export function emptyMods(): ModSum {
  return {
    market_qty: 0, market_both: false, trade_count: 0, accum_bonus: {}, cost_discount: [], upkeep: 0, donate_rate: null, base_guard: 0,
    pet_power: 0, hand_limit: 0, power: 0, heal_discount: 0, sell_bonus: 0, bed_cap: 0,
    cost_extra: [], pet_cap: 0, pet_bring: 0, capture_ease: 0, gold_mana: 0, gold_cap: 0, gold_div: 1, sell_full: false, shard_need: 0,
    ancient_look: 0, spell_return: 0, comp_cap: 0, occ_food: 0, two_hand_armor: false, rage: 0, no_atk_train: false, tool_yield: 0,
    leader_no_weapon: false,
    skill_cap: 0, stone_down: [], send_cap: 0, fav_cut: 0, repair_cut: 0, home_guard: 0, adv_free: false,
    raid_mult: 1, hoard_bonus: 0, hoard_div: 0, no_absent: false, trade_max: 0, winter_gold: 0,
    dual_light: false, wear_weapon2: false, dual_armor_light: false, train_herb: false, rest_train: false, first_spell_cut: 0,
    rest_gain: null, herb_mana: 0, fav_alt: 0, fav_cut_round: 0, nest_peek: false, boss_tame: 0, two_hand_power: 0,
    repair_gold: 0, wall_count: 0, trade_cut: 0, stone_buy_cut: 0, squeeze: false, heal_gold: 0, market_plus: 0, stall: false, own_space: [],
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
      case 'skill_cap': s.skill_cap += m.skill_cap!; break;
      case 'stone_down': s.stone_down.push(m.stone_down!); break;
      case 'send_cap': s.send_cap += m.send_cap!; break;
      case 'fav_cut': s.fav_cut += m.fav_cut!; break;
      case 'repair_cut': s.repair_cut += m.repair_cut!; break;
      case 'home_guard': s.home_guard += m.home_guard!; break;
      case 'adv_free': s.adv_free = s.adv_free || !!m.adv_free; break;
      case 'raid_mult': s.raid_mult = Math.max(s.raid_mult, m.raid_mult!); break;
      case 'hoard_bonus': s.hoard_bonus += m.hoard_bonus!; break;
      case 'hoard_div': s.hoard_div = s.hoard_div ? Math.min(s.hoard_div, m.hoard_div!) : m.hoard_div!; break;
      case 'no_absent': s.no_absent = s.no_absent || !!m.no_absent; break;
      case 'trade_max': s.trade_max += m.trade_max!; break;
      case 'winter_gold': s.winter_gold = s.winter_gold ? Math.min(s.winter_gold, m.winter_gold!) : m.winter_gold!; break;
      case 'dual_light': s.dual_light = s.dual_light || !!m.dual_light; break;
      case 'wear_weapon2': s.wear_weapon2 = s.wear_weapon2 || !!m.wear_weapon2; break;
      case 'dual_armor_light': s.dual_armor_light = s.dual_armor_light || !!m.dual_armor_light; break;
      case 'train_herb': s.train_herb = s.train_herb || !!m.train_herb; break;
      case 'rest_train': s.rest_train = s.rest_train || !!m.rest_train; break;
      case 'first_spell_cut': s.first_spell_cut += m.first_spell_cut!; break;
      case 'rest_gain': s.rest_gain = addCost(s.rest_gain ?? {}, m.rest_gain!); break;
      case 'herb_mana': s.herb_mana = s.herb_mana ? Math.min(s.herb_mana, m.herb_mana!) : m.herb_mana!; break;
      case 'fav_alt': s.fav_alt = s.fav_alt ? Math.min(s.fav_alt, m.fav_alt!) : m.fav_alt!; break;
      case 'fav_cut_round': s.fav_cut_round += m.fav_cut_round!; break;
      case 'nest_peek': s.nest_peek = s.nest_peek || !!m.nest_peek; break;
      case 'boss_tame': s.boss_tame = s.boss_tame ? Math.min(s.boss_tame, m.boss_tame!) : m.boss_tame!; break;
      case 'two_hand_power': s.two_hand_power += m.two_hand_power!; break;
      case 'repair_gold': s.repair_gold = s.repair_gold ? Math.min(s.repair_gold, m.repair_gold!) : m.repair_gold!; break;
      case 'wall_count': s.wall_count += m.wall_count!; break;
      case 'trade_cut': s.trade_cut += m.trade_cut!; break;
      case 'stone_buy_cut': s.stone_buy_cut += m.stone_buy_cut!; break;
      case 'squeeze': s.squeeze = s.squeeze || !!m.squeeze; break;
      case 'heal_gold': s.heal_gold = s.heal_gold ? Math.min(s.heal_gold, m.heal_gold!) : m.heal_gold!; break;
      case 'market_plus': s.market_plus += m.market_plus!; break;
      case 'stall': s.stall = s.stall || !!m.stall; break;
      case 'own_space': if (!s.own_space.includes(m.own_space!)) s.own_space.push(m.own_space!); break;
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
