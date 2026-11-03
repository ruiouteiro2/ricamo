import {closeAfterMaterialSave} from './material-entry-preference.mjs';
import {expect,_electron as electron} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {APP_VERSION} from '../core/version.mjs';
import {assertElectronSecurity} from './electron-security.mjs';
import {missingCatalogueArticles} from '../src/catalogue-rows.mjs';

assert.ok(process.env.RICAMO_EXECUTABLE,'RICAMO_EXECUTABLE is required');mkdirSync('.runtime',{recursive:true});const data=mkdtempSync(resolve('.runtime/dmc-mouline-rows-'));
const env={...process.env,RICAMO_DATA_DIR:data};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
const app=await electron.launch({chromiumSandbox:true,executablePath:resolve(process.env.RICAMO_EXECUTABLE),env,timeout:40000}),page=await app.firstWindow(),errors=[],requests=[];
page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(/^https?:/.test(request.url()))requests.push(request.url());});
const dialog=page.getByRole('dialog'),grey=page.locator('.catalogue-rows tr'),owned=page.locator('.table-wrap tbody:not(.catalogue-rows) tr'),find=page.locator('.toolbar-search input'),footer=page.locator('.panel-heading small').last();
const card=name=>page.locator('.inventory-category-card').filter({has:page.getByRole('heading',{name,exact:true})});
const total=missingCatalogueArticles('DMC',[]).length;
try{
 await page.locator('.sidebar').waitFor();assert.equal(await app.evaluate(({app})=>app.getVersion()),APP_VERSION);await assertElectronSecurity(app);await closeAfterMaterialSave(page);
 await page.locator('.sidebar').getByRole('button',{name:'Materiali',exact:true}).click();await card('Fili').locator('.inventory-category-link').click();await card('DMC').locator('.inventory-category-link').click();
 await expect(footer).toContainText(`${total} non ancora inseriti`);
 // A colour entered by hand leaves the grey list, whichever way the code was spelled.
 await page.getByRole('button',{name:'Aggiungi materiale',exact:true}).first().click();await dialog.getByLabel('Codice colore',{exact:true}).fill('ecru');await expect(dialog.locator('.catalogue-auto-preview')).toContainText(/ecru/i,{timeout:15000});await dialog.getByLabel('Quantità posseduta',{exact:true}).fill('1');await dialog.getByRole('button',{name:'Salva',exact:true}).click();await expect(dialog).toHaveCount(0);
 await expect(footer).toContainText(`${total-1} non ancora inseriti`);await find.fill('ecru');await expect(grey.filter({has:page.locator('.cell-title',{hasText:/^ecru( |$)/i})})).toHaveCount(0);await expect(owned).toHaveCount(1);
 // Greyed out with the cart as its only action.
 await find.fill('321');const red=grey.filter({has:page.locator('.cell-title',{hasText:/^321( |$)/})});await expect(red).toHaveCount(1);await expect(red.locator('button')).toHaveCount(1);assert.ok(Number(await red.locator('td').nth(1).evaluate(element=>getComputedStyle(element).opacity))<.6,'greyed out');
 await expect(red.locator('.swatch')).toBeVisible();assert.notEqual(await red.locator('.swatch').evaluate(element=>getComputedStyle(element).backgroundColor),'rgba(0, 0, 0, 0)');
 // An out-of-production colour is absent until entered in the inventory.
 await find.fill('222');const retired=grey.filter({has:page.locator('.cell-title',{hasText:/^222( |$)/})});await expect(retired).toHaveCount(0);
 // Ordering makes it a skein of DMC Mouliné, in Shopping, and it opens like any entered thread.
 await find.fill('321');await red.locator('button').click();await dialog.getByLabel('Quantità *',{exact:true}).fill('3');await dialog.getByRole('button',{name:'Inserisci in Acquisti',exact:true}).click();await expect(dialog).toHaveCount(0);
 await expect(red).toHaveCount(0);const bought=owned.filter({hasText:'321'});await expect(bought).toContainText('DMC · Mouliné · 321');
 await bought.getByRole('button',{name:/^Modifica/}).click();await expect(dialog.getByLabel('Tipologia *',{exact:true})).toHaveValue('mouline');await expect(dialog.getByLabel('Codice colore',{exact:true})).toHaveValue('321');await dialog.getByRole('button',{name:'Annulla',exact:true}).click();
 // Select owned and catalogue rows across searches, then enter quantities together.
 await bought.locator('input[type="checkbox"]').check();
 await find.fill('310');const black=grey.filter({has:page.locator('.cell-title',{hasText:/^310( |$)/})});await black.locator('input[type="checkbox"]').check();
 await find.fill('666');const bright=grey.filter({has:page.locator('.cell-title',{hasText:/^666( |$)/})});await bright.locator('input[type="checkbox"]').check();
 const selectionBar=page.locator('.panel-heading').filter({has:page.getByRole('button',{name:'Inserisci in Acquisti',exact:true})});await expect(selectionBar).toContainText('3');await selectionBar.getByRole('button',{name:'Inserisci in Acquisti',exact:true}).click();
 const amounts=dialog.locator('input[inputmode="decimal"]');await expect(amounts).toHaveCount(3);await amounts.nth(0).fill('2');await amounts.nth(1).fill('4');await amounts.nth(2).fill('5');await dialog.getByRole('button',{name:'Inserisci in Acquisti',exact:true}).click();await expect(dialog).toHaveCount(0);
 await page.locator('.sidebar').getByRole('button',{name:'Acquisti',exact:true}).click();const order=page.locator('.table-wrap tbody tr').filter({hasText:'321'});await expect(order).toHaveCount(2);await expect(order.first()).toContainText(/matass/i);await expect(page.locator('.table-wrap tbody tr').filter({hasText:'310'})).toContainText('4');await expect(page.locator('.table-wrap tbody tr').filter({hasText:'666'})).toContainText('5');
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);console.log('PASS: DMC Mouliné colours not yet entered are greyed out and orderable. Evidence: '+data);
}catch(error){await page.screenshot({path:resolve(data,'failure.png')});throw error;}finally{await app.close();}
