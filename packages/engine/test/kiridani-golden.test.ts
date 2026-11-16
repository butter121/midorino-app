// 霧谷の冒険者団：Python 版（正）と TypeScript 版が同じ種で同じ試合になるか。
// 記録は tools/kiridani/trace.py が作る（packages/engine/test/kiridani-golden.json）。
// 両方とも乱数は mulberry32（Python 側は random.Random を差し替え）。ドラフト・キャラ・毎手の選択・取引・
// ラウンドごとの状態と得点・最終得点の内訳がすべて一致することを確かめる。
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AI, Game, drive, score, scoreBreakdown, type Option, type Player, type Level } from '../src/kiridani';

const rec = JSON.parse(readFileSync(new URL('./kiridani-golden.json', import.meta.url), 'utf8'));

class TAI extends AI {
  constructor(level: Level, seed: number, private log: unknown[], private real: { g: Game | null }) { super(level, { seed }); }
  draft_pick(g: Game, p: Player, cards: string[], kind: string, ingame = false) {
    const c = super.draft_pick(g, p, cards, kind, ingame);
    if (g === this.real.g) this.log.push([ingame ? 'pick' : 'draft', p.pid, c]);
    return c;
  }
  pick_character(g: Game, p: Player, options: string[]) {
    const c = super.pick_character(g, p, options);
    this.log.push(['char', p.pid, c]);
    return c;
  }
  choose(g: Game, p: Player, opts: Option[]) {
    const o = super.choose(g, p, opts);
    if (g === this.real.g) this.log.push(['choose', g.round, p.pid, o[0], o[1], opts.length]);
    return o;
  }
}

const pstate = (p: Player) => ({
  res: p.res, skills: p.skills, trophies: p.trophies, card_fame: p.card_fame, quest_fame: p.quest_fame, discontent: p.discontent,
  unpaid: p.unpaid, occs: p.occs, weapons: p.weapons, tools: p.tools, hand: p.hand, pets: p.pets, walls: p.walls, beds: p.beds,
  fate: p.fate, injured: [...p.injured].sort((a, b) => a - b), egg: p.egg,
});

function replay(x: { n: number; levels: Level[]; seed: number }) {
  const log: unknown[] = [];
  const real: { g: Game | null } = { g: null };
  const ais = x.levels.map((lv, i) => new TAI(lv, x.seed * 100 + i, log, real));
  const g = new Game(x.n, ais, { seed: x.seed });
  real.g = g;
  const origTrade = g.trade.bind(g);
  g.trade = (a, b, give, get) => { log.push(['trade', g.round, a.pid, b.pid, give, get]); origTrade(a, b, give, get); };
  drive(g.setup());
  const rounds: unknown[] = [];
  for (let r = 1; r <= 12; r++) {
    g.round = r;
    drive(g.start_round());
    drive(g.work_phase());
    drive(g.end_round());
    rounds.push({
      r, scores: g.players.map((p) => score(p, g)), weather: g.weather[r - 1],
      nests: Object.fromEntries([...g.nests].map(([k, v]) => [k, { ...v, wait: v.wait && { pid: v.wait.pid } }])),
      prices: { ...g.prices }, players: g.players.map((p) => JSON.parse(JSON.stringify(pstate(p)))),
    });
  }
  g.over = true;
  return { g, log, rounds };
}

describe('霧谷：Python 版との一致（同じ種・同じ乱数）', () => {
  it('記録は今の engine.py・ai.py・data.py から作られている', () => {
    expect(rec.games.length).toBeGreaterThanOrEqual(10);
  });
  for (const x of rec.games) {
    it(`${x.n}人・${x.levels.join('/')}・種${x.seed}：全手順と得点が一致`, () => {
      const { g, log, rounds } = replay(x);
      expect(g.players.map((p) => p.char)).toEqual(x.chars);
      expect(g.quests).toEqual(x.quests);
      expect(g.weather).toEqual(x.weather);
      // 最初にずれた手を分かりやすく出す
      const n = Math.min(log.length, x.log.length);
      for (let i = 0; i < n; i++) {
        const a = JSON.parse(JSON.stringify(log[i])); const b = x.log[i];
        if (JSON.stringify(a) !== JSON.stringify(b)) {
          const r = (b[0] === 'choose' || b[0] === 'trade') ? b[1] : 0;
          const prev = r > 1 ? { py: x.rounds[r - 2], ts: rounds[r - 2] } : null;
          expect(a, `手順 ${i} がずれた（R${r}）。前のラウンドの終わり: ${JSON.stringify(prev)?.slice(0, 4000)}`).toEqual(b);
        }
      }
      expect(log.length).toBe(x.log.length);
      x.rounds.forEach((pr: { r: number; nests: Record<string, any> }, i: number) => {
        const tr = rounds[i] as typeof pr;
        const strip = (o: typeof pr) => ({ ...o, nests: Object.fromEntries(Object.entries(o.nests).map(([k, v]) => [k, { ...v, wait: v.wait && { pid: v.wait.pid } }])) });
        expect(strip(tr), `R${pr.r} の終わり`).toEqual(strip(pr));
      });
      expect(g.players.map((p) => score(p, g))).toEqual(x.scores);
      expect(g.players.map((p) => scoreBreakdown(p, g))).toEqual(x.breakdown);
      expect(g.errors).toEqual(x.errors);
      expect([g.fights, g.kills, g.trades]).toEqual([x.fights, x.kills, x.trades]);
    });
  }
});
