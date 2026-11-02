import test from 'node:test';
import assert from 'node:assert/strict';
import catalogue from '../data/dmc-colbert-catalogue.json' with {type:'json'};
import previews from '../src/assets/dmc-colbert-previews.json' with {type:'json'};
import {bundledSupplierProducts,normalizeSupplierProduct} from '../core/supplier-products.mjs';
import {productPreview} from '../src/product-previews.mjs';

test('official DMC Colbert variants are searchable with offline previews',()=>{
 assert.equal(catalogue.format,'ricamo-official-dmc-colbert');
 assert.equal(catalogue.sourceUrl,'https://www.dmc.com/FR/fr/api/quilt/products/colbert-wool/product_data');
 assert.equal(catalogue.productUrl,'https://www.dmc.com/FR/fr/products/dmc-wool-tapestry/colbert-wool');
 assert.equal(catalogue.products.length,414);
 assert.equal(new Set(catalogue.products.map(row=>row.code)).size,414);
 assert.equal(Object.keys(previews).length,414);
 for(const raw of catalogue.products){
  const row=normalizeSupplierProduct(raw);
  assert.equal(row.brand,'DMC');assert.equal(row.range,'Laine Colbert');assert.equal(row.type,'wool');
  assert.equal(row.pack.unit,'skein');assert.equal(row.pack.lengthM,8);assert.equal(row.hex,null);
  assert.match(previews[row.id],/^data:image\/(?:jpeg|png|webp);base64,/);
  assert.equal(productPreview(row),previews[row.id]);
 }
 const bundled=bundledSupplierProducts().filter(row=>row.brand==='DMC'&&row.range==='Laine Colbert');
 assert.equal(bundled.length,414);
 assert.ok(bundled.some(row=>row.code==='7003'));
 assert.ok(bundled.some(row=>row.code==='CB724'));
});

test('existing Mouliné lanato records reuse exact Colbert previews without rewriting inventory',()=>{
 for(const code of ['7444','7727','7971','7439']){
  const material={brand:'DMC',range:'Mouliné lanato',code,properties:{threadFamily:'wool'}};
  assert.equal(productPreview(material),previews[`dmc:colbert:${code}`]);
 }
 assert.equal(productPreview({brand:'DMC',range:'Mouliné lanato',code:'7445',properties:{threadFamily:'wool'}}),'');
 assert.equal(productPreview({brand:'DMC',range:'Mouliné',code:'7444',properties:{threadFamily:'mouline'}}),'');
});
