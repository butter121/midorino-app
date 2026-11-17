// 霧谷：タップで詳しく見るシート。カード・キャラ・魔物・行動スペース・巣・天候・冬の食料を、全文と数値で出す。
// 使い方：要素に data-inspect="card:i19" のような印を付けるだけ。KiridaniTable の一番外側がタップを拾ってこのシートを開く。
//   ・押せるボタン（ドラフトのカード・置ける場所など）の中では、そのボタンの操作を優先する（InfoDot で開ける）。
//   ・シートの中の印もそのまま押せる（キャラのシートから出したカードへ、など）。
import { createContext, useCallback, useContext, useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import { BossArt, HeroArt, KIcon, MonsterArt, NestScene, TerrainArt, WeatherArt } from '../art-registry';
import {
  ACT, BOSS, BOSS_ROUNDS, OCC_FOOD, CARDS, CHAR, EL_JP, KIND_JP, MON, NEST_JP, RACE_JP, SEASON_JP, UPKEEP, WEATHER, WEATHER_EL, WEATHER_JP, WINTER_ROUNDS,
  seasonOf, type ItemDef,
} from '../data';
import { monsterDef } from '../reduce';
import { CHAR_TEXT, SPACE_TEXT, TAG_JP } from '../text';
import type { GameView, PlayerView, Seat } from '../types';
import { CardArt, CostRow, FateDeck, MonsterCard, ResCount, Token } from './parts';
import './tray.css';

/** 天候の効果（ルールブックの表から） */
export const WEATHER_FX: Record<string, string> = {
  calm: '効果なし', storm: '雷+2。弓の最初の矢は0', sprout: '古の森・薬草の野に+1', thaw: '狩場・鉄の坑道に+1',
  fog: 'その場限りの「霧の巣」に魔物が1体多く出る', newmoon: '闇+2。亡者の強さ+2', heat: '炎+2',
  harvestmoon: '狩場に食料+3', surge: '魔石の泉に+1。魔石の相場-1', drought: '狩場-2', gale: '反撃+1。弓の最初の矢は0',
  festival: '広場で金貨+1', blizzard: '氷+2。維持費+1', cold: '維持費+2', mild: '維持費-1', fair: '市場の売値+1',
};
const UPKEEP_W: Record<string, number> = { blizzard: 1, cold: 2, mild: -1 };

// ---------------------------------------------------------------- 冬の食料
export interface UpkeepInfo {
  comps: number; base: number; mods: { label: string; n: number }[]; need: number; have: number;
  /** 次の冬のラウンド（もう冬が無ければ undefined） */
  round?: number; weather?: string; weatherKnown: boolean; short: number;
}

/** 次の冬に要る食料（エンジンの upkeep と同じ足し引き。天候は見えている分だけ） */
export function upkeepOf(v: GameView, p: PlayerView): UpkeepInfo {
  const comps = p.companions.length;
  const base = UPKEEP * comps;
  const mods: { label: string; n: number }[] = [];
  if (p.facilities.includes('i13')) mods.push({ label: CARDS.i13.name, n: -1 });
  if (p.character === 'momo') mods.push({ label: CHAR.momo.name, n: -1 });
  if (p.occupations.includes('o20')) mods.push({ label: CARDS.o20.name, n: -2 * UPKEEP });
  const r = Math.max(1, v.round);
  const round = WINTER_ROUNDS.find((x) => x >= r);
  let weather: string | undefined;
  let weatherKnown = false;
  if (round !== undefined) {
    const ahead = round - v.round;
    if (ahead === 0 && v.weather) { weather = v.weather; weatherKnown = true; }
    else if (ahead >= 1 && v.forecast[ahead - 1]) { weather = v.forecast[ahead - 1]; weatherKnown = true; }
    if (weather && UPKEEP_W[weather]) mods.push({ label: WEATHER_JP[weather], n: UPKEEP_W[weather] });
  }
  const need = Math.max(0, base + mods.reduce((a, m) => a + m.n, 0));
  const have = p.res.food;
  return { comps, base, mods, need, have, round, weather, weatherKnown, short: Math.max(0, need - have) };
}

/** 下の持ち物の列に出す「冬の食料」の小札（タップで詳しく） */
export function UpkeepChip({ view, seat }: { view: GameView; seat?: Seat }) {
  const p = view.players[seat ?? view.me];
  if (!p || !view.round) return null;
  const u = upkeepOf(view, p);
  if (u.round === undefined) return null;
  return (
    <span className={`kd-upchip${u.short ? ' is-short' : ''}`} data-inspect={`upkeep:${p.seat}`} role="button" tabIndex={0}
      aria-label={`冬に必要な食料 ${u.need}、手持ち ${u.have}。タップで詳しく`}>
      <KIcon name="upkeep" size={18} /><b>{u.have}/{u.need}</b>
    </span>
  );
}

// ---------------------------------------------------------------- 開く仕組み
const InspectCtx = createContext<(target: string) => void>(() => {});
export const useOpenInspect = () => useContext(InspectCtx);

/** 押せるボタンの中でも詳しく見られる小さな「i」 */
export function InfoDot({ target, label = '詳しく' }: { target: string; label?: string }) {
  const open = useOpenInspect();
  const go = (e: { stopPropagation: () => void; preventDefault: () => void }) => { e.stopPropagation(); e.preventDefault(); open(target); };
  return (
    <span className="kd-idot" role="button" tabIndex={0} aria-label={label} onClick={go}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') go(e); }}>i</span>
  );
}

const INTERACTIVE = 'button, a[href], input, select, textarea, summary, [role="button"], [role="tab"], [role="radio"]';

/** 画面の一番外側に付ける：印の付いた所をタップしたらシートを開く */
export function useInspect() {
  const [stack, setStack] = useState<string[]>([]);
  const open = useCallback((t: string) => setStack((s) => (s[s.length - 1] === t ? s : [...s, t])), []);
  const back = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  const close = useCallback(() => setStack([]), []);
  const onClick = useCallback((e: MouseEvent) => {
    const t = e.target as Element | null;
    const el = t?.closest?.('[data-inspect]');
    if (!el) return;
    // 押せる操作の中（印より内側、または印を含むボタン）なら、そちらを優先
    const ctl = t!.closest(INTERACTIVE);
    if (ctl && ctl !== el && ctl.getAttribute('aria-disabled') !== 'true' && !(ctl as HTMLButtonElement).disabled) {
      if (ctl.contains(el) || el.contains(ctl)) return;
    }
    if (ctl === el && el.matches('button') && !(el as HTMLButtonElement).disabled && el.getAttribute('aria-disabled') !== 'true' && !el.hasAttribute('data-inspect-tap')) return;
    const target = el.getAttribute('data-inspect');
    if (target) { e.stopPropagation(); open(target); }
  }, [open]);
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = (e.target as Element).closest?.('[data-inspect][role="button"]');
    const target = el?.getAttribute('data-inspect');
    if (target && el === e.target) { e.preventDefault(); open(target); }
  }, [open]);
  return { target: stack[stack.length - 1] ?? null, depth: stack.length, open, back, close, onClick, onKeyDown, Provider: InspectCtx.Provider };
}

