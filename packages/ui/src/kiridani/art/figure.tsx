// 人物の胸像を部品から組み立てる（冒険者12人と職能30枚で共用）
import type { ReactNode } from 'react';
import { INK, K, O, L, T, MistBg, Eye, Spark } from './common';

export type HairStyle = 'short' | 'spiky' | 'long' | 'bob' | 'braid' | 'bun' | 'slick' | 'tail' | 'none';
export type Headgear = 'none' | 'hood' | 'witch' | 'cap' | 'furhat' | 'leaves' | 'circlet' | 'helm' | 'beret' | 'bandana' | 'band' | 'mitre' | 'horned' | 'veil' | 'tophat' | 'mask';
export type Outfit = 'cloak' | 'armor' | 'robe' | 'apron' | 'leather' | 'fur' | 'vest';
export type Mouth = 'smile' | 'grin' | 'flat' | 'smirk' | 'open' | 'frown';
export type Prop = 'none' | 'bow' | 'staff' | 'hammer' | 'coin' | 'pup' | 'herbs' | 'orb' | 'shield' | 'lute' | 'ladle' | 'greatsword'
  | 'holy' | 'flame' | 'frostbow' | 'spear' | 'map' | 'dagger' | 'scythe' | 'book' | 'dice' | 'pick' | 'trap' | 'scroll' | 'twin' | 'crystal' | 'knife' | 'mug' | 'lantern' | 'whip';

export interface FigureSpec {
  skin: number;
  hair: string;
  style: HairStyle;
  gear: Headgear;
  gearColor?: string;
  gearColor2?: string;
  outfit: Outfit;
  cloth: string;
  trim: string;
  ears?: 'human' | 'elf' | 'rat';
  beard?: boolean;
  brows?: 'soft' | 'sharp' | 'worried';
  mouth?: Mouth;
  scar?: boolean;
  /** 片目を閉じる・眼帯など */
  eyes?: 'open' | 'wink' | 'closed' | 'patch' | 'glow';
  eyeColor?: string;
  prop: Prop;
  /** 背景（外側・中心） */
  bg: [string, string];
  /** 背景に漂わせる小さな印 */
  motes?: 'sparks' | 'embers' | 'snow' | 'leaves' | 'stars' | 'shadow' | 'coins';
}

// ------------------------------------------------------------------ 髪
function HairBack({ s }: { s: FigureSpec }) {
  const f = s.hair;
  switch (s.style) {
    case 'long': return <path d="M29 42C26 60 26 74 22 84h52c-4-10-4-24-7-42z" fill={f} {...O} />;
    case 'bob': return <path d="M29 40C26 54 27 62 30 66h36c3-4 4-12 1-26z" fill={f} {...O} />;
    case 'braid': return <path d="M30 42c-2 10-2 18 0 24h36c2-6 2-14 0-24z" fill={f} {...O} />;
    case 'tail': return <path d="M62 34c10 2 14 12 12 26-1 6-4 10-8 12 1-8 0-16-6-22z" fill={f} {...O} />;
    case 'bun': return <circle cx="48" cy="22" r="8" fill={f} {...O} />;
    default: return null;
  }
}

function HairFront({ s }: { s: FigureSpec }) {
  const f = s.hair;
  switch (s.style) {
    case 'none': return null;
    case 'spiky':
      return <path d="M30 47c-3-8-2-14 1-18l-3-5 7 1 2-7 5 4 6-6 4 6 7-3 0 7 7 0-3 6c3 5 3 10 1 15-2-5-5-8-9-10-3 3-8 4-12 3-4 1-8 3-11 7z" fill={f} {...O} />;
    case 'slick':
      return <path d="M31 46c-2-14 6-22 18-22 10 0 17 6 16 18-6-6-14-9-24-8-5 2-8 6-10 12z" fill={f} {...O} />;
    case 'braid':
      return (
        <g>
          <path d="M31 46c-2-14 6-21 17-21s19 7 17 21c-4-6-9-9-15-10-1 3-4 5-8 6-4 1-8 1-11 4z" fill={f} {...O} />
          <path d="M64 50c4 6 4 12 2 16" {...L} stroke={INK} />
          {[0, 1, 2, 3].map((i) => <ellipse key={i} cx={67 - i * 0.6} cy={58 + i * 7} rx="4.4" ry="4" fill={f} {...O} strokeWidth={2} />)}
          <path d="M64 86l2 6 3-6z" fill={s.gearColor ?? K.moss2} {...O} strokeWidth={1.6} />
        </g>
      );
    case 'bun':
    case 'tail':
    case 'short':
    case 'bob':
    case 'long':
    default:
      return <path d="M31 47c-3-14 5-22 17-22s20 8 17 22c-2-4-4-7-7-9-3 3-8 4-13 3-2 0-5 0-7 1-3 1-6 3-7 5z" fill={f} {...O} />;
  }
}

