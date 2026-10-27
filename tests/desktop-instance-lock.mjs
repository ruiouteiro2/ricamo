import {_electron as electron,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Repository} from '../desktop/repository.mjs';
import {assertElectronSecurity} from './electron-security.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));mkdirSync(join(root,'.runtime'),{recursive:true});
const data=mkdtempSync(join(root,'.runtime/instance-lock-')),executable=resolve(process.env.RICAMO_EXECUTABLE||join(root,'node_modules/electron/dist',process.platform==='win32'?'electron.exe':'electron'));
const env={...process.env,RICAMO_DATA_DIR:data};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
const args=process.env.RICAMO_EXECUTABLE?[]:[root],errors=[],requests=[];
const app=await electron.launch({chromiumSandbox:true,executablePath:executable,args,env,timeout:40000});let result={data,platform:process.platform,executable};
try {
  const page=await app.firstWindow();page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(/^https?:/.test(request.url()))requests.push(request.url())});await expect(page.locator('h1').first()).toBeVisible();
  result.security=await assertElectronSecurity(app);
  const created=await page.evaluate(async()=>{const state=await window.ricamo.load();return window.ricamo.command({type:'material.save',payload:{id:'instance-lock-material',name:'Single-instance persistence',category:'thread',unit:'m',code:'001'},operationId:crypto.randomUUID()},state.value.revision)});assert.equal(created.ok,true);
  const before=(await page.evaluate(()=>window.ricamo.load())).value;
  await app.evaluate(({app,BrowserWindow})=>{globalThis.secondInstanceCount=0;app.on('second-instance',()=>globalThis.secondInstanceCount++);BrowserWindow.getAllWindows()[0].minimize()});
  const second=spawn(executable,args,{cwd:root,env,windowsHide:true,stdio:'ignore'});
  const exit=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{try{if(process.platform==='win32')execFileSync('taskkill.exe',['/PID',String(second.pid),'/T','/F'],{stdio:'ignore'});else second.kill('SIGKILL')}catch{}reject(Error('Second instance did not exit within 15 seconds'))},15000);second.once('error',error=>{clearTimeout(timer);reject(error)});second.once('exit',(code,signal)=>{clearTimeout(timer);resolve({code,signal})})});
  assert.equal(exit.code,0);
  await expect.poll(()=>app.evaluate(()=>globalThis.secondInstanceCount)).toBe(1);
  const windows=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().map(window=>({minimized:window.isMinimized(),visible:window.isVisible()})));
  assert.deepEqual(windows,[{minimized:false,visible:true}]);assert.deepEqual((await page.evaluate(()=>window.ricamo.load())).value,before);
  await app.close();const repository=new Repository(join(data,'ricamo.sqlite'));try{assert.deepEqual(repository.load(),before)}finally{repository.close()}
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);result={...result,ok:true,secondExit:exit,windows,secondInstanceEvents:1,sqliteUnchanged:true,errors,requests};
} catch(error){result.error=error.stack;throw error;}
finally{await app.close().catch(()=>{});writeFileSync(join(data,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));}
