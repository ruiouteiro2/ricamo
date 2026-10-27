import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { pdfAssets } from './build/pdf-assets.mjs';

export default defineConfig({
  plugins: [vue(), pdfAssets()],
  base: './',
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 1000 },
});
