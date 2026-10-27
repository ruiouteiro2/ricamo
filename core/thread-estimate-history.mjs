import {normalizeSupplierProduct} from './supplier-products.mjs';
import {assert,assertSafeJson,identifier,text,integer,quantity,date,oneOf,jsonObject} from './shared.mjs';
import {THREAD_ESTIMATE_DEFAULTS,threadEstimateConfiguration} from './thread-estimate-config.mjs';
import {UNITS} from './inventory.mjs';
const MAX_BYTES=32*1024*1024;
function object(value,allowed,required=[]){assert(value&&typeof value==='object'&&!Array.isArray(value),'thread_estimate_history');assert(Object.keys(value).every(key=>allowed.includes(key))&&required.every(key=>Object.hasOwn(value,key)),'thread_estimate_history');}
function amount(value,{positive=false}={}){assert(value===null||typeof value==='number','thread_estimate_history');return quantity(value,{nullable:!positive,positive});}
function timestamp(value,field){assert(typeof value==='string'&&value.length>0,'thread_estimate_history');date(value,field);}
function configuration(value){object(value,[...Object.keys(THREAD_ESTIMATE_DEFAULTS),'colorStrands']);if(value.colorStrands!==undefined)assert(value.colorStrands&&typeof value.colorStrands==='object'&&!Array.isArray(value.colorStrands),'thread_estimate_history');threadEstimateConfiguration(value);}
function fabric(value){if(value===null)return;object(value,['countX','countY','countMeaning','overX','overY'],['countX','countY','countMeaning','overX','overY']);quantity(value.countX,{positive:true});quantity(value.countY,{positive:true});oneOf(value.countMeaning,['stitches','threads'],'countMeaning');integer(value.overX,'overX',{min:1,max:1000});integer(value.overY,'overY',{min:1,max:1000});}
function reference(state,id){identifier(id);if(state)assert(state.has(id),'thread_estimate_history_material');}
function calibration(value,state){if(value===null)return;const fields=['materialId','revisionId','actualQuantity','actualUnit','actualFilamentMetres','uncalibratedFilamentMetres','factor','scope','confirmedComplete','confirmedAt'];object(value,fields,fields);reference(state,value.materialId);identifier(value.revisionId);amount(value.actualQuantity,{positive:true});oneOf(value.actualUnit,UNITS,'actualUnit');amount(value.actualFilamentMetres,{positive:true});amount(value.uncalibratedFilamentMetres,{positive:true});assert(typeof value.factor==='number'&&Number.isFinite(value.factor)&&value.factor>=.1&&value.factor<=10,'thread_estimate_history');assert(value.scope==='all-work-for-selected-material'&&value.confirmedComplete===true,'thread_estimate_history');timestamp(value.confirmedAt,'confirmedAt');assert(Math.abs(value.factor-quantity(quantity(value.actualFilamentMetres)/quantity(value.uncalibratedFilamentMetres)))<=.000001,'thread_estimate_history');}
function conversion(value,need){if(value===null)return;if(value.product!==undefined)normalizeSupplierProduct(value.product);object(value,['unit','strands','quantity','product'],['unit','strands','quantity']);oneOf(value.unit,UNITS,'unit');assert(value.strands===null||typeof value.strands==='number','thread_estimate_history');integer(value.strands,'strands',{nullable:true,min:1,max:1000});amount(value.quantity);assert(value.unit===need.unit&&value.quantity===need.quantity,'thread_estimate_history');}
/** Bounded derived receipts have their own structural/byte budget; never trim valid records to fit ordinary settings. */
export function validateThreadEstimateHistory(history,{state}={}){
  if(history===undefined)return;
  const materialIds=state?new Set(state.materials.map(row=>row.id)):undefined;
  assert(Array.isArray(history),'thread_estimate_history');assert(history.length<=1000,'thread_estimate_history_capacity');assertSafeJson(history);assert(new TextEncoder().encode(JSON.stringify(history)).length<=MAX_BYTES,'thread_estimate_history_capacity');
  for(const snapshot of history){object(snapshot,['savedAt','reason','configuration','calibration','fabric','needs'],['savedAt','reason','configuration','calibration','needs']);timestamp(snapshot.savedAt,'savedAt');text(snapshot.reason,'reason',{required:true,max:100});configuration(snapshot.configuration);calibration(snapshot.calibration,materialIds);if(snapshot.fabric!==undefined)fabric(snapshot.fabric);
    assert(Array.isArray(snapshot.needs)&&snapshot.needs.length<=1920,'thread_estimate_history');const materials=new Set();
    for(const need of snapshot.needs){object(need,['materialId','quantity','unit','revisionId','method','filamentMetres','conversion'],['materialId','quantity','unit','revisionId','method','filamentMetres']);reference(materialIds,need.materialId);assert(!materials.has(need.materialId),'thread_estimate_history');materials.add(need.materialId);amount(need.quantity);oneOf(need.unit,UNITS,'unit');if(need.revisionId!==null)identifier(need.revisionId);if(need.method!==null)oneOf(need.method,['ricamo-geometric-v1','ricamo-geometric-v2','ricamo-geometric-v3'],'method');amount(need.filamentMetres);if(need.conversion!==undefined)conversion(need.conversion,need);}
  }
}
export function normalizeProjectSettings(value={},options={}){
  assert(value&&typeof value==='object'&&!Array.isArray(value),'invalid_object',{field:'settings'});assertSafeJson(value);
  const {threadEstimateHistory,...ordinary}=value;const settings=jsonObject(ordinary,'settings');validateThreadEstimateHistory(threadEstimateHistory,options);
  return threadEstimateHistory===undefined?settings:{...settings,threadEstimateHistory:structuredClone(threadEstimateHistory)};
}
