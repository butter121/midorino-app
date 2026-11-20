// 霧谷 v2：オンライン対戦の審判（席ごとに隠した出来事・問い・盤面の写し）、退室と復帰、人どうしの取引
import { describe, expect, it } from 'vitest';
import {
  Kiridani2Referee, Kiridani2Session, Shadow2Session, applyAction2, decodeGame2, encodeGame2, leaksFor2, marketQuote, previewFight, simpleAnswer2,
  type Prompt2,
} from '../src/kiridani2/index';

const NAMES = ['ホスト', 'ゲスト1', 'ゲスト2', 'AI4', 'AI5'];
const wire = (p: Prompt2) => JSON.parse(JSON.stringify(p)) as Prompt2;

function step(ref: Kiridani2Referee) {
  for (const seat of ref.waitingSeats()) {
    const pr = ref.prompt(seat);
    if (!pr) continue;
    const w = wire(pr);
    expect(ref.act(seat, w.id, simpleAnswer2(new Shadow2Session(w)))).toEqual({ ok: true });
  }
}

/** 審判を、人間の席それぞれの「写し」だけを見て答えさせて最後まで回す */
function playReferee(n: number, seed: number, humans: number[]) {
  const ref = new Kiridani2Referee({ n, seed, humans, names: NAMES.slice(0, n), offerTimeoutMs: 0 });
  ref.start();
  let steps = 0;
  while (!ref.done) {
    expect(ref.waitingSeats().length).toBeGreaterThan(0);
    step(ref);
    if (++steps > 20000) throw new Error('終わらない');
  }
  return ref;
}

/** 同じ答え方で Kiridani2Session を直接回す */
function playDirect(n: number, seed: number, humans: number[]) {
  const s = new Kiridani2Session({ n, seed, humans, names: NAMES.slice(0, n) });
  s.start();
  while (!s.done) applyAction2(s, simpleAnswer2(s));
  return s;
}

