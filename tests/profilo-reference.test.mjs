import test from 'node:test';
import assert from 'node:assert/strict';
import {INVENTORY_GROUPS,threadReferenceFor} from '../src/inventory-navigation.mjs';
import {purchaseUrl} from '../core/pattern-fabric.mjs';
import {bundledSupplierProducts} from '../core/supplier-products.mjs';
import {productPreview} from '../src/product-previews.mjs';
import previews from '../src/assets/profilo-previews.json' with {type:'json'};
import sources from '../data/casa-profilo-preview-sources.json' with {type:'json'};

const URL='https://www.casacenina.it/fili-e-filati/profilo/profilo-6-mouline/';
const threads=INVENTORY_GROUPS.find(group=>group.id==='threads').children;

test('Profilo threads carry the requested Casa Cenina reference',()=>{
 const profilo=threads.find(child=>child.brand==='Profilo');
 assert.equal(profilo.reference.url,URL);assert.equal(profilo.reference.source,'Casa Cenina');
 assert.equal(threadReferenceFor(profilo,'mouline').url,URL);
 assert.equal(purchaseUrl(URL),URL);
});

test('every Profilo article shows its own colour offline',()=>{
 const articles=bundledSupplierProducts().filter(row=>row.brand==='Profilo');
 assert.equal(articles.length,400);assert.deepEqual(sources.missing,[]);
 for(const row of articles){const image=productPreview(row);assert.match(image,/^data:image\/png;base64,/,row.code);assert.equal(image,previews.images[previews.byCode[row.code]]);}
 assert.notEqual(previews.byCode['059'],previews.byCode['002']);
 assert.equal(sources.evidence.find(row=>row.code==='059').dmcEquivalent,'602');
});

test('saved Profilo rows reuse the colour and other codes or brands do not',()=>{
 const saved=code=>({brand:'Profilo',range:'Mouliné',code,category:'thread',properties:{threadFamily:'mouline'}});
 const image=previews.images[previews.byCode['059']];
 assert.equal(productPreview(saved('059')),image);
 assert.equal(productPreview(saved('59')),image);
 assert.equal(productPreview(saved('001')),'');
 assert.equal(productPreview(saved('')),'');
 assert.notEqual(productPreview({...saved('059'),brand:'Anchor'}),image);
});

test('the reference belongs to Profilo threads only',()=>{
 const others=INVENTORY_GROUPS.flatMap(group=>group.children).filter(child=>!(child.brand==='Profilo'&&child.reference));
 for(const child of others)assert.notEqual(child.reference?.url,URL,child.id);
 for(const child of threads.filter(child=>child.brand!=='Profilo'))for(const reference of child.references||[])assert.notEqual(reference.url,URL);
});
