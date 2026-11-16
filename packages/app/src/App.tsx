import { useEffect, useMemo, useState } from 'react';
import {
  ACT, BASE_PRICE, CHARACTERS, FARM_PLOTS, GOODS, IMPROVEMENTS, JP, MARKET_SPACES, PRICE_SPAN, RES,
  buyPrice, legal, marketBuyLimit, sellPrice, sellValue, validateMarket,
  type Command, type Cost, type GameState, type Good, type Level, type MatchView, type Opt, type Player, type Res, type Seat, type SellBuy,
} from '@midorino/engine';
import { LocalHost } from './host';
import {
  SEAT_COLORS, charName, costText, impLabel, optLabel, seasonOf, weatherName, weatherText, yearOf,
} from './labels';

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
      <RotateHint />
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
    <div className="draft">
      <h2>キャラクターを1人選んでください</h2>
      <div className="cards">
        {opts.map((c) => (
          <button key={c} className={`card ${mine === c ? 'on' : ''}`} disabled={!!mine} onClick={() => send({ type: 'pickChar', char: c })}>
            <b>{CHARACTERS[c].name}</b><span>{CHARACTERS[c].text}</span>
          </button>
        ))}
      </div>
      {mine && <p>ほかの人の選択を待っています…</p>}
    </div>
  );
}

// ------------------------------------------------------------ ゲーム画面
type Sheet = { kind: 'space'; sid: string } | { kind: 'market'; sid: string } | { kind: 'trade' } | { kind: 'player'; pid: number } | { kind: 'log' } | null;

