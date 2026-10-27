import {validateThreadEstimateHistory} from './thread-estimate-history.mjs';
import { assert, find, quantity, audit } from './shared.mjs';
import { saveMaterial } from './inventory.mjs';
import { saveNeed, projectRevision, confirmedConsumption } from './projects.mjs';
import { convertQuantity } from './fabric.mjs';
import { estimateThreads, estimateForMaterial, threadEstimateConfiguration, archivePatternNeeds } from './estimates.mjs';
import { componentIdentity } from './thread-recipes.mjs';

export function resolveThreadMaterial(state,color) {
  let material=color.itemId?state.materials.find(row=>row.id===color.itemId):null;
  const seen=new Set();while(material?.mergedInto){assert(!seen.has(material.id),'invalid_merge');seen.add(material.id);material=state.materials.find(row=>row.id===material.mergedInto);}
  if(material && !material.archived){assert(material.category==='thread','thread_material_required');return material;}
  const matches=state.materials.filter(row=>!row.archived && row.category==='thread' && componentIdentity(row)===componentIdentity(color));
  assert(matches.length<=1,'thread_material_ambiguous');return matches[0]??null;
}
export function projectThreadContext(state,project,configuration=project.settings.thread??{}) {
  const revision=projectRevision(state,project);assert(revision,'structured_pattern_required');
  const selected=project.fabricLotId?find(state,'lots',project.fabricLotId):null,planned=project.settings.fabric??{};
  const fabric={countX:selected?selected.properties.countX:planned.countX,countY:selected?selected.properties.countY:planned.countY,
    countMeaning:selected?selected.properties.countMeaning??'stitches':planned.countMeaning??'stitches',overX:planned.overX??1,overY:planned.overY??planned.overX??1};
  assert(fabric.countX>0 && fabric.countY>0,'fabric_count_unknown');
  return {revision,fabric,configuration:threadEstimateConfiguration(configuration)};
}
export function previewProjectThreadNeeds(state,project,configuration=project.settings.thread??{}) {
  const context=projectThreadContext(state,project,configuration),estimates=estimateThreads(context.revision,{...context.configuration,...context.fabric}),grouped=new Map();
  for(const estimate of estimates)for(const component of estimate.components){
    if(component.filamentMetres<=0)continue;
    const material=resolveThreadMaterial(state,component.color),key=material?`id:${material.id}`:componentIdentity(component.color);
    if(!grouped.has(key))grouped.set(key,{key,color:component.color,material,filamentMetres:0,byType:{full:0,half:0,back:0},paletteSources:[]});
    const row=grouped.get(key);row.filamentMetres+=component.filamentMetres;for(const type of ['full','half','back'])row.byType[type]+=component.byType[type];
    row.paletteSources.push({index:estimate.index,code:estimate.color.code,symbol:estimate.color.symbol??'',blend:Boolean(estimate.color.blend),filamentMetres:component.filamentMetres,strandConfiguration:estimate.assumptions.strandConfiguration});
  }
  const rows=[...grouped.values()].map(row=>{row.filamentMetres=quantity(row.filamentMetres);return {...row,unit:row.material?.unit??'strand-m',quantity:row.material?estimateForMaterial(row,row.material):row.filamentMetres,
    manual:row.material?state.needs.some(need=>need.projectId===project.id && need.materialId===row.material.id && need.source==='manual'):false,manualQuantity:row.material?state.needs.find(need=>need.projectId===project.id && need.materialId===row.material.id && need.source==='manual')?.quantity:null};});
  return {...context,rows,method:'ricamo-geometric-v2'};
}
function actualFilamentMetres(value,material) {
  const direct=convertQuantity(value,material.unit,'strand-m',material);if(direct!==null)return direct;
  if(['cm','mm'].includes(material.unit)){const metres=convertQuantity(value,material.unit,'m',material);return metres===null?null:convertQuantity(metres,'m','strand-m',material);}
  return null;
}
export function threadCalibrationCandidate(state,project,materialId,configuration=project.settings.thread??{}) {
  assert(!project.progressHistory.some(row=>row.revisionId && row.revisionId!==project.revisionId),'calibration_revision_changed');
  const material=find(state,'materials',materialId),actualQuantity=confirmedConsumption(state,project.id,materialId),actual=actualFilamentMetres(actualQuantity,material);
  assert(actual!==null && actual>0,'calibration_consumption_unknown');
  const preview=previewProjectThreadNeeds(state,project,{...configuration,calibrationFactor:1}),row=preview.rows.find(row=>row.material?.id===materialId);
  assert(row?.filamentMetres>0,'calibration_estimate_unknown');const factor=quantity(actual/row.filamentMetres);
  assert(factor>=.1 && factor<=10,'calibration_factor_range');
  return {materialId,revisionId:project.revisionId,actualQuantity,actualUnit:material.unit,actualFilamentMetres:actual,uncalibratedFilamentMetres:row.filamentMetres,factor,scope:'all-work-for-selected-material'};
}
export function applyProjectThreadEstimate(state,payload,context) {
  const project=find(state,'projects',payload.projectId);assert(!['completed','archived'].includes(project.status),'project_closed');
  let configuration=threadEstimateConfiguration(payload.configuration??project.settings.thread??{}),calibration;
  if(payload.calibration){assert(payload.calibration.confirmedComplete===true,'calibration_confirmation_required');calibration=threadCalibrationCandidate(state,project,payload.calibration.materialId,configuration);configuration={...configuration,calibrationFactor:calibration.factor};}
  const preview=previewProjectThreadNeeds(state,project,configuration);
  archivePatternNeeds(state,project,context);
  project.settings.thread=configuration;
  for(const row of preview.rows){
    let material=row.material;
    if(!material){const id=context.id();saveMaterial(state,{id,name:row.color.name||row.color.code,category:'thread',brand:row.color.brand||'',range:row.color.range||'',code:row.color.code,color:row.color.hex,unit:'strand-m'},context);material=find(state,'materials',id);}
    const previous=state.needs.find(need=>need.projectId===project.id && need.materialId===material.id);if(previous?.source==='manual')continue;
    saveNeed(state,{projectId:project.id,materialId:material.id,quantity:estimateForMaterial(row,material),confidence:'estimated',source:'pattern'},context);
    const need=state.needs.find(need=>need.projectId===project.id && need.materialId===material.id);
    need.estimate={method:preview.method,assumptions:configuration,fabric:preview.fabric,filamentMetres:row.filamentMetres,byType:row.byType,paletteSources:row.paletteSources,revisionId:preview.revision.id,conversion:{unit:material.unit,strands:material.strands??null,quantity:need.quantity}};
  }
  project.settings.threadEstimate={method:preview.method,fabric:preview.fabric,configuration:structuredClone(configuration),revisionId:preview.revision.id,updatedAt:context.now,...(calibration?{calibration:{...calibration,confirmedComplete:true,confirmedAt:context.now}}:{})};
  if(payload.saveDefaults===true)state.settings.preferences={...state.settings.preferences,threadEstimates:structuredClone(configuration)};
  project.updatedAt=context.now;audit(state,context,'project',project.id,'thread_estimated',{method:preview.method,revisionId:preview.revision.id,materials:preview.rows.length,unknownConversions:preview.rows.filter(row=>row.quantity===null).length,calibrated:Boolean(calibration)});
}

export function validateThreadEstimateState(state) {
  if(state.settings.preferences?.threadEstimates!==undefined)threadEstimateConfiguration(state.settings.preferences.threadEstimates);
  for(const project of state.projects){
    if(project.settings.thread!==undefined)threadEstimateConfiguration(project.settings.thread);
    const receipt=project.settings.threadEstimate;
    if(receipt){assert(receipt.method==='ricamo-geometric-v2','thread_estimate_version');assert(receipt.revisionId===project.revisionId,'thread_estimate_stale');threadEstimateConfiguration(receipt.configuration);}
    validateThreadEstimateHistory(project.settings.threadEstimateHistory,{state});
  }
  return state;
}
