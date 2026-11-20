// 霧谷 v2：捕まえた使い魔が拠点に並ぶ（出来事だけで画面の使い魔の一覧がエンジンと一致し、拠点に絵と戦力が出る）
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AI, Kiridani2Session, applyAction2, type GameEvent } from '@midorino/engine/src/kiridani2';
import { answerToAction } from '@midorino/engine/src/kiridani2/uihelp';
import { applyEvent2, initialView2, type Ev, type View2 } from '../src/kiridani2/view';
import { BaseView2 } from '../src/kiridani2/table2';

describe('霧谷 v2：使い魔を拠点に表示', () => {
  it('使い魔の一覧がエンジンと同じで、拠点に並ぶ', () => {
    let seen = 0;
    for (let seed = 1; seed <= 6 && seen === 0; seed++) {
      const s = new Kiridani2Session({ n: 3, seed, years: 5, human: 0 });
      const ai = new AI('strong', { seed, target: 'beast' });
      let v: View2 = initialView2(0);
      const push = (evs: GameEvent[]) => { for (const e of evs) v = applyEvent2(v, e as Ev); };
      push(s.start());
      for (let i = 0; i < 20000 && !s.done; i++) push(applyAction2(s, answerToAction(s.waiting!, ai.respond(s.waiting!))));
      for (const p of s.g.players) {
        const pv = v.players[p.pid];
        expect(pv.petList.map((x) => x.type).sort()).toEqual(p.pets.map((x) => x.type).sort());
        expect(pv.pets).toBe(p.pets.length);
        if (p.pets.length) {
          seen++;
          const html = renderToStaticMarkup(createElement(BaseView2, { p: pv, v, cur: null }));
          expect((html.match(/is-pet/g) ?? []).length).toBe(p.pets.length);
          expect(html).toContain(`card2:pet_${p.pets[0].type}`);
        }
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});
