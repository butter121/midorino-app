// 霧谷：本物のエンジン（KiridaniSession）で1試合を遊ぶ画面。人間は1席、残りは AI。
// エンジンの「人間に聞くこと」を、既存の画面（ドラフト・キャラ選択・盤面で置き場所）と選択のシート（ChoiceSheet）に振り分ける。
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AI, KiridaniSession, describeOption, previewFight, type Level, type Option, type Req, type SeatSession } from '@midorino/engine/src/kiridani';
import { CARDS, MARKETS, MON, SEASON_JP, WEATHER, WEATHER_JP, seasonOf, type Cost, type ItemDef, type Res } from './data';
import type { Speed } from './anim/timing';
import type { GameEvent } from './types';
import { useTable } from './ui/useTable';
import { KiridaniTable, type Ask } from './ui/table';
import { ChoiceSheet, type ChoiceSpec } from './ui/choice';
import { FightTray, MarketTray, TradeButton, TradeTray, type FightSel } from './ui/tray';

export const ENGINE_NAMES = ['あなた', 'ハヤテ', 'コトネ', 'ジン', 'ルリ', 'タケル'];

/** その場面の最初の出来事か（?at= で途中まで飛ばすとき） */
export function isSceneStart(at: string, e: GameEvent, me: number): boolean {
  if (at === 'draft') return e.t === 'draft_offer';
  if (at === 'char') return e.t === 'char_offer';
  if (at === 'combat') return e.t === 'combat_start' && e.seats.includes(me);
  if (at === 'anycombat') return e.t === 'combat_start';
  if (at === 'winter') return e.t === 'winter_start';
  if (at === 'boss') return e.t === 'boss_appear';
  if (at === 'final') return e.t === 'score';
  const m = /^r(\d+)$/.exec(at);
  if (m) return e.t === 'round_start' && e.round === Number(m[1]);
  return false;
}

const yesNo = (title: string, sub: string, yes = 'はい', no = 'いいえ'): ChoiceSpec => ({
  title, sub, items: [{ id: 'yes', title: yes, primary: true }, { id: 'no', title: no }],
});

/** 置き場所を選んだあとの細かい選択（何人で・方針・どのカード・いくつ） */
export function optionSheet(s: SeatSession, sid: string, opts: Option[]): ChoiceSpec {
  const g = s.g; const p = s.player!;
  const fight = sid.startsWith('nest') || sid === 'lair';
  const items = opts.map((o, i) => {
    const d = describeOption(g, p, o);
    const pv = fight ? previewFight(g, p, o[0], o[1]) : null;
    return {
      id: String(i), title: d.title, detail: d.detail, card: d.card,
      ...(pv ? { meter: { power: pv.power, need: pv.need + pv.power + pv.partner, pwin: pv.pwin, partner: pv.partner }, uses: pv.boosts, cost: pv.cost } : {}),
    };
  });
  if (fight) {
    const nd = sid === 'lair' ? null : g.nest(sid);
    const mon = sid === 'lair' ? g.bosses[g.round] : MON[nd!.mon!];
    const wait = nd?.wait ? `${g.names[nd.wait.pid]}が待ち伏せ中（戦力${nd.wait.plan.power}）。` : '';
    const need = sid === 'lair' ? `強さ${mon.str}（みんなの戦力と運命の合計で挑む）` : `強さ${g.eff_str(p, mon, nd)}`;
    return { title: `${mon.name}に挑む`, sub: `${wait}${need}。％は運命の山から見た勝つ見込み`, monster: mon.id, items, cancel: '置き場所を選び直す' };
  }
  const title = sid === 'guild' ? '出す職能を選ぶ' : sid === 'forge' ? '作る武具を選ぶ' : sid === 'workshop' ? '工房で建てるもの' : '市場で売り買い';
  return { title, items, cancel: '置き場所を選び直す' };
}

