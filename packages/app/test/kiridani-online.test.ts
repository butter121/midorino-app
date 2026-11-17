// 霧谷：オンライン対戦（ホスト＋参加者2人を同じ JS の中の通信でつなぎ、AI の席を足して最後まで）
import { describe, expect, it } from 'vitest';
import { KiridaniSession, ShadowSession, applyAction, decodeGame, leaksFor, simpleAnswer, type GameEvent, type Prompt } from '@midorino/engine/src/kiridani';
import { KdHostRoom } from '../src/net/kiridaniHost';
import { KdGuestClient } from '../src/net/kiridaniGuest';
import type { KdToGuest, KdToHost } from '../src/net/kiridaniProtocol';
import { memoryNet, type Conn } from '../src/net/transport';

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
async function until(ok: () => boolean, ms = 20000) {
  const t0 = Date.now();
  while (!ok()) { if (Date.now() - t0 > ms) throw new Error('timeout'); await tick(1); }
}
function memStore() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); }, m };
}

/** 受け取ったメッセージを全部ためる（隠し事が漏れていないかを見る） */
function spy(net: ReturnType<typeof memoryNet>, log: KdToGuest[]) {
  const dial = net.dial.bind(net);
  net.dial = (id, h) => {
    const c: Conn = dial(id, h);
    c.onData((s) => log.push(JSON.parse(s)));
    return c;
  };
}

/** ホスト・参加者の答え（写しだけを見て決める） */
const answer = (p: Prompt) => simpleAnswer(new ShadowSession(JSON.parse(JSON.stringify(p)) as Prompt));

async function setupRoom(net: ReturnType<typeof memoryNet>, stores = [memStore(), memStore(), memStore()], offerTimeoutMs?: number, awayGraceMs?: number) {
  const host = new KdHostRoom(net, 'ホスト', { store: stores[0], offerTimeoutMs, awayGraceMs });
  host.open();
  await until(() => host.status === 'open');
  const a = new KdGuestClient(net, host.roomId, 'アオイ', { store: stores[1], retryMs: 5 });
  const b = new KdGuestClient(net, host.roomId, 'ベニ', { store: stores[2], retryMs: 5 });
  a.connect(); b.connect();
  await until(() => a.status === 'waiting' && b.status === 'waiting');
  expect(host.lobby().members.map((m) => m.status)).toEqual(['host', 'waiting', 'waiting']);
  for (const m of host.members.filter((x) => x.status === 'waiting')) host.approve(m.id, true);
  await until(() => a.status === 'joined' && b.status === 'joined');
  host.setSeats(5);
  host.setLevel('mid');
  await until(() => a.lobby?.seats === 5 && b.lobby?.seats === 5);
  return { host, a, b, stores };
}

/** みんなが自分の問いに答え続ける（参加者は届いた問いだけを見る） */
async function playAll(host: KdHostRoom, guests: KdGuestClient[], hooks: { every?: number; onStep?: (i: number) => Promise<void> } = {}) {
  let steps = 0;
  const busy = new Set<string>();
  while (!host.referee!.done) {
    let moved = false;
    const hp = host.prompt(host.mySeat);
    if (hp) { expect(host.hostAct(hp.id, answer(hp))).toEqual({ ok: true }); moved = true; }
    for (const g of guests) {
      const p = g.prompt;
      if (g.status !== 'joined' || !p || busy.has(`${g.seat}:${p.id}`)) continue;
      busy.add(`${g.seat}:${p.id}`);
      const r = await g.act(p.id, answer(p));
      if (!r.ok) busy.delete(`${g.seat}:${p.id}`);
      moved = true;
    }
    steps++;
    if (hooks.every && hooks.onStep && steps % hooks.every === 0) await hooks.onStep(steps);
    if (!moved) await tick(1);
    if (steps > 20000) throw new Error('終わらない');
  }
  await until(() => guests.every((g) => g.done));
}

