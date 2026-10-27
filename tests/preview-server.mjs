import { preview } from 'vite';
// Isolate Vite's own process signal handlers from the coordinator and its test children.
if (!process.send) throw new Error('The preview worker must be started by run-browser.mjs.');
const server = await preview({ root: process.argv[2], logLevel: 'error', preview: { host: '127.0.0.1', port: 0, strictPort: true, open: false } });
let closing;
function close() {
  closing ??= server.close().then(() => { process.exitCode = 0; if (process.connected) process.disconnect(); });
  return closing;
}
process.on('message', message => { if (message === 'close') void close(); });
process.once('disconnect', () => { void close(); });
const address = server.httpServer.address();
if (!address || typeof address === 'string') throw new Error('Preview did not bind a TCP port.');
process.send({ type: 'ready', url: `http://127.0.0.1:${address.port}` });
