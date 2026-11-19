// 霧谷の冒険者団 v2 — カードの効果の説明文を DSL から作る（再設計のカードは text を手で書かない）。
// 画面の説明と効果がずれないように、エンジンの DSL をそのまま日本語にする。
import type { CardDef, Cond, Cost, Effect, Mod, Op, StatKey } from '../types';

const RES_JP: Record<string, string> = { wood: '木材', iron: '鉄', herb: '薬草', food: '食料', mana: '魔石', mat: '素材', gold: '金貨' };
export function costText(c: Cost | undefined): string {
  if (!c) return '';
  return Object.entries(c).filter(([, n]) => n).map(([r, n]) => `${RES_JP[r] ?? r}${n}`).join('・');
}

export const STAT_JP: Record<StatKey, string> = {
  comps: '仲間', occs: '出した職能', walls: '防壁', beds: '寝床', facilities: '道具', gear: '持たせた装備', pets: '使い魔', kills: '倒した魔物',
  races: '倒した種族', trophies: '討伐の名声', hand: '手札', ancient: '遺物', quests: '達成した依頼', skills: '熟練', injured: '負傷した仲間',
  boss: '倒した主', coop: '共闘の勝ち', spells: '唱えた秘術', donations: '寄進', trades: '取引', year: '年', round: 'ラウンド',
  weapons: '持たせた武器', armors: '持たせた防具', tools: '建てた道具', tomes: '身につけた秘術', casts: '唱えた秘術', shards: '遺物の欠片',
  kinds: '使っている品物の種類', sold: '売った回数', gold: '金貨', atk: '攻めの熟練', def: '守りの熟練', dmg: '守りを超えた反撃',
  sent_atk: '送った仲間の攻めの熟練', sent_wpow: '送った仲間の武器の戦力', sent_k: '送った仲間', exposed: '守りを超える反撃',
  casts_round: 'このラウンドに唱えた秘術',
};
const RACE_JP: Record<string, string> = { beast: '獣', spirit: '精霊', undead: '不死', humanoid: '亜人', dragon: '竜' };
const SEASON_JP: Record<string, string> = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' };
const DRAW_JP: Record<string, string> = { occ: '職能', item: '品物', equip: '武器か防具', weapon: '武器', armor: '防具', tool: '道具', spell: '秘術', ancient: '遺物' };
const SPACE_JP: Record<string, string> = {
  forest: '古の森', mine: '鉄の坑道', meadow: '薬草の野', spring: '魔石の泉', hunt: '狩場', board: '依頼板', guild: 'ギルド', forge: '鍛冶場',
  workshop: '工房', market: '交換所', curio: '掘り出し市', dig: '古い発掘場', plaza: '広場', hall: '集会所', nest: '巣', lair: '主の巣',
  training: '訓練場', ruins: '遺跡の探索', tavern: '酒場', altar: '古代の祭壇', treasury: '宝物庫', temple: '神殿', caravan: '行商隊',
  tradepost: '交易所', kennel: '獣舎', library: '魔導書庫', bazaar: '大市', lodge: '狩人の小屋', walls: '城壁の普請',
};
const sign = (n: number) => (n >= 0 ? `+${n}` : `−${-n}`);

export function whenJP(w: string): string {
  const [h, a] = w.split(':');
  if (h === 'use') return `${SPACE_JP[a] ?? a}を使うたび`;
  if (h === 'instead') return `${SPACE_JP[a] ?? a}に置くとき、代わりに`;
  if (h === 'other') return `ほかの人が${SPACE_JP[a] ?? a}を使うと`;
  if (h === 'win_race') return `${RACE_JP[a] ?? a}に勝つと`;
  const JP: Record<string, string> = {
    fight: '戦闘で', win: '戦闘に勝つと', lose: '戦闘に負けると', round_start: 'ラウンドの始めに', round_end: 'ラウンドの終わりに', winter: '冬に',
    game_end: '終わりに', setup: '始めに', build: '建てると', hire: '仲間を雇うと', craft: '装備を作ると', sell: '売ると', buy: '買うと',
    trade: '取引すると', donate: '寄進すると', spell: '秘術を唱えると', tame: '使い魔にすると', play: '', occ: '職能を出すと', quest: '依頼を達成すると',
    hit: '反撃を受けると', injure: '仲間が負傷すると', passive: '',
  };
  return JP[h] ?? w;
}

