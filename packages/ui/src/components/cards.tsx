import { CHARACTERS, IMPROVEMENTS, JP, SEASON_JP, WEATHER_BY_ID, type Res } from '@midorino/engine';
import { CharacterArt, CHARACTER_LOOKS } from '../art/characters';
import { ImprovementArt } from '../art/improvements';
import { WeatherArt } from '../art/weather';
import { ResCount, Tag } from './basics';
import { seasonOf } from './status';

/** 天候カード。悪天候は赤＋「悪天候」の文字 */
export function WeatherCard({ id, round, note, small }: { id: string; round: number; note?: string; small?: boolean }) {
  const w = WEATHER_BY_ID[id];
  const s = seasonOf(round);
  return (
    <article className={`mi-card mi-wcard${small ? ' is-small' : ''}${w.neg ? ' is-neg' : ''}`} aria-label={`天候 ${w.name}${w.neg ? '（悪天候）' : ''}：${w.text}`}>
      <div className="mi-card-art"><WeatherArt id={id} season={s} width="100%" height="100%" /></div>
      <div className="mi-card-body">
        <h4>{w.name}<Tag tone={s}>{SEASON_JP[s]}</Tag>{w.neg && <Tag tone="bad">悪天候</Tag>}</h4>
        <p>{w.text}</p>
        {note && <p className="mi-card-note">{note}</p>}
      </div>
    </article>
  );
}

/** キャラクターカード（ドラフトでは2枚から選ぶ） */
export function CharacterCard({ id, selected, onSelect, small }: { id: string; selected?: boolean; onSelect?: (id: string) => void; small?: boolean }) {
  const c = CHARACTERS[id];
  const [job, name] = c.name.split('の');
  const Tagname = onSelect ? 'button' : 'article';
  return (
    <Tagname type={onSelect ? 'button' : undefined} className={`mi-card mi-ccard${selected ? ' is-sel' : ''}${small ? ' is-small' : ''}`}
      onClick={onSelect ? () => onSelect(id) : undefined} aria-pressed={onSelect ? !!selected : undefined} aria-label={`${c.name}：${c.text}`}>
      <div className="mi-card-art" style={{ background: CHARACTER_LOOKS[id]?.bg }}><CharacterArt id={id} size={small ? 64 : 96} /></div>
      <div className="mi-card-body">
        <h4><small>{job}の</small>{name}</h4>
        <p>{c.text}</p>
      </div>
    </Tagname>
  );
}

/** 設備カード。買えない理由があれば reason に（例：「粘土が1足りない」） */
export function ImprovementCard({ id, owned, cost, reason, onSelect, selected, small }: {
  id: string; owned?: boolean; cost?: Partial<Record<Res, number>>; reason?: string;
  onSelect?: (id: string) => void; selected?: boolean; small?: boolean;
}) {
  const d = IMPROVEMENTS[id];
  const c = cost ?? d.cost;
  const Tagname = onSelect ? 'button' : 'article';
  return (
    <Tagname type={onSelect ? 'button' : undefined} disabled={onSelect ? !!reason : undefined}
      className={`mi-card mi-icard${d.basic ? ' is-basic' : ''}${selected ? ' is-sel' : ''}${small ? ' is-small' : ''}${reason ? ' is-off' : ''}`}
      onClick={onSelect ? () => onSelect(id) : undefined}
      aria-label={`${d.basic ? '常設設備' : '発展設備'} ${d.name}、${d.vp}点、費用 ${Object.entries(c).map(([r, n]) => `${JP[r as Res]}${n}`).join('・')}：${d.text}${reason ? `。${reason}` : ''}`}>
      <div className="mi-card-art"><ImprovementArt id={id} size={small ? 56 : 84} /><span className="mi-vp">{d.vp}点</span></div>
      <div className="mi-card-body">
        <h4><small>{d.basic ? '常設' : '発展'}</small>{d.name}</h4>
        {!owned && <div className="mi-cost">{Object.entries(c).map(([r, n]) => <ResCount key={r} res={r as Res} n={n!} size={18} />)}</div>}
        <p>{d.text}</p>
        {reason && <p className="mi-card-why">{reason}</p>}
      </div>
    </Tagname>
  );
}