describe('霧谷 v2：オンライン対戦の審判', () => {
  it('人間3席＋AI2席：写しだけで答えても、直接回した試合と同じ得点になる', () => {
    for (const seed of [3, 11]) {
      const ref = playReferee(5, seed, [0, 1, 2]);
      const direct = playDirect(5, seed, [0, 1, 2]);
      expect(ref.scores).toEqual(direct.scores);
      expect(ref.log.filter((e) => e.t === 'combat_start').length).toBeGreaterThan(0);
      expect(ref.log.at(-2)?.t === 'game_end' || ref.log.at(-1)?.t === 'game_end' || ref.log.some((e) => e.t === 'score')).toBe(true);
    }
  });

  it('席ごとの出来事に、他の席の手札・ドラフトの手・秘密依頼が入らない', () => {
    const ref = playReferee(4, 5, [0, 2]);
    for (let seat = 0; seat < 4; seat++) {
      expect(ref.logs[seat].length).toBe(ref.log.length);
      expect(ref.logs[seat].filter((e) => leaksFor2(e, seat))).toEqual([]);
      const start = ref.logs[seat][0];
      expect(start.t === 'game_start' && start.me).toBe(seat);
      // 自分の秘密依頼は見える
      const sq = ref.logs[seat].find((e) => e.t === 'secret_quest' && e.seat === seat);
      expect(sq && sq.t === 'secret_quest' && sq.quest).toBe(ref.g.players[seat].secret);
    }
    // 隠す前の記録には他の席の手が入っている
    expect(ref.log.some((e) => leaksFor2(e, 0))).toBe(true);
  });

  it('始めの先手・冬の食料・運命の山の残りは全員に届く（運命は中身だけ、並びは伏せる）', () => {
    const ref = playReferee(3, 7, [0, 1]);
    const fp = ref.log.find((e) => e.t === 'first_player');
    for (let seat = 0; seat < 3; seat++) {
      expect(ref.logs[seat].find((e) => e.t === 'first_player')).toEqual(fp);
      const sy = ref.logs[seat].filter((e) => e.t === 'sync');
      expect(sy.length).toBeGreaterThan(0);
      for (const e of sy) {
        if (e.t !== 'sync') continue;
        expect(e.upkeep?.length).toBe(3);
        expect(e.fate?.length).toBe(3);
        for (const f of e.fate ?? []) expect(f).toEqual([...f].sort((a, b) => a - b));
      }
    }
    const last = ref.log.filter((e) => e.t === 'sync').at(-1);
    expect(last && last.t === 'sync' && last.upkeep).toEqual(ref.g.players.map((p) => ref.g.upkeepNeed(p)));
  });

  it('写しで戦闘の見込みを出せる（主の巣に先に送った人の手札は伏せてあっても落ちない）', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const ref = new Kiridani2Referee({ n: 3, seed, humans: [0, 1], names: NAMES.slice(0, 3), offerTimeoutMs: 0 });
      ref.start();
      for (let i = 0; i < 20000 && !ref.done; i++) {
        for (const seat of ref.waitingSeats()) {
          const pr = ref.prompt(seat);
          if (!pr) continue;
          const sh = new Shadow2Session(wire(pr));
          if (sh.waiting.k === 'choose') for (const o of sh.waiting.opts) if (o.k) expect(() => previewFight(sh.g, sh.player, o)).not.toThrow();
          expect(ref.act(seat, pr.id, simpleAnswer2(sh)).ok).toBe(true);
        }
      }
      expect(ref.done).toBe(true);
    }
  });

  it('準備段階：リーダー・職能・割合・品物の種類・始めの2枚・秘密依頼を、人間の席みんなに同時に聞く', () => {
    const ref = new Kiridani2Referee({ n: 3, seed: 9, humans: [0, 1], names: NAMES.slice(0, 3), offerTimeoutMs: 0 });
    ref.start();
    const seen = new Set<string>();
    let sawBoth = false;
    for (let i = 0; i < 500 && !ref.log.some((e) => e.t === 'round_start'); i++) {
      const seats = ref.waitingSeats();
      expect(seats.length).toBeGreaterThan(0);
      for (const seat of seats) { const pr = ref.prompt(seat)!; seen.add(pr.k === 'card' ? `card:${pr.why}` : pr.k); }
      if (seats.length === 2) sawBoth = true;
      step(ref);
    }
    for (const k of ['card:leader', 'card:occ', 'ratio', 'kind', 'card:item', 'card:start_occ', 'card:start_item', 'card:quest']) expect(seen).toContain(k);
    expect(sawBoth).toBe(true);
  });

  it('知らない答え・古い番号・ほかの席の番は断る', () => {
    const ref = new Kiridani2Referee({ n: 3, seed: 2, humans: [0, 1], names: NAMES.slice(0, 3) });
    ref.start();
    const seat = ref.waitingSeats()[0];
    const other = seat === 0 ? 1 : 0;
    const p = ref.prompt(seat)!;
    expect(p.k).toBe('card');
    expect(ref.act(seat, p.id, { t: 'card', id: 'zzz' }).ok).toBe(false);
    expect(ref.act(seat, 'n999', { t: 'card', id: p.cards![0] }).ok).toBe(false);
    expect(ref.act(other, p.id, { t: 'card', id: p.cards![0] }).ok).toBe(false);
    expect(ref.act(seat, p.id, { t: 'opt', i: 0 }).ok).toBe(false);
    expect(ref.act(seat, p.id, null as never).ok).toBe(false);
    expect(ref.act(seat, p.id, { t: 'card', id: p.cards![0] })).toEqual({ ok: true });
  });

  it('盤面の写し：他の席の手札と秘密依頼は隠し、選べる行動と見込みの計算は本物と同じ', () => {
    const s = new Kiridani2Session({ n: 4, seed: 4, humans: [0, 1] });
    s.start();
    let checked = 0, fights = 0;
    for (let i = 0; i < 5000 && !s.done && checked < 20; i++) {
      const w = s.waiting!;
      if (w.k === 'choose') {
        const seat = w.p.pid;
        const snap = JSON.parse(JSON.stringify(encodeGame2(s.g, seat)));
        expect(JSON.stringify(snap).length).toBeLessThan(120_000);
        const g2 = decodeGame2(snap);
        for (const q of g2.players) if (q.pid !== seat) { expect(q.hand.every((c) => c === '?')).toBe(true); expect(q.secret).toBeNull(); }
        expect(g2.players[seat].hand).toEqual(w.p.hand);
        expect(g2.players[seat].secret).toBe(w.p.secret);
        expect(g2.legal(g2.players[seat])).toEqual(s.g.legal(w.p));
        expect(marketQuote(g2, g2.players[seat])).toEqual(marketQuote(s.g, w.p));
        const nest = w.opts.find((o) => (o.s.startsWith('nest') || o.s === 'lair') && o.i >= 0);
        if (nest) {
          const a = previewFight(g2, g2.players[seat], nest), b = previewFight(s.g, w.p, nest);
          expect(a).toEqual(b);
          fights++;
        }
        checked++;
      }
      applyAction2(s, simpleAnswer2(s));
    }
    expect(checked).toBeGreaterThan(5);
    expect(fights).toBeGreaterThan(0);
  });

  it('10年の試合も最後まで回る（写しで答える）', () => {
    const ref = new Kiridani2Referee({ n: 3, seed: 21, years: 10, humans: [0], names: NAMES.slice(0, 3), offerTimeoutMs: 0 });
    ref.start();
    let steps = 0;
    while (!ref.done && ++steps < 20000) step(ref);
    expect(ref.done).toBe(true);
    const gs = ref.log[0];
    expect(gs.t === 'game_start' && gs.rounds).toBe(40);
  });
});

