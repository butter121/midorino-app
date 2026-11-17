// 霧谷：「トレイ」で選ぶシート。持ち物や使うものをタップでオン・オフし、選んだものがトレイに並び、合計がその場で変わる。
//   ・FightTray：巣・主の巣に挑む（何人で・矢・ポーション・士気・秘術・武具の力・待ち伏せ）→ 戦力と強さ・勝つ見込み・反撃・費用
//   ・MarketTray：市場で1種類を好きな数だけ売る／買う
//   ・TradeTray：AI と資源を交換する（渡すトレイ・受け取るトレイ。相手が受けるかはその AI の考えで決まる）
// ルールの計算はエンジン（session.ts の previewPick・judgeTrade など）。ここは並べて見せるだけ。
import { useMemo, useState } from 'react';
import { fightChips, marketQuote, previewPick, TRADE_MAX, type FightChip, type KiridaniSession } from '@midorino/engine/src/kiridani';
import { BossArt, HeroArt, KIcon, MonsterArt } from '../art-registry';
import { ACT, CHAR, EL_JP, NEST_JP, RES, RES_JP, type Cost, type Res } from '../data';
import { monsterDef } from '../reduce';
import { CardArt, CostRow, ResCount, SEAT_COLORS, Token } from './parts';
import { InfoDot } from './inspect';
import './tray.css';

const sumCost = (c: Cost) => RES.reduce((a, r) => a + (c[r] ?? 0), 0);
const addTo = (c: Cost, r: Res, n: number): Cost => {
  const x = { ...c, [r]: Math.max(0, (c[r] ?? 0) + n) };
  if (!x[r]) delete x[r];
  return x;
};

