// 霧谷 v2 — タップで詳しく見るシート（v1 の InspectSheet と同じ見た目。中身は v2 のカード・魔物・マス・プレイヤー）
import { useEffect, type ReactNode } from 'react';
import { DATA, type Monster, FLAVOR } from '@midorino/engine/src/kiridani2';
import { KIcon, NestScene, TerrainArt } from '../kiridani/art-registry';
import { CostRow, ResCount, Token } from '../kiridani/ui/parts';
import { CardChip2, CardFace2, ENGINE_JP, KIND2_JP, LeaderArt, MonArt } from './parts2';
import { ANC2, CARD2, NEST_JP, QUEST2, RES_JP, cardName, placeName, type PV2, type Seat, type View2 } from './view';
import { RES } from '@midorino/engine/src/kiridani2';

const nameOf = (v: View2, s: Seat) => (s === v.me ? 'あなた' : v.players[s]?.name ?? '');
const Row = ({ k, children }: { k: string; children: ReactNode }) => <div className="kd-insp-row"><span>{k}</span><div>{children}</div></div>;
const RACE_JP: Record<string, string> = { beast: '獣', spirit: '精霊', undead: '亡者', humanoid: '人型', dragon: '竜' };
const EL_JP: Record<string, string> = { fire: '炎', ice: '氷', thunder: '雷', light: '光', dark: '闇' };

function monBlock(m: Monster): ReactNode {
  return <>
    <div className="kd-insp-art"><MonArt m={m} size={110} /></div>
    <Row k="強さ">{m.str}{m.wounds ? `（傷${m.wounds} → ${m.str - m.wounds}）` : ''}</Row>
    <Row k="反撃">{m.counter}（守りを超えた分だけ前衛が負傷）</Row>
    <Row k="種族・弱点"><span className="kd-insp-who"><KIcon name={m.race} size={18} />{RACE_JP[m.race]}</span>{m.weak && <span className="kd-insp-who"><KIcon name={m.weak} size={18} />弱点：{EL_JP[m.weak]}（突くと戦力+{DATA.WEAK_BONUS}）</span>}</Row>
    <Row k="戦利品"><CostRow cost={m.loot} size={18} /></Row>
    <Row k="討伐の証">名声{m.trophy}</Row>
    {m.raid > 0 && <Row k="冬の襲撃">{m.raid}（その年のうちに倒さないと冬に襲う）</Row>}
  </>;
}

function playerBlock(v: View2, p: PV2): ReactNode {
  return <>
    <div className="kd-insp-art"><LeaderArt id={p.leader} size={96} /></div>
    {p.leader && <Row k="リーダー"><span className="kd-insp-link" data-inspect={`card2:${p.leader}`} role="button" tabIndex={0}>{cardName(p.leader)}</span></Row>}
    <Row k="名声">{p.fame}{p.discontent ? `（不満${p.discontent}）` : ''}</Row>
    <Row k="持ち物"><span className="kd-resgrid">{RES.map((r) => <ResCount key={r} r={r} n={p.res[r]} size={16} />)}</span></Row>
    <Row k="仲間">{p.comps.map((c, i) => <span key={i} className="kd-insp-who"><Token seat={p.seat} size={14} injured={c.injured} />攻{c.atk}守{c.def}{c.weapon ? `・${cardName(c.weapon)}` : ''}{c.armor ? `・${cardName(c.armor)}` : ''}</span>)}</Row>
    <Row k="職能">{p.occs.length ? p.occs.map((c) => <CardChip2 key={c} id={c} />) : 'なし'}</Row>
    <Row k="施設・防壁">{p.tools.map((c) => <CardChip2 key={c} id={c} />)}寝床{p.beds}・防壁{p.walls}</Row>
    <Row k="討伐">{p.trophies.length}体・使い魔{p.pets}</Row>
  </>;
}

