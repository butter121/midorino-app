// 霧谷 v2 — ゲーム画面全体。v1 の KiridaniTable と同じ骨組み・同じクラス（上の状況バー／プレイヤー列／タブ／下の自分の持ち物、
// 戦闘・冬・季節の帯は上に重ねる）。v2 で増えたもの：準備段階の画面、段階カードのマス、仲間ごとの装備、進み具合（％）、名声の内訳。
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DATA, RES, type Cost, type Res, type ScoreRow } from '@midorino/engine/src/kiridani2';
import { EffectArt, KIcon } from '../kiridani/art-registry';
import { SPEED_JP, SPEEDS } from '../kiridani/anim/timing';
import { FxLayer, type FxApi } from '../kiridani/ui/fx';
import { InfoDot, useInspect } from '../kiridani/ui/inspect';
import { CostRow, Num, ResCount, SEAT_COLORS, SEAT_MARKS, Token } from '../kiridani/ui/parts';
import { CardArt2, CardChip2, CardFace2, FateRow2, LeaderArt, MonArt, MonsterCard2, NestArt, SpaceArt, YearsCtx } from './parts2';
import { pointScale } from '@midorino/engine/src/kiridani2/uihelp';
import { Inspect2 } from './inspect2';
import { FameGraph } from './fameGraph';
import type { Playing2, TablePlayer2 } from './useTable2';
import { CARD2, NEST_JP, QUEST2, RES_JP, SEASON_JP, cardName, groupSpaces, placeName, progressPct, winterFood, type PV2, type Seat, type View2 } from './view';

export type Tab2 = 'board' | 'base' | 'quests' | 'all';
const TABS: { id: Tab2; label: string }[] = [{ id: 'board', label: '盤面' }, { id: 'base', label: '拠点' }, { id: 'quests', label: '依頼' }, { id: 'all', label: 'みんな' }];

/** いま自分に求められている、画面で答える選択（それ以外はシートで聞く） */
export type Ask2 =
  | { kind: 'card'; why: string; cards: string[]; title: string; sub?: string }
  | { kind: 'ratio'; ratios: { weapon: number; armor: number; tool: number; spell: number }[] }
  | { kind: 'place'; options: string[] };

export interface Table2Props {
  t: TablePlayer2;
  ask?: Ask2 | null;
  /** 選んだ答え（カードの id・置く場所の id・割合は "w,t,s"）。false を返したら答えはまだ決まっていない（戦闘のトレイ・細かい選択のシートを開いた。
   *  やめたら同じ問いのまま、ほかの場所を選び直せる） */
  onAnswer?: (choice: string) => boolean | void;
  extra?: ReactNode;
  sheet?: ReactNode;
  actions?: ReactNode;
  /** 自分の番に出す「動かす仲間」の選び */
  picker?: ReactNode;
  /** 拠点の装備の枠をタップしたとき（自分の番だけ。持たせる・はずす） */
  onEquip?: (companion: number, slot: 'weapon' | 'armor') => void;
  /** 最終画面の下に出すもの（「同じメンバーでもう一度」など） */
  finalExtra?: ReactNode;
}

const nameOf = (v: View2, s: Seat) => (s === v.me ? 'あなた' : v.players[s]?.name ?? '');
const msVar = (cur: Playing2 | null) => ({ ['--ms' as string]: `${cur?.ms ?? 400}ms` });
const icons = (c: Cost) => RES.filter((r) => c[r]).flatMap((r) => Array.from({ length: Math.min(4, c[r]!) }, () => r));

function runFx(fx: FxApi, p: Playing2, v: View2) {
  const { ev, ms } = p; const me = v.me;
  const holder = (s: Seat, r: Res) => (s === me ? `res:${r}` : `seat:${s}`);
  const flyRes = (from: string, s: Seat, c: Cost) => {
    const list = icons(c);
    list.forEach((r, i) => fx.fly(from, holder(s, r), <KIcon name={r} size={24} />, { ms: Math.max(200, ms * 0.7), delay: (i * ms * 0.3) / Math.max(1, list.length), arc: 50 }));
    RES.filter((r) => c[r]).forEach((r) => fx.float(holder(s, r), `+${c[r]}`, { ms, delay: ms * 0.5 }));
  };
  switch (ev.t) {
    case 'place':
      fx.fly(`seat:${ev.seat}`, `space:${ev.space}`, <Token seat={ev.seat} size={28} />, { ms, arc: 70, size: 28 });
      fx.burst(`space:${ev.space}`, 'place-ring', { ms: ms * 0.5, delay: ms * 0.75, size: 56 });
      break;
    case 'gather': flyRes(`space:${ev.space}`, ev.seat, ev.gain); break;
    case 'gain': case 'grant': case 'future': flyRes(`seat:${ev.seat}`, ev.seat, ev.gain); break;
    case 'loot': flyRes('combat:monster', ev.seat, ev.gain); break;
    case 'pay': icons(ev.cost).forEach((r, i) => fx.fly(holder(ev.seat, r), `seat:${ev.seat}`, <KIcon name={r} size={22} />, { ms: ms * 0.8, delay: i * 40, arc: 30 })); break;
    case 'refill': Object.entries(ev.adds).forEach(([id, c], i) => RES.filter((r) => c[r]).forEach((r) => fx.float(`space:${id}`, <><KIcon name={r} size={16} />+{c[r]}</>, { ms: ms * 0.9, delay: (i * ms * 0.4) / 10 }))); break;
    case 'play_card': fx.burst(`seat:${ev.seat}`, 'card-glow', { ms, size: 64 }); break;
    case 'craft': fx.burst(`seat:${ev.seat}`, 'spark', { ms, size: 60 }); fx.float(`seat:${ev.seat}`, cardName(ev.card), { ms, tone: 'gold' }); break;
    case 'spell': fx.burst(v.combat ? 'combat:monster' : `seat:${ev.seat}`, 'light', { ms, size: 110 }); break;
    case 'build': fx.burst(`seat:${ev.seat}`, ev.kind === 'wall' ? 'wall-block' : 'shield', { ms, size: 56 }); fx.float(`seat:${ev.seat}`, ev.kind === 'wall' ? '防壁+1' : ev.kind === 'bed' ? '寝床+1' : '施設+1', { ms }); break;
    case 'hire': fx.float(`seat:${ev.seat}`, '仲間+1', { ms, tone: 'good' }); break;
    case 'train': fx.float(`seat:${ev.seat}`, ev.stat === 'atk' ? '攻め+1' : '守り+1', { ms, tone: 'gold' }); break;
    case 'market': fx.float(holder(ev.seat, 'gold'), `${ev.kind === 'sell' ? '+' : '-'}${ev.gold}`, { ms, tone: ev.kind === 'sell' ? 'good' : 'bad' }); break;
    case 'counter': fx.shake('combat', ms); fx.burst('combat:gauge', 'counter', { ms, size: 70 }); break;
    case 'injury': fx.burst(`seat:${ev.seat}`, 'injury', { ms, size: 48 }); fx.float(`seat:${ev.seat}`, '負傷', { ms, tone: 'bad' }); break;
    case 'heal': fx.burst(`seat:${ev.seat}`, 'heal', { ms, size: 48 }); break;
    case 'trophy': fx.fly('combat:monster', `seat:${ev.seat}`, <EffectArt id="trophy" size={36} />, { ms, arc: 90, size: 36 }); fx.float(`seat:${ev.seat}`, `名声+${ev.fame}`, { ms, delay: ms * 0.6, tone: 'gold' }); break;
    case 'tame': fx.burst(`seat:${ev.seat}`, 'heal', { ms, size: 52 }); fx.float(`seat:${ev.seat}`, '使い魔+1', { ms, tone: 'good' }); break;
    case 'upkeep': if (ev.discontent) fx.float(`winter:${ev.seat}`, `不満 -${ev.discontent * 3}`, { ms, tone: 'bad' }); break;
    case 'raid': fx.burst(`winter:${ev.seat}`, ev.damage ? 'raid' : 'wall-block', { ms: ms * 0.5, delay: ms * 0.3, size: 56 }); if (ev.damage) fx.shake(`winter:${ev.seat}`, ms); break;
    case 'quest_done': fx.burst(`quest:${ev.quest}`, 'quest-stamp', { ms, size: 70 }); fx.float(`seat:${ev.seat}`, `依頼 名声+${ev.fame}`, { ms, tone: 'gold' }); break;
    case 'fame': fx.float(`seat:${ev.seat}`, `名声${ev.amount >= 0 ? '+' : ''}${ev.amount}`, { ms, tone: 'gold' }); break;
    case 'donate': fx.float(`seat:${ev.seat}`, `寄進 名声+${ev.fame}`, { ms, tone: 'gold' }); break;
    case 'trade':
      fx.fly(`seat:${ev.a}`, `seat:${ev.b}`, <KIcon name={(Object.keys(ev.give)[0] ?? 'gold') as Res} size={22} />, { ms: ms * 0.8, arc: 30 });
      fx.fly(`seat:${ev.b}`, `seat:${ev.a}`, <KIcon name={(Object.keys(ev.get)[0] ?? 'gold') as Res} size={22} />, { ms: ms * 0.8, arc: 30, delay: ms * 0.15 });
      break;
    case 'wait': fx.burst(`space:${ev.nest}`, 'place-ring', { ms, size: 70 }); fx.float(`space:${ev.nest}`, '待ち伏せ', { ms }); break;
    case 'stage_reveal': fx.burst(`space:${ev.card}`, 'card-glow', { ms, size: 90 }); break;
    default: break;
  }
}