// ---------------------------------------------------------------- シート
export function InspectSheet({ target, view, onClose, onBack, depth }: { target: string; view: GameView; onClose: () => void; onBack?: () => void; depth: number }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [onClose]);
  const body = inspectBody(target, view);
  if (!body) return null;
  return (
    <div className="kd-insp-wrap" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="kd-insp" role="dialog" aria-modal="true" aria-label={body.title}>
        <header className="kd-insp-h">
          {depth > 1 && onBack && <button type="button" className="kd-insp-back" onClick={onBack} aria-label="ひとつ前へ">‹</button>}
          <div className="kd-insp-t"><small>{body.kind}</small><strong>{body.title}</strong></div>
          <button type="button" className="kd-insp-x" onClick={onClose} aria-label="閉じる">×</button>
        </header>
        <div className="kd-insp-b">{body.node}</div>
        <button type="button" className="kd-btn kd-insp-close" onClick={onClose}>閉じる</button>
      </div>
    </div>
  );
}

const nameOf = (v: GameView, s: Seat) => (s === v.me ? 'あなた' : v.players[s]?.name ?? '');
const Row = ({ k, children }: { k: string; children: ReactNode }) => <div className="kd-insp-row"><span>{k}</span><div>{children}</div></div>;
const Tags = ({ tags }: { tags: string[] }) => <span className="kd-tags">{tags.map((t) => <i key={t}>{TAG_JP[t] ?? t}</i>)}</span>;

