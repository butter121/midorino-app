import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import KiridaniApp from './KiridaniApp';
createRoot(document.getElementById('root')!).render(<StrictMode><KiridaniApp /></StrictMode>);

// ホーム画面に追加（インストール）できるように、公開版だけサービスワーカーを登録する
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
}
