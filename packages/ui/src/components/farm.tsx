import { FARM_PLOTS, JP, MAX_FAMILY, RES, freePlots, type Player, type Res } from '@midorino/engine';
import { Icon, ResCount, Worker } from './basics';
import type { IconName } from '../icons';

const HOUSE_COLOR = { wood: '#E8B77A', clay: '#E39A6E', stone: '#B9C2C7' } as const;
const HOUSE_JP = { wood: '木', clay: '土', stone: '石' } as const;

type Plot =
  | { kind: 'room' } | { kind: 'field'; crop: 'grain' | 'veg' | null; n: number }
  | { kind: 'pasture'; animal: 'sheep' | 'pig' | 'cattle' | null; n: number } | { kind: 'empty' };

/** エンジンの Player（区画は数だけ）から4×4の並びを作る。家畜は牧場に左から詰める */
export function farmPlots(p: Player, sheepPer = 2): Plot[] {
  const out: Plot[] = [];
  for (let i = 0; i < p.rooms; i++) out.push({ kind: 'room' });
  for (const [crop, n] of p.fields) out.push({ kind: 'field', crop: n ? (crop as 'grain' | 'veg') : null, n });
  const animals: ['sheep' | 'pig' | 'cattle', number, number][] = [
    ['sheep', p.res.sheep, sheepPer], ['pig', p.res.pig, 2], ['cattle', p.res.cattle, 2],
  ];
  let left = p.pastures;
  for (const [a, count, per] of animals) {
    let c = count;
    while (c > 0 && left > 0) { const k = Math.min(per, c); out.push({ kind: 'pasture', animal: a, n: k }); c -= k; left--; }
  }
  for (let i = 0; i < left; i++) out.push({ kind: 'pasture', animal: null, n: 0 });
  while (out.length < FARM_PLOTS) out.push({ kind: 'empty' });
  return out;
}

function plotLabel(pl: Plot, house: Player['house']) {
  switch (pl.kind) {
    case 'room': return `${HOUSE_JP[house]}の部屋`;
    case 'field': return pl.crop ? `畑：${JP[pl.crop]}${pl.n}` : '畑：空き';
    case 'pasture': return pl.animal ? `牧場：${JP[pl.animal]}${pl.n}頭` : '牧場：空き';
    default: return '空き区画（終了時-1点）';
  }
}

/** 4×4の農場。区画の種類は色＋形（屋根・畝・柵）＋読み上げで区別 */
export function FarmBoard({ player, sheepPer, size = 'm' }: { player: Player; sheepPer?: number; size?: 's' | 'm' }) {
  const plots = farmPlots(player, sheepPer);
  return (
    <div className={`mi-farm is-${size}`} role="list" aria-label={`農場：部屋${player.rooms}・畑${player.fields.length}・牧場${player.pastures}・空き${freePlots(player)}`}>
      {plots.map((pl, i) => (
        <div key={i} role="listitem" className={`mi-plot is-${pl.kind}`} aria-label={plotLabel(pl, player.house)}>
          {pl.kind === 'room' && <Icon name="i-room" color={HOUSE_COLOR[player.house]} />}
          {pl.kind === 'field' && pl.crop && <><Icon name={`i-${pl.crop}` as IconName} /><b>{pl.n}</b></>}
          {pl.kind === 'pasture' && pl.animal && <>{Array.from({ length: Math.min(pl.n, 3) }, (_, k) => <Icon key={k} name={`i-${pl.animal}` as IconName} />)}</>}
        </div>
      ))}
    </div>
  );
}

/** 持ち物10種。0は薄く。読み上げは「木材 3」 */
export function ResourceBar({ res, cols = 5, size = 22 }: { res: Record<Res, number>; cols?: number; size?: number }) {
  return (
    <div className="mi-res" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }} role="list" aria-label="持ち物">
      {RES.map((r) => <div key={r} role="listitem"><ResCount res={r} n={res[r]} size={size} /></div>)}
    </div>
  );
}

/** 家族：置ける/置いた/まだ生まれていない */
export function FamilyRow({ seat, family, avail }: { seat: number; family: number; avail: number }) {
  return (
    <div className="mi-family" aria-label={`家族${family}人、今ラウンド残り${avail}人`}>
      {Array.from({ length: MAX_FAMILY }, (_, i) => (
        <span key={i} className={i < avail ? 'is-ready' : i < family ? 'is-used' : 'is-none'}>
          <Worker seat={seat} size={26} dim={i >= family} />
        </span>
      ))}
    </div>
  );
}
