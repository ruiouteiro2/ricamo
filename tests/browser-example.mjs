import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
await mkdir('.runtime', { recursive: true }); const evidence = await mkdtemp(join('.runtime', 'example-browser-'));
const dictionary = JSON.parse(await readFile('src/i18n-extra.json', 'utf8')), en = key => dictionary[key][1];
const browser = await chromium.launch({ headless: true }); const context = await browser.newContext({ viewport: { width: 1360, height: 920 }, acceptDownloads: true });
const page = await context.newPage(), errors = [], remote = []; let example;
context.on('page', target => target.on('pageerror', error => errors.push(error.message))); page.on('pageerror', error => errors.push(error.message));
const base = process.env.RICAMO_TEST_URL || 'http://127.0.0.1:4173';
context.on('request', request => { if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== new URL(base).origin) remote.push(request.url()); });
async function readState(target, name) { return target.evaluate(name => new Promise((resolve, reject) => { const opening = indexedDB.open(name); opening.onerror = () => reject(opening.error); opening.onsuccess = () => { const db = opening.result, request = db.transaction('state').objectStore('state').get('current'); request.onsuccess = () => { db.close(); resolve(request.result); }; request.onerror = () => reject(request.error); }; }), name); }
try {
  await page.goto(base); await page.locator('.topbar').getByRole('combobox').selectOption('en');
  const normal = await readState(page, 'ricamo-studio'); assert.equal(normal.materials.length, 0);
  await expect(page.getByRole('heading', { name: en('firstStudioTitle'), exact: true })).toBeVisible();
  await page.screenshot({ path: join(evidence, 'first-start.png'), fullPage: true });
  const opened = context.waitForEvent('page'); await page.getByRole('button', { name: en('openExampleStudio'), exact: true }).click(); example = await opened;
  await expect(example.getByRole('button', { name: en('exampleReviewStock'), exact: true })).toBeVisible();
  assert.equal(await example.evaluate(() => window.opener), null);
  let seeded = await readState(example, 'ricamo-example-studio'); assert.equal(seeded.materials.length, 5); assert.equal(seeded.settings.language, 'en');
  assert.deepEqual(await readState(page, 'ricamo-studio'), normal);
  await example.getByRole('button', { name: en('exampleReviewUnknown'), exact: true }).click();
  await example.locator('.page-header').getByRole('button', { name: 'Edit', exact: true }).click();
  const dialog = example.getByRole('dialog'); await dialog.getByLabel('Name', { exact: false }).fill('Browser example changes'); await dialog.getByRole('button', { name: 'Save', exact: true }).click(); await expect(dialog).toHaveCount(0);
  await example.reload(); await expect(example.locator('.sidebar')).toBeVisible(); seeded = await readState(example, 'ricamo-example-studio'); assert.ok(seeded.materials.some(row => row.name === 'Browser example changes'));
  await example.setViewportSize({ width: 760, height: 800 }); await example.screenshot({ path: join(evidence, 'example-narrow.png'), fullPage: true });
  assert.equal(await example.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  const closed = example.waitForEvent('close'); await example.getByRole('button', { name: en('returnToMyStudio'), exact: true }).click(); await closed;
  assert.deepEqual(await readState(page, 'ricamo-studio'), normal);
  // A manually opened example can still return to the normal studio in the same tab.
  example = await context.newPage(); await example.goto(`${base}/?example=1&language=en`); await expect(example.getByRole('button', { name: en('returnToMyStudio'), exact: true })).toBeVisible();
  await example.getByRole('button', { name: en('returnToMyStudio'), exact: true }).click();
  await expect(example.getByRole('heading', { name: en('firstStudioTitle'), exact: true })).toBeVisible();
  assert.deepEqual(await readState(page, 'ricamo-studio'), normal);
  assert.deepEqual(errors, []); assert.deepEqual(remote, []);
  const result = { evidence, checks: ['separate IndexedDB', 'no opener', 'real edit survives reload', '760px no overflow', 'Return closes launched example', 'manually opened example returns normally', 'normal library unchanged'], errors, remote };
  await writeFile(join(evidence, 'result.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
} catch (error) { await (example && !example.isClosed() ? example : page).screenshot({ path: join(evidence, 'failure.png'), fullPage: true }).catch(() => {}); throw error; } finally { await browser.close(); }
