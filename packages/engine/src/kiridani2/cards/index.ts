// 霧谷の冒険者団 v2 — カードデータ一式
import type { CardSet } from '../types';
import { LEADERS } from './leaders';
import { OCCUPATIONS } from './occupations';
import { WEAPONS } from './weapons';
import { ARMORS } from './armors';
import { TOOLS } from './tools';
import { SPELLS } from './spells';
import { PETS } from './pets';
import { GEAR } from './gear';
import { STAGES } from './stages';
import { QUESTS } from './quests';
import { ANCIENT } from './ancient';
import { LIST_OCCUPATIONS, LIST_WEAPONS, LIST_ARMORS, LIST_TOOLS, LIST_SPELLS } from './list300';

export { LEADERS, OCCUPATIONS, WEAPONS, ARMORS, TOOLS, SPELLS, PETS, GEAR, STAGES, QUESTS, ANCIENT };

export const CARD_SET: CardSet = {
  leaders: LEADERS,
  // 職能・品物は K さんのリストの300枚（cards/list300.ts）。前のカード（occupations.ts など）は残してあるが使わない
  occupations: LIST_OCCUPATIONS,
  weapons: LIST_WEAPONS,
  armors: LIST_ARMORS,
  tools: LIST_TOOLS,
  spells: LIST_SPELLS,
  // 使い魔のカードは使わない（前の仕組みに戻した：使い魔は1体につき戦力+1）
  pets: [],
  gear: GEAR,
  stages: STAGES,
  quests: QUESTS,
  ancient: ANCIENT,
};
