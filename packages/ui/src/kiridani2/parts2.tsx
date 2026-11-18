// 霧谷 v2 — 小さな部品（カード・魔物・リーダーの絵）。見た目は v1 の部品とクラスをそのまま使う。
import { BossArt, CardBackArt, KIcon, MonsterArt } from '../kiridani/art-registry';
import { MONSTER_IDS, BOSS_IDS } from '../kiridani/art';
import { CardPicture, kindOf } from './art2';
import { InfoDot } from '../kiridani/ui/inspect';
import { CostRow } from '../kiridani/ui/parts';
import { DATA, FLAVOR, type Monster } from '@midorino/engine/src/kiridani2';
import { ANC2, CARD2, QUEST2 } from './view';
import { createContext, useContext } from 'react';
import { endFameBase, pointScale } from '@midorino/engine/src/kiridani2/uihelp';

/** いまの試合の年数（終わりの名声の倍率を出すため。試合の外では undefined） */
export const YearsCtx = createContext<number | undefined>(undefined);

/** 終わりの名声（game_end の効果・秘密依頼）の倍率の注記。年数が分かればその値、分からなければ倍率の決まり */
export function endFameNote(id: string, years: number | undefined): string | null {
  const base = endFameBase(CARD2[id] ?? QUEST2[id]);
  if (!base) return null;
  if (!years) return `終わりの名声は10年の試合で×${DATA.POINT_SCALE[10]}・15年で×${DATA.POINT_SCALE[15]}`;
  const sc = pointScale(years);
  return sc > 1 ? `${years}年の試合なので終わりの名声×${sc}（+${base}→+${base * sc}）` : null;
}

export const KIND2_JP: Record<string, string> = { leader: 'リーダー', occ: '職能', weapon: '武具', armor: '防具', tool: '道具', spell: '秘術', gear: '共通の装備', stage: '段階', ancient: '古代の品', quest: '依頼' };
const KIND_CLASS: Record<string, string> = { leader: 'occ', occ: 'occ', weapon: 'weapon', armor: 'weapon', gear: 'weapon', tool: 'tool', spell: 'spell', stage: 'tool' };
export const ENGINE_JP: Record<string, string> = {
  hunt: '狩り', gather: '採集', trade: '交易', fort: '守り', smith: '鍛冶', family: '家族', arcane: '秘術', beast: '獣使い', quest: '依頼', ally: '共闘', ruins: '遺跡', boss: '主狩り', bridge: '橋渡し',
};

