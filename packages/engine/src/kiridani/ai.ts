// 霧谷の冒険者団 — AI（Python 版 ai.py の写し）：ヒューリスティック評価＋1手先読み（貪欲）。腕前はノイズ量で表す。
// 巣の手は k∈{1,2} × 方針(safe/gamble/chip/wait) を列挙し、残りの運命カードで期待値を取る。
import * as D from './data';
import type { Cost, Element, MonsterDef } from './data';
import { BASIC, Game, Player, canPay, drive, isBeast, score, WEAPON_POWER, type Brain, type Opt, type Option, type Req } from './engine';
import { MRandom, erf, pysumF } from './rng';

const { CARDS, CHAR, MON, NUM_ROUNDS, WINTER_ROUNDS, HERO_BONUS, GOLD_PER_FAME, MAX_COMPANIONS, FAME_PER_COMPANION, UPKEEP, POWER_PER, QUEST_FAME, RATING, CHAR_RATING } = D;

export type Level = 'random' | 'novice' | 'mid' | 'expert';
export interface W { [k: string]: any; tag: Record<string, number> }

export const DEFAULT_W: W = {
  act: 1.3,
  wood: 0.35, iron: 0.5, herb: 0.4, mana: 0.65, food: 0.4, gold: 0.18, mat: 0.5,
  short: 2.2, perm: 0.30, defn: 0.12, bed: 0.45, wall: 0.9, hand: 0.45, played: 5.0, inj: 0.8, ready: 0.45,
  threat: 0.25, quest: 0.6, wait: 0.3, join: 0.3, pet: 0.6, tag: {},
};

export const ARCHETYPES: Record<string, Partial<W>> = {
  melee: { perm: 0.36, iron: 0.58, defn: 0.15, tag: { front: 0.6, iron: 0.4, chain: 0.4 } },
  magic: { mana: 0.78, tag: { mana: 0.6, fire: 0.3, ice: 0.3, thunder: 0.3, dark: 0.2, light: 0.2 } },
  beast: { food: 0.55, pet: 1.4, tag: { beast: 0.9, food: 0.3 } },
  fortress: { wall: 1.15, wood: 0.42, tag: { wall: 0.8, wood: 0.3, herb: 0.2 } },
  trader: { gold: 0.2, mat: 0.5, tag: { trade: 0.5, gold: 0.4 } },
  coop: { wait: 0.6, join: 0.6, tag: { coop: 0.9, support: 0.5 } },
};
export const ARCH_CHARS: Record<string, Set<string>> = {
  melee: new Set(['gan', 'riku', 'goro']), magic: new Set(['mina', 'yuki']), beast: new Set(['haru', 'momo']),
  fortress: new Set(['goro', 'toma']), trader: new Set(['leo', 'aya']), coop: new Set(['aya', 'nana', 'sana']),
};

const rating = (c: string) => RATING[c] ?? 1.0;
const tagsOf = (c: string) => CARDS[c].tags;
const tagSum = (tw: Record<string, number>, tags: string[]) => tags.reduce((a, t) => a + (tw[t] ?? 0), 0);

export function winters_left(g: Game, inclusive = true) {
  return WINTER_ROUNDS.filter((w) => (inclusive ? w >= g.round : w > g.round)).length;
}

export function perm_power(_g: Game, p: Player) {
  const top2 = [...p.skills].sort((a, b) => b - a).slice(0, 2);
  let pw = top2.reduce((a, b) => a + b, 0) + p.weapons.reduce((a, w) => a + (WEAPON_POWER[w] ?? 0), 0);
  pw += p.pets * (p.occs.includes('o07') ? 3 : 2) + (p.weapons.includes('i08') ? p.pets : 0);
  const o = p.occs;
  const has = (c: string) => Number(o.includes(c));
  pw += 3 * has('o11') + 5 * has('o26') + 4 * Number(o.includes('o28') && p.comps <= 3) + 1 * Number(p.tools.includes('i13'));
  pw += 1.5 * has('o17') + 1.5 * has('o22') + 0.8 * has('o30') + 0.5 * has('o16');
  return pw;
}

