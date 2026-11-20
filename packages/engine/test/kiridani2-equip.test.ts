// 霧谷 v2：装備は人が自分で持たせる（手に入れたときの問い・手番の equip）、動かす仲間を選ぶ（Option.who）
import { describe, expect, it } from 'vitest';
import {
  AI, CARD_SET, Game, Kiridani2Referee, Kiridani2Session, applyAction2, previewFight, simpleAnswer2, Shadow2Session, slotOf,
  type Action2, type GameEvent, type Option,
} from '../src/kiridani2/index';
import { answerToAction } from '../src/kiridani2/uihelp';

const NAMES = ['あなた', 'ハヤテ', 'コトネ', 'ジン'];

/** 人の席0・AI1 の盤面（仲間3人：リーダー・仲間2・仲間3） */
function bare() {
  const g = new Game(2, [null, new AI('normal', { seed: 1 })], { seed: 1, cards: CARD_SET });
  const p = g.players[0];
  p.comps = [0, 1, 2].map((i) => ({ atk: i, def: 0, weapon: null, armor: null, leader: i === 0, injured: false, rest: false, used: false }));
  return { g, p };
}

describe('kiridani2 装備を自分で持たせる', () => {
  it('倉庫から持たせる・はずす・ほかの仲間から持ち替える。持っていたものは倉庫へ', () => {
    const { g, p } = bare();
    p.items = ['g_sword', 'g_spear', 'g_leather'];
    g.equip(p, 1, 'weapon', 'g_sword');
    expect(p.comps[1].weapon).toBe('g_sword');
    expect(g.storage(p).sort()).toEqual(['g_leather', 'g_spear']);
    g.equip(p, 1, 'weapon', 'g_spear');
    expect(p.comps[1].weapon).toBe('g_spear');
    expect(g.storage(p)).toContain('g_sword');
    // ほかの仲間が持っている物を持ち替える
    g.equip(p, 2, 'weapon', 'g_spear');
    expect(p.comps[1].weapon).toBeNull();
    expect(p.comps[2].weapon).toBe('g_spear');
    g.equip(p, 2, 'weapon', null);
    expect(p.comps[2].weapon).toBeNull();
    // 倉庫にない・枠が違う・もう持っていない
    expect(() => g.equip(p, 0, 'weapon', 'g_bow')).toThrow();
    expect(() => g.equip(p, 0, 'armor', 'g_sword')).toThrow();
    expect(() => g.equip(p, 0, 'weapon', null)).toThrow();
    expect(() => g.equip(p, 9, 'weapon', 'g_sword')).toThrow();
  });

  it('両手武器を持つと防具は倉庫へ・持っている間は防具を持てない', () => {
    const { g, p } = bare();
    p.items = ['w_trophy_axe', 'g_leather'];
    g.equip(p, 1, 'armor', 'g_leather');
    g.equip(p, 1, 'weapon', 'w_trophy_axe');
    expect(p.comps[1].armor).toBeNull();
    expect(() => g.equip(p, 1, 'armor', 'g_leather')).toThrow();
    expect(g.equipTargets(p, 'g_leather')).not.toContain(1);
  });

  it('巨人狩り山田：駒はみな両手武器しか持てない', () => {
    const { g, p } = bare();
    p.leader = 'l_doran';
    p.items = ['w_trophy_axe', 'g_sword'];
    expect(() => g.equip(p, 1, 'weapon', 'g_sword')).toThrow(/両手武器しか/);
    expect(g.equipTargets(p, 'g_sword')).toEqual([]);
    g.equip(p, 1, 'weapon', 'w_trophy_axe');
    expect(p.comps[1].weapon).toBe('w_trophy_axe');
  });

  it('手に入れたときに誰に持たせるか聞く（空いている枠・熟練の高い順、最後に倉庫）。AI の席は自動のまま', () => {
    const { g, p } = bare();
    p.items = ['g_sword'];
    const gen = g.gotGear(p, 'g_sword');
    const r = gen.next();
    expect(r.done).toBe(false);
    const req = r.value as Extract<typeof r.value, { k: 'pick' }>;
    expect(req.what).toBe('equip:g_sword');
    expect(req.options).toEqual(['eq:2', 'eq:1', 'eq:0', 'eq:-']);
    gen.next('eq:1');
    expect(p.comps[1].weapon).toBe('g_sword');
    // 倉庫に置く
    p.items.push('g_spear');
    const g2 = g.gotGear(p, 'g_spear');
    g2.next();
    expect(g2.next('eq:-').done).toBe(true);
    expect(g.storage(p)).toEqual(['g_spear']);
    // 人の席は自動の持ち替えをしない
    g.autoEquip(p);
    expect(p.comps[1].weapon).toBe('g_sword');
    // AI の席は聞かずに自動で
    const q = g.players[1];
    q.comps = [{ atk: 0, def: 0, weapon: null, armor: null, leader: true, injured: false, rest: false, used: false }];
    q.items = ['g_sword'];
    expect(g.gotGear(q, 'g_sword').next().done).toBe(true);
    expect(q.comps[0].weapon).toBe('g_sword');
  });

  it('手番に装備を持ち替えられる（Session.equip / Action equip）。選択は続き、記録から同じ試合になる', () => {
    const s = new Kiridani2Session({ n: 3, seed: 4, years: 5, human: 0, names: NAMES.slice(0, 3) });
    const helper = new AI('normal', { seed: 99 });
    const hist: Action2[] = [];
    s.start();
    // 装備の問いが来たら倉庫に置く。最初の置き場所の選択まで
    while (!(s.waiting!.k === 'choose' && s.g.storage(s.player!).length) && !s.done) {
      const w = s.waiting!;
      // 手伝いの AI は先読みで人の席の狙いと他の AI の乱数を進めるので、答えたあと元に戻す
      const me = s.g.players[0], keepT = [...me.target];
      const keepR = s.g.players.map((q) => (q.ai as unknown as { rng?: { a: number } } | null)?.rng?.a);
      const a: Action2 = w.k === 'pick' && w.what.startsWith('equip:') ? { t: 'pick', i: w.options.length - 1 } : answerToAction(w, helper.respond(w));
      me.target = keepT;
      s.g.players.forEach((q, i) => { const r = (q.ai as unknown as { rng?: { a: number } } | null)?.rng; if (r && keepR[i] !== undefined) r.a = keepR[i]!; });
      applyAction2(s, a); hist.push(a);
    }
    const p = s.player!;
    const id = s.g.storage(p)[0];
    const ci = s.g.equipTargets(p, id)[0];
    const slot = slotOf(s.g.card(id))!;
    const a: Action2 = { t: 'equip', c: ci, slot, id };
    const evs = applyAction2(s, a); hist.push(a);
    expect(evs.some((e) => e.t === 'equip' && e.companion === ci && e.card === id)).toBe(true);
    expect(s.waiting!.k).toBe('choose');
    expect(applyAction2(s, { t: 'equip', c: ci, slot, id })).toEqual([]); // 同じ操作の再送は何もしない
    // 記録を当て直すと同じ
    const again = new Kiridani2Session({ n: 3, seed: 4, years: 5, human: 0, names: NAMES.slice(0, 3) });
    again.start();
    for (const x of hist) applyAction2(again, x);
    expect(again.g.players[0].comps).toEqual(s.g.players[0].comps);
  });
});

