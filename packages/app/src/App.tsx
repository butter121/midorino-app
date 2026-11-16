import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ACT, GOODS, JP, MARKET_SPACES, RES, SEASONS,
  buyPrice, feedNeed, legal, marketBuyLimit, score, sellPrice, sellValue, sheepPerPlot, validateMarket,
  type Command, type Cost, type GameState, type Good, type Level, type MatchView, type Opt, type Player, type Res, type Seat, type SellBuy,
} from '@midorino/engine';
import {
  ActionBar, ActionBoard, Button, PlacementFx, type PlacedMove, CharacterCard, GameLayout, Icon, ImprovementCard, MarketPanel, MyPanel,
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
      {view.phase === 'over' && <ResultScreen view={view} onBack={onBack} />}
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
    return (
      <div className="lobby">
        <h1>ミドリノ谷の四季</h1>
        <p className="sub">招待された部屋に参加します</p>
        <label>ニックネーム<input value={name} maxLength={12} onChange={(e) => setName(e.target.value)} placeholder="ほかの人に表示される名前" /></label>
        <button className="primary big" onClick={() => { const c = new GuestClient(join, nick()); c.connect(); onMode({ kind: 'guest', client: c }); }}>参加する</button>
      </div>
    );
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
function HostLobby({ room, onQuit }: { room: HostRoom; onQuit: () => void }) {
  const url = inviteUrl(room.roomId);
  const qr = useMemo(() => { const q = qrcode(0, 'M'); q.addData(url); q.make(); return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); }, [url]);
  const [msg, setMsg] = useState('');
  const players = room.members.filter((m) => m.status !== 'waiting');
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'ミドリノ谷の四季', text: '一緒に遊ぼう！', url });
      else { await navigator.clipboard.writeText(url); setMsg('リンクをコピーしました'); }
    } catch { /* キャンセル */ }
  };
  return (
    <div className="hostlobby">
      <div className="invite">
        <h2>友だちを招待</h2>
        {room.status === 'connecting' && <p className="muted">部屋を準備しています…</p>}
        {room.status === 'error' && <p className="err">部屋を開けませんでした：{room.error}</p>}
        <div className="qr" dangerouslySetInnerHTML={{ __html: qr }} />
        <button className="primary" onClick={share}>招待リンクを送る</button>
        {msg && <p className="muted">{msg}</p>}
        <p className="muted small">このリンクを知っている人だけが参加を申し込めます。参加には、あなたの承認が必要です。部屋を作った画面は、ゲーム中ずっと開いたままにしてください。</p>
      </div>
      <div className="members">
        <h2>メンバー（{players.length}/{room.maxPlayers}人）</h2>
        <ul>
          {room.members.map((m) => (
            <li key={m.id} className={m.status}>
              <span className={`dot ${m.online ? 'on' : ''}`} />
              <b>{m.name}</b>
              <small>{{ host: 'ホスト（あなた）', joined: '参加', waiting: '承認待ち', ai: 'AI' }[m.status]}</small>
              <span className="spacer" />
              {m.status === 'waiting' && <><button className="primary" onClick={() => room.approve(m.id, true)}>承認</button><button onClick={() => room.approve(m.id, false)}>見送る</button></>}
              {(m.status === 'joined' || m.status === 'ai') && <button onClick={() => room.kick(m.id)}>外す</button>}
            </li>
          ))}
        </ul>
        <div className="row">
          <button disabled={players.length >= room.maxPlayers} onClick={() => room.addAI('mid')}>AIを追加</button>
          <button className="primary" disabled={players.length < 3} onClick={() => { const e = room.start(); if (e) setMsg(e); }}>
            この{players.length}人で始める
          </button>
        </div>
        {players.length < 3 && <p className="muted small">3人から遊べます。人数が足りないときはAIを追加してください。</p>}
        <button className="link" onClick={onQuit}>部屋を閉じる</button>
      </div>
    </div>
  );
}

function GuestWaiting({ client, onLeave }: { client: GuestClient; onLeave: () => void }) {
  const lobby = client.lobby;
  return (
    <div className="lobby">
      <h1>ミドリノ谷の四季</h1>
      {client.status === 'connecting' && <p>ホストにつないでいます…</p>}
      {client.status === 'waiting' && <p>ホストの承認を待っています…</p>}
      {client.status === 'joined' && <p>参加しました。ホストがゲームを始めるのを待っています…</p>}
      {client.status === 'offline' && <p className="err">{client.reason}</p>}
      {client.status === 'denied' && <p className="err">{client.reason}</p>}
      {lobby && <ul className="memberlist">{lobby.members.filter((m) => m.status !== 'waiting').map((m) => <li key={m.id}>{m.name}{m.id === client.memberId ? '（あなた）' : ''}</li>)}</ul>}
      <button onClick={onLeave}>{client.status === 'denied' ? 'トップに戻る' : 'やめる'}</button>
    </div>
  );
}

