// 資源・属性・種族・状態の小さなアイコン（32×32 の下絵。24px 以上で使う想定）
import type { ReactNode } from 'react';
import { INK, K } from './common';

const S = { stroke: INK, strokeWidth: 1.8, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
const N = { ...S, fill: 'none' };

const ICONS: Record<string, { jp: string; d: ReactNode }> = {
  // ---- 資源
  wood: { jp: '木材', d: <>
    <rect x="4" y="15" width="22" height="8" rx="4" fill={K.wood} {...S} transform="rotate(-18 15 19)" />
    <rect x="6" y="8" width="22" height="8" rx="4" fill={K.wood3} {...S} transform="rotate(14 17 12)" />
    <ellipse cx="26" cy="15" rx="3" ry="4" fill={K.parch2} {...S} transform="rotate(14 26 15)" />
    <path d="M10 10l8 2" {...N} strokeWidth={1.2} /></> },
  iron: { jp: '鉄', d: <>
    <path d="M5 22l4-9h14l4 9z" fill={K.steel} {...S} />
    <path d="M9 13l2-5h10l2 5z" fill={K.steel3} {...S} />
    <path d="M12 10h6" {...N} stroke="#fff" strokeWidth={1.6} /></> },
  herb: { jp: '薬草', d: <>
    <path d="M16 28V12" {...N} stroke={K.moss} strokeWidth={2.2} />
    <path d="M16 12c-6 0-9-4-8-9 6 0 9 4 8 9z" fill={K.moss2} {...S} />
    <path d="M16 18c5 0 9-3 9-8-5 0-9 3-9 8z" fill={K.moss3} {...S} />
    <path d="M16 23c-5 0-8-2-9-6 5-1 8 2 9 6z" fill={K.moss2} {...S} /></> },
  mana: { jp: '魔石', d: <>
    <circle cx="16" cy="16" r="12" fill={K.dark3} opacity={0.35} />
    <path d="M16 3l8 9-8 17-8-17z" fill={K.dark3} {...S} />
    <path d="M8 12h16M16 3l-3 9 3 17 3-17z" {...N} strokeWidth={1.2} />
    <path d="M12 9l2-3" {...N} stroke="#fff" strokeWidth={1.6} /></> },
  food: { jp: '食料', d: <>
    <path d="M18 14c4-6 12-4 11 3-1 6-8 8-12 5z" fill={K.blood2} {...S} />
    <path d="M17 21l-8 6" {...N} stroke={INK} strokeWidth={4.6} /><path d="M17 21l-8 6" {...N} stroke={K.bone} strokeWidth={2.4} />
    <circle cx="7" cy="26" r="2.6" fill={K.bone} {...S} /><circle cx="9" cy="29" r="2.2" fill={K.bone} {...S} />
    <path d="M22 13c2 0 4 1 5 3" {...N} stroke="#fff" strokeWidth={1.4} /></> },
  gold: { jp: '金貨', d: <>
    <ellipse cx="16" cy="24" rx="10" ry="4" fill={K.gold} {...S} />
    <ellipse cx="16" cy="19" rx="10" ry="4" fill={K.gold} {...S} />
    <ellipse cx="16" cy="13" rx="10" ry="4.4" fill={K.gold2} {...S} />
    <path d="M13 13h6" {...N} strokeWidth={1.4} /></> },
  mat: { jp: '素材', d: <>
    <path d="M8 6c8 2 12 10 10 22-4-4-8-12-10-22z" fill={K.bone} {...S} />
    <path d="M18 10c5 0 9 3 10 8-3 2-7 2-10 0-1-3-1-5 0-8z" fill={K.moss2} {...S} />
    <path d="M21 13c2 0 4 2 5 4" {...N} strokeWidth={1.1} /></> },
  // ---- 属性
  fire: { jp: '炎', d: <>
    <path d="M16 29c-7 0-10-5-8-11 1-4 4-5 4-10 4 2 5 6 4 9 2-1 3-3 3-6 5 4 7 9 6 12-1 4-4 6-9 6z" fill={K.fire} {...S} />
    <path d="M16 26c-3 0-4-2-3-5 1-2 2-2 2-4 2 1 4 3 4 5 0 3-1 4-3 4z" fill={K.fire3} /></> },
  ice: { jp: '氷', d: <>
    <path d="M16 3v26M5 9.5l22 13M5 22.5l22-13" {...N} stroke={INK} strokeWidth={4.4} />
    <path d="M16 3v26M5 9.5l22 13M5 22.5l22-13" {...N} stroke={K.ice2} strokeWidth={2} />
    <path d="M13 5l3 3 3-3M13 27l3-3 3 3" {...N} stroke={K.ice} strokeWidth={1.6} />
    <circle cx="16" cy="16" r="3" fill={K.ice} {...S} /></> },
  thunder: { jp: '雷', d: <path d="M19 2L7 18h7l-3 12 14-17h-7l4-11z" fill={K.thunder} {...S} /> },
  light: { jp: '光', d: <>
    {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => <path key={a} d="M16 2l2 6h-4z" fill={K.gold2} {...S} strokeWidth={1.2} transform={`rotate(${a} 16 16)`} />)}
    <circle cx="16" cy="16" r="7" fill={K.light} {...S} /></> },
  dark: { jp: '闇', d: <>
    <path d="M22 4a12 12 0 1 0 6 20A10 10 0 0 1 22 4z" fill={K.dark} {...S} />
    <circle cx="13" cy="17" r="2.6" fill={K.dark3} {...S} strokeWidth={1.2} /><circle cx="13" cy="17" r="1" fill={INK} /></> },
  // ---- 種族
  beast: { jp: '獣', d: <>
    <ellipse cx="16" cy="21" rx="7" ry="6" fill={K.leather2} {...S} />
    {[[7, 13], [12, 8], [20, 8], [25, 13]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx="3" ry="3.6" fill={K.leather2} {...S} />)}</> },
  undead: { jp: '亡者', d: <>
    <path d="M6 15c0-7 4-11 10-11s10 4 10 11c0 4-2 6-4 7v5H10v-5c-2-1-4-3-4-7z" fill={K.bone} {...S} />
    <circle cx="12" cy="15" r="2.6" fill={INK} /><circle cx="20" cy="15" r="2.6" fill={INK} />
    <path d="M13 24v3M16 24v3M19 24v3" {...N} strokeWidth={1.2} /></> },
  spirit: { jp: '精霊', d: <>
    <path d="M16 29c-7 0-10-5-9-10 1-6 6-7 6-14 6 3 12 9 12 16 0 5-4 8-9 8z" fill={K.ice2} {...S} />
    <circle cx="13" cy="20" r="1.6" fill={INK} /><circle cx="19" cy="20" r="1.6" fill={INK} /></> },
  dragon: { jp: '竜', d: <>
    <path d="M4 20c2-8 10-12 18-10l6-6-1 8c2 2 2 6 0 8-4 2-8 2-10 6-4-2-10-2-13-6z" fill={K.fire} {...S} />
    <path d="M10 12l-2-6 6 4zM16 10l1-6 4 6z" fill={K.bone} {...S} strokeWidth={1.4} />
    <circle cx="21" cy="15" r="1.8" fill={K.thunder2} {...S} strokeWidth={1} /></> },
  humanoid: { jp: '人型', d: <>
    <path d="M5 29c0-6 5-10 11-10s11 4 11 10z" fill={K.leather} {...S} />
    <circle cx="16" cy="12" r="7" fill={K.skin[1]} {...S} />
    <path d="M9 10c1-5 4-7 7-7s6 2 7 7c-4-1-10-1-14 0z" fill={K.steel} {...S} /></> },
  // ---- 状態・点数
  fame: { jp: '名声', d: <>
    <path d="M16 3l4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1z" fill={K.gold2} {...S} />
    <path d="M16 9v8" {...N} stroke="#fff" strokeWidth={1.4} /></> },
  power: { jp: '戦力', d: <>
    <path d="M24 3l5 1-1 5-14 14-4-4z" fill={K.steel3} {...S} />
    <path d="M7 17l8 8M9 25l-4 4" {...N} stroke={INK} strokeWidth={4} /><path d="M7 17l8 8M9 25l-4 4" {...N} stroke={K.gold} strokeWidth={2} /></> },
  defense: { jp: '防御', d: <>
    <path d="M16 3l11 4v8c0 7-5 12-11 14-6-2-11-7-11-14V7z" fill={K.steel} {...S} />
    <path d="M16 7l7 3v5c0 5-3 8-7 10z" fill={K.steel3} /></> },
  injury: { jp: '負傷', d: <>
    <rect x="4" y="11" width="24" height="10" rx="5" fill={K.parch} {...S} transform="rotate(-35 16 16)" />
    <rect x="12" y="12" width="8" height="8" fill={K.blood2} {...S} strokeWidth={1.2} transform="rotate(-35 16 16)" /></> },
  companion: { jp: '仲間', d: <>
    <path d="M4 29c0-6 5-10 12-10s12 4 12 10z" fill={K.moss} {...S} />
    <circle cx="16" cy="11" r="7" fill={K.skin[0]} {...S} />
    <path d="M9 10c0-5 3-7 7-7s7 2 7 7c-3-2-5-2-7-2s-4 0-7 2z" fill={K.wood} {...S} /></> },
  bed: { jp: '寝床', d: <>
    <path d="M3 25V9M29 25v-7" {...N} strokeWidth={2.4} />
    <rect x="3" y="16" width="26" height="6" rx="1" fill={K.wood3} {...S} />
    <rect x="5" y="11" width="8" height="5" rx="2.5" fill="#fff" {...S} />
    <path d="M13 16c2-3 10-3 16 0" fill={K.blood2} {...S} /></> },
  wall: { jp: '防壁', d: <>
    <path d="M3 29V12h4V8h4v4h4V8h4v4h4V8h4v4h2v17z" fill={K.steel} {...S} />
    <path d="M3 18h26M3 24h26M10 18v6M22 18v6M16 24v5M16 12v6" {...N} strokeWidth={1.2} /></> },
  trophy: { jp: '討伐の証', d: <>
    <path d="M6 6c4 6 16 6 20 0" {...N} strokeWidth={1.6} />
    <path d="M10 9c0 8 2 14 6 20 4-6 6-12 6-20-4 2-8 2-12 0z" fill={K.bone} {...S} />
    <circle cx="16" cy="14" r="2.6" fill={K.blood} {...S} strokeWidth={1.2} /></> },
  fate: { jp: '運命', d: <>
    <rect x="5" y="5" width="15" height="21" rx="2" fill={K.night2} {...S} transform="rotate(-10 12 15)" />
    <rect x="12" y="7" width="15" height="21" rx="2" fill={K.parch} {...S} transform="rotate(8 19 17)" />
    <path d="M19 12l2 4 4 .5-3 3 1 4-4-2-4 2 1-4-3-3 4-.5z" fill={K.thunder} {...S} strokeWidth={1.1} transform="rotate(8 19 17)" /></> },
  skill: { jp: '熟練', d: <>
    <path d="M6 20l10-8 10 8M6 27l10-8 10 8" {...N} stroke={INK} strokeWidth={5} />
    <path d="M6 20l10-8 10 8M6 27l10-8 10 8" {...N} stroke={K.gold2} strokeWidth={2.6} />
    <circle cx="16" cy="6" r="3" fill={K.gold2} {...S} /></> },
  quest: { jp: '依頼', d: <>
    <rect x="6" y="4" width="20" height="24" rx="2" fill={K.parch} {...S} />
    <path d="M10 10h12M10 15h12M10 20h7" {...N} strokeWidth={1.4} />
    <circle cx="22" cy="23" r="4" fill={K.blood} {...S} strokeWidth={1.2} /></> },
  upkeep: { jp: '維持費', d: <>
    <path d="M5 13h22l-2 12c0 2-2 3-4 3H11c-2 0-4-1-4-3z" fill={K.steel2} {...S} />
    <path d="M3 13h26" {...N} strokeWidth={2.4} />
    <path d="M12 9c-1-2 1-3 0-5M18 9c-1-2 1-3 0-5" {...N} strokeWidth={1.4} /></> },
  discontent: { jp: '不満', d: <>
    <circle cx="16" cy="16" r="12" fill={K.blood2} {...S} />
    <path d="M10 12l4 2M22 12l-4 2" {...N} strokeWidth={2} /><path d="M11 23c3-3 7-3 10 0" {...N} strokeWidth={2} /></> },
  raid: { jp: '襲撃', d: <>
    <path d="M3 28l4-14 4 6 5-14 5 14 4-6 4 14z" fill={K.blood} {...S} />
    <path d="M14 16h4" {...N} stroke="#fff" strokeWidth={1.4} /></> },
  familiar: { jp: '使い魔', d: <>
    <circle cx="16" cy="18" r="10" fill={K.dark3} {...S} />
    <path d="M8 12L7 3l6 5zM24 12l1-9-6 5z" fill={K.dark3} {...S} />
    <circle cx="12" cy="17" r="2" fill={K.thunder2} {...S} strokeWidth={1} /><circle cx="20" cy="17" r="2" fill={K.thunder2} {...S} strokeWidth={1} /></> },
};

export type KIconName = keyof typeof ICONS;
export const KICON_NAMES = Object.keys(ICONS);
export const KICON_JP: Record<string, string> = Object.fromEntries(Object.entries(ICONS).map(([k, v]) => [k, v.jp]));

/** label を渡すと読み上げ名に（渡さなければ飾り扱い。label={true} で日本語名を読む） */
export function KIcon({ name, size = 24, label }: { name: string; size?: number; label?: string | boolean }) {
  const ic = ICONS[name];
  if (!ic) return null;
  const l = label === true ? ic.jp : label || undefined;
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} role={l ? 'img' : undefined} aria-label={l} aria-hidden={l ? undefined : true} style={{ display: 'inline-block', verticalAlign: 'middle', flex: 'none' }}>
      {ic.d}
    </svg>
  );
}
