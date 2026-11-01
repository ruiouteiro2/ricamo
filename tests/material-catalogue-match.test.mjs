import test from 'node:test';import assert from 'node:assert/strict';
import { catalogueCodeQuery, exactCatalogueMatch } from '../src/material-catalogue-match.mjs';
import { bundledSupplierProducts } from '../core/supplier-products.mjs';
const rows=bundledSupplierProducts();
test('Diamant code entry accepts the optional D prefix without changing digits or other ranges',()=>{
 for(const code of ['140','D140','d140','D 140','d-140',' 140 '])assert.equal(catalogueCodeQuery({brand:'DMC',family:'diamant',code}),'D140');
 assert.equal(catalogueCodeQuery({brand:'DMC',family:'diamant',code:'00140'}),'D00140');assert.equal(catalogueCodeQuery({brand:'Anchor',family:'mouline',code:'001'}),'001');assert.equal(catalogueCodeQuery({brand:'DMC',family:'mouline',code:'140'}),'140');assert.equal(catalogueCodeQuery({brand:'DMC',family:'diamant',code:''}),'');
});
test('a unique exact identity selects its official or sourced preview offer, while fuzzy/ambiguous matches stay manual',()=>{
 let match=exactCatalogueMatch(rows.filter(row=>row.range==='Diamant'),{brand:'DMC',family:'diamant',code:'140'});assert.equal(match.product.id,'dmc:diamant:D140');assert.equal(match.ambiguous,false);
 match=exactCatalogueMatch(rows.filter(row=>row.range==='Mouliné'),{brand:'DMC',family:'mouline',code:'310'});assert.equal(match.product.code,'310');assert.ok(match.product.hex);
 match=exactCatalogueMatch(rows.filter(row=>row.brand==='Madeira'),{brand:'Madeira',family:'spool',code:'4022'});assert.equal(match.product.range,'FS 40');assert.ok(match.product.hex);
 match=exactCatalogueMatch(rows.filter(row=>row.brand==='Anchor'),{brand:'Anchor',family:'mouline',code:'1'});assert.equal(match.product.code,'001');assert.ok(match.product.hex);
 assert.deepEqual(exactCatalogueMatch(rows.filter(row=>row.range==='Diamant'),{brand:'DMC',family:'diamant',code:'14'}),{product:null,ambiguous:false});assert.deepEqual(exactCatalogueMatch(rows,{brand:'DMC',family:'mouline',code:'UNKNOWN'}),{product:null,ambiguous:false});
 const alternatives=[{brand:'Test',range:'Pearl 5',code:'001'},{brand:'Test',range:'Pearl 8',code:'001'}];assert.deepEqual(exactCatalogueMatch(alternatives,{brand:'Test',family:'pearl',code:'001'}),{product:null,ambiguous:true});assert.deepEqual(exactCatalogueMatch(alternatives,{brand:'Other',family:'pearl',code:'001'}),{product:null,ambiguous:false});
});
