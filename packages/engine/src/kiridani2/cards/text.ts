// 霧谷の冒険者団 v2 — カードの効果の説明文を DSL から作る（再設計のカードは text を手で書かない）。
// 画面の説明と効果がずれないように、エンジンの DSL をそのまま日本語にする。
//
// 言い方の決まり（全カード共通）
// - 効果ごとに【いつ】を頭に付ける：【いつも】【戦闘中】【勝ったとき】【試合の終わり】など。秘術は【唱える】【戦闘中に唱える】。
// - 条件は【いつ】のすぐ後に「〜なら、」。
// - 数えるものは「持たせた武器2つごとに」「使い魔1体ごとに」のように、ものに合う数え方＋「ごとに」。
// - 上限は（最大3）、回数の制限は（1ラウンド1回）（1年1回）（1試合1回）。
// - 年数で増える名声は（年数倍）。かっこは1つにまとめる：（最大3・年数倍）。
// - 増える・減るは「+1」「−1」、手に入れるのは「〜を得る」、払うのは「〜を払って」。
import type { CardDef, Cond, Cost, Effect, Mod, Op, StatKey } from '../types';

const RES_JP: Record<string, string> = { wood: '木材', iron: '鉄', herb: '薬草', food: '食料', mana: '魔石', mat: '素材', gold: '金貨' };
export function costText(c: Cost | undefined): string {
  if (!c) return '';
  return Object.entries(c).filter(([, n]) => n).map(([r, n]) => `${RES_JP[r] ?? r}${n}`).join('・');
}

export const STAT_JP: Record<StatKey, string> = {
  comps: '仲間', occs: '出した職能', walls: '防壁', beds: '寝床', facilities: '建てた道具', gear: '持たせた装備', pets: '使い魔', kills: '倒した魔物',
  races: '倒した種族', trophies: '討伐の名声', hand: '手札', ancient: '遺物', quests: '達成した依頼', skills: '熟練', injured: '負傷した仲間',
  boss: '倒した主', coop: '共闘での勝ち', spells: '唱えた秘術', donations: '寄進', trades: '取引', year: '年', round: 'ラウンド',
  weapons: '持たせた武器', armors: '持たせた防具', tools: '建てた道具', tomes: '覚えた秘術書', casts: '唱えた秘術', shards: '遺物の欠片',
  kinds: '使っている品物の種類', sold: '売った回数', gold: '金貨', atk: '攻めの熟練', def: '守りの熟練', dmg: '守りを超えた反撃',
  sent_atk: '送った仲間の攻めの熟練', sent_wpow: '送った仲間の武器の戦力', sent_k: '送った仲間', exposed: '守りを超える反撃',
  casts_round: 'このラウンドに唱えた秘術',
};
/** 数え方（「2つ」「1体」など） */
const UNIT: Record<StatKey, string> = {
  comps: '人', occs: '枚', walls: 'つ', beds: 'つ', facilities: 'つ', gear: 'つ', pets: '体', kills: '体', races: '種', trophies: '点', hand: '枚',
  ancient: '枚', quests: 'つ', skills: '段', injured: '人', boss: '体', coop: '回', spells: '回', donations: '回', trades: '回', year: '年', round: '',
  weapons: 'つ', armors: 'つ', tools: 'つ', tomes: '冊', casts: '回', shards: '個', kinds: '種', sold: '', gold: '枚', atk: '段', def: '段', dmg: '点',
  sent_atk: '段', sent_wpow: '点', sent_k: '人', exposed: '点', casts_round: '回',
};
/** 「売った回数3」のように、名前に数え方が入っているもの */
const n_ = (k: StatKey, n: number) => `${STAT_JP[k] ?? k}${k === 'sold' ? n + '回' : k === 'round' ? n : n + (UNIT[k] ?? 'つ')}`;