// ------------------------------------------------------------ 退室と復帰
describe('霧谷 v2：途中退室と復帰', () => {
  function play(seed: number, leaveAt: number, backAt: number) {
    const ref = new Kiridani2Referee({ n: 4, seed, humans: [0, 1, 2], names: NAMES.slice(0, 4), offerTimeoutMs: 0 });
    ref.start();
    let steps = 0;
    const awaySteps: boolean[] = [];
    while (!ref.done) {
      if (steps === leaveAt) expect(ref.setAway(1, true)).toBe(true);
      if (steps === backAt) expect(ref.setAway(1, false)).toBe(true);
      if (ref.isAway(1)) { expect(ref.prompt(1)).toBeNull(); expect(ref.waitingSeats()).not.toContain(1); }
      awaySteps.push(ref.isAway(1));
      step(ref);
      if (++steps > 20000) throw new Error('終わらない');
    }
    return { ref, awaySteps };
  }

  it('退室中は席 1 に問いが来ず、試合は最後まで進む。戻ると再び問いが来る', () => {
    const { ref, awaySteps } = play(4, 5, 60);
    expect(ref.done).toBe(true);
    expect(awaySteps.slice(5, 60).every(Boolean)).toBe(true);
    expect(awaySteps.slice(60).some(Boolean)).toBe(false);
    const back = ref.history.findIndex(([s, id, a]) => s === -1 && id === '1' && a.t === 'away' && !a.v);
    expect(ref.history.slice(back).some(([s]) => s === 1)).toBe(true);
  });

  it('準備段階の最中に退室しても、AI が代わりに選んで先へ進む', () => {
    const { ref } = play(7, 0, 1_000_000);
    expect(ref.done).toBe(true);
    expect(ref.history.filter(([s]) => s === 1)).toEqual([]);
  });

  it('記録を読み直すと、退室・復帰も含めて同じ試合になる（ホストの読み込み直し）', () => {
    const { ref } = play(12, 6, 40);
    const again = new Kiridani2Referee({ n: 4, seed: 12, humans: [0, 1, 2], names: NAMES.slice(0, 4), offerTimeoutMs: 0 });
    again.start();
    again.replay(JSON.parse(JSON.stringify(ref.history)));
    expect(again.done).toBe(true);
    expect(again.scores).toEqual(ref.scores);
    expect(again.logs[1].length).toBe(ref.logs[1].length);
  });
});

// ------------------------------------------------------------ 人どうしの取引
function toTrade() {
  for (let seed = 1; seed < 40; seed++) {
    const ref = new Kiridani2Referee({ n: 3, seed, humans: [0, 1], names: ['ホスト', 'ゲスト', 'AI'], offerTimeoutMs: 0 });
    ref.start();
    for (let i = 0; i < 2000 && !ref.done; i++) {
      const p0 = ref.prompt(0);
      const g = ref.g;
      if (p0?.k === 'choose' && p0.left > 0 && g.players[0].res.food >= 1 && g.players[1].res.gold >= 1 && p0.partners.includes(1)) return { ref, p0 };
      step(ref);
    }
  }
  throw new Error('取引の場面がない');
}

