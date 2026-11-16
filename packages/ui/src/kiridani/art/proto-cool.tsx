// かっこいい路線の試作（4枚）。決まれば全部この描き方にそろえる
import type { ReactNode } from 'react';

const INK = '#0B0E18';
const ln = { stroke: INK, strokeWidth: 1.3, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
const shade = (o = 0.32) => ({ fill: '#0B0E18', opacity: o });

function Frame({ id, size, label, bg, glow, glowAt = [62, 40], children }: { id: string; size: number; label: string; bg: [string, string]; glow: string; glowAt?: [number, number]; children: ReactNode }) {
  return (
    <svg viewBox="0 0 96 96" width={size} height={size} role="img" aria-label={label} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={bg[0]} /><stop offset="1" stopColor={bg[1]} /></linearGradient>
        <radialGradient id={`${id}-gl`} cx={glowAt[0] / 96} cy={glowAt[1] / 96} r="0.55"><stop offset="0" stopColor={glow} stopOpacity="0.75" /><stop offset="1" stopColor={glow} stopOpacity="0" /></radialGradient>
        <linearGradient id={`${id}-vg`} x1="0" y1="0" x2="0" y2="1"><stop offset="0.55" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.55" /></linearGradient>
        <clipPath id={`${id}-cl`}><rect width="96" height="96" rx="6" /></clipPath>
      </defs>
      <g clipPath={`url(#${id}-cl)`}>
        <rect width="96" height="96" fill={`url(#${id}-bg)`} />
        <rect width="96" height="96" fill={`url(#${id}-gl)`} />
        {children}
        <rect width="96" height="96" fill={`url(#${id}-vg)`} />
      </g>
      <rect x="0.75" y="0.75" width="94.5" height="94.5" rx="6" fill="none" stroke="#C9A45C" strokeWidth={1.5} opacity={0.8} />
    </svg>
  );
}

/** リク（魔物狩り） */
export function CoolRiku({ size = 96 }: { size?: number }) {
  return (
    <Frame id="cr" size={size} label="リク（魔物狩り）" bg={['#1A1726', '#2C2438']} glow="#7B4FA6" glowAt={[70, 30]}>
      {/* 霧の筋 */}
      <path d="M-4 70c20-6 40 2 60-4s30-4 44 0" fill="none" stroke="#B596D6" strokeWidth={6} opacity={0.12} />
      {/* 背中の大剣 */}
      <g transform="rotate(32 70 40)">
        <path d="M66 -10h10l2 6v58h-14V-4z" fill="#8D97A8" {...ln} />
        <path d="M71 -8v60" stroke="#E6ECF4" strokeWidth={1.2} />
        <path d="M76 -4l2 2v56h-3z" fill="#5A6272" />
        <path d="M58 54h26l-3 5H61z" fill="#6B5634" {...ln} />
        <path d="M68 59h6v16h-6z" fill="#2A2230" {...ln} />
      </g>
      {/* 体：黒い外套と革の肩当て */}
      <path d="M2 96l8-22c6-9 18-13 28-15l10 7 10-7c10 2 22 6 28 15l8 22z" fill="#23202E" {...ln} />
      <path d="M48 66l-10-7c-8 2-16 5-22 10l4 27h28z" {...shade(0.35)} />
      <path d="M12 76c4-8 12-12 22-12l2 8c-8 1-16 4-22 10z" fill="#4A3628" {...ln} />
      <path d="M84 76c-4-8-12-12-22-12l-2 8c8 1 16 4 22 10z" fill="#5A4230" {...ln} />
      <path d="M30 66l36 30M66 66L44 96" stroke="#3B2C22" strokeWidth={3.4} />
      <path d="M30 66l36 30" stroke="#6B5634" strokeWidth={1} />
      <rect x="44" y="78" width="8" height="6" fill="#B8924A" {...ln} transform="rotate(40 48 81)" />
      {/* 襟巻き（赤・ぼろ） */}
      <path d="M38 56c4 6 16 6 20 0l4 6c4 2 10 2 14 6-6 0-8 2-12 1l2 5c-4-2-6-3-8-5-6 4-16 4-22-1l-4-6z" fill="#7A1E24" {...ln} />
      <path d="M40 60c4 3 12 3 16 0" fill="none" stroke="#B83A3A" strokeWidth={1} />
      {/* 首と顔 */}
      <path d="M44 50h8v8h-8z" fill="#B88A6A" {...ln} />
      <path d="M36.5 36c0-10 5-16 11.5-16S59.5 26 59.5 36l-1 9c-1 6-6 12-10.5 13-4.5-1-9.5-7-10.5-13z" fill="#D2A27E" {...ln} />
      <path d="M36.5 36c0 5 0 7 1 9 1 6 6 12 10.5 13-3-2-6-6-7-12l-1-9z" {...shade(0.28)} />
      <path d="M59.5 34l-1 11c-1 5-4 9-7 11" fill="none" stroke="#E7B9F0" strokeWidth={0.9} opacity={0.9} />
      {/* 目・眉・鼻・口 */}
      <path d="M39.5 38.5l6-1 .3 1.6-5.3.6z" fill="#F4EEE6" {...ln} strokeWidth={0.8} />
      <path d="M50.5 37.5l6 1-1 1.4-5.2-.6z" fill="#F4EEE6" {...ln} strokeWidth={0.8} />
      <circle cx="43.4" cy="38.6" r="1.1" fill="#7B4FA6" /><circle cx="53" cy="38.6" r="1.1" fill="#7B4FA6" />
      <path d="M38.5 35.6l7.5-.4M50 35.2l7.5.6" stroke={INK} strokeWidth={1.6} strokeLinecap="round" />
      <path d="M48.6 41l.9 4.6-1.6.4" fill="none" {...ln} strokeWidth={0.9} />
      <path d="M45.4 50.4h5.4" {...ln} strokeWidth={1} />
      <path d="M54 33l3 12" stroke="#C0453E" strokeWidth={1.1} />
      {/* 髪（角ばった房） */}
      <path d="M34 40l-2-10 3-8-1-6 6 3 4-7 3 5 6-6 1 6 7-3-2 6 6 1-3 5 3 6-4 1 1 9-3-6-4-6-5 4-1-5-6 6v-6l-5 7z" fill="#151827" {...ln} />
      <path d="M46 16l3 5 6-6M57 24l6 1" fill="none" stroke="#6A5C9A" strokeWidth={1.1} />
      <path d="M36.5 31.8c7-2 16-2.4 23 .2l-.3 2.2c-7-2-16-2-22.5 0z" fill="#7A1E24" {...ln} strokeWidth={0.9} />
    </Frame>
  );
}

/** ミナ（土くれの魔導士）：手のひらの炎が顔を下から照らす */
export function CoolMina({ size = 96 }: { size?: number }) {
  return (
    <Frame id="cm" size={size} label="ミナ（土くれの魔導士）" bg={['#1C1416', '#3A2018']} glow="#F6A13A" glowAt={[66, 66]}>
      {/* 背後のフード */}
      <path d="M26 64c-4-22 2-42 22-46 20 4 26 24 22 46z" fill="#3A2622" {...ln} />
      {/* ローブ */}
      <path d="M4 96l8-20c6-8 16-12 26-14l10 8 10-8c10 2 20 6 26 14l8 20z" fill="#4A2A24" {...ln} />
      <path d="M38 62l10 8v26H14l-2-20c6-8 16-12 26-14z" {...shade(0.38)} />
      <path d="M38 62l10 18 10-18" fill="none" stroke="#C9A45C" strokeWidth={1.4} />
      <path d="M48 80v16" stroke="#C9A45C" strokeWidth={1.2} />
      {/* 長い赤髪 */}
      <path d="M33 38c-3 14-2 26-6 36l8-4 2 6 4-10 1-20zM63 38c3 14 2 26 6 36l-8-4-2 6-4-10-1-20z" fill="#8E2A1E" {...ln} />
      <path d="M44 50h8v8h-8z" fill="#B88A6A" {...ln} />
      <path d="M37 37c0-10 5-15 11-15s11 5 11 15l-1 8c-1 6-6 11-10 12-4-1-9-6-10-12z" fill="#E2B595" {...ln} />
      <path d="M37 37l1 8c1 6 6 11 10 12-3-2-6-6-7-12-1-4-1-6-1-8z" {...shade(0.3)} />
      {/* 下からの炎の照り返し */}
      <path d="M41 46c2 6 5 9 7 10 3-1 6-4 8-10-3 3-5 4-8 4s-5-1-7-4z" fill="#F6A13A" opacity={0.55} />
      <path d="M40.2 39l5.6-.8.2 1.4-5 .6z" fill="#FFF4E0" {...ln} strokeWidth={0.8} />
      <path d="M50.2 38.2l5.6.8-.8 1.2-5-.6z" fill="#FFF4E0" {...ln} strokeWidth={0.8} />
      <circle cx="43.6" cy="39" r="1" fill="#E0662F" /><circle cx="52.6" cy="39" r="1" fill="#E0662F" />
      <path d="M39.6 36.2l6.4-.6M50 35.6l6.4.6" stroke={INK} strokeWidth={1.2} strokeLinecap="round" />
      <path d="M48.4 41.4l.8 3.6-1.4.4" fill="none" {...ln} strokeWidth={0.8} />
      <path d="M46 50c1.4.6 3 .6 4.4 0" fill="none" {...ln} strokeWidth={0.9} />
      {/* 前髪とフードの縁 */}
      <path d="M36 40c-1-12 5-18 12-18s13 6 12 18l-3-7-3 4-2-6-4 5-2-5-4 6-2-4z" fill="#A8361F" {...ln} />
      <path d="M30 56c-4-18 2-34 18-38 16 4 22 20 18 38-2-14-8-26-18-28-10 2-16 14-18 28z" fill="#5A3A30" {...ln} />
      <path d="M48 18c16 4 22 20 18 38" fill="none" stroke="#F6A13A" strokeWidth={0.9} opacity={0.7} />
      {/* 手のひらの炎 */}
      <path d="M58 96c0-8 2-14 8-18 3-2 7 0 8 3l2 15z" fill="#C89070" {...ln} />
      <circle cx="68" cy="66" r="14" fill="#F6A13A" opacity={0.25} />
      <path d="M68 78c-7 0-10-5-8-10 1-4 4-5 4-10 3 2 5 5 4 9 2-1 3-4 3-7 4 4 6 8 5 12-1 4-4 6-8 6z" fill="#E0662F" {...ln} />
      <path d="M68 76c-3 0-4-2-3-5 1-2 2-3 2-5 2 1 3 3 3 5s-1 5-2 5z" fill="#FFE2A0" />
      {[[74, 50], [60, 54], [80, 60]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={0.9 + (i % 2) * 0.5} fill="#FFD58A" />)}
    </Frame>
  );
}

/** はぐれ狼 */
export function CoolWolf({ size = 96 }: { size?: number }) {
  return (
    <Frame id="cw" size={size} label="はぐれ狼（獣）" bg={['#121A20', '#24323A']} glow="#9CC4D8" glowAt={[70, 18]}>
      <circle cx="74" cy="16" r="9" fill="#E6EEF2" opacity={0.85} />
      <path d="M0 80l20-10 14 6 20-14 20 10 22-8v32H0z" fill="#0E1418" />
      {/* 首まわりの毛 */}
      <path d="M8 96l6-20-6-4 10-4-4-8 12 2 4-10 10 8 8-6 8 6 10-8 4 10 12-2-4 8 10 4-6 4 6 20z" fill="#2E3640" {...ln} />
      {/* 頭（角ばった逆三角） */}
      <path d="M22 30l-4-20 16 12h28l16-12-4 20 4 12-10 8-4 12-10 12h-12l-10-12-4-12-10-8z" fill="#4A5462" {...ln} />
      <path d="M48 22H34L18 10l4 20-4 12 10 8 4 12 10 12h6z" {...shade(0.32)} />
      <path d="M22 12l10 9-8-2zM74 12l-10 9 8-2z" fill="#7A2E34" />
      <path d="M62 22l16-12-4 20 4 12" fill="none" stroke="#B8D8E8" strokeWidth={1} />
      {/* 鼻面 */}
      <path d="M40 48h16l4 12-4 8-8 4-8-4-4-8z" fill="#6A7482" {...ln} />
      <path d="M44 50h8l-2 4h-4z" fill={INK} />
      <path d="M48 54v6M42 64c4 2 8 2 12 0" fill="none" {...ln} />
      <path d="M38 62l4 8 2-5 4 4 4-4 2 5 4-8" fill="#6A1E22" {...ln} />
      <path d="M41 64l2 5 1-4zM55 64l-2 5-1-4z" fill="#EDE7DA" {...ln} strokeWidth={0.7} />
      {/* 光る目 */}
      <path d="M30 38l10 2-2 3-7-1z" fill="#F2C94C" {...ln} strokeWidth={0.9} />
      <path d="M66 38l-10 2 2 3 7-1z" fill="#F2C94C" {...ln} strokeWidth={0.9} />
      <path d="M35 39.4v2.6M61 39.4v2.6" stroke={INK} strokeWidth={1.4} />
      <path d="M26 41l-8 2M70 41l8 2" stroke="#F2C94C" strokeWidth={1} opacity={0.6} />
      <path d="M28 34l12 3M68 34l-12 3" stroke={INK} strokeWidth={1.6} strokeLinecap="round" />
      <path d="M44 26l4 6 4-6" fill="none" stroke="#2E3640" strokeWidth={1.2} />
    </Frame>
  );
}

/** 谷底の古竜（横顔） */
export function CoolDragon({ size = 96 }: { size?: number }) {
  return (
    <Frame id="cd" size={size} label="主：谷底の古竜" bg={['#120C0E', '#3A1612']} glow="#E0662F" glowAt={[22, 70]}>
      {/* 煙 */}
      <path d="M-4 30c14-8 30-2 40-8M60 88c14-4 24 2 40-4" fill="none" stroke="#8A7A78" strokeWidth={5} opacity={0.18} />
      {/* 首 */}
      <path d="M96 40c-14 6-22 18-26 34l-6 22h32z" fill="#2A1A1E" {...ln} />
      <path d="M94 48c-10 6-16 16-18 28M96 62c-6 4-10 10-12 18" fill="none" stroke="#4A2A2A" strokeWidth={1.2} />
      {/* 後ろの角 */}
      <path d="M70 30C78 18 88 12 98 10c-8 6-14 14-18 24zM66 26c4-12 4-22 0-30 8 6 12 16 10 28z" fill="#B8A88A" {...ln} />
      <path d="M72 28c6-8 14-13 22-16" fill="none" stroke="#6A5C4A" strokeWidth={1} />
      {/* 頭（左向き） */}
      <path d="M8 56l14-10 16-6 10-12 16-4 14 6 6 12-4 12-10 6-14 4-6 6-16 4H18l-10-4 4-6z" fill="#3A2226" {...ln} />
      <path d="M8 56l4 6 10 2 16 0 16-4 6-6 14-4 10-6-6 12-10 6-14 4-6 6-16 4H18l-10-4 4-6z" {...shade(0.3)} />
      {/* 下あご（開いて火が見える） */}
      <path d="M12 62l10 6 18 2 14-2 6 6-12 8-18 2-12-4-8-6z" fill="#2E1A1E" {...ln} />
      <path d="M14 63c8 3 16 5 26 5l12-1 4 3c-10 4-24 4-36 0z" fill="#F6A13A" />
      <path d="M18 65c8 2 16 3 24 3" fill="none" stroke="#FFE2A0" strokeWidth={1.4} />
      <path d="M16 62l2 4 2-3 2 4 2-3 2 4 2-3 2 4 2-3 2 4M18 70l2-3 2 3 2-3 2 3 2-3 2 3" fill="none" stroke="#EDE3C8" strokeWidth={1.1} strokeLinejoin="round" />
      {/* 鼻先の角と鱗 */}
      <path d="M14 50l-4-6 8 2zM24 44l-2-8 7 6z" fill="#B8A88A" {...ln} strokeWidth={1} />
      <path d="M36 42l6 2M44 36l6 2M52 30l6 3M60 40l6 2M48 46l6 2" stroke="#5A3236" strokeWidth={1} />
      <path d="M22 46l16-6 10-12 16-4 14 6" fill="none" stroke="#E07A5A" strokeWidth={1} opacity={0.8} />
      {/* 目 */}
      <path d="M50 36l10-2-2 5-7 1z" fill="#F2C94C" {...ln} strokeWidth={0.9} />
      <path d="M55 34.6v5" stroke={INK} strokeWidth={1.3} />
      <path d="M48 34l14-4" stroke={INK} strokeWidth={1.8} strokeLinecap="round" />
      <path d="M60 36l10 1" stroke="#F2C94C" strokeWidth={0.8} opacity={0.6} />
      {/* 火の粉 */}
      {[[8, 74], [20, 84], [4, 66], [30, 90], [14, 80]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={0.8 + (i % 2) * 0.6} fill="#FFD58A" />)}
    </Frame>
  );
}
