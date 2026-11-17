// 霧谷：オンライン対戦のチャット。
//   ・ChatSheet：発言の一覧（新しいものが下に入り、古いものは上へ流れる）・ひと言スタンプ・入力欄
//   ・ChatFloat：チャットを閉じているあいだ、届いた発言を盤面の上に下から流し、上へ漂わせて消す（最大4行。押せる所はふさがない）
// 文字はすべて React の文字として出す（HTML として解釈しない）。
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { SEAT_COLORS, Token } from './parts';
import './chat.css';

export interface ChatLine { id: number; seat: number; name: string; text: string; at: number; stamp?: boolean }

const hhmm = (t: number) => { const d = new Date(t); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
const SHOW = 20;

/** スマホの画面キーボードが出たとき、見えている範囲に合わせる */
function useVisualViewport() {
  const [vv, setVv] = useState<{ h: number; top: number } | null>(null);
  useEffect(() => {
    const v = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!v) return;
    const on = () => setVv(Math.abs(v.height - window.innerHeight) > 40 || v.offsetTop > 0 ? { h: v.height, top: v.offsetTop } : null);
    on();
    v.addEventListener('resize', on); v.addEventListener('scroll', on);
    return () => { v.removeEventListener('resize', on); v.removeEventListener('scroll', on); };
  }, []);
  return vv;
}

export function ChatSheet({ msgs, me, stamps, onSend, onClose }: {
  msgs: ChatLine[]; me: number; stamps: string[];
  onSend: (text: string, stamp: boolean) => Promise<{ ok: boolean; error?: string }>;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [all, setAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);
  const firstId = useRef(msgs.at(-1)?.id ?? 0);
  const vv = useVisualViewport();
  const shown = all ? msgs : msgs.slice(-SHOW);

  // いつも一番下（新しい発言）を見せる
  useLayoutEffect(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight; }, [msgs.length, all]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [onClose]);

  const send = async (t: string, stamp: boolean) => {
    if (!t.trim() || busy) return;
    setBusy(true); setErr('');
    const r = await onSend(t, stamp);
    setBusy(false);
    if (r.ok) { if (!stamp) setText(''); } else setErr(r.error ?? '送れませんでした');
  };

  return (
    <div className="kd-root kd-chatwrap" style={vv ? { height: `${vv.h}px`, top: `${vv.top}px`, bottom: 'auto' } : undefined}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="kd-chat" role="dialog" aria-label="チャット">
        <header className="kd-chat-h">
          <strong>チャット</strong>
          <button type="button" className="kd-iconbtn kd-chat-x" onClick={onClose} aria-label="チャットを閉じる">×</button>
        </header>
        <ol className="kd-chatlist" ref={listRef} aria-live="polite">
          {!all && msgs.length > SHOW && <li className="kd-chat-more"><button type="button" onClick={() => setAll(true)}>もっと見る（{msgs.length - SHOW}件）</button></li>}
          {!shown.length && <li className="kd-chat-empty">まだ発言はありません。ひと言どうぞ</li>}
          {shown.map((m) => (
            <li key={m.id} className={`kd-chatline${m.seat === me ? ' is-me' : ''}${m.stamp ? ' is-stamp' : ''}${m.id > firstId.current ? ' is-new' : ''}`} style={{ ['--seat' as string]: SEAT_COLORS[m.seat] ?? '#999' }}>
              <span className="kd-chat-who"><Token seat={m.seat >= 0 ? m.seat : 0} size={14} /><b>{m.seat === me ? 'あなた' : m.name}</b><time>{hhmm(m.at)}</time></span>
              <span className="kd-chat-text">{m.text}</span>
            </li>
          ))}
        </ol>
        <div className="kd-chat-stamps" role="group" aria-label="ひと言スタンプ">
          {stamps.map((s) => <button key={s} type="button" disabled={busy} onClick={() => send(s, true)}>{s}</button>)}
        </div>
        <form className="kd-chat-in" onSubmit={(e) => { e.preventDefault(); send(text, false); }}>
          <input value={text} maxLength={100} onChange={(e) => setText(e.target.value)} placeholder="メッセージ（100文字まで）" aria-label="メッセージ" enterKeyHint="send" autoComplete="off" />
          <button type="submit" className="kd-btn is-primary" disabled={!text.trim() || busy}>送る</button>
        </form>
        {err && <p className="kd-chat-err" role="alert">{err}</p>}
      </section>
    </div>
  );
}

/** チャットを閉じているあいだに届いた発言を、下から流して消す */
export function ChatFloat({ msgs, me, hidden }: { msgs: ChatLine[]; me: number; hidden?: boolean }) {
  const [lines, setLines] = useState<ChatLine[]>([]);
  const last = useRef(msgs.at(-1)?.id ?? 0);
  const [bottom, setBottom] = useState(96);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    const add = msgs.filter((m) => m.id > last.current && m.seat !== me);
    last.current = Math.max(last.current, msgs.at(-1)?.id ?? 0);
    if (!add.length || hidden) return;
    // 下の欄（置く場所のボタン）より上に出す
    const bar = typeof document !== 'undefined' ? document.querySelector('.kd-mybar') : null;
    setBottom(bar ? Math.max(16, innerHeight - bar.getBoundingClientRect().top + 8) : 96);
    setLines((ls) => [...ls, ...add].slice(-4));
    const ids = add.map((m) => m.id);
    timers.current.push(setTimeout(() => setLines((ls) => ls.filter((l) => !ids.includes(l.id))), 5200));
  }, [msgs, me, hidden]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  if (hidden || !lines.length) return null;
  return (
    <div className="kd-chatfloat" style={{ bottom }} aria-hidden>
      {lines.map((m) => (
        <div key={m.id} className={`kd-chatfloat-l${m.stamp ? ' is-stamp' : ''}`} style={{ ['--seat' as string]: SEAT_COLORS[m.seat] ?? '#999' }}>
          <b>{m.name}</b>{m.text}
        </div>
      ))}
    </div>
  );
}

/** 未読の数のしるし */
export function UnreadBadge({ n }: { n: number }) {
  if (!n) return null;
  return <span className="kd-unread" aria-label={`未読${n}件`}>{n > 9 ? '9+' : n}</span>;
}
