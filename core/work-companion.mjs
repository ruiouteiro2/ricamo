import {LIMITS} from './pattern.mjs';
import {cellKind} from './pattern-materials.mjs';
import {assert,identifier,integer,text,date,oneOf,find,activeProject,jsonObject,audit} from './shared.mjs';
export const WORK_KINDS = Object.freeze(['full','half','backstitch','bead']);
export const WORK_MARKER_LIMIT = 200;
const viewportKeys = ['zoom','x','y','cursor','selectedColor','grid','symbols','monochrome','highlight','workType'];
const markerKeys = ['id','patternId','revisionId','kind','x','y','color','stitchKind','note','createdAt','updatedAt'];
const object = value => assert(value && typeof value==='object' && !Array.isArray(value),'invalid_work_view');
function exactKeys(value, keys) { object(value); assert(Object.keys(value).every(key=>keys.includes(key)),'invalid_work_view'); }
function whole(value,field,max) { if(typeof value==='number')assert(Number.isInteger(value),'invalid_integer',{field});return integer(value,field,{max}); }
function storedWhole(value,field,max) { assert(typeof value==='number','invalid_work_marker');return whole(value,field,max); }
export function scopedWorkMarker(marker) { return typeof marker?.patternId==='string' && typeof marker?.revisionId==='string'; }
export function workMarkers(view) { return view?.markers ?? []; }
export function resetWorkView(view) { return view?.workVersion===1 || workMarkers(view).length ? {workVersion:1,markers:structuredClone(workMarkers(view))}:{}; }
export function workMarkerContext(state,marker) {
  if(!scopedWorkMarker(marker))return null;
  const pattern=find(state,'patterns',marker.patternId), revision=pattern.revisions.find(row=>row.id===marker.revisionId);
  assert(pattern.kind==='structured'&&revision,'work_revision_required');
  return {pattern,revision,color:marker.color===null?null:revision.colors[marker.color]};
}
function scope(state,payload) {
  const project=find(state,'projects',payload.projectId);
  assert(payload.patternId===project.patternId&&payload.revisionId===project.revisionId,'stale_revision');
  const pattern=state.patterns.find(row=>row.id===project.patternId),revision=pattern?.revisions?.find(row=>row.id===project.revisionId);
  assert(pattern?.kind==='structured'&&revision,'work_revision_required');return{project,pattern,revision};
}
function validateMarker(state,marker) {
  object(marker);identifier(marker.id);text(marker.note,'note',{max:500});assert(typeof marker.note==='string','invalid_work_marker');
  if(!scopedWorkMarker(marker)) {
    exactKeys(marker,['id','x','y','note']);storedWhole(marker.x,'x',499);storedWhole(marker.y,'y',499);return;
  }
  exactKeys(marker,markerKeys);assert(markerKeys.every(key=>Object.hasOwn(marker,key)),'invalid_work_marker');
  const {revision}=workMarkerContext(state,marker);identifier(marker.patternId);identifier(marker.revisionId);
  oneOf(marker.kind,['bookmark','parked'],'kind');storedWhole(marker.x,'x',revision.width-1);storedWhole(marker.y,'y',revision.height-1);
  if(marker.color!==null)storedWhole(marker.color,'color',revision.colors.length-1);
  assert(marker.kind!=='parked'||marker.color!==null,'work_parked_color_required');
  if(marker.stitchKind!==null)oneOf(marker.stitchKind,WORK_KINDS,'stitchKind');
  for(const field of ['createdAt','updatedAt']){assert(typeof marker[field]==='string'&&marker[field].length,'invalid_work_marker');date(marker[field],field);}
}
export function validateWorkView(state,project) {
  const view=jsonObject(project.view,'view');
  if(view.workVersion!==undefined)assert(view.workVersion===1,'work_unsupported_version');
  let revision=null;
  if(view.patternId!==undefined||view.revisionId!==undefined){
    assert(view.workVersion===1&&view.patternId===project.patternId&&view.revisionId===project.revisionId,'stale_revision');
    ({revision}=scope(state,{projectId:project.id,patternId:view.patternId,revisionId:view.revisionId}));
  }
  if(view.workVersion===1){
    for(const field of ['zoom','x','y'])if(view[field]!==undefined){assert(typeof view[field]==='number'&&Number.isFinite(view[field]),'invalid_work_view');assert(field==='zoom'?view[field]>=1&&view[field]<=36:view[field]>=0&&view[field]<=25000,'invalid_work_view');}
    if(view.cursor!==undefined){exactKeys(view.cursor,['x','y']);storedWhole(view.cursor.x,'x',(revision?.width??500)-1);storedWhole(view.cursor.y,'y',(revision?.height??500)-1);}
    if(view.selectedColor!==undefined)storedWhole(view.selectedColor,'selectedColor',revision?Math.max(0,revision.colors.length-1):LIMITS.colors-1);
    for(const key of ['grid','symbols','monochrome','highlight'])if(view[key]!==undefined)assert(typeof view[key]==='boolean','invalid_work_view');
    if(view.workType!==undefined)oneOf(view.workType,['all',...WORK_KINDS],'workType');
  }
  const markers=workMarkers(view);assert(Array.isArray(markers)&&markers.length<=WORK_MARKER_LIMIT,'work_marker_limit');const ids=new Set();
  for(const marker of markers){validateMarker(state,marker);assert(!ids.has(marker.id),'duplicate_id');ids.add(marker.id);}
  return view;
}
export function validateWorkCompanion(state) { for(const project of state.projects)validateWorkView(state,project);return state; }
function setView(state,project,view,ctx) { validateWorkView(state,{...project,view});project.view=view;project.updatedAt=ctx.now; }
function saveView(state,p,ctx) {
  const {project}=scope(state,p);exactKeys(p.view,viewportKeys);
  setView(state,project,{...project.view,...jsonObject(p.view,'view'),workVersion:1,patternId:p.patternId,revisionId:p.revisionId},ctx);
}
function saveMarker(state,p,ctx) {
  const {project,revision}=scope(state,p);activeProject(state,project.id);exactKeys(p.marker,['id','kind','x','y','color','stitchKind','note']);
  const id=p.marker.id?identifier(p.marker.id):ctx.id(), markers=workMarkers(project.view),old=markers.find(row=>row.id===id);
  if(old){if(!scopedWorkMarker(old))assert(p.confirmAssociation===true,'work_marker_association_required');else assert(old.patternId===p.patternId&&old.revisionId===p.revisionId,'work_marker_other_revision');}
  const kind=oneOf(p.marker.kind,['bookmark','parked'],'kind');
  const color=p.marker.color===null||p.marker.color===undefined||p.marker.color===''?null:whole(p.marker.color,'color',revision.colors.length-1);
  assert(kind!=='parked'||color!==null,'work_parked_color_required');
  const marker={id,patternId:p.patternId,revisionId:p.revisionId,kind,x:whole(p.marker.x,'x',revision.width-1),y:whole(p.marker.y,'y',revision.height-1),color,
    stitchKind:p.marker.stitchKind?oneOf(p.marker.stitchKind,WORK_KINDS,'stitchKind'):null,note:text(p.marker.note,'note',{max:500}),createdAt:old?.createdAt??ctx.now,updatedAt:ctx.now};
  const next=old?markers.map(row=>row.id===id?marker:row):[...markers,marker];
  setView(state,project,{...project.view,workVersion:1,markers:next},ctx);
  audit(state,ctx,'project',project.id,old?'work_marker_updated':'work_marker_created',{markerId:id,kind,patternId:p.patternId,revisionId:p.revisionId,progressChanged:false,stockChanged:false});
}
function removeMarker(state,p,ctx) {
  const project=activeProject(state,p.projectId),markers=workMarkers(project.view);identifier(p.markerId);assert(markers.some(row=>row.id===p.markerId),'work_marker_not_found');
  setView(state,project,{...project.view,markers:markers.filter(row=>row.id!==p.markerId)},ctx);
  audit(state,ctx,'project',project.id,'work_marker_deleted',{markerId:p.markerId,progressChanged:false,stockChanged:false});
}
export const workCompanionHandlers={'project.work.view':saveView,'project.work.marker.save':saveMarker,'project.work.marker.remove':removeMarker};

