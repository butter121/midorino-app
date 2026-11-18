// 霧谷 v2 — 最終画面の「名声の移り変わり」グラフ。全員の名声をラウンドごとの折れ線で描く（x＝ラウンド・年の目盛り、y＝名声）。
// 点は出来事から作る View2.fameHist（ラウンドの終わりの名声）。最後に終わりの集計（ScoreRow.total）を「集計」の点として点線でつなぐ。
// タップ・ホバー・←→ キーでその時点の全員の値を出す。色は席の色、名前は凡例と吹き出し（色だけに頼らない：席の印も出す）。
import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { ScoreRow } from '@midorino/engine/src/kiridani2';
import { SEAT_COLORS, SEAT_MARKS, Token } from '../kiridani/ui/parts';
import { SEASON_JP, type View2 } from './view';

interface Pt { x: number; label: string; sub: string; fame: number[]; final?: boolean }

const STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500];
function niceRange(lo: number, hi: number): { min: number; max: number; step: number } {
  const span = Math.max(1, hi - lo);
  const step = STEPS.find((s) => span / s <= 5) ?? 1000;
  return { min: Math.floor(lo / step) * step, max: Math.max(Math.ceil(hi / step) * step, Math.floor(lo / step) * step + step), step };
}

/** グラフに描く点（始まり・各ラウンドの終わり・集計） */
export function famePoints(v: View2, rows?: ScoreRow[]): Pt[] {
  const pts: Pt[] = v.fameHist.filter((h) => h.fame.length).map((h) => ({
    x: h.round,
    label: h.round === 0 ? '始まり' : `ラウンド${h.round}`,
    sub: h.round === 0 ? '準備のあと' : `${h.year}年目の${SEASON_JP[h.season]}の終わり`,
    fame: h.fame,
  }));
  if (rows?.length && pts.length) {
    const fame = v.players.map((p) => rows.find((r) => r.seat === p.seat)?.total ?? p.fame);
    const lastX = pts[pts.length - 1].x;
    pts.push({ x: lastX + Math.max(1, Math.round(v.rounds * 0.08)), label: '集計', sub: '終わりの名声を足した最終結果', fame, final: true });
  }
  return pts;
}