function RotateHint() {
  return <div className="rotate-hint"><div>📱↻</div><p>スマホを横向きにしてください</p></div>;
}

// ------------------------------------------------------------ キャラクター選択
function Draft({ view, send }: { view: MatchView; send: (c: Command) => Promise<Result> }) {
  const opts = view.draft!.options!;
  const mine = view.draft!.picked[view.you];
  return (
    <div className="draft mi-root">
      <h2>キャラクターを1人選んでください</h2>
      <div className="cards">
        {opts.map((c) => (
          <CharacterCard key={c} id={c} selected={mine === c} onSelect={mine ? undefined : (id) => send({ type: 'pickChar', char: id })} />
        ))}
      </div>
      {mine && <p>ほかの人の選択を待っています…</p>}
    </div>
  );
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
      if (opts.length === 1 && opts[0] === null) act({ type: 'place', sid: sel, opt: null });
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
          {tab === 'log' && <ol className="log">{[...view.events].reverse().map((e, i) => <li key={i}>{e.text}</li>)}</ol>}
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
      {incoming && (
        <Modal title="取引の提案が届きました" onClose={() => act({ type: 'respondTrade', id: incoming.id, accept: false })}>
          <p><b>{view.seats[incoming.from].name}</b> から：</p>
          <p>あなたがもらう：{costText(incoming.give)}<br />あなたが渡す：{costText(incoming.get)}</p>
          <div className="row">
            <button className="primary" onClick={() => act({ type: 'respondTrade', id: incoming.id, accept: true })}>受ける</button>
            <button onClick={() => act({ type: 'respondTrade', id: incoming.id, accept: false })}>断る</button>
          </div>
        </Modal>
      )}
      {sheet?.kind === 'space' && (
        <Modal title={ACT[sheet.sid].name} onClose={() => setSheet(null)}>
          <SpaceOptions sid={sheet.sid} opts={optionsForView(view, sheet.sid)} p={me} onPick={(opt) => act({ type: 'place', sid: sheet.sid, opt })} />
        </Modal>
      )}
      {sheet?.kind === 'market' && (
        <Modal title={ACT[sheet.sid].name} onClose={() => setSheet(null)}>
          <MarketBuilder g={g} pid={view.you} onDone={(opt) => act({ type: 'place', sid: sheet.sid, opt })} />
        </Modal>
      )}
      {sheet?.kind === 'trade' && (
        <Modal title="取引を提案" onClose={() => setSheet(null)}>
          <TradeBuilder view={view} g={g} onSend={(to, give, get) => act({ type: 'proposeTrade', to, give, get })} />
        </Modal>
      )}
    </>
  );
}

// 選択肢は、見えている情報（自分の持ち物と盤面）から審判と同じ計算で出す。最終判定は審判が行う
function optionsForView(view: MatchView, sid: string): Opt[] {
  const g = view.game as unknown as GameState;
  return legal(g, g.players[view.you]).filter(([s]) => s === sid).map(([, o]) => o);
}

function SpaceOptions({ sid, opts, p, onPick }: { sid: string; opts: Opt[]; p: Player; onPick: (o: Opt) => void }) {
  const a = ACT[sid];
  if (opts.length === 1 && (opts[0] === null || ['plow', 'plow2', 'family', 'family2'].includes(sid))) {
    return (
      <div>
        <p>{a.give ? `${costText(a.give)} を受け取ります。` : a.accum ? '積まれている物をすべて受け取ります。' : a.text}</p>
        <button className="primary" onClick={() => onPick(opts[0])}>ここに置く{opts[0] !== null ? `（${optLabel(sid, opts[0], p)}）` : ''}</button>
      </div>
    );
  }
  return (
    <div className="optlist">
      {a.text && <p className="muted">{a.text}</p>}
      {opts.map((o, i) => <button key={i} onClick={() => onPick(o)}>{optLabel(sid, o, p)}</button>)}
    </div>
  );
}


