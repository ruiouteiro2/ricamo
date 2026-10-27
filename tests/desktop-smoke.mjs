import { APP_VERSION } from '../core/version.mjs';
import { _electron as electron, expect } from '@playwright/test';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
mkdirSync(join(root, '.runtime'), { recursive: true });
const data = mkdtempSync(join(root, '.runtime', 'desktop-smoke-'));
const executable = process.env.RICAMO_EXECUTABLE || join(root, 'node_modules/electron/dist', process.platform === 'win32' ? 'electron.exe' : 'electron');
const packaged = Boolean(process.env.RICAMO_EXECUTABLE);
const errors = [], remoteRequests = [];
const requestedScale = Number(process.env.RICAMO_TEST_SCALE || 0);
if (requestedScale) assert.ok(requestedScale >= 0.5 && requestedScale <= 3);
async function launch() {
  const environment = { ...process.env, RICAMO_DATA_DIR: data };
  // The coding host may itself be Electron. Its Node-mode flag is not an app setting.
  delete environment.ELECTRON_RUN_AS_NODE;
  delete environment.NODE_OPTIONS;
  const app = await electron.launch({ executablePath: resolve(executable), args: [...(requestedScale ? [`--force-device-scale-factor=${requestedScale}`] : []), ...(process.env.RICAMO_TEST_NO_SANDBOX === '1' ? ['--no-sandbox'] : []), ...(packaged ? [] : [root])], env: environment, timeout: 40000 });
  const page = await app.firstWindow();
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url())) remoteRequests.push(request.url()); });
  await expect(page.locator('h1').first()).toBeVisible();
  return { app, page };
}
let { app, page } = await launch();
let id, displayEvidence;
try {
  displayEvidence = await app.evaluate(({app,BrowserWindow,screen}) => { const window=BrowserWindow.getAllWindows().find(row=>row.webContents.getURL().startsWith('ricamo:')); return {version:app.getVersion(),bounds:window.getBounds(),workArea:screen.getDisplayMatching(window.getBounds()).workArea}; });
  displayEvidence.pixelRatio = await page.evaluate(()=>devicePixelRatio);
  assert.equal(displayEvidence.version,APP_VERSION);
  const {bounds,workArea}=displayEvidence;
  assert.ok(bounds.x>=workArea.x-1 && bounds.y>=workArea.y-1 && bounds.x+bounds.width<=workArea.x+workArea.width+1 && bounds.y+bounds.height<=workArea.y+workArea.height+1,`Initial window must fit the logical display work area: ${JSON.stringify(displayEvidence)}`);
  assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
  assert.equal(await page.evaluate(() => typeof window.process), 'undefined');
  assert.equal(new URL(page.url()).protocol, 'ricamo:');
  await page.locator('.topbar').getByRole('combobox').selectOption('en');
  await page.locator('.sidebar').getByRole('button', { name: 'Materials', exact: true }).click();
  await page.locator('.page-header').getByRole('button', { name: 'Add material', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name', { exact: false }).first().fill('Desktop persistence test');
  await dialog.getByLabel('Code', { exact: false }).first().fill('001');
  await dialog.getByLabel('Quantity', { exact: false }).first().fill('1,5');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const loaded = await page.evaluate(() => window.ricamo.load());
  assert.equal(loaded.ok, true);
  const material = loaded.value.materials.find(row => row.name === 'Desktop persistence test');
  assert.equal(material.code, '001'); id = material.id;
  assert.equal(loaded.value.lots.find(row => row.materialId === id).quantity, 1.5);
  await page.screenshot({ path: join(data, 'desktop-material.png'), fullPage: true });
} finally { await app.close(); }
({ app, page } = await launch());
try {
  const loaded = await page.evaluate(() => window.ricamo.load());
  assert.equal(loaded.value.materials.find(row => row.id === id).code, '001');
  assert.equal(loaded.value.lots.find(row => row.materialId === id).quantity, 1.5);
  assert.equal(loaded.value.settings.language, 'en');
  assert.equal(errors.length, 0, errors.join('\n'));
  assert.equal(remoteRequests.length, 0, remoteRequests.join('\n'));
  const report = { displayEvidence, requestedScale, platform: process.platform, executable, packaged, data, materialId: id, persistenceReopened: true, leadingZeroCode: true, decimalComma: true, errors, remoteRequests };
  writeFileSync(join(data, 'result.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await app.close(); }
