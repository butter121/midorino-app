// 霧谷 v2：オンライン対戦（新ルール）。ホスト＋参加者2人を同じ JS の中の通信でつなぎ、AI の席を足して最後まで
import { describe, expect, it } from 'vitest';
import { Shadow2Session, decodeGame2, leaksFor2, simpleAnswer2, type Prompt2 } from '@midorino/engine/src/kiridani2';
import { KdHostRoom } from '../src/net/kiridaniHost';
import { KdGuestClient } from '../src/net/kiridaniGuest';
import type { KdToGuest } from '../src/net/kiridaniProtocol';
import { memoryNet, type Conn } from '../src/net/transport';

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
async function until(ok: () => boolean, ms = 30000) {
  const t0 = Date.now();
  while (!ok()) { if (Date.now() - t0 > ms) throw new Error('timeout'); await tick(1); }
}
function memStore() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); }, m };
}
function spy(net: ReturnType<typeof memoryNet>, log: KdToGuest[]) {
  const dial = net.dial.bind(net);
  net.dial = (id, h) => {
    const c: Conn = dial(id, h);
    c.onData((s) => log.push(JSON.parse(s)));
    return c;
  };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const answer = (p: any) => simpleAnswer2(new Shadow2Session(JSON.parse(JSON.stringify(p)) as Prompt2));

async function setupRoom(net: ReturnType<typeof memoryNet>, stores = [memStore(), memStore(), memStore()], awayGraceMs?: number) {
  const host = new KdHostRoom(net, 'ホスト', { store: stores[0], rules: 2, years: 5, offerTimeoutMs: 0, awayGraceMs });
  host.open();
  await until(() => host.status === 'open');
  const a = new KdGuestClient(net, host.roomId, 'アオイ', { store: stores[1], retryMs: 5 });
  const b = new KdGuestClient(net, host.roomId, 'ベニ', { store: stores[2], retryMs: 5 });
  a.connect(); b.connect();
  await until(() => a.status === 'waiting' && b.status === 'waiting');
  for (const m of host.members.filter((x) => x.status === 'waiting')) host.approve(m.id, true);
  await until(() => a.status === 'joined' && b.status === 'joined');
  host.setSeats(4);
  await until(() => a.lobby?.seats === 4 && b.lobby?.seats === 4);
  expect(a.lobby?.rules).toBe(2);
  expect(a.rules).toBe(2);
  return { host, a, b, stores };
}

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
    if (steps > 40000) throw new Error('終わらない');
  }
  await until(() => guests.every((g) => g.done));
}

