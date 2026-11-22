// 霧谷 v2 — 1つの席の「いま選ぶこと」を画面に振り分ける（ひとり遊びとオンラインで共通）。
// 答えはオンラインの答え（Action2）の形で返す。ひとり遊びは applyAction2 でそのまま手元の試合に渡す。
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  choiceLabel, DATA, optionLabel, opsText, previewFight, whenText, RES, slotOf, type Action2, type Choice, type Cost, type FightChip, type FightMode, type Game, type Option,
  type Player, type SeatSession2,
} from '@midorino/engine/src/kiridani2';
import { KIcon } from '../kiridani/art-registry';
import { ChoiceSheet, type ChoiceItem, type ChoiceSpec } from '../kiridani/ui/choice';
import { InfoDot } from '../kiridani/ui/inspect';
import { CostRow, Token } from '../kiridani/ui/parts';
import { TradeButton, TradeTray } from '../kiridani/ui/tray';
import type { SeatSession } from '@midorino/engine/src/kiridani';
import { CardArt2, FateRow2, MonArt } from './parts2';
import { whyTitle, type Ask2 } from './table2';
import { MarketTray2 } from './market2';
import { CARD2, cardName, placeName } from './view';

const KIND_JP: Record<string, string> = { weapon: '武器', armor: '防具', tool: '道具', spell: '秘術' };
const isFight = (sid: string) => sid.startsWith('nest') || sid === 'lair';
const SLOT_JP = { weapon: '武器', armor: '防具' } as const;

// ---------------------------------------------------------------- 仲間（戦力・守り・装備）
export const compName = (p: Player, i: number) => (p.comps[i]?.leader ? 'リーダー' : `仲間${i + 1}`);
/** 仲間1人の戦力と守り（エンジンの計算と同じ：基本＋熟練＋装備） */
export function compStats(g: Game, p: Player, i: number): { power: number; guard: number } {
  const c = p.comps[i];
  const gd = (id: string | null) => (id ? g.card(id).guard ?? 0 : 0);
  return { power: g.compPower(p, i), guard: DATA.GUARD_PER + c.def + gd(c.armor) + gd(c.weapon) };
}

