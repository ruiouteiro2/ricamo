/** Bundle PDF.js support data at stable local paths. No CDN or runtime download. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

export function pdfAssets() {
  const require = createRequire(import.meta.url);
  const root = path.dirname(require.resolve('pdfjs-dist/package.json'));
  const allowed = { cmaps: /\.bcmap$/, standard_fonts: /\.(pfb|ttf)$/, wasm: /^(jbig2|openjpeg|qcms_bg)\.wasm$|^(jbig2|openjpeg)_nowasm_fallback\.js$/, iccs: /\.icc$/ };
  const assets = new Map();
  for (const [directory, pattern] of Object.entries(allowed)) {
    const folder = path.join(root, directory);
    for (const name of fs.readdirSync(folder)) if (pattern.test(name) || /^LICENSE(?:_|$)/.test(name)) assets.set(`/pdfjs/${directory}/${name}`, path.join(folder, name));
  }
  assets.set('/pdfjs/LICENSE', path.join(root, 'LICENSE'));
  return {
    name: 'ricamo-pdf-offline-assets',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = new URL(request.url, 'http://localhost').pathname, filename = assets.get(pathname);
        if (!filename) return next();
        response.setHeader('Content-Type', filename.endsWith('.js') ? 'text/javascript' : filename.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream');
        response.setHeader('Cache-Control', 'no-cache'); response.end(fs.readFileSync(filename));
      });
    },
    generateBundle() { for (const [name, filename] of assets) this.emitFile({ type: 'asset', fileName: name.slice(1), source: fs.readFileSync(filename) }); },
  };
}
