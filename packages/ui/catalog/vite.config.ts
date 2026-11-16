import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
// 2ページ：index.html（農場版の部品）と kiridani.html（霧谷の冒険者団の画面と演出）
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        kiridani: fileURLToPath(new URL('./kiridani.html', import.meta.url)),
      },
    },
  },
});
