import { ACT, JP, type Cost, type Res } from '@midorino/engine';
import { Icon, PLAYER_MARKS, RES_ICON, Worker } from './basics';
import type { IconName } from '../icons';

// ---------------------------------------------------------------- プレイヤー一覧
export interface PlayerChip {
  seat: number; name: string; vp: number; left: number; total: number;
  isTurn?: boolean; isFirst?: boolean; isMe?: boolean; offline?: boolean; foodShort?: number;
}

/** 全員の状況（手番・先手・残りコマ・点数）を横一列で */
export function PlayerStrip({ players, onSelect }: { players: PlayerChip[]; onSelect?: (seat: number) => void }) {
  return (
    <ul className={`mi-players n${players.length}`} aria-label="プレイヤー">
      {players.map((p) => (
        <li key={p.seat}>
          <button type="button" className={`mi-pl${p.isTurn ? ' is-turn' : ''}${p.offline ? ' is-off' : ''}`} onClick={() => onSelect?.(p.seat)}
            aria-label={`${p.name}${p.isMe ? '（あなた）' : ''}、${p.vp}点、コマ残り${p.left}/${p.total}${p.isTurn ? '、手番' : ''}${p.isFirst ? '、先手' : ''}${p.offline ? '、接続切れ' : ''}`}>
            {p.isFirst && <span className="mi-pl-first" aria-hidden>先手</span>}
            {p.isTurn && <span className="mi-pl-turn" aria-hidden>番</span>}
            <Worker seat={p.seat} size={28} />
            <span className="mi-pl-nm" aria-hidden>{PLAYER_MARKS[p.seat]}{p.isMe ? 'あなた' : p.name}</span>
            <span className="mi-pl-vp" aria-hidden>{p.vp}点</span>
            <span className="mi-pl-dots" aria-hidden>
              {Array.from({ length: p.total }, (_, i) => <i key={i} className={i < p.left ? '' : 'u'} />)}
            </span>
            {!!p.foodShort && <span className="mi-pl-warn" aria-hidden>食料-{p.foodShort}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------- アクションボード
export interface SpaceView {
  id: string;
  /** たまっている量（積み増しスペース） */
  accum?: Cost;
  /** 置いている人の席番号（あぜ道は複数） */
  by?: number[];
  /** 自分が今置けるか */
  available: boolean;
  /** 置けない理由（「ラウンド5から」「石切場は吹雪で使えない」「空き部屋がない」など） */
  reason?: string;
  /** 天候などによるおまけの一言（「春雨で+2」） */
  bonus?: string;
}

/** スペースを目的別にまとめる（迷わず探せるように） */
export const SPACE_GROUPS: { title: string; short: string; icon: IconName; ids: string[] }[] = [
  { title: '資材を集める', short: '資材', icon: 'i-wood', ids: ['forest', 'forest2', 'forest3', 'claypit', 'claypit2', 'quarry'] },
  { title: '食料・お金', short: '食料・お金', icon: 'i-food', ids: ['start', 'river', 'marsh', 'daylabor', 'peddler', 'lane'] },
  { title: '畑と家畜', short: '畑・家畜', icon: 'i-field', ids: ['seed', 'garden', 'plow', 'plow2', 'sow', 'plowsow', 'fence', 'sheep', 'pig', 'cattle'] },
  { title: '家と家族', short: '家・家族', icon: 'i-room', ids: ['build', 'renovate', 'family', 'family2'] },
  { title: '市場・設備', short: '市場・設備', icon: 'i-stall', ids: ['market', 'market2', 'workshop'] },
];

const SPACE_ICONS: Record<string, IconName[]> = {
  start: ['i-food', 'i-coin'], daylabor: ['i-coin'], seed: ['i-grain'], garden: ['i-veg'], peddler: ['i-coin', 'i-grain'],
  lane: ['i-food'], marsh: ['i-food', 'i-coin'], plow: ['i-field'], plow2: ['i-field'], sow: ['i-grain', 'i-veg'],
  plowsow: ['i-field', 'i-grain'], fence: ['i-pasture'], build: ['i-room'], renovate: ['i-room', 'i-tool'],
  family: ['i-baby'], family2: ['i-baby'], workshop: ['i-tool'], market: ['i-stall'], market2: ['i-stall'],
};

const costText = (c: Cost, sep = '・') => Object.entries(c).map(([r, n]) => `${JP[r as Res]}${n}`).join(sep);

/** スペースの効果の短い説明 */
export function spaceEffect(id: string): string {
  const a = ACT[id];
  if (a.accum) return `${costText(a.accum)}ずつたまる${a.give ? `＋${costText(a.give)}` : ''}`;
  if (a.give) return costText(a.give) + (a.unlimited ? '・何人でも' : '');
  return (a.text ?? '').replace(/（.*?）/g, '');
}

export function ActionSpace({ s, selected, onPick }: { s: SpaceView; selected?: boolean; onPick?: (id: string) => void }) {
  const a = ACT[s.id];
  const accum = s.accum && Object.entries(s.accum).filter(([, n]) => n);
  const icons = SPACE_ICONS[s.id] ?? (a.accum ? Object.keys(a.accum).map((r) => RES_ICON[r as Res]) : []);
  const taken = !!s.by?.length && !a.unlimited;
  const label = `${a.name}：${spaceEffect(s.id)}${accum?.length ? `。いま ${costText(Object.fromEntries(accum))}` : ''}${taken ? '。使用中' : ''}${!s.available && s.reason ? `。${s.reason}` : ''}`;
  return (
    <button type="button" className={`mi-sp${taken ? ' is-taken' : ''}${!s.available ? ' is-off' : ''}${selected ? ' is-sel' : ''}${a.unlimited ? ' is-wide' : ''}`}
      disabled={!s.available} aria-pressed={selected} aria-label={label} onClick={() => onPick?.(s.id)}>
      {!!accum?.length && (
        <span className="mi-sp-acc" aria-hidden>{accum.map(([r, n]) => <span key={r}><Icon name={RES_ICON[r as Res]} size={18} />{n}</span>)}</span>
      )}
      <span className="mi-sp-ic" aria-hidden>{icons.map((ic, i) => <Icon key={i} name={ic} size={26} />)}</span>
      <span className="mi-sp-nm" aria-hidden>{a.name}</span>
      <span className="mi-sp-ef" aria-hidden>{s.bonus ? <em>{s.bonus}</em> : spaceEffect(s.id)}</span>
      {!s.available && s.reason && !taken && <span className="mi-sp-why" aria-hidden>{s.reason}</span>}
      {!!s.by?.length && (
        <span className="mi-sp-by" aria-hidden>{s.by.map((seat, i) => <Worker key={i} seat={seat} size={a.unlimited ? 24 : 30} />)}</span>
      )}
    </button>
  );
}

/** アクションボード全体。spaces に無いIDのスペース（人数で出ないもの）は表示しない */
export function ActionBoard({ spaces, selected, onPick, rows }: {
  spaces: SpaceView[]; selected?: string | null; onPick?: (id: string) => void;
  /** 横向きのとき1列に並べる段数（省略時：6人用ボードは6段、それ以外は5段） */
  rows?: number;
}) {
  const byId = Object.fromEntries(spaces.map((s) => [s.id, s]));
  const R = rows ?? (spaces.length > 26 ? 6 : 5);
  return (
    <div className="mi-board" style={{ ['--rows' as string]: R }}>
      {SPACE_GROUPS.map((g) => {
        const list = g.ids.filter((id) => byId[id]);
        if (!list.length) return null;
        const open = list.filter((id) => byId[id].available).length;
        return (
          <section key={g.title} className="mi-board-group" aria-label={g.title} style={{ ['--cols' as string]: Math.ceil(list.length / R) }}>
            <h3><Icon name={g.icon} size={20} /><span className="mi-long">{g.title}</span><span className="mi-short">{g.short}</span><small>置ける {open}/{list.length}</small></h3>
            <div className="mi-board-grid">
              {list.map((id) => <ActionSpace key={id} s={byId[id]} selected={selected === id} onPick={onPick} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}
