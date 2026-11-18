// 霧谷 v2：人の答えをでたらめに選んで（仲間の選択・装備の持ち替え・取引・秘術・戦闘の後押しも混ぜて）何試合も回す。
// - 人に聞いているのに答えられる選択肢がない／正しい答えが例外になる、が起きないこと
// - 保存した答え（Action の並び）を最初から当て直すと、同じ場面・同じ盤面になること（ひとり用の再開・オンラインの再入室）
import { describe, expect, it } from 'vitest';
import { Kiridani2Referee, Kiridani2Session, Rng, applyAction2, previewFight, type Action2, type Cost, type Option, type Res } from '../src/kiridani2/index';

const RES5: Res[] = ['wood', 'iron', 'herb', 'mana', 'food'];

/** いまの問いに対する、でたらめだが正しい答え（取引・装備は置き場所の選択の前に混ぜる） */
function randomActions(s: Kiridani2Session, rng: Rng): Action2[] {
  const w = s.waiting!;
  const pick = <T,>(xs: T[]) => xs[Math.floor(rng.random() * xs.length)];
  switch (w.k) {
    case 'card': return [{ t: 'card', id: pick(w.cards) }];
    case 'ratio': return [{ t: 'ratio', v: pick(w.options) }];
    case 'kind': return [{ t: 'kind', v: pick(w.options) }];
    case 'pick': return [{ t: 'pick', i: Math.floor(rng.random() * w.options.length) }];
    case 'heal': case 'effect': return [{ t: 'yes', v: rng.random() < 0.5 }];
    case 'choose': {
      const out: Action2[] = [];
      const p = w.p;
      // 装備の持ち替え
      if (rng.random() < 0.3) {
        const ci = Math.floor(rng.random() * p.comps.length);
        const slot = rng.random() < 0.5 ? 'weapon' : 'armor';
        const cand = [...s.g.storage(p), null].filter((id) => !s.g.equipError(p, ci, slot, id));
        if (cand.length) out.push({ t: 'equip', c: ci, slot, id: pick(cand) });
      }
      // AI との取引（受けるものが見つかれば）
      if (rng.random() < 0.5 && s.tradeLeft() > 0) {
        for (let tries = 0; tries < 12; tries++) {
          const b = pick(s.tradePartners());
          if (b === undefined) break;
          const r1 = pick(RES5), r2 = pick(RES5.filter((r) => r !== r1));
          const give: Cost = { [r1]: 1 + Math.floor(rng.random() * 2) }, get: Cost = { [r2]: 1 + Math.floor(rng.random() * 3) };
          const j = s.judgeTrade(b, give, get);
          if (j.ok && j.accept) { out.push({ t: 'trade', b, give, get }); break; }
        }
      }
      return out;
    }
  }
}

function chooseAfter(s: Kiridani2Session, rng: Rng): Action2 {
  const w = s.waiting!;
  if (w.k !== 'choose') throw new Error('not choose');
  const opts = w.opts;
  const i = Math.floor(rng.random() * opts.length);
  const o: Option = opts[i];
  const p = w.p;
  const a: Action2 = { t: 'opt', i };
  const fight = o.s.startsWith('nest') || o.s === 'lair';
  if (fight && o.k && o.mode !== 'wait' && rng.random() < 0.5) {
    const pv = previewFight(s.g, p, o);
    if (pv) {
      const keys = pv.chips.filter(() => rng.random() < 0.4).map((c) => c.key);
      a.use = keys;
      if (rng.random() < 0.5 && pv.idxs?.length) a.who = [...pv.idxs];
    }
  } else if (!fight && o.s !== '@spell' && rng.random() < 0.6) {
    const free = p.comps.map((_, j) => j).filter((j) => !p.comps[j].used && !p.comps[j].rest);
    if (free.length) a.who = [free[Math.floor(rng.random() * free.length)]];
    if (!s.g.whoFor(p, { ...o, who: a.who })) delete a.who;
  }
  return a;
}

/** 1試合をでたらめに回し、答えの並びを返す */
function fuzzGame(seed: number, n: number, years = 5) {
  const rng = new Rng(seed * 31 + 7);
  const s = new Kiridani2Session({ n, seed, years, human: 0, levels: Array(n).fill('normal') });
  s.start();
  const hist: Action2[] = [];
  let guard = 0;
  while (!s.done) {
    if (++guard > 5000) throw new Error('too long');
    expect(s.waiting, 'waiting').toBeTruthy();
    if (s.waiting!.k === 'choose') for (const a of randomActions(s, rng)) {
      // 取引・装備（失敗してもよいが、試合は壊れない）
      try { applyAction2(s, a); hist.push(a); } catch { /* 断られた */ }
    }
    const w = s.waiting!;
    const a = w.k === 'choose' ? chooseAfter(s, rng) : randomActions(s, rng)[0];
    try { applyAction2(s, a); } catch (e) {
      throw new Error(`seed ${seed}: valid answer threw ${JSON.stringify(a)} at step ${hist.length}: ${(e as Error).message}`);
    }
    hist.push(a);
  }
  return { s, hist };
}

const fingerprint = (s: Kiridani2Session) => JSON.stringify({ done: s.done, scores: s.scores, players: s.g.players.map((p) => ({ res: p.res, fame: p.fame, comps: p.comps, hand: p.hand })), round: s.g.round });

