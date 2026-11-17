// 霧谷：人間の席だけの選び方（戦闘で使うものを自分で選ぶ・市場で好きな数を売買・AI との取引）
import { describe, expect, it } from 'vitest';
import { AI, AYA_TRADE_GOLD, KiridaniSession, fightChips, marketQuote, previewPick, type GameEvent, type Res } from '../src/kiridani';

const helper = new AI('mid', { seed: 7 });

/** 人間の席を AI の答えで進め、条件に合う「置き場所の選択」で止める */
function until(s: KiridaniSession, ok: (s: KiridaniSession) => boolean, from?: GameEvent[]): boolean {
  if (!from) s.start();
  for (let i = 0; i < 2000 && !s.done; i++) {
    if (s.waiting?.k === 'choose' && ok(s)) return true;
    s.answer(helper.respond(s.waiting!));
  }
  return false;
}
const nestOpt = (s: KiridaniSession) => s.waiting?.k === 'choose' ? s.waiting.opts.find((o) => o[0].startsWith('nest') && Array.isArray(o[1]) && !s.g.nest(o[0]).wait) : undefined;

describe('霧谷：戦闘で使うものを自分で選ぶ（人間の席）', () => {
  it('使うものを選んで挑むと、その分だけ払い、戦力の内訳が合う', () => {
    let tested = 0;
    for (let seed = 1; seed <= 12 && tested < 3; seed++) {
      const s = new KiridaniSession({ n: 4, seed, human: 0 });
      const found = until(s, (x) => {
        const o = nestOpt(x);
        if (!o) return false;
        return fightChips(x.g, x.player!, o[0]).some((c) => !c.locked && x.g.check_pick(x.player!, { sid: o[0], k: 1, boosts: [c.name] }).ok);
      });
      if (!found) continue;
      const p = s.player!;
      const sid = nestOpt(s)![0];
      const chip = fightChips(s.g, p, sid).find((c) => s.g.check_pick(p, { sid, k: 1, boosts: [c.name] }).ok)!;
      const pv0 = previewPick(s.g, p, { sid, k: 1, boosts: [] });
      const pv = previewPick(s.g, p, { sid, k: 1, boosts: [chip.name] });
      expect(pv.ok).toBe(true);
      expect(pv.parts.reduce((a, x) => a + x.value, 0)).toBe(pv.power);
      expect(pv.power).toBeGreaterThanOrEqual(pv0.power + chip.power);
      expect(pv.cost).toEqual(chip.cost);
      const before = { ...p.res };
      const evs = s.fight({ sid, k: 1, boosts: [chip.name] });
      // 使ったものを払った（戦利品が入ることがあるので、払いの出来事で確かめる）
      const paid = evs.filter((e) => e.t === 'pay' && e.seat === 0);
      const sumPaid: Record<string, number> = {};
      for (const e of paid) if (e.t === 'pay') for (const [r, n] of Object.entries(e.cost)) sumPaid[r] = (sumPaid[r] ?? 0) + (n as number);
      for (const [r, n] of Object.entries(chip.cost)) expect(sumPaid[r], r).toBeGreaterThanOrEqual(n as number);
      const pw = evs.find((e) => e.t === 'power' && e.parts.some((x) => x.seat === 0));
      expect(pw).toBeTruthy();
      if (pw?.t === 'power') expect(pw.parts.filter((x) => x.seat === 0).reduce((a, x) => a + x.value, 0)).toBe(pv.power);
      void before;
      s.autoplay();
      expect(s.done).toBe(true);
      tested += 1;
    }
    expect(tested).toBeGreaterThan(0);
  });

  it('持っていないもの・払えないもの・置けない人数は断られる', () => {
    const s = new KiridaniSession({ n: 4, seed: 3, human: 0 });
    expect(until(s, (x) => !!nestOpt(x))).toBe(true);
    const p = s.player!;
    const sid = nestOpt(s)![0];
    expect(() => s.fight({ sid, k: 1, boosts: ['i19', 'i19'] })).toThrow();
    expect(s.g.check_pick(p, { sid, k: 1, boosts: ['nothing'] }).ok).toBe(false);
    expect(s.g.check_pick(p, { sid, k: 9, boosts: [] }).ok).toBe(false);
    // 資源を空にするとポーション（薬草2）は払えない
    const keep = { ...p.res };
    for (const r of Object.keys(p.res) as Res[]) p.res[r] = 0;
    const r = s.g.check_pick(p, { sid, k: 1, boosts: ['potion'] });
    expect(r.ok).toBe(false);
    expect(previewPick(s.g, p, { sid, k: 1, boosts: ['potion'] }).ok).toBe(false);
    Object.assign(p.res, keep);
    // 何も使わずに挑むのは置ければいつでもよい
    expect(s.g.check_pick(p, { sid, k: 1, boosts: [] }).ok).toBe(true);
    expect(s.waiting?.k).toBe('choose');
  });

  it('待ち伏せを選ぶと巣で待ち、払った分が待ちの戦力になる', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const s = new KiridaniSession({ n: 4, seed, human: 0 });
      if (!until(s, (x) => { const o = nestOpt(x); return !!o && previewPick(x.g, x.player!, { sid: o[0], k: 1, boosts: [] }).waitOk; })) continue;
      const sid = nestOpt(s)![0];
      const pv = previewPick(s.g, s.player!, { sid, k: 1, boosts: [], wait: true });
      const evs = s.fight({ sid, k: 1, boosts: [], wait: true });
      const w = evs.find((e) => e.t === 'wait');
      expect(w).toBeTruthy();
      if (w?.t === 'wait') expect(w.power).toBe(pv.power);
      s.autoplay();
      expect(s.done).toBe(true);
      return;
    }
    throw new Error('待ち伏せの場面が見つからない');
  });

  it('使うものを全部自分で選んで最後まで遊べる（毎回、払えるものを全部使う）', () => {
    const s = new KiridaniSession({ n: 3, seed: 5, human: 0 });
    s.start();
    let fights = 0;
    for (let i = 0; i < 3000 && !s.done; i++) {
      const w = s.waiting!;
      if (w.k === 'choose') {
        const o = w.opts.find((x) => (x[0].startsWith('nest') || x[0] === 'lair') && Array.isArray(x[1]));
        if (o) {
          const k = (o[1] as number[])[0];
          const boosts: string[] = [];
          for (const c of fightChips(s.g, s.player!, o[0])) if (s.g.check_pick(s.player!, { sid: o[0], k, boosts: [...boosts, c.name] }).ok) boosts.push(c.name);
          s.fight({ sid: o[0], k, boosts });
          fights += 1;
          continue;
        }
      }
      s.answer(helper.respond(w));
    }
    expect(s.done).toBe(true);
    expect(fights).toBeGreaterThan(0);
    expect(s.g.errors).toEqual([]);
  });
});

