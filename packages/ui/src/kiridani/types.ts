// 霧谷の冒険者団 — 画面とエンジンの約束（表示用の状態 GameView と、出来事の列 GameEvent）
//
// エンジン（後で TypeScript に移植される）は「起きたこと」を GameEvent の列として流すだけでよい。
// 画面は applyEvent(view, ev) で GameView を1つずつ進め、そのたびに演出を再生する。
// 数値（何を得た・いくつ払った・戦力の内訳）はすべてイベントに載せ、画面側ではルールを計算しない。
import type { Cost, Element, Res, Season } from './data';

export type Seat = number;
export type DraftKind = 'occ' | 'item';

export interface CompanionView {
  id: string;
  /** 団長（最初の1人） */
  leader?: boolean;
  /** 負傷：次のラウンドは働けない（薬草1で回復） */
  injured: boolean;
  /** 熟練（0〜2、職能で上限+1） */
  skill: number;
  /** いま置かれている場所（スペースか巣の id）。拠点にいるなら undefined */
  at?: string;
}

export interface PlayerView {
  seat: Seat;
  name: string;
  character?: string;
  /** キャラ選択で配られた2枚 */
  charOptions?: string[];
  fame: number;
  res: Record<Res, number>;
  companions: CompanionView[];
  beds: number;
  walls: number;
  /** 拠点に置いた道具カード（施設） */
  facilities: string[];
  /** 装備した武具 */
  weapons: string[];
  /** 出した職能 */
  occupations: string[];
  /** 手札。自分以外は中身が見えないので '?' が入る */
  hand: string[];
  /** 使った秘術 */
  spellsUsed: string[];
  /** 倒した魔物（討伐の証） */
  trophies: string[];
  /** 使い魔にした魔物 */
  familiars: string[];
  /** 不満カードの枚数（1枚 -3 名声） */
  discontent: number;
  /** 運命カードの山の残り（全員に公開） */
  fateLeft: number[];
  /** 運命カードのめくった札 */
  fateUsed: number[];
  /** 達成した依頼 */
  quests: string[];
}

export interface SpaceState {
  id: string;
  /** たまっている資源 */
  stock: Cost;
  occupants: Seat[];
  open: boolean;
}

export interface NestState {
  id: string;
  monster?: string;
  /** 魔物に残っている傷（後の人が横取りできる） */
  wounds: number;
  occupants: Seat[];
  trap?: boolean;
  /** 次のラウンドに現れる魔物（影で見える） */
  next?: string;
}

export interface LairState {
  /** 今年の主（決まっていれば） */
  boss?: string;
  /** 候補（春に予告） */
  candidates: string[];
  /** 主の出るラウンド */
  round?: number;
  wounds: number;
  occupants: Seat[];
  defeated?: boolean;
}

export type PowerKind = 'companion' | 'skill' | 'weapon' | 'occ' | 'spell' | 'supply' | 'familiar' | 'weakness' | 'tide' | 'weather' | 'trap' | 'coop' | 'char';

export interface PowerPart {
  kind: PowerKind;
  label: string;
  value: number;
  seat?: Seat;
  /** カード・魔物などの id（絵を出すため） */
  ref?: string;
  el?: Element;
}

export interface CombatView {
  nest: string;
  monster: string;
  boss: boolean;
  seats: Seat[];
  strength: number;
  /** 前の挑戦で残った傷 */
  wounds: number;
  parts: PowerPart[];
  fate?: { seat: Seat; value: number; values?: number[] };
  total?: number;
  result?: 'win' | 'lose';
  counter?: { amount: number; defense: number };
  injured: { seat: Seat; companion: string }[];
  loot?: Cost;
  trophy?: number;
}

export interface WinterView {
  upkeep: { seat: Seat; need: number; paid: number; discontent: number }[];
  raids: { seat: Seat; monster: string; damage: number; blocked: number; lost: Cost }[];
}

export interface ScoreItem { key: string; label: string; fame: number }
export interface ScoreRow { seat: Seat; items: ScoreItem[]; total: number; rank: number }

export interface DraftView {
  kind: DraftKind;
  lap: number;
  /** 席ごとに見えている3枚（自分以外は空の配列でよい） */
  offers: Record<Seat, string[]>;
  /** このラウンドで取った札（自分以外は '?'） */
  picked: Record<Seat, string | undefined>;
}

export type Phase = 'setup' | 'draft' | 'character' | 'play' | 'final';