function Overlay({ cur, v }: { cur: Playing2 | null; v: View2 }) {
  if (!cur) return null;
  const { ev, ms } = cur;
  const st = { ['--ms' as string]: `${ms}ms` };
  if (ev.t === 'round_start') return (
    <div className={`kd-ov kd-band is-${ev.season}`} style={st} key={cur.key} aria-live="polite">
      <EffectArt id="season-change" size={56} />
      <div><small>ラウンド {ev.round} / {v.rounds}・{ev.year}年目／{v.years}年</small><strong>{SEASON_JP[ev.season]}</strong><span>進み具合 {Math.round(ev.progress * 100)}%</span></div>
    </div>
  );
  if (ev.t === 'first_player') return (
    <div className="kd-ov kd-band kd2-firstband" style={{ ...st, ['--seat' as string]: SEAT_COLORS[ev.seat] }} key={cur.key} aria-live="polite" data-kd="first-banner">
      <span className="kd-firstmark">先</span>
      <div><small>くじで決まった</small><strong>先攻は{nameOf(v, ev.seat)}</strong><span>この順で準備と手番を進める</span></div>
    </div>
  );
  if (ev.t === 'stage_reveal') return (
    <div className="kd-ov kd-toast is-gold" style={st} key={cur.key}>段階{ev.stage}：新しい場所「{cardName(ev.card)}」が開いた</div>
  );
  if (ev.t === 'boss_reveal') return (
    <div className="kd-ov kd-bossintro" style={st} key={cur.key} aria-live="assertive">
      <MonArt m={ev.boss} size={200} />
      <div><small>{ev.boss.type === 'b_ancient' ? '最後の冬の決戦' : `${Math.ceil(ev.round / 4)}年目の冬に現れる主`}</small><strong>{ev.boss.name}</strong><span>強さ {ev.boss.str}・ラウンド{ev.round}・参加しないと名声−{DATA.BOSS_ABSENT}</span></div>
    </div>
  );
  if (ev.t === 'quest_done') return <div className="kd-ov kd-toast is-gold" style={st} key={cur.key}>{nameOf(v, ev.seat)}が依頼を達成！ 名声+{ev.fame}</div>;
  if (ev.t === 'winter_start') return <div className="kd-ov kd-band is-winter" style={st} key={cur.key}><EffectArt id="upkeep" size={56} /><div><small>{v.year}年目の終わり</small><strong>冬越し</strong><span>維持費と襲撃</span></div></div>;
  if (ev.t === 'fame' && ev.reason === '古竜') return <div className="kd-ov kd-toast is-bad" style={st} key={cur.key}>古竜を倒せなかった…全員 {ev.amount}</div>;
  return null;
}

// ---------------------------------------------------------------- 準備段階
const WHY_TITLE: Record<string, [string, string]> = {
  leader: ['リーダーを選ぶ', '5人から1人。残りは山へ戻る'],
  occ: ['職能カードを選ぶ', '5枚見て1枚（3回）'],
  item: ['品物カードを選ぶ', '選んだ種類の山から5枚見て1枚'],
  start_occ: ['始めの職能', '手札の職能から1枚を費用なしで出す'],
  start_item: ['始めの品物', '手札の品物から1枚を費用なしで出す（装備は仲間が持つ）'],
  quest: ['秘密依頼を選ぶ', '2枚から1枚。あなただけに見える'],
  refill_occ: ['補充：職能', '5枚見て1枚'],
  refill_item: ['補充：品物', '5枚見て1枚'],
  draw: ['カードを選ぶ', ''],
};
export const whyTitle = (why: string) => WHY_TITLE[why] ?? ['カードを選ぶ', ''];
const SETUP_STEPS: [string, string][] = [['leader', 'リーダー'], ['occ', '職能×3'], ['ratio', '割合'], ['item', `品物×${DATA.ITEM_COUNT}`], ['start', '始めの2枚'], ['quest', '秘密依頼']];

function setupStep(v: View2, ask: Ask2 | null | undefined): string {
  if (ask?.kind === 'ratio') return 'ratio';
  if (ask?.kind === 'card') return ask.why.startsWith('start') ? 'start' : ask.why;
  const s = v.setup;
  if (!s) return 'leader';
  if (s.step === 'draft') return s.kind === 'occ' ? 'occ' : 'item';
  return s.step;
}

/** 準備のカード選び。配られたカードは1回だけ配る演出をして、出たらすぐ選べる。
 *  - 自分に配られたカード（出来事の draft_offer／leader_offer）と、問い（ask）のカードは同じ入れ物（同じ key）で出す。
 *    以前は「待っている間の表示」と「選ぶ表示」が別の入れ物で、問いが届いた瞬間に同じカードを配り直していた（選べない→もう一度配る→選べる）
 *  - 決めたあと（taken）は、次の問いが届くまで同じカードを選んだ印つきで残す（消して配り直さない） */
