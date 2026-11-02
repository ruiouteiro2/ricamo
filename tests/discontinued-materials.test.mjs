import test from 'node:test';
import assert from 'node:assert/strict';
import {discontinuedEntry,isDiscontinued} from '../core/discontinued-materials.mjs';
import {bundledSupplierProducts,supplierIdentity} from '../core/supplier-products.mjs';
import {productPreview} from '../src/product-previews.mjs';
import catalogue from '../data/discontinued-materials.json' with {type:'json'};

const bead=code=>({brand:'Mill Hill',range:'Crystal Treasures',code,properties:{}});
const thread=(code,range='Mouliné')=>({brand:'DMC',range,code,properties:{}});

test('declared beads and threads are out of production, with their source',()=>{
 assert.ok(isDiscontinued(bead('13005')));assert.equal(discontinuedEntry(bead('13005')).replacement,'13009');assert.match(discontinuedEntry(bead('13005')).source,/^https:/);
 assert.ok(isDiscontinued(bead('12157')));assert.ok(isDiscontinued(thread('222')));assert.equal(discontinuedEntry(thread('222')).replacement,'221');
});

test('being sold, another line or another brand is never marked',()=>{
 assert.ok(!isDiscontinued(bead('00143')));assert.ok(!isDiscontinued(thread('310')));
 assert.ok(!isDiscontinued(thread('222','Perlé')));assert.ok(!isDiscontinued({brand:'Anchor',range:'Stranded Cotton',code:'222',properties:{}}));
 assert.ok(!isDiscontinued(bead('')));assert.ok(!isDiscontinued(null));
 // The compiled list names codes still on sale: the sold catalogue wins.
 assert.ok(catalogue.contradictedBySoldCatalogue.includes('48'));assert.ok(!isDiscontinued(thread('48')));
 const sold=new Set(bundledSupplierProducts().filter(row=>row.brand==='DMC'&&row.category==='thread').map(supplierIdentity));
 for(const row of catalogue.entries.filter(entry=>entry.brand==='DMC'))assert.ok(!sold.has(supplierIdentity(row)),row.code);
});

test('a status set on the material outranks the list both ways',()=>{
 const set=(material,catalogueStatus)=>({...material,properties:{details:{version:1,catalogueStatus}}});
 assert.ok(!isDiscontinued(set(bead('13005'),'current')));assert.ok(isDiscontinued(set({brand:'Anchor',range:'Stranded Cotton',code:'403',properties:{}},'discontinued')));
});

test('out-of-production beads are selectable and show a photo where one exists',()=>{
 const products=bundledSupplierProducts().filter(row=>row.brand==='Mill Hill'&&row.id.startsWith('casa-mh-'));
 for(const row of catalogue.entries.filter(entry=>entry.brand==='Mill Hill')){const product=products.find(item=>item.code===row.code);assert.ok(product,row.code);if(row.code!=='02093')assert.ok(productPreview(product),row.code);}
});
