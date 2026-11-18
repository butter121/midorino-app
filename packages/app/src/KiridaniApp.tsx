// 霧谷の冒険者団：アプリの入口。
// 大型アップデートで新ルール（v2：年数を選べる・準備段階・段階カード・装備）が標準。旧ルール（v1）もタイトルで選べば今まで通り遊べる。
// タイトル →「ひとりで遊ぶ（AI）」（人数と AI の強さ・新ルールは年数を選んで、あなた＋AI の試合）
//          →「友だちと遊ぶ」（部屋をつくって招待リンク・QR で呼ぶ。招待リンク #join=… を開いた人は参加の画面へ）
// オンラインはミドリノと同じ仕組み：ホストの端末が審判で、参加者は自分の答えだけを送る（net/kiridaniHost.ts・kiridaniGuest.ts）。
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
// 試合の画面（v1・v2）は使うときに読み込む（kdLazy）。ここではタイトル・待合室・チャットの軽い部品だけを直に読む
import { HeroArt } from '@midorino/ui/src/kiridani/art-registry';
import { RoomJoin, RoomLobby, RoomMessage } from '@midorino/ui/src/kiridani/ui/lobby';
import type { Ev } from '@midorino/ui/src/kiridani2/view';
import { KiridaniEngineGame, KiridaniOnlineGame, Kiridani2EngineGame, Kiridani2OnlineGame, preload } from './kdLazy';
import type { Action, Cost, GameEvent, OfferNote, OfferView, Prompt, TradeJudge } from '@midorino/engine/src/kiridani';
import type { Action2, Level as Level2, OfferNote2, OfferView2, Prompt2, TradeJudge as TradeJudge2 } from '@midorino/engine/src/kiridani2';
import '@midorino/ui/src/kiridani/kiridani.css';
import '@midorino/ui/src/kiridani2/kiridani2.css';
import './kiridani-app.css';
import { roomFromHash } from './net/protocol';
import { peerNet } from './net/peerNet';
import { KD_HOST_KEY } from './net/kiridaniProtocol';
import { load, save, SPEED, YEARS, useRoom, useStablePrompt, Menu, useChat } from './kdShared';
import { KdGuestClient } from './net/kiridaniGuest';
import type { AnyAction, KdLevel, KdRules } from './net/kiridaniProtocol';

/** ホストの画面は審判（両方のルールのエンジン）ごと、使うときに読み込む */
const HostScreen = lazy(() => import('./KdHostScreen'));

type Level = KdLevel;
const LEVELS: [Level, string][] = [['novice', 'やさしい'], ['mid', 'ふつう'], ['expert', 'つよい']];
const HEROES = ['toma', 'mina', 'goro', 'nana'];
const YEARS_SUB: Record<number, string> = { 5: '20ラウンド・約40分', 10: '40ラウンド', 15: '60ラウンド' };

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
/** v2 のひとり用の途中の試合（同じ条件で最初から答えを当て直して再開する） */
const SOLO2 = 'kd2.solo';
interface Solo2Save { v: 1; n: number; seed: number; years: number; level: Level; hist: Action2[]; auto?: boolean; at: number }
function loadSolo2(): Solo2Save | null {
  const s = load<Solo2Save | null>(SOLO2, null);
  return s && s.v === 1 && Array.isArray(s.hist) && Number.isInteger(s.n) && Number.isInteger(s.seed) ? s : null;
}
const forgetSolo2 = () => { try { localStorage.removeItem(SOLO2); } catch { /* 無視 */ } };
const LEVEL2: Record<Level, Level2> = { novice: 'novice', mid: 'normal', expert: 'strong' };
const forgetRoom = () => { try { localStorage.removeItem(LAST_ROOM); } catch { /* 無視 */ } };
const clearHash = () => { try { history.replaceState(null, '', location.pathname + location.search); } catch { /* 無視 */ } };

