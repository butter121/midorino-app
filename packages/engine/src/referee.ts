// 審判：ホストの端末で動き、全員の操作（コマンド）を検証して1つのゲームを進める。
// 通信や画面には依存しない。状態 MatchState は JSON で保存・復元できる。
import { AI, makeRng, TUNED_W, type Level } from './ai.js';
import {
  CHARACTER_IDS, DEV_IDS, GOODS, IMPROVEMENTS, MARKET_SPACES, NUM_ROUNDS, RES, SEASONS, WEATHER,
  type Cost, type Good, type Res,
} from './data.js';
import {
  apply, buyPrice, endRound, legal, marketBuyLimit, newGame, nextActor, scoreBreakdown, sellValue,
  startRound, trade, type GameState, type Move, type Opt, type ScoreBreakdown, type SellBuy,
} from './engine.js';

// ------------------------------------------------------------ 型
export interface Seat { name: string; ai: Level | null; id?: string }   // ai が null なら人間。id はオンライン時の参加者ID
export interface TradeOffer { id: number; from: number; to: number; give: Cost; get: Cost }
/** 置かれた手の記録（演出用）。gains は持ち物の増えた分 */
export interface PlacedMoveLog { n: number; seat: number; sid: string; gains: Cost }
export interface MatchEvent { seq: number; round: number; text: string }
export interface MatchState {
  version: 1;
  seats: Seat[];                    // 席順（0番が最初の先手）
  phase: 'draft' | 'work' | 'over';
  draft: { options: string[][]; picked: (string | null)[] };
  setup: { weather: string[]; deck: string[] };
  game: GameState | null;
  turn: number | null;              // いま置く人
  last: number | null;              // 直前に置いた人
  offers: TradeOffer[];             // 回答待ちの取引提案
  placements: Record<string, number[]>;   // このラウンドに誰がどこに置いたか（スペースID → 席番号）
  moves: PlacedMoveLog[];           // 最近置かれた手（演出用。n は通し番号）
  moveCount: number;
  proposals: number;                // 手番の人がこの手番で出した提案の数
  nextOfferId: number;
  seq: number;                      // 状態が変わるたびに +1（同期用）
  events: MatchEvent[];
  aiSeed: number;
  result: { scores: { total: number; breakdown: ScoreBreakdown }[]; ranking: number[] } | null;
}
export type Command =
  | { type: 'pickChar'; char: string }
  | { type: 'place'; sid: string; opt: Opt }
  | { type: 'proposeTrade'; to: number; give: Cost; get: Cost }
  | { type: 'respondTrade'; id: number; accept: boolean }
  | { type: 'cancelTrade'; id: number };
export type Result = { ok: true } | { ok: false; error: string };

const fail = (error: string): Result => ({ ok: false, error });
const OK: Result = { ok: true };

// ------------------------------------------------------------ 作成
/**
 * 新しい試合。seed は暗号学的乱数から作ること（山札・天候・席順・ドラフトの元になる）。
 * participants の並びは関係なく、席順はランダムに決まる。
 */
export function createMatch(participants: Seat[], seed: number): MatchState {
  const n = participants.length;
  if (n < 3 || n > 6) throw new Error('3〜6人で遊びます');
  const rng = makeRng(seed);
  const seats = rng.shuffle(participants);
  const decks = Object.fromEntries(SEASONS.map((s) => [s, rng.shuffle(WEATHER[s])]));
  const weather = Array.from({ length: NUM_ROUNDS }, (_, r) => decks[SEASONS[r % 4]][Math.floor(r / 4)].id);
  const chars = rng.shuffle(CHARACTER_IDS);
  const options = seats.map((_, i) => [chars[2 * i], chars[2 * i + 1]]);
  const m: MatchState = {
    version: 1, seats, phase: 'draft', draft: { options, picked: seats.map(() => null) },
    setup: { weather, deck: rng.shuffle(DEV_IDS) }, game: null, turn: null, last: null,
    offers: [], placements: {}, moves: [], moveCount: 0, proposals: 0, nextOfferId: 1, seq: 0, events: [], aiSeed: Math.floor(rng.next() * 1e9),
    result: null,
  };
  seats.forEach((s, i) => { if (s.ai) m.draft.picked[i] = rng.choice(options[i]); });
  maybeStart(m);
  return m;
}

function event(m: MatchState, text: string) {
  m.events.push({ seq: m.seq, round: m.game?.round ?? 0, text });
  if (m.events.length > 300) m.events.splice(0, m.events.length - 300);
}

