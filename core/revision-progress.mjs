import {isBead,materialColorIdentity} from './pattern-materials.mjs';
import {stableStringify} from './shared.mjs';
import {validateRevision} from './pattern.mjs';
import {boundIdentity,componentIdentity,threadComponents} from './thread-recipes.mjs';
import {projectFabricConfig} from './design-size.mjs';

function frame(state,project){const config=projectFabricConfig(project,state.lots.find(l=>l.id===project.fabricLotId));return stableStringify([project.fabricLotId,project.settings.fabric??{},...['countX','countY','countMeaning','overX','overY'].map(k=>config[k]??null)]);}
function indexPrimitives(revision,configuration,threadIds,beadIds){
  validateRevision(revision);const byKey=new Map(),bySignature=new Map();
  const recipes=new Map();
  const recipe=(color,type)=>{const key=`${color}:${type}`;if(!recipes.has(key)){try{const components=threadComponents(revision.colors[color],type,configuration,color);if(components.some(c=>!c.code?.trim()&&!threadIds.has(c.itemId))){recipes.set(key,null);return null;}recipes.set(key,JSON.stringify(components.map(c=>[boundIdentity(c),componentIdentity(c),c.strands,c.hex??null,c.rgb??null]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))))}catch{recipes.set(key,null)}}return recipes.get(key)};
  const add=(key,type,geometry,color)=>{const value=revision.colors[color],knownBead=value.code?.trim()||value.product?.id||beadIds.has(value.itemId);const threads=isBead(value)?(knownBead?materialColorIdentity(value):null):recipe(color,type);if(threads===null)return;const signature=JSON.stringify([type,geometry,threads]);byKey.set(key,signature);if(!bySignature.has(signature))bySignature.set(signature,[]);bySignature.get(signature).push(key)};
  revision.cells.forEach((c,i)=>{if(c>=0)add(`c:${i}`,isBead(revision.colors[c])?'bead':'full',[i%revision.width,Math.floor(i/revision.width)],c)});
  for(const h of revision.halfStitches??[])add(`h:${h.id}`,'half',[h.x,h.y,h.direction],h.color);
  for(const s of revision.backstitches??[])add(`b:${s.id}`,'back',[[s.x1,s.y1],[s.x2,s.y2]].sort((a,b)=>a[0]-b[0]||a[1]-b[1]),s.color);
  return{byKey,bySignature};
}
/** No inferred translations, manual percentages or cross-design correspondence. */
export function matchingRevisionProgress(state,before,after){
  const empty=reason=>({eligible:false,reason,completed:[],matched:0,unmatched:before.completed.length});
  if(!before.patternId||before.patternId!==after.patternId)return empty('different_pattern');
  if(frame(state,before)!==frame(state,after))return empty('different_fabric');
  const pattern=state.patterns.find(p=>p.id===before.patternId);if(pattern?.kind!=='structured')return empty('reference');
  const old=pattern.revisions.find(r=>r.id===before.revisionId),next=pattern.revisions.find(r=>r.id===after.revisionId);if(!old||!next)return empty('reference');
  const threadIds=new Set(state.materials.filter(m=>m.category==='thread').map(m=>m.id)),beadIds=new Set(state.materials.filter(m=>m.category==='embellishment').map(m=>m.id));
  const oldIndex=indexPrimitives(old,before.settings.thread??{},threadIds,beadIds),configuration={...(after.settings.thread??{})};delete configuration.colorStrands;
  const nextIndex=indexPrimitives(next,configuration,threadIds,beadIds),completed=[];
  for(const key of before.completed){const signature=oldIndex.byKey.get(key),sources=oldIndex.bySignature.get(signature),targets=nextIndex.bySignature.get(signature);if(sources?.length===1&&targets?.length===1)completed.push(targets[0]);}
  return{eligible:true,reason:null,completed,matched:completed.length,unmatched:before.completed.length-completed.length};
}
