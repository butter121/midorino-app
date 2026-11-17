// 霧谷の冒険者団 v2 — カードデータの点検（id の重複、強い動きの入り口の数、DSL の op / mod / 条件 / タイミング）
import { describe, it, expect } from 'vitest';
import {
  LEADERS, OCCUPATIONS, WEAPONS, TOOLS, SPELLS, GEAR, STAGES, QUESTS, ANCIENT,
} from '../src/kiridani2/cards';
import type { CardDef, Effect, Cond } from '../src/kiridani2/types';

// SPEC §8 の op と、types.ts でエンジンが足したもの（craft / occ / exchange / first / donate）
const OPS = new Set([
  'gain', 'pay', 'convert', 'fame', 'power', 'guard', 'counter', 'loot', 'trophy', 'str', 'no_injury',
  'extra_worker', 'place_again', 'ignore_full', 'future', 'draw', 'hire', 'hire_free', 'tame', 'train',
  'build', 'heal', 'steal_gain', 'craft', 'occ', 'exchange', 'first', 'donate',
]);
/** op のキーに添えてよいもの（build の値引き） */
const OP_EXTRA = new Set(['discount']);
const MODS = new Set([
  'market_qty', 'market_both', 'trade_count', 'accum_bonus', 'cost_discount', 'upkeep', 'donate_rate',
  'base_guard', 'pet_power', 'hand_limit', 'power', 'heal_discount', 'sell_bonus', 'bed_cap',
]);
const CONDS = new Set(['season', 'min', 'max', 'race', 'coop', 'k_min', 'boss', 'weak', 'has', 'res_min', 't_min', 't_max']);
const STATS = new Set([
  'comps', 'occs', 'walls', 'beds', 'facilities', 'gear', 'pets', 'kills', 'races', 'trophies', 'hand', 'ancient',
  'quests', 'skills', 'injured', 'boss', 'coop', 'weak', 'spells', 'donations', 'trades', 'year', 'round',
]);
const RES = new Set(['wood', 'iron', 'herb', 'mana', 'food', 'gold', 'mat']);
const PLAIN_WHEN = new Set([
  'fight', 'win', 'lose', 'round_start', 'round_end', 'winter', 'game_end', 'setup', 'build', 'hire', 'craft',
  'sell', 'buy', 'trade', 'donate', 'spell', 'tame', 'play', 'passive', 'use',
]);
const RACES = new Set(['beast', 'spirit', 'undead', 'humanoid', 'dragon']);
// 始めからのマス（SPEC §4）＋人数で増えるマス（v1 min_p）＋段階カード＋まとめ指定
const BASE_SPACES = [
  'forest', 'mine', 'meadow', 'spring', 'hunt', 'board', 'guild', 'forge', 'workshop', 'market', 'plaza', 'hall',
  'grove', 'market2', 'deepmine', 'peddler', 'herb2', 'outpost', 'nest', 'any_accum', 'lair',
];
const SPACES = new Set([...BASE_SPACES, ...STAGES.map((s) => s.id)]);
const MOVES = ['hunt', 'gather', 'trade', 'fort', 'smith', 'family', 'arcane', 'beast', 'quest', 'ally', 'ruins', 'boss'] as const;

const PLAYABLE: CardDef[] = [...LEADERS, ...OCCUPATIONS, ...WEAPONS, ...TOOLS, ...SPELLS];
const ALL_CARDS: CardDef[] = [...PLAYABLE, ...GEAR, ...STAGES];

function checkCost(c: Record<string, unknown> | undefined, where: string, errs: string[]) {
  if (!c) return;
  for (const [k, v] of Object.entries(c)) {
    if (!RES.has(k)) errs.push(`${where}: 知らない資源 ${k}`);
    if (typeof v !== 'number') errs.push(`${where}: ${k} が数でない`);
  }
}

function checkCond(cond: Cond | undefined, where: string, errs: string[]) {
  if (!cond) return;
  for (const [k, v] of Object.entries(cond)) {
    if (!CONDS.has(k)) errs.push(`${where}: 知らない条件 ${k}`);
    if ((k === 'min' || k === 'max') && v) for (const s of Object.keys(v)) if (!STATS.has(s)) errs.push(`${where}: 知らない数 ${s}`);
    if (k === 'res_min') checkCost(v as Record<string, unknown>, where, errs);
  }
}

