// 天候と巣（地形）の横長の背景（160×96）。天候カード・季節の切り替え・戦闘画面の後ろに使う
import type { ReactNode } from 'react';
import { INK, K, L, T, Spark } from './common';

type Season = 'spring' | 'summer' | 'autumn' | 'winter';
const SKY: Record<Season, [string, string]> = {
  spring: ['#BFE3E8', '#F4EEDC'], summer: ['#8FCBE6', '#E6F4EA'], autumn: ['#E8B98A', '#F6E6CC'], winter: ['#B4C4D8', '#EEF2F6'],
};
const HILL: Record<Season, [string, string, string]> = {
  spring: ['#9BB8B4', '#7FA678', '#B7D19A'], summer: ['#7C9EA8', '#4F7A5A', '#7FA678'],
  autumn: ['#A89088', '#B8774A', '#D9A441'], winter: ['#9AA8BC', '#C4D0DE', '#EEF2F6'],
};
const NIGHT: [string, string] = ['#1E2433', '#3E4A6B'];

function Land({ s, sky, id, night }: { s: Season; sky?: [string, string]; id: string; night?: boolean }) {
  const [a, b] = sky ?? (night ? NIGHT : SKY[s]);
  const [h1, h2, h3] = HILL[s];
  return (
    <>
      <defs>
        <linearGradient id={`sk-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={a} /><stop offset="1" stopColor={b} /></linearGradient>
      </defs>
      <rect width="160" height="96" fill={`url(#sk-${id})`} />
      <path d="M0 58l18-16 14 8 22-22 18 16 14-10 22 18 16-12 22 14 14-8v50H0z" fill={h1} opacity={night ? 0.5 : 0.8} stroke={INK} strokeWidth={1.2} strokeLinejoin="round" />
      <path d="M0 70c20-8 36-4 56-8s34-10 56-4 34 4 48-2v40H0z" fill={h2} opacity={night ? 0.7 : 1} stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
      <path d="M0 84c26-6 48-2 72-4s50-8 88-2v18H0z" fill={h3} opacity={night ? 0.7 : 1} stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
      <path d="M0 66c30-4 60 2 90-2s50-2 70 0" {...L} stroke="#fff" strokeWidth={5} opacity={0.35} />
    </>
  );
}
const Cloud = ({ x, y, s = 1, c = '#fff' }: { x: number; y: number; s?: number; c?: string }) => (
  <path transform={`translate(${x} ${y}) scale(${s})`} d="M0 10c-6 0-8-8-2-10 0-6 8-8 12-4 2-6 12-6 14 0 6-2 10 4 6 8 4 2 2 6-2 6z" fill={c} stroke={INK} strokeWidth={1.4 / s} strokeLinejoin="round" />
);
const Sun = ({ x, y, r = 9, c = K.thunder2 }: { x: number; y: number; r?: number; c?: string }) => (
  <g><circle cx={x} cy={y} r={r + 6} fill={c} opacity={0.35} /><circle cx={x} cy={y} r={r} fill={c} stroke={INK} strokeWidth={1.4} /></g>
);
const Rain = ({ c = '#fff', n = 14 }: { c?: string; n?: number }) => <g>{Array.from({ length: n }, (_, i) => <path key={i} d={`M${8 + i * 11} ${20 + (i % 3) * 12}l-4 10`} {...T} stroke={c} strokeWidth={1.6} />)}</g>;
const Snow = ({ n = 18, big = false }: { n?: number; big?: boolean }) => <g>{Array.from({ length: n }, (_, i) => <circle key={i} cx={(i * 37) % 160} cy={8 + ((i * 23) % 70)} r={big ? 2.2 : 1.5} fill="#fff" stroke={INK} strokeWidth={0.6} />)}</g>;

type W = { jp: string; s?: Season; night?: boolean; sky?: [string, string]; fx: ReactNode };
const WEATHER: Record<string, W> = {
  calm: { jp: '穏やかな日', fx: <><Sun x={130} y={20} /><Cloud x={30} y={14} /><Cloud x={80} y={24} s={0.8} /></> },
  storm: { jp: '嵐', sky: ['#4A5470', '#8C96AE'], fx: <><Cloud x={10} y={8} s={1.6} c="#6E7890" /><Cloud x={70} y={4} s={1.8} c="#5A6480" /><Cloud x={118} y={12} s={1.4} c="#6E7890" />
    <path d="M96 26l-8 16h7l-6 16" {...L} stroke={INK} strokeWidth={5} /><path d="M96 26l-8 16h7l-6 16" {...L} stroke={K.thunder} strokeWidth={2.6} /><Rain c="#D8E0F0" /></> },
  sprout: { jp: '芽吹き', s: 'spring', fx: <><Sun x={28} y={20} c={K.light} />{[30, 60, 92, 124].map((x) => <g key={x}><path d={`M${x} 84v-8`} {...L} stroke={K.moss} strokeWidth={2} /><path d={`M${x} 78c-5 0-6-4-6-6 4 0 6 2 6 6zM${x} 78c5 0 6-4 6-6-4 0-6 2-6 6z`} fill={K.moss3} stroke={INK} strokeWidth={1} /></g>)}
    {[[50, 40], [110, 30], [140, 50]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2" fill="#F6A7BB" stroke={INK} strokeWidth={0.8} />)}</> },
  thaw: { jp: '雪解け', s: 'spring', fx: <><Sun x={130} y={18} c={K.light} /><path d="M10 82c10-4 20-2 28-6M110 78c10-2 18 0 26-4" {...L} stroke="#fff" strokeWidth={6} />
    <path d="M60 96c4-8 10-12 20-14s16-6 18-10" {...L} stroke={INK} strokeWidth={6} /><path d="M60 96c4-8 10-12 20-14s16-6 18-10" {...L} stroke={K.ice} strokeWidth={3.6} /></> },
  fog: { jp: '濃霧', sky: ['#C8D0D8', '#E8ECF0'], fx: <>{[30, 46, 62, 76].map((y, i) => <path key={y} d={`M${-10 + i * 6} ${y}c30-6 60 6 90 0s50-6 90 0`} {...L} stroke="#fff" strokeWidth={8} opacity={0.75} />)}</> },
  newmoon: { jp: '新月', night: true, fx: <><circle cx="126" cy="20" r="9" fill="none" stroke={K.dark3} strokeWidth={1.6} strokeDasharray="2 2" />
    {[[20, 14], [50, 30], [80, 10], [100, 36], [150, 40]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.2" fill="#fff" />)}
    <path d="M0 60c40-10 80 6 160-4" {...L} stroke={K.dark} strokeWidth={10} opacity={0.35} /></> },
  heat: { jp: '猛暑', s: 'summer', sky: ['#F2B46A', '#FCE7C0'], fx: <><Sun x={80} y={22} r={13} c={K.fire2} />{[30, 70, 110].map((x) => <path key={x} d={`M${x} 60c-4-4 4-8 0-12s4-8 0-12`} {...L} stroke={K.fire} strokeWidth={1.8} opacity={0.7} />)}</> },
  harvestmoon: { jp: '豊穣の月', s: 'autumn', night: true, fx: <><circle cx="120" cy="26" r="20" fill={K.gold2} opacity={0.3} /><circle cx="120" cy="26" r="14" fill={K.gold2} stroke={INK} strokeWidth={1.4} />
    <circle cx="116" cy="22" r="3" fill={K.gold} /><circle cx="124" cy="30" r="2" fill={K.gold} />{[[20, 14], [50, 30], [80, 10]].map(([x, y], i) => <Spark key={i} x={x} y={y} r={2.6} fill={K.gold3} />)}</> },
  surge: { jp: '魔力の奔流', s: 'summer', sky: ['#6A5A9A', '#C8B8E8'], fx: <>{[0, 1, 2].map((i) => <path key={i} d={`M-10 ${30 + i * 14}c30-16 50 16 80 0s50-16 90 0`} {...L} stroke={i === 1 ? K.dark3 : K.ice2} strokeWidth={3} opacity={0.85} />)}
    {[[30, 20], [90, 26], [140, 18], [60, 50]].map(([x, y], i) => <Spark key={i} x={x} y={y} r={3} fill={K.dark3} />)}</> },
  drought: { jp: '日照り', s: 'summer', sky: ['#E8C890', '#F8ECD0'], fx: <><Sun x={130} y={20} r={11} c={K.fire2} />
    <path d="M10 90l10-6 4 4 8-6M60 92l6-8 8 2 4-6M110 90l8-4 2 4 10-6" {...L} stroke={K.wood2} strokeWidth={1.6} /></> },
  gale: { jp: '強風', s: 'autumn', fx: <><Cloud x={110} y={12} s={1.2} />{[24, 40, 56].map((y, i) => <path key={y} d={`M${10 + i * 10} ${y}h50c8 0 8-8 2-8`} {...L} stroke="#fff" strokeWidth={2.4} />)}
    {[[90, 40], [120, 54], [70, 60]].map(([x, y], i) => <path key={i} d={`M${x} ${y}c-4-1-5-4-3-6 4 1 5 4 3 6z`} fill={K.fire2} stroke={INK} strokeWidth={0.9} />)}</> },
  festival: { jp: '収穫祭', s: 'autumn', fx: <><path d="M0 14c40 14 120 14 160 0" {...L} stroke={INK} strokeWidth={1} />
    {Array.from({ length: 9 }, (_, i) => <path key={i} d={`M${10 + i * 18} ${17 + Math.sin((i / 8) * Math.PI) * 9}l5 9 5-9`} fill={[K.blood2, K.gold2, K.moss2][i % 3]} stroke={INK} strokeWidth={1} />)}
    {[40, 120].map((x) => <g key={x}><path d={`M${x} 40v16`} {...T} /><ellipse cx={x} cy={62} rx={6} ry={7} fill={K.fire2} stroke={INK} strokeWidth={1.4} /></g>)}</> },
  blizzard: { jp: '吹雪', s: 'winter', sky: ['#8C9CB4', '#D4DCE8'], fx: <>{[20, 40, 60].map((y) => <path key={y} d={`M-10 ${y}c40-8 80 8 180-4`} {...L} stroke="#fff" strokeWidth={3} opacity={0.8} />)}<Snow n={30} big /></> },
  cold: { jp: '寒波', s: 'winter', sky: ['#7FA8C8', '#DCECF6'], fx: <>{Array.from({ length: 10 }, (_, i) => <path key={i} d={`M${8 + i * 16} 0l3 ${10 + (i % 3) * 5} 3-${10 + (i % 3) * 5}`} fill={K.ice2} stroke={INK} strokeWidth={1} />)}<Snow n={10} /></> },
  mild: { jp: '暖冬', s: 'winter', sky: ['#C8D8E0', '#F6F0E0'], fx: <><Sun x={30} y={20} c={K.light} />{[50, 100, 130].map((x) => <path key={x} d={`M${x} 82v-6`} {...L} stroke={K.moss} strokeWidth={2} />)}</> },
  fair: { jp: '冬の市', s: 'winter', fx: <>{[24, 80, 136].map((x, i) => <g key={x}><path d={`M${x - 16} 64h32v20h-32z`} fill={K.wood3} stroke={INK} strokeWidth={1.4} />
    <path d={`M${x - 20} 64l4-12h32l4 12z`} fill={[K.blood2, K.moss2, K.gold2][i]} stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />
    <path d={`M${x - 20} 52h40`} {...L} stroke="#fff" strokeWidth={3} /></g>)}<Snow n={10} /></> },
};

/** 天候の絵。season は穏やか・新月など季節をまたぐ天候の背景に使う */
export function WeatherScene({ id, season = 'spring', width = 160, height, label }: { id: string; season?: Season; width?: number; height?: number; label?: string }) {
  const w = WEATHER[id];
  if (!w) return null;
  const s = w.s ?? season;
  const k = `w-${id}-${s}`;
  return (
    <svg viewBox="0 0 160 96" width={width} height={height ?? (width * 96) / 160} preserveAspectRatio="xMidYMid slice" role="img" aria-label={label ?? w.jp} style={{ display: 'block' }}>
      <Land s={s} sky={w.sky} night={w.night} id={k} />
      {w.fx}
    </svg>
  );
}
export const WEATHER_JP: Record<string, string> = Object.fromEntries(Object.entries(WEATHER).map(([k, v]) => [k, v.jp]));

// ---------------------------------------------------------------- 巣（戦闘の舞台）
const NESTS: Record<string, { jp: string; draw: ReactNode }> = {
  nest_forest: { jp: '森の巣', draw: <>
    <rect width="160" height="96" fill="#5E8A6A" />
    {[10, 40, 120, 150].map((x, i) => <g key={x}><path d={`M${x - 4} 96V20h8v76z`} fill={K.wood2} stroke={INK} strokeWidth={1.4} /><circle cx={x} cy={20} r={20 + (i % 2) * 4} fill={i % 2 ? K.moss : '#3E6A4A'} stroke={INK} strokeWidth={1.4} /></g>)}
    <ellipse cx="80" cy="86" rx="70" ry="12" fill="#7FA678" stroke={INK} strokeWidth={1.4} />
    {[[60, 50], [100, 40], [80, 30]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.6" fill={K.light} />)}</> },
  nest_cave: { jp: '洞窟', draw: <>
    <rect width="160" height="96" fill="#3A3A4A" />
    <path d="M0 0h160v30c-20 10-30-6-50 4s-30 2-40 0-40 6-70-4z" fill="#5A5A6E" stroke={INK} strokeWidth={1.4} />
    {[20, 50, 90, 130].map((x) => <path key={x} d={`M${x} 26l4 14 4-14`} fill="#6E6E84" stroke={INK} strokeWidth={1.2} />)}
    <ellipse cx="80" cy="86" rx="72" ry="12" fill="#6E6A7A" stroke={INK} strokeWidth={1.4} />
    {[[30, 70], [130, 66]].map(([x, y], i) => <g key={i}><path d={`M${x} ${y}l4-8 4 8-4 6z`} fill={K.ice} stroke={INK} strokeWidth={1.2} /><circle cx={x + 4} cy={y - 2} r={8} fill={K.ice2} opacity={0.3} /></g>)}</> },
  nest_swamp: { jp: '沼の巣', draw: <>
    <rect width="160" height="96" fill="#7A9A8A" />
    <path d="M0 50c30-6 50 4 80 0s50-6 80 0v46H0z" fill="#4E7A6A" stroke={INK} strokeWidth={1.4} />
    {[[30, 70, 18], [110, 78, 22]].map(([x, y, r], i) => <ellipse key={i} cx={x} cy={y} rx={r} ry={5} fill="#6EA0A0" stroke={INK} strokeWidth={1.2} />)}
    {[14, 60, 140].map((x) => <g key={x}><path d={`M${x} 62v-18`} {...L} stroke="#3E5A4A" strokeWidth={2} /><ellipse cx={x} cy={42} rx={2.4} ry={6} fill={K.wood} stroke={INK} strokeWidth={1} /></g>)}
    {[0, 1, 2].map((i) => <path key={i} d={`M${-10 + i * 20} ${30 + i * 8}c30-6 60 6 90 0s50-6 90 0`} {...L} stroke="#fff" strokeWidth={6} opacity={0.4} />)}</> },
  nest_mount: { jp: '山の巣', draw: <>
    <rect width="160" height="96" fill="#A8B8D4" />
    <path d="M0 70l30-44 20 20 30-40 30 40 20-18 30 42v26H0z" fill="#7C8CA8" stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />
    <path d="M70 18l10-12 10 12-5-2-5 4-5-4z M24 34l6-8 6 8-3-1-3 2z" fill="#fff" stroke={INK} strokeWidth={1} />
    <path d="M0 84c40-8 100-8 160 0v12H0z" fill="#9A8A7A" stroke={INK} strokeWidth={1.4} />
    {[20, 50, 120].map((x) => <path key={x} d={`M${x} 84l6-6 6 6z`} fill="#B8A898" stroke={INK} strokeWidth={1} />)}</> },
  lair: { jp: '主の巣', draw: <>
    <rect width="160" height="96" fill="#2A1418" />
    <circle cx="80" cy="50" r="50" fill={K.fire} opacity={0.25} />
    <path d="M0 0h160v20c-30 16-50 4-80 10S20 34 0 20z" fill="#3E2028" stroke={INK} strokeWidth={1.4} />
    <ellipse cx="80" cy="86" rx="76" ry="12" fill="#5A2E30" stroke={INK} strokeWidth={1.4} />
    {[[20, 80], [140, 78], [60, 90], [104, 88]].map(([x, y], i) => <g key={i}><path d={`M${x - 6} ${y}h12l-2-6h-8z`} fill={K.bone} stroke={INK} strokeWidth={1} /><circle cx={x} cy={y - 8} r={3} fill={K.gold2} stroke={INK} strokeWidth={1} /></g>)}
    {[[30, 40], [130, 30], [80, 20]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.6" fill={K.fire2} />)}</> },
};
export const NEST_IDS = Object.keys(NESTS);
export const NEST_JP: Record<string, string> = Object.fromEntries(NEST_IDS.map((k) => [k, NESTS[k].jp]));

/** 巣（戦闘の舞台）の絵 */
export function NestScene({ id, width = 160, height, label }: { id: string; width?: number; height?: number; label?: string }) {
  const n = NESTS[id];
  if (!n) return null;
  return (
    <svg viewBox="0 0 160 96" width={width} height={height ?? (width * 96) / 160} preserveAspectRatio="xMidYMid slice" role="img" aria-label={label ?? n.jp} style={{ display: 'block' }}>
      {n.draw}
    </svg>
  );
}