function inspectBody(target: string, v: GameView): { kind: string; title: string; node: ReactNode } | null {
  const [k, id, extra] = target.split(':');
  const me = v.players[v.me];
  switch (k) {
    case 'card': return cardBody(id, v);
    case 'char': return charBody(id, v, extra !== undefined ? Number(extra) : undefined);
    case 'seat': {
      const p = v.players[Number(id)];
      if (!p) return null;
      return p.character ? charBody(p.character, v, p.seat) : { kind: 'プレイヤー', title: nameOf(v, p.seat), node: <PlayerBlock v={v} p={p} /> };
    }
    case 'mon': return monBody(id, v, Number(extra ?? 0));
    case 'nest': {
      const n = v.nests.find((x) => x.id === id);
      if (id === 'lair') return lairBody(v);
      if (!n) return null;
      return {
        kind: '巣', title: NEST_JP[id] ?? id, node: <>
          <div className="kd-insp-art is-wide"><NestScene id={id} width={300} /></div>
          <p className="kd-insp-p">魔物には1つの巣に2人まで挑める。置いた人の仲間の戦力・使うもの・運命カード1枚の合計が強さ以上なら撃破。負けても傷が残り、あとの人が横取りできる。</p>
          {n.monster ? <MonBlock id={n.monster} wounds={n.wounds} /> : <p className="kd-insp-p">いまは魔物がいない。</p>}
          <Row k="置いた人">{n.occupants.length ? n.occupants.map((s, i) => <span key={i} className="kd-insp-who"><Token seat={s} size={16} />{nameOf(v, s)}</span>) : 'まだいない'}</Row>
          {n.trap && <Row k="罠">罠がしかけてある（強さが下がる）</Row>}
          {n.next && <Row k="次のラウンド"><span className="kd-insp-who"><MonsterArt id={n.next} size={28} />{MON[n.next]?.name ?? '？'}（影で見えている）</span></Row>}
        </>,
      };
    }
    case 'space': {
      if (id.startsWith('nest') || id === 'lair') return inspectBody(`nest:${id}`, v);
      const a = ACT[id]; const s = v.spaces[id];
      if (!a) return null;
      return {
        kind: '行動スペース', title: a.name, node: <>
          <div className="kd-insp-art"><TerrainArt id={id} size={96} /></div>
          <p className="kd-insp-p">{SPACE_TEXT[id] ?? ''}</p>
          {a.give && <Row k="毎回もらえる"><CostRow cost={a.give} size={18} /></Row>}
          {a.accum && <Row k="毎ラウンドたまる"><CostRow cost={a.accum} size={18} signed /></Row>}
          {a.accum && s && <Row k="いまたまっている">{Object.values(s.stock).some((n) => n) ? <CostRow cost={s.stock} size={18} /> : 'なし'}</Row>}
          <Row k="置ける人数">{a.unlimited ? '何人でも' : '1ラウンドに1人'}</Row>
          {a.from_round && a.from_round > 1 && <Row k="開く">ラウンド{a.from_round}から{s && !s.open ? '（まだ閉じている）' : ''}</Row>}
          {s && s.occupants.length > 0 && <Row k="置いた人">{s.occupants.map((o, i) => <span key={i} className="kd-insp-who"><Token seat={o} size={16} />{nameOf(v, o)}</span>)}</Row>}
          {me && id === 'guild' && <Row k="あなたの手札の職能">{me.hand.filter((c) => c.startsWith('o')).map((c) => <span key={c} className="kd-insp-link" data-inspect={`card:${c}`} role="button" tabIndex={0}>{CARDS[c]?.name}</span>)}</Row>}
        </>,
      };
    }
    case 'weather': {
      const se = seasonOf(Math.max(1, v.round));
      return {
        kind: '天候', title: WEATHER_JP[id] ?? id, node: <>
          <div className="kd-insp-art"><WeatherArt id={id} size={96} /></div>
          <p className="kd-insp-p kd-insp-big">{WEATHER_FX[id] ?? ''}</p>
          {WEATHER_EL[id] && <Row k="属性"><span className="kd-insp-who"><KIcon name={WEATHER_EL[id][0]} size={18} />{EL_JP[WEATHER_EL[id][0]]}の攻めに+{WEATHER_EL[id][1]}</span></Row>}
          {v.round > 0 && <Row k={`${SEASON_JP[se]}の天候`}>{WEATHER[se].map((w) => <span key={w} className={`kd-insp-chip${w === id ? ' is-on' : ''}`}>{WEATHER_JP[w]}</span>)}</Row>}
          {v.forecast.length > 0 && <Row k="これから">{v.forecast.map((w, i) => <span key={i} className="kd-insp-chip">R{v.round + i + 1}：{WEATHER_JP[w]}</span>)}</Row>}
        </>,
      };
    }
    case 'upkeep': {
      const p = v.players[Number(id)] ?? me;
      if (!p) return null;
      const u = upkeepOf(v, p);
      return {
        kind: '冬越し', title: '冬に必要な食料', node: <>
          <p className="kd-insp-p kd-insp-big">冬に必要な食料：仲間{u.comps}人×{UPKEEP}＝{u.base}{u.mods.map((m) => `${m.n >= 0 ? '＋' : '－'}${Math.abs(m.n)}`).join('')}{u.mods.length ? `＝${u.need}` : ''}（手持ち{u.have}）</p>
          <div className="kd-insp-food" aria-hidden>{Array.from({ length: Math.max(u.need, u.have) }, (_, i) => <i key={i} className={i < Math.min(u.have, u.need) ? 'is-ok' : i < u.need ? 'is-miss' : 'is-extra'} />)}</div>
          {u.mods.length > 0 && <Row k="増減">{u.mods.map((m) => <span key={m.label} className="kd-insp-chip">{m.label} {m.n > 0 ? '+' : ''}{m.n}</span>)}</Row>}
          <Row k="次の冬">{u.round !== undefined ? <>ラウンド{u.round}{u.round === v.round ? '（このラウンドの終わり）' : `（あと${u.round - v.round}ラウンド）`}{u.weather ? `・天候「${WEATHER_JP[u.weather]}」` : '・天候はまだ見えない（吹雪+1・寒波+2・暖冬-1）'}</> : 'もう冬はない'}</Row>
          <Row k="足りないと">{u.short ? <b className="kd-bad">あと食料{u.short}。足りない1つにつき不満カード1枚（-3名声）</b> : '足りている'}</Row>
          {p.discontent > 0 && <Row k="不満カード">{p.discontent}枚（-{p.discontent * 3}名声）</Row>}
        </>,
      };
    }
    case 'res': {
      if (id === 'food' && me) return inspectBody(`upkeep:${v.me}`, v);
      return null;
    }
    default: return null;
  }
}

