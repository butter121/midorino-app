// 霧谷 v2 — 本物のエンジン（Kiridani2Session）で1試合を遊ぶ画面。人間は1席、残りは AI。
// 答えはオンラインと同じ形（Action2）で作り、applyAction2 で手元の試合に渡す。
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AI, Kiridani2Session, applyAction2, syncEvent, type Action2, type Cost, type GameEvent, type Level, type SeatSession2 } from '@midorino/engine/src/kiridani2';
import type { Speed } from '../kiridani/anim/timing';
import { useTable2 } from './useTable2';
import { Kiridani2Table } from './table2';
import { useSeat2 } from './seat';
import type { Ev } from './view';

export const ENGINE2_NAMES = ['あなた', 'ハヤテ', 'コトネ', 'ジン', 'ルリ', 'タケル'];

/** いまの問いごとに新しい席の見え方（画面が「問いが変わった」と分かるように） */
function seatOf(s: Kiridani2Session): SeatSession2 | null {
  if (!s.waiting) return null;
  return { g: s.g, player: s.player, waiting: s.waiting, tradePartners: () => s.tradePartners(), tradeLeft: () => s.tradeLeft(), judgeTrade: (b, give, get) => s.judgeTrade(b, give, get) };
}

export interface Engine2GameProps {
  n: number;
  seed: number;
  years?: number;
  level?: Level;
  speed?: Speed;
  extra?: (ctl: { restart: () => void; auto: boolean; setAuto: (a: boolean) => void; session: Kiridani2Session | null }) => ReactNode;
}

export function Kiridani2EngineGame({ n, seed, years = 5, level = 'normal', speed, extra }: Engine2GameProps) {
  const me = 0;
  const t = useTable2(me, { speed });
  const sRef = useRef<Kiridani2Session | null>(null);
  const helper = useRef(new AI('normal', { seed: 99 }));
  const [seat, setSeat] = useState<SeatSession2 | null>(null);
  const [sheetReady, setSheetReady] = useState(false);
  const [auto, setAutoState] = useState(false);
  const autoRef = useRef(false);

  const withSync = (s: Kiridani2Session, evs: GameEvent[]): Ev[] => (evs.length ? [...evs, syncEvent(s.g)] : evs);

  const feed = useCallback((evs: GameEvent[]) => {
    const s = sRef.current!;
    t.push(withSync(s, evs));
    if (s.done) { setSeat(null); return; }
    if (autoRef.current) {
      const w = s.waiting!;
      setSeat(null);
      t.submit(() => { if (sRef.current === s) feed(s.answer(helper.current.respond(w))); });
      return;
    }
    setSheetReady(false);
    setSeat(seatOf(s));
    // シートは演出が追いついてから出す
    t.submit(() => { if (sRef.current === s) setSheetReady(true); });
  }, [t]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = useCallback((a: Action2) => {
    const s = sRef.current!;
    if (a.t === 'trade') {
      // 取引は置き場所の選択を続けたまま
      try { const evs = applyAction2(s, a); t.push(withSync(s, evs)); setSeat(seatOf(s)); } catch { /* 断られた */ }
      return;
    }
    setSeat(null);
    t.submit(() => { if (sRef.current === s) feed(applyAction2(s, a)); });
  }, [feed, t]); // eslint-disable-line react-hooks/exhaustive-deps

  const restart = useCallback(() => {
    const s = new Kiridani2Session({ n, seed, years, human: me, levels: Array(n).fill(level), names: ENGINE2_NAMES.slice(0, n) });
    sRef.current = s;
    t.reset(me);
    setSeat(null);
    feed(s.start());
  }, [feed, level, n, seed, years, t]);

  useEffect(() => { restart(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setAuto = (a: boolean) => {
    setAutoState(a); autoRef.current = a;
    const s = sRef.current;
    if (a && s?.waiting) { const w = s.waiting; setSeat(null); t.submit(() => feed(s.answer(helper.current.respond(w)))); }
    else if (!a && s?.waiting) setSeat(seatOf(s));
  };

  const ctl = useSeat2(seat, send, { sheetReady, onTrade: (b: number, give: Cost, get: Cost) => send({ t: 'trade', b, give, get }) });
  return <Kiridani2Table t={t} ask={auto ? null : ctl.ask} onAnswer={ctl.onAnswer} sheet={auto ? null : ctl.sheetNode} actions={ctl.actions}
    extra={extra?.({ restart, auto, setAuto, session: sRef.current })} />;
}
