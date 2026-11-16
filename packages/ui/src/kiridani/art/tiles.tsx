// 正方形の小さな絵：天候アイコン（WeatherArt）・行動スペースと巣の地形（TerrainArt）・カード裏（CardBackArt）
import type { ReactNode } from 'react';
import { INK, K, O, L, T, MistBg, Spark } from './common';
import { ITEM_DRAW } from './items';
import { NEST_DRAW, NEST_JP } from './scenes';

export interface ArtProps { id: string; size?: number; label?: string; frame?: boolean }

function Tile({ k, size, label, bg, frame = true, children }: { k: string; size: number; label?: string; bg: [string, string]; frame?: boolean; children: ReactNode }) {
  return (
    <svg viewBox="0 0 96 96" width={size} height={size} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} style={{ display: 'block' }}>
      {frame && <MistBg id={k} c1={bg[0]} c2={bg[1]} />}
      <g clipPath={frame ? `url(#cl-${k})` : undefined}>{children}</g>
    </svg>
  );
}

// ---------------------------------------------------------------- 天候アイコン
const Sun = ({ x = 48, y = 46, r = 18, c = K.thunder2 }: { x?: number; y?: number; r?: number; c?: string }) => (
  <g>{[0, 45, 90, 135, 180, 225, 270, 315].map((a) => <path key={a} d={`M${x} ${y - r - 12}l3 7h-6z`} fill={c} {...O} strokeWidth={1.6} transform={`rotate(${a} ${x} ${y})`} />)}
    <circle cx={x} cy={y} r={r} fill={c} {...O} /></g>
);
const Cloud = ({ x, y, s = 1, c = '#fff' }: { x: number; y: number; s?: number; c?: string }) => (
  <path transform={`translate(${x} ${y}) scale(${s})`} d="M0 20c-12 0-14-16-3-18 1-10 16-14 22-5 4-9 22-8 24 3 10-1 14 12 5 16 4 4 0 8-6 8z" fill={c} {...O} strokeWidth={2.6 / s} />
);
const Flake = ({ x, y, r = 6 }: { x: number; y: number; r?: number }) => (
  <g><path d={`M${x} ${y - r}v${2 * r}M${x - r * 0.87} ${y - r / 2}l${r * 1.74} ${r}M${x - r * 0.87} ${y + r / 2}l${r * 1.74} -${r}`} {...L} stroke={INK} strokeWidth={4} />
    <path d={`M${x} ${y - r}v${2 * r}M${x - r * 0.87} ${y - r / 2}l${r * 1.74} ${r}M${x - r * 0.87} ${y + r / 2}l${r * 1.74} -${r}`} {...L} stroke="#fff" strokeWidth={1.8} /></g>
);

