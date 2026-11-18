// 霧谷 v2 — カードの絵。
//  1) 絵の画像（packages/app/public/cards/<id>.webp・小さい版 <id>-s.webp。一覧は cards/index.json）があればそれを、
//     無ければ今の SVG の絵（v1 の絵を id の hash で割り当て）を描く。
//  2) その上に「種類の縁取り（左上の三角＋印）」と「強い動きの札（右下の丸）」を重ねる。
// 画像の置き方は packages/app/public/cards/README.md。
import { useEffect, useId, useReducer, useRef, type ReactNode } from 'react';
import { INK, K, MistBg, Spark } from '../kiridani/art/common';
import { FigureLayers } from '../kiridani/art/figure';
import { HERO_LOOKS } from '../kiridani/art/heroes';
import { JOB_LOOKS } from '../kiridani/art/jobs';
import { ITEM_DRAW, ITEM_IDS, ITEM_KIND, ITEM_KIND_BG } from '../kiridani/art/items';
import { ANC2, CARD2, QUEST2 } from './view';

// ------------------------------------------------------------------ 強い動きの札（12種＋橋渡し）
export const MOVES = ['hunt', 'gather', 'trade', 'fort', 'smith', 'family', 'arcane', 'beast', 'quest', 'ally', 'ruins', 'boss'] as const;
export type Move = (typeof MOVES)[number] | 'bridge';

/** 札の地の色（色だけでも見分けられるよう色相を散らす） */
export const MOVE_COLOR: Record<Move, string> = {
  hunt: '#FF4F5E', gather: '#3FCB6A', trade: '#FFC21A', fort: '#4C8DFF', smith: '#FF8A1F', family: '#FF7EB6',
  arcane: '#A35BFF', beast: '#C77A3A', quest: '#1FC7C1', ally: '#2F6BFF', ruins: '#B9A66B', boss: '#7A1F4F', bridge: '#8F96B2',
};

