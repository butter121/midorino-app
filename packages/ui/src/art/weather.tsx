// 天候カードのイラスト（オリジナル）。IDは engine の WEATHER の id。viewBox 0 0 120 80
import type { ReactNode } from 'react';
import { C, L, O } from './common';

type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export const SEASON_SKY: Record<Season, [string, string, string, string]> = {
  // 空の上・空の下・遠い丘・近い丘
  spring: ['#FCE6EC', '#FFF6E8', '#BFE0A6', '#8CC77E'],
  summer: ['#BFE6F0', '#EAF8FB', '#9ED38A', '#5DA36A'],
  autumn: ['#FBD9B8', '#FFF1DF', '#F3C38E', '#E5A15F'],
  winter: ['#DCE6F5', '#F5F8FC', '#E9EFF7', '#CBD8EA'],
};

const sun = (x: number, y: number, r = 11, c = '#F6C142') => <>
  <path {...L} stroke="#E89A1A" strokeWidth={3} d={[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
    const t = (a * Math.PI) / 180; const r1 = r + 4, r2 = r + 9;
    return `M${x + r1 * Math.cos(t)} ${y + r1 * Math.sin(t)}L${x + r2 * Math.cos(t)} ${y + r2 * Math.sin(t)}`;
  }).join('')} />
  <circle {...O} cx={x} cy={y} r={r} fill={c} /></>;
const cloud = (x: number, y: number, s = 1, fill = '#FFFFFF') =>
  <path {...O} transform={`translate(${x} ${y}) scale(${s})`} d="M-16 8c-8 0-8-12 0-12 1-9 13-12 18-5 7-4 16 1 15 9 7 0 7 8 0 8z" fill={fill} />;
const drops = (x: number, y: number, c = '#3A8FD0') =>
  <path {...L} stroke={c} strokeWidth={3} d={`M${x - 10} ${y}l-3 7M${x} ${y}l-3 7M${x + 10} ${y}l-3 7`} />;
const flakes = (x: number, y: number) =>
  <g fill="#8FB0E0" {...O} strokeWidth={2}><circle cx={x - 10} cy={y} r="3" /><circle cx={x} cy={y + 5} r="3" /><circle cx={x + 10} cy={y} r="3" /></g>;
const wind = (x: number, y: number) => <path {...L} stroke="#4E77B8" strokeWidth={3} d={`M${x} ${y}h22c5 0 5-7 0-7M${x + 4} ${y + 8}h28c5 0 5 7 0 7`} />;
const use = (id: string, x: number, y: number, s: number) => <use href={`#${id}`} x={x} y={y} width={s} height={s} />;
const tree = (x: number, y: number, c: string) => <><path {...O} d={`M${x - 1.5} ${y + 16}v-8h3v8z`} fill={C.woodD} /><circle {...O} cx={x} cy={y} r="9" fill={c} /></>;