// ------------------------------------------------------------------ かぶりもの（後ろと前）
function GearBack({ s }: { s: FigureSpec }) {
  const c = s.gearColor ?? s.cloth;
  if (s.gear === 'hood' || s.gear === 'veil') return <path d="M24 66c-4-18-2-36 8-44 9-7 23-7 32 0 10 8 12 26 8 44z" fill={c} {...O} />;
  if (s.gear === 'mitre') return <path d="M24 66c-4-18-2-30 6-38h36c8 8 10 20 6 38z" fill={c} {...O} />;
  return null;
}

function GearFront({ s }: { s: FigureSpec }) {
  const c = s.gearColor ?? s.cloth;
  const c2 = s.gearColor2 ?? s.trim;
  switch (s.gear) {
    case 'hood':
      return <path d="M27 58c-3-16 1-28 11-33 6-3 14-3 20 0 10 5 14 17 11 33-2-12-6-22-21-23-15 1-19 11-21 23z" fill={c} {...O} />;
    case 'veil':
      return (
        <g>
          <path d="M27 58c-3-16 1-28 11-33 6-3 14-3 20 0 10 5 14 17 11 33-2-12-6-22-21-23-15 1-19 11-21 23z" fill={c} {...O} />
          <path d="M33 33c8-4 22-4 30 0" {...L} stroke={c2} strokeWidth={3} />
          <circle cx="48" cy="30" r="3" fill={c2} {...O} strokeWidth={1.6} />
        </g>
      );
    case 'witch':
      return (
        <g>
          <ellipse cx="48" cy="31" rx="27" ry="6.5" fill={c} {...O} />
          <path d="M34 30c2-10 6-18 12-24 4-3 10-2 14 2-6 0-8 4-8 8l6 14z" fill={c} {...O} />
          <path d="M35 27c8 2 18 2 25 0l1 4c-8 2-18 2-27 0z" fill={c2} {...O} strokeWidth={2} />
          <Spark x={58} y={17} r={3.4} fill={K.gold2} />
        </g>
      );
    case 'cap':
      return (
        <g>
          <path d="M30 40c0-12 8-17 18-17s18 5 18 17z" fill={c} {...O} />
          <rect x="28" y="36" width="40" height="7" rx="3.5" fill={K.leather} {...O} strokeWidth={2} />
          <circle cx="40" cy="36" r="5.4" fill={K.ice2} {...O} strokeWidth={2} />
          <circle cx="54" cy="36" r="5.4" fill={K.ice2} {...O} strokeWidth={2} />
          <path d="M38 34l2-1M52 34l2-1" {...T} stroke="#fff" strokeWidth={1.6} />
        </g>
      );
    case 'furhat':
      return (
        <g>
          <path d="M33 30l-4-12 10 7zM63 30l4-12-10 7z" fill={c} {...O} />
          <path d="M29 42c-1-12 8-19 19-19s20 7 19 19c-6-3-12-4-19-4s-13 1-19 4z" fill={c} {...O} />
          <path d="M29 42c6-4 12-5 19-5s13 1 19 5l-1 4c-6-3-11-4-18-4s-12 1-18 4z" fill={c2} {...O} strokeWidth={2} />
        </g>
      );
    case 'leaves':
      return (
        <g>
          <path d="M31 36c6-4 28-4 34 0" {...L} stroke={K.moss} strokeWidth={3} />
          {[34, 41, 48, 55, 62].map((x, i) => <path key={x} d={`M${x} ${36 - (i % 2) * 1.5}c-3-4-2-8 1-10 3 3 3 7-1 10z`} fill={i % 2 ? K.moss2 : K.moss3} {...O} strokeWidth={1.6} />)}
          <circle cx="62" cy="33" r="2.6" fill={K.blood2} {...O} strokeWidth={1.4} />
        </g>
      );
    case 'circlet':
      return (
        <g>
          <path d="M31 38c8-4 26-4 34 0" {...L} stroke={c2} strokeWidth={3.2} />
          <path d="M31 38c8-4 26-4 34 0" {...T} />
          <path d="M48 26l3 6 6 1-5 4 1 6-5-3-5 3 1-6-5-4 6-1z" fill={K.thunder2} {...O} strokeWidth={1.8} />
        </g>
      );
    case 'helm':
      return (
        <g>
          <path d="M28 52c-2-18 6-28 20-28s22 10 20 28h-5c0-8-2-13-4-15H37c-2 2-4 7-4 15z" fill={c} {...O} />
          <path d="M48 24v13" {...L} />
          <path d="M33 36h30" {...L} />
          <path d="M44 18c2-6 6-8 10-6-2 2-3 6-3 12h-6z" fill={K.blood} {...O} strokeWidth={2} />
          <circle cx="31" cy="48" r="1.5" fill={INK} /><circle cx="65" cy="48" r="1.5" fill={INK} />
        </g>
      );
    case 'horned':
      return (
        <g>
          <path d="M30 40c-6-4-10-10-9-18 4 4 8 6 13 8z M66 40c6-4 10-10 9-18-4 4-8 6-13 8z" fill={K.bone} {...O} />
          <path d="M29 44c-2-14 6-21 19-21s21 7 19 21z" fill={c} {...O} />
          <path d="M29 42h38" {...L} stroke={c2} strokeWidth={3} />
        </g>
      );
    case 'beret':
      return (
        <g>
          <path d="M55 22c10-10 22-10 26-6-8 0-14 4-20 10z" fill={K.parch} {...O} strokeWidth={2} />
          <path d="M60 18c6-2 12-2 16 0" {...T} />
          <path d="M27 36c2-10 12-14 24-13 12 1 19 7 18 14-12 0-28 2-42-1z" fill={c} {...O} />
          <path d="M29 36c12 3 26 3 39 1" {...L} stroke={c2} strokeWidth={2.6} />
        </g>
      );
    case 'bandana':
      return (
        <g>
          <path d="M30 40c0-11 8-16 18-16s18 5 18 16c-12-3-24-3-36 0z" fill={c} {...O} />
          {[38, 48, 58].map((x) => <circle key={x} cx={x} cy={32} r="1.6" fill="#fff" />)}
          <path d="M64 38c6 0 10 2 12 6-4 0-6 0-8-1 1 3 0 6-2 8-1-4-2-8-4-11z" fill={c} {...O} strokeWidth={2} />
        </g>
      );
    case 'band':
      return <path d="M31 39c10-3 24-3 34 0l-1 4c-10-2-22-2-32 0z" fill={c} {...O} strokeWidth={2} />;
    case 'mitre':
      return (
        <g>
          <path d="M33 34c0-10 6-20 15-26 9 6 15 16 15 26z" fill={c} {...O} />
          <path d="M48 12v20M42 21h12" {...L} stroke={c2} strokeWidth={3} />
          <path d="M31 38c10-4 24-4 34 0l-1 4c-10-3-22-3-32 0z" fill={c2} {...O} strokeWidth={2} />
        </g>
      );
    case 'tophat':
      return (
        <g>
          <ellipse cx="48" cy="31" rx="21" ry="4.6" fill={c} {...O} />
          <path d="M36 30V14c0-2 2-3 4-3h16c2 0 4 1 4 3v16z" fill={c} {...O} />
          <path d="M36 25h24v4H36z" fill={c2} {...O} strokeWidth={1.8} />
        </g>
      );
    case 'mask':
      return <path d="M32 44c4-3 10-4 16-2 6-2 12-1 16 2l-1 7c-4 2-10 2-15-1-5 3-11 3-15 1z" fill={c} {...O} strokeWidth={2} />;
    default:
      return null;
  }
}