describe('霧谷：市場で好きな数を売買（人間の席）', () => {
  it('買える数なら何個でも、上限や金貨を超えると断られる', () => {
    const s = new KiridaniSession({ n: 4, seed: 2, human: 0 });
    expect(until(s, (x) => x.waiting!.k === 'choose' && x.waiting!.opts.some((o) => o[0] === 'market'))).toBe(true);
    const p = s.player!;
    const q = marketQuote(s.g, p);
    p.res.gold = 20;
    expect(s.g.check_market(p, 'market', 'buy', 'wood', q.qty + 1)).not.toBeNull();
    expect(s.g.check_market(p, 'market', 'sell', 'wood', 1)).not.toBeNull();
    p.res.mana = 0;
    expect(s.g.check_market(p, 'market', 'sell', 'mana', 1)).not.toBeNull();
    const n = Math.min(q.qty, 3);
    const wood = p.res.wood;
    const evs = s.market('market', 'buy', 'wood', n);
    const m = evs.find((e) => e.t === 'market');
    expect(m && m.t === 'market' && m.gold).toBe(-q.buy.wood! * n);
    expect(p.res.wood).toBeGreaterThanOrEqual(wood + n);
  });
});

describe('霧谷：AI との取引（人間の席）', () => {
  it('AI の取引の評価で受ける／断るが決まり、受けたら資源が動く', () => {
    let done = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const s = new KiridaniSession({ n: 4, seed, human: 0 });
      if (!until(s, (x) => x.g.round >= 2)) continue;
      const p = s.player!;
      p.res.gold += 6; p.res.wood += 3;
      for (const b of s.tradePartners()) {
        const o = s.g.players[b];
        // 気前のよい提案（金貨3と木材1→相手の持ち物1つ）
        const want = (['food', 'wood', 'herb', 'iron', 'mana', 'mat'] as Res[]).find((r) => o.res[r] > 0 && r !== 'wood');
        if (!want) continue;
        const give = { gold: 3, ...(want !== 'wood' ? { wood: 0 } : {}) };
        const get = { [want]: 1 };
        const j = s.judgeTrade(b, give, get);
        expect(j.ok).toBe(true);
        // AI 自身の評価と一致（乱数を使わない）
        const own = (o.ai as AI).judge_offer(s.g, o, get, give);
        expect(j.accept).toBe(own.accept);
        expect(j.gain).toBeCloseTo(own.gain, 9);
        if (!j.accept) { expect(() => s.trade(b, give, get)).toThrow(); continue; }
        const g0 = p.res.gold, w0 = p.res[want], og0 = o.res.gold, left = s.tradeLeft();
        const evs = s.trade(b, give, get);
        expect(evs.some((e) => e.t === 'trade' && e.a === 0 && e.b === b)).toBe(true);
        const aya = (p.char === 'aya' ? AYA_TRADE_GOLD : 0);
        expect(p.res.gold).toBe(g0 - 3 + aya);
        expect(p.res[want]).toBe(w0 + 1);
        expect(o.res.gold).toBe(og0 + 3 + (o.char === 'aya' ? AYA_TRADE_GOLD : 0));
        expect(s.tradeLeft()).toBe(left - 1);
        expect(s.waiting?.k).toBe('choose');
        done += 1;
        break;
      }
      if (done) {
        // 回数を使い切ると断られる
        while (s.tradeLeft() > 0) s['tradesDone'][s.g.round] = 99;
        expect(s.judgeTrade(s.tradePartners()[0], { gold: 1 }, { food: 1 }).ok).toBe(false);
        s.autoplay();
        expect(s.done).toBe(true);
        break;
      }
    }
    expect(done).toBe(1);
  });

  it('成り立たない提案は理由つきで断られる', () => {
    const s = new KiridaniSession({ n: 3, seed: 4, human: 0 });
    expect(until(s, (x) => x.g.round >= 1)).toBe(true);
    const b = s.tradePartners()[0];
    const p = s.player!;
    expect(s.judgeTrade(b, {}, { food: 1 }).ok).toBe(false);
    expect(s.judgeTrade(b, { gold: 1 }, { gold: 1 }).ok).toBe(false);
    expect(s.judgeTrade(b, { gold: p.res.gold + 1 }, { food: 1 }).ok).toBe(false);
    expect(s.judgeTrade(b, { gold: 1, food: 1, wood: 1, herb: 1 }, { mana: 1 }).ok).toBe(false);
    expect(s.judgeTrade(0, { gold: 1 }, { food: 1 }).ok).toBe(false);
  });
});
