import {closeAfterMaterialSave} from './material-entry-preference.mjs';
import {expect,_electron as electron} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {APP_VERSION} from '../core/version.mjs';
import {assertElectronSecurity} from './electron-security.mjs';

assert.ok(process.env.RICAMO_EXECUTABLE,'RICAMO_EXECUTABLE is required');mkdirSync('.runtime',{recursive:true});const data=process.env.RICAMO_ALSACE_DATA||mkdtempSync(resolve('.runtime/dmc-alsace-'));
const env={...process.env,RICAMO_DATA_DIR:data};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
const app=await electron.launch({chromiumSandbox:true,executablePath:resolve(process.env.RICAMO_EXECUTABLE),env,timeout:40000}),page=await app.firstWindow(),errors=[],requests=[];
page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(/^https?:/.test(request.url()))requests.push(request.url());});
const preview=page.locator('.catalogue-auto-preview');
const field=name=>page.getByLabel(name,{exact:true});
try{
 await page.locator('.sidebar').waitFor();assert.equal(await app.evaluate(({app})=>app.getVersion()),APP_VERSION);await assertElectronSecurity(app);await closeAfterMaterialSave(page);
 await page.locator('.sidebar').getByRole('button',{name:'Materiali',exact:true}).click();
 const card=name=>page.locator('.inventory-category-card').filter({has:page.getByRole('heading',{name,exact:true})});
 await card('Fili').getByRole('button').first().click();await card('DMC').getByRole('button').first().click();
 await page.getByRole('button',{name:'Aggiungi materiale',exact:true}).first().click();
 await field('Tipologia *').selectOption({label:"Ritorto d'Alsazia"});
 await field('Codice colore').fill('726');await field('Numero spessore').fill('#12');
 const image=preview.locator('img');await expect(image).toBeVisible({timeout:15000});
 await expect(preview).toContainText("Retors d'Alsace #12");await expect(preview).toContainText('726');
 assert.ok(await image.evaluate(element=>element.complete&&element.naturalWidth>0),'swatch decodes');
 await field('Numero spessore').fill('#5');await expect(preview).toContainText("Retors d'Alsace #5");await expect(image).toBeVisible();
 // A code DMC does not list must fall back to the prompt, never to a stale "loading" label.
 await field('Codice colore').fill('99999');await expect(preview).not.toContainText('Alsace');await expect(preview.locator('img')).toHaveCount(0);
 const select=page.locator('select.catalogue-select');await expect(select).toBeEnabled();
 await page.waitForTimeout(600);
 const shown=await select.evaluate(element=>element.querySelector('selectedcontent')?.textContent||element.selectedOptions[0]?.textContent||'');
 assert.ok(!/loading|caricamento/i.test(shown),`stale select label: ${shown}`);
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);console.log("PASS: DMC Retors d'Alsace previews. Evidence: "+data);
}catch(error){await page.screenshot({path:resolve(data,'failure.png')});throw error;}finally{await app.close();}
