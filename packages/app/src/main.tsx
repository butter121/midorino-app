import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '@midorino/ui/src/styles/ui.css';
import './styles.css';
import { IconSprite } from '@midorino/ui';
createRoot(document.getElementById('root')!).render(<StrictMode><IconSprite /><App /></StrictMode>);

// ホーム画面に追加（インストール）できるように、公開版だけサービスワーカーを登録する
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
}