const RACE_JP: Record<string, string> = { beast: '獣', spirit: '精霊', undead: '不死', humanoid: '亜人', dragon: '竜' };
const SEASON_JP: Record<string, string> = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' };
const DRAW_JP: Record<string, string> = { occ: '職能', item: '品物', equip: '武器か防具', weapon: '武器', armor: '防具', tool: '道具', spell: '秘術', ancient: '遺物' };
const SPACE_JP: Record<string, string> = {
  any_accum: 'たまるマス', forest: '古の森', mine: '鉄の坑道', meadow: '薬草の野', spring: '魔石の泉', hunt: '狩場', board: '依頼板', guild: 'ギルド', forge: '鍛冶場',
  workshop: '工房', market: '交換所', curio: '掘り出し市', dig: '古い発掘場', plaza: '広場', hall: '集会所', nest: '巣', lair: '主の巣',
  training: '訓練場', ruins: '遺跡の探索', tavern: '酒場', altar: '古代の祭壇', treasury: '宝物庫', temple: '神殿', caravan: '行商隊',
  tradepost: '交易所', kennel: '獣舎', library: '魔導書庫', bazaar: '大市', lodge: '狩人の小屋', walls: '城壁の普請',
};
const KIND_COST_JP: Record<string, string> = { ...DRAW_JP, any: 'すべての品物', bed: '寝床', wall: '防壁', gear: '共通の装備', facility: '道具' };
const sign = (n: number) => (n >= 0 ? `+${n}` : `−${-n}`);

const WHEN_JP: Record<string, string> = {
  fight: '戦闘中', win: '勝ったとき', lose: '負けたとき', round_start: 'ラウンドの始め', round_end: 'ラウンドの終わり', winter: '冬',
  game_end: '試合の終わり', setup: '試合の始め', build: '建てたとき', hire: '仲間を雇ったとき', craft: '装備を作ったとき', sell: '売ったとき',
  buy: '買ったとき', trade: '取引したとき', donate: '寄進したとき', spell: '秘術を唱えたとき', tame: '使い魔にしたとき', play: '唱える',
  occ: '職能を出したとき', quest: '依頼を達成したとき', hit: '反撃を受けたとき', injure: '仲間が負傷したとき', passive: 'いつも',
};
export function whenJP(w: string, kind?: string): string {
  const [h, a] = w.split(':');
  if (h === 'use') return `${SPACE_JP[a] ?? a}を使ったとき`;
  if (h === 'instead') return `${SPACE_JP[a] ?? a}に置くとき`;
  if (h === 'other') return `ほかの人が${SPACE_JP[a] ?? a}を使ったとき`;
  if (h === 'win_race') return `${RACE_JP[a] ?? a}に勝ったとき`;
  if (h === 'fight' && kind === 'spell') return '戦闘中に唱える';
  return WHEN_JP[h] ?? w;
}

function statCond(m: Partial<Record<StatKey, number>>, ge: boolean): string[] {
  return Object.entries(m).map(([k, n]) => `${n_(k as StatKey, n!)}${ge ? '以上' : '以下'}`.replace(/^(.+?)(\d)/, '$1が$2'));
}
/** 条件を「〜なら、」の形で（無ければ空） */
export function condJP(c: Cond | undefined): string {
  if (!c) return '';
  const out: string[] = [];
  if (c.season) out.push(([] as string[]).concat(c.season).map((s) => SEASON_JP[s] ?? s).join('か'));
  if (c.min) out.push(...statCond(c.min, true));
  if (c.max) out.push(...statCond(c.max, false));
  if (c.race) out.push(`相手が${([] as string[]).concat(c.race).map((r) => RACE_JP[r] ?? r).join('か')}`);
  if (c.boss) out.push('相手が主か古竜');
  if (c.boss === false) out.push('相手が主でない');
  if (c.coop) out.push('共闘');
  if (c.k_min) out.push(`${c.k_min}人以上で挑む`);
  if (c.k_max) out.push(c.k_max === 1 ? '1人で挑む' : `${c.k_max}人以下で挑む`);
  if (c.has) out.push('決まったカードを持っている');
  if (c.res_min) out.push(`${costText(c.res_min)}以上持っている`);
  if (c.t_min !== undefined) out.push(c.t_min >= 0.5 ? '試合の後半' : '試合の途中から');
  if (c.t_max !== undefined) out.push('試合の前半');
  return out.length ? `${out.join('・')}なら、` : '';
}

