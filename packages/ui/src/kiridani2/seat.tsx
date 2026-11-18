// 霧谷 v2 — 1つの席の「いま選ぶこと」を画面に振り分ける（ひとり遊びとオンラインで共通）。
// 答えはオンラインの答え（Action2）の形で返す。ひとり遊びは applyAction2 でそのまま手元の試合に渡す。
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  choiceLabel, optionLabel, previewFight, type Action2, type Cost, type FightMode, type Option, type SeatSession2,
} from '@midorino/engine/src/kiridani2';
import { KIcon } from '../kiridani/art-registry';
import { ChoiceSheet, type ChoiceSpec } from '../kiridani/ui/choice';
import { CostRow } from '../kiridani/ui/parts';
import { TradeButton, TradeTray } from '../kiridani/ui/tray';
import type { SeatSession } from '@midorino/engine/src/kiridani';
import { MonsterCard2 } from './parts2';
import { whyTitle, type Ask2 } from './table2';
import { cardName, placeName } from './view';
import { CARD2 } from './view';

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

// ---------------------------------------------------------------- 戦闘のトレイ
const MODES: [FightMode, string, string][] = [
  ['normal', '通常', '後押しなし'], ['safe', '確実に', '最悪の運命でも勝てるまで後押しを払う'], ['gamble', '賭ける', '運命+1で勝てるまで払う'],
  ['guard', '守って戦う', `戦力−2・反撃−2`], ['chip', '削るだけ', '負けても傷+1'], ['wait', '待ち伏せ', '共闘を待つ（来なければ終わりに単独）'],
];

function Sheet({ label, children }: { label: string; children: ReactNode }) {
  return <div className="kd-ovwrap kd-sheetwrap kd-traywrap"><div className="kd-tray" role="dialog" aria-label={label}>{children}</div></div>;
}

