import {normalizeProjectSettings} from './thread-estimate-history.mjs';
import {assert,find} from './shared.mjs';
import {activeFabricRegions} from './fabric-state.mjs';
import {counts} from './pattern.mjs';
import {projectRevision,confirmedConsumption} from './projects.mjs';
import {componentIdentity} from './thread-recipes.mjs';
import {previewProjectThreadNeeds,createPatternMaterialResolver} from './thread-estimate-workflow.mjs';
import {physicalDesignSize,projectFabricConfig} from './design-size.mjs';
import {convertQuantity} from './fabric.mjs';
import {procurementConversionMaterial} from './pattern-procurement.mjs';
import {matchingRevisionProgress} from './revision-progress.mjs';

const total=rows=>rows.some(row=>row.quantity===null)?null:rows.reduce((sum,row)=>sum+row.quantity,0);
const emptyCounts=()=>({full:0,half:0,back:0,bead:0,attachment:0});
function usage(state,revision){
  const result=new Map();if(!revision)return result;const resolveMaterial=createPatternMaterialResolver(state);
  for(const row of counts(revision).byColor){
    const entries=[['full',row.full,row.color,'thread'],['half',row.half,row.color,'thread'],['back',row.backstitch,row.color,'thread'],['bead',row.bead??0,row.color,'embellishment']];
    if(row.color.attachmentThread)entries.push(['attachment',row.bead??0,row.color.attachmentThread,'thread']);
    for(const [type,count,source,category]of entries){
      if(!count)continue;const components=source.blend?(type==='back'?source.blend.backComponents??source.blend.components:source.blend.components):[source];
      const seen=new Set();for(const color of components){let material=null;try{material=resolveMaterial(color,category)}catch{/* Ambiguous identity remains unbound. */}
        const key=material?`id:${material.id}`:`${category==='embellishment'?'bead:':''}${componentIdentity(color)}`;if(seen.has(key))continue;seen.add(key);
        if(!result.has(key))result.set(key,{key,color,category,material,counts:emptyCounts()});result.get(key).counts[type]+=count;
      }
    }
  }return result;
}
function estimates(state,project){
  let rows,error=null;try{rows=new Map(previewProjectThreadNeeds(state,project).rows.map(row=>[row.key,row]));}catch(caught){rows=new Map();error=caught.code||caught.message||'unknown';}
  for(const row of usage(state,projectRevision(state,project)).values())if(row.category==='embellishment'){
    const material=procurementConversionMaterial(row.material,row.color);rows.set(row.key,{quantity:material?convertQuantity(row.counts.bead,'piece',material.unit,material):row.counts.bead,filamentMetres:null});
  }
  return{rows,error};
}
function dimensions(state,project,revision){if(!revision)return null;try{return physicalDesignSize(revision,projectFabricConfig(project,state.lots.find(l=>l.id===project.fabricLotId)))}catch{return null}}
/** A read-only review, not a stock, reservation or estimate command. */
export function projectRevisionImpact(state,payload){
  const before=find(state,'projects',payload.id),after={...before,...payload,settings:normalizeProjectSettings(payload.settings===undefined?before.settings:payload.settings,{state})};after.patternId=after.patternId||null;const pattern=after.patternId?find(state,'patterns',after.patternId):null;
  after.revisionId=pattern?.kind==='structured'?(after.revisionId||pattern.currentRevisionId):null;
  const changed=before.patternId!==after.patternId||before.revisionId!==after.revisionId;assert(changed,'revision_review_unchanged');
  if(after.settings.thread)delete after.settings.thread.colorStrands;
  const old=projectRevision(state,before),next=projectRevision(state,after),oldUsage=usage(state,old),newUsage=usage(state,next),oldEstimate=estimates(state,before),newEstimate=estimates(state,after);
  const needs=state.needs.filter(n=>n.projectId===before.id),reservations=state.reservations.filter(r=>r.projectId===before.id&&r.quantity>0),materialIds=new Set([...needs.map(n=>n.materialId),...reservations.map(r=>r.materialId??state.lots.find(l=>l.id===r.lotId)?.materialId),...state.movements.filter(m=>m.projectId===before.id&&['consume','kit_open'].includes(m.kind)).map(m=>m.materialId??state.lots.find(l=>l.id===m.lotId)?.materialId)]);
  const identities=new Map([...oldUsage,...newUsage]);for(const id of materialIds){if(!id)continue;const material=find(state,'materials',id);if(!identities.has(`id:${id}`))identities.set(`id:${id}`,{key:`id:${id}`,material,color:material});}
  const materials=[...identities.values()].map(identity=>{
    const key=identity.key,material=identity.material,id=material?.id,materialRelevant=identity.category==='embellishment'||!material||material.category==='thread',bead=identity.category==='embellishment',related=id?needs.filter(n=>n.materialId===id):[],held=id?reservations.filter(r=>(r.materialId??state.lots.find(l=>l.id===r.lotId)?.materialId)===id):null;
    const estimate=(data,use,revision)=>{if(!revision||!materialRelevant)return{quantity:null,filamentMetres:null};if(!use.has(key))return{quantity:0,filamentMetres:bead?null:0};const row=data.rows.get(key);return{quantity:row?.quantity??null,filamentMetres:row?.filamentMetres??null}};
    return{key,color:identity.color,materialId:id??null,name:material?.name??identity.color.name,unit:material?.unit??(bead?'piece':'strand-m'),beforeCounts:old&&materialRelevant?(oldUsage.get(key)?.counts??emptyCounts()):null,afterCounts:next&&materialRelevant?(newUsage.get(key)?.counts??emptyCounts()):null,beforeEstimate:estimate(oldEstimate,oldUsage,old),afterEstimate:estimate(newEstimate,newUsage,next),needBefore:id?total(related):null,needAfter:id?total(related.filter(n=>n.source!=='pattern')):null,removedNeeds:related.filter(n=>n.source==='pattern').length,reservations:held,consumed:id?confirmedConsumption(state,before.id,id):null};
  });
  return{stateRevision:state.revision,projectId:before.id,before:{patternId:before.patternId,revisionId:before.revisionId,name:state.patterns.find(p=>p.id===before.patternId)?.name??null,revisionName:old?.name??null,counts:old?counts(old):null,width:old?.width??null,height:old?.height??null,dimensions:dimensions(state,before,old)},after:{patternId:after.patternId,revisionId:after.revisionId,name:pattern?.name??null,revisionName:next?.name??null,counts:next?counts(next):null,width:next?.width??null,height:next?.height??null,dimensions:dimensions(state,after,next)},materials,estimateErrors:{before:oldEstimate.error,after:newEstimate.error},progress:matchingRevisionProgress(state,before,after),completed:before.completed.length,manualPercent:before.manualPercent,markers:before.view?.markers?.length??0,referenceAnnotations:(before.referenceData?.annotations?.length??0)+(before.referenceData?.bookmarks?.length??0),derivedNeeds:needs.filter(n=>n.source==='pattern').length,retainedNeeds:needs.filter(n=>n.source!=='pattern').length,reservationCount:reservations.length,fabricRegions:state.lots.flatMap(l=>activeFabricRegions(l).filter(r=>r.projectId===before.id).map(r=>({lotId:l.id,...r}))),paper:state.settings.paper,printPages:null,oldEstimateArchived:Boolean(before.settings.threadEstimate),manualForecastRetained:Boolean(before.settings.forecast?.manualRemaining)};
}
