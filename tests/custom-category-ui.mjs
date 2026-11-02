import {closeAfterMaterialSave} from './material-entry-preference.mjs';
import {expect,_electron as electron} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {APP_VERSION} from '../core/version.mjs';
import {assertElectronSecurity} from './electron-security.mjs';

assert.ok(process.env.RICAMO_EXECUTABLE,'RICAMO_EXECUTABLE is required');mkdirSync('.runtime',{recursive:true});const data=mkdtempSync(resolve('.runtime/custom-category-'));
const env={...process.env,RICAMO_DATA_DIR:data};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;const errors=[],requests=[];
async function open(){const app=await electron.launch({chromiumSandbox:true,executablePath:resolve(process.env.RICAMO_EXECUTABLE),env,timeout:40000}),page=await app.firstWindow();page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(/^https?:/.test(request.url()))requests.push(request.url());});await page.locator('.sidebar').waitFor();return{app,page};}
const name='Telai antichi';
const materials=page=>page.locator('.sidebar').getByRole('button',{name:'Materiali',exact:true}).click();
const tile=page=>page.locator('.inventory-category-card').filter({has:page.getByRole('heading',{name,exact:true})});
let {app,page}=await open();
try{
 assert.equal(await app.evaluate(({app})=>app.getVersion()),APP_VERSION);await assertElectronSecurity(app);await closeAfterMaterialSave(page);
 await materials(page);
 await expect(page.getByRole('button',{name:'Aggiungi materiale',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Aggiungi categoria',exact:true}).click();
 let dialog=page.getByRole('dialog');await dialog.getByLabel(/^Nome della categoria/).fill(name);await dialog.getByRole('button',{name:'Salva categoria',exact:true}).click();await expect(dialog).toHaveCount(0);
 await expect(tile(page)).toBeVisible();await expect(tile(page)).toContainText('0');
 await tile(page).locator('.inventory-category-link').click();await expect(page.locator('h1')).toHaveText(name);
 await page.getByRole('button',{name:'Aggiungi materiale',exact:true}).first().click();
 dialog=page.getByRole('dialog');await expect(dialog.getByLabel('Scegli dal catalogo',{exact:true})).toHaveCount(0);
 await dialog.getByLabel(/^Nome/).fill('Telaio a rullo');await dialog.getByLabel('Marca',{exact:false}).fill('Elbesee');await dialog.getByRole('button',{name:'Salva',exact:true}).click();await expect(dialog).toHaveCount(0);
 const row=page.locator('.table-wrap tbody tr').filter({hasText:'Telaio a rullo'});await expect(row).toBeVisible();await expect(row).toContainText(name);
 await app.close();({app,page}=await open());
 await materials(page);await expect(tile(page)).toContainText('1');
 await tile(page).locator('.inventory-category-link').click();await expect(page.locator('.table-wrap tbody tr').filter({hasText:'Telaio a rullo'})).toBeVisible();
 await page.locator('.table-wrap tbody tr').filter({hasText:'Telaio a rullo'}).getByRole('button').first().waitFor();
 await materials(page);await page.locator('.inventory-category-card').filter({has:page.getByRole('heading',{name:'Fili',exact:true})}).locator('.inventory-category-link').click();await page.locator('.inventory-category-card').filter({has:page.getByRole('heading',{name:'DMC',exact:true})}).locator('.inventory-category-link').click();
 await expect(page.getByRole('button',{name:'Aggiungi materiale',exact:true}).first()).toBeVisible();await expect(page.getByRole('button',{name:'Aggiungi categoria',exact:true})).toHaveCount(0);
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);console.log('PASS: custom category journey. Evidence: '+join(data));
}catch(error){await page.screenshot({path:join(data,'failure.png')});throw error;}finally{await app.close();}
