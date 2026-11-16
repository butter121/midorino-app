import type { ReactNode } from 'react';

/**
 * ゲーム画面の骨組み。
 * - 横向き（基本）：上に状況バー（1行）、左端にプレイヤー、中央に村のボード、右に「自分の農場など（タブ）」と操作
 * - 縦向き（予備）：同じ部品を1列に並べ、上に「横にすると遊びやすい」案内
 */
export function GameLayout({ status, players, board, side, action, rotateHint = true }: {
  status: ReactNode; players: ReactNode; board: ReactNode; side: ReactNode; action?: ReactNode; rotateHint?: boolean;
}) {
  return (
    <div className="mi-root mi-game">
      {rotateHint && <p className="mi-rotate" role="note">📱↻ 横向きにすると、村全体が見渡せて遊びやすくなります</p>}
      <div className="mi-game-status">{status}</div>
      <main className="mi-game-main">
        <div className="mi-game-players">{players}</div>
        <div className="mi-game-board">{board}</div>
        <aside className="mi-game-side">
          <div className="mi-game-sidebody">{side}</div>
          {action && <div className="mi-game-action">{action}</div>}
        </aside>
      </main>
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; badge?: string }[]; value: T; onChange: (id: T) => void }) {
  return (
    <div className="mi-tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={t.id === value} className={t.id === value ? 'is-on' : ''} onClick={() => onChange(t.id)}>
          {t.label}{t.badge && <span className="mi-badge">{t.badge}</span>}
        </button>
      ))}
    </div>
  );
}

/** 手番の案内と決定ボタンの帯 */
export function ActionBar({ message, children, tone = 'normal' }: { message: ReactNode; children?: ReactNode; tone?: 'normal' | 'turn' | 'wait' }) {
  return (
    <div className={`mi-actionbar is-${tone}`} role="status" aria-live="polite">
      <div className="mi-actionbar-msg">{message}</div>
      <div className="mi-actionbar-btns">{children}</div>
    </div>
  );
}
