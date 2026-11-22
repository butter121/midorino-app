// 霧谷の冒険者団 v2 — AI（§10）。v1 と同じく「評価関数＋1手先読みの貪欲」。腕前はノイズの量で表す。
// ・準備段階で「目指す強い動き」を1〜2個決め（リーダーと見えたカードの engine タグの重なり）、
//   カード選び・マス選びでその動きの部品と「一周」の手順に重みを足す。
// ・戦闘は盤面を複製し、運命を最大・最小に決め打ちした2通りを評価して、勝つ確率で混ぜる（守って戦う・装備・守りも込み）。
import * as D from './data';
import { cardEffects } from './dsl';
import {
  ancientScore, costValue, drive, Game, ITEM_KINDS, Player, score, type Brain, type Choice, type Option, type Ratio, type Req,
} from './engine';
import { Rng } from './rng';
import { LEADER_W, type WeightMul } from './ai_weights';
import type { CardDef, Cost, EngineTag, Op, Res } from './types';
import { ENGINES, RES } from './types';

export type Level = 'random' | 'novice' | 'normal' | 'strong';
export const LEVELS: Level[] = ['novice', 'normal', 'strong'];
const NOISE: Record<Level, number> = { random: 0, novice: 2.0, normal: 0.8, strong: 0.12 };
/** 置く場所を先読みせずに選ぶ割合（腕前の差をはっきりさせる） */
const SLIP: Record<Level, number> = { random: 1, novice: 0.25, normal: 0.08, strong: 0 };
/** 主の巣の先読みで、まだ置いていない人が送ると見込む仲間の数 */
const LAIR_GUESS = 2;
/** 主の巣の前のラウンドで、薬草・余った食料に足す重み */
const BOSS_PREP = { herb: 0.15, food: 0.12 };

export interface W {
  res: Record<Res, number>;
  act: number; short: number; inj: number; perm: number; defn: number; wall: number; hand: number; played: number;
  quest: number; tag: number; loop: number; pet: number; ancient: number;
}
export const DEFAULT_W: W = {
  res: { wood: 0.35, iron: 0.5, herb: 0.4, mana: 0.7, food: 0.55, gold: 0.2, mat: 0.5 },
  act: 0.5, short: 1.6, inj: 0.9, perm: 1.0, defn: 0.4, wall: 0.5, hand: 0.35, played: 1.0, quest: 0.5, tag: 0.35, loop: 3.0, pet: 0.5, ancient: 0.6,
};
/** 重みに倍率をかける（act は手数の見込みに後からかける） */
export function applyMul(w: W, m?: WeightMul) {
  if (!m) return;
  for (const [k, v] of Object.entries(m)) {
    if (k === 'res') { for (const [r, x] of Object.entries(v as Record<string, number>)) w.res[r as Res] *= x; continue; }
    if (k === 'act') continue;
    (w as unknown as Record<string, number>)[k] *= v as number;
  }
}
/** 強い動きごとの重み（v1 の ARCHETYPES に当たる） */
export const ENGINE_W: Partial<Record<EngineTag, (w: W) => void>> = {
  hunt: (w) => { w.perm += 0.12; w.res.iron += 0.1; },
  gather: (w) => { for (const r of ['wood', 'iron', 'herb', 'mat'] as Res[]) w.res[r] += 0.1; },
  trade: (w) => { w.res.gold += 0.1; w.res.mat += 0.1; },
  fort: (w) => { w.wall += 0.5; w.res.wood += 0.1; w.res.food += 0.15; },
  smith: (w) => { w.res.iron += 0.15; w.perm += 0.08; },
  family: (w) => { w.res.food += 0.05; },
  arcane: (w) => { w.res.mana += 0.3; },
  beast: (w) => { w.pet += 0.6; w.res.food += 0.1; },
  quest: (w) => { w.quest += 0.5; w.res.gold += 0.05; },
  ally: (w) => { w.perm += 0.05; },
  ruins: (w) => { w.ancient += 0.5; w.res.mana += 0.1; },
  boss: (w) => { w.defn += 0.1; w.perm += 0.1; w.res.herb += 0.05; w.res.food += 0.3; },
  bridge: (w) => { w.played += 0.2; },
};

