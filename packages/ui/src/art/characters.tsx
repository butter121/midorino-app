// キャラクター12人の肖像（オリジナル）。部品を組み合わせて描く。viewBox 0 0 100 100
import type { ReactNode } from 'react';
import { C, L, O } from './common';

type Hair = 'bun' | 'short' | 'long' | 'braid' | 'bob' | 'spiky' | 'crop' | 'pony';
type Hat = 'none' | 'beanie' | 'kerchief' | 'cap' | 'straw' | 'hood' | 'hachimaki' | 'bandana' | 'goggles';
type Prop = 'axe' | 'pot' | 'hammer' | 'pouch' | 'crook' | 'wheat' | 'vane' | 'saw' | 'scroll' | 'ladle' | 'hoe' | 'rattle';

interface Look {
  skin: string; hair: string; hairStyle: Hair; hat: Hat; hatColor?: string;
  outfit: string; trim: string; prop: Prop; beard?: boolean; glasses?: boolean; bg: string;
}

/** 肖像の背景色（カードの上半分にも使う） */
export const CHARACTER_LOOKS: Record<string, Look> = {
  toma: { skin: C.skin[1], hair: '#6B4A2E', hairStyle: 'crop', hat: 'beanie', hatColor: '#3E8E57', outfit: '#C2553E', trim: '#9C3F2C', prop: 'axe', beard: true, bg: '#DCEFD7' },
  mina: { skin: C.skin[0], hair: '#5A3B2E', hairStyle: 'bun', hat: 'kerchief', hatColor: '#D9774B', outfit: '#7FB3A6', trim: '#F4E6C8', prop: 'pot', bg: '#FBE5D2' },
  gan: { skin: C.skin[2], hair: '#2E2A2A', hairStyle: 'crop', hat: 'goggles', hatColor: '#8E989E', outfit: '#5E6B66', trim: '#8C5E3C', prop: 'hammer', beard: true, bg: '#E3E6E8' },
  leo: { skin: C.skin[0], hair: '#C98A4B', hairStyle: 'short', hat: 'cap', hatColor: '#3A6FC4', outfit: '#8A5BB8', trim: '#F2C14E', prop: 'pouch', bg: '#EDE3F6' },
  haru: { skin: C.skin[3], hair: '#3B2A22', hairStyle: 'short', hat: 'straw', hatColor: '#E8C25A', outfit: '#4F86C6', trim: '#FFFDF5', prop: 'crook', bg: '#DDF2F6' },
  sana: { skin: C.skin[1], hair: '#7A4E2D', hairStyle: 'braid', hat: 'bandana', hatColor: '#F2B630', outfit: '#E8A23A', trim: '#FFF3DA', prop: 'wheat', bg: '#FFF1C9' },
  yuki: { skin: C.skin[3], hair: '#9DB4D8', hairStyle: 'long', hat: 'hood', hatColor: '#7E9DD3', outfit: '#B9A6E0', trim: '#FFFFFF', prop: 'vane', glasses: true, bg: '#E6EDF8' },
  goro: { skin: C.skin[2], hair: '#2E2A2A', hairStyle: 'spiky', hat: 'hachimaki', hatColor: '#FFFFFF', outfit: '#E5803A', trim: '#8C5E3C', prop: 'saw', bg: '#FBE5D2' },
  aya: { skin: C.skin[0], hair: '#2E2A2A', hairStyle: 'bob', hat: 'none', outfit: '#EC7FA9', trim: '#FFFDF7', prop: 'scroll', bg: '#FCE6EC' },
  momo: { skin: C.skin[3], hair: '#B85A33', hairStyle: 'pony', hat: 'kerchief', hatColor: '#FFFFFF', outfit: '#FFFDF7', trim: '#E5533D', prop: 'ladle', bg: '#FDEBDD' },
  riku: { skin: C.skin[2], hair: '#4A3426', hairStyle: 'spiky', hat: 'bandana', hatColor: '#3FA67A', outfit: '#A89A6A', trim: '#6E6040', prop: 'hoe', bg: '#EAF0D8' },
  nana: { skin: C.skin[0], hair: '#8C5E3C', hairStyle: 'long', hat: 'none', outfit: '#8FD0B8', trim: '#FFFDF7', prop: 'rattle', glasses: false, bg: '#DFF4EC' },
};

