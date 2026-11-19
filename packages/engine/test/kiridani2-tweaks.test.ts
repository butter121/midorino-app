// 霧谷 v2：訓練（攻めは3まで・誰を鍛えるか選ぶ・若手の訓練は1段階目だけ）、遺跡の探索（山を選ぶ）、共通の依頼の同着
import { describe, expect, it } from 'vitest';
import { AI, CARD_SET, DATA, Game, type Player } from '../src/kiridani2/index';

/** 人の席0・AI1 の盤面（仲間3人） */
function bare(atk: number[] = [0, 0, 0], def: number[] = [0, 0, 0]) {
  const g = new Game(2, [null, new AI('normal', { seed: 1 })], { seed: 1, cards: CARD_SET });
  const p = g.players[0];
  p.comps = atk.map((a, i) => ({ atk: a, def: def[i], weapon: null, armor: null, leader: i === 0, injured: false, rest: false, used: false }));
  return { g, p };
}
const stageOps = (id: string) => CARD_SET.stages.find((s) => s.id === id)!.effects.map((e) => e.do ?? []);

describe('kiridani2 訓練', () => {
  it('熟練の上限は攻め3・守り2', () => {
    expect(DATA.MAX_SKILL).toEqual({ atk: 3, def: 2 });
    const { g, p } = bare([2, 3, 3], [2, 2, 2]);
    expect(g.trainCands(p, 'atk')).toEqual([0]);
    expect(g.trainCands(p, 'def')).toEqual([]);
    expect(g.expand(p, [{ train: 'any' }])).toEqual(['atk']);
  });

  it('上げられる仲間が2人以上なら誰を鍛えるか聞く（熟練の低い順）。選んだ仲間が上がる', () => {
    const { g, p } = bare([1, 0, 2]);
    const gen = g.runOps(p, [{ train: 'atk' }], { x: 'atk' });
    const r = gen.next();
    expect(r.done).toBe(false);
    const req = r.value as { k: string; what: string; options: string[] };
    expect(req.k).toBe('pick');
    expect(req.what).toBe('train:atk');
    expect(req.options).toEqual(['tr:1', 'tr:0', 'tr:2']);
    expect(gen.next('tr:2').done).toBe(true);
    expect(p.comps.map((c) => c.atk)).toEqual([1, 0, 3]);
  });

  it('上げられるのが1人なら聞かずに上げる', () => {
    const { g, p } = bare([3, 3, 1]);
    const gen = g.runOps(p, [{ train: 'atk' }], { x: 'atk' });
    expect(gen.next().done).toBe(true);
    expect(p.comps[2].atk).toBe(2);
  });

  it('若手の訓練：まだその熟練がない仲間だけ、1段階目だけ', () => {
    const ops = stageOps('drill')[0];
    expect(ops.every((o) => o.fresh)).toBe(true);
    const { g, p } = bare([1, 0, 0], [0, 1, 2]);
    const gen = g.runOps(p, ops, { x: 'atk' });
    const r = gen.next();
    expect((r.value as { options: string[] }).options).toEqual(['tr:1', 'tr:2']);
    // 守りは仲間1（リーダー）だけが0なので聞かずに上がる
    expect(gen.next('tr:2').done).toBe(true);
    expect(p.comps.map((c) => [c.atk, c.def])).toEqual([[1, 1], [0, 1], [1, 2]]);
  });

  it('若手の訓練：全員がもう攻めの熟練を持っていれば置けない', () => {
    const { g, p } = bare([1, 1, 2]);
    expect(g.expand(p, stageOps('drill')[0])).toEqual([]);
  });
});

describe('kiridani2 遺跡の探索', () => {
  it('武具・道具・秘術の山を選んで3枚見て1枚／古代の品', () => {
    const froms = stageOps('ruins').map((ops) => ops[0].draw?.from);
    expect(froms).toEqual(['weapon', 'tool', 'spell', 'ancient']);
  });

  it('選んだ山からだけ見る', () => {
    const { g, p } = bare();
    const gen = g.runOps(p, stageOps('ruins')[1], {});
    const r = gen.next();
    const req = r.value as { k: string; cards: string[] };
    expect(req.k).toBe('card');
    expect(req.cards).toHaveLength(3);
    for (const c of req.cards) expect(g.card(c).kind).toBe('tool');
    gen.next(req.cards[0]);
    expect(p.hand).toContain(req.cards[0]);
  });
});

describe('kiridani2 共通の依頼の同着', () => {
  const setup = () => {
    const g = new Game(3, [null, null, null], { seed: 3, cards: CARD_SET });
    g.quests = [{ id: 'q_boss', done: [] }];
    return g;
  };
  const boss = (p: Player) => { p.st.boss = 1; };

  it('同時に達成した人は全員1番目の名声。次の人は同着の人数ぶん後の順位', () => {
    const g = setup();
    const [a, b, c] = g.players;
    boss(a); boss(b);
    expect(g.checkQuests(g.players)).toEqual([1, 1, 0]);
    expect(a.fame.quest).toBe(DATA.QUEST_FAME[0]);
    expect(b.fame.quest).toBe(DATA.QUEST_FAME[0]);
    boss(c);
    expect(g.checkQuests(g.players)).toEqual([0, 0, 1]);
    expect(c.fame.quest).toBe(DATA.QUEST_FAME[2]);
  });

  it('別々のときに達成すれば先着順', () => {
    const g = setup();
    const [a, b] = g.players;
    boss(a);
    g.checkQuests(g.players);
    boss(b);
    g.checkQuests(g.players);
    expect([a.fame.quest, b.fame.quest]).toEqual([DATA.QUEST_FAME[0], DATA.QUEST_FAME[1]]);
  });
});
