import test from 'node:test';
import assert from 'node:assert/strict';
import {convertQuantity,productPackageCapacity} from '../core/fabric.mjs';
const product=(patch={})=>({category:'thread',brand:'Declared brand',range:'Declared type',code:'001',pack:{unit:'skein',lengthM:8,strands:6,divisible:true,pieces:null,weightG:null,...patch}});
test('skein conversion uses declared separable filaments; metallic decorative plies never multiply length',()=>{
 assert.equal(productPackageCapacity(product(),'strand-m'),48);
 assert.equal(productPackageCapacity(product({divisible:false,strands:6}),'strand-m'),8);
 assert.equal(productPackageCapacity(product({divisible:null,strands:6}),'strand-m'),null);
 assert.equal(productPackageCapacity(product({lengthM:null}),'strand-m'),null);
 assert.equal(convertQuantity(96,'strand-m','skein',{unit:'skein',properties:{product:product()}}),2);
 assert.equal(convertQuantity(2,'skein','strand-m',{unit:'skein',properties:{product:product()}}),96);
 assert.equal(convertQuantity(8,'m','strand-m',{unit:'m',strands:6,properties:{product:product({divisible:false})}}),8);
});
test('bead packs require an exact declared piece count; grams alone do not imply pieces',()=>{
 const bead={category:'embellishment',pack:{unit:'pack',pieces:100,weightG:5,lengthM:null,strands:null,divisible:null}};
 assert.equal(productPackageCapacity(bead,'piece'),100);
 assert.equal(convertQuantity(2,'pack','piece',{unit:'pack',product:bead}),200);
 assert.equal(convertQuantity(5,'g','piece',{unit:'g',product:bead}),null);
 assert.equal(productPackageCapacity({...bead,pack:{...bead.pack,pieces:null}},'piece'),null);
});

import {Repository} from '../desktop/repository.mjs';
import {createBlank} from '../core/pattern.mjs';
import {estimateThreads} from '../core/estimates.mjs';
import {previewPatternProcurement,ingredientStock,procurementConversionMaterial} from '../core/pattern-procurement.mjs';
import {bundledSupplierProducts,normalizeSupplierProduct} from '../core/supplier-products.mjs';
import {colorFromProduct} from '../core/pattern-materials.mjs';
import {inspectBackup} from '../core/backup.mjs';
const dmc=bundledSupplierProducts().find(row=>row.brand==='DMC'&&row.code==='310'&&row.category==='thread');
const bead=normalizeSupplierProduct({id:'synthetic-bead',supplier:'casa-cenina',category:'embellishment',type:'bead',brand:'Test bead',range:'Glass',code:'0001',name:'Synthetic measured bead',url:'https://www.casacenina.it/test-bead.html',retrievedAt:'2026-10-27T12:00:00.000Z',pack:{unit:'pack',pieces:100},beadSizeMm:4});
const cloth={countX:32,countY:32,countMeaning:'threads',overX:2,overY:2};
const geometric={waste:0,startFinishCm:0,crossTravel:0,halfTravel:0,outlineReturn:1,calibrationFactor:1};
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<.000002,`${actual} != ${expected}`);
function seed({beads=false,fastening=true,productSnapshot=true}={}){
 const repo=new Repository(':memory:'),run=(type,payload,operationId=crypto.randomUUID())=>repo.execute({type,payload,operationId},repo.load().revision);
 const thread={...colorFromProduct(dmc),symbol:'A'},colors=[thread,...(beads?[{...colorFromProduct(bead,fastening?{attachmentThread:thread}:{}),symbol:'B'}]:[])];
 if(!productSnapshot)delete colors[0].product;
 const revision=createBlank(2,2,colors,{id:'rev',settings:{fabric:cloth}});revision.cells=beads?[0,1,1,-1]:[0,0,0,0];
 run('pattern.save',{id:'pattern',name:'Synthetic fixture',revision});run('project.save',{id:'project',name:'Project',patternId:'pattern',status:'active',settings:{fabric:cloth,thread:geometric}});
 return{repo,run,revision};
}
function declared(product,quantity,unit='strand-m'){return{category:product.category,brand:product.brand,range:product.range,code:product.code,name:product.name,quantity,unit,product};}

