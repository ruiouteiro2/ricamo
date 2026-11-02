import test from 'node:test';
import assert from 'node:assert/strict';
import {INVENTORY_GROUPS,MILL_HILL_LINES,threadReferenceFor} from '../src/inventory-navigation.mjs';
import {purchaseUrl} from '../core/pattern-fabric.mjs';
import {bundledSupplierProducts,validateSupplierMaterial} from '../core/supplier-products.mjs';
import {exactCatalogueMatch} from '../src/material-catalogue-match.mjs';
import {productPreview} from '../src/product-previews.mjs';
import previews from '../src/assets/mill-hill-previews.json' with {type:'json'};
import catalogue from '../data/mill-hill-catalogue.json' with {type:'json'};
import sources from '../data/casa-millhill-preview-sources.json' with {type:'json'};

const URL='https://www.casacenina.it/mill-hill/?filter_id=8';
const articles=bundledSupplierProducts().filter(row=>row.id.startsWith('casa-mh-'));

test('Mill Hill beads carry the requested Casa Cenina reference',()=>{
 const child=INVENTORY_GROUPS.find(group=>group.id==='beads').children.find(row=>row.brand==='Mill Hill');
 assert.equal(child.reference.url,URL);assert.equal(threadReferenceFor(child,'mouline').url,URL);assert.equal(purchaseUrl(URL),URL);
});

test('every Mill Hill article shows its own photo offline',()=>{
 assert.ok(articles.length>=995);assert.equal(articles.length,catalogue.products.length);assert.deepEqual(sources.missing,[]);
 // Sold-out cards have no cart button: they must be neither lost nor merged with their neighbour.
 for(const code of ['02098','11001','13001','13105','13005'])assert.ok(articles.some(row=>row.code===code),code);
 const scarlet=articles.find(row=>row.code==='13105');assert.equal(scarlet.range,'Crystal Treasures');assert.equal(scarlet.id,'casa-mh-130545');
 const withoutPhoto=articles.filter(row=>!productPreview(row)).map(row=>row.code);assert.deepEqual(withoutPhoto,['02093']);
 for(const row of articles)if(previews.byUrl[row.url])assert.equal(productPreview(row),previews.images[previews.byUrl[row.url]],row.url);
 assert.notEqual(productPreview(articles.find(row=>row.code==='00143')),productPreview(articles.find(row=>row.code==='12143')));
});

test('the type menu lists exactly the catalogue lines',()=>{
 assert.deepEqual(new Set(articles.map(row=>row.range)),new Set(MILL_HILL_LINES));assert.equal(new Set(MILL_HILL_LINES).size,MILL_HILL_LINES.length);
});

test('a bead code selects one article whichever line is showing',()=>{
 const coded=articles.filter(row=>row.code);assert.equal(new Set(coded.map(row=>row.code)).size,coded.length);
 for(const row of coded){assert.match(row.code,/^\d{5}$/);const match=exactCatalogueMatch(articles,{brand:'Mill Hill',family:'mouline',code:row.code});assert.equal(match.product?.id,row.id);assert.equal(match.ambiguous,false);}
 const blue=articles.find(row=>row.code==='00143');assert.equal(blue.range,'Glass Seed Beads');assert.equal(blue.colorName,'Robin Egg Blue Ceylon');assert.equal(blue.pack.unit,'pack');
});

test('a saved Mill Hill row keeps its photo and stays a valid catalogue material',()=>{
 const blue=articles.find(row=>row.code==='00143'),button=articles.find(row=>!row.code);
 for(const row of [blue,button]){const saved={brand:'Mill Hill',range:row.range,code:row.code,category:'embellishment',properties:{product:row}};assert.equal(validateSupplierMaterial(saved).id,row.id);assert.equal(productPreview(saved),productPreview(row));}
 assert.equal(productPreview({brand:'Mill Hill',range:'Glass Seed Beads',code:'00143',category:'embellishment',properties:{}}),productPreview(blue));
 assert.equal(productPreview({brand:'Mill Hill',range:'Glass Seed Beads',code:'99999',category:'embellishment',properties:{}}),'');
 assert.notEqual(productPreview({brand:'Other',range:'Glass Seed Beads',code:'00143',category:'embellishment',properties:{}}),productPreview(blue));
});
