import { createProjectPackage, inspectProjectPackage, previewProjectImport, projectExportManifest, projectImportAssets, projectImportCommand, importedProjectId } from '../core/project-package.mjs';
import { createState, executeCommand } from '../core/application.mjs';
import { createBackup, inspectBackup } from '../core/backup.mjs';
import { detectFile, safeDisplayName, digestBytes, boundedBytes } from '../core/files.mjs';

function failure(code) { return Object.assign(new Error(code), { code }); }
const request = value => new Promise((resolve, reject) => { value.onsuccess = () => resolve(value.result); value.onerror = () => reject(value.error); });
let database;
async function db() {
  if (database) return database;
  database = new Promise((resolve, reject) => {
    const opening = indexedDB.open('ricamo-studio', 1);
    opening.onupgradeneeded = () => {
      const store = opening.result.createObjectStore('state');
      store.put(createState(), 'current');
      opening.result.createObjectStore('assets', { keyPath: 'id' });
      opening.result.createObjectStore('recovery');
    };
    opening.onsuccess = () => resolve(opening.result);
    opening.onerror = () => reject(opening.error);
    opening.onblocked = () => reject(failure('storage_blocked'));
  });
  return database;
}
async function mutate(action) {
  const connection = await db();
  return new Promise((resolve, reject) => {
    const transaction = connection.transaction(['state', 'assets', 'recovery'], 'readwrite');
    let value, error;
    const current = transaction.objectStore('state').get('current');
    current.onsuccess = () => {
      try { value = action(current.result, transaction); }
      catch (caught) { error = caught; transaction.abort(); }
    };
    transaction.oncomplete = () => resolve(value);
    transaction.onabort = transaction.onerror = () => reject(error || transaction.error || failure('storage_error'));
  });
}
function writeCommand(state, transaction, command, revision) {
  if (!state.operations.some(row => row.id === command.operationId) && state.revision !== revision) throw failure('stale_revision');
  const next = executeCommand(state, command);
  transaction.objectStore('state').put(next, 'current');
  return next;
}
let pendingRestore, pendingProject, pendingProjectTimer;
const browser = {
  async load() { return request((await db()).transaction('state').objectStore('state').get('current')); },
  command(command, revision) {
    if (['attachment.add','project.package.import'].includes(command.type)) throw failure('unauthorized_command');
    return mutate((state, tx) => writeCommand(state, tx, command, revision));
  },
  async importAsset({ name, data, operationId }, revision) {
    const bytes = boundedBytes(data), mime = detectFile(bytes), digest = await digestBytes(bytes);
    return mutate((state, tx) => {
      const existing = state.attachments.find(row => row.digest === digest);
      if (existing) return { state, asset: existing, duplicate: true };
      const asset = { id: crypto.randomUUID(), name: safeDisplayName(name), size: bytes.length, mime, digest };
      const next = writeCommand(state, tx, { type: 'attachment.add', payload: asset, operationId }, revision);
      tx.objectStore('assets').put({ id: asset.id, data: bytes });
      return { state: next, asset, duplicate: false };
    });
  },
  async getAsset(id) {
    const asset = await request((await db()).transaction('assets').objectStore('assets').get(id));
    if (!asset) throw failure('file_not_found');
    return asset.data;
  },
  async saveFile({ name, data }) {
    const url = URL.createObjectURL(new Blob([data]));
    const link = document.createElement('a'); link.href = url; link.download = safeDisplayName(name); link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return true;
  },
  async backupText() {
    const tx = (await db()).transaction(['state', 'assets']);
    const [state, assets] = await Promise.all([request(tx.objectStore('state').get('current')), request(tx.objectStore('assets').getAll())]);
    return createBackup(state, assets);
  },
  async backup() { return browser.saveFile({ name: `Ricamo-${new Date().toISOString().slice(0, 10)}.ricamobackup`, data: await browser.backupText() }); },
  async inspectRestore(text) {
    const prepared = await inspectBackup(text);
    pendingRestore = { token: crypto.randomUUID(), prepared };
    return { token: pendingRestore.token, summary: prepared.summary, createdAt: prepared.createdAt };
  },
  async restore(token, revision) {
    if (!pendingRestore || pendingRestore.token !== token) throw failure('invalid_restore_token');
    const prepared = pendingRestore.prepared;
    pendingRestore = null;
    const oldBackup = await browser.backupText();
    const next = await mutate((state, tx) => {
      if (state.revision !== revision) throw failure('stale_revision');
      tx.objectStore('recovery').put(oldBackup, 'before-restore');
      tx.objectStore('assets').clear();
      for (const asset of prepared.assets) tx.objectStore('assets').put(asset);
      const next = structuredClone(prepared.state); next.revision = state.revision + 1;
      tx.objectStore('state').put(next, 'current');
      return next;
    });
    return next;
  },
async exportProject(projectId, options = {}) {
  const connection = await db();
  const { state, assets } = await new Promise((resolve, reject) => {
    const tx = connection.transaction(['state', 'assets']);
    let state, error; const assets = [];
    const current = tx.objectStore('state').get('current');
    current.onsuccess = () => {
      try {
        state = current.result;
        const manifest = projectExportManifest(state, projectId, options);
        const ids = new Set([...manifest.requiredAttachmentIds, ...(options.attachmentIds || [])]);
        for (const id of ids) {
          const read = tx.objectStore('assets').get(id);
          read.onsuccess = () => { if (read.result) assets.push(read.result); };
        }
      } catch (caught) { error = caught; tx.abort(); }
    };
    tx.oncomplete = () => resolve({ state, assets });
    tx.onerror = tx.onabort = () => reject(error || tx.error || failure('storage_error'));
  });
  return createProjectPackage(state, projectId, assets, options);
},
async inspectProject(text) {
  const prepared = await inspectProjectPackage(text), state = await browser.load();
  const token = crypto.randomUUID();
  clearTimeout(pendingProjectTimer);
  pendingProject = { token, prepared, operationId: crypto.randomUUID(), expires: Date.now() + 10 * 60_000 };
  pendingProjectTimer = setTimeout(() => { if (pendingProject?.token === token) pendingProject = null; }, 10 * 60_000);
  return { token, revision: state.revision, preview: previewProjectImport(state, prepared) };
},
async importProject(token, decisions, revision) {
  if (!pendingProject || pendingProject.token !== token || Date.now() > pendingProject.expires) throw failure('invalid_project_token');
  const captured = pendingProject; pendingProject = null; clearTimeout(pendingProjectTimer); pendingProjectTimer = null;
  return mutate((state, tx) => {
    const command = projectImportCommand(captured.prepared, decisions, captured.operationId, revision);
    const assets = projectImportAssets(state, captured.prepared, captured.operationId);
    const next = writeCommand(state, tx, command, revision);
    if (next.revision !== state.revision) for (const asset of assets) tx.objectStore('assets').add(asset);
    return { state: next, projectId: importedProjectId(captured.operationId) };
  });
},

  async print() { window.print(); return true; },
};

export const desktop = Boolean(window.ricamo);
export const storage = desktop ? Object.fromEntries(Object.keys(window.ricamo).filter(method => method !== 'onCloseRequest').map(method => [method, async (...args) => {
  const result = await window.ricamo[method](...args);
  if (!result.ok) throw Object.assign(new Error(result.error.code), result.error);
  return result.value;
}])) : browser;
