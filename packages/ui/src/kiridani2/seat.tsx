// 霧谷 v2 — 1つの席の「いま選ぶこと」を画面に振り分ける（ひとり遊びとオンラインで共通）。
// 答えはオンラインの答え（Action2）の形で返す。ひとり遊びは applyAction2 でそのまま手元の試合に渡す。
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  choiceLabel, DATA, optionLabel, previewFight, type Action2, type Cost, type FightChip, type FightMode, type Option, type SeatSession2,
} from '@midorino/engine/src/kiridani2';
import { KIcon } from '../kiridani/art-registry';
import { ChoiceSheet, type ChoiceSpec } from '../kiridani/ui/choice';
import { InfoDot } from '../kiridani/ui/inspect';
import { CostRow, Token } from '../kiridani/ui/parts';
import { TradeButton, TradeTray } from '../kiridani/ui/tray';
import type { SeatSession } from '@midorino/engine/src/kiridani';
import { CardArt2, MonArt, rageText } from './parts2';
import { whyTitle, type Ask2 } from './table2';
import { CARD2, cardName, placeName } from './view';

const KIND_JP: Record<string, string> = { weapon: '武具', tool: '道具', spell: '秘術' };
const isFight = (sid: string) => sid.startsWith('nest') || sid === 'lair';

/** 画面で答える選択（ask）か、シートで答える選択（sheet）か */
export function uiFor2(s: SeatSession2): { ask: Ask2 | null; sheet: (ChoiceSpec & { toAction: (id: string) => Action2 }) | null } {
  const w = s.waiting;
  if (!w) return { ask: null, sheet: null };
  const g = s.g, p = s.player;
  switch (w.k) {
    case 'card': {
      if (w.why === 'draw') {
        return { ask: null, sheet: { title: 'カードを1枚取る', sub: w.kind ? `${KIND_JP[w.kind] ?? w.kind}から` : undefined, items: w.cards.map((c) => ({ id: c, title: cardName(c), detail: CARD2[c]?.text, card: CARD2[c] ? c : undefined })), toAction: (id) => ({ t: 'card', id }) } };
      }
      const [title, sub] = whyTitle(w.why);
      return { ask: { kind: 'card', why: w.why, cards: w.cards, title: w.kind && w.why === 'item' ? `${title}（${KIND_JP[w.kind] ?? w.kind}）` : title, sub }, sheet: null };
    }
    case 'ratio': return { ask: { kind: 'ratio', ratios: w.options }, sheet: null };
    case 'kind': return {
      ask: null, sheet: {
        title: '次に引く品物の種類', sub: `残り：武具${w.left.weapon}・道具${w.left.tool}・秘術${w.left.spell}`,
        items: w.options.map((k) => ({ id: k, title: KIND_JP[k] ?? k, detail: k === 'weapon' ? '武器・防具（仲間が持つ）' : k === 'tool' ? '施設（拠点に建てる）' : '使い切りの術', primary: false })),
        toAction: (id) => ({ t: 'kind', v: id as 'weapon' | 'tool' | 'spell' }),
      },
    };
    case 'choose': return { ask: { kind: 'place', options: [...new Set(w.opts.filter((o) => o.s !== '@spell').map((o) => o.s))] }, sheet: null };
    case 'heal': return {
      ask: null, sheet: {
        title: `仲間${w.comp + 1}の負傷を治す？`, sub: '治さないと次のラウンドは休み',
        items: [{ id: 'yes', title: '治す', cost: w.cost, primary: true }, { id: 'no', title: '休ませる' }],
        toAction: (id) => ({ t: 'yes', v: id === 'yes' }),
      },
    };
    case 'effect': {
      const c = CARD2[w.card];
      return {
        ask: null, sheet: {
          title: `${c?.name ?? w.card}の効果を使う？`, sub: c?.text,
          items: [{ id: 'yes', title: '使う', card: c ? w.card : undefined, primary: true }, { id: 'no', title: '使わない' }],
          toAction: (id) => ({ t: 'yes', v: id === 'yes' }),
        },
      };
    }
    case 'pick': {
      const what = w.what === 'craft' ? '作る装備' : w.what === 'build' ? '建てるもの' : w.what === 'occ' ? '出す職能' : w.what === 'exchange' ? '交換所で' : w.what === 'train' ? '鍛える熟練' : w.what === 'tame' ? '使い魔にする魔物' : w.what === 'again' ? 'もう一度' : cardName(w.what);
      return {
        ask: null, sheet: {
          title: `${what}を選ぶ`,
          items: w.options.map((x, i) => { const l = choiceLabel(g, p, x); return { id: String(i), title: l.title, detail: l.detail, card: l.card && CARD2[l.card] ? l.card : undefined, cost: l.cost }; }),
          toAction: (id) => ({ t: 'pick', i: Number(id) }),
        },
      };
    }
  }
}