const WEATHER: Record<string, { jp: string; bg: [string, string]; d: ReactNode }> = {
  calm: { jp: '穏やかな日', bg: ['#8FCBE6', '#EAF6F8'], d: <><Sun /><Cloud x={46} y={58} s={0.8} /></> },
  storm: { jp: '嵐', bg: ['#4A5470', '#9AA4BC'], d: <><Cloud x={18} y={14} s={1.3} c="#7A849C" /><path d="M52 50l-10 16h8l-6 18" {...L} stroke={INK} strokeWidth={7} /><path d="M52 50l-10 16h8l-6 18" {...L} stroke={K.thunder} strokeWidth={3.6} />
    {[24, 34, 66, 76].map((x) => <path key={x} d={`M${x} 56l-4 10`} {...T} stroke="#DCE4F4" strokeWidth={2} />)}</> },
  sprout: { jp: '芽吹き', bg: [K.moss3, '#F4F8E4'], d: <><path d="M14 80c20-6 48-6 68 0" {...L} stroke={K.wood} strokeWidth={5} /><path d="M48 78V48" {...L} stroke={K.moss} strokeWidth={4} />
    <path d="M48 56c-14 0-18-10-16-18 12 0 16 8 16 18zM48 50c12 0 18-8 16-18-12 0-16 8-16 18z" fill={K.moss2} {...O} /><circle cx="24" cy="26" r="4" fill="#F6A7BB" {...O} strokeWidth={1.4} /><circle cx="74" cy="24" r="3.4" fill="#F6A7BB" {...O} strokeWidth={1.4} /></> },
  thaw: { jp: '雪解け', bg: [K.ice, K.ice3], d: <><path d="M48 18c10 16 18 26 18 38a18 18 0 0 1-36 0c0-12 8-22 18-38z" fill={K.ice2} {...O} /><path d="M40 58c0 6 4 10 8 10" {...L} stroke="#fff" strokeWidth={3} />
    <path d="M14 82c8-4 16-4 24 0s16 4 24 0 14-4 20 0" {...L} stroke={K.ice} strokeWidth={4} /></> },
  fog: { jp: '濃霧', bg: ['#AAB4C0', '#E8ECF0'], d: <>{[30, 46, 62].map((y, i) => <g key={y}><path d={`M${16 + i * 6} ${y}h${56 - i * 6}`} {...L} stroke={INK} strokeWidth={9} /><path d={`M${16 + i * 6} ${y}h${56 - i * 6}`} {...L} stroke="#fff" strokeWidth={5.4} /></g>)}</> },
  newmoon: { jp: '新月', bg: [K.night, '#4A3E6E'], d: <><circle cx="48" cy="46" r="22" fill={K.night} stroke={K.dark3} strokeWidth={2.4} strokeDasharray="4 3" />
    <path d="M40 34a16 16 0 1 0 22 20 13 13 0 0 1-22-20z" fill={K.dark} {...O} strokeWidth={1.6} />{[[16, 18], [80, 22], [20, 74], [78, 70]].map(([x, y], i) => <Spark key={i} x={x} y={y} r={3} fill={K.dark3} />)}</> },
  heat: { jp: '猛暑', bg: [K.fire, K.fire3], d: <><Sun c={K.fire2} r={16} y={40} />{[30, 48, 66].map((x) => <path key={x} d={`M${x} 86c-4-4 4-6 0-10s4-6 0-10`} {...L} stroke={K.blood} strokeWidth={2.4} />)}</> },
  harvestmoon: { jp: '豊穣の月', bg: ['#2B2340', '#5A4A7A'], d: <><circle cx="48" cy="44" r="30" fill={K.gold2} opacity={0.25} /><circle cx="48" cy="44" r="22" fill={K.gold2} {...O} />
    <circle cx="42" cy="38" r="4" fill={K.gold} /><circle cx="56" cy="50" r="3" fill={K.gold} /><path d="M20 84c4-10 8-14 10-20M76 84c-4-10-8-14-10-20" {...L} stroke={K.gold} strokeWidth={3} /></> },
  surge: { jp: '魔力の奔流', bg: [K.dark, '#D4C4F0'], d: <><path d="M48 14l14 18-14 40-14-40z" fill={K.dark3} {...O} /><path d="M34 32h28M48 14v58" {...T} />
    {[0, 1].map((i) => <path key={i} d={`M8 ${56 + i * 14}c14-10 26 10 40 0s26-10 40 0`} {...L} stroke={i ? K.ice2 : '#fff'} strokeWidth={3} />)}</> },
  drought: { jp: '日照り', bg: ['#D6A860', '#F8ECD0'], d: <><Sun c={K.fire2} r={14} y={34} /><path d="M10 72h76v18H10z" fill={K.wood3} {...O} />
    <path d="M24 72l4 8-4 6M48 72l-4 6 6 6M70 72l4 6-6 8" {...L} stroke={K.wood2} strokeWidth={2} /></> },
  gale: { jp: '強風', bg: ['#7FA7C9', '#E4EEF6'], d: <>{[30, 48, 66].map((y, i) => <g key={y}><path d={`M${12 + i * 6} ${y}h44c10 0 10-12 2-12`} {...L} stroke={INK} strokeWidth={6.4} /><path d={`M${12 + i * 6} ${y}h44c10 0 10-12 2-12`} {...L} stroke="#fff" strokeWidth={3} /></g>)}
    <path d="M78 76c-6-1-8-6-4-10 6 1 8 6 4 10z" fill={K.fire2} {...O} strokeWidth={1.6} /></> },
  festival: { jp: '収穫祭', bg: [K.fire2, K.gold3], d: <><path d="M6 20c28 14 56 14 84 0" {...L} strokeWidth={1.8} />
    {[14, 30, 48, 66, 82].map((x, i) => <path key={x} d={`M${x - 5} ${22 + Math.sin((i / 4) * Math.PI) * 7}l5 10 5-10z`} fill={[K.blood2, K.gold2, K.moss2][i % 3]} {...O} strokeWidth={1.4} />)}
    <path d="M48 44v6" {...L} /><path d="M36 52h24l2 6v14l-2 6H36l-2-6V58z" fill={K.blood2} {...O} /><path d="M38 58h20M38 72h20" {...T} /><circle cx="48" cy="65" r="5" fill={K.gold3} {...O} strokeWidth={1.4} /></> },
  blizzard: { jp: '吹雪', bg: ['#7C8EAA', '#D8E2EE'], d: <><Flake x={48} y={44} r={20} />{[[18, 22], [78, 26], [22, 74], [76, 74]].map(([x, y], i) => <Flake key={i} x={x} y={y} r={7} />)}
    <path d="M6 60c20-6 30 4 50-2" {...L} stroke="#fff" strokeWidth={3} /></> },
  cold: { jp: '寒波', bg: ['#5C88B0', K.ice3], d: <><path d="M10 10h76v10H10z" fill={K.ice2} {...O} />{[18, 34, 50, 66, 80].map((x, i) => <path key={x} d={`M${x - 5} 20l5 ${20 + (i % 2) * 14} 5-${20 + (i % 2) * 14}`} fill={K.ice2} {...O} strokeWidth={1.8} />)}
    <rect x="42" y="50" width="12" height="30" rx="6" fill="#fff" {...O} /><circle cx="48" cy="80" r="9" fill={K.ice} {...O} /><path d="M48 76V60" {...L} stroke={K.ice} strokeWidth={4} /></> },
  mild: { jp: '暖冬', bg: ['#B9D3E6', '#FAF2E0'], d: <><Sun c={K.light} r={14} y={36} /><path d="M10 74c12-6 24-6 36 0s24 6 40 0v16H10z" fill="#fff" {...O} />
    <path d="M30 74v-8M62 74v-8" {...L} stroke={K.moss} strokeWidth={2.4} /><path d="M30 68c-4 0-5-3-4-5 3 0 4 2 4 5zM62 68c4 0 5-3 4-5-3 0-4 2-4 5z" fill={K.moss3} {...O} strokeWidth={1.2} /></> },
  fair: { jp: '冬の市', bg: ['#A8BCD0', '#F0F4F8'], d: <><path d="M20 82V52h56v30z" fill={K.wood3} {...O} /><path d="M14 52l8-18h52l8 18z" fill={K.blood2} {...O} />
    <path d="M30 34l-4 18M48 34v18M66 34l4 18" {...T} /><path d="M14 52h68" {...L} stroke="#fff" strokeWidth={4} />{[34, 48, 62].map((x) => <circle key={x} cx={x} cy={66} r="5" fill={K.gold2} {...O} strokeWidth={1.4} />)}
    <Flake x={14} y={18} r={5} /><Flake x={82} y={20} r={5} /></> },
};
export const WEATHER_ICON_JP: Record<string, string> = Object.fromEntries(Object.entries(WEATHER).map(([k, v]) => [k, v.jp]));

