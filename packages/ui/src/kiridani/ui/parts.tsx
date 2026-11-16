// 霧谷の画面で使う小さな部品（カード・魔物・資源・コマ・運命の山）
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BossArt, CardBackArt, HeroArt, ItemArt, JobArt, KIcon, MonsterArt, WeatherArt } from '../art-registry';
import { CARDS, CHAR, EL_JP, FATE_DECK, KIND_JP, MON, RACE_JP, RES, RES_JP, WEATHER_JP, type Cost, type ItemDef, type Res } from '../data';
import { monsterDef } from '../reduce';
import type { PlayerView, Seat } from '../types';

export const SEAT_COLORS = ['#E8743B', '#3B8BD9', '#E3B22B', '#2FAE84', '#D16BA5', '#7DC4E8'];
export const SEAT_MARKS = ['●', '▲', '■', '★', '◆', '✚'];

export function Token({ seat, size = 22, dim, injured }: { seat: Seat; size?: number; dim?: boolean; injured?: boolean }) {
  const c = dim ? '#5c566a' : SEAT_COLORS[seat % 6];
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden className="kd-token">
      <circle cx="20" cy="11" r="8" fill={c} stroke="#0b0910" strokeWidth="2" />
      <path d="M7 38 Q8 20 20 20 Q32 20 33 38Z" fill={c} stroke="#0b0910" strokeWidth="2" />
      <text x="20" y="34" textAnchor="middle" fontSize="11" fill="#fff" fontWeight="900">{SEAT_MARKS[seat % 6]}</text>
      {injured && <path d="M4 6 L36 30 M36 6 L4 30" stroke="#F2E6D0" strokeWidth="5" strokeLinecap="round" opacity=".9" />}
    </svg>
  );
}

/** 値が変わるとカウントアップ／ダウンする数 */
export function Num({ value, ms = 500 }: { value: number; ms?: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const a = from.current; const b = value;
    if (a === b) return;
    const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || ms <= 0) { setShown(b); from.current = b; return; }
    const t0 = performance.now(); let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setShown(Math.round(a + (b - a) * p));
      if (p < 1) raf = requestAnimationFrame(tick); else from.current = b;
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); from.current = b; };
  }, [value, ms]);
  return <>{shown}</>;
}

export function ResCount({ r, n, size = 20, anchor, signed }: { r: Res; n: number; size?: number; anchor?: string; signed?: boolean }) {
  return (
    <span className={`kd-rc${n === 0 ? ' is-zero' : ''}`} data-kd={anchor} aria-label={`${RES_JP[r]} ${n}`}>
      <KIcon name={r} size={size} />
      <b aria-hidden>{signed && n > 0 ? '+' : ''}{anchor ? <Num value={n} /> : n}</b>
    </span>
  );
}

export function CostRow({ cost, size = 16, signed }: { cost: Cost; size?: number; signed?: boolean }) {
  const e = RES.filter((r) => cost[r]);
  if (!e.length) return null;
  return <span className="kd-cost">{e.map((r) => <ResCount key={r} r={r} n={cost[r]!} size={size} signed={signed} />)}</span>;
}

export function CardArt({ id, size }: { id: string; size: number }) {
  const c = CARDS[id];
  if (!c) return <CardBackArt id="item" size={size} />;
  return c.kind === 'occ' ? <JobArt id={id} size={size} /> : <ItemArt id={id} size={size} />;
}

/** 職能・品物カードの表 */
export function CardFace({ id, size = 'm', selected, onClick, highlight, disabled, anchor }: {
  id: string; size?: 's' | 'm' | 'l'; selected?: boolean; onClick?: () => void; highlight?: boolean; disabled?: boolean; anchor?: string;
}) {
  const c = CARDS[id];
  if (!c) return <div className={`kd-card is-${size} is-back`} data-kd={anchor}><CardBackArt id="item" size={size === 's' ? 44 : 72} /></div>;
  const it = c.kind !== 'occ' ? (c as ItemDef) : null;
  const body = (
    <>
      <div className="kd-card-art"><CardArt id={id} size={size === 's' ? 44 : size === 'm' ? 76 : 104} /></div>
      <div className="kd-card-body">
        <div className="kd-card-kind">{KIND_JP[c.kind]}{c.quirk && <span className="kd-quirk">★クセ</span>}</div>
        <div className="kd-card-name">{c.name}</div>
        {size !== 's' && <>
          {it && <div className="kd-card-cost"><CostRow cost={it.cost} size={14} />{it.fame > 0 && <span className="kd-fame-s">名声{it.fame}</span>}</div>}
          <p className="kd-card-text">{c.text}</p>
          <div className="kd-card-chars">相性：{c.chars.map((x) => CHAR[x]?.name).join('・')}</div>
        </>}
      </div>
    </>
  );
  const cls = `kd-card is-${size} is-${c.kind}${selected ? ' is-selected' : ''}${highlight ? ' is-hl' : ''}`;
  return onClick
    ? <button type="button" className={cls} onClick={onClick} disabled={disabled} aria-pressed={selected} data-kd={anchor}>{body}</button>
    : <div className={cls} data-kd={anchor}>{body}</div>;
}

