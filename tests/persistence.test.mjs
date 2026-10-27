import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Repository } from '../desktop/repository.mjs';
import { inspectBackup } from '../core/backup.mjs';
import { createBlank } from '../core/pattern.mjs';
import { exportInventory, parseCsv, guessMapping, previewInventory } from '../core/csv.mjs';
import { createState, executeCommand } from '../core/application.mjs';
import { estimateThreads, estimateForMaterial } from '../core/estimates.mjs';

const command=(type,payload,operationId=crypto.randomUUID())=>({type,payload,operationId});
const color={brand:'Personal',code:'001',name:'Black',hex:'#000000',rgb:[0,0,0],symbol:'A',strands:2};
const fixture=()=>{const directory=mkdtempSync(join(tmpdir(),'ricamo-test-'));return {directory,path:join(directory,'library.sqlite'),cleanup:()=>rmSync(directory,{recursive:true,force:true})};};

test('SQLite commits atomic material+lot, preserves code and Italian decimals after reopening',()=>{
  const f=fixture();let repo=new Repository(f.path);
  try{
    repo.execute(command('material.createWithLot',{material:{id:'m1',name:'Thread',category:'thread',code:'001',unit:'m'},lot:{quantity:'1,5'}}),0);
    repo.close();repo=new Repository(f.path);
    const state=repo.load();assert.equal(state.materials[0].code,'001');assert.equal(state.lots[0].quantity,1.5);assert.equal(state.movements.length,1);
    const before=JSON.stringify(state);
    assert.throws(()=>repo.execute(command('material.createWithLot',{material:{id:'m2',name:'Invalid lot',unit:'m'},lot:{quantity:-1}}),state.revision));
    assert.equal(JSON.stringify(repo.load()),before);
  }finally{repo.close();f.cleanup();}
});

test('SQLite rejects stale writers and conflicting retries but replays identical operation before revision check',()=>{
  const f=fixture(),first=new Repository(f.path),second=new Repository(f.path);
  try{
    const op=command('material.save',{id:'m1',name:'Thread',unit:'m'},'stable-operation');
    first.execute(op,0);
    assert.equal(second.execute(op,0).materials.length,1);
    assert.throws(()=>second.execute(command('material.save',{name:'Stale'},'new-operation'),0),{code:'stale_revision'});
    assert.throws(()=>first.execute({...op,payload:{...op.payload,name:'Different'}},1),{code:'idempotency_conflict'});
    assert.equal(first.load().revision,1);
  }finally{first.close();second.close();f.cleanup();}
});

test('complete backup round-trips database and managed attachment; corrupt/future packages do not mutate destination',async()=>{
  const source=new Repository(':memory:'),destination=new Repository(':memory:');
  try{
    source.execute(command('material.save',{id:'m1',name:'B5200',code:'B5200'}),0);
    const bytes=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64'));
    const imported=source.importAsset({name:'foto.png',data:bytes,operationId:'image-1'},1);
    source.execute(command('material.save',{id:'m1',attachments:[imported.asset.id]}),2);
    const serialized=await source.backup(),prepared=await inspectBackup(serialized);
    destination.restore(prepared,0);
    assert.equal(destination.load().materials[0].code,'B5200');assert.deepEqual(destination.getAsset(imported.asset.id),bytes);
    const before=JSON.stringify(destination.load()),bad=JSON.parse(serialized);bad.payload=bad.payload.replace('B5200','B5201');
    await assert.rejects(()=>inspectBackup(JSON.stringify(bad)),{code:'backup_integrity'});
    await assert.rejects(()=>inspectBackup(JSON.stringify({...JSON.parse(serialized),version:99})),{code:'unsupported_backup'});
    assert.equal(JSON.stringify(destination.load()),before);
  }finally{source.close();destination.close();}
});