const ART: Record<string, ReactNode> = {
  // 春
  harusame: <>{cloud(60, 20, 1.3, '#E6EEF5')}{drops(60, 36)}{use('i-grain', 28, 44, 22)}{use('i-veg', 72, 44, 22)}</>,
  osojimo: <><path {...L} stroke="#5E8BD0" strokeWidth={3} d="M60 8v26M49 14l22 14M49 28l22-14" />{use('i-grain', 44, 40, 30)}
    <path d="M44 66h32" stroke="#fff" strokeWidth={4} strokeLinecap="round" opacity=".9" /></>,
  yoshun: <>{sun(30, 22)}{tree(78, 36, C.pink)}{tree(94, 40, '#F9C3D0')}{use('i-wood', 34, 44, 22)}{use('i-clay', 58, 46, 20)}</>,
  yukidoke: <><path {...O} d="M14 44l20-26 20 26z" fill="#fff" /><path {...O} d="M10 70c20-14 40 6 60-6s30-4 44 2v14H10z" fill={C.water} />
    <path d="M30 70h14M64 66h16" stroke="#fff" strokeWidth={3} strokeLinecap="round" />{use('i-food', 76, 30, 26)}</>,
  hanabie: <>{tree(36, 30, C.pink)}{tree(54, 34, '#F9C3D0')}<path {...L} stroke="#5E8BD0" strokeWidth={3} d="M82 12v20M74 16l16 12M74 28l16-12" />{use('i-veg', 72, 42, 24)}</>,
  odayaka: <>{sun(80, 22, 9)}{cloud(44, 26, 1.1)}</>,
  // 夏
  hideri: <>{sun(60, 24, 12, '#F28C3A')}<path {...L} d="M40 66l4 4-3 4M74 64l-3 4 4 4" /><path {...L} stroke="#7FA65A" strokeWidth={3} d="M60 70c0-6 1-9 0-12" /></>,
  megumi: <>{cloud(46, 18, 1.2, '#E6EEF5')}{drops(46, 32)}{sun(92, 18, 8)}<path {...L} stroke="#F6A7BB" strokeWidth={3} d="M70 48c4-16 30-16 34 0" /><path {...L} stroke="#7EC4DA" strokeWidth={3} d="M74 48c4-11 22-11 26 0" /></>,
  yudachi: <>{cloud(56, 18, 1.4, '#9AA6B4')}<path {...O} d="M58 30l-6 12h8l-6 12" fill="none" stroke="#F6C142" strokeWidth={3.5} />{drops(80, 34)}{use('i-stone', 18, 40, 26)}</>,
  mosho: <>{sun(36, 26, 13, '#F28C3A')}<path {...L} stroke="#E5622A" strokeWidth={3} d="M74 20c-4 4 4 8 0 12s4 8 0 12M86 20c-4 4 4 8 0 12s4 8 0 12" />{use('i-food', 76, 46, 22)}</>,
  hareten: <>{sun(60, 24)}{use('i-field', 22, 44, 28)}{use('i-field', 70, 44, 28)}</>,
  // 秋
  hosaku: <>{sun(96, 16, 8)}{use('i-grain', 14, 26, 34)}{use('i-grain', 42, 22, 38)}{use('i-veg', 78, 34, 28)}</>,
  taifu: <><path {...L} stroke="#4E77B8" strokeWidth={3.5} d="M60 36m-5 0a5 5 0 1 0 10 0c0-10-18-13-23-3M60 36c0 10 18 13 23 3M60 36c10 0 13-18 3-23M60 36c-10 0-13 18-3 23" />
    <path {...O} d="M18 30c6-2 10 4 6 8-2-4-6-6-6-8zM96 52c6-2 10 4 6 8-2-4-6-6-6-8z" fill={C.leaf} /></>,
  nagaame: <>{cloud(36, 16, 1.1, '#C3CCD6')}{cloud(80, 20, 1.2, '#C3CCD6')}{drops(36, 30)}{drops(80, 34)}{use('i-grain', 50, 44, 22)}</>,
  akibare: <>{sun(28, 20, 9)}<path {...L} stroke="#4E77B8" d="M60 18l4 3 4-3M76 12l4 3 4-3" />{use('i-sheep', 50, 38, 28)}{use('i-sheep', 76, 42, 24)}</>,
  wataridori: <><path {...L} strokeWidth={3} d="M20 30l8 6 8-6M44 20l8 6 8-6M68 28l8 6 8-6M90 16l6 5 6-5" />{use('i-food', 50, 42, 24)}</>,
  // 冬
  oyuki: <>{cloud(60, 16, 1.4, '#F4F7FB')}{flakes(60, 32)}<path {...O} d="M14 66c14-12 30-12 44-4s30 6 50-2v20H14z" fill="#fff" />{use('i-room', 18, 38, 26)}</>,
  kanpa: <>{wind(18, 22)}{wind(66, 30)}<path {...O} d="M90 12v34" fill="none" strokeWidth={7} stroke="#fff" /><circle {...O} cx="90" cy="52" r="7" fill="#7E9DD3" /><path d="M90 46V20" stroke="#7E9DD3" strokeWidth={3} />{use('i-wood', 24, 44, 24)}</>,
  dantou: <>{sun(36, 24, 10)}<path {...O} d="M64 50c0-10 8-16 16-16s16 6 16 16z" fill="#fff" />{use('i-worker', 70, 34, 20)}</>,
  fuyunoichi: <>{flakes(30, 14)}{flakes(88, 18)}{use('i-stall', 36, 26, 46)}{use('i-coin', 82, 44, 18)}</>,
  fubuki: <>{wind(14, 18)}{wind(60, 12)}{flakes(42, 40)}{flakes(84, 38)}{use('i-stone', 50, 50, 22)}
    <path d="M48 52l26 20M74 52L48 72" stroke="#D9534A" strokeWidth={3.5} strokeLinecap="round" /></>,
};

export const WEATHER_ART_IDS = Object.keys(ART);

export function WeatherArt({ id, season, width = 120, height = 80 }: { id: string; season: Season; width?: number | string; height?: number | string }) {
  const [top, bot, far, near] = SEASON_SKY[season];
  const gid = `wx-${season}`;
  return (
    <svg viewBox="0 0 120 80" width={width} height={height} role="img" aria-hidden preserveAspectRatio="xMidYMid slice">
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={top} /><stop offset="1" stopColor={bot} /></linearGradient></defs>
      <rect width="120" height="80" fill={`url(#${gid})`} />
      <path d="M0 58Q30 46 60 54T120 52V80H0z" fill={far} />
      <path d="M0 70Q40 60 80 68T120 66V80H0z" fill={near} />
      {ART[id] ?? ART.odayaka}
    </svg>
  );
}