function Sheet({ label, children, tone }: { label: string; children: React.ReactNode; tone?: string }) {
  return (
    <div className="kd-ovwrap kd-sheetwrap kd-traywrap">
      <div className={`kd-tray${tone ? ` is-${tone}` : ''}`} role="dialog" aria-label={label}>{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------- 戦闘
export interface FightSel { sid: string; k: number; boosts: string[]; wait?: boolean }

export function FightTray({ s, sid, onFight, onCancel }: { s: KiridaniSession; sid: string; onFight: (sel: FightSel) => void; onCancel: () => void }) {
  const g = s.g; const p = s.player!;
  const chips = useMemo(() => fightChips(g, p, sid), [g, p, sid]);
  const ks0 = useMemo(() => previewPick(g, p, { sid, k: 1, boosts: [] }).ks, [g, p, sid]);
  const [k, setK] = useState(ks0.includes(2) && p.free_idx().length >= 2 ? 2 : ks0[0] ?? 1);
  const [on, setOn] = useState<Set<string>>(() => new Set(chips.filter((c) => c.locked).map((c) => c.key)));
  const [wait, setWait] = useState(false);
  const names = (set: Set<string>) => chips.filter((c) => set.has(c.key)).map((c) => c.name);
  const sel: FightSel = { sid, k, boosts: names(on), wait };
  const pv = useMemo(() => previewPick(g, p, sel), [g, p, sid, k, on, wait]); // eslint-disable-line react-hooks/exhaustive-deps
  const waitOk = pv.waitOk;
  const canAdd = (c: FightChip) => g.check_pick(p, { ...sel, boosts: names(new Set([...on, c.key])) }).ok;
  const toggle = (c: FightChip) => {
    if (c.locked) return;
    const n = new Set(on);
    if (n.has(c.key)) n.delete(c.key); else if (canAdd(c)) n.add(c.key); else return;
    setOn(n);
  };
  const m = monsterDef(pv.monster)!;
  const pct = Math.round(pv.pwin * 100);
  const tone = pct >= 80 ? 'good' : pct >= 40 ? 'mid' : 'bad';
  const ours = pv.power + pv.partner + pv.others;
  const scale = Math.max(pv.strength, ours + Math.max(0, ...pv.fate), 1) * 1.1;
  const selected = chips.filter((c) => on.has(c.key));
  const title = pv.boss ? `主「${m.name}」に挑む` : `${NEST_JP[sid] ?? sid}の${m.name}に挑む`;
  return (
    <Sheet label={title}>
      <header className="kd-tray-h">
        <span className="kd-tray-foe" data-inspect={`mon:${pv.monster}:${pv.boss ? 0 : g.nest(sid).dmg}`} role="button" tabIndex={0} aria-label={`${m.name}をくわしく`}>
          {pv.boss ? <BossArt id={pv.monster} size={64} /> : <MonsterArt id={pv.monster} size={64} />}
        </span>
        <div className="kd-tray-ht">
          <small>{pv.joining !== undefined ? `${s.g.names[pv.joining]}の待ち伏せに加わる（共闘）` : pv.boss ? '主の巣：置いた全員の戦力で挑む' : '使うものをタップしてトレイへ'}</small>
          <strong>{title}</strong>
          <span className="kd-tray-stats">
            <span className="kd-stat is-str">強さ{pv.strength}</span>
            <span className="kd-stat is-ctr">反撃{pv.counter}</span>
            {m.weak && <span className="kd-stat is-weak"><KIcon name={m.weak} size={14} />弱点{EL_JP[m.weak]}</span>}
          </span>
        </div>
      </header>

      {/* トレイ：選んだもの・合計 */}
      <section className="kd-tray-box" aria-label="選んだもの">
        <div className="kd-tray-sum">
          <div className={`kd-vs is-${tone}`}>
            <span className="kd-vs-us"><small>戦力</small><b>{pv.power}</b>{pv.partner ? <em>+共闘{pv.partner}</em> : null}{pv.others ? <em>+先に置いた人{pv.others}</em> : null}</span>
            <span className="kd-vs-x">vs</span>
            <span className="kd-vs-them"><small>強さ</small><b>{pv.strength}</b></span>
            <span className="kd-vs-p"><small>勝つ見込み</small><b>{pct}%</b></span>
          </div>
          <div className="kd-tray-gauge" aria-hidden>
            <i className="kd-tg-us" style={{ width: `${(Math.min(ours, scale) / scale) * 100}%` }} />
            <i className="kd-tg-need" style={{ left: `${(pv.strength / scale) * 100}%` }} />
          </div>
          <div className="kd-tray-fate" aria-label={`運命で${pv.need}以上が出れば勝ち`}>
            <small>{pv.need <= Math.min(...pv.fate) ? 'どの運命でも勝てる' : pv.need > Math.max(...pv.fate) ? '運命では届かない' : `運命 ${pv.need > 0 ? '+' : ''}${pv.need} 以上で勝ち`}</small>
            <span>{[...pv.fate].sort((a, b) => a - b).map((f, i) => <i key={i} className={f >= pv.need ? 'is-win' : 'is-lose'}>{f > 0 ? `+${f}` : f}</i>)}</span>
          </div>
          <div className="kd-tray-ctr">
            <span><KIcon name="injury" size={16} />反撃{pv.counter} − 防御{pv.defense}</span>
            <b className={pv.injuries ? 'kd-bad' : 'kd-good'}>{pv.injuries ? `負傷 ${pv.injuries}人の見込み` : '負傷なし'}</b>
          </div>
        </div>
        <div className="kd-tray-items">
          <span className="kd-tray-item is-base"><Token seat={p.pid} size={18} />仲間{k}人</span>
          {selected.map((c) => (
            <button key={c.key} type="button" className={`kd-tray-item${c.locked ? ' is-locked' : ''}`} onClick={() => toggle(c)} aria-label={`${c.label}を外す`}>
              <ChipIcon c={c} size={18} />{c.label}<b>+{c.power}</b>
            </button>
          ))}
          {wait && <span className="kd-tray-item is-wait">待ち伏せ</span>}
          {!selected.length && !wait && <small className="kd-tray-empty">まだ何も使わない</small>}
        </div>
        <div className="kd-tray-cost"><small>払うもの</small>{sumCost(pv.cost) ? <CostRow cost={pv.cost} size={18} /> : <span>なし</span>}</div>
      </section>

      {/* 仲間の数 */}
      <div className="kd-tray-sec">
        <h4>送る仲間</h4>
        <div className="kd-chips">
          {[1, 2].map((n) => {
            const ok = pv.ks.includes(n);
            return (
              <button key={n} type="button" className={`kd-tchip is-k${k === n ? ' is-on' : ''}`} disabled={!ok} aria-pressed={k === n}
                onClick={() => { setK(n); if (wait && !previewPick(g, p, { ...sel, k: n, wait: true }).waitOk) setWait(false); }}>
                <span className="kd-tchip-ic">{Array.from({ length: n }, (_, i) => <Token key={i} seat={p.pid} size={18} />)}</span>
                <span className="kd-tchip-l">{n}人</span>
                <small>防御+{n}</small>
              </button>
            );
          })}
          {waitOk || wait ? (
            <button type="button" className={`kd-tchip is-wait${wait ? ' is-on' : ''}`} aria-pressed={wait} disabled={!waitOk && !wait} onClick={() => setWait(!wait)}>
              <span className="kd-tchip-ic">⏳</span>
              <span className="kd-tchip-l">待ち伏せ</span>
              <small>共闘の相手を待つ</small>
            </button>
          ) : null}
        </div>
        {wait && <p className="kd-tray-note">この巣で待つ。ほかの人が来れば一緒に戦い、来なければラウンドの終わりに単独で戦う（使うものは今払う）。</p>}
      </div>

      {/* 使うもの */}
      <div className="kd-tray-sec">
        <h4>使うもの<small>タップでオン・オフ</small></h4>
        {chips.length ? (
          <div className="kd-chips">
            {chips.map((c) => {
              const isOn = on.has(c.key);
              const ok = isOn || canAdd(c);
              return (
                <button key={c.key} type="button" className={`kd-tchip${isOn ? ' is-on' : ''}${c.card ? ' is-spell' : ''}${c.locked ? ' is-locked' : ''}`} aria-pressed={isOn}
                  aria-disabled={!ok} onClick={() => toggle(c)} title={c.src}>
                  <span className="kd-tchip-ic"><ChipIcon c={c} size={26} /></span>
                  <span className="kd-tchip-l">{c.label}</span>
                  <b className="kd-tchip-pw">+{c.power}</b>
                  <span className="kd-tchip-c">{sumCost(c.cost) ? <CostRow cost={c.cost} size={13} /> : <small>無料</small>}</span>
                  {c.bonus && <em className="kd-tchip-bonus">{c.bonus}</em>}
                  {c.card && <small className="kd-tchip-tag">使うと捨てる</small>}
                  {!ok && <small className="kd-tchip-tag is-bad">足りない</small>}
                  {c.card && <InfoDot target={`card:${c.card}`} />}
                  {!c.card && /^[oi]\d\d$/.test(c.name) && <InfoDot target={`card:${c.name}`} />}
                </button>
              );
            })}
          </div>
        ) : <p className="kd-tray-note">使えるものがない（矢・ポーション・士気・秘術など）。仲間の力だけで挑む。</p>}
      </div>

      {pv.error && <p className="kd-tray-err" role="alert">{pv.error}</p>}
      <div className="kd-tray-act">
        <button type="button" className="kd-btn" onClick={onCancel}>やめる</button>
        <button type="button" className="kd-btn is-primary" disabled={!pv.ok} onClick={() => onFight(sel)}>
          {wait ? '待ち伏せする' : pv.boss ? `主の巣に置く（${pct}%）` : `挑む（${pct}%）`}
        </button>
      </div>
    </Sheet>
  );
}

function ChipIcon({ c, size }: { c: FightChip; size: number }) {
  if (c.name === 'arrow') return <KIcon name="wood" size={size} />;
  if (c.name === 'potion') return <KIcon name="herb" size={size} />;
  if (c.name === 'morale') return <KIcon name="food" size={size} />;
  if (/^[oi]\d\d$/.test(c.name)) return <CardArt id={c.name} size={size + 4} />;
  if (c.el) return <KIcon name={c.el} size={size} />;
  return <KIcon name="power" size={size} />;
}

// ---------------------------------------------------------------- 市場
export function MarketTray({ s, sid, onDeal, onCancel }: { s: KiridaniSession; sid: string; onDeal: (kind: 'buy' | 'sell', r: Res, q: number) => void; onCancel: () => void }) {
  const g = s.g; const p = s.player!;
  const q = marketQuote(g, p);
  const [deal, setDeal] = useState<{ kind: 'buy' | 'sell'; r: Res; n: number } | null>(null);
  const err = deal ? g.check_market(p, sid, deal.kind, deal.r, deal.n) : 'タップして選ぶ';
  const tap = (kind: 'buy' | 'sell', r: Res) => {
    if (deal && deal.kind === kind && deal.r === r) {
      const n = deal.n + 1;
      if (!g.check_market(p, sid, kind, r, n)) setDeal({ kind, r, n });
      return;
    }
    if (!g.check_market(p, sid, kind, r, 1)) setDeal({ kind, r, n: 1 });
  };
  const minus = () => { if (!deal) return; setDeal(deal.n > 1 ? { ...deal, n: deal.n - 1 } : null); };
  const gold = deal ? (deal.kind === 'sell' ? q.sell[deal.r]! : q.buy[deal.r]!) * deal.n : 0;
  const give: Cost = deal ? (deal.kind === 'sell' ? { [deal.r]: deal.n } : { gold }) : {};
  const get: Cost = deal ? (deal.kind === 'sell' ? { gold } : { [deal.r]: deal.n }) : {};
  return (
    <Sheet label="市場で売り買い">
      <header className="kd-tray-h">
        <span className="kd-tray-foe" aria-hidden><KIcon name="gold" size={48} /></span>
        <div className="kd-tray-ht">
          <small>1回で1種類・{q.qty}個まで。値段は売り買いのたびに動く</small>
          <strong>{ACT[sid]?.name ?? '市場'}で売り買い</strong>
          <span className="kd-tray-stats"><span>手持ちの金貨 <ResCount r="gold" n={p.res.gold} size={16} /></span></span>
        </div>
      </header>
      <ExchangeBox give={give} get={get} onTakeGive={deal?.kind === 'sell' ? minus : undefined} onTakeGet={deal?.kind === 'buy' ? minus : undefined}
        giveLabel="渡す" getLabel="受け取る" verdict={deal ? (err ? <b className="kd-bad">{err}</b> : <b className="kd-good">{deal.kind === 'sell' ? '売れる' : '買える'}</b>) : null} />
      <div className="kd-tray-sec">
        <h4>売る<small>あなたの持ち物をタップ</small></h4>
        <div className="kd-chips">
          {(['mana', 'mat'] as Res[]).map((r) => {
            const on = deal?.kind === 'sell' && deal.r === r;
            const ok = !g.check_market(p, sid, 'sell', r, on ? deal!.n + 1 : 1);
            return (
              <button key={r} type="button" className={`kd-tchip is-res${on ? ' is-on' : ''}`} aria-disabled={!ok && !on} onClick={() => tap('sell', r)}>
                <span className="kd-tchip-ic"><KIcon name={r} size={26} /></span>
                <span className="kd-tchip-l">{RES_JP[r]}<small>×{p.res[r]}</small></span>
                <span className="kd-tchip-c">1つ<KIcon name="gold" size={13} />{q.sell[r]}</span>
                {on && <b className="kd-tchip-n">{deal!.n}</b>}
              </button>
            );
          })}
        </div>
      </div>
      <div className="kd-tray-sec">
        <h4>買う<small>市場の品をタップ</small></h4>
        <div className="kd-chips">
          {(Object.keys(q.buy) as Res[]).map((r) => {
            const on = deal?.kind === 'buy' && deal.r === r;
            const ok = !g.check_market(p, sid, 'buy', r, on ? deal!.n + 1 : 1);
            return (
              <button key={r} type="button" className={`kd-tchip is-res${on ? ' is-on' : ''}`} aria-disabled={!ok && !on} onClick={() => tap('buy', r)}>
                <span className="kd-tchip-ic"><KIcon name={r} size={26} /></span>
                <span className="kd-tchip-l">{RES_JP[r]}</span>
                <span className="kd-tchip-c">1つ<KIcon name="gold" size={13} />{q.buy[r]}</span>
                {on && <b className="kd-tchip-n">{deal!.n}</b>}
              </button>
            );
          })}
        </div>
      </div>
      <div className="kd-tray-act">
        <button type="button" className="kd-btn" onClick={onCancel}>やめる</button>
        <button type="button" className="kd-btn is-primary" disabled={!deal || !!err} onClick={() => deal && onDeal(deal.kind, deal.r, deal.n)}>
          {deal ? `${RES_JP[deal.r]}を${deal.n}${deal.kind === 'sell' ? '売る' : '買う'}` : '選んでください'}
        </button>
      </div>
    </Sheet>
  );
}

/** 渡す／受け取るの2つのトレイ（中身をタップで1つ戻す） */
function ExchangeBox({ give, get, onTakeGive, onTakeGet, giveLabel, getLabel, verdict }: {
  give: Cost; get: Cost; onTakeGive?: (r: Res) => void; onTakeGet?: (r: Res) => void; giveLabel: string; getLabel: string; verdict?: React.ReactNode;
}) {
  const side = (c: Cost, on: ((r: Res) => void) | undefined, label: string, cls: string) => (
    <div className={`kd-xside ${cls}`}>
      <small>{label}<b>{sumCost(c)}</b></small>
      <div className="kd-xitems">
        {RES.filter((r) => c[r]).flatMap((r) => Array.from({ length: c[r]! }, (_, i) => (
          <button key={r + i} type="button" className="kd-xitem" onClick={on ? () => on(r) : undefined} disabled={!on} aria-label={`${RES_JP[r]}を1つ戻す`}><KIcon name={r} size={24} /></button>
        )))}
        {!sumCost(c) && <span className="kd-tray-empty">空</span>}
      </div>
    </div>
  );
  return (
    <section className="kd-tray-box kd-xbox" aria-label="交換のトレイ">
      <div className="kd-xrow">
        {side(give, onTakeGive, giveLabel, 'is-give')}
        <span className="kd-xarrow" aria-hidden>⇄</span>
        {side(get, onTakeGet, getLabel, 'is-get')}
      </div>
      {verdict && <div className="kd-xverdict">{verdict}</div>}
    </section>
  );
}

// ---------------------------------------------------------------- AI との取引
export function TradeTray({ s, onTrade, onCancel }: { s: KiridaniSession; onTrade: (b: number, give: Cost, get: Cost) => void; onCancel: () => void }) {
  const g = s.g; const p = s.player!;
  const partners = s.tradePartners();
  const [b, setB] = useState<number>(partners[0] ?? -1);
  const [give, setGive] = useState<Cost>({});
  const [get, setGet] = useState<Cost>({});
  const o = g.players[b];
  const left = s.tradeLeft();
  const j = b >= 0 && (sumCost(give) || sumCost(get)) ? s.judgeTrade(b, give, get) : null;
  const pickPartner = (x: number) => { setB(x); setGet({}); };
  const tapMine = (r: Res) => { if (sumCost(give) < TRADE_MAX && p.res[r] > (give[r] ?? 0) && !get[r]) setGive(addTo(give, r, 1)); };
  const tapTheirs = (r: Res) => { if (o && sumCost(get) < TRADE_MAX && o.res[r] > (get[r] ?? 0) && !give[r]) setGet(addTo(get, r, 1)); };
  const mood = j?.ok ? (j.accept ? (j.gain > 1 ? '大よろこびで受ける' : '受ける') : j.gain > -0.3 ? 'もうひと声…' : '断る') : null;
  return (
    <Sheet label="取引">
      <header className="kd-tray-h">
        <span className="kd-tray-foe" aria-hidden><KIcon name="gold" size={48} /></span>
        <div className="kd-tray-ht">
          <small>あなたの番に、AI と資源を交換（片側{TRADE_MAX}個まで・置き場所は使わない）</small>
          <strong>取引を持ちかける</strong>
          <span className="kd-tray-stats"><span>このラウンドあと<b>{left}</b>回</span></span>
        </div>
      </header>
      <div className="kd-tray-sec">
        <h4>相手</h4>
        <div className="kd-chips kd-partners">
          {partners.map((x) => {
            const q = g.players[x];
            return (
              <button key={x} type="button" className={`kd-tchip is-who${b === x ? ' is-on' : ''}`} aria-pressed={b === x} onClick={() => pickPartner(x)} style={{ ['--seat' as string]: SEAT_COLORS[x] }}>
                <span className="kd-tchip-ic">{q.char ? <HeroArt id={q.char} size={30} /> : <Token seat={x} size={24} />}</span>
                <span className="kd-tchip-l">{g.names[x]}<small>{q.char ? CHAR[q.char].name : ''}</small></span>
                {q.char && <InfoDot target={`seat:${x}`} />}
              </button>
            );
          })}
        </div>
      </div>
      <ExchangeBox give={give} get={get} onTakeGive={(r) => setGive(addTo(give, r, -1))} onTakeGet={(r) => setGet(addTo(get, r, -1))}
        giveLabel="渡す" getLabel="受け取る"
        verdict={j ? (j.ok ? <span className={`kd-mood ${j.accept ? 'is-yes' : 'is-no'}`}>{o ? `${g.names[b]}：` : ''}<b>{mood}</b><i style={{ width: `${Math.max(4, Math.min(100, 50 + j.gain * 25))}%` }} /></span> : <b className="kd-bad">{j.error}</b>) : <small>あなたの持ち物と、相手の持ち物をタップ</small>} />
      <div className="kd-tray-sec">
        <h4>あなたの持ち物<small>タップで「渡す」へ</small></h4>
        <div className="kd-chips is-res">
          {RES.map((r) => (
            <button key={r} type="button" className={`kd-tchip is-res is-mini${give[r] ? ' is-on' : ''}`} aria-disabled={!(p.res[r] > (give[r] ?? 0)) || !!get[r] || sumCost(give) >= TRADE_MAX} onClick={() => tapMine(r)} aria-label={`${RES_JP[r]}（${p.res[r]}）を渡す`}>
              <span className="kd-tchip-ic"><KIcon name={r} size={24} /></span><span className="kd-tchip-l">{p.res[r] - (give[r] ?? 0)}</span>
            </button>
          ))}
        </div>
      </div>
      {o && (
        <div className="kd-tray-sec">
          <h4>{g.names[b]}の持ち物<small>タップで「受け取る」へ</small></h4>
          <div className="kd-chips is-res">
            {RES.map((r) => (
              <button key={r} type="button" className={`kd-tchip is-res is-mini${get[r] ? ' is-on' : ''}`} aria-disabled={!(o.res[r] > (get[r] ?? 0)) || !!give[r] || sumCost(get) >= TRADE_MAX} onClick={() => tapTheirs(r)} aria-label={`${RES_JP[r]}（${o.res[r]}）をもらう`}>
                <span className="kd-tchip-ic"><KIcon name={r} size={24} /></span><span className="kd-tchip-l">{o.res[r] - (get[r] ?? 0)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="kd-tray-act">
        <button type="button" className="kd-btn" onClick={onCancel}>閉じる</button>
        <button type="button" className="kd-btn is-primary" disabled={!j?.ok || !j.accept || left <= 0} onClick={() => onTrade(b, give, get)}>
          {j?.ok && !j.accept ? '受けてもらえない' : '取引する'}
        </button>
      </div>
    </Sheet>
  );
}

/** 下の欄に出す「取引」ボタン */
export function TradeButton({ s, onOpen }: { s: KiridaniSession | null; onOpen: () => void }) {
  if (!s || s.waiting?.k !== 'choose' || !s.tradePartners().length) return null;
  const left = s.tradeLeft();
  return <button type="button" className="kd-btn kd-tradebtn" disabled={left <= 0} onClick={onOpen} aria-label={`取引（あと${left}回）`}>⇄ 取引<small>{left}</small></button>;
}

