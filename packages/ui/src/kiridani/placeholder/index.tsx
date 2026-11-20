// 仮の絵（シルエットとアイコン）。本番のファンタジー絵に差し替えるまでの代わり。
//
// すべて <XxxArt id="..." size={...} /> の同じ形で、id は data.py / data.ts と同じ。
// 本番の絵は src/kiridani/art/ に同じ名前・同じ props で作られ、src/kiridani/art-registry.ts の
// import 1行を替えれば画面全体が差し替わる。
import { useId, type ReactElement, type ReactNode } from 'react';
import { BOSS, CARDS, CHAR, ITEMS, MON, OCCUPATIONS, type Element, type Race, type Res } from '../data';
import { G, glyph } from './glyphs';

/** 本番の絵（src/kiridani/art/）と同じ props */
export interface ArtProps {
  id: string;
  size?: number;
  /** 読み上げ用の名前（省略すると id から名前を引く／飾り扱い） */
  label?: string;
  /** false で背景を描かない（地形の上に重ねるとき） */
  frame?: boolean;
}

export const EL_COLOR: Record<Element, string> = { fire: '#E4572E', ice: '#4FB3E0', thunder: '#E8B923', light: '#F3DE8A', dark: '#8A5CC2' };
export const EL_GLYPH: Record<Element, string> = { fire: 'flame', ice: 'snow', thunder: 'bolt', light: 'sun', dark: 'moon' };
export const RACE_JP: Record<Race, string> = { beast: '獣', undead: '亡者', spirit: '精霊', dragon: '竜', humanoid: '人型' };
export const RACE_BG: Record<Race, [string, string]> = { beast: ['#5A4A2E', '#1A140C'], undead: ['#3A3448', '#100E16'], spirit: ['#2E4A5A', '#0C141A'], dragon: ['#5A2A22', '#1A0A08'], humanoid: ['#4A3A30', '#16100C'] };
const RACE_GLYPH: Record<Race, string> = { beast: 'paw', spirit: 'swirl', undead: 'skull', humanoid: 'mask', dragon: 'fang' };

function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const hue = (s: string) => hash(s) % 360;

function Frame({ size = 64, label, children, bg, rounded = 14 }: { size?: number; label?: string; children: ReactNode; bg?: [string, string]; rounded?: number }) {
  const gid = 'kdg' + useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role={label ? 'img' : undefined} style={{ display: 'block', flex: 'none' }}
      aria-label={label} aria-hidden={label ? undefined : true} data-art="placeholder">
      {bg && <>
        <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={bg[0]} /><stop offset="1" stopColor={bg[1]} /></linearGradient></defs>
        <rect width="100" height="100" rx={rounded} fill={`url(#${gid})`} />
      </>}
      {children}
    </svg>
  );
}

