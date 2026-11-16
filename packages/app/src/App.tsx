import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ACT, GOODS, JP, MARKET_SPACES, RES, SEASONS,
  buyPrice, feedNeed, legal, marketBuyLimit, score, sellPrice, sellValue, sheepPerPlot, validateMarket,
  type Command, type Cost, type GameState, type Good, type Level, type MatchView, type Opt, type Player, type Res, type Seat, type SellBuy,
} from '@midorino/engine';
import {
  ActionBar, ActionBoard, Button, PlacementFx, type PlacedMove, Lobby, JoinScreen, DraftScreen, TradeComposer, TradeOfferCard,
  OptionPicker, MarketForm, EventLog, ResultScreen, type LobbyMember, CharacterCard, GameLayout, Icon, ImprovementCard, MarketPanel, MyPanel,
  PlayerStrip, PlayersOverview, StatusBar, Tabs, Worker, spaceEffect, type Alert, type SpaceView,
} from '@midorino/ui';
import qrcode from 'qrcode-generator';
import { viewFor, type Result } from '@midorino/engine';
import { LocalHost } from './host';
import { HostRoom } from './net/hostRoom';
import { GuestClient } from './net/guestClient';
import { inviteUrl, roomFromHash } from './net/protocol';
import { SEAT_COLORS, charName, costText, optLabel, weatherName } from './labels';

const ME = 0;   // 1台版では自分は「人間の席」。席順はランダムなので seatOf で探す

type Mode =
  | { kind: 'home' }
  | { kind: 'local'; host: LocalHost }
  | { kind: 'host'; room: HostRoom }
  | { kind: 'guest'; client: GuestClient };

function initialMode(): Mode {
  const join = roomFromHash();
  if (join) {
    const name = savedName();
    if (name) { const c = new GuestClient(join, name); c.connect(); return { kind: 'guest', client: c }; }
    return { kind: 'home' };
  }
  return { kind: 'home' };
}
function savedName() { try { return localStorage.getItem('midorino.name') ?? ''; } catch { return ''; } }
function saveName(n: string) { try { localStorage.setItem('midorino.name', n); } catch { /* 無視 */ } }

export default function App() {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);
  useEffect(() => {
    if (mode.kind === 'host') return mode.room.subscribe(refresh);
    if (mode.kind === 'guest') return mode.client.subscribe(refresh);
  }, [mode]);
  const goHome = () => { history.replaceState(null, '', location.pathname); setMode({ kind: 'home' }); };

  if (mode.kind === 'home') return <><RotateHint /><Home onMode={setMode} /></>;

  if (mode.kind === 'local') {
    const host = mode.host;
    const me = host.m.seats.findIndex((s) => !s.ai);
    const view = host.view(me < 0 ? ME : me);
    const send = async (cmd: Command) => { const r = host.send(view.you, cmd); refresh(); return r; };
    const quit = () => { if (confirm('このゲームをやめてトップに戻りますか？')) { LocalHost.clear(); goHome(); } };
    return <Play view={view} send={send} onQuit={quit} onBack={() => { LocalHost.clear(); goHome(); }} />;
  }

  if (mode.kind === 'host') {
    const room = mode.room;
    const quit = () => { if (confirm('部屋を閉じてトップに戻りますか？（参加者の接続も切れます）')) { room.close(); HostRoom.clear(); goHome(); } };
    if (!room.match) return <><RotateHint /><HostLobby room={room} onQuit={quit} /></>;
    const view = viewFor(room.match, room.mySeat);
    const send = async (cmd: Command) => room.command(room.me.id, cmd);
    return <Play view={view} send={send} onQuit={quit} onBack={() => { room.close(); HostRoom.clear(); goHome(); }} />;
  }

  const c = mode.client;
  const leave = () => { if (confirm('部屋から抜けますか？')) { c.close(); goHome(); } };
  if (c.view && c.status !== 'denied') {
    return (
      <>
        {c.status === 'offline' && <div className="netbar">{c.reason}</div>}
        <Play view={c.view} send={(cmd) => c.send(cmd)} onQuit={leave} onBack={() => { c.close(); goHome(); }} />
      </>
    );
  }
  return <><RotateHint /><GuestWaiting client={c} onLeave={() => { c.close(); goHome(); }} /></>;
}

