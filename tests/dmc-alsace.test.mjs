import test from 'node:test';
import assert from 'node:assert/strict';
import catalogue from '../data/dmc-alsace-catalogue.json' with {type:'json'};
import previews from '../src/assets/dmc-alsace-previews.json' with {type:'json'};
import {bundledSupplierProducts,normalizeSupplierProduct} from '../core/supplier-products.mjs';
import {threadRangeMatchesSize} from '../src/inventory-navigation.mjs';
import {productPreview,sameColourSwatch} from '../src/product-previews.mjs';

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

test('a size without its own article borrows the same colour, never another code',()=>{
 assert.deepEqual(Object.keys(previews).filter(key=>key.endsWith(':211')),['dmc:alsace:8:211']);
 const swatch=sameColourSwatch({family:'alsace',size:'#12',code:'211'});
 assert.equal(swatch.image,previews['dmc:alsace:8:211']);assert.equal(swatch.line,'alsace');assert.equal(swatch.size,8);
 assert.equal(sameColourSwatch({family:'alsace',size:'12',code:'99999'}),null);
 assert.equal(sameColourSwatch({family:'alsace',size:'',code:'211'}),null);
 assert.equal(sameColourSwatch({family:'wool',size:'12',code:'211'}),null);
 const elsewhere=sameColourSwatch({family:'pearl',size:'12',code:'4010'});
 assert.ok(elsewhere);
 const sizes={};for(const key of Object.keys(previews)){const[,,size,code]=key.split(':');(sizes[code]??=[]).push(previews[key]);}
 for(const images of Object.values(sizes))assert.equal(new Set(images).size,1,'each colour keeps one photo across sizes');
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
 assert.equal(productPreview({...saved('#12'),code:onlyEight.code}),previews[onlyEight.id]);
 assert.equal(productPreview({...saved('#12'),brand:'Anchor'}),'');
});