// ---------------------------------------------------------------- 資源・属性
const RES_ART: Record<Res, ReactElement> = {
  wood: <g><rect x="12" y="34" width="70" height="32" rx="16" fill="#A5672F" /><ellipse cx="80" cy="50" rx="10" ry="16" fill="#E8B77A" /><ellipse cx="80" cy="50" rx="4" ry="7" fill="#A5672F" /><path d="M24 44 L60 44 M30 56 L66 56" stroke="#7A4A20" strokeWidth="3" strokeLinecap="round" /></g>,
  iron: <g><path d="M10 66 L24 38 L76 38 L90 66Z" fill="#7F8C99" /><path d="M24 38 L76 38 L70 48 L30 48Z" fill="#B7C2CC" /></g>,
  herb: glyph('leaf', '#4FA65B', '#2C6B37'),
  mana: glyph('crystal', '#8F6BEA', '#D7C8FF'),
  food: <g><ellipse cx="44" cy="56" rx="30" ry="24" fill="#C8553D" /><ellipse cx="40" cy="52" rx="18" ry="12" fill="#E98A6D" /><path d="M68 66 L86 82" stroke="#F3E6D0" strokeWidth="9" strokeLinecap="round" /><circle cx="88" cy="80" r="6" fill="#F3E6D0" /><circle cx="82" cy="86" r="6" fill="#F3E6D0" /></g>,
  gold: glyph('coin', '#E8B923', '#9A6F00'),
  mat: glyph('fang', '#EFE6D2', '#A89A7C'),
};
const ICON_JP: Record<string, string> = {
  wood: '木材', iron: '鉄', herb: '薬草', mana: '魔石', food: '食料', gold: '金貨', mat: '素材',
  fire: '炎', ice: '氷', thunder: '雷', light: '光', dark: '闇',
  beast: '獣', undead: '亡者', spirit: '精霊', dragon: '竜', humanoid: '人型',
  fame: '名声', power: '戦力', defense: '防御', injury: '負傷', companion: '仲間', bed: '寝床', wall: '防壁', trophy: '討伐の証',
  fate: '運命', skill: '熟練', quest: '依頼', upkeep: '維持費', discontent: '不満', raid: '襲撃', familiar: '使い魔',
};
export const KICON_NAMES = Object.keys(ICON_JP);
const ICON_GLYPH: Record<string, [string, string, string]> = {
  beast: ['paw', '#C9A15A', '#000'], undead: ['skull', '#E6E0D0', '#2a2430'], spirit: ['swirl', '#9FD0E8', '#000'], dragon: ['fang', '#D8573A', '#000'],
  humanoid: ['mask', '#B58A6A', '#2a2018'], fame: ['laurel', '#E8B923', '#FFF2C8'], power: ['sword', '#C7CCD3', '#8A5A34'], defense: ['shield', '#9FB4C8', '#E8F0F8'],
  injury: ['bandage', '#F2E6D0', '#C8402E'], companion: ['people', '#D8C27A', '#9A8A5A'], bed: ['house', '#8A5A34', '#EADBC0'], wall: ['wall', '#8C8478', '#5A544A'],
  trophy: ['crest', '#E8B923', '#7A1D1D'], fate: ['cards', '#5568B8', '#E8B923'], skill: ['star', '#FFD84D', '#000'], quest: ['parchment', '#EADBB8', '#8A5A34'],
  upkeep: ['bowl', '#C8853D', '#F3E6D0'], discontent: ['mask', '#6A5A7A', '#F2E6D0'], raid: ['claw', '#D8402E', '#000'], familiar: ['paw', '#8A5CC2', '#000'],
};
/** 小さなアイコン（資源・属性・種族・状態）。本番の KIcon と同じ props */
export function KIcon({ name, size = 24, label }: { name: string; size?: number; label?: string | boolean }) {
  const l = label === true ? ICON_JP[name] : label || undefined;
  let body: ReactNode;
  if (name in RES_ART) body = RES_ART[name as Res];
  else if (name in EL_COLOR) body = <><circle cx="50" cy="50" r="46" fill="#1d1a2b" /><g transform="translate(15 15) scale(.7)">{glyph(EL_GLYPH[name as Element], EL_COLOR[name as Element], '#fff')}</g></>;
  else if (ICON_GLYPH[name]) { const [g, c, a] = ICON_GLYPH[name]; body = glyph(g, c, a); }
  else return null;
  return <Frame size={size} label={l}>{body}</Frame>;
}

// ---------------------------------------------------------------- キャラクター
const HERO: Record<string, { color: string; prop: string; bg: [string, string] }> = {
  toma: { color: '#3E7D4F', prop: 'bow', bg: ['#2D4A35', '#152219'] },
  mina: { color: '#B1532E', prop: 'staff', bg: ['#4E2C24', '#1E1210'] },
  gan: { color: '#8A6A44', prop: 'hammer', bg: ['#4A3A28', '#1D160E'] },
  leo: { color: '#6B4E8C', prop: 'coin', bg: ['#3A2B4D', '#17101F'] },
  haru: { color: '#9A7B2F', prop: 'paw', bg: ['#4B4020', '#1E190B'] },
  sana: { color: '#4C9A7E', prop: 'leaf', bg: ['#244A3E', '#0F1F1A'] },
  yuki: { color: '#5568B8', prop: 'star', bg: ['#25305C', '#0E1226'] },
  goro: { color: '#7D8794', prop: 'shield', bg: ['#3A4048', '#16191D'] },
  aya: { color: '#C0607E', prop: 'lute', bg: ['#552939', '#211016'] },
  momo: { color: '#D08A3C', prop: 'pot', bg: ['#5A3A1A', '#24160A'] },
  riku: { color: '#5B5B66', prop: 'twin', bg: ['#2E2E36', '#111115'] },
  nana: { color: '#D8C27A', prop: 'sun', bg: ['#4D4630', '#1D1A10'] },
};
const HERO_BODY = 'M22 100 Q24 62 50 54 Q76 62 78 100Z';
const HERO_HOOD = 'M30 46 Q28 14 50 12 Q72 14 70 46 Q66 56 50 56 Q34 56 30 46Z';