// ------------------------------------------------------------------ 服
function Body({ s }: { s: FigureSpec }) {
  const c = s.cloth, t = s.trim;
  const base = <path d="M8 98c2-20 18-30 40-30s38 10 40 30z" fill={c} {...O} />;
  switch (s.outfit) {
    case 'armor':
      return (
        <g>
          {base}
          <path d="M8 90c0-10 6-16 16-18 6 0 9 4 9 10-6 2-12 6-16 12z" fill={t} {...O} />
          <path d="M88 90c0-10-6-16-16-18-6 0-9 4-9 10 6 2 12 6 16 12z" fill={t} {...O} />
          <path d="M36 70h24l-3 10H39z" fill={K.steel3} {...O} strokeWidth={2} />
          <path d="M48 82v14" {...L} />
          <circle cx="48" cy="88" r="4" fill={K.gold2} {...O} strokeWidth={1.8} />
        </g>
      );
    case 'robe':
      return (
        <g>
          {base}
          <path d="M38 69l10 16 10-16" fill={K.parch} {...O} strokeWidth={2.2} />
          <path d="M34 70l14 22 14-22" {...L} stroke={t} strokeWidth={3.4} />
          <path d="M34 70l14 22 14-22" {...T} />
        </g>
      );
    case 'apron':
      return (
        <g>
          {base}
          <path d="M34 72h28l2 26H32z" fill={t} {...O} />
          <path d="M36 72c0-4 4-6 12-6s12 2 12 6" {...L} />
          <rect x="41" y="82" width="14" height="8" rx="2" fill={c} {...O} strokeWidth={1.8} />
        </g>
      );
    case 'leather':
      return (
        <g>
          {base}
          <path d="M28 72l40 26M68 72L28 98" {...L} stroke={K.wood2} strokeWidth={4} />
          <path d="M28 72l40 26" {...T} />
          <rect x="42" y="80" width="10" height="7" rx="1.5" fill={K.gold2} {...O} strokeWidth={1.6} transform="rotate(32 47 83)" />
        </g>
      );
    case 'fur':
      return (
        <g>
          {base}
          <path d="M14 82c4-8 10-12 16-10 4-4 10-4 14 0 4-4 12-4 16 0 6-2 12 2 16 10-6 2-12 0-16-2-4 3-10 3-14 0-4 3-10 3-14 0-4 2-10 4-18 2z" fill={t} {...O} strokeWidth={2.2} />
        </g>
      );
    case 'vest':
      return (
        <g>
          {base}
          <path d="M40 69h16l-2 29H42z" fill={K.parch} {...O} strokeWidth={2.2} />
          <path d="M40 69l8 8 8-8" {...L} />
          {[80, 87, 94].map((y) => <circle key={y} cx="48" cy={y} r="1.6" fill={K.gold2} stroke={INK} strokeWidth={1} />)}
          <path d="M60 74c4 2 6 4 6 8" {...L} stroke={t} strokeWidth={2.6} />
        </g>
      );
    case 'cloak':
    default:
      return (
        <g>
          {base}
          <path d="M18 80c8-6 18-9 30-9s22 3 30 9" {...L} stroke={t} strokeWidth={3.6} />
          <path d="M18 80c8-6 18-9 30-9s22 3 30 9" {...T} />
          <circle cx="48" cy="73" r="4.4" fill={K.gold2} {...O} strokeWidth={2} />
        </g>
      );
  }
}

