import { counts } from './pattern.mjs';
import { fabricSize, convertQuantity } from './fabric.mjs';
import { assert, quantity } from './shared.mjs';
import { threadComponents, boundIdentity } from './thread-recipes.mjs';

import {threadEstimateConfiguration} from './thread-estimate-config.mjs';
export {THREAD_ESTIMATE_DEFAULTS,threadEstimateConfiguration} from './thread-estimate-config.mjs';
import {validateThreadEstimateHistory} from './thread-estimate-history.mjs';

/** Versioned geometric planning estimate; each primitive uses actual whole strands. */
export function estimateThreads(revision,configuration={}) {
  const settings=threadEstimateConfiguration(configuration),countX=Number(configuration.countX),countY=Number(configuration.countY??countX);
  assert(countX>0 && countY>0,'fabric_count_unknown');
  const countMeaning=configuration.countMeaning??'stitches',overX=Number(configuration.overX??1),overY=Number(configuration.overY??overX);
  const size=fabricSize({width:revision.width,height:revision.height,countX,countY,countMeaning,overX,overY});
  const pitchX=size.widthCm/revision.width/100,pitchY=size.heightCm/revision.height/100,diagonal=Math.hypot(pitchX,pitchY);
  const extended=revision.colors.some(color=>color.materialKind==='bead');
  return counts(revision).byColor.map(row=>{
    const color=revision.colors[row.index],components=new Map(),breakdown={full:0,half:0,back:0};
    const geometry={full:row.full*(2*diagonal+(pitchX+pitchY)*settings.crossTravel),half:row.half*(diagonal+pitchY*settings.halfTravel),
      back:(revision.backstitches??[]).filter(segment=>segment.color===row.index).reduce((n,b)=>n+Math.hypot((b.x2-b.x1)*pitchX,(b.y2-b.y1)*pitchY)*settings.outlineReturn,0)};
    const bead=color.materialKind==='bead',beadCount=row.bead??0,attachment=color.attachmentThread;
    const primitiveCounts={full:row.full,half:row.half,back:row.backstitch},strandConfiguration={};
    const span=bead?Math.max(diagonal,(color.product?.beadSizeMm??0)/1000):0;
    const returnTravel=(pitchX+pitchY)*settings.crossTravel;
    if(bead){geometry.beadAttachment=beadCount*(span+returnTravel);primitiveCounts.beadAttachment=beadCount;breakdown.beadAttachment=0;}
    for(const type of bead?(attachment?['beadAttachment']:[]):['full','half','back']){
      const recipe=threadComponents(bead?attachment:color,bead?'full':type,bead?{...settings,colorStrands:undefined}:settings,row.index);strandConfiguration[type]=recipe.map(c=>({identity:boundIdentity(c),strands:c.strands}));
      if(!primitiveCounts[type])continue;
      const perFilament=(geometry[type]*(1+settings.waste/100)+Math.ceil(primitiveCounts[type]/settings.batchSize)*settings.startFinishCm/100)*settings.calibrationFactor;
      for(const component of recipe){const key=boundIdentity(component);if(!components.has(key))components.set(key,{color:component,filamentMetres:0,byType:{full:0,half:0,back:0,...(bead?{beadAttachment:0}:{})}});const record=components.get(key),amount=perFilament*component.strands;record.filamentMetres+=amount;record.byType[type]+=amount;breakdown[type]+=amount;}
    }
    const expanded=[...components.values()].map(row=>({...row,filamentMetres:quantity(row.filamentMetres),byType:Object.fromEntries(Object.entries(row.byType).map(([key,value])=>[key,quantity(value)]))}));
    return {index:row.index,color,filamentMetres:quantity(expanded.reduce((n,row)=>n+row.filamentMetres,0)),components:expanded,breakdown,confidence:'estimated',method:extended?'ricamo-geometric-v3':'ricamo-geometric-v2',...(bead?{beadCount,fasteningUnknown:beadCount>0&&!attachment}:{}),
      assumptions:{...settings,countX,countY,countMeaning,overX,overY,pitchX,pitchY,strandConfiguration,startFinishPerBatchMetres:settings.startFinishCm/100,batching:extended?'separate-full-half-back-bead':'separate-full-half-back',...(bead?{beadAttachment:{count:beadCount,spanMetres:span,returnTravelMetres:returnTravel,threadDeclared:Boolean(attachment)}}:{})}};
  });
}
export function estimateForMaterial(estimate,material) {
  const direct=convertQuantity(estimate.filamentMetres,'strand-m',material.unit,material);
  if(direct!==null)return direct;
  if(['cm','mm'].includes(material.unit)){const metres=convertQuantity(estimate.filamentMetres,'strand-m','m',material);return metres===null?null:convertQuantity(metres,'m',material.unit,material);}
  return null;
}
/** Called when revising estimates or changing their design/fabric context. */
export function archivePatternNeeds(state,project,context,reason='reestimated',include=()=>true) {
  const previous=state.needs.filter(row=>row.projectId===project.id && row.source==='pattern' && include(row));
  if(previous.length){
    const history=project.settings.threadEstimateHistory??[];
    const nextHistory=[...history,{savedAt:context.now,reason,configuration:structuredClone(project.settings.threadEstimate?.configuration??{}),
      calibration:structuredClone(project.settings.threadEstimate?.calibration??null),fabric:structuredClone(project.settings.threadEstimate?.fabric??null),needs:previous.map(row=>({materialId:row.materialId,quantity:row.quantity,unit:row.unit,revisionId:row.estimate?.revisionId??null,method:row.estimate?.method??null,filamentMetres:row.estimate?.filamentMetres??null,conversion:structuredClone(row.estimate?.conversion??null)}))}];
    validateThreadEstimateHistory(nextHistory,{state});
    project.settings.threadEstimateHistory=nextHistory;
  }else validateThreadEstimateHistory(project.settings.threadEstimateHistory,{state});
  state.needs=state.needs.filter(row=>row.projectId!==project.id || row.source!=='pattern' || !include(row));delete project.settings.threadEstimate;
}
