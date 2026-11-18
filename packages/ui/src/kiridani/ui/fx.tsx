// 飛ぶ・浮かぶ・弾ける演出の層。画面の部品には data-kd="..." の目印をつけ、ここから位置を測って動かす。
// 重いライブラリは使わず Web Animations API（element.animate）だけで動かす。
// 「視差効果を減らす」設定では、飛ばさずに行き先で光るだけにする。
import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { EffectArt } from '../art-registry';

export interface FlyOpts { ms: number; delay?: number; arc?: number; size?: number; spin?: boolean }
export interface FxApi {
  fly(from: string, to: string, node: ReactNode, o: FlyOpts): void;
  float(at: string, text: ReactNode, o: { ms: number; delay?: number; tone?: 'good' | 'bad' | 'gold' | 'big' }): void;
  burst(at: string, effect: string, o: { ms: number; delay?: number; size?: number }): void;
  shake(at: string, ms: number): void;
  clear(): void;
}

type Sprite =
  | { key: number; kind: 'fly'; node: ReactNode; from: DOMRect; to: DOMRect; o: FlyOpts }
  | { key: number; kind: 'float'; node: ReactNode; at: DOMRect; ms: number; delay: number; tone?: string }
  | { key: number; kind: 'burst'; effect: string; at: DOMRect; ms: number; delay: number; size: number };

const center = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

function SpriteEl({ s, reduced, onDone }: { s: Sprite; reduced: boolean; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof el.animate !== 'function') { const t = setTimeout(onDone, 50); return () => clearTimeout(t); }
    let a: Animation;
    if (s.kind === 'fly') {
      const f = center(s.from), t = center(s.to);
      const dx = t.x - f.x, dy = t.y - f.y;
      const lift = -(s.o.arc ?? 60);
      a = reduced
        ? el.animate([{ transform: `translate(${dx}px,${dy}px) scale(.6)`, opacity: 0 }, { transform: `translate(${dx}px,${dy}px) scale(1)`, opacity: 1, offset: 0.4 }, { transform: `translate(${dx}px,${dy}px) scale(1)`, opacity: 0 }],
          { duration: s.o.ms, delay: s.o.delay ?? 0, fill: 'both' })
        : el.animate([
          { transform: 'translate(0,0) scale(.7)', opacity: 0 },
          { transform: `translate(${dx * 0.1}px,${dy * 0.1 + lift * 0.3}px) scale(1.1)`, opacity: 1, offset: 0.12 },
          { transform: `translate(${dx * 0.5}px,${dy * 0.5 + lift}px) scale(1)${s.o.spin ? ' rotate(180deg)' : ''}`, offset: 0.55 },
          { transform: `translate(${dx}px,${dy}px) scale(.85)${s.o.spin ? ' rotate(360deg)' : ''}`, opacity: 1, offset: 0.92 },
          { transform: `translate(${dx}px,${dy}px) scale(.4)`, opacity: 0 },
        ], { duration: s.o.ms, delay: s.o.delay ?? 0, easing: 'cubic-bezier(.3,.1,.3,1)', fill: 'both' });
    } else if (s.kind === 'float') {
      a = el.animate([
        { transform: 'translate(-50%,-30%) scale(.6)', opacity: 0 },
        { transform: 'translate(-50%,-90%) scale(1.15)', opacity: 1, offset: 0.2 },
        { transform: 'translate(-50%,-120%) scale(1)', opacity: 1, offset: 0.7 },
        { transform: `translate(-50%,${reduced ? '-120%' : '-170%'}) scale(1)`, opacity: 0 },
      ], { duration: s.ms, delay: s.delay, easing: 'ease-out', fill: 'both' });
    } else {
      a = el.animate(reduced
        ? [{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 0 }]
        : [{ transform: 'translate(-50%,-50%) scale(.3) rotate(-20deg)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1.15) rotate(0)', opacity: 1, offset: 0.35 }, { transform: 'translate(-50%,-50%) scale(1.3)', opacity: 0 }],
      { duration: s.ms, delay: s.delay, easing: 'ease-out', fill: 'both' });
    }
    a.onfinish = onDone;
    a.oncancel = onDone;
    return () => a.cancel();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (s.kind === 'fly') {
    const f = center(s.from); const size = s.o.size ?? 28;
    return <div ref={ref} className="kd-sprite" style={{ left: f.x - size / 2, top: f.y - size / 2, width: size, height: size }}>{s.node}</div>;
  }
  if (s.kind === 'float') {
    const c = center(s.at);
    return <div ref={ref} className={`kd-float is-${s.tone ?? 'good'}`} style={{ left: c.x, top: c.y }}>{s.node}</div>;
  }
  const c = center(s.at);
  return <div ref={ref} className="kd-burst" style={{ left: c.x, top: c.y }}><EffectArt id={s.effect} size={s.size} /></div>;
}

export const FxLayer = forwardRef<FxApi, { root: () => HTMLElement | null; reduced: boolean }>(function FxLayer({ root, reduced }, ref) {
  const [sprites, setSprites] = useState<Sprite[]>([]);
  const seq = useRef(0);
  const find = (sel: string) => {
    const r = root();
    const el = r?.querySelector<HTMLElement>(`[data-kd="${sel}"]`);
    if (!el) return null;
    // スクロールする盤面（data-kd-scroll）の中で見えていない目印は、先に見えるところまで動かす（演出が画面の外へ飛ばないように）
    for (let sc = el.closest<HTMLElement>('[data-kd-scroll]'); sc; sc = sc.parentElement?.closest<HTMLElement>('[data-kd-scroll]') ?? null) {
      if (sc.scrollHeight <= sc.clientHeight + 1) continue;
      const er = el.getBoundingClientRect(), sr = sc.getBoundingClientRect();
      if (er.top < sr.top) sc.scrollTop -= sr.top - er.top + 4;
      else if (er.bottom > sr.bottom) sc.scrollTop += Math.min(er.bottom - sr.bottom + 4, er.top - sr.top - 4);
    }
    const rect = el.getBoundingClientRect();
    if (!rect.width && !rect.height) return null;
    return rect;
  };
  const add = (s: Sprite) => setSprites((xs) => (xs.length > 80 ? [...xs.slice(-60), s] : [...xs, s]));

  useImperativeHandle(ref, () => ({
    fly(from, to, node, o) {
      const a = find(from), b = find(to);
      if (!a || !b) { if (b) this.burst(to, 'place-ring', { ms: o.ms, delay: o.delay, size: 40 }); return; }
      add({ key: ++seq.current, kind: 'fly', node, from: a, to: b, o });
    },
    float(at, text, o) {
      const a = find(at); if (!a) return;
      add({ key: ++seq.current, kind: 'float', node: text, at: a, ms: o.ms, delay: o.delay ?? 0, tone: o.tone });
    },
    burst(at, effect, o) {
      const a = find(at); if (!a) return;
      add({ key: ++seq.current, kind: 'burst', effect, at: a, ms: o.ms, delay: o.delay ?? 0, size: o.size ?? 72 });
    },
    shake(at, ms) {
      if (reduced) return;
      const el = root()?.querySelector<HTMLElement>(`[data-kd="${at}"]`);
      el?.animate?.([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(0)' }], { duration: Math.min(ms, 400) });
    },
    clear() { setSprites([]); },
  }));

  return (
    <div className="kd-fx" aria-hidden>
      {sprites.map((s) => <SpriteEl key={s.key} s={s} reduced={reduced} onDone={() => setSprites((xs) => xs.filter((x) => x.key !== s.key))} />)}
    </div>
  );
});