test('pattern revisions remain pinned and progress never changes physical stock after persistence',()=>{
  const repo=new Repository(':memory:');
  try{
    let revision=createBlank(2,1,[color],{id:'r1'});revision.cells=[0,-1];
    repo.execute(command('pattern.save',{id:'p1',name:'First',revision}),0);
    repo.execute(command('project.save',{id:'work',name:'Work',patternId:'p1'}),1);
    repo.execute(command('project.progress',{projectId:'work',completed:['c:0']}),2);
    revision={...revision,id:'r2',cells:[-1,0]};repo.execute(command('pattern.save',{id:'p1',name:'First',revision}),3);
    assert.equal(repo.load().projects[0].revisionId,'r1');assert.deepEqual(repo.load().projects[0].completed,['c:0']);assert.equal(repo.load().movements.length,0);
    assert.throws(()=>repo.execute(command('project.save',{id:'work',revisionId:'r2'}),4),{code:'revision_change_confirmation'});
  }finally{repo.close();}
});

test('CSV quotes, newlines, exact codes, decimal comma and formula escape round-trip without mutating canonical data',()=>{
  let state=createState();state=executeCommand(state,command('material.createWithLot',{material:{id:'m',name:'A "quoted" thread',code:'001',unit:'m',notes:'=SUM(A1:A2)\nnext line'},lot:{quantity:1.5}}));
  const exported=exportInventory(state,'it');assert.ok(exported.includes("'=SUM"));
  const rows=parseCsv(exported),mapping=guessMapping(rows[0]),preview=previewInventory(rows,mapping,createState(),{decimal:','});
  assert.equal(preview[0].material.code,'001');assert.equal(preview[0].lot.quantity,1.5);assert.equal(preview[0].material.notes,'=SUM(A1:A2)\nnext line');assert.deepEqual(preview[0].issues,[]);
  assert.equal(state.materials[0].notes,'=SUM(A1:A2)\nnext line');
});

test('CSV commit is atomic; repeated digest requires explicit decision and repeated lots share catalogue identity',()=>{
  const state=createState(),rows=[{material:{name:'Thread',brand:'Personal',code:'001',unit:'m'},lot:{quantity:2,locationName:'Drawer'}},{material:{name:'Thread',brand:'Personal',code:'001',unit:'m'},lot:{quantity:3,locationName:'Drawer'}}];
  const payload={rows,digest:'a'.repeat(64),createLocations:true};
  const next=executeCommand(state,command('inventory.import',payload));assert.equal(next.materials.length,1);assert.equal(next.lots.length,2);assert.equal(next.locations.length,1);
  assert.throws(()=>executeCommand(next,command('inventory.import',payload)),{code:'duplicate_import'});
  assert.throws(()=>executeCommand(state,command('inventory.import',{...payload,rows:[rows[0],{...rows[1],lot:{quantity:-3}}]})));
  assert.equal(state.materials.length,0);
});

test('geometric estimates scale by actual strands and do not invent unknown package conversions',()=>{
  const revision=createBlank(10,10,[color],{id:'estimate'});revision.cells.fill(0);
  const two=estimateThreads(revision,{countX:14,strands:2})[0];
  const four=estimateThreads(revision,{countX:14,colorStrands:{0:4}})[0];
  assert.ok(two.filamentMetres>0);assert.ok(Math.abs(four.filamentMetres-2*two.filamentMetres)<.000002);
  assert.equal(estimateForMaterial(two,{unit:'m',strands:null}),null);
  assert.equal(estimateForMaterial(two,{unit:'strand-m'}),two.filamentMetres);
  let state=createState();state=executeCommand(state,command('pattern.save',{id:'pattern',name:'P',revision}));state=executeCommand(state,command('project.save',{id:'project',name:'W',patternId:'pattern'}));state=executeCommand(state,command('project.estimate',{projectId:'project'}));
  assert.equal(state.needs.length,1);assert.equal(state.lots.length,0);assert.equal(state.reservations.length,0);assert.equal(state.needs[0].source,'pattern');
});