describe('霧谷：オンライン対戦（ホスト＋参加者2人＋AI）', () => {
  it('部屋を開き、承認して始め、最後まで遊ぶと、直接回した試合と同じ得点になる', async () => {
    const net = memoryNet();
    const seen: KdToGuest[] = [];
    spy(net, seen);
    const { host, a, b } = await setupRoom(net);
    host.start(4242);
    await until(() => a.seat >= 0 && b.seat >= 0);
    expect([host.mySeat, a.seat, b.seat]).toEqual([0, 1, 2]);
    expect(host.game!.names).toEqual(['ホスト', 'アオイ', 'ベニ', expect.any(String), expect.any(String)]);
    await playAll(host, [a, b]);
    const direct = new KiridaniSession({ n: 5, seed: 4242, humans: [0, 1, 2], levels: Array(5).fill('mid'), names: host.game!.names });
    direct.start();
    while (!direct.done) applyAction(direct, simpleAnswer(direct));
    expect(host.referee!.scores).toEqual(direct.scores);
    // 参加者の出来事は審判のその席の記録と同じで、最後に得点が届く
    expect(a.events).toEqual(host.referee!.logs[1]);
    expect(b.events).toEqual(host.referee!.logs[2]);
    const sc = b.events.find((e): e is Extract<GameEvent, { t: 'score' }> => e.t === 'score')!;
    expect(sc.rows.map((r) => r.total)).toEqual(direct.scores);

    // 届いたメッセージに、ほかの席の手札・ドラフトの手は入っていない
    const games = seen.filter((m): m is Extract<KdToGuest, { t: 'game' }> => m.t === 'game');
    expect(games.length).toBeGreaterThan(50);
    for (const m of games) {
      for (const e of m.evs) expect(leaksFor(e, m.seat)).toBe(false);
      if (m.prompt) {
        const g = decodeGame(m.prompt.snap);
        for (const q of g.players) if (q.pid !== m.seat) expect(q.hand.every((c) => c === '?')).toBe(true);
        expect(m.prompt.seat).toBe(m.seat);
      }
    }
  });

  it('参加者が切れてもつなぎ直して同じ席に戻り、読み込み直し（新しい接続）でも続けられる', async () => {
    const net = memoryNet();
    const { host, a, b, stores } = await setupRoom(net);
    host.setSeats(3);
    host.start(77);
    await until(() => a.seat >= 0 && b.seat >= 0);
    let a2: KdGuestClient | null = null;
    const guests = [a, b];
    await playAll(host, guests, {
      every: 10,
      onStep: async (i) => {
        if (i === 10) { net.drop(host.roomId); await until(() => a.status === 'offline'); await until(() => a.status === 'joined' && b.status === 'joined'); }
        if (i === 30) {
          // 参加者 a が画面を読み込み直す：保存した合言葉で同じ席に入り、出来事を最初から受け取る
          a.close();
          a2 = new KdGuestClient(net, host.roomId, '', { store: stores[1], retryMs: 5 });
          a2.connect();
          await until(() => a2!.status === 'joined' && a2!.seat === 1 && a2!.events.length === host.referee!.logs[1].length);
          guests[0] = a2;
        }
      },
    });
    expect(a2).not.toBeNull();
    expect(a2!.events).toEqual(host.referee!.logs[1]);
    expect(host.referee!.done).toBe(true);
  });

  it('ホストが読み込み直すと、保存した答えから同じ試合に戻る', async () => {
    const net = memoryNet();
    const { host, a, b, stores } = await setupRoom(net);
    host.start(9);
    await until(() => a.seat >= 0 && b.seat >= 0);
    let n = 0;
    await playAll(host, [a, b], { every: 1, onStep: async () => { n++; if (n === 30) throw new Error('stop'); } }).catch((e) => { if (e.message !== 'stop') throw e; });
    const before = host.referee!.log.length;
    const again = KdHostRoom.resume(net, stores[0])!;
    expect(again.roomId).toBe(host.roomId);
    expect(again.referee!.log).toEqual(host.referee!.log);
    expect(again.referee!.log.length).toBe(before);
  });

  it('ホストが部屋を閉じると、参加者に知らせが届く・始まったあとの新しい申請は断る', async () => {
    const net = memoryNet();
    const { host, a } = await setupRoom(net);
    host.start(5);
    const late = new KdGuestClient(net, host.roomId, 'おそい', { store: memStore(), retryMs: 5 });
    late.connect();
    await until(() => late.status === 'denied');
    expect(late.reason).toContain('始まって');
    host.close();
    await until(() => a.status === 'closed');
    expect(a.reason).toBe('ホストが部屋を閉じました');
  });

  it('メッセージは JSON で行き来し、形の崩れた答えは断る', async () => {
    const msgs: KdToHost[] = [
      { t: 'hello', name: 'x' },
      { t: 'act', reqId: 1, id: 'n3', a: { t: 'fight', sel: { sid: 'nest1', k: 2, boosts: ['arrow'], wait: true } } },
      { t: 'act', reqId: 2, id: 'n4', a: { t: 'market', sid: 'market', kind: 'sell', r: 'mana', q: 2 } },
      { t: 'judge', reqId: 3, b: 2, give: { wood: 1 }, get: { iron: 1 } },
      { t: 'sync', have: 10 },
    ];
    for (const m of msgs) expect(JSON.parse(JSON.stringify(m))).toEqual(m);
    const net = memoryNet();
    const { host, a } = await setupRoom(net);
    host.start(3);
    await until(() => a.prompt !== null);
    const p = a.prompt!;
    expect((await a.act(p.id, { t: 'card', id: 'nope' })).ok).toBe(false);
    expect((await a.act(p.id, { t: 'trade', b: 1, give: { wood: -5 }, get: {} })).ok).toBe(false);
    expect((await a.act('n0', { t: 'card', id: p.cards![0] })).ok).toBe(false);
    expect((await a.act(p.id, { t: 'card', id: p.cards![0] })).ok).toBe(true);
    host.close();
  });

  it('人どうしの取引：ホストが申し込み、参加者が受ける／断る。ほかの参加者には成立した取引だけが届く', async () => {
    const net = memoryNet();
    const seen: KdToGuest[] = [];
    spy(net, seen);
    const { host, a, b } = await setupRoom(net);
    host.setSeats(3);
    host.start(31);
    await until(() => a.seat >= 0 && b.seat >= 0);
    // ホストの番（置き場所）で、ホストが食料・アオイが金貨を持つところまで進める
    let hp: Prompt | null = null;
    await playAll(host, [a, b], { every: 1, onStep: async () => {
      const p = host.prompt(0); const g = host.referee!.g;
      if (p?.k === 'choose' && p.left > 0 && p.partners.includes(1) && g.players[0].res.food >= 2 && g.players[1].res.gold >= 2) { hp = p; throw new Error('stop'); }
    } }).catch((e) => { if (e.message !== 'stop') throw e; });
    expect(hp).not.toBeNull();
    const ref = host.referee!;
    const tradesIn = (evs: GameEvent[]) => evs.filter((e) => e.t === 'trade').length;
    const t0 = tradesIn(b.events);
    const resB = JSON.stringify(ref.g.players.map((p) => p.res));

    // 1. 申し込み → 断る
    expect(host.hostAct(hp!.id, { t: 'offer', b: 1, give: { food: 1 }, get: { gold: 1 } })).toEqual({ ok: true });
    await until(() => !!a.offer);
    expect(a.offer).toMatchObject({ from: 0, to: 1, give: { food: 1 }, get: { gold: 1 } });
    expect(a.offer!.res).toEqual(ref.g.players[1].res);
    expect(b.offer).toBeNull();
    expect((await a.act(a.offer!.id, { t: 'reply', accept: false })).ok).toBe(true);
    await until(() => a.offer === null);
    expect(host.noteFor(0)?.text).toBe('アオイが取引を断りました');
    expect(JSON.stringify(ref.g.players.map((p) => p.res))).toBe(resB);

    // 2. もう一度申し込み → 受ける：全員の画面に取引の出来事
    const p2 = host.prompt(0)!;
    expect(p2.left).toBe(hp!.left);
    expect(host.hostAct(p2.id, { t: 'offer', b: 1, give: { food: 2 }, get: { gold: 1 } })).toEqual({ ok: true });
    await until(() => !!a.offer);
    expect((await a.act(a.offer!.id, { t: 'reply', accept: true })).ok).toBe(true);
    await until(() => tradesIn(b.events) === t0 + 1 && tradesIn(a.events) === tradesIn(ref.logs[1]));
    expect(a.note?.text).toBe('ホストとの取引が成立しました');
    expect(b.note).toBeNull();
    const ev = b.events.filter((e) => e.t === 'trade').at(-1)!;
    expect(ev).toMatchObject({ t: 'trade', a: 0, b: 1, give: { food: 2 }, get: { gold: 1 } });
    expect(host.prompt(0)!.left).toBe(hp!.left - 1);

    // 申し込みの中身は当事者以外（ベニ）には一度も届いていない
    for (const m of seen) if (m.t === 'game' && m.seat === 2) { expect(m.offer ?? null).toBeNull(); expect(m.note ?? null).toBeNull(); }
    await playAll(host, [a, b]);
    expect(ref.done).toBe(true);
    expect(b.events).toEqual(ref.logs[2]);
  });

  it('人どうしの取引：参加者から参加者へ。返事がなければ時間切れで断ったことになり、申し込んだ人の番が続く', async () => {
    const net = memoryNet();
    const { host, a, b } = await setupRoom(net, undefined, 40);
    host.setSeats(3);
    host.start(12);
    await until(() => a.seat >= 0 && b.seat >= 0);
    let ap: Prompt | null = null;
    await playAll(host, [a, b], { every: 1, onStep: async () => {
      const p = a.prompt;
      if (p?.k === 'choose' && p.left > 0 && p.partners.includes(2)) {
        const g = decodeGame(p.snap);
        if (g.players[1].res.food >= 1 && g.players[2].res.gold >= 1) { ap = p; throw new Error('stop'); }
      }
    } }).catch((e) => { if (e.message !== 'stop') throw e; });
    expect(ap).not.toBeNull();
    expect((await a.act(ap!.id, { t: 'offer', b: 2, give: { food: 1 }, get: { gold: 1 } })).ok).toBe(true);
    await until(() => !!b.offer && !!a.offer);
    expect(a.prompt!.offer?.id).toBe(a.offer!.id);
    expect(host.offerFor(0)).toBeNull();
    // 返事をしない → 40ms で時間切れ
    await until(() => a.offer === null && b.offer === null);
    expect(a.note?.text).toContain('返事がなく');
    expect(b.note?.text).toBe('時間切れで、取引の申し込みは流れました');
    expect(a.prompt!.k).toBe('choose');
    expect(a.prompt!.left).toBe(ap!.left);
    // ホストの記録に時間切れが残り、読み直しても同じ
    expect(host.referee!.history.at(-1)![2]).toEqual({ t: 'expire' });
    await playAll(host, [a, b]);
    expect(host.referee!.done).toBe(true);
  });

  it('途中退室：戻らない人の席は少しして弱い AI が動かし、試合は最後まで進む。同じ端末で開き直すと席に戻る', async () => {
    const net = memoryNet();
    const stores = [memStore(), memStore(), memStore()];
    const { host, a, b } = await setupRoom(net, stores, 0, 30);
    host.start(777);
    await until(() => a.seat >= 0 && b.seat >= 0);
    const bSeat = b.seat;
    let b2: KdGuestClient | null = null;
    let left = false, back = false;
    const guests: KdGuestClient[] = [a];
    await playAll(host, guests, {
      every: 1,
      onStep: async (i) => {
        if (i === 3 && !left) {
          left = true;
          b.close();
          // 猶予のあいだはまだ人の席
          await until(() => host.dropping.includes('ベニ'));
          expect(host.referee!.isAway(bSeat)).toBe(false);
          await until(() => host.referee!.isAway(bSeat));
          expect(host.dropping).toEqual([]);
          await until(() => a.lobby?.away?.includes(bSeat) ?? false);
        }
        if (i === 40 && !back) {
          back = true;
          // 同じ端末（保存した合言葉）で開き直す
          b2 = new KdGuestClient(net, host.roomId, '', { store: stores[2], retryMs: 5 });
          b2.connect();
          await until(() => b2!.status === 'joined' && b2!.seat === bSeat);
          expect(host.referee!.isAway(bSeat)).toBe(false);
          await until(() => !(a.lobby?.away ?? []).length);
          guests.push(b2);
        }
      },
    });
    expect(left && back).toBe(true);
    expect(host.referee!.done).toBe(true);
    // 退室・復帰は記録に残り、ホストが読み込み直しても同じ得点
    const h = host.referee!.history;
    expect(h.some(([s, id, x]) => s === -1 && id === String(bSeat) && x.t === 'away' && x.v)).toBe(true);
    expect(h.some(([s, id, x]) => s === -1 && id === String(bSeat) && x.t === 'away' && !x.v)).toBe(true);
    const again = KdHostRoom.resume(memoryNet(), stores[0])!;
    expect(again.referee!.scores).toEqual(host.referee!.scores);
    host.close(); again.close(); a.close(); (b2 as KdGuestClient | null)?.close();
  });
});
