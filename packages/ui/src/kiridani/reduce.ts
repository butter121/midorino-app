// 出来事を1つずつ GameView に当てる（純粋関数。ルールの計算はしない：数値はすべてイベントが運ぶ）
import { ACT, BOSS, CARDS, CHAR, EL_JP, FATE_DECK, MON, NEST_JP, QUESTS, RES, RES_JP, SEASON_JP, START_BEDS, TIDE, WEATHER_JP, type Cost, type Res } from './data';
import type { GameEvent, GameView, PlayerView, Seat } from './types';

export const emptyRes = (): Record<Res, number> => Object.fromEntries(RES.map((r) => [r, 0])) as Record<Res, number>;

export function initialView(me: Seat = 0): GameView {
  return {
    phase: 'setup', me, round: 0, season: 'spring', tide: TIDE.spring, forecast: [], spaceOrder: [], spaces: {}, nests: [],
    lair: { candidates: [], wounds: 0, occupants: [] }, players: [], first: 0, quests: [], market: {}, log: [],
  };
}

export const monsterDef = (id: string) => MON[id] ?? BOSS[id];
export const costText = (c: Cost | undefined) =>
  Object.entries(c ?? {}).filter(([, n]) => n).map(([r, n]) => `${RES_JP[r as Res]}${(n as number) > 0 ? '+' : ''}${n}`).join('・');
export const placeName = (id: string) => ACT[id]?.name ?? NEST_JP[id] ?? id;
export const cardName = (id: string) => CARDS[id]?.name ?? '？';

function addCost(to: Record<Res, number>, c: Cost, sign = 1) {
  for (const [r, n] of Object.entries(c)) to[r as Res] = Math.max(0, (to[r as Res] ?? 0) + sign * (n ?? 0));
}

function newPlayer(seat: Seat, name: string): PlayerView {
  return {
    seat, name, fame: 0, res: emptyRes(), beds: START_BEDS, walls: 0, facilities: [], weapons: [], occupations: [], hand: [],
    spellsUsed: [], trophies: [], familiars: [], discontent: 0, fateLeft: [...FATE_DECK], fateUsed: [], quests: [],
    companions: [{ id: `c${seat}-0`, leader: true, injured: false, skill: 0 }, { id: `c${seat}-1`, injured: false, skill: 0 }],
  };
}

const who = (v: GameView, seat: Seat) => (seat === v.me ? 'あなた' : v.players[seat]?.name ?? `席${seat + 1}`);

