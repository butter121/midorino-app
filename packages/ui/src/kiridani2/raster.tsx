// 霧谷 — 絵の画像（ラスター）の読み込みと、カード以外の絵の部品（魔物・行動マス・巣・タイトル・カードの裏）。
// タイトル画面からも読むので、ここではエンジンのデータを import しない（軽く保つ）。
import { useEffect, useId, useReducer, useRef, useState, type ReactNode } from 'react';
import { INK } from '../kiridani/art/common';

// ------------------------------------------------------------------ 絵の画像（<folder>/<id>.webp）
// 置き場（folder）ごとに index.json（{"v": "...", "ids": [...]}）を1回だけ読み、一覧にある id の画像だけを取りに行く。
//   cards/          カード（縦長 3:4）           …… packages/app/public/cards/README.md
//   art/monsters/   魔物・主・古竜（正方形）
//   art/spaces/     行動マス・巣・主の巣（横長 16:10）
//   art/title/      タイトルの背景（key-p 縦長・key-l 横長）
//   art/misc/       カードの裏など
// 置き方は packages/app/public/art/README.md。画像が無いものは今までどおり SVG の絵。
export type ArtFolder = 'cards' | 'art/monsters' | 'art/spaces' | 'art/title' | 'art/misc';
type Manifest = { ids: Set<string>; v: string };
const manifestP = new Map<string, Promise<Manifest | null>>();
const status = new Map<string, 'loading' | 'ok' | 'bad'>();
const hrefOf = new Map<string, string>();
const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => f());

/** 画像の一覧（<folder>/index.json）。無い・読めないときは画像を使わない（存在しない画像を1枚ずつ取りに行かない） */
export function artManifest(folder: ArtFolder): Promise<Manifest | null> {
  let p = manifestP.get(folder);
  if (!p) {
    p = (typeof fetch === 'undefined' ? Promise.resolve(null) : fetch(`${folder}/index.json`, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { ids?: unknown; v?: unknown } | null) => (j && Array.isArray(j.ids) ? { ids: new Set(j.ids.map(String)), v: j.v == null ? '' : String(j.v) } : null))
      .catch(() => null));
    manifestP.set(folder, p);
  }
  return p;
}
/** 画像の URL（?v= つき） */
export const artHref = (folder: ArtFolder, file: string, m: Manifest) => `${folder}/${file}${m.v ? `?v=${encodeURIComponent(m.v)}` : ''}`;

function request(folder: ArtFolder, id: string, file: string) {
  const key = `${folder}/${file}`;
  if (status.has(key)) return;
  status.set(key, 'loading');
  artManifest(folder).then((m) => {
    if (!m || !m.ids.has(id)) { status.set(key, 'bad'); return; }
    const href = artHref(folder, file, m);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => { hrefOf.set(key, href); status.set(key, 'ok'); notify(); };
    img.onerror = () => { status.set(key, 'bad'); notify(); };
    img.src = href;
  });
}

/**
 * 見えたら画像（<folder>/<id>.webp・small なら <id>-s.webp）を読み込み、読めたら href を返す（読めるまで・無いときは null）。
 * ref を付けた要素が見えたときに読む。ref を付けなければすぐ読む。
 */
export function useRaster(folder: ArtFolder, id: string, small: boolean, enabled = true) {
  const ref = useRef<SVGSVGElement>(null);
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const file = `${id}${small ? '-s' : ''}.webp`;
  const key = `${folder}/${file}`;
  const st = status.get(key);
  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || typeof fetch === 'undefined' || typeof Image === 'undefined') return;
    if (st === 'ok' || st === 'bad') return;
    subs.add(bump);
    const el = ref.current;
    let io: IntersectionObserver | undefined;
    if (el && typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io?.disconnect(); request(folder, id, file); } }, { rootMargin: '200px' });
      io.observe(el);
    } else request(folder, id, file);
    return () => { subs.delete(bump); io?.disconnect(); };
  }, [folder, id, file, st, enabled]);
  return { ref, href: st === 'ok' ? hrefOf.get(key) ?? null : null, onError: () => { status.set(key, 'bad'); bump(); } };
}
// ------------------------------------------------------------------ カード以外の絵（魔物・行動マス・巣・タイトル・カードの裏）
const GOLD = '#C9A24A';
/**
 * 正方形の絵（魔物・主・古竜・行動マスの小さな絵・カードの裏）。画像 <folder>/<id>.webp があればそれを角丸に切り抜いて描き、
 * 無ければ fallback（今の SVG の絵）。横長の画像（行動マス）は真ん中を正方形に切り抜く。80px 以下は小さい版（-s）。
 * frame：'gold' は主の金の縁、'ink' は細い紺の縁、'none' は縁なし。
 */
