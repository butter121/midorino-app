// 霧谷 v2：押し売りモモは魔石1つを、同じ価値の資源1種類と取引できる（金貨3枚分の上限は魔石には当てはまらない）
import { describe, expect, it } from 'vitest';
import { AI, Kiridani2Session, applyAction2, stoneKey, type Cost } from '../src/kiridani2/index';
import { answerToAction } from '../src/kiridani2/uihelp';

function momoChoose() {
  const s = new Kiridani2Session({ n: 3, seed: 5, years: 5, human: 0, names: ['あなた', 'ハヤテ', 'コトネ'] });
  const helper = new AI('normal', { seed: 99 });
  s.start();
  while (!s.done && !(s.waiting!.k === 'choose' && s.g.round >= 1)) applyAction2(s, answerToAction(s.waiting!, helper.respond(s.waiting!)));
  const p = s.player!;
  p.leader = 'l_momo';
  return s;
}

describe('霧谷 v2：モモの魔石の取引', () => {
  it('上級の魔石1つ ⇄ 食料6（相手の了承なし）。価値が違う・2種類・2つは断られる', () => {
    const s = momoChoose();
    const p = s.player!, q = s.g.players[1];
    p.stones[2] = 1; q.res.food = 8;
    const give = { [stoneKey(2)]: 1 } as Cost;
    expect(s.judgeTrade(1, give, { food: 5 }).ok).toBe(false);
    expect(s.judgeTrade(1, give, { food: 3, wood: 3 }).ok).toBe(false);
    expect(s.judgeTrade(1, { [stoneKey(2)]: 2 } as Cost, { food: 6 }).ok).toBe(false);
    expect(s.judgeTrade(1, give, { food: 6 })).toMatchObject({ ok: true, accept: true });
    const f0 = p.res.food;
    applyAction2(s, { t: 'trade', b: 1, give, get: { food: 6 } });
    expect(p.stones[2]).toBe(0);
    expect(q.stones[2]).toBe(1);
    expect(p.res.food).toBe(f0 + 6);
    expect(q.res.food).toBe(2);
  });
  it('モモでなければ魔石は出せない', () => {
    const s = momoChoose();
    s.player!.leader = 'l_akane';
    s.player!.stones[0] = 1;
    expect(s.judgeTrade(1, { [stoneKey(0)]: 1 } as Cost, { wood: 2 }).ok).toBe(false);
  });
});
