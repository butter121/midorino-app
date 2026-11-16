// 冒険者12人の肖像
import { K } from './common';
import { Figure, type FigureSpec } from './figure';

export const HERO_LOOKS: Record<string, FigureSpec & { name: string; role: string }> = {
  toma: { name: 'トーマ', role: '森の弓使い', skin: 0, hair: '#8A5A3B', style: 'short', gear: 'hood', gearColor: K.moss, outfit: 'cloak', cloth: K.moss, trim: K.moss3, ears: 'elf', prop: 'bow', mouth: 'smile', bg: [K.moss2, K.moss3], motes: 'leaves' },
  mina: { name: 'ミナ', role: '土くれの魔導士', skin: 3, hair: '#C8553D', style: 'bob', gear: 'witch', gearColor: '#9C5B3B', gearColor2: K.fire2, outfit: 'robe', cloth: '#9C5B3B', trim: K.fire2, prop: 'staff', mouth: 'grin', bg: ['#E3A27A', K.fire3], motes: 'embers' },
  gan: { name: 'ガン', role: 'ドワーフの鍛冶師', skin: 2, hair: '#C9692E', style: 'short', gear: 'cap', gearColor: K.leather, outfit: 'apron', cloth: K.night2, trim: K.leather2, beard: true, brows: 'sharp', prop: 'hammer', mouth: 'smile', bg: [K.steel2, K.steel3], motes: 'embers' },
  leo: { name: 'レオ', role: '闇市の商人', skin: 1, hair: '#2E2A3A', style: 'slick', gear: 'hood', gearColor: K.dark2, outfit: 'cloak', cloth: K.dark2, trim: K.gold, brows: 'sharp', mouth: 'smirk', eyes: 'wink', prop: 'coin', bg: [K.dark, K.dark3], motes: 'coins' },
  haru: { name: 'ハル', role: '獣使い', skin: 2, hair: '#3B2A22', style: 'short', gear: 'furhat', gearColor: '#9B7653', gearColor2: K.bone, outfit: 'fur', cloth: K.leather, trim: K.bone, prop: 'pup', mouth: 'grin', bg: ['#A6B07A', '#E2E6B8'] },
  sana: { name: 'サナ', role: '薬草師', skin: 3, hair: '#6B4A2E', style: 'braid', gear: 'leaves', gearColor: K.moss2, outfit: 'apron', cloth: K.moss, trim: K.parch, prop: 'herbs', mouth: 'smile', bg: [K.moss3, '#F0F4D8'], motes: 'leaves' },
  yuki: { name: 'ユキ', role: '星詠みの巫女', skin: 3, hair: '#E8EEF6', style: 'long', gear: 'circlet', gearColor2: K.gold2, outfit: 'robe', cloth: K.night, trim: K.thunder, eyeColor: '#3E5BA8', eyes: 'open', prop: 'orb', mouth: 'smile', bg: [K.night2, '#6C7FB0'], motes: 'stars' },
  goro: { name: 'ゴロウ', role: '城塞の騎士', skin: 1, hair: '#3B2A22', style: 'none', gear: 'helm', gearColor: K.steel, outfit: 'armor', cloth: K.night2, trim: K.steel, brows: 'sharp', mouth: 'flat', prop: 'shield', bg: [K.mist2, K.mist] },
  aya: { name: 'アヤ', role: '旅の吟遊詩人', skin: 0, hair: '#D9A441', style: 'tail', gear: 'beret', gearColor: K.blood, gearColor2: K.gold2, outfit: 'vest', cloth: K.blood, trim: K.gold2, prop: 'lute', mouth: 'open', eyes: 'wink', bg: ['#E7B4A0', K.parch] },
  momo: { name: 'モモ', role: '野営の料理人', skin: 0, hair: '#E0889A', style: 'bun', gear: 'bandana', gearColor: K.fire2, outfit: 'apron', cloth: K.leather2, trim: K.parch, prop: 'ladle', mouth: 'grin', eyes: 'closed', bg: [K.fire3, K.gold3] },
  riku: { name: 'リク', role: '魔物狩り', skin: 1, hair: '#2B2F3F', style: 'spiky', gear: 'band', gearColor: K.blood, outfit: 'leather', cloth: '#3D3A4A', trim: K.leather, brows: 'sharp', scar: true, mouth: 'flat', prop: 'greatsword', bg: ['#6A5A7A', '#B4A6C0'], motes: 'shadow' },
  nana: { name: 'ナナ', role: '光の神官', skin: 3, hair: '#F0D79A', style: 'long', gear: 'veil', gearColor: '#FFFDF6', gearColor2: K.gold, outfit: 'robe', cloth: '#FFFDF6', trim: K.gold, prop: 'holy', mouth: 'smile', eyeColor: '#8A6A2A', bg: [K.gold2, K.light2], motes: 'sparks' },
};

export const HERO_IDS = Object.keys(HERO_LOOKS);

/** 冒険者の肖像。label を省くと「トーマ（森の弓使い）」を読み上げる */
export function HeroArt({ id, size = 96, label, frame = true }: { id: string; size?: number; label?: string; frame?: boolean }) {
  const s = HERO_LOOKS[id];
  if (!s) return null;
  return <Figure s={s} id={`h-${id}`} size={size} frame={frame} label={label ?? `${s.name}（${s.role}）`} />;
}