export function CardPickScreen({ v, ask, onPick }: { v: View2; ask: Extract<Ask2, { kind: 'card' }> | null; onPick?: (id: string) => void }) {
  const [sel, setSel] = useState<string | null>(null);
  const [took, setTook] = useState<{ id: string; cards: string[]; ask: object } | null>(null);
  const askKey = ask?.cards.join(',');
  const viewKey = v.setup?.cards?.join(',');
  useEffect(() => setSel(null), [askKey]);
  // 新しい問い（答えを受け付けなかったときの出し直しも）が届いたら、決めた印を外す
  useEffect(() => { if (ask && took && ask !== took.ask) setTook(null); }, [ask]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!ask && took && viewKey !== took.cards.join(',')) setTook(null); }, [viewKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const taken = took?.id ?? null;
  const pick = (id: string) => { if (!ask) return; setTook({ id, cards: ask.cards, ask }); onPick?.(id); };
  const me = v.players[v.me];
  const step = setupStep(v, ask);
  const at = SETUP_STEPS.findIndex(([k]) => k === step);
  const waiting = !ask && !taken;
  const other = v.setup?.seat !== undefined && v.setup.seat !== v.me ? v.setup.seat : undefined;
  const occN = me?.hand.filter((c) => CARD2[c]?.kind === 'occ').length ?? 0;
  const itemN = me ? me.hand.filter((c) => CARD2[c] && CARD2[c].kind !== 'occ').length + me.items.length + me.tools.length : 0;
  const count = step === 'occ' ? ` ${Math.min(3, occN + 1)}/3` : step === 'item' ? ` ${Math.min(5, itemN + 1)}/5` : '';
  return (
    <div className="kd-screen kd-draft kd2-setup">
      <header className="kd-screen-h">
        <div><small>{v.round ? `${v.year}年目の春・補充` : '準備'}{ask?.sub ? `・${ask.sub}` : ''}{!v.round && v.players[v.first] ? <span className="kd2-firstnote" data-kd="first-note">・先攻 <Token seat={v.first} size={12} />{nameOf(v, v.first)}</span> : null}</small><h2>{ask ? `${ask.title}${count}` : other !== undefined ? `${nameOf(v, other)}が選んでいます…` : '準備しています…'}</h2></div>
        {!v.round && <ol className="kd-laps" aria-label="準備の流れ">{SETUP_STEPS.map(([k, l], i) => <li key={k} className={i < at ? 'is-done' : i === at ? 'is-now' : ''}>{l}</li>)}</ol>}
      </header>
      {(() => {
        const mine = !!took || !!ask || v.setup?.seat === v.me;
        const cards = took ? took.cards : ask ? ask.cards : v.setup?.cards ?? [];
        const live = !!ask && !taken && !!onPick;
        return (
          <div className={`kd-offer${live ? '' : ' kd2-wait'}${mine ? ' is-mine' : ''}`} key={`${mine ? 'me' : 'other'}:${cards.join(',')}`} data-kd="offer" data-cards={`${mine ? 'me' : 'other'}:${cards.join(',')}`}>
            {cards.map((id, i) => (
              <div key={id + i} className={`kd-deal${taken === id ? ' is-taken' : taken ? ' is-gone' : ''}`} style={{ animationDelay: `${i * 90}ms` }}>
                <CardFace2 id={id} size={mine ? 'l' : 'm'} selected={sel === id || taken === id} onClick={live ? () => setSel(id) : undefined} />
              </div>
            ))}
          </div>
        );
      })()}
      <div className="kd-draft-foot">
        <div className="kd-hand-mini" data-kd="hand" aria-label={`あなたの手札 ${me?.hand.length ?? 0}`}>
          <small>{me?.leader ? <>リーダー：<b>{cardName(me.leader)}</b>・</> : null}手札 {me?.hand.length ?? 0}</small>
          {me?.hand.map((id, i) => <CardChip2 key={id + i} id={id} />)}
        </div>
        <div className="kd-draft-others" aria-label="ほかの人">
          {v.players.filter((p) => p.seat !== v.me).map((p) => (
            <span key={p.seat} className={`kd-chip${p.leader ? ' is-done' : ''}`} data-kd={`seat:${p.seat}`} title={p.name}><Token seat={p.seat} size={16} />{p.leader ? <LeaderArt id={p.leader} size={20} /> : <small>…</small>}</span>
          ))}
        </div>
      </div>
      {ask && onPick && !taken && <div className="kd-confirm"><button type="button" className="kd-btn is-primary" disabled={!sel} onClick={() => sel && pick(sel)}>{sel ? `「${cardName(sel)}」に決める` : 'カードを選んでください'}</button></div>}
      {(waiting || taken) && <div className="kd-confirm"><span className="kd-queued" role="status">{taken ? `「${cardName(taken)}」に決めました` : other !== undefined ? `${nameOf(v, other)}の番` : '少し待ってください'}</span></div>}
    </div>
  );
}

const ITEM_N = DATA.ITEM_COUNT;
const KINDS4: ['weapon' | 'armor' | 'tool' | 'spell', string, string][] = [['weapon', '武器', '戦力を上げる'], ['armor', '防具', '守り・反撃で効く'], ['tool', '道具', 'ずっと効く'], ['spell', '秘術', '使い切り・何度でも']];
export function RatioScreen({ v, onPick }: { v: View2; onPick: (r: string) => void }) {
  const [r, setR] = useState({ weapon: 2, armor: 1, tool: 2, spell: 1 });
  const sum = r.weapon + r.armor + r.tool + r.spell;
  const me = v.players[v.me];
  const bump = (k: keyof typeof r, d: number) => setR((x) => ({ ...x, [k]: Math.max(0, Math.min(ITEM_N, x[k] + d)) }));
  return (
    <div className="kd-screen kd-draft kd2-setup kd2-ratio">
      <header className="kd-screen-h">
        <div><small>準備・品物の割合</small><h2>品物{ITEM_N}枚の種類を決める（合計{ITEM_N}）</h2></div>
        <ol className="kd-laps">{SETUP_STEPS.map(([k, l], i) => <li key={k} className={i < 2 ? 'is-done' : i === 2 ? 'is-now' : ''}>{l}</li>)}</ol>
      </header>
      <div className="kd2-ratio-rows">
        {KINDS4.map(([k, jp, sub]) => (
          <div key={k} className={`kd2-ratio-row is-${k}`}>
            <span className="kd2-ratio-l"><b>{jp}</b><small>{sub}</small></span>
            <button type="button" className="kd-btn" aria-label={`${jp}を減らす`} onClick={() => bump(k, -1)} disabled={r[k] <= 0}>−</button>
            <b className="kd2-ratio-n" aria-live="polite">{r[k]}</b>
            <button type="button" className="kd-btn" aria-label={`${jp}を増やす`} onClick={() => bump(k, 1)} disabled={r[k] >= ITEM_N || sum >= ITEM_N}>＋</button>
            <span className="kd2-ratio-bar">{Array.from({ length: r[k] }, (_, i) => <i key={i} />)}</span>
          </div>
        ))}
        <p className={`kd2-ratio-sum${sum === ITEM_N ? ' is-ok' : ''}`}>合計 {sum} / {ITEM_N}</p>
      </div>
      <div className="kd-draft-foot">
        <div className="kd-hand-mini" data-kd="hand"><small>手札</small>{me?.hand.map((id, i) => <CardChip2 key={id + i} id={id} />)}</div>
      </div>
      <div className="kd-confirm"><button type="button" className="kd-btn is-primary" disabled={sum !== ITEM_N} onClick={() => onPick(`${r.weapon},${r.armor},${r.tool},${r.spell}`)}>この割合で品物を引く</button></div>
    </div>
  );
}

// ---------------------------------------------------------------- 盤面
const SPACE_SHORT: Record<string, string> = { guild: '職能を出す', forge: '武器を作る', workshop: '建てる', market: '売り買い', market2: '売り買い', board: '金貨+2', plaza: '食料か素材', hall: '先手＋食料' };

