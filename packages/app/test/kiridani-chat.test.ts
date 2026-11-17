// 霧谷：オンライン対戦のチャット（ホストが受け取り、整えて全員に配る。ゲームの状態・記録には入らない）
import { describe, expect, it } from 'vitest';
import { KdHostRoom } from '../src/net/kiridaniHost';
import { KdGuestClient } from '../src/net/kiridaniGuest';
import { CHAT_KEEP, CHAT_STAMPS, ChatLimiter, sanitizeChat } from '../src/net/chat';
import type { KdToGuest, KdToHost } from '../src/net/kiridaniProtocol';
import { memoryNet } from '../src/net/transport';

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
async function until(ok: () => boolean, ms = 10000) {
  const t0 = Date.now();
  while (!ok()) { if (Date.now() - t0 > ms) throw new Error('timeout'); await tick(1); }
}
function memStore() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); } };
}

async function room(now?: () => number) {
  const net = memoryNet();
  const host = new KdHostRoom(net, 'ホスト', { store: memStore(), now });
  host.open();
  await until(() => host.status === 'open');
  const stores = [memStore(), memStore()];
  const a = new KdGuestClient(net, host.roomId, 'アオイ', { store: stores[0], retryMs: 5 });
  const b = new KdGuestClient(net, host.roomId, 'ベニ', { store: stores[1], retryMs: 5 });
  a.connect(); b.connect();
  await until(() => a.status === 'waiting' && b.status === 'waiting');
  for (const m of host.members.filter((x) => x.status === 'waiting')) host.approve(m.id, true);
  await until(() => a.status === 'joined' && b.status === 'joined');
  return { net, host, a, b, stores };
}

describe('霧谷：チャット', () => {
  it('文字を整える：制御文字・向きを変える文字を除き、空白をまとめ、100文字まで', () => {
    expect(sanitizeChat('  こんにちは\n\tみんな  ')).toBe('こんにちは みんな');
    expect(sanitizeChat('a\u0000b‮c​d')).toBe('a b c d');
    expect(sanitizeChat('<b>太字</b>')).toBe('<b>太字</b>');   // 文字のまま（画面は HTML として解釈しない）
    expect(sanitizeChat('   \n ')).toBeNull();
    expect(sanitizeChat(42)).toBeNull();
    expect([...sanitizeChat('霧'.repeat(150))!].length).toBe(100);
    expect([...sanitizeChat('😀'.repeat(120))!].length).toBe(100);
  });

  it('回数の制限：10秒に5通まで、時間がたてばまた送れる', () => {
    const l = new ChatLimiter();
    for (let i = 0; i < 5; i++) expect(l.allow('a', 1000 + i)).toBe(true);
    expect(l.allow('a', 2000)).toBe(false);
    expect(l.allow('b', 2000)).toBe(true);
    expect(l.allow('a', 11_001)).toBe(true);
  });

  it('メッセージは JSON で行き来する', () => {
    const up: KdToHost = { t: 'chat', reqId: 3, text: 'よろしく！', stamp: true };
    const down: KdToGuest = { t: 'chat', msgs: [{ id: 1, seat: 2, name: 'ベニ', text: 'やあ', at: 123 }], reset: true };
    expect(JSON.parse(JSON.stringify(up))).toEqual(up);
    expect(JSON.parse(JSON.stringify(down))).toEqual(down);
  });

  it('ホスト・参加者の発言が全員に届き、席・名前・ホストの時刻が付く。スタンプはスタンプの言葉だけ', async () => {
    let now = 5_000;
    const { host, a, b } = await room(() => now);
    expect((await a.say('  やあ\nみんな ')).ok).toBe(true);
    now += 100;
    expect(host.hostSay('ようこそ').ok).toBe(true);
    now += 100;
    expect((await b.say(CHAT_STAMPS[0], true)).ok).toBe(true);
    expect((await b.say('自作スタンプ', true)).ok).toBe(true);
    await until(() => a.chat.length === 4 && b.chat.length === 4);
    expect(a.chat).toEqual(host.chat);
    expect(b.chat).toEqual(host.chat);
    expect(host.chat.map((m) => [m.seat, m.name, m.text, m.at, !!m.stamp])).toEqual([
      [1, 'アオイ', 'やあ みんな', 5_000, false],
      [0, 'ホスト', 'ようこそ', 5_100, false],
      [2, 'ベニ', 'よろしく！', 5_200, true],
      [2, 'ベニ', '自作スタンプ', 5_200, false],
    ]);
    expect((await a.say('   ')).ok).toBe(false);
  });

  it('送りすぎると断られ、ほかの人には届かない', async () => {
    let now = 0;
    const { host, a, b } = await room(() => now);
    for (let i = 0; i < 5; i++) expect((await a.say(`連投${i}`)).ok).toBe(true);
    const r = await a.say('6通目');
    expect(r).toEqual({ ok: false, error: '少し待ってから送ってください' });
    expect((await b.say('ぼくは送れる')).ok).toBe(true);
    await until(() => b.chat.length === 6);
    expect(host.chat.map((m) => m.text)).not.toContain('6通目');
    now = 10_001;
    expect((await a.say('また送れる')).ok).toBe(true);
  });

  it('承認待ちの人は話せない・読み込み直した参加者にはこれまでの分が届く・残すのは最後の100件', async () => {
    const { net, host, a, stores } = await room();
    const c = new KdGuestClient(net, host.roomId, 'ミドリ', { store: memStore(), retryMs: 5 });
    c.connect();
    await until(() => c.status === 'waiting');
    expect((await c.say('入れて')).ok).toBe(false);
    host.hostSay('一言目');
    await until(() => a.chat.length === 1);
    expect(c.chat).toEqual([]);
    // 読み込み直し
    a.close();
    host.hostSay('いなかったあいだ');
    const a2 = new KdGuestClient(net, host.roomId, '', { store: stores[0], retryMs: 5 });
    a2.connect();
    await until(() => a2.status === 'joined' && a2.chat.length === 2);
    expect(a2.chat.map((m) => m.text)).toEqual(['一言目', 'いなかったあいだ']);
    // 100件まで
    let t = 0;
    const h2 = new KdHostRoom(memoryNet(), 'ホスト', { store: memStore(), now: () => (t += 3000) });
    for (let i = 0; i < CHAT_KEEP + 20; i++) expect(h2.hostSay(`#${i}`).ok).toBe(true);
    expect(h2.chat.length).toBe(CHAT_KEEP);
    expect(h2.chat[0].text).toBe('#20');
  });

  it('試合中のチャットはゲームの状態・審判の記録を変えない', async () => {
    const { host, a, b } = await room();
    host.start(77);
    await until(() => a.seat >= 0 && b.seat >= 0);
    const ref = host.referee!;
    const before = [ref.log.length, ref.history.length, JSON.stringify(ref.prompt(0))];
    expect((await a.say('がんばろう')).ok).toBe(true);
    host.hostSay('おー');
    await until(() => b.chat.length === 2);
    expect(b.chat.map((m) => m.seat)).toEqual([1, 0]);
    expect([ref.log.length, ref.history.length, JSON.stringify(ref.prompt(0))]).toEqual(before);
  });
});
