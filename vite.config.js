import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { pdfAssets } from './build/pdf-assets.mjs';
import {schemaStudioAssets} from './build/schema-studio.mjs';
import {catalogueImages} from './build/catalogue-images.mjs';

export default defineConfig({
  plugins: [catalogueImages(), vue({ template: { compilerOptions: { isCustomElement: tag => tag === 'selectedcontent' } } }), pdfAssets(), schemaStudioAssets()],
  base: './',
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  // desktop/protocol.mjs refuses assets over 32 MiB, so each large preview catalogue gets its own chunk.
  build: { target: 'es2022', chunkSizeWarningLimit: 1000, rollupOptions: { output: { manualChunks: id => id.match(/assets[\/](dmc-[a-z]+-previews|casa-product-previews|profilo-previews|mill-hill-previews).json/)?.[1] } } },
});
