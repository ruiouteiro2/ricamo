import { _electron as electron, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jsPDF } from 'jspdf';
import { Repository } from '../desktop/repository.mjs';
import { createBlank } from '../core/pattern.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
mkdirSync(join(root, '.runtime'), { recursive: true });
const data = mkdtempSync(join(root, '.runtime', 'export-cancel-'));
const dictionary = JSON.parse(readFileSync(join(root, 'src/i18n-extra.json'), 'utf8')), en = key => dictionary[key][1];
const repository = new Repository(join(data, 'ricamo.sqlite'));
const command = (type, payload) => repository.execute({ type, payload, operationId: crypto.randomUUID() }, repository.load().revision);
try {
  command('settings.save', { language: 'en' });
  const revision = createBlank(2, 1, [{ brand: 'DMC', code: '001', name: 'Red', hex: '#ff0000', rgb: [255, 0, 0], symbol: 'A', strands: 2 }], { id: 'revision', name: 'First revision' }); revision.cells = [0, 0];
  command('pattern.save', { id: 'pattern', name: 'Cancellation pattern', revision });
  command('project.save', { id: 'project', name: 'Cancellation project', patternId: 'pattern' });
  const pdf = new jsPDF(); pdf.text('Reference export cancellation', 20, 20);
  const imported = repository.importAsset({ name: 'reference.pdf', data: new Uint8Array(pdf.output('arraybuffer')), operationId: 'original-reference' }, repository.load().revision);
  command('pattern.save', { id: 'reference', kind: 'reference', name: 'Cancellation reference', sourceAttachmentId: imported.asset.id });
} finally { repository.close(); }
const environment = { ...process.env, RICAMO_DATA_DIR: data }; delete environment.ELECTRON_RUN_AS_NODE; delete environment.NODE_OPTIONS;
const executable = process.env.RICAMO_EXECUTABLE || join(root, 'node_modules/electron/dist', process.platform === 'win32' ? 'electron.exe' : 'electron');
const app = await electron.launch({ executablePath: resolve(executable), args: process.env.RICAMO_EXECUTABLE ? [] : [root], env: environment, timeout: 40000 });
const page = await app.firstWindow(), errors = [], remote = [], checks = [];
page.setDefaultTimeout(10000);
page.on('pageerror', error => errors.push(error.message)); page.on('request', request => { if (/^https?:/.test(request.url())) remote.push(request.url()); });
const dialog = () => page.getByRole('dialog');
const load = async () => { const result = await page.evaluate(() => window.ricamo.load()); assert.equal(result.ok, true); return result.value; };
const nav = name => page.locator('.sidebar').getByRole('button', { name, exact: true }).click();
async function picker(canceled, filePath) {
  // Automate only the native destination choice. Renderer, IPC, file validation and writes remain real.
  await app.evaluate(({ dialog }, choice) => {
    globalThis.__ricamoExportChoices = 0;
    dialog.showSaveDialog = async () => { globalThis.__ricamoExportChoices++; return choice; };
  }, { canceled, filePath });
}
async function waitPicker() { await expect.poll(() => app.evaluate(() => globalThis.__ricamoExportChoices), { timeout: 15000 }).toBe(1); }
async function noToast() { await expect(page.locator('.toast')).toHaveCount(0); }
async function cancelExport(button, name) {
  await noToast(); const before = await load(), target = join(data, `must-not-exist-${name}`);
  await picker(true, target); await button.click(); await waitPicker();
  await expect(dialog(), 'Canceling the native destination must retain export options').toHaveCount(1);
  await expect(button).toBeEnabled(); assert.equal(await page.locator('.toast').count(), 0, 'Canceled exports must not show a success toast');
  assert.equal(existsSync(target), false); assert.deepEqual(await load(), before);
  checks.push(`${name}: canceled, form retained, no success, no write/state change`);
}
async function saveExport(button, name, signature, closes = true) {
  const target = join(data, name); await picker(false, target); await button.click(); await waitPicker();
  if (closes) await expect(dialog()).toHaveCount(0);
  // Read the committed bytes, not just directory metadata on Windows/WSL mounts.
  await expect.poll(() => { try { return readFileSync(target).subarray(0, signature.length).toString('latin1'); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } }).toBe(signature);
  checks.push(`${name}: subsequent actual save succeeds`);
}
try {
  await expect(page.locator('h1').first()).toBeVisible();
  await nav('Projects'); await page.getByRole('heading', { name: 'Cancellation project', exact: true }).click();
  for (const key of ['projectReport', 'printCalibration', 'physicalPattern']) {
    await page.getByRole('button', { name: en(key), exact: true }).click();
    await dialog().getByLabel('Paper size', { exact: false }).selectOption('letter');
    if (key === 'physicalPattern') { await dialog().getByLabel(en('physicalCountX'), { exact: false }).fill('14'); await dialog().getByLabel(en('physicalCountY'), { exact: false }).fill('16'); }
    const button = dialog().getByRole('button', { name: en('exportPdf'), exact: true });
    await cancelExport(button, key);
    await expect(dialog().getByLabel('Paper size', { exact: false })).toHaveValue('letter');
    if (key === 'physicalPattern') await expect(dialog().getByLabel(en('physicalCountY'), { exact: false })).toHaveValue('16');
    await saveExport(button, `${key}.pdf`, '%PDF-');
  }
  await page.getByRole('button', { name: 'Open pattern', exact: true }).click();
  for (const [kind, extension, signature] of [['pdf', 'pdf', '%PDF-'], ['png', 'png', '\x89PNG'], ['native', 'ricamopattern', '{']]) {
    await page.locator('.page-header').getByRole('button', { name: 'Export', exact: true }).click();
    await dialog().getByLabel('Type', { exact: true }).selectOption(kind);
    const button = dialog().getByRole('button', { name: 'Export', exact: true });
    await cancelExport(button, `pattern-${kind}`); await expect(dialog().getByLabel('Type', { exact: true })).toHaveValue(kind);
    await saveExport(button, `pattern.${extension}`, signature);
  }
  await nav('Patterns'); await page.getByRole('button', { name: 'Cancellation reference', exact: true }).click();
  await expect(page.getByRole('button', { name: en('referenceExport'), exact: true })).toBeEnabled();
  await expect.poll(async () => (await load()).patterns.find(row => row.id === 'reference').referenceData?.pageCount).toBe(1);
  await page.getByRole('button', { name: en('referenceExport'), exact: true }).click();
  const referenceButton = dialog().getByRole('button', { name: 'Export', exact: true });
  await cancelExport(referenceButton, 'annotated-reference');
  await saveExport(referenceButton, 'annotated-reference.pdf', '%PDF-');
  await nav('Storage'); await page.getByRole('button', { name: 'New location', exact: true }).first().click();
  await dialog().getByLabel('Name', { exact: false }).fill('Undefined submit still saves');
  await dialog().getByRole('button', { name: 'Save', exact: true }).click(); await expect(dialog()).toHaveCount(0);
  assert.ok((await load()).locations.some(row => row.name === 'Undefined submit still saves'));
  checks.push('Ordinary EntityForm submit returning undefined still closes and persists');
  assert.deepEqual(errors, []); assert.deepEqual(remote, []);
  writeFileSync(join(data, 'result.json'), JSON.stringify({ platform: process.platform, executable, packaged: Boolean(process.env.RICAMO_EXECUTABLE), data, nativePickerResponseAutomated: true, checks, errors, remote }, null, 2));
  console.log(JSON.stringify({ data, checks, errors, remote }));
} catch (error) {
  await page.screenshot({ path: join(data, 'failure.png'), fullPage: true });
  writeFileSync(join(data, 'failure.json'), JSON.stringify({ message: error.message, dialogs: await dialog().count(), toasts: await page.locator('.toast').count(), checks, errors }, null, 2));
  throw error;
} finally { await app.close(); }
