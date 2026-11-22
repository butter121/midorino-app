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

  it('上げられるのが1人でも人の席には聞く（AI の席は聞かない）', () => {
    const { g, p } = bare([3, 3, 1]);
    const gen = g.runOps(p, [{ train: 'atk' }], { x: 'atk' });
    expect((gen.next().value as { options: string[] }).options).toEqual(['tr:2']);
    expect(gen.next('tr:2').done).toBe(true);
    expect(p.comps[2].atk).toBe(2);
    const q = g.players[1];
    q.comps = [{ atk: 3, def: 0, weapon: null, armor: null, leader: true, injured: false, rest: false, used: false }, { atk: 1, def: 0, weapon: null, armor: null, leader: false, injured: false, rest: false, used: false }];
    expect(g.runOps(q, [{ train: 'atk' }], { x: 'atk' }).next().done).toBe(true);
    expect(q.comps[1].atk).toBe(2);
  });

  it('訓練場と遺跡の探索は始めから盤面にある（段階0）', () => {
    const { g } = bare();
    expect(g.spaces.some((sp) => sp.id === 'training')).toBe(true);
    expect(g.spaces.some((sp) => sp.id === 'ruins')).toBe(true);
    expect(Object.values(g.stageAt)).not.toContain('training');
    expect(Object.values(g.stageAt)).not.toContain('ruins');
  });
});

describe('kiridani2 遺跡の探索', () => {
  it('武器・防具・道具・秘術の山を選んで3枚見て1枚／遺物1枚', () => {
    const ops = stageOps('ruins');
    expect(ops[0][0].draw_any?.from).toEqual(['weapon', 'armor', 'tool', 'spell']);
    expect(ops[1][0].relic).toBe(1);
  });

  it('選んだ山からだけ見る', () => {
    const { g, p } = bare();
    const gen = g.runOps(p, stageOps('ruins')[0], {});
    const r0 = gen.next();
    expect((r0.value as { what: string }).what).toBe('deck');
    const r = gen.next('tool');
    const req = r.value as { k: string; cards: string[] };
    expect(req.k).toBe('card');
    expect(req.cards).toHaveLength(3);
    for (const c of req.cards) expect(g.card(c).kind).toBe('tool');
    gen.next(req.cards[0]);
    expect(p.hand).toContain(req.cards[0]);
  });

  it('遺物を引くと壊れた状態で手元に来る（欠片はない）', () => {
    const { g, p } = bare();
    const gen = g.runOps(p, [{ relic: 1 }], {});
    const r = gen.next();
    const req = r.value as { k: string; cards: string[] };
    expect(req.k).toBe('card');
    gen.next(req.cards[0]);
    expect(p.broken).toEqual([req.cards[0]]);
    expect(p.ancient).toEqual([]);
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

describe('kiridani2 選択肢が1つでも人には見せる', () => {
  it('遺跡で山に1枚しか残っていなくても、そのカードを見せて選ばせる', () => {
    const { g, p } = bare();
    g.decks.tool = g.decks.tool.slice(0, 1);
    const gen = g.runOps(p, [{ draw: { from: 'tool', look: 3, take: 1 } }], {});
    const req = gen.next().value as { k: string; cards: string[] };
    expect(req.k).toBe('card');
    expect(req.cards).toHaveLength(1);
  });
});
