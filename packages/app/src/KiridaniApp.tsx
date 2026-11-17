// 霧谷の冒険者団：アプリの入口。
// タイトル →「ひとりで遊ぶ（AI）」（人数と AI の強さを選んで、あなた＋AI の試合）
//          →「友だちと遊ぶ」（部屋をつくって招待リンク・QR で呼ぶ。招待リンク #join=… を開いた人は参加の画面へ）
// オンラインはミドリノと同じ仕組み：ホストの端末が審判で、参加者は自分の答えだけを送る（net/kiridaniHost.ts・kiridaniGuest.ts）。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import qrcode from 'qrcode-generator';
import { KiridaniEngineGame, KiridaniOnlineGame, HeroArt, RoomJoin, RoomLobby, RoomMessage } from '@midorino/ui/src/kiridani';
import type { Action, Cost, Prompt } from '@midorino/engine/src/kiridani';
import '@midorino/ui/src/kiridani/kiridani.css';
import './kiridani-app.css';
import { inviteUrl, roomFromHash } from './net/protocol';
import { peerNet } from './net/peerNet';
import { KdHostRoom, KD_HOST_KEY } from './net/kiridaniHost';
import { KdGuestClient } from './net/kiridaniGuest';
import type { KdLevel } from './net/kiridaniProtocol';

type Level = KdLevel;
const LEVELS: [Level, string][] = [['novice', 'やさしい'], ['mid', 'ふつう'], ['expert', 'つよい']];
const HEROES = ['toma', 'mina', 'goro', 'nana'];

function load<T>(k: string, d: T): T { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } }
function save(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 保存できなくても遊べる */ } }
const hasSavedRoom = () => { try { return !!localStorage.getItem(KD_HOST_KEY); } catch { return false; } };
/** 演出の速さ（?speed=minimal などはテスト用） */
const SPEED = (() => { try { const v = new URLSearchParams(location.search).get('speed'); return v === 'minimal' || v === 'fast' || v === 'normal' ? v : undefined; } catch { return undefined; } })();
const clearHash = () => { try { history.replaceState(null, '', location.pathname + location.search); } catch { /* 無視 */ } };

type Mode = { k: 'title' } | { k: 'solo' } | { k: 'friends' } | { k: 'host'; resume: boolean } | { k: 'guest'; room: string };

