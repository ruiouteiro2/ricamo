import { app, BrowserWindow, ipcMain, dialog, session, Menu, protocol } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Repository } from './repository.mjs';
import { inspectBackup } from '../core/backup.mjs';
import { BACKUP_LIMIT, safeDisplayName, boundedBytes } from '../core/files.mjs';
import { createAssetHandler } from './protocol.mjs';
import { atomicWrite } from './filesystem.mjs';
import { BackupManager, writeBackup } from './backup-manager.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
protocol.registerSchemesAsPrivileged([{ scheme: 'ricamo', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
if (process.env.RICAMO_DATA_DIR) app.setPath('userData', process.env.RICAMO_DATA_DIR);
const lock = app.requestSingleInstanceLock();
let window, repository, pendingRestore, backupManager;
if (!lock) app.quit();
else {
  app.on('second-instance', () => { if (window?.isMinimized()) window.restore(); window?.focus(); });
  app.whenReady().then(start).catch(error => {
    dialog.showErrorBox('Ricamo', `Impossibile aprire i dati. I file esistenti sono stati conservati.\nUnable to open data. Existing files have been preserved.\n\n${error.code || 'storage_error'}`);
    app.quit();
  });
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
  backupManager = new BackupManager(repository, app.getPath('userData'));
  await backupManager.initialise();
  protocol.handle('ricamo', await createAssetHandler(join(root, 'dist')));
  Menu.setApplicationMenu(null);
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const url = new URL(details.url);
    callback({ cancel: !['ricamo:', 'data:', 'blob:', 'devtools:'].includes(url.protocol) || (url.protocol === 'ricamo:' && url.host !== 'app') });
  });
  window = new BrowserWindow({ width: 1440, height: 960, minWidth: 760, minHeight: 600, title: 'Ricamo', backgroundColor: '#f7f5f1', show: false,
    webPreferences: { preload: join(root, 'desktop', 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true, spellcheck: false, webviewTag: false } });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  handle('load', () => repository.load());
  handle('backup-status', () => backupManager.status());
  handle('configure-backup', patch => backupManager.configure(patch));
  handle('choose-backup-folder', async remove => {
    if (remove === true) return backupManager.chooseExternal(null);
    const choice = await dialog.showOpenDialog(window, { properties: ['openDirectory', 'createDirectory'] });
    return choice.canceled ? backupManager.status() : backupManager.chooseExternal(choice.filePaths[0]);
  });
  handle('run-backup', () => backupManager.run());
  handle('command', (command, revision) => {
    if (['attachment.add'].includes(command?.type)) throw Object.assign(new Error(), { code: 'unauthorized_command' });
    return repository.execute(command, revision);
  });
  handle('import-asset', (asset, revision) => repository.importAsset(asset, revision));
  handle('get-asset', id => repository.getAsset(id));
  handle('save-file', async ({ name, data }) => {
    name = safeDisplayName(name);
    if (!['.csv', '.tsv', '.json', '.ricamo', '.ricamopattern', '.ricamoproject', '.ricamobackup', '.pdf', '.png', '.txt'].includes(extname(name).toLowerCase())) throw Object.assign(new Error(), { code: 'invalid_file_type' });
    if (typeof data === 'string' && Buffer.byteLength(data, 'utf8') > BACKUP_LIMIT) throw Object.assign(new Error(), { code: 'file_too_large' });
    const bytes = typeof data === 'string' ? Buffer.from(data, 'utf8') : boundedBytes(data, BACKUP_LIMIT);
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
    await writeBackup(choice.filePath, text);
    await backupManager.recordManual(choice.filePath);
    return true;
  });
  handle('inspect-restore', async text => {
    const prepared = await inspectBackup(text);
    pendingRestore = { token: randomUUID(), prepared, expires: Date.now() + 10 * 60_000 };
    return { token: pendingRestore.token, summary: prepared.summary, createdAt: prepared.createdAt };
  });
  handle('restore', async (token, revision) => {
    if (!pendingRestore || token !== pendingRestore.token || Date.now() > pendingRestore.expires) throw Object.assign(new Error(), { code: 'invalid_restore_token' });
    const prepared = pendingRestore.prepared;
    pendingRestore = null;
    await backupManager.run('before-restore');
    return repository.restore(prepared, revision);
  });
  handle('print', () => new Promise((resolve, reject) => window.webContents.print({ silent: false, printBackground: true }, (success, reason) => success ? resolve(true) : reject(Object.assign(new Error(reason), { code: 'print_failed' })))));
  await window.loadURL('ricamo://app/index.html');
  window.show();
  backupManager.start();
  window.on('closed', () => { window = null; });
}
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => { backupManager?.stop(); repository?.close(); repository = null; });