function hairBack(l: Look): ReactNode {
  switch (l.hairStyle) {
    case 'long': return <path {...O} d="M28 46c0-16 10-26 22-26s22 10 22 26v28H28z" fill={l.hair} />;
    case 'bun': return <><circle {...O} cx="50" cy="16" r="9" fill={l.hair} /><path {...O} d="M28 44c0-14 10-24 22-24s22 10 22 24v6H28z" fill={l.hair} /></>;
    case 'bob': return <path {...O} d="M27 50c0-18 10-28 23-28s23 10 23 28v12H27z" fill={l.hair} />;
    case 'braid': return <><path {...O} d="M29 46c0-15 9-25 21-25s21 10 21 25v4H29z" fill={l.hair} /><path {...O} d="M70 50c4 6 4 14 0 20 3 2 4 5 2 8" fill="none" stroke={l.hair} strokeWidth={7} /></>;
    case 'pony': return <><path {...O} d="M29 46c0-15 9-25 21-25s21 10 21 25v4H29z" fill={l.hair} /><path {...O} d="M68 32c10 2 12 14 6 22-1-8-4-12-10-14z" fill={l.hair} /></>;
    default: return <path {...O} d="M30 46c0-15 9-24 20-24s20 9 20 24z" fill={l.hair} />;
  }
}

function hairFront(l: Look): ReactNode {
  switch (l.hairStyle) {
    case 'spiky': return <path {...O} d="M30 42l3-12 5 6 4-10 5 8 4-10 4 9 5-7 3 9 5-4 1 11c-8-3-30-3-39 0z" fill={l.hair} />;
    case 'bob': return <path {...O} d="M31 44c4-10 12-14 19-14s15 4 19 14c-6-4-12-5-19-5s-13 1-19 5z" fill={l.hair} />;
    case 'short': return <path {...O} d="M31 42c2-10 10-14 19-14s17 4 19 14c-8-6-16-4-24-8-4 4-9 6-14 8z" fill={l.hair} />;
    case 'crop': return <path {...O} d="M32 40c3-8 10-11 18-11s15 3 18 11c-10-3-26-3-36 0z" fill={l.hair} />;
    default: return <path {...O} d="M31 42c4-8 11-12 19-12s15 4 19 12c-4-2-10-4-19-4s-15 2-19 4z" fill={l.hair} />;
  }
}

function hat(l: Look): ReactNode {
  const c = l.hatColor ?? '#fff';
  switch (l.hat) {
    case 'beanie': return <><path {...O} d="M29 44c0-16 9-26 21-26s21 10 21 26z" fill={c} /><path {...O} d="M28 41h44v8H28z" fill="#2F6B4F" /><circle {...O} cx="50" cy="16" r="5" fill={C.cream} /></>;
    case 'kerchief': return <path {...O} d="M29 40c6-12 36-12 42 0 2 3 0 5-3 4-6-2-12-3-18-3s-12 1-18 3c-3 1-5-1-3-4z" fill={c} />;
    case 'cap': return <><path {...O} d="M30 38c0-10 9-15 20-15s20 5 20 15z" fill={c} /><path {...O} d="M30 38h44c0 4-4 5-10 5H30z" fill={c} /><circle cx="50" cy="23" r="2.5" fill="#2B3A3A" /></>;
    case 'straw': return <><ellipse {...O} cx="50" cy="36" rx="34" ry="7" fill={c} /><path {...O} d="M34 35c0-10 7-15 16-15s16 5 16 15z" fill={c} /><path {...O} d="M34 33h32v4H34z" fill="#C2553E" /></>;
    case 'hood': return <path {...O} d="M24 70c0-34 10-50 26-50s26 16 26 50l-8-4c0-18-6-30-18-30s-18 12-18 30z" fill={c} />;
    case 'hachimaki': return <><path {...O} d="M30 38h40v7H30z" fill={c} /><path {...O} d="M70 40l10-6-2 10z" fill={c} /><circle cx="50" cy="41.5" r="2.4" fill="#E5533D" /></>;
    case 'bandana': return <><path {...O} d="M30 40c2-12 11-17 20-17s18 5 20 17z" fill={c} /><path {...O} d="M68 36l10 4-8 4z" fill={c} /><circle cx="42" cy="32" r="1.6" fill="#fff" /><circle cx="56" cy="30" r="1.6" fill="#fff" /></>;
    case 'goggles': return <><path {...O} d="M30 36h40v5H30z" fill="#5A3B2E" /><circle {...O} cx="42" cy="36" r="6" fill={c} /><circle {...O} cx="58" cy="36" r="6" fill={c} /><path d="M39 34l3-2M55 34l3-2" stroke="#fff" strokeWidth={2} strokeLinecap="round" /></>;
    default: return null;
  }
}

