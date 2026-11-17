// 霧谷 v2 — 小さな部品（カード・魔物・リーダーの絵）。見た目は v1 の部品とクラスをそのまま使う。
import { BossArt, CardBackArt, HeroArt, ItemArt, JobArt, KIcon, MonsterArt } from '../kiridani/art-registry';
import { HERO_IDS, ITEM_IDS, ITEM_KIND, JOB_IDS, MONSTER_IDS, BOSS_IDS } from '../kiridani/art';
import { InfoDot } from '../kiridani/ui/inspect';
import { CostRow } from '../kiridani/ui/parts';
import { DATA, type Monster } from '@midorino/engine/src/kiridani2';
import { ANC2, CARD2, QUEST2 } from './view';

export const KIND2_JP: Record<string, string> = { leader: 'リーダー', occ: '職能', weapon: '武具', armor: '防具', tool: '道具', spell: '秘術', gear: '共通の装備', stage: '段階', ancient: '古代の品', quest: '依頼' };
const KIND_CLASS: Record<string, string> = { leader: 'occ', occ: 'occ', weapon: 'weapon', armor: 'weapon', gear: 'weapon', tool: 'tool', spell: 'spell', stage: 'tool' };
export const ENGINE_JP: Record<string, string> = {
  hunt: '狩り', gather: '採集', trade: '交易', fort: '守り', smith: '鍛冶', family: '家族', arcane: '秘術', beast: '獣使い', quest: '依頼', ally: '共闘', ruins: '遺跡', boss: '主狩り', bridge: '橋渡し',
};

const hash = (s: string) => { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
const pick = <T,>(xs: T[], id: string) => xs[hash(id) % xs.length];
const JOBS = JOB_IDS.filter((x) => /^o\d+$/.test(x));
const ITEMS_BY: Record<string, string[]> = { weapon: ITEM_IDS.filter((x) => ITEM_KIND[x] === 'weapon'), tool: ITEM_IDS.filter((x) => ITEM_KIND[x] === 'tool'), spell: ITEM_IDS.filter((x) => ITEM_KIND[x] === 'spell') };
const GEAR_ART: Record<string, string> = { g_spear: 'i09', g_sword: 'i02', g_bow: 'i01', g_staff: 'i04', g_wshield: 'i06', g_leather: 'i08', g_ishield: 'i06', g_mail: 'i08' };

/** リーダーの絵（v1 の団長の絵を使う） */
export function LeaderArt({ id, size = 40 }: { id?: string; size?: number }) {
  if (!id) return <CardBackArt id="occ" size={size} />;
  const h = id.replace(/^l_/, '');
  return <HeroArt id={HERO_IDS.includes(h) ? h : pick(HERO_IDS, id)} size={size} />;
}

/** カードの絵（v2 のカードには専用の絵がまだ無いので、種類の合う v1 の絵を割り当てる） */
export function CardArt2({ id, size }: { id: string; size: number }) {
  const c = CARD2[id];
  if (!c) return <CardBackArt id={ANC2[id] ? 'item' : 'occ'} size={size} />;
  if (c.kind === 'leader') return <LeaderArt id={id} size={size} />;
  if (c.kind === 'occ') return <JobArt id={pick(JOBS, id)} size={size} />;
  if (c.kind === 'gear') return <ItemArt id={GEAR_ART[id] ?? pick(ITEMS_BY.weapon, id)} size={size} />;
  const k = c.kind === 'armor' ? 'weapon' : c.kind === 'stage' ? 'tool' : c.kind;
  return <ItemArt id={pick(ITEMS_BY[k] ?? ITEMS_BY.tool, id)} size={size} />;
}

/** カードの表（職能・品物・リーダー・共通の装備・段階カード） */
export function CardFace2({ id, size = 'm', selected, onClick, disabled, anchor }: { id: string; size?: 's' | 'm' | 'l'; selected?: boolean; onClick?: () => void; disabled?: boolean; anchor?: string }) {
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
          {q && <div className="kd-card-chars">{q.secret ? `秘密依頼・名声${q.fame ?? DATA.SECRET_FAME}` : `共通の依頼・先着 ${DATA.QUEST_FAME.join('・')}`}</div>}
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
