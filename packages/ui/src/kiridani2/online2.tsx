// 霧谷 v2 — オンライン対戦の1席の画面（v1 の online.tsx と同じ流れ）。ホストから届く「この席の出来事」と「いま選ぶこと」を見せ、答えを返す。
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Shadow2Session, snapIsAI2, type Action2, type ActResult2, type Cost, type OfferNote2, type OfferView2, type Prompt2, type TradeJudge } from '@midorino/engine/src/kiridani2';
import type { Speed } from '../kiridani/anim/timing';
import { OfferIncoming, OfferWait } from '../kiridani/ui/tray';
import '../kiridani/ui/room.css';
import { useTable2 } from './useTable2';
import { Kiridani2Table } from './table2';
import { useSeat2 } from './seat';
import type { Ev } from './view';

export interface Online2GameProps {
  seat: number;
  events: Ev[];
  prompt: Prompt2 | null;
  waitFor: number[];
  names: string[];
  onAct: (id: string, a: Action2) => Promise<ActResult2>;
  onJudge: (b: number, give: Cost, get: Cost) => Promise<TradeJudge>;
  offer?: OfferView2 | null;
  note?: OfferNote2 | null;
  banner?: ReactNode;
  away?: string[];
  extra?: ReactNode;
  /** 最終画面の下に出すもの（ホスト：「同じメンバーでもう一度」・参加者：待っている案内） */
  finalExtra?: ReactNode;
  speed?: Speed;
}

export function Kiridani2OnlineGame({ seat, events, prompt, waitFor, names, onAct, onJudge, offer = null, note = null, banner, away = [], extra, finalExtra, speed }: Online2GameProps) {
  const t = useTable2(seat, { speed });
  const fed = useRef(0);
  const [err, setErr] = useState('');
  const [, force] = useState(0);
  const [sent, setSent] = useState<string | null>(null);
  const [sheetReady, setSheetReady] = useState(false);

  useEffect(() => {
    if (events.length < fed.current) { t.reset(seat); fed.current = 0; }
    if (events.length === fed.current) return;
    const add = events.slice(fed.current);
    if (fed.current === 0 && add.length > 40) {
      let cut = add.length;
      for (let i = add.length - 1; i >= 0; i--) if (add[i].t === 'round_start' || add[i].t === 'leader_offer') { cut = i; break; }
      t.load(add.slice(0, cut));
      t.push(add.slice(cut));
    } else t.push(add);
    fed.current = events.length;
  }, [events, seat, t]);

  const shadow = useMemo(() => (prompt && prompt.id !== sent ? new Shadow2Session(prompt, onJudge, () => force((x) => x + 1)) : null), [prompt, onJudge, sent]);
  useEffect(() => {
    setSheetReady(false);
    if (shadow) t.submit(() => setSheetReady(true));
  }, [shadow]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = useCallback((a: Action2) => {
    if (!prompt) return;
    const id = prompt.id;
    setSent(id); setErr('');
    t.submit(() => {
      onAct(id, a).then((r) => { if (!r.ok) { setErr(r.error); setSent(null); } });
    });
  }, [onAct, prompt, t]);

  const doTrade = (b: number, give: Cost, get: Cost) => {
    if (!prompt) return;
    const human = !snapIsAI2(prompt.snap, b);
    onAct(prompt.id, human ? { t: 'offer', b, give, get } : { t: 'trade', b, give, get }).then((r) => { if (!r.ok) setErr(r.error); });
  };
  const ctl = useSeat2(shadow, send, { sheetReady, onTrade: doTrade });

  const [incoming, setIncoming] = useState<OfferView2 | null>(null);
  const [replied, setReplied] = useState<string | null>(null);
  useEffect(() => {
    if (!offer || offer.to !== seat) { setIncoming(null); return; }
    const o = offer;
    t.submit(() => setIncoming(o));
  }, [offer?.id, offer?.to, seat]); // eslint-disable-line react-hooks/exhaustive-deps
  const reply = (accept: boolean) => {
    if (!incoming) return;
    const id = incoming.id;
    setReplied(id); setIncoming(null);
    onAct(id, { t: 'reply', accept }).then((r) => { if (!r.ok) setErr(r.error); });
  };
  const withdraw = () => { if (offer) onAct(offer.id, { t: 'withdraw' }).then((r) => { if (!r.ok) setErr(r.error); }); };

  const [shownNote, setShownNote] = useState<OfferNote2 | null>(null);
  useEffect(() => {
    if (!note) return;
    setShownNote(note);
    const tm = setTimeout(() => setShownNote(null), 4000);
    return () => clearTimeout(tm);
  }, [note?.id, note?.text]); // eslint-disable-line react-hooks/exhaustive-deps

  const waitingOffer = offer && offer.from === seat ? offer : null;
  let sheetNode: ReactNode = ctl.sheetNode;
  if (waitingOffer) sheetNode = <OfferWait key={waitingOffer.id} offer={waitingOffer} names={names} onWithdraw={withdraw} />;
  const offerNode = incoming && incoming.id !== replied ? <OfferIncoming key={incoming.id} offer={incoming} names={names} onReply={reply} /> : null;

  const others = waitFor.filter((x) => x !== seat);
  const waitNote = !shadow && others.length && !t.busy ? `${others.map((x) => names[x] ?? `席${x + 1}`).join('・')}が選んでいます…` : '';
  return (
    <>
      <Kiridani2Table t={t} ask={waitingOffer ? null : ctl.ask} onAnswer={ctl.onAnswer} sheet={<>{sheetNode}{offerNode}</>} actions={ctl.actions} extra={extra} finalExtra={finalExtra} />
      {(banner || waitNote || err || shownNote || away.length > 0) && (
        <div className="kd-netnote" role="status">
          {banner}
          {!banner && err && <span className="is-bad" onClick={() => setErr('')}>{err}</span>}
          {!banner && !err && shownNote && <span className={shownNote.ok ? 'is-good' : ''}>{shownNote.text}</span>}
          {!banner && !err && !shownNote && waitNote}
          {away.length > 0 && <span className="kd-netnote-away">🤖 <b>{away.join('・')}</b>は退室中（戻るまでAIが代わりに動かします）</span>}
        </div>
      )}
    </>
  );
}
