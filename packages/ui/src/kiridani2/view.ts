// 霧谷 v2 — 出来事を1つずつ画面の状態（View2）に当てる純粋関数。ルールの計算はしない（数値は出来事と「合わせ」が運ぶ）。
import { CARD_SET, DATA, RES, type Cost, type GameEvent, type Monster, type Res, type ScoreRow, type Season } from '@midorino/engine/src/kiridani2';
import type { NetEvent } from '@midorino/engine/src/kiridani2/net';

export type Seat = number;
export type Ev = NetEvent;

export interface CompView { atk: number; def: number; weapon: string | null; armor: string | null; leader: boolean; injured: boolean; rest: boolean; at?: string }
export interface PV2 {
  seat: Seat; name: string; leader?: string; fame: number; res: Record<Res, number>;
  beds: number; walls: number; tools: string[]; occs: string[]; items: string[]; hand: string[]; ancient: string[];
  comps: CompView[]; pets: number; trophies: string[]; discontent: number; raidLoss: number; quests: string[];
  secret?: string; ratio?: Record<string, number>; spellsUsed: string[];
}
export interface SpaceView2 { id: string; stock: Cost; occupants: Seat[]; stage?: number }
export interface NestView2 { id: string; mon?: Monster; occupants: Seat[]; wait?: Seat }
export interface CombatView2 { nest: string; monster: Monster; seats: Seat[]; mode: string; parts: { kind: string; label: string; value: number; ref?: string }[]; total?: number; fate?: number; strength?: number; result?: 'win' | 'lose'; counter?: { amount: number; defense: number }; injured: { seat: Seat; companion: number }[]; loot?: Cost; trophy?: number }
export interface SetupView { step: string; seat?: Seat; cards?: string[]; kind?: string }
export interface View2 {
  phase: 'title' | 'setup' | 'play' | 'final';
  me: Seat; years: number; rounds: number; round: number; year: number; season: Season; progress: number; first: Seat; turn?: Seat;
  spaceOrder: string[]; spaces: Record<string, SpaceView2>; stages: string[];
  nests: NestView2[]; lair: { boss?: Monster; round?: number; occupants: Seat[]; defeated?: boolean };
  forecast: Monster[]; bosses: { round: number; boss: Monster }[];
  quests: { id: string; doneBy: Seat[] }[];
  players: PV2[]; combat?: CombatView2; winter?: { upkeep: { seat: Seat; need: number; paid: number; discontent: number }[]; raids: { seat: Seat; damage: number; blocked: number }[] };
  setup?: SetupView; final?: ScoreRow[]; log: string[];
  /** 名声の移り変わり（グラフ用）。round 0 は始まり、1..rounds は各ラウンドの終わり（冬越し・依頼のあと）。集計後の値は final の total */
  fameHist: FamePoint[];
  /** いまのラウンドの点をまだ動かしてよいか（ラウンドの終わりで閉じる） */
  histOpen?: boolean;
}
/** グラフの1点：そのラウンドの終わりの全員の名声 */
export interface FamePoint { round: number; year: number; season: Season; fame: number[] }

export const RES_JP = DATA.RES_JP;
export const SEASON_JP: Record<Season, string> = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' };
export const NEST_JP = DATA.NEST_JP;
const ALL = [...CARD_SET.leaders, ...CARD_SET.occupations, ...CARD_SET.weapons, ...CARD_SET.tools, ...CARD_SET.spells, ...CARD_SET.gear, ...CARD_SET.stages];
export const CARD2 = Object.fromEntries(ALL.map((c) => [c.id, c])) as Record<string, (typeof ALL)[number]>;
export const QUEST2 = Object.fromEntries(CARD_SET.quests.map((q) => [q.id, q]));
export const ANC2 = Object.fromEntries(CARD_SET.ancient.map((a) => [a.id, a]));
export const cardName = (id: string) => CARD2[id]?.name ?? ANC2[id]?.name ?? QUEST2[id]?.name ?? '？';
export const placeName = (id: string) => DATA.SPACE[id]?.name ?? CARD2[id]?.name ?? NEST_JP[id] ?? id;
export const costText = (c: Cost | undefined) => RES.filter((r) => c?.[r]).map((r) => `${RES_JP[r]}${c![r]}`).join('・');

