// 主（ボス）5体。普通の魔物より暗い背景と金の縁で見分ける
import type { ReactNode } from 'react';
import { INK, K, O, L, T, MistBg, GlowEye, Spark } from './common';
import { drawSpider, drawWyvern, drawKnight, Tube, Shadow } from './monsters';

const bear = () => (
  <g>
    <Shadow w={36} />
    <path d="M4 98c0-24 18-40 44-40s44 16 44 40z" fill="#6A4A34" {...O} />
    <path d="M14 70c4-6 10-8 16-6M82 70c-4-6-10-8-16-6" {...L} stroke={K.moss} strokeWidth={4} />
    <circle cx="22" cy="24" r="10" fill="#7A563C" {...O} /><circle cx="22" cy="24" r="5" fill="#A87C5A" />
    <circle cx="74" cy="24" r="10" fill="#7A563C" {...O} /><circle cx="74" cy="24" r="5" fill="#A87C5A" />
    <path d="M16 44c0-18 14-28 32-28s32 10 32 28c0 16-14 26-32 26S16 60 16 44z" fill="#7A563C" {...O} />
    <path d="M34 50c0-8 6-12 14-12s14 4 14 12-6 14-14 14-14-6-14-14z" fill="#C49A70" {...O} />
    <ellipse cx="48" cy="45" rx="6" ry="4" fill={INK} />
    <path d="M40 56c4 4 12 4 16 0l-2 6c-4 2-8 2-12 0z" fill={K.blood} {...O} strokeWidth={1.8} />
    <path d="M42 56l1 4 2-3.6M54 56l-1 4-2-3.6" fill="#fff" stroke="none" />
    <GlowEye x={34} y={36} r={3.4} color={K.fire2} /><GlowEye x={62} y={36} r={3.4} color={K.fire2} />
    <path d="M26 30l12 4M70 30l-12 4" {...L} strokeWidth={3} />
    <path d="M62 26l6 14M66 25l6 14M70 26l5 11" {...L} stroke={K.blood2} strokeWidth={2} />
  </g>
);

const queen = () => (
  <g>
    <g opacity={0.55}>{[0, 30, 60, 90, 120, 150].map((a) => <path key={a} d="M48 40L48 -10" {...T} stroke="#fff" transform={`rotate(${a} 48 40)`} />)}
      {[16, 28, 40].map((r) => <circle key={r} cx="48" cy="40" r={r} fill="none" stroke="#fff" strokeWidth={1} />)}</g>
    <g transform="translate(-4 -2) scale(1.08)">{drawSpider(true)}</g>
  </g>
);

const wyrm = () => (
  <g>
    <path d="M-4 70l20-26 12 12 18-30 18 24 14-14 22 34z" fill="#8C96AE" stroke={INK} strokeWidth={2} strokeLinejoin="round" opacity={0.6} />
    <path d="M32 30l-4 6 6-2zM46 26l-4 6 6-2z" fill="#fff" opacity={0.8} />
    {drawWyvern(true)}
  </g>
);

const dullahan = () => (
  <g>
    <circle cx="48" cy="40" r="26" fill={K.light} opacity={0.2} />
    {drawKnight(true)}
  </g>
);

const ancient = () => (
  <g>
    <circle cx="48" cy="46" r="40" fill={K.fire} opacity={0.18} />
    {/* 角と首 */}
    <path d="M30 30C20 18 18 6 22 -2c4 8 10 16 16 22zM66 30C76 18 78 6 74 -2c-4 8-10 16-16 22z" fill={K.bone} {...O} />
    <path d="M26 6l4 2M24 14l4 2M70 6l-4 2M72 14l-4 2" {...T} />
    <path d="M10 98c0-20 12-34 38-34s38 14 38 34z" fill="#5A2E36" {...O} />
    <path d="M30 70l6 8 6-6 6 8 6-8 6 6 6-8" {...L} stroke="#C25A4A" strokeWidth={2.4} />
    <path d="M10 40c-6 2-8 8-6 14 4-4 8-4 12-2zM86 40c6 2 8 8 6 14-4-4-8-4-12-2z" fill="#7A3A42" {...O} />
    {/* 顔 */}
    <path d="M20 40c0-16 12-24 28-24s28 8 28 24c0 6-2 10-4 14l-6 14c-4 6-10 8-18 8s-14-2-18-8l-6-14c-2-4-4-8-4-14z" fill="#8A3E44" {...O} />
    <path d="M34 22l14 6 14-6" {...L} stroke="#B85A5A" strokeWidth={2.4} />
    <path d="M40 18l8 4 8-4" {...L} stroke="#B85A5A" strokeWidth={2} />
    <path d="M30 56c6 4 12 6 18 6s12-2 18-6l-2 10c-4 6-10 8-16 8s-12-2-16-8z" fill="#3A1A22" {...O} />
    <path d="M34 58l2 6 3-5 3 6 3-6 3 6 3-6 3 6 3-5 2-6" fill="#fff" stroke={INK} strokeWidth={1.2} strokeLinejoin="round" />
    <path d="M40 70c4 2 12 2 16 0" fill={K.fire2} opacity={0.9} />
    <circle cx="42" cy="48" r="1.8" fill={INK} /><circle cx="54" cy="48" r="1.8" fill={INK} />
    <GlowEye x={33} y={38} r={4.6} color={K.thunder2} slit /><GlowEye x={63} y={38} r={4.6} color={K.thunder2} slit />
    <path d="M24 32l14 4M72 32l-14 4" {...L} strokeWidth={3} />
    {/* 火の粉 */}
    {[[12, 70], [84, 66], [20, 84], [78, 86], [8, 30], [90, 26]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={1.6 + (i % 2)} fill={K.fire2} />)}
    <Spark x={88} y={10} r={3} fill={K.fire3} />
  </g>
);

const BOSSES: Record<string, { name: string; bg: [string, string]; draw: () => ReactNode }> = {
  b_bear: { name: '森の大熊', bg: ['#3E5A44', '#8DAE7E'], draw: bear },
  b_queen: { name: '蜘蛛の女王', bg: ['#3A2E48', '#8A7AA8'], draw: queen },
  b_wyrm: { name: '山の飛竜', bg: ['#3E4A6B', '#A8B8D4'], draw: wyrm },
  b_dullahan: { name: '首無し騎士', bg: ['#2E2A3E', '#7E7894'], draw: dullahan },
  b_ancient: { name: '谷底の古竜', bg: ['#2A1418', '#A4483A'], draw: ancient },
};
export const BOSS_IDS = Object.keys(BOSSES);
export const BOSS_NAMES: Record<string, string> = Object.fromEntries(BOSS_IDS.map((k) => [k, BOSSES[k].name]));

/** 主の絵（金の縁つき） */
export function BossArt({ id, size = 96, label, frame = true }: { id: string; size?: number; label?: string; frame?: boolean }) {
  const b = BOSSES[id];
  if (!b) return null;
  const k = `b-${id}`;
  return (
    <svg viewBox="0 0 96 96" width={size} height={size} role="img" aria-label={label ?? `主：${b.name}`} style={{ display: 'block' }}>
      {frame && <MistBg id={k} c1={b.bg[0]} c2={b.bg[1]} />}
      <g clipPath={frame ? `url(#cl-${k})` : undefined}>{b.draw()}</g>
      {frame && <rect x="2" y="2" width="92" height="92" rx="12" fill="none" stroke={K.gold2} strokeWidth={3} />}
      {frame && <rect x="2" y="2" width="92" height="92" rx="12" fill="none" stroke={INK} strokeWidth={1} />}
    </svg>
  );
}

