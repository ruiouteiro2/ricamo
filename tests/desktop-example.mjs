import { _electron as electron, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectBackup } from '../core/backup.mjs';
import { Repository } from '../desktop/repository.mjs';
import { EXAMPLE_IDS } from '../core/example-studio.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
mkdirSync(join(root, '.runtime'), { recursive: true });
const data = mkdtempSync(join(root, '.runtime', 'example-studio-'));
const executable = process.env.RICAMO_EXECUTABLE || join(root, 'node_modules/electron/dist', process.platform === 'win32' ? 'electron.exe' : 'electron');
const dictionary = JSON.parse(readFileSync(join(root, 'src/i18n-extra.json'), 'utf8')), en = key => dictionary[key][1];
const errors = [], remoteRequests = [], checks = [];
let app, page, demo;
function observe(target) { target.setDefaultTimeout(12000); target.on('pageerror', error => errors.push(error.message)); target.on('request', request => { if (/^(?:https?|wss?):/.test(request.url())) remoteRequests.push(request.url()); }); }
async function launch() {
  const env = { ...process.env, RICAMO_DATA_DIR: data }; delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS;
  app = await electron.launch({ chromiumSandbox: true, executablePath: resolve(executable), args: process.env.RICAMO_EXECUTABLE ? [] : [root], env, timeout: 40000 });
  page = await app.firstWindow(); observe(page); await expect(page.locator('h1').first()).toBeVisible();
}
const normalState = async () => { const response = await page.evaluate(() => window.ricamo.load()); assert.equal(response.ok, true); return response.value; };
const demoState = target => target.evaluate(async () => {
  const database = await new Promise((resolve, reject) => { const request = indexedDB.open('ricamo-example-studio'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
  try { return await new Promise((resolve, reject) => { const request = database.transaction('state').objectStore('state').get('current'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); } finally { database.close(); }
});
const nav = (target, name) => target.locator('.sidebar').getByRole('button', { name, exact: true }).click();
async function openExample() {
  await nav(page, 'Help'); const opened = app.waitForEvent('window');
  await page.getByRole('button', { name: en('openExampleStudio'), exact: true }).click();
  demo = await opened; observe(demo); await expect(demo.getByRole('button', { name: en('returnToMyStudio'), exact: true })).toBeVisible();
  await expect(demo.getByRole('button', { name: en('exampleReviewStock'), exact: true })).toBeVisible();
  return demo;
}
try {
  await launch(); await page.locator('.topbar').getByRole('combobox').selectOption('en');
  await expect(page.getByRole('heading', { name: en('firstStudioTitle'), exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add material', exact: true }).click();
  let dialog = page.getByRole('dialog'); await dialog.getByLabel('Name', { exact: false }).fill('Personal cotton');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click(); await expect(dialog).toHaveCount(0);
  const original = await normalState(); assert.equal(original.materials.length, 1); assert.equal(original.patterns.length, 0);
  checks.push('First-start guidance leads to a real material save');
  await openExample();
  const bridge = await demo.evaluate(() => ({ normal: typeof window.ricamo, node: typeof window.require, process: typeof window.process, methods: Object.keys(window.ricamoExample).sort() }));
  assert.deepEqual(bridge, { normal: 'undefined', node: 'undefined', process: 'undefined', methods: ['cancelClose', 'close', 'finishClose', 'onCloseRequest', 'setCloseGuard'] });
  const isolation = await app.evaluate(({ BrowserWindow }) => {
    const windows = BrowserWindow.getAllWindows(), example = windows.find(row => row.webContents.getURL().includes('?example=1')), owner = windows.find(row => row !== example);
    const prefs = example.webContents.getLastWebPreferences(); return { differentSession: owner.webContents.session !== example.webContents.session, sandbox: prefs.sandbox, contextIsolation: prefs.contextIsolation, nodeIntegration: prefs.nodeIntegration, modal: example.isModal() };
  });
  assert.deepEqual(isolation, { differentSession: true, sandbox: true, contextIsolation: true, nodeIntegration: false, modal: true });
  const initial = await demoState(demo); assert.equal(initial.materials.length, 5); assert.equal(initial.settings.language, 'en');
  const lot = initial.lots.find(row => row.materialId === EXAMPLE_IDS.known); assert.equal(lot.quantity, 7.5);
  assert.equal(initial.reservations.find(row => row.lotId === lot.id).quantity, 1.5);
  assert.equal(initial.lots.find(row => row.materialId === EXAMPLE_IDS.unknown).quantity, null);
  assert.deepEqual(await normalState(), original);
  checks.push('Example has separate native session, IndexedDB and restricted preload; personal SQLite unchanged');
  await demo.getByRole('button', { name: en('exampleReviewStock'), exact: true }).click();
  await demo.locator('.page-header').getByRole('button', { name: 'Edit', exact: true }).click();
  dialog = demo.getByRole('dialog'); await dialog.getByLabel('Name', { exact: false }).fill('Changed only in the example');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click(); await expect(dialog).toHaveCount(0);
  await nav(demo, 'My studio');
  await demo.getByRole('button', { name: en('exampleOpenProject'), exact: true }).click();
  await demo.locator('.page-header').getByRole('button', { name: 'Stitch', exact: true }).click();
  const canvas = demo.locator('canvas'); await canvas.focus();
  for (let index = 0; index < 4; index++) await canvas.press('ArrowRight');
  for (let index = 0; index < 3; index++) await canvas.press('ArrowDown');
  await canvas.press('Space'); await expect.poll(async () => (await demoState(demo)).projects[0].completed.length).toBe(9);
  const worked = await demoState(demo); assert.deepEqual(worked.lots, initial.lots); assert.deepEqual(worked.reservations, initial.reservations);
  checks.push('Real sample project progress saves without consuming or releasing stock');
  await nav(demo, 'My studio');
  await demo.getByRole('button', { name: en('exampleEditPattern'), exact: true }).click();
  await expect(demo.getByRole('textbox', { name: 'Notes', exact: true })).toBeVisible();
  await demo.getByRole('textbox', { name: 'Notes', exact: true }).fill('Keep this example draft on native close.');
  const closed = demo.waitForEvent('close');
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(row => row.webContents.getURL().includes('?example=1')).close()); await closed;
  assert.deepEqual(await normalState(), original);
  await openExample(); let retained = await demoState(demo);
  assert.equal(retained.materials.find(row => row.id === EXAMPLE_IDS.known).name, 'Changed only in the example');
  assert.equal(retained.patterns[0].draft.revision.notes, 'Keep this example draft on native close.');
  assert.equal(retained.patterns[0].revisions[0].notes, initial.patterns[0].revisions[0].notes); assert.equal(retained.patterns[0].currentRevisionId, initial.patterns[0].currentRevisionId);
  assert.deepEqual(retained.lots, initial.lots); assert.deepEqual(retained.reservations, initial.reservations);
  checks.push('Actual material edit and pending pattern draft survive native close/reopen without reseeding or changing stock');
  await demo.screenshot({ path: join(data, 'example.png'), fullPage: true });
  let close = demo.waitForEvent('close'); await demo.getByRole('button', { name: en('returnToMyStudio'), exact: true }).click(); await close;
  await nav(page, 'Settings'); const backupPath = join(data, 'personal.ricamobackup');
  await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, backupPath);
  await page.getByRole('button', { name: 'Create a backup', exact: true }).click();
  await expect.poll(() => { try { return readFileSync(backupPath, 'utf8').length > 0; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } }).toBe(true);
  const backup = await inspectBackup(readFileSync(backupPath, 'utf8')); assert.deepEqual(backup.state, original); assert.equal(JSON.stringify(backup.state).includes('example-'), false);
  checks.push('Actual native personal backup excludes example records and preferences');
  await app.close(); app = null;
  const repository = new Repository(join(data, 'ricamo.sqlite')); try { assert.deepEqual(repository.load(), original); } finally { repository.close(); }
  await launch(); await openExample(); retained = await demoState(demo);
  assert.equal(retained.materials.find(row => row.id === EXAMPLE_IDS.known).name, 'Changed only in the example');
  assert.equal(retained.patterns[0].draft.revision.notes, 'Keep this example draft on native close.');
  assert.deepEqual(await normalState(), original);
  checks.push('Separate example edits persist across complete Electron restart; normal SQLite readback stays identical');
  await demo.getByRole('button', { name: en('exampleEditPattern'), exact: true }).click();
  await demo.getByRole('dialog').getByRole('button', { name: 'Resume draft', exact: true }).click();
  await demo.getByRole('textbox', { name: 'Notes', exact: true }).fill('Flush the example when its owner window closes.');
  const exited = app.waitForEvent('close', { timeout: 15000 });
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(row => !row.webContents.getURL().includes('?example=1')).close()); await exited; app = null;
  await launch(); await openExample(); retained = await demoState(demo);
  assert.equal(retained.patterns[0].draft.revision.notes, 'Flush the example when its owner window closes.');
  assert.deepEqual(await normalState(), original);
  checks.push('Closing the owner window also preserves the pending example draft');
  await demo.getByRole('button', { name: en('exampleEditPattern'), exact: true }).click();
  await demo.getByRole('dialog').getByRole('button', { name: 'Resume draft', exact: true }).click();
  // Abort the actual IndexedDB transaction to exercise storage failure, not a mocked dispatch result.
  await demo.evaluate(() => {
    const originalPut = IDBObjectStore.prototype.put;
    window.__restoreExampleWrites = () => { IDBObjectStore.prototype.put = originalPut; delete window.__restoreExampleWrites; };
    IDBObjectStore.prototype.put = function (value, ...args) {
      const request = originalPut.call(this, value, ...args);
      if (this.name === 'state' && value.patterns?.some(row => row.draft?.revision.notes === 'Cancelled owner close must stay cancelled.')) this.transaction.abort();
      return request;
    };
  });
  await demo.getByRole('textbox', { name: 'Notes', exact: true }).fill('Cancelled owner close must stay cancelled.');
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(row => !row.webContents.getURL().includes('?example=1')).close());
  await expect(demo.getByRole('dialog').getByRole('heading', { name: en('draftCloseFailed'), exact: true })).toBeVisible();
  await demo.getByRole('dialog').getByRole('button', { name: en('draftStay'), exact: true }).click();
  await demo.evaluate(() => window.__restoreExampleWrites());
  await demo.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect.poll(async () => (await demoState(demo)).patterns[0].draft.revision.notes).toBe('Cancelled owner close must stay cancelled.');
  close = demo.waitForEvent('close'); await demo.getByRole('button', { name: en('returnToMyStudio'), exact: true }).click(); await close;
  assert.deepEqual(await normalState(), original);
  checks.push('Stay after a real IndexedDB failure cancels the owner-close intent; a later Return keeps the owner open');
  assert.deepEqual(errors, []); assert.deepEqual(remoteRequests, []);
  const report = { platform: process.platform, executable, data, checks, errors, remoteRequests, isolation }; writeFileSync(join(data, 'result.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} catch (error) {
  if (app) { await (demo && !demo.isClosed() ? demo : page).screenshot({ path: join(data, 'failure.png'), fullPage: true }).catch(() => {}); writeFileSync(join(data, 'failure.json'), JSON.stringify({ message: error.message, checks, errors, remoteRequests }, null, 2)); }
  throw error;
} finally { if (app) { for (const window of app.windows()) if (window !== page && !window.isClosed()) await window.close().catch(() => {}); await app.close().catch(() => {}); } }