export default function KiridaniApp() {
  const [mode, setMode] = useState<Mode>(() => {
    const room = roomFromHash();
    return room ? { k: 'guest', room } : { k: 'title' };
  });
  const toTitle = useCallback(() => { clearHash(); setMode({ k: 'title' }); }, []);
  useEffect(() => {
    const on = () => { const room = roomFromHash(); if (room) setMode({ k: 'guest', room }); };
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);

  if (mode.k === 'solo') return <Solo onBack={toTitle} />;
  if (mode.k === 'friends') return <Friends onBack={toTitle} onHost={(resume) => setMode({ k: 'host', resume })} />;
  if (mode.k === 'host') return <HostScreen resume={mode.resume} onLeave={toTitle} />;
  if (mode.k === 'guest') return <GuestScreen roomId={mode.room} onLeave={toTitle} />;

  return (
    <div className="kd-root kda-title">
      <div className="kda-heroes" aria-hidden="true">
        {HEROES.map((id) => <HeroArt key={id} id={id} size={72} />)}
      </div>
      <h1 className="kda-name">霧谷の冒険者団</h1>
      <p className="kda-sub">霧の谷で仲間を集め、魔物を討ち、名声を競う。</p>
      <div className="kda-modes">
        <button type="button" className="kd-btn kda-start" onClick={() => setMode({ k: 'solo' })}>ひとりで遊ぶ（AI）</button>
        <button type="button" className="kd-btn kda-start is-alt" onClick={() => setMode({ k: 'friends' })}>友だちと遊ぶ</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- ひとりで遊ぶ
function Solo({ onBack }: { onBack: () => void }) {
  const [n, setN] = useState<number>(() => load('kd.n', 4));
  const [level, setLevel] = useState<Level>(() => load('kd.level', 'mid'));
  const [game, setGame] = useState<{ seed: number; key: number } | null>(null);
  const start = () => { save('kd.n', n); save('kd.level', level); setGame({ seed: Math.floor(Math.random() * 1e6), key: Date.now() }); };

  if (game) {
    return (
      <KiridaniEngineGame key={game.key} n={n} seed={game.seed} level={level} speed={SPEED}
        extra={() => (
          <details className="kd-cat-menu">
            <summary aria-label="メニュー">⚙</summary>
            <div>
              <button type="button" className="kd-btn" onClick={start}>新しい試合</button>
              <button type="button" className="kd-btn" onClick={onBack}>タイトルへ</button>
            </div>
          </details>
        )} />
    );
  }
  return (
    <div className="kd-root kda-title">
      <div className="kda-heroes" aria-hidden="true">
        {HEROES.map((id) => <HeroArt key={id} id={id} size={72} />)}
      </div>
      <h1 className="kda-name">ひとりで遊ぶ</h1>
      <fieldset className="kda-group">
        <legend>人数（あなた＋AI）</legend>
        <div className="kda-seg">
          {[3, 4, 5, 6].map((x) => (
            <button key={x} type="button" className={x === n ? 'is-on' : ''} aria-pressed={x === n} onClick={() => setN(x)}>{x}人</button>
          ))}
        </div>
      </fieldset>
      <fieldset className="kda-group">
        <legend>AIの強さ</legend>
        <div className="kda-seg">
          {LEVELS.map(([v, jp]) => (
            <button key={v} type="button" className={v === level ? 'is-on' : ''} aria-pressed={v === level} onClick={() => setLevel(v)}>{jp}</button>
          ))}
        </div>
      </fieldset>
      <div className="kda-modes">
        <button type="button" className="kd-btn kda-start" onClick={start}>冒険をはじめる</button>
        <button type="button" className="kd-btn kda-back" onClick={onBack}>もどる</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 友だちと遊ぶ（部屋をつくる）
function Friends({ onBack, onHost }: { onBack: () => void; onHost: (resume: boolean) => void }) {
  const [name, setName] = useState<string>(() => load('kd.name', ''));
  const saved = useMemo(hasSavedRoom, []);
  const ok = name.trim().length >= 1 && name.trim().length <= 8;
  return (
    <div className="kd-root kd-room kd-join">
      <div className="kd-room-heroes" aria-hidden><HeroArt id="toma" size={64} /><HeroArt id="nana" size={64} /></div>
      <h1>友だちと遊ぶ</h1>
      <p>部屋をつくり、招待リンクか QR コードで呼びます。空いた席は AI が入ります。</p>
      <form onSubmit={(e) => { e.preventDefault(); if (ok) { save('kd.name', name.trim()); onHost(false); } }}>
        <label htmlFor="kd-host-name">あなたの名前（8文字まで）</label>
        <input id="kd-host-name" value={name} maxLength={8} autoComplete="nickname" onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="kd-btn is-primary" disabled={!ok}>部屋をつくる</button>
        {saved && <button type="button" className="kd-btn" onClick={() => onHost(true)}>前の部屋にもどる</button>}
        <small className="kda-hint">友だちの部屋に入るときは、届いた招待リンクを開いてください</small>
      </form>
      <button type="button" className="kd-btn kd-room-back" onClick={onBack}>もどる</button>
    </div>
  );
}

function useRoom<T extends { subscribe(f: () => void): () => void }>(x: T) {
  const [, setV] = useState(0);
  useEffect(() => x.subscribe(() => setV((v) => v + 1)), [x]);
}

/** 同じ問い（番号が同じ）なら同じものを返す（開いているトレイを閉じない） */
function useStablePrompt(p: Prompt | null): Prompt | null {
  const ref = useRef<Prompt | null>(null);
  if (!p) ref.current = null;
  else if (!ref.current || ref.current.id !== p.id || ref.current.seat !== p.seat) ref.current = p;
  return ref.current;
}

function Menu({ items }: { items: [string, () => void][] }) {
  return (
    <details className="kd-cat-menu">
      <summary aria-label="メニュー">⚙</summary>
      <div>{items.map(([l, f]) => <button key={l} type="button" className="kd-btn" onClick={f}>{l}</button>)}</div>
    </details>
  );
}

// ---------------------------------------------------------------- ホスト
function HostScreen({ resume, onLeave }: { resume: boolean; onLeave: () => void }) {
  const [room] = useState(() => (resume && KdHostRoom.resume(peerNet())) || (KdHostRoom.clearSaved(), new KdHostRoom(peerNet(), load('kd.name', 'ホスト'))));
  useRoom(room);
  useEffect(() => { room.open(); }, [room]);
  const [copied, setCopied] = useState(false);
  const url = inviteUrl(room.roomId);
  const qr = useMemo(() => { const q = qrcode(0, 'M'); q.addData(url); q.make(); return q.createSvgTag({ cellSize: 4, margin: 1, scalable: true }); }, [url]);
  const leave = () => { room.close(); onLeave(); };
  const ref = room.referee;
  const seat = room.mySeat;
  const prompt = useStablePrompt(ref && seat >= 0 ? room.prompt(seat) : null);
  const evLen = ref && seat >= 0 ? ref.logs[seat].length : 0;
  const events = useMemo(() => (ref && seat >= 0 ? ref.logs[seat].slice() : []), [ref, seat, evLen]); // eslint-disable-line react-hooks/exhaustive-deps
  const onAct = useCallback((id: string, a: Action) => Promise.resolve(room.hostAct(id, a)), [room]);
  const onJudge = useCallback((b: number, give: Cost, get: Cost) => Promise.resolve(room.hostJudge(b, give, get)), [room]);

  if (!ref || !room.game) {
    const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* コピーできない */ } };
    const share = typeof navigator !== 'undefined' && 'share' in navigator ? () => { navigator.share({ title: '霧谷の冒険者団', text: '一緒に冒険しよう！', url }).catch(() => {}); } : undefined;
    return (
      <RoomLobby inviteUrl={url} qr={<span dangerouslySetInnerHTML={{ __html: qr }} style={{ display: 'contents' }} />} members={room.lobby().members}
        isHost seats={room.seats} level={room.level} copied={copied}
        status={room.status === 'connecting' ? '部屋を開いています…' : room.status === 'error' ? room.error : '招待を待っています'}
        onSeats={(n) => room.setSeats(n)} onLevel={(l) => room.setLevel(l)} onApprove={(id) => room.approve(id, true)} onDecline={(id) => room.approve(id, false)}
        onRemove={(id) => room.kick(id)} onStart={() => room.start()} onCopy={copy} onShare={share} onLeave={leave} />
    );
  }
  const g = room.game;
  const waitFor = ref.waitingSeats();
  const away = room.members.filter((m) => m.status === 'joined' && !m.online && waitFor.includes(g.seats.indexOf(m.id)));
  const banner = away.length ? <><b>{away.map((m) => m.name).join('・')}</b>の接続が切れています（戻るのを待っています）</> : undefined;
  return (
    <KiridaniOnlineGame seat={seat} events={events} prompt={prompt} waitFor={waitFor} names={g.names} onAct={onAct} onJudge={onJudge} banner={banner} speed={SPEED}
      extra={<Menu items={[['部屋を閉じてタイトルへ', leave]]} />} />
  );
}

// ---------------------------------------------------------------- 参加者
function GuestScreen({ roomId, onLeave }: { roomId: string; onLeave: () => void }) {
  const [client] = useState(() => new KdGuestClient(peerNet(), roomId, load('kd.name', '')));
  useRoom(client);
  const [joining, setJoining] = useState(client.known);
  useEffect(() => { if (joining) client.connect(); }, [client, joining]);
  const leave = () => { client.close(); onLeave(); };
  const prompt = useStablePrompt(client.prompt);
  const onAct = useCallback((id: string, a: Action) => client.act(id, a), [client]);
  const onJudge = useCallback((b: number, give: Cost, get: Cost) => client.judge(b, give, get), [client]);

  if (client.status === 'denied') return <RoomMessage title="参加できませんでした" text={client.reason} onBack={leave} />;
  if (client.status === 'closed') return <RoomMessage title="部屋が閉じました" text={client.started ? `${client.reason}。試合はここで終わりです。` : client.reason} onBack={leave} />;
  if (client.started) {
    const banner = client.status === 'offline' ? (client.reason || 'ホストとの接続が切れました。つなぎ直しています…') : undefined;
    return (
      <KiridaniOnlineGame seat={client.seat} events={client.events} prompt={prompt} waitFor={client.wait} names={client.names} onAct={onAct} onJudge={onJudge} banner={banner} speed={SPEED}
        extra={<Menu items={[['部屋を出てタイトルへ', leave]]} />} />
    );
  }
  if (client.status === 'joined' && client.lobby) {
    return <RoomLobby inviteUrl="" members={client.lobby.members} isHost={false} seats={client.lobby.seats} level={client.lobby.level} onLeave={leave} />;
  }
  const status = client.status === 'offline' ? (client.reason || 'ホストにつないでいます…') : client.status === 'waiting' ? 'ホストの承認を待っています…' : 'ホストにつないでいます…';
  return <RoomJoin waiting={joining} status={status} defaultName={client.name} onBack={leave}
    onJoin={(name) => { save('kd.name', name); client.name = name; setJoining(true); }} />;
}