export const emptyRes = (): Record<Res, number> => Object.fromEntries(RES.map((r) => [r, 0])) as Record<Res, number>;

export function initialView2(me: Seat = 0): View2 {
  return {
    phase: 'title', me, years: 5, rounds: 20, round: 0, year: 0, season: 'spring', progress: 0, first: 0, spaceOrder: [], spaces: {}, stages: [],
    nests: [], lair: { occupants: [] }, forecast: [], bosses: [], quests: [], players: [], log: [], fameHist: [],
  };
}

const newComp = (leader: boolean): CompView => ({ atk: 0, def: 0, weapon: null, armor: null, leader, injured: false, rest: false });
function newPlayer(seat: Seat, name: string): PV2 {
  return {
    seat, name, fame: 0, res: emptyRes(), beds: DATA.START.beds, walls: 0, tools: [], occs: [], items: [], hand: [], ancient: [],
    comps: [newComp(true), newComp(false)], pets: 0, trophies: [], discontent: 0, raidLoss: 0, quests: [], spellsUsed: [],
  };
}

const add = (to: Record<Res, number>, c: Cost, sign = 1) => { for (const [r, n] of Object.entries(c)) if (r in to) to[r as Res] = Math.max(0, to[r as Res] + sign * (n ?? 0)); };
const who = (v: View2, s: Seat) => (s === v.me ? 'あなた' : v.players[s]?.name ?? `席${s + 1}`);
const KIND_JP: Record<string, string> = { occ: '職能', weapon: '武具', tool: '道具', spell: '秘術', item: '品物', ancient: '古代の品' };

