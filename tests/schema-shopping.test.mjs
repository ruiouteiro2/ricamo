import test from 'node:test';import assert from 'node:assert/strict';
import {createState,executeCommand} from '../core/application.mjs';
import {previewSchemaPurchases,schemaSupplySource} from '../core/schema-shopping.mjs';
import {createBlank} from '../core/pattern.mjs';
import {bundledSupplierProducts} from '../core/supplier-products.mjs';
import {createBackup,inspectBackup} from '../core/backup.mjs';
import source from '../data/chart-supplies.json' with {type:'json'};
const run=(s,type,payload,id=crypto.randomUUID())=>executeCommand(s,{type,payload,operationId:id});
const selection=id=>({kind:'pattern',id,corrections:[]});
function seed(unit='skein'){let s=createState();s=run(s,'material.save',{id:'black',name:'Black',category:'thread',brand:'DMC',range:'Mouliné',code:'310',unit});s=run(s,'lot.add',{id:'one',materialId:'black',quantity:1});for(const id of ['a','b'])s=run(s,'pattern.save',{id,name:id,revision:createBlank(2,2,[],{id:'r-'+id}),library:{version:1,design:{requirements:[{name:'Black',category:'thread',brand:'DMC',range:'Mouliné',code:'310',quantity:3,unit:'skein'}]}}});return s;}
test('3 required minus 1 owned orders 2, repeated selection and operation retries never duplicate stock or purchases',async()=>{
 let s=seed();const before=structuredClone(s.lots);assert.equal(previewSchemaPurchases(s,selection('a')).rows[0].toBuy,2);
 s=run(s,'schema.purchaseMissing',selection('a'),'selected');assert.equal(s.purchases.length,1);assert.equal(s.purchases[0].quantity,2);assert.deepEqual(s.lots,before);assert.deepEqual(run(s,'schema.purchaseMissing',selection('a'),'selected'),s);
 s=run(s,'schema.purchaseMissing',selection('a'));assert.equal(s.purchases.length,1);assert.equal(Object.is(previewSchemaPurchases(s,selection('a')).rows[0].toBuy,-0),false);
 s=run(s,'schema.purchaseMissing',selection('b'));assert.equal(s.purchases.reduce((n,r)=>n+r.quantity,0),5);assert.equal(s.materials.length,1);
 const restored=await inspectBackup(await createBackup(s,[]));assert.deepEqual(restored.state.settings.preferences.schemaShopping,s.settings.preferences.schemaShopping);
});
test('missing stock gets required packs, unknown stock and incompatible units never become zero, exclusions persist',()=>{
 let s=seed();s=run(s,'lot.save',{id:'one',status:'blocked'});assert.equal(previewSchemaPurchases(s,selection('a')).rows[0].toBuy,3);
 s=run(s,'lot.add',{materialId:'black',quantity:null});let p=previewSchemaPurchases(s,selection('a'));assert.equal(p.rows[0].toBuy,null);s=run(s,'schema.purchaseMissing',selection('a'));assert.equal(s.purchases.length,0);
 let fresh=seed();fresh=run(fresh,'purchase.restock',{materialId:'black',enabled:false});fresh=run(fresh,'schema.purchaseMissing',selection('a'));assert.equal(fresh.purchases.length,0);
 let absent=createState();absent=run(absent,'pattern.save',{id:'a',name:'No stock',revision:createBlank(2,2,[],{id:'r'}),library:{version:1,design:{requirements:[{name:'Beads',category:'embellishment',brand:'Mill Hill',code:'00150',quantity:2,unit:'pack'}]}}});absent=run(absent,'schema.purchaseMissing',selection('a'));assert.equal(absent.purchases[0].quantity,2);assert.equal(absent.materials[0].code,'00150');assert.equal(absent.lots.length,0);
});
test('retailer component lists keep stated quantities, exact pack identity, and survive reselect',()=>{
 const chart=Object.entries(source.charts).find(([,c])=>c.requirements.some(r=>r.unit==='skein'&&r.quantity>=3));assert.ok(chart);const [id,definition]=chart;let s=createState();const req=definition.requirements.find(r=>r.unit==='skein'&&r.quantity>=3);
 s=run(s,'material.save',{id:'owned',name:req.name,category:req.category,brand:req.brand,range:req.range,code:req.code,unit:'skein'});s=run(s,'lot.add',{materialId:'owned',quantity:1});const preview=previewSchemaPurchases(s,{kind:'chart',id});const row=preview.rows.find(r=>r.code===req.code&&r.brand===req.brand);assert.equal(row.toBuy,row.required-1);
 s=run(s,'schema.purchaseMissing',{kind:'chart',id});assert.ok(s.purchases.length>0);const quantity=s.purchases.reduce((n,r)=>n+r.quantity,0);s=run(s,'schema.purchaseMissing',{kind:'chart',id});assert.equal(s.purchases.reduce((n,r)=>n+r.quantity,0),quantity);
 assert.equal(Object.keys(source.charts).length,482);assert.equal(Object.values(source.charts).filter(c=>c.requirements.length).length,338);assert.ok(Object.values(source.charts).every(c=>/^[a-f0-9]{64}$/.test(c.htmlSha256)));
});
test('quantities and units may be corrected without changing stock; malformed overrides reject atomically',()=>{
 let s=seed();const corrections=[{index:0,quantity:4,unit:'skein'}];s=run(s,'schema.purchaseMissing',{...selection('a'),corrections});assert.equal(s.purchases[0].quantity,3);assert.equal(s.lots[0].quantity,1);assert.equal(s.patterns[0].library.design.requirements[0].quantity,3);
 assert.throws(()=>run(s,'schema.purchaseMissing',{...selection('a'),corrections:[{index:500,quantity:3,unit:'skein'}]}));
 s=run(s,'pattern.save',{id:'a',archived:true});assert.equal(s.patterns[0].archived,true);
});

test('reserved stock is protected and incompatible package measures require verification',()=>{
 let s=seed();s=run(s,'project.save',{id:'other',name:'Other work'});s=run(s,'reservation.set',{projectId:'other',lotId:'one',quantity:1});assert.equal(previewSchemaPurchases(s,selection('a')).rows[0].toBuy,3);
 s=seed('m');const preview=previewSchemaPurchases(s,selection('a'));assert.equal(preview.rows[0].toBuy,null);const before=structuredClone(s.lots);s=run(s,'schema.purchaseMissing',selection('a'));assert.equal(s.purchases.length,0);assert.deepEqual(s.lots,before);
});
test('numeric pattern revisions estimate packs explicitly, not chart-cover pixels',()=>{
 let s=createState();const revision=createBlank(10,10,[{brand:'DMC',range:'Mouliné',code:'310',name:'Black',hex:'#000000',rgb:[0,0,0]}],{id:'numeric',settings:{strands:2,fabric:{type:'aida',countX:14,countY:14,countMeaning:'stitches',overX:1,overY:1}}});revision.cells.fill(0);s=run(s,'pattern.save',{id:'numeric',name:'Numeric',revision});const source=schemaSupplySource(s,selection('numeric'));assert.equal(source.estimated,true);assert.equal(source.requirements[0].unit,'skein');assert.equal(source.requirements[0].quantity,1);
});

test('removing a selection preserves existing cancellable orders and stock',()=>{let s=seed();s=run(s,'schema.purchaseMissing',selection('a'));const before=structuredClone(s);s=run(s,'schema.unselectShopping',selection('a'));assert.deepEqual(s.settings.preferences.schemaShopping,[]);assert.deepEqual(s.purchases,before.purchases);assert.deepEqual(s.lots,before.lots);});
