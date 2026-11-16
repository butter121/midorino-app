// UIカタログ：部品を本物のゲーム状態で並べて確認するページ（#game / #cards / #parts）
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ACT, CHARACTER_IDS, IMPROVEMENTS, WEATHER, SEASONS, WEATHER_BY_ID, feedNeed, legal, score, sheepPerPlot,
  type GameState,
} from '@midorino/engine';
import '../src/styles/ui.css';
import {
  ActionBar, ActionBoard, Button, CharacterCard, GameLayout, Icon, IconSprite, ImprovementCard, MarketPanel, MyPanel,
  PlayerStrip, PlayersOverview, spaceEffect, StatusBar, Tabs, WeatherCard, Worker, type Alert, type SpaceView,
} from '../src';
import { sampleGame } from './sample';

const NAMES = ['ゆう', 'はると', 'けんた', 'みさき', 'そら', 'りん'];

function spacesFor(g: GameState, by: Record<string, number[]>, me: number): SpaceView[] {
  const legalIds = new Set(legal(g, g.players[me]).map((m) => m[0]));
  const w = g.weather[g.round - 1];
  return g.spaces.map((id) => {
    const a = ACT[id];
    const notYet = (a.from_round ?? 1) > g.round;
    const reason = notYet ? `ラウンド${a.from_round}から` : g.closed.includes(id) ? `${WEATHER_BY_ID[w].name}で使えない` : !legalIds.has(id) && !by[id] ? '条件を満たしていない' : undefined;
    const bonus = w === 'harusame' && id === 'sow' ? '春雨で畑ごと+2' : w === 'hareten' && id === 'plow' ? '晴天続きで+1区画' : undefined;
    return { id, accum: g.accum[id], by: by[id], available: legalIds.has(id), reason, bonus };
  });
}

function GameDemo({ n, round, placed, me }: { n: number; round: number; placed: number; me: number }) {
  const [{ g, by, turn }] = useState(() => sampleGame(n, round, placed));
  if (me < 0) me = turn;
  const [tab, setTab] = useState<'me' | 'all' | 'market' | 'cards'>('me');
  const [sel, setSel] = useState<string | null>(() => spacesFor(g, by, me).find((s) => s.available && ACT[s.id].accum)?.id ?? null);
  const p = g.players[me];
  const myTurn = turn === me;
  const winterW = 'odayaka';
  const need = feedNeed(p, winterW);
  const alerts: Alert[] = [];
  if (p.res.food < need) alerts.push({ tone: 'bad', text: `冬越しの食料 ${p.res.food}/${need}` });
  else alerts.push({ tone: 'leaf', text: `冬越しの食料 ${p.res.food}/${need} ✓` });
  const forecast = [g.weather[g.round]].filter(Boolean);
  return (
    <GameLayout
      status={<StatusBar round={g.round} weather={g.weather[g.round - 1]} forecast={forecast} alerts={alerts} />}
      players={<PlayerStrip players={g.players.map((q) => ({
        seat: q.pid, name: NAMES[q.pid], vp: score(q), left: q.avail, total: q.family, isTurn: q.pid === turn,
        isFirst: q.pid === g.first, isMe: q.pid === me,
      }))} />}
      board={<ActionBoard spaces={spacesFor(g, by, me)} selected={sel} onPick={setSel} />}
      side={<>
        <Tabs value={tab} onChange={setTab} tabs={[{ id: 'me', label: 'わたし' }, { id: 'all', label: 'みんな' }, { id: 'market', label: '市場' }, { id: 'cards', label: '設備' }]} />
        {tab === 'me' && <MyPanel player={p} sheepPer={sheepPerPlot(p)} />}
        {tab === 'all' && <PlayersOverview players={g.players} names={NAMES} mySeat={me} />}
        {tab === 'market' && <MarketPanel prices={g.prices} />}
        {tab === 'cards' && <div className="cat-cards">{[...new Set(g.display)].map((id) => <ImprovementCard key={id} id={id} small />)}</div>}
      </>}
      action={<ActionBar tone={myTurn ? 'turn' : 'wait'} message={myTurn
        ? <><Worker seat={me} size={28} /><span>{sel ? <>「{ACT[sel].name}」に置きますか？<span className="mi-sp-detail">{spaceEffect(sel)}</span></> : 'あなたの番です。置く場所を選んでください'}</span></>
        : <><Worker seat={turn} size={28} />{NAMES[turn]}さんが考えています…</>}>
        <Button><Icon name="i-trade" size={20} />取引</Button>
        <Button kind="primary" disabled={!sel || !myTurn}>{sel ? 'ここに置く' : '置く'}</Button>
      </ActionBar>}
    />
  );
}

function CardsPage() {
  return (
    <div className="mi-root cat-page">
      <h2>キャラクター（12人）</h2>
      <div className="cat-grid">{CHARACTER_IDS.map((id) => <CharacterCard key={id} id={id} />)}</div>
      <h2>設備（常設5・発展24）</h2>
      <div className="cat-grid">{Object.keys(IMPROVEMENTS).map((id) => <ImprovementCard key={id} id={id} />)}</div>
      <h2>天候（各季節6枚）</h2>
      {SEASONS.map((s, i) => <div key={s} className="cat-grid">{WEATHER[s].map((w) => <WeatherCard key={w.id + s} id={w.id} round={i + 1} />)}</div>)}
    </div>
  );
}

function App() {
  const h = location.hash.replace('#', '') || 'game';
  if (h === 'cards') return <CardsPage />;
  const [n, round, placed, me] = (new URLSearchParams(location.search).get('s') ?? '5,7,6,-1').split(',').map(Number);
  return <GameDemo n={n} round={round} placed={placed} me={me} />;
}

const css = document.createElement('style');
css.textContent = `
.cat-page{padding:16px;min-height:100vh}.cat-page h2{font-size:18px;margin:18px 0 8px}
.cat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px;margin-bottom:12px}
.cat-cards{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}`;
document.head.appendChild(css);

createRoot(document.getElementById('root')!).render(<StrictMode><IconSprite /><App /></StrictMode>);
