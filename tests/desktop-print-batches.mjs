import {_electron as electron,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {Repository} from '../desktop/repository.mjs';
import {createBlank} from '../core/pattern.mjs';
import {assertElectronSecurity} from './electron-security.mjs';

const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
mkdirSync(join(root,'.runtime'),{recursive:true});
const data=mkdtempSync(join(root,'.runtime','print-batches-'));
const repo=new Repository(join(data,'ricamo.sqlite'));
const command=(type,payload)=>repo.execute({type,payload,operationId:crypto.randomUUID()},repo.load().revision);
try{
 command('settings.save',{language:'en'});
 const revision=createBlank(450,450,[{brand:'DMC',range:'Mouliné',code:'310',name:'Black',hex:'#000000',rgb:[0,0,0],symbol:'X'}],{id:'base',settings:{fabric:{type:'aida',countX:14,countY:14,countMeaning:'stitches',overX:1,overY:1}}});
 revision.cells.fill(0);command('pattern.save',{id:'batch-chart',name:'Native print batches',revision});
}finally{repo.close();}
const env={...process.env,RICAMO_DATA_DIR:data};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
const executablePath=resolve(process.env.RICAMO_EXECUTABLE||process.env.RICAMO_ELECTRON_RUNTIME||join(root,'node_modules/electron/dist',process.platform==='win32'?'electron.exe':'electron'));
const app=await electron.launch({chromiumSandbox:true,executablePath,args:process.env.RICAMO_EXECUTABLE?[]:[root],env,timeout:40000});
const child=app.process(),page=await app.firstWindow(),errors=[],remote=[],checks=[];page.setDefaultTimeout(30000);
page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(/^https?:/.test(request.url()))remote.push(request.url());});
const dialog=()=>page.getByRole('dialog').last();let failure;
async function inspect(job){
 assert.equal(job.error,undefined);assert.equal(job.options.silent,false);assert.equal(job.active,true);
 assert.ok(job.pages.length>0&&job.pages.length<=200);assert.ok(job.pages.reduce((sum,p)=>sum+p.pixels,0)<=128_000_000);
 const task=getDocument({data:new Uint8Array(job.pdf),useSystemFonts:false});
 try{const pdf=await task.promise;assert.equal(pdf.numPages,job.pages.length);const hashes=[];
  for(const index of [...new Set([1,pdf.numPages])]){
   const sheet=await pdf.getPage(index),viewport=sheet.getViewport({scale:.5});
   assert.ok(Math.abs(viewport.width*2-210*72/25.4)<1);assert.ok(Math.abs(viewport.height*2-297*72/25.4)<1);
   const target=pdf.canvasFactory.create(Math.ceil(viewport.width),Math.ceil(viewport.height));
   try{await sheet.render({canvasContext:target.context,viewport}).promise;hashes.push(createHash('sha256').update(target.context.getImageData(0,0,target.canvas.width,target.canvas.height).data).digest('hex'));}
   finally{pdf.canvasFactory.destroy(target);}
   const text=(await sheet.getTextContent()).items.map(item=>item.str).join(' ');assert.doesNotMatch(text,/My studio|Shopping|Settings/);
  }return hashes;
 }finally{await task.destroy();}
}
try{
 await assertElectronSecurity(app);await expect(page.locator('.sidebar')).toBeVisible();
 await app.evaluate(({BrowserWindow})=>{
  const wc=BrowserWindow.getAllWindows()[0].webContents;globalThis.__jobs=[];
  wc.print=async(options,callback)=>{
   try{
    const snapshot=await wc.executeJavaScript(`({active:document.body.classList.contains('printing-document'),pages:[...document.querySelectorAll('.ricamo-print-page')].map(el=>({pixels:el.querySelector('img').naturalWidth*el.querySelector('img').naturalHeight}))})`);
    const pdf=await wc.printToPDF({printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false});
    globalThis.__jobs.push({...snapshot,pdf:Array.from(pdf),options});
    if(globalThis.__jobs.length===1)globalThis.__releaseFirst=()=>callback(true);
    else callback(globalThis.__jobs.length!==2,globalThis.__jobs.length===2?'Print job canceled':'');
   }catch(error){globalThis.__jobs.push({error:error.message});callback(false,'Print job failed');}
  };
 });
 await page.locator('.sidebar').getByRole('button',{name:'Patterns',exact:true}).click();await page.getByRole('button',{name:'Native print batches',exact:true}).click();
 await page.getByRole('button',{name:'Export',exact:true}).click();
 await dialog().getByLabel('Chart style',{exact:true}).selectOption('true');
 await dialog().getByLabel('Cell size on paper (cm)',{exact:true}).press('ArrowRight');
 await expect(dialog().getByLabel('Cell size on paper (cm)',{exact:true})).toHaveValue('0.5');
 await dialog().getByRole('button',{name:'Print',exact:true}).click();
 await expect.poll(()=>app.evaluate(()=>globalThis.__jobs.length),{timeout:240000}).toBe(1);
 await page.locator('.sidebar').getByRole('button',{name:'Materials',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Native print batches',exact:true})).toBeVisible();
 await expect(page.getByRole('alert')).toContainText('Wait for the current operation');
 await app.evaluate(()=>globalThis.__releaseFirst());
 await expect.poll(()=>app.evaluate(()=>globalThis.__jobs.length),{timeout:180000}).toBe(2);
 const resume=dialog().getByRole('button',{name:/Resume previous document from page/});await expect(resume).toBeEnabled({timeout:30000});
 const jobs=await app.evaluate(()=>globalThis.__jobs),submitted=jobs[0].pages.length;
 await expect(resume).toHaveText(`Resume previous document from page ${submitted+1}`);
 await expect(page.locator('#ricamo-print-document')).toHaveCount(0);
 await inspect(jobs[0]);const cancelledHashes=await inspect(jobs[1]);
 checks.push(`Actual native A4 print output spans ${jobs[0].pages.length}+${jobs[1].pages.length} pages in bounded jobs; cancelling the second preserves the accepted first batch`);
 await dialog().getByLabel('Chart style',{exact:true}).selectOption('false');
 await resume.click();await expect.poll(()=>app.evaluate(()=>globalThis.__jobs.length),{timeout:180000}).toBe(3);
 await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('#ricamo-print-document')).toHaveCount(0);
 const resumed=await app.evaluate(()=>globalThis.__jobs[2]);assert.equal(resumed.pages.length,jobs[1].pages.length);assert.deepEqual(await inspect(resumed),cancelledHashes);
 checks.push('Resume prints only the unsubmitted pages from the original cached document, with identical first/last raster output despite changed export appearance');
 for(const [index,job]of [...jobs,resumed].entries())writeFileSync(join(data,`native-job-${index+1}.pdf`),new Uint8Array(job.pdf));
 assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);
 await page.screenshot({path:join(data,'print-resumed.png')});
 const result={data,checks,rendererErrors:errors,remoteRequests:remote};writeFileSync(join(data,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}catch(error){failure=error;await page.screenshot({path:join(data,'failure.png')}).catch(()=>{});throw error;}
finally{try{await Promise.race([app.close(),new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('Application shutdown timed out')),20000);timer.unref();})]);}catch(error){child.kill();if(!failure)throw error;}}
