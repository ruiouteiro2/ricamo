import test from 'node:test';
import assert from 'node:assert/strict';
import {createState, applyCommand} from '../core/commands.mjs';
import {restockNeeds} from '../core/purchasing.mjs';

function studio(amount) {
  let state=createState(),sequence=0;
  const run=(type,payload)=>state=applyCommand(state,{type,payload,operationId:`op-${++sequence}`});
  run('material.save',{id:'thread',name:'DMC 001',category:'thread',unit:'skein',minimum:1});
  if(amount!==undefined)run('lot.add',{id:'lot',materialId:'thread',quantity:amount});
  return {run,get state(){return state;}};
}
test('minimum stock automatically lists absent/zero stock, not unknown or sufficient stock',()=>{
  for(const amount of [undefined,0])assert.equal(restockNeeds(studio(amount).state)[0].toOrder,1);
  for(const amount of [null,1,3])assert.deepEqual(restockNeeds(studio(amount).state),[]);
  const s=studio(0);s.run('lot.add',{materialId:'thread',quantity:null});assert.deepEqual(restockNeeds(s.state),[]);
});
test('consumption triggers replenishment; reservations do not; receipt removes it',()=>{
  const s=studio(1);
  s.run('project.save',{id:'project',name:'Project'});
  s.run('reservation.set',{projectId:'project',lotId:'lot',quantity:1});
  assert.deepEqual(restockNeeds(s.state),[]);
  s.run('stock.move',{kind:'consume',projectId:'project',lotId:'lot',quantity:1});
  assert.equal(restockNeeds(s.state)[0].toOrder,1);
  s.run('purchase.save',{id:'order',materialId:'thread',quantity:1});
  assert.equal(restockNeeds(s.state)[0].toOrder,0);
  s.run('purchase.receive',{purchaseId:'order',quantity:1});
  assert.deepEqual(restockNeeds(s.state),[]);
});
test('open purchases cover shortages, cancellation persists exclusion and archived materials stay out',()=>{
  const s=studio(0);
  s.run('purchase.save',{id:'order',materialId:'thread',quantity:1,status:'ordered'});
  assert.equal(restockNeeds(s.state)[0].toOrder,0);
  s.run('purchase.save',{id:'order',materialId:'thread',quantity:1,status:'cancelled'});
  assert.equal(restockNeeds(s.state)[0].toOrder,0);
  assert.equal(restockNeeds(s.state)[0].suppressed,true);
  s.run('purchase.restock',{materialId:'thread',enabled:true});
  assert.equal(restockNeeds(s.state)[0].toOrder,1);
  s.run('material.archive',{id:'thread'});assert.deepEqual(restockNeeds(s.state),[]);
});
test('legacy minimum fallback and multiple lots use physical totals without mutating data',()=>{
  const s=studio(0);s.run('material.save',{id:'thread',minimum:null});
  const before=structuredClone(s.state);assert.equal(restockNeeds(s.state)[0].minimum,1);assert.deepEqual(s.state,before);
  s.run('lot.add',{materialId:'thread',quantity:1});assert.deepEqual(restockNeeds(s.state),[]);
});

test('colour exclusion cancels all open orders atomically and reinclusion does not invent stock',()=>{
  const s=studio(0);
  s.run('purchase.save',{id:'a',materialId:'thread',quantity:2});
  s.run('purchase.save',{id:'b',materialId:'thread',quantity:3,status:'ordered'});
  s.run('purchase.restock',{materialId:'thread',enabled:false});
  assert.ok(s.state.purchases.every(order=>order.status==='cancelled'));
  assert.equal(restockNeeds(s.state)[0].suppressed,true);
  const snapshot=structuredClone(s.state);
  assert.throws(()=>s.run('purchase.restock',{materialId:'missing',enabled:true}));
  assert.deepEqual(s.state,snapshot);
  s.run('purchase.save',{id:'a',materialId:'thread',quantity:4,status:'to_buy'});
  assert.equal(s.state.purchases.length,2);
  assert.equal(restockNeeds(s.state)[0].suppressed,false);
  assert.equal(restockNeeds(s.state)[0].pending,4);
  assert.equal(s.state.lots[0].quantity,0);
});

test('removing a thread archives it and cancels open purchases without erasing stock history',()=>{
  const s=studio(0);
  s.run('purchase.save',{id:'order',materialId:'thread',quantity:1});
  const history=structuredClone(s.state.movements),lots=structuredClone(s.state.lots);
  s.run('material.removeFromInventory',{id:'thread'});
  assert.equal(s.state.materials[0].archived,true);
  assert.equal(s.state.purchases[0].status,'cancelled');
  assert.deepEqual(s.state.movements,history);assert.deepEqual(s.state.lots,lots);
  assert.deepEqual(restockNeeds(s.state),[]);
});
