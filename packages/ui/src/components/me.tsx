import { CHARACTERS, IMPROVEMENTS, scoreBreakdown, type Player } from '@midorino/engine';
import { CharacterArt, CHARACTER_LOOKS } from '../art/characters';
import { Icon, PLAYER_COLORS } from './basics';
import { FamilyRow, FarmBoard, ResourceBar } from './farm';

/** 「わたし」タブ：キャラ・農場・持ち物・家族・設備・いまの得点を一画面に */
export function MyPanel({ player, sheepPer }: { player: Player; sheepPer?: number }) {
  const c = CHARACTERS[player.char];
  const { total, breakdown: b } = scoreBreakdown(player);
  return (
    <section className="mi-me" aria-label="わたしの農場">
      <div className="mi-me-head" style={{ color: PLAYER_COLORS[player.pid] }}>
        <div className="mi-portrait" style={{ background: CHARACTER_LOOKS[player.char]?.bg }}><CharacterArt id={player.char} size={48} /></div>
        <div style={{ color: 'var(--mi-ink)' }}><b>{c.name}</b><p>{c.text}</p></div>
      </div>
      <div className="mi-me-row" style={{ marginTop: 6 }}>
        <FarmBoard player={player} sheepPer={sheepPer} />
        <div className="mi-me-col">
          <h4 className="mi-h">持ち物</h4>
          <ResourceBar res={player.res} cols={3} size={20} />
          <h4 className="mi-h">家族（あと{player.avail}人置ける）</h4>
          <FamilyRow seat={player.pid} family={player.family} avail={player.avail} />
          <h4 className="mi-h">設備</h4>
          <div className="mi-imps">{player.imps.length ? player.imps.map((i) => <span key={i}>{IMPROVEMENTS[i].name}</span>) : <span style={{ opacity: .6 }}>まだなし</span>}</div>
          <p className="mi-score" aria-label={`いまの得点 ${total}点。空き区画 ${b.empty}点、借り ${b.begging}点`}>
            <Icon name="i-vp" size={20} />いま <b>{total}</b>点
            {b.empty < 0 && <span className="is-bad">空き区画{b.empty}</span>}
            {b.begging < 0 && <span className="is-bad">借り{b.begging}</span>}
          </p>
        </div>
      </div>
    </section>
  );
}