function maybeStart(m: MatchState) {
  if (m.phase !== 'draft' || m.draft.picked.some((c) => c === null)) return;
  m.game = newGame({ n: m.seats.length, chars: m.draft.picked as string[], ...m.setup }, true);
  m.phase = 'work';
  event(m, 'ゲーム開始');
  beginRound(m, 1);
}

function flushLogs(m: MatchState) {
  const g = m.game!;
  for (const t of g.logs) event(m, t.trim());
  g.logs = [];
}

function beginRound(m: MatchState, r: number) {
  const g = m.game!;
  g.round = r;
  startRound(g);
  flushLogs(m);
  m.last = null;
  m.placements = {};
  setTurn(m, nextActor(g, null));
}

function setTurn(m: MatchState, pid: number | null) {
  m.turn = pid;
  m.proposals = 0;
  m.offers = [];
}

/** 手番が終わったあとの進行（ラウンド終了・ゲーム終了） */
function advance(m: MatchState) {
  const g = m.game!;
  const nxt = nextActor(g, m.last);
  if (nxt !== null) { setTurn(m, nxt); return; }
  endRound(g);
  flushLogs(m);
  if (g.round >= NUM_ROUNDS) {
    m.phase = 'over';
    m.turn = null;
    const scores = g.players.map(scoreBreakdown);
    const ranking = g.players.map((_, i) => i).sort((a, b) =>
      scores[b].total - scores[a].total || g.players[b].res.coin - g.players[a].res.coin
      || g.players[b].family - g.players[a].family);
    m.result = { scores, ranking };
    event(m, 'ゲーム終了');
    return;
  }
  beginRound(m, g.round + 1);
}

// ------------------------------------------------------------ 手の検証
const isInt = (x: unknown): x is number => Number.isInteger(x);

function validCost(c: unknown): c is Cost {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return false;
  return Object.entries(c).every(([r, n]) => (RES as readonly string[]).includes(r) && isInt(n) && n > 0 && n <= 99);
}

/** 人間の市場の手（売る→買うを自由に組み合わせ）を検証する */
export function validateMarket(g: GameState, pid: number, opt: unknown): string | null {
  const p = g.players[pid];
  if (!Array.isArray(opt) || opt.length !== 2) return '形式が正しくありません';
  const [sells, buys] = opt as [SellBuy, SellBuy];
  const isLine = (x: unknown) => Array.isArray(x) && x.length === 2 && (GOODS as readonly string[]).includes(x[0]) && isInt(x[1]) && x[1] > 0;
  if (!Array.isArray(sells) || !Array.isArray(buys) || !sells.every(isLine) || !buys.every(isLine)) return '形式が正しくありません';
  if (!sells.length && !buys.length) return '売るか買うかを選んでください';
  const sold = new Set(sells.map(([gd]) => gd));
  const bought = new Set(buys.map(([gd]) => gd));
  if (sold.size !== sells.length || bought.size !== buys.length) return '同じ品目が重複しています';
  for (const [gd, q] of sells) if (p.res[gd] < q) return '売る数が足りません';
  for (const gd of bought) if (sold.has(gd)) return '売った品目は同じ回に買えません';
  const nBuy = buys.reduce((s, [, q]) => s + q, 0);
  if (nBuy > marketBuyLimit(p)) return `買えるのは合計${marketBuyLimit(p)}個までです`;
  const coin = p.res.coin + sellValue(g, p, sells);
  const cost = buys.reduce((s, [gd, q]) => s + buyPrice(g, p, gd as Good) * q, 0);
  if (cost > coin) return 'コインが足りません';
  return null;
}

const sameMove = (a: Move, b: Move) => JSON.stringify(a) === JSON.stringify(b);

/** 置けるかどうか。null ならOK、文字列ならその理由 */
export function validatePlace(g: GameState, pid: number, sid: string, opt: Opt): string | null {
  const p = g.players[pid];
  if (p.avail <= 0) return '置けるコマがありません';
  if (MARKET_SPACES.has(sid)) {
    const ok = legal(g, p).some(([s]) => s === sid);   // スペースが空いているか
    if (!ok) return 'そこには置けません';
    return validateMarket(g, pid, opt);
  }
  return legal(g, p).some((mv) => sameMove(mv, [sid, opt])) ? null : 'そこには置けません';
}

// ------------------------------------------------------------ コマンドの実行
export function handle(m: MatchState, pid: number, cmd: Command): Result {
  const r = handleInner(m, pid, cmd);
  if (r.ok) { m.seq += 1; runAI(m); }
  return r;
}

