import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,executeCommand} from '../core/application.mjs';
import {duplicateMaterials} from '../core/material-duplicates.mjs';
import {inventorySummary} from '../core/inventory.mjs';
const material={id:'original',name:'Black thread',category:'thread',brand:'DMC',range:'Mouline',code:'001',unit:'m',properties:{threadSize:'25'}};
const candidate={...material,id:'incoming',range:'Moulin\u00e9'};
const run=(state,type,payload,operationId=crypto.randomUUID())=>executeCommand(state,{type,payload,operationId});
function seed(){let s=run(createState(),'material.save',material);return run(s,'lot.add',{id:'old-lot',materialId:material.id,quantity:3});}
test('duplicate matching uses category, supplier identity and size while retaining string codes',()=>{
 const s=seed();assert.equal(duplicateMaterials(s,candidate).length,1);assert.equal(duplicateMaterials(s,{...candidate,properties:{threadSize:'8'}}).length,0);assert.equal(duplicateMaterials(s,{...candidate,category:'fabric'}).length,0);assert.equal(duplicateMaterials(s,{...candidate,brand:'Anchor'}).length,0);assert.equal(s.materials[0].code,'001');
 const archived=run(s,'material.archive',{id:material.id});assert.equal(duplicateMaterials(archived,candidate).length,0);
});
test('creation of a repeated article is blocked before any stock or history changes',()=>{
 const s=seed(),before=structuredClone(s);assert.throws(()=>run(s,'material.createWithLot',{material:candidate,lot:{quantity:2}}),{code:'material_duplicate'});assert.deepEqual(s,before);
});
test('confirmed duplicate adds stock to one material, preserves old lots, and retries exactly once',()=>{
 const s=seed(),payload={materialId:material.id,material:candidate,unit:'m',lot:{quantity:2,properties:{usageStatus:'new'}}};const next=run(s,'material.addDuplicateStock',payload,'add-once');assert.equal(next.materials.length,1);assert.equal(next.lots.length,2);assert.equal(next.lots[0].quantity,3);assert.equal(inventorySummary(next,material.id).physical,5);assert.deepEqual(next.materials,s.materials);assert.deepEqual(run(next,'material.addDuplicateStock',payload,'add-once'),next);
 for(const bad of [{...payload,unit:'skein'},{...payload,material:{...candidate,code:'999'}},{...payload,lot:{quantity:0}}])assert.throws(()=>run(s,'material.addDuplicateStock',bad));
});