// ------------------------------------------------------------------ 顔
function Face({ s }: { s: FigureSpec }) {
  const skin = K.skin[s.skin % K.skin.length];
  const brow = s.brows ?? 'soft';
  const ec = s.eyeColor ?? INK;
  const eyes = s.eyes ?? 'open';
  const browD = brow === 'sharp' ? 'M37 41l8 2M59 41l-8 2' : brow === 'worried' ? 'M37 43l8-2M59 43l-8-2' : 'M37 42c2-1.5 5-1.5 7 0M52 42c2-1.5 5-1.5 7 0';
  const m = s.mouth ?? 'smile';
  const mouthD = m === 'grin' ? 'M43 54c2 3 8 3 10 0z' : m === 'flat' ? 'M45 55h6' : m === 'smirk' ? 'M44 55c3 1 6 0 8-2' : m === 'open' ? 'M45 54c1 3 5 3 6 0z' : m === 'frown' ? 'M45 56c2-2 4-2 6 0' : 'M44.5 54c2 2 5 2 7 0';
  return (
    <g>
      {s.ears === 'elf' ? (
        <>
          <path d="M33 44l-10-7 2 8 7 6z" fill={skin} {...O} />
          <path d="M63 44l10-7-2 8-7 6z" fill={skin} {...O} />
        </>
      ) : s.ears === 'rat' ? (
        <>
          <circle cx="30" cy="34" r="7" fill={K.bone2} {...O} /><circle cx="30" cy="34" r="3.4" fill={K.blood2} />
          <circle cx="66" cy="34" r="7" fill={K.bone2} {...O} /><circle cx="66" cy="34" r="3.4" fill={K.blood2} />
        </>
      ) : (
        <>
          <ellipse cx="31.5" cy="47" rx="3.2" ry="4.2" fill={skin} {...O} />
          <ellipse cx="64.5" cy="47" rx="3.2" ry="4.2" fill={skin} {...O} />
        </>
      )}
      <rect x="42" y="56" width="12" height="14" fill={skin} {...O} />
      <path d="M31 44c0-11 7-18 17-18s17 7 17 18c0 10-7 18-17 18s-17-8-17-18z" fill={skin} {...O} />
      <ellipse cx="38" cy="52" rx="3.2" ry="2" fill="#F0A090" opacity={0.55} />
      <ellipse cx="58" cy="52" rx="3.2" ry="2" fill="#F0A090" opacity={0.55} />
      {eyes === 'closed' ? (
        <path d="M39 47c1.5 1.5 3.5 1.5 5 0M52 47c1.5 1.5 3.5 1.5 5 0" {...L} strokeWidth={1.8} />
      ) : eyes === 'wink' ? (
        <><Eye x={41.5} y={47} color={ec} /><path d="M52 47c1.5 1.5 3.5 1.5 5 0" {...L} strokeWidth={1.8} /></>
      ) : eyes === 'patch' ? (
        <><Eye x={41.5} y={47} color={ec} /><path d="M50 43h9v7c-3 2-6 2-9 0z" fill={INK} /><path d="M33 40l17 4M59 44l7-3" {...T} /></>
      ) : eyes === 'glow' ? (
        <><ellipse cx="41.5" cy="47" rx="2.6" ry="2.2" fill={ec} stroke={INK} strokeWidth={1} /><ellipse cx="54.5" cy="47" rx="2.6" ry="2.2" fill={ec} stroke={INK} strokeWidth={1} /></>
      ) : (
        <><Eye x={41.5} y={47} color={ec} /><Eye x={54.5} y={47} color={ec} /></>
      )}
      <path d={browD} {...L} strokeWidth={1.8} />
      <path d={mouthD} fill={m === 'grin' || m === 'open' ? K.blood : 'none'} {...L} strokeWidth={1.8} />
      {s.scar && <path d="M57 50l4 6M58.5 54.5l2-1" {...T} stroke={K.blood} strokeWidth={1.6} />}
    </g>
  );
}

