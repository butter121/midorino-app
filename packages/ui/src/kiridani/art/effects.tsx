// 戦闘・自動処理の演出に重ねる絵（背景なし・96×96）。動きは演出側で付ける（拡大・回転・フェード）
import type { ReactNode } from 'react';
import { INK, K, L, T, Spark } from './common';
import { KIcon } from './icons';

const S = { stroke: INK, strokeWidth: 2.2, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
const burst = (n: number, r1: number, r2: number, c: string) => (
  <path d={Array.from({ length: n * 2 }, (_, i) => { const a = (i / (n * 2)) * Math.PI * 2, r = i % 2 ? r1 : r2; return `${i ? 'L' : 'M'}${48 + Math.cos(a) * r} ${48 + Math.sin(a) * r}`; }).join('') + 'z'} fill={c} {...S} />
);

const FX: Record<string, { jp: string; d: ReactNode }> = {
  slash: { jp: '斬撃', d: <>
    <path d="M10 82C36 60 60 34 88 10c-20 30-44 52-74 76z" fill="#fff" {...S} />
    <path d="M18 88C42 70 62 50 84 26" {...L} stroke={K.ice2} strokeWidth={2} />
    <Spark x={84} y={14} r={6} /><Spark x={16} y={84} r={4} /></> },
  fire: { jp: '炎', d: <>{burst(9, 22, 40, K.fire2)}
    <path d="M48 80c-16 0-22-12-18-24 2-8 8-10 8-20 8 4 10 12 8 18 4-2 6-6 6-12 10 8 14 18 12 26-2 8-8 12-16 12z" fill={K.fire} {...S} />
    <path d="M48 74c-6 0-9-5-7-10 1-4 4-5 4-9 4 2 6 6 6 10 0 5-1 9-3 9z" fill={K.fire3} /></> },
  ice: { jp: '氷', d: <>{[0, 60, 120, 180, 240, 300].map((a) => <path key={a} d="M48 48L44 14l4-8 4 8z" fill={K.ice2} {...S} transform={`rotate(${a} 48 48)`} />)}
    <circle cx="48" cy="48" r="10" fill={K.ice} {...S} /><Spark x={20} y={20} r={4} fill={K.ice3} /><Spark x={78} y={76} r={4} fill={K.ice3} /></> },
  thunder: { jp: '雷', d: <>{burst(8, 20, 34, K.thunder2)}
    <path d="M56 4L30 50h16l-10 42 30-52H50l12-36z" fill={K.thunder} {...S} /></> },
  light: { jp: '光', d: <><circle cx="48" cy="48" r="40" fill={K.light} opacity={0.5} />{burst(12, 18, 44, K.light2)}
    <circle cx="48" cy="48" r="14" fill={K.gold2} {...S} /><path d="M48 38v20M38 48h20" {...L} stroke="#fff" strokeWidth={4} /></> },
  dark: { jp: '闇', d: <><circle cx="48" cy="48" r="38" fill={K.dark2} opacity={0.45} />
    {[0, 90, 180, 270].map((a) => <path key={a} d="M48 48c0-20 12-32 30-34-10 8-14 20-12 34z" fill={K.dark} {...S} transform={`rotate(${a} 48 48)`} />)}
    <circle cx="48" cy="48" r="9" fill={K.black} {...S} /><circle cx="48" cy="48" r="3" fill={K.dark3} /></> },
  heal: { jp: '回復', d: <><circle cx="48" cy="48" r="36" fill={K.moss3} opacity={0.4} />
    <path d="M38 18h20v20h20v20H58v20H38V58H18V38h20z" fill={K.moss3} {...S} />
    {[[18, 18], [80, 22], [76, 80], [20, 76]].map(([x, y], i) => <Spark key={i} x={x} y={y} r={4} fill={K.light2} />)}</> },
  shield: { jp: '防御', d: <><circle cx="48" cy="48" r="40" fill="none" stroke={K.ice2} strokeWidth={6} opacity={0.7} />
    <path d="M48 12l30 10v22c0 20-14 34-30 40-16-6-30-20-30-40V22z" fill={K.steel3} {...S} />
    <path d="M48 20l22 8v16c0 14-10 26-22 30z" fill="#fff" opacity={0.6} /></> },
  injury: { jp: '負傷', d: <>{burst(7, 16, 30, K.blood2)}
    <path d="M30 36l36 24M34 62l28-28" {...L} stroke={INK} strokeWidth={8} /><path d="M30 36l36 24M34 62l28-28" {...L} stroke={K.blood} strokeWidth={4} /></> },
  'fate-flip': { jp: '運命カード', d: <>
    <rect x="22" y="10" width="52" height="76" rx="6" fill={K.night2} {...S} />
    <rect x="28" y="16" width="40" height="64" rx="4" fill="none" stroke={K.gold2} strokeWidth={2} />
    <path d="M48 30l5 10 11 1-8 8 2 11-10-5-10 5 2-11-8-8 11-1z" fill={K.thunder} {...S} /></> },
  'loot-drop': { jp: '戦利品', d: <>
    <path d="M24 46h48v34c0 4-2 6-6 6H30c-4 0-6-2-6-6z" fill={K.wood} {...S} />
    <path d="M20 34h56v14H20z" fill={K.wood3} {...S} /><rect x="42" y="42" width="12" height="12" rx="2" fill={K.gold2} {...S} />
    {[[30, 20], [48, 10], [66, 20]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="6" fill={K.gold2} {...S} />)}</> },
  trophy: { jp: '討伐の証', d: <><circle cx="48" cy="48" r="38" fill={K.gold2} opacity={0.35} />{burst(10, 26, 38, K.gold3)}
    <g transform="translate(16 16) scale(2)"><KIcon name="trophy" size={32} /></g></> },
  raid: { jp: '襲撃', d: <>{burst(6, 24, 42, K.blood2)}
    <g transform="translate(16 16) scale(2)"><KIcon name="raid" size={32} /></g></> },
  upkeep: { jp: '冬の食料', d: <>
    <circle cx="48" cy="48" r="36" fill={K.parch} {...S} />
    <g transform="translate(20 20) scale(1.75)"><KIcon name="food" size={32} /></g>
    <path d="M70 70l14 14" {...L} stroke={K.blood} strokeWidth={5} /></> },
  'weather-change': { jp: '天候の変化', d: <>
    <path d="M16 54c-10 0-12-14-2-16 0-10 14-14 20-6 4-10 20-10 24 0 10-2 16 8 10 14 6 4 4 10-4 10z" fill="#fff" {...S} />
    <path d="M70 18a14 14 0 1 1-12 22" {...L} stroke={INK} strokeWidth={5} /><path d="M70 18a14 14 0 1 1-12 22" {...L} stroke={K.gold2} strokeWidth={2.6} />
    <path d="M56 34l2 8 6-4z" fill={K.gold2} {...S} /><path d="M30 70l-4 10M44 70l-4 10M58 70l-4 10" {...T} stroke={K.ice} strokeWidth={2.4} /></> },
  'season-change': { jp: '季節の変わり目', d: <>
    {[[K.moss3, 0], [K.fire2, 90], [K.gold, 180], [K.ice2, 270]].map(([c, a]) => <path key={a as number} d="M48 48V8a40 40 0 0 1 40 40z" fill={c as string} {...S} transform={`rotate(${a} 48 48)`} />)}
    <circle cx="48" cy="48" r="12" fill={K.parch} {...S} /><path d="M48 48l6-6" {...L} strokeWidth={3} /></> },
};
export const EFFECT_IDS = Object.keys(FX);
export const EFFECT_JP: Record<string, string> = Object.fromEntries(EFFECT_IDS.map((k) => [k, FX[k].jp]));

/** 演出用の絵（飾り扱い。読み上げは演出側の文字で） */
export function EffectArt({ id, size = 96 }: { id: string; size?: number }) {
  const f = FX[id];
  if (!f) return null;
  return <svg viewBox="0 0 96 96" width={size} height={size} aria-hidden style={{ display: 'block', overflow: 'visible' }}>{f.d}</svg>;
}
