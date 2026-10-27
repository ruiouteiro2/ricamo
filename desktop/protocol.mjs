import { realpath, readFile, stat } from 'node:fs/promises';
import { resolve, relative, isAbsolute, extname } from 'node:path';

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.bcmap': 'application/octet-stream', '.pfb': 'application/octet-stream', '.ttf': 'font/ttf', '.bin': 'application/octet-stream' };
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; frame-src 'self' blob:; base-uri 'none'; form-action 'none'";

/** The renderer can request bundled public assets, never arbitrary local files. */
export async function createAssetHandler(directory) {
  const root = await realpath(directory);
  return async request => {
    try {
      const url = new URL(request.url);
      if (url.protocol !== 'ricamo:' || url.host !== 'app' || !['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 403 });
      const pathname = decodeURIComponent(url.pathname);
      if (pathname.includes('\\') || pathname.includes('\0')) return new Response(null, { status: 403 });
      const candidate = await realpath(resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`));
      const within = relative(root, candidate);
      if (!within || within.startsWith('..') || isAbsolute(within)) return new Response(null, { status: 403 });
      const type = TYPES[extname(candidate).toLowerCase()];
      if (!type) return new Response(null, { status: 403 });
      const info = await stat(candidate);
      if (!info.isFile() || info.size > 32 * 1024 * 1024) return new Response(null, { status: 403 });
      return new Response(request.method === 'HEAD' ? null : await readFile(candidate), { headers: {
        'Content-Type': type, 'Content-Length': String(info.size), 'Content-Security-Policy': CSP,
        'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'same-origin',
      } });
    } catch { return new Response(null, { status: 404 }); }
  };
}