/** キャラクター12人の仮の絵（フード姿＋持ち物） */
export function HeroArt({ id, size = 96, label, frame = true }: ArtProps) {
  const h = HERO[id] ?? { color: `hsl(${hue(id)} 40% 45%)`, prop: 'star', bg: ['#333', '#111'] as [string, string] };
  return (
    <Frame size={size} label={label ?? CHAR[id]?.name} bg={frame ? h.bg : undefined}>
      <circle cx="50" cy="40" r="34" fill={h.color} opacity=".18" />
      <path d={HERO_BODY} fill={h.color} />
      <path d={HERO_HOOD} fill={h.color} />
      <path d="M38 38 Q50 30 62 38 Q62 50 50 52 Q38 50 38 38Z" fill="#0b0b10" />
      <circle cx="45" cy="42" r="2.4" fill="#fff" /><circle cx="55" cy="42" r="2.4" fill="#fff" />
      <g transform="translate(56 54) scale(.42)">{glyph(h.prop, '#f4ead2', h.color)}</g>
    </Frame>
  );
}

// ---------------------------------------------------------------- 魔物・主
const RACE_PATH: Record<Race, string> = {
  beast: 'M10 80 Q8 58 24 50 Q40 40 58 44 L64 34 L68 22 L74 34 Q82 30 88 38 L94 50 Q90 56 82 56 L80 62 L82 82 L72 82 L70 68 Q56 72 42 68 L38 82 L28 82 L28 68 Q20 72 18 82Z',
  spirit: 'M50 10 Q80 22 76 54 Q74 78 62 90 Q60 78 52 76 Q46 90 34 92 Q40 78 32 72 Q16 60 24 36 Q30 16 50 10Z',
  undead: 'M50 8 Q72 8 74 32 Q76 46 66 52 L76 60 L86 92 L14 92 L24 60 L34 52 Q24 46 26 32 Q28 8 50 8Z',
  humanoid: 'M50 10 Q63 10 63 26 Q63 32 59 36 L78 42 L90 66 L80 72 L72 56 L70 92 L56 92 L52 68 L48 68 L44 92 L30 92 L28 56 L20 72 L10 66 L22 42 L41 36 Q37 32 37 26 Q37 10 50 10Z',
  dragon: 'M50 26 Q56 18 64 22 L72 12 L70 28 Q78 34 72 44 L98 28 L88 58 L72 58 L66 74 L78 92 L60 92 L54 76 L42 76 L36 92 L20 92 L32 72 L28 58 L10 60 L2 32 L30 46 Q34 34 50 26Z',
};
const RACE_EYES: Record<Race, [number, number][]> = {
  beast: [[80, 44]], spirit: [[42, 40], [58, 40]], undead: [[43, 30], [57, 30]], humanoid: [[46, 24], [54, 24]], dragon: [[62, 30]],
};

