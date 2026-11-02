import {closeAfterMaterialSave} from './material-entry-preference.mjs';
import {expect,_electron as electron} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {APP_VERSION} from '../core/version.mjs';
import {assertElectronSecurity} from './electron-security.mjs';

assert.ok(process.env.RICAMO_EXECUTABLE,'RICAMO_EXECUTABLE is required');mkdirSync('.runtime',{recursive:true});const data=process.env.RICAMO_PEARL_DATA||mkdtempSync(resolve('.runtime/dmc-pearl-'));
const env={...process.env,RICAMO_DATA_DIR:data};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
const started=Date.now(),app=await electron.launch({chromiumSandbox:true,executablePath:resolve(process.env.RICAMO_EXECUTABLE),env,timeout:40000}),page=await app.firstWindow(),errors=[],requests=[];
page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(/^https?:/.test(request.url()))requests.push(request.url());});
const preview=page.locator('.catalogue-auto-preview'),field=name=>page.getByLabel(name,{exact:true});
try{
 await page.locator('.sidebar').waitFor();const startupMs=Date.now()-started;assert.equal(await app.evaluate(({app})=>app.getVersion()),APP_VERSION);await assertElectronSecurity(app);await closeAfterMaterialSave(page);
 await page.locator('.sidebar').getByRole('button',{name:'Materiali',exact:true}).click();
 const card=name=>page.locator('.inventory-category-card').filter({has:page.getByRole('heading',{name,exact:true})});
 await card('Fili').locator('.inventory-category-link').click();await card('DMC').locator('.inventory-category-link').click();
 await page.getByRole('button',{name:'Aggiungi materiale',exact:true}).first().click();
 await field('Tipologia *').selectOption({label:'Perlé'});
 for(const [size,code] of [['8','52'],['5','726'],['3','726'],['12','726']]){
  await field('Codice colore').fill(code);await field('Numero spessore').fill(size);
  await expect(preview).toContainText(`Perlé ${size}`,{timeout:15000});await expect(preview).toContainText(code);
  const image=preview.locator('img');await expect(image).toBeVisible();assert.ok(await image.evaluate(element=>element.complete&&element.naturalWidth>0),`${size}/${code} decodes`);
 }
 await field('Tipologia *').selectOption({label:"Ritorto d'Alsazia"});await field('Codice colore').fill('726');await field('Numero spessore').fill('12');
 await expect(preview).toContainText("Retors d'Alsace #12",{timeout:15000});await expect(preview.locator('img')).toBeVisible();
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);console.log(`PASS: DMC Perlé previews, startup ${startupMs} ms. Evidence: ${data}`);
}catch(error){await page.screenshot({path:resolve(data,'failure.png')});throw error;}finally{await app.close();}
