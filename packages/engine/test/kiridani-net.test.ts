// 霧谷：オンライン対戦の審判（席ごとに隠した出来事・問い・盤面の写し）
import { describe, expect, it } from 'vitest';
import { KiridaniReferee, KiridaniSession, ShadowSession, applyAction, decodeGame, encodeGame, fightChips, leaksFor, marketQuote, previewPick, simpleAnswer, type Prompt } from '../src/kiridani';

const NAMES = ['ホスト', 'ゲスト1', 'ゲスト2', 'AI4', 'AI5'];

/** 審判を、人間の席それぞれの「写し」だけを見て答えさせて最後まで回す */
function playReferee(n: number, seed: number, humans: number[], order: (seats: number[]) => number[] = (x) => x) {
  const ref = new KiridaniReferee({ n, seed, humans, names: NAMES.slice(0, n) });
  ref.start();
  let steps = 0;
  while (!ref.done) {
    const seats = order(ref.waitingSeats());
    expect(seats.length).toBeGreaterThan(0);
    for (const seat of seats) {
      const pr = ref.prompt(seat);
      if (!pr) continue;
      const wire = JSON.parse(JSON.stringify(pr)) as Prompt;
      const sh = new ShadowSession(wire);
      const r = ref.act(seat, wire.id, simpleAnswer(sh));
      expect(r).toEqual({ ok: true });
    }
    if (++steps > 5000) throw new Error('終わらない');
  }
  return ref;
}

/** 同じ答え方で KiridaniSession を直接回す */
function playDirect(n: number, seed: number, humans: number[]) {
  const s = new KiridaniSession({ n, seed, humans, names: NAMES.slice(0, n) });
  s.start();
  while (!s.done) applyAction(s, simpleAnswer(s));
  return s;
}

describe('霧谷：オンライン対戦の審判', () => {
  it('人間3席＋AI2席：写しだけで答えても、直接回した試合と同じ得点になる', () => {
    for (const seed of [3, 11]) {
      const ref = playReferee(5, seed, [0, 1, 2], (x) => [...x].reverse());
      const direct = playDirect(5, seed, [0, 1, 2]);
      expect(ref.scores).toEqual(direct.scores);
      expect(ref.log.filter((e) => e.t === 'combat_start').length).toBeGreaterThan(0);
    }
  });

  it('席ごとの出来事に、他の席の手札・ドラフトの手が入らない', () => {
    const ref = playReferee(4, 5, [0, 2]);
    for (let seat = 0; seat < 4; seat++) {
      expect(ref.logs[seat].length).toBe(ref.log.length);
      expect(ref.logs[seat].filter((e) => leaksFor(e, seat))).toEqual([]);
      const start = ref.logs[seat][0];
      expect(start.t === 'game_start' && start.me).toBe(seat);
    }
    // 隠す前の記録には他の席の手が入っている
    expect(ref.log.some((e) => leaksFor(e, 0))).toBe(true);
  });

  it('ドラフトとキャラ選びは同時に答えられ、順番が来る前の答えは預かる', () => {
    const ref = new KiridaniReferee({ n: 4, seed: 9, humans: [0, 1, 3], names: NAMES.slice(0, 4) });
    ref.start();
    expect(ref.waitingSeats()).toEqual([0, 1, 3]);
    const p3 = ref.prompt(3)!;
    expect(p3.k).toBe('draft');
    expect(ref.act(3, p3.id, { t: 'card', id: p3.cards![0] })).toEqual({ ok: true });
    expect(ref.prompt(3)).toBeNull();
    expect(ref.act(3, p3.id, { t: 'card', id: p3.cards![0] }).ok).toBe(false);
    // 席0・1が選ぶと、預かっていた席3の答えも入る
    for (const seat of [1, 0]) { const p = ref.prompt(seat)!; ref.act(seat, p.id, { t: 'card', id: p.cards![1] }); }
    const picks = ref.log.filter((e) => e.t === 'draft_pick');
    expect(picks.map((e) => e.t === 'draft_pick' && e.seat)).toEqual([0, 1, 2, 3]);
    expect(picks[3].t === 'draft_pick' && picks[3].card).toBe(p3.cards![0]);
    // 次の周の問いは新しい番号
    expect(ref.prompt(3)!.id).not.toBe(p3.id);
  });

  it('知らない答え・古い番号・ほかの席の番は断る', () => {
    const ref = new KiridaniReferee({ n: 3, seed: 2, humans: [0, 1], names: NAMES.slice(0, 3) });
    ref.start();
    const p = ref.prompt(0)!;
    expect(ref.act(0, p.id, { t: 'card', id: 'zzz' }).ok).toBe(false);
    expect(ref.act(0, 'n999', { t: 'card', id: p.cards![0] }).ok).toBe(false);
    expect(ref.act(2, p.id, { t: 'card', id: p.cards![0] }).ok).toBe(false);
    expect(ref.act(0, p.id, { t: 'opt', i: 0 } as never).ok).toBe(false);
    expect(ref.act(0, p.id, null as never).ok).toBe(false);
  });

  it('盤面の写し：他の席の手札は隠し、見込みの計算は本物と同じ', () => {
    const s = new KiridaniSession({ n: 4, seed: 4, humans: [0, 1] });
    s.start();
    let checked = 0;
    for (let i = 0; i < 3000 && !s.done && checked < 6; i++) {
      const w = s.waiting!;
      if (w.k === 'choose') {
        const seat = w.p.pid;
        const snap = JSON.parse(JSON.stringify(encodeGame(s.g, seat)));
        const g2 = decodeGame(snap);
        for (const q of g2.players) if (q.pid !== seat) expect(q.hand.every((c) => c === '?')).toBe(true);
        expect(g2.players[seat].hand).toEqual(w.p.hand);
        expect(g2.legal(g2.players[seat])).toEqual(s.g.legal(w.p));
        expect(marketQuote(g2, g2.players[seat])).toEqual(marketQuote(s.g, w.p));
        const nest = w.opts.find((o) => o[0].startsWith('nest') && Array.isArray(o[1]));
        if (nest) {
          const sel = { sid: nest[0], k: (nest[1] as number[])[0], boosts: [] as string[] };
          expect(fightChips(g2, g2.players[seat], nest[0])).toEqual(fightChips(s.g, w.p, nest[0]));
          expect(previewPick(g2, g2.players[seat], sel)).toEqual(previewPick(s.g, w.p, sel));
          checked++;
        }
      }
      applyAction(s, simpleAnswer(s));
    }
    expect(checked).toBeGreaterThan(0);
  });
});