export function boost_potential(g: Game, p: Player): [number, Set<Element>] {
  let tot = 0;
  const els = new Set<Element>();
  let used: Record<string, number> = {};
  for (const [, pw, c, el] of g.boost_list(p, MON.rat, false)) {
    const t = { ...used };
    for (const [r, n] of Object.entries(c)) t[r] = (t[r] ?? 0) + (n as number);
    if (canPay(p, t as Cost)) {
      used = t;
      tot += pw;
      if (el) els.add(el);
    }
  }
  return [tot, els];
}

export function evaluate(g: Game, p: Player, W: W): number {
  const r = g.round;
  const rl = NUM_ROUNDS - r;
  const prog = r / NUM_ROUNDS;
  const dec = Math.min(1.0, (rl + 1) / 4.0);
  let v = score(p);
  const res = p.res;
  const others = g.n > 1 ? Math.max(...g.players.filter((q) => q !== p).map((q) => q.trophies)) : 0;
  const lead = p.trophies - others;
  v += HERO_BONUS * (1 / (1 + Math.exp(-lead / 2.0))) * (0.2 + 0.8 * prog);
  v += (res.gold % GOLD_PER_FAME) * 0.2 * (1 - dec) + W.gold * res.gold * dec;
  for (const k of ['wood', 'iron', 'herb', 'mana', 'mat'] as const) v += W[k] * Math.min(res[k], 8) * dec + 0.1 * Math.max(0, res[k] - 8) * dec;
  v += W.act * (p.avail() + rl * (p.comps - 0.3 * p.injured.size));
  v -= W.inj * p.injured.size;
  const wl = winters_left(g, true);
  if (wl) {
    const nxtW0 = Math.min(...WINTER_ROUNDS.filter((w) => w >= r));
    const ww = nxtW0 - r < g.forecast(p) + 1 ? g.weather[nxtW0 - 1] : 'calm';
    const up = g.upkeep(p, ww);
    const needAll = up * wl;
    const f = res.food + (p.occs.includes('o08') ? Math.floor(res.herb / 2) * 3 : 0);
    const nxtW = nxtW0;
    const urg = Math.min(2.0, Math.max(0.4, 2.0 / (1 + nxtW - r)));
    const shortNext = Math.max(0, up - f);
    v -= W.short * shortNext * urg;
    v -= 0.25 * W.short * Math.max(0, needAll - f - shortNext);
    v += 0.15 * Math.min(Math.max(0, f - needAll), 4);
  }
  v += W.perm * perm_power(g, p) * rl / 4.0;
  v += W.defn * g.defense(p, 2) * rl / 4.0;
  v += W.pet * p.pets * rl / 12.0;
  if (p.tools.includes('i27') && p.egg < 3) v += 1.5 * (p.egg + 1) - (res.food >= 2 ? 0 : 1.0);
  if (p.comps < MAX_COMPANIONS && rl >= 2 && (p.comps < p.bed_cap() || (D.NANA_FREE_BED && p.char === 'nana' && !('nana_bed' in p.st)))) {
    v += W.bed * (FAME_PER_COMPANION + W.act * (rl - 1) - UPKEEP * winters_left(g, false) * 0.4);
  } else if (p.comps < MAX_COMPANIONS && rl >= 3) {
    v += 0.3 * W.bed * Math.min(1.0, p.res.wood / 3) * (FAME_PER_COMPANION + W.act * (rl - 2));
  }
  const wlAfter = winters_left(g, false) + (WINTER_ROUNDS.includes(r) ? 1 : 0);
  if (wlAfter) {
    const red = 6 - g.raid_damage(p, 6) + (p.walls % D.RAID_WALLS && !p.occs.includes('o13') ? 0.5 : 0);
    v += W.wall * Math.min(red, 4) * wlAfter;
  }
  const tw = W.tag;
  const cardVal = (c: string) => rating(c) + tagSum(tw, tagsOf(c)) * 0.5;
  v += W.hand * pysumF(p.hand.map(cardVal)) * Math.min(1.0, rl / 6);
  v += W.played * pysumF([...p.occs, ...p.tools, ...p.weapons].map(cardVal)) * rl / 12;
  if (rl >= 0) {
    const base2 = 2 * POWER_PER + perm_power(g, p);
    const [bp, bels] = boost_potential(g, p);
    const best: number[] = [];
    const mons = [...[...g.nests.values()].filter((nd) => nd.mon).map((nd) => nd.mon!), ...g.visible_spawns(p).slice(0, 3)];
    const wels = g.weapon_els(p);
    for (const mid of mons) {
      const m = MON[mid];
      const els = new Set([...bels, ...wels]);
      const margin = base2 + bp + g.elem_bonus(p, m, els) - m.str;
      best.push(m.trophy * Math.min(1.0, Math.max(0.0, (margin + 3) / 5.0)));
    }
    best.sort((a, b) => b - a);
    v += W.ready * pysumF(best.slice(0, 2)) * Math.min(1.0, rl / 2 + 0.5);
    let threat = 0;
    for (const nd of g.nests.values()) if (nd.mon) threat += MON[nd.mon].raid;
    threat += 2 * D.RAID_FROM_DECK;
    v -= W.threat * Math.max(0, g.raid_damage(p, threat)) * (wl ? 1 : 0);
  }
  for (const q of g.quests) {
    const d = g.quest_done[q];
    if (d.includes(p.pid) || d.length >= 3) continue;
    v += W.quest * QUEST_FAME[d.length] * quest_prog(g, p, q) * 0.5;
  }
  return v;
}