test('real fabric pitch and Numero di fili determine filament metres, independently of package filaments',()=>{
 const {repo,revision}=seed();try{const result=estimateThreads(revision,{...cloth,...geometric})[0];const pitch=.0254/16;near(result.filamentMetres,4*2*Math.hypot(pitch,pitch)*2);revision.colors[0].strands=3;near(estimateThreads(revision,{...cloth,...geometric})[0].filamentMetres,result.filamentMetres*1.5);const planned=previewPatternProcurement(repo.load(),revision,{fabric:cloth,configuration:geometric});near(planned.fabric.size.widthCm,2/16*2.54);assert.deepEqual(planned.fabric.margins,{left:0,right:0,top:0,bottom:0});assert.equal(planned.rows[0].offers[0].capacity,48);assert.equal(planned.rows[0].offers[0].packagesRequired,1);assert.equal(planned.rows[0].stock.available,null);assert.equal(planned.rows[0].offers[0].packagesMissing,null);const project=repo.load().projects[0];const actual=previewPatternProcurement(repo.load(),revision,{project,fabric:{countX:14,countY:14}});near(actual.fabric.size.widthCm,2/16*2.54);}finally{repo.close();}
});
test('availability includes own reservations, excludes other projects and never treats progress as consumption',()=>{
 const {repo,run}=seed();try{run('material.save',{id:'thread',name:dmc.name,category:'thread',brand:dmc.brand,range:dmc.range,code:dmc.code,unit:'strand-m'});run('lot.add',{id:'lot',materialId:'thread',quantity:10});run('project.save',{id:'other',name:'Other'});run('reservation.set',{projectId:'project',lotId:'lot',quantity:2});run('reservation.set',{projectId:'other',lotId:'lot',quantity:4});const options=()=>({project:repo.load().projects.find(row=>row.id==='project'),design:{requirements:[declared(dmc,8)]}});let row=previewPatternProcurement(repo.load(),null,options()).rows[0];assert.deepEqual([row.stock.physical,row.stock.available,row.stock.ownReserved,row.stock.elsewhereReserved,row.shortage],[10,6,2,4,2]);run('project.progress',{projectId:'project',completed:['c:0','c:1','c:2','c:3']});assert.equal(previewPatternProcurement(repo.load(),null,options()).rows[0].consumed,0);run('stock.move',{kind:'consume',lotId:'lot',projectId:'project',quantity:2});row=previewPatternProcurement(repo.load(),null,options()).rows[0];assert.deepEqual([row.consumed,row.remaining,row.stock.available,row.shortage],[2,6,4,2]);run('lot.add',{id:'unknown',materialId:'thread',quantity:null});row=previewPatternProcurement(repo.load(),null,options()).rows[0];assert.equal(row.stock.available,null);assert.equal(row.stock.knownAvailable,4);assert.equal(row.shortage,null);const small=previewPatternProcurement(repo.load(),null,{...options(),design:{requirements:[declared(dmc,5)]}}).rows[0];assert.equal(small.shortage,0);}finally{repo.close();}
});
test('known SKU metadata fills a missing pack conversion without mutating inventory; conflicting packs stay unknown',()=>{
 const material={id:'m',category:'thread',brand:dmc.brand,range:dmc.range,code:dmc.code,unit:'skein',strands:null,properties:{}},copy=structuredClone(material),effective=procurementConversionMaterial(material,dmc,[dmc]);assert.equal(convertQuantity(2,'skein','strand-m',effective),96);assert.deepEqual(material,copy);
 const different={...dmc,id:'another-pack',pack:{...dmc.pack,lengthM:12}};assert.equal(procurementConversionMaterial(material,{...dmc,product:undefined},[dmc,different]),material);
 const state={lots:[{id:'lot',materialId:'m',quantity:2,status:'usable'}],reservations:[]};assert.equal(ingredientStock(state,effective,'strand-m',null).available,96);
 const zero={...state,lots:[{...state.lots[0],quantity:0}]};assert.equal(ingredientStock(zero,material,'strand-m',null).available,0);
});
test('beads are exact pieces, with explicitly chosen fastening filaments and no fabricated bead thread',()=>{
 const {repo,revision}=seed({beads:true});try{const preview=previewPatternProcurement(repo.load(),revision,{fabric:cloth,configuration:geometric}),pieces=preview.rows.find(row=>row.category==='embellishment'),thread=preview.rows.find(row=>row.category==='thread');assert.equal(pieces.required,2);assert.equal(pieces.offers[0].capacity,100);assert.equal(pieces.offers[0].packagesRequired,1);const pitch=.0254/16;near(thread.required,2*Math.hypot(pitch,pitch)*2+2*.004*2);assert.equal(preview.warnings.length,0);delete revision.colors[1].attachmentThread;const unknown=previewPatternProcurement(repo.load(),revision,{fabric:cloth,configuration:geometric});assert.equal(unknown.warnings[0].code,'procurement_fastening_unknown');near(unknown.rows.find(row=>row.category==='thread').required,2*Math.hypot(pitch,pitch)*2);assert.equal(unknown.rows.filter(row=>row.category==='thread').length,1);const fabricUnknown=previewPatternProcurement(repo.load(),revision,{fabric:{},configuration:geometric});assert.equal(fabricUnknown.rows.find(row=>row.category==='embellishment').required,2);assert.equal(fabricUnknown.rows.find(row=>row.category==='thread').required,null);}finally{repo.close();}
});
test('applying all ingredients is replay-safe, preserves manual needs, archives v3 receipts and leaves stock untouched',async()=>{
 const {repo,run}=seed({beads:true});try{const before=repo.load(),operationId=crypto.randomUUID();run('project.procurement.apply',{projectId:'project'},operationId);let after=repo.load();assert.equal(after.needs.length,2);assert.equal(after.needs.find(row=>row.unit==='piece').quantity,2);assert.ok(after.needs.every(row=>row.estimate.method==='ricamo-geometric-v3'));for(const key of ['lots','movements','reservations'])assert.deepEqual(after[key],before[key]);run('project.procurement.apply',{projectId:'project'},operationId);assert.deepEqual(repo.load(),after);const thread=after.needs.find(row=>row.unit==='strand-m');run('need.save',{id:thread.id,projectId:'project',materialId:thread.materialId,quantity:99,source:'manual'});run('project.procurement.apply',{projectId:'project'});after=repo.load();assert.equal(after.needs.find(row=>row.materialId===thread.materialId).quantity,99);assert.equal(after.projects[0].settings.threadEstimateHistory.length,1);run('project.estimate',{projectId:'project'});after=repo.load();assert.equal(after.needs.find(row=>row.unit==='piece').quantity,2,'thread settings must retain bead needs');assert.equal(after.needs.find(row=>row.materialId===thread.materialId).quantity,99);const restored=await inspectBackup(await repo.backup());assert.deepEqual(restored.state.needs,after.needs);assert.deepEqual(restored.state.projects[0].settings.threadEstimateHistory,after.projects[0].settings.threadEstimateHistory);}finally{repo.close();}
});
test('local supplier conversion used in preview is retained in persisted planning receipt',()=>{
 const {repo,run,revision}=seed({productSnapshot:false});try{run('material.save',{id:'thread',name:dmc.name,category:'thread',brand:dmc.brand,range:dmc.range,code:dmc.code,unit:'skein'});run('lot.add',{id:'lot',materialId:'thread',quantity:2});let state=repo.load();const preview=previewPatternProcurement(state,revision,{project:state.projects[0],products:[dmc]});assert.equal(preview.rows[0].stock.available,96);run('project.procurement.apply',{projectId:'project',products:[dmc]});state=repo.load();assert.ok(state.needs[0].quantity>0);assert.equal(state.needs[0].estimate.conversion.product.id,dmc.id);run('project.procurement.apply',{projectId:'project',products:[dmc]});assert.equal(repo.load().projects[0].settings.threadEstimateHistory[0].needs[0].conversion.product.id,dmc.id);}finally{repo.close();}
});

