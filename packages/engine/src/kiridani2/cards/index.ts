// 霧谷の冒険者団 v2 — カードデータ一式
import type { CardSet } from '../types';
import { LEADERS } from './leaders';
import { OCCUPATIONS } from './occupations';
import { WEAPONS } from './weapons';
import { TOOLS } from './tools';
import { SPELLS } from './spells';
import { GEAR } from './gear';
import { STAGES } from './stages';
import { QUESTS } from './quests';
import { ANCIENT, ANCIENT_SET_FAME } from './ancient';

export { LEADERS, OCCUPATIONS, WEAPONS, TOOLS, SPELLS, GEAR, STAGES, QUESTS, ANCIENT, ANCIENT_SET_FAME };

export const CARD_SET: CardSet = {
  leaders: LEADERS,
  occupations: OCCUPATIONS,
  weapons: WEAPONS,
  tools: TOOLS,
  spells: SPELLS,
  gear: GEAR,
  stages: STAGES,
  quests: QUESTS,
  ancient: ANCIENT,
};