function body(target: string, v: View2): { kind: string; title: string; node: ReactNode } | null {
  const [k, id] = target.split(':');
  switch (k) {
    case 'card2': {
      const c = CARD2[id], q = QUEST2[id], a = ANC2[id];
      if (!c && !q && !a) return null;
      const name = c?.name ?? q?.name ?? a?.name ?? id;
      return {
        kind: c ? KIND2_JP[c.kind] : q ? (q.secret ? '秘密依頼' : '依頼') : '古代の品', title: name, node: <>
          <div className="kd-insp-card"><CardFace2 id={id} size="l" /></div>
          {c?.engine?.length ? <Row k="強い動き"><span className="kd-tags">{c.engine.map((e) => <i key={e}>{ENGINE_JP[e] ?? e}</i>)}</span></Row> : null}
          {c?.cost && <Row k="費用"><CostRow cost={c.cost} size={18} /></Row>}
          {c?.prereq && <Row k="条件">{Object.entries(c.prereq).map(([kk, n]) => `${kk === 'occs' ? '職能' : kk === 'comps' ? '仲間' : kk === 'walls' ? '防壁' : kk === 'facilities' ? '施設' : kk === 'kills' ? '討伐' : kk}${typeof n === 'number' ? `${n}以上` : `：${cardName(String(n))}`}`).join('・')}</Row>}
          {c && (c.kind === 'weapon' || c.kind === 'armor' || c.kind === 'gear') && <Row k="装備">{c.slot === 'armor' ? '防具の枠' : '武器の枠'}{c.power ? `・戦力+${c.power}` : ''}{c.guard ? `・守り+${c.guard}` : ''}{c.rear ? '・後衛（反撃を受けない）' : ''}{c.two_hand ? '・両手（防具なし）' : ''}</Row>}
          {c?.kind === 'gear' && <Row k="作る場所">{(c as { place?: string }).place === 'training' ? '訓練場' : '鍛冶場'}</Row>}
          {a && <Row k="組">同じ種類2つ＝名声{DATA.ANCIENT_SAME[2]}・3つ＝{DATA.ANCIENT_SAME[3]}・4種そろい＝{DATA.ANCIENT_ALL}</Row>}
        </>,
      };
    }
    case 'mon2': case 'fc': {
      const uid = Number(id);
      const all = [...v.nests.map((n) => n.mon), v.lair.boss, ...v.forecast, ...v.bosses.map((b) => b.boss), v.combat?.monster].filter(Boolean) as Monster[];
      const m = all.find((x) => x.uid === uid);
      if (!m) return null;
      return { kind: k === 'fc' ? '次のラウンドの予告' : m.boss ? '主' : '魔物', title: m.name, node: monBlock(m) };
    }
    case 'forecast': return { kind: '予告', title: '次のラウンドに出るかもしれない魔物', node: <>{v.forecast.map((m) => <Row key={m.uid} k={`強さ${m.str}`}><span className="kd-insp-link" data-inspect={`fc:${m.uid}`} role="button" tabIndex={0}>{m.name}</span></Row>)}<p className="kd-insp-p">空いた巣に、くじで出てくる（全部出るとは限らない）。</p></> };
    case 'space2': {
      if (id.startsWith('nest') || id === 'lair') {
        const n = v.nests.find((x) => x.id === id);
        return { kind: '巣', title: NEST_JP[id] ?? id, node: <><div className="kd-insp-art is-wide"><NestScene id={id} width={300} /></div><p className="kd-insp-p">1ラウンドに2組まで。1回に送れる仲間は{DATA.MAX_SEND}人まで。戦力（2＋攻めの熟練＋武器）と運命カードの合計が強さ以上で撃破。</p>{n?.mon ? monBlock(n.mon) : <p className="kd-insp-p">いまは魔物がいない。</p>}</> };
      }
      const def = DATA.SPACE[id];
      const st = CARD2[id];
      const s = v.spaces[id];
      return {
        kind: s?.stage ? `段階${s.stage}の場所` : '行動マス', title: placeName(id), node: <>
          {!s?.stage && <div className="kd-insp-art"><TerrainArt id={id} size={96} /></div>}
          {st && <p className="kd-insp-p kd-insp-big">{st.text}</p>}
          {st && FLAVOR[id] && <p className="kd2-flavor">{FLAVOR[id]}</p>}
          {def?.accum && <Row k="毎ラウンドたまる"><CostRow cost={def.accum} size={18} signed /></Row>}
          {s && Object.keys(s.stock).length > 0 && <Row k="いまたまっている"><CostRow cost={s.stock} size={18} /></Row>}
          {def && <Row k="できること">{def.options.map((ops, i) => <span key={i} className="kd-insp-chip">{ops.length ? ops.map((o) => Object.keys(o)[0]).map((x) => OPS_JP[x] ?? x).join('＋') : 'たまった資源を取る'}</span>)}</Row>}
          <Row k="置ける人数">{(def?.cap ?? (st as { cap?: number } | undefined)?.cap ?? 1) === 0 ? '何人でも' : `1ラウンドに${def?.cap ?? (st as { cap?: number } | undefined)?.cap ?? 1}人`}</Row>
          {s && s.occupants.length > 0 && <Row k="置いた人">{s.occupants.map((o, i) => <span key={i} className="kd-insp-who"><Token seat={o} size={16} />{nameOf(v, o)}</span>)}</Row>}
        </>,
      };
    }
    case 'seat': {
      const p = v.players[Number(id)];
      return p ? { kind: 'プレイヤー', title: nameOf(v, p.seat), node: playerBlock(v, p) } : null;
    }
    case 'upkeep2': {
      const p = v.players[v.me];
      if (!p) return null;
      const need = p.comps.length * DATA.UPKEEP;
      return { kind: '冬の食料', title: `次の冬に要る食料 ${need}`, node: <><Row k="仲間">{p.comps.length}人 × 食料{DATA.UPKEEP}</Row><Row k="手持ち">{RES_JP.food}{p.res.food}</Row><p className="kd-insp-p">足りない食料{DATA.UPKEEP}ごとに不満1枚（名声−{DATA.DISCONTENT}）。カードで減ることがある。</p></> };
    }
    default: return null;
  }
}
const OPS_JP: Record<string, string> = { gain: '資源を得る', occ: '職能を出す', craft: '装備を作る', build: '建てる', exchange: '売り買い', first: '先手', train: '熟練', hire: '仲間+1', draw: 'カードを見る', donate: '寄進', fame: '名声' };

export function Inspect2({ target, v, onClose, onBack, depth }: { target: string; v: View2; onClose: () => void; onBack?: () => void; depth: number }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [onClose]);
  const b = body(target, v);
  if (!b) return null;
  return (
    <div className="kd-insp-wrap" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="kd-insp" role="dialog" aria-modal="true" aria-label={b.title}>
        <header className="kd-insp-h">
          {depth > 1 && onBack && <button type="button" className="kd-insp-back" onClick={onBack} aria-label="ひとつ前へ">‹</button>}
          <div className="kd-insp-t"><small>{b.kind}</small><strong>{b.title}</strong></div>
          <button type="button" className="kd-insp-x" onClick={onClose} aria-label="閉じる">×</button>
        </header>
        <div className="kd-insp-b">{b.node}</div>
        <button type="button" className="kd-btn kd-insp-close" onClick={onClose}>閉じる</button>
      </div>
    </div>
  );
}
