import { CHARACTERS, freePlots, score, type Player } from '@midorino/engine';
import { Icon, PLAYER_MARKS, Worker } from './basics';

/** 「みんな」タブ：全員の農場を1つの表で見比べる */
export function PlayersOverview({ players, names, mySeat }: { players: Player[]; names: string[]; mySeat?: number }) {
  const cols: { key: string; head: React.ReactNode; label: string; get: (p: Player) => React.ReactNode }[] = [
    { key: 'vp', head: <Icon name="i-vp" size={20} />, label: '点数', get: (p) => <b>{score(p)}</b> },
    { key: 'fam', head: <Icon name="i-worker" size={20} color="#9AA3A8" />, label: '家族', get: (p) => p.family },
    { key: 'room', head: <Icon name="i-room" size={20} color="#E8B77A" />, label: '部屋', get: (p) => `${p.rooms}${{ wood: '木', clay: '土', stone: '石' }[p.house]}` },
    { key: 'field', head: <Icon name="i-field" size={20} />, label: '畑', get: (p) => p.fields.length },
    { key: 'past', head: <Icon name="i-pasture" size={20} />, label: '牧場', get: (p) => p.pastures },
    { key: 'ani', head: <Icon name="i-sheep" size={20} />, label: '家畜（羊/豚/牛）', get: (p) => `${p.res.sheep}/${p.res.pig}/${p.res.cattle}` },
    { key: 'food', head: <Icon name="i-food" size={20} />, label: '食料', get: (p) => p.res.food },
    { key: 'empty', head: '空', label: '空き区画', get: (p) => freePlots(p) },
  ];
  return (
    <table className="mi-overview">
      <caption className="mi-sr">全員の農場の比較</caption>
      <thead><tr><th scope="col">プレイヤー</th>{cols.map((c) => <th key={c.key} scope="col" aria-label={c.label} title={c.label}>{c.head}</th>)}</tr></thead>
      <tbody>
        {players.map((p) => (
          <tr key={p.pid} className={p.pid === mySeat ? 'is-me' : ''}>
            <th scope="row"><Worker seat={p.pid} size={22} /><span>{PLAYER_MARKS[p.pid]}{p.pid === mySeat ? 'あなた' : names[p.pid]}<small>{CHARACTERS[p.char]?.name.split('の')[1]}</small></span></th>
            {cols.map((c) => <td key={c.key}>{c.get(p)}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
