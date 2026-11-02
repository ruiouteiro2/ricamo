import {closeAfterMaterialSave} from './material-entry-preference.mjs';
import {expect,_electron as electron} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {Repository} from '../desktop/repository.mjs';
import {APP_VERSION} from '../core/version.mjs';
import {assertElectronSecurity} from './electron-security.mjs';

assert.ok(process.env.RICAMO_EXECUTABLE,'RICAMO_EXECUTABLE is required');mkdirSync('.runtime',{recursive:true});const data=mkdtempSync(resolve('.runtime/dmc-pearl-format-'));
const env={...process.env,RICAMO_DATA_DIR:data};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
const app=await electron.launch({chromiumSandbox:true,executablePath:resolve(process.env.RICAMO_EXECUTABLE),env,timeout:40000}),page=await app.firstWindow(),errors=[],requests=[];
page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(/^https?:/.test(request.url()))requests.push(request.url());});
const field=name=>page.getByLabel(name,{exact:true}),preview=page.locator('.catalogue-auto-preview'),form=page.getByRole('dialog');
const open=async()=>{await page.getByRole('button',{name:'Aggiungi materiale',exact:true}).first().click();await field('Tipologia *').selectOption({label:'Perlé'});};
const fill=async(code,size,quantity)=>{await field('Codice colore').fill(code);await field('Numero spessore').fill(size);await expect(preview).toContainText(`Perlé ${size}`,{timeout:15000});await field('Quantità posseduta').fill(quantity);};
const save=async()=>{await form.getByRole('button',{name:'Salva',exact:true}).click();};
let closed=false;
try{
 await page.locator('.sidebar').waitFor();assert.equal(await app.evaluate(({app})=>app.getVersion()),APP_VERSION);await assertElectronSecurity(app);await closeAfterMaterialSave(page);
 await page.locator('.sidebar').getByRole('button',{name:'Materiali',exact:true}).click();
 const card=name=>page.locator('.inventory-category-card').filter({has:page.getByRole('heading',{name,exact:true})});
 await card('Fili').locator('.inventory-category-link').click();await card('DMC').locator('.inventory-category-link').click();
 const rows=page.locator('.table-wrap tbody tr');

 // The choice exists only for Perlé and follows the catalogue format until changed.
 await page.getByRole('button',{name:'Aggiungi materiale',exact:true}).first().click();await expect(field('Formato')).toHaveCount(0);
 await field('Tipologia *').selectOption({label:'Perlé'});await expect(field('Formato').locator('option')).toHaveText(['Matassa','Gomitolo']);
 await fill('52','8','2');await expect(field('Formato')).toHaveValue('ball');await expect(form).toContainText('gomitoli. Lascia vuoto');
 await field('Formato').selectOption({label:'Matassa'});await expect(form).toContainText('matasse. Lascia vuoto');
 await field('Numero spessore').fill('8');await page.waitForTimeout(600);await expect(field('Formato')).toHaveValue('skein');
 await save();await expect(form).toHaveCount(0);
 await expect(rows.filter({hasText:'Matassa'})).toContainText('matasse');

 // A ball of the same colour is new stock, with no duplicate prompt.
 await open();await fill('52','8','1');await field('Formato').selectOption({label:'Gomitolo'});await save();await expect(form).toHaveCount(0);
 await expect(rows.filter({hasText:'Gomitolo'})).toContainText('gomitoli');await expect(rows.filter({hasText:'· 52 ·'})).toHaveCount(2);

 // Another skein of that colour still asks to add to the existing one.
 await open();await fill('52','8','3');await field('Formato').selectOption({label:'Matassa'});await save();
 const prompt=form.filter({has:page.locator('.duplicate-quantity-summary')});await expect(prompt).toBeVisible();await expect(prompt).toContainText('matasse');await prompt.locator('.button.primary').click();await expect(form).toHaveCount(0);
 await expect(rows.filter({hasText:'· 52 ·'})).toHaveCount(2);

 // The edit form shows the saved format.
 await rows.filter({hasText:'Gomitolo'}).getByRole('button',{name:/^Modifica filo:/}).click();await expect(field('Formato')).toHaveValue('ball');await form.getByRole('button',{name:'Annulla',exact:true}).click();await expect(form).toHaveCount(0);
 await page.getByRole('button',{name:'Aggiungi materiale',exact:true}).first().click();await field('Tipologia *').selectOption({label:'Coton retors mat'});await expect(field('Formato')).toHaveCount(0);await form.getByRole('button',{name:'Annulla',exact:true}).click();
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
 await app.close();closed=true;

 const repository=new Repository(join(data,'ricamo.sqlite'));
 try{
  const state=repository.load(),materials=state.materials.filter(row=>row.code==='52');assert.equal(materials.length,2);
  const skein=materials.find(row=>row.unit==='skein'),ball=materials.find(row=>row.unit==='ball');
  assert.equal(skein.properties.threadFormat,'skein');assert.equal(ball.properties.threadFormat,'ball');
  assert.equal(skein.properties.product.pack.unit,'skein');assert.equal(skein.properties.product.pack.lengthM,null);
  assert.equal(ball.properties.product.pack.unit,'ball');
  const held=row=>state.lots.filter(lot=>lot.materialId===row.id).reduce((sum,lot)=>sum+lot.quantity,0);
  assert.equal(held(skein),5);assert.equal(held(ball),1);
 }finally{repository.close();}
 console.log('PASS: DMC Perlé skein and ball choice, separate stock and honest pack. Evidence: '+data);
}catch(error){if(!closed)await page.screenshot({path:join(data,'failure.png')});throw error;}finally{if(!closed)await app.close();}
