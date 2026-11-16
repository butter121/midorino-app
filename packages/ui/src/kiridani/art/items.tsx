// 品物カード30枚の絵（武具・道具・秘術）。種類ごとに背景の色を変える
import type { ReactNode } from 'react';
import { INK, K, O, L, T, MistBg, Spark, GlowEye } from './common';

type Kind = 'weapon' | 'tool' | 'spell';
export const ITEM_KIND_BG: Record<Kind, [string, string]> = {
  weapon: ['#7E8CA2', '#DCE3EA'],
  tool: ['#B39268', '#F3E9D2'],
  spell: ['#7A64A0', '#E0D6F0'],
};
export const ITEM_KIND_JP: Record<Kind, string> = { weapon: '武具', tool: '道具', spell: '秘術' };

const Tube = ({ d, c, w = 5 }: { d: string; c: string; w?: number }) => (
  <g><path d={d} {...L} stroke={INK} strokeWidth={w + 2.6} /><path d={d} {...L} stroke={c} strokeWidth={w} /></g>
);
const Glow = ({ x, y, r, c }: { x: number; y: number; r: number; c: string }) => <circle cx={x} cy={y} r={r} fill={c} opacity={0.35} />;
const Shadow = ({ w = 26 }: { w?: number }) => <ellipse cx="48" cy="86" rx={w} ry="4" fill={INK} opacity={0.16} />;

/** 斜めの剣（角度・刃の色・柄の色） */
const Sword = ({ blade, guard = K.gold, grip = K.leather, w = 9, len = 54, rot = 45, extra }: { blade: string; guard?: string; grip?: string; w?: number; len?: number; rot?: number; extra?: ReactNode }) => (
  <g transform={`rotate(${rot} 48 48)`}>
    <path d={`M${48 - w / 2} ${60 - len}l${w / 2} -6 ${w / 2} 6v${len}h-${w}z`} fill={blade} {...O} />
    <path d={`M48 ${58 - len}v${len - 2}`} {...T} stroke="#fff" strokeWidth={1.4} opacity={0.7} />
    <rect x={48 - w - 6} y="58" width={2 * w + 12} height="6" rx="3" fill={guard} {...O} strokeWidth={2.2} />
    <rect x="45" y="64" width="6" height="16" rx="2" fill={grip} {...O} strokeWidth={2.2} />
    <circle cx="48" cy="83" r="4" fill={guard} {...O} strokeWidth={2} />
    {extra}
  </g>
);