/** 強い動きの「一周」：ラウンドの中でそろえたい手順の組（どれか1つで満たす）。測定（tools/kiridani2/sim.ts）も同じ定義を使う */
// 一周＝「その動きの入口（材料を得る）」と「出口（材料を名声・力に変える）」の両方を同じラウンドにした。
// 印は engine.ts が p.acts に入れる：マス（sp:<id>）、得た資源の種類（wood…）、払った資源（pay:<res>）、
// accum・fight（戦闘に出た）・win・win:<race>・coop・boss・tame・craft・build・hire・train・occ・spell・draw・exchange・sell・buy・trade・donate・board・quest（共通の依頼を達成）。
export const LOOPS: Record<EngineTag, string[][]> = {
  hunt: [['fight'], ['sell', 'craft', 'buy', 'train', 'heal', 'herb', 'pay:mat', 'build', 'trade', 'donate']],
  gather: [['accum'], ['build', 'craft', 'donate', 'occ', 'pay:wood', 'pay:herb']],
  trade: [['sell'], ['buy', 'trade', 'donate']],
  fort: [['build', 'train', 'craft'], ['wood', 'iron']],
  smith: [['craft', 'sell'], ['iron', 'wood', 'mat']],
  family: [['hire', 'train', 'occ', 'heal'], ['food']],
  arcane: [['mana'], ['spell', 'pay:mana', 'draw']],
  beast: [['tame', 'win', 'fight'], ['food', 'pay:food']],
  quest: [['board', 'donate', 'quest', 'gold'], ['win', 'build', 'craft', 'occ', 'fight', 'train']],
  ally: [['coop', 'trade', 'fight'], ['accum', 'sell', 'buy', 'food']],
  ruins: [['draw', 'sp:ruins', 'sp:treasury', 'sp:dig'], ['sell', 'craft', 'build', 'occ', 'mana', 'spell']],
  boss: [['fight', 'train'], ['craft', 'heal', 'herb', 'iron', 'buy', 'pay:mat', 'build', 'trade']],
  bridge: [['build', 'craft', 'occ'], ['win', 'sell', 'buy']],
};
export function loopDone(tag: EngineTag, acts: string[]): number {
  return LOOPS[tag].filter((grp) => grp.some((a) => acts.includes(a))).length;
}

const WEAPON_TAGS = new Set<EngineTag>(['hunt', 'smith', 'boss', 'ally']);
const ARMOR_TAGS = new Set<EngineTag>(['fort', 'boss', 'smith']);
const TOOL_TAGS = new Set<EngineTag>(['fort', 'gather', 'family', 'trade', 'quest', 'beast']);
const SPELL_TAGS = new Set<EngineTag>(['arcane', 'ruins']);
const TAG_STAT: Record<EngineTag, string[]> = {
  hunt: ['kills', 'races'], gather: ['wood', 'herb'], trade: ['sold', 'gold', 'trades'], fort: ['walls', 'tools', 'facilities'], smith: ['gear', 'weapons', 'armors'],
  family: ['comps', 'skills'], arcane: ['casts', 'spells'], beast: ['pets'], quest: ['quests', 'gold'], ally: ['coop'], ruins: ['ancient'], boss: ['boss'], bridge: ['occs', 'kinds'],
};

export function opsValue(ops: Op[]): number {
  let v = 0;
  for (const o of ops) {
    if (o.gain) v += costValue(o.gain);
    if (o.steal_gain) v += costValue(o.steal_gain);
    if (o.pay) v -= costValue(o.pay);
    if (o.convert) v += costValue(o.convert.to) - costValue(o.convert.from);
    if (o.fame) v += o.fame;
    if (o.power) v += 0.5 * o.power;
    if (o.guard) v += 0.3 * o.guard;
    if (o.counter) v -= 0.3 * o.counter;
    if (o.loot) v += 0.5 * o.loot;
    if (o.trophy) v += o.trophy;
    if (o.str) v -= 0.5 * o.str;
    if (o.no_injury) v += 0.6 * o.no_injury;
    if (o.extra_worker) v += 1.2 * o.extra_worker;
    if (o.future) v += costValue(o.future.gain) * o.future.rounds.length;
    if (o.draw) v += 0.8 * o.draw.take;
    if (o.hire || o.hire_free) v += 2;
    if (o.tame) v += 2;
    if (o.train) v += 0.8;
    if (o.build) v += 1;
    if (o.craft || o.occ || o.exchange) v += 0.8;
    if (o.heal) v += 0.5;
    if (o.donate) v += o.donate.fame - costValue(o.donate.pay);
    if (o.place_again || o.ignore_full) v += 0.6;
    if (o.first) v += 0.3;
    if (o.fame_per) v += 0.6 * Math.min(o.fame_per.max ?? 4, 4);
    if (o.gain_per) v += costValue(o.gain_per.gain) * 0.6 * Math.min(o.gain_per.max ?? 3, 3);
    if (o.others_gain) v -= 0.3 * costValue(o.others_gain);
    if (o.trade_bonus) v += 0.6 * o.trade_bonus;
    if (o.ward) v += 0.8 * o.ward;
    if (o.accum_add) v += 1.5;
    if (o.gain_pick) v += 0.5 * o.gain_pick.n;
    if (o.relic) v += 1.5 * o.relic;
    if (o.repair) v += 1.5;
  }
  return v;
}

