// 魔物30体の絵。種族ごとに背景の色を変え、形でも見分けられるようにする
import type { ReactNode } from 'react';
import { INK, K, O, L, T, MistBg, Eye, GlowEye, Spark } from './common';
import { Figure, type FigureSpec } from './figure';

export type Race = 'beast' | 'undead' | 'spirit' | 'dragon' | 'humanoid';
/** 種族の背景（外・中心） */
export const RACE_BG: Record<Race, [string, string]> = {
  beast: ['#8DAE7E', '#DCE8C4'],
  undead: ['#7E7894', '#D2CDE0'],
  spirit: ['#6FA9B4', '#D4EEF0'],
  dragon: ['#C07A5A', '#F4D2B6'],
  humanoid: ['#A88B66', '#EEDFC4'],
};
export const RACE_JP: Record<Race, string> = { beast: '獣', undead: '亡者', spirit: '精霊', dragon: '竜', humanoid: '人型' };

const Shadow = ({ w = 26 }: { w?: number }) => <ellipse cx="48" cy="88" rx={w} ry="4" fill={INK} opacity={0.18} />;
/** 輪郭つき太線（しっぽ・首など） */
const Tube = ({ d, c, w = 5 }: { d: string; c: string; w?: number }) => (
  <g><path d={d} {...L} stroke={INK} strokeWidth={w + 2.6} /><path d={d} {...L} stroke={c} strokeWidth={w} /></g>
);

// ---------------------------------------------------------------- 1年目
const rat = () => (
  <g>
    <Shadow />
    <Tube d="M64 78c14 4 22-4 20-14s-8-10-4-16" c="#E9A2A6" w={3} />
    <ellipse cx="48" cy="70" rx="22" ry="16" fill="#8E8A9A" {...O} />
    <ellipse cx="48" cy="73" rx="12" ry="10" fill="#D8D2DC" />
    <circle cx="32" cy="28" r="9" fill="#8E8A9A" {...O} /><circle cx="32" cy="28" r="4.6" fill="#E9A2A6" />
    <circle cx="64" cy="28" r="9" fill="#8E8A9A" {...O} /><circle cx="64" cy="28" r="4.6" fill="#E9A2A6" />
    <circle cx="48" cy="44" r="17" fill="#8E8A9A" {...O} />
    <ellipse cx="48" cy="52" rx="9" ry="6.5" fill="#D8D2DC" {...O} strokeWidth={2} />
    <ellipse cx="48" cy="47.5" rx="3" ry="2.2" fill="#E07A8A" {...O} strokeWidth={1.4} />
    <rect x="45" y="56" width="6" height="6" rx="1" fill="#fff" {...O} strokeWidth={1.6} /><path d="M48 56v6" {...T} strokeWidth={1} />
    <GlowEye x={40} y={41} r={2.6} color={K.blood2} /><GlowEye x={56} y={41} r={2.6} color={K.blood2} />
    <path d="M38 52l-10-2M38 55l-10 2M58 52l10-2M58 55l10 2" {...T} />
    <path d="M32 66l10 10-3 3-10-9z" fill={K.fire2} {...O} strokeWidth={1.8} />
    <path d="M29 68c-4-4-4-8-2-10M30 67c-2-6 0-8 3-9" {...L} stroke={K.moss} strokeWidth={2} />
    <ellipse cx="40" cy="74" rx="5" ry="3.6" fill="#8E8A9A" {...O} strokeWidth={2} />
    <ellipse cx="56" cy="74" rx="5" ry="3.6" fill="#8E8A9A" {...O} strokeWidth={2} />
  </g>
);

const imp = () => (
  <g>
    <Shadow w={16} />
    <path d="M40 78c-8 4-12 10-10 14 4-2 8-2 10-6 2 4 6 6 10 4-2-4-2-8-4-12z" fill={K.mist2} {...O} strokeWidth={2} opacity={0.9} />
    <path d="M30 34l-10-14 16 6zM66 34l10-14-16 6z" fill={K.night2} {...O} />
    <path d="M28 48c0-14 8-22 20-22s20 8 20 22c0 14-8 26-20 30-12-4-20-16-20-30z" fill="#9AA6C4" {...O} />
    <path d="M22 50c-6-2-10 2-10 6 4-1 8 0 10 2zM74 50c6-2 10 2 10 6-4-1-8 0-10 2z" fill="#9AA6C4" {...O} strokeWidth={2} />
    <GlowEye x={40} y={46} r={4} color={K.light} />
    <GlowEye x={56} y={46} r={4} color={K.light} />
    <path d="M38 58c4 6 16 6 20 0-2 6-6 8-10 8s-8-2-10-8z" fill={K.night} {...O} strokeWidth={2} />
    <path d="M42 59l2 3 2-3M50 59l2 3 2-3" fill="#fff" stroke="none" />
    <path d="M16 20c4 0 6 2 6 6M78 70c4 0 6 2 6 6M10 64c3 0 4 2 4 4" {...T} stroke="#fff" strokeWidth={2} />
  </g>
);

const boar = () => (
  <g>
    <Shadow w={30} />
    <path d="M30 80v8M40 82v6M64 82v6M74 80v8" {...L} stroke={INK} strokeWidth={6} />
    <path d="M30 80v8M40 82v6M64 82v6M74 80v8" {...L} stroke="#6B4A33" strokeWidth={3.4} />
    <path d="M22 64c0-14 12-24 30-24 18 0 30 8 30 22 0 12-10 20-30 20-18 0-30-6-30-18z" fill="#8A5E40" {...O} />
    <path d="M34 42l4-8 4 6 4-8 4 8 4-6 3 8 5-4 1 8" fill="#5A3B28" {...O} strokeWidth={2} />
    <path d="M80 60c4-2 8 0 8 4" {...L} />
    <path d="M14 60c0-10 8-16 18-16 6 0 10 4 10 10v12c0 6-6 10-14 10-8 0-14-6-14-16z" fill="#9C6C4A" {...O} />
    <path d="M24 44l-2-8 8 5z" fill="#9C6C4A" {...O} strokeWidth={2} />
    <ellipse cx="18" cy="66" rx="7" ry="6" fill="#D9A48A" {...O} strokeWidth={2} />
    <circle cx="16" cy="66" r="1.4" fill={INK} /><circle cx="20.5" cy="66" r="1.4" fill={INK} />
    <path d="M24 72c-2-6-8-10-12-8 2 2 4 4 6 10z" fill={K.bone} {...O} strokeWidth={1.8} />
    <path d="M30 70c2-6 0-12-4-14 0 4 0 8-2 12z" fill={K.bone} {...O} strokeWidth={1.8} />
    <GlowEye x={30} y={54} r={2.8} color={K.fire2} />
    <path d="M26 50l8 2" {...L} strokeWidth={2} />
  </g>
);

