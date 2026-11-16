// 霧谷の冒険者団：アプリの入口。タイトル画面で人数と AI の強さを選び、あなた＋AI の試合を始める。
import { useState } from 'react';
import { KiridaniEngineGame, HeroArt } from '@midorino/ui/src/kiridani';
import '@midorino/ui/src/kiridani/kiridani.css';
import './kiridani-app.css';

type Level = 'novice' | 'mid' | 'expert';
const LEVELS: [Level, string][] = [['novice', 'やさしい'], ['mid', 'ふつう'], ['expert', 'つよい']];
const HEROES = ['toma', 'mina', 'goro', 'nana'];

function load<T>(k: string, d: T): T { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } }
function save(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 保存できなくても遊べる */ } }

export default function KiridaniApp() {
  const [n, setN] = useState<number>(() => load('kd.n', 4));
  const [level, setLevel] = useState<Level>(() => load('kd.level', 'mid'));
  const [game, setGame] = useState<{ seed: number; key: number } | null>(null);

  const start = () => { save('kd.n', n); save('kd.level', level); setGame({ seed: Math.floor(Math.random() * 1e6), key: Date.now() }); };

  if (game) {
    return (
      <KiridaniEngineGame key={game.key} n={n} seed={game.seed} level={level}
        extra={() => (
          <details className="kd-cat-menu">
            <summary aria-label="メニュー">⚙</summary>
            <div>
              <button type="button" className="kd-btn" onClick={start}>新しい試合</button>
              <button type="button" className="kd-btn" onClick={() => setGame(null)}>タイトルへ</button>
            </div>
          </details>
        )} />
    );
  }

  return (
    <div className="kd-root kda-title">
      <div className="kda-heroes" aria-hidden="true">
        {HEROES.map((id) => <HeroArt key={id} id={id} size={72} />)}
      </div>
      <h1 className="kda-name">霧谷の冒険者団</h1>
      <p className="kda-sub">霧の谷で仲間を集め、魔物を討ち、名声を競う。</p>
      <fieldset className="kda-group">
        <legend>人数（あなた＋AI）</legend>
        <div className="kda-seg">
          {[3, 4, 5, 6].map((x) => (
            <button key={x} type="button" className={x === n ? 'is-on' : ''} aria-pressed={x === n} onClick={() => setN(x)}>{x}人</button>
          ))}
        </div>
      </fieldset>
      <fieldset className="kda-group">
        <legend>AIの強さ</legend>
        <div className="kda-seg">
          {LEVELS.map(([v, jp]) => (
            <button key={v} type="button" className={v === level ? 'is-on' : ''} aria-pressed={v === level} onClick={() => setLevel(v)}>{jp}</button>
          ))}
        </div>
      </fieldset>
      <button type="button" className="kd-btn kda-start" onClick={start}>冒険をはじめる</button>
    </div>
  );
}