function handleInner(m: MatchState, pid: number, cmd: Command): Result {
  if (!isInt(pid) || pid < 0 || pid >= m.seats.length) return fail('席が正しくありません');
  if (cmd.type === 'pickChar') {
    if (m.phase !== 'draft') return fail('キャラクターはもう決まっています');
    if (m.draft.picked[pid]) return fail('選択済みです');
    if (!m.draft.options[pid].includes(cmd.char)) return fail('配られたキャラクターから選んでください');
    m.draft.picked[pid] = cmd.char;
    maybeStart(m);
    return OK;
  }
  if (m.phase !== 'work') return fail('いまはその操作はできません');
  const g = m.game!;
  switch (cmd.type) {
    case 'place': {
      if (m.turn !== pid) return fail('あなたの番ではありません');
      if (typeof cmd.sid !== 'string') return fail('形式が正しくありません');
      const err = validatePlace(g, pid, cmd.sid, cmd.opt);
      if (err) return fail(err);
      const before = { ...g.players[pid].res };
      apply(g, g.players[pid], cmd.sid, structuredClone(cmd.opt));
      recordMove(m, pid, cmd.sid, before);
      g.players[pid].avail -= 1;
      flushLogs(m);
      m.last = pid;
      advance(m);
      return OK;
    }
    case 'proposeTrade': {
      if (m.turn !== pid) return fail('取引の提案は自分の番に、コマを置く前に行います');
      const p = g.players[pid];
      const limit = 1 + (p.char === 'aya' ? 1 : 0) + (p.imps.includes('kyoka') ? 1 : 0);
      if (m.proposals >= limit) return fail('この番の提案回数を使い切りました');
      if (m.offers.length) return fail('回答待ちの提案があります');
      const to = cmd.to;
      if (!isInt(to) || to < 0 || to >= m.seats.length || to === pid) return fail('相手が正しくありません');
      if (!validCost(cmd.give) || !validCost(cmd.get)) return fail('取引の内容が正しくありません');
      if (!Object.keys(cmd.give).length && !Object.keys(cmd.get).length) return fail('取引の内容が空です');
      if (!Object.entries(cmd.give).every(([r, n]) => p.res[r as Res] >= n!)) return fail('渡す物が足りません');
      const offer: TradeOffer = { id: m.nextOfferId++, from: pid, to, give: { ...cmd.give }, get: { ...cmd.get } };
      m.proposals += 1;
      const ai = m.seats[to].ai;
      if (ai) {   // AI はその場で回答
        const bot = aiFor(m, to);
        const accept = bot.accept(g, g.players[to], offer.get, offer.give);
        resolveOffer(m, offer, accept);
      } else {
        m.offers.push(offer);
        event(m, `${m.seats[pid].name} が ${m.seats[to].name} に取引を提案`);
      }
      return OK;
    }
    case 'respondTrade': {
      const i = m.offers.findIndex((o) => o.id === cmd.id);
      if (i < 0) return fail('その提案はもうありません');
      const offer = m.offers[i];
      if (offer.to !== pid) return fail('あなた宛ての提案ではありません');
      m.offers.splice(i, 1);
      resolveOffer(m, offer, !!cmd.accept);
      return OK;
    }
    case 'cancelTrade': {
      const i = m.offers.findIndex((o) => o.id === cmd.id && o.from === pid);
      if (i < 0) return fail('その提案はもうありません');
      m.offers.splice(i, 1);
      event(m, `${m.seats[pid].name} が提案を取り下げ`);
      return OK;
    }
  }
  return fail('不明な操作です');
}

function recordMove(m: MatchState, pid: number, sid: string, before: Record<Res, number>) {
  (m.placements[sid] ??= []).push(pid);
  const after = m.game!.players[pid].res;
  const gains: Cost = {};
  for (const r of RES) if (after[r] > before[r]) gains[r] = after[r] - before[r];
  m.moveCount = (m.moveCount ?? 0) + 1;
  (m.moves ??= []).push({ n: m.moveCount, seat: pid, sid, gains });
  if (m.moves.length > 40) m.moves.splice(0, m.moves.length - 40);
}

