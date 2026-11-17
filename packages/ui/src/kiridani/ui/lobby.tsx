// 霧谷：オンライン対戦の部屋（ホストの待合室・参加者の入口）。ミドリノの Lobby / JoinScreen と同じ流れを霧谷の見た目で。
import { useState, type ReactNode } from 'react';
import { HeroArt } from '../art-registry';
import { SEAT_COLORS, Token } from './parts';
import './room.css';

export interface RoomMember { id: string; name: string; status: 'host' | 'joined' | 'waiting' | 'ai'; online: boolean }
export type AILevel = 'novice' | 'mid' | 'expert';
export const AI_LEVELS: [AILevel, string][] = [['novice', 'やさしい'], ['mid', 'ふつう'], ['expert', 'つよい']];

export interface RoomLobbyProps {
  inviteUrl: string;
  qr?: ReactNode;
  members: RoomMember[];
  isHost: boolean;
  /** 席の数（人間＋AI） */
  seats: number;
  level: AILevel;
  /** 接続の状態（「部屋を開いています…」など） */
  status?: string;
  onSeats?: (n: number) => void;
  onLevel?: (l: AILevel) => void;
  onApprove?: (id: string) => void;
  onDecline?: (id: string) => void;
  onRemove?: (id: string) => void;
  onStart?: () => void;
  onCopy?: () => void;
  onShare?: () => void;
  onLeave?: () => void;
  copied?: boolean;
}

/** 待合室：招待（QR・リンク）、参加申請の承認、席の数と AI の強さ、開始 */
export function RoomLobby({ inviteUrl, qr, members, isHost, seats, level, status, onSeats, onLevel, onApprove, onDecline, onRemove, onStart, onCopy, onShare, onLeave, copied }: RoomLobbyProps) {
  const humans = members.filter((m) => m.status === 'host' || m.status === 'joined');
  const waiting = members.filter((m) => m.status === 'waiting');
  const ai = Math.max(0, seats - humans.length);
  const rows: { key: string; name: string; tag?: string; seat: number; m?: RoomMember }[] = [
    ...humans.map((m, i) => ({ key: m.id, name: m.name, tag: m.status === 'host' ? 'ホスト' : m.online ? undefined : '接続切れ', seat: i, m })),
    ...Array.from({ length: ai }, (_, i) => ({ key: `ai${i}`, name: `AI（${AI_LEVELS.find((x) => x[0] === level)?.[1]}）`, tag: 'AI', seat: humans.length + i })),
  ];
  return (
    <div className="kd-root kd-room kd-lobby">
      <header className="kd-room-h">
        <button type="button" className="kd-iconbtn" onClick={onLeave} aria-label="部屋を出る">←</button>
        <h1>{isHost ? 'あなたの部屋' : '部屋で待っています'}</h1>
        {status && <small role="status">{status}</small>}
      </header>
      {isHost && (
        <section className="kd-room-inv" aria-label="招待">
          <div className="kd-room-qr">{qr ?? <span aria-hidden>QR</span>}</div>
          <div className="kd-room-invb">
            <h2>友だちを招待</h2>
            <p className="kd-room-url">{inviteUrl}</p>
            <div className="kd-room-btns">
              <button type="button" className="kd-btn" onClick={onCopy}>{copied ? 'コピーしました' : 'リンクをコピー'}</button>
              {onShare && <button type="button" className="kd-btn" onClick={onShare}>共有…</button>}
            </div>
            <small>リンクを開くと参加申請が届きます</small>
          </div>
        </section>
      )}
      <section className="kd-room-mem" aria-label="席">
        {waiting.length > 0 && (
          <ul className="kd-room-wait" aria-label="参加申請">
            {waiting.map((m) => (
              <li key={m.id}><span><b>{m.name}</b>さんが参加したい</span>
                {isHost && <span className="kd-room-btns"><button type="button" className="kd-btn is-primary" onClick={() => onApprove?.(m.id)}>承認</button><button type="button" className="kd-btn" onClick={() => onDecline?.(m.id)}>断る</button></span>}
              </li>
            ))}
          </ul>
        )}
        <h2>席 {rows.length}<small>（人 {humans.length}・AI {ai}）</small></h2>
        <ul className="kd-room-seats">
          {rows.map((r) => (
            <li key={r.key} className={r.m && !r.m.online ? 'is-off' : ''} style={{ ['--seat' as string]: SEAT_COLORS[r.seat] }}>
              <Token seat={r.seat} size={18} /><b>{r.name}</b>{r.tag && <em>{r.tag}</em>}
              {isHost && r.m && r.m.status === 'joined' && <button type="button" className="kd-room-x" aria-label={`${r.name}を外す`} onClick={() => onRemove?.(r.m!.id)}>×</button>}
            </li>
          ))}
        </ul>
        {isHost ? (
          <div className="kd-room-set">
            <div className="kd-room-seg" role="radiogroup" aria-label="席の数">
              {[3, 4, 5, 6].map((x) => (
                <button key={x} type="button" role="radio" aria-checked={x === seats} className={x === seats ? 'is-on' : ''} disabled={x < humans.length} onClick={() => onSeats?.(x)}>{x}人</button>
              ))}
            </div>
            <div className="kd-room-seg" role="radiogroup" aria-label="AIの強さ">
              {AI_LEVELS.map(([v, jp]) => (
                <button key={v} type="button" role="radio" aria-checked={v === level} className={v === level ? 'is-on' : ''} onClick={() => onLevel?.(v)}>{jp}</button>
              ))}
            </div>
            <button type="button" className="kd-btn is-primary kd-room-start" onClick={onStart} disabled={humans.length > seats}>冒険をはじめる{ai ? `（空き${ai}席はAI）` : ''}</button>
          </div>
        ) : <p className="kd-room-note" role="status">ホストが始めるのを待っています…</p>}
      </section>
    </div>
  );
}

