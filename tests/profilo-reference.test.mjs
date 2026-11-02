import test from 'node:test';
import assert from 'node:assert/strict';
import {INVENTORY_GROUPS,threadReferenceFor} from '../src/inventory-navigation.mjs';
import {purchaseUrl} from '../core/pattern-fabric.mjs';

const URL='https://www.casacenina.it/fili-e-filati/profilo/profilo-6-mouline/';
const threads=INVENTORY_GROUPS.find(group=>group.id==='threads').children;

test('Profilo threads carry the requested Casa Cenina reference',()=>{
 const profilo=threads.find(child=>child.brand==='Profilo');
 assert.equal(profilo.reference.url,URL);assert.equal(profilo.reference.source,'Casa Cenina');
 assert.equal(threadReferenceFor(profilo,'mouline').url,URL);
 assert.equal(purchaseUrl(URL),URL);
});

test('the reference belongs to Profilo threads only',()=>{
 const others=INVENTORY_GROUPS.flatMap(group=>group.children).filter(child=>!(child.brand==='Profilo'&&child.reference));
 for(const child of others)assert.notEqual(child.reference?.url,URL,child.id);
 for(const child of threads.filter(child=>child.brand!=='Profilo'))for(const reference of child.references||[])assert.notEqual(reference.url,URL);
});
