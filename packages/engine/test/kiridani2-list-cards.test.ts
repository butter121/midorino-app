// 霧谷 v2：リストの効果どおりに動くか（前は近い効果で代わりにしていたカード）
import { describe, expect, it } from 'vitest';
import { AI, CARD_SET, DATA, Game, drive, type Gen, type Player, type Req } from '../src/kiridani2/index';

function bare(n = 2) {
  const g = new Game(n, [null, ...Array.from({ length: n - 1 }, (_, i) => new AI('normal', { seed: i + 1 }))], { seed: 1, cards: CARD_SET });
  const p = g.players[0];
  p.comps = [0, 1, 2].map((i) => ({ atk: 0, def: 0, weapon: null, armor: null, weapon2: null, armor2: null, leader: i === 0, injured: false, rest: false, used: false }));
  for (const r of ['wood', 'iron', 'herb', 'food', 'mana', 'mat', 'gold'] as const) p.res[r] = 10;
  return { g, p, q: g.players[1] };
}
/** 問いに answer で答えながら最後まで回す（answer が undefined を返したら既定の答え） */
function run<T>(gen: Gen<T>, answer: (r: Req) => unknown = () => undefined): T {
  let r = gen.next();
  while (!r.done) {
    const a = answer(r.value);
    if (a === undefined) {
      const req = r.value;
      r = gen.next(req.k === 'effect' ? true : req.k === 'pick' ? req.options[0] : req.k === 'card' ? req.cards[0] : drive((function* () { return yield req; })()));
    } else r = gen.next(a);
  }
  return r.value;
}
const opsOf = (id: string, i = 0) => CARD_SET.spells.concat(CARD_SET.tools, CARD_SET.occupations, CARD_SET.weapons, CARD_SET.armors).find((c) => c.id === id)!.effects[i];