/** カード1枚の目安の価値（AI のドラフト・評価用。カードの数値と効果の大きさだけを見る） */
const cvCache = new WeakMap<CardDef, Map<string, number>>();
export function cardValue(c: CardDef, targets: EngineTag[] = []): number {
  let m = cvCache.get(c);
  if (!m) { m = new Map(); cvCache.set(c, m); }
  const key = targets.join(',');
  let v = m.get(key);
  if (v === undefined) { v = cardValueRaw(c, targets); m.set(key, v); }
  return v;
}
function cardValueRaw(c: CardDef, targets: EngineTag[]): number {
  let v = 0.8 + (c.fame ?? 0) + 0.8 * (c.power ?? 0) + 0.6 * (c.guard ?? 0);
  for (const e of cardEffects(c)) {
    if (e.when === 'passive') v += 0.6 * Object.keys(e.mod ?? {}).length;
    else {
      const per = e.when === 'game_end' ? 1 : e.when === 'play' ? 1 : e.limit === 'game' ? 1 : e.limit === 'year' ? 1.3 : 1.6;
      v += Math.max(0.2, opsValue(e.do ?? []) * 0.5 * per) * (e.if ? 0.7 : 1);
    }
  }
  if (c.tome) v += 0.6 * c.tome.uses;
  if (c.weight === 'heavy') v += 0.8;
  v -= 0.12 * costValue(c.cost ?? {});
  for (const t of c.engine) if (targets.includes(t)) v += 1.2;
  return v;
}

export class AI implements Brain {
  level: Level;
  noise: number;
  rng: Rng;
  W: W;
  targets: EngineTag[] = [];
  tagCount: Record<string, number> = {};
  trade_on: boolean;
  /** 1手の値打ちの目安（最近の選択で一番よかった手の伸びの移動平均）。仲間を増やす価値に使う */
  actVal = 1.5;
  /** 測定：わざと目指す動きを決める（sim で強い動きごとの名声を比べるため） */
  forced?: EngineTag;

  /** 選んだリーダー（重みを選ぶのに使う） */
  leaderId = '';
  /** 重みの倍率（調整用に外から与える。なければリーダーごとの調整済みの倍率 LEADER_W） */
  wmul?: WeightMul;
  /** false ならリーダーごとの調整済みの倍率を使わない */
  tuned: boolean;

  constructor(level: Level = 'normal', opts: { seed?: number; trade?: boolean; target?: EngineTag; wmul?: WeightMul; tuned?: boolean } = {}) {
    this.wmul = opts.wmul;
    this.tuned = opts.tuned ?? true;
    this.level = level;
    this.noise = NOISE[level];
    this.rng = new Rng(opts.seed ?? 0);
    this.W = structuredClone(DEFAULT_W);
    this.trade_on = (opts.trade ?? true) && level !== 'random';
    this.forced = opts.target;
  }

  private n() { return this.noise ? this.rng.normal() * this.noise : 0; }
  private best<T>(xs: T[], f: (x: T) => number): T {
    if (this.level === 'random') return this.rng.choice(xs);
    let bi = 0, bv = -Infinity;
    xs.forEach((x, i) => { const v = f(x) + this.n(); if (v > bv) { bv = v; bi = i; } });
    return xs[bi];
  }

  private note(tags: EngineTag[], w: number) { for (const t of tags) this.tagCount[t] = (this.tagCount[t] ?? 0) + w; }
  private setTargets(p: Player) {
    if (this.forced) this.targets = [this.forced];
    else {
      const ranked = ENGINES.filter((t) => this.tagCount[t]).sort((a, b) => (this.tagCount[b] ?? 0) - (this.tagCount[a] ?? 0));
      this.targets = ranked.slice(0, ranked.length > 1 && (this.tagCount[ranked[1]] ?? 0) >= 0.6 * (this.tagCount[ranked[0]] ?? 0) ? 2 : 1);
    }
    p.target = [...this.targets];
    this.W = structuredClone(DEFAULT_W);
    for (const t of this.targets) ENGINE_W[t]?.(this.W);
    applyMul(this.W, this.wmul ?? (this.tuned ? LEADER_W[this.leaderId || p.leader || ''] : undefined));
    this.W.act = this.actVal * (this.wmul?.act ?? (this.tuned ? LEADER_W[this.leaderId || p.leader || '']?.act : undefined) ?? 1);
  }

