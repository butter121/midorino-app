// 霧谷の冒険者団 v2 — 使い魔（魔物48種それぞれの固有の効果）。id は pet_<魔物の型>。
// 巣の魔物を「捕まえる」で戦って勝つ（強さ＋格ごとの捕まえにくさ）か、捕まえる効果で使い魔にする。食料＝強さ÷4（切り上げ）。
// 使い魔の戦力＝捕まえたときの強さ÷4（切り上げ）。戦闘に連れて行くのは1体（効果で増える）。fight の効果は連れて行った使い魔だけ、
// それ以外の効果は持っている間ずっと効く。持てるのは3体まで（超えたら弱い使い魔を放す）。
import type { CardDef, EngineTag } from '../types';
import { MONSTERS } from '../data';
import { fight, win, hit, on, passive, powPer } from './mk';
import type { Effect } from '../types';
import { withText } from './text';

const E: Record<string, [EngineTag[], Effect[]]> = {
  rat: [['family'], [on('round_start', [{ gain: { food: 1 } }])]],
  imp: [['arcane'], [on('spell', [{ gain: { herb: 1 } }], undefined, 'round')]],
  boar: [['hunt'], [fight([{ power: 2 }])]],
  skel: [['fort'], [fight([{ guard: 1 }])]],
  slime: [['gather'], [on('injure', [{ gain: { herb: 1 } }])]],
  wolf: [['hunt', 'ally'], [fight([{ power: 2 }], { k_min: 2 })]],
  goblin: [['trade'], [win([{ gain: { gold: 1 } }], undefined, 'round')]],
  bat: [['hunt'], [win([{ loot: 1 }], undefined, 'round')]],
  wisp: [['arcane'], [on('round_start', [{ gain: { mana: 1 } }])]],
  spider: [['fort'], [fight([{ counter: -1 }])]],
  frog: [['gather'], [on('use:meadow', [{ gain: { herb: 1 } }])]],
  golem: [['fort'], [fight([{ guard: 2 }])]],
  ghoul: [['smith'], [win([{ gain: { mat: 1 } }], undefined, 'round')]],
  harpy: [['trade'], [on('sell', [{ gain: { gold: 1 } }], undefined, 'round')]],
  ogre: [['hunt'], [fight([{ power: 3 }]), passive({ upkeep: 1 })]],
  wraith: [['boss'], [fight([{ str: -1 }])]],
  salam: [['smith'], [on('use:forge', [{ gain: { iron: 1 } }])]],
  bandit: [['trade'], [on('round_start', [{ gain: { gold: 1 } }])]],
  treant: [['gather'], [on('use:forest', [{ gain: { wood: 2 } }])]],
  icewolf: [['hunt'], [fight([{ counter: -1 }, { power: 1 }])]],
  wyvern: [['boss'], [fight([{ power: 3 }], { boss: true })]],
  lich: [['arcane'], [on('spell', [{ gain: { mana: 1 } }], undefined, 'round')]],
  troll: [['boss'], [fight([{ no_injury: 1 }])]],
  basil: [['fort'], [fight([{ counter: -2 }])]],
  elem: [['arcane'], [fight([powPer('casts_round', 1, 1, 2)])]],
  knight: [['hunt', 'fort'], [fight([{ power: 2 }, { guard: 1 }])]],
  manti: [['hunt'], [win([{ trophy: 1 }], undefined, 'year')]],
  witch: [['gather', 'arcane'], [on('round_start', [{ gain: { herb: 1 } }])]],
  hydra: [['beast'], [fight([powPer('pets', 1, 1, 3)])]],
  shade: [['hunt'], [fight([{ power: 3 }], { k_max: 1 })]],
  mole: [['gather'], [on('use:mine', [{ gain: { iron: 1 } }])]],
  owl: [['ruins'], [passive({ ancient_look: 1 })]],
  mushroom: [['family'], [on('winter', [{ gain: { food: 2 } }])]],
  scarecrow: [['fort'], [passive({ base_guard: 1 })]],
  kobold: [['trade', 'gather'], [on('use:mine', [{ gain: { gold: 1 } }])]],
  stag: [['family'], [on('use:hunt', [{ gain: { food: 2 } }])]],
  crab: [['fort'], [hit([{ gain: { mat: 1 } }], undefined, 'round')]],
  mimic: [['ruins'], [win([{ shard: 1 }], undefined, 'year')]],
  banshee: [['boss'], [on('injure', [{ fame: 1 }], undefined, 'round')]],
  lizardman: [['ally', 'trade'], [on('trade', [{ gain: { gold: 1 } }])]],
  drake: [['hunt'], [fight([{ power: 2 }])]],
  wasp: [['ally'], [fight([{ power: 3 }], { k_min: 3 })]],
  bear: [['hunt'], [fight([{ power: 3 }])]],
  scorpion: [['boss'], [fight([{ str: -2 }])]],
  gargoyle: [['fort', 'ruins'], [fight([{ guard: 2 }]), passive({ shard_need: 1 })]],
  mummy: [['ruins'], [on('round_start', [{ shard: 1 }], undefined, 'year')]],
  orcchief: [['hunt', 'family'], [fight([powPer('sent_k', 1, 1, 3)])]],
  wyrmling: [['arcane', 'hunt'], [fight([{ power: 2 }], { min: { casts_round: 1 } }), win([{ gain: { mana: 1 } }], undefined, 'round')]],
};

export const PETS: CardDef[] = withText(MONSTERS.map((m) => {
  const [engine, effects] = E[m.id] ?? [['beast'], []];
  return { id: `pet_${m.id}`, kind: 'pet', name: `使い魔：${m.name}`, engine: ['beast', ...engine.filter((t) => t !== 'beast')] as EngineTag[], mech: 'combat', effects, text: '' } as CardDef;
}));