/** 天候の小さな絵（予報・天候カード） */
export function WeatherArt({ id, size = 64, label, frame = true }: ArtProps) {
  const w = WEATHER[id] ?? WEATHER.calm;
  return <Tile k={`wa-${id}`} size={size} label={label ?? w.jp} bg={w.bg} frame={frame}>{w.d}</Tile>;
}

// ---------------------------------------------------------------- 地形（行動スペース）
const Tree = ({ x, y, s = 1, c = K.moss }: { x: number; y: number; s?: number; c?: string }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}><path d="M-3 0v-14h6V0z" fill={K.wood2} {...O} strokeWidth={2} /><path d="M0-44l16 26H-16z" fill={c} {...O} /><path d="M0-32l14 20H-14z" fill={c} {...O} /></g>
);
const Ground = ({ c = K.moss2 }: { c?: string }) => <path d="M-4 78c20-6 40-2 56-4s30-6 48-2v28H-4z" fill={c} {...O} />;
const Cave = ({ c = '#7A6E64', dark = K.black }: { c?: string; dark?: string }) => (
  <g><path d="M4 84l10-40 22-22h24l22 22 10 40z" fill={c} {...O} /><path d="M26 84V58c0-12 10-20 22-20s22 8 22 20v26z" fill={dark} {...O} />
    <path d="M30 60h36M48 40v44" {...L} stroke={K.wood} strokeWidth={3.4} /></g>
);
const Pick = ({ x, y, r = -30 }: { x: number; y: number; r?: number }) => (
  <g transform={`translate(${x} ${y}) rotate(${r})`}><path d="M0 0v24" {...L} stroke={INK} strokeWidth={5.6} /><path d="M0 0v24" {...L} stroke={K.wood3} strokeWidth={2.8} />
    <path d="M-14 2c8-8 20-8 28 0-8-2-20-2-28 0z" fill={K.steel} {...O} strokeWidth={2} /></g>
);
const ItemOn = ({ id, s = 0.82, x = 9, y = 6 }: { id: string; s?: number; x?: number; y?: number }) => <g transform={`translate(${x} ${y}) scale(${s})`}>{ITEM_DRAW[id]}</g>;