export function quest_prog(_g: Game, p: Player, q: string) {
  const s = p.st;
  const f: Record<string, number> = {
    q_kill4: s.kills / 4, q_beast2: s.beast / 2, q_undead2: s.undead / 2, q_boss: 0,
    q_comp4: (p.comps - 2) / 2, q_fac3: p.tools.length / 3, q_wall3: p.walls / 3, q_weap3: p.weapons.length / 3,
    q_occ3: p.occs.length / 3, q_spell2: s.spells / 2, q_weak3: s.weak / 3,
    q_gold10: p.res.gold / 10, q_coop2: s.coop / 2, q_mat6: p.res.mat / 6, q_skill3: p.skills.reduce((a, b) => a + b, 0) / 3,
  };
  return Math.min(1.0, Math.max(0.0, f[q])) ** 2;
}

export class AI implements Brain {
  level: Level;
  W: W;
  arch?: string;
  rng: MRandom;
  noise: number | null;
  trade_on: boolean;

  constructor(level: Level = 'mid', opts: { W?: Partial<W>; seed?: number; trade?: boolean; arch?: string } = {}) {
    this.level = level;
    this.W = { ...DEFAULT_W };
    this.arch = opts.arch;
    if (opts.arch) Object.assign(this.W, ARCHETYPES[opts.arch]);
    if (opts.W) Object.assign(this.W, opts.W);
    this.rng = new MRandom(opts.seed ?? 0);
    this.noise = ({ random: null, novice: 1.5, mid: 0.6, expert: 0.1 } as const)[level];
    this.trade_on = (opts.trade ?? true) && level !== 'random';
  }

  respond(req: Req): any {
    switch (req.k) {
      case 'draft': return this.draft_pick(req.g, req.p, req.cards, req.kind, req.ingame);
      case 'char': return this.pick_character(req.g, req.p, req.options);
      case 'choose': return this.choose(req.g, req.p, req.opts);
      case 'hourglass': return this.use_hourglass(req.g, req.p);
      case 'tame': return this.want_tame(req.g, req.p, req.m);
      case 'heal': return this.sana_heal(req.g, req.p);
      case 'tan': return this.tan_hide(req.g, req.p);
      case 'weather': return this.weather_choice(req.g, req.p);
      case 'storm': return this.want_storm(req.g, req.p, req.nr);
    }
  }