describe('霧谷 v2：オンライン対戦（新ルール）', () => {
  it('新ルールで部屋を開いて最後まで遊べる。隠し事は漏れず、ホストの読み込み直しでも同じ得点', async () => {
    const net = memoryNet();
    const seen: KdToGuest[] = [];
    spy(net, seen);
    const stores = [memStore(), memStore(), memStore()];
    const { host, a, b } = await setupRoom(net, stores);
    host.start(4242);
    await until(() => a.seat >= 0 && b.seat >= 0);
    expect(host.game!.rules).toBe(2);
    await playAll(host, [a, b]);
    // 通信は JSON（-0 は 0 になる）
    const j = (x: unknown) => JSON.parse(JSON.stringify(x));
    expect(a.events).toEqual(j(host.referee!.logs[a.seat]));
    expect(b.events).toEqual(j(host.referee!.logs[b.seat]));
    const games = seen.filter((m): m is Extract<KdToGuest, { t: 'game' }> => m.t === 'game');
    expect(games.length).toBeGreaterThan(30);
    for (const m of games) {
      expect(m.rules).toBe(2);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const e of m.evs as any[]) expect(leaksFor2(e, m.seat)).toBe(false);
      if (m.prompt) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const g = decodeGame2((m.prompt as any).snap);
        for (const q of g.players) if (q.pid !== m.seat) expect(q.hand.every((c: string) => c === '?')).toBe(true);
      }
    }
    const again = KdHostRoom.resume(memoryNet(), stores[0])!;
    expect(again.game!.rules).toBe(2);
    expect(again.referee!.scores).toEqual(host.referee!.scores);
    host.close(); again.close(); a.close(); b.close();
  }, 60000);

  it('途中退室した席は AI が動かし、同じ端末で開き直すと席に戻る', async () => {
    const net = memoryNet();
    const stores = [memStore(), memStore(), memStore()];
    const { host, a, b } = await setupRoom(net, stores, 30);
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
          await until(() => host.referee!.isAway(bSeat));
          await until(() => a.lobby?.away?.includes(bSeat) ?? false);
        }
        if (i === 40 && !back) {
          back = true;
          b2 = new KdGuestClient(net, host.roomId, '', { store: stores[2], retryMs: 5 });
          b2.connect();
          await until(() => b2!.status === 'joined' && b2!.seat === bSeat && b2!.rules === 2);
          expect(host.referee!.isAway(bSeat)).toBe(false);
          guests.push(b2);
        }
      },
    });
    expect(left && back).toBe(true);
    expect(host.referee!.done).toBe(true);
    host.close(); a.close(); (b2 as KdGuestClient | null)?.close();
  }, 60000);

  it('終わったあと「同じメンバーでもう一度」：参加者はつないだまま新しい試合に移り、前の試合の出来事は捨てる。チャット・保存・退室も新しい試合で動く', async () => {
    const net = memoryNet();
    const stores = [memStore(), memStore(), memStore()];
    const { host, a, b } = await setupRoom(net, stores, 30);
    expect(host.rematch()).toBe(false);
    host.start(99);
    await until(() => a.seat >= 0 && b.seat >= 0);
    expect(host.rematch()).toBe(false);
    host.hostSay('よろしく');
    await until(() => a.chat.length === 1 && b.chat.length === 1);
    const [aSeat, bSeat, names, gid0] = [a.seat, b.seat, host.game!.names, host.game!.gid];
    await playAll(host, [a, b]);
    expect(a.done && b.done).toBe(true);
    const oldLen = a.events.length;
    expect(host.rematch(1234)).toBe(true);
    expect(host.game!.gid).not.toBe(gid0);
    expect(host.game!.names).toEqual(names);
    expect(host.game!.seed).toBe(1234);
    await until(() => a.rematched && b.rematched && !!a.prompt === (host.referee!.prompt(aSeat) !== null) && a.events.length > 0);
    expect(a.seat).toBe(aSeat); expect(b.seat).toBe(bSeat);
    expect(a.done).toBe(false);
    expect(a.gid).toBe(host.game!.gid);
    expect(a.events.length).toBeLessThan(oldLen);
    expect((a.events[0] as { t: string }).t).toBe('game_start');
    // チャットはそのまま
    expect(a.chat.map((m) => m.text)).toEqual(['よろしく']);
    // 保存は新しい試合に置き換わる（読み込み直すと新しい試合の同じところ）
    const saved = JSON.parse(stores[0].m.get('kiridani.host')!);
    expect(saved.game.gid).toBe(host.game!.gid);
    expect(saved.game.seed).toBe(1234);
    // 1人が抜けると AI が代わる。最後まで遊べて、出来事はホストの記録と同じ
    b.close();
    await until(() => host.referee!.isAway(bSeat));
    await playAll(host, [a]);
    const j = (x: unknown) => JSON.parse(JSON.stringify(x));
    expect(a.events).toEqual(j(host.referee!.logs[aSeat]));
    const again = KdHostRoom.resume(memoryNet(), stores[0])!;
    expect(again.game!.gid).toBe(host.game!.gid);
    expect(again.referee!.scores).toEqual(host.referee!.scores);
    host.close(); again.close(); a.close();
  }, 90000);
});
