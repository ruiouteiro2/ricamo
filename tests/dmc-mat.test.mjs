import test from 'node:test';
import assert from 'node:assert/strict';
import catalogue from '../data/dmc-mat-catalogue.json' with {type:'json'};
import previews from '../src/assets/dmc-mat-previews.json' with {type:'json'};
import {bundledSupplierProducts,normalizeSupplierProduct} from '../core/supplier-products.mjs';
import {INVENTORY_GROUPS,threadReferenceFor} from '../src/inventory-navigation.mjs';
import {productPreview} from '../src/product-previews.mjs';

const URL='https://www.dmc.com/IT/it/products/dmc-wool-tapestry/retors-mat-cotton';

test('official DMC Coton Retors Mat variants are searchable with offline previews',()=>{
 assert.equal(catalogue.format,'ricamo-official-dmc-mat');
 assert.equal(catalogue.productUrl,URL);
 assert.equal(catalogue.products.length,306);
 assert.equal(Object.keys(previews).length,306);
 for(const raw of catalogue.products){
  const row=normalizeSupplierProduct(raw);
  assert.equal(row.brand,'DMC');assert.equal(row.range,'Coton Retors Mat');assert.equal(row.url,URL);
  assert.equal(row.pack.unit,'skein');assert.equal(row.pack.lengthM,10);assert.equal(row.hex,null);
  assert.equal(productPreview(row),previews[row.id]);
  assert.match(previews[row.id],/^data:image\/(?:jpeg|png|webp);base64,/);
 }
 const bundled=bundledSupplierProducts().filter(row=>row.brand==='DMC'&&row.range==='Coton Retors Mat');
 assert.equal(bundled.length,306);
 for(const code of ['2035','BLANC','ECRU'])assert.ok(bundled.some(row=>row.code===code),code);
 for(const code of ['2012','2715'])assert.ok(!bundled.some(row=>row.code===code),code);
});

test('the DMC section links the type to the requested catalogue page',()=>{
 const dmc=INVENTORY_GROUPS.find(group=>group.id==='threads').children.find(child=>child.brand==='DMC');
 assert.deepEqual(threadReferenceFor(dmc,'mat'),{name:'DMC Coton Retors Mat',source:'DMC',family:'mat',url:URL});
});

test('saved rows of this type show their colour without being rewritten',()=>{
 const saved=code=>({brand:'DMC',range:'Coton retors mat',code,category:'thread',properties:{threadFamily:'mat'}});
 assert.equal(productPreview(saved('2035')),previews['dmc:mat:2035']);
 assert.equal(productPreview(saved('blanc')),previews['dmc:mat:BLANC']);
 assert.equal(productPreview(saved('99999')),'');
 assert.equal(productPreview({...saved('2035'),brand:'Anchor',properties:{}}),'');
});
