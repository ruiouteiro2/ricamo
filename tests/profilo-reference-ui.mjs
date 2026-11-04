import {isLocalPhoto} from './local-image-evidence.mjs';
import {closeAfterMaterialSave} from './material-entry-preference.mjs';
import {expect,_electron as electron} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {APP_VERSION} from '../core/version.mjs';
import {assertElectronSecurity} from './electron-security.mjs';

assert.ok(process.env.RICAMO_EXECUTABLE,'RICAMO_EXECUTABLE is required');mkdirSync('.runtime',{recursive:true});const data=mkdtempSync(resolve('.runtime/profilo-reference-'));
const env={...process.env,RICAMO_DATA_DIR:data};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
const app=await electron.launch({chromiumSandbox:true,executablePath:resolve(process.env.RICAMO_EXECUTABLE),env,timeout:40000}),page=await app.firstWindow(),errors=[],requests=[];
page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(/^https?:/.test(request.url()))requests.push(request.url());});
const field=name=>page.getByLabel(name,{exact:true}),preview=page.locator('.catalogue-auto-preview'),form=page.getByRole('dialog');
const card=name=>page.locator('.inventory-category-card').filter({has:page.getByRole('heading',{name,exact:true})});
try{
 await page.locator('.sidebar').waitFor();assert.equal(await app.evaluate(({app})=>app.getVersion()),APP_VERSION);await assertElectronSecurity(app);await closeAfterMaterialSave(page);
 await page.locator('.sidebar').getByRole('button',{name:'Materiali',exact:true}).click();
 await card('Fili').locator('.inventory-category-link').click();
 await expect(card('Profilo').locator('.thread-reference')).toContainText('Profilo 6 Mouliné');await expect(card('Anchor').locator('.thread-reference')).toHaveCount(0);
 await card('Profilo').locator('.inventory-category-link').click();
 await page.getByRole('button',{name:'Aggiungi materiale',exact:true}).first().click();
 await expect(form.locator('.thread-reference')).toContainText('Profilo 6 Mouliné');await expect(form.locator('.thread-reference')).toContainText('Casa Cenina');
 await expect(field('Tipologia *')).toHaveValue('mouline');await field('Codice colore').fill('002');
 await expect(preview).toContainText('Profilo · 6 Mouliné · 002',{timeout:15000});
 const image=preview.locator('img');await expect(image).toBeVisible();assert.ok(await image.evaluate(element=>element.complete&&element.naturalWidth>0),'swatch decodes');
 await expect(form.locator('select.catalogue-select')).not.toContainText('Colore digitale non disponibile');
 await field('Quantità posseduta').fill('2');await form.getByRole('button',{name:'Salva',exact:true}).click();await expect(form).toHaveCount(0);
 const row=page.locator('.table-wrap tbody tr').filter({hasText:'002'});await expect(row).toBeVisible();await expect(row).toContainText('matasse');
 assert.ok(isLocalPhoto(await row.locator('.swatch').evaluate(element=>getComputedStyle(element).backgroundImage)),'saved row shows the colour');
 await row.getByRole('button',{name:/^Modifica filo:/}).click();await expect(field('Tipologia *')).toHaveValue('mouline');await form.getByRole('button',{name:'Annulla',exact:true}).click();
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);console.log('PASS: Profilo reference and Mouliné catalogue choice. Evidence: '+data);
}catch(error){await page.screenshot({path:resolve(data,'failure.png')});throw error;}finally{await app.close();}
