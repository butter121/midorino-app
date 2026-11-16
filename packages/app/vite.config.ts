import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// base: './' にして、どこに置いても（Netlify・GitHub Pages のサブフォルダでも）動くようにする
export default defineConfig({ base: './', plugins: [react()] });