const indices=new WeakMap();
function progressIndex(revision){
  let index=indices.get(revision);if(index)return index;
  const totals=revision.colors.map(()=>({full:0,half:0,backstitch:0,bead:0})),halves=new Map(),backs=new Map();
  for(const color of revision.cells)if(color>=0)totals[color][cellKind(revision.colors[color])]++;
  for(const row of revision.halfStitches??[]){totals[row.color].half++;halves.set(`h:${row.id}`,row.color)}
  for(const row of revision.backstitches??[]){totals[row.color].backstitch++;backs.set(`b:${row.id}`,row.color)}
  index={totals,halves,backs};indices.set(revision,index);return index;
}
/** Colour/type filters never enter this calculation: its denominator is real geometry. */
export function workProgress(revision,completed=[]){
  const index=progressIndex(revision),done=revision.colors.map(()=>({full:0,half:0,backstitch:0,bead:0}));
  for(const key of new Set(completed)){
    if(/^c:(0|[1-9][0-9]*)$/.test(key)){const cell=Number(key.slice(2)),color=revision.cells[cell];if(color>=0)done[color][cellKind(revision.colors[color])]++;}
    else if(index.halves.has(key))done[index.halves.get(key)].half++;
    else if(index.backs.has(key))done[index.backs.get(key)].backstitch++;
  }
  const byKind=Object.fromEntries(WORK_KINDS.map(kind=>[kind,{done:0,total:0,remaining:0}]));
  const byColor=index.totals.map((totals,color)=>{
    const kinds=Object.fromEntries(WORK_KINDS.map(kind=>{const row={done:done[color][kind],total:totals[kind],remaining:totals[kind]-done[color][kind]};for(const key of ['done','total','remaining'])byKind[kind][key]+=row[key];return[kind,row]}));
    return{color,kinds,done:Object.values(kinds).reduce((n,row)=>n+row.done,0),total:Object.values(kinds).reduce((n,row)=>n+row.total,0),remaining:Object.values(kinds).reduce((n,row)=>n+row.remaining,0)};
  });
  return{byColor,byKind,done:byColor.reduce((n,row)=>n+row.done,0),total:byColor.reduce((n,row)=>n+row.total,0),remaining:byColor.reduce((n,row)=>n+row.remaining,0)};
}
export function workMarkerReferences(view){const refs=new Map();for(const marker of workMarkers(view))if(scopedWorkMarker(marker))refs.set(`${marker.patternId}\0${marker.revisionId}`,{patternId:marker.patternId,revisionId:marker.revisionId});return[...refs.values()];}
/** Only selected immutable revisions are portable; omission reasons are explicit. */
export function portableWorkView(view,{includeMarkers=false,includePrivateNotes=false,resetProgress=false,includedRevisions=null,mapPatternId=id=>id,mapRevisionId=(_pattern,id)=>id,mapColor=(_pattern,_revision,color)=>color}={}){
  const selected=includedRevisions===null?null:new Set(includedRevisions.map(row=>`${row.patternId}\0${row.revisionId}`)),markers=[],omitted=[];
  for(const marker of workMarkers(view)){
    let reason=!includeMarkers?'not_requested':resetProgress?'new_work':!scopedWorkMarker(marker)?'unassigned':selected&&!selected.has(`${marker.patternId}\0${marker.revisionId}`)?'revision_not_selected':null;
    const patternId=reason?null:mapPatternId(marker.patternId),revisionId=reason?null:mapRevisionId(marker.patternId,marker.revisionId),color=reason||marker.color===null?null:mapColor(marker.patternId,marker.revisionId,marker.color);
    if(!reason&&(!patternId||!revisionId))reason='revision_not_selected';if(!reason&&marker.color!==null&&(color===null||color===undefined))reason='color_not_selected';
    if(reason){omitted.push({id:marker.id,reason});continue}
    markers.push({...structuredClone(marker),patternId,revisionId,color,note:includePrivateNotes?marker.note:''});
  }
  return{view:markers.length?{workVersion:1,markers}:{},omitted};
}
