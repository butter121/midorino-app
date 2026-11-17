// 霧谷：オンライン対戦の1席の画面。ホスト（審判）から届く「この席の出来事」と「いま選ぶこと」（Prompt）を見せ、答え（Action）を返す。
// ひとり遊び（play.tsx）と同じ部品（盤面・ドラフト・トレイ・選択のシート）を使い、盤面の写し（ShadowSession）でトレイの見込みを出す。
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ShadowSession, type Action, type ActResult, type Option, type Prompt, type TradeJudge } from '@midorino/engine/src/kiridani';
import { MARKETS, type Cost, type Res } from './data';
import type { Speed } from './anim/timing';
import type { GameEvent } from './types';
import { useTable } from './ui/useTable';
import { KiridaniTable, type Ask } from './ui/table';
import { ChoiceSheet, type ChoiceSpec } from './ui/choice';
import { FightTray, MarketTray, TradeButton, TradeTray, type FightSel } from './ui/tray';
import { optionSheet, uiFor } from './play';
import './ui/room.css';

export interface OnlineGameProps {
  seat: number;
  /** この席から見た出来事（最初から全部。届くたびに伸びる） */
  events: GameEvent[];
  /** いまこの席に聞いていること */
  prompt: Prompt | null;
  /** 答えを待っている席（自分以外の表示用） */
  waitFor: number[];
  names: string[];
  onAct: (id: string, a: Action) => Promise<ActResult>;
  onJudge: (b: number, give: Cost, get: Cost) => Promise<TradeJudge>;
  /** 接続の状態など（上に重ねて出す） */
  banner?: ReactNode;
  extra?: ReactNode;
  speed?: Speed;
}

/** シートの答えを Action に */
function sheetAction(p: Prompt, id: string): Action {
  if (p.k === 'draft') return { t: 'card', id };
  if (p.k === 'weather') return { t: 'weather', w: id || null };
  return { t: 'yes', v: id === 'yes' };
}

export function KiridaniOnlineGame({ seat, events, prompt, waitFor, names, onAct, onJudge, banner, extra, speed }: OnlineGameProps) {
  const t = useTable(seat, { speed });
  const fed = useRef(0);
  const [ask, setAsk] = useState<Ask | null>(null);
  const [sheet, setSheet] = useState<ChoiceSpec | null>(null);
  const [sub, setSub] = useState<{ sid: string; opts: Option[] } | null>(null);
  const [tray, setTray] = useState<{ kind: 'fight' | 'market'; sid: string } | { kind: 'trade' } | null>(null);
  const [err, setErr] = useState('');
  const [retry, setRetry] = useState(0);
  const [, force] = useState(0);
  /** 答えを送ったあと、次の問いが来るまで */
  const [sent, setSent] = useState<string | null>(null);

  // 出来事：最初にまとめて届いたとき（つなぎ直し）は演出なしで当て、そのあとは演出つきで流す
  useEffect(() => {
    if (events.length < fed.current) { t.reset(seat); fed.current = 0; }
    if (events.length === fed.current) return;
    const add = events.slice(fed.current);
    if (fed.current === 0 && add.length > 40) {
      // 最後のラウンドの始まりまでは一気に、そこからは演出つき（何が起きているか分かるように）
      let cut = add.length;
      for (let i = add.length - 1; i >= 0; i--) if (add[i].t === 'round_start' || add[i].t === 'char_offer') { cut = i; break; }
      t.load(add.slice(0, cut));
      t.push(add.slice(cut));
    } else t.push(add);
    fed.current = events.length;
  }, [events, seat, t]);

  const shadow = useMemo(() => (prompt ? new ShadowSession(prompt, onJudge, () => force((x) => x + 1)) : null), [prompt, onJudge]);

  // 問いが変わったら、既存の画面（ask）か選択のシートに振り分ける。シートは演出が追いついてから
  useEffect(() => {
    setSub(null); setTray(null);
    if (!shadow || !prompt) { setAsk(null); setSheet(null); return; }
    if (sent === prompt.id) return;
    const ui = uiFor(shadow);
    setAsk(ui.ask);
    if (ui.sheet) { setSheet(null); t.submit(() => setSheet(ui.sheet)); } else setSheet(null);
  }, [shadow, retry]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = useCallback((a: Action) => {
    if (!prompt) return;
    const id = prompt.id;
    setAsk(null); setSheet(null); setSub(null); setTray(null); setSent(id); setErr('');
    t.submit(() => {
      onAct(id, a).then((r) => {
        if (!r.ok) { setErr(r.error); setSent(null); setRetry((x) => x + 1); }
      });
    });
  }, [onAct, prompt, t]);

  const onAnswer = (c: string) => {
    const w = shadow?.waiting;
    if (!w) return;
    if (w.k === 'choose') {
      const opts = w.opts.filter((o) => o[0] === c);
      if (c.startsWith('nest') || c === 'lair') { setTray({ kind: 'fight', sid: c }); return; }
      if (MARKETS.has(c)) { setTray({ kind: 'market', sid: c }); return; }
      if (opts.length === 1) send({ t: 'opt', i: w.opts.indexOf(opts[0]) });
      else setSub({ sid: c, opts });
      return;
    }
    send({ t: 'card', id: c });
  };
  const doTrade = (b: number, give: Cost, get: Cost) => {
    if (!prompt) return;
    setTray(null);
    onAct(prompt.id, { t: 'trade', b, give, get }).then((r) => { if (!r.ok) setErr(r.error); });
  };

  let sheetNode: ReactNode = null;
  const backToBoard = () => { setTray(null); setAsk(ask ? { ...ask } : null); };
  const s = shadow;
  if (tray && s?.waiting.k === 'choose') {
    if (tray.kind === 'fight') sheetNode = <FightTray key={tray.sid} s={s} sid={tray.sid} onFight={(sel: FightSel) => send({ t: 'fight', sel })} onCancel={backToBoard} />;
    else if (tray.kind === 'market') sheetNode = <MarketTray key={tray.sid} s={s} sid={tray.sid} onDeal={(kind: 'buy' | 'sell', r: Res, q: number) => send({ t: 'market', sid: tray.sid, kind, r, q })} onCancel={backToBoard} />;
    else sheetNode = <TradeTray s={s} onTrade={doTrade} onCancel={() => setTray(null)} />;
  } else if (sub && s && s.waiting.k === 'choose') {
    const all = s.waiting.opts;
    sheetNode = <ChoiceSheet spec={optionSheet(s, sub.sid, sub.opts)} onPick={(id) => send({ t: 'opt', i: all.indexOf(sub.opts[Number(id)]) })} onCancel={() => { setSub(null); setAsk(ask ? { ...ask } : null); }} />;
  } else if (sheet && prompt) {
    const p = prompt;
    sheetNode = <ChoiceSheet spec={sheet} onPick={(id) => send(sheetAction(p, id))} />;
  }

  const others = waitFor.filter((x) => x !== seat);
  const waitNote = !prompt && others.length && !t.busy ? `${others.map((x) => names[x] ?? `席${x + 1}`).join('・')}が選んでいます…` : '';
  const actions = ask?.kind === 'place' ? <TradeButton s={s} onOpen={() => setTray({ kind: 'trade' })} /> : null;
  return (
    <>
      <KiridaniTable t={t} ask={ask} onAnswer={onAnswer} sheet={sheetNode} actions={actions} extra={extra} />
      {(banner || waitNote || err) && (
        <div className="kd-netnote" role="status">
          {banner}
          {!banner && err && <span className="is-bad" onClick={() => setErr('')}>{err}</span>}
          {!banner && !err && waitNote}
        </div>
      )}
    </>
  );
}
