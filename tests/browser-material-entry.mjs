import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
await mkdir('.runtime', { recursive: true });
const browser=await chromium.launch({headless:true,...(process.env.RICAMO_BROWSER_CHANNEL ? {channel:process.env.RICAMO_BROWSER_CHANNEL} : {})});
const page=await browser.newPage({viewport:{width:1300,height:1000},reducedMotion:'reduce'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='warning')console.log('WARN',m.text())});
const read=()=>page.evaluate(()=>new Promise((resolve,reject)=>{const opening=indexedDB.open('ricamo-studio',1);opening.onerror=()=>reject(opening.error);opening.onsuccess=()=>{const db=opening.result,request=db.transaction('state','readonly').objectStore('state').get('current');request.onsuccess=()=>{resolve(request.result);db.close()};request.onerror=()=>reject(request.error);};}));
const dialog=page.getByRole('dialog');
const open=async()=>{await page.locator('.sidebar').getByRole('button',{name:'Materiali',exact:true}).click();await page.getByRole('button',{name:'Aggiungi materiale',exact:true}).first().click();await dialog.waitFor();};
try {
await page.goto(process.env.RICAMO_TEST_URL || 'http://127.0.0.1:4173');await page.locator('.sidebar').waitFor();await open();
const family=dialog.getByLabel(/^Tipologia/),brand=dialog.getByLabel(/^Marca/),status=dialog.getByLabel('Stato',{exact:true}),catalogue=dialog.getByLabel('Scegli dal catalogo',{exact:true});
assert.equal(await family.locator('option').count(),6);assert.deepEqual(await status.locator('option').allTextContents(),['Nuovo','Parzialmente utilizzato','Finito']);
await expect(brand.locator('option[value="DMC"]')).toBeAttached();await brand.selectOption('DMC');await expect(family.locator('option')).toHaveCount(7);await family.selectOption('mouline');await dialog.getByLabel('Codice colore',{exact:true}).fill('310');
await expect(catalogue).toBeEnabled();await expect(catalogue.locator('option[value]').filter({hasText:'310'}).first()).toBeAttached();
const productId=await catalogue.locator('option').evaluateAll(options=>options.find(o=>o.value&&o.textContent.includes('310')).value);await catalogue.selectOption(productId);
await expect(catalogue.locator('selectedcontent .catalogue-swatch')).toBeVisible();assert.notEqual(await catalogue.locator('selectedcontent .catalogue-swatch').evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)');
await status.selectOption('partial');await dialog.getByLabel('Quantit\u00e0 posseduta',{exact:true}).fill('2');
await family.click();await page.screenshot({path:'.runtime/material-types-menu.png'});await page.keyboard.press('Escape');
await catalogue.click();await page.screenshot({path:'.runtime/material-catalogue-menu.png'});await page.keyboard.press('Escape');
await dialog.getByRole('button',{name:'Salva',exact:true}).click();await expect(dialog).toHaveCount(0);let state=await read();assert.equal(state.lots[0].properties.usageStatus,'partial');assert.equal(state.lots[0].quantity,2);assert.equal(state.materials[0].properties.threadFamily,'mouline');await expect(page.getByText('Parzialmente utilizzato',{exact:true})).toBeVisible();
await page.reload();await page.locator('.sidebar').waitFor();assert.equal((await read()).lots[0].properties.usageStatus,'partial');
await open();await expect(brand.locator('option[value="DMC"]')).toBeAttached();await brand.selectOption('DMC');await family.selectOption('pearl');await dialog.getByLabel('Codice colore',{exact:true}).fill('001');await dialog.getByLabel('Quantit\u00e0 posseduta',{exact:true}).fill('3');await status.selectOption('finished');await expect(dialog.getByLabel('Quantit\u00e0 posseduta',{exact:true})).toHaveValue('0');await dialog.getByRole('button',{name:'Salva',exact:true}).click();await expect(dialog).toHaveCount(0);
state=await read();const material=state.materials.find(m=>m.code==='001');assert.equal(material.properties.threadFamily,'pearl');assert.equal(state.lots.find(l=>l.materialId===material.id).quantity,0);assert.equal(state.lots.find(l=>l.materialId===material.id).properties.usageStatus,'finished');
await page.locator('.sidebar').getByRole('button',{name:'Acquisti',exact:true}).click();await expect(page.getByRole('region',{name:'Scorte da riassortire'})).toContainText('001');
await open();await expect(brand.locator('option[value="DMC"]')).toBeAttached();await brand.selectOption('DMC');await family.selectOption('special');await dialog.getByLabel('Codice colore',{exact:true}).fill('E130');await expect(catalogue).toBeEnabled();await expect(catalogue.locator('option').filter({hasText:'E130'}).first()).toBeAttached();const specialId=await catalogue.locator('option').evaluateAll(options=>options.find(o=>o.value&&o.textContent.includes('E130')).value);await catalogue.selectOption(specialId);await expect(family).toHaveValue('special');
await page.setViewportSize({width:390,height:844});await status.click();await page.screenshot({path:'.runtime/material-status-mobile.png'});await page.keyboard.press('Escape');assert.equal(await dialog.evaluate(el=>el.scrollWidth>el.clientWidth),false);
assert.deepEqual(errors,[]);console.log('PASS: three statuses, six common families and brand-specific twisted type, visible colour swatch in selection/menu, partial persistence, finished sets zero and shopping, special catalogue filtering, desktop/mobile menu, no renderer errors.');
}catch(e){console.log('ERRORS',errors);console.log((await page.locator('body').innerText()).slice(-1800));await page.screenshot({path:'.runtime/material-options-failure.png'});throw e;}finally{await browser.close()}

