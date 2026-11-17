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

async function setupRoom(net: ReturnType<typeof memoryNet>, stores = [memStore(), memStore(), memStore()]) {
  const host = new KdHostRoom(net, 'ホスト', { store: stores[0] });
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
});
