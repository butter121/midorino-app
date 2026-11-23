// 霧谷 v2 — リストのカードを1枚ずつ、AI の席0に始めから持たせて試合を回し、例外がないか・効果が起きたかを数える。
//   npx vite-node tools/kiridani2/cardcheck.ts            （CHECK_N=局数、CHECK_IDS=o_ak3,a_ak1 のように絞れる）
import { AI, CARD_SET, autoAnswer, Game, type GameEvent, type Req } from '../../packages/engine/src/kiridani2/index';

/** 最初の手番で、カードを始めから持っていたことにする AI */
class Given extends AI {
  done = false;
  constructor(seed: number, private give: (req: Req) => void) { super('normal', { seed }); }
  respond(req: Req) { if (!this.done && req.k === 'choose') { this.done = true; this.give(req); } return super.respond(req); }
}

const IDS = (process.env.CHECK_IDS ?? 'o_ak3 a_ak1 a_ak3 t_ak4 s_ak2 s_ak3 s_ak5 o_jn3 w_jn3 a_jn2 a_jn3 t_jn1 s_jn1 s_jn2 s_jn3 o_mn1 o_mn5 a_mn2 s_mn3 o_ga2 o_ga3 o_ga5 s_ga4 o_ha2 w_ha1 w_ha2 w_ha4 a_ha4 a_ha5 t_ha4 t_ha5 s_ha5 o_ya1 s_ya3 s_ya4 o_is2 s_is2 s_is4 s_is5 o_go3 a_go1 a_go5 s_go5 o_po4 o_po5 s_po1 s_po3 s_po5 o_mo1 o_mo4 o_mo5 t_mo3 t_mo4 s_mo3 s_mo4 s_mo5 o_ka2 o_ka4 t_ka4 t_ka5 s_ka4 s_ka5 o_mi3 o_mi4 w_mi2 a_mi4 t_mi4 t_mi5 s_mi2 s_mi3 s_mi5').split(/[ ,]+/).filter(Boolean);
const N = Number(process.env.CHECK_N ?? 6);
const all = [...CARD_SET.occupations, ...CARD_SET.weapons, ...CARD_SET.armors, ...CARD_SET.tools, ...CARD_SET.spells];
let errors = 0;
const rows: string[] = [];
for (const id of IDS) {
  const c = all.find((x) => x.id === id)!;
  let used = 0, ms = 0;
  const notes = new Map<string, number>();
  for (let s = 0; s < N; s++) {
    const give = (req: Req) => {
          const g = req.g;
          const p = g.players[0];
          for (const r2 of ['wood', 'iron', 'herb', 'food', 'mana', 'mat', 'gold'] as const) p.res[r2] += 3;
          if (c.kind === 'occ') p.occs.push(id);
          else if (c.kind === 'tool') p.tools.push(id);
          else if (c.kind === 'spell') { if (c.tome) p.tomes.push(id); else p.hand.push(id, id, id); }
          else { p.items.push(id); g.autoEquip(p); }
          if (c.kind === 'weapon' || c.kind === 'armor') p.items.push(id);
          g.autoEquip(p);
    };
    const g = new Game(4, [0, 1, 2, 3].map((i) => (i === 0 ? new Given(s * 10, give) : new AI('normal', { seed: s * 10 + i }))), { seed: 1000 + s, years: 5, cards: CARD_SET, events: { me: -1, names: ['a', 'b', 'c', 'd'] } });
    const gen = g.play();
    const t0 = Date.now();
    try {
      let r = gen.next();
      while (!r.done) r = gen.next(autoAnswer(r.value));
    } catch (e) {
      errors++;
      console.log(`ERROR ${id} seed ${s}:`, (e as Error).stack?.split('\n').slice(0, 6).join('\n'));
    }
    ms += Date.now() - t0;
    for (const ev of g.E ?? []) {
      const e = ev as GameEvent & { card?: string; seat?: number };
      if (e.seat !== 0) continue;
      if ((e.t === 'effect' || e.t === 'spell' || e.t === 'note' || e.t === 'learn') && e.card === id) used++;
      if (e.t === 'power' && (e as { parts: { ref?: string; seat: number }[] }).parts.some((x) => x.ref === id && x.seat === 0)) used++;
      if (e.t === 'note' || e.t === 'discard' || (e.t === 'place' && String((e as { space?: string }).space).startsWith('@'))) notes.set(`${e.t}:${(e as { space?: string }).space ?? (e as { text?: string }).text ?? ''}`, (notes.get(`${e.t}:${(e as { space?: string }).space ?? (e as { text?: string }).text ?? ''}`) ?? 0) + 1);
    }
  }
  console.log(`${id}\t${c.name}\tevents=${used}\t${Math.round(ms / N)}ms\t${[...notes].map(([k, v]) => `${k}=${v}`).join(' ')}`);
}

console.log(`errors=${errors}`);
