// 霧谷の冒険者団：アプリの画面どうしで使う小さな道具（保存・速さ・部屋の購読・問いの安定化・⚙メニュー・チャット）
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChatFloat, ChatSheet, UnreadBadge } from '@midorino/ui/src/kiridani/ui/chat';
import type { AnyPrompt } from './net/kiridaniProtocol';
import { CHAT_STAMPS, type ChatMsg } from './net/chat';

export function load<T>(k: string, d: T): T { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } }
export function save(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 保存できなくても遊べる */ } }
/** 演出の速さ（?speed=minimal などはテスト用） */
export const SPEED = (() => { try { const v = new URLSearchParams(location.search).get('speed'); return v === 'minimal' || v === 'fast' || v === 'normal' ? v : undefined; } catch { return undefined; } })();
export const YEARS: [number, string][] = [[5, '5年'], [10, '10年'], [15, '15年']];

export function useRoom<T extends { subscribe(f: () => void): () => void }>(x: T) {
  const [, setV] = useState(0);
  useEffect(() => x.subscribe(() => setV((v) => v + 1)), [x]);
}

/** 同じ問い（番号が同じ）なら同じものを返す（開いているトレイを閉じない）。game は試合の番号（次の試合では同じ番号の問いも別物） */
export function useStablePrompt(p: AnyPrompt | null, game = ''): AnyPrompt | null {
  const ref = useRef<AnyPrompt | null>(null);
  const gref = useRef(game);
  if (gref.current !== game) { gref.current = game; ref.current = null; }
  if (!p) ref.current = null;
  else if (!ref.current || ref.current.id !== p.id || ref.current.seat !== p.seat) ref.current = p;
  return ref.current;
}

/** 同じ番号・同じ文なら同じものを返す（取引の申し込み・お知らせ） */
export function useStableById<T extends { id: string; text?: string }>(x: T | null): T | null {
  const ref = useRef<T | null>(null);
  if (!x) ref.current = null;
  else if (!ref.current || ref.current.id !== x.id || ref.current.text !== x.text) ref.current = x;
  return ref.current;
}

/** ⚙ のメニュー（オンラインでは「チャット」と未読のしるし） */
export function Menu({ items, chat }: { items: [string, () => void][]; chat?: Chat }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const n = chat?.unread ?? 0;
  return (
    <details className="kd-cat-menu" ref={ref}>
      <summary aria-label={n ? `メニュー（チャットの未読${n}件）` : 'メニュー'}>⚙<UnreadBadge n={n} /></summary>
      <div>
        {chat && <button type="button" className="kd-btn kd-chatbtn" onClick={() => { if (ref.current) ref.current.open = false; chat.setOpen(true); }}>💬 チャット<UnreadBadge n={n} /></button>}
        {items.map(([l, f]) => <button key={l} type="button" className="kd-btn" onClick={f}>{l}</button>)}
      </div>
    </details>
  );
}

// ---------------------------------------------------------------- チャット
export interface Chat { unread: number; setOpen: (o: boolean) => void; node: ReactNode; lobbyButton: ReactNode }
/** チャットの開け閉め・未読・流れる発言。me は色の席（自分の発言は未読に数えない） */
export function useChat(msgs: ChatMsg[], me: number, send: (text: string, stamp: boolean) => Promise<{ ok: boolean; error?: string }>): Chat {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(0);
  const lastId = msgs.at(-1)?.id ?? 0;
  useEffect(() => { if (open) setSeen(lastId); }, [open, lastId]);
  const unread = open ? 0 : msgs.filter((m) => m.id > seen && m.seat !== me).length;
  const close = useCallback(() => setOpen(false), []);
  const node = (
    <>
      <ChatFloat msgs={msgs} me={me} hidden={open} />
      {open && <ChatSheet msgs={msgs} me={me} stamps={CHAT_STAMPS} onSend={send} onClose={close} />}
    </>
  );
  const lobbyButton = <button type="button" className="kd-iconbtn kd-chatbtn" aria-label={unread ? `チャット（未読${unread}件）` : 'チャット'} onClick={() => setOpen(true)}>💬<UnreadBadge n={unread} /></button>;
  return { unread, setOpen, node, lobbyButton };
}

