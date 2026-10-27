import { _electron as electron, expect } from '@playwright/test';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
mkdirSync(join(root, '.runtime'), { recursive: true });
const data = mkdtempSync(join(root, '.runtime', 'draft-close-'));
const executable = process.env.RICAMO_EXECUTABLE || join(root, 'node_modules/electron/dist', process.platform === 'win32' ? 'electron.exe' : 'electron');
const packaged = Boolean(process.env.RICAMO_EXECUTABLE);
const errors = [], remoteRequests = [];
async function launch() {
  const environment = { ...process.env, RICAMO_DATA_DIR: data };
  // The coding host may itself be Electron. Its Node-mode flag is not an app setting.
  delete environment.ELECTRON_RUN_AS_NODE;
  delete environment.NODE_OPTIONS;
  const app = await electron.launch({ chromiumSandbox: true, executablePath: resolve(executable), args: [...(packaged ? [] : [root])], env: environment, timeout: 40000 });
  const page = await app.firstWindow();
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url())) remoteRequests.push(request.url()); });
  await expect(page.locator('h1').first()).toBeVisible();
  return { app, page };
}
let app, page, patternId, revisionId;
try {
  ({ app, page } = await launch());
  await page.locator('.topbar').getByRole('combobox').selectOption('en');
  await page.locator('.sidebar').getByRole('button', { name: 'Patterns', exact: true }).click();
  await page.locator('.page-header').getByRole('button', { name: 'Blank grid', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill('Native close recovery');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Notes', exact: true })).toBeVisible();
  const initial = await page.evaluate(() => window.ricamo.load());
  patternId = initial.value.patterns[0].id; revisionId = initial.value.patterns[0].currentRevisionId;
  const editStarted = Date.now();
  await page.getByRole('textbox', { name: 'Notes', exact: true }).fill('Flush this edit before closing the native window.');
  const closeRequestedMsAfterEdit = Date.now() - editStarted;
  const closed = app.waitForEvent('close', { timeout: 15000 });
  // The normal native window close event must flush pending edits itself.
  await app.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows()[0].close(); });
  await closed; app = null;
  ({ app, page } = await launch());
  let loaded = await page.evaluate(() => window.ricamo.load());
  let pattern = loaded.value.patterns.find(row => row.id === patternId);
  assert.equal(pattern.draft.revision.notes, 'Flush this edit before closing the native window.');
  assert.equal(pattern.currentRevisionId, revisionId);
  assert.notEqual(pattern.revisions[0].notes, pattern.draft.revision.notes);
  await page.locator('.sidebar').getByRole('button', { name: 'Patterns', exact: true }).click();
  await page.getByRole('button', { name: 'Open pattern: Native close recovery', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Resume draft', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Notes', exact: true })).toHaveValue(pattern.draft.revision.notes);
  await page.getByRole('textbox', { name: 'Notes', exact: true }).fill('Acknowledged draft survives process exit.');
  await expect.poll(async () => (await page.evaluate(() => window.ricamo.load())).value.patterns.find(row => row.id === patternId).draft?.revision.notes).toBe('Acknowledged draft survives process exit.');
  await page.screenshot({ path: join(data, 'recovered-draft.png'), fullPage: true });
  const exited = app.waitForEvent('close', { timeout: 15000 });
  await app.evaluate(({ app: native }) => { native.exit(0); }); await exited; app = null;
  ({ app, page } = await launch());
  loaded = await page.evaluate(() => window.ricamo.load()); pattern = loaded.value.patterns.find(row => row.id === patternId);
  assert.equal(pattern.draft.revision.notes, 'Acknowledged draft survives process exit.');
  assert.equal(pattern.currentRevisionId, revisionId); assert.equal(pattern.revisions.length, 1);
  assert.deepEqual(errors, []); assert.deepEqual(remoteRequests, []);
  const report = { platform: process.platform, executable, data, patternId, revisionId, closeRequestedMsAfterEdit, nativeCloseFlushed: true, acknowledgedDraftSurvivesExit: true, originalRevisionUnchanged: true, errors, remoteRequests };
  writeFileSync(join(data, 'result.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} catch (error) {
  if (app) { await page.screenshot({ path: join(data, 'failure.png'), fullPage: true }).catch(() => {}); await app.evaluate(({ app: native }) => native.exit(1)).catch(() => {}); app = null; }
  throw error;
} finally { if (app) await app.close(); }