export const ITEM_DRAW: Record<string, ReactNode> = {
  // ---------------- 武具
  i01: <g>
    <Tube d="M22 14c30 4 56 30 60 60" c={K.wood} w={5} />
    <path d="M22 14l60 60" {...T} />
    <path d="M18 70L74 22" {...L} stroke={INK} strokeWidth={3.4} /><path d="M18 70L74 22" {...L} stroke={K.wood3} strokeWidth={1.6} />
    <path d="M78 18l-10 2 6 6z" fill={K.steel3} {...O} strokeWidth={1.8} />
    <path d="M18 70l-4 8 8-2zM22 66l-6 2M22 66l-2 6" fill={K.moss2} {...O} strokeWidth={1.6} />
  </g>,
  i02: <g><Shadow /><Sword blade={K.steel3} w={14} len={58} guard={K.steel2} extra={<path d="M44 20l8 6-8 6 8 6-8 6" {...L} stroke={K.ice} strokeWidth={1.8} />} /></g>,
  i03: <g><Glow x={44} y={42} r={24} c={K.fire2} /><Sword blade={K.fire} w={8} len={36} guard={K.gold} extra={<path d="M48 30c-3 6-1 12 0 18 2-6 4-12 0-18z" fill={K.fire3} />} /></g>,
  i04: <g>
    <Tube d="M30 88L58 26" c={K.wood} w={4} />
    <Glow x={62} y={20} r={18} c={K.ice2} />
    <path d="M62 4l8 14-8 14-8-14z" fill={K.ice} {...O} />
    <path d="M62 4l-3 14 3 14M54 18h16" {...T} />
    <path d="M52 30c4-4 6-4 10-2M72 30c-4-4-6-4-10-2" {...L} stroke={K.wood2} strokeWidth={2.4} />
    {[[30, 20], [80, 36], [74, 6]].map(([x, y], i) => <Spark key={i} x={x} y={y} r={3} fill={K.ice3} />)}
  </g>,
  i05: <g transform="rotate(-30 48 48)">
    <Glow x={48} y={26} r={22} c={K.thunder2} />
    <rect x="44" y="36" width="8" height="50" rx="3" fill={K.wood} {...O} />
    <rect x="24" y="14" width="48" height="24" rx="5" fill={K.steel} {...O} />
    <path d="M30 20h36" {...T} stroke={K.steel3} strokeWidth={2} />
    <path d="M52 16l-8 10h6l-6 10" {...L} stroke={K.thunder} strokeWidth={3} />
  </g>,
  i06: <g>
    <Shadow w={22} />
    <path d="M18 14h60v26c0 22-14 38-30 46-16-8-30-24-30-46z" fill={K.steel3} {...O} />
    <path d="M26 20h44v20c0 16-10 28-22 34-12-6-22-18-22-34z" fill="#FFFDF6" {...O} strokeWidth={2} />
    {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => <path key={a} d="M48 26l2 8h-4z" fill={K.gold2} {...O} strokeWidth={1.2} transform={`rotate(${a} 48 42)`} />)}
    <circle cx="48" cy="42" r="7" fill={K.gold2} {...O} strokeWidth={2} />
  </g>,
  i07: <g>
    <Glow x={40} y={30} r={24} c={K.dark3} />
    <Tube d="M70 90L54 14" c={K.night2} w={4} />
    <path d="M54 16C40 6 18 10 10 26c14-8 30-8 44-4z" fill={K.dark2} {...O} />
    <path d="M50 17c-10-4-24-2-34 6" {...T} stroke={K.dark3} strokeWidth={1.8} />
    <circle cx="55" cy="18" r="4" fill={K.blood2} {...O} strokeWidth={1.6} />
  </g>,
  i08: <g>
    <Shadow />
    <path d="M24 30c8-6 16-8 24-8s16 2 24 8l-2 46c-6 6-14 8-22 8s-16-2-22-8z" fill={K.leather} {...O} />
    {[42, 52, 62].map((y) => <path key={y} d={`M32 ${y}c10 4 22 4 32 0`} {...L} stroke={INK} strokeWidth={5} />)}
    {[42, 52, 62].map((y) => <path key={`b${y}`} d={`M32 ${y}c10 4 22 4 32 0`} {...L} stroke={K.bone} strokeWidth={2.6} />)}
    <path d="M24 30c-8-2-14 2-16 10 6 0 10 2 12 6zM72 30c8-2 14 2 16 10-6 0-10 2-12 6z" fill={K.bone} {...O} />
    <path d="M14 30l-4-10 8 6zM82 30l4-10-8 6z" fill={K.bone2} {...O} strokeWidth={1.8} />
    <path d="M40 24l8 10 8-10" {...L} />
  </g>,
  i09: <g>
    <path d="M14 20c24-8 44-8 68 0-4 20-4 40 0 60-24 8-44 8-68 0 4-20 4-40 0-60z" fill={K.parch2} opacity={0.4} />
    {[0, 1, 2, 3, 4].map((i) => <path key={`h${i}`} d={`M14 ${22 + i * 14}c24 ${i % 2 ? 4 : -4} 44 ${i % 2 ? 4 : -4} 68 0`} {...L} stroke={K.wood2} strokeWidth={2.4} />)}
    {[0, 1, 2, 3, 4].map((i) => <path key={`v${i}`} d={`M${18 + i * 15} 18c${i % 2 ? 4 : -4} 20 ${i % 2 ? 4 : -4} 44 0 64`} {...L} stroke={K.wood2} strokeWidth={2.4} />)}
    {[[14, 20], [82, 20], [14, 80], [82, 80]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="5" fill={K.steel2} {...O} strokeWidth={2} />)}
  </g>,
  i10: <g transform="rotate(30 48 48)">
    <Shadow w={18} />
    <path d="M44 46l1-36h6l1 36" fill={K.wood2} {...O} />
    <rect x="41" y="4" width="14" height="10" rx="2" fill={K.wood} {...O} strokeWidth={2} />
    {[6, 10].map((y) => <g key={y}><circle cx="39" cy={y} r="1.8" fill={K.gold2} {...T} /><circle cx="57" cy={y} r="1.8" fill={K.gold2} {...T} /></g>)}
    <path d="M48 44c-14 0-22 10-22 22s8 22 22 22 22-10 22-22-8-22-22-22z" fill={K.wood3} {...O} />
    <circle cx="48" cy="62" r="6" fill={K.wood2} {...O} strokeWidth={1.8} />
    <path d="M46 14v66M50 14v66" {...T} strokeWidth={0.9} />
    <rect x="40" y="76" width="16" height="4" rx="1" fill={K.wood2} {...O} strokeWidth={1.4} />
  </g>,
  // ---------------- 道具
  i11: <g>
    <Shadow w={30} />
    <path d="M24 86V44c0-14 10-24 24-24s24 10 24 24v42z" fill={K.steel2} {...O} />
    <path d="M30 40h36M30 54h36" {...T} stroke={K.steel3} strokeWidth={1.8} />
    <path d="M36 86V66c0-6 6-10 12-10s12 4 12 10v20z" fill={K.dark2} {...O} />
    <Glow x={48} y={72} r={14} c={K.dark3} />
    <path d="M48 62l6 8-6 10-6-10z" fill={K.dark3} {...O} strokeWidth={1.8} />
    <rect x="42" y="8" width="12" height="14" fill={K.steel} {...O} />
    <path d="M44 6c-2-4 2-6 0-10M52 6c-2-4 2-6 0-10" {...T} stroke={K.dark3} strokeWidth={2} />
  </g>,
  i12: <g>
    <path d="M10 64h76l-6 22H16z" fill={K.wood} {...O} />
    <path d="M14 70h68" {...T} stroke={K.wood2} strokeWidth={1.6} />
    <path d="M14 64c4-6 64-6 68 0" fill="#6A4A34" {...O} />
    {[24, 40, 56, 72].map((x, i) => (
      <g key={x}>
        <path d={`M${x} 62V${44 - (i % 2) * 6}`} {...L} stroke={K.moss} strokeWidth={2.4} />
        <path d={`M${x} ${48 - (i % 2) * 6}c-6 0-8-4-8-8 6 0 8 4 8 8z`} fill={K.moss3} {...O} strokeWidth={1.6} />
        <path d={`M${x} ${54 - (i % 2) * 6}c6 0 8-4 8-8-6 0-8 4-8 8z`} fill={K.moss2} {...O} strokeWidth={1.6} />
        {i % 2 === 1 && <circle cx={x} cy={34} r="3" fill={K.dark3} {...O} strokeWidth={1.4} />}
      </g>
    ))}
  </g>,
  i13: <g>
    <path d="M22 88l12-14M74 88L62 74M48 88V74" {...L} stroke={K.wood2} strokeWidth={4} />
    <path d="M36 84c-2-8 4-12 6-18 2 4 4 6 6 2 2 6 8 8 6 16z" fill={K.fire} {...O} strokeWidth={2} />
    <path d="M42 84c0-4 2-6 4-8 2 2 4 4 4 8z" fill={K.fire3} />
    <path d="M20 40h56l-4 26c0 4-4 6-8 6H32c-4 0-8-2-8-6z" fill={K.night2} {...O} />
    <path d="M16 40h64" {...L} strokeWidth={4} />
    <path d="M24 44h48" {...T} stroke="#6A7AA0" strokeWidth={1.6} />
    <path d="M34 34c-2-4 2-6 0-10M48 32c-2-4 2-8 0-12M62 34c-2-4 2-6 0-10" {...L} stroke="#fff" strokeWidth={2.4} />
    <path d="M62 38l12-26" {...L} stroke={INK} strokeWidth={4} /><path d="M62 38l12-26" {...L} stroke={K.wood3} strokeWidth={2} />
  </g>,
  i14: <g>
    <Shadow w={20} />
    <path d="M34 88l4-52h20l4 52z" fill={K.parch3} {...O} />
    {[48, 60, 72].map((y) => <path key={y} d={`M37 ${y}h22`} {...T} />)}
    <path d="M28 38h40v-8H28z" fill={K.wood} {...O} />
    <path d="M30 30V18h36v12" fill="none" {...O} />
    <path d="M30 18l18-12 18 12z" fill={K.blood} {...O} />
    <rect x="42" y="20" width="12" height="10" fill={K.night} {...O} strokeWidth={1.8} />
    <circle cx="48" cy="25" r="2.4" fill={K.thunder2} />
    <path d="M48 6V0" {...L} /><path d="M48 0l10 3-10 3" fill={K.gold2} {...O} strokeWidth={1.4} />
  </g>,
  i15: <g>
    <path d="M10 64h60v-24H10z" fill={K.wood} {...O} />
    <path d="M10 40c0-18 60-18 60 0" fill={K.parch} {...O} />
    <path d="M30 26v14M50 26v14" {...T} stroke={K.parch3} strokeWidth={1.6} />
    <path d="M10 52h60" {...T} stroke={K.wood2} strokeWidth={1.6} />
    <path d="M70 58h18" {...L} strokeWidth={3} />
    {[24, 58].map((x) => <g key={x}><circle cx={x} cy="70" r="11" fill={K.wood3} {...O} /><circle cx={x} cy="70" r="3" fill={K.wood2} {...O} strokeWidth={1.4} /><path d={`M${x - 8} 70h16M${x} 62v16`} {...T} /></g>)}
    <circle cx="40" cy="34" r="3.6" fill={K.gold2} {...O} strokeWidth={1.4} /><circle cx="56" cy="36" r="3" fill={K.gold2} {...O} strokeWidth={1.4} />
  </g>,
  i16: <g>
    <Shadow w={20} />
    <path d="M48 88V44" {...L} stroke={INK} strokeWidth={8} /><path d="M48 88V44" {...L} stroke={K.wood} strokeWidth={5} />
    <path d="M22 50h52" {...L} stroke={INK} strokeWidth={7} /><path d="M22 50h52" {...L} stroke={K.wood3} strokeWidth={4} />
    <path d="M36 44c0-8 4-14 12-14s12 6 12 14v26c-4 4-8 4-12 4s-8 0-12-4z" fill={K.parch2} {...O} />
    <circle cx="48" cy="22" r="10" fill={K.parch2} {...O} />
    <path d="M44 20l2 2M50 20l2 2M46 22l-2 2M52 22l-2 2" {...T} />
    <circle cx="48" cy="56" r="7" fill="#fff" {...O} strokeWidth={1.8} /><circle cx="48" cy="56" r="3" fill={K.blood} />
    <path d="M60 30l16-16" {...L} stroke={INK} strokeWidth={4} /><path d="M60 30l16-16" {...L} stroke={K.steel3} strokeWidth={2} />
  </g>,
  i17: <g>
    <path d="M8 86V48l40-26 40 26v38z" fill={K.parch2} {...O} />
    <path d="M4 50l44-30 44 30" {...L} stroke={INK} strokeWidth={7} /><path d="M4 50l44-30 44 30" {...L} stroke={K.blood} strokeWidth={4} />
    <path d="M38 86V64c0-6 4-10 10-10s10 4 10 10v22z" fill={K.wood2} {...O} />
    {[18, 70].map((x) => <rect key={x} x={x - 6} y="56" width="14" height="12" fill={K.thunder2} {...O} strokeWidth={2} />)}
    <path d="M48 20V6" {...L} /><path d="M48 6l12 4-12 4" fill={K.moss2} {...O} strokeWidth={1.4} />
  </g>,
  i18: <g>
    <Shadow w={30} />
    <path d="M14 36h56c6 0 12 4 14 10H56l-4 10h-20l-6-10H22c-6-2-8-6-8-10z" fill={K.steel2} {...O} />
    <path d="M32 56h20l6 22H26z" fill={K.steel2} {...O} />
    <path d="M22 78h40v8H22z" fill={K.steel} {...O} />
    <path d="M20 40h56" {...T} stroke={K.steel3} strokeWidth={2} />
    {[[40, 22], [56, 16], [28, 18], [64, 26]].map(([x, y], i) => <Spark key={i} x={x} y={y} r={3 + (i % 2)} fill={K.fire3} />)}
    <path d="M54 30l10-14" {...L} stroke={INK} strokeWidth={3.6} /><path d="M54 30l10-14" {...L} stroke={K.wood} strokeWidth={1.8} />
  </g>,
  // ---------------- 秘術
  i19: <g>
    <Glow x={58} y={34} r={26} c={K.fire2} />
    <g transform="rotate(-12 40 60)">
      <rect x="18" y="54" width="44" height="26" fill={K.parch} {...O} />
      <rect x="14" y="52" width="7" height="30" rx="3.5" fill={K.wood} {...O} strokeWidth={2} />
      <rect x="60" y="52" width="7" height="30" rx="3.5" fill={K.wood} {...O} strokeWidth={2} />
      <path d="M26 62h28M26 68h20M26 74h24" {...T} stroke={K.blood} strokeWidth={1.4} />
    </g>
    <circle cx="60" cy="32" r="16" fill={K.fire} {...O} />
    <circle cx="60" cy="32" r="9" fill={K.fire2} />
    <circle cx="57" cy="29" r="4" fill={K.fire3} />
    <path d="M44 38c-8 4-14 4-18 2M46 26c-6-4-10-4-14-4" {...L} stroke={K.fire2} strokeWidth={3} />
  </g>,
  i20: <g>
    <Glow x={48} y={48} r={30} c={K.dark3} />
    <rect x="24" y="10" width="48" height="8" rx="3" fill={K.wood} {...O} />
    <rect x="24" y="78" width="48" height="8" rx="3" fill={K.wood} {...O} />
    <path d="M30 18c0 16 14 22 14 30s-14 14-14 30h36c0-16-14-22-14-30s14-14 14-30z" fill={K.ice3} {...O} />
    <path d="M36 24h24c-2 8-8 12-12 16-4-4-10-8-12-16z" fill={K.gold2} />
    <path d="M48 48v20M36 78c4-8 20-8 24 0z" fill={K.gold2} stroke={K.gold} strokeWidth={1.6} />
    <path d="M30 18c0 16 14 22 14 30s-14 14-14 30h36c0-16-14-22-14-30s14-14 14-30z" fill="none" {...O} />
    <path d="M20 18v60M76 18v60" {...L} stroke={K.wood2} strokeWidth={3} />
  </g>,
  i21: <g>
    <path d="M48 8v8" {...L} strokeWidth={3} />
    <path d="M28 64c0-24 6-46 20-46s20 22 20 46z" fill={K.gold2} {...O} />
    <path d="M24 64h48v6H24z" fill={K.gold} {...O} />
    <path d="M36 30c2-6 6-8 10-8" {...L} stroke="#fff" strokeWidth={2.4} />
    <circle cx="48" cy="76" r="5" fill={K.gold} {...O} />
    <path d="M14 30c-6 0-8 6-4 8h12c4 0 4-6-2-6-2-4-6-4-6-2z" fill="#fff" {...O} strokeWidth={1.8} />
    <circle cx="82" cy="24" r="6" fill={K.thunder2} {...O} strokeWidth={1.8} />
    <path d="M78 52c-2 2-2 6 0 8M84 48c-4 4-4 12 0 16M18 52c2 2 2 6 0 8M12 48c4 4 4 12 0 16" {...L} strokeWidth={1.8} />
  </g>,
  i22: <g>
    <Glow x={48} y={48} r={30} c={K.light} />
    <path d="M30 84C34 56 50 26 76 12c-4 24-18 52-40 70z" fill="#fff" {...O} />
    <path d="M32 82C42 58 56 36 74 16" {...L} stroke={K.gold} strokeWidth={2} />
    {[0, 1, 2, 3].map((i) => <path key={i} d={`M${42 + i * 8} ${62 - i * 12}l-10 -4`} {...T} stroke={K.mist2} />)}
    <Spark x={22} y={30} r={4} /><Spark x={76} y={64} r={3.4} /><Spark x={62} y={78} r={2.6} />
  </g>,
  i23: <g>
    <path d="M58 12h22v60H58z" fill={K.dark2} opacity={0.5} transform="rotate(8 69 42)" />
    <rect x="24" y="12" width="30" height="66" rx="2" fill={K.parch} {...O} transform="rotate(-6 39 45)" />
    <g transform="rotate(-6 39 45)">
      <circle cx="39" cy="38" r="9" fill="none" stroke={K.dark} strokeWidth={2.6} />
      <path d="M39 29v18M30 38h18M33 32l12 12M45 32l-12 12" {...T} stroke={K.dark} />
      <path d="M32 56h14M32 62h10M32 68h12" {...T} stroke={K.dark} strokeWidth={1.8} />
      <circle cx="39" cy="38" r="3" fill={K.dark3} {...T} />
    </g>
    <path d="M36 12l-2-8M42 12l2-8" {...L} stroke={K.blood} strokeWidth={2} />
  </g>,
  i24: <g>
    <Shadow w={18} />
    <Glow x={48} y={60} r={26} c={K.blood2} />
    <path d="M40 10h16v6l-2 2v10c12 4 18 14 18 26 0 16-10 28-24 28S24 70 24 54c0-12 6-22 18-26V18l-2-2z" fill={K.ice3} {...O} />
    <path d="M26 54c6 2 14-2 22 0s16 2 22-2c0 14-10 26-22 26S26 68 26 54z" fill={K.blood} />
    <path d="M40 10h16v6l-2 2v10c12 4 18 14 18 26 0 16-10 28-24 28S24 70 24 54c0-12 6-22 18-26V18l-2-2z" fill="none" {...O} />
    <rect x="40" y="4" width="16" height="8" rx="2" fill={K.wood} {...O} strokeWidth={2} />
    <path d="M38 62c4-6 10-6 12-2l6-6-2 8c4 2 4 6 2 8-4-2-8-2-10 0-4-2-6-4-8-8z" fill={K.gold2} {...O} strokeWidth={1.4} />
    <path d="M32 40c2-4 6-6 8-6" {...L} stroke="#fff" strokeWidth={2.4} />
  </g>,
  i25: <g>
    <rect x="16" y="14" width="56" height="70" rx="2" fill={K.parch} {...O} transform="rotate(-4 44 49)" />
    <g transform="rotate(-4 44 49)">
      <path d="M24 26h40M24 34h40M24 42h32M24 50h36" {...T} strokeWidth={1.4} />
      <path d="M24 66c4-4 8 4 12 0M48 66c4-4 8 4 12 0" {...L} stroke={K.night2} strokeWidth={1.8} />
      <circle cx="44" cy="74" r="7" fill={K.blood} {...O} strokeWidth={1.8} />
    </g>
    <path d="M70 66L88 10" {...L} stroke={INK} strokeWidth={3.4} />
    <path d="M86 12c-6 4-12 16-14 30 6-4 12-14 14-30z" fill="#fff" {...O} strokeWidth={1.8} />
  </g>,
  i26: <g>
    <Glow x={48} y={44} r={30} c={K.blood2} />
    <Sword blade="#3A2E48" w={11} len={56} guard={K.blood} grip="#2E2A3A" extra={<g><path d="M48 14v38" {...T} stroke={K.blood2} strokeWidth={2} /><GlowEye x={48} y={61} r={2.6} color={K.blood2} slit /></g>} />
    <path d="M70 70c0 4 2 6 0 8-2-2-2-4 0-8zM76 60c0 4 2 6 0 8-2-2-2-4 0-8z" fill={K.blood} {...T} />
  </g>,
  i27: <g>
    <path d="M14 76c8 12 60 12 68 0-4-6-12-8-18-8H32c-6 0-14 2-18 8z" fill={K.wood3} {...O} />
    {[20, 32, 44, 56, 68].map((x) => <path key={x} d={`M${x} 72l8 10`} {...T} stroke={K.wood2} strokeWidth={1.6} />)}
    <Glow x={48} y={46} r={26} c={K.fire2} />
    <path d="M48 10c-16 0-24 22-24 36 0 16 10 26 24 26s24-10 24-26c0-14-8-36-24-36z" fill="#E8D8B0" {...O} />
    {[[38, 34], [56, 28], [60, 50], [40, 56], [50, 42]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx="4" ry="3" fill="#C0705A" />)}
    <path d="M40 22l6 8-4 6 6 6" {...L} stroke={K.fire2} strokeWidth={2.4} />
    <path d="M40 22l6 8-4 6 6 6" {...T} />
  </g>,
  i28: <g>
    <Glow x={48} y={46} r={30} c={K.gold2} />
    {[[18, 80], [28, 82], [72, 80], [80, 78]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx="8" ry="3.6" fill={K.gold2} {...O} strokeWidth={1.8} />)}
    <rect x="24" y="16" width="48" height="56" fill="#F6DE8E" {...O} />
    <rect x="20" y="12" width="56" height="8" rx="4" fill={K.gold} {...O} />
    <rect x="20" y="68" width="56" height="8" rx="4" fill={K.gold} {...O} />
    <path d="M32 30h32M32 38h32M32 46h22" {...T} stroke={K.wood2} strokeWidth={1.4} />
    <circle cx="60" cy="56" r="7" fill={K.blood} {...O} strokeWidth={1.8} />
    <path d="M57 56h6M60 53v6" {...T} stroke={K.gold2} strokeWidth={1.6} />
    <Spark x={84} y={20} r={4} fill={K.gold3} /><Spark x={12} y={36} r={3} fill={K.gold3} />
  </g>,
  i29: <g>
    <Shadow w={24} />
    <path d="M24 86V50h48v36z" fill={K.steel2} {...O} />
    <path d="M30 50c0-12 8-20 18-20s18 8 18 20" fill="none" {...L} stroke={INK} strokeWidth={6} />
    <path d="M30 50c0-12 8-20 18-20s18 8 18 20" fill="none" {...L} stroke={K.wood} strokeWidth={3} />
    <path d="M36 86V70c0-4 4-8 12-8s12 4 12 8v16z" fill={K.night} {...O} />
    <path d="M42 84c-2-6 2-10 6-14 2 4 6 8 4 14z" fill={K.fire} {...O} strokeWidth={1.6} />
    <path d="M24 58h48" {...T} stroke={K.steel3} strokeWidth={1.8} />
    <path d="M72 70h10v8H72z" fill={K.leather} {...O} strokeWidth={1.8} />
    <Spark x={60} y={30} r={3} fill={K.fire3} />
  </g>,
  i30: <g>
    <Shadow w={16} />
    <Glow x={48} y={58} r={26} c={K.ice2} />
    <path d="M42 22h12v12c10 4 16 12 16 24 0 14-10 24-22 24S26 72 26 58c0-12 6-20 16-24z" fill={K.ice3} {...O} />
    <path d="M28 58c6-2 12 2 20 0s14-2 20 0c0 12-8 22-20 22s-20-10-20-22z" fill={K.ice} />
    <path d="M42 22h12v12c10 4 16 12 16 24 0 14-10 24-22 24S26 72 26 58c0-12 6-20 16-24z" fill="none" {...O} />
    <rect x="40" y="14" width="16" height="9" rx="2" fill={K.wood3} {...O} strokeWidth={2} />
    <path d="M48 58v14M42 64h12" {...L} stroke="#fff" strokeWidth={3} />
    <Spark x={20} y={30} r={3.4} /><Spark x={76} y={36} r={3} />
  </g>,
};

