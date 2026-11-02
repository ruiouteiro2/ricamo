import {chromium,_electron as electron,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {APP_VERSION} from '../core/version.mjs';
import {assertElectronSecurity} from './electron-security.mjs';

mkdirSync('.runtime',{recursive:true});
const data=mkdtempSync(resolve('.runtime/dmc-casa-routing-'));
const native=Boolean(process.env.RICAMO_EXECUTABLE),base=process.env.RICAMO_TEST_URL||'http://127.0.0.1:5173';
let app,browser,page;
if(native){const env={...process.env,RICAMO_DATA_DIR:data};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;app=await electron.launch({chromiumSandbox:true,executablePath:resolve(process.env.RICAMO_EXECUTABLE),env,timeout:40000});page=await app.firstWindow();}
else{browser=await chromium.launch({channel:'msedge',headless:true});page=await browser.newPage();}
const errors=[],requests=[];page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(/^https?:/.test(request.url())&&(native||!request.url().startsWith(base)))requests.push(request.url());});
try{
 if(!native)await page.goto(base);await page.locator('.sidebar').waitFor();if(native){assert.equal(await app.evaluate(({app})=>app.getVersion()),APP_VERSION);await assertElectronSecurity(app);}
 await page.locator('.sidebar').getByRole('button',{name:'Materiali',exact:true}).click();await page.locator('.inventory-category-card').filter({hasText:'Fili'}).getByRole('button',{name:'Aggiungi',exact:true}).click();
 const form=page.getByRole('dialog'),brand=form.getByLabel(/^Marca/),family=form.getByLabel(/^Tipologia/),size=form.getByLabel('Numero spessore',{exact:true}),code=form.getByLabel('Codice colore',{exact:true}),catalogue=form.getByLabel('Scegli dal catalogo',{exact:true}),reference=form.locator('.thread-reference');
 await brand.selectOption('DMC');
 const selectFamily=async(value,text)=>{await family.selectOption(value);await expect(reference).toContainText(text);await expect(reference).toContainText('Casa Cenina');};
 await selectFamily('mouline','DMC Mouliné');await selectFamily('special','DMC filati speciali');await selectFamily('silk','DMC Satin');await selectFamily('wool','DMC Lana Colbert');await selectFamily('spool','DMC Mouliné - Cono');
 await selectFamily('pearl','DMC Perlé');await size.fill('08');await expect(reference).toContainText('DMC Perlé #8');await code.fill('469');await expect(catalogue).not.toHaveValue('');await expect(catalogue.locator('option:checked')).toContainText('Perlé 8');
 const opened=[];if(native)await app.evaluate(({shell})=>{globalThis.__opened=[];shell.openExternal=async url=>{globalThis.__opened.push(url);};});else await page.evaluate(()=>{window.__opened=[];window.open=url=>{window.__opened.push(url);return null;};});
 await reference.getByRole('button',{name:'Apri riferimento filo',exact:true}).click();opened.push(native?await app.evaluate(()=>globalThis.__opened.at(-1)):await page.evaluate(()=>window.__opened.at(-1)));assert.equal(opened.at(-1),'https://www.casacenina.it/fili-e-filati/dmc/dmc-perle-8/');
 await size.fill('5');await expect(reference).toContainText('DMC Perlé #5');await expect(catalogue).toHaveValue('');await expect(catalogue.locator('option:checked')).not.toContainText('Perlé 8');
 await selectFamily('alsace',"DMC Coton Perlé - Retors d'Alsace #5");await size.fill('12');await expect(reference).toContainText("DMC Coton Perlé - Retors d'Alsace #12");await reference.getByRole('button',{name:'Apri riferimento filo',exact:true}).click();opened.push(native?await app.evaluate(()=>globalThis.__opened.at(-1)):await page.evaluate(()=>window.__opened.at(-1)));assert.equal(opened.at(-1),'https://www.casacenina.it/fili-e-filati/dmc/dmc-coton-perle-retors-d-alsace-12/');
 await selectFamily('diamant','DMC Diamant');
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);writeFileSync(join(data,'result.json'),JSON.stringify({version:APP_VERSION,native,opened,checks:['all DMC families routed to Casa Cenina','Perlé #8 selected by entered size','catalogue item limited to Perlé 8','old selection cleared after size change','Retors d’Alsace #12 selected by entered size','offline runtime'],errors,requests},null,2));console.log('PASS: DMC Casa Cenina family and thread-size catalogue routing. Evidence: '+data);
}catch(error){await page.screenshot({path:join(data,'failure.png')});throw error;}finally{if(app)await app.close();if(browser)await browser.close();}