/** 魔物カード（強さ・反撃・弱点・種族・戦利品・証・襲撃） */
export function MonsterCard({ id, wounds = 0, compact, shadow, anchor }: { id: string; wounds?: number; compact?: boolean; shadow?: boolean; anchor?: string }) {
  const m = monsterDef(id);
  if (!m) return null;
  const boss = !MON[id];
  const left = Math.max(0, m.str - wounds);
  return (
    <div className={`kd-mon${compact ? ' is-compact' : ''}${shadow ? ' is-shadow' : ''}${boss ? ' is-boss' : ''}`} data-kd={anchor}>
      <div className="kd-mon-art">{boss ? <BossArt id={id} size={compact ? 56 : 88} /> : <MonsterArt id={id} size={compact ? 56 : 88} />}</div>
      {shadow ? <div className="kd-mon-name">次：？？？</div> : <>
        <div className="kd-mon-name">{m.name}</div>
        <div className="kd-mon-stats">
          <span className="kd-stat is-str" title="強さ">⚔{wounds ? <><s>{m.str}</s>{left}</> : m.str}</span>
          <span className="kd-stat is-ctr" title="反撃">↩{m.counter}</span>
          {m.weak && <span className="kd-stat is-weak" title={`弱点：${EL_JP[m.weak]}`}><KIcon name={m.weak} size={14} />{EL_JP[m.weak]}</span>}
          {!compact && <span className="kd-stat">{RACE_JP[m.race]}</span>}
        </div>
        {!compact && <div className="kd-mon-loot"><CostRow cost={m.loot} size={14} /><span className="kd-fame-s">証{m.trophy}</span>{m.raid > 0 && <span className="kd-raid-s">襲撃{m.raid}</span>}</div>}
        {wounds > 0 && <div className="kd-hpbar" aria-label={`残り${left}`}><i style={{ width: `${(left / m.str) * 100}%` }} /></div>}
      </>}
    </div>
  );
}

/** 運命カードの山：残り（明るい）とめくった札（暗い）。全員に公開 */
export function FateDeck({ p, size = 's' }: { p: PlayerView; size?: 's' | 'm' }) {
  // その人の山（職能で中身が変わることがある）＝残り＋めくった札。まだ混ぜていなければ基本の6枚
  const cells = (p.fateLeft.length + p.fateUsed.length ? [...p.fateLeft.map((v) => ({ v, used: false })), ...p.fateUsed.map((v) => ({ v, used: true }))] : FATE_DECK.map((v) => ({ v, used: false })))
    .sort((a, b) => a.v - b.v || Number(a.used) - Number(b.used));
  return (
    <span className={`kd-fate is-${size}`} aria-label={`運命の山 残り ${p.fateLeft.join('、') || 'なし'}`}>
      {cells.map((c, i) => <i key={i} className={`${c.used ? 'is-used' : ''} ${c.v > 0 ? 'is-plus' : c.v < 0 ? 'is-minus' : ''}`}>{c.v > 0 ? `+${c.v}` : c.v}</i>)}
    </span>
  );
}

export function WeatherChip({ id, label, small }: { id?: string; label: string; small?: boolean }) {
  return (
    <span className={`kd-wchip${small ? ' is-small' : ''}`}>
      {id ? <WeatherArt id={id} size={small ? 22 : 30} /> : <span className="kd-wq">?</span>}
      <span><small>{label}</small>{id ? WEATHER_JP[id] : '—'}</span>
    </span>
  );
}

export function HeroBadge({ id, size = 36 }: { id?: string; size?: number }) {
  return id ? <HeroArt id={id} size={size} /> : <CardBackArt id="occ" size={size} />;
}

export function Section({ title, children, extra }: { title: ReactNode; children: ReactNode; extra?: ReactNode }) {
  return <section className="kd-sec"><h3>{title}{extra && <span className="kd-sec-x">{extra}</span>}</h3>{children}</section>;
}
