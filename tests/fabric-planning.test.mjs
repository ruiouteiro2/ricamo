import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, executeCommand } from '../core/application.mjs';
import { inventorySummary } from '../core/inventory.mjs';
import { shoppingNeeds } from '../core/purchasing.mjs';
import { validateFabricPlanning, previewFabricCut, fabricProjectFit, fabricCutDependencies, toCentimetres, rectanglesOverlap } from '../core/fabric-planning.mjs';
let serial = 0;
const id = () => `id-${++serial}`;
function execute(state, type, payload, operationId = id()) {
  const command = { type, payload, operationId }, context = { now: '2026-10-27T10:00:00.000Z', id };
  return executeCommand(state, command, context);
}
function fixture(cost = 101) {
  let s = createState();
  s = execute(s, 'material.save', { id: 'cloth', name: 'Aida', category: 'fabric', unit: 'piece' });
  s = execute(s, 'lot.add', { id: 'source', materialId: 'cloth', quantity: 1, cost, properties: { widthCm: 100, heightCm: 80, countX: 14, countY: 14, countMeaning: 'stitches', irregular: false } });
  s = execute(s, 'project.save', { id: 'project-a', name: 'Rose' });
  s = execute(s, 'project.save', { id: 'project-b', name: 'Iris' });
  return s;
}
const reserve = (s, p={}) => execute(s, 'fabric.region.reserve', {lotId:'source',projectId:'project-a',x:10,y:10,width:20,height:20,...p});
const cut = (s, p={}) => execute(s,'fabric.plan.cut',{lotId:'source',x:10,y:10,width:20,height:20,...p});
const code = expected => error => error.code === expected;
const stockArea = s => s.lots.filter(l=>l.status!=='transformed'&&l.quantity===1).reduce((n,l)=>n+l.properties.widthCm*l.properties.heightCm,0);