function MonsterBody({ id, boss }: { id: string; boss: boolean }) {
  const m = MON[id] ?? BOSS[id];
  const race: Race = m?.race ?? 'beast';
  const el = m?.weak ?? null;
  const h = hash(id);
  const scale = Math.min(1.05, 0.72 + (m?.str ?? 5) / 30);
  const body = boss ? '#0c0910' : `hsl(${(h % 60) + 250} 18% ${12 + (h % 8)}%)`;
  const eye = boss ? '#FF4D3D' : '#FFD84D';
  const horns = h % 3 === 0;
  const t = `translate(${50 - 50 * scale} ${54 - 50 * scale}) scale(${scale})`;
  return (
    <g>
      {boss && <circle cx="50" cy="52" r="44" fill="none" stroke="#FF6A4D" strokeOpacity=".5" strokeWidth="3" strokeDasharray="4 6" />}
      <ellipse cx="50" cy="92" rx="36" ry="5" fill="#000" opacity=".35" />
      <g transform={t}>
        <path d={RACE_PATH[race]} fill={body} stroke={el ? EL_COLOR[el] : '#999'} strokeOpacity=".55" strokeWidth="1.5" />
        {horns && race !== 'spirit' && <path d={race === 'beast' ? 'M74 34 L70 18 L78 30 M84 36 L88 22 L88 38' : 'M40 14 L34 2 L46 12 M60 14 L66 2 L54 12'} fill={body} stroke={body} strokeWidth="3" />}
        {RACE_EYES[race].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3" fill={eye} />)}
        {h % 4 === 1 && RACE_EYES[race].length === 2 && <circle cx="50" cy={RACE_EYES[race][0][1] - 7} r="2.4" fill={eye} />}
      </g>
    </g>
  );
}

function monsterBg(id: string): [string, string] {
  const m = MON[id] ?? BOSS[id];
  const el = m?.weak;
  const c = el ? EL_COLOR[el] : '#6b5a7a';
  return [c + '55', '#120f18'];
}

/** 魔物30種の仮の絵（種族ごとのシルエット。背景のにじみは弱点の属性色） */
export function MonsterArt({ id, size = 96, label, frame = true }: ArtProps) {
  const m = MON[id];
  return (
    <Frame size={size} label={label ?? m?.name} bg={frame ? monsterBg(id) : undefined}>
      <MonsterBody id={id} boss={false} />
      {m && <g transform="translate(4 4) scale(.16)"><circle cx="50" cy="50" r="48" fill="#0008" />{glyph(RACE_GLYPH[m.race], '#e9e2d0', '#0008')}</g>}
    </Frame>
  );
}

/** 主（各年の冬の決戦）と古竜の仮の絵 */
export function BossArt({ id, size = 128, label, frame = true }: ArtProps) {
  const b = BOSS[id];
  return (
    <Frame size={size} label={label ?? b?.name} bg={frame ? ['#5a1d1d', '#0a0608'] : undefined}>
      <circle cx="50" cy="56" r="40" fill="#ff5a3c" opacity=".12" />
      <MonsterBody id={id} boss />
      <g transform="translate(36 2) scale(.28)">{glyph('crown', '#E8B923', '#7a1d1d')}</g>
    </Frame>
  );
}

// ---------------------------------------------------------------- カード（職能・品物）
const TAG_GLYPH: Record<string, string> = {
  fire: 'flame', ice: 'snow', thunder: 'bolt', light: 'sun', dark: 'moon', front: 'sword', rear: 'bow', support: 'heart',
  beast: 'paw', herb: 'leaf', iron: 'anvil', mana: 'crystal', food: 'pot', gold: 'coin', trade: 'coin', fate: 'cards',
  weather: 'cloud', wall: 'wall', trap: 'trap', chain: 'twin', companion: 'people', coop: 'people', convert: 'crystal',
  mat: 'fang', wood: 'tree', dragon: 'fang', morale: 'heart',
};
const TAG_COLOR: Record<string, string> = {
  fire: EL_COLOR.fire, ice: EL_COLOR.ice, thunder: EL_COLOR.thunder, light: EL_COLOR.light, dark: EL_COLOR.dark,
  front: '#B04A3A', rear: '#4C8A54', support: '#D07A9A', beast: '#9A7B2F', herb: '#4FA65B', iron: '#8996A3', mana: '#8F6BEA',
  food: '#D08A3C', gold: '#E8B923', trade: '#C9A13B', fate: '#5568B8', weather: '#7FA7C9', wall: '#8C8C8C', trap: '#7A6A3A',
  chain: '#7C2F3A', companion: '#D8C27A', coop: '#C0607E', wood: '#7D5A34', mat: '#BDB298', dragon: '#B8442E', convert: '#8F6BEA',
};
const tagOf = (tags: string[]) => tags.find((t) => ['fire', 'ice', 'thunder', 'light', 'dark'].includes(t)) ?? tags[0] ?? 'front';

/** 職能カード30種の仮の絵（人物シルエット＋キーワードの印） */
export function JobArt({ id, size = 96, label, frame = true }: ArtProps) {
  const o = OCCUPATIONS.find((x) => x.id === id);
  const t = o ? tagOf(o.tags) : 'front';
  const c = TAG_COLOR[t] ?? '#888';
  const second = o?.tags.find((x) => x !== t) ?? t;
  return (
    <Frame size={size} label={label ?? o?.name} bg={frame ? [c + '66', '#14121a'] : undefined}>
      <path d={HERO_BODY} fill="#0d0c12" transform="translate(-8 0)" />
      <circle cx="42" cy="36" r="15" fill="#0d0c12" />
      {o?.quirk && <circle cx="42" cy="36" r="20" fill="none" stroke="#E8B923" strokeWidth="2" strokeDasharray="3 3" />}
      <g transform="translate(54 8) scale(.4)"><circle cx="50" cy="50" r="48" fill="#0009" />{glyph(TAG_GLYPH[t] ?? 'star', c, '#fff')}</g>
      <g transform="translate(60 58) scale(.32)">{glyph(TAG_GLYPH[second] ?? 'star', TAG_COLOR[second] ?? '#ccc', '#0009')}</g>
    </Frame>
  );
}

const ITEM_GLYPH: Record<string, string> = {
  i01: 'bow', i02: 'greatsword', i03: 'dagger', i04: 'staff', i05: 'hammer', i06: 'shield', i07: 'scythe', i08: 'armor', i09: 'net', i10: 'lute',
  i11: 'furnace', i12: 'sprout', i13: 'pot', i14: 'tower', i15: 'wagon', i16: 'dummy', i17: 'house', i18: 'anvil',
  i19: 'scroll', i20: 'hourglass', i21: 'bell', i22: 'feather', i23: 'talisman', i24: 'potion', i25: 'parchment',
  i26: 'greatsword', i27: 'egg', i28: 'parchment', i29: 'furnace', i30: 'vial',
};
export const ITEM_KIND: Record<string, 'weapon' | 'tool' | 'spell'> = Object.fromEntries(ITEMS.map((x) => [x.id, x.kind]));
const KIND_BG: Record<string, [string, string]> = { weapon: ['#5a3a2a', '#17100c'], tool: ['#3a4a2a', '#10160b'], spell: ['#3a2a5a', '#100c18'] };

/** 品物カード30種（武具・道具・秘術）の仮の絵 */
export function ItemArt({ id, size = 96, label, frame = true }: ArtProps) {
  const it = ITEMS.find((x) => x.id === id);
  const el = it?.el ?? (it?.tags.find((t) => t in EL_COLOR) as Element | undefined);
  const c = el ? EL_COLOR[el] : it?.kind === 'tool' ? '#C9A46B' : '#C7CCD3';
  const a = it?.quirk ? '#B8263A' : it?.kind === 'spell' ? '#E8D7FF' : '#5b4630';
  return (
    <Frame size={size} label={label ?? it?.name} bg={frame ? KIND_BG[it?.kind ?? 'weapon'] : undefined}>
      {el && <circle cx="50" cy="50" r="40" fill={EL_COLOR[el]} opacity=".18" />}
      <g transform="translate(12 12) scale(.76)">{glyph(ITEM_GLYPH[id] ?? 'star', c, a)}</g>
      {it?.quirk && <g transform="translate(74 4) scale(.22)">{glyph('star', '#E8B923', '#000')}</g>}
    </Frame>
  );
}

/** カードの裏面（相手の手札・山札） */
export function CardBackArt({ id, size = 64, label }: ArtProps) {
  const occ = id === 'occ';
  return (
    <Frame size={size} label={label} bg={occ ? ['#2b3c5a', '#0e1420'] : ['#5a3b2b', '#20140e']}>
      <rect x="8" y="8" width="84" height="84" rx="10" fill="none" stroke="#d9c38a" strokeOpacity=".6" strokeWidth="2" />
      <g transform="translate(25 25) scale(.5)">{glyph(occ ? 'crest' : 'bag', '#d9c38a', '#0008')}</g>
    </Frame>
  );
}

// ---------------------------------------------------------------- 天候・地形
const WEATHER_ART: Record<string, { g: string; c: string; bg: [string, string]; extra?: string }> = {
  calm: { g: 'sun', c: '#F3C94E', bg: ['#6FA7D8', '#2E5A86'] },
  storm: { g: 'bolt', c: '#F2D04B', bg: ['#38404F', '#13161E'], extra: 'cloud' },
  sprout: { g: 'sprout', c: '#6CC070', bg: ['#9BD49A', '#3E7A47'] },
  thaw: { g: 'drop', c: '#8ED0F0', bg: ['#B8D8E8', '#5A87A3'] },
  fog: { g: 'fog', c: '#E4E6EA', bg: ['#8F98A5', '#4A5260'] },
  newmoon: { g: 'moon', c: '#B48EEA', bg: ['#1C1730', '#05040B'] },
  heat: { g: 'sun', c: '#FF7A3D', bg: ['#F2B04E', '#A3441F'] },
  harvestmoon: { g: 'moon', c: '#F6C453', bg: ['#2B2340', '#0D0A18'] },
  surge: { g: 'crystal', c: '#B48EEA', bg: ['#5A3A8A', '#1C1030'] },
  drought: { g: 'sun', c: '#E8A33D', bg: ['#D6B06A', '#7A5A2A'] },
  gale: { g: 'wind', c: '#EAF2F8', bg: ['#7FA7C9', '#3A5A78'] },
  festival: { g: 'lantern', c: '#7A2E1C', bg: ['#E89A4E', '#7A2E1C'] },
  blizzard: { g: 'snow', c: '#FFFFFF', bg: ['#A8C8E0', '#3E5E7E'] },
  cold: { g: 'thermo', c: '#DDEAF6', bg: ['#6F93B8', '#253F5C'] },
  mild: { g: 'sun', c: '#FFE29A', bg: ['#B9D3E6', '#6A8FAD'] },
  fair: { g: 'tent', c: '#C0503A', bg: ['#DCE8F2', '#8BA5BC'] },
};
/** 天候16種の仮の絵 */
export function WeatherArt({ id, size = 64, label, frame = true }: ArtProps) {
  const w = WEATHER_ART[id] ?? WEATHER_ART.calm;
  return (
    <Frame size={size} label={label} bg={frame ? w.bg : undefined}>
      {w.extra && <g transform="translate(6 -4) scale(.88)" opacity=".9">{glyph(w.extra, '#5B6272', '#000')}</g>}
      <g transform={w.extra ? 'translate(30 36) scale(.5)' : 'translate(16 16) scale(.68)'}>{glyph(w.g, w.c, '#ffffffaa')}</g>
    </Frame>
  );
}

const TERRAIN: Record<string, { g: string; c: string; bg: [string, string] }> = {
  forest: { g: 'tree', c: '#2F6B3A', bg: ['#86B97A', '#2E4A2A'] },
  mine: { g: 'pickaxe', c: '#5A5048', bg: ['#9A8E80', '#3A332C'] },
  meadow: { g: 'leaf', c: '#4FA65B', bg: ['#C4E0A0', '#5E8A44'] },
  spring: { g: 'crystal', c: '#8F6BEA', bg: ['#A7C8F0', '#3A4E8A'] },
  hunt: { g: 'paw', c: '#6A4A2A', bg: ['#D2B880', '#6A5430'] },
  board: { g: 'parchment', c: '#EADBB8', bg: ['#B88A5A', '#5A3E22'] },
  guild: { g: 'book', c: '#6B4E8C', bg: ['#C8B6DE', '#4A3A66'] },
  forge: { g: 'anvil', c: '#3A3A42', bg: ['#F09A5A', '#7A2E1C'] },
  workshop: { g: 'hammer', c: '#5A4630', bg: ['#D8C49A', '#6A5A3A'] },
  market: { g: 'tent', c: '#B8442E', bg: ['#F0D8A0', '#9A7A40'] },
  plaza: { g: 'fountain', c: '#7A8A9A', bg: ['#D8E0E8', '#7A8C9E'] },
  tavern: { g: 'mug', c: '#9A6A2A', bg: ['#E8B870', '#7A4A1A'] },
  training: { g: 'dummy', c: '#7A5A3A', bg: ['#D8C8A8', '#6A5A40'] },
  ruins: { g: 'pillar', c: '#8A8478', bg: ['#B8B0C8', '#4A4260'] },
  grove: { g: 'tree', c: '#4A7A3A', bg: ['#B0D090', '#4A6A34'] },
  market2: { g: 'tent', c: '#3A6A9A', bg: ['#E0D0B0', '#8A7A5A'] },
  deepmine: { g: 'pickaxe', c: '#2A2620', bg: ['#6A5E50', '#1A1612'] },
  peddler: { g: 'wagon', c: '#7A5A34', bg: ['#E0C890', '#7A6034'] },
  herb2: { g: 'fog', c: '#E4ECE8', bg: ['#7AAA90', '#2E5A44'] },
  outpost: { g: 'tower', c: '#5A4A3A', bg: ['#C8D0B8', '#5A6A4A'] },
  nest_forest: { g: 'tree', c: '#14261A', bg: ['#3E6A44', '#0E1A10'] },
  nest_cave: { g: 'cave', c: '#2A2430', bg: ['#5A5068', '#120E16'] },
  nest_swamp: { g: 'reeds', c: '#1E3A2A', bg: ['#4E6A4A', '#101A10'] },
  nest_mount: { g: 'mountain', c: '#3A3A48', bg: ['#7A8AA8', '#1A1E2A'] },
  nest_ruins: { g: 'mountain', c: '#4A4438', bg: ['#B0A898', '#2A2620'] },
  nest_plain: { g: 'mountain', c: '#6A4A2A', bg: ['#E4C08A', '#3A2A1A'] },
  lair: { g: 'cave', c: '#2A0E10', bg: ['#8A2A1E', '#14060A'] },
};
/** アクションスペース・巣・主の巣の背景（地形） */
export function TerrainArt({ id, size = 64, label, frame = true }: ArtProps) {
  const t = TERRAIN[id] ?? { g: 'star', c: '#888', bg: ['#666', '#222'] as [string, string] };
  return (
    <Frame size={size} label={label} bg={frame ? t.bg : undefined} rounded={10}>
      <path d="M0 78 Q30 66 60 74 T100 70 L100 100 L0 100Z" fill="#000" opacity=".22" />
      <g transform="translate(22 18) scale(.56)" opacity=".92">{glyph(t.g, t.c, '#ffffff66')}</g>
    </Frame>
  );
}

// ---------------------------------------------------------------- 横長の背景（160×96）。本番の WeatherScene / NestScene と同じ props
type SceneSeason = 'spring' | 'summer' | 'autumn' | 'winter';
const SEASON_HILL: Record<SceneSeason, string> = { spring: '#7FA678', summer: '#4F7A5A', autumn: '#B8774A', winter: '#C4D0DE' };
function Scene({ width = 160, height, label, bg, hill, children }: { width?: number; height?: number; label?: string; bg: [string, string]; hill: string; children: ReactNode }) {
  const gid = 'kds' + useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <svg viewBox="0 0 160 96" width={width} height={height ?? (width * 96) / 160} preserveAspectRatio="xMidYMid slice" role={label ? 'img' : undefined}
      aria-label={label} aria-hidden={label ? undefined : true} style={{ display: 'block' }} data-art="placeholder">
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={bg[0]} /><stop offset="1" stopColor={bg[1]} /></linearGradient></defs>
      <rect width="160" height="96" fill={`url(#${gid})`} />
      <path d="M0 70 Q40 56 80 66 T160 62 L160 96 L0 96Z" fill={hill} opacity=".8" />
      <path d="M0 82 Q50 72 100 80 T160 78 L160 96 L0 96Z" fill="#000" opacity=".25" />
      {children}
    </svg>
  );
}
/** 天候16種の横長の背景（季節で丘の色が変わる） */
export function WeatherScene({ id, season = 'spring', width = 160, height, label }: { id: string; season?: SceneSeason; width?: number; height?: number; label?: string }) {
  const w = WEATHER_ART[id];
  if (!w) return null;
  return <Scene width={width} height={height} label={label} bg={w.bg} hill={SEASON_HILL[season]}>
    {w.extra && <g transform="translate(70 0) scale(.6)" opacity=".9">{glyph(w.extra, '#5B6272', '#000')}</g>}
    <g transform="translate(92 6) scale(.42)">{glyph(w.g, w.c, '#ffffffaa')}</g>
  </Scene>;
}
/** 巣（森・洞窟・沼・山）と主の巣の横長の背景 */
export function NestScene({ id, width = 160, height, label }: { id: string; width?: number; height?: number; label?: string }) {
  const t = TERRAIN[id];
  if (!t) return null;
  return <Scene width={width} height={height} label={label} bg={t.bg} hill={t.c}>
    <g transform="translate(8 20) scale(.6)" opacity=".85">{glyph(t.g, t.c, '#ffffff33')}</g>
    <g transform="translate(100 30) scale(.45)" opacity=".7">{glyph(t.g, t.c, '#ffffff22')}</g>
  </Scene>;
}

