// 職能カード30枚の絵（名前のない冒険者の胸像。冒険者12人と同じ組み立て方）
import { K } from './common';
import { Figure, type FigureSpec } from './figure';

const F = (o: Partial<FigureSpec> & Pick<FigureSpec, 'prop' | 'bg'>): FigureSpec => ({
  skin: 0, hair: '#5A3E2B', style: 'short', gear: 'none', outfit: 'cloak', cloth: K.moss, trim: K.parch, mouth: 'smile', ...o,
});
const BG = {
  fire: [K.fire, K.fire3] as [string, string], ice: ['#7FB8CC', K.ice3] as [string, string], thunder: ['#C9A84A', K.thunder2] as [string, string],
  light: [K.gold2, K.light2] as [string, string], dark: [K.dark, K.dark3] as [string, string], green: [K.moss2, K.moss3] as [string, string],
  earth: ['#B08A62', K.parch] as [string, string], steel: [K.steel2, K.steel3] as [string, string], night: [K.night2, '#7C8CB8'] as [string, string],
  rose: ['#D9978A', '#F6DCCF'] as [string, string],
};

export const JOB_LOOKS: Record<string, FigureSpec & { name: string }> = {
  o01: { name: '見習い炎術士', ...F({ skin: 3, hair: '#E07A3A', style: 'bob', gear: 'witch', gearColor: K.blood, gearColor2: K.fire2, outfit: 'robe', cloth: K.blood, trim: K.fire2, mouth: 'open', prop: 'flame', bg: BG.fire, motes: 'embers' }) },
  o02: { name: '霜の射手', ...F({ skin: 3, hair: '#E8EEF6', style: 'long', gear: 'hood', gearColor: '#4E8AA6', outfit: 'cloak', cloth: '#4E8AA6', trim: K.ice2, ears: 'elf', mouth: 'flat', brows: 'sharp', prop: 'frostbow', bg: BG.ice, motes: 'snow' }) },
  o03: { name: '雷槍の傭兵', ...F({ skin: 2, hair: '#3B2A22', style: 'spiky', gear: 'band', gearColor: K.thunder, outfit: 'leather', cloth: '#5A5A6A', trim: K.leather, brows: 'sharp', mouth: 'grin', prop: 'spear', bg: BG.thunder, motes: 'sparks' }) },
  o04: { name: '聖堂の癒し手', ...F({ skin: 0, hair: '#C8A060', style: 'long', gear: 'veil', gearColor: '#FFFDF6', gearColor2: K.moss2, outfit: 'robe', cloth: '#FFFDF6', trim: K.moss2, eyes: 'closed', prop: 'herbs', bg: BG.light, motes: 'sparks' }) },
  o05: { name: '闇市の情報屋', ...F({ skin: 1, hair: '#2E2A3A', style: 'slick', gear: 'mask', gearColor: K.dark2, outfit: 'cloak', cloth: '#3A2E4E', trim: K.gold, mouth: 'smirk', prop: 'map', bg: BG.dark, motes: 'shadow' }) },
  o06: { name: '盾持ちの古参兵', ...F({ skin: 1, hair: '#B8B8C0', style: 'none', gear: 'helm', gearColor: K.steel2, outfit: 'armor', cloth: '#4A5A6A', trim: K.steel, beard: true, brows: 'sharp', mouth: 'flat', prop: 'shield', bg: BG.steel }) },
  o07: { name: '魔獣の調教師', ...F({ skin: 2, hair: '#4A3428', style: 'tail', gear: 'furhat', gearColor: '#6A5A4A', gearColor2: K.bone, outfit: 'fur', cloth: '#6A4A34', trim: K.bone, mouth: 'grin', prop: 'whip', bg: BG.earth }) },
  o08: { name: '薬草摘みの少女', ...F({ skin: 3, hair: '#C88A4A', style: 'braid', gear: 'leaves', gearColor: K.moss3, outfit: 'apron', cloth: '#7FA678', trim: K.parch, prop: 'herbs', bg: BG.green, motes: 'leaves' }) },
  o09: { name: '酒場の看板娘', ...F({ skin: 0, hair: '#8A3A2E', style: 'tail', gear: 'bandana', gearColor: K.blood2, outfit: 'apron', cloth: K.blood, trim: K.parch, eyes: 'wink', mouth: 'grin', prop: 'mug', bg: BG.rose }) },
  o10: { name: '鉱山のドワーフ', ...F({ skin: 2, hair: '#6A4A34', style: 'short', gear: 'cap', gearColor: '#7A6A5A', outfit: 'vest', cloth: '#4A5A6A', trim: K.leather, beard: true, mouth: 'smile', prop: 'pick', bg: BG.steel }) },
  o11: { name: '狂戦士', ...F({ skin: 1, hair: '#8A2E22', style: 'spiky', gear: 'horned', gearColor: '#4A3A34', gearColor2: K.blood, outfit: 'fur', cloth: '#5A3A30', trim: '#8A6A54', brows: 'sharp', mouth: 'grin', scar: true, prop: 'greatsword', bg: ['#8A3A3A', '#D9978A'], motes: 'embers' }) },
  o12: { name: '星図の学者', ...F({ skin: 3, hair: '#5A6A9A', style: 'bob', gear: 'circlet', gearColor2: K.steel, outfit: 'robe', cloth: K.night2, trim: K.thunder, mouth: 'open', prop: 'book', bg: BG.night, motes: 'stars' }) },
  o13: { name: '城壁の工兵', ...F({ skin: 1, hair: '#4A3428', style: 'short', gear: 'band', gearColor: K.steel2, outfit: 'vest', cloth: '#6A5A44', trim: K.wood, mouth: 'smile', prop: 'hammer', bg: BG.earth }) },
  o14: { name: '影の斥候', ...F({ skin: 1, hair: '#1E2433', style: 'short', gear: 'hood', gearColor: '#2E2E3E', outfit: 'leather', cloth: '#2E2E3E', trim: '#4A4A62', brows: 'sharp', mouth: 'flat', prop: 'dagger', bg: ['#4A4A62', '#9A96B0'], motes: 'shadow' }) },
  o15: { name: '竜骨の錬金術師', ...F({ skin: 0, hair: '#7AA0A0', style: 'bob', gear: 'cap', gearColor: '#5A4A6A', outfit: 'apron', cloth: '#5A4A6A', trim: K.bone, mouth: 'smirk', prop: 'crystal', bg: ['#6A8A8A', '#D4E6E0'], motes: 'sparks' }) },
  o16: { name: '嵐呼びの巫女', ...F({ skin: 3, hair: '#3A3A5A', style: 'long', gear: 'circlet', gearColor2: K.thunder, outfit: 'robe', cloth: '#FFFDF6', trim: K.blood, eyes: 'closed', prop: 'orb', bg: ['#4A5A7A', '#A8B8D4'], motes: 'sparks' }) },
  o17: { name: '光の聖騎士', ...F({ skin: 0, hair: '#E8D08A', style: 'none', gear: 'helm', gearColor: '#E6E8EE', outfit: 'armor', cloth: '#FFFDF6', trim: K.gold2, mouth: 'smile', prop: 'holy', bg: BG.light, motes: 'sparks' }) },
  o18: { name: '罠師', ...F({ skin: 2, hair: '#6A5A3A', style: 'short', gear: 'band', gearColor: K.moss, outfit: 'leather', cloth: K.moss, trim: K.leather, eyes: 'wink', mouth: 'smirk', prop: 'trap', bg: BG.green }) },
  o19: { name: '契約魔の主', ...F({ skin: 4, hair: '#1E2433', style: 'long', gear: 'hood', gearColor: K.dark2, outfit: 'robe', cloth: K.dark2, trim: K.blood2, eyes: 'glow', eyeColor: K.dark3, mouth: 'smirk', prop: 'staff', bg: BG.dark, motes: 'shadow' }) },
  o20: { name: '野営地の世話役', ...F({ skin: 1, hair: '#8A6A4A', style: 'short', gear: 'bandana', gearColor: K.moss2, outfit: 'apron', cloth: '#7A5A3A', trim: K.parch, beard: true, mouth: 'smile', prop: 'ladle', bg: [K.fire2, K.fire3] }) },
  o21: { name: '古地図の冒険家', ...F({ skin: 1, hair: '#A06A3A', style: 'tail', gear: 'tophat', gearColor: K.leather, gearColor2: K.blood, outfit: 'vest', cloth: K.leather2, trim: K.moss, mouth: 'grin', prop: 'map', bg: BG.earth }) },
  o22: { name: '双剣の剣士', ...F({ skin: 0, hair: '#2B2F3F', style: 'tail', gear: 'band', gearColor: K.ice, outfit: 'leather', cloth: '#3A4A6A', trim: K.ice, brows: 'sharp', mouth: 'flat', prop: 'twin', bg: ['#5A6A8A', '#C4D0E4'] }) },
  o23: { name: '結界の守り手', ...F({ skin: 3, hair: '#E8EEF6', style: 'long', gear: 'mitre', gearColor: '#FFFDF6', gearColor2: K.gold, outfit: 'robe', cloth: '#FFFDF6', trim: K.ice, eyes: 'closed', prop: 'shield', bg: BG.light, motes: 'sparks' }) },
  o24: { name: '交渉上手の仲介人', ...F({ skin: 0, hair: '#4A3A2A', style: 'slick', gear: 'tophat', gearColor: K.night2, gearColor2: K.gold, outfit: 'vest', cloth: K.night2, trim: K.gold, mouth: 'smile', prop: 'scroll', bg: BG.rose }) },
  o25: { name: '獣の皮なめし職人', ...F({ skin: 2, hair: '#3B2A22', style: 'short', gear: 'bandana', gearColor: K.leather, outfit: 'apron', cloth: '#6A4A34', trim: K.leather2, mouth: 'flat', prop: 'knife', bg: BG.earth }) },
  o26: { name: '呪われた勇者', ...F({ skin: 4, hair: '#C8C8D8', style: 'spiky', gear: 'none', outfit: 'armor', cloth: '#2E2E3E', trim: K.dark, eyes: 'glow', eyeColor: K.dark3, scar: true, brows: 'sharp', mouth: 'frown', prop: 'greatsword', bg: ['#2E2A3E', K.dark], motes: 'shadow' }) },
  o27: { name: '賭博師', ...F({ skin: 1, hair: '#A02E3A', style: 'slick', gear: 'tophat', gearColor: '#2E2A3A', gearColor2: K.blood, outfit: 'vest', cloth: K.blood, trim: K.gold, eyes: 'wink', mouth: 'grin', prop: 'dice', bg: ['#2E5A4A', '#8AC0A0'], motes: 'coins' }) },
  o28: { name: '孤高の剣聖', ...F({ skin: 0, hair: '#1E2433', style: 'tail', gear: 'none', outfit: 'cloak', cloth: '#E6E0D0', trim: K.blood, eyes: 'closed', mouth: 'flat', prop: 'greatsword', bg: ['#8A9AAA', K.mist], motes: 'leaves' }) },
  o29: { name: '宝探しの鼠人', ...F({ skin: 3, hair: '#B8A88A', style: 'short', gear: 'none', ears: 'rat', outfit: 'leather', cloth: K.leather, trim: K.wood2, mouth: 'grin', prop: 'lantern', bg: ['#A88A4A', K.gold3], motes: 'coins' }) },
  o30: { name: '氷雪の隠者', ...F({ skin: 3, hair: '#F4F8FC', style: 'long', gear: 'hood', gearColor: '#9CC4D8', outfit: 'cloak', cloth: '#9CC4D8', trim: K.ice3, beard: true, eyes: 'closed', mouth: 'flat', prop: 'crystal', bg: BG.ice, motes: 'snow' }) },
};
export const JOB_IDS = Object.keys(JOB_LOOKS);

/** 職能カードの絵 */
export function JobArt({ id, size = 96, label, frame = true }: { id: string; size?: number; label?: string; frame?: boolean }) {
  const s = JOB_LOOKS[id];
  if (!s) return null;
  return <Figure s={s} id={`j-${id}`} size={size} frame={frame} label={label ?? s.name} />;
}