test('Unit normalization, rotation and dry-run exact partition leave input unchanged',()=>{
 const s=fixture(),before=JSON.stringify(s),lot=s.lots[0];
 assert.equal(toCentimetres('1,5','m'),150);assert.equal(toCentimetres(1,'in'),2.54);assert.equal(toCentimetres(15,'mm'),1.5);
 const preview=previewFabricCut(lot,{x:10,y:5,width:20,height:30,rotated:true,discardRemnants:['top']});
 assert.equal(preview.requested.widthCm,30);assert.equal(preview.requested.heightCm,20);assert.equal(preview.rectangles.reduce((n,r)=>n+r.areaCm2,0),8000);assert.equal(preview.wasteCm2,500);assert.equal(JSON.stringify(s),before);
 assert.throws(()=>previewFabricCut(lot,{x:99,width:2,height:1}),code('cut_outside_fabric'));
 assert.throws(()=>toCentimetres(1,'yards'),code('invalid_choice'));
});
test('Region reservation retains physical stock, edge contact allowed; overlap and rotated overlap rejected',()=>{
 let s=reserve(fixture()); assert.equal(s.lots[0].quantity,1);assert.equal(s.reservations.length,0);
 s=reserve(s,{projectId:'project-b',x:30,y:10}); assert.equal(s.lots[0].fabricPlan.regions.length,2);
 assert.throws(()=>reserve(s,{projectId:'project-b',x:29,y:10,width:10,height:5,rotated:true}),code('fabric_region_overlap'));
 assert.throws(()=>reserve(s,{x:90,width:20}),code('fabric_region_outside_usable'));
 assert.equal(rectanglesOverlap({xCm:0,yCm:0,widthCm:5,heightCm:5},{xCm:5,yCm:0,widthCm:5,heightCm:5}),false);
});
test('Whole-piece and region reservations exclude each other, unknown/grouped pieces are not region reservable',()=>{
 const s=reserve(fixture());assert.throws(()=>execute(s,'reservation.set',{lotId:'source',projectId:'project-a',quantity:1}),code('fabric_regions_active'));
 const whole=execute(fixture(),'reservation.set',{lotId:'source',projectId:'project-a',quantity:1});assert.throws(()=>reserve(whole),code('fabric_whole_piece_reserved'));
 let changed=execute(fixture(),'stock.move',{lotId:'source',kind:'count',quantity:2});assert.throws(()=>reserve(changed),code('fabric_piece_unavailable'));
 changed=fixture();changed.lots[0].quantity=null;changed.lots[0].confidence='unknown';assert.throws(()=>reserve(changed),code('fabric_piece_unavailable'));
});
test('All movements/legacy cutting and dimension edits blocked while regions active; release owner required',()=>{
 const s=reserve(fixture()),region=s.lots[0].fabricPlan.regions[0];
 for(const kind of ['transfer','consume','count','loss','receipt','discard','return'])assert.throws(()=>execute(s,'stock.move',{lotId:'source',kind,quantity:1}),code('fabric_regions_active'));
 assert.throws(()=>execute(s,'fabric.cut',{lotId:'source',widthCm:10,heightCm:10}),code('fabric_use_planner'));
 assert.throws(()=>execute(s,'lot.save',{id:'source',properties:{widthCm:200,heightCm:100}}),code('fabric_regions_active'));
 assert.throws(()=>execute(s,'fabric.region.release',{lotId:'source',id:region.id,projectId:'project-b'}),code('fabric_region_owner'));
 const next=execute(s,'fabric.region.release',{lotId:'source',id:region.id,projectId:'project-a'});assert.equal(next.lots[0].fabricPlan.regions[0].status,'released');assert.equal(next.lots[0].quantity,1);
});
test('Project close releases only owning regions atomically and cannot be bypassed by project.save',()=>{
 let s=reserve(fixture());s=reserve(s,{projectId:'project-b',x:40});
 assert.throws(()=>execute(s,'project.save',{id:'project-a',status:'completed'}),code('close_project_first'));
 s=execute(s,'project.close',{projectId:'project-a'});assert.deepEqual(s.lots[0].fabricPlan.regions.map(r=>r.status),['released','active']);assert.equal(s.lots[0].quantity,1);
});
test('Cut refuses other regions; single claim becomes project child reservation; partition/cost conserved',()=>{
 let s=reserve(fixture());const region=s.lots[0].fabricPlan.regions[0];const multi=reserve(s,{projectId:'project-b',x:40});
 assert.throws(()=>cut(multi,{regionId:region.id}),code('fabric_other_regions'));
 assert.throws(()=>cut(s),code('fabric_other_regions'));
 s=cut(s,{regionId:region.id});const c=s.cuts[0],output=s.lots.find(l=>l.id===c.pieceIds[0]);
 assert.equal(s.lots[0].quantity,0);assert.equal(s.lots[0].status,'transformed');assert.equal(s.lots[0].fabricPlan.regions[0].status,'cut');assert.equal(s.projects[0].fabricLotId,output.id);assert.equal(s.reservations.find(r=>r.lotId===output.id).quantity,1);
 assert.equal(stockArea(s),8000);assert.equal(s.lots.reduce((n,l)=>n+l.cost,0),101);assert(c.pieceIds.every(id=>!s.lots.find(l=>l.id===id).fabricPlan));
});
test('Waste is explicit, real remnants retained, exact expense-cent conservation including tiny costs',()=>{
 for(const amount of [0,1,2,3,101,999999]) {
  const s=cut(fixture(amount),{discardRemnants:['top','left']});const c=s.cuts[0];
  assert.equal(c.wasteCm2,1200);assert.equal(stockArea(s)+c.wasteCm2,8000);assert.equal(s.lots.reduce((n,l)=>n+l.cost,0)+c.planning.wasteCost,amount);
  assert.equal(s.movements.filter(m=>m.kind==='cut_waste').length,2);
 }
 const unknown=cut(fixture(null),{discardRemnants:['top']});assert.equal(unknown.cuts[0].planning.wasteCost,null);
});
test('Undo before use restores source, retires children, appends corrections and is idempotent',()=>{
 let s=cut(fixture(101),{discardRemnants:['top']});const c=s.cuts[0],old=s.movements.length,payload={cutId:c.id,reason:'Cut was not actually made'};
 assert.deepEqual(fabricCutDependencies(s,c.id),[]);s=execute(s,'fabric.cut.reverse',payload,'undo-op');
 assert.equal(s.lots[0].quantity,1);assert.equal(s.lots[0].cost,101);assert.equal(stockArea(s),8000);assert.equal(s.lots.reduce((n,l)=>n+l.cost,0),101);assert(c.pieceIds.every(id=>s.lots.find(l=>l.id===id).status==='transformed'));assert(s.movements.length>old);assert.equal(s.cuts.length,1);assert(s.cuts[0].reversed);
 assert.deepEqual(execute(s,'fabric.cut.reverse',payload,'undo-op'),s);assert.throws(()=>execute(s,'fabric.cut.reverse',payload),code('fabric_undo_blocked'));
});
test('Auto reservation must be released before undo, source claims not silently reactivated',()=>{
 let s=reserve(fixture());const region=s.lots[0].fabricPlan.regions[0];s=cut(s,{regionId:region.id});const c=s.cuts[0];
 assert(fabricCutDependencies(s,c.id).some(x=>x.code==='fabric_undo_reserved'));
 s=execute(s,'reservation.set',{lotId:c.pieceIds[0],projectId:'project-a',quantity:0});s=execute(s,'fabric.cut.reverse',{cutId:c.id,reason:'Physical correction'});
 assert.equal(s.lots[0].fabricPlan.regions[0].status,'released');assert.equal(s.projects[0].fabricLotId,null);
});
test('Undo rejected after consume/reversal, transfer, edit/revert, downstream cut or reservation',()=>{
 const base=cut(fixture());const c=base.cuts[0],child=c.pieceIds[0];
 const variants=[
  execute(base,'stock.move',{lotId:child,kind:'consume',quantity:1}),
  execute(base,'lot.save',{id:child,notes:'Touched'}),
  execute(base,'reservation.set',{lotId:child,projectId:'project-a',quantity:1}),
  execute(base,'fabric.plan.cut',{lotId:child,x:0,y:0,width:5,height:5}),
 ];
 let moved=execute(base,'location.save',{id:'box',name:'Box'});moved=execute(moved,'stock.move',{lotId:child,kind:'transfer',toLocationId:'box'});variants.push(moved);
 const consumed=variants[0],m=consumed.movements.find(m=>m.kind==='consume');variants.push(execute(consumed,'stock.reverse',{movementId:m.id,reason:'Correction'}));
 const edited=execute(variants[1],'lot.save',{id:child,notes:''});variants.push(edited);
 for(const s of variants)assert.throws(()=>execute(s,'fabric.cut.reverse',{cutId:c.id,reason:'Undo'}),code('fabric_undo_blocked'));
});
test('Usable borders and real anisotropic count govern project dimensions and rotated fit',()=>{
 let s=fixture();s=execute(s,'fabric.plan.save',{lotId:'source',width:50,height:20,countX:10,countY:20,countMeaning:'threads',usableMargins:{left:2,right:3,top:1,bottom:1},washState:'prewashed'});
 const lot=s.lots[0];let fit=fabricProjectFit(lot,{width:300,height:50},{overX:1,overY:1,margins:{left:2,right:2,top:1,bottom:1}});
 assert.equal(fit.candidates[1].widthCm,12.7);assert.equal(fit.fits,false); // rotated 12.7 by38.1 plus margins exceeds usable18cm height
 fit=fabricProjectFit(lot,{width:100,height:50},{margins:{left:2,right:2,top:1,bottom:1}});assert.equal(fit.fits,true);assert.equal(fit.widthCm,25.4);
 const rotated=fabricProjectFit({...lot,properties:{...lot.properties,widthCm:20,heightCm:40}},{width:100,height:50},{margins:{left:2,right:2,top:1,bottom:1}});assert.equal(rotated.fits,true);assert.equal(rotated.rotated,true);
 assert.throws(()=>reserve(s,{x:0,y:0,width:5,height:5}),code('fabric_region_outside_usable'));
});
test('Irregular/defective bounding rectangles stay manual and need explicit region confirmation',()=>{
 let s=fixture();s=execute(s,'fabric.plan.save',{lotId:'source',irregular:true,geometryNotes:'Missing corner'});
 assert.equal(fabricProjectFit(s.lots[0],{width:50,height:50}).fits,null);assert.throws(()=>reserve(s),code('fabric_manual_confirmation'));s=reserve(s,{manualConfirmed:true});assert.equal(s.lots[0].quantity,1);assert.throws(()=>cut(s,{regionId:s.lots[0].fabricPlan.regions[0].id}),code('manual_geometry'));
});
test('Deep validator rejects restored overlaps, whole-piece conflict, receipt tampering and future schema',()=>{
 let s=reserve(fixture());const region=s.lots[0].fabricPlan.regions[0];s.lots[0].fabricPlan.regions.push({...region,id:'other',projectId:'project-b'});assert.throws(()=>validateFabricPlanning(s),code('fabric_region_overlap'));
 s=reserve(fixture());s.lots[0].fabricPlan.schemaVersion=2;assert.throws(()=>validateFabricPlanning(s),code('fabric_plan_version'));
 s=cut(fixture());s.cuts[0].planning.sourceBefore.cost+=1;assert.throws(()=>validateFabricPlanning(s),code('fabric_cost_mismatch'));
});
test('Replay remains idempotent after source transformation; stale region geometry cannot be cut',()=>{
 const payload={lotId:'source',projectId:'project-a',x:10,y:10,width:20,height:20};
 let s=execute(fixture(),'fabric.region.reserve',payload,'reserve-once');const region=s.lots[0].fabricPlan.regions[0];
 assert.throws(()=>cut(s,{regionId:region.id,width:10}),code('fabric_region_changed'));
 s=cut(s,{regionId:region.id});assert.deepEqual(execute(s,'fabric.region.reserve',payload,'reserve-once'),s);
});
test('Receipt material identity and geometry cannot be forged for reversal',()=>{
 let s=cut(fixture());s.cuts[0].planning.outputs[0].materialId='other';assert.throws(()=>validateFabricPlanning(s),code('fabric_invalid_receipt'));
 s=cut(fixture());s.cuts[0].planning.rectangles[0].widthCm=-1;assert.throws(()=>validateFabricPlanning(s));
 s=cut(fixture());s.cuts[0].planning.sourceBefore=null;assert.throws(()=>validateFabricPlanning(s),code('fabric_invalid_receipt'));
});

test('Integrated availability and shopping never count a region-held source as a free whole piece',()=>{
 let s=reserve(fixture());s=execute(s,'need.save',{projectId:'project-a',materialId:'cloth',quantity:1});
 const summary=inventorySummary(s,'cloth');assert.equal(summary.knownPhysical,1);assert.equal(summary.available,0);assert.equal(summary.regionHeld,1);
 const needs=shoppingNeeds(s,['project-a'])[0];assert.equal(needs.eligibleForGroup,0);assert.equal(needs.free,0);
});