export interface GameView {
  phase: Phase;
  /** 自分の席（観戦は -1） */
  me: Seat;
  round: number;
  season: Season;
  tide: Element;
  weather?: string;
  /** これからの天候（先の分だけ） */
  forecast: string[];
  spaceOrder: string[];
  spaces: Record<string, SpaceState>;
  nests: NestState[];
  lair: LairState;
  players: PlayerView[];
  first: Seat;
  turn?: Seat;
  /** 公開中の依頼と達成者（達成順） */
  quests: { id: string; doneBy: Seat[] }[];
  market: Cost;
  draft?: DraftView;
  combat?: CombatView;
  winter?: WinterView;
  final?: ScoreRow[];
  /** 新しい順の短い記録 */
  log: string[];
}

// ---------------------------------------------------------------- 出来事
export type GameEvent =
  | { t: 'game_start'; players: { seat: Seat; name: string }[]; me: Seat; quests: string[]; spaces: string[]; nests: string[]; market: Cost }
  | { t: 'draft_offer'; kind: DraftKind; lap: number; offers: Record<Seat, string[]> }
  | { t: 'draft_pick'; seat: Seat; kind: DraftKind; card: string }
  | { t: 'grant'; seat: Seat; gain: Cost; reason: string }
  | { t: 'fate_shuffle'; seat: Seat; deck: number[] }
  | { t: 'char_offer'; offers: Record<Seat, string[]> }
  | { t: 'char_pick'; seat: Seat; char: string }
  | { t: 'round_start'; round: number; season: Season; tide: Element; first: Seat; seasonChanged: boolean }
  | { t: 'weather'; weather: string; forecast: string[] }
  | { t: 'boss_reveal'; candidates: string[]; boss?: string; round: number }
  | { t: 'monster_spawn'; nest: string; monster: string; next?: string }
  | { t: 'monster_leave'; nest: string }
  | { t: 'refill'; adds: Record<string, Cost> }
  | { t: 'recover'; seat: Seat; companion: string }
  | { t: 'turn'; seat: Seat }
  | { t: 'place'; seat: Seat; space: string; companion: string }
  | { t: 'gather'; seat: Seat; space: string; gain: Cost }
  | { t: 'pay'; seat: Seat; cost: Cost; space?: string }
  | { t: 'play_card'; seat: Seat; card: string }
  | { t: 'spell'; seat: Seat; card: string; el?: Element }
  | { t: 'build'; seat: Seat; kind: 'bed' | 'wall' }
  | { t: 'hire'; seat: Seat; companion: string }
  | { t: 'train'; seat: Seat; companion: string }
  | { t: 'market'; seat: Seat; buy: Cost; sell: Cost; gold: number; prices: Cost }
  | { t: 'draw'; seat: Seat; card: string; from: 'ruins' | 'boss' }
  | { t: 'combat_start'; nest: string; monster: string; seats: Seat[]; strength: number; wounds: number; boss: boolean }
  | { t: 'power'; parts: PowerPart[] }
  | { t: 'fate_flip'; seat: Seat; value: number; values?: number[] }
  | { t: 'clash'; total: number; strength: number; result: 'win' | 'lose'; el?: Element }
  | { t: 'hit'; amount: number }
  | { t: 'counter'; amount: number; defense: number }
  | { t: 'injury'; seat: Seat; companion: string }
  | { t: 'heal'; seat: Seat; companion: string; cost?: Cost }
  | { t: 'loot'; seat: Seat; gain: Cost }
  | { t: 'trophy'; seat: Seat; monster: string; fame: number }
  | { t: 'combat_end' }
  | { t: 'produce'; seat: Seat; facility: string; gain: Cost }
  | { t: 'winter_start' }
  | { t: 'upkeep'; seat: Seat; need: number; paid: number; discontent: number }
  | { t: 'raid'; seat: Seat; monster: string; nest: string; damage: number; blocked: number; lost: Cost }
  | { t: 'winter_end' }
  | { t: 'boss_appear'; boss: string }
  | { t: 'dragon_fail'; fame: number }
  | { t: 'quest_done'; quest: string; seat: Seat; fame: number }
  | { t: 'fame'; seat: Seat; amount: number; reason: string }
  | { t: 'market_reset'; market: Cost }
  | { t: 'round_end' }
  | { t: 'first_pass'; seat: Seat }
  | { t: 'score'; rows: ScoreRow[] }
  | { t: 'game_end' };

export type EventType = GameEvent['t'];
export type EventOf<T extends EventType> = Extract<GameEvent, { t: T }>;

/** 出来事の中の「誰の」席。自分に関係するかの判断に使う */
export function eventSeat(ev: GameEvent): Seat | undefined {
  return 'seat' in ev ? ev.seat : undefined;
}