export function FightTray2({ s, sid, onPick, onCancel }: { s: SeatSession2; sid: string; onPick: (i: number) => void; onCancel: () => void }) {
  const w = s.waiting;
  const all = w?.k === 'choose' ? w.opts : [];
  const opts = all.filter((o) => o.s === sid);
  const fights = opts.filter((o) => o.i >= 0);
  const ks = [...new Set(fights.map((o) => o.k ?? 1))].sort();
  const [k, setK] = useState(ks.includes(2) ? 2 : ks[0] ?? 1);
  const modes = MODES.filter(([m]) => fights.some((o) => (o.k ?? 1) === k && o.mode === m));
  const [mode, setMode] = useState<FightMode>(modes.some(([m]) => m === 'safe') ? 'safe' : modes[0]?.[0] ?? 'normal');
  const o = fights.find((x) => (x.k ?? 1) === k && x.mode === mode) ?? fights.find((x) => (x.k ?? 1) === k);
  const pv = useMemo(() => (o && s.player ? previewFight(s.g, s.player, o) : null), [o, s]);
  const others = opts.filter((x) => x.i < 0);
  const join = fights.some((x) => x.join);
  const pct = pv ? Math.round(pv.pwin * 100) : 0;
  const tone = pct >= 80 ? 'is-good' : pct >= 40 ? 'is-mid' : 'is-bad';
  const pick = (x: Option) => onPick(all.indexOf(x));
  return (
    <Sheet label="戦闘">
      <header className="kd-tray-h">
        {pv && <span className="kd-tray-foe"><MonsterCard2 m={pv.monster} compact /></span>}
        <div className="kd-tray-ht">
          <small>{placeName(sid)}{join ? '・待ち伏せている人と共闘' : ''}</small>
          <strong>{pv ? `${pv.monster.name}に挑む` : '挑む'}</strong>
          {pv && <span className="kd-tray-stats"><span>強さ<b>{pv.monster.str - pv.monster.wounds}</b></span><span>反撃<b>{pv.monster.counter}</b></span></span>}
        </div>
      </header>
      <div className="kd-tray-sec">
        <h4>送る仲間</h4>
        <div className="kd-chips">
          {ks.map((x) => <button key={x} type="button" className={`kd-tchip${x === k ? ' is-on' : ''}`} aria-pressed={x === k} onClick={() => setK(x)}><span className="kd-tchip-ic"><KIcon name="companion" size={22} /></span><span className="kd-tchip-l">{x}人</span></button>)}
        </div>
      </div>
      <div className="kd-tray-sec">
        <h4>戦い方</h4>
        <div className="kd-chips kd2-modes">
          {modes.map(([m, jp, sub]) => <button key={m} type="button" className={`kd-tchip${m === mode ? ' is-on' : ''}`} aria-pressed={m === mode} onClick={() => setMode(m)}><span className="kd-tchip-l">{jp}<small>{sub}</small></span></button>)}
        </div>
      </div>
      {pv && (
        <section className="kd-tray-box kd2-fightpv" aria-label="見込み">
          <div className={`kd-meter ${tone}`}>
            <span><KIcon name="power" size={16} />戦力 {pv.power}{pv.partner ? `＋共闘${pv.partner}` : ''} ／ 必要 {pv.need}</span>
            <b>{mode === 'wait' ? '—' : `${pct}%`}</b>
          </div>
          <div className="kd2-fightpv-r">
            <span>反撃 {pv.counter} − 守り {pv.guard} → {pv.injuries ? <b className="kd-bad">{pv.injuries}人負傷</b> : '負傷なし'}</span>
            {Object.values(pv.cost).some((n) => n) && <span>払う：<CostRow cost={pv.cost as Cost} size={14} /></span>}
            {pv.boosts.length > 0 && <span>後押し：{pv.boosts.map((b) => (b === 'morale' ? '士気' : b === 'potion' ? 'ポーション' : cardName(b))).join('・')}</span>}
          </div>
        </section>
      )}
      {others.length > 0 && (
        <div className="kd-tray-sec">
          <h4>カードの効果</h4>
          <div className="kd-chips">{others.map((x, i) => { const l = optionLabel(s.g, s.player, x); return <button key={i} type="button" className="kd-tchip" onClick={() => pick(x)}><span className="kd-tchip-l">{l.title}</span></button>; })}</div>
        </div>
      )}
      <div className="kd-tray-act">
        <button type="button" className="kd-btn" onClick={onCancel}>置き場所を選び直す</button>
        <button type="button" className="kd-btn is-primary" disabled={!o} onClick={() => o && pick(o)}>{mode === 'wait' ? '待ち伏せる' : `${k}人で挑む${pv ? `（${pct}%）` : ''}`}</button>
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

/** 席の操作（盤面の答え・シート・トレイ・取引・秘術）をまとめて持つ */
export function useSeat2(s: SeatSession2 | null, send: (a: Action2) => void, opts: { sheetReady: boolean; onTrade: (b: number, give: Cost, get: Cost) => void }) {
  const [sub, setSub] = useState<{ sid: string; opts: Option[] } | null>(null);
  const [tray, setTray] = useState<{ kind: 'fight'; sid: string } | { kind: 'trade' } | { kind: 'spell' } | null>(null);
  const ui = useMemo(() => (s ? uiFor2(s) : { ask: null, sheet: null }), [s]);
  const w = s?.waiting ?? null;
  const reset = () => { setSub(null); setTray(null); };
  useEffect(reset, [s]);
  const go = (a: Action2) => { reset(); send(a); };

  const onAnswer = (c: string) => {
    if (!s || !w) return;
    if (w.k === 'choose') {
      const os = w.opts.filter((o) => o.s === c);
      if (isFight(c)) { setTray({ kind: 'fight', sid: c }); return; }
      if (os.length === 1) go({ t: 'opt', i: w.opts.indexOf(os[0]) });
      else setSub({ sid: c, opts: os });
      return;
    }
    if (w.k === 'ratio') {
      const [a, b, d] = c.split(',').map(Number);
      const r = w.options.find((x) => x.weapon === a && x.tool === b && x.spell === d);
      if (r) go({ t: 'ratio', v: r });
      return;
    }
    go({ t: 'card', id: c });
  };

  let sheetNode: ReactNode = null;
  if (s && w?.k === 'choose' && tray?.kind === 'fight') sheetNode = <FightTray2 key={tray.sid} s={s} sid={tray.sid} onPick={(i) => go({ t: 'opt', i })} onCancel={reset} />;
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