function cardBody(id: string, v: GameView) {
  const c = CARDS[id];
  if (!c) return { kind: 'カード', title: '？？？', node: <p className="kd-insp-p">ほかの人の手札は見えない。</p> };
  const it = c.kind !== 'occ' ? (c as ItemDef) : null;
  const me = v.players[v.me];
  const mine = me?.character;
  const fitsMe = !!mine && (c.chars.includes(mine) || c.tags.some((t) => CHAR[mine]?.tags.includes(t)));
  const pool = me ? [...me.hand, ...me.occupations, ...me.weapons, ...me.facilities].filter((x) => x !== id && CARDS[x]) : [];
  const combo = pool.filter((x) => CARDS[x].tags.some((t) => c.tags.includes(t)));
  const where = me && (me.occupations.includes(id) ? '出した職能' : me.weapons.includes(id) ? '装備した武具' : me.facilities.includes(id) ? '拠点の施設' : me.hand.includes(id) ? 'あなたの手札' : me.spellsUsed.includes(id) ? '使った秘術' : '');
  return {
    kind: `${KIND_JP[c.kind]}カード${c.quirk ? '・クセあり' : ''}`, title: c.name, node: <>
      <div className="kd-insp-art"><CardArt id={id} size={120} /></div>
      <p className="kd-insp-p kd-insp-big">{c.text}</p>
      {it && <Row k={c.kind === 'weapon' ? '作る費用（鍛冶場）' : c.kind === 'tool' ? '建てる費用（工房）' : '使う費用'}>{Object.values(it.cost).some((n) => n) ? <CostRow cost={it.cost} size={18} /> : 'なし'}</Row>}
      {c.kind === 'occ' && <Row k="出す費用（ギルド）"><CostRow cost={{ food: OCC_FOOD[0] }} size={18} /></Row>}
      {it && it.fame > 0 && <Row k="名声">+{it.fame}</Row>}
      {it?.power !== undefined && it.power > 0 && <Row k="戦力">+{it.power}{it.el ? `（${EL_JP[it.el]}）` : ''}</Row>}
      {it?.defense !== undefined && it.defense > 0 && <Row k="防御">+{it.defense}</Row>}
      <Row k="種類"><Tags tags={c.tags} /></Row>
      <Row k="相性のよいキャラ">{c.chars.map((x) => <span key={x} className="kd-insp-link" data-inspect={`char:${x}`} role="button" tabIndex={0}><HeroArt id={x} size={22} />{CHAR[x]?.name}</span>)}</Row>
      {mine && <Row k="あなたとの相性">{fitsMe ? <b className="kd-good">{CHAR[mine].name}と噛み合う</b> : 'ふつう'}</Row>}
      {combo.length > 0 && <Row k="あなたのカードとの組み合わせ">{combo.slice(0, 6).map((x) => <span key={x} className="kd-insp-link" data-inspect={`card:${x}`} role="button" tabIndex={0}>{CARDS[x].name}</span>)}</Row>}
      {where && <Row k="いま">{where}</Row>}
      {c.quirk && <p className="kd-insp-note">★クセ：強いが条件や代わりの損がある札。</p>}
    </>,
  };
}

