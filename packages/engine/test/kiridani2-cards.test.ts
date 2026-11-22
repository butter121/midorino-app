// 霧谷の冒険者団 v2 — カードデータの点検（id の重複、強い動きの入り口の数、DSL の op / mod / 条件 / タイミング）
import { describe, it, expect } from 'vitest';
import {
  LEADERS, OCCUPATIONS, WEAPONS, ARMORS, TOOLS, SPELLS, PETS, GEAR, STAGES, QUESTS, ANCIENT,
} from '../src/kiridani2/cards';
import { OP_KEYS, MOD_KEYS, COND_KEYS, STAT_KEYS, WHEN_FIXED } from '../src/kiridani2/dsl';
import type { CardDef, Effect, Cond } from '../src/kiridani2/types';

// DSL の op / mod / 条件 / 数は dsl.ts の表から（エンジンが知っているものだけ）
const OPS = OP_KEYS;
/** op のキーに添えてよいもの（build の値引き・train の fresh） */
const OP_EXTRA = new Set(['discount', 'fresh']);
const MODS = MOD_KEYS;
const CONDS = COND_KEYS;
const STATS = STAT_KEYS as Set<string>;
const RES = new Set(['wood', 'iron', 'herb', 'mana', 'food', 'gold', 'mat']);
const PLAIN_WHEN = new Set([...WHEN_FIXED, 'use']);
const RACES = new Set(['beast', 'spirit', 'undead', 'humanoid', 'dragon']);
// 始めからのマス（SPEC §4）＋人数で増えるマス（v1 min_p）＋段階カード＋まとめ指定
const BASE_SPACES = [
  'forest', 'mine', 'meadow', 'spring', 'hunt', 'board', 'guild', 'forge', 'workshop', 'market', 'plaza', 'hall',
  'grove', 'market2', 'deepmine', 'peddler', 'herb2', 'outpost', 'nest', 'any_accum', 'lair', 'curio', 'dig',
];
const SPACES = new Set([...BASE_SPACES, ...STAGES.map((s) => s.id)]);
const MOVES = ['hunt', 'gather', 'trade', 'fort', 'smith', 'family', 'arcane', 'beast', 'quest', 'ally', 'ruins', 'boss'] as const;

const PLAYABLE: CardDef[] = [...LEADERS, ...OCCUPATIONS, ...WEAPONS, ...ARMORS, ...TOOLS, ...SPELLS];
const ALL_CARDS: CardDef[] = [...PLAYABLE, ...PETS, ...GEAR, ...STAGES];

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
      for (const k of ['gain', 'pay', 'steal_gain', 'discount', 'others_gain']) checkCost(o[k] as Record<string, unknown>, where, errs);
      if (op.convert) { checkCost(op.convert.from, where, errs); checkCost(op.convert.to, where, errs); }
      for (const k of ['fame_per', 'gain_per', 'power_per'] as const) {
        const f = op[k];
        if (!f) continue;
        if (!STATS.has(f.stat)) errs.push(`${where}: ${k} の知らない数 ${f.stat}`);
        if (!(f.per > 0)) errs.push(`${where}: ${k}.per は正の数`);
      }
      if (op.gain_per) checkCost(op.gain_per.gain, where, errs);
    }
  }
  if (e.limit != null && !['round', 'year', 'game'].includes(e.limit)) errs.push(`${where}: 知らない limit ${e.limit}`);
}

