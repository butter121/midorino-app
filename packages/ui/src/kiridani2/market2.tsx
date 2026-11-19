// 霧谷 v2 — 交換所（売り買いのマス）のトレイ。ほかの団との取引と同じ「渡す ⇄ 受け取る」の両替の形。
// 持ち物（売る）・交換所の品（買う）・倉庫の品物（売る）をタップして台に載せ、台の上をタップすると1つ戻す。
// 選べる組み合わせはエンジンが出した選択肢（exchange の Choice）だけ。台の中身がどれかに一致したら「交換する」が押せる。
import { useMemo, useState } from 'react';
import { DATA, RES, type Choice, type Game, type Player, type Res } from '@midorino/engine/src/kiridani2';
import { KIcon } from '../kiridani/art-registry';
import { cardName } from './view';

type Ex = Exclude<Choice, string>;
type RQ = { r: Res; q: number };
interface Sel { sell?: RQ; buy?: RQ; item?: string }

const sameRQ = (a: RQ | undefined, b: RQ | undefined) => !!a && !!b && a.r === b.r && a.q === b.q;
/** 台の中身と同じ選択肢の番号（なければ -1） */
function matchIndex(xs: Ex[], s: Sel): number {
  return xs.findIndex((x) => {
    if (s.item) return x.m === 'item' && x.id === s.item;
    if (s.sell && s.buy) return x.m === 'both' && sameRQ(x.sell, s.sell) && sameRQ(x.buy, s.buy);
    if (s.sell) return x.m === 'sell' && sameRQ(x, s.sell);
    if (s.buy) return x.m === 'buy' && sameRQ(x, s.buy);
    return false;
  });
}

/** 1種類の資源を n 個（アイコン×数）。on があればタップで1つ戻す */
function Stack({ r, n, on }: { r: Res; n: number; on?: () => void }) {
  if (n <= 0) return null;
  const body = <><KIcon name={r} size={24} /><b>×{n}</b></>;
  return on
    ? <button type="button" className="kd2-xstack" onClick={on} aria-label={`${DATA.RES_JP[r]}を1つ戻す`}>{body}</button>
    : <span className="kd2-xstack is-fixed" aria-label={`${DATA.RES_JP[r]}${n}`}>{body}</span>;
}