// ---------------------------------------------------------------- 細かい選択を短く（見出し＋払う→得るのアイコン。説明は要るときだけ）
const one = (r: string, n: number) => ({ [r]: n }) as Cost;
const addOps = (ops: { gain?: Cost; pay?: Cost }[], k: 'gain' | 'pay') => ops.reduce<Cost>((a, op) => (op[k] ? addC(a, op[k]!) : a), {});
const resNames = (c: Cost) => RES.filter((r) => c[r]).map((r) => `${DATA.RES_JP[r]}${c[r]! > 1 ? `×${c[r]}` : ''}`).join('＋');
export function choiceItem2(g: Game, p: Player | null, x: Choice, id: string): ChoiceItem {
  if (typeof x === 'object') {
    if (x.m === 'sell') return { id, title: `${DATA.RES_JP[x.r]}を売る`, cost: one(x.r, x.q), gain: { gold: (p ? g.sellPrice(p, x.r) : DATA.sellPrice(x.r)) * x.q } };
    if (x.m === 'buy') return { id, title: `${DATA.RES_JP[x.r]}を買う`, cost: { gold: DATA.BUY[x.r] * x.q }, gain: one(x.r, x.q) };
    if (x.m === 'item') return { id, title: `${cardName(x.id)}を売る`, card: CARD2[x.id] ? x.id : undefined, gain: { gold: g.itemSell(x.id) } };
    if (x.m === 'tool') return { id, title: `建てた${cardName(x.id)}を売る`, card: CARD2[x.id] ? x.id : undefined, gain: { gold: g.itemSell(x.id) } };
    if (x.m === 'relic') return { id, title: `${x.broken ? '壊れた' : ''}${g.anc.get(x.id)?.name ?? x.id}を売る`, gain: { gold: g.relicSell(x.id, x.broken) } };
    if (x.m === 'both') return { id, title: `${DATA.RES_JP[x.sell.r]}を売って${DATA.RES_JP[x.buy.r]}を買う`, cost: one(x.sell.r, x.sell.q), gain: one(x.buy.r, x.buy.q) };
  }
  const l = choiceLabel(g, p, x);
  return { id, title: l.title, detail: l.detail, card: l.card && CARD2[l.card] ? l.card : undefined, cost: l.cost };
}
/** 置き場所の選択肢1つ（資源を払う・得るだけなら、見出しは得るもの、アイコンで 払う→得る） */
function spaceItem2(g: Game, p: Player | null, o: Option, id: string): ChoiceItem {
  if (o.x !== undefined && o.i >= 0) return choiceItem2(g, p, o.x, id);
  const l = optionLabel(g, p, o);
  const sp = g.space(o.s);
  const ops = o.i >= 0 && sp && !sp.def.accum ? sp.def.options[o.i] ?? [] : [];
  if (ops.length && ops.every((op) => op.gain || op.pay)) {
    const gain = addOps(ops, 'gain'), cost = addOps(ops, 'pay');
    if (sumCost(gain)) return { id, title: resNames(gain), cost, gain };
  }
  return { id, title: l.title, detail: l.detail, card: l.card && CARD2[l.card] ? l.card : undefined, cost: l.cost };
}
/** 選択肢に同じ説明がくり返されるときは、見出しの下（sub）に1回だけ出す */
function hoist(items: ChoiceItem[], sub?: string): { items: ChoiceItem[]; sub?: string } {
  const ds = items.map((it) => it.detail);
  const same = items.length > 1 && ds[0] && ds.every((d) => d === ds[0]) ? ds[0] : undefined;
  const top = sub ?? same;
  return { items: top ? items.map((it) => (it.detail === top ? { ...it, detail: undefined } : it)) : items, sub: top };
}

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
    case 'multi': return { ask: null, sheet: null };
    case 'choose': return { ask: { kind: 'place', options: [...new Set(w.opts.filter((o) => !isSpellOpt(o)).map((o) => o.s))] }, sheet: null };
    case 'heal': return {
      ask: null, sheet: {
        title: `仲間${w.comp + 1}の負傷を治す？`, sub: '治さないと次のラウンドは休み',
        items: [{ id: 'yes', title: '治す', cost: w.cost, primary: true }, { id: 'no', title: '休ませる' }],
        toAction: (id) => ({ t: 'yes', v: id === 'yes' }),
      },
    };
    case 'effect': {
      // どの効果か（カードに効果が2つ以上あれば「n つ目」）・いつの効果か・何を払って何が起きるかを出す。
      // 1つ目を断ったあとに2つ目を聞くときも、見出しと中身で違いがわかる
      const c = CARD2[w.card];
      const n = c?.effects?.length ?? 0;
      const nth = n > 1 && w.ei !== undefined ? `（効果${w.ei + 1}／${n}）` : '';
      const what = opsText(w.ops) || c?.text || '';
      const pays = w.ops.reduce<Cost>((a, op) => (op.pay ? addC(a, op.pay) : op.convert ? addC(a, op.convert.from) : a), {});
      return {
        ask: null, sheet: {
          title: `${c?.name ?? w.card}${nth}：${whenText(w.when, placeName)}`, sub: n > 1 ? `カード全体：${c?.text ?? ''}` : c?.text,
          items: [
            { id: 'yes', title: `使う：${what}`, card: c ? w.card : undefined, cost: sumCost(pays) ? pays : undefined, primary: true },
            { id: 'no', title: '使わない', detail: n > 1 && w.ei !== undefined && w.ei + 1 < n ? 'この効果は使わずに、次の効果へ' : 'この効果は使わずに進む' },
          ],
          toAction: (id) => ({ t: 'yes', v: id === 'yes' }),
        },
      };
    }
    case 'pick': {
      if (w.what.startsWith('equip:') && p) {
        const id = w.what.slice(6), cd = g.card(id), sl = slotOf(cd) ?? 'weapon';
        return {
          ask: null, sheet: {
            title: `${cd.name}を誰に持たせる？`, sub: `${SLOT_JP[sl]}・${cd.text}`,
            items: w.options.map((x, i) => {
              const ci = String(x) === 'eq:-' ? -1 : Number(String(x).slice(3));
              if (ci < 0) return { id: String(i), title: '倉庫に置く', detail: '自分の番に「拠点」でいつでも持たせられる' };
              const c = p.comps[ci], st = compStats(g, p, ci);
              const out = [c[sl], sl === 'weapon' && cd.two_hand ? c.armor : null].filter(Boolean).map((y) => cardName(y!));
              return { id: String(i), title: compName(p, ci), detail: `戦力${st.power}・守り${st.guard}${out.length ? `／${out.join('・')}は倉庫へ` : ''}`, primary: i === 0 };
            }),
            toAction: (id) => ({ t: 'pick', i: Number(id) }),
          },
        };
      }
      if (w.what.startsWith('train:') && p) {
        const st = w.what.slice(6) as 'atk' | 'def', max = DATA.MAX_SKILL[st], jp = st === 'atk' ? '攻め' : '守り';
        return {
          ask: null, sheet: {
            title: `${jp}の熟練を上げる仲間を選ぶ`, sub: `${jp}の熟練は${max}まで`,
            items: w.options.map((x, i) => {
              const ci = Number(String(x).slice(3)), c = p.comps[ci], cs = compStats(g, p, ci);
              return { id: String(i), title: compName(p, ci), detail: `${jp}の熟練 ${c[st]}→${c[st] + 1}・いまの戦力${cs.power}・守り${cs.guard}`, primary: i === 0 };
            }),
            toAction: (id) => ({ t: 'pick', i: Number(id) }),
          },
        };
      }
      const what = w.what === 'craft' ? '作る装備' : w.what === 'build' ? '建てるもの' : w.what === 'occ' ? '出す職能' : w.what === 'exchange' ? '交換所で' : w.what === 'train' ? '鍛える熟練' : w.what === 'tame' ? '使い魔にする魔物' : w.what === 'again' ? 'もう一度' : cardName(w.what);
      return {
        ask: null, sheet: {
          title: `${what}を選ぶ`,
          ...hoist(w.options.map((x, i) => choiceItem2(g, p, x, String(i)))),
          toAction: (id) => ({ t: 'pick', i: Number(id) }),
        },
      };
    }
  }
}