function checkEffect(e: Effect, where: string, errs: string[]) {
  const w = e.when as string;
  const [head, arg] = w.includes(':') ? [w.slice(0, w.indexOf(':')), w.slice(w.indexOf(':') + 1)] : [w, ''];
  if (arg) {
    if (head === 'use' || head === 'instead' || head === 'other') {
      if (!SPACES.has(arg)) errs.push(`${where}: 知らないマス ${arg}`);
    } else if (head === 'win_race') {
      if (!RACES.has(arg)) errs.push(`${where}: 知らない種族 ${arg}`);
    } else errs.push(`${where}: 知らない when ${w}`);
  } else if (!PLAIN_WHEN.has(w)) errs.push(`${where}: 知らない when ${w}`);
  checkCond(e.if, where, errs);
  if (w === 'passive') {
    if (!e.mod || e.do) errs.push(`${where}: passive は mod だけ`);
    for (const k of Object.keys(e.mod ?? {})) if (!MODS.has(k)) errs.push(`${where}: 知らない mod ${k}`);
  } else {
    if (!e.do || e.do.length === 0 || e.mod) errs.push(`${where}: do が要る`);
    for (const op of e.do ?? []) {
      const keys = Object.keys(op).filter((k) => !OP_EXTRA.has(k));
      if (keys.length !== 1) errs.push(`${where}: op はキー1つ (${Object.keys(op).join(',')})`);
      for (const k of keys) if (!OPS.has(k)) errs.push(`${where}: 知らない op ${k}`);
      if ('discount' in op && !('build' in op)) errs.push(`${where}: discount は build と一緒に`);
      const o = op as Record<string, unknown>;
      for (const k of ['gain', 'pay', 'steal_gain', 'discount']) checkCost(o[k] as Record<string, unknown>, where, errs);
      if (op.convert) { checkCost(op.convert.from, where, errs); checkCost(op.convert.to, where, errs); }
    }
  }
  if (e.limit != null && !['round', 'year', 'game'].includes(e.limit)) errs.push(`${where}: 知らない limit ${e.limit}`);
}

describe('kiridani2 cards', () => {
  it('枚数', () => {
    expect(LEADERS.length).toBe(12);
    expect(OCCUPATIONS.length).toBe(15);
    expect(WEAPONS.length).toBe(15);
    expect(TOOLS.length).toBe(15);
    expect(SPELLS.length).toBe(15);
    expect(GEAR.length).toBe(8);
    expect(STAGES.filter((s) => s.stage === 1).length).toBe(3);
    for (const st of [2, 3, 4, 5]) expect(STAGES.filter((s) => s.stage === st).length).toBe(6);
    expect(QUESTS.filter((q) => q.secret).length).toBeGreaterThanOrEqual(12);
    expect(ANCIENT.reduce((n, a) => n + (a.copies ?? 3), 0)).toBe(12);
    expect(new Set(ANCIENT.map((a) => a.group)).size).toBe(4);
  });

  it('id の重複なし', () => {
    const ids = [...ALL_CARDS, ...QUESTS, ...ANCIENT].map((c) => c.id);
    const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dup).toEqual([]);
  });

  it('種類ごとの kind', () => {
    for (const c of LEADERS) expect(c.kind).toBe('leader');
    for (const c of OCCUPATIONS) expect(c.kind).toBe('occ');
    for (const c of WEAPONS) expect(['weapon', 'armor']).toContain(c.kind);
    for (const c of TOOLS) expect(c.kind).toBe('tool');
    for (const c of SPELLS) expect(c.kind).toBe('spell');
    for (const c of WEAPONS) expect(c.slot).toBe(c.kind === 'armor' ? 'armor' : 'weapon');
  });

  it('engine タグは1〜2個、強い動きごとに4枚以上（リーダー・職能・武具・道具・秘術）', () => {
    const count: Record<string, number> = {};
    for (const c of PLAYABLE) {
      expect(c.engine.length, c.id).toBeGreaterThanOrEqual(1);
      expect(c.engine.length, c.id).toBeLessThanOrEqual(2);
      for (const t of c.engine) count[t] = (count[t] ?? 0) + 1;
    }
    for (const m of MOVES) expect(count[m] ?? 0, m).toBeGreaterThanOrEqual(4);
    // 2種類以上のカードにまたがる
    for (const m of MOVES) {
      const kinds = new Set(PLAYABLE.filter((c) => c.engine.includes(m)).map((c) => (c.kind === 'armor' ? 'weapon' : c.kind)));
      expect(kinds.size, m).toBeGreaterThanOrEqual(3);
    }
  });

  it('DSL は知っている op / mod / 条件 / タイミングだけ', () => {
    const errs: string[] = [];
    for (const c of ALL_CARDS) {
      checkCost(c.cost, c.id, errs);
      if (!c.text) errs.push(`${c.id}: text が空`);
      c.effects.forEach((e, i) => checkEffect(e, `${c.id}#${i}`, errs));
      for (const k of Object.keys(c.mods ?? {})) if (!MODS.has(k)) errs.push(`${c.id}: 知らない mod ${k}`);
    }
    for (const q of QUESTS) checkCond(q.need, q.id, errs);
    expect(errs).toEqual([]);
  });

  it('秘術はタイミングが play か、使い切り（limit game）', () => {
    for (const c of SPELLS) for (const e of c.effects) expect(e.when === 'play' || e.limit === 'game', c.id).toBe(true);
  });
});
