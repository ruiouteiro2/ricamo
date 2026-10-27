import { initialWindowBounds } from './window-bounds.mjs';
import { BrowserWindow, ipcMain, session, dialog, screen } from 'electron';
import { join } from 'node:path';
import { createAssetHandler } from './protocol.mjs';

/** An isolated browser-backed example window. No Repository is accepted or exposed. */
export function createExampleStudio({ owner, root }) {
  let window, opening, prepared, closeGuard = false, closeAuthorized = false, closingOwner = false, language = 'it';
  function handle(channel, action) {
    ipcMain.handle(`ricamo-example:${channel}`, async (event, ...args) => {
      if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) return { ok: false, error: { code: 'unauthorized' } };
      try { return { ok: true, value: await action(...args) }; }
      catch (error) { return { ok: false, error: { code: error.code || 'storage_error' } }; }
    });
  }
  // Destroying an owner destroys its children before their normal close guard runs.
  // Let the example finish its own draft handshake before resuming the owner close.
  owner.on('close', event => {
    if (!window || window.isDestroyed()) return;
    event.preventDefault(); closingOwner = true; window.close();
  });
  handle('set-close-guard', value => { if (typeof value !== 'boolean') throw Object.assign(new Error(), { code: 'invalid_payload' }); closeGuard = value; return true; });
  handle('cancel-close', () => { closingOwner = false; closeAuthorized = false; return true; });
  handle('close', () => { window.close(); return true; });
  handle('finish-close', () => { closeAuthorized = true; closeGuard = false; setImmediate(() => window?.close()); return true; });
  async function exampleSession() {
    prepared ??= (async () => {
      const isolated = session.fromPartition('persist:ricamo-example');
      await isolated.protocol.handle('ricamo', await createAssetHandler(join(root, 'dist')));
      isolated.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
      isolated.setPermissionCheckHandler(() => false);
      isolated.webRequest.onBeforeRequest((details, callback) => {
        const url = new URL(details.url);
        callback({ cancel: !['ricamo:', 'data:', 'blob:', 'devtools:'].includes(url.protocol) || (url.protocol === 'ricamo:' && url.host !== 'app') });
      });
      return isolated;
    })();
    return prepared;
  }
  return {
    async open(locale = 'it') {
      if (window && !window.isDestroyed()) { window.focus(); return true; }
      if (opening) return opening;
      opening = (async () => {
        language = locale === 'en' ? 'en' : 'it'; closeGuard = false; closeAuthorized = false;
        const isolated = await exampleSession();
        window = new BrowserWindow({ parent: owner, modal: true, ...initialWindowBounds(screen.getDisplayMatching(owner.getBounds()).workArea, { width: 1360, height: 920 }), title: language === 'en' ? 'Ricamo — example studio' : 'Ricamo — atelier di esempio', backgroundColor: '#f7f5f1', show: false,
          webPreferences: { session: isolated, preload: join(root, 'desktop', 'example-preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true, spellcheck: false, webviewTag: false } });
        window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
        window.webContents.on('will-navigate', event => event.preventDefault());
        window.webContents.on('will-attach-webview', event => event.preventDefault());
        window.on('close', event => { if (closeGuard && !closeAuthorized) { event.preventDefault(); window.webContents.send('ricamo-example:request-close'); } });
        window.webContents.on('will-prevent-unload', event => {
          if (closeAuthorized) { event.preventDefault(); return; }
          const response = dialog.showMessageBoxSync(window, { type: 'question', buttons: language === 'en' ? ['Keep working', 'Close without saving'] : ['Continua a lavorare', 'Chiudi senza salvare'], defaultId: 0, cancelId: 0,
            message: language === 'en' ? 'Example changes are still being saved.' : 'Le modifiche dell’esempio sono ancora in salvataggio.' });
          if (response === 1) event.preventDefault(); else closingOwner = false;
        });
        window.on('closed', () => {
          window = null;
          const resumeClose = closingOwner; closingOwner = false;
          if (!owner.isDestroyed()) {
            if (resumeClose) setImmediate(() => { if (!owner.isDestroyed()) owner.close(); });
            else owner.focus();
          }
        });
        try {
          await window.loadURL(`ricamo://app/index.html?example=1&language=${language}`);
          window.show(); return true;
        } catch (error) {
          if (window && !window.isDestroyed()) window.destroy();
          throw error;
        }
      })().finally(() => { opening = null; });
      return opening;
    },
  };
}