function charBody(id: string, v: GameView, seat?: Seat) {
  const ch = CHAR[id];
  if (!ch) return null;
  const p = seat !== undefined ? v.players[seat] : undefined;
  return {
    kind: `キャラ・${ch.role}`, title: p ? `${ch.name}（${nameOf(v, p.seat)}）` : ch.name, node: <>
      <div className="kd-insp-art"><HeroArt id={id} size={128} /></div>
      <p className="kd-insp-p kd-insp-big">{CHAR_TEXT[id]}</p>
      <Row k="得意"><Tags tags={ch.tags} /></Row>
      {p && <PlayerBlock v={v} p={p} />}
    </>,
  };
}

function PlayerBlock({ v, p }: { v: GameView; p: PlayerView }) {
  const u = upkeepOf(v, p);
  const mine = p.seat === v.me;
  return (
    <>
      <Row k="名声"><b>{p.fame}</b>{p.discontent > 0 && <small className="kd-bad">（不満{p.discontent}枚）</small>}</Row>
      <Row k="持ち物"><span className="kd-insp-res">{(['wood', 'iron', 'herb', 'mana', 'food', 'gold', 'mat'] as const).map((r) => <ResCount key={r} r={r} n={p.res[r]} size={18} />)}</span></Row>
      <Row k="仲間">{p.companions.length}人（待機{p.companions.filter((c) => !c.at && !c.injured).length}・負傷{p.companions.filter((c) => c.injured).length}）・熟練{p.companions.reduce((a, c) => a + c.skill, 0)}{p.familiars.length ? `・使い魔${p.familiars.length}` : ''}</Row>
      {u.round !== undefined && <Row k="冬の食料"><span className="kd-insp-link" data-inspect={`upkeep:${p.seat}`} role="button" tabIndex={0}>{u.need}必要（手持ち{u.have}）</span></Row>}
      <Row k="拠点">寝床{p.beds}・防壁{p.walls}・施設{p.facilities.length}</Row>
      {[...p.occupations, ...p.weapons, ...p.facilities].length > 0 && (
        <Row k="出したカード">{[...p.occupations, ...p.weapons, ...p.facilities].map((c) => <span key={c} className="kd-insp-link" data-inspect={`card:${c}`} role="button" tabIndex={0}>{CARDS[c]?.name}</span>)}</Row>
      )}
      <Row k="手札">{mine ? p.hand.map((c, i) => <span key={c + i} className="kd-insp-link" data-inspect={`card:${c}`} role="button" tabIndex={0}>{CARDS[c]?.name}</span>) : `${p.hand.length}枚（中身は見えない）`}</Row>
      {p.trophies.length > 0 && <Row k="討伐の証">{p.trophies.map((m, i) => <span key={i} className="kd-insp-link" data-inspect={`mon:${m}`} role="button" tabIndex={0}>{monsterDef(m)?.name}</span>)}</Row>}
      <Row k="運命の山"><FateDeck p={p} /></Row>
    </>
  );
}