// ---------------------------------------------------------------- 演出の絵
export const EFFECT_IDS = [
  'slash', 'fire', 'ice', 'thunder', 'light', 'dark', 'heal', 'shield', 'injury', 'fate-flip', 'loot-drop', 'trophy',
  'raid', 'upkeep', 'weather-change', 'season-change',
  'hit', 'weakness', 'counter', 'spark', 'coin', 'discontent', 'quest-stamp', 'fame', 'wall-block', 'place-ring', 'boss-aura', 'card-glow',
] as const;
export type EffectId = (typeof EFFECT_IDS)[number];
const FX: Record<string, () => ReactElement> = {
  slash: () => glyph('arc', '#FFFFFF', '#fff'),
  fire: () => glyph('flame', EL_COLOR.fire, '#FFD27A'),
  ice: () => <g>{glyph('snow', EL_COLOR.ice, '#fff')}<circle cx="50" cy="50" r="10" fill="#E8F8FF" /></g>,
  thunder: () => glyph('bolt', EL_COLOR.thunder, '#fff'),
  light: () => <g><circle cx="50" cy="50" r="34" fill={EL_COLOR.light} opacity=".35" />{glyph('star', '#FFF6C8', '#fff')}</g>,
  dark: () => <g><circle cx="50" cy="50" r="36" fill={EL_COLOR.dark} opacity=".35" />{glyph('swirl', EL_COLOR.dark, '#000')}</g>,
  heal: () => <g><circle cx="50" cy="50" r="40" fill="#7CE0A0" opacity=".3" />{glyph('cross', '#5ACB86', '#fff')}</g>,
  shield: () => glyph('shield', '#9FB4C8', '#E8F0F8'),
  injury: () => glyph('bandage', '#F2E6D0', '#C8402E'),
  'fate-flip': () => glyph('cards', '#5568B8', '#E8B923'),
  'loot-drop': () => glyph('bag', '#B8864A', '#E8B923'),
  trophy: () => glyph('crest', '#E8B923', '#7A1D1D'),
  raid: () => glyph('claw', '#D8402E', '#000'),
  upkeep: () => glyph('bowl', '#C8853D', '#F3E6D0'),
  'weather-change': () => <g>{glyph('cloud', '#DDE6EE', '#fff')}<g transform="translate(46 46) scale(.5)">{glyph('bolt', '#F2D04B', '#fff')}</g></g>,
  'season-change': () => <g><circle cx="50" cy="50" r="40" fill="none" stroke="#E8B923" strokeWidth="5" strokeDasharray="10 8" />{glyph('leaf', '#E77F9A', '#fff')}</g>,
  hit: () => glyph('burst', '#FFF2C8', '#FF7A3D'),
  weakness: () => glyph('burst', '#FFD84D', '#D8402E'),
  counter: () => glyph('claw', '#FF5A3C', '#000'),
  spark: () => <g fill="#FFC14D">{[0, 45, 90, 135, 180, 225, 270, 315].map((r) => <rect key={r} x="48" y="8" width="4" height="22" rx="2" transform={`rotate(${r} 50 50)`} />)}</g>,
  coin: () => glyph('coin', '#E8B923', '#9A6F00'),
  discontent: () => glyph('mask', '#6A5A7A', '#F2E6D0'),
  'quest-stamp': () => glyph('stamp', '#C8402E', '#C8402E'),
  fame: () => glyph('laurel', '#E8B923', '#FFF2C8'),
  'wall-block': () => <g>{glyph('wall', '#8C8478', '#5A544A')}<g transform="translate(30 10) scale(.4)">{glyph('shield', '#9FB4C8', '#fff')}</g></g>,
  'place-ring': () => glyph('ring', '#FFFFFF', '#fff'),
  'boss-aura': () => <g><circle cx="50" cy="50" r="44" fill="#FF4D3D" opacity=".25" />{glyph('burst', '#FF6A4D', '#2a0000')}</g>,
  'card-glow': () => <rect x="14" y="6" width="72" height="88" rx="10" fill="none" stroke="#FFE29A" strokeWidth="6" />,
};
/** 演出用の絵（攻撃・回復・戦利品など）。動きは使う側の CSS でつける */
export function EffectArt({ id, size = 64 }: { id: string; size?: number }) {
  return <Frame size={size}>{(FX[id] ?? FX.hit)()}</Frame>;
}

/** どの id にどの部品を使うか（画面からはこれを通して絵を引く） */
export function cardArtKind(id: string): 'job' | 'item' | 'unknown' {
  const c = CARDS[id];
  return !c ? 'unknown' : c.kind === 'occ' ? 'job' : 'item';
}
export const placeholderGlyphNames = Object.keys(G);