  respond(req: Req): any {
    const { g, p } = req;
    switch (req.k) {
      case 'card': {
        if (req.why === 'quest') return this.best(req.cards, (id) => this.questFit(g, id));
        if (req.kind === 'ancient' || req.cards.every((id) => g.anc.has(id))) {
          return this.best(req.cards, (id) => (g.anc.get(id)?.fame ?? 0) - 0.3 * costValue(g.anc.get(id)?.repair ?? {}));
        }
        const cs = req.cards.map((id) => ({ id, c: g.byId.get(id) }));
        if (req.why === 'leader') {
          const pick = this.forced ? (req.cards.find((id) => g.card(id).engine.includes(this.forced!)) ?? this.best(req.cards, () => 0)) : this.best(req.cards, (id) => cardValue(g.card(id)));
          this.note(g.card(pick).engine, 3);
          this.leaderId = pick;
          this.setTargets(p);
          return pick;
        }
        for (const { c } of cs) if (c && (req.why === 'occ' || req.why === 'item')) this.note(c.engine, 0.3);
        const pick = this.best(req.cards, (id) => (id === 'skip' ? 1.6 : cardValue(g.card(id), this.targets) + (req.why === 'start_item' && g.card(id).kind !== 'spell' ? 0.5 : 0) + this.leadBonus(g, p, id)));
        if ((req.why === 'occ' || req.why === 'item') && pick !== 'skip') { this.note(g.card(pick).engine, 1); this.setTargets(p); }
        return pick;
      }
      case 'ratio': {
        const want: Ratio = { weapon: 2, armor: 1, tool: 1.5, spell: 1 };
        for (const t of this.targets) {
          if (WEAPON_TAGS.has(t)) want.weapon += 1.5;
          if (ARMOR_TAGS.has(t)) want.armor += 1.5;
          if (TOOL_TAGS.has(t)) want.tool += 1.5;
          if (SPELL_TAGS.has(t)) want.spell += 2;
        }
        const tot = want.weapon + want.armor + want.tool + want.spell, N = D.ITEM_COUNT;
        return this.best(req.options, (r) => -ITEM_KINDS.reduce((a, k) => a + Math.abs(r[k] - want[k] * N / tot), 0) * 3);
      }
      case 'kind': return this.best(req.options, (k) => req.left[k]);
      case 'heal': return g.round < g.R && p.res.herb >= (req.cost.herb ?? 0);
      case 'effect': {
        const v = opsValue(req.ops) + 0.5 * req.ops.reduce((a, o) => a + (o.fame ?? 0), 0);
        return v > -0.05 || this.level === 'random';
      }
      // 誰を鍛えるか：いちばん熟練の低い仲間（エンジンが先頭に並べる）
      case 'pick': return req.what.startsWith('train:') ? req.options[0] : this.best(req.options, (x) => this.choiceValue(g, p, x));
      case 'choose': return this.choose(g, p, req.opts);
    }
  }

  questFit(g: Game, id: string): number {
    const q = g.quest.get(id);
    if (!q) return 0;
    const keys = [...Object.keys(q.need.min ?? {}), ...Object.keys(q.need.res_min ?? {})];
    let v = (q.fame ?? 4) * 0.2;
    for (const t of this.targets) for (const s of TAG_STAT[t]) if (keys.includes(s)) v += 2;
    return v;
  }

  choiceValue(g: Game, p: Player, x: Choice): number {
    if (typeof x === 'string') {
      if (x === 'bed') return p.comps.length >= g.bedCap(p) ? 2 : 0.5;
      if (x === 'mage:draw') return 1.2;
      if (x === 'mage:mana') return 1;
      if (x === 'skip') return 0;
      if (x.startsWith('res:')) return this.W.res[x.slice(4) as Res] ?? 0;
      if (x === 'wall') return 1.5 + (this.targets.includes('fort') ? 1 : 0);
      if (x === 'atk') return 1 + (this.targets.some((t) => WEAPON_TAGS.has(t)) ? 0.5 : 0);
      if (x === 'def') return 0.8;
      { const an = g.anc.get(x.split('~')[0]); if (an) return an.fame - 0.3 * costValue(g.repairOf(p, x)?.cost ?? an.repair); }
      if (g.byId.has(x)) return cardValue(g.card(x), this.targets) - 0.1 * costValue(g.card(x).cost ?? {});
      const nd = g.nest(x);
      if (nd?.mon) return nd.mon.str;
      return 0;
    }
    if (x.m === 'sell') return D.sellPrice(x.r) * x.q * this.W.res.gold - this.W.res[x.r] * x.q;
    if (x.m === 'buy') return this.W.res[x.r] * x.q - D.BUY[x.r] * x.q * this.W.res.gold;
    if (x.m === 'item') return g.itemSell(x.id) * this.W.res.gold;
    if (x.m === 'stone') return (x.dir === 'sell' ? 1 : -1) * (this.W.res[x.r] * x.q - D.STONE.fame[x.tier] * 1.2);
    if (x.m === 'both') return this.W.res[x.buy.r] * x.buy.q - this.W.res[x.sell.r] * x.sell.q;
    return 0;
  }