function Beard({ s }: { s: FigureSpec }) {
  if (!s.beard) return null;
  return (
    <g>
      <path d="M31 48c0 18 8 28 17 28s17-10 17-28c-3 6-7 8-17 8s-14-2-17-8z" fill={s.hair} {...O} />
      <path d="M40 54c3-2 5-2 8 0 3-2 5-2 8 0-2 3-6 3-8 1-2 2-6 2-8-1z" fill={s.hair} {...O} strokeWidth={1.8} />
      <path d="M44 64v6M52 64v6M48 66v7" {...T} />
    </g>
  );
}

// ------------------------------------------------------------------ 持ち物（behind = 体の後ろ）
function PropBack({ p }: { p: Prop }) {
  switch (p) {
    case 'bow':
    case 'frostbow': {
      const c = p === 'frostbow' ? K.ice : K.wood;
      return (
        <g>
          <path d="M70 12c16 14 18 42 6 62" {...L} stroke={INK} strokeWidth={6} />
          <path d="M70 12c16 14 18 42 6 62" {...L} stroke={c} strokeWidth={3} />
          <path d="M70 12l6 62" {...T} />
          {p === 'frostbow' && <><path d="M80 30l4-2M82 44l4 0" {...T} stroke={K.ice2} /></>}
        </g>
      );
    }
    case 'greatsword':
      return (
        <g transform="rotate(-28 70 50)">
          <rect x="66" y="2" width="9" height="56" rx="1" fill={K.steel3} {...O} />
          <path d="M70.5 6v48" {...T} stroke={K.steel2} />
          <rect x="60" y="56" width="21" height="5" rx="2" fill={K.gold} {...O} strokeWidth={2} />
          <rect x="68" y="60" width="5" height="12" fill={K.leather} {...O} strokeWidth={2} />
        </g>
      );
    case 'staff':
    case 'crystal':
      return (
        <g>
          <path d="M80 96L74 22" {...L} stroke={INK} strokeWidth={6} />
          <path d="M80 96L74 22" {...L} stroke={K.wood} strokeWidth={3} />
          <path d="M74 22c-6-2-8-8-4-12M74 22c6-2 8-8 4-12" {...L} stroke={K.wood2} strokeWidth={2.4} />
          <path d="M74 4l5 8-5 9-5-9z" fill={p === 'crystal' ? K.ice : K.dark3} {...O} strokeWidth={2} />
          <circle cx="74" cy="12" r="10" fill={p === 'crystal' ? K.ice2 : K.dark3} opacity={0.3} />
        </g>
      );
    case 'holy':
      return (
        <g>
          <path d="M18 96L22 24" {...L} stroke={INK} strokeWidth={6} />
          <path d="M18 96L22 24" {...L} stroke={K.gold} strokeWidth={3} />
          <circle cx="22" cy="16" r="12" fill={K.light} opacity={0.5} />
          <circle cx="22" cy="16" r="8" fill="none" {...O} stroke={INK} strokeWidth={4.6} />
          <circle cx="22" cy="16" r="8" fill="none" stroke={K.gold2} strokeWidth={2.2} />
          <circle cx="22" cy="16" r="3" fill={K.light2} {...O} strokeWidth={1.4} />
        </g>
      );
    case 'spear':
      return (
        <g>
          <path d="M82 96L70 8" {...L} stroke={INK} strokeWidth={5.6} />
          <path d="M82 96L70 8" {...L} stroke={K.wood3} strokeWidth={2.6} />
          <path d="M70 0l5 10-4 6-5-5z" fill={K.steel3} {...O} strokeWidth={2} />
          <path d="M66 18l10-2-2 4z" fill={K.thunder} {...O} strokeWidth={1.4} />
        </g>
      );
    case 'scythe':
      return (
        <g>
          <path d="M84 96L74 10" {...L} stroke={INK} strokeWidth={5.6} />
          <path d="M84 96L74 10" {...L} stroke={K.night2} strokeWidth={2.6} />
          <path d="M74 12c-14-6-28-2-36 8 12-4 24-4 36 0z" fill={K.dark2} {...O} />
          <path d="M70 13c-10-2-20 0-28 4" {...T} stroke={K.dark3} />
        </g>
      );
    case 'pick':
      return (
        <g>
          <path d="M80 96L70 28" {...L} stroke={INK} strokeWidth={5.6} />
          <path d="M80 96L70 28" {...L} stroke={K.wood} strokeWidth={2.6} />
          <path d="M54 30c8-8 24-8 32-2-6 0-12 0-16 2-6 0-12 0-16 0z" fill={K.steel} {...O} strokeWidth={2.2} />
        </g>
      );
    default: return null;
  }
}

