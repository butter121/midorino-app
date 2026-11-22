// 霧谷の冒険者団 v2 — AI の評価の重み（リーダーごと）。tools/kiridani2/tune.ts が自己対戦で調整して書き出す。
// 値は ai.ts の DEFAULT_W にかける倍率（res は資源ごと、ほかは同じ名前の重み）。載っていないリーダー・項目は 1 倍。
export type WeightMul = { res?: Partial<Record<'wood' | 'iron' | 'herb' | 'mana' | 'food' | 'gold' | 'mat', number>> } & Partial<Record<
  'act' | 'short' | 'inj' | 'perm' | 'defn' | 'wall' | 'hand' | 'played' | 'quest' | 'tag' | 'loop' | 'pet' | 'ancient', number>>;

// 2026-11-22 調整（3人・5年・強いAI、10世代×8候補×12局。検証60局で全員1倍より良かった）
export const LEADER_W: Record<string, WeightMul> = {
  l_akane: {res: {wood: 1.21, iron: 1.01, herb: 0.91, mana: 0.75, food: 1.32, gold: 1.14, mat: 0.85}, act: 2.32, short: 1.32, inj: 0.9, perm: 0.97, defn: 0.95, wall: 1.14, hand: 0.94, played: 1.0, quest: 0.85, tag: 1.26, loop: 1.01, pet: 1.25, ancient: 1.18},
  l_doran: {res: {wood: 0.97, iron: 1.09, herb: 1.17, mana: 0.81, food: 0.98, gold: 0.84, mat: 0.99}, act: 1.94, short: 0.9, inj: 1.01, perm: 0.9, defn: 0.73, wall: 1.05, hand: 0.9, played: 0.96, quest: 1.1, tag: 0.94, loop: 0.48, pet: 0.93, ancient: 0.75},
  l_gareth: {res: {wood: 1.17, iron: 1.16, herb: 0.58, mana: 0.96, food: 1.22, gold: 0.96, mat: 1.08}, act: 2.86, short: 1.05, inj: 1.25, perm: 1.18, defn: 0.8, wall: 1.09, hand: 0.82, played: 0.85, quest: 0.92, tag: 0.88, loop: 1.05, pet: 0.64, ancient: 1.08},
  l_goro: {res: {wood: 1.63, iron: 1.21, herb: 0.84, mana: 1.06, food: 1.26, gold: 1.02, mat: 0.95}, act: 2.06, short: 1.19, inj: 0.9, perm: 0.84, defn: 0.86, wall: 0.88, hand: 0.94, played: 0.89, quest: 1.34, tag: 0.82, loop: 0.91, pet: 1.06, ancient: 0.78},
  l_haru: {res: {wood: 0.95, iron: 0.76, herb: 1.06, mana: 1.52, food: 1.25, gold: 1.07, mat: 1.23}, act: 1.53, short: 0.83, inj: 1.04, perm: 0.57, defn: 0.65, wall: 1.01, hand: 0.76, played: 0.79, quest: 1.35, tag: 0.62, loop: 0.53, pet: 1.13, ancient: 0.84},
  l_iska: {res: {wood: 0.7, iron: 0.86, herb: 0.82, mana: 0.79, food: 1.04, gold: 1.45, mat: 0.95}, act: 1.77, short: 1.11, inj: 0.88, perm: 0.54, defn: 0.95, wall: 1.44, hand: 0.7, played: 1.06, quest: 0.96, tag: 1.14, loop: 0.61, pet: 1.15, ancient: 1.06},
  l_jin: {res: {wood: 0.92, iron: 1.24, herb: 0.93, mana: 0.73, food: 1.99, gold: 1.3, mat: 1.04}, act: 2.39, short: 1.1, inj: 1.02, perm: 1.24, defn: 1.12, wall: 1.08, hand: 1.13, played: 0.92, quest: 0.83, tag: 1.08, loop: 0.63, pet: 1.6, ancient: 1.39},
  l_kai: {res: {wood: 1.14, iron: 0.69, herb: 0.75, mana: 0.99, food: 1.02, gold: 1.14, mat: 1.0}, act: 1.7, short: 0.86, inj: 1.38, perm: 0.46, defn: 1.04, wall: 0.87, hand: 0.63, played: 1.53, quest: 1.52, tag: 1.54, loop: 0.8, pet: 0.85, ancient: 1.27},
  l_mina: {res: {wood: 0.98, iron: 0.79, herb: 1.24, mana: 1.28, food: 1.96, gold: 1.32, mat: 0.97}, act: 2.86, short: 1.21, inj: 1.21, perm: 0.8, defn: 0.89, wall: 1.23, hand: 0.64, played: 1.14, quest: 0.97, tag: 1.44, loop: 0.94, pet: 0.72, ancient: 0.96},
  l_miro: {res: {wood: 1.06, iron: 0.89, herb: 1.07, mana: 0.9, food: 1.52, gold: 1.51, mat: 1.26}, act: 1.87, short: 1.08, inj: 0.81, perm: 0.49, defn: 0.98, wall: 1.2, hand: 0.79, played: 1.14, quest: 0.88, tag: 1.33, loop: 0.68, pet: 0.72, ancient: 0.81},
  l_momo: {res: {wood: 1.72, iron: 1.07, herb: 0.97, mana: 0.78, food: 0.99, gold: 1.25, mat: 0.8}, act: 2.04, short: 0.81, inj: 1.18, perm: 0.5, defn: 0.78, wall: 1.0, hand: 0.93, played: 1.12, quest: 1.0, tag: 1.18, loop: 0.74, pet: 1.11, ancient: 1.14},
  l_popo: {res: {wood: 1.2, iron: 0.94, herb: 0.79, mana: 1.42, food: 0.92, gold: 1.51, mat: 0.69}, act: 1.37, short: 1.14, inj: 0.94, perm: 0.57, defn: 0.85, wall: 0.91, hand: 0.69, played: 1.08, quest: 0.87, tag: 0.73, loop: 0.82, pet: 0.86, ancient: 0.89},
};