/** 参加する人の入口：名前を入れて申請 → 承認待ち */
export function RoomJoin({ waiting, error, status, onJoin, onBack, defaultName = '' }: {
  waiting?: boolean; error?: string; status?: string; onJoin: (name: string) => void; onBack?: () => void; defaultName?: string;
}) {
  const [name, setName] = useState(defaultName);
  const ok = name.trim().length >= 1 && name.trim().length <= 8;
  return (
    <div className="kd-root kd-room kd-join">
      <div className="kd-room-heroes" aria-hidden><HeroArt id="mina" size={64} /><HeroArt id="goro" size={64} /></div>
      <h1>霧谷の冒険者団</h1>
      <p>友だちの部屋に参加します</p>
      {waiting ? (
        <p className="kd-room-note" role="status">{status ?? 'ホストの承認を待っています…'}</p>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); if (ok) onJoin(name.trim()); }}>
          <label htmlFor="kd-nick">あなたの名前（8文字まで）</label>
          <input id="kd-nick" value={name} maxLength={8} autoComplete="nickname" onChange={(e) => setName(e.target.value)} />
          {error && <p className="kd-bad" role="alert">{error}</p>}
          <button type="submit" className="kd-btn is-primary" disabled={!ok}>参加を申し込む</button>
        </form>
      )}
      {waiting && error && <p className="kd-bad" role="alert">{error}</p>}
      {onBack && <button type="button" className="kd-btn kd-room-back" onClick={onBack}>タイトルへ</button>}
    </div>
  );
}

/** 部屋が閉じた・断られたなどの知らせ */
export function RoomMessage({ title, text, onBack }: { title: string; text?: string; onBack: () => void }) {
  return (
    <div className="kd-root kd-room kd-join">
      <h1>{title}</h1>
      {text && <p>{text}</p>}
      <button type="button" className="kd-btn is-primary" onClick={onBack}>タイトルへ</button>
    </div>
  );
}