type Mode = { k: 'title' } | { k: 'solo'; resume?: boolean } | { k: 'friends' } | { k: 'host'; resume: boolean } | { k: 'guest'; room: string };

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
  if (mode.k === 'solo') return <Solo rules={mode.resume ? 2 : rules} resume={mode.resume} onBack={toTitle} />;
  if (mode.k === 'friends') return <Friends rules={rules} onBack={toTitle} onHost={(resume) => setMode({ k: 'host', resume })} />;
  if (mode.k === 'host') return <Suspense fallback={<div className="kd-root kda-title" role="status"><p className="kda-sub">部屋を用意しています…</p></div>}><HostScreen resume={mode.resume} onLeave={toTitle} /></Suspense>;
  if (mode.k === 'guest') return <GuestScreen roomId={mode.room} onLeave={toTitle} />;
  const back = unfinished();
  const solo2 = loadSolo2();

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
        {solo2 && <button type="button" className="kd-btn kda-start is-resume" data-kd="resume-solo" onClick={() => setMode({ k: 'solo', resume: true })}>途中の試合にもどる{back ? '（ひとり）' : ''}<small className="kda-resume-sub">{solo2.n}人・{solo2.years}年{solo2.hist.length ? '' : '・始めたところ'}</small></button>}
        {back && <button type="button" className="kd-btn kda-start is-resume" onClick={() => setMode(back)}>途中の試合にもどる{solo2 ? '（友だち）' : ''}</button>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- ひとりで遊ぶ
function Solo({ rules, resume, onBack }: { rules: KdRules; resume?: boolean; onBack: () => void }) {
  const [n, setN] = useState<number>(() => load('kd.n', 4));
  const [level, setLevel] = useState<Level>(() => load('kd.level', 'mid'));
  const [years, setYears] = useState<number>(() => load('kd.years', 5));
  const [saved] = useState(() => (resume ? loadSolo2() : null));
  const [game, setGame] = useState<{ seed: number; key: number; n: number; years: number; level: Level; resume?: Solo2Save } | null>(() => (saved ? { seed: saved.seed, key: Date.now(), n: saved.n, years: saved.years, level: saved.level, resume: saved } : null));
  useEffect(() => { preload(rules); }, [rules]);
  const seatsFor = rules === 2 ? [2, 3, 4, 5, 6] : [3, 4, 5, 6];
  const nn = seatsFor.includes(n) ? n : 4;
  const start = () => {
    save('kd.n', nn); save('kd.level', level); save('kd.years', years);
    const g = { seed: Math.floor(Math.random() * 1e6), key: Date.now(), n: nn, years, level };
    if (rules === 2) save(SOLO2, { v: 1, n: g.n, seed: g.seed, years: g.years, level: g.level, hist: [], at: Date.now() } satisfies Solo2Save);
    setGame(g);
  };
  const g2 = game && rules === 2 ? game : null;
  const onProgress = useCallback((p: { hist: Action2[]; auto: boolean; done: boolean }) => {
    if (!g2) return;
    if (p.done) { forgetSolo2(); return; }
    save(SOLO2, { v: 1, n: g2.n, seed: g2.seed, years: g2.years, level: g2.level, hist: p.hist, auto: p.auto, at: Date.now() } satisfies Solo2Save);
  }, [g2]);

  if (g2) {
    return (
      <Kiridani2EngineGame key={g2.key} n={g2.n} seed={g2.seed} years={g2.years} level={LEVEL2[g2.level] ?? 'normal'} speed={SPEED}
        resume={g2.resume ? { hist: g2.resume.hist, auto: g2.resume.auto } : undefined} onProgress={onProgress}
        extra={({ auto, setAuto }) => (
          <details className="kd-cat-menu">
            <summary aria-label="メニュー">⚙</summary>
            <div>
              <button type="button" className="kd-btn" onClick={() => setAuto(!auto)}>{auto ? '自分で選ぶ' : '自分の席もAIに任せる'}</button>
              <button type="button" className="kd-btn" onClick={start}>新しい試合</button>
              <button type="button" className="kd-btn" onClick={onBack}>タイトルへ（続きはあとで）</button>
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

// ---------------------------------------------------------------- 参加者
function GuestScreen({ roomId, onLeave }: { roomId: string; onLeave: () => void }) {
  const [client] = useState(() => new KdGuestClient(peerNet(), roomId, load('kd.name', '')));
  useRoom(client);
  const [joining, setJoining] = useState(client.known);
  useEffect(() => { if (joining) client.connect(); }, [client, joining]);
  const leave = () => { client.close(); onLeave(); };
  const lobbyRules = client.lobby?.rules ?? client.rules;
  useEffect(() => { if (lobbyRules === 1 || lobbyRules === 2) preload(lobbyRules); }, [lobbyRules]);
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
