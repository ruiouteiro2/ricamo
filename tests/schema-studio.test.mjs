import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,executeCommand,validateApplicationState} from '../core/application.mjs';
import {validateStudioModel,validateStudioValue} from '../core/schema-studio.mjs';
import {Repository} from '../desktop/repository.mjs';
import {createBackup,inspectBackup} from '../core/backup.mjs';

const model=()=>({id:'studio-model',images:[{width:4,height:3,flossIndexes:[{sys:'DMC',id:'321',rgb:[227,28,56],symbol:'sm0',active:true}],crossIndexes:[{tp:'cr',fi:0},{tp:'pt',fis:[0,-1,0,-1]},{tp:'qt1',fi:0},{tp:'hc2',fi:0},{tp:'bi1',fis:[0,0]}],layers:[{width:4,height:3,position:{left:0,top:0},cross:[0,1,2,3,4,-1,-1,-1,-1,-1,-1,-1],backstitch:[{c:0,p:[[0,.25,2.5,3],[1,1,1,1]]}]}]}]});
test('advanced studio preserves mixed, petite, three-quarter, half stitches and quarter-step backstitch',()=>{
  const state=createState(),value={v:133,modelId:'studio-model',model:model()},command={type:'studio.write',operationId:'studio-save',payload:{changes:[{key:'S1.model',json:JSON.stringify(value)}]}};
  const next=executeCommand(state,command);assert.deepEqual(JSON.parse(next.schemaStudio.entries['S1.model']),value);assert.equal(state.schemaStudio,undefined);
  assert.deepEqual(executeCommand(next,command),next);assert.equal(next.movements.length,0);assert.equal(next.patterns.length,0);validateApplicationState(next);
});
test('advanced studio data is included in repository readback and normal backups',async()=>{
  const repo=new Repository(':memory:');const json=JSON.stringify({v:133,modelId:'m',model:model()});
  repo.execute({type:'studio.write',operationId:'write',payload:{changes:[{key:'S1.model',json},{key:'local:$fc_index_reserve',json:JSON.stringify('{"reserves":[]}')},{key:'Global.Settings',json:'{"settings":{"mainPalette":{}}}'}]}},0);
  const saved=repo.load();const restored=await inspectBackup(await createBackup(saved,[]));assert.deepEqual(restored.state.schemaStudio,saved.schemaStudio);
  repo.restore(restored,saved.revision);assert.equal(repo.load().schemaStudio.entries['S1.model'],json);repo.close();
});
test('advanced studio validates bounded documents and atomically rejects invalid changes',()=>{
  for(const mutate of [p=>p.images[0].width=301,p=>p.images[0].layers[0].cross[0]=500,p=>p.images[0].crossIndexes[1].fis=[99],p=>p.images[0].layers[0].backstitch[0].p=[[0,0,5,1]],p=>p.images[0].layers[0].backstitch[0].p=[[0,0,.1,1]],p=>p.images[0].flossIndexes[0].sys='UNKNOWN']){const value=model();mutate(value);assert.throws(()=>validateStudioModel(value));}
  for(const key of ['__proto__','S4.model','../file','local:constructor/path'])assert.throws(()=>validateStudioValue(key,'{}'));
  assert.throws(()=>validateStudioValue('S1.info','{"__proto__":{"polluted":true}}'));
  const state=createState();assert.throws(()=>executeCommand(state,{type:'studio.write',operationId:'bad',payload:{changes:[{key:'S1.info',json:'{}'},{key:'S1.model',json:'{}'}]}}));assert.equal(state.schemaStudio,undefined);
});
test('advanced studio clear and settings writes preserve the other slots and old application data',()=>{
  let state=executeCommand(createState(),{type:'studio.write',operationId:'initial',payload:{changes:[{key:'S1.info',json:'{"info":{"title":"First"}}'},{key:'S2.info',json:'{"info":{"title":"Second"}}'}]}});
  state=executeCommand(state,{type:'studio.write',operationId:'clear-first',payload:{changes:[{key:'S1.info',json:null}]}});
  assert.equal(state.schemaStudio.entries['S1.info'],undefined);assert.equal(JSON.parse(state.schemaStudio.entries['S2.info']).info.title,'Second');assert.equal(state.settings.language,'it');
});
