import test from 'node:test';
import assert from 'node:assert/strict';
import catalogue from '../data/dmc-alsace-catalogue.json' with {type:'json'};
import previews from '../src/assets/dmc-alsace-previews.json' with {type:'json'};
import {bundledSupplierProducts,normalizeSupplierProduct} from '../core/supplier-products.mjs';
import {threadRangeMatchesSize} from '../src/inventory-navigation.mjs';
import {productPreview} from '../src/product-previews.mjs';

test('official DMC Retors d\'Alsace variants are searchable by size with offline previews',()=>{
 assert.equal(catalogue.format,'ricamo-official-dmc-alsace');
 assert.equal(catalogue.products.length,146);
 assert.equal(Object.keys(previews).length,146);
 for(const raw of catalogue.products){
  const row=normalizeSupplierProduct(raw);
  assert.equal(row.brand,'DMC');assert.equal(row.pack.unit,'skein');assert.equal(row.hex,null);
  assert.match(previews[row.id],/^data:image\/(?:jpeg|png|webp);base64,/);
  assert.equal(productPreview(row),previews[row.id]);
 }
 const bundled=bundledSupplierProducts().filter(row=>row.brand==='DMC'&&row.code==='726'&&/alsace/i.test(row.range));
 assert.deepEqual(bundled.map(row=>row.id).sort(),['dmc:alsace:12:726','dmc:alsace:5:726','dmc:alsace:8:726']);
 for(const size of ['5','8','12'])assert.deepEqual(bundled.filter(row=>threadRangeMatchesSize(row.range,'alsace',size)).map(row=>row.id),[`dmc:alsace:${size}:726`]);
});

test('saved Ritorto rows reuse the swatch of their thickness without rewriting',()=>{
 const saved=size=>({brand:'DMC',range:"Ritorto d'Alsazia",code:'726',category:'thread',properties:{threadFamily:'alsace',threadSize:size}});
 assert.equal(productPreview(saved('#12')),previews['dmc:alsace:12:726']);
 assert.equal(productPreview(saved('08')),previews['dmc:alsace:8:726']);
 assert.equal(productPreview(saved('')),'');
 assert.equal(productPreview({...saved('#12'),code:'99999'}),'');
 const onlyEight=catalogue.products.find(row=>row.range.endsWith('#8')&&!previews[`dmc:alsace:12:${row.code}`]);
 assert.ok(onlyEight);
 assert.equal(productPreview({...saved('#8'),code:onlyEight.code}),previews[onlyEight.id]);
 assert.equal(productPreview({...saved('#12'),code:onlyEight.code}),'');
 assert.equal(productPreview({...saved('#12'),brand:'Anchor'}),'');
});
