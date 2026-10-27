import { _electron as electron, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Repository } from '../desktop/repository.mjs';
import { parseCsv } from '../core/csv.mjs';
import { createBlank } from '../core/pattern.mjs';
import { APP_VERSION } from '../core/version.mjs';
const root = fileURLToPath(new URL('../',import.meta.url));
mkdirSync(join(root,'.runtime'),{recursive:true});const data=mkdtempSync(join(root,'.runtime','data-exports-'));
let repo=new Repository(join(data,'ricamo.sqlite'));
const command=(type,payload)=>repo.execute({type,payload,operationId:crypto.randomUUID()},repo.load().revision);
command('settings.save',{language:'en'});
command('material.save',{id:'thread',name:'=SUM(1,2)',category:'thread',unit:'m',brand:'Export test',code:'001'});
command('lot.add',{id:'known',materialId:'thread',quantity:8,confidence:'estimated',cost:1200,currency:'EUR'});
command('lot.add',{id:'unknown',materialId:'thread',quantity:null});
const revision=createBlank(2,1,[{brand:'Export test',code:'001',name:'Thread',hex:'#804060',rgb:[128,64,96],symbol:'A'}],{id:'revision'});revision.cells=[0,0];
command('pattern.save',{id:'pattern',name:'Export design',revision});
command('project.save',{id:'project',name:'Export project',patternId:'pattern',budget:2500,currency:'GBP'});
command('project.progress',{projectId:'project',completed:['c:0'],done:true});
command('stock.move',{lotId:'known',kind:'consume',quantity:1,projectId:'project'});
command('purchase.save',{id:'order',materialId:'thread',quantity:4,unitPrice:125,currency:'USD',projectIds:['project']});
command('purchase.receive',{purchaseId:'order',quantity:1.5});
const before=repo.load();repo.close();
const env={...process.env,RICAMO_DATA_DIR:data};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
const executable=resolve(process.env.RICAMO_EXECUTABLE||join(root,'node_modules/electron/dist',process.platform==='win32'?'electron.exe':'electron'));
const app=await electron.launch({ chromiumSandbox: true,executablePath:executable,args:process.env.RICAMO_EXECUTABLE?[]:[root],env,timeout:40000});
const page=await app.firstWindow(),errors=[],remote=[],checks=[];page.setDefaultTimeout(15000);
page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(/^https?:/.test(request.url()))remote.push(request.url())});
const labels={inventory:'Export inventory',movements:'Export · Movements',purchases:'Export · Shopping',projects:'Export · Projects'};
async function destination(path,canceled=false){await app.evaluate(({dialog},{path,canceled})=>{globalThis.__dataExportsPicker=0;dialog.showSaveDialog=async()=>{globalThis.__dataExportsPicker++;return{canceled,filePath:path}}},{path,canceled})}
async function exportFile(dataset,format){const path=join(data,`${dataset}.${format}`);await page.getByLabel('Export format',{exact:true}).selectOption(format);await destination(path);await page.getByRole('button',{name:labels[dataset],exact:true}).click();await expect.poll(()=>app.evaluate(()=>globalThis.__dataExportsPicker)).toBe(1);let text;await expect.poll(()=>{try{text=readFileSync(path,'utf8');return text.length>0}catch(error){if(error.code==='ENOENT')return false;throw error}}).toBe(true);await expect(page.getByRole('button',{name:labels[dataset],exact:true})).toBeEnabled();return text}
try{
 await expect(page.locator('h1').first()).toBeVisible();await page.locator('.sidebar').getByRole('button',{name:'Settings',exact:true}).click();await expect(page.locator('.settings-grid h3').filter({hasText:'Ricamo'})).toContainText(APP_VERSION);
 for(const format of ['csv','tsv','json'])for(const dataset of Object.keys(labels)){
  const text=await exportFile(dataset,format);
  if(format==='json'){
   const result=JSON.parse(text);assert.equal(result.dataset,dataset);assert.equal(result.moneyScale,100);assert.equal(result.attachmentsIncluded,false);
   if(dataset==='inventory'){assert.equal(result.data.materials[0].code,'001');assert.equal(result.data.materials[0].name,'=SUM(1,2)');assert.equal(result.data.lots.find(row=>row.id==='unknown').quantity,null)}
   if(dataset==='movements'){assert.equal(result.data.find(row=>row.kind==='consume').costHundredths,150);assert.equal(result.data.find(row=>row.lotId==='unknown').confidence,'unknown')}
   if(dataset==='purchases'){assert.equal(result.data[0].received,1.5);assert.equal(result.data[0].receipts.length,1);assert.equal(result.data[0].currency,'USD')}
   if(dataset==='projects'){assert.equal(result.data[0].progressMode,'structured');assert.equal(result.data[0].progressPercent,50);assert.equal(result.data[0].completedPrimitives,1);assert.equal(result.data[0].totalPrimitives,2);assert.deepEqual(result.data[0].knownConsumedCostHundredthsByCurrency,{EUR:150});assert.equal(result.data[0].currency,'GBP')}
  }else{
   const delimiter=format==='tsv'?'\t':',';assert.ok(text.split('\r\n')[0].includes(delimiter));const rows=parseCsv(text,delimiter);assert.ok(rows.length>=2);const nameIndex=rows[0].indexOf(dataset==='inventory'?'name':'materialName');if(nameIndex>=0)assert.ok(rows[1][nameIndex].startsWith("'="));if(dataset==='inventory')assert.equal(rows[1][rows[0].indexOf('code')],'001');
  }
  checks.push(`${dataset} ${format}: actual UI, native write and parsed content`);
 }
 const exportedState=await page.evaluate(()=>window.ricamo.load());assert.deepEqual(exportedState.value,before);
 await expect(page.locator('.toast')).toHaveCount(0,{timeout:7000});const canceled=join(data,'must-not-exist.json');await destination(canceled,true);await page.getByRole('button',{name:labels.projects,exact:true}).click();await expect.poll(()=>app.evaluate(()=>globalThis.__dataExportsPicker)).toBe(1);await expect(page.getByRole('button',{name:labels.projects,exact:true})).toBeEnabled();assert.equal(existsSync(canceled),false);assert.equal(await page.locator('.toast').count(),0);
 await page.locator('.language-switch').selectOption('it');await page.getByLabel('Formato di esportazione',{exact:true}).selectOption('tsv');const italian=join(data,'acquisti-it.tsv');await destination(italian);await page.getByRole('button',{name:/^Esporta · Acquisti$/}).click();await expect.poll(()=>{try{return readFileSync(italian,'utf8')}catch(error){if(error.code==='ENOENT')return '';throw error}}).toContain('1,5');
 await page.locator('.language-switch').selectOption('en');await expect(page.getByLabel('Export format',{exact:true})).toBeVisible();const readback=await page.evaluate(()=>window.ricamo.load());assert.equal(readback.ok,true);const expected={...before,revision:readback.value.revision,operations:readback.value.operations,audit:readback.value.audit};assert.deepEqual(readback.value,expected);
 await page.screenshot({path:join(data,'export-options.png'),fullPage:true});assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);checks.push('Canceled export makes no file/success; Italian TSV retains comma decimals; no inventory mutations');
 await app.close();repo=new Repository(join(data,'ricamo.sqlite'));assert.deepEqual(repo.load(),readback.value);repo.close();
 writeFileSync(join(data,'result.json'),JSON.stringify({platform:process.platform,executable,version:APP_VERSION,data,checks,errors,remote,nativeDestinationSelectionAutomated:true},null,2));console.log(JSON.stringify({data,checks,errors,remote}));
}catch(error){try{await page.screenshot({path:join(data,'failure.png'),fullPage:true})}catch{}writeFileSync(join(data,'failure.json'),JSON.stringify({error:error.message,checks,errors,remote},null,2));throw error}finally{await app.close().catch(()=>{})}
