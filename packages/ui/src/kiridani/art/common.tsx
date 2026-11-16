// 霧谷の冒険者団：絵の共通部品（オリジナル画風「霧の絵本」：太くやわらかい紺の線＋平面塗り＋ひとつだけの明るい差し色）
import type { ReactNode } from 'react';

export const INK = '#1E2433';

/** 基本の色。属性色は UI の色分けと同じ値を使う */
export const K = {
  ink: INK, night: '#2B3550', night2: '#3E4A6B',
  parch: '#F3E9D2', parch2: '#E6D6B0', parch3: '#C9B48A',
  mist: '#DDE3EA', mist2: '#B9C4D2',
  moss: '#4F7A5A', moss2: '#7FA678', moss3: '#B7D19A',
  gold: '#D9A441', gold2: '#F2CF7A', gold3: '#FFF0C2',
  fire: '#E0662F', fire2: '#F6A13A', fire3: '#FFD58A',
  ice: '#5CC4E0', ice2: '#BFEAF5', ice3: '#EAF9FD',
  thunder: '#F2C94C', thunder2: '#FFE58A',
  light: '#FFF1B8', light2: '#FFFBE6',
  dark: '#7B4FA6', dark2: '#4A2F6B', dark3: '#B596D6',
  steel: '#A9B4C2', steel2: '#6E7C8E', steel3: '#DCE3EA',
  wood: '#A0703F', wood2: '#6E4526', wood3: '#D2A26B',
  leather: '#8A5A3B', leather2: '#B57E55',
  bone: '#EDE3C8', bone2: '#C8BB98',
  blood: '#B83A3A', blood2: '#E07A6E',
  white: '#FFFFFF', black: '#141824',
  skin: ['#F6D5B8', '#EBC09A', '#C98F67', '#F9E1CC', '#A9744F'],
};

export type El = 'fire' | 'ice' | 'thunder' | 'light' | 'dark';
export const EL_COLOR: Record<El, [string, string]> = {
  fire: [K.fire, K.fire3], ice: [K.ice, K.ice3], thunder: [K.thunder, K.thunder2], light: [K.gold, K.light], dark: [K.dark, K.dark3],
};

type Stroke = { stroke: string; strokeWidth: number; strokeLinejoin: 'round'; strokeLinecap: 'round'; fill?: string };
/** 塗り＋輪郭 */
export const O: Stroke = { stroke: INK, strokeWidth: 2.6, strokeLinejoin: 'round', strokeLinecap: 'round' };
/** 線だけ */
export const L: Stroke = { ...O, fill: 'none', strokeWidth: 2.2 };
/** 細い線 */
export const T: Stroke = { ...O, fill: 'none', strokeWidth: 1.4 };

/** 96×96 の絵を包む。label を渡すと読み上げ名になる */
export function Art({ size = 96, label, children, view = '0 0 96 96', w, h }: { size?: number; label?: string; children: ReactNode; view?: string; w?: number; h?: number }) {
  return (
    <svg viewBox={view} width={w ?? size} height={h ?? size} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} style={{ display: 'block' }}>
      {children}
    </svg>
  );
}

/** 霧のかかった丸い背景（キャラ・魔物の後ろ） */
export function MistBg({ c1, c2, id }: { c1: string; c2: string; id: string }) {
  return (
    <>
      <defs>
        <radialGradient id={`bg-${id}`} cx="50%" cy="38%" r="70%">
          <stop offset="0" stopColor={c2} />
          <stop offset="1" stopColor={c1} />
        </radialGradient>
        <clipPath id={`cl-${id}`}><rect x="0" y="0" width="96" height="96" rx="14" /></clipPath>
      </defs>
      <rect x="0" y="0" width="96" height="96" rx="14" fill={`url(#bg-${id})`} />
      <g clipPath={`url(#cl-${id})`} opacity={0.55}>
        <path d="M-6 78c14-8 24-2 36-6s20-10 34-4 22 6 38-2v40H-6z" fill="#fff" opacity={0.35} />
        <path d="M-6 86c18-6 30 0 46-4s26-6 40 0 18 2 22 0v20H-6z" fill="#fff" opacity={0.45} />
      </g>
    </>
  );
}

/** 小さなきらめき（4つの角の星） */
export function Spark({ x, y, r = 4, fill = K.light2 }: { x: number; y: number; r?: number; fill?: string }) {
  const q = r * 0.28;
  return <path d={`M${x} ${y - r}Q${x + q} ${y - q} ${x + r} ${y}Q${x + q} ${y + q} ${x} ${y + r}Q${x - q} ${y + q} ${x - r} ${y}Q${x - q} ${y - q} ${x} ${y - r}z`} fill={fill} stroke={INK} strokeWidth={1.2} strokeLinejoin="round" />;
}

/** 目（白目なしの丸目＋光） */
export function Eye({ x, y, r = 2.6, color = INK, glint = true }: { x: number; y: number; r?: number; color?: string; glint?: boolean }) {
  return (
    <g>
      <ellipse cx={x} cy={y} rx={r * 0.9} ry={r} fill={color} />
      {glint && <circle cx={x + r * 0.3} cy={y - r * 0.4} r={r * 0.35} fill="#fff" />}
    </g>
  );
}

/** 光る目（魔物用） */
export function GlowEye({ x, y, r = 3, color = K.thunder2, slit = false }: { x: number; y: number; r?: number; color?: string; slit?: boolean }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r + 1.6} fill={color} opacity={0.35} />
      <ellipse cx={x} cy={y} rx={r} ry={r * 0.9} fill={color} stroke={INK} strokeWidth={1.4} />
      {slit ? <ellipse cx={x} cy={y} rx={r * 0.25} ry={r * 0.8} fill={INK} /> : <circle cx={x} cy={y} r={r * 0.4} fill={INK} />}
    </g>
  );
}