function statCond(m: Partial<Record<StatKey, number>>, ge: boolean): string[] {
  return Object.entries(m).map(([k, n]) => `${STAT_JP[k as StatKey] ?? k}が${n}${ge ? '以上' : '以下'}`);
}
export function condJP(c: Cond | undefined): string {
  if (!c) return '';
  const out: string[] = [];
  if (c.season) out.push(`${([] as string[]).concat(c.season).map((s) => SEASON_JP[s] ?? s).join('か')}なら`);
  if (c.min) out.push(...statCond(c.min, true));
  if (c.max) out.push(...statCond(c.max, false));
  if (c.race) out.push(`相手が${([] as string[]).concat(c.race).map((r) => RACE_JP[r] ?? r).join('か')}`);
  if (c.boss) out.push('相手が主・古竜');
  if (c.boss === false) out.push('相手が主でない');
  if (c.coop) out.push('共闘');
  if (c.k_min) out.push(`${c.k_min}人以上で挑む`);
  if (c.k_max) out.push(`${c.k_max}人以下で挑む`);
  if (c.has) out.push('特定のカードを持つ');
  if (c.res_min) out.push(`${costText(c.res_min)}以上持つ`);
  if (c.t_min !== undefined) out.push(c.t_min >= 0.5 ? '試合の後半' : '試合の途中から');
  if (c.t_max !== undefined) out.push('試合の前半');
  return out.join('・');
}