/** 画面（盤面・準備の画面・シート）でいまの問いに答えられるか */
export function actionable2(s: SeatSession2, ui: ReturnType<typeof uiFor2>): boolean {
  const w = s.waiting;
  if (!w) return true;
  if (ui.sheet) return true;
  const a = ui.ask;
  if (!a) return false;
  if (a.kind === 'place') return a.options.length > 0 || (w.k === 'choose' && w.opts.some((o) => isSpellOpt(o)));
  if (a.kind === 'card') return a.cards.length > 0;
  return a.ratios.length > 0;
}

/** どの問いにも使える、選択肢を全部並べるだけのシート（答えられる場面が画面にないときの逃げ道） */
export function fallbackSheet2(s: SeatSession2): (ChoiceSpec & { toAction: (id: string) => Action2 }) | null {
  const w = s.waiting;
  if (!w) return null;
  const g = s.g, p = s.player;
  const title = 'いま選べるもの';
  switch (w.k) {
    case 'card': return { title, items: w.cards.map((c) => ({ id: c, title: cardName(c), card: CARD2[c] ? c : undefined })), toAction: (id) => ({ t: 'card', id }) };
    case 'ratio': return { title, items: w.options.map((r, i) => ({ id: String(i), title: `武器${r.weapon}・防具${r.armor}・道具${r.tool}・秘術${r.spell}` })), toAction: (id) => ({ t: 'ratio', v: w.options[Number(id)] }) };
    case 'kind': return { title, items: w.options.map((k) => ({ id: k, title: KIND_JP[k] ?? k })), toAction: (id) => ({ t: 'kind', v: id as 'weapon' | 'tool' | 'spell' }) };
    case 'choose': return { title, items: w.opts.map((o, i) => { const l = optionLabel(g, p, o); return { id: String(i), title: isSpellOpt(o) ? l.title : `${placeName(o.s)}：${l.title}`, detail: l.detail, cost: l.cost }; }), toAction: (id) => ({ t: 'opt', i: Number(id) }) };
    case 'pick': return { title, items: w.options.map((x, i) => choiceItem2(g, p, x, String(i))), toAction: (id) => ({ t: 'pick', i: Number(id) }) };
    case 'heal': case 'effect': return { title, items: [{ id: 'yes', title: 'はい', primary: true }, { id: 'no', title: 'いいえ' }], toAction: (id) => ({ t: 'yes', v: id === 'yes' }) };
    case 'multi': return null;
  }
}

