import { _electron as electron, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Repository } from '../desktop/repository.mjs';
import { command, projectPackageFixture } from './project-fixture.mjs';
import { inspectProjectPackage } from '../core/project-package.mjs';
import { digestBytes } from '../core/files.mjs';
import { extractPdfText } from './pdf-helpers.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
mkdirSync(join(root, '.runtime'), { recursive: true });
const data = mkdtempSync(join(root, '.runtime', 'project-transfer-'));
const dictionary = JSON.parse(readFileSync(join(root, 'src/i18n-extra.json'), 'utf8'));
const en = key => dictionary[key][1];
const environment = { ...process.env, RICAMO_DATA_DIR: data };
delete environment.ELECTRON_RUN_AS_NODE; delete environment.NODE_OPTIONS;
const executable = process.env.RICAMO_EXECUTABLE || join(root, 'node_modules/electron/dist', process.platform === 'win32' ? 'electron.exe' : 'electron');
const args = [...(process.env.RICAMO_TEST_NO_SANDBOX === '1' ? ['--no-sandbox'] : []), ...(process.env.RICAMO_EXECUTABLE ? [] : [root])];
const launch = () => electron.launch({ executablePath: resolve(executable), args, env: environment, timeout: 40000 });
const { repo: source, asset, revision } = projectPackageFixture();
let packageText;
try {
  command(source, 'material.createWithLot', { material: { id: 'fabric', name: 'Linen 28', category: 'fabric', unit: 'piece' }, lot: { id: 'source-piece', quantity: 1, properties: { widthCm: 30, heightCm: 40, countX: 28, countY: 28, countMeaning: 'threads' } } });
  command(source, 'project.save', { id: 'work', fabricLotId: 'source-piece', recipient: 'PRIVATE_RECIPIENT', settings: { fabric: { overX: 2, overY: 2 } } });
  command(source, 'session.save', { projectId: 'work', date: '2026-10-26', durationMinutes: 5, work: { kind: 'full', count: 1, patternId: 'p', revisionId: 'r1' }, notes: 'PRIVATE_SESSION' });
  command(source, 'pattern.save', { id: 'p', revision: { ...revision, id: 'r2', name: 'Second revision' } });
  command(source, 'project.save', { id: 'work', revisionId: 'r2', acceptRevisionChange: true });
  command(source, 'project.progress', { projectId: 'work', completed: ['c:1'] });
  command(source, 'task.save', { projectId: 'work', title: 'Check colour card', notes: 'PRIVATE_TASK' });
  packageText = await source.exportProject('work', { includeSessions: true, attachmentIds: [asset.id] });
} finally { source.close(); }
const input = join(data, 'Shared blend.ricamoproject'); writeFileSync(input, packageText);
const destination = new Repository(join(data, 'ricamo.sqlite'));
command(destination, 'material.createWithLot', { material: { id: 'local', name: 'Local name must stay', brand: 'DMC', range: 'Mouliné', code: '001', category: 'thread', unit: 'm', strands: 6, divisible: true }, lot: { id: 'local-lot', quantity: 75 } });
const initial = destination.load(); destination.close();