/** 人の席が置き場所を選ぶ場面まで（仲間が2人以上空いていて、巣で戦える） */
function toChoose(seed: number) {
  const s = new Kiridani2Session({ n: 4, seed, years: 5, human: 0, levels: Array(4).fill('normal'), names: NAMES });
  const helper = new AI('normal', { seed: 99 });
  s.start();
  while (!s.done) {
    const w = s.waiting!;
    if (w.k === 'choose' && s.g.round >= 2 && w.p.free().length >= 2 && w.opts.some((o) => o.s.startsWith('nest') && o.k === 1)) return s;
    applyAction2(s, answerToAction(w, helper.respond(w)));
  }
  throw new Error('no choose');
}

describe('kiridani2 動かす仲間を選ぶ（who）', () => {
  it('マス：選んだ仲間が出る（place の companions）。選ばなければこれまでどおり空いている最初の仲間', () => {
    const s = toChoose(5);
    const w = s.waiting as Extract<typeof s.waiting, { k: 'choose' }>;
    const p = s.player!;
    const fr = p.free();
    const i = w.opts.findIndex((o) => !o.s.startsWith('nest') && o.s !== 'lair' && o.s !== '@spell');
    const pick = fr[fr.length - 1];
    const evs = applyAction2(s, { t: 'opt', i, who: [pick] });
    const pl = evs.find((e) => e.t === 'place' && e.seat === 0) as Extract<GameEvent, { t: 'place' }>;
    expect(pl.companions).toEqual([pick]);
    expect(s.g.players[0].comps[pick].used).toBe(true);
    expect(s.g.players[0].comps[fr[0]].used).toBe(false);
  });

  it('使えない仲間は断る（休み・使った・数が違う）', () => {
    const s = toChoose(5);
    const w = s.waiting as Extract<typeof s.waiting, { k: 'choose' }>;
    const i = w.opts.findIndex((o) => !o.s.startsWith('nest') && o.s !== 'lair' && o.s !== '@spell');
    expect(() => applyAction2(s, { t: 'opt', i, who: [99] })).toThrow();
    expect(() => applyAction2(s, { t: 'opt', i, who: [0, 1] })).toThrow();
    expect(() => s.answer({ ...w.opts[i], who: 'x' as never })).toThrow();
  });

  it('戦闘：見込みも実際の戦闘も選んだ仲間で計算する', () => {
    const s = toChoose(5);
    const w = s.waiting as Extract<typeof s.waiting, { k: 'choose' }>;
    const p = s.player!;
    const o = w.opts.find((x) => x.s.startsWith('nest') && x.k === 1 && x.mode === 'normal')!;
    const fr = p.free().filter((i) => !p.comps[i].injured);
    const def = previewFight(s.g, p, o)!;
    const other = fr.find((i) => i !== def.idxs[0])!;
    const pv = previewFight(s.g, p, { ...o, who: [other] } as Option)!;
    expect(pv.idxs).toEqual([other]);
    const evs = applyAction2(s, { t: 'opt', i: w.opts.indexOf(o), who: [other] });
    const pl = evs.find((e) => e.t === 'place' && e.seat === 0) as Extract<GameEvent, { t: 'place' }>;
    expect(pl.companions).toEqual([other]);
    const pw = evs.find((e) => e.t === 'power') as Extract<GameEvent, { t: 'power' }>;
    expect(pw.parts.find((x) => x.kind === 'companion')?.label).toBe(`仲間${other + 1}`);
  });
});

