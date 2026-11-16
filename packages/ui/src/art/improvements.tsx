// 設備カード29枚のイラスト（オリジナル）。viewBox 0 0 100 100
import type { ReactNode } from 'react';
import { C, L, O } from './common';

const ground = <path {...O} d="M8 88h84" fill="none" />;
const steam = (x: number, y = 20) => <path {...L} d={`M${x} ${y}c-4-5 4-8 0-13M${x + 12} ${y}c-4-5 4-8 0-13`} stroke="#9AA3A8" strokeWidth={3} />;
const use = (id: string, x: number, y: number, s: number) => <use href={`#${id}`} x={x} y={y} width={s} height={s} />;
const bricks = (x: number, y: number, w: number, h: number) => (
  <path {...L} stroke={C.clayD} d={Array.from({ length: Math.floor(h / 12) }, (_, i) => `M${x} ${y + 12 * (i + 1)}h${w}`).join('')} />
);

const ART: Record<string, ReactNode> = {
  kamado: <>{steam(42)}<path {...O} d="M30 34h40l-3 12H33z" fill="#4A4F57" /><path {...O} d="M26 30h48v6H26z" fill="#6B7178" />
    <path {...O} d="M18 48c0-4 3-6 7-6h50c4 0 7 2 7 6v38H18z" fill={C.clay} />{bricks(18, 48, 64, 36)}
    <path {...O} d="M38 86V76c0-7 5-12 12-12s12 5 12 12v10z" fill="#3A2A22" /><path d="M42 86c0-6 3-10 8-12 2 4 6 6 6 12z" fill="#F28C3A" />{ground}</>,
  okamado: <>{steam(24)}{steam(56)}<path {...O} d="M10 46c0-4 3-6 7-6h66c4 0 7 2 7 6v40H10z" fill={C.clay} />{bricks(10, 46, 80, 36)}
    <path {...O} d="M18 34h28v8H18zM54 34h28v8H54z" fill="#4A4F57" />
    <path {...O} d="M22 86V78c0-6 4-10 9-10s9 4 9 10v8zM60 86V78c0-6 4-10 9-10s9 4 9 10v8z" fill="#3A2A22" />
    <path d="M26 86c0-5 2-8 5-10 2 3 5 5 5 10zM64 86c0-5 2-8 5-10 2 3 5 5 5 10z" fill="#F28C3A" />{ground}</>,
  ishigama: <><path {...O} d="M12 88c0-30 16-48 38-48s38 18 38 48z" fill={C.stone} />
    <path {...L} d="M24 60l8 4M44 46l2 8M66 50l-4 8M74 68l-8 2M30 76h8" stroke={C.stoneD} />
    <path {...O} d="M36 88V74c0-8 6-14 14-14s14 6 14 14v14z" fill="#3A2A22" />
    <ellipse {...O} cx="50" cy="80" rx="10" ry="5" fill="#E8B26A" /><path {...L} d="M44 79l3-2M50 79l3-2" />{ground}</>,
  ido: <><path {...O} d="M20 40L50 18l30 22z" fill={C.red} /><path {...O} d="M26 40v24M74 40v24" fill="none" strokeWidth={4} stroke={C.woodD} />
    <path {...L} d="M50 34v14" /><path {...O} d="M45 48h10l-1 8h-8z" fill={C.wood} />
    <path {...O} d="M18 62h64v26H18z" fill={C.stone} /><path {...L} d="M18 74h64M34 62v12M58 62v12M46 74v14M70 74v14M26 74v14" stroke={C.stoneD} />
    <ellipse {...O} cx="50" cy="62" rx="32" ry="5" fill={C.water} /></>,
  kura: <><path {...O} d="M14 38L50 16l36 22z" fill="#4A4F57" /><path {...O} d="M20 38h60v30H20z" fill="#FFFDF7" />
    <path {...O} d="M20 68h60v20H20z" fill="#2B3A3A" /><path d="M24 74h52M24 82h52" stroke="#FFFDF7" strokeWidth={2} strokeDasharray="6 4" />
    <path {...O} d="M42 46h16v14H42z" fill={C.woodD} /><circle cx="50" cy="28" r="4" fill="#FFFDF7" {...O} /></>,
  teoshi: <><path {...O} d="M14 52h52l-6 20H22z" fill={C.leaf} /><path {...O} d="M66 54l22-10" fill="none" strokeWidth={4} stroke={C.woodD} />
    <circle {...O} cx="30" cy="78" r="9" fill={C.wood} /><circle cx="30" cy="78" r="3" fill="#2B3A3A" />
    {use('i-wood', 20, 22, 36)}{use('i-stone', 44, 28, 26)}</>,
  suki: <><path {...O} d="M20 30l44 26" fill="none" strokeWidth={5} stroke={C.woodD} /><path {...O} d="M14 22h14v8H14z" fill={C.wood} />
    <path {...O} d="M58 50l20 6-6 26-22-12z" fill={C.stone} /><path {...L} d="M64 58l8 2" stroke="#fff" />
    <path {...O} d="M18 88c10-6 22-6 32 0s22 6 32 0" fill="none" stroke={C.woodD} /></>,
  taihi: <><path {...O} d="M16 44L50 22l34 22z" fill={C.wood} /><path {...O} d="M22 44h56v44H22z" fill={C.woodL} />
    <path {...L} d="M22 56h56M22 70h56" stroke={C.woodD} />
    <path {...O} d="M30 88c0-12 8-18 20-18s20 6 20 18z" fill="#7A4E2D" />
    <path {...O} d="M50 70c-2-8 2-14 10-16 0 8-4 13-10 16z" fill={C.leafL} />{steam(40, 26)}</>,
  onshitsu: <><path {...O} d="M12 88V54c0-18 17-30 38-30s38 12 38 30v34z" fill="#DDF2F6" />
    <path {...L} d="M50 24v64M24 34v54M76 34v54M12 60h76" stroke="#7EC4DA" />
    <path d="M20 36c6-6 14-8 20-8" stroke="#fff" strokeWidth={4} strokeLinecap="round" />
    {use('i-veg', 26, 58, 28)}{use('i-veg', 54, 60, 26)}{ground}</>,
  youmou: <><path {...O} d="M14 46L46 26l32 20z" fill={C.wood} /><path {...O} d="M20 46h52v42H20z" fill={C.woodL} />
    <circle {...O} cx="72" cy="72" r="16" fill={C.pink} /><path {...L} d="M60 64c8 2 18 10 22 20M58 76c8-2 16 0 22 6M66 58c2 8 2 18-2 28" stroke="#C9768C" />
    {use('i-sheep', 22, 54, 34)}</>,
  kunsei: <><path {...L} d="M64 22c-5-5 5-8 0-13M74 24c-5-5 5-8 0-13" stroke="#9AA3A8" strokeWidth={3.5} />
    <path {...O} d="M60 26h18v20H60z" fill={C.clay} /><path {...O} d="M18 50L50 30l32 20z" fill="#5A3B2E" />
    <path {...O} d="M24 50h52v38H24z" fill={C.wood} /><path {...O} d="M38 58h24v20H38z" fill="#3A2A22" />
    <path {...O} d="M44 60v10M50 60v12M56 60v9" fill="none" stroke="#E5803A" strokeWidth={3.5} /></>,
  chichi: <><path {...O} d="M34 30h32v6l6 8v42c0 3-2 4-4 4H36c-2 0-4-1-4-4V44l6-8z" fill="#E3E6E8" />
    <path {...O} d="M38 22h24v8H38z" fill={C.stone} /><path {...O} d="M32 56h40v14H32z" fill="#4F86C6" />
    <path d="M40 40c6-2 14-2 20 0" stroke="#fff" strokeWidth={3} strokeLinecap="round" />
    <path {...O} d="M12 80c0-6 4-10 8-10s8 4 8 10-4 8-8 8-8-2-8-8z" fill="#fff" /></>,
  kaju: <><path {...O} d="M46 88V56h8v32z" fill={C.woodD} /><circle {...O} cx="50" cy="40" r="28" fill={C.leaf} />
    <circle {...O} cx="36" cy="38" r="5" fill="#E5533D" /><circle {...O} cx="58" cy="30" r="5" fill="#E5533D" />
    <circle {...O} cx="62" cy="50" r="5" fill="#E5533D" /><circle {...O} cx="44" cy="54" r="5" fill="#F2B630" />{ground}</>,
  hachi: <><path {...O} d="M26 34h48v12H26zM24 46h52v16H24zM26 62h48v18H26z" fill="#F6C142" />
    <path {...O} d="M20 30h60v6H20z" fill={C.wood} /><path {...O} d="M44 74h12v6H44z" fill="#3A2A22" />
    <g transform="translate(70 18)"><ellipse {...O} cx="0" cy="0" rx="7" ry="5" fill="#F6C142" /><path d="M-2-5v10M2-5v10" stroke="#2B3A3A" strokeWidth={2} />
      <ellipse cx="-2" cy="-8" rx="4" ry="3" fill="#fff" {...O} strokeWidth={1.6} /></g>
    <path {...O} d="M16 80h68v8H16z" fill={C.woodD} /></>,
  yagura: <><path {...O} d="M30 30L50 12l20 18z" fill={C.red} /><path {...O} d="M34 30h32v14H34z" fill={C.woodL} />
    <path {...O} d="M36 44L26 88M64 44l10 44M50 44v44" fill="none" strokeWidth={4} stroke={C.woodD} />
    <path {...L} d="M30 62h40M28 76h44M34 50l32 22M66 50L34 72" stroke={C.wood} />
    <circle cx="50" cy="37" r="3" fill="#2B3A3A" /></>,
  keiryo: <><path {...O} d="M50 18v60" fill="none" strokeWidth={4} /><path {...O} d="M18 30h64" fill="none" strokeWidth={4} />
    <path {...L} d="M22 30l-8 22M22 30l8 22M78 30l-8 18M78 30l8 18" />
    <path {...O} d="M10 52h24c0 6-5 10-12 10S10 58 10 52zM66 48h24c0 6-5 10-12 10s-12-4-12-10z" fill={C.gold} />
    <path {...O} d="M34 78h32v10H34z" fill={C.woodD} /><circle {...O} cx="50" cy="16" r="5" fill={C.gold} />
    {use('i-grain', 12, 30, 20)}</>,
  souko: <><path {...O} d="M8 40L50 16l42 24z" fill={C.leafD} /><path {...O} d="M14 40h72v48H14z" fill={C.woodL} />
    <path {...O} d="M22 60h22v28H22zM46 66h20v22H46zM56 50h18v16H56z" fill={C.wood} />
    <path {...L} d="M22 60l22 28M44 60L22 88M46 66l20 22M66 66L46 88" stroke={C.woodD} /></>,
  ushigoya: <><path {...O} d="M10 44L50 18l40 26z" fill={C.red} /><path {...O} d="M16 44h68v44H16z" fill="#E86A55" />
    <path {...O} d="M36 56h28v32H36z" fill="#FFFDF7" /><path {...L} d="M36 56l28 32M64 56L36 88" stroke={C.red} />{use('i-cattle', 56, 52, 40)}</>,
  butagoya: <><path {...O} d="M12 50L50 30l38 20z" fill={C.wood} /><path {...O} d="M18 50h64v38H18z" fill={C.woodL} />
    <path {...O} d="M10 70h80M10 82h80" fill="none" stroke={C.woodD} strokeWidth={4} />
    <path {...O} d="M14 64v24M86 64v24" fill="none" stroke={C.woodD} strokeWidth={4} />{use('i-pig', 30, 50, 40)}</>,
  inu: <><path {...O} d="M30 30l-6-14 14 8zM70 30l6-14-14 8z" fill="#E8A23A" />
    <path {...O} d="M26 88c0-16 10-28 24-28s24 12 24 28z" fill="#E8A23A" />
    <ellipse {...O} cx="50" cy="44" rx="24" ry="20" fill="#E8A23A" />
    <path d="M34 48c4 12 28 12 32 0-4 8-28 8-32 0z" fill="#FFF3DA" /><ellipse cx="50" cy="52" rx="12" ry="9" fill="#FFF3DA" />
    <circle cx="40" cy="42" r="3" fill="#2B3A3A" /><circle cx="60" cy="42" r="3" fill="#2B3A3A" />
    <ellipse cx="50" cy="50" rx="4" ry="3" fill="#2B3A3A" /><path {...L} d="M46 56q4 3 8 0" />
    <path {...O} d="M36 64h28v6H36z" fill="#E5533D" /></>,
  yurikago: <><path {...O} d="M14 52h72c0 18-16 30-36 30S14 70 14 52z" fill={C.wood} />
    <path {...O} d="M10 88c10-8 70-8 80 0" fill="none" stroke={C.woodD} strokeWidth={4} />
    <circle {...O} cx="40" cy="48" r="10" fill="#FCE6EC" /><path {...O} d="M40 38c-1-6 1-10 6-12 0 6-3 9-6 12z" fill="#6CC17A" />
    <path {...O} d="M48 50h30c0 4-4 6-8 6H52c-3 0-4-2-4-6z" fill={C.pink} /></>,
  shokutaku: <><path {...O} d="M8 54h84v8H8z" fill={C.wood} /><path {...O} d="M16 62v26M84 62v26" fill="none" stroke={C.woodD} strokeWidth={5} />
    <ellipse {...O} cx="28" cy="50" rx="12" ry="4" fill="#fff" /><ellipse {...O} cx="72" cy="50" rx="12" ry="4" fill="#fff" />
    <path {...O} d="M40 50c0-10 4-16 10-16s10 6 10 16z" fill={C.clay} />{use('i-food', 18, 34, 18)}{use('i-veg', 64, 32, 18)}</>,
  ishidatami: <><ellipse {...O} cx="50" cy="66" rx="42" ry="22" fill={C.leafL} />
    <g {...O} fill={C.stone}><ellipse cx="30" cy="66" rx="10" ry="6" /><ellipse cx="52" cy="60" rx="10" ry="6" /><ellipse cx="72" cy="68" rx="9" ry="6" /><ellipse cx="46" cy="76" rx="9" ry="5" /></g>
    <path {...O} d="M74 50c0-8 4-14 10-16 2 8-2 14-10 16z" fill={C.leaf} /><circle {...O} cx="20" cy="50" r="6" fill={C.pink} /></>,
  chokoku: <><path {...O} d="M30 74h40v14H30z" fill={C.stone} /><path {...O} d="M36 66h28v8H36z" fill={C.stoneD} />
    <path {...O} d="M36 66c0-10 6-16 14-16s14 6 14 16z" fill="#D7DCDF" /><circle {...O} cx="50" cy="40" r="11" fill="#D7DCDF" />
    <path {...O} d="M50 29c-1-6 2-10 7-11 0 6-3 9-7 11zM50 29c-1-4-5-6-9-5 1 4 5 5 9 5z" fill="#D7DCDF" />
    <path d="M18 24l2 6 6 2-6 2-2 6-2-6-6-2 6-2zM82 30l1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5z" fill={C.gold} /></>,
  suiro: <><path {...O} d="M8 58h84v18H8z" fill={C.water} /><path d="M16 66h14M44 64h18M70 68h12" stroke="#fff" strokeWidth={3} strokeLinecap="round" />
    <path {...O} d="M8 54h84v4H8zM8 76h84v4H8z" fill={C.stone} />{use('i-grain', 12, 18, 34)}{use('i-grain', 52, 16, 36)}</>,
  shushi: <><path {...O} d="M30 34c-6 10-12 22-12 34 0 14 14 20 32 20s32-6 32-20c0-12-6-24-12-34z" fill={C.cream} />
    <path {...O} d="M34 34c-2-6 2-12 16-12s18 6 16 12z" fill={C.cream} /><path {...O} d="M30 34h40" fill="none" stroke={C.red} strokeWidth={4} />
    {use('i-grain', 28, 50, 24)}{use('i-veg', 50, 50, 24)}</>,
  kyoka: <><path {...O} d="M24 18h52v66H24z" fill={C.paper} /><path {...O} d="M20 14h60v8H20zM20 80h60v8H20z" fill={C.clay} />
    <path {...L} d="M32 32h36M32 42h36M32 52h24" /><circle {...O} cx="62" cy="66" r="9" fill="#E5533D" />
    <path d="M58 66l3 3 5-6" stroke="#fff" strokeWidth={2.4} fill="none" strokeLinecap="round" /></>,
  bofu: <><path {...L} d="M6 30h16M4 42h12M8 54h10" stroke="#7EC4DA" strokeWidth={3} />
    {[28, 50, 72].map((x, i) => <g key={x}><path {...O} d={`M${x - 2} 88V64h4v24z`} fill={C.woodD} /><path {...O} d={`M${x} ${20 + i * 2}c10 10 14 26 12 40-4 4-20 4-24 0-2-14 2-30 12-40z`} fill={i === 1 ? C.leafD : C.leaf} /></g>)}
    {ground}</>,
  makigoya: <><path {...O} d="M10 36l40-16 40 16v6H10z" fill={C.woodD} /><path {...O} d="M16 42v46M84 42v46" fill="none" stroke={C.woodD} strokeWidth={4} />
    {[0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => <circle key={`${r}${c}`} {...O} strokeWidth={2.4} cx={27 + c * 15 + (r % 2) * 7} cy={80 - r * 12} r={6.5} fill={C.woodL} />))}</>,
};

export const IMPROVEMENT_ART_IDS = Object.keys(ART);

export function ImprovementArt({ id, size = 96 }: { id: string; size?: number }) {
  return <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-hidden>{ART[id] ?? ART.ishidatami}</svg>;
}
