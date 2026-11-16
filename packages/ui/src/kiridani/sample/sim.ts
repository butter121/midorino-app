// 見本の試合（エンジンができるまでの台本）。
// 本物のルールエンジンではない：画面と演出を確かめるために、それらしい出来事の列を最後まで作るだけ。
// 数値は data.ts を使い、ルールは設計書の骨格を大まかになぞる（細部は Python エンジンが正）。
// 自分の席の選択（ドラフト・キャラ・置き場所）は外から渡せる。渡さなければ自動で選ぶ。
import {
  ACT, ACTIONS, BOSSES, CARDS, CHAR, CHARACTERS, DRAGON_FAIL, FAME_PER_COMPANION, FATE_DECK, GOLD_PER_FAME, HERO_BONUS, HIRE_FOOD,
  ITEM_IDS, MARKET_BASE, MAX_COMPANIONS, MAX_SKILL, MON, MONSTERS, NEST_CAP, NESTS, OCC_IDS, POWER_PER, QUESTS, QUEST_FAME,
  SEAT_FOOD, START_FOOD, START_GOLD, TIDE, TIDE_BONUS, UPKEEP, WEAKNESS_BONUS, WEATHER, WEATHER_EL, seasonOf,
  type Cost, type Element, type ItemDef, type MonsterDef, type Res,
} from '../data';
import { applyEvent, initialView, monsterDef, readyCompanions } from '../reduce';
import type { DraftKind, GameEvent, GameView, PlayerView, PowerPart, ScoreRow, Seat } from '../types';

export interface SimWait { kind: 'draft' | 'char' | 'place'; seat: Seat; options: string[] }
type Step = { wait: SimWait };

export const SAMPLE_NAMES = ['あなた', 'ハヤテ', 'コトネ', 'ジン', 'ルリ', 'タケル'];