describe('kiridani2 cards', () => {
  it('枚数', () => {
    expect(LEADERS.length).toBe(50);
    expect(OCCUPATIONS.length).toBe(80);
    expect(WEAPONS.length).toBe(80);
    expect(ARMORS.length).toBe(80);
    expect(TOOLS.length).toBe(80);
    expect(SPELLS.length).toBe(80);
    expect(SPELLS.filter((c) => c.tome).length).toBe(30);
    expect(PETS.length).toBe(48);
    expect(GEAR.length).toBe(8);
    expect(STAGES.filter((s) => s.stage === 0).map((s) => s.id)).toEqual(['training', 'ruins']);
    expect(STAGES.filter((s) => s.stage === 1).length).toBe(3);
    expect(STAGES.filter((s) => s.stage === 2).length).toBe(5);
    for (const st of [3, 4]) expect(STAGES.filter((s) => s.stage === st).length).toBe(4);
    expect(STAGES.filter((s) => s.stage === 5).length).toBe(3);
    expect(QUESTS.filter((q) => q.secret).length).toBeGreaterThanOrEqual(12);
    expect(ANCIENT.reduce((n, a) => n + (a.copies ?? 3), 0)).toBe(20);
    expect(new Set(ANCIENT.map((a) => a.group)).size).toBe(5);
  });

  it('id の重複なし', () => {
    const ids = [...ALL_CARDS, ...QUESTS, ...ANCIENT].map((c) => c.id);
    const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dup).toEqual([]);
  });

  it('種類ごとの kind', () => {
    for (const c of LEADERS) expect(c.kind).toBe('leader');
    for (const c of OCCUPATIONS) expect(c.kind).toBe('occ');
    for (const c of WEAPONS) expect(c.kind).toBe('weapon');
    for (const c of ARMORS) expect(c.kind).toBe('armor');
    for (const c of TOOLS) expect(c.kind).toBe('tool');
    for (const c of SPELLS) expect(c.kind).toBe('spell');
    for (const c of PETS) expect(c.kind).toBe('pet');
    for (const c of WEAPONS) expect(c.slot).toBe('weapon');
    for (const c of ARMORS) expect(c.slot).toBe('armor');
  });

  it('engine タグは1〜2個、強い動きごとに15枚以上・3種類以上（リーダー・職能・武具・道具・秘術）', () => {
    const count: Record<string, number> = {};
    for (const c of PLAYABLE) {
      expect(c.engine.length, c.id).toBeGreaterThanOrEqual(1);
      expect(c.engine.length, c.id).toBeLessThanOrEqual(2);
      for (const t of c.engine) count[t] = (count[t] ?? 0) + 1;
    }
    for (const m of MOVES) expect(count[m] ?? 0, m).toBeGreaterThanOrEqual(15);
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

  it('秘術：手札・身につけた秘術から使えるのは play と fight。唱えるマナ鉱石は1〜3、何度でもは1手番に1〜3回', () => {
    for (const c of SPELLS) for (const e of c.effects) expect(['play', 'fight'], c.id).toContain(e.when);
    for (const c of SPELLS) {
      expect(c.cost?.mana ?? 0, c.id).toBeGreaterThanOrEqual(1);
      expect(c.cost?.mana ?? 0, c.id).toBeLessThanOrEqual(3);
      if (c.tome) { expect(c.tome.uses, c.id).toBeGreaterThanOrEqual(1); expect(c.tome.uses, c.id).toBeLessThanOrEqual(3); }
    }
    const uses = new Set(SPELLS.filter((c) => c.tome).map((c) => c.tome!.uses));
    expect([...uses].sort()).toEqual([1, 2, 3]);
  });

  it('再設計の決まり：種族への特攻なし・職能は回数の制限なし・どの種類にも欠点のあるカード', () => {
    for (const c of [...PLAYABLE, ...PETS]) for (const e of c.effects) {
      expect(e.when.startsWith('win_race:'), c.id).toBe(false);
      expect(e.if?.race, c.id).toBeUndefined();
    }
    for (const c of OCCUPATIONS) for (const e of c.effects) expect(e.limit ?? null, c.id).toBeNull();
    for (const list of [LEADERS, OCCUPATIONS, WEAPONS, ARMORS, TOOLS, SPELLS]) expect(list.filter((c) => c.weight === 'curse').length, list[0].kind).toBeGreaterThanOrEqual(2);
    // ほかの人のマスを使うたびに得る効果は（あっても）ラウンド1回まで
    for (const c of PLAYABLE) for (const e of c.effects) if (e.when.startsWith('other:')) expect(e.limit, c.id).toBe('round');
  });

  it('名前の重複なし（リーダー・職能・武具・道具・秘術）', () => {
    const names = PLAYABLE.map((c) => c.name);
    expect(names.filter((n, i) => names.indexOf(n) !== i)).toEqual([]);
  });
  it('説明文は決まった言い方（英字なし・かっこが重ならない・【いつ】で始まる効果）', () => {
    for (const c of [...PLAYABLE, ...PETS, ...GEAR]) {
      expect(c.text, c.id).not.toMatch(/[A-Za-z]/);
      expect(c.text, c.id).not.toMatch(/）（/);
      expect(c.text, c.id).not.toMatch(/につき/);
      if (c.effects.length) expect(c.text, c.id).toMatch(/【/);
    }
  });
});