const S = { stroke: INK, strokeWidth: 1.7, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
const N = { ...S, fill: 'none' };

/** 24×24 の下絵 */
const MOVE_GLYPH: Record<Move, ReactNode> = {
  // 爪あと3本
  hunt: <>{['M6 4l3 16', 'M11 3l2 18', 'M16 4l1 15'].map((d) => <g key={d}><path d={d} {...N} strokeWidth={4.4} /><path d={d} {...N} stroke="#fff" strokeWidth={2} /></g>)}</>,
  // 葉
  gather: <><path d="M12 21C3 16 4 7 12 3c8 4 9 13 0 18z" fill={K.moss3} {...S} /><path d="M12 21V8M12 14l-3-3M12 17l3-3" {...N} strokeWidth={1.2} /></>,
  // 天秤
  trade: <><path d="M12 4v15M8 20h8M4 8h16" {...N} strokeWidth={2} /><path d="M2 13h7a3.5 3.5 0 0 1-7 0zM15 13h7a3.5 3.5 0 0 1-7 0z" fill={K.gold3} {...S} /><path d="M5.5 8L2 13M5.5 8L9 13M18.5 8L15 13M18.5 8L22 13" {...N} strokeWidth={1} /><circle cx="12" cy="4" r="2" fill={K.gold3} {...S} /></>,
  // 塔
  fort: <><path d="M5 21V9h2.5V6H10v3h4V6h2.5v3H19v12z" fill={K.steel3} {...S} /><path d="M10 21v-4a2 2 0 0 1 4 0v4z" fill={INK} /></>,
  // 金床＋火花
  smith: <><path d="M3 8h13c0 3 2 4 5 4v1h-6l-1 3h3v4H7v-4h3l-1-3C5 13 3 11 3 8z" fill={K.steel3} {...S} /><path d="M18 3l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" fill={K.fire3} {...S} strokeWidth={1} /></>,
  // 家＋ハート
  family: <><path d="M3 12l9-8 9 8v9H3z" fill={K.parch} {...S} /><path d="M12 19c-4-3-5-4-5-6a2.3 2.3 0 0 1 5-1 2.3 2.3 0 0 1 5 1c0 2-1 3-5 6z" fill={K.blood} {...S} strokeWidth={1.1} /></>,
  // 星ふたつ
  arcane: <><path d="M10 2Q11.5 9.5 18 11 11.5 12.5 10 21 8.5 12.5 2 11 8.5 9.5 10 2z" fill={K.light2} {...S} /><path d="M18.5 2.5Q19 5 21.5 5.5 19 6 18.5 8.5 18 6 15.5 5.5 18 5 18.5 2.5z" fill={K.dark3} {...S} strokeWidth={1} /></>,
  // 肉球
  beast: <><path d="M12 12c4 0 7 4 7 6.5S16 22 12 20.5 5 21 5 18.5 8 12 12 12z" fill={K.bone} {...S} />{[[5, 10], [9, 6], [15, 6], [19, 10]].map(([x, y]) => <ellipse key={x} cx={x} cy={y} rx="2.2" ry="2.8" fill={K.bone} {...S} />)}</>,
  // 依頼書＋封蝋
  quest: <><path d="M5 3h11l3 3v15H5z" fill={K.parch} {...S} /><path d="M8 8h7M8 11h8M8 14h5" {...N} strokeWidth={1.1} /><circle cx="16" cy="17.5" r="3.2" fill={K.blood} {...S} strokeWidth={1.2} /></>,
  // ふたりの肩
  ally: <><circle cx="8.5" cy="8" r="3.4" fill={K.ice2} {...S} /><path d="M2 21c0-5 3-8 6.5-8s6.5 3 6.5 8z" fill={K.ice2} {...S} /><circle cx="15.5" cy="8" r="3.4" fill={K.gold2} {...S} /><path d="M9 21c0-5 3-8 6.5-8s6.5 3 6.5 8z" fill={K.gold2} {...S} /></>,
  // 折れた柱
  ruins: <><path d="M7 21V9l2-2 2 2 2-3 2 2 2-1v14z" fill={K.bone} {...S} /><path d="M5 21h14" {...N} strokeWidth={2} /><path d="M10 11v8M14 11v8" {...N} strokeWidth={1} /></>,
  // 角のある髑髏
  boss: <><path d="M6 9C3 7 2 4 3 1c1 3 3 4 5 5zM18 9c3-2 4-5 3-8-1 3-3 4-5 5z" fill={K.blood2} {...S} strokeWidth={1.2} /><path d="M12 4c5 0 7 3 7 7 0 3-2 4-3 5v3H8v-3c-1-1-3-2-3-5 0-4 2-7 7-7z" fill={K.bone} {...S} /><circle cx="9.3" cy="11.5" r="2" fill={INK} /><circle cx="14.7" cy="11.5" r="2" fill={INK} /><path d="M10 19v-2M14 19v-2M12 19v-2" {...N} strokeWidth={1} /></>,
  // 橋
  bridge: <><path d="M2 19c2-6 6-9 10-9s8 3 10 9" {...N} strokeWidth={2.6} /><path d="M2 12h20" {...N} strokeWidth={2} /><path d="M7 12v4M12 10v-1M17 12v4" {...N} strokeWidth={1.4} /></>,
};

/** 札の丸（96 の座標で描く）。cx,cy は中心、r は半径。アニメ調：太い輪郭・べた塗り＋影1段＋ハイライト1つ */
function MoveDisc({ move, cx, cy, r }: { move: Move; cx: number; cy: number; r: number }) {
  const s = (r * 1.45) / 24;
  const w = Math.max(2, r * 0.2);
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={MOVE_COLOR[move]} stroke={INK} strokeWidth={w} />
      {/* 影（右下の三日月） */}
      <path d={`M${cx + r * 0.92} ${cy - r * 0.3}A${r * 0.94} ${r * 0.94} 0 0 1 ${cx - r * 0.3} ${cy + r * 0.92}A${r * 1.05} ${r * 1.05} 0 0 0 ${cx + r * 0.92} ${cy - r * 0.3}z`} fill="#000" opacity={0.22} />
      <circle cx={cx} cy={cy} r={r - w * 0.9} fill="none" stroke="#fff" strokeWidth={Math.max(0.8, r * 0.07)} opacity={0.9} />
      <g transform={`translate(${cx - 12 * s} ${cy - 12 * s}) scale(${s})`}>{MOVE_GLYPH[move]}</g>
      {/* ハイライト（左上のつや） */}
      <ellipse cx={cx - r * 0.45} cy={cy - r * 0.5} rx={r * 0.22} ry={r * 0.12} transform={`rotate(-40 ${cx - r * 0.45} ${cy - r * 0.5})`} fill="#fff" opacity={0.85} />
    </g>
  );
}

const MOVE_JP: Record<Move, string> = { hunt: '狩り', gather: '採集', trade: '交易', fort: '守り', smith: '鍛冶', family: '家族', arcane: '秘術', beast: '獣使い', quest: '依頼', ally: '共闘', ruins: '遺跡', boss: '主狩り', bridge: '橋渡し' };