  // ---------------------------------------------------------- 1手の価値
  option_value(g: Game, p: Player, sid: string, opt: Opt): number {
    const W = this.W;
    if (sid.startsWith('nest')) return this.nest_value(g, p, sid, opt as [number, string, string]);
    const g2 = g.clone_for(p.pid);
    const p2 = g2.players[p.pid];
    if (sid === 'lair') {
      drive(g2.apply(p2, sid, opt));
      return evaluate(g2, p2, W) + this.lair_bonus(g, p, g2, p2);
    }
    drive(g2.apply(p2, sid, opt));
    g2.check_quests(p2);
    return evaluate(g2, p2, W);
  }

  nest_value(g: Game, p: Player, nid: string, opt: [number, string, string]): number {
    const mode = opt[1];
    const nd = g.nest(nid);
    let extra: number[] = nd.wait ? [nd.wait.pid] : [];
    if (nd.trapper !== null) extra = [...extra, nd.trapper];
    const dist = g.fate_dist(p);
    const vals = [...dist.keys()].sort((a, b) => a - b);
    const g2 = g.clone_for(p.pid, extra);
    const p2 = g2.players[p.pid];
    let run: (fv: number) => [number, number];
    let bonus: number;
    if (mode === 'wait') {
      drive(g2.apply(p2, nid, opt));
      const w = g2.nest(nid).wait!;
      g2.nest(nid).wait = null;
      const baseG = g2;
      run = (fv) => {
        const g3 = baseG.clone_for(p.pid, extra);
        const p3 = g3.players[p.pid];
        drive(g3.resolve(p3, nid, w.plan, null, fv));
        g3.check_quests(p3);
        return [evaluate(g3, p3, this.W), g3.last_need];
      };
      bonus = this.W.wait;
    } else {
      run = (fv) => {
        const g3 = g.clone_for(p.pid, extra);
        const p3 = g3.players[p.pid];
        drive(g3.apply(p3, nid, opt, fv));
        g3.check_quests(p3);
        return [evaluate(g3, p3, this.W), g3.last_need];
      };
      bonus = extra.length ? this.W.join : 0.0;
    }
    const [vLo, need] = run(vals[0]);
    const winVals = vals.filter((x) => x >= need);
    const pw = pysumF(winVals.map((x) => dist.get(x)!));
    if (vals[0] >= need) return vLo + bonus;
    if (!winVals.length) return vLo + bonus;
    const [vHi] = run(winVals[0]);
    return pw * vHi + (1 - pw) * vLo + bonus;
  }

  lair_bonus(g: Game, p: Player, g2: Game, _p2: Player): number {
    const m = g.bosses[g.round];
    const pool = g.lair.reduce((a, e) => a + e.plan.power, 0);
    const mine = g2.lair[g2.lair.length - 1].plan.power;
    const joined = new Set([...g.lair.map((e) => e.pid), p.pid]);
    let expMore = 0.0;
    for (const q of g.players) {
      if (joined.has(q.pid)) continue;
      if (q.avail() > 0) expMore += Math.min(q.avail(), 2) / 2 * 0.75 * (2 * POWER_PER + perm_power(g, q)) * (g.round === 12 ? 1.0 : 0.6);
    }
    const nPart = joined.size;
    const pwin = (pw: number, n: number) => {
      const mu = pw + 0.5 * n;
      const sd = Math.sqrt(0.9 * Math.max(1, n)) + 1.5;
      const z = (mu - m.str + 0.5) / sd;
      return 0.5 * (1 + erf(z / Math.sqrt(2)));
    };
    const othersN = nPart - 1 + Number(expMore > 0) * 1;
    const pWith = pwin(pool + mine + expMore, nPart + (expMore ? 1 : 0));
    const pWo = pwin(pool + expMore, othersN);
    let v: number;
    if (g.round === 12) {
      const o17 = p.occs.includes('o17') ? D.O17_DRAGON_FAME : 0;
      const vwin = D.DRAGON_JOIN_FAME + (p.occs.includes('o26') ? 8 : 0) + o17 / Math.max(pWith, 0.1) * 0;
      v = pWith * vwin + (pWith - pWo) * D.DRAGON_FAIL + o17;
    } else {
      const share = mine >= Math.max(...g.lair.map((e) => e.plan.power), 0) ? m.trophy : m.trophy * D.BOSS_SHARE;
      const vwin = share + 1.2 + (p.weapons.includes('i26') ? D.I26_BOSS_FAME : 0);
      v = pWith * vwin + (pWith - pWo) * 0.5 * g.raid_damage(p, m.raid);
    }
    return v;
  }

