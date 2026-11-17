// 霧谷の各画面：ドラフト・キャラ選択・盤面・拠点・依頼・戦闘・冬・最終集計
import { useEffect, useMemo, useState } from 'react';
import { BossArt, EffectArt, HeroArt, KIcon, MonsterArt, NestScene, TerrainArt } from '../art-registry';
import {
  ACT, BASE_PLOTS, CARDS, CHAR, EL_JP, MAX_COMPANIONS, MAX_SKILL, NEST_CAP, NEST_JP, QUESTS, QUEST_FAME, RES, WEATHER_JP,
} from '../data';
import { monsterDef, placeName } from '../reduce';
import { CHAR_TEXT, SPACE_TEXT, TAG_JP } from '../text';
import type { GameView, PlayerView, ScoreRow, Seat } from '../types';
import { CardFace, CostRow, FateDeck, HeroBadge, MonsterCard, Num, ResCount, SEAT_COLORS, SEAT_MARKS, Section, Token } from './parts';
import { InfoDot } from './inspect';
import type { Playing } from './useTable';

const nameOf = (v: GameView, s: Seat) => (s === v.me ? 'あなた' : v.players[s]?.name ?? '');
const msVar = (cur: Playing | null) => ({ ['--ms' as string]: `${cur?.ms ?? 400}ms` });