let app = await launch(), page = await app.firstWindow();
const errors = [], externalRequests = [];
const observe = current => {
  current.on('pageerror', error => errors.push(error.message));
  current.on('request', request => { if (/^https?:/.test(request.url())) externalRequests.push(request.url()); });
};
observe(page);
const load = async () => { const reply = await page.evaluate(() => window.ricamo.load()); assert.equal(reply.ok, true); return reply.value; };
const dialog = () => page.getByRole('dialog');
async function targetFile(path) {
  // Only automate the destination picker. Export/rendering and actual file IPC remain real.
  await app.evaluate(({ dialog }, destination) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: destination }); }, path);
}
try {
  await expect(page.locator('h1').first()).toBeVisible();
  await page.locator('.topbar').getByRole('combobox').selectOption('en');
  await page.locator('.sidebar').getByRole('button', { name: 'Projects', exact: true }).click();
  await page.getByRole('button', { name: en('importProjectPackage'), exact: true }).click();
  await dialog().getByLabel(en('projectPackageFile')).setInputFiles(input);
  await expect(dialog().getByRole('button', { name: en('confirmProjectImport'), exact: true })).toBeDisabled();
  await dialog().getByRole('combobox', { name: 'Reference destination: Linen 28', exact: true }).selectOption('create');
  await expect(dialog().getByRole('button', { name: en('confirmProjectImport'), exact: true })).toBeEnabled();
  await expect(dialog().getByRole('combobox', { name: 'Reference destination: Cotone à mão', exact: true })).toHaveValue('reuse:local');
  await dialog().getByRole('textbox', { name: /^Imported project name/ }).fill('Imported à mão');
  await dialog().getByRole('button', { name: en('confirmProjectImport'), exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Imported à mão', exact: true })).toBeVisible();
  let state = await load(), project = state.projects[0], pattern = state.patterns.find(row => row.id === project.patternId);
  assert.equal(project.status, 'preparing'); assert.equal(project.fabricLotId, null);
  assert.deepEqual(project.completed, ['c:1']); assert.equal(project.progressHistory.length, 0);
  assert.equal(pattern.revisions.length, 2); assert.equal(state.sessions[0].work.count, 1);
  assert.notEqual(state.sessions[0].work.revisionId, project.revisionId);
  assert.equal(pattern.revisions.find(row => row.id === project.revisionId).colors[0].blend.components[0].itemId, 'local');
  assert.equal(state.materials.find(row => row.id === 'local').name, 'Local name must stay');
  for (const key of ['lots', 'movements', 'reservations', 'purchases']) assert.deepEqual(state[key], initial[key]);
  assert.doesNotMatch(JSON.stringify(state), /PRIVATE_/);
  const originalId = state.attachments[0].id;
  const bytesReply = await page.evaluate(async id => { const reply=await window.ricamo.getAsset(id);return {...reply,value:reply.ok?Array.from(reply.value):null}; }, originalId);
  assert.equal(bytesReply.ok, true); assert.equal(await digestBytes(new Uint8Array(bytesReply.value)), asset.digest);

  await page.locator('.tabs').getByRole('button', { name: 'Materials', exact: true }).click();
  await expect(page.getByRole('heading', { name: en('importedFabricReference'), exact: true })).toBeVisible();
  await page.getByRole('button', { name: en('useImportedFabricCounts'), exact: true }).click();
  await expect.poll(async () => (await load()).projects[0].settings.fabric.countX).toBe(28);
  await page.locator('.tabs').getByRole('button', { name: 'Overview', exact: true }).click();

  const reportPath = join(data, 'Project report.pdf'); await targetFile(reportPath);
  await page.getByRole('button', { name: en('projectReport'), exact: true }).click();
  await dialog().getByRole('button', { name: 'Export PDF', exact: true }).click();
  await expect(dialog()).toHaveCount(0);
  assert.equal(existsSync(reportPath), true);
  const reportText = await extractPdfText(readFileSync(reportPath));
  assert.match(reportText, /Imported à mão/); assert.doesNotMatch(reportText, /PRIVATE_/);

  const physicalPath = join(data, 'Actual size.pdf'); await targetFile(physicalPath);
  await page.getByRole('button', { name: en('physicalPattern'), exact: true }).click();
  await dialog().getByRole('textbox', { name: en('physicalCountX'), exact: true }).fill('14');
  await dialog().getByRole('textbox', { name: en('physicalCountY'), exact: true }).fill('14');
  await dialog().getByRole('button', { name: 'Export PDF', exact: true }).click();
  await expect(dialog()).toHaveCount(0);
  const physicalText = await extractPdfText(readFileSync(physicalPath));
  assert.match(physicalText, /100 × 100 mm/); assert.match(physicalText, /Ω/);
  assert.match(physicalText, /1 × DMC Mouliné 001/); assert.match(physicalText, /2 × DMC Mouliné 002/);

  const reexport = join(data, 'Re-export.ricamoproject'); await targetFile(reexport);
  await page.getByRole('button', { name: en('exportProjectPackage'), exact: true }).click();
  await dialog().getByRole('checkbox', { name: en('package_includeSessions'), exact: true }).check();
  await dialog().getByRole('checkbox', { name: 'original.png', exact: true }).check();
  await dialog().getByRole('button', { name: en('downloadProjectPackage'), exact: true }).click();
  await expect.poll(() => existsSync(reexport)).toBe(true);
  const again = await inspectProjectPackage(readFileSync(reexport, 'utf8'));
  assert.equal(again.state.projects[0].settings.transferFabric.widthCm, 30);
  assert.equal(again.state.sessions[0].work.count, 1); assert.equal(again.assets.length, 1);
  await dialog().getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.screenshot({ path: join(data, 'project-documents.png'), fullPage: true });

  const beforeClose = await load();
  await app.close(); app = await launch(); page = await app.firstWindow(); observe(page);
  await expect(page.locator('h1').first()).toBeVisible(); state = await load();
  assert.deepEqual(state.projects, beforeClose.projects); assert.deepEqual(state.sessions, beforeClose.sessions);
  assert.deepEqual(state.patterns, beforeClose.patterns); assert.deepEqual(state.lots, initial.lots);
  const recovered = await page.evaluate(async id => { const reply=await window.ricamo.getAsset(id);return {...reply,value:reply.ok?Array.from(reply.value):null}; }, originalId);
  assert.equal(await digestBytes(new Uint8Array(recovered.value)), asset.digest);
  const preferences = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences());
  assert.equal(preferences.sandbox, true); assert.equal(preferences.contextIsolation, true); assert.equal(preferences.nodeIntegration, false);
  assert.deepEqual(errors, []); assert.deepEqual(externalRequests, []);
  const result = { platform: process.platform, executable, data, projectId: project.id, checks: ['real UI reviewed import', 'no stock creation or overwrite', 'blend/provenance/historical session remapping', 'imported fabric reference', 'Unicode project report', 'actual-size recipe legend', 'UI selective re-export', 'SQLite and original bytes after restart'], reportBytes: readFileSync(reportPath).length, physicalPdfBytes: readFileSync(physicalPath).length, nativeDestinationSelectionAutomated: true, errors, externalRequests };
  writeFileSync(join(data, 'result.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
} catch (error) {
  await page.screenshot({ path: join(data, 'failure.png'), fullPage: true }).catch(() => {});
  throw error;
} finally { await app.close(); }