function Play({ view, send, onQuit, onBack }: { view: MatchView; send: (c: Command) => Promise<Result>; onQuit: () => void; onBack: () => void }) {
  return (
    <>
      {view.phase !== 'work' && <RotateHint />}
      {view.phase === 'draft' && <Draft view={view} send={send} />}
      {view.phase === 'work' && <Game view={view} send={send} onQuit={onQuit} />}
      {view.phase === 'over' && view.result && <ResultScreen names={view.seats.map((s) => s.name)} scores={view.result.scores} ranking={view.result.ranking} you={view.you} onAgain={onBack} />}
    </>
  );
}

// ------------------------------------------------------------ トップ
function Home({ onMode }: { onMode: (m: Mode) => void }) {
  const join = roomFromHash();
  const [name, setName] = useState(savedName);
  const nick = () => { const n = name.trim().slice(0, 12) || 'あなた'; saveName(n); return n; };
  const resumeHost = useMemo(() => HostRoom.resume(), []);
  const resumeLocal = useMemo(() => LocalHost.load(), []);
  if (join) {
    return <JoinScreen defaultName={name.slice(0, 8)} onJoin={(n) => { saveName(n); const c = new GuestClient(join, n); c.connect(); onMode({ kind: 'guest', client: c }); }} />;
  }
  return (
    <div className="lobby">
      <h1>ミドリノ谷の四季</h1>
      <label>ニックネーム<input value={name} maxLength={12} onChange={(e) => setName(e.target.value)} placeholder="ほかの人に表示される名前" /></label>
      {resumeHost && (
        <button className="primary big" onClick={() => { const r = HostRoom.resume()!; r.open(); onMode({ kind: 'host', room: r }); }}>
          {resumeHost.match ? '中断したオンライン対戦を再開する' : '作った部屋に戻る'}
        </button>
      )}
      <button className={resumeHost ? 'big' : 'primary big'} onClick={() => {
        HostRoom.clear(); const r = new HostRoom(nick()); r.open(); onMode({ kind: 'host', room: r });
      }}>友だちと遊ぶ（部屋を作る）</button>
      <LocalStart onStart={(seats) => onMode({ kind: 'local', host: LocalHost.create(seats) })} nick={nick} />
      {resumeLocal && <button onClick={() => onMode({ kind: 'local', host: LocalHost.load()! })}>中断した1人用ゲームを続ける</button>}
      <p className="muted small">友だちは、部屋を作った人から届く招待リンクを開くと参加できます。</p>
    </div>
  );
}

function LocalStart({ onStart, nick }: { onStart: (s: Seat[]) => void; nick: () => string }) {
  const [open, setOpen] = useState(false);
  const [n, setN] = useState(4);
  const [level, setLevel] = useState<Level>('mid');
  if (!open) return <button className="big" onClick={() => setOpen(true)}>AIと1台で遊ぶ</button>;
  const names = ['ハナ', 'ソウタ', 'ユイ', 'ケン', 'ミオ'];
  return (
    <div className="box">
      <label>人数<div className="seg">{[3, 4, 5, 6].map((k) => <button key={k} className={k === n ? 'on' : ''} onClick={() => setN(k)}>{k}人</button>)}</div></label>
      <label>AIの強さ<div className="seg">{([['novice', 'やさしい'], ['mid', 'ふつう'], ['expert', 'つよい']] as [Level, string][]).map(([k, t]) =>
        <button key={k} className={k === level ? 'on' : ''} onClick={() => setLevel(k)}>{t}</button>)}</div></label>
      <button className="primary big" onClick={() => onStart([{ name: nick(), ai: null }, ...names.slice(0, n - 1).map((nm) => ({ name: `${nm}（AI）`, ai: level }))])}>ゲームを始める</button>
    </div>
  );
}

// ------------------------------------------------------------ ホストのロビー
function lobbyMembers(members: { id: string; name: string; status: LobbyMember['status']; online?: boolean }[]): LobbyMember[] {
  return members.map((m) => ({ id: m.id, name: m.name, status: m.status, online: m.online }));
}

