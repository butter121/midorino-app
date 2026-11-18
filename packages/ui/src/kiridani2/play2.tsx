// 霧谷 v2 — 本物のエンジン（Kiridani2Session）で1試合を遊ぶ画面。人間は1席、残りは AI。
// 答えはオンラインと同じ形（Action2）で作り、applyAction2 で手元の試合に渡す。
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AI, Kiridani2Session, applyAction2, syncEvent, type Action2, type Cost, type GameEvent, type Level, type SeatSession2 } from '@midorino/engine/src/kiridani2';
import type { Speed } from '../kiridani/anim/timing';
import '../kiridani/ui/room.css';
import { useTable2 } from './useTable2';
import { Kiridani2Table } from './table2';
import { useSeat2 } from './seat';
import type { Ev } from './view';
import { answerToAction } from '@midorino/engine/src/kiridani2/uihelp';

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
  /** 途中から再開するときの、これまでの答え（同じ n・seed・years・level で最初から当て直す） */
  resume?: { hist: Action2[]; auto?: boolean };
  /** 答えるたびに呼ぶ（保存用）。done は試合が終わったか */
  onProgress?: (p: { hist: Action2[]; auto: boolean; done: boolean }) => void;
  /** 最終画面の下に出すもの（「同じメンバーでもう一度」） */
  finalExtra?: ReactNode;
  extra?: (ctl: { restart: () => void; auto: boolean; setAuto: (a: boolean) => void; session: Kiridani2Session | null }) => ReactNode;
}