export function MarketTray2({ g, p, title, sub, choices, onPick, onCancel }: {
  g: Game; p: Player; title: string; sub?: string; choices: Choice[]; onPick: (i: number) => void; onCancel?: () => void;
}) {
  const xs = useMemo(() => choices.filter((x): x is Ex => typeof x === 'object'), [choices]);
  const [sel, setSel] = useState<Sel>({});
  const both = xs.some((x) => x.m === 'both');
  const qty = g.marketQty(p);
  const sellRes = RES.filter((r) => xs.some((x) => (x.m === 'sell' && x.r === r) || (x.m === 'both' && x.sell.r === r)));
  const buyRes = RES.filter((r) => xs.some((x) => (x.m === 'buy' && x.r === r) || (x.m === 'both' && x.buy.r === r)));
  const items = [...new Set(xs.flatMap((x) => (x.m === 'item' ? [x.id] : [])))];

  const canSell = (r: Res, q: number) => xs.some((x) => (x.m === 'sell' && x.r === r && x.q === q) || (x.m === 'both' && x.sell.r === r && x.sell.q === q));
  const canBuy = (r: Res, q: number) => xs.some((x) => (x.m === 'buy' && x.r === r && x.q === q) || (x.m === 'both' && x.buy.r === r && x.buy.q === q));
  const nextQ = (cur: RQ | undefined, r: Res) => (cur?.r === r ? cur.q + 1 : 1);
  const tapSell = (r: Res) => {
    const q = nextQ(sel.sell, r);
    if (!canSell(r, q)) return;
    setSel({ sell: { r, q }, buy: both && sel.buy?.r !== r ? sel.buy : undefined });
  };
  const tapBuy = (r: Res) => {
    const q = nextQ(sel.buy, r);
    if (!canBuy(r, q)) return;
    setSel({ buy: { r, q }, sell: both && sel.sell?.r !== r ? sel.sell : undefined });
  };
  const tapItem = (id: string) => setSel(sel.item === id ? {} : { item: id });
  const less = (k: 'sell' | 'buy') => {
    const cur = sel[k];
    if (!cur) return;
    setSel({ ...sel, [k]: cur.q > 1 ? { r: cur.r, q: cur.q - 1 } : undefined });
  };

  // 台の上：渡すもの・受け取るもの（金貨は差し引きでどちらかに出す）
  const sellGold = sel.sell ? g.sellPrice(p, sel.sell.r) * sel.sell.q : sel.item ? g.itemSell(sel.item) : 0;
  const buyGold = sel.buy ? DATA.BUY[sel.buy.r] * sel.buy.q : 0;
  const net = sellGold - buyGold;
  const idx = matchIndex(xs, sel);
  const empty = !sel.sell && !sel.buy && !sel.item;
  const goldAfter = p.res.gold + net;
  const verdict = empty
    ? <small>持ち物か、交換所の品をタップして台に載せる</small>
    : idx >= 0
      ? <b className="kd-good">交換できる（金貨 {p.res.gold}→{goldAfter}）</b>
      : sel.sell && sel.buy
        ? <b className="kd-bad">売って買うときは、売る資源を持っている分（{qty}個まで）全部売る</b>
        : <b className="kd-bad">この組み合わせはできない</b>;

  return (
    <div className="kd-ovwrap kd-sheetwrap kd-traywrap">
      <div className="kd-tray kd2-market" role="dialog" aria-label={title}>
        <header className="kd-tray-h">
          <span className="kd-tray-foe" aria-hidden><KIcon name="gold" size={48} /></span>
          <div className="kd-tray-ht">
            <small>{sub ?? `1種類を${qty}個まで、売るか買う`}</small>
            <strong>{title}</strong>
            <span className="kd-tray-stats"><span>金貨<b>{p.res.gold}</b></span>{both && <span>売って買うこともできる</span>}</span>
          </div>
        </header>

        <section className="kd-tray-box kd-xbox" aria-label="交換の台">
          <div className="kd-xrow">
            <div className="kd-xside is-give">
              <small>渡す</small>
              <div className="kd-xitems">
                {sel.sell && <Stack r={sel.sell.r} n={sel.sell.q} on={() => less('sell')} />}
                {sel.item && <button type="button" className="kd2-xstack is-card" onClick={() => setSel({})} aria-label={`${cardName(sel.item)}を戻す`}>{cardName(sel.item)}</button>}
                {net < 0 && <Stack r="gold" n={-net} />}
                {empty && <span className="kd-tray-empty">空</span>}
              </div>
            </div>
            <span className="kd-xarrow" aria-hidden>⇄</span>
            <div className="kd-xside is-get">
              <small>受け取る</small>
              <div className="kd-xitems">
                {sel.buy && <Stack r={sel.buy.r} n={sel.buy.q} on={() => less('buy')} />}
                {net > 0 && <Stack r="gold" n={net} />}
                {empty && <span className="kd-tray-empty">空</span>}
              </div>
            </div>
          </div>
          <div className="kd-xverdict" role="status">{verdict}</div>
        </section>

        {sellRes.length > 0 && (
          <div className="kd-tray-sec">
            <h4>売る<small>あなたの持ち物をタップ（1つの値段）</small></h4>
            <div className="kd-chips is-res">
              {sellRes.map((r) => {
                const on = sel.sell?.r === r;
                return (
                  <button key={r} type="button" className={`kd-tchip is-res is-mini${on ? ' is-on' : ''}`} aria-disabled={!canSell(r, nextQ(sel.sell, r))} onClick={() => tapSell(r)} aria-label={`${DATA.RES_JP[r]}（${p.res[r]}）を売る`} data-kd={`sell:${r}`}>
                    <span className="kd-tchip-ic"><KIcon name={r} size={24} /></span>
                    <span className="kd-tchip-l">{p.res[r] - (on ? sel.sell!.q : 0)}</span>
                    <span className="kd-tchip-c"><KIcon name="gold" size={12} />{g.sellPrice(p, r)}</span>
                    {on && <b className="kd-tchip-n">{sel.sell!.q}</b>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {buyRes.length > 0 && (
          <div className="kd-tray-sec">
            <h4>買う<small>交換所の品をタップ（1つの値段）</small></h4>
            <div className="kd-chips is-res">
              {buyRes.map((r) => {
                const on = sel.buy?.r === r;
                return (
                  <button key={r} type="button" className={`kd-tchip is-res is-mini${on ? ' is-on' : ''}`} aria-disabled={!canBuy(r, nextQ(sel.buy, r))} onClick={() => tapBuy(r)} aria-label={`${DATA.RES_JP[r]}を買う`} data-kd={`buy:${r}`}>
                    <span className="kd-tchip-ic"><KIcon name={r} size={24} /></span>
                    <span className="kd-tchip-l">{DATA.RES_JP[r]}</span>
                    <span className="kd-tchip-c"><KIcon name="gold" size={12} />{DATA.BUY[r]}</span>
                    {on && <b className="kd-tchip-n">{sel.buy!.q}</b>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {items.length > 0 && (
          <div className="kd-tray-sec">
            <h4>倉庫の品物を売る<small>1回に1つ</small></h4>
            <div className="kd-chips">
              {items.map((id) => (
                <button key={id} type="button" className={`kd-tchip${sel.item === id ? ' is-on' : ''}`} onClick={() => tapItem(id)} aria-label={`${cardName(id)}を売る`} data-kd={`sellitem:${id}`}>
                  <span className="kd-tchip-l">{cardName(id)}</span>
                  <span className="kd-tchip-c"><KIcon name="gold" size={12} />{g.itemSell(id)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="kd-tray-act">
          {onCancel && <button type="button" className="kd-btn" onClick={onCancel}>置き場所を選び直す</button>}
          <button type="button" className="kd-btn is-primary" disabled={idx < 0} onClick={() => onPick(choices.indexOf(xs[idx]))}>交換する</button>
        </div>
      </div>
    </div>
  );
}
