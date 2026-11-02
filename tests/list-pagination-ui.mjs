import {expect,_electron as electron} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {Repository} from '../desktop/repository.mjs';
import {APP_VERSION} from '../core/version.mjs';
import {assertElectronSecurity} from './electron-security.mjs';

assert.ok(process.env.RICAMO_EXECUTABLE,'RICAMO_EXECUTABLE is required');mkdirSync('.runtime',{recursive:true});const data=mkdtempSync(resolve('.runtime/list-pagination-'));
const total=230,repository=new Repository(join(data,'ricamo.sqlite'));
try{for(let index=0;index<total;index++){const code=String(1000+index),state=repository.load();repository.execute({type:'material.createWithLot',operationId:crypto.randomUUID(),payload:{material:{id:`thread-${code}`,name:`DMC · Mouliné · ${code}`,brand:'DMC',range:'Mouliné',code,category:'thread',unit:'skein',minimum:1},lot:{id:`lot-${code}`,quantity:1}}},state.revision);}}finally{repository.close();}
const env={...process.env,RICAMO_DATA_DIR:data};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
const errors=[],requests=[];
async function open(){const app=await electron.launch({chromiumSandbox:true,executablePath:resolve(process.env.RICAMO_EXECUTABLE),env,timeout:40000}),page=await app.firstWindow();page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(/^https?:/.test(request.url()))requests.push(request.url());});await page.locator('.sidebar').waitFor();return{app,page};}
const nav=(page,name)=>page.locator('.sidebar').getByRole('button',{name,exact:true}).click();
const rows=page=>page.locator('.table-wrap tbody tr');
async function dmcTable(page){await nav(page,'Materiali');const card=name=>page.locator('.inventory-category-card').filter({has:page.getByRole('heading',{name,exact:true})});await card('Fili').getByRole('button').first().click();await card('DMC').getByRole('button').first().click();await expect(rows(page).first()).toBeVisible();}
const toggle=page=>page.getByRole('switch',{name:'Dividi gli elenchi lunghi in pagine',exact:true});
const next=page=>page.getByRole('button',{name:'Pagina successiva',exact:true});

let {app,page}=await open();
try{
 assert.equal(await app.evaluate(({app})=>app.getVersion()),APP_VERSION);await assertElectronSecurity(app);
 await dmcTable(page);await expect(rows(page)).toHaveCount(50);await expect(next(page)).toBeVisible();
 await nav(page,'Impostazioni');await expect(toggle(page)).toBeChecked();await toggle(page).uncheck();await expect(toggle(page)).toBeEnabled();await expect(toggle(page)).not.toBeChecked();
 await dmcTable(page);await expect(rows(page)).toHaveCount(total);await expect(next(page)).toHaveCount(0);
 const header=page.locator('.table-wrap thead input[type=checkbox]');await header.check();await expect(header).toBeChecked();await expect(page.locator('.table-wrap tbody input[type=checkbox]:checked')).toHaveCount(200);await header.uncheck();await expect(page.locator('.table-wrap tbody input[type=checkbox]:checked')).toHaveCount(0);
 await app.close();({app,page}=await open());
 await dmcTable(page);await expect(rows(page)).toHaveCount(total);
 await nav(page,'Impostazioni');await expect(toggle(page)).not.toBeChecked();await toggle(page).check();await expect(toggle(page)).toBeEnabled();await expect(toggle(page)).toBeChecked();
 await dmcTable(page);await expect(rows(page)).toHaveCount(50);await expect(next(page)).toBeVisible();
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);console.log('PASS: list pagination preference. Evidence: '+data);
}catch(error){await page.screenshot({path:join(data,'failure.png')});throw error;}finally{await app.close();}