describe('霧谷 v2：リストどおりのカード', () => {
  it('魔石の闇商人：交換所で魔石を1安く買える', () => {
    const { g, p } = bare();
    const before = g.expand(p, [{ exchange: true }]).filter((x) => typeof x === 'object' && x && 'm' in x && x.m === 'stone' && x.dir === 'buy');
    expect(before.map((x) => (x as { q: number }).q)).toContain(2);
    p.occs.push('o_mo5');
    const after = g.expand(p, [{ exchange: true }]).filter((x) => typeof x === 'object' && x && 'm' in x && x.m === 'stone' && x.dir === 'buy') as { tier: number; q: number }[];
    expect(after.filter((x) => x.tier === 0).every((x) => x.q === 1)).toBe(true);
    expect(after.filter((x) => x.tier === 2).every((x) => x.q === 5)).toBe(true);
    expect(CARD_SET.occupations.find((c) => c.id === 'o_mo5')!.text).toBe('交換所で魔石を1安く買うことができる。');
  });

  it('二刀の心得：軽い武器を2本持てる。剣帯：着た仲間は武器をもう1本', () => {
    const { g, p } = bare();
    p.items.push('w_ak1', 'w_ha1', 'w_ak4');
    g.equip(p, 0, 'weapon', 'w_ak1');
    expect(g.equipError(p, 0, 'weapon2', 'w_ha1')).not.toBeNull();
    p.occs.push('o_ak3');
    expect(g.equipError(p, 0, 'weapon2', 'w_ha1')).toBeNull();
    expect(g.equipError(p, 0, 'weapon2', 'w_ak4')).not.toBeNull(); // 中くらいの武器は二刀にできない
    g.equip(p, 0, 'weapon2', 'w_ha1');
    expect(g.compWeaponPower(p, p.comps[0])).toBe(2);
    const { g: g2, p: p2 } = bare();
    p2.items.push('w_ak4', 'w_ak3', 'a_ak1');
    g2.equip(p2, 1, 'weapon', 'w_ak4');
    expect(g2.equipError(p2, 1, 'weapon2', 'w_ak3')).not.toBeNull();
    g2.equip(p2, 1, 'armor', 'a_ak1');
    g2.equip(p2, 1, 'weapon2', 'w_ak3');
    expect(p2.comps[1].weapon2).toBe('w_ak3');
    // 剣帯をはずすと2本目は倉庫へ
    g2.equip(p2, 1, 'armor', null);
    expect(p2.comps[1].weapon2).toBeNull();
  });

  it('重装の心得：軽い防具をもう1つ', () => {
    const { g, p } = bare();
    p.items.push('a_ak2', 'a_ak4', 'a_jn2');
    p.occs.push('o_ga2');
    g.equip(p, 0, 'armor', 'a_ak4');
    expect(g.equipError(p, 0, 'armor2', 'a_jn2')).toBeNull();
    g.equip(p, 0, 'armor2', 'a_jn2');
    expect(g.defenseOf(p, [0])).toBe(g.defenseOf(p, []) + 1 + 1 + 1);
  });

  it('連鎖詠唱：次の秘術は費用なし。詠唱短縮：ラウンド最初の秘術−1', () => {
    const { g, p } = bare();
    p.hand.push('s_mn3', 's_mo5');
    run(g.playSpell(p, 's_mn3', 0));
    expect(g.spellCost(p, 's_mo5')).toEqual({});
    const mana = p.res.mana;
    run(g.playSpell(p, 's_mo5', 0));
    expect(p.res.mana).toBe(mana);
    expect(p.flags.free_spell).toBeUndefined();
    const { g: g2, p: p2 } = bare();
    p2.occs.push('o_mn1');
    expect(g2.spellCost(p2, 's_mo5')).toEqual({ mana: 1 });
    expect(g2.spellCost(p2, 's_mo5', 1)).toEqual({ mana: 2 });
  });

  it('薬草の護符：秘術の費用を薬草2でマナ1として払える', () => {
    const { g, p } = bare();
    p.res.mana = 0;
    p.items.push('a_mn2');
    g.equip(p, 0, 'armor', 'a_mn2');
    expect(g.manaPlan(p, { mana: 2 }, {})).toEqual({ herb: 4 });
  });

  it('籠城：この冬の食料がいらない', () => {
    const { g, p } = bare();
    p.res.food = 0;
    g.addFlag(p, 'no_upkeep');
    run(g.winter());
    expect(p.discontent).toBe(0);
    expect(p.flags.no_upkeep).toBeUndefined();
  });

  it('城壁の盾：防壁1つとして数える', () => {
    const { g, p } = bare();
    const w = g.wallsOf(p), h = g.homeGuard(p);
    p.items.push('a_go5');
    g.equip(p, 0, 'armor', 'a_go5');
    expect(g.wallsOf(p)).toBe(w + 1);
    expect(g.homeGuard(p)).toBe(h + 1);
  });

  it('修復師：修復の素材1つを金貨2で払える。復元の術：名声4以下を費用なしで', () => {
    const { g, p } = bare();
    const anc = [...g.anc.values()].find((a) => (a.repair.mat ?? 0) > 0 && a.fame <= 4)!;
    p.broken.push(anc.id);
    p.occs.push('o_is2');
    const vs = g.repairVariants(p, anc.id);
    expect(vs.some((v) => v.key.endsWith('!g') && v.cost.gold === (anc.repair.gold ?? 0) + 2 && (v.cost.mat ?? 0) === (anc.repair.mat ?? 0) - 1)).toBe(true);
    const gold = p.res.gold, mat = p.res.mat;
    run(g.runOps(p, [{ repair_free: 4 }], { x: `fix0:${anc.id}` }));
    expect(p.ancient).toContain(anc.id);
    expect([p.res.gold, p.res.mat]).toEqual([gold, mat]);
  });

  it('偽の立て札・交換所の出禁：ほかの人はそのマスを使えない', () => {
    const { g, p, q } = bare();
    run(g.runOps(p, [{ block: 'any' }], { x: 'blk:forest' }));
    expect(g.spaceBanned(q, 'forest')).toBe(true);
    expect(g.spaceBanned(p, 'forest')).toBe(false);
    run(g.runOps(p, [{ market_ban: true }], { x: `pl:${q.pid}` }));
    expect(g.marketBan[q.pid]).toBe(g.round + 1);
  });

  it('盗み見：相手の手札1枚を山に戻させる', () => {
    const { g, p, q } = bare();
    q.hand = ['s_mo5', 's_mo4'];
    run(g.runOps(p, [{ peek_discard: true }], { x: `pl:${q.pid}` }), (r) => (r.k === 'card' ? 's_mo4' : undefined));
    expect(q.hand).toEqual(['s_mo5']);
  });

  it('市場操作：このラウンド好きな資源の価値+1。買い占め：その資源をほかの人は買えない', () => {
    const { g, p, q } = bare();
    run(g.runOps(p, [{ value_up: true }], { x: 'val:iron' }));
    expect(g.val('iron')).toBe(2);
    run(g.runOps(p, [{ buy_ban: true }], { x: 'ban:wood' }));
    const qb = g.expand(q, [{ exchange: true }]).some((x) => typeof x === 'object' && x && 'm' in x && x.m === 'buy' && x.r === 'wood');
    expect(qb).toBe(false);
  });

  it('調教の鞭：好物の数−1（1ラウンド1回）。獣の通訳：好物でない資源2つで好物1つ', () => {
    const { g, p } = bare();
    const mon = g.rollMonster(DATA.MON.wolf, 3, 1);
    const base = g.captureCost(mon, p);
    const n0 = Object.values(base)[0] ?? 0;
    p.items.push('w_ha1');
    g.equip(p, 0, 'weapon', 'w_ha1');
    const n1 = Object.values(g.captureCost(mon, p))[0] ?? 0;
    expect(n1).toBe(Math.max(1, n0 - 1));
    g.addFlag(p, 'r:favcut');
    expect(Object.values(g.captureCost(mon, p))[0] ?? 0).toBe(n0);
    const { g: g2, p: p2 } = bare();
    const c = g2.captureCost(mon, p2);
    const [r] = Object.keys(c) as ('food')[];
    p2.res[r] = 0;
    expect(g2.capturePay(p2, mon)).toBeNull();
    p2.occs.push('o_ha2');
    const pay = g2.capturePay(p2, mon)!;
    expect(Object.values(pay).reduce((a, b) => a + (b ?? 0), 0)).toBe((c[r] ?? 0) * 2);
  });

  it('未完の大作：工房のたびに資源2つで印1、印×2の名声（最大10）', () => {
    const { g, p } = bare();
    p.tools.push('t_ka4');
    for (let i = 0; i < 7; i++) run(g.fire(p, 'use:workshop', { space: 'workshop' }));
    expect(p.flags['mk:t_ka4']).toBe(5);
    const fame = p.fame.effect;
    run(g.fire(p, 'game_end', {}));
    expect(p.fame.effect - fame).toBe(10);
  });

  it('夜なべ：このラウンド工房を使うと名声+2', () => {
    const { g, p } = bare();
    p.hand.push('s_ka5');
    run(g.playSpell(p, 's_ka5', 0));
    const fame = p.fame.effect;
    run(g.fire(p, 'use:workshop', { space: 'workshop' }));
    expect(p.fame.effect - fame).toBe(2);
  });

  it('連勝の兜：勝った次の戦闘は戦力+1', () => {
    const { g, p } = bare();
    p.items.push('a_ak3');
    g.equip(p, 0, 'armor', 'a_ak3');
    const mon = g.rollMonster(DATA.MON.wolf, 3, 1);
    const a = g.makePlan(p, mon, [0], 'normal', false, 99, []).power;
    p.st.lastWin = 1;
    expect(g.makePlan(p, mon, [0], 'normal', false, 99, []).power).toBe(a + 1);
  });

  it('覚醒：この戦闘だけ熟練+2（努力家は3倍）', () => {
    const { g, p } = bare();
    p.hand.push('s_jn1');
    const mon = g.rollMonster(DATA.MON.wolf, 3, 1);
    const a = g.makePlan(p, mon, [0], 'normal', false, 99, []).power;
    const pl = g.makePlan(p, mon, [0], 'normal', false, 99, ['s_jn1#0']);
    expect(pl.power).toBe(a + 2 * g.skillMult(p));
  });

  it('総力戦：この戦闘に仲間をもう1人送れる', () => {
    const { g, p } = bare();
    const c = g.sendCap(p);
    g.addFlag(p, 'r:send', 1, 1);
    expect(g.sendCap(p)).toBe(c + 1);
  });

  it('上前はね：取引で受け取った鉄かマナ鉱石をさらに1つ', () => {
    const { g, p, q } = bare();
    p.occs.push('o_mo4');
    q.res.iron = 5;
    const iron = p.res.iron;
    run(g.tradeGen(p, q, { wood: 1 }, { iron: 1 }));
    expect(p.res.iron).toBe(iron + 2);
  });
  it('鍛え直しの炉：武器に戦力+1の印（1本に2つまで）。大剣使い：両手武器の戦力+1', () => {
    const { g, p } = bare();
    p.items.push('w_ak4'); g.equip(p, 1, 'weapon', 'w_ak4');
    const a = g.compWeaponPower(p, p.comps[1]);
    run(g.runOps(p, [{ mark_weapon: 2 }], { x: 'mk:w_ak4' }));
    run(g.runOps(p, [{ mark_weapon: 2 }], { x: 'mk:w_ak4' }));
    run(g.runOps(p, [{ mark_weapon: 2 }], { x: 'mk:w_ak4' }));
    expect(g.compWeaponPower(p, p.comps[1])).toBe(a + 2);
    const { g: g2, p: p2 } = bare();
    p2.items.push('w_ak5'); g2.equip(p2, 1, 'weapon', 'w_ak5');
    const b = g2.compWeaponPower(p2, p2.comps[1]);
    p2.occs.push('o_ya1');
    expect(g2.compWeaponPower(p2, p2.comps[1])).toBe(b + 1);
  });

  it('固い構え：送った仲間の守りが5以上なら反撃−1', () => {
    const { g, p } = bare();
    p.occs.push('o_ga3');
    const m = g.rollMonster(DATA.MON.wolf, 3, 1);
    const lo = g.makePlan(p, m, [0], 'normal', false, 99, []).counter;
    p.comps[0].def = 2; p.items.push('a_ak5'); g.equip(p, 0, 'armor', 'a_ak5');
    expect(g.defenseOf(p, [0])).toBeGreaterThanOrEqual(5);
    expect(g.makePlan(p, m, [0], 'normal', false, 99, []).counter).toBe(lo - 1);
  });

  it('護衛の鎧：負傷を治す薬草が足りなければ金貨2で払える', () => {
    const { g, p } = bare();
    p.res.herb = 0;
    expect(g.healPlan(p)).toBeNull();
    p.items.push('a_mi4'); g.equip(p, 0, 'armor', 'a_mi4');
    const c = g.healCost(p).herb ?? 0;
    expect(g.healPlan(p)).toEqual({ gold: 2 * c });
  });

  it('根性の鉢巻：着ている仲間は休んでいても訓練のマスに置ける', () => {
    const { g, p } = bare();
    p.items.push('a_jn2'); g.equip(p, 1, 'armor', 'a_jn2');
    expect(g.wearMod(p.comps[1], 'rest_train')).toBe(true);
    expect(g.wearMod(p.comps[0], 'rest_train')).toBe(false);
  });
});

export type { Player };