export function Board2({ v, selectable, selected, onSelect, cur }: { v: View2; selectable?: Set<string>; selected?: string | null; onSelect?: (id: string) => void; cur: Playing2 | null }) {
  const lastRefill = cur?.ev.t === 'refill' ? cur.ev.adds : undefined;
  const pick = (id: string) => (selectable?.has(id) && onSelect ? () => onSelect(id) : undefined);
  const lair = v.lair;
  const lairNow = lair.boss && lair.round === v.round && !lair.defeated;
  return (
    <div className="kd-board kd2-board" style={{ ['--kd-nn' as string]: v.nests.length + 1, ['--kd-ns' as string]: v.spaceOrder.length }}>
      <div className="kd-nests" role="group" aria-label="巣（1ラウンドに2組まで）">
        {v.nests.map((n) => {
          const can = selectable?.has(n.id);
          const spawn = cur?.ev.t === 'monster_spawn' && cur.ev.nest === n.id;
          return (
            <button type="button" key={n.id} data-kd={`space:${n.id}`} data-inspect={n.mon ? `mon2:${n.mon.uid}` : `space2:${n.id}`} className={`kd-nest${can ? ' is-can' : ''}${selected === n.id ? ' is-selected' : ''}${spawn ? ' is-spawn' : ''}`}
              style={msVar(cur)} onClick={pick(n.id)} aria-disabled={!can} aria-label={`${NEST_JP[n.id]}${n.mon ? `：${n.mon.name}` : '：空'}`}>
              {can && n.mon && <InfoDot target={`mon2:${n.mon.uid}`} />}
              <div className="kd-nest-bg"><NestArt id={n.id} width={200} /></div>
              <div className="kd-nest-h"><span className="kd-nest-name">{NEST_JP[n.id]}</span><span className="kd-cap">{Array.from({ length: DATA.NEST_CAP }, (_, i) => n.occupants[i] !== undefined ? <Token key={i} seat={n.occupants[i]} size={16} /> : <i key={i} className="kd-slot" />)}</span></div>
              {n.mon ? <MonsterCard2 m={n.mon} compact /> : <div className="kd-nest-empty">静か</div>}
              {n.wait !== undefined && <div className="kd-next"><Token seat={n.wait} size={14} />待ち伏せ</div>}
            </button>
          );
        })}
        <button type="button" data-kd="space:lair" data-inspect={lair.boss ? `mon2:${lair.boss.uid}` : 'space2:lair'} className={`kd-nest kd-lair${selectable?.has('lair') ? ' is-can' : ''}${selected === 'lair' ? ' is-selected' : ''}${lair.defeated ? ' is-defeated' : ''}`} onClick={pick('lair')} aria-disabled={!selectable?.has('lair')}>
          {selectable?.has('lair') && <InfoDot target={lair.boss ? `mon2:${lair.boss.uid}` : 'space2:lair'} />}
          <div className="kd-nest-bg"><NestArt id="lair" width={200} /></div>
          <div className="kd-nest-h"><span className="kd-nest-name">主の巣</span><span className="kd-cap">{lair.occupants.map((o, i) => <Token key={i} seat={o} size={16} />)}</span></div>
          {lair.boss ? <MonsterCard2 m={lair.boss} compact /> : <div className="kd-nest-empty">—</div>}
          <small className="kd-lair-when">{lair.defeated ? '討伐済み' : lairNow ? '今が決戦！' : lair.round ? `R${lair.round}に決戦` : ''}</small>
        </button>
      </div>
      {(v.forecast.length > 0 || v.players[v.me]) && (
        <div className="kd2-forecast">
          {v.forecast.length > 0 && (
            <span className="kd2-fcl" aria-label="次のラウンドに出るかもしれない魔物" data-inspect="forecast">
              <small>次の予告</small>
              {v.forecast.map((m) => <span key={m.uid} className="kd2-fc" data-inspect={`fc:${m.uid}`} role="button" tabIndex={0} aria-label={`${m.name} 強さ${m.str}`}><MonArt m={m} size={26} /><b>{m.str}</b></span>)}
            </span>
          )}
          {v.players[v.me] && <FateRow2 left={v.players[v.me].fateLeft} label inspect={`fate2:${v.me}`} />}
        </div>
      )}
      <div className="kd-spaces kd2-spaces" role="group" aria-label="行動マス" data-kd-scroll="">
        {groupSpaces(v.spaceOrder).map((g) => (
        <section key={g.id} className={`kd2-sgroup is-${g.id}`} aria-label={g.jp} style={{ ['--kd2-gn' as string]: g.ids.length }}>
        <h4 className="kd2-sgroup-h">{g.jp}</h4>
        <div className="kd2-sgrid">
        {g.ids.map((id) => {
          const s = v.spaces[id];
          const def = DATA.SPACE[id];
          const st = CARD2[id];
          const can = selectable?.has(id);
          const cap = def ? def.cap ?? 1 : (st as { cap?: number } | undefined)?.cap ?? 1;
          const full = cap > 0 && s.occupants.length >= cap;
          const add = lastRefill?.[id];
          const fresh = cur?.ev.t === 'stage_reveal' && cur.ev.card === id;
          return (
            <button type="button" key={id} data-kd={`space:${id}`} data-inspect={`space2:${id}`} className={`kd-space${can ? ' is-can' : ''}${selected === id ? ' is-selected' : ''}${full ? ' is-full' : ''}${add ? ' is-refill' : ''}${s.stage ? ' kd2-stage' : ''}${fresh ? ' is-new' : ''}`}
              style={msVar(cur)} onClick={pick(id)} aria-disabled={!can} aria-label={placeName(id)}>
              {can && <InfoDot target={`space2:${id}`} />}
              <strong className="kd-space-n">{placeName(id)}</strong>
              <span className="kd-space-m">
                <span className="kd-space-art">{s.stage ? <span className="kd2-stageart"><CardArt2 id={id} size={44} /><span className="kd2-stagebadge is-mini">段{s.stage}</span></span> : <SpaceArt id={id} size={44} />}</span>
                <span className="kd-space-e">
                  {Object.keys(s.stock).length ? <CostRow cost={s.stock} size={14} /> : <small>{SPACE_SHORT[id] ?? (s.stage ? (st?.text ?? '').slice(0, 14) : '')}</small>}
                </span>
              </span>
              {s.occupants.length > 0 && <span className="kd-space-by">{s.occupants.map((o, i) => <Token key={i} seat={o} size={16} />)}</span>}
            </button>
          );
        })}
        </div>
        </section>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 拠点（仲間ごとの装備）
function Pips({ n, max, cls }: { n: number; max: number; cls: string }) {
  return <span className={`kd-skill ${cls}`}>{Array.from({ length: max }, (_, i) => <i key={i} className={i < n ? 'is-on' : ''} />)}</span>;
}

export function BaseView2({ p, v, cur, onEquip }: { p: PV2; v: View2; cur: Playing2 | null; onEquip?: (companion: number, slot: 'weapon' | 'armor') => void }) {
  const mine = p.seat === v.me;
  const equipped = new Set(p.comps.flatMap((c) => [c.weapon, c.armor]).filter(Boolean) as string[]);
  const storage = p.items.filter((x, i) => !equipped.has(x) || p.items.indexOf(x) !== i);
  const lastBuild = cur?.ev.t === 'build' && cur.ev.seat === p.seat ? cur.ev.kind : undefined;
  return (
    <div className="kd-base kd2-base" style={msVar(cur)}>
      <div className="kd-base-h">
        <span data-inspect={p.leader ? `card2:${p.leader}` : undefined} style={{ display: 'contents' }}><LeaderArt id={p.leader} size={44} /></span>
        <div className="kd-base-who"><small>リーダー</small><strong>{p.leader ? cardName(p.leader) : '未定'}<span className="kd-who">（{nameOf(v, p.seat)}）</span></strong></div>
        <span className="kd-fame" data-kd={`fame:${p.seat}`}><KIcon name="fame" size={16} /><b><Num value={p.fame} /></b>{p.discontent > 0 && <small className="kd-bad">不満{p.discontent}</small>}</span>
      </div>
      <div className="kd-base-grid">
        <section className="kd-bsec kd-bsec-comps kd2-comps" aria-label="仲間と装備">
          <h3>仲間 {p.comps.length}/{DATA.MAX_COMPS}<small>寝床{p.beds}・使い魔{p.pets}</small>{onEquip && <small className="kd2-eqhint">装備の枠をタップで持ち替え</small>}</h3>
          <div className="kd2-complist">
            {p.comps.map((c, i) => (
              <div key={i} className={`kd2-comp${c.injured ? ' is-injured' : ''}${c.rest ? ' is-rest' : ''}${c.at ? ' is-out' : ''}`} data-kd={`comp:${p.seat}:${i}`}>
                <span className="kd2-comp-who"><Token seat={p.seat} size={24} injured={c.injured} dim={!!c.at || c.rest} /><small>{c.leader ? 'リーダー' : `仲間${i + 1}`}</small><small className="kd-comp-st">{c.injured ? '負傷' : c.rest ? '休み' : c.at ? placeName(c.at).slice(0, 4) : '待機'}</small></span>
                <span className="kd2-comp-sk"><span title="攻めの熟練"><KIcon name="power" size={14} /><Pips n={c.atk} max={DATA.MAX_SKILL.atk} cls="is-atk" /></span><span title="守りの熟練"><KIcon name="defense" size={14} /><Pips n={c.def} max={DATA.MAX_SKILL.def} cls="is-def" /></span></span>
                <span className="kd2-slots">
                  {(['weapon', 'armor'] as const).map((sl) => {
                    const id = c[sl];
                    const body = <><small>{sl === 'weapon' ? '武器' : '防具'}</small>{id ? <b>{cardName(id)}</b> : <i>{onEquip ? '＋持たせる' : 'なし'}</i>}</>;
                    return onEquip
                      ? <button key={sl} type="button" className={`kd2-slot is-${sl} is-edit${id ? ' is-on' : ''}`} data-kd={`slot:${i}:${sl}`} onClick={() => onEquip(i, sl)} aria-label={`${c.leader ? 'リーダー' : `仲間${i + 1}`}の${sl === 'weapon' ? '武器' : '防具'}を持ち替える`}>{body}</button>
                      : <span key={sl} className={`kd2-slot is-${sl}${id ? ' is-on' : ''}`} data-inspect={id ? `card2:${id}` : undefined} role={id ? 'button' : undefined} tabIndex={id ? 0 : undefined}>{body}</span>;
                  })}
                </span>
              </div>
            ))}
          </div>
        </section>
        <section className="kd-bsec kd-bsec-plots" aria-label="拠点">
          <h3>拠点<small>寝床{p.beds}・施設{p.tools.length}・防壁{p.walls}</small></h3>
          <div className="kd-plots">
            {Array.from({ length: p.beds }, (_, i) => <div key={`b${i}`} className={`kd-plot is-bed${lastBuild === 'bed' && i === p.beds - 1 ? ' is-new' : ''}`} title="寝床"><svg viewBox="0 0 40 30" width="28" aria-hidden><rect x="2" y="12" width="36" height="12" rx="3" fill="#8A5A34" /><rect x="4" y="8" width="10" height="8" rx="3" fill="#EADBC0" /><rect x="14" y="10" width="22" height="6" rx="2" fill="#6A7FB0" /></svg></div>)}
            {p.tools.map((id) => <div key={id} className={`kd-plot is-fac${lastBuild === 'facility' ? ' is-new' : ''}`} data-inspect={`card2:${id}`} title={cardName(id)}><CardChip2 id={id} /></div>)}
            {Array.from({ length: p.walls }, (_, i) => <div key={`w${i}`} className={`kd-plot is-wall${lastBuild === 'wall' && i === p.walls - 1 ? ' is-new' : ''}`} title="防壁"><EffectArt id="wall-block" size={26} /></div>)}
          </div>
        </section>
        <WinterFateSec p={p} v={v} />
        {!mine && (
          <section className="kd-bsec kd-bsec-res" aria-label="持ち物">
            <h3>持ち物</h3>
            <div className="kd-resgrid">{RES.map((r) => <ResCount key={r} r={r} n={p.res[r]} size={18} />)}</div>
          </section>
        )}
        <section className="kd-bsec kd-bsec-played" aria-label="出した職能">
          <h3>出した職能 {p.occs.length}{storage.length > 0 && <small>倉庫の装備{storage.length}</small>}</h3>
          <div className="kd-chiprow">{p.occs.map((id) => <CardChip2 key={id} id={id} />)}{storage.map((id, i) => <CardChip2 key={`s${id}${i}`} id={id} />)}{!p.occs.length && !storage.length && <small className="kd-none">まだない</small>}</div>
        </section>
        <section className="kd-bsec kd-bsec-hand" aria-label="手札">
          <h3>手札 {p.hand.length}枚{p.spellsUsed.length > 0 && <small>使った秘術{p.spellsUsed.length}</small>}</h3>
          <div className="kd-chiprow">{p.hand.map((id, i) => <CardChip2 key={id + i} id={mine ? id : '?'} />)}{!p.hand.length && <small className="kd-none">なし</small>}</div>
        </section>
        <section className="kd-bsec kd-bsec-tro" aria-label="討伐と古代の品">
          <h3>倒した魔物 {p.trophies.length}{p.ancient.length > 0 && <small>古代の品{p.ancient.length}</small>}</h3>
          <div className="kd-chiprow">
            {p.trophies.map((m, i) => <span key={i} className="kd-trophy"><MonArt m={{ type: m }} size={24} /></span>)}
            {p.ancient.map((a, i) => <CardChip2 key={`a${i}`} id={a} />)}
            {!p.trophies.length && !p.ancient.length && <small className="kd-none">まだない</small>}
          </div>
        </section>
      </div>
    </div>
  );
}

/** 冬の食料（要る・手持ち・足りない分）と運命の山の残り。自分も他の人も同じ計算 */
export function WinterFood2({ p, v, compact }: { p: PV2; v: View2; compact?: boolean }) {
  const f = winterFood(p);
  return (
    <span className={`kd2-wfood${f.short ? ' is-short' : ''}${compact ? ' is-compact' : ''}`} data-kd={`wfood:${p.seat}`} data-inspect={`upkeep2:${p.seat}`} role="button" tabIndex={0}
      aria-label={`${nameOf(v, p.seat)}の冬の食料：要る${f.need}・手持ち${f.have}${f.short ? `・${f.short}足りない（不満${f.discontent}）` : ''}`}>
      <KIcon name="upkeep" size={compact ? 13 : 16} /><b>{f.have}/{f.need}</b>{f.short ? <small>{compact ? `−${f.short}` : `${f.short}足りない・不満${f.discontent}`}</small> : !compact ? <small>足りる</small> : null}
    </span>
  );
}
function WinterFateSec({ p, v }: { p: PV2; v: View2 }) {
  const f = winterFood(p);
  return (
    <section className="kd-bsec kd2-bsec-wf" aria-label="冬の食料と運命の山">
      <h3>次の冬の食料<small>仲間{p.comps.length}人{f.need !== p.comps.length * DATA.UPKEEP ? `・カードの修正込み` : ''}</small></h3>
      <div className="kd2-wf-row"><WinterFood2 p={p} v={v} /></div>
      <h3>運命の山の残り<small>{p.fateLeft.length ? `${p.fateLeft.length}枚・春に混ぜ直し` : '次は混ぜ直し'}</small></h3>
      <FateRow2 left={p.fateLeft} size="m" inspect={`fate2:${p.seat}`} />
    </section>
  );
}

// ---------------------------------------------------------------- 依頼
export function QuestsView2({ v, cur }: { v: View2; cur: Playing2 | null }) {
  const me = v.players[v.me];
  const secret = me?.secret && me.secret !== '?' ? QUEST2[me.secret] : null;
  return (
    <div className="kd-quests">
      <p className="kd-hint">共通の依頼：達成した順に名声 {DATA.QUEST_FAME.join('・')}（同時に達成した人は同じ名声）</p>
      {v.quests.map((q) => {
        const stamp = cur?.ev.t === 'quest_done' && cur.ev.quest === q.id;
        return (
          <div key={q.id} className={`kd-quest${stamp ? ' is-stamp' : ''}`} data-kd={`quest:${q.id}`} data-inspect={`card2:${q.id}`} style={msVar(cur)} role="button" tabIndex={0}>
            <span className="kd-quest-ic"><EffectArt id="quest-stamp" size={28} /></span>
            <strong>{QUEST2[q.id]?.name ?? q.id}<small className="kd2-qtext">{QUEST2[q.id]?.text}</small></strong>
            <ol className="kd-quest-slots">{Array.from({ length: Math.max(DATA.QUEST_FAME.length, q.doneBy.length) }, (_, i) => <li key={i}>{q.doneBy[i] !== undefined ? <Token seat={q.doneBy[i]} size={18} /> : <i />}<small>{q.fames[i] ?? DATA.QUEST_FAME[i]}</small></li>)}</ol>
          </div>
        );
      })}
      {secret && (
        <div className="kd-quest kd2-secret" data-inspect={`card2:${secret.id}`} role="button" tabIndex={0}>
          <span className="kd-quest-ic">🔒</span>
          <strong>秘密依頼：{secret.name}<small className="kd2-qtext">{secret.text}（終わりに達成していれば名声{(secret.fame ?? DATA.SECRET_FAME) * pointScale(v.years)}{pointScale(v.years) > 1 ? `：${v.years}年なので×${pointScale(v.years)}` : ''}）</small></strong>
        </div>
      )}
    </div>
  );
}

export function Everyone2({ v, onOpen }: { v: View2; onOpen?: (s: Seat) => void }) {
  return (
    <div className="kd-everyone" style={{ ['--kd-np' as string]: v.players.length }}>
      {v.players.map((p) => (
        <button type="button" key={p.seat} className="kd-ev-row" onClick={onOpen ? () => onOpen(p.seat) : undefined} style={{ ['--seat' as string]: SEAT_COLORS[p.seat] }}>
          <LeaderArt id={p.leader} size={30} />
          <span className="kd-ev-n"><Token seat={p.seat} size={14} />{nameOf(v, p.seat)}<small>{p.leader ? cardName(p.leader) : ''}</small></span>
          <span className="kd-ev-f"><KIcon name="fame" size={14} /><b>{p.fame}</b></span>
          <span className="kd-ev-d">仲間{p.comps.length}・討伐{p.trophies.length}・職能{p.occs.length}・装備{p.comps.filter((c) => c.weapon).length + p.comps.filter((c) => c.armor).length}・防壁{p.walls}・手札{p.hand.length}</span>
          <span className="kd-ev-r">{RES.map((r) => <ResCount key={r} r={r} n={p.res[r]} size={14} />)}</span>
          <span className="kd2-ev-w"><small>冬</small><WinterFood2 p={p} v={v} compact /><FateRow2 left={p.fateLeft} label /></span>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- 戦闘・冬
const PART_ICON: Record<string, string> = { companion: '👤', familiar: '🐾', spell: '✷', mod: '★', weakness: '弱', card: '📜', boost: '➶', mode: '🛡' };
const MODE_JP: Record<string, string> = { normal: '通常', safe: '確実に', gamble: '賭ける', chip: '削るだけ', wait: '待ち伏せ', guard: '守って戦う', capture: '捕まえる' };

export function CombatPanel2({ v, cur }: { v: View2; cur: Playing2 | null }) {
  const c = v.combat;
  if (!c) return null;
  const m = c.monster;
  const need = c.strength ?? Math.max(1, m.str - m.wounds);
  const total = c.total ?? 0;
  const t = cur?.ev.t;
  const scale = Math.max(need, total, 1) * 1.15;
  return (
    <div className={`kd-combat${m.boss ? ' is-boss' : ''}${t === 'combat_start' ? ' is-enter' : ''}${t === 'counter' ? ' is-counter' : ''}`} data-kd="combat" style={msVar(cur)} role="dialog" aria-label="戦闘">
      <div className="kd-combat-h">
        <span>{m.boss ? '主との決戦' : `${NEST_JP[c.nest] ?? '巣'}の戦い`}・{MODE_JP[c.mode] ?? c.mode}</span>
        <span className="kd-combat-who">{c.seats.map((s) => <span key={s}><Token seat={s} size={18} />{nameOf(v, s)}</span>)}</span>
      </div>
      <div className="kd-arena">
        <div className={`kd-foe${c.result === 'win' ? ' is-down' : ''}${c.result === 'lose' ? ' is-stand' : ''}`} data-kd="combat:monster">
          <MonArt m={m} size={132} />
          {c.result === 'win' && t === 'clash' && <span className="kd-strike"><EffectArt id="slash" size={120} /></span>}
        </div>
        <div className="kd-foe-info">
          <strong>{m.name}</strong>
          <span className="kd-mon-stats">
            <span className="kd-stat is-str">強さ{m.wounds ? <><s>{m.str}</s>→{m.str - m.wounds}</> : m.str}</span>
            <span className="kd-stat is-ctr">反撃{m.counter}</span>
          </span>
        </div>
      </div>
      <div className="kd-gauge" data-kd="combat:gauge" aria-label={`戦力 ${total} ／ 必要 ${need}`}>
        <i className="kd-gauge-fill" style={{ width: `${(Math.min(total, scale) / scale) * 100}%` }} />
        <i className="kd-gauge-need" style={{ left: `${(need / scale) * 100}%` }}><span>必要{need}</span></i>
        <b><Num value={total} ms={cur?.ms ?? 300} /></b>
      </div>
      <ul className="kd-parts">
        {c.parts.map((x, i) => <li key={i} className={`is-${x.kind}`}><span className="kd-part-ic">{PART_ICON[x.kind] ?? '+'}</span><span className="kd-part-l">{x.label}{x.ref && x.kind === 'companion' ? `（${cardName(x.ref)}）` : ''}</span><b>{x.value >= 0 ? '+' : ''}{x.value}</b></li>)}
        {c.fate !== undefined && <li className={`is-fate${t === 'fate_flip' ? ' is-new' : ''}`}><span className="kd-part-ic">🂠</span><span className="kd-part-l">運命</span><b>{c.fate >= 0 ? '+' : ''}{c.fate}</b></li>}
      </ul>
      {c.result && <div className={`kd-result is-${c.result}`}>{c.result === 'win' ? '撃破！' : '撃破できず…傷が残った'}</div>}
      {c.counter && <div className="kd-counter">反撃 {c.counter.amount} − 守り {c.counter.defense} → {c.injured.length ? `${c.injured.length}人 負傷` : '負傷なし'}{c.injured.length > 0 && <EffectArt id="injury" size={28} />}</div>}
      {c.loot && <div className="kd-loot"><EffectArt id="loot-drop" size={26} /><CostRow cost={c.loot} size={18} signed />{c.trophy ? <span className="kd-fame-s">名声+{c.trophy}</span> : null}</div>}
    </div>
  );
}

export function WinterPanel2({ v, cur }: { v: View2; cur: Playing2 | null }) {
  const w = v.winter;
  if (!w) return null;
  return (
    <div className="kd-winter" style={msVar(cur)} role="dialog" aria-label="冬の処理">
      <h2>冬越し<small>仲間1人に食料{DATA.UPKEEP}・倒されていない魔物が襲う（防壁1つで1防ぐ）</small></h2>
      <div className="kd-winter-rows">
        {v.players.map((p) => {
          const u = w.upkeep.find((x) => x.seat === p.seat);
          const raid = w.raids.find((x) => x.seat === p.seat);
          const now = (cur?.ev.t === 'upkeep' || cur?.ev.t === 'raid') && cur.ev.seat === p.seat;
          return (
            <div key={p.seat} className={`kd-wrow${now ? ' is-now' : ''}`} data-kd={`winter:${p.seat}`}>
              <span className="kd-wrow-n"><Token seat={p.seat} size={20} />{nameOf(v, p.seat)}</span>
              <span className="kd-wrow-u">
                {u ? <><span className="kd-food">{Array.from({ length: u.need }, (_, i) => <i key={i} className={i < u.paid ? 'is-paid' : 'is-miss'} />)}</span>{u.discontent > 0 ? <b className="kd-bad">不満{u.discontent}（-{u.discontent * DATA.DISCONTENT}）</b> : <small>食料{u.paid}</small>}</> : <small>…</small>}
              </span>
              <span className="kd-wrow-r">{raid && <span className={`kd-raid${raid.damage ? ' is-dmg' : ' is-blocked'}`}>{raid.damage ? <>襲撃-{raid.damage}</> : <EffectArt id="wall-block" size={18} />}{raid.blocked ? <small>防いだ{raid.blocked}</small> : null}</span>}</span>
              <span className="kd-wrow-w">防壁{p.walls}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 最終集計（名声の内訳）
export function FinalScoring2({ v, rows, cur, after }: { v: View2; rows: ScoreRow[]; cur: Playing2 | null; after?: ReactNode }) {
  const animMs = cur?.ev.t === 'score' ? cur.ms : 0;
  const [p, setP] = useState(animMs ? 0 : 1);
  const [mode, setMode] = useState<'rank' | 'graph' | 'table'>('rank');
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
    let sum = 0;
    r.items.forEach((it, i) => { sum += it.fame * Math.max(0, Math.min(1, p * steps - i)); });
    return { r, sum: Math.round(sum) };
  }), [rows, p, steps]);
  const order = [...partial].sort((a, b) => b.sum - a.sum || a.r.seat - b.r.seat);
  const done = p >= 1;
  return (
    <div className={`kd-screen kd-final is-${mode}`}>
      <header className="kd-screen-h">
        <div><small>{v.years}年間の冒険の終わり</small><h2>{done ? '最終結果' : '名声の集計'}</h2></div>
        <div className="kd-seg" role="tablist" aria-label="表示">
          <button type="button" role="tab" aria-selected={mode === 'rank'} className={mode === 'rank' ? 'is-on' : ''} onClick={() => setMode('rank')}>順位</button>
          <button type="button" role="tab" aria-selected={mode === 'graph'} className={mode === 'graph' ? 'is-on' : ''} onClick={() => setMode('graph')}>推移</button>
          <button type="button" role="tab" aria-selected={mode === 'table'} className={mode === 'table' ? 'is-on' : ''} onClick={() => setMode('table')}>内訳</button>
        </div>
      </header>
      <div className="kd-final-board" style={{ height: `calc(var(--kd-frow) * ${rows.length})` }}>
        {partial.map(({ r, sum }) => {
          const rank = order.findIndex((x) => x.r.seat === r.seat);
          return (
            <div key={r.seat} className={`kd-frow${done && r.rank === 1 ? ' is-win' : ''}`} style={{ transform: `translateY(calc(var(--kd-frow) * ${rank}))` }}>
              <span className="kd-frank">{done ? r.rank : rank + 1}</span>
              <LeaderArt id={v.players[r.seat]?.leader} size={40} />
              <span className="kd-fname"><Token seat={r.seat} size={16} />{nameOf(v, r.seat)}</span>
              <span className="kd-fitems">{r.items.map((it, i) => (p * steps > i && it.fame !== 0) && <i key={it.key} className={it.fame < 0 ? 'is-neg' : ''}>{it.label}{it.fame > 0 ? '+' : ''}{it.fame}</i>)}</span>
              <b className="kd-ftotal">{sum}</b>
            </div>
          );
        })}
      </div>
      <table className="kd-ftable kd2-ftable" aria-label="名声の内訳">
        <thead><tr><th>項目</th>{rows.map((r) => <th key={r.seat}><span style={{ color: SEAT_COLORS[r.seat] }}>{SEAT_MARKS[r.seat]}</span>{nameOf(v, r.seat).slice(0, 3)}</th>)}</tr></thead>
        <tbody>
          {keys.map((k, i) => <tr key={k} className={p * steps > i ? 'is-shown' : ''}><th>{rows[0].items[i].label}</th>{rows.map((r) => <td key={r.seat} className={(r.items[i]?.fame ?? 0) < 0 ? 'is-neg' : ''}>{p * steps > i ? r.items[i]?.fame ?? 0 : ''}</td>)}</tr>)}
          <tr className="is-total"><th>合計</th>{rows.map((r) => <td key={r.seat}>{done ? r.total : ''}</td>)}</tr>
        </tbody>
      </table>
      {mode !== 'table' && <FameGraph v={v} rows={done ? rows : undefined} nameOf={(s) => nameOf(v, s)} />}
      {done && after && <div className="kd2-final-after">{after}</div>}
    </div>
  );
}

// ---------------------------------------------------------------- 全体
export function Kiridani2Table({ t, ask, onAnswer, extra, sheet, actions, picker, onEquip, finalExtra }: Table2Props) {
  const { view: v, cur } = t;
  const rootRef = useRef<HTMLDivElement>(null);
  const fxRef = useRef<FxApi>(null);
  const [tab, setTab] = useState<Tab2>('board');
  const [peek, setPeek] = useState<Seat | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [queued, setQueued] = useState<string | null>(null);
  const insp = useInspect();

  useLayoutEffect(() => { if (cur && fxRef.current) runFx(fxRef.current, cur, v); }, [cur?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  // 合わせ（sync）で動いた名声・持ち物：数字を光らせ、増減を浮かべる（出来事の演出に出なかった分だけ）
  const pulse = t.pulse;
  useLayoutEffect(() => {
    const root = rootRef.current, fx = fxRef.current;
    if (!pulse || !root) return;
    const flash = (sel: string, up: boolean) => {
      root.querySelectorAll<HTMLElement>(`[data-kd="${sel}"]`).forEach((el) => {
        el.classList.remove('kd2-flash', 'is-up', 'is-down');
        void el.offsetWidth;
        el.classList.add('kd2-flash', up ? 'is-up' : 'is-down');
      });
    };
    const ms = t.speed === 'minimal' ? 500 : 900;
    pulse.fame.forEach((d, s) => {
      if (!d) return;
      flash(`fame:${s}`, d > 0);
      if (!t.reduced) fx?.float(`fame:${s}`, `名声${d > 0 ? '+' : ''}${d}`, { ms, tone: d > 0 ? 'gold' : 'bad' });
    });
    for (const [r, d] of Object.entries(pulse.res[v.me] ?? {})) {
      if (!d) continue;
      flash(`res:${r}`, d > 0);
      if (!t.reduced) fx?.float(`res:${r}`, `${d > 0 ? '+' : ''}${d}`, { ms, tone: d > 0 ? 'good' : 'bad' });
    }
  }, [pulse?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  // 置く番になったら盤面へ（装備を持ち替えて問いが新しくなっただけなら、拠点のまま）
  const prevAsk = useRef<string | undefined>(undefined);
  useEffect(() => { setSel(null); setQueued(null); if (ask?.kind === 'place' && prevAsk.current !== 'place') { setTab('board'); setPeek(null); } prevAsk.current = ask?.kind; }, [ask]);
  useEffect(() => {
    if (!cur) return;
    const e = cur.ev;
    if ((e.t === 'build' || e.t === 'hire' || e.t === 'train' || e.t === 'craft') && e.seat === v.me && tab !== 'base' && ask?.kind !== 'place') setTab('base');
    if ((e.t === 'turn' && e.seat === v.me) || e.t === 'round_start') setTab('board');
  }, [cur?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const me = v.players[v.me];
  const answer = (c: string) => {
    t.sound.play(t.busy ? 'ui_queue' : 'ui_tap');
    // シート・トレイを開いただけなら「予約」にしない（やめたときに盤面の選択に戻れるように）
    if (onAnswer?.(c) === false) return;
    setQueued(c);
  };
  const placeAsk = ask?.kind === 'place' ? ask : null;
  const selectable = placeAsk && !queued ? new Set(placeAsk.options) : undefined;
  const setupPhase = v.phase === 'setup' || ask?.kind === 'ratio' || (ask?.kind === 'card' && ask.why !== 'draw');

  let main: ReactNode;
  if (v.phase === 'title') main = <div className="kd-screen kd-title"><h1>霧谷の冒険者団</h1><p>霧の谷に拠点を構え、{v.years}年間で名声を競う</p></div>;
  else if (v.phase === 'final' && v.final) main = <FinalScoring2 v={v} rows={v.final} cur={cur} after={finalExtra} />;
  else if (ask?.kind === 'ratio') main = <RatioScreen v={v} onPick={answer} />;
  else if (setupPhase) main = <CardPickScreen v={v} ask={ask?.kind === 'card' ? ask : null} onPick={ask?.kind === 'card' ? answer : undefined} />;
  else main = (
    <>
      <nav className="kd-tabs" role="tablist">
        {TABS.map((x) => <button key={x.id} type="button" role="tab" aria-selected={tab === x.id} data-kd={`tab:${x.id}`} className={tab === x.id ? 'is-on' : ''} onClick={() => { setTab(x.id); setPeek(null); }}>{x.label}</button>)}
      </nav>
      <div className="kd-tabbody" data-kd-scroll="">
        {tab === 'board' && <Board2 v={v} cur={cur} selectable={selectable} selected={sel ?? queued} onSelect={setSel} />}
        {tab === 'base' && me && <BaseView2 p={v.players[peek ?? v.me]} v={v} cur={cur} onEquip={(peek ?? v.me) === v.me ? onEquip : undefined} />}
        {tab === 'quests' && <QuestsView2 v={v} cur={cur} />}
        {tab === 'all' && <Everyone2 v={v} onOpen={(s) => { setPeek(s); setTab('base'); }} />}
      </div>
    </>
  );

  const hudRef = useRef<HTMLElement>(null);
  const barRef = useRef<HTMLElement>(null);
  const hasBar = !!me && v.phase === 'play' && !setupPhase;
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      root.style.setProperty('--kd-hud-h', `${hudRef.current?.offsetHeight ?? 0}px`);
      root.style.setProperty('--kd-bar-h', `${barRef.current?.offsetHeight ?? 0}px`);
    });
    if (hudRef.current) ro.observe(hudRef.current);
    if (barRef.current) ro.observe(barRef.current);
    return () => ro.disconnect();
  }, [hasBar]);

  const myTurn = !!placeAsk && !queued;
  const turnFlag: { text: string; me?: boolean; seat?: Seat } | null =
    v.combat ? { text: '戦闘中' } : v.winter ? { text: '冬越し' } : myTurn ? { text: 'あなたの番', me: true }
      : v.phase === 'setup' ? { text: '準備' } : v.turn !== undefined && v.players[v.turn] ? { text: `${nameOf(v, v.turn)}の番`, seat: v.turn, me: v.turn === v.me } : null;
  const pct = v.round ? progressPct(v) : 0;
  const pname = (id: string) => placeName(id);

  return (
    <insp.Provider value={insp.open}>
    <YearsCtx.Provider value={v.phase === 'title' ? undefined : v.years}>
    <div className={`kd-root kd-play kd2 is-ph-${v.phase === 'setup' || setupPhase ? 'draft' : v.phase}${t.reduced ? ' is-reduced' : ''} is-${v.season}${myTurn ? ' is-myturn' : ''}${v.players.length >= 5 ? ' is-many' : ''}`} ref={rootRef} onClick={insp.onClick} onKeyDown={insp.onKeyDown}>
      <header className="kd-hud" ref={hudRef}>
        <div className="kd-hud-title">
          <strong className="kd-hud-season">{v.round ? SEASON_JP[v.season] : '準備'}</strong>
          <span className="kd-hud-meta">
            <small>{v.round ? <>{v.year}/{v.years}年・<span className="kd-hud-rl">ラウンド</span><span className="kd-hud-rs">R</span><b>{v.round}</b>/{v.rounds}</> : `霧谷の冒険者団・${v.years}年`}</small>
            {v.round > 0 && <span className="kd2-prog" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`進み具合 ${pct}%`}><i style={{ width: `${pct}%` }} /></span>}
          </span>
        </div>
        {v.round > 0 && <span className="kd-tidechip" title="進み具合（魔物の強さはこれで上がる）"><span>進み {pct}%</span></span>}
        {turnFlag && (
          <div className={`kd-turnflag${turnFlag.me ? ' is-me' : ''}`} role="status" style={turnFlag.seat !== undefined ? { ['--seat' as string]: SEAT_COLORS[turnFlag.seat] } : undefined}>
            {turnFlag.seat !== undefined && <Token seat={turnFlag.seat} size={18} />}{turnFlag.text}
          </div>
        )}
        <div className="kd-hud-ctl">
          <button type="button" className="kd-iconbtn" onClick={t.skip} disabled={!t.busy} aria-label="この演出を飛ばす">⏩</button>
          <details className="kd-cat-menu kd-hudmenu">
            <summary aria-label={`演出の速さ（${SPEED_JP[t.speed]}）と音`}><span className="kd-hudmenu-s">{SPEED_JP[t.speed]}</span>{t.muted ? '🔇' : '🔊'}</summary>
            <div>
              <small>演出の速さ</small>
              <div className="kd-speed" role="radiogroup" aria-label="演出の速さ">
                {SPEEDS.map((s) => <button key={s} type="button" role="radio" aria-checked={t.speed === s} className={t.speed === s ? 'is-on' : ''} onClick={() => t.setSpeed(s)}>{SPEED_JP[s]}</button>)}
              </div>
              <button type="button" className="kd-btn" onClick={() => t.setMuted(!t.muted)}>{t.muted ? '🔇 音を出す' : '🔊 音を消す'}</button>
            </div>
          </details>
          {extra}
        </div>
      </header>
      <div className={`kd-shell${v.players.length ? '' : ' is-solo'}`}>
        {v.players.length > 0 && (
          <aside className="kd-rail">
            <div className="kd-strip" role="list" aria-label="プレイヤー">
              {v.players.map((p) => (
                <div key={p.seat} role="listitem" data-kd={`seat:${p.seat}`} data-inspect={`seat:${p.seat}`} tabIndex={0} aria-label={`${p.seat === v.me ? 'あなた' : p.name}：タップで詳しく`} className={`kd-pchip${v.turn === p.seat ? ' is-turn' : ''}${p.seat === v.me ? ' is-me' : ''}`} style={{ ['--seat' as string]: SEAT_COLORS[p.seat] }}>
                  <LeaderArt id={p.leader} size={30} />
                  <span className="kd-pchip-b"><span className="kd-pchip-n"><Token seat={p.seat} size={14} />{p.seat === v.me ? 'あなた' : p.name}{v.first === p.seat && v.round > 0 && <span className="kd-firstmark" title="先手">先</span>}</span>
                    <span className="kd-pchip-s"><b data-kd={`fame:${p.seat}`}><KIcon name="fame" size={12} /><Num value={p.fame} /></b>{v.round > 0 && (() => { const f = winterFood(p); return <em className={`kd2-pfood${f.short ? ' is-short' : ''}`} data-kd={`pfood:${p.seat}`} title={`冬の食料 ${f.have}/${f.need}`}>食{f.have}/{f.need}</em>; })()}<span>{p.comps.map((c, i) => <i key={i} className={c.injured || c.rest ? 'is-inj' : c.at ? 'is-out' : ''} />)}</span></span>
                  </span>
                </div>
              ))}
            </div>
            {v.log.length > 0 && (
              <section className="kd-log" aria-label="これまでの出来事">
                <h3>できごと</h3>
                <ol data-kd-scroll="">{v.log.slice(0, 40).map((l, i) => <li key={`${v.log.length - i}`}>{l}</li>)}</ol>
              </section>
            )}
          </aside>
        )}
        <main className="kd-main">{main}</main>
        {hasBar && me && (
          <footer className="kd-mybar" ref={barRef}>
            {placeAsk && !queued && picker}
            <div className="kd-mybar-r">{RES.map((r) => <ResCount key={r} r={r} n={me.res[r]} size={22} anchor={`res:${r}`} />)}{(() => { const f = winterFood(me); return <span className={`kd-upchip${f.short ? ' is-short' : ''}`} data-inspect={`upkeep2:${v.me}`} role="button" tabIndex={0} aria-label={`冬の食料 ${f.have}/${f.need}`}><KIcon name="upkeep" size={18} /><b>{f.have}/{f.need}</b></span>; })()}</div>
            <div className="kd-mybar-a">
              {placeAsk ? (
                queued ? <span className="kd-queued" role="status">{t.busy ? `予約：${pname(queued)}（演出のあとに実行）` : `${pname(queued)}へ`}</span>
                  : <>
                    <span className="kd-ask"><b>あなたの番</b><small>{t.busy ? '演出中でも選べます' : sel ? `${pname(sel)}に置く？` : '光る場所を選ぶ'}</small></span>
                    {actions}
                    <button type="button" className="kd-btn is-primary" disabled={!sel} onClick={() => sel && answer(sel)}>{sel ? `${pname(sel)}に置く` : '場所を選ぶ'}</button>
                  </>
              ) : <span className="kd-mybar-me">{turnFlag && !turnFlag.me ? <b className="kd-mybar-turn" style={turnFlag.seat !== undefined ? { ['--seat' as string]: SEAT_COLORS[turnFlag.seat] } : undefined}>{turnFlag.seat !== undefined && <Token seat={turnFlag.seat} size={16} />}{turnFlag.text}</b> : me.leader && <b>{cardName(me.leader)}</b>}<span data-kd="hand">手札 {me.hand.length}</span><span>仲間 {me.comps.filter((c) => !c.at && !c.injured && !c.rest).length}/{me.comps.length}</span></span>}
            </div>
          </footer>
        )}
      </div>
      {v.combat && <div className="kd-ovwrap"><CombatPanel2 v={v} cur={cur} /></div>}
      {v.winter && !v.combat && <div className="kd-ovwrap"><WinterPanel2 v={v} cur={cur} /></div>}
      {sheet}
      <Overlay cur={cur} v={v} />
      <div className="kd-sr" aria-live="polite">{v.log[0]}</div>
      <FxLayer ref={fxRef} root={() => rootRef.current} reduced={t.reduced} />
      {insp.target && <Inspect2 target={insp.target} v={v} depth={insp.depth} onBack={insp.back} onClose={insp.close} />}
    </div>
    </YearsCtx.Provider>
    </insp.Provider>
  );
}

export { RES_JP };
