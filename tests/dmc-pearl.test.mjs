import test from 'node:test';
import assert from 'node:assert/strict';
import catalogue from '../data/dmc-pearl-catalogue.json' with {type:'json'};
import previews from '../src/assets/dmc-pearl-previews.json' with {type:'json'};
import {bundledSupplierProducts,normalizeSupplierProduct} from '../core/supplier-products.mjs';
import {threadRangeMatchesSize} from '../src/inventory-navigation.mjs';
import {productPreview} from '../src/product-previews.mjs';

const image=(size,code)=>previews.images[previews.byKey[`dmc:pearl:${size}:${code}`]];

test('official DMC Coton Perlé articles are searchable by size with offline previews',()=>{
 assert.equal(catalogue.format,'ricamo-official-dmc-pearl');
 for(const raw of catalogue.products){
  const row=normalizeSupplierProduct(raw);
  assert.equal(row.brand,'DMC');assert.match(row.range,/^Perlé (?:3|5|8|12)$/);assert.ok(['skein','ball'].includes(row.pack.unit));
  assert.match(productPreview(row),/^data:image\/(?:jpeg|png|webp);base64,/);
 }
 const perle=bundledSupplierProducts().filter(row=>row.brand==='DMC'&&/^Perlé /.test(row.range));
 const pairs=perle.filter(row=>row.code).map(row=>`${row.range}:${row.code.toUpperCase()}`);
 assert.equal(new Set(pairs).size,pairs.length,'one article for each size and colour');
 for(const size of ['3','5','12'])assert.ok(perle.some(row=>row.range===`Perlé ${size}`));
 assert.deepEqual(perle.filter(row=>row.code==='52'&&threadRangeMatchesSize(row.range,'pearl','8')).map(row=>row.range),['Perlé 8']);
});

test('existing Perlé 8 offers and saved Perlé rows gain the swatch of their size without rewriting',()=>{
 const offer=bundledSupplierProducts().find(row=>row.brand==='DMC'&&row.range==='Perlé 8'&&row.code==='52');
 assert.equal(offer.supplier,'tessiland');assert.equal(offer.pack.unit,'ball');
 assert.equal(productPreview(offer),image(8,'52'));assert.ok(image(8,'52'));
 const saved=size=>({brand:'DMC',range:'Perlé',code:'52',category:'thread',properties:{threadFamily:'pearl',threadSize:size}});
 assert.equal(productPreview(saved('8')),image(8,'52'));
 assert.equal(productPreview(saved('#08')),image(8,'52'));
 assert.equal(productPreview(saved('')),'');
 assert.equal(productPreview({...saved('8'),code:'99999'}),'');
 assert.equal(productPreview({...saved('8'),brand:'Anchor'}),'');
 assert.notEqual(productPreview({brand:'DMC',range:"Coton Perlé - Retors d'Alsace #12",code:'726'}),'');
});