function Sheet({ label, children }: { label: string; children: ReactNode }) {
  return <div className="kd-ovwrap kd-sheetwrap kd-traywrap"><div className="kd-tray" role="dialog" aria-label={label}>{children}</div></div>;
}

// ---------------------------------------------------------------- 戦闘のトレイ（v1 と同じ「選択式」）
// 送る仲間の数・戦い方を選び、使うもの（士気・ポーション・払うカードの効果・手札の秘術）をタップでトレイに足す。
// 足すたびに戦力・勝つ見込み・運命・反撃と負傷・払うものがその場で変わる。計算はエンジン（previewFight → makePlan の use）。
const EL_JP: Record<string, string> = { fire: '火', ice: '氷', thunder: '雷', light: '光', dark: '闇' };
const STYLES: [FightMode, string, string][] = [
  ['normal', '普通に', '戦力そのまま'], ['guard', '守って戦う', '戦力−2・反撃−2'], ['chip', '削るだけ', '負けても傷+1'],
];
const sumCost = (c: Cost) => Object.values(c).reduce((a: number, n) => a + (n ?? 0), 0);
const addC = (a: Cost, b: Cost): Cost => { const o: Cost = { ...a }; for (const [r, n] of Object.entries(b)) (o as Record<string, number>)[r] = ((o as Record<string, number>)[r] ?? 0) + (n as number); return o; };
const payable = (res: Record<string, number> | undefined, c: Cost) => !!res && Object.entries(c).every(([r, n]) => (res[r] ?? 0) >= (n as number));

function ChipIcon2({ c, size }: { c: FightChip; size: number }) {
  if (c.name === 'morale') return <KIcon name="food" size={size} />;
  if (c.name === 'potion') return <KIcon name="herb" size={size} />;
  if (c.card && CARD2[c.card]) return <CardArt2 id={c.card} size={size + 4} />;
  return <KIcon name="power" size={size} />;
}