/** 強い動きの札だけの小さなアイコン（文字の横などで使う） */
export function MoveIcon({ move, size = 18, label }: { move: string; size?: number; label?: string | boolean }) {
  const m = (move in MOVE_COLOR ? move : 'bridge') as Move;
  const name = typeof label === 'string' ? label : MOVE_JP[m];
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} role={label === false ? undefined : 'img'} aria-label={label === false ? undefined : name} aria-hidden={label === false ? true : undefined} style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <MoveDisc move={m} cx={16} cy={16} r={14.5} />
    </svg>
  );
}

// ------------------------------------------------------------------ 種類の縁取り
export type ArtKind = 'leader' | 'occ' | 'weapon' | 'armor' | 'gear' | 'tool' | 'spell' | 'stage' | 'quest' | 'ancient';
export const KIND_COLOR: Record<ArtKind, string> = {
  leader: '#FFC93C', occ: '#5B8CFF', weapon: '#FF6B4A', armor: '#7FA7D9', gear: '#B8A27A',
  tool: '#6CCB3F', spell: '#B266FF', stage: '#22C3B5', quest: '#FF4F7B', ancient: '#2EE0C8',
};

/** 左上の三角に入れる種類の印（中心 10,10 あたり・白） */
const KIND_GLYPH: Record<ArtKind, ReactNode> = {
  leader: <path d="M3 13l1-8 4 4 3-6 3 6 4-4 1 8z" fill="#fff" {...S} strokeWidth={1.3} />,
  occ: <><circle cx="10" cy="6.5" r="3.2" fill="#fff" {...S} strokeWidth={1.3} /><path d="M3.5 16c0-4 3-6 6.5-6s6.5 2 6.5 6z" fill="#fff" {...S} strokeWidth={1.3} /></>,
  weapon: <><path d="M15 3l2 0 0 2-8 8-2-2z" fill="#fff" {...S} strokeWidth={1.3} /><path d="M4 12l4 4M6 14l-3 3" {...N} strokeWidth={1.8} /></>,
  armor: <path d="M4 4h12v5c0 4-3 7-6 8-3-1-6-4-6-8z" fill="#fff" {...S} strokeWidth={1.3} />,
  gear: <><path d="M4 4h8v4c0 3-2 5-4 6-2-1-4-3-4-6z" fill="#fff" {...S} strokeWidth={1.2} /><path d="M17 4l-6 10" {...N} strokeWidth={2.2} /></>,
  tool: <><path d="M3 10l7-6 7 6v7H3z" fill="#fff" {...S} strokeWidth={1.3} /><path d="M8 17v-4h4v4" {...N} strokeWidth={1.1} /></>,
  spell: <path d="M10 2Q11.4 8.6 18 10 11.4 11.4 10 18 8.6 11.4 2 10 8.6 8.6 10 2z" fill="#fff" {...S} strokeWidth={1.3} />,
  stage: <><path d="M6 18V3" {...N} strokeWidth={1.8} /><path d="M6 4h10l-2 3 2 3H6z" fill="#fff" {...S} strokeWidth={1.3} /></>,
  quest: <><circle cx="10" cy="10" r="6.5" fill="#fff" {...S} strokeWidth={1.3} /><path d="M10 6.5v4.5M10 13.5v.2" {...N} strokeWidth={2} /></>,
  ancient: <path d="M10 2l6 6-6 10-6-10z" fill="#fff" {...S} strokeWidth={1.3} />,
};

function KindFrame({ kind, clip }: { kind: ArtKind; clip: string }) {
  const c = KIND_COLOR[kind];
  return (
    <g>
      <g clipPath={`url(#${clip})`}>
        {/* 左上の三角（べた塗り＋影1段＋白い縁） */}
        <path d="M0 0h38L0 38z" fill={c} stroke={INK} strokeWidth={2.6} strokeLinejoin="round" />
        <path d="M0 28L28 0h10L0 38z" fill="#000" opacity={0.16} />
        <path d="M3 33L33 3" stroke="#fff" strokeWidth={1.2} strokeLinecap="round" opacity={0.8} />
        <g transform="translate(3.5 3.5) scale(0.9)">{KIND_GLYPH[kind]}</g>
      </g>
      {/* 縁：外に紺の太線、内に種類の色、さらに内側に白いつや線 */}
      <rect x="1.8" y="1.8" width="92.4" height="92.4" rx="12.4" fill="none" stroke={INK} strokeWidth={3.6} />
      <rect x="3.6" y="3.6" width="88.8" height="88.8" rx="10.8" fill="none" stroke={c} strokeWidth={2.4} />
      <path d="M40 5.6h40a10 10 0 0 1 10.4 10.4v10" fill="none" stroke="#fff" strokeWidth={1.1} strokeLinecap="round" opacity={0.75} />
      {kind === 'leader' && <rect x="6.6" y="6.6" width="82.8" height="82.8" rx="8.4" fill="none" stroke={c} strokeWidth={1} strokeDasharray="3 2.5" />}
      {kind === 'ancient' && [[48, 3], [93, 48], [48, 93], [3, 48]].map(([x, y]) => <path key={`${x}${y}`} d={`M${x} ${y - 4.5}l4.5 4.5-4.5 4.5-4.5-4.5z`} fill={c} stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />)}
    </g>
  );
}