/** かっこの中身をまとめる：（最大3・年数倍） */
const paren = (xs: (string | false | undefined)[]) => { const v = xs.filter(Boolean); return v.length ? `（${v.join('・')}）` : ''; };

export function opJP(op: Op, scaled = false): string {
  const k = Object.keys(op).find((x) => x !== 'discount' && x !== 'fresh')!;
  const v = (op as Record<string, unknown>)[k] as never;
  const yr = scaled && '年数倍';
  switch (k) {
    case 'gain': return `${costText(v)}を得る`;
    case 'pay': return `${costText(v)}を払って`;
    case 'convert': return `${costText((v as { from: Cost }).from)}を${costText((v as { to: Cost }).to)}に替える`;
    case 'fame': return `名声${sign(v)}${paren([yr])}`;
    case 'power': return `戦力${sign(v)}`;
    case 'guard': return `守り${sign(v)}`;
    case 'counter': return `受ける反撃${sign(v)}`;
    case 'loot': return `戦利品${sign(v)}`;
    case 'trophy': return `証${sign(v)}`;
    case 'str': return `魔物の強さ${sign(v)}`;
    case 'no_injury': return `負傷を${v}人まで防ぐ`;
    case 'extra_worker': return `このラウンド、仲間をもう${v}人置ける`;
    case 'place_again': return '同じマスをもう一度使う';
    case 'ignore_full': return '埋まった巣にも置ける';
    case 'future': { const f = v as { rounds: number[]; gain: Cost }; return `次の${f.rounds.length}ラウンドの始めに、${costText(f.gain)}を得る`; }
    case 'draw': { const d = v as { from: string; look: number; take: number }; return `${DRAW_JP[d.from] ?? d.from}の山から${d.look}枚見て${d.take}枚を手札に`; }
    case 'draw_any': { const d = v as { look: number; take: number }; return `好きな山から${d.look}枚見て${d.take}枚を手札に`; }
    case 'hire': return `仲間を${v}人雇う`;
    case 'hire_free': return `寝床なしで仲間を${v}人増やす`;
    case 'tame': return '巣の魔物1体を戦わずに使い魔にする（捕まえる食料は払う）';
    case 'train': return `${(op as { fresh?: boolean }).fresh ? 'まだ熟練のない' : ''}仲間1人の${v === 'atk' ? '攻めの' : v === 'def' ? '守りの' : ''}熟練+1`;
    case 'build': { const d = (op as { discount?: Cost }).discount; const w = v === 'wall' ? '防壁' : v === 'bed' ? '寝床' : v === 'facility' ? '道具' : '道具・寝床・防壁のどれか'; return `${w}を1つ建てる${d ? `（${costText(d)}安い）` : ''}`; }
    case 'heal': return `負傷した仲間を${v}人回復する`;
    case 'steal_gain': return `${costText(v)}を得る`;
    case 'craft': return `${v === 'weapon' ? '武器' : v === 'armor' ? '防具' : '装備'}を1つ作る`;
    case 'occ': return '手札の職能を1枚出す';
    case 'exchange': return '交換所と同じく、売るか買うを1回する';
    case 'first': return '先手になる';
    case 'donate': { const d = v as { pay: Cost; fame: number }; return `${costText(d.pay)}を寄進して名声+${d.fame}`; }
    case 'fame_per': { const f = v as { stat: StatKey; per: number; max?: number }; return `${n_(f.stat, f.per)}ごとに名声+1${paren([f.max !== undefined && `最大${f.max}`, yr])}`; }
    case 'gain_per': { const g = v as { stat: StatKey; per: number; gain: Cost; max?: number }; return `${n_(g.stat, g.per)}ごとに${costText(g.gain)}を得る${paren([g.max !== undefined && `最大${g.max}回`])}`; }
    case 'others_gain': return `ほかの人全員が${costText(v)}を得る`;
    case 'power_per': { const p = v as { stat: StatKey; per: number; mult?: number; max?: number }; return `${n_(p.stat, p.per)}ごとに戦力${sign(p.mult ?? 1)}${paren([p.max !== undefined && `最大${p.max}`])}`; }
    case 'lose': return `${costText(v)}を失う`;
    case 'injure': return `自分の仲間${v}人が負傷する`;
    case 'scrap': { const s = v as { gain_per_cost?: Cost }; return `建てた道具を1つ壊す（山に戻す）${s.gain_per_cost ? `。その費用1つごとに${costText(s.gain_per_cost)}を得る` : ''}`; }
    case 'shard': return `遺物の欠片+${v}`;
    case 'buy_card': { const b = v as { count: number; price: number }; return `掘り出し市の品物を${b.count}枚まで、1枚金貨${b.price}で買う`; }
    default: return k;
  }
}
export function opsJP(ops: Op[] | undefined, scaled = false): string {
  if (!ops?.length) return '';
  // 「〜を払って」の後は読点を付けない
  // 続くときは前をつなぐ形に（得る→得て、失う→失って、する→して、なる→なって）
  const te = (x: string) => x.replace(/得る$/, '得て').replace(/失う$/, '失って').replace(/する$/, 'して').replace(/なる$/, 'なって');
  return ops.map((o) => opJP(o, scaled)).reduce((s, p, i, a) => (i === 0 ? p : a[i - 1].endsWith('払って') ? s + p : te(s) + '、' + p), '');
}