function Game({ view, send, onQuit }: { view: MatchView; send: (c: Command) => { ok: boolean; error?: string }; onQuit: () => void }) {
  const g = view.game! as unknown as GameState;
  const me = g.players[view.you];
  const myTurn = view.turn === view.you;
  const [sheet, setSheet] = useState<Sheet>(null);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2500); return () => clearTimeout(t); }, [toast]);
  const act = (cmd: Command) => {
    const r = send(cmd);
    if (!r.ok) setToast(r.error ?? 'できませんでした');
    else setSheet(null);
  };
  const incoming = view.offers.find((o) => o.to === view.you);

  const clickSpace = (sid: string) => {
    if (!myTurn || !view.legalSpaces.includes(sid)) return;
    if (MARKET_SPACES.has(sid)) { setSheet({ kind: 'market', sid }); return; }
    setSheet({ kind: 'space', sid });
  };

  return (
    <div className="game">
      <header className="topbar">
        <span className="round">{yearOf(g.round)}年目 {seasonOf(g.round)}（{g.round}/12）</span>
        <span className="weather" title={weatherText(view.game!.weather[g.round - 1])}>天気：<b>{weatherName(view.game!.weather[g.round - 1])}</b></span>
        <span className="forecast">予報：{view.game!.weather.slice(g.round, g.round + 2).map((w, i) => <span key={i}>{w ? weatherName(w) : ''}</span>)}</span>
        <span className="turn" style={{ color: view.turn !== null ? SEAT_COLORS[view.turn] : undefined }}>
          {myTurn ? 'あなたの番です' : view.turn !== null ? `${view.seats[view.turn].name} の番` : ''}
        </span>
        <span className="spacer" />
        <button onClick={() => setSheet({ kind: 'log' })}>記録</button>
        <button onClick={onQuit}>やめる</button>
      </header>
      <main className="panes">
        <section className="board">
          <div className="spaces">
            {g.spaces.filter((s) => (ACT[s].from_round ?? 1) <= g.round).map((sid) => {
              const a = ACT[sid];
              const by = view.placements[sid] ?? [];
              const can = myTurn && view.legalSpaces.includes(sid);
              const acc = g.accum[sid];
              return (
                <button key={sid} className={`space ${can ? 'can' : ''} ${g.closed.includes(sid) ? 'closed' : ''}`} onClick={() => clickSpace(sid)} disabled={!can}>
                  <b>{a.name}</b>
                  <small>{acc ? `${costText(acc)}` : a.give ? costText(a.give) : a.text}</small>
                  <span className="pawns">{by.map((pid, i) => <i key={i} style={{ background: SEAT_COLORS[pid] }} />)}</span>
                </button>
              );
            })}
          </div>
          <Market g={g} />
          <div className="imps">
            <span>発展設備：</span>{g.display.map((id) => <span key={id} className="chip" title={IMPROVEMENTS[id].text}>{IMPROVEMENTS[id].name}</span>)}
            <span className="muted">（山札 {view.game!.deckCount}枚）</span>
          </div>
        </section>
        <section className="mine">
          <FarmPanel p={me} name={view.seats[view.you].name} color={SEAT_COLORS[view.you]} />
          <div className="actions">
            <button disabled={!myTurn || view.proposalsLeft <= 0 || view.offers.length > 0} onClick={() => setSheet({ kind: 'trade' })}>
              取引を提案{myTurn ? `（あと${view.proposalsLeft}回）` : ''}
            </button>
          </div>
          <div className="others">
            {g.players.map((p, i) => i !== view.you && (
              <button key={i} className="other" onClick={() => setSheet({ kind: 'player', pid: i })} style={{ borderColor: SEAT_COLORS[i] }}>
                <b style={{ color: SEAT_COLORS[i] }}>{view.seats[i].name}</b> {charName(p.char)}
                <small>家族{p.family}・コマ残り{p.avail}・畑{p.fields.length}・牧場{p.pastures}・部屋{p.rooms}</small>
              </button>
            ))}
          </div>
          <ol className="log mini">{view.events.slice(-4).map((e, i) => <li key={i}>{e.text}</li>)}</ol>
        </section>
      </main>
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
      {sheet?.kind === 'player' && (
        <Modal title={view.seats[sheet.pid].name} onClose={() => setSheet(null)}>
          <FarmPanel p={g.players[sheet.pid]} name={view.seats[sheet.pid].name} color={SEAT_COLORS[sheet.pid]} />
        </Modal>
      )}
      {sheet?.kind === 'log' && (
        <Modal title="これまでの記録" onClose={() => setSheet(null)}>
          <ol className="log">{[...view.events].reverse().map((e, i) => <li key={i}>{e.text}</li>)}</ol>
        </Modal>
      )}
    </div>
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

function Market({ g }: { g: GameState }) {
  return (
    <div className="market">
      {GOODS.map((gd) => {
        const pr = g.prices[gd], base = BASE_PRICE[gd];
        return <span key={gd} className={pr > base ? 'up' : pr < base ? 'down' : ''}>{JP[gd]}<b>{pr}</b></span>;
      })}
      <span className="muted">（上限は基準+{PRICE_SPAN}）</span>
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

function FarmPanel({ p, name, color }: { p: Player; name: string; color: string }) {
  const plots = useMemo(() => {
    const out: { k: string; t: string }[] = [];
    for (let i = 0; i < p.rooms; i++) out.push({ k: `room-${p.house}`, t: { wood: '木の部屋', clay: '土の部屋', stone: '石の部屋' }[p.house] });
    for (const [k, n] of p.fields) out.push({ k: `field ${k ?? 'empty'}`, t: k ? `${k === 'grain' ? '麦' : '野菜'}${n}` : '畑' });
    for (let i = 0; i < p.pastures; i++) out.push({ k: 'pasture', t: '牧場' });
    while (out.length < FARM_PLOTS) out.push({ k: 'free', t: '' });
    return out;
  }, [p]);
  return (
    <div className="farm">
      <div className="farmhead"><b style={{ color }}>{name}</b> <span>{charName(p.char)}</span>
        <small title={CHARACTERS[p.char].text}>ⓘ</small> <span className="muted">家族{p.family}人（今年生まれ{p.born_year}）・借り{p.begging}</span></div>
      <div className="plots">{plots.map((x, i) => <div key={i} className={`plot ${x.k}`}>{x.t}</div>)}</div>
      <div className="res">{RES.map((r) => <span key={r} className={p.res[r] ? '' : 'zero'}>{JP[r as Res]}<b>{p.res[r]}</b></span>)}</div>
      {p.imps.length > 0 && <div className="imps">{p.imps.map((i) => <span key={i} className="chip" title={IMPROVEMENTS[i].text}>{IMPROVEMENTS[i].name}</span>)}</div>}
    </div>
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
