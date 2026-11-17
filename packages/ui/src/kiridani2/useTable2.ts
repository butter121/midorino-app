// 霧谷 v2 — 画面の再生役（v1 の useTable と同じ形。演出キュー・音・速さは v1 の部品をそのまま使う）
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimQueue } from '../kiridani/anim/queue';
import type { Speed } from '../kiridani/anim/timing';
import { SoundPlayer } from '../kiridani/sound';
import type { GameEvent as V1Event } from '../kiridani/types';
import { eventMs2, minMs2 } from './timing';
import { applyEvent2, initialView2, type Ev, type Seat, type View2 } from './view';

export interface Playing2 { ev: Ev; ms: number; key: number; prev: View2 }

export interface TablePlayer2 {
  view: View2;
  cur: Playing2 | null;
  busy: boolean;
  queued: number;
  speed: Speed;
  setSpeed: (s: Speed) => void;
  push: (evs: Ev[]) => void;
  submit: (action: () => void) => void;
  skip: () => void;
  reset: (me: Seat) => void;
  load: (evs: Ev[]) => void;
  sound: SoundPlayer;
  muted: boolean;
  setMuted: (m: boolean) => void;
  reduced: boolean;
}

const prefersReduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function useTable2(me: Seat, opts: { speed?: Speed; soundBase?: string } = {}): TablePlayer2 {
  const [view, setView] = useState<View2>(() => initialView2(me));
  const viewRef = useRef(view);
  const [cur, setCur] = useState<Playing2 | null>(null);
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
    timing: { eventMs: (ev, sp, m, c) => eventMs2(ev as unknown as Ev, sp, m, c), minMs: minMs2 },
    onEvent: (e, ms) => {
      const ev = e as unknown as Ev;
      const prev = viewRef.current;
      const next = applyEvent2(prev, ev);
      viewRef.current = next;
      setView(next);
      if (ms > 0) setCur({ ev, ms, key: ++keyRef.current, prev });
      setBusy(true);
      if (ev.t !== 'sync') sound.event(e, meRef.current);
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
  const push = useCallback((evs: Ev[]) => { if (evs.length) { setBusy(true); queue.push(...(evs as unknown as V1Event[])); } }, [queue]);
  const submit = useCallback((a: () => void) => { if (queue.busy) setQueued((q) => q + 1); queue.submit(a); }, [queue]);
  const skip = useCallback(() => queue.skip(), [queue]);
  const reset = useCallback((m: Seat) => {
    queue.clear(); queue.setMe(m); meRef.current = m;
    const v = initialView2(m); viewRef.current = v; setView(v); setCur(null); setBusy(false); setQueued(0);
  }, [queue]);
  const load = useCallback((evs: Ev[]) => {
    queue.clear();
    let v = viewRef.current;
    for (const e of evs) v = applyEvent2(v, e);
    viewRef.current = v; setView(v); setCur(null); setBusy(false); setQueued(0);
  }, [queue]);
  const setMuted = useCallback((m: boolean) => { sound.setMuted(m); setMutedState(m); }, [sound]);

  return { view, cur, busy, queued, speed, setSpeed, push, submit, skip, reset, load, sound, muted, setMuted, reduced };
}
