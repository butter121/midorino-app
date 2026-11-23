// 霧谷 v2：リストどおりのカード（試合の途中で、置く手・戦闘・ラウンドの始めの処理まで通す）
import { describe, expect, it } from 'vitest';
import { LEAD } from '../src/kiridani2/engine';
import { AI, CARD_SET, DATA, Game, autoAnswer, type Gen, type Option, type Player, type Req } from '../src/kiridani2/index';

/** 席0（人）の最初の手番まで進めた試合。資源は多めに持たせる */
function atTurn(n = 3, leader?: keyof typeof LEAD) {
  for (let seed = 7; seed < 80; seed++) {
    const g = new Game(n, [null, ...Array.from({ length: n - 1 }, (_, i) => new AI('normal', { seed: i + 1 }))], { seed, cards: CARD_SET });
    const gen = g.play();
    let r = gen.next();
    while (!r.done && !(r.value.k === 'choose' && r.value.p.pid === 0)) r = gen.next(autoAnswer(r.value));
    const p = g.players[0];
    // 大物狩り山田は両手武器しか持てないので、装備を試すときは別のリーダーの試合にする
    if (leader ? !g.is(p, leader) : g.is(p, 'giant')) continue;
    return ready(g);
  }
  throw new Error(`リーダー ${leader ?? '山田以外'} の試合が見つからない`);
}
function ready(g: Game) {
  const p = g.players[0], q = g.players[1];
  for (const x of [p, q]) for (const k of ['wood', 'iron', 'herb', 'food', 'mana', 'mat', 'gold'] as const) x.res[k] = 10;
  return { g, p, q };
}
/** 問いに answer で答えながら最後まで回す（undefined なら既定の答え：はい・最初の選択肢） */
function run<T>(gen: Gen<T>, answer: (r: Req) => unknown = () => undefined): T {
  let r = gen.next();
  while (!r.done) {
    const req = r.value;
    const a = answer(req);
    r = gen.next(a !== undefined ? a : req.k === 'effect' ? true : req.k === 'pick' ? req.options[0] : req.k === 'card' ? req.cards[0] : autoAnswer(req));
  }
  return r.value;
}
const find = (g: Game, p: Player, f: (o: Option) => boolean) => g.legal(p).find(f);
const mon = (g: Game, str = 3) => { const m = g.rollMonster(DATA.MON.wolf, 3, g.year()); m.str = str; m.counter = 0; m.loot = { food: 2 }; return m; };