/** 人間に聞くことを、既存の画面（ask）か選択のシートに振り分ける */
export function uiFor(s: SeatSession): { ask: Ask | null; sheet: ChoiceSpec | null } {
  const w = s.waiting;
  if (!w) return { ask: null, sheet: null };
  const g = s.g;
  switch (w.k) {
    case 'draft':
      if (!w.ingame) return { ask: { kind: 'draft', options: w.cards }, sheet: null };
      return { ask: null, sheet: { title: '品物カードを1枚取る', sub: g.round && BOSS_ROUND(g.round) ? '主を倒したごほうび' : '遺跡の探索', items: w.cards.map((c) => ({ id: c, title: CARDS[c].name, detail: (CARDS[c] as ItemDef).text, card: c })) } };
    case 'char': return { ask: { kind: 'char', options: w.options }, sheet: null };
    case 'choose': return { ask: { kind: 'place', options: [...new Set(w.opts.map((o) => o[0]))] }, sheet: null };
    case 'tame': return { ask: null, sheet: { ...yesNo(`${w.m.name}を使い魔にする？`, '食料を払い、戦利品の代わりに使い魔にする（毎回の戦力が上がる）'), monster: w.m.id } };
    case 'heal': return { ask: null, sheet: yesNo('サナ：薬草1で負傷を防ぐ？', '負傷するはずの仲間1人をその場で手当てする') };
    case 'tan': return { ask: null, sheet: yesNo('皮なめし：素材3を名声2にする？', '獣の皮なめし職人（各ラウンド1回）') };
    case 'hourglass': return { ask: null, sheet: yesNo('時渡りの砂時計を使う？', '魔石を払い、このラウンドは仲間をもう1人置ける') };
    case 'storm': return { ask: null, sheet: yesNo('嵐呼びの巫女：次のラウンドを嵐にする？', '年に1回。嵐の日は戦力+2') };
    case 'weather': {
      const s2 = seasonOf(g.round + 1);
      return { ask: null, sheet: {
        title: '天候の鈴：次の天候を選ぶ', sub: `次は${SEASON_JP[s2]}。いま決まっているのは「${WEATHER_JP[g.weather[g.round]]}」`,
        items: [...WEATHER[s2].map((x) => ({ id: x, title: WEATHER_JP[x] })), { id: '', title: '使わない' }],
      } };
    }
  }
}
const BOSS_ROUND = (r: number) => r % 4 === 0;

/** シートの答えをエンジンの答えに直す */
export function sheetAnswer(w: Req, id: string): unknown {
  switch (w.k) {
    case 'draft': return id;
    case 'weather': return id || null;
    default: return id === 'yes';
  }
}

export interface EngineGameProps {
  n: number;
  seed: number;
  level?: Level;
  speed?: Speed;
  /** この場面の手前まで自動で進めてから再生（draft|char|r5|combat|winter|boss|final） */
  at?: string;
  /** 自分の席も AI に任せる */
  auto?: boolean;
  extra?: (ctl: { restart: (n?: number, seed?: number) => void; auto: boolean; setAuto: (a: boolean) => void; session: KiridaniSession | null }) => ReactNode;
}

