import { BASE_PRICE, GOODS, JP, PRICE_MIN, PRICE_SPAN, type Good } from '@midorino/engine';
import { Icon, RES_ICON } from './basics';

/** 市場の相場。目盛りの中の濃い所が今の値段、緑の枠が基準価格。矢印と数字で上下も示す */
export function MarketPanel({ prices, sellOffset = -1, note }: { prices: Record<Good, number>; sellOffset?: number; note?: string }) {
  return (
    <section className="mi-market" aria-label="市場の相場">
      <h3>市場の相場<small>売値＝相場{sellOffset ? sellOffset : ''}・買値＝相場</small></h3>
      <table>
        <thead className="mi-sr"><tr><th>品目</th><th>相場</th><th>基準との差</th><th>売値</th></tr></thead>
        <tbody>
          {GOODS.map((g) => {
            const p = prices[g], b = BASE_PRICE[g], d = p - b;
            return (
              <tr key={g}>
                <th scope="row"><Icon name={RES_ICON[g]} size={22} /><span>{JP[g]}</span></th>
                <td className="mi-mtrack" aria-hidden>
                  {Array.from({ length: b + PRICE_SPAN - PRICE_MIN + 1 }, (_, i) => {
                    const v = i + PRICE_MIN;
                    return <i key={v} className={`${v === b ? 'is-base' : ''}${v === p ? ' is-cur' : ''}`}>{v === p ? v : ''}</i>;
                  })}
                </td>
                <td className={`mi-mdiff ${d > 0 ? 'is-up' : d < 0 ? 'is-dn' : ''}`}>{d > 0 ? `▲${d}` : d < 0 ? `▼${-d}` : '―'}</td>
                <td className="mi-msell">売{Math.max(1, p + sellOffset)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {note && <p className="mi-market-note">{note}</p>}
    </section>
  );
}