const skel = () => (
  <g>
    <Shadow w={20} />
    <path d="M70 18l6 50" {...L} stroke={INK} strokeWidth={5} /><path d="M70 18l6 50" {...L} stroke={K.steel2} strokeWidth={2.4} />
    <path d="M66 66h14" {...L} stroke={INK} strokeWidth={4} />
    <path d="M38 62h20v6H38z" fill={K.bone} {...O} strokeWidth={2} />
    <path d="M34 68c0 10 6 18 14 18s14-8 14-18z" fill={K.night2} {...O} />
    {[72, 77, 82].map((y) => <path key={y} d={`M38 ${y}h20`} {...L} stroke={K.bone} strokeWidth={2.6} />)}
    <path d="M48 66v20" {...L} stroke={K.bone} strokeWidth={2.4} />
    <path d="M34 70c-8 0-12 4-14 10M62 70c4 0 8-2 10-6" {...L} stroke={INK} strokeWidth={5} />
    <path d="M34 70c-8 0-12 4-14 10M62 70c4 0 8-2 10-6" {...L} stroke={K.bone} strokeWidth={2.6} />
    <path d="M30 40c0-12 8-20 18-20s18 8 18 20c0 8-4 12-8 14v6H38v-6c-4-2-8-6-8-14z" fill={K.bone} {...O} />
    <path d="M28 34c0-10 8-18 20-18s20 8 20 18c-8-3-14-4-20-4s-12 1-20 4z" fill="#8C6E4A" {...O} />
    <path d="M28 34c6-3 14-4 20-4s14 1 20 4" {...L} stroke={K.gold} strokeWidth={2} />
    <ellipse cx="41" cy="42" rx="5" ry="5.4" fill={INK} /><ellipse cx="55" cy="42" rx="5" ry="5.4" fill={INK} />
    <circle cx="41" cy="42" r="1.8" fill={K.ice} /><circle cx="55" cy="42" r="1.8" fill={K.ice} />
    <path d="M46 50l2-3 2 3z" fill={INK} />
    <path d="M42 56v4M46 56v4M50 56v4M54 56v4" {...T} />
  </g>
);

const slime = () => (
  <g>
    <Shadow w={28} />
    <path d="M18 82c-4-20 8-44 30-46 22 2 34 26 30 46-2 6-56 6-60 0z" fill="#86C06A" {...O} />
    <path d="M26 82c2 4 4 6 2 8M70 82c-2 4 0 6 2 8" {...L} stroke="#86C06A" strokeWidth={4} />
    <path d="M28 52c4-8 10-10 14-10" {...L} stroke="#D8F0B8" strokeWidth={4} />
    <circle cx="62" cy="62" r="3.4" fill="#D8F0B8" opacity={0.8} /><circle cx="30" cy="70" r="2.4" fill="#D8F0B8" opacity={0.8} />
    <Eye x={40} y={62} r={4} /><Eye x={58} y={62} r={4} />
    <path d="M44 72c2 2 6 2 8 0" {...L} strokeWidth={2} />
    <path d="M48 36c-2-8 2-12 8-14-2 4 0 8-4 12zM48 36c-4-4-8-4-12-2 4 2 6 4 12 2z" fill={K.moss} {...O} strokeWidth={1.8} />
    <circle cx="76" cy="40" r="3" fill="none" {...T} /><circle cx="82" cy="30" r="2" fill="none" {...T} />
  </g>
);

const wolf = (ice = false) => {
  const fur = ice ? '#BFD8E8' : '#7E8492', fur2 = ice ? '#EAF6FC' : '#C9CDD6', eye = ice ? K.ice : K.thunder2;
  return (
    <g>
      <Shadow />
      <path d="M26 34L20 10l16 14zM70 34l6-24-16 14z" fill={fur} {...O} />
      <path d="M24 30l-2-12 8 8zM72 30l2-12-8 8z" fill={K.blood2} />
      <path d="M16 46c0-16 14-24 32-24s32 8 32 24c0 8-4 12-8 16l-6 14c-4 8-10 12-18 12s-14-4-18-12l-6-14c-4-4-8-8-8-16z" fill={fur} {...O} />
      <path d="M16 46c6 4 10 10 12 16-6-2-10-6-12-16zM80 46c-6 4-10 10-12 16 6-2 10-6 12-16z" fill={fur2} {...O} strokeWidth={2} />
      <path d="M36 58c0-6 6-8 12-8s12 2 12 8v10c0 8-6 14-12 14s-12-6-12-14z" fill={fur2} {...O} />
      <ellipse cx="48" cy="60" rx="5" ry="3.6" fill={INK} />
      <path d="M40 74l4 6 4-4 4 4 4-6" fill="none" {...L} strokeWidth={2} />
      <path d="M42 76l1 4 2-2zM54 76l-1 4-2-2z" fill={ice ? K.ice2 : '#fff'} {...O} strokeWidth={1} />
      <GlowEye x={36} y={46} r={3.4} color={eye} slit /><GlowEye x={60} y={46} r={3.4} color={eye} slit />
      <path d="M30 40l10 3M66 40l-10 3" {...L} strokeWidth={2.2} />
      {ice && <><path d="M10 20l4 4M14 20l-4 4M84 70l4 4M88 70l-4 4" {...T} stroke="#fff" strokeWidth={2} /><Spark x={86} y={20} r={3} fill={K.ice3} /></>}
    </g>
  );
};