export function modJP(m: Mod): string {
  const out: string[] = [];
  for (const [k, v] of Object.entries(m) as [keyof Mod, never][]) {
    switch (k) {
      case 'market_qty': out.push(`交換所で扱える数${sign(v)}`); break;
      case 'market_both': out.push('交換所で、売ると買うを同じ手番にできる'); break;
      case 'trade_count': out.push(`取引できる回数${sign(v)}`); break;
      case 'accum_bonus': out.push(`${Object.entries(v as Record<string, number>).map(([s, n]) => `${SPACE_JP[s] ?? s}を使うと+${n}`).join('・')}`); break;
      case 'cost_discount': { const d = v as { kind: string; res: Cost }; out.push(`${KIND_COST_JP[d.kind] ?? d.kind}の費用が${costText(d.res)}安い`); break; }
      case 'cost_extra': { const d = v as { kind: string; res: Cost }; out.push(`${KIND_COST_JP[d.kind] ?? d.kind}の費用が${costText(d.res)}高い`); break; }
      case 'upkeep': out.push(`冬に払う食料${sign(v)}`); break;
      case 'donate_rate': out.push(Object.entries(v as Cost).map(([r, n]) => `寄進で払う${RES_JP[r] ?? r}は多くても${n}`).join('・')); break;
      case 'base_guard': out.push(`拠点と戦闘の守り${sign(v)}`); break;
      case 'pet_power': out.push(`使い魔の戦力${sign(v)}`); break;
      case 'hand_limit': out.push(`手札の上限${sign(v)}`); break;
      case 'power': out.push(`戦闘のたびに戦力${sign(v)}`); break;
      case 'heal_discount': out.push(`回復に払う薬草−${v}`); break;
      case 'sell_bonus': out.push(`売値+${v}`); break;
      case 'bed_cap': out.push(`寝床${sign(v)}として数える`); break;
      case 'pet_cap': out.push(`持てる使い魔${sign(v)}`); break;
      case 'pet_bring': out.push(`戦闘に連れて行ける使い魔${sign(v)}`); break;
      case 'capture_ease': out.push(`捕まえるのに要る戦力${sign(-(v as number))}`); break;
      case 'gold_mana': out.push(`秘術の魔石1を金貨${v}で払える`); break;
      case 'gold_cap': out.push(`金貨の名声の上限${sign(v)}（年数倍）`); break;
      case 'gold_div': out.push(`金貨${v}枚ごとに名声1（ふつうは4枚）`); break;
      case 'sell_full': out.push('売値が買値と同じになる'); break;
      case 'shard_need': out.push(`遺物1枚に要る欠片${sign(-(v as number))}`); break;
      case 'ancient_look': out.push(`遺物を引くとき、${v}枚多く見る`); break;
      case 'spell_return': out.push(`使い切りの秘術を唱えたあと、魔石1を払って手札に戻せる（1ラウンド${v}枚まで）`); break;
      case 'comp_cap': out.push(`仲間の上限${sign(v)}`); break;
      case 'occ_food': out.push(`職能を出すときの食料${sign(v)}`); break;
      case 'two_hand_armor': out.push('両手武器を持っても防具を持てる'); break;
      case 'rage': out.push(`反撃で負傷しない。代わりに負傷する分を怒りとしてため（最大${v}）、次の戦闘で戦力に足す`); break;
      case 'no_atk_train': out.push('攻めの熟練を上げられない'); break;
      case 'tool_yield': out.push(`道具の効果で資源を得るとき、その資源+${v}`); break;
      case 'leader_no_weapon': out.push('リーダーは武器を持てない'); break;
    }
  }
  return out.join('。');
}