  // ------------------------------------------------------------ 置く場所の選択（1手先読み）
  choose(g: Game, p: Player, opts: Option[]): Option {
    if (this.level === 'random' || this.rng.random() < SLIP[this.level]) return this.rng.choice(opts);
    if (!this.targets.length) this.setTargets(p);
    let best = opts[0], bv = -Infinity, raw = 0;
    const base = evaluate(g, p, this.W, this.targets);
    for (const o of opts) {
      if (!this.worthLooking(g, p, o)) continue;
      const d = this.valueOf(g, p, o) - base;
      const v = d + this.n();
      if (v > bv) { bv = v; best = o; raw = d; }
    }
    if (best.s !== '@spell') {
      this.actVal = 0.9 * this.actVal + 0.1 * Math.max(0.3, Math.min(6, raw));
      this.W.act = this.actVal * (this.wmul?.act ?? (this.tuned ? LEADER_W[this.leaderId || p.leader || '']?.act : undefined) ?? 1);
    }
    return best;
  }

  /** 明らかに無駄な選択肢を先読みしない（速さのため） */
  private worthLooking(g: Game, p: Player, o: Option): boolean {
    if (o.mode === 'chip') return false;
    if (o.mode === 'wait') return this.targets.includes('ally') && this.level !== 'novice';
    if (o.mode === 'normal' && !o.join && o.s !== 'lair') return false;
    if (o.x && typeof o.x === 'object' && (o.x.m === 'sell' || o.x.m === 'buy')) {
      const q = g.marketQty(p);
      return o.x.q === 1 || o.x.q === q || (o.x.m === 'sell' && o.x.q === p.res[o.x.r]);
    }
    if (o.x && typeof o.x === 'object' && o.x.m === 'both') return o.x.sell.q === Math.min(g.marketQty(p), p.res[o.x.sell.r]);
    if (o.x && typeof o.x === 'object' && o.x.m === 'stone') return o.x.dir === 'sell';
    return true;
  }

  valueOf(g: Game, p: Player, o: Option): number {
    const fight = (g.nest(o.s) || o.s === 'lair') && o.i >= 0;
    const run = (fate: number | null) => {
      const g2 = g.clone();
      g2.forceFate = fate;
      const p2 = g2.players[p.pid];
      // 主の巣：まだ置いていない人も（休んでいない仲間を2人まで）挑むと見込む。主は全員で挑む強さなので、先に置く人が損に見えないように
      if (o.s === 'lair') for (const q of g2.players) {
        if (q === p2 || g2.lairQ.some((e) => e.pid === q.pid)) continue;
        const k = Math.min(q.fightable(), LAIR_GUESS);
        if (k > 0) g2.lairQ.push({ pid: q.pid, idxs: g2.pickComps(q, k), mode: 'normal' });
      }
      drive(g2.apply(p2, o));
      const decks = o.s === 'lair' ? g2.lairQ.map((e) => { const q = g2.players[e.pid]; return q.fate.length ? [...q.fate] : D.FATE_DECK; }) : [];
      let adj = 0;
      if (o.s === 'lair') {
        const boss = g2.bossOf[g2.round]!;
        const dragon = boss.type === D.ANCIENT_DRAGON.id;
        drive(g2.resolveLair());
        // 主・古竜に負けたときの罰（古竜の −3、主の襲撃）は誰も挑まなくても受けるので、ほかの手と同じ土台で比べる：
        // 負けの罰は打ち消し、勝てば避けられた罰を足す。参加しない人の −BOSS_ABSENT はほかの手の盤面にはまだ出ていないので、避けた分を足す
        const won = g2.lastClash?.win;
        if (dragon) adj = D.DRAGON.fail;
        else if (won) adj = Math.max(0, boss.raid - g.homeGuard(p)) * 0.8;
        adj += D.BOSS_ABSENT;
      }
      if (o.mode === 'wait') {
        const nd = g2.nest(o.s)!;
        if (nd.wait && nd.mon) { const w = nd.wait; nd.wait = null; drive(g2.fight(nd, [{ p: p2, idxs: w.idxs, mode: 'gamble' }])); }
      }
      return { v: evaluate(g2, p2, this.W, this.targets) + adj, clash: g2.lastClash, decks };
    };
    if (!fight) return run(null).v;
    const deck = p.fate.length ? p.fate : D.FATE_DECK;
    if (o.s === 'lair') {
      // 主の巣：全員の運命の合計で勝つ確率を出し、勝った盤面と負けた盤面を混ぜる
      const hi = run(Math.max(...deck)), lo = run(Math.min(...deck));
      if (!hi.clash || !lo.clash || hi.clash.win === lo.clash.win) return (hi.v + lo.v) / 2;
      const need = hi.clash.strength - hi.clash.base;
      const pwin = sumAtLeast(hi.decks, need);
      return pwin * hi.v + (1 - pwin) * lo.v;
    }
    const hi = run(Math.max(...deck)), lo = run(Math.min(...deck));
    if (!hi.clash || !lo.clash || hi.clash.win === lo.clash.win) return (hi.v + lo.v) / 2;
    const need = hi.clash.strength - hi.clash.base;
    const pwin = deck.filter((v) => v >= need).length / deck.length;
    let v = pwin * hi.v + (1 - pwin) * lo.v;
    if (o.mode === 'wait') v += 0.8;
    return v;
  }