function MarketBuilder({ g, pid, onDone }: { g: GameState; pid: number; onDone: (o: Opt) => void }) {
  const p = g.players[pid];
  const [sell, setSell] = useState<Partial<Record<Good, number>>>({});
  const [buy, setBuy] = useState<Partial<Record<Good, number>>>({});
  const sells: SellBuy = GOODS.filter((gd) => sell[gd]).map((gd) => [gd, sell[gd]!]);
  const buys: SellBuy = GOODS.filter((gd) => buy[gd]).map((gd) => [gd, buy[gd]!]);
  const income = sellValue(g, p, sells);
  const cost = buys.reduce((s, [gd, q]) => s + buyPrice(g, p, gd) * q, 0);
  const err = validateMarket(g, pid, [sells, buys]);
  const nBuy = buys.reduce((s, [, q]) => s + q, 0);
  return (
    <div className="mkt">
      <table>
        <thead><tr><th>品目</th><th>持ち</th><th>売値</th><th>売る</th><th>買値</th><th>買う</th></tr></thead>
        <tbody>
          {GOODS.map((gd) => (
            <tr key={gd}>
              <td>{JP[gd]}</td><td>{p.res[gd]}</td><td>{sellPrice(g, p, gd)}</td>
              <td><Stepper v={sell[gd] ?? 0} max={p.res[gd]} on={(v) => setSell({ ...sell, [gd]: v })} disabled={!!buy[gd]} /></td>
              <td>{buyPrice(g, p, gd)}</td>
              <td><Stepper v={buy[gd] ?? 0} max={marketBuyLimit(p) - nBuy + (buy[gd] ?? 0)} on={(v) => setBuy({ ...buy, [gd]: v })} disabled={!!sell[gd]} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>コイン {p.res.coin} ＋ 売上 {income} − 支払い {cost} ＝ <b>{p.res.coin + income - cost}</b>（買えるのは合計{marketBuyLimit(p)}個まで）</p>
      {err && <p className="err">{err}</p>}
      <button className="primary" disabled={!!err} onClick={() => onDone([sells, buys])}>この内容で取引する</button>
    </div>
  );
}

function TradeBuilder({ view, g, onSend }: { view: MatchView; g: GameState; onSend: (to: number, give: Cost, get: Cost) => void }) {
  const others = g.players.map((_, i) => i).filter((i) => i !== view.you);
  const [to, setTo] = useState(others[0]);
  const [give, setGive] = useState<Cost>({});
  const [get, setGet] = useState<Cost>({});
  const me = g.players[view.you], them = g.players[to];
  const clean = (c: Cost) => Object.fromEntries(Object.entries(c).filter(([, n]) => n)) as Cost;
  const empty = !Object.keys(clean(give)).length && !Object.keys(clean(get)).length;
  return (
    <div className="trade">
      <div className="seg">{others.map((i) => <button key={i} className={i === to ? 'on' : ''} onClick={() => { setTo(i); setGet({}); }}>{view.seats[i].name}</button>)}</div>
      <table>
        <thead><tr><th></th><th>渡す（持ち）</th><th>もらう（相手の持ち）</th></tr></thead>
        <tbody>
          {RES.map((r) => (
            <tr key={r}><td>{JP[r]}</td>
              <td><Stepper v={give[r] ?? 0} max={me.res[r]} on={(v) => setGive({ ...give, [r]: v })} /> <small>({me.res[r]})</small></td>
              <td><Stepper v={get[r] ?? 0} max={them.res[r]} on={(v) => setGet({ ...get, [r]: v })} /> <small>({them.res[r]})</small></td></tr>
          ))}
        </tbody>
      </table>
      <button className="primary" disabled={empty} onClick={() => onSend(to, clean(give), clean(get))}>提案する</button>
    </div>
  );
}

function Stepper({ v, max, on, disabled }: { v: number; max: number; on: (v: number) => void; disabled?: boolean }) {
  return (
    <span className="stepper">
      <button disabled={disabled || v <= 0} onClick={() => on(v - 1)}>−</button>
      <b>{v}</b>
      <button disabled={disabled || v >= max} onClick={() => on(v + 1)}>＋</button>
    </span>
  );
}


function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><b>{title}</b><button onClick={onClose}>×</button></div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

function ResultScreen({ view, onBack }: { view: MatchView; onBack: () => void }) {
  const r = view.result!;
  const g = view.game! as unknown as GameState;
  const labels: Record<string, string> = { fields: '畑', pastures: '牧場', grain: '麦', veg: '野菜', sheep: '羊', pig: '豚', cattle: '牛', diversity: '多様性', house: '家', family: '家族', imps: '設備', coin: 'コイン', empty: '空き区画', begging: '借り' };
  const keys = Object.keys(labels).filter((k) => k !== 'pastures');
  return (
    <div className="result">
      <h2>ゲーム終了</h2>
      <table>
        <thead><tr><th>順位</th><th>名前</th>{keys.map((k) => <th key={k}>{labels[k]}</th>)}<th>合計</th></tr></thead>
        <tbody>
          {r.ranking.map((pid, i) => (
            <tr key={pid} className={pid === view.you ? 'me' : ''}>
              <td>{i + 1}</td><td style={{ color: SEAT_COLORS[pid] }}>{view.seats[pid].name}<br /><small>{charName(g.players[pid].char)}</small></td>
              {keys.map((k) => <td key={k}>{(r.scores[pid].breakdown as unknown as Record<string, number>)[k]}</td>)}
              <td><b>{r.scores[pid].total}</b></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="primary big" onClick={onBack}>ロビーに戻る</button>
    </div>
  );
}