import {projectRevisionImpact} from '../core/revision-impact.mjs';
test('revision review counts physical beads and changed fastening thread separately from crosses',()=>{
 const {repo,run,revision}=seed({beads:true});try{const red=bundledSupplierProducts().find(row=>row.brand==='DMC'&&row.code==='321'&&row.category==='thread'),next=structuredClone(revision);next.id='next';next.cells[3]=1;next.colors[1].attachmentThread=colorFromProduct(red);run('pattern.save',{id:'pattern',revision:next});const impact=projectRevisionImpact(repo.load(),{id:'project',patternId:'pattern',revisionId:'next'});const beadRow=impact.materials.find(row=>row.color.materialKind==='bead');assert.equal(beadRow.beforeCounts.bead,2);assert.equal(beadRow.afterCounts.bead,3);assert.equal(beadRow.beforeEstimate.quantity,2);assert.equal(beadRow.afterEstimate.quantity,3);assert.equal(beadRow.afterEstimate.filamentMetres,null);assert.equal(beadRow.unit,'piece');const added=impact.materials.find(row=>row.color.code==='321');assert.equal(added.beforeCounts.attachment,0);assert.equal(added.afterCounts.attachment,3);assert.equal(added.beforeEstimate.quantity,0);assert.ok(added.afterEstimate.filamentMetres>0);}finally{repo.close();}
});