export function FameGraph({ v, rows, nameOf }: { v: View2; rows?: ScoreRow[]; nameOf: (seat: number) => string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 340, h: 200 });
  const [at, setAt] = useState<number | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const read = () => { const r = el.getBoundingClientRect(); if (r.width > 0 && r.height > 0) setBox({ w: Math.round(r.width), h: Math.round(r.height) }); };
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pts = useMemo(() => famePoints(v, rows), [v.fameHist, rows, v.players, v.rounds]); // eslint-disable-line react-hooks/exhaustive-deps
  const n = v.players.length;
  if (pts.length < 2 || !n) return null;

  const { w: W, h: H } = box;
  const M = { l: 30, r: 14, t: 10, b: 22 };
  const xMax = pts[pts.length - 1].x;
  const all = pts.flatMap((p) => p.fame);
  const yr = niceRange(Math.min(0, ...all), Math.max(1, ...all));
  const X = (x: number) => M.l + (x / Math.max(1, xMax)) * (W - M.l - M.r);
  const Y = (y: number) => M.t + (1 - (y - yr.min) / (yr.max - yr.min)) * (H - M.t - M.b);
  const yTicks: number[] = [];
  for (let y = yr.min; y <= yr.max + 1e-9; y += yr.step) yTicks.push(y);
  const years = v.years;
  const yearStep = years <= 5 ? 1 : years <= 10 ? 2 : 3;
  const plain = pts.filter((p) => !p.final);
  const fin = pts.find((p) => p.final);
  const lastPlain = plain[plain.length - 1];

  const nearest = (px: number) => {
    let best = 0;
    pts.forEach((p, i) => { if (Math.abs(X(p.x) - px) < Math.abs(X(pts[best].x) - px)) best = i; });
    return best;
  };
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setAt(nearest(e.clientX - r.left));
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); setAt((a) => Math.max(0, (a ?? pts.length) - 1)); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); setAt((a) => Math.min(pts.length - 1, (a ?? -1) + 1)); }
    else if (e.key === 'Escape') setAt(null);
  };
  const cur = at !== null ? pts[at] : null;
  const prev = at !== null && at > 0 ? pts[at - 1] : null;
  const order = cur ? v.players.map((p) => p.seat).sort((a, b) => cur.fame[b] - cur.fame[a] || a - b) : [];
  const tipLeft = cur ? X(cur.x) > W / 2 : false;
  const summary = fin ? `名声の移り変わり。最終：${v.players.map((p) => `${nameOf(p.seat)} ${fin.fame[p.seat]}`).join('、')}` : '名声の移り変わり';

  return (
    <section className="kd2-fgraph" aria-label="名声の移り変わり">
      <h3>名声の移り変わり<small>タップでその時点の名声</small></h3>
      <div className="kd2-fgraph-plot" ref={wrapRef}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} tabIndex={0}
          onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={(e) => { if (e.pointerType === 'mouse') setAt(null); }} onKeyDown={onKey} onBlur={() => setAt(null)}>
          {/* 年ごとの帯（交互にうすく）と年の目盛り */}
          {Array.from({ length: years }, (_, i) => {
            const x0 = X(i * 4), x1 = X(Math.min((i + 1) * 4, lastPlain.x));
            if (x1 <= x0) return null;
            return (
              <g key={i}>
                {i % 2 === 1 && <rect x={x0} y={M.t} width={x1 - x0} height={H - M.t - M.b} className="kd2-fg-band" />}
                {(i % yearStep === 0 || i === years - 1) && <text x={(x0 + x1) / 2} y={H - 6} className="kd2-fg-xl" textAnchor="middle">{i + 1}年</text>}
              </g>
            );
          })}
          {/* 季節の目盛り（冬は長め） */}
          {plain.filter((p) => p.x > 0).map((p) => <line key={p.x} x1={X(p.x)} x2={X(p.x)} y1={H - M.b} y2={H - M.b + (p.x % 4 === 0 ? 5 : 2.5)} className="kd2-fg-tick" />)}
          {/* y の目盛りと横線 */}
          {yTicks.map((y) => (
            <g key={y}>
              <line x1={M.l} x2={W - M.r} y1={Y(y)} y2={Y(y)} className={y === 0 ? 'kd2-fg-zero' : 'kd2-fg-grid'} />
              <text x={M.l - 5} y={Y(y) + 3.5} className="kd2-fg-yl" textAnchor="end">{y}</text>
            </g>
          ))}
          {fin && <text x={X(fin.x)} y={H - 6} className="kd2-fg-xl is-final" textAnchor="middle">集計</text>}
          {fin && <line x1={X(lastPlain.x)} x2={X(lastPlain.x)} y1={M.t} y2={H - M.b} className="kd2-fg-sep" />}
          {/* 折れ線（集計への段差は点線） */}
          {v.players.map((p) => {
            const s = p.seat;
            const d = plain.map((q, i) => `${i ? 'L' : 'M'}${X(q.x).toFixed(1)} ${Y(q.fame[s] ?? 0).toFixed(1)}`).join('');
            const dim = focus !== null && focus !== s;
            return (
              <g key={s} className={`kd2-fg-line${dim ? ' is-dim' : ''}${focus === s ? ' is-focus' : ''}`} style={{ ['--seat' as string]: SEAT_COLORS[s] }} data-seat={s}>
                <path d={d} fill="none" stroke="var(--seat)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                {fin && <path d={`M${X(lastPlain.x)} ${Y(lastPlain.fame[s] ?? 0)}L${X(fin.x)} ${Y(fin.fame[s] ?? 0)}`} fill="none" stroke="var(--seat)" strokeWidth={2} strokeDasharray="3 3" strokeLinecap="round" />}
                {fin && <circle cx={X(fin.x)} cy={Y(fin.fame[s] ?? 0)} r={4.5} fill="var(--seat)" className="kd2-fg-end" />}
              </g>
            );
          })}
          {/* いま見ている時点 */}
          {cur && (
            <g className="kd2-fg-cur">
              <line x1={X(cur.x)} x2={X(cur.x)} y1={M.t} y2={H - M.b} />
              {v.players.map((p) => <circle key={p.seat} cx={X(cur.x)} cy={Y(cur.fame[p.seat] ?? 0)} r={4.5} fill={SEAT_COLORS[p.seat]} />)}
            </g>
          )}
        </svg>
        {cur && (
          <div className={`kd2-fg-tip${tipLeft ? ' is-left' : ''}`} style={tipLeft ? { right: W - X(cur.x) + 10 } : { left: X(cur.x) + 10 }} role="status">
            <b>{cur.label}</b><small>{cur.sub}</small>
            <ol>
              {order.map((s) => {
                const d = prev ? (cur.fame[s] ?? 0) - (prev.fame[s] ?? 0) : 0;
                return <li key={s}><Token seat={s} size={12} /><span>{nameOf(s)}</span><b>{cur.fame[s]}</b>{prev && d !== 0 && <i className={d < 0 ? 'is-neg' : ''}>{d > 0 ? '+' : ''}{d}</i>}</li>;
              })}
            </ol>
          </div>
        )}
      </div>
      <ul className="kd2-fg-legend" aria-label="凡例">
        {v.players.map((p) => (
          <li key={p.seat}>
            <button type="button" aria-pressed={focus === p.seat} className={focus === p.seat ? 'is-on' : ''} onClick={() => setFocus((f) => (f === p.seat ? null : p.seat))} style={{ ['--seat' as string]: SEAT_COLORS[p.seat] }}>
              <i aria-hidden="true" />{SEAT_MARKS[p.seat]}<span>{nameOf(p.seat)}</span>{fin && <b>{fin.fame[p.seat]}</b>}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