const LIMIT_JP: Record<string, string> = { round: '1ラウンド1回', year: '1年1回', game: '1試合1回' };
export function effectJP(e: Effect, kind?: string): string {
  const head = `【${whenJP(e.when, kind)}】`;
  const c = condJP(e.if);
  if (e.when === 'passive') return head + c + modJP(e.mod ?? {});
  // 終わりの名声・主に勝ったときの名声は年数で増える
  const scaled = e.when === 'game_end' || (e.when === 'win' && !!e.if?.boss);
  const body = opsJP(e.do, scaled);
  const lim = e.limit ? `（${LIMIT_JP[e.limit] ?? e.limit}）` : '';
  return head + c + body + lim;
}

/** カードの説明文（費用以外。費用は画面が別に出す） */
export function cardText(c: CardDef): string {
  const top: string[] = [];
  if (c.power) top.push(`戦力${sign(c.power)}`);
  if (c.guard) top.push(`守り${sign(c.guard)}`);
  if (c.two_hand) top.push('両手持ち');
  if (c.leader_only) top.push('リーダー専用');
  const out: string[] = [];
  if (top.length) out.push(top.join('・'));
  if (c.tome) out.push(`秘術書（覚える：${costText(c.tome.learn) || 'なし'}／1手番に${c.tome.uses}回まで）`);
  else if (c.kind === 'spell') out.push('使い切り');
  if (c.fame) out.push(`${c.kind === 'spell' ? '覚えていると' : c.kind === 'tool' ? '建てていると' : c.slot ? '持っていると' : '出していると'}名声+${c.fame}`);
  // 条件のない【いつも】は1つにまとめて先に出す
  const always = [c.mods ? modJP(c.mods) : '', ...c.effects.filter((e) => e.when === 'passive' && !e.if).map((e) => modJP(e.mod ?? {}))].filter(Boolean);
  if (always.length) out.push('【いつも】' + always.join('。'));
  for (const e of c.effects) if (!(e.when === 'passive' && !e.if)) out.push(effectJP(e, c.kind));
  return out.filter(Boolean).join('。') + '。';
}

/** カードに説明文を入れる（手で書いた文は使わず、いつも DSL から作る） */
export function withText<T extends CardDef>(cs: T[]): T[] {
  for (const c of cs) c.text = cardText(c);
  return cs;
}
