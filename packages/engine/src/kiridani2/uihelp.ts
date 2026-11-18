// 霧谷 v2 — 画面のための読み取り専用の小さな道具（エンジンの状態は変えない）。
import { sameOpt, type Req } from './engine';
import type { Action } from './net';
import * as D from './data';
import type { Effect } from './types';

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** AI などが返した生の答えを、オンラインと同じ形（Action）にする（ひとり用の試合の記録・再生に使う） */
export function answerToAction(w: Req, raw: unknown): Action {
  switch (w.k) {
    case 'card': return { t: 'card', id: String(raw) };
    case 'ratio': return { t: 'ratio', v: (w.options.find((x) => same(x, raw)) ?? raw) as Extract<Action, { t: 'ratio' }>['v'] };
    case 'kind': return { t: 'kind', v: raw as Extract<Action, { t: 'kind' }>['v'] };
    case 'choose': {
      const i = w.opts.findIndex((o) => sameOpt(o, raw as never));
      if (i < 0) throw new Error('bad option');
      return { t: 'opt', i };
    }
    case 'pick': {
      const i = w.options.findIndex((x) => x === raw || same(x, raw));
      if (i < 0) throw new Error('bad pick');
      return { t: 'pick', i };
    }
    case 'heal': case 'effect': return { t: 'yes', v: !!raw };
  }
}

/** 終わりの点の倍率（年数ごと。5年＝1） */
export const pointScale = (years: number | undefined) => (years ? D.POINT_SCALE[years] ?? 1 : 1);

/** カードの「終わりに名声+N」（game_end の効果の名声。条件つきでも足す）。なければ 0 */
export function endFameBase(c: { kind: string; effects?: Effect[]; secret?: boolean; fame?: number } | undefined): number {
  if (!c) return 0;
  if (c.kind === 'quest') return c.secret ? c.fame ?? D.SECRET_FAME : 0;
  let n = 0;
  for (const e of c.effects ?? []) if (e.when === 'game_end') for (const op of e.do ?? []) if (typeof op.fame === 'number') n += op.fame;
  return n;
}