export function FightTray2({ s, sid, onPick, onCancel }: { s: SeatSession2; sid: string; onPick: (i: number, use?: string[]) => void; onCancel: () => void }) {
  const w = s.waiting;
  const all = w?.k === 'choose' ? w.opts : [];
  const p = s.player;
  const opts = all.filter((o) => o.s === sid);
  const fights = opts.filter((o) => o.i >= 0 && o.k);
  const ks = [...new Set(fights.map((o) => o.k ?? 1))].sort();
  const join = fights.some((x) => x.join);
  const canWait = fights.some((o) => o.mode === 'wait');
  const [k, setK] = useState(ks.includes(2) ? 2 : ks[0] ?? 1);
  const [style, setStyle] = useState<FightMode>('normal');
  const [wait, setWait] = useState(false);
  const [use, setUse] = useState<string[]>([]);
  const mode: FightMode = wait ? 'wait' : style;
  const find = (kk: number, m: FightMode) => fights.find((x) => (x.k ?? 1) === kk && x.mode === m);
  const base = find(k, mode) ?? find(k, 'normal');
  const opt: Option | undefined = base && (mode === 'wait' ? base : { ...base, use });
  const pv = useMemo(() => (opt && p ? previewFight(s.g, p, opt) : null), [s, p, k, mode, use.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  /** おまかせ（確実に・運命+1まで）で選ばれる後押し */
  const preset = (m: FightMode) => { const o = find(k, m); return o && p ? previewFight(s.g, p, o)?.keys ?? null : null; };
  const others = opts.filter((x) => x.i < 0);
  const res = p?.res as Record<string, number> | undefined;
  const on = pv?.keys ?? [];
  const chips = pv?.chips ?? [];
  // 同じ key（士気）が複数あるときは、前から「使う」数だけオン
  const onAt = (i: number) => { const key = chips[i].key; const n = on.filter((x) => x === key).length; return chips.slice(0, i).filter((c) => c.key === key).length < n; };
  const canAdd = (c: FightChip) => !wait && payable(res, addC(pv?.cost ?? {}, c.cost));
  const toggle = (i: number) => {
    const c = chips[i];
    if (wait) return;
    if (onAt(i)) { const j = on.lastIndexOf(c.key); setUse(on.filter((_, x) => x !== j)); return; }
    if (!canAdd(c)) return;
    setUse([...on, c.key]);
  };
  const pct = pv ? Math.round(pv.pwin * 100) : 0;
  const tone = pct >= 80 ? 'good' : pct >= 40 ? 'mid' : 'bad';
  const ours = pv ? pv.power + pv.partner : 0;
  const fvals = pv ? pv.fate.map(([v]) => v) : [0];
  const scale = Math.max(pv?.need ?? 1, ours + Math.max(0, ...fvals), 1) * 1.1;
  const mon = pv?.monster;
  const boss = sid === 'lair';
  const title = mon ? (boss ? `主「${mon.name}」に挑む` : `${placeName(sid)}の${mon.name}に挑む`) : '挑む';
  const comps = p?.comps ?? [];
  const pick = (x: Option, u?: string[]) => onPick(all.indexOf(x), u);
  const presets = !wait ? ([['safe', '確実に勝てるまで'], ['gamble', '運命+1まで']] as const).map(([m, l]) => [m, l, find(k, m) ? preset(m) : null] as const).filter(([, , u]) => u && u.length) : [];
  return (
    <Sheet label="戦闘">
      <header className="kd-tray-h">
        {mon && <span className="kd-tray-foe" data-inspect={`mon2:${mon.uid}`} role="button" tabIndex={0} aria-label={`${mon.name}をくわしく`}><MonArt m={mon} size={64} /></span>}
        <div className="kd-tray-ht">
          <small>{join ? '待ち伏せている人と共闘する' : boss ? '主の巣：置いた全員の戦力で、ラウンドの終わりに挑む' : '使うものをタップしてトレイへ'}</small>
          <strong>{title}</strong>
          {mon && (
            <span className="kd-tray-stats">
              <span className="kd-stat is-str">強さ{mon.str - mon.wounds}{rageText(mon)}{mon.wounds ? <small>（傷{mon.wounds}）</small> : null}</span>
              <span className="kd-stat is-ctr">反撃{mon.counter}</span>
              {mon.weak && <span className="kd-stat is-weak"><KIcon name={mon.weak} size={14} />弱点{EL_JP[mon.weak] ?? mon.weak}</span>}
            </span>
          )}
        </div>
      </header>

      {pv && (
        <section className="kd-tray-box" aria-label="選んだもの">
          <div className="kd-tray-sum">
            <div className={`kd-vs is-${tone}`}>
              <span className="kd-vs-us"><small>戦力</small><b data-kd="fight-power">{pv.power}</b>{pv.partner ? <em>+{join ? '共闘' : '先に置いた人'}{pv.partner}</em> : null}</span>
              <span className="kd-vs-x">vs</span>
              <span className="kd-vs-them"><small>強さ</small><b>{pv.need}</b></span>
              <span className="kd-vs-p"><small>勝つ見込み</small><b data-kd="fight-pct">{wait ? '—' : `${pct}%`}</b></span>
            </div>
            <div className="kd-tray-gauge" aria-hidden>
              <i className="kd-tg-us" style={{ width: `${(Math.min(ours, scale) / scale) * 100}%` }} />
              <i className="kd-tg-need" style={{ left: `${(pv.need / scale) * 100}%` }} />
            </div>
            <div className="kd-tray-fate" aria-label={`運命で${pv.fateNeed}以上が出れば勝ち`}>
              <small>{pv.fateNeed <= Math.min(...fvals) ? 'どの運命でも勝てる' : pv.fateNeed > Math.max(...fvals) ? '運命では届かない' : `運命 ${pv.fateNeed > 0 ? '+' : ''}${pv.fateNeed} 以上で勝ち`}</small>
              <span>{[...pv.fate].sort((a, b) => a[0] - b[0]).map(([f, pr], i) => <i key={i} className={f >= pv.fateNeed ? 'is-win' : 'is-lose'} title={`${Math.round(pr * 100)}%`}>{f > 0 ? `+${f}` : f}</i>)}</span>
            </div>
            <div className="kd-tray-ctr">
              <span><KIcon name="injury" size={16} />反撃{pv.counter} − 守り{pv.guard}</span>
              <b className={pv.injuries ? 'kd-bad' : 'kd-good'}>{pv.injuries ? `負傷 ${pv.injuries}人の見込み` : '負傷なし'}</b>
            </div>
          </div>
          <div className="kd-tray-items">
            {pv.idxs.length > 0 && <span className="kd-tray-item is-base"><Token seat={p!.pid} size={18} />仲間{pv.idxs.length}人<b>+{pv.parts.filter((x) => x.kind === 'companion').reduce((a, x) => a + x.value, 0)}</b></span>}
            {pv.parts.filter((x) => x.kind !== 'companion' && x.kind !== 'boost' && x.kind !== 'spell' && !(x.kind === 'card' && x.ref && on.some((k2) => k2.startsWith(`${x.ref}#`)))).map((x, i) => (
              <span key={`p${i}`} className="kd-tray-item is-base" data-inspect={x.ref ? `card2:${x.ref}` : undefined}>
                {x.ref && CARD2[x.ref] ? <CardArt2 id={x.ref} size={18} /> : <KIcon name="power" size={16} />}
                {x.label}<b>{x.value >= 0 ? `+${x.value}` : x.value}</b>
              </span>
            ))}
            {chips.map((c, i) => (onAt(i) ? (
              <button key={`c${i}`} type="button" className="kd-tray-item" onClick={() => toggle(i)} aria-label={`${c.label}を外す`}>
                <ChipIcon2 c={c} size={18} />{c.label}<b>+{c.gain}</b>
              </button>
            ) : null))}
            {wait && <span className="kd-tray-item is-wait">待ち伏せ</span>}
          </div>
          <div className="kd-tray-cost"><small>払うもの</small>{sumCost(pv.cost) ? <CostRow cost={pv.cost as Cost} size={18} /> : <span>なし</span>}</div>
        </section>
      )}

      {/* 送る仲間（行く仲間と装備） */}
      <div className="kd-tray-sec">
        <h4>送る仲間</h4>
        <div className="kd-chips">
          {ks.map((n) => (
            <button key={n} type="button" className={`kd-tchip is-k${k === n ? ' is-on' : ''}`} aria-pressed={k === n} onClick={() => setK(n)}>
              <span className="kd-tchip-ic">{Array.from({ length: n }, (_, i) => <Token key={i} seat={p?.pid ?? 0} size={18} />)}</span>
              <span className="kd-tchip-l">{n}人</span>
              <small>守り+{n}</small>
            </button>
          ))}
          {canWait && (
            <button type="button" className={`kd-tchip is-wait${wait ? ' is-on' : ''}`} aria-pressed={wait} onClick={() => setWait(!wait)}>
              <span className="kd-tchip-ic">⏳</span><span className="kd-tchip-l">待ち伏せ</span><small>共闘の相手を待つ</small>
            </button>
          )}
        </div>
        {pv && pv.idxs.length > 0 && (
          <div className="kd2-fcomps" aria-label="行く仲間と装備">
            {pv.idxs.map((i) => { const c = comps[i]; const wv = c?.weapon ? CARD2[c.weapon] as { power?: number } | undefined : undefined; return c ? (
              <div key={i} className="kd2-fcomp">
                <span className="kd2-comp-who"><Token seat={p!.pid} size={20} /><small>{c.leader ? 'リーダー' : `仲間${i + 1}`}</small></span>
                <span className="kd2-fcomp-st"><KIcon name="power" size={13} />{DATA.POWER_PER + c.atk + (wv?.power ?? 0)}<KIcon name="defense" size={13} />{DATA.GUARD_PER + c.def}</span>
                <span className={`kd2-slot is-weapon${c.weapon ? ' is-on' : ''}`} data-inspect={c.weapon ? `card2:${c.weapon}` : undefined}><small>武器</small>{c.weapon ? <b>{cardName(c.weapon)}</b> : <i>なし</i>}</span>
                <span className={`kd2-slot is-armor${c.armor ? ' is-on' : ''}`} data-inspect={c.armor ? `card2:${c.armor}` : undefined}><small>防具</small>{c.armor ? <b>{cardName(c.armor)}</b> : <i>なし</i>}</span>
              </div>
            ) : null; })}
          </div>
        )}
        {wait && <p className="kd-tray-note">この巣で待つ。ほかの人が来れば一緒に戦い、来なければラウンドの終わりに単独で戦う（使うものはそのとき「運命+1まで」で自動で選ぶ）。</p>}
      </div>

      {/* 戦い方 */}
      {!wait && (
        <div className="kd-tray-sec">
          <h4>戦い方</h4>
          <div className="kd-chips kd2-modes">
            {STYLES.filter(([m]) => find(k, m)).map(([m, jp, sub]) => (
              <button key={m} type="button" className={`kd-tchip${m === style ? ' is-on' : ''}`} aria-pressed={m === style} onClick={() => setStyle(m)}><span className="kd-tchip-l">{jp}<small>{sub}</small></span></button>
            ))}
          </div>
        </div>
      )}

      {/* 使うもの */}
      <div className="kd-tray-sec">
        <h4>使うもの<small>タップでオン・オフ</small></h4>
        {chips.length ? (
          <div className="kd-chips kd2-fchips">
            {chips.map((c, i) => {
              const isOn = onAt(i);
              const ok = isOn || canAdd(c);
              return (
                <button key={i} type="button" className={`kd-tchip${isOn ? ' is-on' : ''}${c.spell ? ' is-spell' : ''}`} aria-pressed={isOn} aria-disabled={!ok} onClick={() => toggle(i)} data-chip={c.key}>
                  <span className="kd-tchip-ic"><ChipIcon2 c={c} size={26} /></span>
                  <span className="kd-tchip-l">{c.label}</span>
                  <b className="kd-tchip-pw">+{c.gain}</b>
                  <span className="kd-tchip-c">{sumCost(c.cost) ? <CostRow cost={c.cost as Cost} size={13} /> : <small>無料</small>}</span>
                  {c.spell && <small className="kd-tchip-tag">使うと捨てる</small>}
                  {!ok && !wait && <small className="kd-tchip-tag is-bad">足りない</small>}
                  {c.card && <InfoDot target={`card2:${c.card}`} />}
                </button>
              );
            })}
          </div>
        ) : <p className="kd-tray-note">使えるものがない（士気・ポーション・秘術など）。仲間の力だけで挑む。</p>}
        {presets.length > 0 && (
          <div className="kd2-presets">
            <small>おまかせ：</small>
            {presets.map(([m, l, u]) => <button key={m} type="button" className="kd-btn kd2-preset" onClick={() => setUse([...(u ?? [])])}>{l}</button>)}
            {on.length > 0 && <button type="button" className="kd-btn kd2-preset" onClick={() => setUse([])}>全部外す</button>}
          </div>
        )}
      </div>

      {others.length > 0 && (
        <div className="kd-tray-sec">
          <h4>カードの効果（戦う代わりに）</h4>
          <div className="kd-chips">{others.map((x, i) => { const l = optionLabel(s.g, s.player, x); return <button key={i} type="button" className="kd-tchip" onClick={() => pick(x)}><span className="kd-tchip-l">{l.title}</span></button>; })}</div>
        </div>
      )}

      {pv?.short && <p className="kd-tray-err" role="alert">払うものが足りない</p>}
      <div className="kd-tray-act">
        <button type="button" className="kd-btn" onClick={onCancel} aria-label="やめて置き場所を選び直す">選び直す</button>
        <button type="button" className="kd-btn is-primary" disabled={!base || !!pv?.short} onClick={() => base && pick(base, mode === 'wait' ? undefined : on)}>
          {wait ? '待ち伏せする' : boss ? `主の巣に置く（${pct}%）` : `${k}人で挑む（${pct}%）`}
        </button>
      </div>
    </Sheet>
  );
}

/** 置き場所を選んだあとの細かい選択 */
export function optionSheet2(s: SeatSession2, sid: string, opts: Option[]): ChoiceSpec {
  const items = opts.map((o, i) => { const l = optionLabel(s.g, s.player, o); return { id: String(i), title: l.title, detail: l.detail, card: l.card && CARD2[l.card] ? l.card : undefined, cost: l.cost }; });
  const title = sid === 'guild' ? '出す職能を選ぶ' : sid === 'forge' ? '作る武器を選ぶ（武具カードか共通の武器）' : sid === 'workshop' ? '工房で建てるもの' : sid.startsWith('market') ? '交換所で売り買い' : `${placeName(sid)}でできること`;
  return { title, items, cancel: '置き場所を選び直す' };
}

/** AI の取引の返事（v1 のトレイは「喜び具合」を見るので、受ける／断るから作る） */
function tradeAdapter(s: SeatSession2): SeatSession {
  return new Proxy(s, {
    get(target, prop) {
      if (prop === 'judgeTrade') return (b: number, give: Cost, get: Cost) => { const j = target.judgeTrade(b, give, get); return { ...j, gain: j.accept ? 1 : -1 }; };
      if (prop === 'player') { const p = target.player; return p ? new Proxy(p, { get: (pp, k) => (k === 'char' ? undefined : (pp as never)[k]) }) : p; }
      const v = (target as never)[prop];
      return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(target) : v;
    },
  }) as unknown as SeatSession;
}

/** 盤面で選んだもの（置く場所・カード・割合 "w,t,s"）をどう扱うか。
 *  send＝そのまま答える／fight＝戦闘のトレイを開く／sub＝細かい選択のシートを開く（どちらもまだ答えていない。やめれば同じ問いに戻る）／none＝選べない */
export type Route2 = { k: 'send'; a: Action2 } | { k: 'fight'; sid: string } | { k: 'sub'; sid: string; opts: Option[] } | { k: 'none' };
export function routeAnswer2(w: NonNullable<SeatSession2['waiting']>, c: string): Route2 {
  if (w.k === 'choose') {
    const os = w.opts.filter((o) => o.s === c && o.s !== '@spell');
    if (!os.length) return { k: 'none' };
    if (isFight(c)) return { k: 'fight', sid: c };
    if (os.length === 1) return { k: 'send', a: { t: 'opt', i: w.opts.indexOf(os[0]) } };
    return { k: 'sub', sid: c, opts: os };
  }
  if (w.k === 'ratio') {
    const [a, b, d] = c.split(',').map(Number);
    const r = w.options.find((x) => x.weapon === a && x.tool === b && x.spell === d);
    return r ? { k: 'send', a: { t: 'ratio', v: r } } : { k: 'none' };
  }
  if (w.k === 'card' && w.cards.includes(c)) return { k: 'send', a: { t: 'card', id: c } };
  return { k: 'none' };
}

/** 席の操作（盤面の答え・シート・トレイ・取引・秘術）をまとめて持つ */
export function useSeat2(s: SeatSession2 | null, send: (a: Action2) => void, opts: { sheetReady: boolean; onTrade: (b: number, give: Cost, get: Cost) => void }) {
  const [sub, setSub] = useState<{ sid: string; opts: Option[] } | null>(null);
  const [tray, setTray] = useState<{ kind: 'fight'; sid: string } | { kind: 'trade' } | { kind: 'spell' } | null>(null);
  const ui = useMemo(() => (s ? uiFor2(s) : { ask: null, sheet: null }), [s]);
  const w = s?.waiting ?? null;
  const reset = () => { setSub(null); setTray(null); };
  useEffect(reset, [s]);
  const go = (a: Action2) => { reset(); send(a); };

  /** 盤面の答え。トレイ・シートを開いただけ（まだ決まっていない）なら false */
  const onAnswer = (c: string): boolean => {
    if (!w) return false;
    const r = routeAnswer2(w, c);
    switch (r.k) {
      case 'send': go(r.a); return true;
      case 'fight': setSub(null); setTray({ kind: 'fight', sid: r.sid }); return false;
      case 'sub': setTray(null); setSub({ sid: r.sid, opts: r.opts }); return false;
      default: return false;
    }
  };

  let sheetNode: ReactNode = null;
  if (s && w?.k === 'choose' && tray?.kind === 'fight') sheetNode = <FightTray2 key={tray.sid} s={s} sid={tray.sid} onPick={(i, use) => go(use ? { t: 'opt', i, use } : { t: 'opt', i })} onCancel={reset} />;
  else if (s && w?.k === 'choose' && tray?.kind === 'trade') sheetNode = <TradeTray s={tradeAdapter(s)} onTrade={(b, give, get) => { reset(); opts.onTrade(b, give, get); }} onCancel={reset} />;
  else if (s && w?.k === 'choose' && tray?.kind === 'spell') {
    const sp = w.opts.filter((o) => o.s === '@spell');
    sheetNode = <ChoiceSheet spec={{ title: '秘術を使う（置く前に1枚）', items: sp.map((o, i) => { const l = optionLabel(s.g, s.player, o); return { id: String(i), title: l.title, detail: l.detail, card: l.card, cost: l.cost }; }), cancel: '使わない' }} onPick={(id) => go({ t: 'opt', i: w.opts.indexOf(sp[Number(id)]) })} onCancel={reset} />;
  } else if (s && w?.k === 'choose' && sub) {
    sheetNode = <ChoiceSheet spec={optionSheet2(s, sub.sid, sub.opts)} onPick={(id) => go({ t: 'opt', i: w.opts.indexOf(sub.opts[Number(id)]) })} onCancel={reset} />;
  } else if (ui.sheet && opts.sheetReady) {
    const sh = ui.sheet;
    sheetNode = <ChoiceSheet spec={sh} onPick={(id) => go(sh.toAction(id))} />;
  }

  const spells = w?.k === 'choose' ? w.opts.filter((o) => o.s === '@spell').length : 0;
  const actions = ui.ask?.kind === 'place' && s ? (
    <>
      {spells > 0 && <button type="button" className="kd-btn kd-tradebtn" onClick={() => setTray({ kind: 'spell' })} aria-label={`秘術（${spells}）`}>✷ 秘術<small>{spells}</small></button>}
      <TradeButton s={tradeAdapter(s)} onOpen={() => setTray({ kind: 'trade' })} />
    </>
  ) : null;
  return { ask: ui.ask, hasSheet: !!ui.sheet, sheetNode, actions, onAnswer, reset };
}
