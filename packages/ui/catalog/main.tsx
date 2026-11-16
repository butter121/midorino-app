// UIカタログ：部品を本物のゲーム状態で並べて確認するページ（#game / #cards / #parts）
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ACT, CHARACTER_IDS, IMPROVEMENTS, WEATHER, SEASONS, WEATHER_BY_ID, feedNeed, legal, score, sheepPerPlot,
  buyPrice, marketBuyLimit, scoreBreakdown, sellPrice, type GameState,
} from '@midorino/engine';
import '../src/styles/ui.css';
import {
  ActionBar, ActionBoard, Button, CharacterCard, GameLayout, Icon, IconSprite, ImprovementCard, MarketPanel, MyPanel,
  PlayerStrip, PlayersOverview, spaceEffect, Lobby, JoinScreen, DraftScreen, ResultScreen, TradeComposer, TradeOfferCard, MarketForm, OptionPicker, EventLog, SeasonBanner, StatusBar, Tabs, WeatherCard, Worker, type Alert, type SpaceView,
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
  const [tab, setTab] = useState<'me' | 'all' | 'market' | 'cards' | 'log'>('me');
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
        <Tabs value={tab} onChange={setTab} tabs={[{ id: 'me', label: 'わたし' }, { id: 'all', label: 'みんな' }, { id: 'market', label: '市場' }, { id: 'cards', label: '設備' }, { id: 'log', label: '記録' }]} />
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

function ScreensPage({ h }: { h: string }) {
  const [{ g }] = useState(() => sampleGame(5, 12, 99));
  const me = 1;
  const p = g.players[me];
  const names = NAMES.slice(0, g.n);
  const noop = () => {};
  if (h === 'lobby') return <Lobby isHost inviteUrl="https://example.github.io/midorino/#join=ABCD-1234" onCopy={noop}
    members={[{ id: 'a', name: 'はると', status: 'host' }, { id: 'b', name: 'ゆう', status: 'joined' }, { id: 'c', name: 'AIさくら', status: 'ai' }, { id: 'd', name: 'けんた', status: 'waiting' }]} />;
  if (h === 'join') return <JoinScreen hostName="はると" onJoin={noop} defaultName="みさき" />;
  if (h === 'draft') return <DraftScreen options={['mina', 'yuki']} picked={[null, null, 'x', null, 'x']} names={names} you={me} onPick={noop} />;
  if (h === 'result') {
    const scores = g.players.map((q) => scoreBreakdown(q));
    const ranking = [...scores.keys()].sort((a, b) => scores[b].total - scores[a].total);
    return <ResultScreen names={names} scores={scores} ranking={ranking} you={me} onAgain={noop} />;
  }
  const bg = <div className="mi-root" style={{ padding: 16, height: '100%' }}>
    <TradeOfferCard fromSeat={2} fromName="けんた" toName="あなた" give={{ wood: 2 }} get={{ food: 2 }} onAccept={noop} onDecline={noop} /></div>;
  if (h === 'trade') return <>{bg}<TradeComposer you={me} players={names.map((name, seat) => ({ seat, name }))} myRes={p.res} theirRes={(s) => g.players[s].res} left={1} onSubmit={noop} onClose={noop} /></>;
  if (h === 'market') return <>{bg}<MarketForm have={p.res} coin={p.res.coin} buyLimit={marketBuyLimit(p)} sellPrice={(gd) => sellPrice(g, p, gd)} buyPrice={(gd) => buyPrice(g, p, gd)} onSubmit={noop} onClose={noop} /></>;
  if (h === 'sow') return <>{bg}<OptionPicker title="種まき：何をまきますか" onChoose={noop} onClose={noop} choices={[
    { value: 1, label: '麦を2区画', detail: '麦2を使い、畑に麦6', icon: <Icon name="i-grain" size={28} /> },
    { value: 2, label: '麦1区画・野菜1区画', detail: '麦1・野菜1を使い、麦3と野菜2', icon: <Icon name="i-veg" size={28} /> },
    { value: 3, label: '野菜を1区画', detail: '野菜1を使い、野菜2', icon: <Icon name="i-veg" size={28} /> }]} /></>;
  return <><div className="mi-root" style={{ padding: 16 }}><EventLog events={[{ seq: 1, round: 7, text: 'ゆうさんが森林で木材6を取りました' }, { seq: 2, round: 7, text: 'あなたが粘土坑で粘土4を取りました' }]} /></div>
    <SeasonBanner title="秋の終わり：収穫と繁殖" lines={['畑から麦3・野菜1を収穫しました', '羊が1頭増えました', '台風：畑の作物が1ずつ減りました（貯蔵庫で防ぎました）']} onClose={noop} /></>;
}

function App() {
  const [h, setH] = useState(() => location.hash.replace('#', '') || 'game');
  useEffect(() => { const f = () => setH(location.hash.replace('#', '') || 'game'); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  if (h === 'cards') return <CardsPage />;
  if (['lobby', 'join', 'draft', 'result', 'trade', 'market', 'sow', 'banner'].includes(h)) return <ScreensPage key={h} h={h} />;
  // #game-人数-ラウンド-置いた数（例 #game-6-10-9）。?s=人数,ラウンド,置いた数,席 でも可
  const m = h.match(/^game-(\d)-(\d+)-(\d+)$/);
  const q = new URLSearchParams(location.search).get('s');
  const [n, round, placed, me] = m ? [+m[1], +m[2], +m[3], -1] : (q ?? '5,7,6,-1').split(',').map(Number);
  return <GameDemo key={h} n={n} round={round} placed={placed} me={me} />;
}

const css = document.createElement('style');
css.textContent = `
.cat-page{padding:16px;min-height:100vh}.cat-page h2{font-size:18px;margin:18px 0 8px}
.cat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px;margin-bottom:12px}
.cat-cards{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}`;
document.head.appendChild(css);

createRoot(document.getElementById('root')!).render(<StrictMode><IconSprite /><App /></StrictMode>);
