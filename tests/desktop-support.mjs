import {_electron as electron,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Repository} from '../desktop/repository.mjs';
import {createState,executeCommand} from '../core/application.mjs';
import {parseCsv,guessMapping,csvText} from '../core/csv.mjs';
import {inspectBackup} from '../core/backup.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));mkdirSync(join(root,'.runtime'),{recursive:true});
const data=mkdtempSync(join(root,'.runtime','support-')),env={...process.env,RICAMO_DATA_DIR:data};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
let initial=executeCommand(createState(),{type:'material.createWithLot',operationId:crypto.randomUUID(),payload:{material:{name:'PRIVATE material name',code:'PRIVATE_CODE',category:'thread',unit:'m',notes:'C:\\PRIVATE_PATH'},lot:{quantity:1.5}}});initial.settings.language='en';
const repo=new Repository(join(data,'ricamo.sqlite'));repo.restore({state:initial,assets:[]},0);repo.close();
const executable=resolve(process.env.RICAMO_EXECUTABLE||join(root,'node_modules/electron/dist',process.platform==='win32'?'electron.exe':'electron'));
const app=await electron.launch({ chromiumSandbox: true,executablePath:executable,args:process.env.RICAMO_EXECUTABLE?[]:[root],env,timeout:40000});
const page=await app.firstWindow(),errors=[],remote=[],checks=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('request',r=>{if(/^https?:/.test(r.url()))remote.push(r.url())});
const load=()=>page.evaluate(async()=>{const result=await window.ricamo.load();if(!result.ok)throw Error(result.error.code);return result.value});
const picker=destination=>app.evaluate(({dialog},path)=>{dialog.showSaveDialog=async()=>path?{canceled:false,filePath:path}:{canceled:true}},destination);
async function readSaved(path){let content;await expect.poll(()=>{try{content=readFileSync(path,'utf8');return true}catch(error){if(error.code==='ENOENT')return false;throw error}}).toBe(true);return content}
const resetSpace=()=>app.evaluate(()=>{if(globalThis.__ricamoOriginalSpace){process.getBuiltinModule('fs').statfsSync=globalThis.__ricamoOriginalSpace;process.getBuiltinModule('module').syncBuiltinESMExports();delete globalThis.__ricamoOriginalSpace}});
try{
 await expect(page.locator('h1').first()).toBeVisible();const before=await load();await page.locator('.sidebar').getByRole('button',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Import CSV / TSV',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByText('Empty CSV templates',{exact:true}).click();
 await picker(null);await dialog.getByRole('button',{name:'English · CSV',exact:true}).click();await expect(dialog.getByRole('button',{name:'English · CSV',exact:true})).toBeEnabled();await expect(page.locator('.toast')).toHaveCount(0);
 for(const locale of ['it','en']){const path=join(data,'template-'+locale+'.csv');await picker(path);await dialog.getByRole('button',{name:(locale==='it'?'Italiano':'English')+' · CSV',exact:true}).click();const rows=parseCsv(await readSaved(path),locale==='it'?';':',');assert.equal(rows.length,1);assert.ok(guessMapping(rows[0]).code>=0);}
 assert.deepEqual(await load(),before);checks.push('Canceled template emits no success; actual IT/EN downloads contain headers only and do not change inventory');
 const headers=parseCsv(readFileSync(join(data,'template-en.csv'),'utf8'),',')[0],map=guessMapping(headers),values={name:'Template import',category:'thread',code:'001',unit:'m',quantity:'1.5',confidence:'exact',status:'usable'};
 const row=headers.map((header,index)=>header==='__has_stock'?'1':values[Object.keys(map).find(key=>map[key]===index)]??'');const edited=join(data,'filled-template.csv');writeFileSync(edited,csvText(headers,[row],','));await dialog.locator('input[type=file]').setInputFiles(edited);await dialog.getByRole('button',{name:'Import reviewed data',exact:true}).click();await expect(dialog).toHaveCount(0);
 const imported=await load(),material=imported.materials.find(row=>row.name==='Template import');assert.equal(material.code,'001');assert.equal(imported.lots.find(row=>row.materialId===material.id).quantity,1.5);checks.push('A filled downloaded template imports through actual review UI with leading-zero code and physical quantity');
 await page.getByRole('button',{name:'Diagnostics without personal records',exact:true}).click();const text=await dialog.getByLabel('Diagnostic file preview',{exact:true}).inputValue();assert.doesNotMatch(text,/PRIVATE|private-id/);const report=JSON.parse(text);assert.equal(report.counts.materials,2);assert.equal(report.validation,'passed');
 const diagnostic=join(data,'diagnostics.json');await picker(diagnostic);await dialog.getByRole('button',{name:'Export',exact:true}).click();await expect.poll(()=>existsSync(diagnostic)).toBe(true);assert.deepEqual(JSON.parse(readFileSync(diagnostic,'utf8')),report);await dialog.getByRole('button',{name:'Close',exact:true}).last().click();assert.deepEqual(await load(),imported);checks.push('Diagnostic preview/export disclose counts and version, never names, codes, notes or paths');
 const backup=join(data,'space-check.ricamobackup');await picker(backup);await app.evaluate(()=>{const fs=process.getBuiltinModule('fs');globalThis.__ricamoOriginalSpace=fs.statfsSync;fs.statfsSync=()=>({bsize:1n,bavail:0n});process.getBuiltinModule('module').syncBuiltinESMExports()});await page.getByRole('button',{name:'Create a backup',exact:true}).click();await expect(page.getByRole('alert')).toContainText('not enough free space');assert.equal(existsSync(backup),false);assert.deepEqual(await load(),imported);await resetSpace();
 await page.getByRole('button',{name:'Create a backup',exact:true}).click();await expect.poll(()=>existsSync(backup)).toBe(true);const restored=await inspectBackup(readFileSync(backup,'utf8'));assert.deepEqual(restored.state,imported);checks.push('Injected low free space blocks the real native backup before file creation; retry writes a validated complete backup');
 await page.screenshot({path:join(data,'support.png'),fullPage:true});assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);writeFileSync(join(data,'result.json'),JSON.stringify({platform:process.platform,executable,data,checks,errors,remote,nativeDestinationSelectionAutomated:true},null,2));console.log(JSON.stringify({data,checks,errors,remote}));
}catch(error){await page.screenshot({path:join(data,'failure.png'),fullPage:true}).catch(()=>{});throw error}finally{await resetSpace().catch(()=>{});await app.close()}
