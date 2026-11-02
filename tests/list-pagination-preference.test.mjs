import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,executeCommand} from '../core/application.mjs';
import {createBackup,inspectBackup} from '../core/backup.mjs';

const save=(state,preferences)=>executeCommand(state,{type:'settings.save',payload:{preferences},operationId:crypto.randomUUID()});

test('list pagination is on by default and its preference survives a complete backup',async()=>{
 const fresh=createState();
 assert.notEqual(fresh.settings.preferences?.paginateLists,false);
 const state=save(fresh,{paginateLists:false,existingPreference:'retained'});
 assert.equal(state.settings.preferences.paginateLists,false);
 const restored=await inspectBackup(await createBackup(state,[]));
 assert.deepEqual(restored.state.settings.preferences,state.settings.preferences);
});

test('invalid list pagination preference is rejected without changing state',()=>{
 const state=createState(),before=structuredClone(state);
 assert.throws(()=>save(state,{paginateLists:'false'}),{code:'invalid_boolean'});
 assert.deepEqual(state,before);
});