function HostLobby({ room, onQuit }: { room: HostRoom; onQuit: () => void }) {
  const url = inviteUrl(room.roomId);
  const qr = useMemo(() => { const q = qrcode(0, 'M'); q.addData(url); q.make(); return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); }, [url]);
  const [msg, setMsg] = useState('');
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'ミドリノ谷の四季', text: '一緒に遊ぼう！', url });
      else { await navigator.clipboard.writeText(url); setMsg('リンクをコピーしました'); }
    } catch { /* キャンセル */ }
  };
  return (
    <>
      {room.status !== 'open' && <div className="netbar">{room.status === 'error' ? `部屋を開けませんでした：${room.error}` : '部屋を準備しています…'}</div>}
      <Lobby inviteUrl={url} qr={<div className="qr" dangerouslySetInnerHTML={{ __html: qr }} />} members={lobbyMembers(room.members)} isHost
        onApprove={(id) => room.approve(id, true)} onDecline={(id) => room.approve(id, false)} onAddAI={() => room.addAI('mid')}
        onRemove={(id) => room.kick(id)} onStart={() => { const e = room.start(); if (e) setMsg(e); }} onCopy={share} max={room.maxPlayers} />
      <div className="lobby-foot">{msg && <span>{msg}</span>}<span className="muted small">部屋を作ったこの画面は、ゲーム中ずっと開いたままにしてください。</span><button className="link" onClick={onQuit}>部屋を閉じる</button></div>
    </>
  );
}

function GuestWaiting({ client, onLeave }: { client: GuestClient; onLeave: () => void }) {
  const lobby = client.lobby;
  if (client.status === 'joined' && lobby) {
    return (
      <>
        <Lobby inviteUrl={inviteUrl(client.roomId)} members={lobbyMembers(lobby.members)} isHost={false} max={lobby.maxPlayers} />
        <div className="lobby-foot"><button className="link" onClick={onLeave}>抜ける</button></div>
      </>
    );
  }
  const err = client.status === 'denied' || client.status === 'offline' ? client.reason : undefined;
  return (
    <>
      <JoinScreen hostName={lobby?.members.find((m) => m.status === 'host')?.name} waiting={client.status === 'waiting' || client.status === 'connecting'} error={err} defaultName={client.name}
        onJoin={() => { /* 名前はすでに送信済み */ }} />
      {client.status === 'connecting' && <p className="center muted">ホストにつないでいます…</p>}
      {err && <p className="center err">{err}</p>}
      <div className="lobby-foot"><button className="link" onClick={onLeave}>{client.status === 'denied' ? 'トップに戻る' : 'やめる'}</button></div>
    </>
  );
}

// ------------------------------------------------------------ キャラクター選択
function Draft({ view, send }: { view: MatchView; send: (c: Command) => Promise<Result> }) {
  return <DraftScreen options={view.draft!.options} picked={view.draft!.picked} names={view.seats.map((s) => s.name)} you={view.you}
    onPick={(id) => { void send({ type: 'pickChar', char: id }); }} />;
}

// ------------------------------------------------------------ ゲーム画面
type Sheet = { kind: 'space'; sid: string } | { kind: 'market'; sid: string } | { kind: 'trade' } | { kind: 'log' } | null;
type Tab = 'me' | 'all' | 'market' | 'cards' | 'log';

function spaceViews(view: MatchView, g: GameState): SpaceView[] {
  const myTurn = view.turn === view.you;
  const w = g.weather[g.round - 1];
  return g.spaces.map((id) => {
    const a = ACT[id];
    const notYet = (a.from_round ?? 1) > g.round;
    const can = view.legalSpaces.includes(id);
    const taken = (view.placements[id]?.length ?? 0) > 0 && !a.unlimited;
    const reason = notYet ? `ラウンド${a.from_round}から` : g.closed.includes(id) ? `${weatherName(w)}で使えない`
      : !can && !taken ? '条件を満たしていない' : undefined;
    const bonus = w === 'harusame' && id === 'sow' ? '春雨で畑ごと+2' : w === 'hareten' && id === 'plow' ? '晴天続きで+1区画' : undefined;
    return { id, accum: g.accum[id], by: view.placements[id], available: can, reason, bonus };
  });
}

