// 霧谷：画面に無かった選択のための小さなシート（何人で・どの方針で戦うか、共闘に加わるか、どのカードを取るか、はい/いいえ）。
// 中身は親が決める（エンジンの選択肢をそのまま並べるだけ。ルールの計算はしない）。カード・コスト・魔物の部品は既存のものを使う。
import { MonsterArt, BossArt, KIcon } from '../art-registry';
import type { Cost } from '../data';
import { CardFace, CostRow } from './parts';
import { InfoDot } from './inspect';

export interface ChoiceMeter { power: number; need: number; pwin: number; partner?: number }
export interface ChoiceItem {
  id: string;
  title: string;
  detail?: string;
  /** カードの絵を出す */
  card?: string;
  /** 払うもの */
  cost?: Cost;
  /** 得るもの（払うもの → 得るもの のアイコンで出す） */
  gain?: Cost;
  /** 戦闘の見込み（戦力・必要・勝つ確率） */
  meter?: ChoiceMeter;
  /** 使う札（矢・ポーション・秘術など） */
  uses?: string[];
  primary?: boolean;
  /** 右上の i マークで開く詳しい説明（data-inspect の形。カード・魔物など） */
  info?: string;
}
export interface ChoiceSpec { title: string; sub?: string; monster?: string; items: ChoiceItem[]; cancel?: string }

export function ChoiceSheet({ spec, onPick, onCancel }: { spec: ChoiceSpec; onPick: (id: string) => void; onCancel?: () => void }) {
  return (
    <div className="kd-ovwrap kd-sheetwrap">
      <div className="kd-sheet" role="dialog" aria-label={spec.title}>
        <header className="kd-sheet-h">
          {spec.monster && (spec.monster.startsWith('b_') ? <BossArt id={spec.monster} size={56} /> : <MonsterArt id={spec.monster} size={56} />)}
          <div><strong>{spec.title}</strong>{spec.sub && <small>{spec.sub}</small>}</div>
        </header>
        <div className="kd-choices">
          {spec.items.map((it) => (
            <button key={it.id} type="button" className={`kd-choice${it.primary ? ' is-primary' : ''}${it.card ? ' has-card' : ''}${it.info ? ' has-info' : ''}`} onClick={() => onPick(it.id)}>
              {it.card && <span className="kd-choice-card"><CardFace id={it.card} size="s" /></span>}
              <span className="kd-choice-b">
                <strong>{it.title}</strong>
                {it.detail && <small>{it.detail}</small>}
                {(it.cost && Object.values(it.cost).some((n) => n)) || it.uses?.length || it.gain ? (
                  <span className="kd-choice-uses">{it.uses?.map((u, i) => <i key={i}>{u}</i>)}{it.cost && Object.values(it.cost).some((n) => n) && <CostRow cost={it.cost} size={14} />}{it.gain && <><span className="kd-choice-to" aria-label="で得る">→</span><CostRow cost={it.gain} size={14} /></>}</span>
                ) : null}
              </span>
              {it.meter && <Meter m={it.meter} />}
              {it.info && <InfoDot target={it.info} label={`${it.title}をくわしく`} />}
            </button>
          ))}
        </div>
        {onCancel && <button type="button" className="kd-btn kd-sheet-x" onClick={onCancel}>{spec.cancel ?? 'やめる'}</button>}
      </div>
    </div>
  );
}

function Meter({ m }: { m: ChoiceMeter }) {
  const pct = Math.round(m.pwin * 100);
  const tone = pct >= 80 ? 'is-good' : pct >= 40 ? 'is-mid' : 'is-bad';
  return (
    <span className={`kd-meter ${tone}`} aria-label={`戦力${m.power}${m.partner ? `＋共闘${m.partner}` : ''}、勝つ見込み${pct}%`}>
      <span><KIcon name="power" size={14} />{m.power}{m.partner ? `+${m.partner}` : ''}</span>
      <b>{pct}%</b>
    </span>
  );
}
