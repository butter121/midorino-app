// 霧谷の冒険者団：ホストの画面（部屋の待合室と、ホストの端末で審判を回す試合）。審判は両方のルールのエンジンを使うので、この画面ごと遅れて読み込む。
import { useCallback, useEffect, useMemo, useState } from 'react';
import qrcode from 'qrcode-generator';
import { RoomLobby } from '@midorino/ui/src/kiridani/ui/lobby';
import type { Ev } from '@midorino/ui/src/kiridani2/view';
import type { Action, Cost, GameEvent, OfferNote, OfferView, Prompt, TradeJudge } from '@midorino/engine/src/kiridani';
import type { Action2, OfferNote2, OfferView2, Prompt2, TradeJudge as TradeJudge2 } from '@midorino/engine/src/kiridani2';
import { inviteUrl } from './net/protocol';
import { peerNet } from './net/peerNet';
import { KdHostRoom } from './net/kiridaniHost';
import type { AnyAction, KdRules } from './net/kiridaniProtocol';
import { KiridaniOnlineGame, Kiridani2OnlineGame, preload } from './kdLazy';
import { load, save, SPEED, YEARS, useRoom, useStablePrompt, useStableById, Menu, useChat } from './kdShared';

export default function HostScreen({ resume, onLeave }: { resume: boolean; onLeave: () => void }) {
  const [room] = useState(() => (resume && KdHostRoom.resume(peerNet())) || (KdHostRoom.clearSaved(), new KdHostRoom(peerNet(), load('kd.name', 'ホスト'), { rules: load<number>('kd.rules', 2) === 1 ? 1 : 2, years: load('kd.years', 5) })));
  useRoom(room);
  useEffect(() => { room.open(); }, [room]);
  useEffect(() => { preload(room.rules); }, [room.rules]);
  const [copied, setCopied] = useState(false);
  const url = inviteUrl(room.roomId);
  const qr = useMemo(() => { const q = qrcode(0, 'M'); q.addData(url); q.make(); return q.createSvgTag({ cellSize: 4, margin: 1, scalable: true }); }, [url]);
  const leave = () => { room.close(); onLeave(); };
  const ref = room.referee;
  const seat = room.mySeat;
  const gameKey = room.game ? room.game.gid ?? String(room.game.seed) : '';
  const prompt = useStablePrompt(ref && seat >= 0 ? room.prompt(seat) : null, gameKey);
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
  // 終わったら、同じ席・同じ人で次の試合（参加者はつないだまま移る）
  const again = ref.done ? <><button type="button" className="kd-btn is-primary" data-kd="rematch" onClick={() => room.rematch()}>同じメンバーでもう一度</button><small>参加者もこのまま次の試合に移ります（抜けたい人は退室できます）</small></> : null;
  return (
    <>
    {g.rules === 2
      ? <Kiridani2OnlineGame key={gameKey} finalExtra={again} seat={seat} events={events as Ev[]} prompt={prompt as Prompt2 | null} waitFor={waitFor} names={g.names} onAct={onAct as (id: string, a: Action2) => Promise<{ ok: true } | { ok: false; error: string }>}
        onJudge={onJudge as (b: number, give: Cost, get: Cost) => Promise<TradeJudge2>} banner={banner} away={awayNames} speed={SPEED} offer={offer as OfferView2 | null} note={note as OfferNote2 | null} extra={menu} />
      : <KiridaniOnlineGame key={gameKey} finalExtra={again} seat={seat} events={events as GameEvent[]} prompt={prompt as Prompt | null} waitFor={waitFor} names={g.names} onAct={onAct as (id: string, a: Action) => Promise<{ ok: true } | { ok: false; error: string }>}
        onJudge={onJudge as (b: number, give: Cost, get: Cost) => Promise<TradeJudge>} banner={banner} away={awayNames} speed={SPEED} offer={offer as OfferView | null} note={note as OfferNote | null} extra={menu} />}
    {chat.node}
    </>
  );
}