function Sheet({ label, children }: { label: string; children: ReactNode }) {
  return <div className="kd-ovwrap kd-sheetwrap kd-traywrap"><div className="kd-tray" role="dialog" aria-label={label}>{children}</div></div>;
}

// ---------------------------------------------------------------- 戦闘のトレイ（v1 と同じ「選択式」）
// 送る仲間の数・戦い方を選び、使うもの（士気・ポーション・払うカードの効果・手札の秘術）をタップでトレイに足す。
// 足すたびに戦力・勝つ見込み・運命・反撃と負傷・払うものがその場で変わる。計算はエンジン（previewFight → makePlan の use）。
const STYLES: [FightMode, string, string][] = [
  ['normal', '普通に', '戦力そのまま'], ['guard', '守って戦う', '戦力−2・反撃−2'], ['chip', '削るだけ', '負けても傷+1'],
];
/** 秘術を唱える・身につける（置く場所を選ぶ前に何度でも） */
const isSpellOpt = (o: { s: string }) => o.s === '@spell' || o.s === '@learn';
const sumCost = (c: Cost) => Object.values(c).reduce((a: number, n) => a + (n ?? 0), 0);
const addC = (a: Cost, b: Cost): Cost => { const o: Cost = { ...a }; for (const [r, n] of Object.entries(b)) (o as Record<string, number>)[r] = ((o as Record<string, number>)[r] ?? 0) + (n as number); return o; };
const payable = (res: Record<string, number> | undefined, c: Cost) => !!res && Object.entries(c).every(([r, n]) => (res[r] ?? 0) >= (n as number));

function ChipIcon2({ c, size }: { c: FightChip; size: number }) {
  if (c.name === 'morale') return <KIcon name="food" size={size} />;
  if (c.name === 'potion') return <KIcon name="herb" size={size} />;
  if (c.card && CARD2[c.card]) return <CardArt2 id={c.card} size={size + 4} />;
  return <KIcon name="power" size={size} />;
}