// ------------------------------------------------------------------ 絵の画像（cards/<id>.webp）
type Manifest = { ids: Set<string>; v: string };
let manifestP: Promise<Manifest | null> | null = null;
const status = new Map<string, 'loading' | 'ok' | 'bad'>();
const hrefOf = new Map<string, string>();
const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => f());

/** 画像の一覧（cards/index.json）。無い・読めないときは画像を使わない（存在しない画像を1枚ずつ取りに行かない） */
function manifest(): Promise<Manifest | null> {
  if (!manifestP) {
    manifestP = fetch('cards/index.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { ids?: unknown; v?: unknown } | null) => (j && Array.isArray(j.ids) ? { ids: new Set(j.ids.map(String)), v: j.v == null ? '' : String(j.v) } : null))
      .catch(() => null);
  }
  return manifestP;
}

function request(id: string, file: string) {
  if (status.has(file)) return;
  status.set(file, 'loading');
  manifest().then((m) => {
    if (!m || !m.ids.has(id)) { status.set(file, 'bad'); return; }
    const href = `cards/${file}${m.v ? `?v=${encodeURIComponent(m.v)}` : ''}`;
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => { hrefOf.set(file, href); status.set(file, 'ok'); notify(); };
    img.onerror = () => { status.set(file, 'bad'); notify(); };
    img.src = href;
  });
}

/** 見えたら画像を読み込み、読めたら href を返す（読めるまで・無いときは null） */
function useCardImage(id: string, small: boolean, enabled: boolean) {
  const ref = useRef<SVGSVGElement>(null);
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const file = `${id}${small ? '-s' : ''}.webp`;
  const st = status.get(file);
  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || typeof fetch === 'undefined' || typeof Image === 'undefined') return;
    if (st === 'ok' || st === 'bad') return;
    subs.add(bump);
    const el = ref.current;
    let io: IntersectionObserver | undefined;
    if (el && typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io?.disconnect(); request(id, file); } }, { rootMargin: '200px' });
      io.observe(el);
    } else request(id, file);
    return () => { subs.delete(bump); io?.disconnect(); };
  }, [id, file, st, enabled]);
  return { ref, href: st === 'ok' ? hrefOf.get(file) ?? null : null, onError: () => { status.set(file, 'bad'); bump(); } };
}

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
function engineOf(id: string, kind: ArtKind): Move[] {
  const c = CARD2[id];
  if (c?.engine?.length) return c.engine.filter((e) => e in MOVE_COLOR) as Move[];
  if (kind === 'ancient') return ['ruins'];
  const m = /^sq_(\w+)$/.exec(id)?.[1];
  return m && m in MOVE_COLOR ? [m as Move] : [];
}

export function kindOf(id: string): ArtKind | null {
  const c = CARD2[id];
  if (c) return c.kind as ArtKind;
  if (QUEST2[id]) return 'quest';
  if (ANC2[id]) return 'ancient';
  return null;
}

/**
 * カードの絵1枚。size は CSS の px。
 * 30px 以上で種類の縁取り、40px 以上で強い動きの札を重ねる（overlay=false で消す）。
 * 80px 以下は小さい画像（<id>-s.webp）を使う。
 */
export function CardPicture({ id, kind, size, overlay = true, label }: { id: string; kind: ArtKind; size: number; overlay?: boolean; label?: string }) {
  const uid = `ka${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const { ref, href, onError } = useCardImage(id, size <= 80, true);
  const name = label ?? CARD2[id]?.name ?? QUEST2[id]?.name ?? ANC2[id]?.name ?? id;
  const fb = href ? null : fallback(id, kind);
  const moves = overlay && size >= 40 ? engineOf(id, kind).slice(0, 2) : [];
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
      {moves[1] && <MoveDisc move={moves[1]} cx={64} cy={84} r={9.5} />}
      {moves[0] && <MoveDisc move={moves[0]} cx={82} cy={82} r={12.5} />}
    </svg>
  );
}
