import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,executeCommand} from '../core/application.mjs';
import {inventoryCsvTemplate} from '../core/csv-template.mjs';
import {parseCsv,guessMapping,previewInventory,csvText} from '../core/csv.mjs';
import {createDiagnostics} from '../core/diagnostics.mjs';

for(const language of ['it','en'])test('Empty '+language+' template imports exact text codes and distinguishes unknown, zero and catalogue-only',()=>{
 const template=inventoryCsvTemplate(language),delimiter=language==='it'?';':',',headers=parseCsv(template,delimiter)[0],mapping=guessMapping(headers),state=createState();
 assert.equal(previewInventory(parseCsv(template,delimiter),mapping,state).length,0);
 const row=(name,code,quantity,confidence,stock)=>headers.map((_,i)=>({name,code,quantity,confidence,category:'thread',unit:'m',status:'usable'}[Object.keys(mapping).find(key=>mapping[key]===i)]??(headers[i]==='__has_stock'?stock:'')));
 const data=csvText(headers,[row('Known','001',language==='it'?'1,5':'1.5','exact','1'),row('Unknown','002','','unknown','1'),row('Zero','003','0','exact','1'),row('Catalogue','004','','','0')],delimiter),rows=previewInventory(parseCsv(data,delimiter),mapping,state,{decimal:language==='it'?',':'.'});
 assert.ok(rows.every(row=>row.issues.length===0));const next=executeCommand(state,{type:'inventory.import',operationId:crypto.randomUUID(),payload:{digest:'d'.repeat(64),rows:JSON.parse(JSON.stringify(rows)),createLocations:true}});
 assert.deepEqual(next.materials.map(row=>row.code),['001','002','003','004']);assert.deepEqual(next.lots.map(row=>row.quantity),[1.5,null,0]);assert.equal(state.materials.length,0);
});
test('Diagnostics whitelist counts even when validation fails and exclude every user record and path',()=>{
 let state=executeCommand(createState(),{type:'material.createWithLot',operationId:crypto.randomUUID(),payload:{material:{id:'private-id',name:'PRIVATE_NAME',category:'thread',unit:'m',brand:'PRIVATE_BRAND',code:'PRIVATE_CODE',notes:'C:\\PRIVATE_PATH',properties:{custom:{Private:'PRIVATE_CUSTOM'}}},lot:{quantity:1.5}}});
 const before=structuredClone(state),report=createDiagnostics(state,{storage:'sqlite',createdAt:'2026-10-27T12:00:00.000Z'});assert.equal(report.counts.materials,1);assert.equal(report.counts.lots,1);assert.equal(report.validation,'passed');assert.doesNotMatch(JSON.stringify(report),/PRIVATE_|private-id/);assert.deepEqual(state,before);
 state.lots[0].quantity=-1;const bad=createDiagnostics(state,{storage:'indexeddb'});assert.equal(bad.validation,'failed');assert.doesNotMatch(JSON.stringify(bad),/PRIVATE_|private-id/);
});
