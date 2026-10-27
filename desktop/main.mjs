import { app, BrowserWindow, ipcMain, dialog, session, Menu } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { mkdir, writeFile, readFile, rename, readdir, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { Repository } from './repository.mjs';
import { inspectBackup } from '../core/backup.mjs';
import { BACKUP_LIMIT, safeDisplayName } from '../core/files.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
if (process.env.RICAMO_DATA_DIR) app.setPath('userData', process.env.RICAMO_DATA_DIR);
const lock = app.requestSingleInstanceLock();
let window, repository, pendingRestore, automaticBackupTimer;
if (!lock) app.quit();
else {
  app.on('second-instance', () => { if (window?.isMinimized()) window.restore(); window?.focus(); });
  app.whenReady().then(start).catch(error => {
    dialog.showErrorBox('Ricamo', `Impossibile aprire i dati. I file esistenti sono stati conservati.\nUnable to open data. Existing files have been preserved.\n\n${error.code || 'storage_error'}`);
    app.quit();
  });
}

async function atomicWrite(path, content) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, content, { flag: 'wx' });
  try { await rename(temporary, path); } catch (error) { await unlink(temporary).catch(() => {}); throw error; }
}
async function localBackup(label = 'automatic') {
  const directory = join(app.getPath('userData'), 'backups');
  await mkdir(directory, { recursive: true });
  const text = await repository.backup();
  await inspectBackup(text);
  const path = join(directory, `${new Date().toISOString().replace(/[:.]/g, '-')}-${label}.ricamobackup`);
  await atomicWrite(path, text);
  await inspectBackup(await readFile(path, 'utf8'));
  const files = (await readdir(directory)).filter(name => name.endsWith('-automatic.ricamobackup')).sort().reverse();
  for (const name of files.slice(7)) await unlink(join(directory, name));
  return path;
}
function handle(channel, action) {
  ipcMain.handle(`ricamo:${channel}`, async (event, ...args) => {
    if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) return { ok: false, error: { code: 'unauthorized' } };
    try { return { ok: true, value: await action(...args) }; }
    catch (error) { return { ok: false, error: { code: error.code || 'storage_error', details: error.details ?? {} } }; }
  });
}
async function start() {
  repository = new Repository(join(app.getPath('userData'), 'ricamo.sqlite'));
  Menu.setApplicationMenu(null);
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const url = new URL(details.url);
    callback({ cancel: !['file:', 'data:', 'blob:', 'devtools:'].includes(url.protocol) });
  });
  window = new BrowserWindow({ width: 1440, height: 960, minWidth: 760, minHeight: 600, title: 'Ricamo', backgroundColor: '#f7f5f1', show: false,
    webPreferences: { preload: join(root, 'desktop', 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true, spellcheck: false, webviewTag: false } });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  handle('load', () => repository.load());
  handle('command', (command, revision) => {
    if (['attachment.add'].includes(command?.type)) throw Object.assign(new Error(), { code: 'unauthorized_command' });
    return repository.execute(command, revision);
  });
  handle('import-asset', (asset, revision) => repository.importAsset(asset, revision));
  handle('get-asset', id => repository.getAsset(id));
  handle('save-file', async ({ name, data }) => {
    name = safeDisplayName(name);
    if (!['.csv', '.tsv', '.json', '.ricamo', '.ricamobackup', '.pdf', '.png', '.txt'].includes(extname(name).toLowerCase())) throw Object.assign(new Error(), { code: 'invalid_file_type' });
    const bytes = typeof data === 'string' ? Buffer.from(data, 'utf8') : Buffer.from(data);
    if (bytes.length > BACKUP_LIMIT) throw Object.assign(new Error(), { code: 'file_too_large' });
    const choice = await dialog.showSaveDialog(window, { defaultPath: name, filters: [{ name: 'Ricamo', extensions: [extname(name).slice(1)] }] });
    if (choice.canceled) return false;
    await atomicWrite(choice.filePath, bytes);
    return true;
  });
  handle('backup', async () => {
    const choice = await dialog.showSaveDialog(window, { defaultPath: `Ricamo-${new Date().toISOString().slice(0, 10)}.ricamobackup`, filters: [{ name: 'Ricamo backup', extensions: ['ricamobackup'] }] });
    if (choice.canceled) return false;
    const text = await repository.backup();
    await inspectBackup(text);
    await atomicWrite(choice.filePath, text);
    await inspectBackup(await readFile(choice.filePath, 'utf8'));
    return true;
  });
  handle('inspect-restore', async text => {
    const prepared = await inspectBackup(text);
    pendingRestore = { token: randomUUID(), prepared, expires: Date.now() + 10 * 60_000 };
    return { token: pendingRestore.token, summary: prepared.summary, createdAt: prepared.createdAt };
  });
  handle('restore', async (token, revision) => {
    if (!pendingRestore || token !== pendingRestore.token || Date.now() > pendingRestore.expires) throw Object.assign(new Error(), { code: 'invalid_restore_token' });
    await localBackup('before-restore');
    const result = repository.restore(pendingRestore.prepared, revision);
    pendingRestore = null;
    return result;
  });
  handle('print', () => new Promise((resolve, reject) => window.webContents.print({ silent: false, printBackground: true }, (success, reason) => success ? resolve(true) : reject(Object.assign(new Error(reason), { code: 'print_failed' })))));
  await window.loadFile(join(root, 'dist', 'index.html'));
  window.show();
  automaticBackupTimer = setInterval(() => { localBackup().catch(() => { /* Manual backup remains available; data is never discarded. */ }); }, 30 * 60_000);
  window.on('closed', () => { window = null; });
}
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => { clearInterval(automaticBackupTimer); repository?.close(); repository = null; });