const TERRAIN: Record<string, { jp: string; bg: [string, string]; d: ReactNode }> = {
  forest: { jp: '古の森', bg: [K.moss, K.moss3], d: <><Ground /><Tree x={24} y={80} s={1.1} c="#3E6A4A" /><Tree x={50} y={76} s={1.4} /><Tree x={76} y={82} s={1} c="#3E6A4A" /></> },
  grove: { jp: '雑木林', bg: [K.moss2, '#EEF4DC'], d: <><Ground c={K.moss3} />{[[22, 46, 12], [50, 38, 16], [76, 48, 12]].map(([x, y, r], i) => <g key={i}><path d={`M${x - 2} 80V${y}h4v${80 - y}z`} fill={K.wood2} {...O} strokeWidth={1.8} /><circle cx={x} cy={y} r={r} fill={i === 1 ? K.moss2 : K.moss3} {...O} /></g>)}</> },
  mine: { jp: '鉄の坑道', bg: ['#8A7E70', '#E4DACA'], d: <><Cave /><Pick x={76} y={58} r={25} /><path d="M10 86l8-6 6 6z" fill={K.steel} {...O} strokeWidth={1.6} /></> },
  deepmine: { jp: '深い坑道', bg: ['#4A4440', '#9A8E80'], d: <><Cave c="#5A524A" /><circle cx="48" cy="66" r="10" fill={K.fire2} opacity={0.35} /><path d="M48 58v6" {...L} /><path d="M43 64h10v8H43z" fill={K.gold3} {...O} strokeWidth={1.6} /></> },
  meadow: { jp: '薬草の野', bg: [K.moss3, '#F6F8E6'], d: <><Ground c={K.moss2} />{[20, 38, 58, 76].map((x, i) => <g key={x}><path d={`M${x} 78v-${18 + (i % 2) * 8}`} {...L} stroke={K.moss} strokeWidth={2.4} />
    <path d={`M${x} ${66 - (i % 2) * 8}c-7 0-9-5-8-9 6 0 8 4 8 9zM${x} ${70 - (i % 2) * 8}c7 0 9-5 8-9-6 0-8 4-8 9z`} fill={K.moss3} {...O} strokeWidth={1.4} /><circle cx={x} cy={58 - (i % 2) * 8} r="2.6" fill={i % 2 ? K.dark3 : '#fff'} {...O} strokeWidth={1.2} /></g>)}</> },
  herb2: { jp: '霧の沢', bg: ['#6A9A88', '#DCEEE6'], d: <><Ground c={K.moss} /><path d="M30 96c4-10 14-14 24-16s18-8 20-14" {...L} stroke={INK} strokeWidth={9} /><path d="M30 96c4-10 14-14 24-16s18-8 20-14" {...L} stroke={K.ice} strokeWidth={5.6} />
    {[26, 40].map((y) => <path key={y} d={`M6 ${y}c20-6 40 4 84-2`} {...L} stroke="#fff" strokeWidth={6} opacity={0.75} />)}<path d="M18 76c-4 0-5-4-3-6 3 1 4 3 3 6z" fill={K.moss3} {...O} strokeWidth={1.2} /></> },
  spring: { jp: '魔石の泉', bg: ['#5A6AA8', '#D8DCF4'], d: <><Ground c="#7A8AA0" /><ellipse cx="48" cy="74" rx="28" ry="9" fill={K.ice} {...O} /><circle cx="48" cy="48" r="20" fill={K.dark3} opacity={0.35} />
    <path d="M48 26l10 14-10 26-10-26z" fill={K.dark3} {...O} /><path d="M38 40h20" {...T} /><Spark x={24} y={30} r={3.4} fill={K.light2} /><Spark x={74} y={36} r={3} fill={K.light2} /></> },
  hunt: { jp: '狩場', bg: ['#B08A5A', '#F2E2C2'], d: <><Ground c={K.moss2} /><Tree x={80} y={78} s={0.9} />{[[22, 70], [34, 60], [46, 70], [58, 60]].map(([x, y], i) => <g key={i} transform={`translate(${x} ${y}) rotate(-20) scale(.45)`}>
    <ellipse cx="0" cy="6" rx="7" ry="6" fill={K.wood2} /><circle cx="-8" cy="-4" r="3" fill={K.wood2} /><circle cx="-2" cy="-9" r="3" fill={K.wood2} /><circle cx="5" cy="-8" r="3" fill={K.wood2} /><circle cx="10" cy="-2" r="3" fill={K.wood2} /></g>)}
    <path d="M14 22c18 2 30 14 32 32" {...L} stroke={INK} strokeWidth={5} /><path d="M14 22c18 2 30 14 32 32" {...L} stroke={K.wood} strokeWidth={2.6} /><path d="M14 22l32 32" {...T} /></> },
  board: { jp: '依頼板', bg: ['#A87850', '#F2E0C4'], d: <><path d="M24 90V60M72 90V60" {...L} stroke={INK} strokeWidth={6} /><path d="M24 90V60M72 90V60" {...L} stroke={K.wood2} strokeWidth={3} />
    <rect x="12" y="16" width="72" height="50" rx="3" fill={K.wood} {...O} /><path d="M8 18l40-12 40 12" fill={K.blood} {...O} />
    {[[18, 24, -4], [42, 22, 3], [62, 26, -2], [26, 44, 5], [52, 44, -3]].map(([x, y, r], i) => <g key={i} transform={`rotate(${r} ${x + 8} ${y + 9})`}><rect x={x} y={y} width="16" height="18" fill={K.parch} {...O} strokeWidth={1.6} /><path d={`M${x + 3} ${y + 6}h10M${x + 3} ${y + 10}h8`} {...T} strokeWidth={1} /><circle cx={x + 8} cy={y + 2} r="1.6" fill={K.blood} /></g>)}</> },
  guild: { jp: 'ギルドで登用', bg: ['#6B5A8C', '#E4DCF0'], d: <><path d="M10 88V40l38-24 38 24v48z" fill={K.parch2} {...O} /><path d="M6 42l42-28 42 28" {...L} stroke={INK} strokeWidth={6} /><path d="M6 42l42-28 42 28" {...L} stroke={K.night2} strokeWidth={3} />
    <path d="M38 88V66c0-6 4-10 10-10s10 4 10 10v22z" fill={K.wood2} {...O} /><path d="M20 48h16v26l-8-5-8 5zM60 48h16v26l-8-5-8 5z" fill={K.dark} {...O} strokeWidth={2} /><path d="M24 56l4 4 4-4M64 56l4 4 4-4" {...T} stroke={K.gold2} strokeWidth={1.8} />
    <circle cx="48" cy="36" r="6" fill={K.gold2} {...O} strokeWidth={1.8} /></> },
  forge: { jp: '鍛冶場', bg: [K.fire, K.fire3], d: <ItemOn id="i18" /> },
  workshop: { jp: '工房', bg: ['#B08A5A', K.parch], d: <><path d="M8 70h80v8H8z" fill={K.wood} {...O} /><path d="M14 78v12M82 78v12" {...L} stroke={INK} strokeWidth={5} /><path d="M14 78v12M82 78v12" {...L} stroke={K.wood2} strokeWidth={2.4} />
    <g transform="rotate(-25 34 50)"><rect x="31" y="40" width="6" height="28" rx="2" fill={K.wood3} {...O} strokeWidth={2} /><rect x="22" y="30" width="24" height="12" rx="2" fill={K.steel} {...O} strokeWidth={2} /></g>
    <path d="M58 70l6-30 6 30" fill={K.wood3} {...O} strokeWidth={2} /><path d="M54 56h20" {...L} strokeWidth={2} /><Spark x={50} y={28} r={4} fill={K.gold3} /><path d="M70 66l12-6 4 8-12 4z" fill={K.parch3} {...O} strokeWidth={1.6} /></> },
  market: { jp: '市場', bg: [K.gold, K.gold3], d: <><path d="M16 86V52h64v34z" fill={K.wood3} {...O} /><path d="M10 52l10-22h56l10 22z" fill={K.blood2} {...O} />
    {[24, 38, 52, 66].map((x) => <path key={x} d={`M${x} 30l-2 22`} {...T} stroke="#fff" strokeWidth={4} />)}<path d="M10 52l10-22h56l10 22z" fill="none" {...O} />
    <circle cx="30" cy="64" r="6" fill={K.blood2} {...O} strokeWidth={1.6} /><path d="M42 60l10-4 6 8-10 4z" fill={K.dark3} {...O} strokeWidth={1.6} /><ellipse cx="66" cy="66" rx="8" ry="4" fill={K.gold2} {...O} strokeWidth={1.6} /></> },
  market2: { jp: '露店', bg: ['#6A8AB0', '#E4ECF4'], d: <><path d="M10 70h76v8H10z" fill={K.parch3} {...O} /><path d="M18 78v10M78 78v10M18 70V36M78 70V36" {...L} strokeWidth={2.4} />
    <path d="M12 36c12 8 24 8 36 0 12 8 24 8 36 0V26H12z" fill={K.ice} {...O} />{[[28, 62], [48, 62], [66, 62]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="6" fill={[K.fire2, K.moss3, K.gold2][i]} {...O} strokeWidth={1.6} />)}</> },
  plaza: { jp: '広場', bg: ['#8C9EAE', '#EEF2F4'], d: <><ellipse cx="48" cy="78" rx="38" ry="10" fill={K.steel3} {...O} /><ellipse cx="48" cy="72" rx="26" ry="8" fill={K.steel} {...O} /><ellipse cx="48" cy="70" rx="20" ry="5" fill={K.ice} {...O} strokeWidth={1.6} />
    <path d="M44 70V40h8v30z" fill={K.steel3} {...O} strokeWidth={2} /><path d="M48 36c-8 0-14 6-16 14M48 36c8 0 14 6 16 14" {...L} stroke={K.ice} strokeWidth={3.4} /><circle cx="48" cy="34" r="5" fill={K.ice2} {...O} strokeWidth={1.6} /></> },
  tavern: { jp: '酒場で募集', bg: [K.leather2, K.gold3], d: <><path d="M8 88V44h80v44z" fill={K.wood} {...O} /><path d="M4 46l12-18h64l12 18z" fill={K.blood} {...O} />
    <rect x="18" y="56" width="16" height="14" fill={K.thunder2} {...O} strokeWidth={2} /><rect x="62" y="56" width="16" height="14" fill={K.thunder2} {...O} strokeWidth={2} /><path d="M40 88V62h16v26z" fill={K.wood2} {...O} />
    <path d="M48 10v8" {...L} /><circle cx="48" cy="22" r="8" fill={K.parch} {...O} strokeWidth={1.8} /><path d="M44 18h6v8h-6zM50 20c3 0 3 4 0 4" fill={K.gold2} {...T} /></> },
  training: { jp: '訓練場', bg: ['#9A8A6A', K.parch], d: <ItemOn id="i16" /> },
  ruins: { jp: '遺跡の探索', bg: ['#6A6488', '#DCD8EA'], d: <><Ground c="#8A8478" /><path d="M14 80V34h12v46zM60 80V44h12v36z" fill={K.parch2} {...O} /><path d="M10 34h20v-6H10zM56 44h20v-6H56z" fill={K.parch3} {...O} />
    <path d="M36 80V60l10-4v24z" fill={K.parch2} {...O} /><path d="M18 44v30M64 52v22" {...T} /><path d="M30 30c4-2 8 0 10 4" {...L} stroke={K.moss} strokeWidth={2.4} />
    <circle cx="82" cy="24" r="8" fill={K.gold2} opacity={0.4} /><Spark x={82} y={24} r={5} fill={K.gold3} /></> },
  peddler: { jp: '行商', bg: ['#B8946A', '#F4E6CC'], d: <ItemOn id="i15" y={10} /> },
  outpost: { jp: '見張り小屋', bg: ['#7A8A6A', '#E6ECD8'], d: <ItemOn id="i14" /> },
};
export const TERRAIN_JP: Record<string, string> = { ...Object.fromEntries(Object.entries(TERRAIN).map(([k, v]) => [k, v.jp])), ...NEST_JP };