export function FightTray2({ s, sid, onPick, onCancel }: { s: SeatSession2; sid: string; onPick: (i: number, use?: string[], who?: number[]) => void; onCancel: () => void }) {
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
  /** 送る仲間を自分で選んだとき（null＝戦力の高い順） */
  const [who, setWho] = useState<number[] | null>(null);
  const mode: FightMode = wait ? 'wait' : style;
  const find = (kk: number, m: FightMode) => fights.find((x) => (x.k ?? 1) === kk && x.mode === m);
  const base = find(k, mode) ?? find(k, 'normal');
  const opt: Option | undefined = base && { ...base, ...(mode === 'wait' ? {} : { use }), ...(who ? { who } : {}) };
  const pv = useMemo(() => (opt && p ? previewFight(s.g, p, opt) : null), [s, p, k, mode, use.join(','), who?.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
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
  const pick = (x: Option, u?: string[], wh?: number[]) => onPick(all.indexOf(x), u, wh);
  // 送れる仲間（休み・負傷でない。もう使った仲間は「もう1人置ける」があるときだけ）
  const cands = p ? comps.map((_, i) => i).filter((i) => !comps[i].rest && !comps[i].injured && (!comps[i].used || p.extra > 0)) : [];
  const sel = pv?.idxs ?? [];
  const toggleComp = (i: number) => {
    const nx = sel.includes(i) ? sel.filter((x) => x !== i) : [...sel, i];
    if (!p || !ks.includes(nx.length)) {
      // 人数の上限なら入れ替える（最後に選んだ仲間と）
      if (!sel.includes(i) && sel.length && ks.includes(sel.length)) { const r = [...sel.slice(0, -1), i]; if (s.g.whoFor(p!, { ...(find(sel.length, mode) ?? base)!, who: r })) setWho(r); }
      return;
    }
    const o2 = find(nx.length, mode) ?? find(nx.length, 'normal');
    if (!o2 || !s.g.whoFor(p, { ...o2, who: nx })) return;
    setK(nx.length); setWho(nx);
  };
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
              <span className="kd-stat is-str">強さ{mon.str - mon.wounds}{mon.wounds ? <small>（傷{mon.wounds}）</small> : null}</span>
              <span className="kd-stat is-ctr">反撃{mon.counter}</span>
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
            {p && <div className="kd2-tray-fdeck" data-kd="tray-fate"><small>運命の山の残り{p.fate.length ? ` ${p.fate.length}枚` : '（次は混ぜ直し）'}</small><FateRow2 left={p.fate} /></div>}
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
            <button key={n} type="button" className={`kd-tchip is-k${k === n ? ' is-on' : ''}`} aria-pressed={k === n} onClick={() => { setK(n); setWho(null); }}>
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
        {pv && cands.length > 0 && (
          <div className="kd2-fcomps" role="group" aria-label="行く仲間（タップで選ぶ）">
            {cands.map((i) => { const c = comps[i]; const st = compStats(s.g, p!, i); const on = sel.includes(i); return (
              <button key={i} type="button" className={`kd2-fcomp${on ? ' is-on' : ' is-off'}`} aria-pressed={on} onClick={() => toggleComp(i)} data-kd={`fcomp:${i}`}>
                <span className="kd2-comp-who"><Token seat={p!.pid} size={20} dim={!on} /><small>{compName(p!, i)}</small></span>
                <span className="kd2-fcomp-st"><KIcon name="power" size={13} />{st.power}<KIcon name="defense" size={13} />{st.guard}</span>
                <span className={`kd2-slot is-weapon${c.weapon ? ' is-on' : ''}`}><small>武器</small>{c.weapon ? <b>{cardName(c.weapon)}</b> : <i>なし</i>}</span>
                <span className={`kd2-slot is-armor${c.armor ? ' is-on' : ''}`}><small>防具</small>{c.armor ? <b>{cardName(c.armor)}</b> : <i>なし</i>}</span>
              </button>
            ); })}
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
        <button type="button" className="kd-btn is-primary" disabled={!base || !!pv?.short} onClick={() => base && pick(base, mode === 'wait' ? undefined : on, pv && p && s.g.whoFor(p, { ...base, who: pv.idxs }) ? pv.idxs : undefined)}>
          {wait ? '待ち伏せする' : boss ? `主の巣に置く（${pct}%）` : `${k}人で挑む（${pct}%）`}
        </button>
      </div>
    </Sheet>
  );
}

/** 置き場所を選んだあとの細かい選択 */
export function optionSheet2(s: SeatSession2, sid: string, opts: Option[]): ChoiceSpec {
  const stage = s.g.space(sid)?.stage;
  const sub = stage ? CARD2[stage]?.text : sid.startsWith('market') ? '1種類を、1回で動かせる数まで（払う→得る）' : undefined;
  const h = hoist(opts.map((o, i) => spaceItem2(s.g, s.player, o, String(i))), sub);
  const title = sid === 'occhall' ? '出す職能を選ぶ' : sid === 'guild' ? 'ギルドで売るもの' : sid === 'forge' ? '作る武器を選ぶ（武具カードか共通の武器）' : sid === 'workshop' ? '工房で建てるもの' : sid.startsWith('market') ? '交換所で売り買い' : `${placeName(sid)}でできること`;
  return { title, ...h, cancel: '置き場所を選び直す' };
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
    const os = w.opts.filter((o) => o.s === c && !isSpellOpt(o));
    if (!os.length) return { k: 'none' };
    // 孤高のテイマー：巣の魔物は好物で使い魔にするだけ（戦闘のトレイは開かない）
    if (isFight(c) && os.every((o) => o.mode === 'capture')) return { k: 'sub', sid: c, opts: os };
    if (isFight(c)) return { k: 'fight', sid: c };
    // 選べるものが1つでも、選ぶ要素のあるマス（建てる・作る・売り買い・できることが複数）は中身を見せてから決める。
    // 何も選ばないマス（金貨+2 など）だけ、そのまま置く
    const sp = w.g.space(c);
    const choosy = os[0].x !== undefined || (sp?.def.options.length ?? 0) > 1 || os[0].i < 0;
    if (os.length === 1 && !choosy) return { k: 'send', a: { t: 'opt', i: w.opts.indexOf(os[0]) } };
    return { k: 'sub', sid: c, opts: os };
  }
  if (w.k === 'ratio') {
    const [a, ar, b, d] = c.split(',').map(Number);
    const r = w.options.find((x) => x.weapon === a && x.armor === ar && x.tool === b && x.spell === d);
    return r ? { k: 'send', a: { t: 'ratio', v: r } } : { k: 'none' };
  }
  if (w.k === 'card' && w.cards.includes(c)) return { k: 'send', a: { t: 'card', id: c } };
  return { k: 'none' };
}

/** 席の操作（盤面の答え・シート・トレイ・取引・秘術）をまとめて持つ */
export function useSeat2(s: SeatSession2 | null, send: (a: Action2) => void, opts: { sheetReady: boolean; onTrade: (b: number, give: Cost, get: Cost) => void }) {
  const [sub, setSub] = useState<{ sid: string; opts: Option[] } | null>(null);
  const [tray, setTray] = useState<{ kind: 'fight'; sid: string } | { kind: 'trade' } | { kind: 'spell' } | { kind: 'equip'; c: number; slot: 'weapon' | 'armor' } | null>(null);
  const ui = useMemo(() => (s ? uiFor2(s) : { ask: null, sheet: null }), [s]);
  const w = s?.waiting ?? null;
  const p = s?.player ?? null;
  // 動かす仲間（置き場所を選ぶ番。最初は空いている最初の仲間＝これまでどおり）
  const [who, setWho] = useState<number | null>(null);
  const reset = () => { setSub(null); setTray(null); };
  useEffect(() => { reset(); setWho((x) => (w?.k === 'choose' && p ? (x !== null && p.comps[x] && !p.comps[x].used && !p.comps[x].rest ? x : p.free()[0] ?? null) : null)); }, [s]); // eslint-disable-line react-hooks/exhaustive-deps
  /** マスに置く答えには、選んだ仲間を付ける */
  const withWho = (a: Action2): Action2 => {
    if (a.t !== 'opt' || w?.k !== 'choose' || who === null || !s || !p) return a;
    const o = w.opts[a.i];
    return o && !isFight(o.s) && !isSpellOpt(o) && s.g.whoFor(p, { ...o, who: [who] }) ? { ...a, who: [who] } : a;
  };
  const go = (a: Action2) => { reset(); send(withWho(a)); };

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
  if (s && w?.k === 'choose' && tray?.kind === 'fight') sheetNode = <FightTray2 key={tray.sid} s={s} sid={tray.sid} onPick={(i, use, wh) => go({ t: 'opt', i, ...(use ? { use } : {}), ...(wh ? { who: wh } : {}) })} onCancel={reset} />;
  else if (s && p && w?.k === 'choose' && tray?.kind === 'equip') {
    const { c: ci, slot } = tray;
    const cur = p.comps[ci]?.[slot] ?? null;
    const cand = [...new Set([...s.g.storage(p), ...p.comps.map((c) => c[slot]).filter((x): x is string => !!x)])].filter((id) => !s.g.equipError(p, ci, slot, id));
    const from = (id: string) => (s.g.storage(p).includes(id) ? '倉庫' : compName(p, p.comps.findIndex((c) => c[slot] === id)));
    const items: ChoiceItem[] = cand.map((id) => {
      const cd = s.g.card(id);
      const stat = slot === 'weapon' ? `戦力+${cd.power ?? 0}${cd.two_hand ? '・両手' : ''}` : `守り+${cd.guard ?? 0}`;
      return { id, title: cd.name, detail: `${stat}（${from(id)}から）`, card: CARD2[id] ? id : undefined };
    });
    if (cur) items.push({ id: '-', title: 'はずす', detail: `${cardName(cur)}を倉庫へ` });
    sheetNode = <ChoiceSheet spec={{ title: `${compName(p, ci)}の${SLOT_JP[slot]}`, sub: cur ? `いま：${cardName(cur)}` : items.length ? '持たせる装備を選ぶ（無料）' : '持たせられる装備がない', items, cancel: '閉じる' }}
      onPick={(id) => go({ t: 'equip', c: ci, slot, id: id === '-' ? null : id })} onCancel={reset} />;
  }
  else if (s && w?.k === 'choose' && tray?.kind === 'trade') sheetNode = <TradeTray s={tradeAdapter(s)} onTrade={(b, give, get) => { reset(); opts.onTrade(b, give, get); }} onCancel={reset} />;
  else if (s && w?.k === 'choose' && tray?.kind === 'spell') {
    const sp = w.opts.filter((o) => isSpellOpt(o));
    sheetNode = <ChoiceSheet spec={{ title: '秘術を使う', sub: '置く前に1枚。使うと手札から捨てる', items: sp.map((o, i) => { const l = optionLabel(s.g, s.player, o); return { id: String(i), title: l.title.replace(/を使う$/, ''), detail: l.detail, card: l.card, cost: l.cost }; }), cancel: '使わない' }} onPick={(id) => go({ t: 'opt', i: w.opts.indexOf(sp[Number(id)]) })} onCancel={reset} />;
  } else if (s && p && w?.k === 'choose' && sub && sub.opts.every((o) => o.x !== undefined && typeof o.x === 'object')) {
    // 売り買いのマス：両替の形のトレイ
    const stage = s.g.space(sub.sid)?.stage;
    sheetNode = <MarketTray2 key={sub.sid} g={s.g} p={p} title={`${placeName(sub.sid)}で売り買い`} sub={stage ? CARD2[stage]?.text : undefined} choices={sub.opts.map((o) => o.x!)}
      onPick={(i) => go({ t: 'opt', i: w.opts.indexOf(sub.opts[i]) })} onCancel={reset} />;
  } else if (s && p && w?.k === 'pick' && w.what === 'exchange' && opts.sheetReady && w.options.every((x) => typeof x === 'object')) {
    sheetNode = <MarketTray2 g={s.g} p={p} title="交換所で売り買い" choices={w.options} onPick={(i) => go({ t: 'pick', i })} />;
  } else if (s && w?.k === 'choose' && sub) {
    sheetNode = <ChoiceSheet spec={optionSheet2(s, sub.sid, sub.opts)} onPick={(id) => go({ t: 'opt', i: w.opts.indexOf(sub.opts[Number(id)]) })} onCancel={reset} />;
  } else if (ui.sheet && opts.sheetReady) {
    const sh = ui.sheet;
    sheetNode = <ChoiceSheet spec={sh} onPick={(id) => go(sh.toAction(id))} />;
  } else if (s && opts.sheetReady && !actionable2(s, ui)) {
    // 画面が出し方を知らない問い（新しい種類の問い・選べるものが盤面に出ない）：何もできないまま止まらないよう、全部を並べて選ばせる
    const fb = fallbackSheet2(s);
    if (fb) sheetNode = <ChoiceSheet spec={fb} onPick={(id) => go(fb.toAction(id))} />;
  }

  const spells = w?.k === 'choose' ? w.opts.filter((o) => isSpellOpt(o)).length : 0;
  const actions = ui.ask?.kind === 'place' && s ? (
    <>
      {spells > 0 && <button type="button" className="kd-btn kd-tradebtn" onClick={() => setTray({ kind: 'spell' })} aria-label={`秘術（${spells}）`}>✷ 秘術<small>{spells}</small></button>}
      <TradeButton s={tradeAdapter(s)} onOpen={() => setTray({ kind: 'trade' })} />
    </>
  ) : null;
  // 動かす仲間を選ぶチップ（自分の番。空いている仲間だけ選べる）
  const picker = ui.ask?.kind === 'place' && s && p && p.comps.length > 1 && p.free().length > 0 ? (
    <div className="kd2-who" role="radiogroup" aria-label="動かす仲間">
      <small>動かす<br />仲間</small>
      {p.comps.map((c, i) => {
        const ok = !c.used && !c.rest;
        const st = compStats(s.g, p, i);
        return (
          <button key={i} type="button" role="radio" aria-checked={who === i} disabled={!ok} className={`kd2-whochip${who === i ? ' is-on' : ''}`} onClick={() => setWho(i)} data-kd={`who:${i}`}>
            <span className="kd2-whochip-h"><Token seat={p.pid} size={14} dim={!ok} injured={c.injured} /><b>{compName(p, i)}</b></span>
            <span className="kd2-whochip-st"><KIcon name="power" size={11} />{st.power}<KIcon name="defense" size={11} />{st.guard}</span>
            <small className="kd2-whochip-eq">{c.weapon ? cardName(c.weapon) : '素手'}{c.armor ? `・${cardName(c.armor)}` : ''}</small>
          </button>
        );
      })}
    </div>
  ) : null;
  /** 拠点の装備の枠をタップ（自分の番だけ） */
  const onEquip = w?.k === 'choose' && ui.ask?.kind === 'place' ? (c: number, slot: 'weapon' | 'armor') => { setSub(null); setTray({ kind: 'equip', c, slot }); } : undefined;
  return { ask: ui.ask, hasSheet: !!ui.sheet, sheetNode, actions, onAnswer, reset, picker, onEquip };
}