  // ------------------------------------------------------------ 取引
  /** 詐欺師：了承なしの取引でほかの人を妨害する。いちばん名声の高い相手から、その人のいちばん値打ちのある資源を取り、
   *  こちらのいちばん安い資源を同じ数だけ渡す（冬の前で食料が足りなければ、食料を先に取る） */
  private swindle(g: Game, p: Player) {
    const foes = g.players.filter((q) => q !== p).sort((a, b) => score(g, b) - score(g, a));
    const toW = 4 - ((g.round - 1) % 4) - 1;
    const short = Math.max(0, D.upkeepOf(p.comps.length) - p.res.food);
    // 冬の直前（冬のラウンドの自分の最後の手番）：相手の食料を取って、相手を食料不足（不満＝名声が減る）にできるなら取る
    // 冬のラウンドは、取引（1ラウンド1回）を最後の手番まで取っておく
    if (toW === 0 && p.avail() > 1) return;
    if (toW === 0) {
      const lack = (q: Player, food: number) => {
        const need = g.upkeepNeed(q), wg = g.mods(q).winter_gold || D.WINTER_GOLD;
        const sh = Math.max(0, need - food - Math.floor(q.res.gold / wg));
        return Math.ceil(sh / D.UPKEEP) * D.DISCONTENT;
      };
      let best: { q: Player; k: number; r: Res; v: number } | null = null;
      const mine = RES.filter((x) => x !== 'food' && x !== 'gold' && p.res[x] > 0).sort((a, b) => p.res[b] - p.res[a]);
      for (const q of foes) for (const r of mine) {
        const k = Math.min(D.LEADER.swindler.tradeMax + g.mods(p).trade_max, q.res.food, p.res[r]);
        if (k <= 0) continue;
        // 相手が失う名声（点の高い相手ほど重く）＋自分の食料不足が減る分
        const v = (lack(q, q.res.food - k) - lack(q, q.res.food)) * (q === foes[0] ? 1.2 : 1) + Math.min(k, short) * 0.5;
        if (v > 0 && (!best || v > best.v)) best = { q, k, r, v };
      }
      if (best) {
        const give: Cost = { [best.r]: best.k }, get: Cost = { food: best.k };
        if (!g.tradeOk(p, best.q, give, get)) { g.trade(p, best.q, give, get); return; }
      }
    }
    for (const q of foes) {
      const want = (short > 0 && toW <= 1 && q.res.food > 0 ? ['food' as Res] : [])
        .concat(RES.filter((r) => q.res[r] > 0).sort((a, b) => D.RES_VAL[b] * Math.min(q.res[b], D.TRADE_MAX) - D.RES_VAL[a] * Math.min(q.res[a], D.TRADE_MAX)));
      for (const r of want) {
        const mine = RES.filter((x) => x !== r && p.res[x] > 0).sort((a, b) => D.RES_VAL[a] - D.RES_VAL[b]);
        if (!mine.length || D.RES_VAL[mine[0]] >= D.RES_VAL[r] && r !== 'food') continue;
        const k = Math.min(D.TRADE_MAX, q.res[r], p.res[mine[0]]);
        if (k <= 0) continue;
        const give: Cost = { [mine[0]]: k }, get: Cost = { [r]: k };
        if (!g.tradeOk(p, q, give, get)) { g.trade(p, q, give, get); return; }
      }
    }
  }
  judgeOffer(g: Game, p: Player, recv: Cost, send: Cost): boolean {
    const val = (c: Cost) => Object.entries(c).reduce((a, [r, n]) => a + this.needW(g, p, r as Res) * (n as number), 0);
    return val(recv) - val(send) > 0.05;
  }
  private needW(g: Game, p: Player, r: Res) {
    let w = this.W.res[r];
    if (r === 'food') { const need = D.upkeepOf(p.comps.length); if (p.res.food < need) w += 0.4; }
    return w;
  }
  /** リーダーに合うカードを高く見る（職人：名声のある道具） */
  leadBonus(g: Game, p: Player, id: string): number {
    if (!g.byId.has(id)) return 0;
    const c = g.card(id);
    if (g.is(p, 'crafter') && c.kind === 'tool') return 1 + 1.5 * (c.fame ?? 0);
    return 0;
  }
  tradePhase(g: Game, p: Player) {
    if (p.tradesUsed >= g.tradeLimit(p)) return;
    if (g.is(p, 'swindler')) { this.swindle(g, p); return; }
    if (!this.trade_on) return;
    const toW = 4 - ((g.round - 1) % 4) - 1;
    const need = D.upkeepOf(p.comps.length) - p.res.food;
    if (need <= 0 || toW > 1) return;
    const surplus = (['wood', 'iron', 'herb', 'mat', 'mana'] as Res[]).filter((r) => p.res[r] >= 3).sort((a, b) => p.res[b] - p.res[a]);
    if (!surplus.length) return;
    for (const q of g.players) {
      if (q === p || !(q.ai instanceof AI) || !q.ai.trade_on) continue;
      const give: Cost = { [surplus[0]]: 2 }, get: Cost = { food: Math.min(2, need) };
      if (g.tradeOk(p, q, give, get)) continue;
      if (q.ai.judgeOffer(g, q, give, get)) { g.trade(p, q, give, get); return; }
    }
  }
}