describe('霧谷 v2：リストどおりのカード（試合の中で）', () => {
  it('瞑想家：仲間1人を休ませるとマナ鉱石2（ラウンドに1回）', () => {
    const { g, p } = atTurn();
    expect(find(g, p, (o) => o.s === '@rest')).toBeUndefined();
    p.occs.push('o_mn5');
    const o = find(g, p, (x) => x.s === '@rest')!;
    expect(o).toBeTruthy();
    const mana = p.res.mana, free = p.free().length;
    run(g.apply(p, o));
    expect(p.res.mana).toBe(mana + 2);
    expect(p.free().length).toBe(free - 1);
    expect(find(g, p, (x) => x.s === '@rest')).toBeUndefined();
  });

  it('道場：ほかの人がいても自分だけの訓練のマスに置ける（ラウンドに1回）', () => {
    const { g, p, q } = atTurn();
    const sp = g.space('training')!;
    sp.occ.push(q.pid);
    p.tools.push('t_jn1');
    const o = find(g, p, (x) => x.s === 'training' && x.own === 'training');
    expect(o).toBeTruthy();
    run(g.apply(p, o!));
    expect(find(g, p, (x) => x.s === 'training' && x.own === 'training')).toBeUndefined();
  });

  it('市の屋台：ほかの人は金貨で資源を買える（取引とは別）', () => {
    const { g, p, q } = atTurn();
    q.tools.push('t_mi5');
    const o = find(g, p, (x) => x.s === '@stall' && x.i === q.pid && typeof x.x === 'object' && x.x.m === 'buy' && x.x.r === 'iron' && x.x.q === 2)!;
    expect(o).toBeTruthy();
    const [pg, qg, qi] = [p.res.gold, q.res.gold, q.res.iron];
    run(g.apply(p, o));
    expect([p.res.gold, q.res.gold, q.res.iron]).toEqual([pg - 2, qg + 2, qi - 2]);
    expect(find(g, p, (x) => x.s === '@stall' && x.i === q.pid)).toBeUndefined();
    expect(p.tradesUsed).toBe(0);
  });

  it('金貸し：金貨3を貸し、2ラウンド後に金貨4が戻る。返せなければ名声−2', () => {
    const { g, p, q } = atTurn();
    p.occs.push('o_mi4');
    const o = find(g, p, (x) => x.s === '@act' && x.card === 'o_mi4')!;
    run(g.apply(p, o), (r) => (r.k === 'pick' ? `pl:${q.pid}` : undefined));
    expect(g.loans).toHaveLength(1);
    expect(find(g, p, (x) => x.s === '@act' && x.card === 'o_mi4')).toBeUndefined();
    q.res.gold = 0;
    const fame = q.fame.effect, pg = p.res.gold;
    g.round = g.loans[0].due;
    run(g.startRound());
    expect(q.fame.effect).toBe(fame - 2);
    expect(p.res.gold).toBe(pg);
    expect(g.loans).toHaveLength(0);
  });

  it('落とし穴：印をつけた巣の魔物と、ほかの人は戦えない', () => {
    const { g, p, q } = atTurn();
    const nd = g.nests[0];
    nd.mon = mon(g); nd.groups = 0;
    p.tools.push('t_ha4');
    const o = find(g, p, (x) => x.s === '@act' && x.card === 't_ha4')!;
    run(g.apply(p, o), (r) => (r.k === 'pick' ? `rsv:${nd.id}` : undefined));
    expect(g.reserveOk(q, nd.mon)).toBe(false);
    expect(g.legal(q).some((x) => x.s === nd.id)).toBe(false);
    expect(g.legal(p).some((x) => x.s === nd.id)).toBe(true);
  });

  it('抜け道：ほかの人がいるマスにも置けて、その人と取引を1回', () => {
    const { g, p, q } = atTurn();
    const sp = g.spaces.find((s) => !s.def.accum && s.id !== 'plaza' && s.id !== 'training' && (s.def.cap ?? 1) === 1 && g.legal(p).some((x) => x.s === s.id))!;
    expect(sp).toBeTruthy();
    sp.occ.push(q.pid);
    expect(g.legal(p).some((x) => x.s === sp.id)).toBe(false);
    p.tools.push('t_mo3');
    const o = find(g, p, (x) => x.s === sp.id)!;
    expect(o).toBeTruthy();
    run(g.apply(p, o));
    expect(g.flag(p, `r:tw:${q.pid}`)).toBe(1);
    expect(g.tradesLeft(p)).toBe(g.tradeLimit(p) - p.tradesUsed + 1);
    g.trade(p, q, { wood: 1 }, { iron: 1 });
    expect(g.flag(p, `r:tw:${q.pid}`)).toBe(0);
  });

  it('種まき人・根こそぎの採集人：たまるマスに1つ残す／ほかのたまるマスから1つ取る', () => {
    const { g, p } = atTurn();
    const acc = g.spaces.filter((s) => s.def.accum);
    const [a, b] = acc;
    b.stock = { ...b.stock, [Object.keys(b.def.accum!)[0]]: 3 };
    p.occs.push('o_po4', 'o_po5');
    a.stock = {};
    run(g.fire(p, 'use:any_accum', { space: a.id }), (r) => (r.k === 'pick' ? r.options.find((x) => x === `acc:${b.id}`) : undefined));
    const ra = Object.keys(a.def.accum!)[0] as keyof typeof a.stock, rb = Object.keys(b.def.accum!)[0] as keyof typeof b.stock;
    expect(a.stock[ra]).toBe(1);
    expect(b.stock[rb]).toBe(2);
  });

  it('豊作・黄金の手：次に使うたまるマスの資源+1／2倍', () => {
    const { g, p } = atTurn();
    const sp = g.spaces.find((s) => s.def.accum && g.legal(p).some((x) => x.s === s.id))!;
    const r = Object.keys(sp.def.accum!)[0] as 'wood';
    sp.stock = { [r]: 2 };
    g.addFlag(p, 'accum+'); g.addFlag(p, 'accum2x');
    const before = p.res[r];
    run(g.apply(p, find(g, p, (x) => x.s === sp.id)!));
    expect(p.res[r] - before).toBeGreaterThanOrEqual(6);
    expect(p.flags['accum+']).toBeUndefined();
  });

  it('複製の術：作った道具を1つ複製する', () => {
    const { g, p } = atTurn();
    p.tools.push('t_ak5');
    p.hand.push('s_ka4');
    run(g.playSpell(p, 's_ka4', 0));
    expect(p.tools.filter((x) => x === 't_ak5')).toHaveLength(2);
  });

  it('突貫大工：ラウンドの始めに防壁を2つまで（2つ目は木材+1）', () => {
    const { g, p } = atTurn();
    p.occs.push('o_go3');
    const w = p.walls, wood = p.res.wood;
    run(g.fire(p, 'round_start', {}));
    expect(p.walls).toBe(w + 2);
    expect(wood - p.res.wood).toBe(2 * (DATA.WALL_COST.wood ?? 0) + 1);
  });

  it('工房長：工房で道具を2つ（2つ目は資源+2）。出張職人：工房以外でも年1回', () => {
    const { g, p } = atTurn();
    p.occs.push('o_ka2');
    p.hand.push('t_ak5', 't_ak1');
    const o = find(g, p, (x) => x.s === 'workshop' && x.x === 't_ak5')!;
    expect(o).toBeTruthy();
    run(g.apply(p, o));
    expect(p.tools.filter((x) => x === 't_ak5' || x === 't_ak1').length).toBe(2);
    const { g: g2, p: p2 } = atTurn();
    p2.occs.push('o_ka4');
    p2.hand.push('t_ak5');
    const o2 = find(g2, p2, (x) => x.s === 'forest')!;
    run(g2.apply(p2, o2));
    expect(p2.tools).toContain('t_ak5');
  });

  it('投資家：年の始めに金貨を預け、次の年の始めに1.5倍で戻る', () => {
    const { g, p } = atTurn();
    p.occs.push('o_mi3');
    run(g.fire(p, 'round_start', {}), (r) => (r.k === 'pick' && r.what === 'invest' ? 'gold:4' : undefined));
    expect(g.flag(p, 'dep:o_mi3')).toBe(4);
    const gold = p.res.gold;
    run(g.fire(p, 'round_start', {}), (r) => (r.k === 'pick' && r.what === 'invest' ? r.options[0] : undefined));
    expect(p.res.gold).toBeGreaterThanOrEqual(gold + 6 - 10);
    expect(p.res.gold - gold + g.flag(p, 'dep:o_mi3')).toBe(6);
  });

  it('天秤：交換所の交換で受け取る数+1（1ラウンド1回）。値切り：金貨で払うとき−3', () => {
    const { g, p } = atTurn();
    p.tools.push('t_mi4');
    const w = p.res.wood;
    run(g.runOps(p, [{ exchange: true }], { x: { m: 'buy', r: 'wood', q: 1 } }));
    expect(p.res.wood).toBe(w + 2);
    run(g.runOps(p, [{ exchange: true }], { x: { m: 'buy', r: 'wood', q: 1 } }));
    expect(p.res.wood).toBe(w + 3);
    g.addFlag(p, 'goldcut', 3);
    expect(g.goldPlan(p, { gold: 4 }, {}, true)).toEqual({ gold: 1 });
  });

  it('二度斬り：勝ったときの武器の効果がもう一度起きる', () => {
    const { g, p } = atTurn();
    p.items.push('w_ak1'); g.equip(p, 0, 'weapon', 'w_ak1');
    p.hand.push('s_ak2');
    g.forceFate = 3;
    const m = mon(g, 1);
    const pl = g.makePlan(p, m, [0], 'normal', false, 1, ['s_ak2#0']);
    expect(pl.again).toBe(1);
    const tro = p.trophies;
    run(g.resolve(m, [p], [pl], false));
    // 魔物の証＋武勲の短剣2回
    expect(p.trophies - tro).toBe(Math.max(1, Math.round(m.trophy)) + 2);
  });

  it('追撃：勝ったあと、同じ仲間でほかの巣の魔物とも戦える', () => {
    const { g, p } = atTurn();
    g.forceFate = 3;
    const [n1, n2] = g.nests;
    n1.mon = mon(g, 1); n2.mon = mon(g, 1); n1.groups = 0; n2.groups = 0; n1.wait = null; n2.wait = null;
    g.addFlag(p, 'r:chase', 1, 1);
    const o = find(g, p, (x) => x.s === n1.id && x.mode === 'normal' && !x.join)!;
    run(g.apply(p, o), (r) => (r.k === 'pick' && r.what === 'chase' ? `chase:${n2.id}` : undefined));
    expect(n1.mon).toBeNull();
    expect(n2.mon).toBeNull();
  });

  it('運命返し：負けそうなら運命カードを引き直す（マナ鉱石を払う）', () => {
    const { g, p } = atTurn();
    p.tomes.push('s_ak5');
    g.forceFate = 0;
    const m = mon(g, 50);
    const pl = g.makePlan(p, m, [0], 'normal', false, 50, []);
    let asked = false;
    const mana = p.res.mana;
    run(g.resolve(m, [p], [pl], false), (r) => (r.k === 'effect' && r.when === 'fate' ? ((asked = true), true) : undefined));
    expect(asked).toBe(true);
    expect(p.res.mana).toBeLessThanOrEqual(mana);
    expect(p.tomeUses.s_ak5).toBe(1);
  });

  it('算盤の棍：戦利品を価値の表どおりに金貨で受け取れる', () => {
    const { g, p } = atTurn();
    p.items.push('w_mi2'); g.equip(p, 0, 'weapon', 'w_mi2');
    g.forceFate = 3;
    const m = mon(g, 1);
    const pl = g.makePlan(p, m, [0], 'normal', false, 1, []);
    const gold = p.res.gold, food = p.res.food;
    run(g.resolve(m, [p], [pl], false), (r) => (r.k === 'pick' && r.what === 'loot' ? r.options[1] : undefined));
    expect(p.res.gold).toBeGreaterThan(gold);
    expect(p.res.food).toBe(food);
  });

  it('手柄の独り占め・盾の誓い：共闘でほかの人の戦力を半分に数える／相手の守りを足す', () => {
    const { g, p, q } = atTurn();
    const a = g.makePlan(p, mon(g), [0], 'normal', true, 9, []); a.hog = true;
    const b = g.makePlan(q, mon(g), [0], 'normal', true, 9, []);
    expect(g.sharePow(b, [a, b])).toBe(b.power / 2);
    expect(g.sharePow(a, [a, b])).toBe(a.power);
    p.hand.push('s_ga4');
    const m = mon(g, 40); m.counter = 0;
    const c = g.makePlan(p, m, [0], 'normal', true, 40, ['s_ga4#0']);
    expect(c.allyGuard).toBe(true);
    const d = g.makePlan(q, m, [0], 'normal', true, 40, []);
    const g0 = c.guard;
    g.forceFate = 0;
    run(g.resolve(m, [p, q], [c, d], false));
    expect(c.guard).toBe(g0 + g.defenseOf(q, [0]));
  });

  it('竜騎士の鎧：主を使い魔にでき、参加した全員が倒した扱い', () => {
    const { g, p, q } = atTurn();
    p.items.push('a_ha5'); g.equip(p, 0, 'armor', 'a_ha5');
    const boss = g.rollMonster(DATA.MON.wolf, 3, g.year(), 'boss');
    boss.str = 2; boss.counter = 0; boss.race = 'beast';
    g.bossOf[g.round] = boss;
    p.res.food = 99; p.res.gold = 99;
    for (const r of ['wood', 'iron', 'herb', 'mana', 'mat'] as const) p.res[r] = 99;
    const opt = g.legal(p).find((x) => x.s === 'lair' && x.mode === 'capture');
    expect(opt).toBeTruthy();
    g.lairQ = [{ pid: p.pid, idxs: [0], mode: 'capture' }, { pid: q.pid, idxs: [0], mode: 'normal' }];
    g.forceFate = 3;
    const pets = p.pets.length, kq = q.kills;
    run(g.resolveLair());
    expect(p.pets.length).toBe(pets + 1);
    expect(q.kills).toBe(kq + 1);
  });

  it('誘いの笛：巣で戦う前に次の魔物と入れ替えられる', () => {
    const { g, p } = atTurn();
    const nd = g.nests[0];
    nd.mon = mon(g, 9); nd.groups = 0; nd.wait = null;
    const nx = mon(g, 1);
    g.forecastQ = [nx];
    p.items.push('w_ha2'); g.equip(p, 0, 'weapon', 'w_ha2');
    g.forceFate = 3;
    const o = find(g, p, (x) => x.s === nd.id && x.mode === 'normal' && !x.join)!;
    run(g.apply(p, o), (r) => (r.k === 'pick' && r.what === 'peek' ? `peek:swap:${nd.id}` : undefined));
    expect(g.forecastQ[0].str).toBe(9);
    expect(nd.mon).toBeNull();
  });

  it('連携の双剣：共闘で勝つと送った仲間全員の熟練+1。伝承の羽織：上がった熟練をほかの仲間にも', () => {
    const { g, p, q } = atTurn();
    p.items.push('w_jn3'); g.equip(p, 0, 'weapon', 'w_jn3');
    g.forceFate = 3;
    const m = mon(g, 1);
    const a = g.makePlan(p, m, [0, 1], 'normal', true, 1, []), b = g.makePlan(q, m, [0], 'normal', true, 1, []);
    const sk = p.comps[0].atk + p.comps[0].def + p.comps[1].atk + p.comps[1].def;
    run(g.resolve(m, [p, q], [a, b], false));
    expect(p.comps[0].atk + p.comps[0].def + p.comps[1].atk + p.comps[1].def).toBe(sk + 2);
    const { g: g2, p: p2 } = atTurn();
    p2.comps.forEach((c) => { c.atk = 0; c.def = 0; });
    p2.items.push('a_jn3'); g2.equip(p2, 0, 'armor', 'a_jn3');
    run(g2.runOps(p2, [{ train: 'atk' }], { x: 'atk' }));
    expect(p2.comps.reduce((s, c) => s + c.atk, 0)).toBe(2);
  });

  it('伝授：仲間1人の熟練をもう1人に写す', () => {
    const { g, p } = atTurn();
    p.comps[0].atk = 2; p.comps[0].def = 1; p.comps[1].atk = 0; p.comps[1].def = 0;
    run(g.runOps(p, [{ skill_copy: true }], {}), (r) => (r.k === 'pick' && r.what === 'copy_from' ? 'tr:0' : r.k === 'pick' && r.what === 'copy_to' ? 'tr:1' : undefined));
    expect([p.comps[1].atk, p.comps[1].def]).toEqual([2, 1]);
  });

  it('薬膳の修行僧：熟練を上げる食料を薬草で払える。守りの自主練：食料なしで守り+1（2ラウンドに1回）', () => {
    const { g, p } = atTurn();
    p.occs.push('o_jn3');
    p.res.food = 0;
    expect(g.legal(p).some((x) => x.s === 'training')).toBe(true);
    const { g: g2, p: p2 } = atTurn();
    p2.occs.push('o_ga5');
    p2.res.food = 0;
    const o = g2.legal(p2).find((x) => x.s === 'training' && x.card === 'o_ga5');
    expect(o).toBeTruthy();
  });

  it('時の砂：遺物を3枚見て1枚取り、すぐに費用−2で直せる。鑑定：山の上3枚を並べ替える', () => {
    const { g, p } = atTurn();
    const top = g.decks.ancient.slice(0, 3);
    run(g.runOps(p, [{ relic_sort: 3 }], {}), (r) => (r.k === 'card' && r.why === 'sort' ? r.cards[r.cards.length - 1] : undefined));
    expect(g.decks.ancient.slice(0, 3).sort()).toEqual([...top].sort());
    expect(g.decks.ancient[0]).toBe(top[2]);
    const n = p.ancient.length;
    run(g.runOps(p, [{ relic_fix: { look: 3, cut: 2 } }], {}));
    expect(p.ancient.length + p.broken.length).toBeGreaterThan(n);
  });

  it('捕獲網の投げ槍：使い魔にした魔物の戦利品も受け取る。好物の香り：このラウンド費用−2', () => {
    const { g, p } = atTurn();
    const m = mon(g); m.race = 'beast';
    const n0 = Object.values(g.captureCost(m, p))[0] ?? 0;
    g.addFlag(p, 'r:capcut', 2);
    expect(Object.values(g.captureCost(m, p))[0] ?? 0).toBe(Math.max(0, n0 - 2));
    p.items.push('w_ha4'); g.equip(p, 0, 'weapon', 'w_ha4');
    const food = p.res.food;
    const pay = g.capturePay(p, m)!;
    run(g.addPet(p, m));
    expect(p.res.food).toBe(food - (pay.food ?? 0) + 2);
  });

  it('多種の紋章・つがいの小屋：使い魔の種類・同じ種類を数える', () => {
    const { g, p } = atTurn();
    p.pets = [{ type: 'wolf', name: '', str: 1, power: 1, card: '' }, { type: 'wolf', name: '', str: 1, power: 1, card: '' }, { type: 'boar', name: '', str: 1, power: 1, card: '' }];
    expect(g.stat(p, 'pet_types')).toBe(2);
    expect(g.stat(p, 'pet_same')).toBe(2);
  });

  it('重さ消し：次に作る両手武器の魔石の段階を1つ下げる', () => {
    const { g, p } = atTurn();
    const w = CARD_SET.weapons.find((c) => c.two_hand && c.weight === 'heavy')!;
    const t = g.stoneNeed(w.id, p)!;
    g.addFlag(p, 'stone2h', 1, 1);
    expect(g.stoneNeed(w.id, p)).toBe(t - 1);
  });

  it('留守番の上着：戦闘に出なかったラウンドの終わりに木材1', () => {
    const { g, p } = atTurn();
    p.items.push('a_go1'); g.equip(p, 0, 'armor', 'a_go1');
    const w = p.res.wood;
    run(g.fire(p, 'round_end', {}));
    expect(p.res.wood).toBe(w + 1);
    p.st.fightsRound = 1;
    run(g.fire(p, 'round_end', {}));
    expect(p.res.wood).toBe(w + 1);
  });

  it('口八丁：押し売りモモは、同じ価値から出す資源を1つ少なくできる（1ラウンド1回）', () => {
    const { g, p, q } = atTurn();
    p.leader = LEAD.swindler;
    p.occs = p.occs.filter((x) => x !== 'o_mo1');
    expect(g.tradeOk(p, q, { wood: 1 }, { iron: 2 })).not.toBeNull();
    p.occs.push('o_mo1');
    expect(g.tradeOk(p, q, { wood: 1 }, { iron: 2 })).toBeNull();
    g.trade(p, q, { wood: 1 }, { iron: 2 });
    expect(g.tradeOk(p, q, { wood: 1 }, { iron: 2 })).not.toBeNull();
  });
});
