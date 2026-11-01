import test from 'node:test';import assert from 'node:assert/strict';
import {createState,executeCommand} from '../core/application.mjs';import {materialEditSnapshot} from '../core/material-edit.mjs';
const run=(state,type,payload,id=crypto.randomUUID())=>executeCommand(state,{type,payload,operationId:id});
function fixture(){let state=createState();state=run(state,'material.save',{id:'m',name:'Custom name',brand:'DMC',range:'Mouliné',code:'310',category:'thread',unit:'m',notes:'Keep notes',tags:['retained'],properties:{custom:{shelf:'saved'},care:'Keep care'},minimum:1});state=run(state,'lot.add',{id:'one',materialId:'m',quantity:3,lotCode:'A',notes:'Lot note',properties:{usageStatus:'partial',details:{version:1,packageCondition:'partial'}}});return state;}
const payload=(state,quantity,usageStatus='new')=>({material:{...structuredClone(state.materials[0]),properties:{...state.materials[0].properties,threadSize:'8'}},quantity,usageStatus,expected:materialEditSnapshot(state,'m').fingerprint});
test('simplified material edit atomically saves metadata, explicit count and usage without deleting hidden data',()=>{
 const before=fixture();let state=run(before,'material.saveInventory',payload(before,5,'partial'),'edit');assert.equal(state.materials[0].properties.threadSize,'8');assert.equal(state.materials[0].notes,'Keep notes');assert.deepEqual(state.materials[0].tags,['retained']);assert.equal(state.materials[0].properties.custom.shelf,'saved');assert.equal(state.lots[0].quantity,5);assert.equal(state.lots[0].notes,'Lot note');assert.equal(state.lots[0].lotCode,'A');assert.equal(state.lots[0].properties.usageStatus,'partial');assert.ok(state.movements.some(row=>row.kind==='count'&&row.after===5));assert.deepEqual(run(state,'material.saveInventory',payload(before,5,'partial'),'edit'),state);
 state=run(state,'material.saveInventory',payload(state,0,'finished'));assert.equal(state.lots[0].quantity,0);assert.equal(state.lots[0].properties.usageStatus,'finished');assert.equal(state.materials[0].minimum,1);
});
test('multi-lot recount protects reservations, preserves lots and rejects stale or invalid edits atomically',()=>{
 let state=fixture();state=run(state,'lot.add',{id:'two',materialId:'m',quantity:4,lotCode:'B'});state=run(state,'project.save',{id:'p',name:'Project'});state=run(state,'reservation.set',{projectId:'p',lotId:'one',quantity:2});const before=structuredClone(state);let next=run(state,'material.saveInventory',payload(state,2,'partial'));assert.equal(next.lots.length,2);assert.equal(next.lots.reduce((sum,row)=>sum+row.quantity,0),2);assert.equal(next.reservations[0].quantity,2);assert.deepEqual(state,before);assert.throws(()=>run(state,'material.saveInventory',payload(state,0,'finished')),/insufficient_available/);assert.deepEqual(state,before);
 const sameTime=run(state,'material.save',{...state.materials[0],notes:'Concurrent note'});assert.throws(()=>run(sameTime,'material.saveInventory',payload(state,5)),/material_edit_stale/);
 const stale=payload(state,5);next=run(state,'stock.move',{kind:'count',lotId:'two',quantity:3,reason:'Elsewhere'});assert.throws(()=>run(next,'material.saveInventory',stale),/material_edit_stale/);assert.throws(()=>run(state,'material.saveInventory',payload(state,null)),/material_edit_known_quantity/);
});
test('unknown is preserved on metadata/status edits and one unknown lot can receive an explicit count',()=>{
 let state=fixture();state=run(state,'lot.add',{id:'unknown',materialId:'m',quantity:null});assert.equal(materialEditSnapshot(state,'m').quantity,null);let next=run(state,'material.saveInventory',payload(state,null,'partial'));assert.equal(next.lots.find(row=>row.id==='unknown').quantity,null);next=run(next,'material.saveInventory',payload(next,8,'new'));assert.equal(next.lots.find(row=>row.id==='unknown').quantity,5);assert.equal(next.lots.find(row=>row.id==='one').quantity,3);
 state=run(state,'lot.add',{id:'another',materialId:'m',quantity:null});const before=structuredClone(state);assert.throws(()=>run(state,'material.saveInventory',payload(state,9)),/material_edit_unknown_lots/);assert.deepEqual(state,before);
});

test('almost finished survives edits and does not consume stock',()=>{
 const before=fixture();let state=run(before,'material.saveInventory',payload(before,3,'nearly_finished'));
 assert.equal(state.lots[0].quantity,3);assert.equal(state.movements.length,before.movements.length);
 assert.equal(state.lots[0].properties.usageStatus,'nearly_finished');assert.equal(state.lots[0].properties.details.packageCondition,'partial');
 assert.equal(materialEditSnapshot(state,'m').usageStatus,'nearly_finished');
 state=run(state,'material.saveInventory',payload(state,3,'new'));assert.equal(materialEditSnapshot(state,'m').usageStatus,'new');
 state=run(state,'material.saveInventory',payload(state,0,'finished'));assert.equal(materialEditSnapshot(state,'m').usageStatus,'finished');
});
