import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {syncBuiltinESMExports} from 'node:module';
import {ensureDiskSpace,DISK_RESERVE_BYTES} from '../desktop/disk-space.mjs';import {atomicWrite} from '../desktop/filesystem.mjs';import {Repository} from '../desktop/repository.mjs';import {createState} from '../core/application.mjs';
const low=()=>({bsize:1n,bavail:0n});
test('Space preflight uses available blocks, bounded integer arithmetic and a fixed safety reserve',()=>{
 assert.equal(ensureDiskSpace('/synthetic',12,()=>({bsize:1n,bavail:BigInt(DISK_RESERVE_BYTES+12)})).requiredBytes,DISK_RESERVE_BYTES+12);
 assert.throws(()=>ensureDiskSpace('/synthetic',13,()=>({bsize:1n,bavail:BigInt(DISK_RESERVE_BYTES+12)})),{code:'insufficient_disk_space'});
 assert.throws(()=>ensureDiskSpace('/synthetic',0,()=>{throw new Error('PRIVATE_PATH')}),{code:'disk_space_unavailable'});
 assert.throws(()=>ensureDiskSpace('/synthetic',Number.MAX_SAFE_INTEGER+1),{code:'invalid_payload'});
});
test('Low-space export fails before temporary creation and preserves the existing destination; retry writes normally',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'ricamo-space-')),target=join(directory,'existing.txt'),original=fs.statfsSync;await atomicWrite(target,'original');
 try{fs.statfsSync=low;syncBuiltinESMExports();await assert.rejects(()=>atomicWrite(target,'replacement'),{code:'insufficient_disk_space'});assert.equal(await readFile(target,'utf8'),'original');assert.deepEqual(await readdir(directory),['existing.txt']);}finally{fs.statfsSync=original;syncBuiltinESMExports()}
 try{await atomicWrite(target,'replacement');assert.equal(await readFile(target,'utf8'),'replacement')}finally{await rm(directory,{recursive:true,force:true})}
});
test('Restore space rejection rolls back SQLite state and a later retry uses the same expected revision',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'ricamo-restore-space-')),repo=new Repository(join(directory,'ricamo.sqlite')),original=fs.statfsSync;
 repo.execute({type:'material.createWithLot',operationId:crypto.randomUUID(),payload:{material:{id:'keep',name:'Keep original',category:'thread',unit:'m'},lot:{quantity:4}}},0);const before=repo.load(),prepared={state:createState(),assets:[]};
 try{fs.statfsSync=low;syncBuiltinESMExports();assert.throws(()=>repo.restore(prepared,before.revision),{code:'insufficient_disk_space'});assert.deepEqual(repo.load(),before);}finally{fs.statfsSync=original;syncBuiltinESMExports()}
 try{assert.equal(repo.restore(prepared,before.revision).materials.length,0)}finally{repo.close();await rm(directory,{recursive:true,force:true})}
});
