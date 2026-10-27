import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { Repository } from '../desktop/repository.mjs';
import { createExampleStudio,EXAMPLE_IDS } from '../core/example-studio.mjs';
import { createBlank } from '../core/pattern.mjs';
const png=()=>Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64'));
const pdf=()=>new TextEncoder().encode('%PDF-1.7\nOriginal attachment\n%%EOF');
const files=()=>[{name:'photo.png',data:png()},{name:'instructions.pdf',data:pdf()}];
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const blobs=repo=>repo.db.prepare('SELECT count(*) n FROM assets').get().n;
const run=(repo,type,payload)=>repo.execute({type,payload,operationId:crypto.randomUUID()},repo.load().revision);
const request=(type,payload,operationId='owner-save',batch=files())=>({owner:{type,payload},files:batch,operationId});
const save=(repo,input)=>repo.saveEntityWithAssets(input,repo.load().revision);
const newMaterial=()=>request('material.createWithLot',{material:{name:'Cotton',unit:'m',code:'001',attachments:[]},lot:{quantity:3,cost:120}});

test('Material, lot and multiple originals commit once, replay and survive SQLite reopen',()=>{
 const directory=mkdtempSync(join(tmpdir(),'ricamo-owner-assets-')),path=join(directory,'library.sqlite');let repo=new Repository(path);
 try{const input=newMaterial(),unchanged=structuredClone(input),first=save(repo,input);assert.equal(first.state.revision,1);assert.equal(first.state.operations.length,1);assert.equal(first.state.materials[0].code,'001');assert.equal(first.state.lots[0].quantity,3);assert.equal(blobs(repo),2);assert.deepEqual(input,unchanged);repo.close();repo=new Repository(path);assert.equal(repo.load().materials[0].id,first.ownerId);
 for(const file of input.files){const metadata=repo.load().attachments.find(row=>row.digest===digest(file.data));assert.deepEqual(repo.getAsset(metadata.id),file.data);assert.ok(repo.load().materials[0].attachments.includes(metadata.id));}
 run(repo,'project.save',{name:'Unrelated later edit'});const latest=repo.load();assert.deepEqual(repo.saveEntityWithAssets(input,0).state,latest);assert.equal(blobs(repo),2);
 assert.throws(()=>save(repo,{...input,owner:{...input.owner,payload:{...input.owner.payload,material:{...input.owner.payload.material,name:'Different'}}}}),{code:'idempotency_conflict'});
 assert.throws(()=>save(repo,{...input,files:[{name:'changed.pdf',data:new TextEncoder().encode('%PDF-1.7 different')}]}),{code:'idempotency_conflict'});
 }finally{repo.close();rmSync(directory,{recursive:true,force:true});}
});
test('A failure after BLOB insertion rolls back all originals, owner, lot, operation and revision; retry succeeds',()=>{
 const repo=new Repository(':memory:');try{const before=repo.load(),input=newMaterial();repo.db.exec("CREATE TRIGGER abort_state BEFORE UPDATE ON application_state BEGIN SELECT RAISE(ABORT,'state write failed'); END;");assert.throws(()=>save(repo,input),/state write failed/);assert.deepEqual(repo.load(),before);assert.equal(blobs(repo),0);repo.db.exec('DROP TRIGGER abort_state');save(repo,input);assert.equal(blobs(repo),2);assert.equal(repo.load().lots.length,1);}finally{repo.close();}
});
test('Invalid second file, owner, ordinary domain values and stale writes never import a first file',()=>{
 const repo=new Repository(':memory:');try{const before=repo.load();for(const input of [request('material.save',{name:'Invalid',packageSize:0}),request('stock.move',{lotId:'x',quantity:1}),request('material.save',{name:'Bad'},'bad-file',[files()[0],{name:'bad.png',data:new Uint8Array([1,2,3])}]),request('material.save',{name:'Bad'},'too-many',Array.from({length:21},()=>files()[0]))]){assert.throws(()=>save(repo,input));assert.deepEqual(repo.load(),before);assert.equal(blobs(repo),0);}run(repo,'project.save',{name:'Concurrent change'});assert.throws(()=>repo.saveEntityWithAssets(newMaterial(),0),{code:'stale_revision'});assert.equal(blobs(repo),0);}finally{repo.close();}
});
test('Batch duplicates and shared originals are linked without deleting another owner or concurrent links',()=>{
 const repo=new Repository(':memory:');try{const first=save(repo,newMaterial()),shared=first.assetIds[0];const project=save(repo,request('project.save',{name:'Project',attachments:[]},'project',[files()[0],files()[0]]));assert.equal(blobs(repo),2);assert.deepEqual(project.state.projects[0].attachments,[shared]);
 const captured=request('material.save',{id:first.ownerId,name:'Changed',attachments:[]},'edited',[files()[0]]);save(repo,captured);assert.equal(repo.load().materials[0].attachments.length,2);assert.deepEqual(repo.load().projects[0].attachments,[shared]);assert.deepEqual(repo.getAsset(shared),png());
 }finally{repo.close();}
});
test('Sessions save photos atomically and cannot change project identity or claim an unrelated revision',()=>{
 const repo=new Repository(':memory:');try{for(const id of ['one','two'])run(repo,'project.save',{id,name:id});const first=save(repo,request('session.save',{projectId:'one',durationMinutes:10,date:'2026-10-27',attachments:[]},'session'));const before=repo.load();assert.throws(()=>save(repo,request('session.save',{id:first.ownerId,projectId:'two',durationMinutes:10},'move')), {code:'session_project_changed'});assert.deepEqual(repo.load(),before);
 const revision=createBlank(1,1,[{brand:'Example',code:'001',name:'Black',hex:'#000000',rgb:[0,0,0],symbol:'A',strands:2}],{id:'r1'});revision.cells=[0];run(repo,'pattern.save',{id:'pattern',name:'Other project pattern',revision});run(repo,'project.save',{id:'two',patternId:'pattern'});const current=repo.load();assert.throws(()=>save(repo,request('session.save',{projectId:'one',durationMinutes:10,work:{kind:'full',count:1,patternId:'pattern',revisionId:'r1'},restoreHistorical:true},'unrelated')), {code:'session_revision_mismatch'});assert.deepEqual(repo.load(),current);assert.equal(blobs(repo),2);
 }finally{repo.close();}
});
test('Material conversion and project settings still invalidate estimates inside the compound transaction',()=>{
 const repo=new Repository(':memory:');try{repo.restore({state:createExampleStudio('en',{now:'2026-10-27T12:00:00Z'}),assets:[]},0);run(repo,'project.estimate',{projectId:EXAMPLE_IDS.project});const stock=repo.load().lots;assert.ok(repo.load().needs.some(row=>row.source==='pattern'));
 save(repo,request('material.save',{id:EXAMPLE_IDS.estimated,strands:3},'conversion'));assert.equal(repo.load().needs.filter(row=>row.source==='pattern').length,0);assert.equal(repo.load().projects[0].settings.threadEstimateHistory.at(-1).reason,'conversion_changed');assert.deepEqual(repo.load().lots,stock);
 run(repo,'project.estimate',{projectId:EXAMPLE_IDS.project});const project=repo.load().projects[0];save(repo,request('project.save',{id:project.id,settings:{...project.settings,thread:{...project.settings.thread,strands:3}}},'settings'));assert.equal(repo.load().needs.filter(row=>row.source==='pattern').length,0);assert.equal(repo.load().projects[0].settings.threadEstimateHistory.at(-1).reason,'configuration_changed');assert.deepEqual(repo.load().lots,stock);
 }finally{repo.close();}
});
test('Active fabric reservations still prohibit closing through project.save with photos',()=>{
 const repo=new Repository(':memory:');try{repo.restore({state:createExampleStudio('en',{now:'2026-10-27T12:00:00Z'}),assets:[]},0);run(repo,'fabric.region.reserve',{lotId:'example-fabric-piece',projectId:EXAMPLE_IDS.project,x:0,y:0,width:10,height:10});const before=repo.load();assert.throws(()=>save(repo,request('project.save',{id:EXAMPLE_IDS.project,status:'completed'},'close')), {code:'close_project_first'});assert.deepEqual(repo.load(),before);assert.equal(blobs(repo),0);}finally{repo.close();}
});
test('Tool and kit validation remains active when changing attached materials',()=>{
 const repo=new Repository(':memory:');try{repo.restore({state:createExampleStudio('en',{now:'2026-10-27T12:00:00Z'}),assets:[]},0);run(repo,'tool.loan',{lotId:'example-hoop-lot',recipient:'Ada',quantity:1,loanedAt:'2026-10-20'});let before=repo.load();assert.throws(()=>save(repo,request('material.save',{id:'example-hoop',category:'other',reusable:false},'tool')));assert.deepEqual(repo.load(),before);assert.equal(blobs(repo),0);
 run(repo,'material.save',{id:'kit',name:'Kit',category:'kit',unit:'piece'});run(repo,'kit.plan.save',{id:'plan',kind:'physical',materialId:'kit',name:'Contents',components:[]});before=repo.load();assert.throws(()=>save(repo,request('material.save',{id:'kit',category:'other'},'kit')));assert.deepEqual(repo.load(),before);assert.equal(blobs(repo),0);
 }finally{repo.close();}
});
