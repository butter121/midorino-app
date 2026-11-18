// 霧谷の冒険者団 v2 — 画面（v1 の部品・見た目を使い、v2 のエンジンにつなぐ）
// 使い方：import '@midorino/ui/src/kiridani/kiridani.css'; import '@midorino/ui/src/kiridani2/kiridani2.css';
export * from './view';
export { useTable2, type TablePlayer2, type Playing2 } from './useTable2';
export { Kiridani2Table, Board2, BaseView2, QuestsView2, Everyone2, CombatPanel2, WinterPanel2, FinalScoring2, CardPickScreen, RatioScreen, type Ask2 } from './table2';
export { CardFace2, CardChip2, MonsterCard2, LeaderArt, YearsCtx, endFameNote } from './parts2';
export { uiFor2, useSeat2, FightTray2 } from './seat';
export { Kiridani2EngineGame, ENGINE2_NAMES, type Engine2GameProps } from './play2';
export { Kiridani2OnlineGame, type Online2GameProps } from './online2';
