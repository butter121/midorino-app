// 霧谷 v2：カードの絵（画像が無いときの SVG・種類の縁取り・強い動きの札）がすべてのカードで描けるか
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CARD_SET } from '@midorino/engine/src/kiridani2';
import { CardPicture, KIND_COLOR, MOVE_COLOR, MOVES, MoveIcon, kindOf } from '../src/kiridani2/art2';

const ALL = [...CARD_SET.leaders, ...CARD_SET.occupations, ...CARD_SET.weapons, ...CARD_SET.tools, ...CARD_SET.spells, ...CARD_SET.gear, ...CARD_SET.stages, ...CARD_SET.quests, ...CARD_SET.ancient];

describe('霧谷 v2：カードの絵', () => {
  it('全カードに種類があり、種類の色が決まっている', () => {
    expect(ALL.length).toBe(346);
    for (const c of ALL) {
      const k = kindOf(c.id);
      expect(k, c.id).toBeTruthy();
      expect(KIND_COLOR[k!], c.id).toMatch(/^#/);
    }
  });
  it('カードに出てくる強い動きはすべて札がある（12種）', () => {
    expect(MOVES.length).toBe(12);
    const used = new Set(ALL.flatMap((c) => ('engine' in c ? c.engine ?? [] : [])));
    for (const e of used) expect(MOVE_COLOR[e as keyof typeof MOVE_COLOR], e).toBeTruthy();
    for (const m of MOVES) expect(renderToStaticMarkup(createElement(MoveIcon, { move: m }))).toContain('<svg');
  });
  it('画像が無いときは SVG の絵で描き、縁取りと札を重ねる', () => {
    for (const c of ALL) {
      const html = renderToStaticMarkup(createElement(CardPicture, { id: c.id, kind: kindOf(c.id)!, size: 76 }));
      expect(html, c.id).toContain('data-art="svg"');
      expect(html, c.id).toContain(`aria-label="${c.name}"`);
    }
  });
});
