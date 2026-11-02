import test from 'node:test';
import assert from 'node:assert/strict';
import {discontinuedEntry,isDiscontinued} from '../core/discontinued-materials.mjs';
import {bundledSupplierProducts,supplierIdentity} from '../core/supplier-products.mjs';
import {productPreview} from '../src/product-previews.mjs';
import catalogue from '../data/discontinued-materials.json' with {type:'json'};
import {addZeroStockPurchases,generatePurchases,savePurchase,zeroStockPurchases} from '../core/purchasing.mjs';
import {missingMillHillArticles,millHillMaterial} from '../src/mill-hill-catalogue.mjs';

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

const shop=materials=>({materials,purchases:[],receipts:[],lots:[],reservations:[],needs:[],projects:[],suppliers:[],movements:[],audit:[],settings:{currency:'EUR'}});
const owned=(id,code)=>({id,name:code,category:'embellishment',brand:'Mill Hill',range:'Crystal Treasures',code,unit:'pack',minimum:1,properties:{}});
const context={now:'2026-11-02T00:00:00.000Z',operationId:'test',id:(()=>{let next=0;return()=>`generated-${++next}`;})()};

test('an out-of-production article cannot enter Shopping by any route',()=>{
 const state=shop([owned('old','13005'),owned('new','00143')]);
 assert.throws(()=>savePurchase(state,{materialId:'old',quantity:1,currency:'EUR'},context),{code:'material_discontinued'});
 assert.deepEqual(zeroStockPurchases(state).map(row=>row.materialId),['new']);
 addZeroStockPurchases(state,{},context);assert.deepEqual(state.purchases.map(row=>row.materialId),['new']);
});

test('an order placed before the mark stays editable',()=>{
 const state=shop([owned('old','00143')]);savePurchase(state,{materialId:'old',quantity:1,currency:'EUR'},context);
 state.materials[0].code='13005';const [order]=state.purchases;
 savePurchase(state,{...order,status:'cancelled'},context);assert.equal(state.purchases[0].status,'cancelled');
});

test('project demand skips an out-of-production article',()=>{
 const state=shop([owned('old','13005'),owned('new','00143')]);state.projects=[{id:'p',status:'active'}];state.needs=[{projectId:'p',materialId:'old',quantity:1},{projectId:'p',materialId:'new',quantity:1}];
 generatePurchases(state,{projectIds:['p']},context);assert.deepEqual(state.purchases.map(row=>row.materialId),['new']);
});

test('the catalogue list leaves out what is already in the inventory',()=>{
 const all=missingMillHillArticles([]);assert.equal(all.length,bundledSupplierProducts().filter(row=>row.id.startsWith('casa-mh-')).length);
 assert.ok(all.find(row=>row.product.code==='13005').discontinued);assert.ok(!all.find(row=>row.product.code==='00143').discontinued);
 const left=missingMillHillArticles([owned('a','00143'),{...owned('b','12143'),archived:true},{...owned('c','13005'),brand:'Altro'}]);
 assert.ok(!left.some(row=>row.product.code==='00143'));assert.ok(left.some(row=>row.product.code==='12143'));assert.ok(left.some(row=>row.product.code==='13005'));
 const button=all.find(row=>!row.product.code).product;assert.ok(!missingMillHillArticles([{...owned('d',''),properties:{product:button}}]).some(row=>row.product.id===button.id));
 const material=millHillMaterial(all.find(row=>row.product.code==='00143').product,'id');assert.equal(material.unit,'pack');assert.equal(material.name,'Mill Hill · Glass Seed Beads · 00143 · Robin Egg Blue Ceylon');
});
