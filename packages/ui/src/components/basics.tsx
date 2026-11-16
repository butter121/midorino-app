import type { ReactNode } from 'react';
import { JP, type Res } from '@midorino/engine';
import { SPRITE, type IconName } from '../icons';

/** アプリの一番外側に1回だけ置く（アイコンの定義） */
export function IconSprite() {
  return <div aria-hidden style={{ display: 'none' }} dangerouslySetInnerHTML={{ __html: `<svg xmlns="http://www.w3.org/2000/svg">${SPRITE}</svg>` }} />;
}

/** label を渡すと読み上げ用の名前になる（渡さなければ飾り扱い） */
export function Icon({ name, size = 24, label, color, className }: { name: IconName; size?: number; label?: string; color?: string; className?: string }) {
  return (
    <svg width={size} height={size} className={className} style={color ? { color } : undefined}
      role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <use href={`#${name}`} />
    </svg>
  );
}

export const RES_ICON: Record<Res, IconName> = {
  wood: 'i-wood', clay: 'i-clay', stone: 'i-stone', grain: 'i-grain', veg: 'i-veg',
  sheep: 'i-sheep', pig: 'i-pig', cattle: 'i-cattle', food: 'i-food', coin: 'i-coin',
};

// ---- プレイヤーの色と印（色だけに頼らない） ----
export const PLAYER_COLORS = ['var(--mi-p0)', 'var(--mi-p1)', 'var(--mi-p2)', 'var(--mi-p3)', 'var(--mi-p4)', 'var(--mi-p5)'];
export const PLAYER_COLOR_NAMES = ['朱', '青', '黄', '緑', '桃', '空'];
export const PLAYER_MARKS = ['●', '▲', '■', '★', '◆', '✚'];
const MARK_PATH = [
  'M0-4.5a4.5 4.5 0 1 0 .01 0z',
  'M0-5L5 4H-5z',
  'M-4.2-4.2h8.4v8.4h-8.4z',
  'M0-5.5l1.6 3.4 3.7.5-2.7 2.6.7 3.7L0 3 -3.3 4.7l.7-3.7-2.7-2.6 3.7-.5z',
  'M0-5.5L5 0 0 5.5-5 0z',
  'M-1.8-5h3.6v3.2H5v3.6H1.8V5h-3.6V1.8H-5v-3.6h3.2z',
];

/** 家族コマ（プレイヤーの色＋胸の印） */
export function Worker({ seat, size = 32, dim = false, label }: { seat: number; size?: number; dim?: boolean; label?: string }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} style={{ color: dim ? '#C9C4B8' : PLAYER_COLORS[seat % 6] }}
      role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <use href="#i-worker" />
      {!dim && <path d={MARK_PATH[seat % 6]} transform="translate(24 37)" fill="#fff" stroke="#2B3A3A" strokeWidth={1.2} strokeLinejoin="round" />}
    </svg>
  );
}

/** アイコン＋数（読み上げ：「木材 3」） */
export function ResCount({ res, n, size = 24, showZero = true, signed = false }: { res: Res; n: number; size?: number; showZero?: boolean; signed?: boolean }) {
  if (!showZero && n === 0) return null;
  return (
    <span className={`mi-rc${n === 0 ? ' is-zero' : ''}`} aria-label={`${JP[res]} ${n}`}>
      <Icon name={RES_ICON[res]} size={size} />
      <b aria-hidden>{signed && n > 0 ? '+' : ''}{n}</b>
    </span>
  );
}

export function Button({ children, onClick, kind = 'normal', disabled, wide }: {
  children: ReactNode; onClick?: () => void; kind?: 'normal' | 'primary' | 'danger'; disabled?: boolean; wide?: boolean;
}) {
  return <button type="button" className={`mi-btn is-${kind}${wide ? ' is-wide' : ''}`} onClick={onClick} disabled={disabled}>{children}</button>;
}

export function Tag({ children, tone = 'ink' }: { children: ReactNode; tone?: 'ink' | 'bad' | 'warn' | 'leaf' | 'spring' | 'summer' | 'autumn' | 'winter' }) {
  return <span className={`mi-tag is-${tone}`}>{children}</span>;
}
