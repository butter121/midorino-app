// 霧谷の冒険者団：アプリの入口。
// 大型アップデートで新ルール（v2：年数を選べる・準備段階・段階カード・装備）が標準。旧ルール（v1）もタイトルで選べば今まで通り遊べる。
// タイトル →「ひとりで遊ぶ（AI）」（人数と AI の強さ・新ルールは年数を選んで、あなた＋AI の試合）
//          →「友だちと遊ぶ」（部屋をつくって招待リンク・QR で呼ぶ。招待リンク #join=… を開いた人は参加の画面へ）
// オンラインはミドリノと同じ仕組み：ホストの端末が審判で、参加者は自分の答えだけを送る（net/kiridaniHost.ts・kiridaniGuest.ts）。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import qrcode from 'qrcode-generator';
import { ChatFloat, ChatSheet, KiridaniEngineGame, KiridaniOnlineGame, HeroArt, RoomJoin, RoomLobby, RoomMessage, UnreadBadge } from '@midorino/ui/src/kiridani';
import { Kiridani2EngineGame, Kiridani2OnlineGame, type Ev } from '@midorino/ui/src/kiridani2';
import type { Action, Cost, GameEvent, OfferNote, OfferView, Prompt, TradeJudge } from '@midorino/engine/src/kiridani';
import { toLevel2, type Action2, type OfferNote2, type OfferView2, type Prompt2, type TradeJudge as TradeJudge2 } from '@midorino/engine/src/kiridani2';
import '@midorino/ui/src/kiridani/kiridani.css';
import '@midorino/ui/src/kiridani2/kiridani2.css';
import './kiridani-app.css';
import { inviteUrl, roomFromHash } from './net/protocol';
import { peerNet } from './net/peerNet';
import { KdHostRoom, KD_HOST_KEY } from './net/kiridaniHost';
import { KdGuestClient } from './net/kiridaniGuest';
import type { AnyAction, AnyPrompt, KdLevel, KdRules } from './net/kiridaniProtocol';
import { CHAT_STAMPS, type ChatMsg } from './net/chat';
import type { ReactNode } from 'react';

type Level = KdLevel;
const LEVELS: [Level, string][] = [['novice', 'やさしい'], ['mid', 'ふつう'], ['expert', 'つよい']];
const HEROES = ['toma', 'mina', 'goro', 'nana'];
const YEARS: [number, string][] = [[5, '5年'], [10, '10年'], [15, '15年']];
const YEARS_SUB: Record<number, string> = { 5: '20ラウンド・約40分', 10: '40ラウンド', 15: '60ラウンド' };

function load<T>(k: string, d: T): T { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } }
function save(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 保存できなくても遊べる */ } }
const hasSavedRoom = () => { try { return !!localStorage.getItem(KD_HOST_KEY); } catch { return false; } };
/** 途中の試合（ホストなら保存した部屋が始まっている、参加者なら最後に入った試合の部屋） */
const LAST_ROOM = 'kd.lastRoom';
function unfinished(): Mode | null {
  try {
    const h = localStorage.getItem(KD_HOST_KEY);
    if (h && (JSON.parse(h) as { game?: unknown }).game) return { k: 'host', resume: true };
  } catch { /* 無視 */ }
  const room = load<string>(LAST_ROOM, '');
  return room ? { k: 'guest', room } : null;
}
const forgetRoom = () => { try { localStorage.removeItem(LAST_ROOM); } catch { /* 無視 */ } };
/** 演出の速さ（?speed=minimal などはテスト用） */
const SPEED = (() => { try { const v = new URLSearchParams(location.search).get('speed'); return v === 'minimal' || v === 'fast' || v === 'normal' ? v : undefined; } catch { return undefined; } })();
const clearHash = () => { try { history.replaceState(null, '', location.pathname + location.search); } catch { /* 無視 */ } };

type Mode = { k: 'title' } | { k: 'solo' } | { k: 'friends' } | { k: 'host'; resume: boolean } | { k: 'guest'; room: string };