  // ---------------------------------------------------------- 手の選択
  choose(g: Game, p: Player, opts: Option[]): Option {
    if (this.level === 'random') return this.rng.choice(opts);
    const vals = opts.map(([sid, opt]) => this.option_value(g, p, sid, opt));
    if (vals.length >= 2) {
      const s = [...vals].sort((a, b) => b - a);
      g.close_calls += Number(s[0] - s[1] < 0.5);
    }
    let best: Option | null = null, bv = -1e9;
    opts.forEach((o, i) => {
      const v2 = vals[i] + this.rng.gauss(0, this.noise!);
      if (v2 > bv) { best = o; bv = v2; }
    });
    return best!;
  }

  /** 画面用：選択肢ごとの評価値（ノイズなし・乱数を進めない複製で計算） */
  values(g: Game, p: Player, opts: Option[]): number[] {
    const saved = this.rng;
    this.rng = new MRandom(0);
    try { return opts.map(([sid, opt]) => this.option_value(g, p, sid, opt)); } finally { this.rng = saved; }
  }

  // ---------------------------------------------------------- 小さな判断
  want_tame(g: Game, _p: Player, _m: MonsterDef) { return g.round <= 10; }
  sana_heal(_g: Game, _p: Player) { return true; }
  tan_hide(_g: Game, _p: Player) { return true; }
  use_hourglass(_g: Game, _p: Player) { return true; }
  want_storm(_g: Game, _p: Player, _nr: number) { return true; }
  weather_choice(g: Game, p: Player): string | null {
    const nr = g.round + 1;
    const s = g.season(nr);
    const els = new Set<string | null>([...g.weapon_els(p), p.hand.includes('i19') || p.occs.includes('o01') ? 'fire' : null, p.occs.includes('o19') ? 'dark' : null]);
    for (const [wid, [el]] of Object.entries(D.WEATHER_EL)) {
      if (els.has(el) && D.WEATHER[s].includes(wid) && g.weather[g.round] !== wid) return wid;
    }
    return null;
  }

  // ---------------------------------------------------------- ドラフト
  card_score(_g: Game, p: Player, c: string, chars?: string[]) {
    const card = CARDS[c];
    const cs = chars ?? (p.char ? [p.char] : p.char_opts);
    let s = rating(c);
    const tw = this.W.tag;
    s += tagSum(tw, card.tags);
    let syn = 0;
    for (const ch of cs) {
      const sy = (card.chars.includes(ch) ? 0.8 : 0) + 0.15 * card.tags.filter((t) => CHAR[ch].tags.includes(t)).length;
      syn = Math.max(syn, sy);
    }
    s += syn;
    const handTags: Record<string, number> = {};
    for (const h of p.hand) for (const t of CARDS[h].tags) handTags[t] = (handTags[t] ?? 0) + 1;
    s += 0.08 * card.tags.reduce((a, t) => a + (handTags[t] ?? 0), 0);
    return s;
  }

  draft_pick(g: Game, p: Player, cards: string[], _kind: string, _ingame = false): string {
    if (this.level === 'random') return this.rng.choice(cards);
    const noise = this.noise! * 0.6;
    let best = cards[0], bv = -Infinity;
    for (const c of cards) {
      const v = this.card_score(g, p, c) + this.rng.gauss(0, noise);
      if (v > bv) { best = c; bv = v; }
    }
    return best;
  }

  pick_character(_g: Game, p: Player, options: string[]): string {
    if (options.length === 1 || this.level === 'random') return this.rng.choice(options);
    const cs = (ch: string) => {
      let s = CHAR_RATING[ch] ?? 0.0;
      for (const c of p.hand) {
        const card = CARDS[c];
        s += (card.chars.includes(ch) ? 0.8 : 0) + 0.15 * card.tags.filter((t) => CHAR[ch].tags.includes(t)).length;
      }
      if (this.arch && ARCH_CHARS[this.arch].has(ch)) s += 1.0;
      return s + this.rng.gauss(0, this.noise!);
    };
    let best = options[0], bv = -Infinity;
    for (const o of options) { const v = cs(o); if (v > bv) { best = o; bv = v; } }
    return best;
  }