const goblin = () => (
  <g>
    <Shadow w={22} />
    <path d="M58 70c8-2 16 2 18 10 2 6-4 10-10 10-8 0-12-4-12-10z" fill={K.parch3} {...O} />
    <path d="M60 70c2-4 8-4 10 0" {...L} />
    <text x="62" y="86" fontSize="10" fontWeight="900" fill={K.gold}>¤</text>
    <path d="M26 98c0-16 10-24 22-24s22 8 22 24z" fill="#5A4A3A" {...O} />
    <path d="M14 40l14 8-2 6zM82 40l-14 8 2 6z" fill="#8DB86A" {...O} />
    <path d="M28 50c0-14 8-22 20-22s20 8 20 22c0 10-8 18-20 18s-20-8-20-18z" fill="#8DB86A" {...O} />
    <path d="M24 52c-2-18 8-30 24-30s26 12 24 30c-4-10-12-16-24-16s-20 6-24 16z" fill="#4A3F55" {...O} />
    <GlowEye x={40} y={50} r={3} color={K.thunder2} slit /><GlowEye x={56} y={50} r={3} color={K.thunder2} slit />
    <path d="M36 46l8 2M60 46l-8 2" {...L} strokeWidth={2} />
    <path d="M40 60c4 3 12 3 16 0" {...L} strokeWidth={2} />
    <path d="M43 61l1 3 2-2.5M51 61.5l1 3 1.5-3" fill="#fff" {...T} strokeWidth={0.8} />
    <g transform="rotate(-30 30 80)"><path d="M28 56h4v18h-4z" fill={K.steel3} {...O} strokeWidth={1.8} /><rect x="25" y="73" width="10" height="3" rx="1.5" fill={K.leather} {...O} strokeWidth={1.4} /></g>
  </g>
);

const bat = () => (
  <g>
    <Shadow w={18} />
    <path d="M40 50C30 34 16 32 4 40c6 2 8 8 6 14 6-4 10-2 12 4 4-6 10-6 14-2z" fill="#5A4A6A" {...O} />
    <path d="M56 50c10-16 24-18 36-10-6 2-8 8-6 14-6-4-10-2-12 4-4-6-10-6-14-2z" fill="#5A4A6A" {...O} />
    <path d="M10 44l10 6M20 38l4 12M86 44l-10 6M76 38l-4 12" {...T} stroke="#8B79A0" />
    <path d="M38 36l-4-14 10 8zM58 36l4-14-10 8z" fill="#6C5A7E" {...O} />
    <ellipse cx="48" cy="54" rx="14" ry="18" fill="#6C5A7E" {...O} />
    <ellipse cx="48" cy="60" rx="8" ry="10" fill="#9A88AE" />
    <GlowEye x={42} y={46} r={3} color={K.blood2} /><GlowEye x={54} y={46} r={3} color={K.blood2} />
    <path d="M46 52l2 2 2-2" {...T} />
    <path d="M43 56l2 5 2-5M49 56l2 5 2-5" fill="#fff" {...T} strokeWidth={1} />
    <path d="M42 72l-2 6M54 72l2 6" {...L} strokeWidth={2.4} />
  </g>
);

const wisp = () => (
  <g>
    <circle cx="48" cy="54" r="30" fill={K.ice2} opacity={0.35} />
    <path d="M48 86c-16 0-24-10-22-24 2-10 8-14 8-24 6 4 8 10 8 16 2-6 6-12 4-24 12 8 18 20 18 32 2-4 2-8 0-12 6 6 8 14 6 20-2 10-12 16-22 16z" fill={K.ice} {...O} />
    <path d="M48 80c-8 0-14-6-12-14 1-6 6-8 8-14 4 4 4 8 4 12 2-2 4-4 4-8 6 6 8 12 6 16-2 6-6 8-10 8z" fill={K.ice3} />
    <ellipse cx="42" cy="66" rx="2.6" ry="3.4" fill={INK} /><ellipse cx="54" cy="66" rx="2.6" ry="3.4" fill={INK} />
    <path d="M45 74c2 1.4 4 1.4 6 0" {...L} strokeWidth={1.8} />
    <circle cx="18" cy="30" r="3" fill={K.ice} {...T} /><circle cx="80" cy="24" r="2.4" fill={K.ice} {...T} /><circle cx="78" cy="78" r="2" fill={K.ice} {...T} />
  </g>
);

const spider = (queen = false) => (
  <g>
    <Shadow w={34} />
    {[-1, 1].map((sd) => [0, 1, 2, 3].map((i) => {
      const y = 50 + i * 7, x = 48 + sd * 14;
      const kx = 48 + sd * (28 + i * 2), ky = y - 14 + i * 2, fx = 48 + sd * (38 + i * 2), fy = y + 18 + i * 2;
      return <Tube key={`${sd}${i}`} d={`M${x} ${y}L${kx} ${ky}L${fx} ${fy}`} c={queen ? '#3A2E48' : '#4A3B3A'} w={3} />;
    }))}
    <ellipse cx="48" cy="68" rx="20" ry="16" fill={queen ? '#3A2E48' : '#5A4440'} {...O} />
    <path d="M40 62l8 6 8-6M44 74h8" {...L} stroke={queen ? K.blood2 : K.fire2} strokeWidth={2.4} />
    <circle cx="48" cy="46" r="13" fill={queen ? '#4A3B5E' : '#6A524C'} {...O} />
    {[[42, 44], [54, 44], [46, 40], [50, 40], [40, 49], [56, 49]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i < 2 ? 3 : 1.8} fill={K.blood2} stroke={INK} strokeWidth={1} />)}
    <path d="M44 56c-2 4-1 6 1 8M52 56c2 4 1 6-1 8" {...L} stroke={K.bone} strokeWidth={2.4} />
    {queen && <path d="M36 36l4-10 4 6 4-10 4 10 4-6 4 10z" fill={K.gold2} {...O} strokeWidth={2} />}
  </g>
);

