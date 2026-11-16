// ゲームの前後・途中の画面部品：ロビー、参加、キャラ選択、取引、選択肢、市場、記録、結果
import { useState, type ReactNode } from 'react';
import { GOODS, JP, RES, type Cost, type Good, type Res, type ScoreBreakdown } from '@midorino/engine';
import { CharacterCard } from './cards';
import { Button, Icon, PLAYER_MARKS, RES_ICON, ResCount, Worker } from './basics';

// ---------------------------------------------------------------- 共通
/** − 数 ＋ （44pxの押しやすいボタン、読み上げ対応） */
export function Stepper({ label, value, min = 0, max, onChange, icon }: {
  label: string; value: number; min?: number; max: number; onChange: (v: number) => void; icon?: ReactNode;
}) {
  return (
    <div className="mi-step" role="group" aria-label={label}>
      <span className="mi-step-lb">{icon}{label}</span>
      <button type="button" aria-label={`${label}を減らす`} disabled={value <= min} onClick={() => onChange(value - 1)}>−</button>
      <output aria-live="polite">{value}</output>
      <button type="button" aria-label={`${label}を増やす`} disabled={value >= max} onClick={() => onChange(value + 1)}>＋</button>
    </div>
  );
}

/** 下からせり出す画面（選択肢・取引など） */
export function Sheet({ title, children, onClose, footer }: { title: string; children: ReactNode; onClose?: () => void; footer?: ReactNode }) {
  return (
    <div className="mi-root mi-sheet-bg" role="dialog" aria-modal="true" aria-label={title}>
      <div className="mi-sheet">
        <header><h2>{title}</h2>{onClose && <button type="button" className="mi-x" aria-label="閉じる" onClick={onClose}>×</button>}</header>
        <div className="mi-sheet-body">{children}</div>
        {footer && <footer>{footer}</footer>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- ロビー・参加
export interface LobbyMember { id: string; name: string; seat?: number; status: 'host' | 'joined' | 'waiting' | 'ai'; online?: boolean }

/** ホストの待合室：招待リンクとQR、参加承認、AIの追加、開始 */
export function Lobby({ inviteUrl, qr, members, isHost, onApprove, onDecline, onAddAI, onRemove, onStart, onCopy, min = 3, max = 6 }: {
  inviteUrl: string; qr?: ReactNode; members: LobbyMember[]; isHost: boolean;
  onApprove?: (id: string) => void; onDecline?: (id: string) => void; onAddAI?: () => void; onRemove?: (id: string) => void;
  onStart?: () => void; onCopy?: () => void; min?: number; max?: number;
}) {
  const ready = members.filter((m) => m.status !== 'waiting');
  const waiting = members.filter((m) => m.status === 'waiting');
  const canStart = ready.length >= min && ready.length <= max;
  return (
    <div className="mi-root mi-lobby">
      <section className="mi-lobby-invite" aria-label="招待">
        <h2>友だちを招待</h2>
        <div className="mi-qr">{qr ?? <div className="mi-qr-ph" aria-hidden>QR</div>}</div>
        <p className="mi-url"><span>{inviteUrl}</span></p>
        <Button onClick={onCopy}>リンクをコピー</Button>
        <p className="mi-hint">同じリンクを開くと参加申請が届きます。ログインは不要です。</p>
      </section>
      <section className="mi-lobby-members" aria-label="参加者">
        <h2>参加者 {ready.length}/{max}人 <small>（{min}人から遊べます）</small></h2>
        {waiting.length > 0 && (
          <ul className="mi-wait" aria-label="参加申請">
            {waiting.map((m) => (
              <li key={m.id}><span className="mi-wait-msg"><b>{m.name}</b> さんが参加したいそうです</span>
                {isHost && <span><Button kind="primary" onClick={() => onApprove?.(m.id)}>承認</Button><Button onClick={() => onDecline?.(m.id)}>断る</Button></span>}
              </li>
            ))}
          </ul>
        )}
        <ul className="mi-members">
          {ready.map((m, i) => (
            <li key={m.id} className={m.online === false ? 'is-off' : ''}>
              <Worker seat={m.seat ?? i} size={30} />
              <span>{PLAYER_MARKS[m.seat ?? i]} <b>{m.name}</b>{m.status === 'host' && <em>ホスト</em>}{m.status === 'ai' && <em>AI</em>}{m.online === false && <em>接続切れ</em>}</span>
              {isHost && m.status !== 'host' && <button type="button" className="mi-x" aria-label={`${m.name}を外す`} onClick={() => onRemove?.(m.id)}>×</button>}
            </li>
          ))}
        </ul>
        {isHost && <div className="mi-lobby-btns">
          <Button onClick={onAddAI} disabled={ready.length >= max}>AIを入れる</Button>
          <Button kind="primary" onClick={onStart} disabled={!canStart}>{canStart ? 'ゲームを始める' : `あと${min - ready.length}人`}</Button>
        </div>}
        {!isHost && <p className="mi-hint">ホストが始めるのを待っています…</p>}
      </section>
    </div>
  );
}

/** 参加する人の最初の画面：ニックネーム入力（承認待ちの表示も） */
export function JoinScreen({ hostName, waiting, error, onJoin, defaultName = '' }: {
  hostName?: string; waiting?: boolean; error?: string; onJoin: (name: string) => void; defaultName?: string;
}) {
  const [name, setName] = useState(defaultName);
  const ok = name.trim().length >= 1 && name.trim().length <= 8;
  return (
    <div className="mi-root mi-join">
      <h1>ミドリノ谷の四季</h1>
      {hostName && <p>{hostName} さんの部屋に参加します</p>}
      {waiting ? <p className="mi-hint" role="status">ホストの承認を待っています…</p> : (
        <form onSubmit={(e) => { e.preventDefault(); if (ok) onJoin(name.trim()); }}>
          <label htmlFor="mi-nick">ニックネーム（8文字まで）</label>
          <input id="mi-nick" value={name} maxLength={8} autoComplete="nickname" onChange={(e) => setName(e.target.value)} />
          {error && <p className="mi-err" role="alert">{error}</p>}
          <Button kind="primary" wide disabled={!ok}>参加する</Button>
        </form>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- キャラ選択
export function DraftScreen({ options, picked, names, you, onPick }: {
  options: string[] | null; picked: (string | null)[]; names: string[]; you: number; onPick: (id: string) => void;
}) {
  const [sel, setSel] = useState<string | null>(null);
  const mine = picked[you];
  return (
    <div className="mi-root mi-draft">
      <h1>キャラクターを1人選んでください</h1>
      <div className="mi-draft-cards">
        {(options ?? []).map((id) => <CharacterCard key={id} id={id} selected={(mine ?? sel) === id} onSelect={mine ? undefined : setSel} />)}
      </div>
      <div className="mi-draft-foot">
        <ul aria-label="ほかの人の状況">{names.map((n, i) => <li key={i}><Worker seat={i} size={22} />{n}{picked[i] ? ' ✓' : ' …'}</li>)}</ul>
        {mine ? <p role="status">選びました。全員がそろうのを待っています…</p>
          : <Button kind="primary" disabled={!sel} onClick={() => sel && onPick(sel)}>このキャラにする</Button>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 取引
const TRADE_RES: Res[] = [...RES];
const costLabel = (c: Cost) => Object.entries(c).filter(([, n]) => n).map(([r, n]) => `${JP[r as Res]}${n}`).join('・') || 'なし';

/** 取引の提案を作る。相手を選び、「渡す」「もらう」を数で決める */
export function TradeComposer({ you, players, myRes, theirRes, left, onSubmit, onClose }: {
  you: number; players: { seat: number; name: string }[]; myRes: Record<Res, number>;
  theirRes: (seat: number) => Record<Res, number>; left: number;
  onSubmit: (to: number, give: Cost, get: Cost) => void; onClose: () => void;
}) {
  const others = players.filter((p) => p.seat !== you);
  const [to, setTo] = useState(others[0]?.seat ?? 0);
  const [give, setGive] = useState<Cost>({});
  const [get, setGet] = useState<Cost>({});
  const tr = theirRes(to);
  const any = (c: Cost) => Object.values(c).some((n) => n);
  return (
    <Sheet title={`取引を提案（この手番であと${left}回）`} onClose={onClose}
      footer={<Button kind="primary" wide disabled={!any(give) && !any(get)} onClick={() => onSubmit(to, give, get)}>
        {others.find((o) => o.seat === to)?.name}さんに提案する</Button>}>
      <div className="mi-trade-to" role="radiogroup" aria-label="相手">
        {others.map((o) => (
          <button key={o.seat} type="button" role="radio" aria-checked={to === o.seat} className={to === o.seat ? 'is-on' : ''} onClick={() => { setTo(o.seat); setGet({}); }}>
            <Worker seat={o.seat} size={24} />{PLAYER_MARKS[o.seat]}{o.name}
          </button>
        ))}
      </div>
      <div className="mi-trade-cols">
        <fieldset><legend>あなたが渡す</legend>
          {TRADE_RES.filter((r) => myRes[r] > 0).map((r) => <Stepper key={r} label={JP[r]} icon={<Icon name={RES_ICON[r]} size={22} />} value={give[r] ?? 0} max={myRes[r]} onChange={(v) => setGive({ ...give, [r]: v })} />)}
        </fieldset>
        <fieldset><legend>あなたがもらう</legend>
          {TRADE_RES.filter((r) => tr[r] > 0).map((r) => <Stepper key={r} label={JP[r]} icon={<Icon name={RES_ICON[r]} size={22} />} value={get[r] ?? 0} max={tr[r]} onChange={(v) => setGet({ ...get, [r]: v })} />)}
        </fieldset>
      </div>
      <p className="mi-hint">渡す：{costLabel(give)} ／ もらう：{costLabel(get)}。約束ごとは取引できません。</p>
    </Sheet>
  );
}

/** 届いた提案（または自分が出して返事待ちの提案） */
export function TradeOfferCard({ fromSeat, fromName, toName, give, get, mine, onAccept, onDecline, onCancel }: {
  fromSeat: number; fromName: string; toName: string; give: Cost; get: Cost; mine?: boolean;
  onAccept?: () => void; onDecline?: () => void; onCancel?: () => void;
}) {
  return (
    <div className="mi-offer" role="alert">
      <Worker seat={fromSeat} size={32} />
      <div className="mi-offer-body">
        <b>{mine ? `${toName}さんへの提案（返事待ち）` : `${fromName}さんから取引の提案`}</b>
        <div className="mi-offer-row"><span>{mine ? 'あなたが渡す' : 'あなたがもらう'}</span>{Object.entries(give).filter(([, n]) => n).map(([r, n]) => <ResCount key={r} res={r as Res} n={n!} size={20} />)}</div>
        <div className="mi-offer-row"><span>{mine ? 'あなたがもらう' : 'あなたが渡す'}</span>{Object.entries(get).filter(([, n]) => n).map(([r, n]) => <ResCount key={r} res={r as Res} n={n!} size={20} />)}</div>
      </div>
      <div className="mi-offer-btns">
        {mine ? <Button onClick={onCancel}>取り下げ</Button>
          : <><Button kind="primary" onClick={onAccept}>受ける</Button><Button onClick={onDecline}>断る</Button></>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- スペースの選択肢
export interface Choice<T> { value: T; label: string; detail?: string; icon?: ReactNode }

/** 種まき・柵・増築・工房などの選択肢から1つ選ぶ */
export function OptionPicker<T>({ title, choices, onChoose, onClose }: { title: string; choices: Choice<T>[]; onChoose: (v: T) => void; onClose: () => void }) {
  const [i, setI] = useState(0);
  return (
    <Sheet title={title} onClose={onClose} footer={<Button kind="primary" wide disabled={!choices.length} onClick={() => onChoose(choices[i].value)}>これにする</Button>}>
      <div className="mi-choices" role="radiogroup" aria-label={title}>
        {choices.map((c, k) => (
          <button key={k} type="button" role="radio" aria-checked={i === k} className={i === k ? 'is-on' : ''} onClick={() => setI(k)}>
            {c.icon}<span><b>{c.label}</b>{c.detail && <small>{c.detail}</small>}</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

/** 市場：売る→買うの順。値段の計算はアプリから関数で受け取る */
export function MarketForm({ have, sellPrice, buyPrice, buyLimit, coin, onSubmit, onClose }: {
  have: Record<Res, number>; sellPrice: (g: Good) => number; buyPrice: (g: Good) => number; buyLimit: number; coin: number;
  onSubmit: (sells: [Good, number][], buys: [Good, number][]) => void; onClose: () => void;
}) {
  const [sell, setSell] = useState<Partial<Record<Good, number>>>({});
  const [buy, setBuy] = useState<Partial<Record<Good, number>>>({});
  const income = GOODS.reduce((s, g) => s + (sell[g] ?? 0) * sellPrice(g), 0);
  const cost = GOODS.reduce((s, g) => s + (buy[g] ?? 0) * buyPrice(g), 0);
  const nBuy = GOODS.reduce((s, g) => s + (buy[g] ?? 0), 0);
  const after = coin + income - cost;
  const list = (o: Partial<Record<Good, number>>) => GOODS.filter((g) => o[g]).map((g) => [g, o[g]!] as [Good, number]);
  return (
    <Sheet title="市場で売り買い" onClose={onClose}
      footer={<><p className={`mi-sum${after < 0 ? ' is-bad' : ''}`} role="status">コイン {coin} ＋売上 {income} −支払い {cost} ＝ <b>{after}</b>{after < 0 && '（足りません）'}</p>
        <Button kind="primary" wide disabled={after < 0 || (!income && !cost)} onClick={() => onSubmit(list(sell), list(buy))}>この内容で売り買いする</Button></>}>
      <div className="mi-trade-cols">
        <fieldset><legend>① 売る（1個の値段）</legend>
          {GOODS.filter((g) => have[g] > 0).map((g) => <Stepper key={g} label={`${JP[g]} ${sellPrice(g)}`} icon={<Icon name={RES_ICON[g]} size={22} />} value={sell[g] ?? 0} max={have[g]} onChange={(v) => setSell({ ...sell, [g]: v })} />)}
        </fieldset>
        <fieldset><legend>② 買う（合計{buyLimit}個まで）</legend>
          {GOODS.map((g) => <Stepper key={g} label={`${JP[g]} ${buyPrice(g)}`} icon={<Icon name={RES_ICON[g]} size={22} />} value={buy[g] ?? 0} max={(buy[g] ?? 0) + buyLimit - nBuy} onChange={(v) => setBuy({ ...buy, [g]: v })} />)}
        </fieldset>
      </div>
      <p className="mi-hint">売った品は相場が下がり、買った品は上がります（ラウンドの終わりに基準へ1戻ります）。</p>
    </Sheet>
  );
}

// ---------------------------------------------------------------- 記録・季節の知らせ
export function EventLog({ events, max = 30 }: { events: { seq: number; round: number; text: string }[]; max?: number }) {
  return (
    <ol className="mi-log" aria-label="これまでの記録" aria-live="polite">
      {events.slice(-max).reverse().map((e) => <li key={e.seq}><span>R{e.round}</span>{e.text}</li>)}
    </ol>
  );
}

/** ラウンドの節目の知らせ（収穫・冬越しなど）。数秒出して閉じる想定 */
export function SeasonBanner({ title, lines, tone = 'info', onClose }: { title: string; lines: string[]; tone?: 'info' | 'bad'; onClose?: () => void }) {
  return (
    <div className={`mi-root mi-banner is-${tone}`} role="alertdialog" aria-label={title}>
      <h2>{title}</h2>
      <ul>{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
      {onClose && <Button kind="primary" onClick={onClose}>OK</Button>}
    </div>
  );
}

// ---------------------------------------------------------------- 結果
const BD_ROWS: [keyof ScoreBreakdown, string][] = [
  ['fields', '畑'], ['grain', '麦'], ['veg', '野菜'], ['sheep', '羊'], ['pig', '豚'], ['cattle', '牛'], ['diversity', '多様性'],
  ['house', '家'], ['family', '家族'], ['imps', '設備'], ['coin', 'コイン'], ['empty', '空き区画'], ['begging', '借り'],
];

export function ResultScreen({ names, scores, ranking, you, onAgain }: {
  names: string[]; scores: { total: number; breakdown: ScoreBreakdown }[]; ranking: number[]; you: number; onAgain?: () => void;
}) {
  return (
    <div className="mi-root mi-result">
      <h1>ゲーム終了</h1>
      <ol className="mi-podium">
        {ranking.map((seat, i) => (
          <li key={seat} className={`${i === 0 ? 'is-win' : ''}${seat === you ? ' is-me' : ''}`}>
            <span className="mi-rank">{i + 1}位</span><Worker seat={seat} size={36} />
            <b>{PLAYER_MARKS[seat]}{names[seat]}{seat === you && '（あなた）'}</b><span className="mi-total">{scores[seat].total}点</span>
          </li>
        ))}
      </ol>
      <div className="mi-bd-wrap">
        <table className="mi-bd">
          <caption>得点の内訳</caption>
          <thead><tr><th scope="col">項目</th>{ranking.map((s) => <th key={s} scope="col">{PLAYER_MARKS[s]}{names[s]}</th>)}</tr></thead>
          <tbody>
            {BD_ROWS.map(([k, lb]) => (
              <tr key={k}><th scope="row">{lb}</th>{ranking.map((s) => { const v = scores[s].breakdown[k]; return <td key={s} className={v < 0 ? 'is-bad' : ''}>{v}</td>; })}</tr>
            ))}
            <tr className="mi-bd-total"><th scope="row">合計</th>{ranking.map((s) => <td key={s}>{scores[s].total}</td>)}</tr>
          </tbody>
        </table>
      </div>
      {onAgain && <Button kind="primary" onClick={onAgain}>もう一度遊ぶ</Button>}
    </div>
  );
}