test('an explicitly required supplier pack stays one pack even when its bead count is unknown',()=>{
 const {repo}=seed();try{const unknown=normalizeSupplierProduct({...bead,pack:{...bead.pack,pieces:null}}),row=previewPatternProcurement(repo.load(),null,{design:{requirements:[declared(unknown,1,'pack')]}}).rows[0];assert.equal(row.required,1);assert.equal(row.unit,'pack');assert.equal(row.offers[0].capacity,null);assert.equal(row.offers[0].packagesRequired,1);assert.equal(row.offers[0].packagesMissing,null);}finally{repo.close();}
});

test('duplicate declared SKUs sum once, partial unknowns remain unknown, and incompatible units stay explicit',()=>{
 const {repo,revision}=seed({beads:true});try{const design={requirements:[declared(bead,1,'pack'),declared(bead,1,'pack')]};let result=previewPatternProcurement(repo.load(),revision,{fabric:cloth,design,configuration:geometric});let row=result.rows.find(row=>row.category==='embellishment');assert.equal(row.required,200);assert.equal(row.offers[0].packagesRequired,2);design.requirements[1].quantity=null;row=previewPatternProcurement(repo.load(),revision,{fabric:cloth,design,configuration:geometric}).rows.find(row=>row.category==='embellishment');assert.equal(row.required,null);design.requirements[1]={...declared(bead,5,'g')};result=previewPatternProcurement(repo.load(),revision,{fabric:cloth,design,configuration:geometric});row=result.rows.find(row=>row.category==='embellishment');assert.equal(row.required,null);assert.equal(row.unit,'piece');assert.deepEqual(row.declaredParts,[{quantity:1,unit:'pack'},{quantity:5,unit:'g'}]);assert.ok(result.warnings.some(row=>row.code==='procurement_unit_conflict'));
 const manual={...declared(dmc,1,'skein')};delete manual.product;const automatic=previewPatternProcurement(repo.load(),null,{design:{requirements:[manual,manual]},products:[dmc]}).rows[0];assert.equal(automatic.required,96);assert.equal(automatic.offers[0].packagesRequired,2);
 }finally{repo.close();}
});

test('generic yarn with unverified embroidery suitability produces an explicit ingredient warning',()=>{
 const {repo,revision}=seed();try{const product=normalizeSupplierProduct({...dmc,suitability:'verify-technique'});revision.colors[0]=colorFromProduct(product);const result=previewPatternProcurement(repo.load(),revision,{fabric:cloth,configuration:geometric});assert.ok(result.rows[0].required>0);assert.equal(result.warnings.find(row=>row.code==='procurement_suitability_unknown').codeName,'DMC · Mouliné · 310');}finally{repo.close();}
});

test('uncoded yarn variants use exact product identity rather than a shared generic name for stock or offers',()=>{
 const {repo,run}=seed();try{const first=normalizeSupplierProduct({...dmc,id:'uncoded-green',brand:'Synthetic yarn',range:'Wool',code:'',name:'Wool yarn',colorName:'Green',hex:null,rgbSource:null}),second=normalizeSupplierProduct({...first,id:'uncoded-blue',colorName:'Blue'});run('material.save',{id:'green',name:first.name,brand:first.brand,range:first.range,code:'',category:'thread',unit:'strand-m',properties:{product:first}});run('lot.add',{materialId:'green',quantity:100});const revision=createBlank(2,1,[colorFromProduct(first),colorFromProduct(second)]);revision.cells=[0,1];const result=previewPatternProcurement(repo.load(),revision,{fabric:cloth,configuration:geometric,products:[first,second]});assert.equal(result.rows.length,2);const green=result.rows.find(row=>row.color.product.id===first.id),blue=result.rows.find(row=>row.color.product.id===second.id);assert.equal(green.stock.available,100);assert.equal(blue.stock.available,null);assert.deepEqual(green.offers.map(row=>row.product.id),[first.id]);assert.deepEqual(blue.offers.map(row=>row.product.id),[second.id]);}finally{repo.close();}
});