// ---------------------------------------------------------------- ドラフト
export function DraftScreen({ view, options, onPick, queuedPick }: { view: GameView; options?: string[]; onPick?: (id: string) => void; queuedPick?: string }) {
  const d = view.draft;
  const me = view.players[view.me];
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => setSel(null), [d?.kind, d?.lap]);
  if (!d || !me) return null;
  const offers = options ?? d.offers[view.me] ?? [];
  const picked = d.picked[view.me];
  const lapNo = (d.kind === 'occ' ? 0 : 3) + d.lap;
  return (
    <div className="kd-screen kd-draft">
      <header className="kd-screen-h">
        <small>開始時の手札づくり（全員同時）</small>
        <h2>{d.kind === 'occ' ? '職能' : '品物'}カード {d.lap}/3 周目</h2>
        <ol className="kd-laps" aria-label={`6周中${lapNo}周目`}>{Array.from({ length: 6 }, (_, i) => <li key={i} className={i < lapNo - 1 ? 'is-done' : i === lapNo - 1 ? 'is-now' : ''}>{i < 3 ? '職' : '品'}</li>)}</ol>
      </header>
      <p className="kd-hint">{picked ? '取りました。ほかの人を待っています…' : '3枚から1枚を手札に。残りの2枚は山に戻ります'}</p>
      <div className="kd-offer" key={`${d.kind}${d.lap}`}>
        {offers.map((id, i) => (
          <div key={id} className={`kd-deal${picked && picked !== id ? ' is-gone' : ''}${picked === id ? ' is-taken' : ''}`} style={{ animationDelay: `${i * 90}ms` }}>
            <CardFace id={id} size="l" selected={sel === id || picked === id || queuedPick === id} onClick={onPick && !picked ? () => setSel(id) : undefined} />
          </div>
        ))}
      </div>
      {onPick && !picked && <div className="kd-confirm"><button type="button" className="kd-btn is-primary" disabled={!sel} onClick={() => sel && onPick(sel)}>{sel ? `「${CARDS[sel]?.name}」を取る` : 'カードを選んでください'}</button></div>}
      <div className="kd-draft-others" aria-label="ほかの人">
        {view.players.filter((p) => p.seat !== view.me).map((p) => (
          <span key={p.seat} className={`kd-chip${d.picked[p.seat] ? ' is-done' : ''}`} data-kd={`seat:${p.seat}`}><Token seat={p.seat} size={18} />{p.name}<small>{d.picked[p.seat] ? '選んだ' : '選び中…'}</small></span>
        ))}
      </div>
      <Section title={`あなたの手札（${me.hand.length}/6）`}>
        <div className="kd-hand" data-kd="hand">{me.hand.map((id, i) => <CardFace key={id + i} id={id} size="s" />)}</div>
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------- キャラ選択
export function CharacterPick({ view, options, onPick }: { view: GameView; options?: string[]; onPick?: (id: string) => void }) {
  const me = view.players[view.me];
  const [sel, setSel] = useState<string | null>(null);
  if (!me) return null;
  const opts = options ?? me.charOptions ?? [];
  const fit = (c: string) => me.hand.filter((id) => CARDS[id]?.chars.includes(c) || CARDS[id]?.tags.some((t) => CHAR[c].tags.includes(t)));
  return (
    <div className="kd-screen kd-charpick">
      <header className="kd-screen-h"><small>手札を見てから選ぶ</small><h2>団長を選ぶ（2人から1人）</h2></header>
      <div className="kd-chars">
        {opts.map((c, i) => {
          const ch = CHAR[c]; const good = fit(c);
          const chosen = me.character === c; const other = me.character && !chosen;
          return (
            <button key={c} type="button" className={`kd-charcard${sel === c || chosen ? ' is-selected' : ''}${other ? ' is-gone' : ''}`} style={{ animationDelay: `${i * 120}ms` }}
              onClick={onPick && !me.character ? () => setSel(c) : undefined} aria-pressed={sel === c || chosen}>
              <HeroArt id={c} size={120} />
              <div className="kd-charcard-b">
                <small>{ch.role}</small>
                <strong>{ch.name}</strong>
                <span className="kd-tags">{ch.tags.map((t) => <i key={t}>{TAG_JP[t] ?? t}</i>)}</span>
                <p>{CHAR_TEXT[c]}</p>
                <span className="kd-fit">手札と噛み合う：{good.length}枚{good.length ? `（${good.slice(0, 3).map((id) => CARDS[id].name).join('・')}${good.length > 3 ? '…' : ''}）` : ''}</span>
              </div>
            </button>
          );
        })}
      </div>
      {onPick && !me.character && <div className="kd-confirm"><button type="button" className="kd-btn is-primary" disabled={!sel} onClick={() => sel && onPick(sel)}>{sel ? `${CHAR[sel].name}で始める` : 'キャラを選んでください'}</button></div>}
      <Section title="あなたの手札"><div className="kd-hand" data-kd="hand">{me.hand.map((id, i) => <CardFace key={id + i} id={id} size="s" highlight={!!sel && (CARDS[id]?.chars.includes(sel) ?? false)} />)}</div></Section>
      <div className="kd-draft-others">{view.players.filter((p) => p.seat !== view.me).map((p) => <span key={p.seat} className={`kd-chip${p.character ? ' is-done' : ''}`}><Token seat={p.seat} size={18} />{p.name}{p.character && <><HeroArt id={p.character} size={22} /><small>{CHAR[p.character].name}</small></>}</span>)}</div>
    </div>
  );
}

// ---------------------------------------------------------------- 盤面
export function Board({ view, selectable, selected, onSelect, cur }: { view: GameView; selectable?: Set<string>; selected?: string | null; onSelect?: (id: string) => void; cur: Playing | null }) {
  const lastRefill = cur?.ev.t === 'refill' ? cur.ev.adds : undefined;
  const pick = (id: string) => (selectable?.has(id) && onSelect ? () => onSelect(id) : undefined);
  return (
    <div className="kd-board">
      <Section title="巣（魔物は2人まで）" extra={<span>次のラウンドの魔物は影で見える</span>}>
        <div className="kd-nests">
          {view.nests.map((n) => {
            const can = selectable?.has(n.id);
            const spawn = cur?.ev.t === 'monster_spawn' && cur.ev.nest === n.id;
            return (
              <button type="button" key={n.id} data-kd={`space:${n.id}`} data-inspect={`nest:${n.id}`} className={`kd-nest${can ? ' is-can' : ''}${selected === n.id ? ' is-selected' : ''}${spawn ? ' is-spawn' : ''}`}
                style={msVar(cur)} onClick={pick(n.id)} aria-disabled={!can} aria-label={`${NEST_JP[n.id]}${n.monster ? `：${monsterDef(n.monster)?.name}` : '：空'}`}>
                {can && <InfoDot target={`nest:${n.id}`} />}
                <div className="kd-nest-bg"><NestScene id={n.id} width={200} /></div>
                <div className="kd-nest-h">{NEST_JP[n.id]}<span className="kd-cap">{Array.from({ length: NEST_CAP }, (_, i) => n.occupants[i] !== undefined ? <Token key={i} seat={n.occupants[i]} size={18} /> : <i key={i} className="kd-slot" />)}</span></div>
                {n.monster ? <MonsterCard id={n.monster} wounds={n.wounds} compact /> : <div className="kd-nest-empty">静か</div>}
                {n.next && <div className="kd-next"><span className="kd-shadowart"><MonsterArt id={n.next} size={26} frame={false} /></span>次</div>}
              </button>
            );
          })}
          <Lair view={view} can={selectable?.has('lair')} selected={selected === 'lair'} onClick={pick('lair')} />
        </div>
      </Section>
      <Section title="行動スペース">
        <div className="kd-spaces">
          {view.spaceOrder.map((id) => {
            const s = view.spaces[id]; const a = ACT[id];
            const can = selectable?.has(id);
            const full = !a.unlimited && s.occupants.length > 0;
            const add = lastRefill?.[id];
            return (
              <button type="button" key={id} data-kd={`space:${id}`} data-inspect={`space:${id}`} className={`kd-space${can ? ' is-can' : ''}${selected === id ? ' is-selected' : ''}${!s.open ? ' is-locked' : ''}${full ? ' is-full' : ''}${add ? ' is-refill' : ''}`}
                style={msVar(cur)} onClick={pick(id)} aria-disabled={!can}>
                {can && <InfoDot target={`space:${id}`} />}
                <span className="kd-space-art"><TerrainArt id={id} size={44} /></span>
                <span className="kd-space-b">
                  <strong>{a.name}</strong>
                  <span className="kd-space-e">
                    {a.accum ? <CostRow cost={s.stock} size={16} /> : a.give ? <CostRow cost={a.give} size={16} /> : <small>{SPACE_TEXT[id] ?? ''}</small>}
                    {a.accum && <small className="kd-per">毎ラウンド<CostRow cost={a.accum} size={12} signed /></small>}
                  </span>
                  {!s.open && <small className="kd-lock">ラウンド{a.from_round}から</small>}
                </span>
                <span className="kd-space-by">{s.occupants.map((o, i) => <Token key={i} seat={o} size={20} />)}</span>
              </button>
            );
          })}
        </div>
      </Section>
      <Section title="運命の山（全員に公開・年の始めに混ぜ直す）">
        <div className="kd-fates">{view.players.map((p) => <div key={p.seat} className="kd-fate-row"><Token seat={p.seat} size={18} /><span className="kd-fate-n">{nameOf(view, p.seat)}</span><FateDeck p={p} /></div>)}</div>
      </Section>
    </div>
  );
}

function Lair({ view, can, selected, onClick }: { view: GameView; can?: boolean; selected?: boolean; onClick?: () => void }) {
  const l = view.lair;
  const active = l.round === view.round;
  return (
    <button type="button" data-kd="space:lair" data-inspect="nest:lair" className={`kd-nest kd-lair${can ? ' is-can' : ''}${selected ? ' is-selected' : ''}${l.defeated ? ' is-defeated' : ''}`} onClick={onClick} aria-disabled={!can}>
      {can && <InfoDot target="nest:lair" />}
      <div className="kd-nest-bg"><NestScene id="lair" width={200} /></div>
      <div className="kd-nest-h">主の巣<span className="kd-cap">{l.occupants.map((o, i) => <Token key={i} seat={o} size={18} />)}</span></div>
      {l.boss ? <MonsterCard id={l.boss} wounds={l.wounds} compact /> : <div className="kd-nest-empty">—</div>}
      <small className="kd-lair-when">{l.defeated ? '討伐済み' : active ? '今ラウンドが決戦！' : l.round ? `ラウンド${l.round}（冬）に決戦` : ''}</small>
      {!l.boss && l.candidates.length > 0 && <div className="kd-cands">{l.candidates.map((c) => <BossArt key={c} id={c} size={30} />)}</div>}
    </button>
  );
}

// ---------------------------------------------------------------- 拠点
export function BaseView({ p, view, cur }: { p: PlayerView; view: GameView; cur: Playing | null }) {
  const mine = p.seat === view.me;
  const plots: { kind: 'bed' | 'fac' | 'wall' | 'empty'; id?: string }[] = [];
  for (let i = 0; i < p.beds; i++) plots.push({ kind: 'bed' });
  for (const f of p.facilities) plots.push({ kind: 'fac', id: f });
  for (let i = 0; i < p.walls; i++) plots.push({ kind: 'wall' });
  while (plots.length < BASE_PLOTS) plots.push({ kind: 'empty' });
  const lastBuild = cur?.ev.t === 'build' && cur.ev.seat === p.seat ? cur.ev.kind : undefined;
  const lastPlay = cur?.ev.t === 'play_card' && cur.ev.seat === p.seat ? cur.ev.card : undefined;
  return (
    <div className="kd-base" style={msVar(cur)}>
      <div className="kd-base-h">
        <HeroBadge id={p.character} size={56} seat={p.seat} />
        <div><small>{p.character ? CHAR[p.character].role : '—'}</small><strong>{p.character ? CHAR[p.character].name : '未定'}<span className="kd-who">（{nameOf(view, p.seat)}）</span></strong>
          <span className="kd-fame" data-kd={`fame:${p.seat}`}>名声 <b><Num value={p.fame} /></b></span></div>
      </div>
      <Section title={`仲間 ${p.companions.length}/${MAX_COMPANIONS}`} extra={<span>戦力 2/人＋熟練</span>}>
        <div className="kd-comps">
          {p.companions.map((c) => (
            <div key={c.id} className={`kd-comp${c.injured ? ' is-injured' : ''}${c.at ? ' is-out' : ''}`} data-kd={`comp:${c.id}`}>
              <Token seat={p.seat} size={34} injured={c.injured} dim={!!c.at} />
              <small>{c.leader ? '団長' : '仲間'}</small>
              <span className="kd-skill" aria-label={`熟練${c.skill}`}>{Array.from({ length: MAX_SKILL }, (_, i) => <i key={i} className={i < c.skill ? 'is-on' : ''} />)}</span>
              <small className="kd-comp-st">{c.injured ? '負傷' : c.at ? placeName(c.at) : '待機'}</small>
            </div>
          ))}
          {p.familiars.map((f) => <div key={f} className="kd-comp is-fam"><MonsterArt id={f} size={34} /><small>使い魔</small></div>)}
        </div>
      </Section>
      <Section title={`拠点 ${BASE_PLOTS}区画`} extra={<span>寝床{p.beds}・施設{p.facilities.length}・防壁{p.walls}</span>}>
        <div className="kd-plots">
          {plots.map((x, i) => (
            <div key={i} className={`kd-plot is-${x.kind}${(lastBuild === 'bed' && x.kind === 'bed' && i === p.beds - 1) || (lastBuild === 'wall' && x.kind === 'wall' && i === p.beds + p.facilities.length + p.walls - 1) || (lastPlay && x.id === lastPlay) ? ' is-new' : ''}`}>
              {x.kind === 'bed' && <><svg viewBox="0 0 40 30" width="36" aria-hidden><rect x="2" y="12" width="36" height="12" rx="3" fill="#8A5A34" /><rect x="4" y="8" width="10" height="8" rx="3" fill="#EADBC0" /><rect x="14" y="10" width="22" height="6" rx="2" fill="#6A7FB0" /></svg><small>寝床</small></>}
              {x.kind === 'wall' && <><EffectArt id="wall-block" size={34} /><small>防壁</small></>}
              {x.kind === 'fac' && x.id && <><CardFace id={x.id} size="s" /></>}
              {x.kind === 'empty' && <small className="kd-plot-e">空き</small>}
            </div>
          ))}
        </div>
      </Section>
      <Section title="持ち物">
        <div className="kd-resgrid">{RES.map((r) => <ResCount key={r} r={r} n={p.res[r]} size={24} />)}</div>
        {p.discontent > 0 && <p className="kd-bad">不満カード {p.discontent}枚（-{p.discontent * 3}名声）</p>}
      </Section>
      <Section title={`出したカード（職能${p.occupations.length}・武具${p.weapons.length}）`}>
        <div className="kd-hand">{[...p.occupations, ...p.weapons].map((id) => <CardFace key={id} id={id} size="s" highlight={id === lastPlay} />)}{!p.occupations.length && !p.weapons.length && <small className="kd-none">まだありません</small>}</div>
      </Section>
      <Section title={`手札 ${p.hand.length}枚`}>
        <div className="kd-hand">{p.hand.map((id, i) => <CardFace key={id + i} id={mine ? id : '?'} size={mine ? 'm' : 's'} />)}</div>
      </Section>
      {p.spellsUsed.length > 0 && <Section title="使った秘術"><div className="kd-hand">{p.spellsUsed.map((id, i) => <CardFace key={id + i} id={id} size="s" />)}</div></Section>}
      <Section title={`討伐の証 ${p.trophies.length}体`}>
        <div className="kd-trophies">{p.trophies.map((m, i) => <span key={i} className="kd-trophy" data-inspect={`mon:${m}`}>{monsterDef(m) && (MONSTER_IS_BOSS(m) ? <BossArt id={m} size={36} /> : <MonsterArt id={m} size={36} />)}<small>{monsterDef(m)?.name}</small></span>)}{!p.trophies.length && <small className="kd-none">まだありません</small>}</div>
      </Section>
      <Section title="運命の山"><FateDeck p={p} size="m" /></Section>
    </div>
  );
}
const MONSTER_IS_BOSS = (id: string) => id.startsWith('b_');

// ---------------------------------------------------------------- 依頼
export function QuestsView({ view, cur }: { view: GameView; cur: Playing | null }) {
  return (
    <div className="kd-quests">
      <p className="kd-hint">達成した順に名声 {QUEST_FAME.join('・')}</p>
      {view.quests.map((q) => {
        const stamp = cur?.ev.t === 'quest_done' && cur.ev.quest === q.id;
        return (
          <div key={q.id} className={`kd-quest${stamp ? ' is-stamp' : ''}`} data-kd={`quest:${q.id}`} style={msVar(cur)}>
            <span className="kd-quest-ic"><EffectArt id="quest-stamp" size={40} /></span>
            <strong>{QUESTS[q.id]}</strong>
            <ol className="kd-quest-slots">{QUEST_FAME.map((f, i) => <li key={i}>{q.doneBy[i] !== undefined ? <Token seat={q.doneBy[i]} size={20} /> : <i />}<small>名声{f}</small></li>)}</ol>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- みんな
export function Everyone({ view, onOpen }: { view: GameView; onOpen?: (s: Seat) => void }) {
  return (
    <div className="kd-everyone">
      {view.players.map((p) => (
        <button type="button" key={p.seat} className="kd-ev-row" onClick={onOpen ? () => onOpen(p.seat) : undefined}>
          <HeroBadge id={p.character} size={40} />
          <span className="kd-ev-n"><Token seat={p.seat} size={16} />{nameOf(view, p.seat)}<small>{p.character ? CHAR[p.character].name : ''}</small></span>
          <span className="kd-ev-f">名声<b>{p.fame}</b></span>
          <span className="kd-ev-d">仲間{p.companions.length}・証{p.trophies.length}・手札{p.hand.length}・防壁{p.walls}</span>
          <span className="kd-ev-r">{RES.map((r) => <ResCount key={r} r={r} n={p.res[r]} size={14} />)}</span>
          <FateDeck p={p} />
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- 戦闘
const PART_ICON: Record<string, string> = { companion: '👤', skill: '✦', weapon: '⚔', occ: '📜', spell: '✷', supply: '➶', familiar: '🐾', weakness: '弱', tide: '潮', weather: '天', trap: '罠', coop: '共', char: '★' };

export function CombatPanel({ view, cur }: { view: GameView; cur: Playing | null }) {
  const c = view.combat;
  if (!c) return null;
  const m = monsterDef(c.monster);
  const need = Math.max(1, c.strength - c.wounds);
  const total = c.total ?? 0;
  const t = cur?.ev.t;
  const fresh = cur?.ev.t === 'power' ? new Set(cur.ev.parts) : new Set();
  const flipping = t === 'fate_flip';
  const scale = Math.max(need, total, 1) * 1.15;
  const winEl = cur?.ev.t === 'clash' ? cur.ev.el : undefined;
  return (
    <div className={`kd-combat${c.boss ? ' is-boss' : ''}${t === 'combat_start' ? ' is-enter' : ''}${t === 'counter' ? ' is-counter' : ''}`} data-kd="combat" style={msVar(cur)} role="dialog" aria-label="戦闘">
      <div className="kd-combat-h">
        <span>{c.boss ? '主との決戦' : `${NEST_JP[c.nest] ?? c.nest}の戦い`}</span>
        <span className="kd-combat-who">{c.seats.map((s) => <span key={s}><Token seat={s} size={18} />{nameOf(view, s)}</span>)}</span>
      </div>
      <div className="kd-arena">
        <div className={`kd-foe${c.result === 'win' ? ' is-down' : ''}${c.result === 'lose' ? ' is-stand' : ''}${t === 'hit' ? ' is-hit' : ''}`} data-kd="combat:monster" data-inspect={`mon:${c.monster}:${c.wounds}`}>
          {c.boss ? <BossArt id={c.monster} size={132} /> : <MonsterArt id={c.monster} size={132} />}
          {winEl && c.result === 'win' && <span className="kd-strike"><EffectArt id={winEl} size={120} /></span>}
          {c.result === 'win' && t === 'clash' && !winEl && <span className="kd-strike"><EffectArt id="slash" size={120} /></span>}
        </div>
        <div className="kd-foe-info">
          <strong>{m?.name}</strong>
          <span className="kd-mon-stats">
            <span className="kd-stat is-str">強さ{c.wounds ? <><s>{c.strength}</s>→{need}</> : c.strength}</span>
            <span className="kd-stat is-ctr">反撃{m?.counter}</span>
            {m?.weak && <span className="kd-stat is-weak"><KIcon name={m.weak} size={14} />弱点{EL_JP[m.weak]}</span>}
          </span>
          <span className="kd-tide">魔力の潮：<KIcon name={view.tide} size={14} />{EL_JP[view.tide]}{view.weather ? `・${WEATHER_JP[view.weather]}` : ''}</span>
        </div>
      </div>
      <div className="kd-gauge" data-kd="combat:gauge" aria-label={`戦力 ${total} ／ 必要 ${need}`}>
        <i className="kd-gauge-fill" style={{ width: `${(Math.min(total, scale) / scale) * 100}%` }} />
        <i className="kd-gauge-need" style={{ left: `${(need / scale) * 100}%` }}><span>必要{need}</span></i>
        <b><Num value={total} ms={cur?.ms ?? 300} /></b>
      </div>
      <ul className="kd-parts">
        {c.parts.map((x, i) => (
          <li key={i} className={`is-${x.kind}${fresh.has(x) ? ' is-new' : ''}`} style={{ animationDelay: fresh.has(x) ? `${[...fresh].indexOf(x) * ((cur?.ms ?? 400) / Math.max(2, fresh.size + 1))}ms` : undefined }}>
            <span className="kd-part-ic">{x.el ? <KIcon name={x.el} size={16} /> : PART_ICON[x.kind]}</span>
            <span className="kd-part-l">{x.label}</span><b>+{x.value}</b>
          </li>
        ))}
        {c.fate && <li className={`is-fate${flipping ? ' is-new' : ''}`}><span className="kd-part-ic">🂠</span><span className="kd-part-l">運命</span><b>{c.fate.value >= 0 ? '+' : ''}{c.fate.value}</b></li>}
      </ul>
      <div className="kd-fatecard-row">
        <div className={`kd-fatecard${c.fate ? ' is-open' : ''}${flipping ? ' is-flip' : ''}${c.fate && c.fate.value >= 2 ? ' is-gold' : ''}${c.fate && c.fate.value < 0 ? ' is-crack' : ''}`} aria-label={c.fate ? `運命カード ${c.fate.value}` : '運命カード（まだ）'}>
          <span className="kd-fc-back">運命</span>
          <span className="kd-fc-front">{c.fate ? (c.fate.value > 0 ? `+${c.fate.value}` : c.fate.value) : ''}</span>
        </div>
        {c.seats[0] !== undefined && <span className="kd-fate-left"><small>残りの山</small><FateDeck p={view.players[c.seats[0]]} /></span>}
      </div>
      {c.result && <div className={`kd-result is-${c.result}`}>{c.result === 'win' ? '撃破！' : '撃破できず…傷が残った'}</div>}
      {c.counter && <div className="kd-counter">反撃 {c.counter.amount} − 防御 {c.counter.defense} → {c.injured.length ? `${c.injured.length}人 負傷` : '負傷なし'}{c.injured.length > 0 && <EffectArt id="injury" size={28} />}</div>}
      {c.loot && <div className="kd-loot"><EffectArt id="loot-drop" size={26} /><CostRow cost={c.loot} size={18} signed />{c.trophy ? <span className="kd-fame-s">名声+{c.trophy}</span> : null}</div>}
    </div>
  );
}

// ---------------------------------------------------------------- 冬
export function WinterPanel({ view, cur }: { view: GameView; cur: Playing | null }) {
  const w = view.winter;
  if (!w) return null;
  return (
    <div className="kd-winter" style={msVar(cur)} role="dialog" aria-label="冬の処理">
      <h2>冬越し<small>仲間1人につき食料2。残った魔物が拠点を襲う</small></h2>
      <div className="kd-winter-rows">
        {view.players.map((p) => {
          const u = w.upkeep.find((x) => x.seat === p.seat);
          const raids = w.raids.filter((x) => x.seat === p.seat);
          const now = (cur?.ev.t === 'upkeep' || cur?.ev.t === 'raid') && cur.ev.seat === p.seat;
          return (
            <div key={p.seat} className={`kd-wrow${now ? ' is-now' : ''}${now && cur?.ev.t === 'raid' && cur.ev.damage > 0 ? ' is-hit' : ''}`} data-kd={`winter:${p.seat}`}>
              <span className="kd-wrow-n"><Token seat={p.seat} size={20} />{nameOf(view, p.seat)}</span>
              <span className="kd-wrow-u" data-inspect={`upkeep:${p.seat}`}>
                {u ? <>
                  <span className="kd-food">{Array.from({ length: u.need }, (_, i) => <i key={i} className={i < u.paid ? 'is-paid' : 'is-miss'} style={{ animationDelay: `${i * 60}ms` }} />)}</span>
                  {u.discontent > 0 ? <b className="kd-bad">不満{u.discontent}（-{u.discontent * 3}）</b> : <small>食料{u.paid}</small>}
                </> : <small>…</small>}
              </span>
              <span className="kd-wrow-r">
                {raids.map((r, i) => (
                  <span key={i} className={`kd-raid${r.damage ? ' is-dmg' : ' is-blocked'}`}>
                    <MonsterArt id={r.monster} size={22} />{r.damage ? <>-{r.damage}</> : <EffectArt id="wall-block" size={18} />}
                  </span>
                ))}
              </span>
              <span className="kd-wrow-w">防壁{p.walls}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 最終集計
export function FinalScoring({ view, rows, cur }: { view: GameView; rows: ScoreRow[]; cur: Playing | null }) {
  const animMs = cur?.ev.t === 'score' ? cur.ms : 0;
  const [p, setP] = useState(animMs ? 0 : 1);
  useEffect(() => {
    if (!animMs) { setP(1); return; }
    const t0 = performance.now(); let raf = 0;
    const tick = (t: number) => { const x = Math.min(1, (t - t0) / animMs); setP(x); if (x < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [animMs, cur?.key]);
  const keys = rows[0]?.items.map((x) => x.key) ?? [];
  const steps = keys.length;
  const partial = useMemo(() => rows.map((r) => {
    const shownSteps = p * steps;
    let sum = 0;
    r.items.forEach((it, i) => { const f = Math.max(0, Math.min(1, shownSteps - i)); sum += it.fame * f; });
    return { r, sum: Math.round(sum) };
  }), [rows, p, steps]);
  const order = [...partial].sort((a, b) => b.sum - a.sum || a.r.seat - b.r.seat);
  const done = p >= 1;
  const ROW = 64;
  return (
    <div className="kd-screen kd-final">
      <header className="kd-screen-h"><small>3年間の冒険の終わり</small><h2>{done ? '最終結果' : '名声の集計'}</h2></header>
      <div className="kd-final-board" style={{ height: rows.length * ROW }}>
        {partial.map(({ r, sum }) => {
          const rank = order.findIndex((x) => x.r.seat === r.seat);
          const pl = view.players[r.seat];
          return (
            <div key={r.seat} className={`kd-frow${done && r.rank === 1 ? ' is-win' : ''}`} style={{ transform: `translateY(${rank * ROW}px)` }}>
              <span className="kd-frank">{done ? r.rank : rank + 1}</span>
              <HeroBadge id={pl?.character} size={40} />
              <span className="kd-fname"><Token seat={r.seat} size={16} />{nameOf(view, r.seat)}</span>
              <span className="kd-fitems">{r.items.map((it, i) => (p * steps > i && it.fame !== 0) && <i key={it.key} className={it.fame < 0 ? 'is-neg' : ''}>{it.label}{it.fame > 0 ? '+' : ''}{it.fame}</i>)}</span>
              <b className="kd-ftotal">{sum}</b>
            </div>
          );
        })}
      </div>
      <table className="kd-ftable">
        <thead><tr><th>項目</th>{rows.map((r) => <th key={r.seat}><span style={{ color: SEAT_COLORS[r.seat] }}>{SEAT_MARKS[r.seat]}</span>{nameOf(view, r.seat).slice(0, 3)}</th>)}</tr></thead>
        <tbody>
          {keys.map((k, i) => <tr key={k} className={p * steps > i ? 'is-shown' : ''}><th>{rows[0].items[i].label}</th>{rows.map((r) => <td key={r.seat}>{p * steps > i ? r.items[i].fame : ''}</td>)}</tr>)}
          <tr className="is-total"><th>合計</th>{rows.map((r) => <td key={r.seat}>{done ? r.total : ''}</td>)}</tr>
        </tbody>
      </table>
    </div>
  );
}