  // ---------------------------------------------------------- 取引
  marginals(g: Game, p: Player): [Record<string, number>, Record<string, number>] {
    const base = evaluate(g, p, this.W);
    const mp: Record<string, number> = {}, mm: Record<string, number> = {};
    for (const r of BASIC) {
      p.res[r] += 1;
      mp[r] = evaluate(g, p, this.W) - base;
      p.res[r] -= 1;
      if (p.res[r] > 0) {
        p.res[r] -= 1;
        mm[r] = base - evaluate(g, p, this.W);
        p.res[r] += 1;
      }
    }
    return [mp, mm];
  }

  trade_gain(g: Game, p: Player, give: Cost, get: Cost) {
    const g2 = g.clone_for(p.pid);
    const q = g2.players[p.pid];
    const base = evaluate(g, p, this.W);
    for (const [r, n] of Object.entries(give)) q.res[r as keyof typeof q.res] -= n as number;
    for (const [r, n] of Object.entries(get)) q.res[r as keyof typeof q.res] += n as number;
    if (Object.values(q.res).some((v) => v < 0)) return -99;
    return evaluate(g2, q, this.W) - base;
  }

  accept(g: Game, p: Player, give: Cost, get: Cost) {
    if (!this.trade_on) return false;
    const thr = this.level === 'expert' ? 0.3 : 0.0;
    return this.trade_gain(g, p, give, get) + this.rng.gauss(0, (this.noise || 0) * 0.3) > thr;
  }

  /** 人間からの取引の提案に乗るか（乱数を使わない判定。AI どうしの accept と同じ評価としきい値） */
  judge_offer(g: Game, p: Player, give: Cost, get: Cost): { accept: boolean; gain: number } {
    const gain = this.trade_gain(g, p, give, get);
    const thr = this.level === 'expert' ? 0.3 : 0.0;
    return { accept: this.trade_on && gain > thr, gain };
  }

  tradePhase(g: Game, p: Player) {
    if (!this.trade_on || p.used.size || p.extra < 0) return;
    const key = `traded:${g.round}`;
    if (p.once.has(key)) return;
    p.once.add(key);
    const tries = 1 + (p.char === 'aya' ? 1 : 0) + (p.tools.includes('i15') ? 1 : 0);
    const [mp, mm] = this.marginals(g, p);
    const cand: [number, Player, Cost, Cost][] = [];
    for (const o of g.players) {
      if (o === p || !o.ai?.marginals) continue;
      const [omp, omm] = o.ai.marginals(g, o);
      for (const x of Object.keys(mm)) {
        for (const y of Object.keys(omm)) {
          if (x === y) continue;
          for (const [nx, ny] of [[1, 1], [2, 1], [1, 2]]) {
            if (p.res[x as keyof typeof p.res] < nx || o.res[y as keyof typeof o.res] < ny) continue;
            const mine = ny * mp[y] - nx * mm[x];
            const theirs = nx * omp[x] - ny * omm[y];
            if (mine > 0.4 && theirs > 0.2) cand.push([mine, o, { [x]: nx }, { [y]: ny }]);
          }
        }
      }
    }
    cand.sort((a, b) => -a[0] - -b[0]);
    let done = 0;
    for (const [, o, give, get] of cand.slice(0, 4)) {
      if (done >= tries) break;
      const [[x, nx]] = Object.entries(give) as [string, number][];
      const [[y, ny]] = Object.entries(get) as [string, number][];
      if (p.res[x as keyof typeof p.res] < nx || o.res[y as keyof typeof o.res] < ny) continue;
      if (this.trade_gain(g, p, give, get) <= 0.3) continue;
      if (o.ai!.accept!(g, o, get, give)) {
        g.trade(p, o, give, get);
        done += 1;
      }
    }
  }
}
