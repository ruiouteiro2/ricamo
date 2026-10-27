import { _electron as electron, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertElectronSecurity } from './electron-security.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
mkdirSync(join(root, '.runtime'), { recursive: true });
const data = mkdtempSync(join(root, '.runtime', 'ui-polish-'));
const packaged = Boolean(process.env.RICAMO_EXECUTABLE);
const executable = process.env.RICAMO_EXECUTABLE || process.env.RICAMO_ELECTRON_RUNTIME || join(root, 'node_modules/electron/dist', process.platform === 'win32' ? 'electron.exe' : 'electron');
const env = { ...process.env, RICAMO_DATA_DIR: data };
delete env.ELECTRON_RUN_AS_NODE;
delete env.NODE_OPTIONS;
const errors = [], requests = [], checks = [];
const app = await electron.launch({ chromiumSandbox: true, executablePath: resolve(executable), args: packaged ? [] : [resolve(root)], env, timeout: 40000 });
try {
  const page = await app.firstWindow();
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'warning' && /Failed to resolve component|Transition/.test(message.text())) errors.push(message.text()); });
  page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
  await expect(page.locator('.sidebar')).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  const security = await assertElectronSecurity(app);
  assert.ok(await page.evaluate(() => CSS.supports('appearance', 'base-select')));
  const language = page.locator('.topbar select');
  assert.equal(await language.evaluate(el => getComputedStyle(el).appearance), 'base-select');
  await language.click();
  await expect.poll(() => language.evaluate(el => el.matches(':open'))).toBe(true);
  await page.screenshot({ path: join(data, 'language-picker.png') });
  await page.getByRole('option', { name: 'EN', exact: true }).click();
  await expect(language).toHaveValue('en');
  await language.focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('Home');
  await page.keyboard.press('Escape');
  await expect(language).toHaveValue('en');
  await language.focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  await expect(language).toHaveValue('it');
  await language.focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await expect(language).toHaveValue('en');
  checks.push('Custom picker supports pointer and keyboard selection; Escape cancels without changing language');

  async function nav(name) {
    await page.locator('.sidebar').getByRole('button', { name, exact: true }).click();
    await expect(page.locator('.page-header')).toBeVisible();
    await expect(page.locator('.page-enter-active, .page-leave-active')).toHaveCount(0);
  }
  for (const width of [1440, 1024, 800, 560]) {
    await page.setViewportSize({ width, height: 900 });
    for (const name of ['Storage', 'Shopping']) {
      await nav(name);
      const bounds = await page.evaluate(() => {
        const header = document.querySelector('.page-header').getBoundingClientRect();
        const bar = document.querySelector('.topbar').getBoundingClientRect();
        const sidebar = document.querySelector('.sidebar').getBoundingClientRect();
        return { left: header.left - sidebar.right, right: innerWidth - header.right, top: header.top - bar.bottom, overflow: document.documentElement.scrollWidth > innerWidth };
      });
      assert.ok(bounds.left >= 16 && bounds.right >= 15 && bounds.top >= 24, JSON.stringify({ name, width, bounds }));
      assert.equal(bounds.overflow, false, `${name} overflows at ${width}`);
    }
  }
  checks.push('Locations and Purchases retain shared gutters at 1440, 1024, 800 and 560 CSS pixels');
  await page.setViewportSize({ width: 1440, height: 900 });
  await nav('Storage');
  await page.screenshot({ path: join(data, 'locations.png'), fullPage: true });
  await page.locator('.page-header').getByRole('button', { name: 'New location', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name', { exact: false }).first().fill('UI parent location');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.locator('.page-header').getByRole('button', { name: 'New location', exact: true }).click();
  await dialog.getByLabel('Name', { exact: false }).first().fill('UI nested location');
  const parent = dialog.getByLabel('Inside', { exact: true });
  await parent.click();
  await page.getByRole('option', { name: 'UI parent location', exact: true }).click();
  await expect(parent).not.toHaveValue('');
  await parent.click();
  await page.screenshot({ path: join(data, 'dialog-picker.png') });
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const stored = await page.evaluate(() => window.ricamo.load());
  assert.ok(stored.ok);
  const parentRecord = stored.value.locations.find(row => row.name === 'UI parent location');
  assert.equal(stored.value.locations.find(row => row.name === 'UI nested location').parentId, parentRecord.id);
  checks.push('Picker displays above modal; Escape dismisses only the picker; selection persists to SQLite');

  await nav('Materials');
  const summary = page.locator('summary').first();
  await summary.click();
  await expect(summary.locator('..')).toHaveAttribute('open', '');
  await summary.click();
  await expect(summary.locator('..')).not.toHaveAttribute('open', '');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await nav('Storage');
  assert.equal(await language.evaluate(el => getComputedStyle(el, '::picker-icon').transitionDuration), '0s');
  await page.locator('.page-header').getByRole('button', { name: 'New location', exact: true }).click();
  assert.equal(await dialog.evaluate(el => getComputedStyle(el).animationName), 'none');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  checks.push('Disclosure toggles and reduced-motion settings preserve immediate interaction');
  assert.deepEqual(errors, []);
  assert.deepEqual(requests, []);
  const result = { passed: true, data, executable, security, checks, errors, requests };
  writeFileSync(join(data, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally { await app.close(); }