// ---------------------------------------------------------------- 2年目
const frog = () => (
  <g>
    <Shadow w={30} />
    <path d="M14 84c0-8 6-12 12-10l6 10zM82 84c0-8-6-12-12-10l-6 10z" fill="#6E9A4A" {...O} />
    <path d="M18 70c0-20 14-34 30-34s30 14 30 34c0 10-12 16-30 16S18 80 18 70z" fill="#7FAE58" {...O} />
    <path d="M30 72c4 6 10 8 18 8s14-2 18-8c-4 2-10 4-18 4s-14-2-18-4z" fill="#E8E2A8" {...O} strokeWidth={2} />
    <circle cx="34" cy="38" r="10" fill="#7FAE58" {...O} /><circle cx="62" cy="38" r="10" fill="#7FAE58" {...O} />
    <circle cx="34" cy="38" r="6" fill={K.thunder2} {...O} strokeWidth={1.6} /><rect x="32.6" y="33" width="2.8" height="10" rx="1.4" fill={INK} />
    <circle cx="62" cy="38" r="6" fill={K.thunder2} {...O} strokeWidth={1.6} /><rect x="60.6" y="33" width="2.8" height="10" rx="1.4" fill={INK} />
    <path d="M28 60c10 6 30 6 40 0" {...L} strokeWidth={2.4} />
    <Tube d="M48 62c2 8 12 12 22 8" c={K.blood2} w={3.4} />
    <circle cx="70" cy="70" r="4" fill={K.blood2} {...O} strokeWidth={1.8} />
    {[[30, 52], [64, 52], [40, 48]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.4" fill="#5A8A3A" />)}
  </g>
);

const golem = () => (
  <g>
    <Shadow w={32} />
    <path d="M14 56l8-10 10 4 2 18-8 6-12-4z" fill="#9AA0A6" {...O} />
    <path d="M82 56l-8-10-10 4-2 18 8 6 12-4z" fill="#9AA0A6" {...O} />
    <path d="M12 74l12-2 4 10-6 6-10-4zM84 74l-12-2-4 10 6 6 10-4z" fill="#848A92" {...O} />
    <path d="M28 46l20-6 20 6 4 28-10 12H34L24 74z" fill="#B0B6BC" {...O} />
    <path d="M34 22l14-4 14 4 4 16-8 8H38l-8-8z" fill="#B0B6BC" {...O} />
    <path d="M36 54l6 4-2 8M58 52l-4 8 6 6M46 70l4 6" {...T} stroke="#6E747C" strokeWidth={1.6} />
    <circle cx="48" cy="60" r="7" fill={K.ice} opacity={0.35} />
    <path d="M48 54l4 6-4 6-4-6z" fill={K.ice2} {...O} strokeWidth={1.8} />
    <rect x="38" y="30" width="7" height="4" rx="1.5" fill={K.ice2} {...O} strokeWidth={1.4} />
    <rect x="51" y="30" width="7" height="4" rx="1.5" fill={K.ice2} {...O} strokeWidth={1.4} />
    <path d="M30 26c-2-4 0-8 4-8M62 18c4-2 8 0 8 4" {...L} stroke={K.moss} strokeWidth={3} />
  </g>
);

const ghoul = () => (
  <g>
    <Shadow w={26} />
    <path d="M20 98c0-18 12-32 28-32s28 14 28 32z" fill="#6C7A6A" {...O} />
    <path d="M22 76c-8 2-12 8-12 16M74 76c8 2 12 8 12 16" {...L} stroke={INK} strokeWidth={6} />
    <path d="M22 76c-8 2-12 8-12 16M74 76c8 2 12 8 12 16" {...L} stroke="#9AAE94" strokeWidth={3.4} />
    <path d="M6 90l2 8M10 90l2 8M14 92l0 6M82 92l0 6M86 90l-2 8M90 90l-2 8" {...L} stroke={K.bone} strokeWidth={2.4} />
    <path d="M30 44c0-14 8-22 18-22s18 8 18 22c0 6-2 12-6 16l-2 8H38l-2-8c-4-4-6-10-6-16z" fill="#9AAE94" {...O} />
    <path d="M30 40c4-10 10-14 18-14s14 4 18 14c-4-4-8-6-10-6l-2 4-4-4-4 4-2-4c-4 0-10 2-14 6z" fill="#4A4E5A" {...O} strokeWidth={2} />
    <GlowEye x={40} y={46} r={3.4} color={K.blood2} /><GlowEye x={56} y={46} r={3.4} color={K.blood2} />
    <path d="M40 58h16v6H40z" fill={INK} />
    <path d="M41 58l2 4 2-4 2 4 2-4 2 4 2-4 2 4 1-4" fill="#fff" stroke="none" />
    <path d="M28 70c4 4 10 6 20 6s16-2 20-6" {...L} stroke="#4A5A4A" strokeWidth={2} />
  </g>
);

const harpy = () => (
  <g>
    <Shadow w={18} />
    <path d="M38 52C26 40 10 40 4 48c8 0 12 4 12 10 6-2 10 0 12 4 2-4 6-6 10-6zM58 52c12-12 28-12 34-4-8 0-12 4-12 10-6-2-10 0-12 4-2-4-6-6-10-6z" fill="#5C7A9A" {...O} />
    <path d="M8 48l8 4M14 44l6 8M88 48l-8 4M82 44l-6 8" {...T} stroke="#9AB4CC" />
    <path d="M38 60c0-8 4-12 10-12s10 4 10 12l-2 18H40z" fill="#7E9AB8" {...O} />
    <path d="M40 78l-4 8 4-2 2 4 2-6M56 78l4 8-4-2-2 4-2-6" fill={K.gold2} {...O} strokeWidth={1.6} />
    <path d="M30 34c-2-10 6-16 18-16s20 6 18 16c4 4 4 10 0 14-2-6-6-10-8-10l-10-2-10 2c-2 0-6 4-8 10-4-4-4-10 0-14z" fill={K.night2} {...O} />
    <path d="M38 32c0-4 4-6 10-6s10 2 10 6v8c0 6-4 10-10 10s-10-4-10-10z" fill="#E4D2C4" {...O} />
    <path d="M42 36c-2 6 0 14 6 14 6 0 8-8 6-14" fill="none" />
    <GlowEye x={44} y={37} r={2} color={K.thunder2} /><GlowEye x={52} y={37} r={2} color={K.thunder2} />
    <path d="M46 44l2 2 2-2" fill={K.gold2} {...T} />
    <path d="M70 18l-4 8h5l-4 8" {...L} stroke={K.thunder} strokeWidth={2.6} />
    <path d="M22 22l-3 6h4l-3 6" {...L} stroke={K.thunder} strokeWidth={2.2} />
  </g>
);

const ogre = () => (
  <g>
    <Shadow w={30} />
    <g transform="rotate(26 74 60)"><path d="M70 30c4-4 12-4 14 2l-2 30h-8z" fill={K.wood} {...O} /><circle cx="76" cy="38" r="1.6" fill={INK} /><circle cx="80" cy="46" r="1.6" fill={INK} /></g>
    <path d="M10 98c0-20 16-32 38-32s38 12 38 32z" fill="#B0805A" {...O} />
    <path d="M30 82l36 12" {...L} stroke={K.leather} strokeWidth={6} />
    <path d="M22 46c0-18 12-28 26-28s26 10 26 28c0 14-10 24-26 24S22 60 22 46z" fill="#C49A70" {...O} />
    <path d="M22 44c-6-2-8 4-6 8 2 2 4 2 6 0M74 44c6-2 8 4 6 8-2 2-4 2-6 0" fill="#C49A70" {...O} strokeWidth={2} />
    <path d="M30 40l12 4M66 40l-12 4" {...L} strokeWidth={3} />
    <Eye x={38} y={46} r={2.8} /><Eye x={58} y={46} r={2.8} />
    <path d="M44 50c0 4 2 6 4 6s4-2 4-6" fill="#B0805A" {...O} strokeWidth={2} />
    <path d="M34 60c8 4 20 4 28 0" {...L} strokeWidth={2.4} />
    <path d="M36 61l2-8 3 7zM60 61l-2-8-3 7z" fill={K.bone} {...O} strokeWidth={1.6} />
    <path d="M40 26c2-6 6-8 8-8s6 2 8 8" {...L} stroke="#4A3428" strokeWidth={3} />
  </g>
);

const wraith = () => (
  <g>
    <circle cx="48" cy="44" r="30" fill={K.light} opacity={0.18} />
    <path d="M22 50c0-20 12-34 26-34s26 14 26 34v30l-6-6-6 10-6-8-8 10-8-10-6 8-6-10-6 6z" fill="#C8CCE0" {...O} opacity={0.95} />
    <path d="M30 50c0-12 8-22 18-22s18 10 18 22c0 8-8 14-18 14s-18-6-18-14z" fill={K.night} {...O} />
    <GlowEye x={41} y={46} r={3} color={K.ice2} /><GlowEye x={55} y={46} r={3} color={K.ice2} />
    <ellipse cx="48" cy="56" rx="4" ry="5" fill={K.ice2} opacity={0.8} />
    <path d="M14 56c-4 4-4 10 0 14M82 56c4 4 4 10 0 14" {...L} stroke="#C8CCE0" strokeWidth={5} />
    <path d="M10 30c4 2 6 6 6 10M80 24c4 2 6 4 8 8" {...T} stroke="#fff" strokeWidth={2} />
  </g>
);

const salam = () => (
  <g>
    <Shadow w={34} />
    <Tube d="M70 70c10 2 18-4 20-14" c="#D0553A" w={7} />
    <path d="M90 56c-2-6 2-10 4-12 0 4 2 6 0 12z" fill={K.fire2} {...O} strokeWidth={1.6} />
    <path d="M22 74l-4 10M34 78l-2 8M58 78l2 8M70 74l4 10" {...L} stroke={INK} strokeWidth={6} />
    <path d="M22 74l-4 10M34 78l-2 8M58 78l2 8M70 74l4 10" {...L} stroke="#D0553A" strokeWidth={3.4} />
    <path d="M16 66c0-10 12-16 32-16s30 6 30 14-12 14-30 14-32-4-32-12z" fill="#D0553A" {...O} />
    <path d="M24 52c-2-8 2-14 6-16 0 4 2 6 4 8 0-6 4-12 8-12-2 6 0 10 4 12 2-6 6-8 10-8-2 4-2 8 2 10 2-4 6-6 10-4-4 4-2 8 2 10" fill={K.fire2} {...O} strokeWidth={2} />
    <path d="M6 60c0-8 8-12 16-12 6 0 10 4 10 10s-6 10-14 10c-6 0-12-2-12-8z" fill="#E06A48" {...O} />
    <GlowEye x={20} y={56} r={3} color={K.thunder2} slit />
    <path d="M8 64c4 2 10 2 14 0" {...L} strokeWidth={1.8} />
    {[[40, 64], [52, 66], [62, 62]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.4" fill={K.fire2} />)}
  </g>
);

const bandit = () => <Figure s={BANDIT} id="m-bandit" frame={false} />;
const BANDIT: FigureSpec = { skin: 2, hair: '#4A2E1E', style: 'short', gear: 'bandana', gearColor: K.blood, outfit: 'leather', cloth: '#5A4A3A', trim: K.leather, beard: true, brows: 'sharp', eyes: 'patch', mouth: 'grin', prop: 'dagger', bg: RACE_BG.humanoid };

const treant = () => (
  <g>
    <Shadow w={30} />
    <path d="M20 30c-6-6-6-14 0-18 0 6 4 8 8 8M76 30c6-6 6-14 0-18 0 6-4 8-8 8" {...L} stroke={INK} strokeWidth={6} />
    <path d="M20 30c-6-6-6-14 0-18 0 6 4 8 8 8M76 30c6-6 6-14 0-18 0 6-4 8-8 8" {...L} stroke={K.wood} strokeWidth={3.4} />
    <circle cx="30" cy="20" r="12" fill={K.moss} {...O} /><circle cx="66" cy="18" r="12" fill={K.moss} {...O} /><circle cx="48" cy="12" r="12" fill={K.moss2} {...O} />
    <path d="M26 90c4-8 4-20 2-34 0-14 8-22 20-22s20 8 20 22c-2 14-2 26 2 34z" fill={K.wood} {...O} />
    <path d="M18 92c4-2 8-4 10-8M78 92c-4-2-8-4-10-8" {...L} stroke={K.wood2} strokeWidth={4} />
    <path d="M36 44l10 4M60 44l-10 4" {...L} strokeWidth={3} />
    <ellipse cx="40" cy="52" rx="4" ry="3.4" fill={INK} /><circle cx="40" cy="52" r="1.6" fill={K.fire2} />
    <ellipse cx="56" cy="52" rx="4" ry="3.4" fill={INK} /><circle cx="56" cy="52" r="1.6" fill={K.fire2} />
    <path d="M38 64c4-4 16-4 20 0-2 6-6 8-10 8s-8-2-10-8z" fill={INK} />
    <path d="M32 76c4 2 6 6 4 10M60 70c-2 4 0 8 4 10" {...T} stroke={K.wood2} strokeWidth={1.6} />
    <circle cx="72" cy="38" r="3" fill={K.blood2} {...T} />
  </g>
);

// ---------------------------------------------------------------- 3年目
const wyvern = (big = false) => {
  const c = big ? '#5A6E8C' : '#5E9A6A', c2 = big ? '#9CB0CC' : '#A8D4A0';
  return (
    <g>
      <Shadow w={30} />
      <path d="M44 56C34 34 14 26 4 34c6 2 8 6 8 12 6-4 12-2 14 4 4-4 10-4 14 0z" fill={c} {...O} />
      <path d="M8 36l10 14M16 32l8 18" {...T} stroke={c2} />
      <Tube d="M60 74c10 6 22 4 28-6" c={c} w={6} />
      <path d="M88 66l6-4-2 8z" fill={c} {...O} strokeWidth={1.8} />
      <path d="M30 66c0-12 8-18 20-18s18 8 18 18-8 16-18 16-20-4-20-16z" fill={c} {...O} />
      <path d="M38 64c0-6 6-10 12-10" {...L} stroke={c2} strokeWidth={4} />
      <path d="M40 80l-4 8M56 80l2 8" {...L} stroke={INK} strokeWidth={6} />
      <path d="M40 80l-4 8M56 80l2 8" {...L} stroke={c} strokeWidth={3.4} />
      <path d="M60 52C72 30 88 26 94 34c-6 2-8 6-8 12-6-4-10-2-12 4-4-4-8-4-12 0z" fill={c} {...O} />
      <Tube d="M46 52c-4-10-2-18 6-22" c={c} w={8} />
      <path d="M44 30c0-8 6-12 14-12 6 0 12 4 12 10 0 4-4 8-10 8H50c-4 0-6-2-6-6z" fill={c} {...O} />
      <path d="M48 20l-4-8 8 5zM56 18l2-8 4 8z" fill={K.bone} {...O} strokeWidth={1.8} />
      <GlowEye x={58} y={26} r={2.8} color={big ? K.ice2 : K.thunder2} slit />
      <path d="M62 34l2 3 2-3" fill="#fff" {...T} strokeWidth={0.8} />
      {big && <path d="M10 70l4-6M18 76l2-6" {...L} stroke="#fff" strokeWidth={2} />}
    </g>
  );
};

const lich = () => (
  <g>
    <Shadow w={24} />
    <path d="M74 14l-4 80" {...L} stroke={INK} strokeWidth={5} /><path d="M74 14l-4 80" {...L} stroke={K.bone2} strokeWidth={2.6} />
    <circle cx="75" cy="12" r="9" fill={K.dark3} opacity={0.4} />
    <circle cx="75" cy="12" r="5.6" fill={K.bone} {...O} strokeWidth={1.8} /><circle cx="73" cy="11" r="1.4" fill={INK} /><circle cx="77" cy="11" r="1.4" fill={INK} />
    <path d="M16 98c2-24 14-40 32-40s30 16 32 40z" fill={K.dark2} {...O} />
    <path d="M36 62l12 30 12-30" {...L} stroke={K.gold} strokeWidth={2.6} />
    <path d="M26 54c0-20 10-32 22-32s22 12 22 32c-6-6-14-8-22-8s-16 2-22 8z" fill={K.dark2} {...O} />
    <path d="M34 42c0-10 6-16 14-16s14 6 14 16c0 6-2 10-6 12v4H40v-4c-4-2-6-6-6-12z" fill={K.bone} {...O} />
    <path d="M36 26l4-8 4 6 4-10 4 10 4-6 4 8z" fill={K.gold2} {...O} strokeWidth={1.8} />
    <ellipse cx="42" cy="42" rx="4" ry="4.4" fill={INK} /><ellipse cx="54" cy="42" rx="4" ry="4.4" fill={INK} />
    <circle cx="42" cy="42" r="2" fill={K.dark3} /><circle cx="54" cy="42" r="2" fill={K.dark3} />
    <path d="M42 54v4M46 54v4M50 54v4M54 54v4" {...T} />
    <circle cx="22" cy="74" r="7" fill={K.dark3} opacity={0.5} /><circle cx="22" cy="74" r="4" fill={K.dark3} {...O} strokeWidth={1.6} />
  </g>
);

const troll = () => (
  <g>
    <Shadow w={32} />
    <path d="M8 98c0-22 18-34 40-34s40 12 40 34z" fill="#6E8C8A" {...O} />
    <path d="M30 70c2 6 6 8 10 8M60 72c4 0 8-2 10-6" {...T} stroke="#4A6462" strokeWidth={1.6} />
    <path d="M20 48c0-18 12-28 28-28s28 10 28 28c0 14-12 22-28 22S20 62 20 48z" fill="#86A6A0" {...O} />
    <path d="M18 40l-8-10 12 2zM78 40l8-10-12 2z" fill="#86A6A0" {...O} />
    <path d="M22 30c6-8 16-12 26-12s20 4 26 12c-6 0-10-2-14-4-4 4-8 4-12 2-4 2-8 2-12-2-4 2-8 4-14 4z" fill={K.moss} {...O} strokeWidth={2} />
    <Eye x={38} y={42} r={2.6} /><Eye x={58} y={42} r={2.6} />
    <path d="M32 36l10 2M64 36l-10 2" {...L} strokeWidth={2.6} />
    <path d="M42 44c-2 8 0 14 6 14s8-6 6-14c-2 2-4 2-6 2s-4 0-6-2z" fill="#9EBEB6" {...O} />
    <path d="M36 62c6 3 18 3 24 0" {...L} strokeWidth={2.4} />
    <path d="M40 62l2-6 2 6zM52 62l2-6 2 6z" fill={K.bone} {...O} strokeWidth={1.4} />
    <path d="M70 60c2-2 4-2 6 0M72 56l2 2M28 66c2 2 2 4 0 6" {...L} stroke={K.moss3} strokeWidth={2.4} />
  </g>
);

const basil = () => (
  <g>
    <Shadow w={34} />
    <Tube d="M18 84c-8-6-8-16 2-20 12-4 30 4 44 0 12-4 16-14 10-22" c="#8A9A5A" w={12} />
    <path d="M24 70c6 2 12 2 18 2M50 70c6-2 12-4 16-8" {...T} stroke="#C8D49A" strokeWidth={2} />
    <path d="M54 22c4-6 10-10 16-8-2 4 0 6 2 8 2-4 6-6 10-4-2 4-2 6 0 10" fill={K.blood} {...O} strokeWidth={2} />
    <path d="M52 40c0-12 8-18 18-18 8 0 14 6 14 14 0 10-8 14-16 14H58c-4 0-6-4-6-10z" fill="#9AAA64" {...O} />
    <GlowEye x={70} y={34} r={4} color={K.thunder2} slit />
    <path d="M56 46c6 2 16 2 24-2" {...L} strokeWidth={2} />
    <Tube d="M60 48c-2 6-8 8-12 6" c={K.blood2} w={2} />
    <path d="M46 52l-4 4M46 56l-4-2" {...T} stroke={K.blood2} strokeWidth={1.8} />
    <path d="M10 40l6-8 8 2 2 8-8 4z" fill={K.steel} {...O} strokeWidth={1.8} /><path d="M14 36l4 4" {...T} />
  </g>
);

const elem = () => (
  <g>
    <circle cx="48" cy="50" r="34" fill={K.thunder2} opacity={0.3} />
    <path d="M52 6L28 52h16l-8 38 32-50H50l10-34z" fill={K.thunder} {...O} />
    <path d="M50 14L36 46h12l-4 24 18-28H48l6-20z" fill={K.thunder2} />
    <ellipse cx="44" cy="40" rx="2.4" ry="3.2" fill={INK} /><ellipse cx="54" cy="40" rx="2.4" ry="3.2" fill={INK} />
    <path d="M46 48l3 2 3-2" {...L} strokeWidth={1.8} />
    <path d="M18 24l-6 8h6l-6 8M80 58l6 8h-6l6 8M16 72l8 2" {...L} stroke={K.thunder} strokeWidth={2.6} />
    <Spark x={82} y={22} r={4} fill={K.light2} /><Spark x={14} y={56} r={3} fill={K.light2} />
  </g>
);

const knight = (headless = false) => (
  <g>
    <Shadow w={28} />
    <path d="M76 8l-6 82" {...L} stroke={INK} strokeWidth={6} /><path d="M76 8l-6 82" {...L} stroke={K.steel2} strokeWidth={3} />
    <path d="M68 54h14" {...L} stroke={INK} strokeWidth={5} /><path d="M68 54h14" {...L} stroke={K.dark3} strokeWidth={2.4} />
    <path d="M12 98c0-20 16-32 36-32s36 12 36 32z" fill="#2E2E3E" {...O} />
    <path d="M12 86c0-12 6-20 18-22 6 0 8 6 6 12-8 2-16 6-24 10zM84 86c0-12-6-20-18-22-6 0-8 6-6 12 8 2 16 6 24 10z" fill="#4A4A62" {...O} />
    <path d="M40 70h16l-8 10z" fill={K.dark} {...O} strokeWidth={1.8} />
    {headless ? (
      <g>
        <path d="M36 66c0-4 6-6 12-6s12 2 12 6" fill="#4A4A62" {...O} />
        <path d="M40 60c2-10 4-18 8-24 4 6 6 14 8 24" fill={K.dark3} opacity={0.6} />
        <path d="M44 56c0-8 2-12 4-16 2 4 4 8 4 16" fill={K.light} opacity={0.8} />
        <g transform="translate(-6 30)">
          <path d="M16 40c0-10 6-16 14-16s14 6 14 16v8H16z" fill="#4A4A62" {...O} />
          <rect x="18" y="38" width="24" height="4" fill={INK} />
          <GlowEye x={25} y={40} r={2} color={K.light} /><GlowEye x={35} y={40} r={2} color={K.light} />
        </g>
      </g>
    ) : (
      <g>
        <path d="M30 46c0-16 8-26 18-26s18 10 18 26v16H30z" fill="#4A4A62" {...O} />
        <path d="M48 20v42" {...T} stroke="#6A6A86" strokeWidth={2} />
        <rect x="32" y="40" width="32" height="6" fill={INK} />
        <GlowEye x={41} y={43} r={2.4} color={K.dark3} /><GlowEye x={55} y={43} r={2.4} color={K.dark3} />
        <path d="M44 20c2-8 6-12 12-14-2 4-2 8 0 12z" fill={K.dark} {...O} strokeWidth={2} />
      </g>
    )}
  </g>
);

const manti = () => (
  <g>
    <Shadow w={34} />
    <Tube d="M72 70c10-2 14-12 10-22-2-6 0-12 6-14" c="#8A5A3A" w={4} />
    <path d="M86 30l6-6-2 10z" fill={K.blood} {...O} strokeWidth={1.8} />
    <path d="M22 72c0-12 12-18 30-18s26 6 26 16-10 14-26 14-30-2-30-12z" fill="#D2A060" {...O} />
    <path d="M30 80l-2 8M40 82v6M62 82v6M72 80l2 8" {...L} stroke={INK} strokeWidth={6} />
    <path d="M30 80l-2 8M40 82v6M62 82v6M72 80l2 8" {...L} stroke="#D2A060" strokeWidth={3.4} />
    <path d="M6 44c0-18 10-30 26-30s26 12 26 30-10 28-26 28S6 62 6 44z" fill="#B0703A" {...O} />
    {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const a = (i / 8) * Math.PI * 2; return <circle key={i} cx={32 + Math.cos(a) * 22} cy={44 + Math.sin(a) * 22} r="5" fill="#B0703A" {...O} strokeWidth={2} />; })}
    <path d="M14 44c0-12 8-20 18-20s18 8 18 20-8 20-18 20-18-8-18-20z" fill="#E8C49A" {...O} />
    <GlowEye x={26} y={42} r={2.6} color={K.blood2} /><GlowEye x={38} y={42} r={2.6} color={K.blood2} />
    <path d="M22 36l8 2M42 36l-8 2" {...L} strokeWidth={2} />
    <path d="M24 54c4 4 12 4 16 0" fill={INK} {...L} strokeWidth={2} />
    <path d="M26 54l1 3 2-2.6M35 54.4l1.4 2.6 1.6-3" fill="#fff" stroke="none" />
  </g>
);

const WITCH: FigureSpec = { skin: 4, hair: '#3A4A5A', style: 'long', gear: 'witch', gearColor: '#3A2E4E', gearColor2: K.moss2, outfit: 'robe', cloth: '#3A2E4E', trim: K.moss2, eyes: 'glow', eyeColor: K.moss3, mouth: 'smirk', brows: 'sharp', prop: 'crystal', bg: RACE_BG.humanoid };
const witch = () => <Figure s={WITCH} id="m-witch" frame={false} />;

const hydra = () => (
  <g>
    <Shadow w={34} />
    <path d="M14 84c0-14 14-22 34-22s34 8 34 22z" fill="#4E7A6A" {...O} />
    {[[-1, 18, 30], [0, 48, 16], [1, 78, 30]].map(([sd, hx, hy]) => (
      <g key={sd}>
        <Tube d={`M${48 + sd * 12} 70C${48 + sd * 14} 50 ${hx - sd * 4} ${hy + 20} ${hx} ${hy + 6}`} c="#5E8E7A" w={9} />
        <path d={`M${hx - 10} ${hy + 2}c0-8 4-12 10-12s10 4 10 12-4 10-10 10-10-2-10-10z`} fill="#6EA08A" {...O} />
        <GlowEye x={hx - 4} y={hy} r={2} color={K.thunder2} slit /><GlowEye x={hx + 4} y={hy} r={2} color={K.thunder2} slit />
        <path d={`M${hx - 5} ${hy + 7}c3 2 7 2 10 0`} {...L} strokeWidth={1.8} />
        <path d={`M${hx - 6} ${hy - 9}l2 -5 2 4zM${hx + 6} ${hy - 9}l-2 -5 -2 4z`} fill={K.bone} {...O} strokeWidth={1.4} />
      </g>
    ))}
    <path d="M20 86c8-4 16-4 24 0s16 4 24 0 12-2 14 0" {...L} stroke="#9AC8D8" strokeWidth={3} />
  </g>
);

const shade = () => (
  <g>
    <circle cx="48" cy="52" r="34" fill={K.dark2} opacity={0.3} />
    <path d="M12 86c4-6 2-14 6-20-4-6-4-16 2-22l-2-14 10 8c6-4 14-6 20-6s14 2 20 6l10-8-2 14c6 6 6 16 2 22 4 6 2 14 6 20-6-2-10-6-12-4 0 4-4 8-8 6-2-4-6-4-8 0-4-2-6-6-10-4-4-2-6 2-10 4-2-4-6-4-8 0-4 2-8-2-8-6-2-2-6 2-12 4z" fill="#1E1E30" {...O} />
    <GlowEye x={38} y={50} r={4} color={K.dark3} slit /><GlowEye x={58} y={50} r={4} color={K.dark3} slit />
    <path d="M36 64l4 6 4-4 4 6 4-6 4 4 4-6" fill="none" {...L} stroke={K.dark3} strokeWidth={2} />
    <path d="M10 40c-4-2-6-6-4-10M86 40c4-2 6-6 4-10M30 20c0-4 2-6 4-8" {...L} stroke={K.dark3} strokeWidth={2} opacity={0.7} />
  </g>
);

// ---------------------------------------------------------------- 表
export interface MonsterLook { name: string; race: Race; draw: () => ReactNode; figure?: boolean }
export const MONSTER_LOOKS: Record<string, MonsterLook> = {
  rat: { name: '畑荒らしの大ネズミ', race: 'beast', draw: rat },
  imp: { name: '霧の小鬼', race: 'spirit', draw: imp },
  boar: { name: '牙猪', race: 'beast', draw: boar },
  skel: { name: '骸骨兵', race: 'undead', draw: skel },
  slime: { name: '沼スライム', race: 'spirit', draw: slime },
  wolf: { name: 'はぐれ狼', race: 'beast', draw: () => wolf(false) },
  goblin: { name: '小鬼の盗賊', race: 'humanoid', draw: goblin },
  bat: { name: '吸血大コウモリ', race: 'beast', draw: bat },
  wisp: { name: '鬼火', race: 'spirit', draw: wisp },
  spider: { name: '洞窟大蜘蛛', race: 'beast', draw: () => spider(false) },
  frog: { name: '沼の大蛙', race: 'beast', draw: frog },
  golem: { name: '岩の巨人', race: 'spirit', draw: golem },
  ghoul: { name: '屍食鬼', race: 'undead', draw: ghoul },
  harpy: { name: '嵐のハーピー', race: 'beast', draw: harpy },
  ogre: { name: '人喰い鬼', race: 'humanoid', draw: ogre },
  wraith: { name: '嘆きの亡霊', race: 'undead', draw: wraith },
  salam: { name: '火蜥蜴', race: 'beast', draw: salam },
  bandit: { name: '山賊の頭領', race: 'humanoid', draw: bandit, figure: true },
  treant: { name: '怒れる古木', race: 'spirit', draw: treant },
  icewolf: { name: '氷牙の狼群', race: 'beast', draw: () => <g><g transform="translate(-6 10) scale(.7)" opacity={0.9}>{wolf(true)}</g><g transform="translate(26 18) scale(.72)">{wolf(true)}</g></g> },
  wyvern: { name: '飛竜の若者', race: 'dragon', draw: () => wyvern(false) },
  lich: { name: '墓所の死霊術師', race: 'undead', draw: lich },
  troll: { name: '再生する大鬼', race: 'humanoid', draw: troll },
  basil: { name: '石化の大蛇', race: 'beast', draw: basil },
  elem: { name: '雷の精霊', race: 'spirit', draw: elem },
  knight: { name: '亡国の黒騎士', race: 'undead', draw: () => knight(false) },
  manti: { name: '人面獅子', race: 'beast', draw: manti },
  witch: { name: '霧の魔女', race: 'humanoid', draw: witch, figure: true },
  hydra: { name: '沼の多頭蛇', race: 'dragon', draw: hydra },
  shade: { name: '影の獣', race: 'spirit', draw: shade },
};
export const MONSTER_IDS = Object.keys(MONSTER_LOOKS);

/** 魔物の絵。frame=false で背景なし（戦闘画面で地形の上に重ねるとき） */
export function MonsterArt({ id, size = 96, label, frame = true }: { id: string; size?: number; label?: string; frame?: boolean }) {
  const m = MONSTER_LOOKS[id];
  if (!m) return null;
  const [c1, c2] = RACE_BG[m.race];
  const k = `m-${id}`;
  return (
    <svg viewBox="0 0 96 96" width={size} height={size} role="img" aria-label={label ?? `${m.name}（${RACE_JP[m.race]}）`} style={{ display: 'block' }}>
      {frame && <MistBg id={k} c1={c1} c2={c2} />}
      <g clipPath={frame ? `url(#cl-${k})` : undefined}>{m.draw()}</g>
    </svg>
  );
}

// 下の部品はボスでも使う
export { wolf as drawWolf, spider as drawSpider, wyvern as drawWyvern, knight as drawKnight, Tube, Shadow };