function Game({ view, send, onQuit }: { view: MatchView; send: (c: Command) => Promise<Result>; onQuit: () => void }) {
  const g = view.game! as unknown as GameState;
  const me = g.players[view.you];
  const myTurn = view.turn === view.you;
  const [sheet, setSheet] = useState<Sheet>(null);
  const [tab, setTab] = useState<Tab>('me');
  const [sel, setSel] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // 置かれた手の演出：新しい手を順番に1つずつ再生する
  const shownN = useRef(view.moves.length ? view.moves[view.moves.length - 1].n : 0);
  const [fxQueue, setFxQueue] = useState<PlacedMove[]>([]);
  useEffect(() => {
    const fresh = view.moves.filter((mv) => mv.n > shownN.current);
    if (!fresh.length) return;
    shownN.current = fresh[fresh.length - 1].n;
    setFxQueue((q) => [...q, ...fresh.map((mv) => ({ key: mv.n, seat: mv.seat, sid: mv.sid, gains: mv.gains, who: mv.seat === view.you ? 'あなた' : `${view.seats[mv.seat].name}さん` }))].slice(-8));
  }, [view.seq]);   // eslint-disable-line
  const playing = fxQueue.length > 0;
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2500); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { if (sel && !view.legalSpaces.includes(sel)) setSel(null); }, [view.seq]);   // eslint-disable-line
  const act = async (cmd: Command) => {
    const r = await send(cmd);
    if (!r.ok) setToast(r.error);
    else { setSheet(null); setSel(null); }
  };
  const incoming = view.offers.find((o) => o.to === view.you);
  const myOffer = view.offers.find((o) => o.from === view.you);
  const names = view.seats.map((s) => s.name);
  const w = g.weather[g.round - 1];
  const forecast = view.game!.weather.slice(g.round, g.round + 2).filter((x): x is string => !!x);
  const winterW = SEASONS[(g.round - 1) % 4] === 'winter' ? (w ?? 'odayaka') : 'odayaka';
  const need = feedNeed(me, winterW);
  const alerts: Alert[] = [{ tone: me.res.food < need ? 'bad' : 'leaf', text: `冬越しの食料 ${me.res.food}/${need}${me.res.food >= need ? ' ✓' : ''}` }];

  const place = () => {
    if (!sel) return;
    if (MARKET_SPACES.has(sel)) setSheet({ kind: 'market', sid: sel });
    else {
      const opts = optionsForView(view, sel);
      if (opts.length === 1) act({ type: 'place', sid: sel, opt: opts[0] });
      else setSheet({ kind: 'space', sid: sel });
    }
  };

  return (
    <>
      <GameLayout
        status={<StatusBar round={g.round} weather={w} forecast={forecast} alerts={alerts} />}
        players={<PlayerStrip players={g.players.map((q) => ({
          seat: q.pid, name: names[q.pid], vp: score(q), left: q.avail, total: q.family, isTurn: q.pid === view.turn,
          isFirst: q.pid === g.first, isMe: q.pid === view.you,
        }))} onSelect={() => setTab('all')} />}
        board={<><ActionBoard spaces={spaceViews(view, g)} selected={sel} locked={!myTurn || playing} onPick={(id) => myTurn && !playing && view.legalSpaces.includes(id) && setSel(id)} />
          <PlacementFx move={fxQueue[0] ?? null} onDone={() => setFxQueue((q) => q.slice(1))} /></>}
        side={<>
          <Tabs value={tab} onChange={setTab} tabs={[{ id: 'me', label: 'わたし' }, { id: 'all', label: 'みんな' }, { id: 'market', label: '市場' }, { id: 'cards', label: '設備' }, { id: 'log', label: '記録' }]} />
          {tab === 'me' && <MyPanel player={me} sheepPer={sheepPerPlot(me)} />}
          {tab === 'all' && <PlayersOverview players={g.players} names={names} mySeat={view.you} />}
          {tab === 'market' && <MarketPanel prices={g.prices} />}
          {tab === 'cards' && <div className="app-cards">{g.display.map((id) => <ImprovementCard key={id} id={id} small />)}
            <p className="muted">山札 {view.game!.deckCount}枚</p></div>}
          {tab === 'log' && <EventLog events={view.events} />}
          <div className="app-quit"><Button onClick={onQuit}>ゲームをやめる</Button></div>
        </>}
        action={<ActionBar tone={myTurn ? 'turn' : 'wait'} message={myTurn
          ? <><Worker seat={view.you} size={28} /><span>{sel ? <>「{ACT[sel].name}」に置きますか？<span className="mi-sp-detail">{spaceEffect(sel)}</span></> : 'あなたの番です。置く場所を選んでください'}</span></>
          : view.turn !== null ? <><Worker seat={view.turn} size={28} />{names[view.turn]}さんが考えています…</> : null}>
          <Button disabled={!myTurn || view.proposalsLeft <= 0 || view.offers.length > 0} onClick={() => setSheet({ kind: 'trade' })}>
            <Icon name="i-trade" size={20} />取引{myTurn && view.proposalsLeft > 0 ? `（${view.proposalsLeft}）` : ''}
          </Button>
          <Button kind="primary" disabled={!sel || !myTurn} onClick={place}>{sel ? 'ここに置く' : '置く'}</Button>
        </ActionBar>}
      />
      {toast && <div className="toast">{toast}</div>}
      {(incoming || myOffer) && (
        <div className="offer-dock">
          {incoming && <TradeOfferCard fromSeat={incoming.from} fromName={names[incoming.from]} toName={names[incoming.to]} give={incoming.give} get={incoming.get}
            onAccept={() => act({ type: 'respondTrade', id: incoming.id, accept: true })} onDecline={() => act({ type: 'respondTrade', id: incoming.id, accept: false })} />}
          {myOffer && <TradeOfferCard mine fromSeat={myOffer.from} fromName={names[myOffer.from]} toName={names[myOffer.to]} give={myOffer.give} get={myOffer.get}
            onCancel={() => act({ type: 'cancelTrade', id: myOffer.id })} />}
        </div>
      )}
      {sheet?.kind === 'space' && (
        <OptionPicker title={ACT[sheet.sid].name} onClose={() => setSheet(null)}
          choices={optionsForView(view, sheet.sid).map((o) => ({ value: o, label: optLabel(sheet.sid, o, me) }))}
          onChoose={(opt) => act({ type: 'place', sid: sheet.sid, opt })} />
      )}
      {sheet?.kind === 'market' && (
        <MarketForm have={me.res} coin={me.res.coin} buyLimit={marketBuyLimit(me)}
          sellPrice={(gd) => sellPrice(g, me, gd)} buyPrice={(gd) => buyPrice(g, me, gd)} onClose={() => setSheet(null)}
          onSubmit={(sells, buys) => {
            const err = validateMarket(g, view.you, [sells, buys]);
            if (err) setToast(err); else act({ type: 'place', sid: sheet.sid, opt: [sells, buys] });
          }} />
      )}
      {sheet?.kind === 'trade' && (
        <TradeComposer you={view.you} players={view.seats.map((s, i) => ({ seat: i, name: s.name }))} myRes={me.res}
          theirRes={(seat) => g.players[seat].res} left={view.proposalsLeft} onClose={() => setSheet(null)}
          onSubmit={(to, give, get) => {
            const clean = (c: Cost) => Object.fromEntries(Object.entries(c).filter(([, n]) => n)) as Cost;
            act({ type: 'proposeTrade', to, give: clean(give), get: clean(get) });
          }} />
      )}
    </>
  );
}

// 選択肢は、見えている情報（自分の持ち物と盤面）から審判と同じ計算で出す。最終判定は審判が行う
function optionsForView(view: MatchView, sid: string): Opt[] {
  const g = view.game as unknown as GameState;
  return legal(g, g.players[view.you]).filter(([s]) => s === sid).map(([, o]) => o);
}









function RotateHint() {
  return <div className="rotate-hint"><div>📱↻</div><p>スマホを横向きにしてください</p></div>;
}
