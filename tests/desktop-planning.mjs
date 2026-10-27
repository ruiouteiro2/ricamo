import { _electron as electron, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Repository } from '../desktop/repository.mjs';
import { createState, executeCommand } from '../core/application.mjs';
import { createBlank } from '../core/pattern.mjs';
import { projectForecast } from '../core/project-forecast.mjs';
import { localDate } from '../core/calendar.mjs';
import { extractPdfText } from './pdf-helpers.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const runtime = process.env.RICAMO_TEST_DATA_ROOT ? resolve(process.env.RICAMO_TEST_DATA_ROOT) : join(root, '.runtime');
mkdirSync(runtime, { recursive: true });
const data = mkdtempSync(join(runtime, 'planning-'));
const dictionary = JSON.parse(readFileSync(join(root, 'src/i18n-extra.json'), 'utf8'));
const en = (key, values = {}) => dictionary[key][1].replace(/\{(\w+)\}/g, (_, name) => values[name] ?? '');
let sequence = 0, state = createState();
const seed = (type, payload) => { state = executeCommand(state, { type, payload, operationId: `planning-seed-${++sequence}` }, { now: new Date().toISOString(), id: () => `planning-seed-${++sequence}` }); };
seed('settings.save', { language: 'en' });
seed('material.save', { id: 'thread', name: 'Planning test thread', category: 'thread', unit: 'm' });
seed('lot.add', { id: 'thread-lot', materialId: 'thread', quantity: 10, cost: 1200 });
seed('project.save', { id: 'manual', name: 'Manual planning study' });
seed('project.progress', { projectId: 'manual', manualPercent: 75 });
const revision = createBlank(2, 1, [{ brand: 'DMC', code: '310', name: 'Black', hex: '#000000', rgb: [0, 0, 0], symbol: 'A', strands: 2 }], { id: 'planning-revision' });
revision.cells = [0, 0];
revision.halfStitches = [{ id: 'half', x: 0, y: 0, color: 0, direction: '/' }];
revision.backstitches = [{ id: 'back', x1: 0, y1: 1, x2: 2, y2: 1, color: 0 }];
seed('pattern.save', { id: 'planning-pattern', name: 'Planning sampler', revision });
seed('project.save', { id: 'grid', name: 'Measured planning study', patternId: 'planning-pattern' });
seed('project.progress', { projectId: 'grid', completed: ['c:0'], done: true });
for (const [kind, durationMinutes] of [['full', 1], ['half', 0.5], ['backstitch', 2]]) {
  seed('session.save', { projectId: 'grid', date: localDate(new Date(Date.now() - 86400000)), durationMinutes, work: { kind, count: 1, patternId: 'planning-pattern', revisionId: 'planning-revision' } });
}
const physical = source => Object.fromEntries(['materials', 'lots', 'movements', 'reservations', 'needs', 'purchases'].map(key => [key, source[key]]));
const initialPhysical = structuredClone(physical(state));
let repository = new Repository(join(data, 'ricamo.sqlite'));
repository.restore({ state, assets: [] }, 0); repository.close();
const environment = { ...process.env, RICAMO_DATA_DIR: data };
delete environment.ELECTRON_RUN_AS_NODE; delete environment.NODE_OPTIONS;
const binary = process.platform === 'win32' ? 'electron.exe' : process.platform === 'darwin' ? 'Electron.app/Contents/MacOS/Electron' : 'electron';
const executable = resolve(process.env.RICAMO_EXECUTABLE || join(root, 'node_modules/electron/dist', binary));
const args = [...(process.env.RICAMO_TEST_NO_SANDBOX === '1' ? ['--no-sandbox'] : []), ...(process.env.RICAMO_EXECUTABLE ? [] : [root])];
const launch = () => electron.launch({ executablePath: executable, args, env: environment, timeout: 40000 });
let app, page;
const errors = [], externalRequests = [], checks = [];
const observe = current => {
  current.setDefaultTimeout(15000);
  current.on('pageerror', error => errors.push(error.message));
  current.on('request', request => { if (/^https?:/.test(request.url())) externalRequests.push(request.url()); });
};
// Read the real public preload API. All post-seed positive mutations use UI controls.
const load = async () => { const reply = await page.evaluate(() => window.ricamo.load()); assert.equal(reply.ok, true); return reply.value; };
const dialog = () => page.getByRole('dialog').last();
const forecast = (source, id) => projectForecast(source, id, { asOf: localDate() });
async function openProject(name) {
  await page.locator('.sidebar').getByRole('button', { name: 'Projects', exact: true }).click();
  await page.getByRole('heading', { name, exact: true }).click();
  await expect(page.locator('h1')).toHaveText(name);
}
async function settings(method) {
  await page.getByRole('button', { name: en('forecastAssumptions'), exact: true }).click();
  await dialog().getByRole('combobox', { name: en('forecastMethod'), exact: true }).selectOption(method);
}
async function saveDialog() {
  await dialog().getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
try {
  app = await launch(); page = await app.firstWindow(); observe(page);
  await expect(page.locator('h1').first()).toBeVisible(); assert.equal(new URL(page.url()).protocol, 'ricamo:');
  await openProject('Manual planning study');
  await settings('manual');
  const full = en('workKind_full'), half = en('workKind_half'), back = en('workKind_backstitch');
  await dialog().getByLabel(en('forecastUnitFor', { kind: full }), { exact: true }).selectOption('minutes');
  await dialog().getByLabel(en('forecastRateFor', { kind: full }), { exact: true }).fill('1,5');
  for (const [kind, quantity] of [[full, '20'], [half, '0'], [back, '0']]) {
    await dialog().getByLabel(en('forecastRemainingFor', { kind }), { exact: true }).fill(quantity);
  }
  await dialog().getByLabel(en('weeklyAvailableHours'), { exact: true }).fill('7');
  await dialog().getByRole('textbox', { name: en('extraFinishingMinutes'), exact: true }).fill('15');
  await dialog().getByRole('combobox', { name: 'Language', exact: true }).selectOption('it');
  await expect(dialog().getByRole('combobox', { name: dictionary.forecastMethod[0], exact: true })).toHaveValue('manual');
  await dialog().getByRole('combobox', { name: 'Lingua', exact: true }).selectOption('en');
  await saveDialog();
  let current = await load(), manual = current.projects.find(row => row.id === 'manual');
  assert.equal(manual.settings.forecast.manualSeconds.full, 90);
  assert.equal(manual.manualPercent, 75); assert.equal(forecast(current, 'manual').totalMinutes, 45);
  assert.deepEqual(physical(current), initialPhysical);
  await page.reload(); await expect(page.locator('h1').first()).toBeVisible(); await openProject('Manual planning study');
  current = await load(); assert.equal(forecast(current, 'manual').totalMinutes, 45);
  checks.push('manual minutes/comma conversion, IT/EN, schedule and finishing persisted through renderer reload');

  await settings('manual');
  await dialog().getByLabel(en('forecastRemainingFor', { kind: half }), { exact: true }).fill('');
  await saveDialog(); current = await load(); assert.equal(forecast(current, 'manual').totalMinutes, null);
  await expect(page.getByText(en('forecast_manual_counts_required'), { exact: true })).toBeVisible();
  const reportPath = join(data, 'Manual unknown forecast.pdf');
  // Only select the native destination. Rendering and filesystem IPC remain real.
  await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, reportPath);
  await page.getByRole('button', { name: en('projectReport'), exact: true }).click();
  await dialog().getByRole('button', { name: 'Export PDF', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(() => existsSync(reportPath)).toBe(true);
  const reportText = await extractPdfText(readFileSync(reportPath));
  assert.match(reportText, /Manual assumptions \(not measured\)/);
  assert.match(reportText, /Half stitches · Remaining: Unknown/);
  checks.push('unknown remaining work stays unknown in actual exported PDF');

  await page.getByRole('button', { name: en('applyChecklistTemplate'), exact: true }).click();
  await dialog().getByRole('button', { name: en('applyChecklistTemplate'), exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.locator('.task-row input[type=checkbox]').first().check();
  await expect.poll(async () => (await load()).tasks[0].done).toBe(true);
  const originalTasks = structuredClone((await load()).tasks);
  await page.getByRole('button', { name: en('manageChecklistTemplates'), exact: true }).click();
  await dialog().getByRole('button', { name: en('copyChecklistTemplate'), exact: true }).click();
  await dialog().getByRole('textbox', { name: 'Name', exact: true }).fill('Reusable planning template');
  await dialog().getByRole('textbox', { name: 'Step', exact: true }).first().fill('Confirm personal fabric count');
  await dialog().getByRole('button', { name: en('templateRemoveTask', { number: 6 }), exact: true }).click();
  await dialog().getByRole('button', { name: en('templateMoveUp', { number: 2 }), exact: true }).click();
  await dialog().getByRole('button', { name: en('reviewTemplateChanges'), exact: true }).click();
  await expect(dialog()).toContainText(en('templateDefinitionCounts', { before: 0, after: 5 }));
  await page.screenshot({ path: join(data, 'template-preview.png'), fullPage: true });
  await dialog().getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await dialog().getByRole('button', { name: en('editChecklistTemplate'), exact: true }).click();
  await dialog().getByRole('textbox', { name: 'Name', exact: true }).fill('Renamed planning template');
  await dialog().getByRole('textbox', { name: 'Notes', exact: true }).first().fill('Future project instruction');
  await dialog().getByRole('button', { name: en('reviewTemplateChanges'), exact: true }).click();
  await expect(dialog()).toContainText('Future project instruction');
  await dialog().getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await dialog().getByRole('button', { name: 'Cancel', exact: true }).click();
  current = await load(); assert.deepEqual(current.tasks, originalTasks);
  const template = current.settings.preferences.checklistTemplates[0];
  assert.equal(template.name, 'Renamed planning template'); assert.equal(template.tasks.length, 5);
  await page.reload(); await expect(page.locator('h1').first()).toBeVisible(); await openProject('Manual planning study');
  assert.deepEqual((await load()).settings.preferences.checklistTemplates[0], template);
  await page.getByRole('button', { name: en('applyChecklistTemplate'), exact: true }).click();
  await dialog().getByLabel(en('checklistTemplate'), { exact: true }).selectOption(template.id);
  await dialog().getByRole('button', { name: en('applyChecklistTemplate'), exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const allTasks = structuredClone((await load()).tasks);
  assert.equal(allTasks.length, 11); assert.equal(allTasks[6].notes, 'Future project instruction');
  assert.equal(allTasks.slice(6).some(row => row.done), false); assert.deepEqual(allTasks.slice(0, 6), originalTasks);
  await page.getByRole('button', { name: en('manageChecklistTemplates'), exact: true }).click();
  await dialog().getByLabel(en('checklistTemplate'), { exact: true }).selectOption(template.id);
  await dialog().getByRole('button', { name: en('deleteChecklistTemplate'), exact: true }).click();
  await expect(dialog()).toContainText('Tasks already applied to projects will remain unchanged.');
  await dialog().getByRole('button', { name: en('deleteChecklistTemplate'), exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await dialog().getByRole('button', { name: 'Cancel', exact: true }).click();
  current = await load(); assert.deepEqual(current.tasks, allTasks); assert.equal(current.settings.preferences.checklistTemplates.length, 0);
  checks.push('built-in apply, completed task, copy/edit/rename/reorder, persisted definition, fresh apply, delete preserves every applied task');

  await openProject('Measured planning study');
  current = await load(); assert.equal(forecast(current, 'grid').method, 'measured'); assert.equal(forecast(current, 'grid').totalMinutes, 3.5);
  await expect(page.getByText(en('forecastMeasured'), { exact: true })).toBeVisible();
  await settings('manual');
  await expect(dialog().getByRole('textbox', { name: /^Remaining primitives:/ })).toHaveCount(0);
  for (const [kind, value] of [[full, '30'], [half, '15'], [back, '60']]) await dialog().getByLabel(en('forecastRateFor', { kind }), { exact: true }).fill(value);
  await dialog().getByRole('textbox', { name: en('extraFinishingMinutes'), exact: true }).fill('5');
  await saveDialog(); current = await load(); assert.equal(forecast(current, 'grid').totalMinutes, 6.75);
  await settings('measured'); await saveDialog(); current = await load(); assert.equal(forecast(current, 'grid').totalMinutes, 8.5);
  await settings('manual'); await saveDialog(); current = await load(); assert.equal(forecast(current, 'grid').totalMinutes, 6.75);
  assert.deepEqual(current.projects.find(row => row.id === 'grid').completed, ['c:0']);
  assert.deepEqual(physical(current), initialPhysical); assert.deepEqual(current.sessions, state.sessions);
  await page.screenshot({ path: join(data, 'grid-forecast.png'), fullPage: true });
  checks.push('measured/manual selection uses actual full/half/back progress, retains finishing, never edits sessions or stock');

  const beforeRestart = current;
  await app.close(); app = await launch(); page = await app.firstWindow(); observe(page);
  await expect(page.locator('h1').first()).toBeVisible(); current = await load();
  for (const key of ['projects', 'tasks', 'sessions']) assert.deepEqual(current[key], beforeRestart[key]);
  assert.deepEqual(current.settings.preferences.checklistTemplates, []); assert.deepEqual(physical(current), initialPhysical);
  const security = await app.evaluate(({ BrowserWindow, app }) => ({ ...BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences(), appPath: app.getAppPath(), version: app.getVersion() }));
  assert.equal(security.sandbox, true); assert.equal(security.contextIsolation, true); assert.equal(security.nodeIntegration, false);
  const appIdentity = { appPath: security.appPath, version: security.version };
  await app.close(); app = null;
  repository = new Repository(join(data, 'ricamo.sqlite'));
  try { const persisted = repository.load(); for (const key of ['projects', 'tasks', 'sessions']) assert.deepEqual(persisted[key], beforeRestart[key]); assert.deepEqual(physical(persisted), initialPhysical); }
  finally { repository.close(); }
  assert.deepEqual(errors, []); assert.deepEqual(externalRequests, []);
  checks.push('native process restart and independent SQLite reopen preserve all planning data');
  const result = { platform: process.platform, executable, ...appIdentity, data, checks, reportBytes: readFileSync(reportPath).length, nativeDestinationSelectionAutomated: true, errors, externalRequests };
  writeFileSync(join(data, 'result.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
} catch (error) {
  await page?.screenshot({ path: join(data, 'failure.png'), fullPage: true }).catch(() => {});
  throw error;
} finally { if (app) await app.close().catch(() => {}); }
