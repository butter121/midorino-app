import { NUM_ROUNDS, SEASONS, SEASON_JP, WEATHER_BY_ID, type Season } from '@midorino/engine';
import { Icon, Tag } from './basics';
import type { IconName } from '../icons';

const SEASON_ICON: Record<Season, IconName> = { spring: 's-spring', summer: 's-summer', autumn: 's-autumn', winter: 's-winter' };
export const seasonOf = (round: number): Season => SEASONS[(round - 1) % 4];

/** ラウンドの終わりに起きること */
export function roundEvent(round: number): string | null {
  const s = seasonOf(round);
  if (s === 'summer') return '収穫';
  if (s === 'autumn') return '収穫・繁殖';
  if (s === 'winter') return '冬越し';
  return null;
}

/** 天候IDの絵文字代わりのアイコン（小さい表示用） */
export function weatherIcon(id: string): IconName {
  const m: Record<string, IconName> = {
    harusame: 'w-rain', megumi: 'w-rain', nagaame: 'w-rain', yudachi: 'w-rain',
    osojimo: 'w-frost', hanabie: 'w-frost', hideri: 'w-drought', mosho: 'w-drought',
    yoshun: 'w-sun', hareten: 'w-sun', akibare: 'w-sun', hosaku: 'w-sun', dantou: 'w-sun',
    taifu: 'w-typhoon', oyuki: 'w-snow', kanpa: 'w-snow', fubuki: 'w-snow', fuyunoichi: 'w-snow',
  };
  return m[id] ?? 'w-calm';
}

function WeatherChip({ id, label, round }: { id: string; label: string; round: number }) {
  const w = WEATHER_BY_ID[id];
  return (
    <div className="mi-wchip" aria-label={`${label}の天気：${w.name}${w.neg ? '（悪天候）' : ''}。${w.text}`}>
      <Icon name={weatherIcon(id)} size={30} />
      <div><span className="mi-wchip-lb">{label}・{SEASON_JP[seasonOf(round)]}</span><b>{w.name}</b>{w.neg && <Tag tone="bad">悪天候</Tag>}</div>
    </div>
  );
}

/** 12ラウンドのすごろく。収穫と冬越しの位置が一目でわかる */
export function SeasonTrack({ round }: { round: number }) {
  return (
    <ol className="mi-track" aria-label={`ラウンド ${round} / ${NUM_ROUNDS}`}>
      {Array.from({ length: NUM_ROUNDS }, (_, i) => {
        const r = i + 1; const s = seasonOf(r); const ev = roundEvent(r);
        return (
          <li key={r} className={`is-${s}${r === round ? ' is-now' : ''}${r < round ? ' is-past' : ''}`}
            aria-current={r === round ? 'step' : undefined} title={`R${r} ${SEASON_JP[s]}${ev ? `・終わりに${ev}` : ''}`}>
            <span>{r}</span>{ev && <i aria-hidden>{ev === '冬越し' ? '冬' : '収'}</i>}
          </li>
        );
      })}
    </ol>
  );
}

export interface Alert { tone: 'bad' | 'warn' | 'leaf'; text: string }

/** 画面上部の状況バー：いま何ラウンドか・天気・次の節目・自分への注意 */
export function StatusBar({ round, weather, forecast, alerts = [] }: {
  round: number; weather: string; forecast: string[]; alerts?: Alert[];
}) {
  const s = seasonOf(round);
  const year = Math.floor((round - 1) / 4) + 1;
  const ev = roundEvent(round);
  let nextWinter = round; while (seasonOf(nextWinter) !== 'winter') nextWinter++;
  return (
    <header className={`mi-status is-${s}`}>
      <div className="mi-status-row">
        <div className="mi-status-title">
          <Icon name={SEASON_ICON[s]} size={30} />
          <div><small>{year}年目</small><h1>{SEASON_JP[s]}<span> R{round}/{NUM_ROUNDS}</span></h1></div>
        </div>
        <div className="mi-status-wx">
          <WeatherChip id={weather} label="今日" round={round} />
          {forecast.map((f, i) => <WeatherChip key={i} id={f} label={i === 0 ? '次' : '次の次'} round={round + i + 1} />)}
        </div>
      </div>
      <SeasonTrack round={round} />
      <ul className="mi-alerts">
        <li className="is-info">{ev ? <>終わりに<b>{ev}</b></> : <>冬越しまで あと<b>{nextWinter - round}</b>ラウンド</>}</li>
        {alerts.map((a, i) => <li key={i} className={`is-${a.tone}`}>{a.tone === 'bad' ? '⚠ ' : ''}{a.text}</li>)}
      </ul>
    </header>
  );
}