const hash = (s: string) => { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
const pick = <T,>(xs: T[], id: string) => xs[hash(id) % xs.length];

/** リーダーの絵（絵の画像があればそれ、無ければ v1 の団長の絵） */
export function LeaderArt({ id, size = 40 }: { id?: string; size?: number }) {
  if (!id) return <CardBackArt id="occ" size={size} />;
  return <CardPicture id={id} kind="leader" size={size} />;
}

/** カードの絵（絵の画像 cards/<id>.webp があればそれ、無ければ種類の合う v1 の絵）。種類の縁取りと強い動きの札を重ねる */
export function CardArt2({ id, size }: { id: string; size: number }) {
  const k = kindOf(id);
  if (!k) return <CardBackArt id="item" size={size} />;
  return <CardPicture id={id} kind={k} size={size} />;
}

/** カードの表（職能・品物・リーダー・共通の装備・段階カード） */
export function CardFace2({ id, size = 'm', selected, onClick, disabled, anchor }: { id: string; size?: 's' | 'm' | 'l'; selected?: boolean; onClick?: () => void; disabled?: boolean; anchor?: string }) {
  const years = useContext(YearsCtx);
  const c = CARD2[id];
  const q = QUEST2[id];
  const a = ANC2[id];
  if (!c && !q && !a) return <div className={`kd-card is-${size} is-back`} data-kd={anchor}><CardBackArt id="item" size={size === 's' ? 44 : 72} /></div>;
  const ins = `card2:${id}`;
  const name = c?.name ?? q?.name ?? a?.name;
  const kind = c?.kind ?? (q ? 'quest' : 'ancient');
  const text = c?.text ?? q?.text ?? a?.text;
  const stats = c ? [c.power ? `戦力+${c.power}` : '', c.guard ? `守り+${c.guard}` : '', c.rear ? '後衛' : '', c.two_hand ? '両手' : '', c.leader_only ? 'リーダー専用' : ''].filter(Boolean) : [];
  const body = (
    <>
      <div className="kd-card-art"><CardArt2 id={id} size={size === 's' ? 44 : size === 'm' ? 76 : 104} /></div>
      <div className="kd-card-body">
        <div className="kd-card-kind">{KIND2_JP[kind]}{c?.engine?.length ? <span className="kd-quirk">{c.engine.map((e) => ENGINE_JP[e] ?? e).join('・')}</span> : null}</div>
        <div className="kd-card-name">{name}</div>
        {size !== 's' && <>
          {(c?.cost || c?.fame || stats.length > 0) && <div className="kd-card-cost">{c?.cost && <CostRow cost={c.cost} size={14} />}{c?.fame ? <span className="kd-fame-s">名声{c.fame}</span> : null}{stats.map((s) => <span key={s} className="kd-fame-s">{s}</span>)}</div>}
          <p className="kd-card-text">{text}</p>
          {endFameNote(id, years) && <p className="kd2-scale">{endFameNote(id, years)}</p>}
          {size === 'l' && FLAVOR[id] && <p className="kd2-flavor">{FLAVOR[id]}</p>}
          {q && <div className="kd-card-chars">{q.secret ? `秘密依頼・名声${(q.fame ?? DATA.SECRET_FAME) * pointScale(years)}` : `共通の依頼・先着 ${DATA.QUEST_FAME.join('・')}`}</div>}
        </>}
      </div>
    </>
  );
  const cls = `kd-card is-${size} is-${KIND_CLASS[kind] ?? 'tool'}${selected ? ' is-selected' : ''}`;
  return onClick
    ? <button type="button" className={cls} onClick={onClick} disabled={disabled} aria-pressed={selected} data-kd={anchor} data-inspect={ins}>{body}<InfoDot target={ins} label={`${name}をくわしく`} /></button>
    : <div className={cls} data-kd={anchor} data-inspect={ins} role="button" tabIndex={0} aria-label={`${name}：タップで詳しく`}>{body}</div>;
}

/** 小さなカード札 */
export function CardChip2({ id, highlight }: { id: string; highlight?: boolean }) {
  const c = CARD2[id] ?? ANC2[id] ?? QUEST2[id];
  if (!c) return <span className="kd-cchip is-back"><CardBackArt id="item" size={20} /></span>;
  const kind = (c as { kind: string }).kind;
  return (
    <span className={`kd-cchip is-${KIND_CLASS[kind] ?? 'tool'}${highlight ? ' is-hl' : ''}`} data-inspect={`card2:${id}`} role="button" tabIndex={0} aria-label={`${c.name}：タップで詳しく`}>
      <CardArt2 id={id} size={22} /><span>{c.name}</span>
    </span>
  );
}

const hasMonArt = (t: string) => MONSTER_IDS.includes(t);
export function MonArt({ m, size }: { m: { type: string; boss?: boolean; race?: string }; size: number }) {
  if (m.boss || m.type.startsWith('b_')) return BOSS_IDS.includes(m.type) ? <BossArt id={m.type} size={size} /> : <BossArt id={pick(BOSS_IDS, m.type)} size={size} />;
  return hasMonArt(m.type) ? <MonsterArt id={m.type} size={size} /> : <MonsterArt id={pick(MONSTER_IDS.filter((x) => x.length > 3 || true), m.type)} size={size} />;
}

/** 魔物カード（くじで決まった強さ・反撃・戦利品・証・襲撃） */
export function MonsterCard2({ m, compact, shadow, anchor }: { m: Monster; compact?: boolean; shadow?: boolean; anchor?: string }) {
  const left = Math.max(0, m.str - m.wounds);
  return (
    <div className={`kd-mon${compact ? ' is-compact' : ''}${shadow ? ' is-shadow' : ''}${m.boss ? ' is-boss' : ''}`} data-kd={anchor} data-inspect={`mon2:${m.uid}`}>
      <div className="kd-mon-art"><MonArt m={m} size={compact ? 56 : 88} /></div>
      <div className="kd-mon-name">{m.name}</div>
      <div className="kd-mon-stats">
        <span className="kd-stat is-str" title="強さ">⚔{m.wounds ? <><s>{m.str}</s>{left}</> : m.str}</span>
        <span className="kd-stat is-ctr" title="反撃">↩{m.counter}</span>
        {m.weak && <span className="kd-stat is-weak" title="弱点"><KIcon name={m.weak} size={14} /></span>}
        {!compact && <span className="kd-stat"><KIcon name={m.race} size={14} /></span>}
      </div>
      {!compact && <div className="kd-mon-loot"><CostRow cost={m.loot} size={14} /><span className="kd-fame-s">証{m.trophy}</span>{m.raid > 0 && <span className="kd-raid-s">襲撃{m.raid}</span>}</div>}
      {m.wounds > 0 && <div className="kd-hpbar" aria-label={`残り${left}`}><i style={{ width: `${(left / m.str) * 100}%` }} /></div>}
    </div>
  );
}