/** 行動スペース・巣・主の巣の地形 */
export function TerrainArt({ id, size = 64, label, frame = true }: ArtProps) {
  if (NEST_DRAW[id]) {
    return <Tile k={`tr-${id}`} size={size} label={label} bg={['#000', '#000']} frame={frame}><g transform="translate(-32 0)">{NEST_DRAW[id]}</g></Tile>;
  }
  const t = TERRAIN[id];
  if (!t) return null;
  return <Tile k={`tr-${id}`} size={size} label={label} bg={t.bg} frame={frame}>{t.d}</Tile>;
}

// ---------------------------------------------------------------- カード裏
/** カードの裏面。id='occ' は職能、それ以外は品物 */
export function CardBackArt({ id, size = 64, label }: ArtProps) {
  const occ = id === 'occ';
  const [c1, c2] = occ ? [K.night2, '#6C7FB0'] : [K.wood2, K.wood3];
  return (
    <Tile k={`cb-${occ ? 'o' : 'i'}`} size={size} label={label} bg={[c1, c2]}>
      <rect x="8" y="8" width="80" height="80" rx="10" fill="none" stroke={K.gold2} strokeWidth={2.4} />
      <rect x="13" y="13" width="70" height="70" rx="7" fill="none" stroke={K.gold2} strokeWidth={1} strokeDasharray="3 3" />
      <circle cx="48" cy="48" r="22" fill={c1} stroke={INK} strokeWidth={2.4} />
      {occ
        ? <path d="M48 30l5 11 12 1-9 8 3 12-11-6-11 6 3-12-9-8 12-1z" fill={K.gold2} {...O} strokeWidth={2} />
        : <g><path d="M36 46h24l-2 18H38z" fill={K.leather2} {...O} strokeWidth={2} /><path d="M40 46c0-8 4-12 8-12s8 4 8 12" {...L} strokeWidth={2.4} /><circle cx="48" cy="54" r="3" fill={K.gold2} {...O} strokeWidth={1.4} /></g>}
      {[[20, 20], [76, 20], [20, 76], [76, 76]].map(([x, y], i) => <Spark key={i} x={x} y={y} r={3} fill={K.gold3} />)}
    </Tile>
  );
}
