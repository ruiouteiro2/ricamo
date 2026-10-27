import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const previewWorker = fileURLToPath(new URL('./preview-server.mjs', import.meta.url));

function start(args, root, env, ipc = false) {
  const child = spawn(process.execPath, args, { cwd: root, env, shell: false, detached: process.platform !== 'win32', stdio: ipc ? ['ignore', 'inherit', 'inherit', 'ipc'] : 'inherit' });
  child.done = new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', (code, signal) => resolve({ code, signal })); });
  // A failed startup must remain handled while readiness is pending.
  child.done.catch(() => {});
  return child;
}
async function stop(child, graceful = false) {
  if (!child || !child.pid || child.exitCode !== null || child.signalCode !== null) return;
  if (graceful && child.connected) child.send('close');
  else if (process.platform === 'win32') {
    await new Promise(resolve => { const killer = spawn('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore', shell: false }); killer.once('error', resolve); killer.once('exit', resolve); });
  } else { try { process.kill(-child.pid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') throw error; } }
  const force = setTimeout(() => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    if (process.platform === 'win32') child.kill('SIGKILL');
    else { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }
  }, 4000);
  try { await child.done.catch(() => {}); } finally { clearTimeout(force); }
}

/** Each script gets fresh browser storage and the same owned production preview. */
export async function runBrowserTests({ root = projectRoot, scripts = ['tests/browser-inventory.mjs', 'tests/browser-tools.mjs'], buildFrontend = true, signal, onReady = () => {} } = {}) {
  let child, server;
  const check = () => { if (signal?.aborted) throw signal.reason ?? new Error('Browser tests interrupted.'); };
  const abort = () => { void stop(child).catch(() => {}); };
  signal?.addEventListener('abort', abort);
  try {
    check();
    if (buildFrontend) {
      child = start([join(projectRoot, 'node_modules/vite/bin/vite.js'), 'build'], root, process.env);
      const result = await child.done; check();
      if (result.code !== 0) throw Object.assign(new Error(`Production build failed (${result.signal ?? result.code}).`), { exitCode: result.code || 1 });
      child = null;
    }
    server = start([previewWorker, root], root, process.env, true);
    let timeout;
    const ready = once(server, 'message');
    const message = await Promise.race([ready.then(([value]) => value), server.done.then(result => { throw new Error(`Preview stopped before readiness (${result.signal ?? result.code}).`); }), new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Preview did not start within 20 seconds.')), 20000); })]).finally(() => clearTimeout(timeout));
    if (message?.type !== 'ready' || !/^http:\/\/127\.0\.0\.1:\d+$/.test(message.url)) throw new Error('Invalid preview readiness message.');
    check(); onReady(message.url); console.log(`Ricamo browser tests: ${message.url}`);
    for (const script of scripts) {
      check(); console.log(`Running ${script}`);
      child = start([resolve(root, script)], root, { ...process.env, RICAMO_TEST_URL: message.url });
      const result = await child.done; check();
      if (result.code !== 0) throw Object.assign(new Error(`${script} failed (${result.signal ?? result.code}).`), { exitCode: result.code || 1 });
      child = null;
    }
  } finally {
    signal?.removeEventListener('abort', abort);
    try { await stop(child); } finally { await stop(server, true); }
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const controller = new AbortController(); let interrupted;
  const onSignal = signal => { interrupted = signal; controller.abort(new Error(`Interrupted by ${signal}.`)); };
  process.on('SIGINT', onSignal); process.on('SIGTERM', onSignal);
  try { await runBrowserTests({ signal: controller.signal }); }
  catch (error) { console.error(error.message); process.exitCode = interrupted === 'SIGINT' ? 130 : interrupted === 'SIGTERM' ? 143 : error.exitCode || 1; }
  finally { process.off('SIGINT', onSignal); process.off('SIGTERM', onSignal); }
}
