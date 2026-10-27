import {_electron as electron,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createCanvas} from '@napi-rs/canvas';
import {Repository} from '../desktop/repository.mjs';
import {createBlank,counts} from '../core/pattern.mjs';
import {assertElectronSecurity} from './electron-security.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));mkdirSync(join(root,'.runtime'),{recursive:true});
const data=mkdtempSync(join(root,'.runtime/background-center-')),result={data,checks:[],errors:[],requests:[]};
let repository=new Repository(join(data,'ricamo.sqlite'));
const run=(type,payload)=>repository.execute({type,payload,operationId:crypto.randomUUID()},repository.load().revision);
run('settings.save',{language:'en'});
for(const[id,name,color,code]of [['black','Black','#000000','00'],['white','White','#ffffff','01']]){run('material.save',{id,name,category:'thread',unit:'m',brand:'Synthetic',code,color});run('lot.add',{id:`lot-${id}`,materialId:id,quantity:10});}
const revision=createBlank(500,499,[{brand:'Synthetic',code:'00',name:'Black',hex:'#000000',rgb:[0,0,0],symbol:'A',strands:2}],{id:'r'});revision.cells[0]=0;revision.cells[revision.cells.length-1]=0;
run('pattern.save',{id:'large',name:'Large centre study',revision});const before=repository.load();repository.close();
const canvas=createCanvas(40,40),context=canvas.getContext('2d');context.fillStyle='#ffffff';context.fillRect(0,0,40,40);context.fillStyle='#000000';context.fillRect(10,10,20,20);context.fillStyle='#ffffff';context.fillRect(12,12,16,16);
const original=canvas.toBuffer('image/png'),source=join(data,'opaque-ring.png');writeFileSync(source,original);
const env={...process.env,RICAMO_DATA_DIR:data};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
const launch=()=>electron.launch({chromiumSandbox:true,executablePath:resolve(process.env.RICAMO_EXECUTABLE||join(root,'node_modules/electron/dist',process.platform==='win32'?'electron.exe':'electron')),args:process.env.RICAMO_EXECUTABLE?[]:[root],env,timeout:40000});
let app,page;
async function open(){app=await launch();page=await app.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',error=>result.errors.push(error.message));page.on('request',request=>{if(/^https?:/.test(request.url()))result.requests.push(request.url())});await expect(page.locator('.sidebar')).toBeVisible();}
const load=async()=>{const response=await page.evaluate(()=>window.ricamo.load());assert.equal(response.ok,true);return response.value};
const stocks=state=>Object.fromEntries(['materials','lots','movements','reservations','needs','projects','cuts'].map(key=>[key,state[key]]));
try {
  await open();result.security=await assertElectronSecurity(app);
  await page.locator('.sidebar').getByRole('button',{name:'Patterns',exact:true}).click();
  await page.getByRole('button',{name:'Open pattern: Large centre study',exact:true}).click();
  await expect(page.getByLabel('Column',{exact:true})).toBeVisible();await page.getByLabel('Zoom',{exact:true}).fill('12');await page.getByLabel('Column',{exact:true}).fill('500');await page.getByLabel('Row',{exact:true}).fill('499');await page.getByRole('button',{name:'Go to coordinates',exact:true}).click();
  await expect(page.getByLabel('Column',{exact:true})).toHaveValue('500');await expect(page.getByLabel('Row',{exact:true})).toHaveValue('499');
  assert.ok(await page.locator('.editor-stage').evaluate(element=>element.scrollLeft>0&&element.scrollTop>0));
  await page.getByLabel('Column',{exact:true}).fill('501');await page.getByRole('button',{name:'Go to coordinates',exact:true}).click();await expect(page.getByText('Enter a whole column from 1 to 500 and a whole row from 1 to 499.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Centre view',exact:true}).click();await expect(page.getByLabel('Column',{exact:true})).toHaveValue('250');await expect(page.getByLabel('Row',{exact:true})).toHaveValue('250');await expect(page.getByText(/Geometric centre: 250, 249.5 cells/)).toBeVisible();
  await page.getByLabel('Show centre guide',{exact:true}).uncheck();await expect(page.getByText(/Geometric centre:/)).toHaveCount(0);await page.getByRole('button',{name:'Centre view',exact:true}).click();await expect(page.getByLabel('Show centre guide',{exact:true})).toBeChecked();assert.ok(await page.locator('.editor-stage').evaluate(element=>Math.abs(element.scrollLeft+element.clientWidth/2-3000)<1&&Math.abs(element.scrollTop+element.clientHeight/2-2994)<1));
  await page.screenshot({path:join(data,'centre.png')});assert.deepEqual(await load(),before);
  result.checks.push('Design mode reaches the last 1-based coordinate, rejects overflow and centres an even-by-odd grid without writing a revision or stock');
  await page.locator('.sidebar').getByRole('button',{name:'Patterns',exact:true}).click();await page.locator('input[type=file][accept="image/png,image/jpeg,image/webp,image/gif"]').setInputFiles(source);
  const dialog=page.getByRole('dialog');await expect(dialog.getByRole('heading',{name:'From an image',exact:true})).toBeVisible();await dialog.getByLabel('Width (stitches)',{exact:true}).fill('40');await dialog.getByLabel('Width (stitches)',{exact:true}).press('Tab');await dialog.getByLabel('Palette',{exact:true}).selectOption('inventory');await dialog.getByLabel('Maximum colours',{exact:true}).fill('2');
  await dialog.getByLabel('Transparency handling',{exact:true}).selectOption('remove');await dialog.getByLabel('Background colour tolerance',{exact:true}).fill('0');await dialog.getByRole('button',{name:'Generate pattern',exact:true}).click();await expect(dialog.getByRole('button',{name:'Save',exact:true})).toBeEnabled({timeout:30000});await expect(dialog.getByText('40 × 40 grid · 2 palette colours · 400 stitches · requested limit 2',{exact:true})).toBeVisible();
  const alpha=await dialog.locator('canvas.transparency-surface').evaluate(element=>{const context=element.getContext('2d');return {border:context.getImageData(0,0,1,1).data[3],centre:context.getImageData(element.width/2,element.height/2,1,1).data[3]}});assert.deepEqual(alpha,{border:0,centre:255});
// In tests/desktop-background-center.mjs, immediately after asserting
// alpha == {border:0,centre:255} for the 40×40 ring, before Save:
await dialog.getByLabel('Width (stitches)',{exact:true}).fill('1');
await dialog.getByLabel('Width (stitches)',{exact:true}).press('Tab');
await expect(dialog.getByLabel('Height (stitches)',{exact:true})).toHaveValue('1');
const previewCentreAlpha=()=>dialog.locator('canvas.transparency-surface').evaluate(element=>element.getContext('2d').getImageData(element.width/2,element.height/2,1,1).data[3]);
await expect.poll(previewCentreAlpha).toBe(0);
await expect(dialog.getByRole('button',{name:'Save',exact:true})).toBeDisabled();
await dialog.getByLabel('Width (stitches)',{exact:true}).fill('40');
await dialog.getByLabel('Width (stitches)',{exact:true}).press('Tab');
await expect(dialog.getByLabel('Height (stitches)',{exact:true})).toHaveValue('40');
await expect.poll(previewCentreAlpha).toBe(255);
await expect(dialog.getByRole('button',{name:'Save',exact:true})).toBeEnabled();
result.checks.push('Removal preview follows output dimensions with zero protected regions; returning to the original dimensions restores the matching saved preview');

  await dialog.getByRole('textbox',{name:'Name',exact:true}).fill('Opaque border removed');await page.screenshot({path:join(data,'removal.png')});assert.deepEqual(await load(),before);
  await dialog.getByRole('button',{name:'Save',exact:true}).click();await expect(dialog).toHaveCount(0,{timeout:30000});const saved=await load(),pattern=saved.patterns.find(pattern=>pattern.name==='Opaque border removed'),generated=pattern.revisions[0];assert.equal(counts(generated).full,400);assert.equal(generated.cells[0],-1);assert.equal(generated.colors[generated.cells[20*40+20]].code,'01');assert.deepEqual(generated.settings.background,{mode:'remove',color:'#ffffff',tolerance:0});assert.equal(generated.provenance.adapterVersion,4);assert.deepEqual(stocks(saved),stocks(before));
  result.checks.push('Opaque PNG loses only 1200 border pixels; 256 enclosed white stitches remain; preview transparency and saved provenance match, without stock changes');
  await app.close();app=null;await open();assert.deepEqual(await load(),saved);await app.close();app=null;
  repository=new Repository(join(data,'ricamo.sqlite'));assert.deepEqual(repository.load(),saved);assert.deepEqual(Buffer.from(repository.getAsset(pattern.sourceAttachmentId)),original);repository.close();assert.deepEqual(readFileSync(source),original);assert.deepEqual(result.errors,[]);assert.deepEqual(result.requests,[]);result.checks.push('Process restart and independent SQLite/original-byte readback');result.ok=true;
} catch(error){result.error=error.stack;if(page)await page.screenshot({path:join(data,'failure.png')}).catch(()=>{});throw error;}
finally {if(app)await app.close().catch(()=>{});writeFileSync(join(data,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));}