function resolveOffer(m: MatchState, o: TradeOffer, accept: boolean) {
  const g = m.game!;
  const a = g.players[o.from], b = g.players[o.to];
  const enough = (p: typeof a, c: Cost) => Object.entries(c).every(([r, n]) => p.res[r as Res] >= n!);
  if (accept && enough(a, o.give) && enough(b, o.get)) {
    trade(g, a, b, o.give, o.get);
    g.logs = [];
    event(m, `${m.seats[o.from].name} と ${m.seats[o.to].name} の取引が成立`);
  } else {
    event(m, `${m.seats[o.to].name} が取引を断った`);
  }
}

// ------------------------------------------------------------ AI の席
const botCache = new WeakMap<MatchState, AI[]>();
function aiFor(m: MatchState, pid: number): AI {
  let bots = botCache.get(m);
  if (!bots) {
    bots = m.seats.map((s, i) => new AI(s.ai ?? 'mid', TUNED_W, m.aiSeed + i * 7919));
    botCache.set(m, bots);
  }
  return bots[pid];
}

/** AI の番なら人間の番になるまで進める */
export function runAI(m: MatchState) {
  while (m.phase === 'work' && m.turn !== null && m.seats[m.turn].ai) {
    const g = m.game!;
    const pid = m.turn;
    const p = g.players[pid];
    const bots = m.seats.map((s, i) => (s.ai ? aiFor(m, i) : null));
    bots[pid]!.tradePhase(g, p, bots);   // AI 同士の取引のみ
    const opts = legal(g, p);
    const [sid, opt] = bots[pid]!.choose(g, p, opts);
    const before = { ...p.res };
    apply(g, p, sid, opt);
    recordMove(m, pid, sid, before);
    p.avail -= 1;
    flushLogs(m);
    m.last = pid;
    m.seq += 1;
    advance(m);
  }
}

// ------------------------------------------------------------ 各自に見せる情報
export interface MatchView {
  you: number; seq: number; phase: MatchState['phase']; seats: Seat[];
  draft: { options: string[] | null; picked: (string | null)[] } | null;
  game: (Omit<GameState, 'weather' | 'deck' | 'logs' | 'errors' | 'logOn'> & {
    weather: (string | null)[];   // 見えないラウンドは null
    deckCount: number;
  }) | null;
  turn: number | null;
  legalSpaces: string[];          // 自分が置ける（自分の番なら置ける）スペース
  offers: TradeOffer[];           // 自分が関わる回答待ちの提案
  placements: Record<string, number[]>;
  moves: PlacedMoveLog[];
  proposalsLeft: number;
  events: MatchEvent[];
  result: MatchState['result'];
}

/** 天候が何ラウンド先まで見えるか（今のラウンド＋予報。ユキは2ラウンド先まで） */
export function weatherVisibleUntil(g: GameState, pid: number) {
  return Math.min(NUM_ROUNDS, Math.max(g.round, 1) + (g.players[pid].char === 'yuki' ? 2 : 1));
}

export function viewFor(m: MatchState, pid: number): MatchView {
  const g = m.game;
  let game: MatchView['game'] = null;
  if (g) {
    const { weather, deck, logs: _l, errors: _e, logOn: _o, ...rest } = g;
    const until = weatherVisibleUntil(g, pid);
    game = structuredClone({ ...rest, weather: weather.map((w, i) => (i < until ? w : null)), deckCount: deck.length });
  }
  const p = g?.players[pid];
  const limit = p ? 1 + (p.char === 'aya' ? 1 : 0) + (p.imps.includes('kyoka') ? 1 : 0) : 0;
  return {
    you: pid, seq: m.seq, phase: m.phase, seats: m.seats,
    draft: m.phase === 'draft' ? { options: m.draft.options[pid], picked: m.draft.picked.map((c, i) => (i === pid ? c : c ? '?' : null)) } : null,
    game, turn: m.turn,
    legalSpaces: g && m.phase === 'work' ? [...new Set(legal(g, g.players[pid]).map(([s]) => s))] : [],
    offers: m.offers.filter((o) => o.from === pid || o.to === pid),
    placements: structuredClone(m.placements),
    moves: structuredClone(m.moves ?? []),
    proposalsLeft: m.turn === pid ? limit - m.proposals : 0,
    events: m.events.slice(-60),
    result: m.result,
  };
}

/** 画面用：自分の番の、スペースごとの選択肢（市場以外） */
export function optionsFor(m: MatchState, pid: number, sid: string): Opt[] {
  const g = m.game;
  if (!g || m.turn !== pid) return [];
  return legal(g, g.players[pid]).filter(([s]) => s === sid).map(([, o]) => o);
}

export const improvementName = (id: string) => IMPROVEMENTS[id === 'okamado_x' ? 'okamado' : id].name;