/** v を壊さずに次の状態を返す */
export function applyEvent(v0: GameView, ev: GameEvent): GameView {
  const v: GameView = structuredClone(v0);
  const log = (s: string) => { v.log = [s, ...v.log].slice(0, 40); };
  const P = (seat: Seat) => v.players[seat];
  const removeCard = (p: PlayerView, card: string) => {
    const i = p.hand.indexOf(card);
    if (i >= 0) p.hand.splice(i, 1); else { const j = p.hand.indexOf('?'); if (j >= 0) p.hand.splice(j, 1); }
  };
  const target = (id: string) => v.spaces[id] ?? v.nests.find((n) => n.id === id) ?? (id === 'lair' ? v.lair : undefined);

  switch (ev.t) {
    case 'game_start': {
      v.me = ev.me;
      v.players = ev.players.map((p) => newPlayer(p.seat, p.name));
      v.quests = ev.quests.map((id) => ({ id, doneBy: [] }));
      v.spaceOrder = ev.spaces;
      v.spaces = Object.fromEntries(ev.spaces.map((id) => [id, { id, stock: {}, occupants: [], open: (ACT[id]?.from_round ?? 1) <= 1 }]));
      v.nests = ev.nests.map((id) => ({ id, wounds: 0, occupants: [] }));
      v.market = { ...ev.market };
      v.phase = 'setup';
      log(`${ev.players.length}人で冒険が始まる`);
      break;
    }
    case 'draft_offer':
      v.phase = 'draft';
      v.draft = { kind: ev.kind, lap: ev.lap, offers: ev.offers, picked: {} };
      break;
    case 'draft_pick': {
      const p = P(ev.seat);
      const shown = ev.seat === v.me || v.me < 0 ? ev.card : '?';
      p.hand.push(shown);
      if (v.draft) v.draft.picked[ev.seat] = shown;
      if (ev.seat === v.me) log(`${cardName(ev.card)}を手札に`);
      break;
    }
    case 'grant':
      addCost(P(ev.seat).res, ev.gain);
      break;
    case 'fate_shuffle': {
      const p = P(ev.seat);
      p.fateLeft = [...ev.deck]; p.fateUsed = [];
      break;
    }
    case 'char_offer':
      v.phase = 'character';
      v.draft = undefined;
      for (const p of v.players) p.charOptions = ev.offers[p.seat];
      break;
    case 'char_pick': {
      const p = P(ev.seat);
      p.character = ev.char;
      log(`${who(v, ev.seat)}は${CHAR[ev.char]?.name}に`);
      break;
    }
    case 'round_start': {
      v.phase = 'play';
      v.round = ev.round; v.season = ev.season; v.tide = ev.tide; v.first = ev.first; v.turn = undefined;
      for (const id of v.spaceOrder) v.spaces[id].open = (ACT[id]?.from_round ?? 1) <= ev.round;
      log(`ラウンド${ev.round}・${SEASON_JP[ev.season]}（魔力の潮：${EL_JP[ev.tide]}）`);
      break;
    }
    case 'weather':
      v.weather = ev.weather; v.forecast = ev.forecast;
      log(`天候：${WEATHER_JP[ev.weather]}`);
      break;
    case 'boss_reveal':
      v.lair = { candidates: ev.candidates, boss: ev.boss, round: ev.round, wounds: 0, occupants: [], defeated: false };
      if (ev.boss) log(`今年の主：${monsterDef(ev.boss)?.name}`);
      break;
    case 'monster_spawn': {
      let n = v.nests.find((x) => x.id === ev.nest);
      // 濃霧の日だけ現れる霧の巣
      if (!n) { n = { id: ev.nest, wounds: 0, occupants: [] }; v.nests.push(n); }
      n.monster = ev.monster; n.wounds = 0; n.next = ev.next; n.trap = false;
      log(`${NEST_JP[ev.nest]}に${monsterDef(ev.monster)?.name}`);
      break;
    }
    case 'monster_leave': {
      const n = v.nests.find((x) => x.id === ev.nest);
      if (n) { n.monster = undefined; n.wounds = 0; n.trap = false; }
      if (ev.nest === 'nest_fog') v.nests = v.nests.filter((x) => x.id !== 'nest_fog');
      break;
    }
    case 'refill':
      for (const [id, c] of Object.entries(ev.adds)) {
        const s = v.spaces[id]; if (!s) continue;
        for (const [r, n] of Object.entries(c)) s.stock[r as Res] = (s.stock[r as Res] ?? 0) + (n ?? 0);
      }
      break;
    case 'recover': {
      const c = P(ev.seat).companions.find((x) => x.id === ev.companion);
      if (c) c.injured = false;
      break;
    }
    case 'turn':
      v.turn = ev.seat;
      break;
    case 'place': {
      const p = P(ev.seat);
      const c = p.companions.find((x) => x.id === ev.companion);
      if (c) c.at = ev.space;
      target(ev.space)?.occupants.push(ev.seat);
      log(`${who(v, ev.seat)}→${placeName(ev.space)}`);
      break;
    }
    case 'gather': {
      const s = v.spaces[ev.space];
      if (s) for (const [r, n] of Object.entries(ev.gain)) if (s.stock[r as Res]) s.stock[r as Res] = Math.max(0, (s.stock[r as Res] ?? 0) - (n ?? 0));
      addCost(P(ev.seat).res, ev.gain);
      break;
    }
    case 'pay':
      addCost(P(ev.seat).res, ev.cost, -1);
      break;
    case 'play_card': {
      const p = P(ev.seat); const card = CARDS[ev.card];
      removeCard(p, ev.card);
      if (!card) break;
      if (card.kind === 'occ') p.occupations.push(ev.card);
      else if (card.kind === 'weapon') p.weapons.push(ev.card);
      else if (card.kind === 'tool') p.facilities.push(ev.card);
      if (card.kind !== 'occ' && card.fame) p.fame += card.fame;
      log(`${who(v, ev.seat)}が${card.name}を出した`);
      break;
    }
    case 'spell': {
      const p = P(ev.seat);
      removeCard(p, ev.card); p.spellsUsed.push(ev.card);
      log(`${who(v, ev.seat)}が${cardName(ev.card)}を使った`);
      break;
    }
    case 'build': {
      const p = P(ev.seat);
      if (ev.kind === 'bed') p.beds += 1; else p.walls += 1;
      log(`${who(v, ev.seat)}が${ev.kind === 'bed' ? '寝床' : '防壁'}を建てた`);
      break;
    }
    case 'hire':
      P(ev.seat).companions.push({ id: ev.companion, injured: false, skill: 0 });
      log(`${who(v, ev.seat)}が仲間を雇った`);
      break;
    case 'train': {
      const c = P(ev.seat).companions.find((x) => x.id === ev.companion);
      if (c) c.skill += 1;
      break;
    }
    case 'market': {
      const p = P(ev.seat);
      addCost(p.res, ev.buy); addCost(p.res, ev.sell, -1);
      p.res.gold = Math.max(0, p.res.gold + ev.gold);
      v.market = { ...v.market, ...ev.prices };
      break;
    }
    case 'draw':
      P(ev.seat).hand.push(ev.seat === v.me || v.me < 0 ? ev.card : '?');
      break;
    case 'combat_start':
      v.combat = { nest: ev.nest, monster: ev.monster, boss: ev.boss, seats: ev.seats, strength: ev.strength, wounds: ev.wounds, parts: [], injured: [] };
      break;
    case 'power':
      if (v.combat) {
        v.combat.parts = [...v.combat.parts, ...ev.parts];
        v.combat.total = v.combat.parts.reduce((a, x) => a + x.value, 0) + (v.combat.fate?.value ?? 0);
      }
      break;
    case 'fate_flip': {
      const p = P(ev.seat);
      for (const val of ev.values ?? [ev.value]) {
        const i = p.fateLeft.indexOf(val);
        if (i >= 0) p.fateLeft.splice(i, 1);
        p.fateUsed.push(val);
      }
      if (v.combat) {
        // 主との決戦では参加者全員が1枚ずつめくり、合計を使う
        const prev = v.combat.fate && v.combat.fate.seat !== ev.seat ? v.combat.fate.value : 0;
        v.combat.fate = { seat: ev.seat, value: prev + ev.value, values: ev.values };
        v.combat.total = v.combat.parts.reduce((a, x) => a + x.value, 0) + v.combat.fate.value;
      }
      break;
    }
    case 'clash':
      if (v.combat) { v.combat.total = ev.total; v.combat.result = ev.result; }
      break;
    case 'hit': {
      const id = v.combat?.nest;
      const n = id === 'lair' ? v.lair : v.nests.find((x) => x.id === id);
      if (n && v.combat?.result !== 'win') n.wounds += ev.amount;
      break;
    }
    case 'counter':
      if (v.combat) v.combat.counter = { amount: ev.amount, defense: ev.defense };
      break;
    case 'injury': {
      const c = P(ev.seat).companions.find((x) => x.id === ev.companion);
      if (c) c.injured = true;
      v.combat?.injured.push({ seat: ev.seat, companion: ev.companion });
      break;
    }
    case 'heal': {
      const p = P(ev.seat);
      const c = p.companions.find((x) => x.id === ev.companion);
      if (c) c.injured = false;
      if (ev.cost) addCost(p.res, ev.cost, -1);
      break;
    }
    case 'loot':
      addCost(P(ev.seat).res, ev.gain);
      if (v.combat) v.combat.loot = ev.gain;
      break;
    case 'trophy': {
      const p = P(ev.seat);
      p.trophies.push(ev.monster); p.fame += ev.fame;
      if (v.combat) v.combat.trophy = ev.fame;
      const n = v.nests.find((x) => x.monster === ev.monster);
      if (n) { n.monster = undefined; n.wounds = 0; n.trap = false; }
      if (v.lair.boss === ev.monster) v.lair.defeated = true;
      log(`${who(v, ev.seat)}が${monsterDef(ev.monster)?.name}を倒した`);
      break;
    }
    case 'combat_end':
      v.combat = undefined;
      break;
    case 'produce':
      addCost(P(ev.seat).res, ev.gain);
      break;
    case 'winter_start':
      v.winter = { upkeep: [], raids: [] };
      break;
    case 'upkeep': {
      const p = P(ev.seat);
      p.res.food = Math.max(0, p.res.food - ev.paid);
      p.discontent += ev.discontent;
      v.winter?.upkeep.push({ seat: ev.seat, need: ev.need, paid: ev.paid, discontent: ev.discontent });
      break;
    }
    case 'raid': {
      addCost(P(ev.seat).res, ev.lost, -1);
      v.winter?.raids.push({ seat: ev.seat, monster: ev.monster, damage: ev.damage, blocked: ev.blocked, lost: ev.lost });
      break;
    }
    case 'winter_end':
      v.winter = undefined;
      break;
    case 'boss_appear':
      v.lair.boss = ev.boss;
      break;
    case 'dragon_fail':
      for (const p of v.players) p.fame -= ev.fame;
      log(`古竜を倒せなかった（全員 -${ev.fame}）`);
      break;
    case 'quest_done': {
      const q = v.quests.find((x) => x.id === ev.quest);
      if (q && !q.doneBy.includes(ev.seat)) q.doneBy.push(ev.seat);
      const p = P(ev.seat);
      p.quests.push(ev.quest); p.fame += ev.fame;
      log(`${who(v, ev.seat)}が依頼「${QUESTS[ev.quest]}」を達成`);
      break;
    }
    case 'fame':
      P(ev.seat).fame += ev.amount;
      break;
    case 'market_reset':
      v.market = { ...ev.market };
      break;
    case 'round_end':
      for (const p of v.players) for (const c of p.companions) c.at = undefined;
      for (const s of Object.values(v.spaces)) s.occupants = [];
      for (const n of v.nests) n.occupants = [];
      v.lair.occupants = [];
      v.turn = undefined;
      break;
    case 'first_pass':
      v.first = ev.seat;
      break;
    case 'score':
      v.phase = 'final';
      v.final = ev.rows;
      for (const r of ev.rows) P(r.seat).fame = r.total;
      break;
    case 'game_end':
      log('ゲーム終了');
      break;
    case 'familiar': {
      const p = P(ev.seat);
      p.familiars.push(ev.monster ?? 'wolf');
      log(`${who(v, ev.seat)}が${ev.monster ? monsterDef(ev.monster)?.name + 'を' : ''}使い魔にした`);
      break;
    }
    case 'trap': {
      const n = v.nests.find((x) => x.id === ev.nest);
      if (n) n.trap = true;
      log(`${who(v, ev.seat)}が${NEST_JP[ev.nest] ?? ev.nest}に罠をしかけた`);
      break;
    }
    case 'trade':
      addCost(P(ev.a).res, ev.give, -1); addCost(P(ev.a).res, ev.get);
      addCost(P(ev.b).res, ev.give); addCost(P(ev.b).res, ev.get, -1);
      log(`${who(v, ev.a)}と${who(v, ev.b)}が取引（${costText(ev.give)} ⇄ ${costText(ev.get)}）`);
      break;
    case 'discard': {
      const p = P(ev.seat);
      for (const list of [p.occupations, p.weapons, p.facilities]) { const i = list.indexOf(ev.card); if (i >= 0) { list.splice(i, 1); break; } }
      log(`${who(v, ev.seat)}の${cardName(ev.card)}がなくなった`);
      break;
    }
    case 'recall': {
      const p = P(ev.seat);
      const c = p.companions.find((x) => x.id === ev.companion);
      const at = c?.at;
      if (c) { c.at = undefined; c.injured = false; }
      const t = at ? target(at) : undefined;
      if (t) { const i = t.occupants.indexOf(ev.seat); if (i >= 0) t.occupants.splice(i, 1); }
      break;
    }
    case 'weather_set':
      if (ev.round === v.round + 1) v.forecast = [ev.weather, ...v.forecast.slice(1)];
      log(`${who(v, ev.seat)}が次の天候を${WEATHER_JP[ev.weather]}に`);
      break;
    case 'wait':
      log(`${who(v, ev.seat)}が${placeName(ev.nest)}で共闘の相手を待つ（戦力${ev.power}）`);
      break;
  }
  return v;
}

/** 戦闘に出せる（拠点にいて負傷していない）仲間 */
export const readyCompanions = (p: PlayerView) => p.companions.filter((c) => !c.at && !c.injured);
export const weatherName = (id?: string) => (id ? WEATHER_JP[id] ?? id : '—');
