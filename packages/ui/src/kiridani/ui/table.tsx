// 霧谷のゲーム画面全体：上の状況バー／プレイヤー列／タブ（盤面・拠点・依頼・みんな）／下の自分の持ち物。
// 戦闘・冬・主の登場・季節の帯などは上に重ねて出す。出来事ごとの「飛ぶ」演出は runFx がここで出す。
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { BossArt, EffectArt, KIcon, WeatherScene } from '../art-registry';
import { CHAR, EL_JP, RES, SEASON_JP, WEATHER_JP, type Cost, type Res } from '../data';
import { SPEED_JP, SPEEDS } from '../anim/timing';
import { monsterDef, placeName } from '../reduce';
import type { GameView, Seat } from '../types';
import { FxLayer, type FxApi } from './fx';
import { InspectSheet, UpkeepChip, useInspect } from './inspect';
import { HeroBadge, Num, ResCount, SEAT_COLORS, Token, WeatherChip } from './parts';
import { BaseView, Board, CharacterPick, CombatPanel, DraftScreen, Everyone, FinalScoring, QuestsView, WinterPanel } from './screens';
import type { Playing, TablePlayer } from './useTable';

export type Tab = 'board' | 'base' | 'quests' | 'all';
const TABS: { id: Tab; label: string }[] = [{ id: 'board', label: '盤面' }, { id: 'base', label: '拠点' }, { id: 'quests', label: '依頼' }, { id: 'all', label: 'みんな' }];

export interface Ask { kind: 'draft' | 'char' | 'place'; options: string[] }

export interface TableProps {
  t: TablePlayer;
  /** いま自分に求められている選択（無ければ観戦） */
  ask?: Ask | null;
  /** 選んだ答え（演出中なら預かられ、終わってから実行される） */
  onAnswer?: (choice: string) => void;
  /** カタログの操作などを右上に足す */
  extra?: ReactNode;
  /** 画面に無い選択のシート（ChoiceSheet など）を上に重ねる */
  sheet?: ReactNode;
  /** 下の欄に足すボタン（取引など） */
  actions?: ReactNode;
}

const nameOf = (v: GameView, s: Seat) => (s === v.me ? 'あなた' : v.players[s]?.name ?? '');
const icons = (c: Cost) => RES.filter((r) => c[r]).flatMap((r) => Array.from({ length: Math.min(4, c[r]!) }, () => r));