function rngOf(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

interface Stats { kills: number; beast: number; undead: number; boss: number; weak: number; spells: number; combatsThisRound: number }

export class SampleGame {
  /** 全員の手札が見える状態（台本用） */
  view: GameView;
  readonly n: number;
  readonly me: Seat;
  private rand: () => number;
  private gen: Generator<Step, void, string | undefined>;
  private out: GameEvent[] = [];
  waiting: SimWait | null = null;
  done = false;
  private stats: Stats[];
  private injuredAt = new Map<string, number>();
  private cardFame: number[];
  private trophyFame: number[];
  private questFame: number[];
  private dragonFail = 0;

  constructor(n: number, seed = 7, me: Seat = 0) {
    this.n = n; this.me = me;
    this.rand = rngOf(seed);
    this.view = initialView(-1);
    this.stats = Array.from({ length: n }, () => ({ kills: 0, beast: 0, undead: 0, boss: 0, weak: 0, spells: 0, combatsThisRound: 0 }));
    this.cardFame = Array(n).fill(0); this.trophyFame = Array(n).fill(0); this.questFame = Array(n).fill(0);
    this.gen = this.script();
  }

  /** 次の「選ぶ場面」か終わりまで進め、その間の出来事を返す。choice は直前の待ちへの答え */
  advance(choice?: string): GameEvent[] {
    if (this.done) return [];
    this.out = [];
    const r = this.gen.next(choice);
    if (r.done) { this.done = true; this.waiting = null; } else this.waiting = r.value.wait;
    return this.out;
  }

  /** 選ぶ場面も自動で答えて最後まで進める（テスト用） */
  runToEnd(): GameEvent[] {
    const all: GameEvent[] = [];
    all.push(...this.advance());
    while (!this.done) all.push(...this.advance(undefined));
    return all;
  }

  // ------------------------------------------------------------ helpers
  private emit(ev: GameEvent) { this.out.push(ev); this.view = applyEvent(this.view, ev); }
  private pick<T>(a: T[]): T { return a[Math.floor(this.rand() * a.length)]; }
  private shuffle<T>(a: T[]): T[] { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(this.rand() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
  private P(seat: Seat): PlayerView { return this.view.players[seat]; }
  private has(seat: Seat, card: string) { const p = this.P(seat); return p.occupations.includes(card) || p.weapons.includes(card) || p.facilities.includes(card); }
  private can(p: PlayerView, c: Cost) { return Object.entries(c).every(([r, n]) => p.res[r as Res] >= (n ?? 0)); }

  private *script(): Generator<Step, void, string | undefined> {
    const n = this.n;
    const spaces = ACTIONS.filter((a) => (a.min_p ?? 0) <= n).map((a) => a.id);
    const nests = NESTS[n];
    const quests = this.shuffle(Object.keys(QUESTS)).slice(0, 3);
    this.emit({ t: 'game_start', players: Array.from({ length: n }, (_, i) => ({ seat: i, name: SAMPLE_NAMES[i] })), me: this.me, quests, spaces, nests, market: { ...MARKET_BASE } });
    for (let s = 0; s < n; s++) this.emit({ t: 'grant', seat: s, gain: { food: START_FOOD + (SEAT_FOOD[n]?.[s] ?? 0), gold: START_GOLD }, reason: '開始時' });

    // ---- 開始時の手札：職能3周・品物3周（3枚見て1枚、全員同時）
    const decks: Record<DraftKind, string[]> = { occ: this.shuffle(OCC_IDS), item: this.shuffle(ITEM_IDS) };
    for (const kind of ['occ', 'item'] as DraftKind[]) {
      for (let lap = 1; lap <= 3; lap++) {
        const offers: Record<Seat, string[]> = {};
        for (let s = 0; s < n; s++) offers[s] = decks[kind].splice(0, 3);
        this.emit({ t: 'draft_offer', kind, lap, offers });
        const mine = yield { wait: { kind: 'draft', seat: this.me, options: offers[this.me] } };
        for (let s = 0; s < n; s++) {
          const card = s === this.me && mine && offers[s].includes(mine) ? mine : this.pick(offers[s]);
          this.emit({ t: 'draft_pick', seat: s, kind, card });
          decks[kind].push(...offers[s].filter((c) => c !== card));
        }
        decks[kind] = this.shuffle(decks[kind]);
      }
    }
    const itemDeck = decks.item;

    // ---- キャラ：2枚から1枚（手札を見てから）
    const chars = this.shuffle(CHARACTERS.map((c) => c.id));
    const offers: Record<Seat, string[]> = {};
    for (let s = 0; s < n; s++) offers[s] = chars.slice(s * 2, s * 2 + 2);
    this.emit({ t: 'char_offer', offers });
    const myChar = yield { wait: { kind: 'char', seat: this.me, options: offers[this.me] } };
    for (let s = 0; s < n; s++) {
      const fit = (c: string) => this.P(s).hand.reduce((a, id) => a + (CARDS[id]?.chars.includes(c) ? 2 : 0) + (CARDS[id]?.tags.filter((t) => CHAR[c].tags.includes(t)).length ?? 0), 0);
      const best = [...offers[s]].sort((a, b) => fit(b) - fit(a))[0];
      const char = s === this.me && myChar && offers[s].includes(myChar) ? myChar : best;
      this.emit({ t: 'char_pick', seat: s, char });
      if (char === 'gan') this.emit({ t: 'grant', seat: s, gain: { iron: 2 }, reason: 'ガンの開始時' });
    }

    // ---- 12ラウンド
    const weather = Array.from({ length: 12 }, (_, i) => this.pick(WEATHER[seasonOf(i + 1)]));
    let monDeck: string[] = [];
    let first = 0;
    for (let r = 1; r <= 12; r++) {
      const year = Math.ceil(r / 4);
      const season = seasonOf(r);
      const tide: Element = weather[r - 1] === 'newmoon' ? 'dark' : TIDE[season];
      this.emit({ t: 'round_start', round: r, season, tide, first, seasonChanged: true });
      if (r % 4 === 1) {
        monDeck = this.shuffle(MONSTERS.filter((m) => m.year === year).map((m) => m.id));
        for (let s = 0; s < n; s++) {
          const deck = this.has(s, 'o12') ? FATE_DECK.map((x) => (x === -1 ? 1 : x)) : [...FATE_DECK]; // 星図の学者：-1 を +1 に
          this.emit({ t: 'fate_shuffle', seat: s, deck });
        }
        const bossRound = r + 3;
        const cands = BOSSES[bossRound].map((b) => b.id);
        this.emit({ t: 'boss_reveal', candidates: cands, boss: this.pick(cands), round: bossRound });
      }
      this.emit({ t: 'weather', weather: weather[r - 1], forecast: weather.slice(r, r + 1) });
      for (const nest of this.view.nests) {
        if (nest.monster) continue;
        if (!monDeck.length) monDeck = this.shuffle(MONSTERS.filter((m) => m.year === year).map((m) => m.id));
        const m = monDeck.shift()!;
        this.emit({ t: 'monster_spawn', nest: nest.id, monster: m, next: monDeck[0] });
      }
      const adds: Record<string, Cost> = {};
      for (const id of spaces) { const a = ACT[id]; if (a.accum && (a.from_round ?? 1) <= r) adds[id] = { ...a.accum }; }
      if (weather[r - 1] === 'harvestmoon') adds.hunt = { food: (adds.hunt?.food ?? 0) + 3 };
      this.emit({ t: 'refill', adds });
      for (let s = 0; s < n; s++) {
        this.stats[s].combatsThisRound = 0;
        if (this.P(s).facilities.includes('i11') && r <= 6) this.emit({ t: 'produce', seat: s, facility: 'i11', gain: { mana: 1 } });
        // 薬草があれば負傷をすぐ治す
        for (const c of this.P(s).companions) if (c.injured && this.P(s).res.herb > 0 && this.rand() < 0.7) { this.emit({ t: 'heal', seat: s, companion: c.id, cost: { herb: 1 } }); this.injuredAt.delete(c.id); }
      }
      if (r % 4 === 0) this.emit({ t: 'boss_appear', boss: this.view.lair.boss! });

      // ---- 行動：先手から1人ずつ
      let passes = 0; let s = first;
      while (passes < n) {
        const p = this.P(s);
        if (!readyCompanions(p).length) { passes++; s = (s + 1) % n; continue; }
        passes = 0;
        this.emit({ t: 'turn', seat: s });
        const opts = this.options(s, r);
        let choice: string | undefined;
        if (s === this.me) choice = yield { wait: { kind: 'place', seat: s, options: opts.map((o) => o.id) } };
        const o = opts.find((x) => x.id === choice) ?? [...opts].sort((a, b) => b.score - a.score)[0];
        this.act(s, o.id, r, itemDeck);
        s = (s + 1) % n;
      }

      // ---- 季節の処理
      if (season === 'summer' || season === 'autumn' || season === 'spring') {
        for (let q = 0; q < n; q++) if (this.P(q).facilities.includes('i12')) this.emit({ t: 'produce', seat: q, facility: 'i12', gain: { herb: 2 } });
      }
      if (season === 'winter') this.winter(r);
      // ---- 片付け
      this.emit({ t: 'round_end' });
      for (let q = 0; q < n; q++) for (const c of this.P(q).companions) {
        const at = this.injuredAt.get(c.id);
        if (c.injured && at !== undefined && at < r) { this.emit({ t: 'recover', seat: q, companion: c.id }); this.injuredAt.delete(c.id); }
      }
      this.emit({ t: 'market_reset', market: { ...MARKET_BASE } });
      first = (first + 1) % n;
      if (r < 12) this.emit({ t: 'first_pass', seat: first });
    }

    this.emit({ t: 'score', rows: this.scoreRows() });
    this.emit({ t: 'game_end' });
  }

  // ------------------------------------------------------------ 置き場所の候補
  private options(s: Seat, r: number): { id: string; score: number }[] {
    const v = this.view; const p = this.P(s);
    const out: { id: string; score: number }[] = [];
    const ready = readyCompanions(p).length;
    for (const id of v.spaceOrder) {
      const sp = v.spaces[id]; const a = ACT[id];
      if (!sp.open || (!a.unlimited && sp.occupants.length)) continue;
      let score = 1;
      const stock = Object.values(sp.stock).reduce((x, y) => x + (y ?? 0), 0);
      if (a.accum) score = stock * 1.4;
      else if (a.give) score = Object.values(a.give).reduce((x, y) => x + (y ?? 0), 0) * 1.2;
      if (id === 'guild') score = p.hand.some((c) => CARDS[c]?.kind === 'occ') && p.res.food >= (p.occupations.length ? 2 : 1) ? 6 : -1;
      if (id === 'forge') score = this.affordable(s, 'weapon') ? 7 : -1;
      if (id === 'workshop') score = this.affordable(s, 'tool') ? 6 : this.can(p, { wood: 3 }) && p.beds <= p.companions.length && p.companions.length < MAX_COMPANIONS ? 5 : this.can(p, { wood: 2, iron: 1 }) ? 3 : -1;
      if (id === 'tavern') score = p.beds > p.companions.length && p.companions.length < MAX_COMPANIONS && (p.res.food >= HIRE_FOOD || this.has(s, 'o09')) ? 8 : -1;
      if (id === 'training') score = p.companions.some((c) => c.skill < MAX_SKILL) ? 4 : -1;
      if (id === 'ruins') score = 4;
      if (id === 'market' || id === 'market2') score = p.res.mat >= 2 || p.res.gold >= 3 ? 3 : 0.5;
      if (id === 'plaza') score = 1;
      // 冬の食料が足りないうちは食料を重く見る
      const food = (sp.stock.food ?? 0) + (a.give?.food ?? 0);
      const short = p.companions.length * UPKEEP - p.res.food;
      if (food && short > 0) score += Math.min(short, food) * (r % 4 === 0 ? 6 : 3);
      if (score >= 0) out.push({ id, score: score + this.rand() });
    }
    for (const nest of v.nests) {
      if (!nest.monster || nest.occupants.length >= NEST_CAP) continue;
      const m = MON[nest.monster];
      const est = this.estimate(s, m, Math.min(ready, NEST_CAP - nest.occupants.length));
      const need = m.str - nest.wounds;
      out.push({ id: nest.id, score: est + 2 >= need ? 8 + m.trophy * 1.5 + this.rand() : est + 3 >= need ? 3 + this.rand() : -0.5 });
    }
    if (r % 4 === 0 && this.view.lair.boss && !this.view.lair.defeated && this.view.lair.occupants.length < NEST_CAP) {
      const b = monsterDef(this.view.lair.boss);
      const est = this.estimate(s, b, Math.min(ready, NEST_CAP));
      out.push({ id: 'lair', score: est + 2 >= b.str - this.view.lair.wounds ? 14 : 1 + this.rand() });
    }
    if (!out.length) out.push({ id: 'plaza', score: 0 });
    return out;
  }

  private affordable(s: Seat, kind: ItemDef['kind']) {
    const p = this.P(s);
    return p.hand.some((c) => { const it = CARDS[c] as ItemDef | undefined; return it?.kind === kind && this.can(p, this.discount(s, it)); });
  }
  private discount(s: Seat, it: ItemDef): Cost {
    const c = { ...it.cost };
    if (this.P(s).character === 'gan' && it.kind === 'weapon') { let off = 2; for (const r of ['iron', 'mana', 'wood', 'mat'] as Res[]) { const d = Math.min(off, c[r] ?? 0); if (d) { c[r] = (c[r] ?? 0) - d; off -= d; } } }
    return c;
  }

  private estimate(s: Seat, m: MonsterDef, k: number) {
    return this.parts(s, m, k, false).reduce((a, x) => a + x.value, 0) + 0.5;
  }

  /** 戦力の内訳（use=true なら秘術・矢などを実際に使う） */
  private parts(s: Seat, m: MonsterDef, k: number, use: boolean): PowerPart[] {
    const p = this.P(s); const v = this.view;
    const parts: PowerPart[] = [{ kind: 'companion', label: `仲間×${k}`, value: POWER_PER * k, seat: s }];
    const sent = readyCompanions(p).slice(0, k);
    const skill = sent.reduce((a, c) => a + c.skill, 0);
    if (skill) parts.push({ kind: 'skill', label: '熟練', value: skill, seat: s });
    const els = new Set<Element>();
    for (const w of p.weapons) {
      const it = CARDS[w] as ItemDef;
      if (it.power) { parts.push({ kind: 'weapon', label: it.name, value: it.power + (w === 'i05' && v.weather === 'storm' ? 2 : 0) + (w === 'i03' && v.season === 'summer' ? 1 : 0), ref: w, el: it.el, seat: s }); if (it.el) els.add(it.el); }
    }
    const occBonus: Record<string, number> = { o11: 3, o26: 5 }; // 数値は台本用の目安
    for (const o of p.occupations) {
      if (occBonus[o]) parts.push({ kind: 'occ', label: CARDS[o].name, value: occBonus[o], ref: o, seat: s });
      if (o === 'o28' && p.companions.length <= 3) parts.push({ kind: 'occ', label: CARDS[o].name, value: 3, ref: o, seat: s });
      if (o === 'o17' && (m.race === 'undead' || m.weak === 'light')) parts.push({ kind: 'occ', label: CARDS[o].name, value: 3, ref: o, seat: s });
      if (o === 'o30' && v.season === 'winter') parts.push({ kind: 'occ', label: CARDS[o].name, value: 3, ref: o, seat: s });
      if (o === 'o16' && v.weather === 'storm') parts.push({ kind: 'occ', label: CARDS[o].name, value: 2, ref: o, seat: s });
    }
    if (p.character === 'riku' && this.stats[s].combatsThisRound >= 1) parts.push({ kind: 'char', label: 'リク：連戦', value: 2, seat: s });
    if (p.character === 'toma' && p.res.wood > 0) {
      const arrows = Math.min(2, p.res.wood);
      parts.push({ kind: 'supply', label: `矢×${arrows}`, value: arrows, seat: s });
      if (use) this.emit({ t: 'pay', seat: s, cost: { wood: arrows } });
    }
    if (p.character === 'momo' && p.res.food > 2) { parts.push({ kind: 'supply', label: '士気', value: 1, seat: s }); if (use) this.emit({ t: 'pay', seat: s, cost: { food: 1 } }); }
    // 秘術：魔石が足りれば使う
    for (const c of p.hand) {
      const it = CARDS[c] as ItemDef | undefined;
      if (it?.kind !== 'spell' || !it.power || !this.can(p, it.cost)) continue;
      if (it.id === 'i24' && MON[m.id]) continue; // 竜殺しの秘薬は主・古竜だけ
      parts.push({ kind: 'spell', label: it.name, value: it.power, ref: c, el: it.el, seat: s });
      if (it.el) els.add(it.el);
      if (use) { this.emit({ t: 'spell', seat: s, card: c, el: it.el }); this.emit({ t: 'pay', seat: s, cost: it.cost }); this.stats[s].spells++; }
      break;
    }
    if (m.weak && els.has(m.weak)) parts.push({ kind: 'weakness', label: '弱点！', value: WEAKNESS_BONUS, el: m.weak });
    if (els.has(v.tide)) parts.push({ kind: 'tide', label: '魔力の潮', value: TIDE_BONUS, el: v.tide });
    const we = v.weather ? WEATHER_EL[v.weather] : undefined;
    if (we && els.has(we[0])) parts.push({ kind: 'weather', label: '天候', value: we[1], el: we[0] });
    if (p.character === 'nana' && els.has('light')) parts.push({ kind: 'char', label: 'ナナ：光', value: 1, seat: s });
    return parts;
  }

  private defense(s: Seat) {
    const p = this.P(s);
    let d = 0;
    if (p.character === 'goro') d += 2;
    if (p.occupations.includes('o06')) d += 2;
    if (p.weapons.includes('i06')) d += 2;
    if (p.weapons.includes('i08')) d += 3;
    return d;
  }

  // ------------------------------------------------------------ 行動
  private act(s: Seat, id: string, r: number, itemDeck: string[]) {
    const p = this.P(s);
    if (id.startsWith('nest_') || id === 'lair') { this.fight(s, id, r, itemDeck); return; }
    const comp = readyCompanions(p)[0];
    this.emit({ t: 'place', seat: s, space: id, companion: comp.id });
    const a = ACT[id];
    if (a.accum || a.give) {
      const gain: Cost = {};
      for (const [k, v] of Object.entries({ ...(a.give ?? {}), ...this.view.spaces[id].stock })) gain[k as Res] = (gain[k as Res] ?? 0) + (v ?? 0);
      if (gain.wood && p.character === 'toma') gain.wood += 1;
      if (gain.mana && p.character === 'mina') gain.mana += 1;
      if (gain.herb && (p.character === 'sana' || p.occupations.includes('o08'))) gain.herb += 1;
      if (gain.iron && p.occupations.includes('o10')) gain.iron += 1;
      this.emit({ t: 'gather', seat: s, space: id, gain });
    } else if (id === 'guild') {
      const c = p.hand.find((x) => CARDS[x]?.kind === 'occ');
      if (c) { this.emit({ t: 'pay', seat: s, cost: { food: p.occupations.length ? 2 : 1 }, space: id }); this.emit({ t: 'play_card', seat: s, card: c }); }
    } else if (id === 'forge' || id === 'workshop') {
      const kind = id === 'forge' ? 'weapon' : 'tool';
      const c = p.hand.map((x) => CARDS[x] as ItemDef).find((it) => it?.kind === kind && this.can(p, this.discount(s, it)));
      if (c) {
        this.emit({ t: 'pay', seat: s, cost: this.discount(s, c), space: id });
        this.emit({ t: 'play_card', seat: s, card: c.id });
        this.cardFame[s] += c.fame;
      } else if (id === 'workshop') {
        if (this.can(p, { wood: 3 }) && p.beds <= p.companions.length) { this.emit({ t: 'pay', seat: s, cost: { wood: 3 }, space: id }); this.emit({ t: 'build', seat: s, kind: 'bed' }); }
        else if (this.can(p, { wood: 2, iron: 1 })) { this.emit({ t: 'pay', seat: s, cost: { wood: p.character === 'goro' ? 1 : 2, iron: 1 }, space: id }); this.emit({ t: 'build', seat: s, kind: 'wall' }); }
      }
    } else if (id === 'tavern') {
      if (!this.has(s, 'o09')) this.emit({ t: 'pay', seat: s, cost: { food: HIRE_FOOD }, space: id });
      this.emit({ t: 'hire', seat: s, companion: `c${s}-${p.companions.length}` });
      if (p.character === 'nana') this.emit({ t: 'grant', seat: s, gain: { food: 1 }, reason: 'ナナ' });
    } else if (id === 'training') {
      const c = p.companions.find((x) => x.skill < MAX_SKILL);
      if (c) this.emit({ t: 'train', seat: s, companion: c.id });
    } else if (id === 'ruins') {
      const c = itemDeck.shift();
      if (c) this.emit({ t: 'draw', seat: s, card: c, from: 'ruins' });
    } else if (id === 'market' || id === 'market2') {
      const price = this.view.market.mat ?? 2;
      if (p.res.mat >= 2) this.emit({ t: 'market', seat: s, buy: {}, sell: { mat: 2 }, gold: price * 2 + (p.character === 'leo' ? 2 : 0), prices: { mat: Math.max(1, price - 1) } });
      else { const k = Math.min(2, Math.floor(p.res.gold / 2)); this.emit({ t: 'market', seat: s, buy: { iron: k }, sell: {}, gold: -2 * k, prices: {} }); }
    }
    this.checkQuests(s);
  }

  private fight(s: Seat, where: string, r: number, itemDeck: string[]) {
    const p = this.P(s); const v = this.view;
    const boss = where === 'lair';
    const nest = boss ? undefined : v.nests.find((x) => x.id === where)!;
    const mid = boss ? v.lair.boss! : nest!.monster!;
    const m = monsterDef(mid);
    const wounds = boss ? v.lair.wounds : nest!.wounds;
    const room = NEST_CAP - (boss ? v.lair.occupants.length : nest!.occupants.length);
    const ready = readyCompanions(p);
    let k = 1;
    if (ready.length >= 2 && room >= 2 && this.estimate(s, m, 1) < m.str - wounds) k = 2;
    const sent = ready.slice(0, k);
    for (const c of sent) this.emit({ t: 'place', seat: s, space: where, companion: c.id });
    this.emit({ t: 'combat_start', nest: where, monster: mid, seats: [s], strength: m.str, wounds, boss });
    // 内訳を2回に分けて積み上げる（仲間と装備 → 属性の上乗せ）
    const all = this.parts(s, m, k, true);
    const base = all.filter((x) => !['weakness', 'tide', 'weather'].includes(x.kind));
    const bonus = all.filter((x) => ['weakness', 'tide', 'weather'].includes(x.kind));
    this.emit({ t: 'power', parts: base });
    if (bonus.length) this.emit({ t: 'power', parts: bonus });
    const deck = this.P(s).fateLeft;
    const fate = deck.length ? deck[Math.floor(this.rand() * deck.length)] : 0;
    this.emit({ t: 'fate_flip', seat: s, value: fate });
    const total = all.reduce((a, x) => a + x.value, 0) + fate;
    const win = total + wounds >= m.str;
    const el = all.find((x) => x.kind === 'weakness')?.el ?? all.find((x) => x.el)?.el;
    this.emit({ t: 'clash', total, strength: m.str, result: win ? 'win' : 'lose', el });
    this.emit({ t: 'hit', amount: win ? m.str - wounds : Math.max(1, Math.floor(total / 2)) });
    const def = this.defense(s);
    this.emit({ t: 'counter', amount: m.counter, defense: def });
    const over = m.counter - def;
    let inj = over >= 3 ? 2 : over >= 1 ? 1 : 0;
    if (win && p.occupations.includes('o11')) inj = Math.max(inj, 1);
    if (!win && p.hand.includes('i22') && this.P(s).res.mana >= 1) { this.emit({ t: 'spell', seat: s, card: 'i22', el: 'light' }); this.emit({ t: 'pay', seat: s, cost: { mana: 1 } }); inj = 0; }
    for (const c of sent.slice(0, inj)) { this.emit({ t: 'injury', seat: s, companion: c.id }); this.injuredAt.set(c.id, r); }
    if (win) {
      const loot: Cost = { ...m.loot };
      if (p.character === 'riku' || p.weapons.includes('i07')) loot.mat = (loot.mat ?? 0) + 1;
      if (m.race === 'beast' && p.occupations.includes('o25')) loot.mat = (loot.mat ?? 0) + 2;
      this.emit({ t: 'loot', seat: s, gain: loot });
      this.emit({ t: 'trophy', seat: s, monster: mid, fame: m.trophy });
      this.trophyFame[s] += m.trophy;
      const st = this.stats[s];
      st.kills++; if (m.race === 'beast') st.beast++; if (m.race === 'undead') st.undead++; if (boss) st.boss++;
      if (all.some((x) => x.kind === 'weakness')) st.weak++;
      if (boss) { const c = itemDeck.shift(); if (c) this.emit({ t: 'draw', seat: s, card: c, from: 'boss' }); }
      if (p.occupations.includes('o04') && inj) { this.emit({ t: 'heal', seat: s, companion: sent[0].id }); this.injuredAt.delete(sent[0].id); }
    }
    this.stats[s].combatsThisRound++;
    this.emit({ t: 'combat_end' });
    this.checkQuests(s);
  }

  private winter(r: number) {
    const n = this.n;
    this.emit({ t: 'winter_start' });
    for (let s = 0; s < n; s++) {
      const p = this.P(s);
      let need = p.companions.length * UPKEEP;
      if (p.character === 'momo') need -= 1;
      if (p.occupations.includes('o20')) need -= 2 * UPKEEP;
      if (p.facilities.includes('i13')) need -= 1;
      if (this.view.weather === 'blizzard') need += 1;
      need = Math.max(0, need);
      const paid = Math.min(need, p.res.food);
      const discontent = Math.ceil((need - paid) / UPKEEP);
      this.emit({ t: 'upkeep', seat: s, need, paid, discontent });
    }
    const raiders = this.view.nests.filter((x) => x.monster).map((x) => ({ nest: x.id, m: monsterDef(x.monster!) }));
    if (this.view.lair.boss && !this.view.lair.defeated && r < 12) raiders.push({ nest: 'lair', m: monsterDef(this.view.lair.boss) });
    for (const { nest, m } of raiders) {
      for (let s = 0; s < n; s++) {
        const p = this.P(s);
        if (p.occupations.includes('o30') && this.view.weather === 'blizzard') continue;
        let block = Math.floor(p.walls / 2) + (p.occupations.includes('o13') ? p.walls - Math.floor(p.walls / 2) : 0);
        if (p.character === 'goro') block += 1;
        if (p.facilities.includes('i14')) block += 1;
        const damage = Math.max(0, m.raid - block);
        const lost: Cost = {};
        let left = damage;
        for (const res of (['food', 'wood', 'iron', 'herb', 'gold'] as Res[])) { const take = Math.min(left, p.res[res]); if (take) { lost[res] = take; left -= take; } }
        this.emit({ t: 'raid', seat: s, monster: m.id, nest, damage, blocked: m.raid - damage, lost });
      }
    }
    if (r === 12 && !this.view.lair.defeated) { this.dragonFail = DRAGON_FAIL; this.emit({ t: 'dragon_fail', fame: DRAGON_FAIL }); }
    this.emit({ t: 'winter_end' });
    // 年の終わり：巣の魔物は霧に帰る
    for (const nest of this.view.nests) if (nest.monster) this.emit({ t: 'monster_leave', nest: nest.id });
  }

  private checkQuests(s: Seat) {
    const p = this.P(s); const st = this.stats[s];
    const ok: Record<string, boolean> = {
      q_kill4: st.kills >= 4, q_beast2: st.beast >= 2, q_undead2: st.undead >= 2, q_boss: st.boss >= 1,
      q_comp4: p.companions.length >= 4, q_fac3: p.facilities.length >= 3, q_wall3: p.walls >= 3, q_weap3: p.weapons.length >= 3,
      q_occ3: p.occupations.length >= 3, q_spell2: st.spells >= 2, q_weak3: st.weak >= 3, q_gold10: p.res.gold >= 10,
      q_coop2: false, q_mat6: p.res.mat >= 6, q_skill3: p.companions.reduce((a, c) => a + c.skill, 0) >= 3,
    };
    for (const q of this.view.quests) {
      if (!ok[q.id] || q.doneBy.includes(s) || q.doneBy.length >= QUEST_FAME.length) continue;
      const fame = QUEST_FAME[q.doneBy.length];
      this.questFame[s] += fame;
      this.emit({ t: 'quest_done', quest: q.id, seat: s, fame });
    }
  }

  private scoreRows(): ScoreRow[] {
    const v = this.view;
    const most = Math.max(...v.players.map((p) => p.trophies.length));
    const rows = v.players.map((p) => {
      const s = p.seat;
      const items = [
        { key: 'trophy', label: '討伐の証', fame: this.trophyFame[s] },
        { key: 'cards', label: '武具・施設', fame: this.cardFame[s] },
        { key: 'quest', label: '依頼', fame: this.questFame[s] },
        { key: 'companion', label: '仲間', fame: p.companions.length * FAME_PER_COMPANION },
        { key: 'gold', label: '金貨', fame: Math.floor(p.res.gold / GOLD_PER_FAME) },
        { key: 'hero', label: '英雄（討伐数1位）', fame: p.trophies.length === most && most > 0 ? HERO_BONUS : 0 },
        { key: 'discontent', label: '不満', fame: -3 * p.discontent },
        { key: 'dragon', label: '古竜', fame: -this.dragonFail },
      ];
      return { seat: s, items, total: items.reduce((a, x) => a + x.fame, 0), rank: 0 };
    });
    const sorted = [...rows].sort((a, b) => b.total - a.total);
    for (const r of rows) r.rank = sorted.findIndex((x) => x.total === r.total) + 1;
    return rows;
  }
}
