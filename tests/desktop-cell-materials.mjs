import {_electron as electron,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {Repository} from '../desktop/repository.mjs';
import {createBlank,counts} from '../core/pattern.mjs';
import {colorFromProduct} from '../core/pattern-materials.mjs';
import {bundledSupplierProducts} from '../core/supplier-products.mjs';
import {assertElectronSecurity} from './electron-security.mjs';

const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
mkdirSync(join(root,'.runtime'),{recursive:true});
const data=mkdtempSync(join(root,'.runtime','cell-materials-'));
const products=bundledSupplierProducts(),black=products.find(p=>p.brand==='DMC'&&p.range==='Mouliné'&&p.code==='310');
const bead=products.find(p=>p.brand==='Mill Hill'&&p.category==='embellishment'&&p.code);
assert.ok(black&&bead);
let repo=new Repository(join(data,'ricamo.sqlite'));
const run=(type,payload)=>repo.execute({type,payload,operationId:crypto.randomUUID()},repo.load().revision);
run('settings.save',{language:'en'});
const revision=createBlank(6,4,[{...colorFromProduct(black),symbol:'A'}],{id:'base',settings:{fabric:{type:'linen',countX:32,countY:32,countMeaning:'threads',overX:2,overY:2},symbolMode:'special'}});
revision.cells.fill(0);run('pattern.save',{id:'pattern',name:'Cell material sampler',revision});repo.close();
const env={...process.env,RICAMO_DATA_DIR:data};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
const executablePath=resolve(process.env.RICAMO_EXECUTABLE||process.env.RICAMO_ELECTRON_RUNTIME||join(root,'node_modules/electron/dist',process.platform==='win32'?'electron.exe':'electron'));
const app=await electron.launch({chromiumSandbox:true,executablePath,args:process.env.RICAMO_EXECUTABLE?[]:[root],env,timeout:40000});
const page=await app.firstWindow(),errors=[],requests=[],checks=[];page.setDefaultTimeout(30000);
page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(/^https?:/.test(request.url()))requests.push(request.url());});
const dialog=()=>page.getByRole('dialog').last();
const load=async()=>{const result=await page.evaluate(()=>window.ricamo.load());assert.equal(result.ok,true);return result.value;};
let currentId,primaryFailure;const child=app.process();
try{
 await assertElectronSecurity(app);await expect(page.locator('.sidebar')).toBeVisible();
 await app.evaluate(({BrowserWindow,shell})=>{BrowserWindow.getAllWindows()[0].setBounds({width:1500,height:1000});globalThis.__purchases=[];shell.openExternal=async url=>{globalThis.__purchases.push(url);};});
 await page.locator('.sidebar').getByRole('button',{name:'Materials',exact:true}).click();
 await page.getByRole('button',{name:'Add material',exact:true}).first().click();
 await dialog().getByLabel('Colour code / thread number',{exact:true}).first().fill('310');
 const productRow=dialog().locator('tr').filter({has:page.locator('strong').filter({hasText:/^DMC 310$/})}).filter({hasText:'Casa Cenina'}).first();
 await productRow.getByRole('button',{name:'Choose',exact:true}).click();
 await expect(dialog().getByRole('textbox',{name:'Name',exact:true})).toHaveValue(black.name);
 await expect(dialog().getByLabel('Unit',{exact:true})).toHaveValue('skein');
 assert.equal(await dialog().getByLabel('Material colour',{exact:true}).locator('.swatch').evaluate(node=>getComputedStyle(node).backgroundColor),'rgb(0, 0, 0)');
 assert.equal(await dialog().getByLabel('Gamma',{exact:true}).count(),0);
 await dialog().getByLabel('Quantity',{exact:true}).fill('2');await dialog().getByRole('button',{name:'Save',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 const stock=await load();assert.equal(stock.materials[0].properties.product.code,'310');assert.equal(stock.materials[0].color,'#000000');assert.equal(stock.lots[0].quantity,2);
 checks.push('Inventory brand/type/colour-code selection automatically fills black DMC310, real skein metadata and saved stock; no Gamma field or manual colour picker');

 await page.locator('.sidebar').getByRole('button',{name:'Patterns',exact:true}).click();
 await page.getByRole('button',{name:'Cell material sampler',exact:true}).click();
 const canvas=page.locator('.editor-stage canvas');await expect(canvas).toBeVisible();
 await canvas.click({position:{x:12,y:12}});
 await expect(dialog()).toHaveAccessibleName('Cell material · column 1, row 1');
 await dialog().getByRole('button',{name:'Beads and embellishments',exact:true}).click();
 await dialog().getByLabel('Colour code / thread number',{exact:true}).fill(bead.code);
 const beadRow=dialog().locator('tr').filter({hasText:`${bead.brand} ${bead.code}`}).first();
 await beadRow.getByRole('button',{name:'Choose',exact:true}).click();
 await expect(dialog().getByLabel('Number of strands',{exact:true})).toHaveValue('1');
 await dialog().getByRole('button',{name:'Apply to cell',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.getByRole('button',{name:'Save new revision',exact:true}).click();await dialog().getByRole('textbox',{name:'Revision name',exact:true}).fill('With one bead');await dialog().getByRole('button',{name:'Save',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 const saved=await load(),pattern=saved.patterns[0];currentId=pattern.currentRevisionId;
 const changed=pattern.revisions.find(row=>row.id===currentId);assert.equal(counts(changed).full,23);assert.equal(counts(changed).bead,1);assert.equal(changed.colors[changed.cells[0]].product.id,bead.id);assert.equal(changed.colors[changed.cells[0]].attachmentThread.code,'310');assert.equal(changed.colors[changed.cells[0]].attachmentThread.strands,1);
 assert.deepEqual(saved.movements,stock.movements);assert.equal(saved.lots[0].quantity,2);
 await page.screenshot({path:join(data,'bead-editor.png')});
 checks.push('Clicking a cell opens material choice; one verified MillHill bead and its fastening thread persist as a version2 revision without consuming stock');

 await page.getByRole('button',{name:'Export',exact:true}).click();
 await dialog().getByLabel('Chart style',{exact:true}).selectOption({label:'White with black symbols'});
 await expect(dialog().getByLabel('Cell size on paper (cm)',{exact:true})).toHaveValue('0.45');
 await expect(dialog().getByRole('img',{name:'Chart page preview',exact:true})).toBeVisible();
 const pdfPath=join(data,'bead-chart.pdf');await app.evaluate(({dialog},filePath)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath});},pdfPath);
 await dialog().getByRole('button',{name:'Export',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0,{timeout:90000});
 const task=getDocument({data:new Uint8Array(readFileSync(pdfPath)),useSystemFonts:false});
 try{const pdf=await task.promise;let text='',links=[];for(let n=1;n<=pdf.numPages;n++){const sheet=await pdf.getPage(n);text+=(await sheet.getTextContent()).items.map(row=>row.str??'').join(' ')+' ';links.push(...(await sheet.getAnnotations()).map(row=>row.url).filter(Boolean));}assert.match(text,/Beads \/ embellishments: 1/);assert.match(text,/Attachment thread: 1/);assert.match(text,/Materials and quantities/);assert.ok(links.some(url=>url===bead.url));assert.ok(links.some(url=>url.includes('tessiland.com')));}finally{await task.destroy();}
 checks.push('Actual A4 export contains bead and attachment legend, required/available quantities and direct verified purchase links');
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);assert.deepEqual(await app.evaluate(()=>globalThis.__purchases),[]);
}catch(error){primaryFailure=error;await page.screenshot({path:join(data,'failure.png')}).catch(()=>{});throw error;}
finally{try{await Promise.race([app.close(),new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('ordinary_shutdown_timeout')),20000);timer.unref();})]);}catch(error){child.kill();if(!primaryFailure)throw error;}}
repo=new Repository(join(data,'ricamo.sqlite'));try{const state=repo.load(),row=state.patterns[0].revisions.find(r=>r.id===currentId);assert.equal(counts(row).bead,1);assert.equal(state.materials[0].properties.product.pack.lengthM,8);checks.push('Authoritative SQLite reopen retains bead geometry, material identity and stock metadata');}finally{repo.close();}
const result={data,checks,errors,networkRequests:requests};writeFileSync(join(data,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
