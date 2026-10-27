import { _electron as electron,expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync,mkdtempSync,writeFileSync } from 'node:fs';
import { join,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { Repository } from '../desktop/repository.mjs';
import { attachmentJourney } from './attachment-journey.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));mkdirSync(join(root,'.runtime'),{recursive:true});const data=mkdtempSync(join(root,'.runtime','attachments-native-')),path=join(data,'ricamo.sqlite');
const env={...process.env,RICAMO_DATA_DIR:data};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
const executable=process.env.RICAMO_EXECUTABLE||join(root,'node_modules/electron/dist',process.platform==='win32'?'electron.exe':'electron');
let app=await electron.launch({executablePath:resolve(executable),args:process.env.RICAMO_EXECUTABLE?[]:[root],env,timeout:40000});const page=await app.firstWindow();page.setDefaultTimeout(12000);const checks=[],errors=[],remote=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))remote.push(r.url());});
const load=async()=>{const r=await page.evaluate(()=>window.ricamo.load());assert.equal(r.ok,true);return r.value;};
const sql=statement=>{const db=new DatabaseSync(path);try{db.exec(statement);}finally{db.close();}};
try{
 await expect(page.locator('h1').first()).toBeVisible();
 const result=await attachmentJourney(page,{load,checkpoint:text=>checks.push(text),injectFailure:async()=>sql("CREATE TRIGGER test_asset_rollback BEFORE UPDATE ON application_state BEGIN SELECT RAISE(ABORT,'synthetic post-blob failure'); END;"),clearFailure:async()=>sql('DROP TRIGGER test_asset_rollback')});
 for (const type of ['attachment.add','entity.saveWithAssets','pattern.createWithAsset','project.package.import']) { const denied=await page.evaluate(type=>window.ricamo.command({type,payload:{},operationId:`forged-${type}`},0),type);assert.equal(denied.ok,false);assert.equal(denied.error.code,'unauthorized_command');assert.deepEqual(await load(),result.state); }
 await page.screenshot({path:join(data,'session-photos.png'),fullPage:true});await app.close();app=null;
 const repo=new Repository(path);try{assert.deepEqual(repo.load(),result.state);assert.equal(repo.db.prepare('SELECT count(*) n FROM assets').get().n,3);for(const file of result.files){const metadata=repo.load().attachments.find(row=>row.digest===createHash('sha256').update(file.data).digest('hex'));assert.ok(metadata);assert.deepEqual(Buffer.from(repo.getAsset(metadata.id)),file.data);}}finally{repo.close();}
 checks.push('Actual main/preload reject forged generic command; SQLite reopen retains every exact original and owner reference');assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);const report={platform:process.platform,executable,data,checks,errors,remote};writeFileSync(join(data,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(error){await page.screenshot({path:join(data,'failure.png'),fullPage:true}).catch(()=>{});writeFileSync(join(data,'failure.json'),JSON.stringify({message:error.message,checks,errors},null,2));throw error;}finally{if(app)await app.close();}
