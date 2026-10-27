import { assert,find,identifier,quantity,text,add,subtract,audit } from './shared.mjs';
import { stockMove,setReservation } from './inventory.mjs';
import { saveNeed,confirmedConsumption } from './projects.mjs';
import { guardFabricCommand,afterFabricCommand } from './fabric-planning.mjs';
import { guardToolCommand,afterToolCommand } from './tool-activity.mjs';
import { toolHeldQuantity } from './tool-state.mjs';
import { afterEstimateCommand } from './estimate-invalidation.mjs';
import { afterKitCommand } from './kit-workflows.mjs';
export const STOCK_COUNT_LIMIT=200;

export function stockCountScope(state,{materialIds=[],category='',locationId=''}={}) {
 const inside=id=>{const seen=new Set();while(id&&!seen.has(id)){if(id===locationId)return true;seen.add(id);id=state.locations.find(row=>row.id===id)?.parentId;}return false;};
 return state.lots.filter(lot=>lot.status!=='transformed'&&(!materialIds.length||materialIds.includes(lot.materialId))&&(!category||state.materials.find(row=>row.id===lot.materialId)?.category===category)&&(!locationId||inside(lot.locationId)));
}
const countCommand=(row,reason)=>({type:'stock.move',payload:{lotId:row.lotId,kind:'count',quantity:row.observed,confidence:'exact',reason}});
export function previewStockCount(state,payload) {
 assert(payload&&Array.isArray(payload.rows)&&payload.rows.length>0&&payload.rows.length<=STOCK_COUNT_LIMIT,'count_batch_limit');
 assert(payload.rows.every(row=>row&&typeof row==='object'&&!Array.isArray(row)),'invalid_payload');
 assert(new Set(payload.rows.map(row=>row.lotId)).size===payload.rows.length,'duplicate_selection');
 const requirements=new Map();
 const rows=payload.rows.map(input=>{
  const lot=find(state,'lots',identifier(input.lotId)),material=find(state,'materials',lot.materialId),observed=quantity(input.observed),held=toolHeldQuantity(lot);
  const command=countCommand({lotId:lot.id,observed},payload.reason||'');guardFabricCommand(state,command);guardToolCommand(state,command);assert(lot.status!=='transformed','lot_transformed');
  const reservations=state.reservations.filter(row=>row.lotId===lot.id&&row.quantity>0),reserved=add(...reservations.map(row=>row.quantity));
  const capacity=lot.status==='usable'?Math.max(0,subtract(observed,held)):0,conflict=Math.max(0,subtract(reserved,capacity)),holdConflict=Math.max(0,subtract(held,lot.status==='usable'?observed:0));
  const decision=input.decision||'keep';assert(['keep','allocate'].includes(decision),'count_invalid_decision');
  const supplied=input.allocations??[];assert(Array.isArray(supplied)&&supplied.length<=1000&&supplied.every(row=>row&&typeof row==='object'&&!Array.isArray(row)),'invalid_list');assert(new Set(supplied.map(row=>row.projectId)).size===supplied.length,'duplicate_selection');
  assert(supplied.every(row=>reservations.some(reservation=>reservation.projectId===row.projectId)),'count_project_mismatch');
  const allocations=reservations.map(row=>{
   const explicit=supplied.find(value=>value.projectId===row.projectId);const after=decision==='allocate'?quantity(explicit?.quantity):row.quantity;
   assert(!material.reusable||lot.unit!=='piece'||Number.isInteger(after),'tool_whole_pieces');
   if(conflict>0){const key=JSON.stringify([row.projectId,material.id]);if(!requirements.has(key)){const existing=state.needs.find(need=>need.projectId===row.projectId&&need.materialId===material.id);const previousReserved=add(...state.reservations.filter(r=>r.projectId===row.projectId&&r.materialId===material.id).map(r=>r.quantity));requirements.set(key,{projectId:row.projectId,materialId:material.id,unit:material.unit,create:!existing,quantity:existing?existing.quantity:add(previousReserved,confirmedConsumption(state,row.projectId,material.id))});}}
   return {projectId:row.projectId,before:row.quantity,after};
  });
  const allocated=add(...allocations.map(row=>row.after));
  const problem=(conflict>0||holdConflict>0)&&!input.decision?'count_decision_required':decision==='allocate'&&(allocated>capacity||holdConflict>0)?'count_allocation_exceeds':null;
  return {lotId:lot.id,materialId:material.id,unit:material.unit,before:lot.quantity,observed,difference:lot.quantity===null?null:subtract(observed,lot.quantity),reserved,held,capacity,conflict,holdConflict,decision,allocations,conflictAfter:add(Math.max(0,subtract(allocated,capacity)),holdConflict),costUnknown:lot.cost!==null&&lot.quantity!==observed,problem};
 });
 return {revision:state.revision,rows,requirements:[...requirements.values()],ready:rows.every(row=>!row.problem)};
}
function applyStep(state,command,ctx,handler){
 guardFabricCommand(state,command);guardToolCommand(state,command);handler(state,command.payload,ctx);
 afterFabricCommand(state,command,ctx);afterToolCommand(state,command,ctx);
 // These two hooks currently return immediately for stock.move and reservation.set.
 afterEstimateCommand(state,command,ctx,state);afterKitCommand(state,command,ctx);
}
export function applyStockCount(state,payload,ctx) {
 assert(payload.previewRevision===state.revision,'inventory_preview_stale');
 const reason=text(payload.reason,'reason',{required:true,max:2000}),preview=previewStockCount(state,payload);
 assert(preview.ready,preview.rows.find(row=>row.problem)?.problem||'count_decision_required');
 // Capture demand before any row releases a reservation, including unselected lots.
 for(const need of preview.requirements.filter(row=>row.create))saveNeed(state,{projectId:need.projectId,materialId:need.materialId,quantity:need.quantity,source:'manual',confidence:'estimated'},ctx);
 for(const row of preview.rows)applyStep(state,countCommand(row,reason),ctx,stockMove);
 const changes=preview.rows.filter(row=>row.decision==='allocate').flatMap(row=>row.allocations.filter(a=>a.before!==a.after).map(a=>({...a,lotId:row.lotId})));
 // Releasing first allows an explicit redistribution without temporarily stealing stock.
 for(const change of [...changes.filter(row=>row.after<row.before),...changes.filter(row=>row.after>row.before)])applyStep(state,{type:'reservation.set',payload:{projectId:change.projectId,lotId:change.lotId,quantity:change.after}},ctx,setReservation);
 audit(state,ctx,'stock_count',ctx.id(),'applied',{reason,rows:preview.rows.map(({lotId,before,observed,decision,allocations,conflictAfter})=>({lotId,before,observed,decision,allocations,conflictAfter})),createdNeeds:preview.requirements.filter(row=>row.create)});
}
export const stockCountHandlers={'stock.countBatch':applyStockCount};