export function opJP(op: Op): string {
  const k = Object.keys(op).find((x) => x !== 'discount' && x !== 'fresh')!;
  const v = (op as Record<string, unknown>)[k] as never;
  switch (k) {
    case 'gain': return `${costText(v)}を得る`;
    case 'pay': return `${costText(v)}を払い`;
    case 'convert': return `${costText((v as { from: Cost }).from)}を${costText((v as { to: Cost }).to)}に替える`;
    case 'fame': return `名声${sign(v)}`;
    case 'power': return `戦力${sign(v)}`;
    case 'guard': return `守り${sign(v)}`;
    case 'counter': return `反撃${sign(v)}`;
    case 'loot': return `戦利品${sign(v)}`;
    case 'trophy': return `証${sign(v)}`;
    case 'str': return `魔物の強さ${sign(v)}`;
    case 'no_injury': return `負傷を${v}人防ぐ`;
    case 'extra_worker': return `このラウンド、仲間をもう${v}人置ける`;
    case 'place_again': return '同じマスをもう一度使う';
    case 'ignore_full': return '定員の埋まった巣にも置ける';
    case 'future': { const f = v as { rounds: number[]; gain: Cost }; return `次から${f.rounds.length}ラウンド、毎ラウンド${costText(f.gain)}`; }
    case 'draw': { const d = v as { from: string; look: number; take: number }; return `${DRAW_JP[d.from] ?? d.from}の山から${d.look}枚見て${d.take}枚を手札に`; }
    case 'draw_any': { const d = v as { look: number; take: number }; return `好きな山から${d.look}枚見て${d.take}枚を手札に`; }
    case 'hire': return `仲間を${v}人雇う`;
    case 'hire_free': return `寝床なしで仲間を${v}人増やす`;
    case 'tame': return '巣の魔物1体を戦わずに使い魔にする（捕まえる食料は払う）';
    case 'train': return `${(op as { fresh?: boolean }).fresh ? 'まだ熟練のない' : ''}仲間1人の${v === 'atk' ? '攻め' : v === 'def' ? '守り' : ''}の熟練+1`;
    case 'build': { const d = (op as { discount?: Cost }).discount; const w = v === 'wall' ? '防壁' : v === 'bed' ? '寝床' : v === 'facility' ? '道具' : '道具・寝床・防壁のどれか'; return `${w}を1つ建てる${d ? `（${costText(d)}安い）` : ''}`; }
    case 'heal': return `負傷した仲間を${v}人回復`;
    case 'steal_gain': return `${costText(v)}を得る`;
    case 'craft': return `${v === 'weapon' ? '武器' : v === 'armor' ? '防具' : '装備'}を1つ作る`;
    case 'occ': return '手札の職能を1枚出す';
    case 'exchange': return '交換所と同じく売るか買う';
    case 'first': return '先手になる';
    case 'donate': { const d = v as { pay: Cost; fame: number }; return `${costText(d.pay)}を寄進して名声${d.fame}`; }
    case 'fame_per': { const f = v as { stat: StatKey; per: number; max?: number }; return `${STAT_JP[f.stat]}${f.per}つにつき名声+1${f.max ? `（${f.max}まで）` : ''}`; }
    case 'gain_per': { const g = v as { stat: StatKey; per: number; gain: Cost; max?: number }; return `${STAT_JP[g.stat]}${g.per}つにつき${costText(g.gain)}${g.max ? `（${g.max}回まで）` : ''}`; }
    case 'others_gain': return `ほかの人全員が${costText(v)}を得る`;
    case 'power_per': { const p = v as { stat: StatKey; per: number; mult?: number; max?: number }; return `${STAT_JP[p.stat]}${p.per === 1 ? '1' : p.per}につき戦力${sign(p.mult ?? 1)}${p.max !== undefined ? `（${p.max}まで）` : ''}`; }
    case 'lose': return `${costText(v)}を失う`;
    case 'injure': return `自分の仲間${v}人が負傷する`;
    case 'scrap': { const s = v as { gain_per_cost?: Cost }; return `建てた道具を1つ壊す（山の下へ）${s.gain_per_cost ? `。その費用1つにつき${costText(s.gain_per_cost)}` : ''}`; }
    case 'shard': return `遺物の欠片+${v}`;
    case 'buy_card': { const b = v as { count: number; price: number }; return `掘り出し市の品物を${b.count}枚まで、1枚金貨${b.price}で買う`; }
    default: return k;
  }
}
export function opsJP(ops: Op[] | undefined): string {
  if (!ops?.length) return '';
  const parts = ops.map(opJP);
  return parts.join('、');
}

