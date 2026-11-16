// 霧谷の冒険者団 画面カタログ：台本の試合（SampleGame）を最後まで流して、画面と演出をエンジン無しで確かめる。
//   kiridani.html                     … 最初から（自動で進む）
//   ?n=6&seed=3&manual=1              … 6人・自分の番は自分で選ぶ（演出中でも先に選べる）
//   ?at=draft|char|r5|combat|winter|boss|final … その場面の直前まで一気に進めてから再生
//   ?speed=fast|minimal               … 演出の速さ
//   #gallery                          … 仮の絵の一覧（本番の絵に差し替えたときの確認用）
import { StrictMode, useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/kiridani/kiridani.css';
import {
  BOSS, CHARACTERS, EFFECT_IDS, ITEMS, KIcon, MONSTERS, OCCUPATIONS, SampleGame, WEATHER_JP, KiridaniTable, useTable,
  BossArt, CardBackArt, EffectArt, HeroArt, ItemArt, JobArt, MonsterArt, NestScene, TerrainArt, WeatherArt, WeatherScene, ACTIONS,
  type Ask, type GameEvent, type Speed,
} from '../src/kiridani';
import { KICON_NAMES } from '../src/kiridani/art-registry';

const q = new URLSearchParams(location.search);
const N = Math.min(6, Math.max(3, Number(q.get('n') ?? 4)));
const SEED = Number(q.get('seed') ?? 5);
const AT = q.get('at') ?? '';
const SPEED = (q.get('speed') as Speed | null) ?? 'normal';

/** その場面の最初の出来事か */
function isTarget(at: string, e: GameEvent, me: number): boolean {
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

function Demo() {
  const me = 0;
  const t = useTable(me, { speed: SPEED });
  const [n, setN] = useState(N);
  const [manual, setManual] = useState(q.get('manual') === '1');
  const manualRef = useRef(manual);
  manualRef.current = manual;
  const gRef = useRef<SampleGame | null>(null);
  const [ask, setAsk] = useState<Ask | null>(null);

  const feed = useCallback((evs: GameEvent[]) => {
    const g = gRef.current!;
    t.push(evs);
    if (g.done) { setAsk(null); return; }
    const w = g.waiting;
    if (!w) return;
    if (!manualRef.current) {
      // 自動：演出が終わってから次へ（演出キューに預ける）
      t.submit(() => feed(g.advance()));
    } else setAsk({ kind: w.kind, options: w.options });
  }, [t]);

  const start = useCallback((players: number, at: string) => {
    const g = new SampleGame(players, SEED, me);
    gRef.current = g;
    t.reset(me);
    setAsk(null);
    if (!at) { feed(g.advance()); return; }
    // その場面まで自動で進め、手前までは演出なしで当てる
    const before: GameEvent[] = [];
    let chunk = g.advance();
    for (;;) {
      const i = chunk.findIndex((e) => isTarget(at, e, me));
      if (i >= 0) { before.push(...chunk.slice(0, i)); t.load(before); feed(chunk.slice(i)); return; }
      before.push(...chunk);
      if (g.done) { t.load(before); return; }
      chunk = g.advance();
    }
  }, [feed, t]);

  useEffect(() => { start(n, AT); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onAnswer = (c: string) => {
    const g = gRef.current!;
    t.submit(() => { setAsk(null); feed(g.advance(c)); });
  };

  const extra = (
    <details className="kd-cat-menu">
      <summary aria-label="カタログの設定">⚙</summary>
      <div>
        <label>人数 <select value={n} onChange={(e) => { const v = Number(e.target.value); setN(v); start(v, ''); }}>{[3, 4, 5, 6].map((x) => <option key={x}>{x}</option>)}</select></label>
        <label><input type="checkbox" checked={manual} onChange={(e) => { setManual(e.target.checked); manualRef.current = e.target.checked; if (!e.target.checked && ask) onAnswer(ask.options[0]); }} /> 自分の番は自分で選ぶ</label>
        <span>場面へ：</span>
        {[['draft', 'ドラフト'], ['char', 'キャラ'], ['r1', '1R'], ['combat', '戦闘'], ['r4', '冬'], ['boss', '主'], ['r9', '3年目'], ['final', '集計']].map(([k, l]) => (
          <button key={k} type="button" onClick={() => start(n, k)}>{l}</button>
        ))}
        <a href="#gallery" onClick={() => setTimeout(() => location.reload(), 0)}>仮の絵の一覧</a>
        <a href="./index.html">農場版カタログ</a>
        <small>最近の音：{t.sound.history.slice(-4).join(' / ') || '—'}（音のファイルはまだ無いので無音）</small>
      </div>
    </details>
  );

  return <KiridaniTable t={t} ask={ask} onAnswer={onAnswer} extra={extra} />;
}

function Gallery() {
  const G = ({ title, children }: { title: string; children: React.ReactNode }) => <section className="kd-sec"><h3>{title}</h3><div className="kd-gal">{children}</div></section>;
  const Cell = ({ label, children }: { label: string; children: React.ReactNode }) => <figure>{children}<figcaption>{label}</figcaption></figure>;
  return (
    <div className="kd-root"><main className="kd-main" style={{ paddingBottom: 40 }}>
      <h1 style={{ fontFamily: 'var(--kd-title)', fontWeight: 400 }}>仮の絵の一覧 <a href="./kiridani.html" style={{ fontSize: 14, color: 'var(--kd-gold-l)' }}>← 試合へ</a></h1>
      <p className="kd-hint">すべて src/kiridani/art-registry.tsx を通して引いている。本番の絵に替えるとこの一覧もそのまま替わる。</p>
      <G title="キャラクター（HeroArt）">{CHARACTERS.map((c) => <Cell key={c.id} label={`${c.id} ${c.name}`}><HeroArt id={c.id} size={88} /></Cell>)}</G>
      <G title="魔物（MonsterArt）">{MONSTERS.map((m) => <Cell key={m.id} label={`${m.id} ${m.name}`}><MonsterArt id={m.id} size={88} /></Cell>)}</G>
      <G title="主・古竜（BossArt）">{Object.values(BOSS).map((m) => <Cell key={m.id} label={`${m.id} ${m.name}`}><BossArt id={m.id} size={110} /></Cell>)}</G>
      <G title="職能（JobArt）">{OCCUPATIONS.map((c) => <Cell key={c.id} label={`${c.id} ${c.name}`}><JobArt id={c.id} size={72} /></Cell>)}</G>
      <G title="品物（ItemArt）">{ITEMS.map((c) => <Cell key={c.id} label={`${c.id} ${c.name}`}><ItemArt id={c.id} size={72} /></Cell>)}</G>
      <G title="天候（WeatherScene / WeatherArt）">{Object.keys(WEATHER_JP).map((w) => <Cell key={w} label={`${w} ${WEATHER_JP[w]}`}><WeatherScene id={w} width={140} /><WeatherArt id={w} size={36} /></Cell>)}</G>
      <G title="巣（NestScene）">{['nest_forest', 'nest_cave', 'nest_swamp', 'nest_mount', 'lair'].map((id) => <Cell key={id} label={id}><NestScene id={id} width={160} /></Cell>)}</G>
      <G title="行動スペース（TerrainArt）">{ACTIONS.map((a) => <Cell key={a.id} label={`${a.id} ${a.name}`}><TerrainArt id={a.id} size={64} /></Cell>)}</G>
      <G title="演出（EffectArt）">{EFFECT_IDS.map((id) => <Cell key={id} label={id}><EffectArt id={id} size={64} /></Cell>)}</G>
      <G title="アイコン（KIcon）">{KICON_NAMES.map((id) => <Cell key={id} label={id}><KIcon name={id} size={36} /></Cell>)}<Cell label="card back occ"><CardBackArt id="occ" size={48} /></Cell><Cell label="card back item"><CardBackArt id="item" size={48} /></Cell></G>
    </main></div>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode>{location.hash === '#gallery' ? <Gallery /> : <Demo />}</StrictMode>);
