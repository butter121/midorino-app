// 霧谷 v2：カードの絵（画像が無いときの SVG・種類の縁取り）がすべてのカードで描けるか。強い動き（engine タグ）は絵に出さない
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CARD_SET } from '@midorino/engine/src/kiridani2';
import { CardPicture, KIND_COLOR, kindOf } from '../src/kiridani2/art2';
import { CardFace2 } from '../src/kiridani2/parts2';

const ALL = [...CARD_SET.leaders, ...CARD_SET.occupations, ...CARD_SET.weapons, ...CARD_SET.armors, ...CARD_SET.tools, ...CARD_SET.spells, ...CARD_SET.gear, ...CARD_SET.stages, ...CARD_SET.quests, ...CARD_SET.ancient, ...CARD_SET.pets];

describe('霧谷 v2：カードの絵', () => {
  it('全カードに種類があり、種類の色が決まっている', () => {
    expect(ALL.length).toBe(396);
    for (const c of ALL) {
      const k = kindOf(c.id);
      expect(k, c.id).toBeTruthy();
      expect(KIND_COLOR[k!], c.id).toMatch(/^#/);
    }
  });
  it('職能・武器・防具・道具・秘術とリーダーは、全部に絵がある（public/cards/index.json）', () => {
    const ids = new Set<string>(JSON.parse(readFileSync(new URL('../../app/public/cards/index.json', import.meta.url), 'utf8')).ids);
    const need = [...CARD_SET.leaders, ...CARD_SET.occupations, ...CARD_SET.weapons, ...CARD_SET.armors, ...CARD_SET.tools, ...CARD_SET.spells];
    expect(need.filter((c) => !ids.has(c.id)).map((c) => c.id)).toEqual([]);
  });
  it('種類の色は原色を避けたくすんだ色（彩度が低い）', () => {
    for (const [k, hex] of Object.entries(KIND_COLOR)) {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      const l = (mx + mn) / 2, sat = mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1));
      expect(sat, k).toBeLessThan(0.5);
      expect(l, k).toBeGreaterThan(0.45);
    }
  });
  it('種類の色は互いに見分けられる（RGB の距離）', () => {
    const cs = Object.entries(KIND_COLOR).map(([k, h]) => [k, [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))] as const);
    for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
      const d = Math.hypot(...cs[i][1].map((x, t) => x - cs[j][1][t]));
      expect(d, `${cs[i][0]}-${cs[j][0]}`).toBeGreaterThan(30);
    }
  });
  it('強い動き（engine タグ）はカードの絵にも表にも出さない', () => {
    const tagged = ALL.filter((c) => 'engine' in c && (c.engine?.length ?? 0) > 0);
    expect(tagged.length).toBeGreaterThan(100);
    for (const c of tagged.slice(0, 80)) {
      const pic = renderToStaticMarkup(createElement(CardPicture, { id: c.id, kind: kindOf(c.id)!, size: 104 }));
      // 絵の中の円は札だけだった（縁取り・背景は円を使わない絵もある）ので、札の色が無いことで見る
      for (const col of ['#FF4F5E', '#3FCB6A', '#FFC21A', '#A35BFF', '#1FC7C1']) expect(pic, c.id).not.toContain(col);
      const face = renderToStaticMarkup(createElement(CardFace2, { id: c.id, size: 'l' }));
      expect(face, c.id).not.toContain('kd-quirk');
    }
  });
  it('画像が無いときは SVG の絵で描き、縁取りを重ねる', () => {
    for (const c of ALL) {
      const html = renderToStaticMarkup(createElement(CardPicture, { id: c.id, kind: kindOf(c.id)!, size: 76 }));
      expect(html, c.id).toContain('data-art="svg"');
      expect(html, c.id).toContain(`aria-label="${c.name}"`);
    }
  });
});
