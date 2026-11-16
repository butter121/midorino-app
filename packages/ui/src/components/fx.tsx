// 置いたときの演出：コマがプレイヤー列から放物線で飛んでスペースに着地 → 波紋 → 得たものが浮かび上がる。
// 人間・AIどちらの手でも、アプリは置かれた手を move に渡すだけ（key が変わるたびに1回再生）。
// 「視差効果を減らす」設定の端末では動かさず、光と文字だけで知らせる。
import { useLayoutEffect, useRef, useState } from 'react';
import { ACT, JP, type Cost, type Res } from '@midorino/engine';
import { PLAYER_COLORS, RES_ICON, Worker } from './basics';

export interface PlacedMove {
  /** 手ごとに変わる値（MatchState.seq など） */
  key: string | number;
  seat: number;
  sid: string;
  /** このコマで得たもの（表示用。省略可） */
  gains?: Cost;
  /** 「ゆうさん」など。読み上げと小さな知らせに使う */
  who?: string;
  /** 「畑を2区画」など、得たもの以外の結果の一言 */
  note?: string;
}

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const gainText = (c?: Cost) => Object.entries(c ?? {}).filter(([, n]) => n).map(([r, n]) => `${JP[r as Res]}+${n}`).join('・');

/** GameLayout の中ならどこに置いてもよい（画面に固定して重ねる）。onDone は演出が終わったとき */
export function PlacementFx({ move, duration = 650, onDone }: { move: PlacedMove | null; duration?: number; onDone?: () => void }) {
  const layer = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<PlacedMove | null>(null);

  useLayoutEffect(() => {
    if (!move || !layer.current) return;
    const root = layer.current.closest('.mi-game') ?? document;
    const tile = root.querySelector<HTMLElement>(`[data-space="${move.sid}"]`);
    const from = root.querySelector<HTMLElement>(`[data-seat="${move.seat}"]`);
    setToast(move);
    const timers: number[] = [];
    timers.push(window.setTimeout(() => setToast(null), 2600));
    const done = () => { onDone?.(); };
    if (!tile) { timers.push(window.setTimeout(done, 300)); return () => timers.forEach(clearTimeout); }

    const tr = tile.getBoundingClientRect();
    const token = tile.querySelectorAll<SVGElement>('.mi-sp-by svg');
    const real = token[token.length - 1];
    const end = real?.getBoundingClientRect() ?? { left: tr.right - 30, top: tr.top, width: 24, height: 24 };

    const ring = () => {
      tile.style.setProperty('--fx-color', PLAYER_COLORS[move.seat % 6]);
      tile.classList.remove('mi-fx-ring'); void tile.offsetWidth; tile.classList.add('mi-fx-ring');
      timers.push(window.setTimeout(() => tile.classList.remove('mi-fx-ring'), 900));
      if (move.gains) floatGains(layer.current!, tr, move.gains, reduced());
    };

    if (reduced() || !from) { ring(); timers.push(window.setTimeout(done, 400)); return () => timers.forEach(clearTimeout); }

    // 飛んでいくコマ（本物は着地まで隠す）
    const fr = from.querySelector('svg')?.getBoundingClientRect() ?? from.getBoundingClientRect();
    const fly = layer.current.querySelector<HTMLElement>('.mi-fx-fly')!;
    fly.style.color = PLAYER_COLORS[move.seat % 6];
    fly.style.width = `${end.width}px`; fly.style.height = `${end.height}px`;
    fly.style.display = 'block';
    if (real) real.style.visibility = 'hidden';
    const sx = fr.left + fr.width / 2 - end.width / 2, sy = fr.top + fr.height / 2 - end.height / 2;
    const ex = end.left, ey = end.top;
    const lift = Math.min(90, Math.abs(ex - sx) * 0.3 + 30);
    const pt = (t: number) => `translate(${sx + (ex - sx) * t}px, ${sy + (ey - sy) * t - 4 * lift * t * (1 - t)}px)`;
    const anim = fly.animate([
      { transform: `${pt(0)} scale(1.3)`, offset: 0 },
      { transform: `${pt(0.25)} scale(1.5) rotate(-8deg)`, offset: 0.25 },
      { transform: `${pt(0.5)} scale(1.6) rotate(0deg)`, offset: 0.5 },
      { transform: `${pt(0.75)} scale(1.4) rotate(8deg)`, offset: 0.75 },
      { transform: `${pt(1)} scale(1.15, 0.8)`, offset: 0.92 },
      { transform: `${pt(1)} scale(1)`, offset: 1 },
    ], { duration, easing: 'cubic-bezier(.3,.1,.3,1)', fill: 'forwards' });
    anim.onfinish = () => {
      fly.style.display = 'none';
      if (real) { real.style.visibility = ''; real.animate([{ transform: 'translateY(-6px)' }, { transform: 'translateY(0)' }], { duration: 160, easing: 'ease-out' }); }
      ring();
      timers.push(window.setTimeout(done, 500));
    };
    return () => { anim.cancel(); fly.style.display = 'none'; if (real) real.style.visibility = ''; timers.forEach(clearTimeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [move?.key]);

  const t = toast;
  return (
    <div ref={layer} className="mi-fx">
      <svg className="mi-fx-fly" viewBox="0 0 48 48" aria-hidden><use href="#i-worker" /></svg>
      {t && (
        <div key={t.key} className="mi-fx-toast" role="status" aria-live="polite">
          <Worker seat={t.seat} size={22} />
          <span><b>{t.who ?? ''}</b>{t.who ? '：' : ''}{ACT[t.sid]?.name}{(t.gains && gainText(t.gains)) ? `（${gainText(t.gains)}）` : ''}{t.note ? `（${t.note}）` : ''}</span>
        </div>
      )}
    </div>
  );
}

/** 得たものが「+3 🪵」の形でスペースから浮かび上がって消える */
function floatGains(layer: HTMLElement, tr: DOMRect, gains: Cost, still: boolean) {
  const list = Object.entries(gains).filter(([, n]) => n) as [Res, number][];
  list.forEach(([r, n], i) => {
    const el = document.createElement('div');
    el.className = 'mi-fx-gain';
    el.innerHTML = `<svg width="20" height="20" aria-hidden="true"><use href="#${RES_ICON[r]}"/></svg><b>+${n}</b>`;
    el.style.left = `${tr.left + tr.width / 2 - 26 + (i - (list.length - 1) / 2) * 44}px`;
    el.style.top = `${tr.top + tr.height / 2 - 14}px`;
    layer.appendChild(el);
    const a = el.animate(still
      ? [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }]
      : [{ transform: 'translateY(6px) scale(.6)', opacity: 0 }, { transform: 'translateY(-8px) scale(1.1)', opacity: 1, offset: 0.25 },
         { transform: 'translateY(-26px) scale(1)', opacity: 1, offset: 0.75 }, { transform: 'translateY(-40px)', opacity: 0 }],
      { duration: 1100, delay: i * 90, easing: 'ease-out', fill: 'both' });
    a.onfinish = () => el.remove();
  });
}
