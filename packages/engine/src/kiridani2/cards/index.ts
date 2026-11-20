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
import { ANCIENT, ANCIENT_SET_FAME } from './ancient';

export { LEADERS, OCCUPATIONS, WEAPONS, ARMORS, TOOLS, SPELLS, PETS, GEAR, STAGES, QUESTS, ANCIENT, ANCIENT_SET_FAME };

export const CARD_SET: CardSet = {
  leaders: LEADERS,
  occupations: OCCUPATIONS,
  weapons: WEAPONS,
  armors: ARMORS,
  tools: TOOLS,
  spells: SPELLS,
  // 使い魔のカードは使わない（前の仕組みに戻した：使い魔は1体につき戦力+1）
  pets: [],
  gear: GEAR,
  stages: STAGES,
  quests: QUESTS,
  ancient: ANCIENT,
};