/** ルールの版の選択（新ルールが標準。旧ルールは「旧ルール」で選ぶ） */
function RulesPick({ rules, onRules }: { rules: KdRules; onRules: (r: KdRules) => void }) {
  return (
    <fieldset className="kda-group">
      <legend>ルール</legend>
      <div className="kda-seg kda-rules">
        <button type="button" className={rules === 2 ? 'is-on' : ''} aria-pressed={rules === 2} onClick={() => onRules(2)}>新ルール<small>年数・準備・装備</small></button>
        <button type="button" className={rules === 1 ? 'is-on' : ''} aria-pressed={rules === 1} onClick={() => onRules(1)}>旧ルール<small>3年・天候・ドラフト</small></button>
      </div>
    </fieldset>
  );
}
function YearsPick({ years, onYears }: { years: number; onYears: (y: number) => void }) {
  return (
    <fieldset className="kda-group">
      <legend>試合の長さ（{YEARS_SUB[years]}）</legend>
      <div className="kda-seg">
        {YEARS.map(([y, jp]) => <button key={y} type="button" className={y === years ? 'is-on' : ''} aria-pressed={y === years} onClick={() => onYears(y)}>{jp}</button>)}
      </div>
    </fieldset>
  );
}

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

  const [rules, setRulesState] = useState<KdRules>(() => (load<number>('kd.rules', 2) === 1 ? 1 : 2));
  const setRules = (r: KdRules) => { setRulesState(r); save('kd.rules', r); };
  if (mode.k === 'solo') return <Solo rules={rules} onBack={toTitle} />;
  if (mode.k === 'friends') return <Friends rules={rules} onBack={toTitle} onHost={(resume) => setMode({ k: 'host', resume })} />;
  if (mode.k === 'host') return <HostScreen resume={mode.resume} onLeave={toTitle} />;
  if (mode.k === 'guest') return <GuestScreen roomId={mode.room} onLeave={toTitle} />;
  const back = unfinished();

  return (
    <div className="kd-root kda-title">
      <div className="kda-heroes" aria-hidden="true">
        {HEROES.map((id) => <HeroArt key={id} id={id} size={72} />)}
      </div>
      <h1 className="kda-name">霧谷の冒険者団</h1>
      <p className="kda-sub">霧の谷で仲間を集め、魔物を討ち、名声を競う。</p>
      <RulesPick rules={rules} onRules={setRules} />
      <div className="kda-modes">
        <button type="button" className="kd-btn kda-start" onClick={() => setMode({ k: 'solo' })}>ひとりで遊ぶ（AI）</button>
        <button type="button" className="kd-btn kda-start is-alt" onClick={() => setMode({ k: 'friends' })}>友だちと遊ぶ</button>
        {back && <button type="button" className="kd-btn kda-start is-resume" onClick={() => setMode(back)}>途中の試合にもどる</button>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- ひとりで遊ぶ
function Solo({ rules, onBack }: { rules: KdRules; onBack: () => void }) {
  const [n, setN] = useState<number>(() => load('kd.n', 4));
  const [level, setLevel] = useState<Level>(() => load('kd.level', 'mid'));
  const [years, setYears] = useState<number>(() => load('kd.years', 5));
  const [game, setGame] = useState<{ seed: number; key: number } | null>(null);
  const seatsFor = rules === 2 ? [2, 3, 4, 5, 6] : [3, 4, 5, 6];
  const nn = seatsFor.includes(n) ? n : 4;
  const start = () => { save('kd.n', nn); save('kd.level', level); save('kd.years', years); setGame({ seed: Math.floor(Math.random() * 1e6), key: Date.now() }); };

  if (game && rules === 2) {
    return (
      <Kiridani2EngineGame key={game.key} n={nn} seed={game.seed} years={years} level={toLevel2(level)} speed={SPEED}
        extra={({ auto, setAuto }) => (
          <details className="kd-cat-menu">
            <summary aria-label="メニュー">⚙</summary>
            <div>
              <button type="button" className="kd-btn" onClick={() => setAuto(!auto)}>{auto ? '自分で選ぶ' : '自分の席もAIに任せる'}</button>
              <button type="button" className="kd-btn" onClick={start}>新しい試合</button>
              <button type="button" className="kd-btn" onClick={onBack}>タイトルへ</button>
            </div>
          </details>
        )} />
    );
  }
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
      <small className="kda-hint">{rules === 2 ? '新ルール' : '旧ルール'}（タイトルで切り替え）</small>
      {rules === 2 && <YearsPick years={years} onYears={setYears} />}
      <fieldset className="kda-group">
        <legend>人数（あなた＋AI）</legend>
        <div className="kda-seg">
          {seatsFor.map((x) => (
            <button key={x} type="button" className={x === nn ? 'is-on' : ''} aria-pressed={x === nn} onClick={() => setN(x)}>{x}人</button>
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
function Friends({ rules, onBack, onHost }: { rules: KdRules; onBack: () => void; onHost: (resume: boolean) => void }) {
  const [name, setName] = useState<string>(() => load('kd.name', ''));
  const saved = useMemo(hasSavedRoom, []);
  const ok = name.trim().length >= 1 && name.trim().length <= 8;
  return (
    <div className="kd-root kd-room kd-join">
      <div className="kd-room-heroes" aria-hidden><HeroArt id="toma" size={64} /><HeroArt id="nana" size={64} /></div>
      <h1>友だちと遊ぶ</h1>
      <p>部屋をつくり、招待リンクか QR コードで呼びます。空いた席は AI が入ります。（{rules === 2 ? '新ルール' : '旧ルール'}。部屋の中でも変えられます）</p>
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
function useStablePrompt(p: AnyPrompt | null): AnyPrompt | null {
  const ref = useRef<AnyPrompt | null>(null);
  if (!p) ref.current = null;
  else if (!ref.current || ref.current.id !== p.id || ref.current.seat !== p.seat) ref.current = p;
  return ref.current;
}

/** 同じ番号・同じ文なら同じものを返す（取引の申し込み・お知らせ） */
function useStableById<T extends { id: string; text?: string }>(x: T | null): T | null {
  const ref = useRef<T | null>(null);
  if (!x) ref.current = null;
  else if (!ref.current || ref.current.id !== x.id || ref.current.text !== x.text) ref.current = x;
  return ref.current;
}

/** ⚙ のメニュー（オンラインでは「チャット」と未読のしるし） */
function Menu({ items, chat }: { items: [string, () => void][]; chat?: Chat }) {
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
interface Chat { unread: number; setOpen: (o: boolean) => void; node: ReactNode; lobbyButton: ReactNode }
/** チャットの開け閉め・未読・流れる発言。me は色の席（自分の発言は未読に数えない） */
function useChat(msgs: ChatMsg[], me: number, send: (text: string, stamp: boolean) => Promise<{ ok: boolean; error?: string }>): Chat {
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

// ---------------------------------------------------------------- ホスト
function HostScreen({ resume, onLeave }: { resume: boolean; onLeave: () => void }) {
  const [room] = useState(() => (resume && KdHostRoom.resume(peerNet())) || (KdHostRoom.clearSaved(), new KdHostRoom(peerNet(), load('kd.name', 'ホスト'), { rules: load<number>('kd.rules', 2) === 1 ? 1 : 2, years: load('kd.years', 5) })));
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
  const onAct = useCallback((id: string, a: AnyAction) => Promise.resolve(room.hostAct(id, a)), [room]);
  const hostOffer = useStableById(ref && seat >= 0 ? room.offerFor(seat) : null);
  const hostNote = useStableById(ref && seat >= 0 ? room.noteFor(seat) : null);
  const onJudge = useCallback((b: number, give: Cost, get: Cost) => Promise.resolve(room.hostJudge(b, give, get)), [room]);
  const chat = useChat(room.chat, 0, useCallback((t: string, st: boolean) => Promise.resolve(room.hostSay(t, st)), [room]));

  if (!ref || !room.game) {
    const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* コピーできない */ } };
    const share = typeof navigator !== 'undefined' && 'share' in navigator ? () => { navigator.share({ title: '霧谷の冒険者団', text: '一緒に冒険しよう！', url }).catch(() => {}); } : undefined;
    return (
      <>
      <RoomLobby inviteUrl={url} qr={<span dangerouslySetInnerHTML={{ __html: qr }} style={{ display: 'contents' }} />} members={room.lobby().members}
        isHost seats={room.seats} level={room.level} copied={copied}
        status={room.status === 'connecting' ? '部屋を開いています…' : room.status === 'error' ? room.error : '招待を待っています'}
        onSeats={(n) => room.setSeats(n)} onLevel={(l) => room.setLevel(l)} onApprove={(id) => room.approve(id, true)} onDecline={(id) => room.approve(id, false)}
        onRemove={(id) => room.kick(id)} onStart={() => room.start()} onCopy={copy} onShare={share} onLeave={leave} extra={chat.lobbyButton}
        seatOptions={room.rules === 2 ? [2, 3, 4, 5, 6] : [3, 4, 5, 6]}
        settings={<>
          <div className="kd-room-seg" role="radiogroup" aria-label="ルール">
            {([[2, '新ルール'], [1, '旧ルール']] as [KdRules, string][]).map(([r, jp]) => <button key={r} type="button" role="radio" aria-checked={room.rules === r} className={room.rules === r ? 'is-on' : ''} onClick={() => { room.setRules(r); save('kd.rules', r); }}>{jp}</button>)}
          </div>
          {room.rules === 2 && <div className="kd-room-seg" role="radiogroup" aria-label="年数">
            {YEARS.map(([y, jp]) => <button key={y} type="button" role="radio" aria-checked={room.years === y} className={room.years === y ? 'is-on' : ''} onClick={() => { room.setYears(y); save('kd.years', y); }}>{jp}</button>)}
          </div>}
        </>} />
      {chat.node}
    </>
    );
  }
  const g = room.game;
  const offer = hostOffer; const note = hostNote;
  const waitFor = ref.waitingSeats();
  const dropping = room.dropping;
  const banner = dropping.length ? <><b>{dropping.join('・')}</b>の接続が切れました（戻らなければ、少ししてAIが代わりに動かします）</> : undefined;
  const awayNames = ref.away.map((x) => g.names[x]);
  const menu = <Menu chat={chat} items={[['部屋を閉じてタイトルへ', leave]]} />;
  return (
    <>
    {g.rules === 2
      ? <Kiridani2OnlineGame seat={seat} events={events as Ev[]} prompt={prompt as Prompt2 | null} waitFor={waitFor} names={g.names} onAct={onAct as (id: string, a: Action2) => Promise<{ ok: true } | { ok: false; error: string }>}
        onJudge={onJudge as (b: number, give: Cost, get: Cost) => Promise<TradeJudge2>} banner={banner} away={awayNames} speed={SPEED} offer={offer as OfferView2 | null} note={note as OfferNote2 | null} extra={menu} />
      : <KiridaniOnlineGame seat={seat} events={events as GameEvent[]} prompt={prompt as Prompt | null} waitFor={waitFor} names={g.names} onAct={onAct as (id: string, a: Action) => Promise<{ ok: true } | { ok: false; error: string }>}
        onJudge={onJudge as (b: number, give: Cost, get: Cost) => Promise<TradeJudge>} banner={banner} away={awayNames} speed={SPEED} offer={offer as OfferView | null} note={note as OfferNote | null} extra={menu} />}
    {chat.node}
    </>
  );
}

// ---------------------------------------------------------------- 参加者
function GuestScreen({ roomId, onLeave }: { roomId: string; onLeave: () => void }) {
  const [client] = useState(() => new KdGuestClient(peerNet(), roomId, load('kd.name', '')));
  useRoom(client);
  const [joining, setJoining] = useState(client.known);
  useEffect(() => { if (joining) client.connect(); }, [client, joining]);
  const leave = () => { client.close(); onLeave(); };
  const quit = () => { forgetRoom(); leave(); };
  const prompt = useStablePrompt(client.prompt);
  // 途中の試合を覚えておく（終わった・閉じた・断られたら忘れる）
  useEffect(() => {
    if (client.status === 'denied' || client.status === 'closed' || client.done) forgetRoom();
    else if (client.started) save(LAST_ROOM, roomId);
  }, [client.status, client.done, client.started, roomId]); // eslint-disable-line react-hooks/exhaustive-deps
  const onAct = useCallback((id: string, a: AnyAction) => client.act(id, a), [client]);
  const onJudge = useCallback((b: number, give: Cost, get: Cost) => client.judge(b, give, get), [client]);
  // 色の席：始まったら自分の席、待合室では参加者の並び順（始まったあとの席と同じ）
  const humans = client.lobby?.members.filter((m) => m.status === 'host' || m.status === 'joined') ?? [];
  const mySeat = client.started ? client.seat : humans.findIndex((m) => m.id === client.memberId);
  const chat = useChat(client.chat, mySeat, useCallback((t: string, st: boolean) => client.say(t, st), [client]));

  if (client.status === 'denied') return <RoomMessage title="参加できませんでした" text={client.reason} onBack={quit} />;
  if (client.status === 'closed') return <RoomMessage title="部屋が閉じました" text={client.started ? `${client.reason}。試合はここで終わりです。` : client.reason} onBack={quit} />;
  if (client.started) {
    const lb = client.lobby;
    // 席の番号は、参加者の並び（ホスト → 参加した順）と同じ
    const away = lb?.away ?? [];
    const awayNames = away.filter((x) => x !== client.seat).map((x) => client.names[x]);
    const notAway = client.status === 'offline' ? [] : humans.map((m, i) => (m.status === 'joined' && !m.online && i !== client.seat && !away.includes(i) ? client.names[i] ?? m.name : '')).filter(Boolean);
    const banner = client.status === 'offline' ? (client.reason || 'ホストとの接続が切れました。つなぎ直しています…')
      : notAway.length ? <><b>{notAway.join('・')}</b>の接続が切れました（戻らなければ、少ししてAIが代わりに動かします）</> : undefined;
    const menu = <Menu chat={chat} items={client.done ? [['タイトルへ', quit]] : [['いったん退室する（AIが代わりに動かします）', leave]]} />;
    return (
      <>
      {client.rules === 2
        ? <Kiridani2OnlineGame seat={client.seat} events={client.events as Ev[]} prompt={prompt as Prompt2 | null} waitFor={client.wait} names={client.names} onAct={onAct as (id: string, a: Action2) => Promise<{ ok: true } | { ok: false; error: string }>}
          onJudge={onJudge as (b: number, give: Cost, get: Cost) => Promise<TradeJudge2>} banner={banner} away={awayNames} speed={SPEED} offer={client.offer as OfferView2 | null} note={client.note as OfferNote2 | null} extra={menu} />
        : <KiridaniOnlineGame seat={client.seat} events={client.events as GameEvent[]} prompt={prompt as Prompt | null} waitFor={client.wait} names={client.names} onAct={onAct as (id: string, a: Action) => Promise<{ ok: true } | { ok: false; error: string }>}
          onJudge={onJudge as (b: number, give: Cost, get: Cost) => Promise<TradeJudge>} banner={banner} away={awayNames} speed={SPEED} offer={client.offer as OfferView | null} note={client.note as OfferNote | null} extra={menu} />}
      {chat.node}
      </>
    );
  }
  if (client.status === 'joined' && client.lobby) {
    const lb = client.lobby;
    const rulesNote = <p className="kd-room-note">ルール：<b>{lb.rules === 2 ? `新ルール・${lb.years ?? 5}年` : '旧ルール'}</b></p>;
    return <><RoomLobby inviteUrl="" members={lb.members} isHost={false} seats={lb.seats} level={lb.level} onLeave={leave} extra={chat.lobbyButton} settings={rulesNote} />{chat.node}</>;
  }
  const status = client.status === 'offline' ? (client.reason || 'ホストにつないでいます…') : client.status === 'waiting' ? 'ホストの承認を待っています…' : 'ホストにつないでいます…';
  return <RoomJoin waiting={joining} status={status} defaultName={client.name} onBack={leave}
    onJoin={(name) => { save('kd.name', name); client.name = name; setJoining(true); }} />;
}
