import {isLocalPhoto} from './local-image-evidence.mjs';
import {expect,_electron as electron} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {Repository} from '../desktop/repository.mjs';
import {APP_VERSION} from '../core/version.mjs';
import {assertElectronSecurity} from './electron-security.mjs';

assert.ok(process.env.RICAMO_EXECUTABLE,'RICAMO_EXECUTABLE is required');mkdirSync('.runtime',{recursive:true});const data=mkdtempSync(resolve('.runtime/existing-colbert-'));
const codes=['7444','7445','7727','7971','7439'],repository=new Repository(join(data,'ricamo.sqlite'));
try{for(const code of codes){const state=repository.load();repository.execute({type:'material.createWithLot',operationId:crypto.randomUUID(),payload:{material:{id:`wool-${code}`,name:`DMC · Mouliné lanato · ${code}`,brand:'DMC',range:'Mouliné lanato',code,category:'thread',unit:'skein',minimum:1,properties:{threadFamily:'wool'}},lot:{id:`lot-${code}`,quantity:1}}},state.revision);}}finally{repository.close();}
const env={...process.env,RICAMO_DATA_DIR:data};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;const app=await electron.launch({chromiumSandbox:true,executablePath:resolve(process.env.RICAMO_EXECUTABLE),env,timeout:40000}),page=await app.firstWindow(),errors=[],requests=[];page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(/^https?:/.test(request.url()))requests.push(request.url());});
try{await page.locator('.sidebar').waitFor();assert.equal(await app.evaluate(({app})=>app.getVersion()),APP_VERSION);await assertElectronSecurity(app);await page.locator('.sidebar').getByRole('button',{name:'Materiali',exact:true}).click();const card=name=>page.locator('.inventory-category-card').filter({has:page.getByRole('heading',{name,exact:true})});await card('Fili').getByRole('button').first().click();await card('DMC').getByRole('button').first().click();
 for(const code of codes){const row=page.locator('.table-wrap tbody tr').filter({hasText:code});await expect(row).toBeVisible();const image=await row.locator('.swatch').evaluate(element=>getComputedStyle(element).backgroundImage);assert.equal(isLocalPhoto(image),code!=='7445',code);}
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);writeFileSync(join(data,'result.json'),JSON.stringify({version:APP_VERSION,codes,previewed:codes.filter(code=>code!=='7445'),unavailable:['7445'],checks:['legacy Mouliné lanato identities retained','four exact offline Colbert previews shown','unsupported code remains uncoloured','offline packaged runtime'],errors,requests},null,2));console.log('PASS: existing Mouliné lanato inventory previews. Evidence: '+data);
}catch(error){await page.screenshot({path:join(data,'failure.png')});throw error;}finally{await app.close();}
