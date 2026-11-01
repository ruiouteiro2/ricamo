import test from 'node:test';import assert from 'node:assert/strict';
import {Repository} from '../desktop/repository.mjs';import {inspectBackup} from '../core/backup.mjs';import {backupSummary} from '../core/backup-summary.mjs';import {seedFullBackup} from './full-backup-fixture.mjs';
test('complete backup restores inventory, archived records, pattern revisions/draft, originals and project history',async()=>{
 const source=new Repository(':memory:'),target=new Repository(':memory:');try{
  const fixture=seedFullBackup(source),text=await source.backup(),prepared=await inspectBackup(text);assert.deepEqual(prepared.state,fixture.state);
  const restored=target.restore(prepared,0),expected={...fixture.state,revision:1};assert.deepEqual(restored,expected);
  for(let i=0;i<fixture.imported.length;i++)assert.deepEqual(target.getAsset(fixture.imported[i].id),new Uint8Array(fixture.originals[i].data));
  assert.deepEqual(backupSummary(restored),{materials:2,lots:3,patterns:1,projects:1,purchases:1,movements:4,attachments:2,revisions:2,drafts:1,catalogueCharts:0});
  const before=target.load(),corrupt=JSON.parse(text);corrupt.payload=corrupt.payload.replace('Stored cotton','Altered cotton');await assert.rejects(inspectBackup(JSON.stringify(corrupt)),{code:'backup_integrity'});assert.deepEqual(target.load(),before);
 }finally{source.close();target.close();}
});