export function RasterSquare({ folder, id, size, label, frame = 'none', fallback }: { folder: ArtFolder; id: string; size: number; label?: string; frame?: 'gold' | 'ink' | 'none'; fallback: ReactNode }) {
  const uid = `ra${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const { href, onError } = useRaster(folder, id, size <= 80);
  if (!href) return <>{fallback}</>;
  return (
    <svg viewBox="0 0 96 96" width={size} height={size} role="img" aria-label={label ?? id} style={{ display: 'block' }} data-art="image">
      <defs><clipPath id={`cl-${uid}`}><rect x="0" y="0" width="96" height="96" rx="14" /></clipPath></defs>
      <g clipPath={`url(#cl-${uid})`}>
        <rect x="0" y="0" width="96" height="96" fill="#3A3F52" />
        <image href={href} x="0" y="0" width="96" height="96" preserveAspectRatio="xMidYMid slice" onError={onError} />
      </g>
      {frame === 'gold' && <>
        <rect x="2" y="2" width="92" height="92" rx="12" fill="none" stroke={GOLD} strokeWidth={3} />
        <rect x="2" y="2" width="92" height="92" rx="12" fill="none" stroke={INK} strokeWidth={1} />
      </>}
      {frame === 'ink' && <rect x="1" y="1" width="94" height="94" rx="13" fill="none" stroke={INK} strokeWidth={1.6} opacity={0.8} />}
    </svg>
  );
}

/** 横長の舞台の絵（巣・主の巣の背景、くわしく見る画面の巣）。画像 art/spaces/<id>.webp（16:10）を 160×96 に切り抜いて描く */
export function RasterScene({ id, width, label, fallback }: { id: string; width: number; label?: string; fallback: ReactNode }) {
  const { href, onError } = useRaster('art/spaces', id, width <= 128);
  if (!href) return <>{fallback}</>;
  return (
    <svg viewBox="0 0 160 96" width={width} height={(width * 96) / 160} preserveAspectRatio="xMidYMid slice" role="img" aria-label={label ?? id} style={{ display: 'block' }} data-art="image">
      <image href={href} x="0" y="0" width="160" height="96" preserveAspectRatio="xMidYMid slice" onError={onError} />
    </svg>
  );
}

/** 一覧を読み終えたもの（2回目からはすぐ描けるように） */
const manifestDone = new Map<string, Manifest | null>();
function useManifest(folder: ArtFolder) {
  const [m, setM] = useState<Manifest | null | undefined>(() => manifestDone.get(folder));
  useEffect(() => {
    if (m !== undefined) return;
    let on = true;
    artManifest(folder).then((x) => { manifestDone.set(folder, x); if (on) setM(x); });
    return () => { on = false; };
  }, [folder, m]);
  return m;
}

/**
 * タイトル・入口の背景の絵（art/title/key-p.webp 縦長・key-l.webp 横長）。あれば画面いっぱいの背景に敷き、children（今の SVG の絵）は出さない。
 * 無ければ children。一覧を読んでいる間は何も出さない（SVG の絵が一瞬出て消えないように）。
 */
export function TitleKeyArt({ children }: { children: ReactNode }) {
  const m = useManifest('art/title');
  const [bad, setBad] = useState(false);
  if (m === undefined && typeof fetch !== 'undefined') return null;
  if (!m || !m.ids.has('key') || bad) return <>{children}</>;
  return (
    <div className="kda-keyart" aria-hidden="true">
      <picture>
        <source media="(orientation: landscape)" srcSet={artHref('art/title', 'key-l.webp', m)} />
        <img src={artHref('art/title', 'key-p.webp', m)} alt="" decoding="async" onError={() => setBad(true)} />
      </picture>
    </div>
  );
}
