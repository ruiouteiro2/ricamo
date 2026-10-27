import { _electron as electron, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jsPDF } from 'jspdf';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { Repository } from '../desktop/repository.mjs';
import { assertElectronSecurity } from './electron-security.mjs';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
mkdirSync(join(root,'.runtime'),{recursive:true});
const data = mkdtempSync(join(root,'.runtime','print-document-'));
const repo = new Repository(join(data,'ricamo.sqlite'));
const command = (type,payload) => repo.execute({type,payload,operationId:crypto.randomUUID()},repo.load().revision);
const original = new jsPDF({unit:'mm',format:'letter'});
original.setFillColor(230,30,40);original.rect(10,10,195,259,'F');original.setTextColor(0);original.text('SYNTHETIC PAGE ONE',20,30);
original.addPage([420,297],'landscape');original.setFillColor(20,45,225);original.rect(10,10,400,277,'F');original.setTextColor(0);original.text('SYNTHETIC PAGE TWO',20,30);
const originalBytes = new Uint8Array(original.output('arraybuffer'));
try {
  command('settings.save',{language:'en'});
  const imported=repo.importAsset({name:'Synthetic print.pdf',data:originalBytes,operationId:'print-original'},repo.load().revision);
  command('pattern.save',{id:'print-reference',kind:'reference',name:'Synthetic print',sourceAttachmentId:imported.asset.id});
  const large=new jsPDF({unit:'mm',format:'a4'});
  for(let number=1;number<=75;number++){if(number>1)large.addPage();large.setFillColor(...(number===75?[20,45,225]:[230,30,40]));large.rect(10,10,190,277,'F');large.setTextColor(0);large.text(`SYNTHETIC LARGE PAGE ${number}`,20,30);}
  const largeImported=repo.importAsset({name:'Large print.pdf',data:new Uint8Array(large.output('arraybuffer')),operationId:'large-print-original'},repo.load().revision);
  command('pattern.save',{id:'large-print-reference',kind:'reference',name:'Large synthetic print',sourceAttachmentId:largeImported.asset.id});
} finally { repo.close(); }
const env={...process.env,RICAMO_DATA_DIR:data};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
const executable=resolve(process.env.RICAMO_EXECUTABLE||process.env.RICAMO_ELECTRON_RUNTIME||join(root,'node_modules/electron/dist',process.platform==='win32'?'electron.exe':'electron'));
const app=await electron.launch({chromiumSandbox:true,executablePath:executable,args:process.env.RICAMO_EXECUTABLE?[]:[root],env,timeout:40000});
const page=await app.firstWindow(),errors=[],remote=[],checks=[];page.setDefaultTimeout(20000);
page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(/^https?:/.test(request.url()))remote.push(request.url())});
const dialog=()=>page.getByRole('dialog').last();
async function openPrint(){await page.getByRole('button',{name:'Print / PDF',exact:true}).click();await expect(dialog().getByRole('button',{name:'Print / PDF',exact:true})).toBeEnabled();}
async function printOutput(mode='success'){
  await app.evaluate(({BrowserWindow},mode)=>{
    const wc=BrowserWindow.getAllWindows()[0].webContents;globalThis.__printResult=null;
    wc.print=async(options,callback)=>{
      try{const snapshot=await wc.executeJavaScript(`({pages:[...document.querySelectorAll('.ricamo-print-page')].map(el=>({width:el.style.width,height:el.style.height,page:el.style.page,pixels:el.querySelector('img').naturalWidth*el.querySelector('img').naturalHeight,canvasWidth:el.querySelector('img').naturalWidth})),active:document.body.classList.contains('printing-document')})`);
        const pdf=await wc.printToPDF({printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false});
        globalThis.__printResult={snapshot,pdf:Array.from(pdf),options};callback(mode==='success',mode==='cancel'?'Print job canceled':mode==='failure'?'Print job failed':'');
      }catch(error){globalThis.__printResult={error:error.message};callback(false,'Print job failed');}
    };
  },mode);
  await dialog().getByRole('button',{name:'Print / PDF',exact:true}).click();
  await expect.poll(()=>app.evaluate(()=>Boolean(globalThis.__printResult)),{timeout:120000}).toBe(true);
  const result=await app.evaluate(()=>globalThis.__printResult);assert.equal(result.error,undefined);assert.equal(result.options.silent,false);assert.equal(result.snapshot.active,true);
  await expect(page.locator('#ricamo-print-document')).toHaveCount(0);
  assert.equal(await page.evaluate(()=>document.body.classList.contains('printing-document')),false);
  return result;
}
async function inspectPdf(bytes,expected){
  const task=getDocument({data:new Uint8Array(bytes),useSystemFonts:false});
  try{const pdf=await task.promise;assert.equal(pdf.numPages,expected.length);
    for(const [index,row]of expected.entries()){
      const pdfPage=await pdf.getPage(index+1),viewport=pdfPage.getViewport({scale:1});
      assert.ok(Math.abs(viewport.width-row.width*72/25.4)<1,`${index} width ${viewport.width}`);assert.ok(Math.abs(viewport.height-row.height*72/25.4)<1,`${index} height ${viewport.height}`);
      if(row.color){const target=pdf.canvasFactory.create(Math.ceil(viewport.width),Math.ceil(viewport.height));
      try{await pdfPage.render({canvasContext:target.context,viewport}).promise;const pixel=Array.from(target.context.getImageData(Math.floor(viewport.width/2),Math.floor(viewport.height/2),1,1).data);
        if(row.color==='red')assert.ok(pixel[0]>180&&pixel[1]<80&&pixel[2]<90,`${pixel}`);
        if(row.color==='blue')assert.ok(pixel[2]>180&&pixel[0]<70&&pixel[1]<90,`${pixel}`);
        if(row.color==='gray')assert.ok(Math.abs(pixel[0]-pixel[1])<=1&&Math.abs(pixel[1]-pixel[2])<=1&&pixel[0]<200,`${pixel}`);
      }finally{pdf.canvasFactory.destroy(target);}}
      const text=(await pdfPage.getTextContent()).items.map(item=>item.str).join(' ');assert.equal(/My studio|Materials|Shopping|Print reference/.test(text),false);
    }
  }finally{await task.destroy();}
}
try{
  await expect(page.locator('.sidebar')).toBeVisible();const security=await assertElectronSecurity(app);
  await page.locator('.sidebar').getByRole('button',{name:'Patterns',exact:true}).click();await page.getByRole('button',{name:'Synthetic print',exact:true}).click();
  await expect(page.getByRole('button',{name:'Next page',exact:true})).toBeEnabled();
  await openPrint();await dialog().getByLabel('Include annotations and note pages',{exact:true}).uncheck();await dialog().getByRole('checkbox',{name:/All .*pages/}).check();
  await expect(dialog().getByRole('button',{name:'Print / PDF',exact:true})).toBeEnabled();await page.screenshot({path:join(data,'reference-print-preview.png')});
  const color=await printOutput();writeFileSync(join(data,'color-printed.pdf'),new Uint8Array(color.pdf));
  await inspectPdf(color.pdf,[{width:215.9,height:279.4,color:'red'},{width:420,height:297,color:'blue'}]);
  checks.push('Actual native Chromium printToPDF: two complete pages in source order, Letter then landscape A3, matching red/blue content and no application chrome');
  await openPrint();await dialog().getByLabel('Appearance',{exact:true}).selectOption('true');await expect(dialog().getByRole('button',{name:'Print / PDF',exact:true})).toBeEnabled();
  const gray=await printOutput();writeFileSync(join(data,'gray-printed.pdf'),new Uint8Array(gray.pdf));await inspectPdf(gray.pdf,[{width:215.9,height:279.4,color:'gray'},{width:420,height:297,color:'gray'}]);
  checks.push('Grayscale changes actual printed page pixels, not only preview styling');
  await openPrint();const cancelled=await printOutput('cancel');assert.equal(cancelled.snapshot.pages.length,2);await expect(dialog().getByRole('heading',{name:'Print reference',exact:true})).toBeVisible();await expect(page.getByRole('alert')).toHaveCount(0);
  await dialog().getByRole('button',{name:'Cancel',exact:true}).click();checks.push('Electron documented cancellation callback returns to options, with no false success/error and all temporary DOM removed');
  await page.getByRole('button',{name:'Next page',exact:true}).click();await openPrint();await dialog().getByRole('checkbox',{name:/All .*pages/}).uncheck();await dialog().getByLabel('Paper size',{exact:true}).selectOption('a4');
  const current=await printOutput();await inspectPdf(current.pdf,[{width:297,height:210,color:'gray'}]);checks.push('Current-page printing selects page two and fits it on landscape A4');
  await page.getByRole('button',{name:'Add note',exact:true}).click();await dialog().getByRole('textbox',{name:/^Notes/}).fill('PRINT NOTE: preserve the complete instructions.');await dialog().getByRole('button',{name:'Save',exact:true}).click();
  await page.getByRole('button',{name:'Rotate 90°',exact:true}).click();
  await openPrint();await dialog().getByLabel('Include annotations and note pages',{exact:true}).check();await dialog().getByLabel('Paper size',{exact:true}).selectOption('original');
  const annotated=await printOutput();await inspectPdf(annotated.pdf,[{width:297,height:420,color:'gray'},{width:210,height:297}]);writeFileSync(join(data,'annotated-rotated-printed.pdf'),new Uint8Array(annotated.pdf));checks.push('Rotated original page retains swapped physical dimensions and annotations include a full A4 notes appendix');
  await openPrint();await printOutput('failure');await expect(page.getByRole('alert')).toContainText('The printer did not accept the document');checks.push('Printer failure is actionable and temporary print content is cleaned up');
  await page.locator('.sidebar').getByRole('button',{name:'Patterns',exact:true}).click();await page.getByRole('button',{name:'Large synthetic print',exact:true}).click();await expect(page.getByRole('button',{name:'Next page',exact:true})).toBeEnabled();
  await openPrint();await dialog().getByRole('checkbox',{name:/All .*pages/}).check();await dialog().getByLabel('Include annotations and note pages',{exact:true}).uncheck();
  const large=await printOutput();assert.equal(large.snapshot.pages.length,75);const retainedPixels=large.snapshot.pages.reduce((sum,row)=>sum+row.pixels,0);assert.ok(retainedPixels<=128_000_000&&retainedPixels>96_000_000);assert.ok(large.snapshot.pages.every(row=>row.canvasWidth>=595.28*96/72&&row.canvasWidth<1191));
  await inspectPdf(large.pdf,Array.from({length:75},(_,index)=>({width:210,height:297,...(index===0?{color:'red'}:index===74?{color:'blue'}:{})})));writeFileSync(join(data,'large-75-pages-printed.pdf'),new Uint8Array(large.pdf));checks.push(`75-page complete native print adapts raster resolution inside ${retainedPixels} pixels; all pages and physical sizes preserved, first/last colors verified`);
  const state=await page.evaluate(async()=>{const result=await window.ricamo.load();return result.value;});const originalStored=await page.evaluate(async id=>{const result=await window.ricamo.getAsset(id);return Array.from(result.value);},state.patterns[0].sourceAttachmentId);assert.deepEqual(new Uint8Array(originalStored),originalBytes);assert.equal(state.movements.length,0);
  assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);writeFileSync(join(data,'result.json'),JSON.stringify({passed:true,data,executable,security,checks,errors,remote,physicalPrinterJobSent:false,nativePrintDialogSelection:'callback boundary controlled; printToPDF real'},null,2));console.log(JSON.stringify({passed:true,data,checks}));
}catch(error){await page.screenshot({path:join(data,'failure.png')}).catch(()=>{});writeFileSync(join(data,'failure.json'),JSON.stringify({error:error.message,checks,errors,remote},null,2));throw error;}finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}