export function KiridaniEngineGame({ n: n0, seed: seed0, level = 'mid', speed, at, auto: auto0 = false, extra }: EngineGameProps) {
  const me = 0;
  const t = useTable(me, { speed });
  const sRef = useRef<KiridaniSession | null>(null);
  const helper = useRef(new AI('mid', { seed: 99 }));
  const [ask, setAsk] = useState<Ask | null>(null);
  const [sheet, setSheet] = useState<ChoiceSpec | null>(null);
  /** 置き場所を選んだあとの細かい選択 */
  const [sub, setSub] = useState<{ sid: string; opts: Option[] } | null>(null);
  /** トレイで選ぶシート（戦闘・市場・取引） */
  const [tray, setTray] = useState<{ kind: 'fight' | 'market'; sid: string } | { kind: 'trade' } | null>(null);
  const [auto, setAutoState] = useState(auto0);
  const autoRef = useRef(auto0);
  const [, force] = useState(0);

  const feed = useCallback((evs: GameEvent[]) => {
    const s = sRef.current!;
    t.push(evs);
    setSub(null); setTray(null);
    if (s.done) { setAsk(null); setSheet(null); force((x) => x + 1); return; }
    if (autoRef.current) {
      const w = s.waiting!;
      t.submit(() => { if (sRef.current === s) feed(s.answer(helper.current.respond(w))); });
      return;
    }
    const ui = uiFor(s);
    setAsk(ui.ask);
    // シートは演出が追いついてから出す（戦闘の途中の判断など）
    if (ui.sheet) { setSheet(null); t.submit(() => { if (sRef.current === s) setSheet(ui.sheet); }); } else setSheet(null);
  }, [t]);

  const send = useCallback((a: unknown) => {
    const s = sRef.current!;
    setAsk(null); setSheet(null); setSub(null); setTray(null);
    t.submit(() => { if (sRef.current === s) feed(s.answer(a)); });
  }, [feed, t]);

  /** 人間の席だけの答え方（戦闘のトレイ・市場のトレイ） */
  const sendWith = useCallback((run: (s: KiridaniSession) => GameEvent[]) => {
    const s = sRef.current!;
    setAsk(null); setSheet(null); setSub(null); setTray(null);
    t.submit(() => { if (sRef.current === s) feed(run(s)); });
  }, [feed, t]);
  const sendFight = (sel: FightSel) => sendWith((s) => s.fight(sel));
  const sendMarket = (sid: string, kind: 'buy' | 'sell', r: Res, q: number) => sendWith((s) => s.market(sid, kind, r, q));
  /** 取引は置き場所の選択を続けたまま（出来事だけ流し、選べる場所を数え直す） */
  const doTrade = (b: number, give: Cost, get: Cost) => {
    const s = sRef.current;
    if (!s) return;
    const evs = s.trade(b, give, get);
    t.push(evs);
    setTray(null);
    setAsk(uiFor(s).ask);
  };

  const restart = useCallback((n = n0, seed = seed0, scene = '') => {
    const s = new KiridaniSession({ n, seed, human: me, levels: Array(n).fill(level), names: ENGINE_NAMES.slice(0, n) });
    sRef.current = s;
    t.reset(me);
    setAsk(null); setSheet(null); setSub(null); setTray(null);
    if (!scene) { feed(s.start()); return; }
    // その場面まで自分の席もお任せで進め、手前までは演出なしで当てる
    const before: GameEvent[] = [];
    let chunk = s.start();
    for (;;) {
      const i = chunk.findIndex((e) => isSceneStart(scene, e, me));
      if (i >= 0) { before.push(...chunk.slice(0, i)); t.load(before); feed(chunk.slice(i)); return; }
      before.push(...chunk);
      if (s.done) { t.load(before); force((x) => x + 1); return; }
      chunk = s.answer(helper.current.respond(s.waiting!));
    }
  }, [feed, level, n0, seed0, t]);

  useEffect(() => { restart(n0, seed0, at ?? ''); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setAuto = (a: boolean) => {
    setAutoState(a); autoRef.current = a;
    const s = sRef.current;
    if (a && s?.waiting) { const w = s.waiting; setAsk(null); setSheet(null); setSub(null); setTray(null); t.submit(() => feed(s.answer(helper.current.respond(w)))); }
  };

  // 既存の画面からの答え（ドラフトのカード・キャラ・置き場所）
  const onAnswer = (c: string) => {
    const s = sRef.current; const w = s?.waiting;
    if (!s || !w) return;
    if (w.k === 'choose') {
      const opts = w.opts.filter((o) => o[0] === c);
      if (c.startsWith('nest') || c === 'lair') { setTray({ kind: 'fight', sid: c }); return; }
      if (MARKETS.has(c)) { setTray({ kind: 'market', sid: c }); return; }
      if (opts.length === 1) send(opts[0]);
      else setSub({ sid: c, opts });
      return;
    }
    send(c);
  };

  const s = sRef.current;
  let sheetNode: ReactNode = null;
  const backToBoard = () => { setTray(null); setAsk(ask ? { ...ask } : null); };
  if (tray && s?.waiting?.k === 'choose') {
    if (tray.kind === 'fight') sheetNode = <FightTray key={tray.sid} s={s} sid={tray.sid} onFight={sendFight} onCancel={backToBoard} />;
    else if (tray.kind === 'market') sheetNode = <MarketTray key={tray.sid} s={s} sid={tray.sid} onDeal={(k, r, q) => sendMarket(tray.sid, k, r, q)} onCancel={backToBoard} />;
    else sheetNode = <TradeTray s={s} onTrade={doTrade} onCancel={() => setTray(null)} />;
  } else if (sub && s) {
    sheetNode = <ChoiceSheet spec={optionSheet(s, sub.sid, sub.opts)} onPick={(id) => send(sub.opts[Number(id)])} onCancel={() => { setSub(null); setAsk(ask ? { ...ask } : null); }} />;
  } else if (sheet && s?.waiting) {
    const w = s.waiting;
    sheetNode = <ChoiceSheet spec={sheet} onPick={(id) => send(sheetAnswer(w, id))} />;
  }

  const actions = ask?.kind === 'place' && !auto ? <TradeButton s={s} onOpen={() => setTray({ kind: 'trade' })} /> : null;
  return <KiridaniTable t={t} ask={ask} onAnswer={onAnswer} sheet={sheetNode} actions={actions} extra={extra?.({ restart: (n, seed) => restart(n, seed), auto, setAuto, session: s })} />;
}