function prop(p: Prop): ReactNode {
  switch (p) {
    case 'axe': return <><path {...O} d="M76 10l8 64" fill="none" strokeWidth={5} stroke={C.woodD} /><path {...O} d="M74 10c8-2 16 2 18 10l-14 4z" fill={C.stone} /></>;
    case 'pot': return <><path {...O} d="M72 72c-5 0-8 3-8 8 0 7 5 12 11 12s11-5 11-12c0-5-3-8-8-8z" fill={C.clay} /><path {...O} d="M69 72h12" fill="none" /></>;
    case 'hammer': return <><path {...O} d="M80 30l-6 60" fill="none" strokeWidth={5} stroke={C.woodD} /><path {...O} d="M68 22h22v12H68z" fill="#6B7178" /></>;
    case 'pouch': return <><path {...O} d="M68 76c0-6 4-10 9-10s9 4 9 10c0 8-4 14-9 14s-9-6-9-14z" fill="#8C5E3C" /><path {...O} d="M70 68h14" fill="none" /><circle {...O} cx="77" cy="80" r="4" fill={C.gold} /></>;
    case 'crook': return <path {...O} d="M80 96V26c0-8 12-8 12 0v4" fill="none" strokeWidth={4.5} stroke={C.woodD} />;
    case 'wheat': return <><path {...L} d="M76 96L84 40M80 96l12-50M72 96l0-48" /><g fill="#E8C25A" {...O} strokeWidth={2}><ellipse cx="84" cy="36" rx="4" ry="8" /><ellipse cx="93" cy="42" rx="3.5" ry="7" transform="rotate(20 93 42)" /><ellipse cx="72" cy="44" rx="3.5" ry="7" transform="rotate(-10 72 44)" /></g></>;
    case 'vane': return <><path {...O} d="M82 96V20" fill="none" strokeWidth={3.5} /><path {...O} d="M82 22l12 4-12 4z" fill={C.gold} /><path {...O} d="M82 26H70l3-4" fill="none" /><circle {...O} cx="82" cy="16" r="3" fill={C.gold} /></>;
    case 'saw': return <><path {...O} d="M70 92l22-50 6 3-20 50z" fill={C.stone} /><path d="M92 46l-2 4 3 1-2 4 3 1-2 4 3 1-2 4 3 1" stroke="#2B3A3A" strokeWidth={1.6} fill="none" /><path {...O} d="M66 92h14v8H66z" fill={C.wood} /></>;
    case 'scroll': return <><path {...O} d="M66 66h22v26H66z" fill={C.paper} /><path {...O} d="M64 64h26v5H64zM64 90h26v5H64z" fill={C.clay} /><path {...L} d="M70 74h14M70 80h10" /></>;
    case 'ladle': return <><path {...O} d="M86 20L74 74" fill="none" strokeWidth={4} stroke={C.woodD} /><path {...O} d="M64 74c0 8 5 12 10 12s10-4 10-12z" fill={C.wood} /></>;
    case 'hoe': return <><path {...O} d="M80 96L84 20" fill="none" strokeWidth={4.5} stroke={C.woodD} /><path {...O} d="M84 22l12 2-2 10-10-4z" fill={C.stone} /></>;
    case 'rattle': return <><path {...O} d="M80 92V64" fill="none" strokeWidth={4} stroke={C.wood} /><circle {...O} cx="80" cy="56" r="10" fill="#F6C142" /><path {...O} d="M80 46c-1-5 1-9 5-10 0 4-2 7-5 10z" fill="#6CC17A" /></>;
  }
}

export function CharacterArt({ id, size = 96, bg = false }: { id: string; size?: number; bg?: boolean }) {
  const l = CHARACTER_LOOKS[id] ?? CHARACTER_LOOKS.toma;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-hidden>
      {bg && <rect width="100" height="100" fill={l.bg} />}
      {hairBack(l)}
      <path {...O} d="M16 100c0-20 15-32 34-32s34 12 34 32z" fill={l.outfit} />
      <path {...O} d="M40 70l10 12 10-12" fill={l.trim} />
      <ellipse {...O} cx="50" cy="50" rx="19" ry="20" fill={l.skin} />
      {l.beard && <path d="M32 56c2 10 9 13 18 13s16-3 18-13c-4 4-10 5-18 5s-14-1-18-5z" fill={l.hair} opacity=".55" />}
      <circle cx="43" cy="51" r="2.4" fill="#2B3A3A" /><circle cx="57" cy="51" r="2.4" fill="#2B3A3A" />
      {l.glasses && <><circle {...L} cx="43" cy="51" r="5.5" /><circle {...L} cx="57" cy="51" r="5.5" /><path {...L} d="M48.5 51h3" /></>}
      <path {...L} d="M45 59q5 4 10 0" />
      <ellipse cx="37" cy="57" rx="4" ry="2.4" fill="#F2A08C" opacity=".7" />
      <ellipse cx="63" cy="57" rx="4" ry="2.4" fill="#F2A08C" opacity=".7" />
      {l.hat !== 'hood' && hairFront(l)}
      {hat(l)}
      {prop(l.prop)}
    </svg>
  );
}