function MonBlock({ id, wounds }: { id: string; wounds: number }) {
  return <div className="kd-insp-mon" data-inspect={`mon:${id}:${wounds}`} role="button" tabIndex={0}><MonsterCard id={id} wounds={wounds} /></div>;
}

function monBody(id: string, v: GameView, wounds: number) {
  const m = monsterDef(id);
  if (!m) return null;
  const boss = !!BOSS[id] && !MON[id];
  return {
    kind: boss ? '主' : `魔物・${m.year}年目`, title: m.name, node: <>
      <div className="kd-insp-art">{boss ? <BossArt id={id} size={140} /> : <MonsterArt id={id} size={140} />}</div>
      <Row k="強さ"><b>{m.str}</b>{wounds > 0 && <>（傷{wounds}で残り{Math.max(0, m.str - wounds)}）</>}</Row>
      <Row k="反撃">{m.counter}<small>（防御＝仲間1人につき1＋武具・職能。超えた分で負傷）</small></Row>
      <Row k="弱点">{m.weak ? <span className="kd-insp-who"><KIcon name={m.weak} size={18} />{EL_JP[m.weak]}で攻めると+2</span> : 'なし'}</Row>
      <Row k="種族"><span className="kd-insp-who"><KIcon name={m.race} size={18} />{RACE_JP[m.race]}</span>{m.race === 'undead' && <small>（新月の日は強さ+2）</small>}</Row>
      <Row k="戦利品"><CostRow cost={m.loot} size={18} /></Row>
      <Row k="討伐の証">名声{m.trophy}</Row>
      {m.raid > 0 && <Row k="冬の襲撃">倒されずに残ると、冬に全員の拠点を{m.raid}襲う（防壁で防げる）</Row>}
      {boss && <p className="kd-insp-note">主はラウンド{BOSS_ROUNDS.join('・')}の冬に現れる。主の巣に置いた全員の戦力と運命の合計で挑む。</p>}
    </>,
  };
}

function lairBody(v: GameView) {
  const l = v.lair;
  return {
    kind: '巣', title: '主の巣', node: <>
      <div className="kd-insp-art is-wide"><NestScene id="lair" width={300} /></div>
      <p className="kd-insp-p">各年の冬（ラウンド{BOSS_ROUNDS.join('・')}）に主が現れる。置いた全員の戦力と運命の合計が主の強さ以上なら討伐。一番戦力の高い人が証と戦利品、ほかの人も証と品物カードを得る。</p>
      {l.boss && <MonBlock id={l.boss} wounds={l.wounds} />}
      {!l.boss && l.candidates.length > 0 && <Row k="今年の候補">{l.candidates.map((c) => <span key={c} className="kd-insp-link" data-inspect={`mon:${c}`} role="button" tabIndex={0}><BossArt id={c} size={26} />{monsterDef(c)?.name}</span>)}</Row>}
      {l.round && <Row k="決戦">ラウンド{l.round}{l.round === v.round ? '（このラウンド！）' : ''}</Row>}
      {l.occupants.length > 0 && <Row k="置いた人">{l.occupants.map((s, i) => <span key={i} className="kd-insp-who"><Token seat={s} size={16} />{nameOf(v, s)}</span>)}</Row>}
    </>,
  };
}