/** 山ごとに1枚ずつめくった合計が need 以上になる確率 */
export function sumAtLeast(decks: number[][], need: number): number {
  let dist = new Map<number, number>([[0, 1]]);
  for (const d of decks) {
    const nx = new Map<number, number>();
    for (const [s, pr] of dist) for (const v of d) nx.set(s + v, (nx.get(s + v) ?? 0) + pr / d.length);
    dist = nx;
  }
  let p = 0;
  for (const [s, pr] of dist) if (s >= need) p += pr;
  return p;
}

// ------------------------------------------------------------ 評価関数
const REPAIR_PUSH = 2;
const SKILL_BONUS = 2.2;
function wintersFrom(g: Game, r: number) { let n = 0; for (let w = 4; w <= g.R; w += 4) if (w >= r) n++; return n; }

export function evaluate(g: Game, p: Player, W: W, targets: EngineTag[] = []): number {
  const rl = g.R - g.round;
  let v = score(g, p);
  const dec = Math.min(1, (rl + 1) / 4);
  for (const r of RES) {
    if (r === 'gold') continue;
    v += W.res[r] * Math.min(p.res[r], 8) * dec + 0.08 * Math.max(0, p.res[r] - 8) * dec;
  }
  v += (p.res.gold % D.GOLD_PER_FAME) * 0.2 * (1 - dec) + (W.res.gold * Math.min(p.res.gold, 12) + 0.03 * Math.max(0, p.res.gold - 12)) * dec;
  for (const f of p.future) v += 0.9 * costValue(f.gain);
  // 冬の食料
  const wl = wintersFrom(g, g.round);
  if (wl) {
    const mods = g.mods(p);
    const need = Math.max(0, D.upkeepOf(p.comps.length) + mods.upkeep);
    let nextW = g.round; while (nextW % 4) nextW++;
    const urg = Math.min(2, Math.max(0.4, 2 / (1 + nextW - g.round)));
    const short = Math.max(0, need - p.res.food);
    v -= W.short * short * urg;
    v -= 0.25 * W.short * Math.max(0, need * wl - p.res.food - short);
  }
  // 主・古竜の備え：その年の主の巣（冬）までは、後押しに使う薬草（ポーション）と冬の分を超える食料（士気）を少し高く見る
  const lair = g.year(g.round) * 4;
  if (g.bossOf[lair] && g.round < lair && lair - g.round <= 3) {
    const spare = Math.max(0, p.res.food - D.upkeepOf(p.comps.length));
    v += BOSS_PREP.herb * Math.min(p.res.herb, 4) + BOSS_PREP.food * Math.min(spare, 3);
  }
  // 仲間（この先の手数）と負傷
  v += W.act * p.comps.length * Math.min(rl, 8) * 0.5;
  v -= W.act * p.comps.filter((c) => c.injured || c.rest).length * (rl > 0 ? 1 : 0);
  // 戦力・守り
  const mods = g.mods(p);
  let pw = g.bringPets(p).reduce((a, i) => a + p.pets[i].power + mods.pet_power, 0) + mods.power + p.rage;
  let df = 0;
  // 熟練は努力家なら3倍で効く。熟練は壊れず、ずっと残るので少し高く見る（SKILL_BONUS）
  const sm = g.skillMult(p);
  let sk = 0;
  for (const c of p.comps) {
    // 武器の戦力は武器狂いアカネなら倍。武器の守りも守りに入る
    pw += c.atk * sm * SKILL_BONUS + (c.weapon ? (g.card(c.weapon).power ?? 0) * g.weaponMult(p) : 0);
    df += c.def * sm * SKILL_BONUS + (c.armor ? g.card(c.armor).guard ?? 0 : 0) + (c.weapon ? g.card(c.weapon).guard ?? 0 : 0);
    sk += c.atk + c.def;
  }
  // 努力家：勝つたびに送った仲間の熟練の合計 ÷ fameDiv の名声。残りの戦闘の見込み（4ラウンドに約3回）で数える
  if (g.is(p, 'striver')) v += sk / D.LEADER.striver.fameDiv * Math.min(rl, 12) * 0.35;
  // 鉄壁ガレス：守りが戦力として倍で効く
  if (g.is(p, 'shield')) pw += df * D.LEADER.shield.guardMult;
  // 戦力1の値打ち：残りのラウンドで、勝つ見込みが上がる分（1ラウンドに約0.25）。終盤ほど小さい
  v += W.perm * pw * Math.min(rl, 12) * 0.25;
  v += W.defn * df * Math.min(rl, 12) * 0.25;
  // このラウンドにもう1人置ける・このラウンドの秘術の後押し（戦闘にまだ出られるなら）
  v += W.act * p.extra;
  if (rl >= 0 && p.fightable() > 0) v += 0.3 * (p.rbuf.power - p.rbuf.str) + 0.15 * (p.rbuf.guard - p.rbuf.counter);
  // 先手（次のラウンドに好きなマスを先に取れる）
  if (g.nextFirst === p.pid && g.first !== p.pid && rl > 0) v += 0.4 + 0.2 * g.n;
  // 連唱魔女ミナ：このラウンドに使った秘術は、勝てば1つ名声2になる
  if (g.is(p, 'mage') && p.st.castsRound) v += p.st.castsRound * D.LEADER.mage.fame * (p.st.mageWon ? 1 : p.fightable() > 0 ? 0.5 : 0);
  // 魔石は名声として score に入っているが、手札の武器・防具を作る元にもなる（作れる段階の魔石を少し高く見る）
  for (const c of p.hand) { const t = g.stoneNeed(c, p); if (t !== null && p.stones[t] > 0) v += 0.4; }
  v += W.pet * p.pets.length * Math.min(rl, 12) / 12;
  const wAfter = wintersFrom(g, g.round + 1) + (g.isWinter() ? 1 : 0);
  v += W.wall * Math.min(g.homeGuard(p), 4) * Math.min(wAfter, 3) * 0.5;
  // カード
  for (const c of p.hand) v += W.hand * cardValue(g.card(c), targets) * Math.min(1, rl / 6);
  for (const c of g.activeCards(p)) v += W.played * cardValue(g.card(c), targets) * Math.min(rl, 12) / 12;
  for (const c of g.storage(p)) v += 0.3 * g.itemSell(c);
  // 壊れた遺物（修復すれば名声）。魔石は試合の終わりの名声として score に入っている
  if (p.acts.includes('repair')) v += REPAIR_PUSH;
  for (const id of p.broken) v += (rl > 0 ? 0.3 : 0) * (g.anc.get(id)?.fame ?? 0);
  // 依頼の進み具合
  for (const q of g.quests) {
    if (q.done.includes(p.pid) || q.done.length >= D.QUEST_FAME.length) continue;
    const qd = g.quest.get(q.id)!;
    let prog = 1;
    for (const [k, n] of Object.entries(qd.need.min ?? {})) prog = Math.min(prog, g.stat(p, k as never) / (n as number));
    for (const [r, n] of Object.entries(qd.need.res_min ?? {})) prog = Math.min(prog, p.res[r as Res] / (n as number));
    v += W.quest * D.QUEST_FAME[q.done.length] * Math.max(0, Math.min(1, prog)) ** 2;
  }
  // 目指す強い動き：部品と、このラウンドの「一周」
  for (const t of targets) {
    for (const c of g.activeCards(p)) if (g.card(c).engine.includes(t)) v += W.tag;
    v += W.loop * loopDone(t, p.acts) * Math.min(1, (rl + 1) / 4);
  }
  return v;
}