describe('kiridani2 でたらめな人の答えで回す', () => {
  it('どの場面でも答えられ、正しい答えが例外にならない。保存した答えを当て直すと同じ結果になる', () => {
    const from = Number(process.env.KD2_FUZZ_FROM ?? 1), count = Number(process.env.KD2_FUZZ_SEEDS ?? 16);
    for (let seed = from; seed < from + count; seed++) {
      const n = 2 + (seed % 3);
      const years = process.env.KD2_FUZZ_SEEDS ? [5, 10, 15][seed % 3] : 5;
      const { s, hist } = fuzzGame(seed, n, years);
      const r = new Kiridani2Session({ n, seed, years, human: 0, levels: Array(n).fill('normal') });
      r.start();
      hist.forEach((a, i) => { try { applyAction2(r, a); } catch (e) { throw new Error(`seed ${seed}: replay failed at ${i}/${hist.length} ${JSON.stringify(a)}: ${(e as Error).message}`); } });
      expect(fingerprint(r)).toBe(fingerprint(s));
    }
  }, 600_000);

  it('取引で払えるようになったマスを、そのまま選べる（古い選択肢で答えを弾かない）', () => {
    // 取引のあとに増えた選択肢を選ぶ場面を探す
    let found = 0;
    for (let seed = 1; seed <= 40 && found < 3; seed++) {
      const s = new Kiridani2Session({ n: 3, seed, human: 0 });
      s.start();
      const r0 = new Rng(seed);
      while (!s.done && s.waiting!.k !== 'choose') applyAction2(s, randomActions(s, r0)[0]);
      if (s.waiting?.k !== 'choose' || s.tradeLeft() <= 0) continue;
      const before = new Set(s.waiting.opts.map((o) => JSON.stringify(o)));
      for (const b of s.tradePartners()) {
        for (const r1 of RES5) for (const r2 of RES5) {
          if (r1 === r2 || s.waiting.k !== 'choose' || s.tradeLeft() <= 0) continue;
          const j = s.judgeTrade(b, { [r1]: 1 }, { [r2]: 2 });
          if (!j.ok || !j.accept) continue;
          applyAction2(s, { t: 'trade', b, give: { [r1]: 1 }, get: { [r2]: 2 } });
          const w = s.waiting as Extract<typeof s.waiting, { k: 'choose' }>;
          const i = w.opts.findIndex((o) => !before.has(JSON.stringify(o)));
          if (i >= 0) { expect(() => applyAction2(s, { t: 'opt', i })).not.toThrow(); found++; }
          break;
        }
        break;
      }
    }
    expect(found).toBeGreaterThan(0);
  });

  it('オンライン：審判の記録を当て直すと同じ盤面になる（再入室）', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const ref = new Kiridani2Referee({ n: 3, seed, humans: [0, 1], names: ['A', 'B', 'C'], offerTimeoutMs: 0 });
      ref.start();
      const rng = new Rng(seed);
      let guard = 0;
      while (!ref.done && ++guard < 4000) {
        const seat = ref.waitingSeats()[0];
        if (seat === undefined) break;
        const pr = ref.prompt(seat)!;
        const s = ref.s;
        if (s.waiting!.k === 'choose') for (const a of randomActions(s, rng)) ref.act(seat, ref.prompt(seat)!.id, a);
        const a = s.waiting!.k === 'choose' ? chooseAfter(s, rng) : randomActions(s, rng)[0];
        const r = ref.act(seat, ref.prompt(seat)?.id ?? pr.id, a);
        expect(r.ok, `seed ${seed}: ${JSON.stringify(a)} ${r.ok ? "" : r.error}`).toBe(true);
      }
      expect(ref.done).toBe(true);
      const again = new Kiridani2Referee({ n: 3, seed, humans: [0, 1], names: ['A', 'B', 'C'], offerTimeoutMs: 0 });
      again.start();
      again.replay(ref.history);
      expect(again.history.length).toBe(ref.history.length);
      expect(fingerprint(again.s)).toBe(fingerprint(ref.s));
    }
  }, 120_000);
});

describe('kiridani2 エンジンが答えの途中で例外を出しても試合は止まらない', () => {
  it('例外のあと、答える前の場面に戻り（同じ問い・同じ盤面）、続けて正しく答えられる', () => {
    const mk = () => { const s = new Kiridani2Session({ n: 3, seed: 5, human: 0 }); s.start(); return s; };
    const a = mk(), b = mk();
    const rng = new Rng(3);
    // 置く番まで同じ答えで進める
    while (a.waiting!.k !== 'choose') { const x = randomActions(a, rng)[0]; applyAction2(a, x); applyAction2(b, x); }
    const before = fingerprint(a);
    // エンジンの中で例外が起きるようにする（この盤面だけ）
    (a.g as unknown as { questsGen: () => Generator }).questsGen = function* () { throw new Error('boom'); };
    expect(() => applyAction2(a, { t: 'opt', i: 0 })).toThrow('boom');
    expect(a.fault).toBeNull();
    expect(a.waiting?.k).toBe('choose');
    expect(fingerprint(a)).toBe(before);
    // 当て直した盤面で、ふつうに続けられる（もう一方の試合と同じ結果）
    for (let i = 0; i < 30 && !a.done; i++) {
      const x = a.waiting!.k === 'choose' ? { t: 'opt' as const, i: 0 } : randomActions(a, rng)[0];
      applyAction2(a, x); applyAction2(b, x);
    }
    expect(fingerprint(a)).toBe(fingerprint(b));
  });
});