/** 出来事に合わせて飛ぶ・浮かぶ演出を出す */
function runFx(fx: FxApi, p: Playing, v: GameView) {
  const { ev, ms } = p; const me = v.me;
  const holder = (s: Seat, r: Res) => (s === me ? `res:${r}` : `seat:${s}`);
  const flyRes = (from: string, s: Seat, c: Cost, span = ms) => {
    const list = icons(c);
    list.forEach((r, i) => fx.fly(from, holder(s, r), <KIcon name={r} size={24} />, { ms: Math.max(200, span * 0.7), delay: (i * span * 0.3) / Math.max(1, list.length), arc: 50 }));
    RES.filter((r) => c[r]).forEach((r) => fx.float(holder(s, r), `+${c[r]}`, { ms: span, delay: span * 0.5 }));
  };
  switch (ev.t) {
    case 'place':
      fx.fly(`seat:${ev.seat}`, `space:${ev.space}`, <Token seat={ev.seat} size={28} />, { ms, arc: 70, size: 28 });
      fx.burst(`space:${ev.space}`, 'place-ring', { ms: ms * 0.5, delay: ms * 0.75, size: 56 });
      break;
    case 'gather': flyRes(`space:${ev.space}`, ev.seat, ev.gain); break;
    case 'grant': case 'produce': flyRes(`seat:${ev.seat}`, ev.seat, ev.gain); break;
    case 'loot': flyRes('combat:monster', ev.seat, ev.gain); break;
    case 'pay':
      icons(ev.cost).forEach((r, i) => fx.fly(holder(ev.seat, r), ev.space ? `space:${ev.space}` : `seat:${ev.seat}`, <KIcon name={r} size={22} />, { ms: ms * 0.8, delay: i * 40, arc: 30 }));
      break;
    case 'refill':
      Object.entries(ev.adds).forEach(([id, c], i) => RES.filter((r) => c[r]).forEach((r) => fx.float(`space:${id}`, <><KIcon name={r} size={16} />+{c[r]}</>, { ms: ms * 0.9, delay: (i * ms * 0.4) / 10 })));
      break;
    case 'play_card':
      fx.burst(`seat:${ev.seat}`, 'card-glow', { ms, size: 64 });
      if (ev.seat === me) fx.fly('hand', 'tab:base', <EffectArt id="card-glow" size={40} />, { ms, arc: 40, size: 40 });
      fx.burst(`space:forge`, 'spark', { ms: ms * 0.6, size: 60 });
      break;
    case 'spell': fx.burst(v.combat ? 'combat:monster' : `seat:${ev.seat}`, ev.el ?? 'light', { ms, size: 110 }); break;
    case 'build': fx.burst(`seat:${ev.seat}`, ev.kind === 'wall' ? 'wall-block' : 'shield', { ms, size: 56 }); fx.float(`seat:${ev.seat}`, ev.kind === 'wall' ? '防壁+1' : '寝床+1', { ms }); break;
    case 'hire': fx.fly('space:tavern', `seat:${ev.seat}`, <Token seat={ev.seat} size={30} />, { ms, arc: 20, size: 30 }); fx.float(`seat:${ev.seat}`, '仲間+1', { ms, delay: ms * 0.5 }); break;
    case 'train': fx.float(`seat:${ev.seat}`, '熟練+1', { ms, tone: 'gold' }); break;
    case 'market':
      fx.fly(`space:market`, holder(ev.seat, 'gold'), <KIcon name="gold" size={22} />, { ms, arc: 40 });
      fx.float(holder(ev.seat, 'gold'), `${ev.gold >= 0 ? '+' : ''}${ev.gold}`, { ms, tone: ev.gold >= 0 ? 'good' : 'bad' });
      break;
    case 'draw': fx.fly(ev.from === 'boss' ? 'combat:monster' : 'space:ruins', ev.seat === me ? 'hand' : `seat:${ev.seat}`, <EffectArt id="card-glow" size={36} />, { ms, arc: 60, size: 36, spin: true }); break;
    case 'hit': fx.float('combat:monster', `-${ev.amount}`, { ms, tone: 'big' }); fx.burst('combat:monster', 'hit', { ms: ms * 0.8, size: 90 }); break;
    case 'counter': fx.shake('combat', ms); fx.burst('combat:gauge', 'counter', { ms, size: 70 }); break;
    case 'injury': fx.burst(`seat:${ev.seat}`, 'injury', { ms, size: 48 }); fx.float(`seat:${ev.seat}`, '負傷', { ms, tone: 'bad' }); break;
    case 'heal': case 'recover': fx.burst(`seat:${ev.seat}`, 'heal', { ms, size: 48 }); break;
    case 'trophy':
      fx.fly('combat:monster', `seat:${ev.seat}`, <EffectArt id="trophy" size={36} />, { ms, arc: 90, size: 36 });
      fx.float(`seat:${ev.seat}`, `名声+${ev.fame}`, { ms, delay: ms * 0.6, tone: 'gold' });
      break;
    case 'upkeep':
      if (ev.paid) fx.fly(holder(ev.seat, 'food'), `winter:${ev.seat}`, <KIcon name="food" size={22} />, { ms: ms * 0.8, arc: 30 });
      if (ev.discontent) fx.float(`winter:${ev.seat}`, `不満 -${ev.discontent * 3}`, { ms, tone: 'bad' });
      break;
    case 'raid':
      fx.fly(`space:${ev.nest}`, `winter:${ev.seat}`, <EffectArt id="raid" size={34} />, { ms: ms * 0.7, arc: 10, size: 34 });
      fx.burst(`winter:${ev.seat}`, ev.damage ? 'raid' : 'wall-block', { ms: ms * 0.5, delay: ms * 0.6, size: 56 });
      if (ev.damage) fx.shake(`winter:${ev.seat}`, ms);
      break;
    case 'quest_done':
      fx.burst(`quest:${ev.quest}`, 'quest-stamp', { ms, size: 70 });
      fx.float(`seat:${ev.seat}`, `依頼 名声+${ev.fame}`, { ms, tone: 'gold' });
      break;
    case 'fame': fx.float(`seat:${ev.seat}`, `名声${ev.amount >= 0 ? '+' : ''}${ev.amount}`, { ms, tone: 'gold' }); break;
    case 'first_pass': fx.fly(`seat:${(ev.seat + v.players.length - 1) % v.players.length}`, `seat:${ev.seat}`, <span className="kd-firstmark">先</span>, { ms, arc: 20, size: 24, spin: true }); break;
    case 'familiar': fx.burst(`seat:${ev.seat}`, 'heal', { ms, size: 52 }); fx.float(`seat:${ev.seat}`, '使い魔+1', { ms, tone: 'good' }); break;
    case 'trap': fx.burst(`space:${ev.nest}`, 'wall-block', { ms, size: 64 }); fx.float(`space:${ev.nest}`, `罠 -${ev.amount}`, { ms }); break;
    case 'trade':
      fx.fly(`seat:${ev.a}`, `seat:${ev.b}`, <KIcon name={(Object.keys(ev.give)[0] ?? 'gold') as Res} size={22} />, { ms: ms * 0.8, arc: 30 });
      fx.fly(`seat:${ev.b}`, `seat:${ev.a}`, <KIcon name={(Object.keys(ev.get)[0] ?? 'gold') as Res} size={22} />, { ms: ms * 0.8, arc: 30, delay: ms * 0.15 });
      break;
    case 'discard': fx.float(`seat:${ev.seat}`, 'カードを失った', { ms, tone: 'bad' }); break;
    case 'recall': fx.burst(`seat:${ev.seat}`, 'heal', { ms, size: 48 }); break;
    case 'weather_set': fx.burst(`seat:${ev.seat}`, 'weather-change', { ms, size: 60 }); break;
    case 'wait': fx.burst(`space:${ev.nest}`, 'place-ring', { ms, size: 70 }); fx.float(`space:${ev.nest}`, '待ち伏せ', { ms }); break;
    case 'dragon_fail': v.players.forEach((pl) => fx.float(`seat:${pl.seat}`, `-${ev.fame}`, { ms, tone: 'bad' })); break;
    default: break;
  }
}

