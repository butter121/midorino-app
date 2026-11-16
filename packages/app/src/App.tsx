import { useEffect, useMemo, useState } from 'react';
import {
  ACT, GOODS, JP, MARKET_SPACES, RES, SEASONS,
  buyPrice, feedNeed, legal, marketBuyLimit, score, sellPrice, sellValue, sheepPerPlot, validateMarket,
  type Command, type Cost, type GameState, type Good, type Level, type MatchView, type Opt, type Player, type Res, type Seat, type SellBuy,
} from '@midorino/engine';
import {
  ActionBar, ActionBoard, Button, CharacterCard, GameLayout, Icon, ImprovementCard, MarketPanel, MyPanel,
  PlayerStrip, PlayersOverview, StatusBar, Tabs, Worker, spaceEffect, type Alert, type SpaceView,
} from '@midorino/ui';
import { LocalHost } from './host';
import { SEAT_COLORS, charName, costText, optLabel, weatherName } from './labels';

const ME = 0;   // 1台版では自分は「人間の席」。席順はランダムなので seatOf で探す

export default function App() {
  const [host, setHost] = useState<LocalHost | null>(() => LocalHost.load());
  const [, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);
  if (!host) return <Lobby onStart={(seats) => setHost(LocalHost.create(seats))} />;
  const me = host.m.seats.findIndex((s) => !s.ai);
  const view = host.view(me < 0 ? ME : me);
  const send = (cmd: Command) => { const r = host.send(view.you, cmd); refresh(); return r; };
  const quit = () => { if (confirm('このゲームをやめてロビーに戻りますか？')) { LocalHost.clear(); setHost(null); } };
  return (
    <>
      {view.phase !== 'work' && <RotateHint />}
      {view.phase === 'draft' && <Draft view={view} send={send} />}
      {view.phase === 'work' && <Game view={view} send={send} onQuit={quit} />}
      {view.phase === 'over' && <ResultScreen view={view} onBack={() => { LocalHost.clear(); setHost(null); }} />}
    </>
  );
}

function RotateHint() {
  return <div className="rotate-hint"><div>📱↻</div><p>スマホを横向きにしてください</p></div>;
}

// ------------------------------------------------------------ ロビー（1台でAIと遊ぶ）
function Lobby({ onStart }: { onStart: (s: Seat[]) => void }) {
  const [name, setName] = useState(() => { try { return localStorage.getItem('midorino.name') ?? ''; } catch { return ''; } });
  const [n, setN] = useState(4);
  const [level, setLevel] = useState<Level>('mid');
  const start = () => {
    const nick = name.trim() || 'あなた';
    try { localStorage.setItem('midorino.name', nick); } catch { /* 無視 */ }
    const names = ['ハナ', 'ソウタ', 'ユイ', 'ケン', 'ミオ'];
    onStart([{ name: nick, ai: null }, ...names.slice(0, n - 1).map((nm) => ({ name: `${nm}（AI）`, ai: level }))]);
  };
  return (
    <div className="lobby">
      <h1>ミドリノ谷の四季</h1>
      <p className="sub">AIを相手に1台で遊ぶ（動作確認版）</p>
      <label>ニックネーム<input value={name} maxLength={12} onChange={(e) => setName(e.target.value)} placeholder="あなた" /></label>
      <label>人数
        <div className="seg">{[3, 4, 5, 6].map((k) => <button key={k} className={k === n ? 'on' : ''} onClick={() => setN(k)}>{k}人</button>)}</div>
      </label>
      <label>AIの強さ
        <div className="seg">{([['novice', 'やさしい'], ['mid', 'ふつう'], ['expert', 'つよい']] as [Level, string][]).map(([k, t]) =>
          <button key={k} className={k === level ? 'on' : ''} onClick={() => setLevel(k)}>{t}</button>)}</div>
      </label>
      <button className="primary big" onClick={start}>ゲームを始める</button>
    </div>
  );
}

// ------------------------------------------------------------ キャラクター選択
function Draft({ view, send }: { view: MatchView; send: (c: Command) => void }) {
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
    const can = myTurn && view.legalSpaces.includes(id);
    const taken = (view.placements[id]?.length ?? 0) > 0 && !a.unlimited;
    const reason = notYet ? `ラウンド${a.from_round}から` : g.closed.includes(id) ? `${weatherName(w)}で使えない`
      : !can && !taken && myTurn ? '条件を満たしていない' : undefined;
    const bonus = w === 'harusame' && id === 'sow' ? '春雨で畑ごと+2' : w === 'hareten' && id === 'plow' ? '晴天続きで+1区画' : undefined;
    return { id, accum: g.accum[id], by: view.placements[id], available: can, reason, bonus };
  });
}

function Game({ view, send, onQuit }: { view: MatchView; send: (c: Command) => { ok: boolean; error?: string }; onQuit: () => void }) {
  const g = view.game! as unknown as GameState;
  const me = g.players[view.you];
  const myTurn = view.turn === view.you;
  const [sheet, setSheet] = useState<Sheet>(null);
  const [tab, setTab] = useState<Tab>('me');
  const [sel, setSel] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2500); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { if (sel && !view.legalSpaces.includes(sel)) setSel(null); }, [view.seq]);   // eslint-disable-line
  const act = (cmd: Command) => {
    const r = send(cmd);
    if (!r.ok) setToast(r.error ?? 'できませんでした');
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
        board={<ActionBoard spaces={spaceViews(view, g)} selected={sel} onPick={(id) => myTurn && view.legalSpaces.includes(id) && setSel(id)} />}
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