function PropFront({ p }: { p: Prop }) {
  switch (p) {
    case 'hammer':
      return (
        <g transform="rotate(-20 72 76)">
          <rect x="69" y="64" width="6" height="32" rx="2" fill={K.wood} {...O} />
          <rect x="58" y="52" width="28" height="15" rx="3" fill={K.steel} {...O} />
          <path d="M62 56h20" {...T} stroke={K.steel3} strokeWidth={2} />
        </g>
      );
    case 'coin':
      return (
        <g>
          <path d="M66 98c0-10 2-16 8-20 4-3 8 0 8 4v14z" fill={K.skin[0]} {...O} />
          <circle cx="76" cy="70" r="9" fill={K.gold2} {...O} />
          <circle cx="76" cy="70" r="5.6" fill="none" stroke={K.gold} strokeWidth={2} />
          <path d="M76 66v8M74 68h4" {...T} />
          <Spark x={86} y={60} r={3.6} fill={K.gold3} />
        </g>
      );
    case 'pup':
      return (
        <g>
          <path d="M60 98c0-12 6-22 18-22s16 10 16 22z" fill={K.steel2} {...O} />
          <path d="M66 80l-2-12 8 7zM88 80l3-12-8 7z" fill={K.steel2} {...O} />
          <path d="M66 86c0-6 6-10 12-10s12 4 12 10c0 5-5 8-12 8s-12-3-12-8z" fill={K.steel2} {...O} />
          <path d="M71 87c3 4 11 4 14 0-1 4-4 6-7 6s-6-2-7-6z" fill={K.bone} {...O} strokeWidth={1.6} />
          <ellipse cx="78" cy="87" rx="2.4" ry="1.8" fill={INK} />
          <circle cx="72" cy="83" r="1.6" fill={INK} /><circle cx="84" cy="83" r="1.6" fill={INK} />
        </g>
      );
    case 'herbs':
      return (
        <g>
          <path d="M70 70c-2-6 2-12 6-14M76 70c0-8 4-12 8-12M74 70c-4-4-8-4-10-2" {...L} stroke={K.moss} strokeWidth={2.4} />
          {[[64, 66], [76, 55], [85, 58], [70, 60]].map(([x, y], i) => <path key={i} d={`M${x} ${y}c-4-1-6-5-4-8 4 0 6 4 4 8z`} fill={i % 2 ? K.moss2 : K.moss3} {...O} strokeWidth={1.6} />)}
          <path d="M64 72h22l-3 22c-4 3-12 3-16 0z" fill={K.ice2} {...O} />
          <path d="M66 82h18l-1 11c-4 2-12 2-16 0z" fill={K.moss2} stroke="none" />
          <path d="M64 72h22l-3 22c-4 3-12 3-16 0z" fill="none" {...O} />
          <rect x="68" y="66" width="14" height="6" rx="1.5" fill={K.leather} {...O} strokeWidth={2} />
        </g>
      );
    case 'orb':
      return (
        <g>
          <circle cx="76" cy="74" r="14" fill={K.thunder2} opacity={0.35} />
          <circle cx="76" cy="74" r="10" fill={K.night2} {...O} />
          <path d="M78 66l-5 8h5l-4 8" {...L} stroke={K.thunder2} strokeWidth={2.6} />
          <circle cx="72" cy="70" r="2" fill="#fff" opacity={0.7} />
          <Spark x={88} y={60} r={3.4} fill={K.thunder2} />
          <Spark x={63} y={62} r={2.6} fill={K.light2} />
        </g>
      );
    case 'shield':
      return (
        <g>
          <path d="M8 66h28v14c0 10-6 16-14 18-8-2-14-8-14-18z" fill={K.steel} {...O} />
          <path d="M12 70h20v10c0 7-4 11-10 13-6-2-10-6-10-13z" fill={K.night2} {...O} strokeWidth={2} />
          <path d="M22 72v18M15 79h14" {...L} stroke={K.gold2} strokeWidth={3} />
        </g>
      );
    case 'lute':
      return (
        <g transform="rotate(38 68 84)">
          <path d="M62 72l2-28h6l2 28" fill={K.wood2} {...O} strokeWidth={2} />
          <ellipse cx="67" cy="84" rx="12" ry="14" fill={K.wood3} {...O} />
          <circle cx="67" cy="82" r="4" fill={K.wood2} {...O} strokeWidth={1.6} />
          <path d="M65 46v42M69 46v42" {...T} strokeWidth={0.9} />
          <rect x="61" y="38" width="12" height="7" rx="2" fill={K.wood} {...O} strokeWidth={1.8} />
        </g>
      );
    case 'ladle':
      return (
        <g transform="rotate(20 74 70)">
          <rect x="72" y="44" width="5" height="34" rx="2.5" fill={K.wood3} {...O} />
          <path d="M64 78c0 8 6 12 10 12s10-4 10-12z" fill={K.steel} {...O} />
          <path d="M66 78h16" {...L} />
          <path d="M70 30c-2-4 2-6 0-10M78 30c-2-4 2-6 0-10" {...T} stroke="#fff" strokeWidth={1.8} />
        </g>
      );
    case 'flame':
      return (
        <g>
          <path d="M66 98c0-10 2-16 8-20 4-3 8 0 8 4v14z" fill={K.skin[3]} {...O} />
          <circle cx="76" cy="66" r="14" fill={K.fire2} opacity={0.3} />
          <path d="M76 78c-8 0-11-6-9-12 1-4 4-6 4-10 4 2 6 6 5 10 2-2 3-4 3-7 4 4 6 9 5 13-1 4-4 6-8 6z" fill={K.fire} {...O} />
          <path d="M76 76c-3 0-5-3-4-6 1-2 3-3 3-5 2 1 4 3 4 6s-1 5-3 5z" fill={K.fire3} />
        </g>
      );
    case 'map':
      return (
        <g transform="rotate(-8 72 80)">
          <path d="M56 70h30v24H56z" fill={K.parch} {...O} />
          <path d="M60 76c6 4 12-2 18 4s4 8 6 8" {...T} stroke={K.blood} strokeDasharray="2 2" />
          <path d="M80 84l3 3M83 84l-3 3" {...T} stroke={K.blood} strokeWidth={1.8} />
          <path d="M66 70v24M76 70v24" {...T} strokeWidth={0.8} />
        </g>
      );
    case 'dagger':
      return (
        <g transform="rotate(30 72 76)">
          <path d="M70 46h5l1 22h-7z" fill={K.steel3} {...O} strokeWidth={2} />
          <rect x="64" y="67" width="17" height="4" rx="2" fill={K.gold} {...O} strokeWidth={1.8} />
          <rect x="70" y="71" width="5" height="10" fill={K.dark2} {...O} strokeWidth={1.8} />
        </g>
      );
    case 'book':
      return (
        <g>
          <path d="M58 72l14 4 14-4v20l-14 4-14-4z" fill={K.parch} {...O} />
          <path d="M72 76v20" {...L} />
          <path d="M61 78l8 2M61 83l8 2M75 80l8-2M75 85l8-2" {...T} strokeWidth={1} />
          <Spark x={72} y={64} r={4} fill={K.thunder2} />
        </g>
      );
    case 'dice':
      return (
        <g>
          <rect x="60" y="70" width="14" height="14" rx="3" fill="#fff" {...O} transform="rotate(-12 67 77)" />
          <rect x="74" y="76" width="14" height="14" rx="3" fill={K.blood2} {...O} transform="rotate(14 81 83)" />
          <circle cx="64" cy="75" r="1.4" fill={INK} /><circle cx="69" cy="79" r="1.4" fill={INK} />
          <circle cx="81" cy="83" r="1.6" fill="#fff" />
        </g>
      );
    case 'trap':
      return (
        <g>
          <ellipse cx="74" cy="88" rx="14" ry="5" fill={K.steel2} {...O} />
          <path d="M60 86l3-8 3 6 3-8 3 8 3-8 3 8 3-8 3 6 3-6v8" fill="none" {...O} stroke={INK} strokeWidth={2} />
          <path d="M60 86l3-8 3 6 3-8 3 8 3-8 3 8 3-8 3 6 3-6" {...T} stroke={K.steel3} />
        </g>
      );
    case 'scroll':
      return (
        <g transform="rotate(-14 72 80)">
          <rect x="58" y="72" width="28" height="18" fill={K.parch} {...O} />
          <rect x="55" y="70" width="5" height="22" rx="2.5" fill={K.wood} {...O} strokeWidth={1.8} />
          <rect x="84" y="70" width="5" height="22" rx="2.5" fill={K.wood} {...O} strokeWidth={1.8} />
          <path d="M64 77h16M64 81h12M64 85h14" {...T} strokeWidth={1} />
          <circle cx="78" cy="86" r="3" fill={K.blood} {...O} strokeWidth={1.2} />
        </g>
      );
    case 'twin':
      return (
        <g>
          <g transform="rotate(-24 70 70)"><path d="M68 40h5v28h-5z" fill={K.steel3} {...O} strokeWidth={2} /><rect x="63" y="67" width="15" height="4" rx="2" fill={K.gold} {...O} strokeWidth={1.6} /></g>
          <g transform="rotate(18 80 72)"><path d="M78 42h5v28h-5z" fill={K.steel3} {...O} strokeWidth={2} /><rect x="73" y="69" width="15" height="4" rx="2" fill={K.gold} {...O} strokeWidth={1.6} /></g>
        </g>
      );
    case 'knife':
      return (
        <g transform="rotate(-30 74 78)">
          <path d="M70 52c6 4 8 10 6 18h-6z" fill={K.steel3} {...O} strokeWidth={2} />
          <rect x="69" y="70" width="7" height="14" rx="2" fill={K.wood} {...O} strokeWidth={1.8} />
        </g>
      );
    case 'mug':
      return (
        <g>
          <path d="M62 70h18v22c0 2-2 4-4 4H66c-2 0-4-2-4-4z" fill={K.wood3} {...O} />
          <path d="M80 74c6 0 8 3 8 7s-2 7-8 7" {...L} strokeWidth={2.6} />
          <path d="M60 70c0-6 4-8 8-6 2-4 8-4 10 0 4-2 6 2 4 6z" fill="#fff" {...O} strokeWidth={2} />
          <path d="M66 76v14M72 76v14" {...T} stroke={K.wood2} />
        </g>
      );
    case 'lantern':
      return (
        <g>
          <path d="M74 50v6" {...L} />
          <circle cx="74" cy="72" r="14" fill={K.light} opacity={0.35} />
          <path d="M66 58h16l-2 4v16l2 4H66l2-4V62z" fill={K.gold3} {...O} />
          <path d="M74 64c-3 3-3 8 0 10 3-2 3-7 0-10z" fill={K.fire2} {...O} strokeWidth={1.4} />
          <path d="M66 58h16M66 82h16" {...L} stroke={INK} strokeWidth={3} />
        </g>
      );
    case 'whip':
      return (
        <g>
          <rect x="70" y="74" width="6" height="18" rx="2" fill={K.leather} {...O} />
          <path d="M73 74c-4-10 4-18 12-16s6 10-2 12-8 8-4 14" {...L} stroke={K.wood2} strokeWidth={2.6} />
        </g>
      );
    default: return null;
  }
}

