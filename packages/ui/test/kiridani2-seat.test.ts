// 霧谷 v2：盤面の答えの振り分け。戦闘のトレイ・細かい選択のシートを開いただけでは「答えた」ことにしない
// （以前は開いた時点で盤面が「予約済み」になり、やめると置く場所を選べないまま止まった）
import { describe, expect, it } from 'vitest';
import { AI, Kiridani2Session, applyAction2 } from '@midorino/engine/src/kiridani2';
import { answerToAction } from '@midorino/engine/src/kiridani2/uihelp';
import { optionSheet2, routeAnswer2, uiFor2 } from '../src/kiridani2/seat';

function toChoose(seed: number, ok: (s: Kiridani2Session) => boolean) {
  const s = new Kiridani2Session({ n: 4, seed, years: 5, human: 0 });
  const helper = new AI('normal', { seed: 99 });
  s.start();
  while (!s.done) {
    if (s.waiting!.k === 'choose' && ok(s)) return s;
    applyAction2(s, answerToAction(s.waiting!, helper.respond(s.waiting!)));
  }
  throw new Error('not found');
}
const seat = (s: Kiridani2Session) => ({ g: s.g, player: s.player, waiting: s.waiting, tradePartners: () => s.tradePartners(), tradeLeft: () => s.tradeLeft(), judgeTrade: s.judgeTrade.bind(s) });

describe('kiridani2 盤面の答えの振り分け（routeAnswer2）', () => {
  it('巣は戦闘のトレイ、選択肢が複数のマスはシート（どちらもまだ答えていない）。1つだけのマスはそのまま答える', () => {
    const s = toChoose(3, (x) => x.waiting!.k === 'choose' && x.waiting!.opts.some((o) => o.s.startsWith('nest')));
    const w = s.waiting!;
    if (w.k !== 'choose') throw new Error();
    const ask = uiFor2(seat(s) as never).ask;
    expect(ask?.kind).toBe('place');
    const nest = w.opts.find((o) => o.s.startsWith('nest'))!.s;
    expect(routeAnswer2(w, nest)).toEqual({ k: 'fight', sid: nest });
    const places = ask!.kind === 'place' ? ask!.options : [];
    for (const sid of places) {
      const r = routeAnswer2(w, sid);
      const n = w.opts.filter((o) => o.s === sid).length;
      if (sid.startsWith('nest') || sid === 'lair') expect(r.k).toBe('fight');
      else if (n === 1) expect(r.k).toBe('send');
      else expect(r.k).toBe('sub');
    }
    // 選べない場所・秘術は答えにならない
    expect(routeAnswer2(w, 'nowhere').k).toBe('none');
    expect(routeAnswer2(w, '@spell').k).toBe('none');
  });
  it('準備：割合とカードは答える。知らないカードは答えない', () => {
    const s = new Kiridani2Session({ n: 3, seed: 2, years: 5, human: 0 });
    s.start();
    const w = s.waiting!;
    expect(w.k).toBe('card');
    if (w.k !== 'card') return;
    expect(routeAnswer2(w, w.cards[0])).toEqual({ k: 'send', a: { t: 'card', id: w.cards[0] } });
    expect(routeAnswer2(w, 'zzz').k).toBe('none');
  });
});

describe('kiridani2 シートは短く（説明は見出しの下に1回）・装備を誰に持たせるか', () => {
  it('交換所：選択肢は「売る・買う」と 払う→得る のアイコンだけ（くり返しの説明なし）', () => {
    const s = toChoose(3, (x) => x.waiting!.k === 'choose' && x.waiting!.opts.filter((o) => o.s === 'market').length > 1);
    const w = s.waiting!;
    if (w.k !== 'choose') throw new Error();
    const spec = optionSheet2(seat(s) as never, 'market', w.opts.filter((o) => o.s === 'market'));
    expect(spec.sub).toBeTruthy();
    for (const it of spec.items) {
      expect(it.detail).toBeUndefined();
      expect(it.gain).toBeTruthy();
      expect(it.title.length).toBeLessThanOrEqual(16);
    }
  });
  it('段階のマス（大市など）：カードの説明は見出しの下に1回、選択肢は得るものだけ', () => {
    const s = toChoose(3, (x) => x.waiting!.k === 'choose' && x.g.spaces.some((sp) => sp.stage && x.waiting!.k === 'choose' && x.waiting!.opts.filter((o) => o.s === sp.id).length > 1));
    const w = s.waiting!;
    if (w.k !== 'choose') throw new Error();
    const sp = s.g.spaces.find((x) => x.stage && w.opts.filter((o) => o.s === x.id).length > 1)!;
    const spec = optionSheet2(seat(s) as never, sp.id, w.opts.filter((o) => o.s === sp.id));
    expect(spec.sub).toBe(s.g.card(sp.stage!).text);
    for (const it of spec.items) expect(it.detail).not.toBe(spec.sub);
  });
  it('装備を手に入れたとき：誰に持たせるかのシート（仲間ごとの戦力・守り、最後に倉庫）', () => {
    const s = new Kiridani2Session({ n: 3, seed: 4, years: 5, human: 0 });
    const helper = new AI('normal', { seed: 99 });
    s.start();
    while (!s.done && !(s.waiting!.k === 'pick' && s.waiting!.what.startsWith('equip:'))) applyAction2(s, answerToAction(s.waiting!, helper.respond(s.waiting!)));
    const w = s.waiting!;
    if (w.k !== 'pick') throw new Error('no equip prompt');
    const sh = uiFor2(seat(s) as never).sheet!;
    expect(sh.title).toMatch(/を誰に持たせる？/);
    expect(sh.items.length).toBe(w.options.length);
    expect(sh.items.at(-1)!.title).toBe('倉庫に置く');
    expect(sh.items[0].detail).toMatch(/戦力\d+・守り\d+/);
  });
});