describe('kiridani2 審判：装備と仲間の選び', () => {
  it('equip と who の答えも記録され、読み直すと同じ試合になる', () => {
    const ref = new Kiridani2Referee({ n: 3, seed: 8, humans: [0, 1], names: NAMES.slice(0, 3), offerTimeoutMs: 0 });
    ref.start();
    let equipped = 0, chosen = 0;
    for (let n = 0; n < 4000 && !ref.done; n++) {
      for (const seat of ref.waitingSeats()) {
        const pr = JSON.parse(JSON.stringify(ref.prompt(seat)));
        const sh = new Shadow2Session(pr);
        const w = sh.waiting;
        const p = sh.player;
        if (w.k === 'choose' && sh.g.storage(p).length && equipped < 3) {
          const id = sh.g.storage(p)[0];
          const to = sh.g.equipTargets(p, id);
          const slot = slotOf(sh.g.card(id))!;
          if (to.length && !sh.g.equipError(p, to[0], slot, id)) { expect(ref.act(seat, pr.id, { t: 'equip', c: to[0], slot, id })).toEqual({ ok: true }); equipped++; continue; }
        }
        // 装備の問いは倉庫に置き、手番に持たせる
        let a: Action2 = w.k === 'pick' && w.what.startsWith('equip:') ? { t: 'pick', i: w.options.length - 1 } : simpleAnswer2(sh);
        // 装備を作れるときは作る（倉庫に置いた装備を手番に持たせる）
        const craft = w.k === 'choose' && equipped < 3 ? w.opts.findIndex((o) => (o.s === 'forge' || o.s === 'training') && typeof o.x === 'string') : -1;
        if (craft >= 0) a = { t: 'opt', i: craft };
        if (a.t === 'opt' && w.k === 'choose') {
          const o = w.opts[a.i];
          const fr = p.free().filter((i) => !p.comps[i].injured);
          const k = o.k ?? 1;
          if (o.s !== '@spell' && fr.length >= k) {
            const who = [...fr].reverse().slice(0, k);
            if (sh.g.whoFor(p, { ...o, who })) { a = { ...a, who }; chosen++; }
          }
        }
        expect(ref.act(seat, pr.id, a)).toEqual({ ok: true });
      }
    }
    expect(ref.done).toBe(true);
    expect(equipped).toBeGreaterThan(0);
    expect(chosen).toBeGreaterThan(10);
    const again = new Kiridani2Referee({ n: 3, seed: 8, humans: [0, 1], names: NAMES.slice(0, 3), offerTimeoutMs: 0 });
    again.start();
    again.replay(JSON.parse(JSON.stringify(ref.history)));
    expect(again.scores).toEqual(ref.scores);
    expect(again.g.players.map((p) => p.comps)).toEqual(ref.g.players.map((p) => p.comps));
  }, 60000);
});