export function modJP(m: Mod): string {
  const out: string[] = [];
  for (const [k, v] of Object.entries(m) as [keyof Mod, never][]) {
    switch (k) {
      case 'market_qty': out.push(`交換所で扱える数${sign(v)}`); break;
      case 'market_both': out.push('交換所で売りと買いを両方できる'); break;
      case 'trade_count': out.push(`取引できる回数${sign(v)}`); break;
      case 'accum_bonus': out.push(`たまるマスを使うと${Object.entries(v as Record<string, number>).map(([s, n]) => `${SPACE_JP[s] ?? s}で+${n}`).join('・')}`); break;
      case 'cost_discount': { const d = v as { kind: string; res: Cost }; out.push(`${DRAW_JP[d.kind] ?? (d.kind === 'any' ? '何でも' : d.kind === 'bed' ? '寝床' : d.kind === 'wall' ? '防壁' : d.kind === 'gear' ? '共通の装備' : d.kind)}の費用が${costText(d.res)}安い`); break; }
      case 'cost_extra': { const d = v as { kind: string; res: Cost }; out.push(`${DRAW_JP[d.kind] ?? (d.kind === 'any' ? '何でも' : d.kind)}の費用が${costText(d.res)}高い`); break; }
      case 'upkeep': out.push(`冬の食料${sign(v)}`); break;
      case 'donate_rate': out.push(`寄進が${costText(v)}まで安い`); break;
      case 'base_guard': out.push(`拠点と戦闘の守り${sign(v)}`); break;
      case 'pet_power': out.push(`使い魔の戦力${sign(v)}`); break;
      case 'hand_limit': out.push(`手札の上限${sign(v)}`); break;
      case 'power': out.push(`戦闘のたびに戦力${sign(v)}`); break;
      case 'heal_discount': out.push(`回復の薬草が${v}安い`); break;
      case 'sell_bonus': out.push(`売値+${v}`); break;
      case 'bed_cap': out.push(`寝床${sign(v)}として数える`); break;
      case 'pet_cap': out.push(`持てる使い魔${sign(v)}`); break;
      case 'pet_bring': out.push(`戦闘に連れて行ける使い魔${sign(v)}`); break;
      case 'capture_ease': out.push(`捕まえるのに要る戦力${sign(-(v as number))}`); break;
      case 'gold_mana': out.push(`秘術の魔石の代わりに金貨${v}枚で払える`); break;
      case 'gold_cap': out.push(`金貨の名声の上限${sign(v)}（年数の倍率）`); break;
      case 'gold_div': out.push(`金貨の名声が1/${v}`); break;
      case 'sell_full': out.push('売値が買値と同じ'); break;
      case 'shard_need': out.push(`遺物1枚に要る欠片${sign(-(v as number))}`); break;
      case 'ancient_look': out.push(`遺物を引くとき${v}枚多く見る`); break;
      case 'spell_return': out.push(`使い切りの秘術を唱えたあと、魔石1で手札に戻せる（ラウンドに${v}枚）`); break;
      case 'comp_cap': out.push(`仲間の上限${sign(v)}`); break;
      case 'occ_food': out.push(`職能を出す食料${sign(v)}`); break;
      case 'two_hand_armor': out.push('両手武器を持っても防具を持てる'); break;
      case 'rage': out.push(`反撃で負傷しない。負傷する分を怒りとしてため（${v}まで）、次の戦闘の戦力に足す`); break;
      case 'no_atk_train': out.push('攻めの熟練を上げられない'); break;
      case 'tool_yield': out.push(`道具の効果で資源を得るとき、いちばん多い資源+${v}`); break;
      case 'leader_no_weapon': out.push('リーダーは武器を持てない'); break;
    }
  }
  return out.join('。');
}

const LIMIT_JP: Record<string, string> = { round: '（ラウンド1回）', year: '（1年に1回）', game: '（1試合に1回）' };
export function effectJP(e: Effect): string {
  if (e.when === 'passive') { const c = condJP(e.if); return (c ? `${c}なら、` : '') + modJP(e.mod ?? {}); }
  const w = whenJP(e.when);
  const c = condJP(e.if);
  const body = opsJP(e.do);
  const head = e.when === 'play' ? '唱えると' : w;
  const end = e.when === 'game_end' ? '（名声は年数の倍率）' : '';
  return `${head}${c ? `（${c}）` : ''}${head ? '、' : ''}${body}${LIMIT_JP[e.limit ?? ''] ?? ''}${end}`;
}

/** カードの説明文（費用以外。費用は画面が別に出す） */
export function cardText(c: CardDef): string {
  const out: string[] = [];
  if (c.two_hand) out.push('両手持ち');
  if (c.leader_only) out.push('リーダーだけが持てる');
  if (c.power) out.push(`戦力${sign(c.power)}`);
  if (c.guard) out.push(`守り${sign(c.guard)}`);
  if (c.fame) out.push(`名声${c.fame}`);
  if (c.tome) out.push(`身につける：${costText(c.tome.learn) || 'なし'}。1手番に${c.tome.uses}回まで、魔石を払って唱える`);
  else if (c.kind === 'spell') out.push('使い切り（使ったら山の下へ）');
  if (c.mods) out.push(modJP(c.mods));
  for (const e of c.effects) out.push(effectJP(e));
  return out.filter(Boolean).join('。') + '。';
}

/** text が空のカードに説明文を入れる */
export function withText<T extends CardDef>(cs: T[]): T[] {
  for (const c of cs) if (!c.text) c.text = cardText(c);
  return cs;
}
