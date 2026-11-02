import test from 'node:test';
import assert from 'node:assert/strict';
import {threadCountUnit} from '../core/thread-count-unit.mjs';
import {duplicateMaterials} from '../core/material-duplicates.mjs';

const perle=(id,unit,extra={})=>({id,category:'thread',brand:'DMC',range:'Perlé 8',code:'52',unit,archived:false,name:`Perlé ${id}`,properties:{threadFamily:'pearl',threadSize:'8',...extra}});

test('the chosen DMC Perlé format decides the count unit over the catalogue pack',()=>{
 const product={pack:{unit:'ball'}};
 assert.equal(threadCountUnit({brand:'DMC',family:'pearl',properties:{threadFormat:'skein'},product}),'skein');
 assert.equal(threadCountUnit({brand:'DMC',family:'pearl',properties:{},product}),'ball');
 assert.equal(threadCountUnit({brand:'DMC',family:'mouline',properties:{threadFormat:'ball'}}),'skein');
 assert.equal(threadCountUnit({brand:'Anchor',family:'pearl',properties:{threadFormat:'ball'}}),'skein');
 assert.equal(threadCountUnit({brand:'DMC',family:'pearl',properties:{threadFormat:'cone'}}),'skein');
});

test('a skein and a ball of one DMC Perlé colour stay separate, the same format still merges',()=>{
 const state={materials:[perle('skein','skein',{threadFormat:'skein'})]};
 assert.deepEqual(duplicateMaterials(state,perle('new','ball',{threadFormat:'ball'})),[]);
 assert.deepEqual(duplicateMaterials(state,perle('new','skein',{threadFormat:'skein'})).map(row=>row.id),['skein']);
 const legacy={materials:[{...perle('old','ball'),properties:{threadSize:'8'}}]};
 assert.deepEqual(duplicateMaterials(legacy,perle('new','skein')),[]);
 assert.deepEqual(duplicateMaterials(legacy,perle('new','ball')).map(row=>row.id),['old']);
});

test('other threads keep merging regardless of unit',()=>{
 const mouline={id:'a',category:'thread',brand:'DMC',range:'Mouliné',code:'310',unit:'skein',archived:false,name:'A',properties:{threadFamily:'mouline'}};
 assert.deepEqual(duplicateMaterials({materials:[mouline]},{...mouline,id:'b',unit:'ball'}).map(row=>row.id),['a']);
});