describe('霧谷 v2：人どうしの取引（審判）', () => {
  it('申し込み → 受ける：両方の持ち物が変わり、全員に取引の出来事が届く', () => {
    const { ref, p0 } = toTrade();
    const [f0, g0, f1, g1] = [ref.g.players[0].res.food, ref.g.players[0].res.gold, ref.g.players[1].res.food, ref.g.players[1].res.gold];
    expect(new Shadow2Session(wire(p0)).judgeTrade(1, { food: 1 }, { gold: 1 })).toMatchObject({ ok: true, human: true });
    expect(ref.act(0, p0.id, { t: 'offer', b: 1, give: { food: 1 }, get: { gold: 1 } })).toEqual({ ok: true });
    const of = ref.offerFor(1)!;
    expect(of).toMatchObject({ from: 0, to: 1, give: { food: 1 }, get: { gold: 1 } });
    expect(ref.prompt(0)!.offer?.id).toBe(of.id);
    expect(ref.offerFor(2)).toBeNull();
    expect(ref.act(0, ref.prompt(0)!.id, { t: 'opt', i: 0 }).ok).toBe(false);
    expect(ref.act(0, of.id, { t: 'reply', accept: true }).ok).toBe(false);
    expect(ref.act(1, of.id, { t: 'reply', accept: true })).toEqual({ ok: true });
    expect(ref.g.players[0].res.food).toBe(f0 - 1);
    expect(ref.g.players[0].res.gold).toBe(g0 + 1);
    expect(ref.g.players[1].res.food).toBe(f1 + 1);
    expect(ref.g.players[1].res.gold).toBe(g1 - 1);
    for (let s = 0; s < 3; s++) expect(ref.logs[s].some((e) => e.t === 'trade')).toBe(true);
    expect(ref.noteFor(0)?.ok).toBe(true);
    expect(ref.prompt(0)!.left).toBe(p0.left - 1);
  });

  it('断る・取り下げ・時間切れ：何も変わらずお知らせだけ', () => {
    const { ref, p0 } = toTrade();
    const before = JSON.stringify(ref.g.players.map((p) => p.res));
    expect(ref.act(0, p0.id, { t: 'offer', b: 1, give: { food: 1 }, get: { gold: 1 } }).ok).toBe(true);
    expect(ref.act(1, ref.offer!.id, { t: 'reply', accept: false }).ok).toBe(true);
    expect(ref.noteFor(0)?.ok).toBe(false);
    const p1 = ref.prompt(0)!;
    expect(ref.act(0, p1.id, { t: 'offer', b: 1, give: { food: 1 }, get: { gold: 1 } }).ok).toBe(true);
    expect(ref.act(0, ref.offer!.id, { t: 'withdraw' }).ok).toBe(true);
    const p2 = ref.prompt(0)!;
    expect(ref.act(0, p2.id, { t: 'offer', b: 1, give: { food: 1 }, get: { gold: 1 } }).ok).toBe(true);
    expect(ref.expire(ref.offer!.id)).toBe(true);
    expect(ref.offer).toBeNull();
    expect(JSON.stringify(ref.g.players.map((p) => p.res))).toBe(before);
  });

  it('退室した人への取引の申し込みは流れる', () => {
    const { ref, p0 } = toTrade();
    expect(ref.act(0, p0.id, { t: 'offer', b: 1, give: { food: 1 }, get: { gold: 1 } }).ok).toBe(true);
    expect(ref.setAway(1, true)).toBe(true);
    expect(ref.offer).toBeNull();
    expect(ref.noteFor(0)?.ok).toBe(false);
  });

  it('AI との取引：写しは返事をホストに問い合わせる', async () => {
    const { ref, p0 } = toTrade();
    const ai = p0.partners.find((b) => b === 2);
    if (ai === undefined) return;
    let asked = 0;
    const sh = new Shadow2Session(wire(p0), async (b, give, get) => { asked++; return ref.judge(0, b, give, get); });
    const j = sh.judgeTrade(2, { food: 1 }, { gold: 1 });
    expect(j.pending || !j.ok).toBe(true);
    await Promise.resolve();
    expect(asked).toBeLessThanOrEqual(1);
  });
});