// ------------------------------------------------------------ 人どうしの取引
import { KiridaniReferee as Ref2, simpleAnswer as ans2, ShadowSession as Sh2 } from '../src/kiridani';

/** 人の席 0・1（＋AI）で、席0が置き場所を選ぶ場面まで進め、席0・1がどちらも食料と金貨を持っているところで止める */
function toTrade(opts: { offerTimeoutMs?: number; now?: () => number } = {}) {
  for (let seed = 1; seed < 30; seed++) {
    const ref = new Ref2({ n: 3, seed, humans: [0, 1], names: ['ホスト', 'ゲスト', 'AI'], offerTimeoutMs: opts.offerTimeoutMs ?? 0, now: opts.now });
    ref.start();
    for (let i = 0; i < 400 && !ref.done; i++) {
      const p0 = ref.prompt(0);
      const g = ref.g;
      if (p0?.k === 'choose' && p0.left > 0 && g.players[0].res.food >= 1 && g.players[1].res.gold >= 1 && p0.partners.includes(1)) return { ref, p0, seed };
      for (const seat of ref.waitingSeats()) { const p = ref.prompt(seat)!; ref.act(seat, p.id, ans2(new Sh2(JSON.parse(JSON.stringify(p))))); }
    }
  }
  throw new Error('取引の場面がない');
}
const trades = (ref: InstanceType<typeof Ref2>, seat: number) => ref.logs[seat].filter((e) => e.t === 'trade').length;

