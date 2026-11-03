import { _electron as electron, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { Repository } from '../desktop/repository.mjs';
import { createState } from '../core/application.mjs';
import { saveMaterial, addLot } from '../core/inventory.mjs';
import { missingCatalogueArticles, catalogueMaterial } from '../src/catalogue-rows.mjs';

mkdirSync('.runtime', { recursive: true });
const data = mkdtempSync(resolve('.runtime/inventory-responsiveness-'));
const state = createState(); state.settings.preferences = { paginateLists: false };
let serial = 0;
const context = { id: () => `fixture-${++serial}`, now: '2026-11-03T12:00:00.000Z', operationId: 'fixture' };
for (const [index, row] of missingCatalogueArticles('Mill Hill', []).slice(0, 16).entries()) {
  const material = catalogueMaterial(row.product, `material-${index}`);
  saveMaterial(state, material, context); addLot(state, { materialId: material.id, quantity: 1 }, context);
}
let repository = new Repository(join(data, 'ricamo.sqlite')); repository.restore({ state, assets: [] }, 0); repository.close();
const env = { ...process.env, RICAMO_DATA_DIR: data }; delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS;
const app = await electron.launch({ chromiumSandbox: true, executablePath: resolve(process.env.RICAMO_EXECUTABLE), args: process.env.RICAMO_TEST_SOURCE ? ['.'] : [], env });
const page = await app.firstWindow(), errors = [], clicks = [];
page.on('pageerror', error => errors.push(error.message));
const card = name => page.locator('.inventory-category-card').filter({ has: page.getByRole('heading', { name, exact: true }) });
try {
  await page.locator('.sidebar').waitFor();
  await page.locator('.sidebar').getByRole('button', { name: 'Materiali', exact: true }).click();
  await card('Perle').locator('.inventory-category-link').click(); await card('Mill Hill').locator('.inventory-category-link').click();
  const table = page.locator('.table-wrap'), boxes = table.locator('tbody input[type=checkbox]');
  await boxes.first().waitFor(); assert.ok(await boxes.count() < 80, 'continuous lists must have bounded DOM rows');
  // Exercise width/height changes, maximize and minimize/restore with the list open.
  for (const bounds of [{width:800,height:620},{width:800,height:900},{width:1400,height:900}]) {
    await app.evaluate(({BrowserWindow}, bounds) => BrowserWindow.getAllWindows()[0].setBounds(bounds), bounds);
    await expect.poll(() => table.evaluate(element => element.clientWidth)).toBeGreaterThan(bounds.width - (bounds.width < 850 ? 210 : 410));
    await expect.poll(() => table.evaluate(element => element.clientHeight)).toBeLessThan(bounds.height * .7);
    assert.ok(await boxes.count() < 80);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'page must fit current width');
  }
  await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].maximize());
  await expect.poll(() => app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].isMaximized())).toBe(true);
  await app.evaluate(({BrowserWindow}) => {const window=BrowserWindow.getAllWindows()[0];window.minimize();window.restore();window.unmaximize();});
  await expect(boxes.first()).toBeVisible();

  for (let round = 0; round < 3; round++) {
    for (let index = 0; index < 4; index++) {
      const start = performance.now(); await boxes.nth(index).click();
      await expect(boxes.nth(index)).toBeChecked({ checked: round !== 1 }); clicks.push(performance.now() - start);
      for (let previous = 0; previous < index; previous++) await expect(boxes.nth(previous)).toBeChecked({ checked: round !== 1 });
    }
  }
  await page.getByRole('button', { name: 'Annulla selezione', exact: true }).click();
  await table.locator('thead input[type=checkbox]').click();
  await expect(page.locator('.panel-heading').filter({ hasText: 'materiali selezionati' })).toContainText('200');
  await expect(table.locator('thead input[type=checkbox]')).not.toBeChecked();
  await page.getByRole('button', { name: 'Annulla selezione', exact: true }).click();
  await expect(table.locator('thead input[type=checkbox]')).not.toBeChecked();
  await boxes.first().check(); const firstValue = await boxes.first().getAttribute('value');
  await table.evaluate(element => { element.scrollTop = element.scrollHeight; });
  await expect(table.locator('tbody.catalogue-rows input[type=checkbox]').last()).toBeVisible();
  assert.ok(await boxes.count() < 80); const distant = table.locator('tbody.catalogue-rows input[type=checkbox]').last();
  await distant.check();
  await table.evaluate(element => { element.scrollTop = 0; });
  await expect(table.locator(`input[value="${firstValue}"]`)).toBeChecked();
  await page.locator('.panel-heading').getByRole('button', { name: 'Inserisci in Acquisti', exact: true }).click();
  const dialog = page.getByRole('dialog'); await expect(dialog.locator('input[inputmode=decimal]')).toHaveCount(2);
  await dialog.getByRole('button', { name: 'Inserisci in Acquisti', exact: true }).click(); await expect(dialog).toHaveCount(0);
  repository = new Repository(join(data, 'ricamo.sqlite'));
  try { const saved = repository.load(); assert.equal(saved.purchases.length, 2); assert.equal(saved.lots.length, 16); assert.equal(saved.movements.length, 16); } finally { repository.close(); }
  assert.deepEqual(errors, []);
  writeFileSync(join(data, 'result.json'), JSON.stringify({ clicksMs: clicks, errors }, null, 2));
  await page.screenshot({ path: join(data, 'inventory.png') });
  console.log('PASS: native checkbox toggles, 200-selection limit, continuous scrolling, distant selections and persisted purchases. ' + data);
} catch (error) { await page.screenshot({ path: join(data, 'failure.png') }); throw error; }
finally { await app.close(); }