const ITEMS: Record<string, [string, Kind]> = {
  i01: ['樫の長弓', 'weapon'], i02: ['ドワーフの大剣', 'weapon'], i03: ['炎刃の短剣', 'weapon'], i04: ['氷晶の杖', 'weapon'], i05: ['雷鳴の戦槌', 'weapon'],
  i06: ['聖印の大盾', 'weapon'], i07: ['黒曜の大鎌', 'weapon'], i08: ['魔獣骨の鎧', 'weapon'], i09: ['捕獲の投げ網', 'weapon'], i10: ['吟遊詩人のリュート', 'weapon'],
  i11: ['魔導炉', 'tool'], i12: ['薬草園', 'tool'], i13: ['野戦炊事場', 'tool'], i14: ['物見の塔', 'tool'], i15: ['交易の荷馬車', 'tool'],
  i16: ['訓練場', 'tool'], i17: ['兵舎', 'tool'], i18: ['鍛冶場の金床', 'tool'], i19: ['火球の巻物', 'spell'], i20: ['時渡りの砂時計', 'spell'],
  i21: ['天候の鈴', 'spell'], i22: ['帰還の羽根', 'spell'], i23: ['影分身の呪符', 'spell'], i24: ['竜殺しの秘薬', 'spell'], i25: ['契約の羊皮紙', 'spell'],
  i26: ['生贄の魔剣', 'weapon'], i27: ['竜の卵', 'tool'], i28: ['黄金の誓約書', 'spell'], i29: ['携帯鍛冶炉', 'tool'], i30: ['聖水の小瓶', 'spell'],
};
export const ITEM_IDS = Object.keys(ITEMS);
export const ITEM_NAMES: Record<string, string> = Object.fromEntries(ITEM_IDS.map((k) => [k, ITEMS[k][0]]));
export const ITEM_KIND: Record<string, Kind> = Object.fromEntries(ITEM_IDS.map((k) => [k, ITEMS[k][1]]));

/** 品物カードの絵 */
export function ItemArt({ id, size = 96, label, frame = true }: { id: string; size?: number; label?: string; frame?: boolean }) {
  const it = ITEMS[id];
  if (!it) return null;
  const [c1, c2] = ITEM_KIND_BG[it[1]];
  const k = `it-${id}`;
  return (
    <svg viewBox="0 0 96 96" width={size} height={size} role="img" aria-label={label ?? `${it[0]}（${ITEM_KIND_JP[it[1]]}）`} style={{ display: 'block' }}>
      {frame && <MistBg id={k} c1={c1} c2={c2} />}
      <g clipPath={frame ? `url(#cl-${k})` : undefined}>{ITEM_DRAW[id]}</g>
    </svg>
  );
}