export function Kiridani2EngineGame({ n, seed, years = 5, level = 'normal', speed, resume, onProgress, extra, finalExtra }: Engine2GameProps) {
  const me = 0;
  const t = useTable2(me, { speed });
  const sRef = useRef<Kiridani2Session | null>(null);
  const helper = useRef(new AI('normal', { seed: 99 }));
  const [seat, setSeat] = useState<SeatSession2 | null>(null);
  const [sheetReady, setSheetReady] = useState(false);
  /** 答えを受け付けなかった・記録を当て直せなかったときのお知らせ */
  const [note, setNote] = useState('');
  const [auto, setAutoState] = useState(!!resume?.auto);
  const autoRef = useRef(!!resume?.auto);
  const hist = useRef<Action2[]>([]);
  const progRef = useRef(onProgress);
  progRef.current = onProgress;

  const withSync = (s: Kiridani2Session, evs: GameEvent[]): Ev[] => (evs.length ? [...evs, syncEvent(s.g)] : evs);
  const report = (s: Kiridani2Session) => progRef.current?.({ hist: hist.current, auto: autoRef.current, done: s.done });
  /** 手元の試合に答えを当て、記録する */
  const apply = (s: Kiridani2Session, a: Action2): GameEvent[] => {
    const evs = applyAction2(s, a);
    hist.current.push(a);
    report(s);
    return evs;
  };
  /** お任せの AI の答え */
  const autoAnswer = (s: Kiridani2Session): GameEvent[] => {
    const w = s.waiting!;
    return apply(s, answerToAction(w, helper.current.respond(w)));
  };

  // 出来事を流したあと：お任せなら AI が答え、そうでなければ問いを出す
  const proceed = useCallback((s: Kiridani2Session, instant = false) => {
    if (s.done) { setSeat(null); return; }
    if (autoRef.current) {
      setSeat(null);
      t.submit(() => { if (sRef.current === s) feed(autoAnswer(s)); });
      return;
    }
    setSeat(seatOf(s));
    if (instant) { setSheetReady(true); return; }
    setSheetReady(false);
    // シートは演出が追いついてから出す
    t.submit(() => { if (sRef.current === s) setSheetReady(true); });
  }, [t]); // eslint-disable-line react-hooks/exhaustive-deps

  const feed = useCallback((evs: GameEvent[]) => {
    const s = sRef.current!;
    t.push(withSync(s, evs));
    proceed(s);
  }, [t, proceed]); // eslint-disable-line react-hooks/exhaustive-deps

  /** 答えが受け付けられなかったとき：理由を出し、同じ問いを出し直す（問いを閉じたままにしない） */
  const refused = (s: Kiridani2Session, e: unknown) => {
    setNote(`選べませんでした：${e instanceof Error ? e.message : String(e)}`);
    if (s.fault) { replay(hist.current); return; }
    proceed(s, true);
  };

  const send = useCallback((a: Action2) => {
    const s = sRef.current!;
    if (a.t === 'trade' || a.t === 'equip') {
      // 取引・装備の持ち替えは置き場所の選択を続けたまま
      try { const evs = apply(s, a); t.push(withSync(s, evs)); setSeat(seatOf(s)); } catch (e) { if (a.t === 'equip') refused(s, e); }
      return;
    }
    setSeat(null);
    setNote('');
    t.submit(() => {
      if (sRef.current !== s) return;
      let evs: GameEvent[];
      try { evs = apply(s, a); } catch (e) { refused(s, e); return; }
      feed(evs);
    });
  }, [feed, t]); // eslint-disable-line react-hooks/exhaustive-deps

  const fresh = () => new Kiridani2Session({ n, seed, years, human: me, levels: Array(n).fill(level), names: ENGINE2_NAMES.slice(0, n) });

  const restart = useCallback(() => {
    const s = fresh();
    sRef.current = s;
    hist.current = [];
    t.reset(me);
    setSeat(null);
    report(s);
    feed(s.start());
  }, [feed, level, n, seed, years, t]); // eslint-disable-line react-hooks/exhaustive-deps

  /** 保存した答えを最初から当て直して、演出なしでいまの場面まで一気に進める。
   *  途中の答えが当てはまらなければ、そこで止めて「最後に当てはまった場面」から続ける（最初からやり直さない） */
  const replay = (h: Action2[]): boolean => {
    let s: Kiridani2Session;
    const evs: GameEvent[] = [];
    try { s = fresh(); evs.push(...s.start()); } catch { return false; }
    let ok = 0;
    for (const a of h) {
      try { evs.push(...applyAction2(s, a)); ok++; } catch {
        if (s.fault) return replay(h.slice(0, ok));
        break;
      }
    }
    if (ok < h.length) setNote(`保存した記録の ${ok + 1} 手目から先を当て直せませんでした。${ok} 手目までの場面から続けます。`);
    sRef.current = s;
    hist.current = h.slice(0, ok);
    t.reset(me);
    t.load([...evs, syncEvent(s.g)]);
    setSeat(null);
    report(s);
    proceed(s, true);
    return true;
  };

  useEffect(() => { if (!(resume?.hist.length && replay(resume.hist))) restart(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setAuto = (a: boolean) => {
    setAutoState(a); autoRef.current = a;
    const s = sRef.current;
    if (s) report(s);
    if (a && s?.waiting) { setSeat(null); t.submit(() => { if (sRef.current === s) feed(autoAnswer(s)); }); }
    else if (!a && s?.waiting) setSeat(seatOf(s));
  };

  const ctl = useSeat2(seat, send, { sheetReady, onTrade: (b: number, give: Cost, get: Cost) => send({ t: 'trade', b, give, get }) });
  return (
    <>
      <Kiridani2Table t={t} ask={auto ? null : ctl.ask} onAnswer={ctl.onAnswer} sheet={auto ? null : ctl.sheetNode} actions={ctl.actions} picker={ctl.picker} onEquip={ctl.onEquip}
        extra={extra?.({ restart, auto, setAuto, session: sRef.current })} finalExtra={finalExtra} />
      {note && <div className="kd-netnote" role="alert" data-kd="play-note"><span className="is-bad" onClick={() => setNote('')}>{note}</span></div>}
    </>
  );
}
