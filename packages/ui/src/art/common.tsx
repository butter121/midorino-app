// イラスト共通の線・色（オリジナル画風：太めのやわらかい線＋平面塗り）
export const INK = '#2B3A3A';
type Stroke = { stroke: string; strokeWidth: number; strokeLinejoin: 'round'; strokeLinecap: 'round'; fill?: string };
export const O: Stroke = { stroke: INK, strokeWidth: 3, strokeLinejoin: 'round', strokeLinecap: 'round' };
/** 塗りなしの線 */
export const L: Stroke = { ...O, fill: 'none', strokeWidth: 2.4 };

export const C = {
  skin: ['#F6D2B5', '#EFC3A0', '#D9A27A', '#F9DCC4'],
  wood: '#C98A4B', woodD: '#8C5E3C', woodL: '#F2C98F',
  clay: '#D9774B', clayD: '#B85A33',
  stone: '#B4BDC2', stoneD: '#8E989E',
  leaf: '#5DA36A', leafD: '#2F6B4F', leafL: '#A9D67B',
  gold: '#F2C14E', cream: '#F4E6C8', paper: '#FFFDF7', red: '#C2553E',
  sky: '#DDF2F6', water: '#7EC4DA', pink: '#F6A7BB',
};
