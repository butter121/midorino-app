// 画面の再生役：出来事を受け取り、演出キューで1つずつ GameView に当てる React フック。
// エンジン（またはカタログの台本）は push(events) するだけ。操作は submit() で預ければ、演出が終わってから実行される。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimQueue } from '../anim/queue';
import type { Speed } from '../anim/timing';
import { applyEvent, initialView } from '../reduce';
import { SoundPlayer } from '../sound';
import type { GameEvent, GameView, Seat } from '../types';

export interface Playing { ev: GameEvent; ms: number; key: number; prev: GameView }

export interface TablePlayer {
  view: GameView;
  /** いま再生中の出来事（演出が終わるまで） */
  cur: Playing | null;
  busy: boolean;
  /** 預かっている操作の数 */
  queued: number;
  speed: Speed;
  setSpeed: (s: Speed) => void;
  push: (evs: GameEvent[]) => void;
  submit: (action: () => void) => void;
  skip: () => void;
  reset: (me: Seat) => void;
  /** 出来事を演出なしで一気に当てる（途中から見る・再接続） */
  load: (evs: GameEvent[]) => void;
  sound: SoundPlayer;
  muted: boolean;
  setMuted: (m: boolean) => void;
  reduced: boolean;
}

const prefersReduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function useTable(me: Seat, opts: { speed?: Speed; soundBase?: string } = {}): TablePlayer {
  const [view, setView] = useState<GameView>(() => initialView(me));
  const viewRef = useRef(view);
  const [cur, setCur] = useState<Playing | null>(null);
  const [busy, setBusy] = useState(false);
  const [queued, setQueued] = useState(0);
  const [speed, setSpeedState] = useState<Speed>(opts.speed ?? 'normal');
  const [muted, setMutedState] = useState(false);
  const [reduced, setReduced] = useState(prefersReduced);
  const sound = useMemo(() => new SoundPlayer({ base: opts.soundBase }), [opts.soundBase]);
  const keyRef = useRef(0);
  const meRef = useRef(me);

  const queue = useMemo(() => new AnimQueue({
    me,
    speed: opts.speed,
    onEvent: (ev, ms) => {
      const prev = viewRef.current;
      const next = applyEvent(prev, ev);
      viewRef.current = next;
      setView(next);
      if (ms > 0) setCur({ ev, ms, key: ++keyRef.current, prev });
      setBusy(true);
      sound.event(ev, meRef.current);
    },
    onIdle: () => { setCur(null); setBusy(false); setQueued(0); },
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (typeof matchMedia === 'undefined') return;
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.('change', on);
    return () => { mq.removeEventListener?.('change', on); queue.clear(); };
  }, [queue]);

  const setSpeed = useCallback((s: Speed) => { queue.setSpeed(s); setSpeedState(s); }, [queue]);
  const push = useCallback((evs: GameEvent[]) => { if (evs.length) { setBusy(true); queue.push(...evs); } }, [queue]);
  const submit = useCallback((a: () => void) => {
    if (queue.busy) setQueued((q) => q + 1);
    queue.submit(a);
  }, [queue]);
  const skip = useCallback(() => queue.skip(), [queue]);
  const reset = useCallback((m: Seat) => {
    queue.clear(); queue.setMe(m); meRef.current = m;
    const v = initialView(m); viewRef.current = v; setView(v); setCur(null); setBusy(false); setQueued(0);
  }, [queue]);
  const load = useCallback((evs: GameEvent[]) => {
    queue.clear();
    let v = viewRef.current;
    for (const e of evs) v = applyEvent(v, e);
    viewRef.current = v; setView(v); setCur(null); setBusy(false); setQueued(0);
  }, [queue]);
  const setMuted = useCallback((m: boolean) => { sound.setMuted(m); setMutedState(m); }, [sound]);

  return { view, cur, busy, queued, speed, setSpeed, push, submit, skip, reset, load, sound, muted, setMuted, reduced };
}
