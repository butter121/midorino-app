// 霧谷：本物のエンジン（KiridaniSession）の出来事を画面の applyEvent に当てると、最後の画面の状態がエンジンと食い違わないか
import { describe, expect, it } from 'vitest';
import { KiridaniSession } from '@midorino/engine/src/kiridani';
import { applyEvent, initialView } from '../src/kiridani/reduce';
import { cuesFor } from '../src/kiridani/sound';
import { BASE_MS } from '../src/kiridani/anim/timing';
import * as D from '../src/kiridani/data';

describe('霧谷：エンジンの出来事で画面が動く', () => {
  for (const [n, seed] of [[3, 1], [4, 2], [5, 3], [6, 4]] as const) {
    it(`${n}人（種${seed}）：人間の席をお任せで最後まで。資源・名声・仲間が画面とエンジンで一致`, () => {
      const s = new KiridaniSession({ n, seed, human: 0, levels: Array(n).fill('mid') });
      const evs = s.autoplay();
      expect(s.done).toBe(true);
      let v = initialView(0);
      for (const e of evs) {
        expect(BASE_MS[e.t], e.t).toBeTypeOf('number');
        cuesFor(e, 0);
        v = applyEvent(v, e);
      }
      expect(v.phase).toBe('final');
      const g = s.g;
      for (const p of g.players) {
        const pv = v.players[p.pid];
        for (const r of D.RES) expect(pv.res[r], `P${p.pid} ${r}`).toBe(p.res[r]);
        expect(pv.fame, `P${p.pid} 名声`).toBe(s.scores[p.pid]);
        expect(pv.companions.length).toBe(p.comps);
        expect(pv.walls).toBe(p.walls);
        expect(pv.beds).toBe(p.beds);
        expect(pv.discontent).toBe(p.discontent);
        expect(pv.occupations).toEqual(p.occs);
        expect(pv.weapons).toEqual(p.weapons);
        expect(pv.facilities).toEqual(p.tools);
        expect(pv.familiars.length).toBe(p.pets);
        if (p.pid === 0) expect(pv.hand).toEqual(p.hand); else expect(pv.hand.length).toBe(p.hand.length);
        expect(pv.companions.map((c) => c.skill)).toEqual(p.skills);
      }
      expect(v.final!.map((r) => r.total)).toEqual(s.scores);
      // 戦闘の内訳の合計と結果が食い違わない
      let combat: { parts: number; fate: number } | null = null;
      for (const e of evs) {
        if (e.t === 'combat_start') combat = { parts: 0, fate: 0 };
        if (e.t === 'power' && combat) combat.parts += e.parts.reduce((a, x) => a + x.value, 0);
        if (e.t === 'fate_flip' && combat) combat.fate += e.value;
        if (e.t === 'clash' && combat) expect(combat.parts + combat.fate).toBe(e.total);
      }
    });
  }
});