/** v を壊さずに次の状態を返す */
export function applyEvent2(v0: View2, ev: Ev): View2 {
  const v: View2 = structuredClone(v0);
  const log = (s: string) => { v.log = [s, ...v.log].slice(0, 60); };
  const P = (s: Seat) => v.players[s];
  const dropHand = (p: PV2, card: string) => { const i = p.hand.indexOf(card); if (i >= 0) p.hand.splice(i, 1); else { const j = p.hand.indexOf('?'); if (j >= 0) p.hand.splice(j, 1); } };
  const target = (id: string) => v.spaces[id] ?? v.nests.find((n) => n.id === id) ?? (id === 'lair' ? v.lair : undefined);
  switch (ev.t) {
    case 'sync':
      ev.res.forEach((r, i) => { if (v.players[i]) v.players[i].res = { ...emptyRes(), ...r }; });
      ev.fame.forEach((f, i) => { if (v.players[i] && v.phase !== 'final') v.players[i].fame = f; });
      break;
    case 'game_start':
      v.me = ev.me; v.years = ev.years; v.rounds = ev.rounds; v.phase = 'setup';
      v.players = ev.players.map((p) => newPlayer(p.seat, p.name));
      v.quests = ev.quests.map((id) => ({ id, doneBy: [] }));
      v.spaceOrder = [...ev.spaces];
      v.spaces = Object.fromEntries(ev.spaces.map((id) => [id, { id, stock: {}, occupants: [] }]));
      v.nests = ev.nests.map((id) => ({ id, occupants: [] }));
      v.setup = { step: 'leader' };
      log(`${ev.players.length}人・${ev.years}年（${ev.rounds}ラウンド）の冒険が始まる`);
      break;
    case 'leader_offer': v.setup = { step: 'leader', seat: ev.seat, cards: ev.cards }; break;
    case 'leader_pick': P(ev.seat).leader = ev.card; log(`${who(v, ev.seat)}のリーダーは${cardName(ev.card)}`); break;
    case 'draft_offer': v.setup = { step: v.round ? 'refill' : 'draft', seat: ev.seat, cards: ev.cards, kind: ev.kind }; break;
    case 'draft_pick': {
      const p = P(ev.seat);
      p.hand.push(ev.card);
      if (ev.seat === v.me) log(`${KIND_JP[ev.kind] ?? ''}「${cardName(ev.card)}」を手札に`);
      break;
    }
    case 'ratio': P(ev.seat).ratio = ev.ratio; break;
    case 'secret_quest': P(ev.seat).secret = ev.quest; if (ev.seat === v.me) log(`秘密依頼「${QUEST2[ev.quest]?.name ?? '？'}」`); break;
    case 'grant': case 'future': case 'gain': add(P(ev.seat).res, ev.gain); break;
    case 'pay': add(P(ev.seat).res, ev.cost, -1); break;
    case 'round_start':
      v.phase = 'play'; v.setup = undefined;
      v.round = ev.round; v.year = ev.year; v.season = ev.season; v.progress = ev.progress; v.first = ev.first; v.turn = undefined;
      for (const s of Object.values(v.spaces)) s.occupants = [];
      for (const n of v.nests) { n.occupants = []; n.wait = undefined; }
      v.lair.occupants = [];
      if (v.lair.round !== undefined && v.lair.round < ev.round) v.lair = { occupants: [] };
      for (const p of v.players) for (const c of p.comps) c.at = undefined;
      log(`ラウンド${ev.round}・${ev.year}年目の${SEASON_JP[ev.season]}`);
      if (!v.fameHist.length) v.fameHist.push({ round: 0, year: 1, season: 'spring', fame: v.players.map((p) => p.fame) });
      v.fameHist = [...v.fameHist.filter((x) => x.round < ev.round), { round: ev.round, year: ev.year, season: ev.season, fame: [] }];
      v.histOpen = true;
      break;
    case 'stage_reveal':
      if (!v.spaces[ev.card]) { v.spaces[ev.card] = { id: ev.card, stock: {}, occupants: [], stage: ev.stage }; v.spaceOrder.push(ev.card); v.stages.push(ev.card); }
      log(`新しい場所「${cardName(ev.card)}」（段階${ev.stage}）`);
      break;
    case 'refill':
      for (const [id, c] of Object.entries(ev.adds)) {
        const s = v.spaces[id]; if (!s) continue;
        for (const [r, n] of Object.entries(c)) s.stock[r as Res] = (s.stock[r as Res] ?? 0) + (n ?? 0);
      }
      break;
    case 'equip': { const c = P(ev.seat).comps[ev.companion]; if (c) c[ev.slot] = ev.card; break; }
    case 'monster_spawn': { const n = v.nests.find((x) => x.id === ev.nest); if (n) n.mon = ev.monster; log(`${NEST_JP[ev.nest] ?? ev.nest}に${ev.monster.name}（強さ${ev.monster.str}）`); break; }
    case 'monster_forecast': v.forecast = ev.monsters; break;
    case 'boss_reveal':
      v.bosses = [...v.bosses.filter((b) => b.round !== ev.round), { round: ev.round, boss: ev.boss }].sort((a, b) => a.round - b.round);
      v.lair = { boss: ev.boss, round: ev.round, occupants: [] };
      log(`主の予告：${ev.boss.name}（強さ${ev.boss.str}・R${ev.round}）`);
      break;
    case 'turn': v.turn = ev.seat; break;
    case 'place': {
      const p = P(ev.seat);
      const idxs = ev.companions.length ? ev.companions : [p.comps.findIndex((c) => !c.at && !c.rest)];
      for (const i of idxs) if (p.comps[i]) p.comps[i].at = ev.space;
      const t = target(ev.space);
      if (t) t.occupants.push(ev.seat);
      log(`${who(v, ev.seat)}→${placeName(ev.space)}`);
      break;
    }
    case 'wait': { const n = v.nests.find((x) => x.id === ev.nest); if (n) n.wait = ev.seat; log(`${who(v, ev.seat)}が${placeName(ev.nest)}で共闘を待つ`); break; }
    case 'gather': {
      const s = v.spaces[ev.space];
      if (s) s.stock = {};
      add(P(ev.seat).res, ev.gain);
      break;
    }
    case 'effect': if (ev.seat === v.me) log(`${cardName(ev.card)}の効果`); break;
    case 'play_card': {
      const p = P(ev.seat), c = CARD2[ev.card];
      dropHand(p, ev.card);
      if (c?.kind === 'occ' && !p.occs.includes(ev.card)) p.occs.push(ev.card);
      if (c && c.kind !== 'occ' && c.fame) p.fame += c.fame;
      if (c?.kind === 'occ' && c.fame) p.fame += c.fame;
      log(`${who(v, ev.seat)}が${cardName(ev.card)}を出した`);
      break;
    }
    case 'spell': { const p = P(ev.seat); dropHand(p, ev.card); p.spellsUsed.push(ev.card); log(`${who(v, ev.seat)}が秘術「${cardName(ev.card)}」`); break; }
    case 'craft': { const p = P(ev.seat); if (!p.items.includes(ev.card) || CARD2[ev.card]?.kind === 'gear') p.items.push(ev.card); log(`${who(v, ev.seat)}が${cardName(ev.card)}を作った`); break; }
    case 'build': {
      const p = P(ev.seat);
      if (ev.kind === 'bed') p.beds += 1; else if (ev.kind === 'wall') p.walls += 1; else if (ev.card && !p.tools.includes(ev.card)) p.tools.push(ev.card);
      log(`${who(v, ev.seat)}が${ev.kind === 'bed' ? '寝床' : ev.kind === 'wall' ? '防壁' : cardName(ev.card ?? '')}を建てた`);
      break;
    }
    case 'hire': { const p = P(ev.seat); while (p.comps.length <= ev.companion) p.comps.push(newComp(false)); log(`${who(v, ev.seat)}の仲間が増えた`); break; }
    case 'train': { const c = P(ev.seat).comps[ev.companion]; if (c) c[ev.stat] += 1; break; }
    case 'market': {
      const p = P(ev.seat);
      if (ev.kind === 'buy') { p.res.gold = Math.max(0, p.res.gold - ev.gold); if ((RES as string[]).includes(ev.res)) p.res[ev.res as Res] += ev.qty; }
      else {
        p.res.gold += ev.gold;
        if ((RES as string[]).includes(ev.res)) p.res[ev.res as Res] = Math.max(0, p.res[ev.res as Res] - ev.qty);
        else { const i = p.items.indexOf(ev.res); if (i >= 0) p.items.splice(i, 1); }
      }
      log(`${who(v, ev.seat)}が${(RES as string[]).includes(ev.res) ? RES_JP[ev.res as Res] : cardName(ev.res)}を${ev.qty}つ${ev.kind === 'buy' ? '買った' : '売った'}`);
      break;
    }
    case 'trade':
      add(P(ev.a).res, ev.give, -1); add(P(ev.a).res, ev.get);
      add(P(ev.b).res, ev.give); add(P(ev.b).res, ev.get, -1);
      log(`${who(v, ev.a)}と${who(v, ev.b)}が取引（${costText(ev.give)} ⇄ ${costText(ev.get)}）`);
      break;
    case 'donate': { const p = P(ev.seat); add(p.res, ev.cost, -1); p.fame += ev.fame; log(`${who(v, ev.seat)}が寄進（名声+${ev.fame}）`); break; }
    case 'draw': {
      const p = P(ev.seat);
      if (ev.from === 'ancient') p.ancient.push(ev.card); else p.hand.push(ev.card);
      break;
    }
    case 'combat_start':
      v.combat = { nest: ev.nest || (v.nests.find((n) => n.mon?.uid === ev.monster.uid)?.id ?? ''), monster: ev.monster, seats: ev.seats, mode: ev.mode, parts: [], injured: [] };
      break;
    case 'power': if (v.combat) { v.combat.parts = ev.parts; v.combat.total = ev.total; } break;
    case 'fate_flip': if (v.combat) { v.combat.fate = (v.combat.fate ?? 0) + ev.value; v.combat.total = (v.combat.total ?? 0) + ev.value; } break;
    case 'clash': if (v.combat) { v.combat.total = ev.total; v.combat.strength = ev.strength; v.combat.result = ev.result; } break;
    case 'counter': if (v.combat) v.combat.counter = { amount: ev.amount, defense: ev.defense }; break;
    case 'injury': { const c = P(ev.seat).comps[ev.companion]; if (c) c.injured = true; v.combat?.injured.push({ seat: ev.seat, companion: ev.companion }); break; }
    case 'heal': { const c = P(ev.seat).comps[ev.companion]; if (c) { c.injured = false; c.rest = false; } add(P(ev.seat).res, ev.cost, -1); break; }
    case 'loot': add(P(ev.seat).res, ev.gain); if (v.combat) v.combat.loot = ev.gain; break;
    case 'trophy': {
      const p = P(ev.seat);
      p.trophies.push(ev.monster); p.fame += ev.fame;
      if (v.combat) v.combat.trophy = ev.fame;
      const uid = v.combat?.monster.uid;
      const n = v.nests.find((x) => x.mon && (x.mon.uid === uid));
      if (n) n.mon = undefined;
      if (v.lair.boss && v.lair.boss.uid === uid) v.lair.defeated = true;
      log(`${who(v, ev.seat)}が${v.combat?.monster.name ?? '魔物'}を倒した（証${ev.fame}）`);
      break;
    }
    case 'tame': {
      const p = P(ev.seat); p.pets += 1;
      const n = v.nests.find((x) => x.mon?.type === ev.monster); if (n) n.mon = undefined;
      log(`${who(v, ev.seat)}が魔物を使い魔にした`);
      break;
    }
    case 'combat_end':
      if (v.combat && v.combat.result === 'lose') {
        const n = v.nests.find((x) => x.mon && x.mon.uid === v.combat!.monster.uid);
        if (n?.mon && v.combat.total !== undefined) n.mon = { ...n.mon, wounds: n.mon.wounds + Math.max(1, Math.floor(v.combat.total / 3)) };
      }
      v.combat = undefined;
      break;
    case 'winter_start': v.winter = { upkeep: [], raids: [] }; break;
    case 'upkeep': { const p = P(ev.seat); p.res.food = Math.max(0, p.res.food - ev.paid); p.discontent += ev.discontent; p.fame -= ev.discontent * DATA.DISCONTENT; v.winter?.upkeep.push({ seat: ev.seat, need: ev.need, paid: ev.paid, discontent: ev.discontent }); break; }
    case 'raid': { const p = P(ev.seat); p.raidLoss += ev.damage; p.fame -= ev.damage; v.winter?.raids.push({ seat: ev.seat, damage: ev.damage, blocked: ev.blocked }); break; }
    case 'winter_end': v.winter = undefined; break;
    case 'quest_done': {
      const q = v.quests.find((x) => x.id === ev.quest);
      if (q && !q.doneBy.includes(ev.seat)) q.doneBy.push(ev.seat);
      const p = P(ev.seat); p.quests.push(ev.quest); p.fame += ev.fame;
      log(`${who(v, ev.seat)}が依頼「${QUEST2[ev.quest]?.name ?? ev.quest}」を達成`);
      break;
    }
    case 'fame': P(ev.seat).fame += ev.amount; break;
    case 'first_pass': v.first = ev.seat; break;
    case 'round_end':
      v.histOpen = false;
      for (const p of v.players) for (const c of p.comps) { c.at = undefined; c.rest = c.injured; c.injured = false; }
      for (const s of Object.values(v.spaces)) s.occupants = [];
      for (const n of v.nests) { n.occupants = []; n.wait = undefined; }
      v.lair.occupants = [];
      v.turn = undefined;
      break;
    case 'score':
      v.histOpen = false;
      v.phase = 'final'; v.final = ev.rows;
      for (const r of ev.rows) if (P(r.seat)) P(r.seat).fame = r.total;
      break;
    case 'game_end': log('冒険の終わり'); break;
    default: break;
  }
  // ラウンドの点：そのラウンドの間は名声の変化に合わせて書き換える（終わりで閉じる。合わせの遅れは次のラウンドの点に入る）
  if (v.histOpen && v.phase === 'play') { const last = v.fameHist.at(-1); if (last && last.round === v.round) last.fame = v.players.map((p) => p.fame); }
  return v;
}

/** 戦闘に出せる（休んでいない・負傷していない）仲間 */
export const readyComps = (p: PV2) => p.comps.filter((c) => !c.at && !c.injured && !c.rest);
/** 進み具合（％） */
export const progressPct = (v: View2) => Math.round(((v.round - 1) / Math.max(1, v.rounds - 1)) * 100);
export type { GameEvent };