function Motes({ m }: { m?: FigureSpec['motes'] }) {
  if (!m) return null;
  const pts: [number, number][] = [[12, 16], [84, 12], [16, 54], [88, 42], [10, 34]];
  if (m === 'snow') return <g>{pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={1.8} fill="#fff" stroke={INK} strokeWidth={0.8} />)}</g>;
  if (m === 'embers') return <g>{pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={1.6 + (i % 2)} fill={K.fire2} />)}</g>;
  if (m === 'leaves') return <g>{pts.map(([x, y], i) => <path key={i} d={`M${x} ${y}c-3-1-4-4-2-6 3 1 4 4 2 6z`} fill={K.moss3} stroke={INK} strokeWidth={0.9} />)}</g>;
  if (m === 'shadow') return <g opacity={0.5}>{pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={2 + (i % 3)} fill={K.dark2} />)}</g>;
  if (m === 'coins') return <g>{pts.slice(0, 3).map(([x, y], i) => <circle key={i} cx={x} cy={y} r={3} fill={K.gold2} stroke={INK} strokeWidth={1.2} />)}</g>;
  return <g>{pts.map(([x, y], i) => <Spark key={i} x={x} y={y} r={i % 2 ? 2.4 : 3.2} fill={m === 'stars' ? K.thunder2 : K.light2} />)}</g>;
}

/** 胸像。frame=false で背景なし */
export function Figure({ s, id, size = 96, label, frame = true, children }: { s: FigureSpec; id: string; size?: number; label?: string; frame?: boolean; children?: ReactNode }) {
  return (
    <svg viewBox="0 0 96 96" width={size} height={size} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} style={{ display: 'block' }}>
      {frame && <MistBg id={id} c1={s.bg[0]} c2={s.bg[1]} />}
      <g clipPath={frame ? `url(#cl-${id})` : undefined}>
        <Motes m={s.motes} />
        <PropBack p={s.prop} />
        <GearBack s={s} />
        <HairBack s={s} />
        <Body s={s} />
        <Face s={s} />
        <Beard s={s} />
        <HairFront s={s} />
        <GearFront s={s} />
        <PropFront p={s.prop} />
        {children}
      </g>
    </svg>
  );
}