/** 全面に重ねる短い演出（季節の帯・天候・主の登場など） */
function Overlay({ cur, v }: { cur: Playing | null; v: GameView }) {
  if (!cur) return null;
  const { ev, ms } = cur;
  const st = { ['--ms' as string]: `${ms}ms` };
  if (ev.t === 'round_start') return (
    <div className={`kd-ov kd-band is-${ev.season}`} style={st} key={cur.key} aria-live="polite">
      <EffectArt id="season-change" size={56} />
      <div><small>ラウンド {ev.round} / 12・{Math.ceil(ev.round / 4)}年目</small><strong>{SEASON_JP[ev.season]}</strong><span>魔力の潮：{EL_JP[ev.tide]}</span></div>
    </div>
  );
  if (ev.t === 'weather') return (
    <div className={`kd-ov kd-weather is-${ev.weather}`} style={st} key={cur.key} aria-live="polite">
      <div className="kd-precip" aria-hidden>{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 6) * 60}ms` }} />)}</div>
      <div className="kd-wcard"><WeatherScene id={ev.weather} season={v.season} width={220} /><strong>{WEATHER_JP[ev.weather]}</strong>{ev.forecast[0] && <small>次：{WEATHER_JP[ev.forecast[0]]}</small>}</div>
    </div>
  );
  if (ev.t === 'boss_appear') return (
    <div className="kd-ov kd-bossintro" style={st} key={cur.key} aria-live="assertive">
      <BossArt id={ev.boss} size={220} />
      <div><small>{v.round === 12 ? '最後の決戦' : `${Math.ceil(v.round / 4)}年目の主`}</small><strong>{monsterDef(ev.boss)?.name}</strong><span>強さ {monsterDef(ev.boss)?.str}</span></div>
    </div>
  );
  if (ev.t === 'boss_reveal') return (
    <div className="kd-ov kd-toast" style={st} key={cur.key}>今年の主の予告：{ev.candidates.map((c) => monsterDef(c)?.name).join(' か ')}{ev.boss ? `（${monsterDef(ev.boss)?.name}）` : ''}</div>
  );
  if (ev.t === 'dragon_fail') return <div className="kd-ov kd-toast is-bad" style={st} key={cur.key}>古竜を倒せなかった…全員 -{ev.fame}</div>;
  if (ev.t === 'quest_done') return <div className="kd-ov kd-toast is-gold" style={st} key={cur.key}>{nameOf(v, ev.seat)}が依頼を達成！ 名声+{ev.fame}</div>;
  if (ev.t === 'winter_start') return <div className="kd-ov kd-band is-winter" style={st} key={cur.key}><EffectArt id="upkeep" size={56} /><div><small>季節の処理</small><strong>冬越し</strong><span>維持費と襲撃</span></div></div>;
  return null;
}

export function KiridaniTable({ t, ask, onAnswer, extra, sheet, actions }: TableProps) {
  const { view: v, cur } = t;
  const rootRef = useRef<HTMLDivElement>(null);
  const fxRef = useRef<FxApi>(null);
  const [tab, setTab] = useState<Tab>('board');
  const [peek, setPeek] = useState<Seat | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [queuedChoice, setQueuedChoice] = useState<string | null>(null);
  const insp = useInspect();

  useLayoutEffect(() => { if (cur && fxRef.current) runFx(fxRef.current, cur, v); }, [cur?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setSel(null); setQueuedChoice(null); if (ask?.kind === 'place') { setTab('board'); setPeek(null); } }, [ask]);
  // 拠点に関係する出来事は拠点タブで見せる（自分のときだけ）
  useEffect(() => {
    if (!cur) return;
    const e = cur.ev;
    if ((e.t === 'build' || e.t === 'hire' || e.t === 'train') && e.seat === v.me && tab !== 'base') setTab('base');
    if (e.t === 'turn' && e.seat === v.me) setTab('board');
    if (e.t === 'round_start') setTab('board');
    if (e.t === 'quest_done' && tab !== 'quests' && ask?.kind !== 'place') setTab('quests');
  }, [cur?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const me = v.players[v.me];
  const answer = (c: string) => {
    setQueuedChoice(c);
    t.sound.play(t.busy ? 'ui_queue' : 'ui_tap');
    onAnswer?.(c);
  };
  const placeAsk = ask?.kind === 'place' ? ask : null;
  const selectable = placeAsk && !queuedChoice ? new Set(placeAsk.options) : undefined;

  let main: ReactNode;
  if (v.phase === 'setup') main = <div className="kd-screen kd-title"><h1>霧谷の冒険者団</h1><p>魔物に荒らされた霧谷に拠点を構え、3年間で名声を競う</p></div>;
  else if (v.phase === 'draft') main = <DraftScreen view={v} options={ask?.kind === 'draft' ? ask.options : undefined} onPick={ask?.kind === 'draft' && !queuedChoice ? answer : undefined} queuedPick={queuedChoice ?? undefined} />;
  else if (v.phase === 'character') main = <CharacterPick view={v} options={ask?.kind === 'char' ? ask.options : undefined} onPick={ask?.kind === 'char' && !queuedChoice ? answer : undefined} />;
  else if (v.phase === 'final' && v.final) main = <FinalScoring view={v} rows={v.final} cur={cur} />;
  else main = (
    <>
      <nav className="kd-tabs" role="tablist">
        {TABS.map((x) => <button key={x.id} type="button" role="tab" aria-selected={tab === x.id} data-kd={`tab:${x.id}`} className={tab === x.id ? 'is-on' : ''} onClick={() => { setTab(x.id); setPeek(null); }}>{x.label}</button>)}
      </nav>
      <div className="kd-tabbody">
        {tab === 'board' && <Board view={v} cur={cur} selectable={selectable} selected={sel ?? queuedChoice} onSelect={setSel} />}
        {tab === 'base' && me && <BaseView p={v.players[peek ?? v.me]} view={v} cur={cur} />}
        {tab === 'quests' && <QuestsView view={v} cur={cur} />}
        {tab === 'all' && <Everyone view={v} onOpen={(s) => { setPeek(s); setTab('base'); }} />}
      </div>
    </>
  );

  // 上の状況バーと下の欄の高さ（重ねる画面・お知らせをその間に収めるため）
  const hudRef = useRef<HTMLElement>(null);
  const barRef = useRef<HTMLElement>(null);
  const hasBar = !!me && v.phase !== 'final' && v.phase !== 'draft' && v.phase !== 'character' && v.phase !== 'setup';
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

  const myTurn = !!placeAsk && !queuedChoice;
  const turnFlag: { text: string; me?: boolean; seat?: Seat } | null =
    v.combat ? { text: '戦闘中' }
      : v.winter ? { text: '冬越し' }
        : myTurn ? { text: 'あなたの番', me: true }
          : v.phase === 'draft' ? { text: '手札づくり' }
            : v.phase === 'character' ? { text: '団長選び' }
              : v.turn !== undefined && v.players[v.turn] ? { text: `${nameOf(v, v.turn)}の番`, seat: v.turn, me: v.turn === v.me }
                : null;
  const year = Math.ceil(v.round / 4);

  return (
    <insp.Provider value={insp.open}>
    <div className={`kd-root kd-play is-ph-${v.phase}${t.reduced ? ' is-reduced' : ''} is-${v.season}${myTurn ? ' is-myturn' : ''}${v.players.length >= 5 ? ' is-many' : ''}`} ref={rootRef} onClick={insp.onClick} onKeyDown={insp.onKeyDown}>
      <header className="kd-hud" ref={hudRef}>
        <div className="kd-hud-title">
          <strong className="kd-hud-season">{v.round ? SEASON_JP[v.season] : '準備'}</strong>
          <span className="kd-hud-meta">
            <small>{v.round ? <>{year}年目・<span className="kd-hud-rl">ラウンド</span><span className="kd-hud-rs">R</span><b>{v.round}</b>/12</> : '霧谷の冒険者団'}</small>
            {v.round > 0 && (
              <span className="kd-rounds" aria-hidden>
                {Array.from({ length: 12 }, (_, i) => <i key={i} className={`is-s${i % 4}${i + 1 < v.round ? ' is-done' : i + 1 === v.round ? ' is-now' : ''}`} />)}
              </span>
            )}
          </span>
        </div>
        {v.round > 0 && <span className="kd-tidechip" title="魔力の潮" aria-label={`魔力の潮：${EL_JP[v.tide]}`}><KIcon name={v.tide} size={16} /><span>{EL_JP[v.tide]}の潮</span></span>}
        {v.round > 0 && <div className="kd-hud-w"><span data-inspect={v.weather ? `weather:${v.weather}` : undefined}><WeatherChip id={v.weather} label="今日" /></span><span data-inspect={v.forecast[0] ? `weather:${v.forecast[0]}` : undefined}><WeatherChip id={v.forecast[0]} label="次" small /></span></div>}
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
                  <HeroBadge id={p.character} size={30} seat={p.seat} />
                  <span className="kd-pchip-b"><span className="kd-pchip-n"><Token seat={p.seat} size={14} />{p.seat === v.me ? 'あなた' : p.name}{v.first === p.seat && v.round > 0 && <span className="kd-firstmark" title="先手">先</span>}</span>
                    <span className="kd-pchip-s"><b data-kd={`fame:${p.seat}`}><KIcon name="fame" size={12} /><Num value={p.fame} /></b><span>{p.companions.map((c) => <i key={c.id} className={c.injured ? 'is-inj' : c.at ? 'is-out' : ''} />)}</span></span>
                  </span>
                </div>
              ))}
            </div>
            {v.log.length > 0 && (
              <section className="kd-log" aria-label="これまでの出来事">
                <h3>できごと</h3>
                <ol>{v.log.slice(0, 12).map((l, i) => <li key={`${v.log.length - i}`}>{l}</li>)}</ol>
              </section>
            )}
          </aside>
        )}
        <main className="kd-main">{main}</main>
        {hasBar && me && (
          <footer className="kd-mybar" ref={barRef}>
            <div className="kd-mybar-r">{RES.map((r) => <ResCount key={r} r={r} n={me.res[r]} size={22} anchor={`res:${r}`} />)}<UpkeepChip view={v} /></div>
            <div className="kd-mybar-a">
              {placeAsk ? (
                queuedChoice ? <span className="kd-queued" role="status">{t.busy ? `予約：${placeName(queuedChoice)}（演出のあとに実行）` : `${placeName(queuedChoice)}へ`}</span>
                  : <>
                    <span className="kd-ask"><b>あなたの番</b><small>{t.busy ? '演出中でも選べます' : sel ? `${placeName(sel)}に置く？` : '光る場所を選ぶ'}</small></span>
                    {actions}
                    <button type="button" className="kd-btn is-primary" disabled={!sel} onClick={() => sel && answer(sel)}>{sel ? `${placeName(sel)}に置く` : '場所を選ぶ'}</button>
                  </>
              ) : <span className="kd-mybar-me">{turnFlag && !turnFlag.me ? <b className="kd-mybar-turn" style={turnFlag.seat !== undefined ? { ['--seat' as string]: SEAT_COLORS[turnFlag.seat] } : undefined}>{turnFlag.seat !== undefined && <Token seat={turnFlag.seat} size={16} />}{turnFlag.text}</b> : me.character && <b>{CHAR[me.character].name}</b>}<span data-kd="hand">手札 {me.hand.length}</span><span>仲間 {me.companions.filter((c) => !c.at && !c.injured).length}/{me.companions.length}</span></span>}
            </div>
          </footer>
        )}
      </div>
      {v.combat && <div className="kd-ovwrap">{<CombatPanel view={v} cur={cur} />}</div>}
      {v.winter && !v.combat && <div className="kd-ovwrap">{<WinterPanel view={v} cur={cur} />}</div>}
      {sheet}
      <Overlay cur={cur} v={v} />
      <div className="kd-sr" aria-live="polite">{v.log[0]}</div>
      <FxLayer ref={fxRef} root={() => rootRef.current} reduced={t.reduced} />
      {insp.target && <InspectSheet target={insp.target} view={v} depth={insp.depth} onBack={insp.back} onClose={insp.close} />}
    </div>
    </insp.Provider>
  );
}
