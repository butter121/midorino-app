// 霧谷 v2 — カードの絵。
//  1) 絵の画像（packages/app/public/cards/<id>.webp・小さい版 <id>-s.webp。一覧は cards/index.json）があればそれを、
//     無ければ今の SVG の絵（v1 の絵を id の hash で割り当て）を描く。
//  2) その上に「種類の縁取り（左上の三角＋印）」を重ねる。強い動き（engine タグ）はプレイヤーが見つけるものなので、絵にも文字にも出さない。
// 画像の置き方は packages/app/public/cards/README.md。
import { useId, type ReactNode } from 'react';
import { useRaster } from './raster';
import { INK, K, MistBg, Spark } from '../kiridani/art/common';
import { FigureLayers } from '../kiridani/art/figure';
import { HERO_LOOKS } from '../kiridani/art/heroes';
import { JOB_LOOKS } from '../kiridani/art/jobs';
import { ITEM_DRAW, ITEM_IDS, ITEM_KIND, ITEM_KIND_BG } from '../kiridani/art/items';
import { ANC2, CARD2, QUEST2 } from './view';

const S = { stroke: INK, strokeWidth: 1.7, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
const N = { ...S, fill: 'none' };

// ------------------------------------------------------------------ 種類の縁取り
export type ArtKind = 'leader' | 'occ' | 'weapon' | 'armor' | 'gear' | 'tool' | 'spell' | 'stage' | 'quest' | 'ancient' | 'pet';
/** 種類の色。種類は縁の色だけで見分ける（絵の地は種類で変えない）ので、色相を散らして 44px でも見分けられるようにし、
 *  原色は避けてくすませる（彩度を抑え、明るさをそろえる）。リーダーは古い金のグラデーション＋飾りでいちばん目立たせる */
export const KIND_COLOR: Record<ArtKind, string> = {
  leader: '#C4A462', weapon: '#B86F5A', gear: '#9A8063', tool: '#A39E5A', stage: '#6AA77E',
  ancient: '#5AA6AC', occ: '#6E8CC0', spell: '#937CC0', quest: '#B86F98', armor: '#A0A8B4', pet: '#7FB5A0',
};
/** リーダーの縁の古い金（明・暗・つや） */
const ANTIQUE = { lo: '#7A6338', mid: '#C4A462', hi: '#EEDDAA' };

/** 左上の三角に入れる種類の印（中心 10,10 あたり・白） */
const KIND_GLYPH: Record<ArtKind, ReactNode> = {
  leader: <path d="M3 13l1-8 4 4 3-6 3 6 4-4 1 8z" fill="#FAF4E6" {...S} strokeWidth={1.3} />,
  occ: <><circle cx="10" cy="6.5" r="3.2" fill="#FAF4E6" {...S} strokeWidth={1.3} /><path d="M3.5 16c0-4 3-6 6.5-6s6.5 2 6.5 6z" fill="#FAF4E6" {...S} strokeWidth={1.3} /></>,
  weapon: <><path d="M15 3l2 0 0 2-8 8-2-2z" fill="#FAF4E6" {...S} strokeWidth={1.3} /><path d="M4 12l4 4M6 14l-3 3" {...N} strokeWidth={1.8} /></>,
  armor: <path d="M4 4h12v5c0 4-3 7-6 8-3-1-6-4-6-8z" fill="#FAF4E6" {...S} strokeWidth={1.3} />,
  gear: <><path d="M4 4h8v4c0 3-2 5-4 6-2-1-4-3-4-6z" fill="#FAF4E6" {...S} strokeWidth={1.2} /><path d="M17 4l-6 10" {...N} strokeWidth={2.2} /></>,
  tool: <><path d="M3 10l7-6 7 6v7H3z" fill="#FAF4E6" {...S} strokeWidth={1.3} /><path d="M8 17v-4h4v4" {...N} strokeWidth={1.1} /></>,
  spell: <path d="M10 2Q11.4 8.6 18 10 11.4 11.4 10 18 8.6 11.4 2 10 8.6 8.6 10 2z" fill="#FAF4E6" {...S} strokeWidth={1.3} />,
  stage: <><path d="M6 18V3" {...N} strokeWidth={1.8} /><path d="M6 4h10l-2 3 2 3H6z" fill="#FAF4E6" {...S} strokeWidth={1.3} /></>,
  quest: <><circle cx="10" cy="10" r="6.5" fill="#FAF4E6" {...S} strokeWidth={1.3} /><path d="M10 6.5v4.5M10 13.5v.2" {...N} strokeWidth={2} /></>,
  ancient: <path d="M10 2l6 6-6 10-6-10z" fill="#FAF4E6" {...S} strokeWidth={1.3} />,
  pet: <><circle cx="10" cy="12.5" r="4" fill="#FAF4E6" {...S} strokeWidth={1.3} /><circle cx="4.5" cy="7.5" r="2" fill="#FAF4E6" {...S} strokeWidth={1.1} /><circle cx="8.5" cy="4.5" r="2" fill="#FAF4E6" {...S} strokeWidth={1.1} /><circle cx="12.5" cy="4.5" r="2" fill="#FAF4E6" {...S} strokeWidth={1.1} /><circle cx="16" cy="7.5" r="2" fill="#FAF4E6" {...S} strokeWidth={1.1} /></>,
};

/** 四隅の飾り（リーダー）。x,y は角、sx,sy は内向きの向き */
const Corner = ({ x, y, sx, sy, g }: { x: number; y: number; sx: number; sy: number; g: string }) => (
  <g transform={`translate(${x} ${y}) scale(${sx} ${sy})`}>
    <path d="M0 0h13c-2 2-5 2.5-7.5 2.5C4 5 3 8 2.5 13H0z" fill={`url(#${g})`} stroke={INK} strokeWidth={1.3} strokeLinejoin="round" />
    <circle cx="5.2" cy="5.2" r="2.1" fill={ANTIQUE.hi} stroke={INK} strokeWidth={1} />
  </g>
);

function KindFrame({ kind, clip }: { kind: ArtKind; clip: string }) {
  const c = KIND_COLOR[kind];
  const leader = kind === 'leader';
  const g = `${clip}-au`;
  return (
    <g>
      {leader && (
        <defs>
          <linearGradient id={g} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={ANTIQUE.hi} />
            <stop offset=".35" stopColor={ANTIQUE.mid} />
            <stop offset=".55" stopColor={ANTIQUE.lo} />
            <stop offset=".75" stopColor={ANTIQUE.mid} />
            <stop offset="1" stopColor={ANTIQUE.hi} />
          </linearGradient>
        </defs>
      )}
      <g clipPath={`url(#${clip})`}>
        {/* 左上の三角（べた塗り＋影1段＋うすい縁） */}
        <path d="M0 0h38L0 38z" fill={leader ? `url(#${g})` : c} stroke={INK} strokeWidth={2.6} strokeLinejoin="round" />
        <path d="M0 28L28 0h10L0 38z" fill="#000" opacity={0.14} />
        <path d="M3 33L33 3" stroke="#fff" strokeWidth={1.1} strokeLinecap="round" opacity={0.55} />
        <g transform="translate(3.5 3.5) scale(0.9)">{KIND_GLYPH[kind]}</g>
      </g>
      {leader ? (
        <>
          {/* リーダー：古い金の二重の縁＋四隅の飾り＋うすいつや */}
          <rect x="1.8" y="1.8" width="92.4" height="92.4" rx="12.4" fill="none" stroke={INK} strokeWidth={3.6} />
          <rect x="4.6" y="4.6" width="86.8" height="86.8" rx="10" fill="none" stroke={`url(#${g})`} strokeWidth={5.2} />
          <rect x="8.4" y="8.4" width="79.2" height="79.2" rx="7.2" fill="none" stroke={INK} strokeWidth={1.4} opacity={0.85} />
          <rect x="10" y="10" width="76" height="76" rx="6.2" fill="none" stroke={`url(#${g})`} strokeWidth={1.6} />
          <path d="M40 5.2h40a10 10 0 0 1 10.8 10.8v10" fill="none" stroke={ANTIQUE.hi} strokeWidth={1} strokeLinecap="round" opacity={0.7} />
          <Corner x={92} y={4} sx={-1} sy={1} g={g} />
          <Corner x={4} y={92} sx={1} sy={-1} g={g} />
          <Corner x={92} y={92} sx={-1} sy={-1} g={g} />
          <path d="M48 1.5l4 3.5-4 3.5-4-3.5z" fill={`url(#${g})`} stroke={INK} strokeWidth={1.2} strokeLinejoin="round" />
          <path d="M48 87.5l4 3.5-4 3.5-4-3.5z" fill={`url(#${g})`} stroke={INK} strokeWidth={1.2} strokeLinejoin="round" />
        </>
      ) : (
        <>
          {/* 縁：外に紺の太線、内に種類の色、さらに内側にうすいつや線 */}
          <rect x="1.8" y="1.8" width="92.4" height="92.4" rx="12.4" fill="none" stroke={INK} strokeWidth={3.6} />
          <rect x="4.4" y="4.4" width="87.2" height="87.2" rx="10.2" fill="none" stroke={c} strokeWidth={4.8} />
          <rect x="7" y="7" width="82" height="82" rx="7.8" fill="none" stroke={INK} strokeWidth={0.9} opacity={0.55} />
          <path d="M40 3.6h40a12 12 0 0 1 12.4 12.4v10" fill="none" stroke="#fff" strokeWidth={1} strokeLinecap="round" opacity={0.4} />
        </>
      )}
      {kind === 'ancient' && [[48, 3], [93, 48], [48, 93], [3, 48]].map(([x, y]) => <path key={`${x}${y}`} d={`M${x} ${y - 4.5}l4.5 4.5-4.5 4.5-4.5-4.5z`} fill={c} stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />)}
    </g>
  );
}

// 絵の画像の読み込みは ./raster（カード以外の絵と共通）
const useCardImage = (id: string, small: boolean, enabled: boolean) => useRaster('cards', id, small, enabled);

// ------------------------------------------------------------------ 今の SVG の絵（画像が無いときの代わり）
const hash = (s: string) => { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
const pick = <T,>(xs: T[], id: string) => xs[hash(id) % xs.length];
const HERO_IDS = Object.keys(HERO_LOOKS);
const JOBS = Object.keys(JOB_LOOKS).filter((x) => /^o\d+$/.test(x));
const ITEMS_BY: Record<string, string[]> = { weapon: ITEM_IDS.filter((x) => ITEM_KIND[x] === 'weapon'), tool: ITEM_IDS.filter((x) => ITEM_KIND[x] === 'tool'), spell: ITEM_IDS.filter((x) => ITEM_KIND[x] === 'spell') };
const GEAR_ART: Record<string, string> = { g_spear: 'i09', g_sword: 'i02', g_bow: 'i01', g_staff: 'i04', g_wshield: 'i06', g_leather: 'i08', g_ishield: 'i06', g_mail: 'i08' };
const QUEST_BG: [string, string] = ['#B98A62', K.parch];
const ANC_BG: [string, string] = ['#3F8A86', '#D4EEE6'];

/** 背景の2色と中身（すべて 96×96 の座標） */
function fallback(id: string, kind: ArtKind): { bg: [string, string]; body: ReactNode } {
  if (kind === 'leader') {
    const h = id.replace(/^l_/, '');
    const s = HERO_LOOKS[HERO_IDS.includes(h) ? h : pick(HERO_IDS, id)];
    return { bg: s.bg, body: <FigureLayers s={s} /> };
  }
  if (kind === 'occ') { const s = JOB_LOOKS[pick(JOBS, id)]; return { bg: s.bg, body: <FigureLayers s={s} /> }; }
  if (kind === 'quest') return { bg: QUEST_BG, body: <QuestFallback /> };
  if (kind === 'ancient') return { bg: ANC_BG, body: <AncientFallback /> };
  const it = kind === 'gear' ? GEAR_ART[id] ?? pick(ITEMS_BY.weapon, id)
    : pick(ITEMS_BY[kind === 'armor' ? 'weapon' : kind === 'stage' ? 'tool' : kind] ?? ITEMS_BY.tool, id);
  return { bg: ITEM_KIND_BG[ITEM_KIND[it]], body: ITEM_DRAW[it] };
}

const O2 = { stroke: INK, strokeWidth: 2.6, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
const QuestFallback = () => (
  <g>
    <path d="M24 16h44l6 8v58H24z" fill={K.parch} {...O2} />
    <path d="M32 32h30M32 42h34M32 52h26M32 62h20" fill="none" {...O2} strokeWidth={1.6} />
    <circle cx="62" cy="70" r="9" fill={K.blood} {...O2} strokeWidth={2} />
    <path d="M58 70h8M62 66v8" fill="none" stroke={K.blood2} strokeWidth={2} strokeLinecap="round" />
  </g>
);
const AncientFallback = () => (
  <g>
    <circle cx="48" cy="44" r="26" fill={K.gold3} opacity={0.35} />
    <path d="M30 78h36l-4-10H34z" fill={K.bone2} {...O2} />
    <path d="M48 16l16 18-16 30-16-30z" fill="#7FD6C4" {...O2} />
    <path d="M32 34h32M48 16l-6 18 6 30 6-30z" fill="none" {...O2} strokeWidth={1.4} />
    <Spark x={70} y={22} r={4} fill={K.gold3} /><Spark x={26} y={30} r={3} fill={K.gold3} />
  </g>
);

// ------------------------------------------------------------------ 組み立て
export function kindOf(id: string): ArtKind | null {
  const c = CARD2[id];
  if (c) return c.kind as ArtKind;
  if (QUEST2[id]) return 'quest';
  if (ANC2[id]) return 'ancient';
  return null;
}

/**
 * カードの絵1枚。size は CSS の px。
 * 30px 以上で種類の縁取りを重ねる（overlay=false で消す）。
 * 80px 以下は小さい画像（<id>-s.webp）を使う。
 */
export function CardPicture({ id, kind, size, overlay = true, label }: { id: string; kind: ArtKind; size: number; overlay?: boolean; label?: string }) {
  const uid = `ka${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const { ref, href, onError } = useCardImage(id, size <= 80, true);
  const name = label ?? CARD2[id]?.name ?? QUEST2[id]?.name ?? ANC2[id]?.name ?? id;
  const fb = href ? null : fallback(id, kind);
  const person = kind === 'leader' || kind === 'occ';
  return (
    <svg ref={ref} viewBox="0 0 96 96" width={size} height={size} role="img" aria-label={name} style={{ display: 'block' }} data-art={href ? 'image' : 'svg'}>
      {fb ? <MistBg id={uid} c1={fb.bg[0]} c2={fb.bg[1]} /> : (
        <defs><clipPath id={`cl-${uid}`}><rect x="0" y="0" width="96" height="96" rx="14" /></clipPath></defs>
      )}
      <g clipPath={`url(#cl-${uid})`}>
        {fb ? fb.body : (
          // 画像は縦長（3:4）。正方形に切り抜く。人物は顔が上寄りなので少し上を見せる
          <>
            <rect x="0" y="0" width="96" height="96" fill={KIND_COLOR[kind]} opacity={0.35} />
            <image href={href!} x="0" y={person ? -8 : -16} width="96" height="128" preserveAspectRatio="xMidYMid slice" onError={onError} />
          </>
        )}
      </g>
      {overlay && size >= 30 && <KindFrame kind={kind} clip={`cl-${uid}`} />}
    </svg>
  );
}

