import {
  ACT, CHARACTERS, IMPROVEMENTS, JP, WEATHER_BY_ID, SEASON_JP, SEASONS, fenceCost, impCost,
  type Cost, type Opt, type Player,
} from '@midorino/engine';

export const SEAT_COLORS = ['#d9534f', '#3b7dd8', '#e0a526', '#5a9e48', '#8e5cc2', '#e07b39'];
export const costText = (c: Cost) => Object.entries(c).filter(([, n]) => n).map(([r, n]) => `${JP[r as keyof typeof JP]}${n}`).join('・') || 'なし';
export const charName = (id: string) => CHARACTERS[id]?.name ?? id;
export const weatherName = (id: string | null) => (id ? WEATHER_BY_ID[id].name : '？');
export const weatherText = (id: string | null) => (id ? WEATHER_BY_ID[id].text : 'まだわかりません');
export const seasonOf = (round: number) => SEASON_JP[SEASONS[(round - 1) % 4]];
export const yearOf = (round: number) => Math.floor((round - 1) / 4) + 1;

export function optLabel(sid: string, opt: Opt, p: Player): string {
  switch (sid) {
    case 'plow': return `畑を${opt}区画作る`;
    case 'plow2': return '畑を1区画作る';
    case 'sow': { const [g, v] = opt as number[]; return [g && `麦を${g}区画`, v && `野菜を${v}区画`].filter(Boolean).join('・') + 'にまく'; }
    case 'plowsow': {
      const [k, g, v] = opt as number[];
      const a = k ? `畑を${k}区画作り` : '';
      const b = g || v ? [g && `麦${g}`, v && `野菜${v}`].filter(Boolean).join('・') + 'をまく' : 'まかない';
      return a + (a ? '、' : '') + b;
    }
    case 'fence': return `牧場を${opt}区画（木材${fenceCost(p, opt as number)}）`;
    case 'build': return `部屋を${opt}つ増築`;
    case 'workshop': return impLabel(opt as string, p);
    case 'renovate': return opt ? `改築＋${impLabel(opt as string, p)}` : '改築だけする';
    case 'family': case 'family2': return '家族を増やす';
    default: return ACT[sid].name;
  }
}

export function impLabel(id: string, p: Player) {
  if (id === 'okamado_x') return '大かまど（かまどを返して粘土2）';
  return `${IMPROVEMENTS[id].name}（${costText(impCost(p, id))}）`;
}
