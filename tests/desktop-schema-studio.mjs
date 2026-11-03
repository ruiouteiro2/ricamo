import {_electron as electron,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {Repository} from '../desktop/repository.mjs';
import {createState} from '../core/application.mjs';
import {validateStudioModel} from '../core/schema-studio.mjs';
import {createBackup,inspectBackup} from '../core/backup.mjs';

mkdirSync('.runtime',{recursive:true});const data=mkdtempSync(resolve('.runtime/schema-studio-'));
let repo=new Repository(join(data,'ricamo.sqlite'));const initial=createState();initial.settings.language='en';repo.restore({state:initial,assets:[]},0);repo.close();
const env={...process.env,RICAMO_DATA_DIR:data};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
const launch=()=>electron.launch({chromiumSandbox:true,executablePath:resolve(process.env.RICAMO_EXECUTABLE||(process.env.RICAMO_TEST_SOURCE?'.runtime/audit-electron/electron.exe':'release/win-unpacked/Ricamo.exe')),args:process.env.RICAMO_TEST_SOURCE?['.']:[],env});
const snapshot=()=>{const repo=new Repository(join(data,'ricamo.sqlite'));try{return repo.load();}finally{repo.close();}};
let app=await launch(),page=await app.firstWindow();const errors=[],external=[],missing=[];
function observe(page){page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(/^https?:/.test(request.url()))external.push(request.url());});page.on('response',response=>{if(response.status()>=400)missing.push([response.status(),response.url()]);});}
observe(page);
async function open(){await page.locator('.sidebar').waitFor();await page.locator('.sidebar').getByRole('button',{name:'Patterns',exact:true}).click();await page.getByRole('button',{name:'Advanced chart studio',exact:true}).click();const frame=page.frameLocator('.schema-studio-frame');await frame.locator('.sDashboard').waitFor();return frame;}
try{
 let frame=await open();await frame.getByRole('button',{name:'New',exact:true}).first().click();await frame.getByLabel('Chart Width (crosses)').fill('24');await frame.getByLabel('Chart Height (crosses)').fill('20');await frame.getByLabel('Title',{exact:true}).fill('Offline chart');await frame.getByRole('button',{name:'OK',exact:true}).click();
 const cover=frame.locator('.sCanvasFrame-cover').first();await cover.waitFor();await expect.poll(()=>page.frames().filter(f=>f.url().includes('/studio/canvas.html')).length).toBe(1);
 await cover.click({position:{x:55,y:55}});await frame.getByRole('button',{name:'╲',exact:true}).click();await cover.click({position:{x:75,y:55}});await frame.getByRole('button',{name:'¾',exact:true}).click();await cover.click({position:{x:95,y:55}});await frame.getByRole('button',{name:'⨯',exact:true}).click();await cover.click({position:{x:115,y:55}});
 const studio=page.frames().find(f=>f.url().includes('/studio/index.html'));
 await expect.poll(async()=>studio.evaluate(()=>st.vueStore.state.model.model.images[0].layers[0].cross.filter(n=>n>=0).length)).toBe(4);
 let image=await studio.evaluate(()=>JSON.parse(JSON.stringify(st.vueStore.state.model.model.images[0])));assert.ok(image.crossIndexes.some(c=>c.tp==='pt'));assert.ok(image.crossIndexes.some(c=>c.tp.startsWith('qt')));assert.ok(image.crossIndexes.some(c=>c.tp==='hc1'));
 // Navigate away immediately after painting; the host must flush the upstream debounce.
 await cover.click({position:{x:135,y:55}});await page.locator('.sidebar').getByRole('button',{name:'Shopping',exact:true}).click();await expect(page.locator('.schema-studio-frame')).toHaveCount(0);
 const saved=JSON.parse(snapshot().schemaStudio.entries['S1.model']);assert.equal(saved.model.images[0].layers[0].cross.filter(n=>n>=0).length,5);validateStudioModel(saved.model);
 frame=await open();await frame.getByRole('button',{name:'Open',exact:true}).first().click();await frame.locator('.sCanvasFrame-cover').first().waitFor();
 let active=page.frames().find(f=>f.url().includes('/studio/index.html'));
 await frame.getByRole('button',{name:'Backstitch',exact:true}).click();let box=await frame.locator('.sCanvasFrame-cover').first().boundingBox();await page.mouse.move(box.x+50,box.y+70);await page.mouse.down();await page.mouse.move(box.x+90,box.y+95,{steps:5});await page.mouse.up();
 await expect.poll(async()=>active.evaluate(()=>st.vueStore.state.model.model.images[0].layers[0].backstitch.length)).toBeGreaterThan(0);
 await expect.poll(()=>{const value=JSON.parse(snapshot().schemaStudio.entries['S1.model']);return value.model.images[0].layers[0].backstitch.length;}).toBeGreaterThan(0);
 const document=await active.evaluate(()=>st.slotsSv.getSlotDataForExport(1));writeFileSync(join(data,'chart.fcjson'),JSON.stringify(document));
 // Exercise the same FCJSON import pipeline used by the file picker, including validation.
 await active.evaluate(async document=>{await st.slotsSv.importSlotData(2,document);},document);
 await expect.poll(()=>Boolean(snapshot().schemaStudio.entries['S2.model'])).toBe(true);
 const second=JSON.parse(snapshot().schemaStudio.entries['S2.model']);assert.deepEqual(second.model,document.model);
 // Inspect the actual OXS export/import mechanisms without opening an OS save dialog.
 const oxs=await active.evaluate(async document=>{const value=await new st.classes.ExportOxsClass().export({model:document});const imported=new st.classes.ImportOxsClass().getModelFromXml(new X2JS().xml2js(value.xml),{fileName:'chart.oxs'});return{xml:value.xml,model:imported.model};},document);validateStudioModel(oxs.model);assert.ok(oxs.xml.includes('<chart'));assert.ok(oxs.model.images[0].layers[0].backstitch.length>0);writeFileSync(join(data,'chart.oxs'),oxs.xml);
 await active.evaluate(()=>st.router.push('/designer/slot/1/svg'));await frame.locator('.sSvgBuilder').waitFor();await expect.poll(()=>active.evaluate(()=>document.querySelector('.sSvgBuilder').__vue__?.svg?.length||0)).toBeGreaterThan(500);
 const svg=await active.evaluate(()=>document.querySelector('.sSvgBuilder').__vue__.svg);assert.ok(svg.startsWith('<svg'));writeFileSync(join(data,'chart.svg'),svg);
 await active.evaluate(()=>st.router.push('/designer/slot/1/pdf'));await frame.locator('.sPdfBuilder').waitFor();await expect.poll(()=>active.evaluate(()=>{const vm=document.querySelector('.sPdfBuilder').__vue__;return !vm.isProcessing&&vm.doc?.doc?.output('arraybuffer').byteLength||0;}),{timeout:30000}).toBeGreaterThan(1000);
 const pdf=await active.evaluate(()=>Array.from(new Uint8Array(document.querySelector('.sPdfBuilder').__vue__.doc.doc.output('arraybuffer'))));assert.equal(Buffer.from(pdf).subarray(0,5).toString(),'%PDF-');writeFileSync(join(data,'chart.pdf'),Buffer.from(pdf));
 for(const [name,value]of [['native-chart.fcjson',JSON.stringify(document)],['native-chart.oxs',oxs.xml],['native-chart.svg',svg],['native-chart.pdf',pdf]]){
  const file=join(data,name);await app.evaluate(({dialog},filePath)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath});},file);
  await active.evaluate(({name,value})=>st.misc.exportFile(name,Array.isArray(value)?new Uint8Array(value).buffer:value),{name,value});await expect.poll(()=>existsSync(file)).toBe(true);assert.ok(readFileSync(file).byteLength>50);
 }
 await active.evaluate(()=>st.router.push('/designer/slot/1'));await frame.locator('.sCanvasFrame-cover').first().waitFor();
 await app.evaluate(({BrowserWindow})=>{BrowserWindow.getAllWindows()[0].setSize(1120,820);});await expect.poll(async()=>{const box=await frame.locator('.sCanvasFrame-cover').first().boundingBox();return box.width>200&&box.height>250;}).toBe(true);
 await page.screenshot({path:join(data,'editor-resized.png')});
 const backup=await inspectBackup(await createBackup(snapshot(),[]));assert.deepEqual(backup.state.schemaStudio,snapshot().schemaStudio);
 await app.close();app=await launch();page=await app.firstWindow();observe(page);frame=await open();await frame.getByRole('button',{name:'Open',exact:true}).first().click();await frame.locator('.sCanvasFrame-cover').first().waitFor();
 active=page.frames().find(f=>f.url().includes('/studio/index.html'));assert.deepEqual(await active.evaluate(()=>JSON.parse(JSON.stringify(st.vueStore.state.model.model))),document.model);
 await active.evaluate(()=>st.router.push('/designer'));await frame.locator('.sDashboard').waitFor();await frame.getByRole('button',{name:'From Image',exact:true}).first().click();await frame.locator('.sImageImport').waitFor();
 const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=48;c.height=32;const x=c.getContext('2d');x.fillStyle='#e31c38';x.fillRect(0,0,24,32);x.fillStyle='#1b3888';x.fillRect(24,0,24,32);return c.toDataURL('image/png').split(',')[1];});
 await frame.locator('input[type=file]').setInputFiles({name:'source.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
 for(let stage=0;stage<3;stage++){const next=frame.getByRole('button',{name:'Continue',exact:true});await expect(next).toBeEnabled({timeout:30000});await next.click();}
 const finish=frame.getByRole('button',{name:'Finish',exact:true});await expect(finish).toBeEnabled({timeout:30000});await finish.click();await frame.locator('.sCanvasFrame-cover').first().waitFor();
 await expect.poll(()=>Boolean(snapshot().schemaStudio.entries['S3.model'])).toBe(true);const converted=JSON.parse(snapshot().schemaStudio.entries['S3.model']);validateStudioModel(converted.model);assert.ok(converted.model.images[0].layers[0].cross.some(n=>n>=0));
 await page.getByRole('combobox',{name:'Language',exact:true}).selectOption('it');await expect(frame.getByRole('button',{name:'Matita',exact:true})).toBeVisible();
 await page.screenshot({path:join(data,'studio-italian.png')});assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.deepEqual(missing,[]);
 console.log('PASS: offline canvas, fractional/backstitch tools, immediate-leave save, FCJSON/OXS roundtrip, SVG/PDF, image conversion, resize, backup and restart. '+data);
}catch(error){console.log('ERRORS',errors,'EXTERNAL',external,'MISSING',missing);console.log('BODY',(await page.locator('body').innerText()).slice(0,2000));await page.screenshot({path:join(data,'failure.png')});throw error;}finally{await app.close();}
