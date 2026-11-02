import {closeAfterMaterialSave} from './material-entry-preference.mjs';
import {expect,_electron as electron} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {APP_VERSION} from '../core/version.mjs';
import {assertElectronSecurity} from './electron-security.mjs';

assert.ok(process.env.RICAMO_EXECUTABLE,'RICAMO_EXECUTABLE is required');mkdirSync('.runtime',{recursive:true});const data=mkdtempSync(resolve('.runtime/mill-hill-'));
const env={...process.env,RICAMO_DATA_DIR:data};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
const app=await electron.launch({chromiumSandbox:true,executablePath:resolve(process.env.RICAMO_EXECUTABLE),env,timeout:40000}),page=await app.firstWindow(),errors=[],requests=[];
page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(/^https?:/.test(request.url()))requests.push(request.url());});
const field=name=>page.getByLabel(name,{exact:true}),preview=page.locator('.catalogue-auto-preview'),form=page.getByRole('dialog'),menu=form.locator('select.catalogue-select');
const card=name=>page.locator('.inventory-category-card').filter({has:page.getByRole('heading',{name,exact:true})});
const decoded=async()=>{const image=preview.locator('img');await expect(image).toBeVisible();assert.ok(await image.evaluate(element=>element.complete&&element.naturalWidth>0),'photo decodes');return image.getAttribute('src');};
try{
 await page.locator('.sidebar').waitFor();assert.equal(await app.evaluate(({app})=>app.getVersion()),APP_VERSION);await assertElectronSecurity(app);await closeAfterMaterialSave(page);
 await page.locator('.sidebar').getByRole('button',{name:'Materiali',exact:true}).click();
 await card('Perle').locator('.inventory-category-link').click();
 await expect(card('Mill Hill').locator('.thread-reference')).toContainText('Casa Cenina');await card('Mill Hill').locator('.inventory-category-link').click();
 await page.getByRole('button',{name:'Aggiungi materiale',exact:true}).first().click();
 await expect(form.locator('.thread-reference')).toContainText('Casa Cenina');
 // Same layout as threads: no name to type, a type menu and the code driving the preview.
 await expect(field('Nome *')).toHaveCount(0);await expect(field('Tipologia *')).toHaveValue('Glass Seed Beads');
 await expect(menu.locator('option')).toHaveCount(113,{timeout:15000});
 await field('Codice colore').fill('00143');
 await expect(preview).toContainText('Mill Hill · Glass Seed Beads · 00143',{timeout:15000});await expect(preview).toContainText('Robin Egg Blue Ceylon');
 const blue=await decoded();
 // Another line's code is found at once and brings its own line.
 await field('Codice colore').fill('12143');
 await expect(preview).toContainText('Mill Hill · Glass Treasures · 12143',{timeout:15000});await expect(field('Tipologia *')).toHaveValue('Glass Treasures');
 assert.notEqual(await decoded(),blue);
 // Choosing a line after a catalogue code starts again from that line's menu.
 await field('Tipologia *').selectOption('Magnifica');await expect(field('Codice colore')).toHaveValue('');await expect(menu.locator('option')).toHaveCount(120,{timeout:15000});
 // An article unknown to the catalogue can still be saved by hand under the chosen line.
 await field('Codice colore').fill('99999');await expect(preview).toContainText('99999',{timeout:15000});await expect(field('Tipologia *')).toHaveValue('Magnifica');await expect(preview.locator('img')).toHaveCount(0);
 await field('Quantità posseduta').fill('1');await form.getByRole('button',{name:'Salva',exact:true}).click();await expect(form).toHaveCount(0);
 await expect(page.locator('.table-wrap tbody tr').filter({hasText:'99999'})).toContainText('Magnifica');
 await page.getByRole('button',{name:'Aggiungi materiale',exact:true}).first().click();
 await field('Codice colore').fill('00143');await expect(preview).toContainText('Robin Egg Blue Ceylon',{timeout:15000});
 await expect(form.getByText(/^confezion/i).or(form.getByText(/confezioni\. /))).not.toHaveCount(0);
 await field('Quantità posseduta').fill('2');await form.getByRole('button',{name:'Salva',exact:true}).click();await expect(form).toHaveCount(0);
 const row=page.locator('.table-wrap tbody tr').filter({hasText:'00143'});await expect(row).toBeVisible();await expect(row).toContainText('Mill Hill · Glass Seed Beads · 00143 · Robin Egg Blue Ceylon');await expect(row).toContainText('confezioni');
 assert.ok((await row.locator('.swatch').evaluate(element=>getComputedStyle(element).backgroundImage)).startsWith('url("data:image/'),'saved row shows the beads');
 // The saved row reopens in the same layout, and a changed code renames it.
 await row.getByRole('button',{name:/^Modifica/}).click();await expect(field('Nome *')).toHaveCount(0);await expect(field('Tipologia *')).toHaveValue('Glass Seed Beads');await expect(field('Codice colore')).toHaveValue('00143');
 await expect(preview).toContainText('Robin Egg Blue Ceylon',{timeout:15000});await decoded();
 await field('Codice colore').fill('12143');await expect(preview).toContainText('Mill Hill · Glass Treasures · 12143',{timeout:15000});
 await form.getByRole('button',{name:'Salva',exact:true}).click();await expect(form).toHaveCount(0);
 const renamed=page.locator('.table-wrap tbody tr').filter({hasText:'12143'});await expect(renamed).toContainText('Mill Hill · Glass Treasures · 12143 · Medium Leaf Matte Tourmaline');await expect(renamed).toContainText('2');await expect(page.locator('.table-wrap tbody tr').filter({hasText:'00143'})).toHaveCount(0);
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);console.log('PASS: Mill Hill beads use the thread entry layout with offline photos. Evidence: '+data);
}catch(error){await page.screenshot({path:resolve(data,'failure.png')});throw error;}finally{await app.close();}