describe('霧谷：人どうしの取引（審判）', () => {
  it('申し込み → 受ける：両方の持ち物が変わり、全員に取引の出来事、回数を1つ使う', () => {
    const { ref, p0 } = toTrade();
    const [f0, g0, f1, g1] = [ref.g.players[0].res.food, ref.g.players[0].res.gold, ref.g.players[1].res.food, ref.g.players[1].res.gold];
    const before = [0, 1, 2].map((x) => trades(ref, x));
    expect(new Sh2(JSON.parse(JSON.stringify(p0))).judgeTrade(1, { food: 1 }, { gold: 1 })).toMatchObject({ ok: true, human: true });
    expect(ref.act(0, p0.id, { t: 'offer', b: 1, give: { food: 1 }, get: { gold: 1 } })).toEqual({ ok: true });
    const of = ref.offerFor(1)!;
    expect(of).toMatchObject({ from: 0, to: 1, give: { food: 1 }, get: { gold: 1 } });
    expect(ref.prompt(0)!.offer?.id).toBe(of.id);
    expect(ref.offerFor(2)).toBeNull();
    // 返事を待つあいだ、申し込んだ人はほかの答えを出せない
    const pw = ref.prompt(0)!;
    expect(ref.act(0, pw.id, { t: 'opt', i: 0 }).ok).toBe(false);
    expect(ref.act(2, of.id, { t: 'reply', accept: true }).ok).toBe(false);
    expect(ref.act(0, of.id, { t: 'reply', accept: true }).ok).toBe(false);
    expect(ref.act(1, of.id, { t: 'reply', accept: true })).toEqual({ ok: true });
    expect(ref.offer).toBeNull();
    const aya = (x: number) => (ref.g.players[x].char === 'aya' ? 2 : 0);
    expect(ref.g.players[0].res.food).toBe(f0 - 1);
    expect(ref.g.players[0].res.gold).toBe(g0 + 1 + aya(0));
    expect(ref.g.players[1].res.food).toBe(f1 + 1);
    expect(ref.g.players[1].res.gold).toBe(g1 - 1 + aya(1));
    expect([0, 1, 2].map((x) => trades(ref, x))).toEqual(before.map((n) => n + 1));
    expect(ref.prompt(0)!.left).toBe(p0.left - 1);
    expect(ref.noteFor(0)).toMatchObject({ ok: true, text: 'ゲストが取引を受けました' });
    expect(ref.noteFor(2)).toBeNull();
  });

  it('断る：何も変わらず、回数も使わず、ほかの席には何も届かない', () => {
    const { ref, p0 } = toTrade();
    const res = JSON.stringify(ref.g.players.map((p) => p.res));
    const logs = ref.logs.map((l) => l.length);
    ref.act(0, p0.id, { t: 'offer', b: 1, give: { food: 1 }, get: { gold: 1 } });
    const id = ref.offer!.id;
    expect(ref.act(1, id, { t: 'reply', accept: false })).toEqual({ ok: true });
    expect(JSON.stringify(ref.g.players.map((p) => p.res))).toBe(res);
    expect(ref.logs.map((l) => l.length)).toEqual(logs);
    const p = ref.prompt(0)!;
    expect(p.left).toBe(p0.left);
    expect(p.offer).toBeUndefined();
    expect(ref.noteFor(0)?.text).toBe('ゲストが取引を断りました');
    expect(ref.noteFor(1)).toBeNull();
    // 番は続く：置き場所を選べる
    expect(ref.act(0, p.id, { t: 'opt', i: 0 })).toEqual({ ok: true });
  });

  it('取り下げ・時間切れ', () => {
    let now = 1000;
    const { ref, p0 } = toTrade({ offerTimeoutMs: 60_000, now: () => now });
    ref.act(0, p0.id, { t: 'offer', b: 1, give: { food: 1 }, get: { gold: 1 } });
    const id1 = ref.offer!.id;
    expect(ref.act(1, id1, { t: 'withdraw' }).ok).toBe(false);
    expect(ref.act(0, id1, { t: 'withdraw' })).toEqual({ ok: true });
    expect(ref.noteFor(1)?.text).toBe('ホストが取引の申し込みを取り下げました');
    expect(ref.act(1, id1, { t: 'reply', accept: true }).ok).toBe(false);
    // 時間切れ：締め切り前は何もしない
    const p1 = ref.prompt(0)!;
    ref.act(0, p1.id, { t: 'offer', b: 1, give: { food: 1 }, get: { gold: 1 } });
    expect(ref.offerFor(1)!.ms).toBe(60_000);
    now += 59_000;
    expect(ref.expire()).toBe(false);
    now += 2_000;
    expect(ref.expire()).toBe(true);
    expect(ref.offer).toBeNull();
    expect(ref.noteFor(0)?.text).toContain('返事がなく');
    expect(ref.prompt(0)!.left).toBe(p0.left);
    // 取り下げ・時間切れも記録に入る
    expect(ref.history.filter(([, , a]) => a.t === 'expire' || a.t === 'withdraw').length).toBe(2);
  });

  it('本物のタイマーで時間切れになる', async () => {
    const { ref, p0 } = toTrade({ offerTimeoutMs: 30 });
    ref.act(0, p0.id, { t: 'offer', b: 1, give: { food: 1 }, get: { gold: 1 } });
    expect(ref.offer).not.toBeNull();
    await new Promise((r) => setTimeout(r, 60));
    expect(ref.offer).toBeNull();
    expect(ref.history.at(-1)![2]).toEqual({ t: 'expire' });
  });

  it('受けるときにもう一度確かめる・回数の上限・形の確認', () => {
    const { ref, p0 } = toTrade();
    ref.act(0, p0.id, { t: 'offer', b: 1, give: { food: 1 }, get: { gold: 1 } });
    const id = ref.offer!.id;
    const gold = ref.g.players[1].res.gold;
    ref.g.players[1].res.gold = 0;   // 返事までに持ち物が変わった
    expect(ref.act(1, id, { t: 'reply', accept: true })).toEqual({ ok: true });
    expect(ref.noteFor(0)?.text).toContain('成立しませんでした');
    expect(trades(ref, 0)).toBe(0);
    ref.g.players[1].res.gold = gold;
    const p = ref.prompt(0)!;
    expect(p.left).toBe(p0.left);
    // 形の崩れた申し込み・AI への申し込み・人への即時の取引は断る
    expect(ref.act(0, p.id, { t: 'offer', b: 1, give: { food: 1, gold: 1 }, get: { gold: 1 } }).ok).toBe(false);
    expect(ref.act(0, p.id, { t: 'offer', b: 1, give: { food: 9 }, get: { gold: 1 } }).ok).toBe(false);
    expect(ref.act(0, p.id, { t: 'offer', b: 1, give: { food: 1, wood: 1, herb: 1, iron: 1 }, get: { gold: 1 } }).ok).toBe(false);
    expect(ref.act(0, p.id, { t: 'offer', b: 2, give: { food: 1 }, get: { gold: 1 } }).ok).toBe(false);
    expect(ref.act(0, p.id, { t: 'offer', b: 1, give: { food: 1 }, get: {} }).ok).toBe(false);
    expect(ref.act(0, p.id, { t: 'trade', b: 1, give: { food: 1 }, get: { gold: 1 } }).ok).toBe(false);
    // 上限まで受けてもらうと、もう申し込めない
    let left = p.left;
    while (left > 0) {
      const q = ref.prompt(0)!;
      expect(ref.act(0, q.id, { t: 'offer', b: 1, give: { food: 1 }, get: { gold: 1 } })).toEqual({ ok: true });
      ref.act(1, ref.offer!.id, { t: 'reply', accept: true });
      left--;
      expect(ref.prompt(0)!.left).toBe(left);
      if (ref.g.players[0].res.food < 1 || ref.g.players[1].res.gold < 1) break;
    }
    if (left === 0) {
      const r = ref.act(0, ref.prompt(0)!.id, { t: 'offer', b: 1, give: { food: 1 }, get: { gold: 1 } });
      expect(r).toMatchObject({ ok: false, error: 'このラウンドの取引は終わり' });
    }
  });

  it('記録を読み直すと、申し込み・返事・時間切れを含めて同じ試合に戻る', () => {
    const { ref, p0, seed } = toTrade();
    ref.act(0, p0.id, { t: 'offer', b: 1, give: { food: 1 }, get: { gold: 1 } });
    ref.act(1, ref.offer!.id, { t: 'reply', accept: false });
    const p = ref.prompt(0)!;
    ref.act(0, p.id, { t: 'offer', b: 1, give: { food: 1 }, get: { gold: 1 } });
    ref.act(-1, ref.offer!.id, { t: 'expire' });
    const q = ref.prompt(0)!;
    ref.act(0, q.id, { t: 'offer', b: 1, give: { food: 1 }, get: { gold: 1 } });
    ref.act(1, ref.offer!.id, { t: 'reply', accept: true });
    const r2 = new Ref2({ n: 3, seed, humans: [0, 1], names: ['ホスト', 'ゲスト', 'AI'], offerTimeoutMs: 0 });
    r2.start();
    r2.replay(ref.history);
    expect(r2.log).toEqual(ref.log);
    expect(r2.history).toEqual(ref.history);
    expect(r2.prompt(0)!.id).toBe(ref.prompt(0)!.id);
  });
});
