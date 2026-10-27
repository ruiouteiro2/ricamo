import { portableWorkView, workMarkers, workMarkerReferences, scopedWorkMarker } from './work-companion.mjs';
import { portableMaterialDescriptors, hasPrivateMaterialDescriptors } from './material-descriptors.mjs';
import { portableRevision, remapPortableRevision, colorMaterialIds, validatePortableRevision } from './project-portable-pattern.mjs';
import { portablePlanningSettings, portableFabricPlan, portableFabricSettings, validatePortablePlanningSettings } from './project-portable-settings.mjs';
import { createState, validateApplicationState } from './application.mjs';
import { assert, assertSafeJson, identifier, text, quantity, add } from './shared.mjs';
import { validateRevision } from './pattern.mjs';
import { validProgressKeys, saveProject, saveNeed, saveTask, saveSession } from './projects.mjs';
import { saveMaterial } from './inventory.mjs';
import { validateReferenceData } from './references.mjs';
import { BACKUP_LIMIT, digestBytes, bytesToBase64, base64ToBytes, detectFile, boundedBytes, safeDisplayName } from './files.mjs';

export const PROJECT_METADATA_LIMIT=8*1024*1024;
const EMPTY_COLLECTIONS=['lots','movements','reservations','purchases','receipts','locations','suppliers','cuts','kitOpenings','audit','operations'];
const clone=value=>structuredClone(value);
const pick=(value,keys)=>Object.fromEntries(keys.filter(key=>value?.[key]!==undefined).map(key=>[key,clone(value[key])]));
const builtins=new Set(['thread','fabric','tool','storage','preparation','stabilizer','embellishment','finishing','kit','reference','other']);
function optionsFor(options={}) {
  const values={includeRecipient:options.includeRecipient===true,includePrivateNotes:options.includePrivateNotes===true,includeSessions:options.includeSessions===true,includeSessionNotes:options.includeSessions===true&&options.includeSessionNotes===true,includeHistory:options.includeHistory===true,includeMarkers:options.includeMarkers===true,attachmentIds:options.attachmentIds??[]};
  assert(Array.isArray(values.attachmentIds)&&values.attachmentIds.length<=1000,'project_package_assets');values.attachmentIds.forEach(identifier);return values;
}
function portableReference(value,includePrivateNotes) {
  if(!value)return undefined;
  validateReferenceData(value);
  return {version:1,attachmentId:value.attachmentId,pageCount:value.pageCount,view:pick(value.view,['page','zoom','rotation','scrollX','scrollY']),annotations:value.annotations.filter(mark=>includePrivateNotes||mark.type!=='text').map(mark=>({...pick(mark,['id','page','type','x','y','x2','y2','width','height','color','opacity']),text:includePrivateNotes?mark.text||'':''})),bookmarks:includePrivateNotes?value.bookmarks.map(mark=>pick(mark,['id','page','x','y','label'])):[]};
}
function subsetFor(state,projectId,rawOptions={}) {
  validateApplicationState(state);const options=optionsFor(rawOptions),source=state.projects.find(row=>row.id===projectId);assert(source,'not_found');
  const subset=createState();subset.settings=pick(state.settings,['language','currency','paper']);
  const project=pick(source,['id','name','technique','priority','status','dueDate','completedAt','patternId','revisionId','currency','completed','manualPercent','createdAt','updatedAt']);
  Object.assign(project,{description:options.includePrivateNotes?source.description:'',notes:options.includePrivateNotes?source.notes:'',recipient:options.includeRecipient?source.recipient:'',budget:options.includePrivateNotes?source.budget:null,tags:options.includePrivateNotes?[...source.tags]:[],fabricLotId:null,attachments:[],view:{},settings:portablePlanningSettings(source.settings,options),progressHistory:[]});
  if(source.referenceData)project.referenceData=portableReference(source.referenceData,options.includePrivateNotes);
  const requiredPatterns=new Map();
  const requirePattern=(patternId,revisionId)=>{if(!patternId)return;const pattern=state.patterns.find(row=>row.id===patternId);assert(pattern,'broken_reference');if(!requiredPatterns.has(patternId))requiredPatterns.set(patternId,new Set());if(pattern.kind==='structured'){assert(pattern.revisions.some(row=>row.id===revisionId),'revision_not_found');requiredPatterns.get(patternId).add(revisionId);}};
  requirePattern(project.patternId,project.revisionId);
  if(options.includeMarkers)for(const marker of workMarkerReferences(source.view))requirePattern(marker.patternId,marker.revisionId);
  if(options.includeHistory){assert(source.progressHistory.length<=1000,'project_package_history');project.progressHistory=source.progressHistory.map(history=>{requirePattern(history.patternId,history.revisionId);return {...pick(history,['patternId','revisionId','completed','manualPercent','savedAt']),...(history.referenceData?{referenceData:portableReference(history.referenceData,options.includePrivateNotes)}:{})};});}
  const selectedAttachments=new Set(options.attachmentIds),allowedAttachments=new Set(source.attachments),requiredAttachments=new Set(),materialIds=new Set();
  subset.needs=state.needs.filter(row=>row.projectId===projectId).map(row=>{materialIds.add(row.materialId);return {...pick(row,['id','projectId','materialId','quantity','unit','source','confidence','createdAt','updatedAt']),notes:options.includePrivateNotes?row.notes:''};});
  subset.tasks=state.tasks.filter(row=>row.projectId===projectId).map(row=>({...pick(row,['id','projectId','title','stage','done','order','dueDate','createdAt','updatedAt']),notes:options.includePrivateNotes?row.notes:''}));
  if(options.includeSessions)subset.sessions=state.sessions.filter(row=>row.projectId===projectId).map(row=>{row.attachments.forEach(id=>allowedAttachments.add(id));if(row.work)requirePattern(row.work.patternId,row.work.revisionId);return {...pick(row,['id','projectId','date','durationMinutes','source','createdAt','updatedAt','work']),notes:options.includeSessionNotes?row.notes:'',attachments:row.attachments.filter(id=>selectedAttachments.has(id))};});
  for(const [id,revisions] of requiredPatterns){const pattern=state.patterns.find(row=>row.id===id);const currentRevisionId=pattern.kind==='structured'?(id===source.patternId?source.revisionId:[...revisions][0]):undefined;const portable={...pick(pattern,['id','kind','name','favorite','archived','createdAt','updatedAt']),notes:options.includePrivateNotes?pattern.notes:'',tags:options.includePrivateNotes?[...pattern.tags]:[],sourceAttachmentId:null,revisions:pattern.kind==='structured'?pattern.revisions.filter(row=>revisions.has(row.id)).map(row=>portableRevision(row,options.includePrivateNotes,{attachmentIds:selectedAttachments,revisionIds:revisions})):[],...(currentRevisionId?{currentRevisionId}:{})};
    if(pattern.sourceAttachmentId){allowedAttachments.add(pattern.sourceAttachmentId);if(pattern.kind==='reference')requiredAttachments.add(pattern.sourceAttachmentId);if(pattern.kind==='reference'||selectedAttachments.has(pattern.sourceAttachmentId))portable.sourceAttachmentId=pattern.sourceAttachmentId;}
    if(pattern.referenceData)portable.referenceData=portableReference(pattern.referenceData,options.includePrivateNotes);
    for(const revision of pattern.revisions.filter(row=>revisions.has(row.id))){const sourceId=revision.provenance?.source?.attachmentId;if(sourceId&&state.attachments.some(row=>row.id===sourceId))allowedAttachments.add(sourceId);}
    portable.revisions.forEach(revision=>revision.colors.forEach(color=>colorMaterialIds(color).forEach(id=>{assert(state.materials.some(row=>row.id===id),'broken_reference');materialIds.add(id);}))); subset.patterns.push(portable);
  }
  if(source.fabricLotId){const lot=state.lots.find(row=>row.id===source.fabricLotId);assert(lot,'broken_reference');materialIds.add(lot.materialId);project.settings.transferFabric={...portableFabricPlan(lot.properties),materialId:lot.materialId,requiresLocalSelection:true};project.settings.fabric=portableFabricSettings({...source.settings.fabric,countX:lot.properties.countX,countY:lot.properties.countY,countMeaning:lot.properties.countMeaning});}
  if(!source.fabricLotId && source.settings.transferFabric){const spec=source.settings.transferFabric;const material=state.materials.find(row=>row.id===spec.materialId);assert(material?.category==='fabric' && spec.requiresLocalSelection===true,'broken_reference');materialIds.add(material.id);project.settings.transferFabric={...portableFabricPlan(spec),materialId:material.id,requiresLocalSelection:true};}
  subset.materials=state.materials.filter(row=>materialIds.has(row.id)).map(row=>{row.attachments.forEach(id=>allowedAttachments.add(id));return {...pick(row,['id','name','category','brand','range','code','unit','color','packageSize','strands','divisible','reusable','createdAt','updatedAt']),minimum:null,favorite:false,archived:false,description:options.includePrivateNotes?row.description:'',notes:options.includePrivateNotes?row.notes:'',tags:options.includePrivateNotes?[...row.tags]:[],attachments:row.attachments.filter(id=>selectedAttachments.has(id)),properties:{...portableMaterialDescriptors(row.properties,options.includePrivateNotes),...pick(row.properties,['composition','threadType','threadSize','fabricType','countMeaning','countX','countY']),...(options.includePrivateNotes?pick(row.properties,['custom','care']):{})}};});
  subset.categories=state.categories.filter(category=>subset.materials.some(material=>material.category===category.id)).map(row=>pick(row,['id','name','fields','createdAt']));
  for(const id of selectedAttachments)assert(allowedAttachments.has(id),'project_package_assets');
  const included=new Set([...selectedAttachments,...requiredAttachments]);project.attachments=source.attachments.filter(id=>included.has(id));subset.projects=[project];
  subset.attachments=state.attachments.filter(row=>included.has(row.id)).map(row=>({...pick(row,['id','mime','size','digest','createdAt']),name:safeDisplayName(row.name)}));assert(subset.attachments.length===included.size,'missing_attachment');
  const work=portableWorkView(source.view,{...options,includedRevisions:[...requiredPatterns].flatMap(([patternId,revisions])=>[...revisions].map(revisionId=>({patternId,revisionId})))});project.view=work.view;
  const manifest={privacy:options,markerOmissions:work.omitted,requiredAttachmentIds:[...requiredAttachments],attachmentChoices:[...allowedAttachments].map(id=>{const row=state.attachments.find(asset=>asset.id===id);assert(row,'missing_attachment');return {id,name:safeDisplayName(row.name),size:row.size,mime:row.mime,required:requiredAttachments.has(id)};}),counts:{materials:subset.materials.length,patterns:subset.patterns.length,revisions:subset.patterns.reduce((sum,row)=>sum+row.revisions.length,0),needs:subset.needs.length,tasks:subset.tasks.length,sessions:subset.sessions.length,attachments:subset.attachments.length,history:project.progressHistory.length,markers:workMarkers(project.view).length}};
  validateSubset(subset);return {state:subset,manifest};
}
export function projectExportManifest(state,projectId,options={}) { return subsetFor(state,projectId,options).manifest; }
function validateSubset(state) {
  assert(new TextEncoder().encode(JSON.stringify(state)).length<=PROJECT_METADATA_LIMIT,'project_package_bounds');
  validateApplicationState(state);assert(state.projects.length===1&&state.materials.length<=5000&&state.patterns.length<=1000&&state.attachments.length<=1000&&state.needs.length<=5000&&state.tasks.length<=10000&&state.sessions.length<=10000,'project_package_bounds');
  for(const collection of EMPTY_COLLECTIONS)assert(state[collection].length===0,'project_package_stock');
  const project=state.projects[0];assert(Object.keys(project.view).every(key=>['workVersion','markers'].includes(key))&&workMarkers(project.view).every(scopedWorkMarker),'project_package_privacy');assert(!workMarkers(project.view).length||project.view.workVersion===1,'project_package_privacy');validatePortablePlanningSettings(project.settings);assert(project.fabricLotId===null,'project_package_stock');assert(project.progressHistory.length<=1000,'project_package_history');
  for(const collection of ['needs','tasks','sessions'])assert(state[collection].every(row=>row.projectId===project.id),'broken_reference');
  const materialIds=new Set(state.materials.map(row=>row.id));
  const attachmentIds=new Set(state.attachments.map(row=>row.id));
  for(const pattern of state.patterns)for(const revision of pattern.revisions){
    validatePortableRevision(revision,{attachmentIds,revisionIds:new Set(pattern.revisions.map(row=>row.id))});
    for(const color of revision.colors)for(const id of colorMaterialIds(color))assert(materialIds.has(id),'broken_reference');
    const source=revision.provenance?.source;if(source?.attachmentId){const metadata=state.attachments.find(row=>row.id===source.attachmentId);assert(metadata&&(!source.digest||source.digest===metadata.digest),'project_package_integrity');}
  }
  if(project.settings.transferFabric){const spec=project.settings.transferFabric;assert(materialIds.has(spec.materialId)&&spec.requiresLocalSelection===true,'broken_reference');assert(state.materials.find(row=>row.id===spec.materialId).category==='fabric','not_fabric');}
  for(const history of project.progressHistory){assert(history&&typeof history==='object','project_package_history');const pattern=history.patternId?state.patterns.find(row=>row.id===history.patternId):null;assert(!history.patternId||pattern,'broken_reference');assert(Array.isArray(history.completed)&&new Set(history.completed).size===history.completed.length,'invalid_progress');assert(typeof history.manualPercent==='number'&&quantity(history.manualPercent)<=100,'invalid_progress');if(pattern?.kind==='structured'){const revision=pattern.revisions.find(row=>row.id===history.revisionId);assert(revision,'revision_not_found');const valid=validProgressKeys(revision);assert(history.completed.every(key=>valid.has(key)),'invalid_progress');}else assert(history.completed.length===0,'invalid_progress');if(history.referenceData){assert(pattern?.kind==='reference','reference_pattern_required');validateReferenceData(history.referenceData,{attachmentId:pattern.sourceAttachmentId});}}
  return state;
}
export async function createProjectPackage(state,projectId,assets,options={}) {
  const selected=subsetFor(state,projectId,options),byId=new Map(assets.map(asset=>[asset.id,asset]));
  const payloadAssets=[];
  for(const metadata of selected.state.attachments){const asset=byId.get(metadata.id);assert(asset,'missing_attachment');const data=boundedBytes(asset.data);assert(data.length===metadata.size&&detectFile(data)===metadata.mime&&await digestBytes(data)===metadata.digest,'project_package_integrity');payloadAssets.push({id:metadata.id,data:bytesToBase64(data)});}
  // Choices for unselected files stay local; the package manifest reveals included content only.
  const manifest={privacy:pick(selected.manifest.privacy,['includeRecipient','includePrivateNotes','includeSessions','includeSessionNotes','includeHistory','includeMarkers']),requiredAttachmentIds:selected.manifest.requiredAttachmentIds,counts:selected.manifest.counts};
  const payload=JSON.stringify({state:selected.state,manifest,assets:payloadAssets});assert(new TextEncoder().encode(payload).length<=BACKUP_LIMIT,'file_too_large');
  const result=JSON.stringify({format:'ricamo-project',version:1,createdAt:new Date().toISOString(),sha256:await digestBytes(new TextEncoder().encode(payload)),payload});assert(new TextEncoder().encode(result).length<=BACKUP_LIMIT,'file_too_large');return result;
}
export async function inspectProjectPackage(value) {
  assert(typeof value==='string'&&value.length<=BACKUP_LIMIT&&new TextEncoder().encode(value).length<=BACKUP_LIMIT,'file_too_large');let envelope,content;try{envelope=JSON.parse(value)}catch{assert(false,'project_package_invalid')}
  assert(envelope?.format==='ricamo-project'&&envelope.version===1&&typeof envelope.payload==='string','project_package_version');assert(await digestBytes(new TextEncoder().encode(envelope.payload))===envelope.sha256,'project_package_integrity');try{content=JSON.parse(envelope.payload)}catch{assert(false,'project_package_invalid')}
  assertSafeJson(content);validateSubset(content.state);assert(content.manifest&&typeof content.manifest==='object'&&content.manifest.privacy&&typeof content.manifest.privacy==='object','project_package_invalid');
  for(const key of ['includeRecipient','includePrivateNotes','includeSessions','includeSessionNotes','includeHistory'])assert(typeof content.manifest.privacy[key]==='boolean','project_package_invalid');
  const privacy=content.manifest.privacy,project=content.state.projects[0];
  if(privacy.includeMarkers!==undefined)assert(typeof privacy.includeMarkers==='boolean','project_package_invalid');
  if(!privacy.includeMarkers)assert(workMarkers(project.view).length===0,'project_package_privacy');
  if(!privacy.includePrivateNotes)assert(workMarkers(project.view).every(marker=>!marker.note),'project_package_privacy');
  if(!privacy.includeRecipient)assert(project.recipient===''&&!project.settings.finishing?.recipientNotes,'project_package_privacy');
  if(!privacy.includePrivateNotes){
    const finishing=project.settings.finishing;assert(!finishing||!finishing.description&&!finishing.careInstructions&&!finishing.recipientNotes,'project_package_privacy');
    assert(project.notes===''&&project.description===''&&project.budget===null&&project.tags.length===0,'project_package_privacy');
    for(const collection of ['materials','patterns','needs','tasks'])for(const row of content.state[collection])assert(!row.notes&&!row.description&&(!row.tags||row.tags.length===0),'project_package_privacy');
    for(const material of content.state.materials)assert(!material.properties.care&&!Object.keys(material.properties.custom||{}).length&&!hasPrivateMaterialDescriptors(material.properties),'project_package_privacy');
    const references=[project.referenceData,...project.progressHistory.map(row=>row.referenceData)];
    for(const pattern of content.state.patterns){references.push(pattern.referenceData);for(const revision of pattern.revisions)assert(!revision.notes,'project_package_privacy');}
    for(const reference of references.filter(Boolean))assert(reference.bookmarks.length===0&&reference.annotations.every(mark=>mark.type!=='text'&&!mark.text),'project_package_privacy');
  }
  if(!privacy.includeSessions)assert(content.state.sessions.length===0,'project_package_privacy');
  if(!privacy.includeSessionNotes)assert(content.state.sessions.every(row=>!row.notes),'project_package_privacy');
  if(!privacy.includeHistory)assert(project.progressHistory.length===0,'project_package_privacy');
  assert(Array.isArray(content.assets)&&content.assets.length===content.state.attachments.length,'project_package_assets');const ids=new Set(),assets=[];
  for(const asset of content.assets){const metadata=content.state.attachments.find(row=>row.id===asset.id);assert(metadata&&!ids.has(asset.id),'project_package_assets');ids.add(asset.id);const bytes=base64ToBytes(asset.data);assert(bytes.length===metadata.size&&detectFile(bytes)===metadata.mime&&await digestBytes(bytes)===metadata.digest,'project_package_integrity');assets.push({id:asset.id,data:bytes});}
  return {state:content.state,manifest:content.manifest,digest:envelope.sha256,createdAt:envelope.createdAt,assets};
}

const catalogueKey=material=>JSON.stringify([material.brand.trim().toLowerCase(),material.range.trim().toLowerCase(),material.code,material.unit]);
const compatible=(source,target)=>source.unit===target.unit&&source.packageSize===target.packageSize&&source.strands===target.strands&&source.divisible===target.divisible&&source.reusable===target.reusable&&(builtins.has(source.category)?source.category:'custom')===(builtins.has(target.category)?target.category:'custom');
const conversionKnown=material=>material.unit!=='custom'&&(!['skein','spool','pack'].includes(material.unit)||material.packageSize>0)&&(!material.divisible||material.strands>0);
const importedId=(operationId,kind,index='')=>`${kind}-${operationId}${index===''?'':`-${index}`}`;
function importOperation(operationId){assert(typeof operationId==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(operationId),'project_package_operation');}
export function previewProjectImport(state,prepared) {
  validateSubset(prepared.state);assert(/^[a-f0-9]{64}$/.test(prepared.digest),'project_package_integrity');
  const index=new Map();for(const material of state.materials){if(material.archived)continue;const key=catalogueKey(material);if(!index.has(key))index.set(key,[]);index.get(key).push(material);}
  return {name:prepared.state.projects[0].name,sourceProjectId:prepared.state.projects[0].id,digest:prepared.digest,repeat:state.audit.some(row=>row.kind==='project_package_import'&&row.digest===prepared.digest),privacy:clone(prepared.manifest.privacy),counts:{materials:prepared.state.materials.length,patterns:prepared.state.patterns.length,needs:prepared.state.needs.length,tasks:prepared.state.tasks.length,sessions:prepared.state.sessions.length,attachments:prepared.state.attachments.length,history:prepared.state.projects[0].progressHistory.length,markers:workMarkers(prepared.state.projects[0].view).length,completed:prepared.state.projects[0].completed.length,manualPercent:prepared.state.projects[0].manualPercent},fabric:clone(prepared.state.projects[0].settings.transferFabric||null),materials:prepared.state.materials.map(material=>{const matches=(index.get(catalogueKey(material))||[]).map(row=>({id:row.id,name:row.name,compatible:compatible(material,row)})),usable=matches.filter(row=>row.compatible),known=conversionKnown(material);return {sourceId:material.id,name:material.name,brand:material.brand,range:material.range,code:material.code,unit:material.unit,conversionKnown:known,matches,needsReview:!known||usable.length>1||!material.code,recommendedId:known&&material.code&&usable.length===1?usable[0].id:null};})};
}
function attachmentMapping(state,source,operationId){
  const byDigest=new Map(state.attachments.map(row=>[row.digest,row])),mapping=new Map(),newMetadata=[];
  source.attachments.forEach((metadata,index)=>{let target=byDigest.get(metadata.digest);if(target){assert(target.size===metadata.size&&target.mime===metadata.mime,'project_package_integrity');}else{target={...clone(metadata),id:importedId(operationId,'attachment',index)};byDigest.set(metadata.digest,target);newMetadata.push(target);}mapping.set(metadata.id,target.id);});
  return {mapping,newMetadata};
}
export function projectImportAssets(state,prepared,operationId){
  importOperation(operationId);const plan=attachmentMapping(state,prepared.state,operationId),newIds=new Set(plan.newMetadata.map(row=>row.id)),added=new Set();
  const assets=[];for(const asset of prepared.assets){const id=plan.mapping.get(asset.id);assert(id,'project_package_assets');if(newIds.has(id)&&!added.has(id)){assets.push({id,data:boundedBytes(asset.data)});added.add(id);}}
  assert(assets.length===newIds.size,'project_package_assets');return assets;
}
function remapReference(value,attachmentMap){if(!value)return undefined;const next=clone(value);next.attachmentId=attachmentMap.get(value.attachmentId);assert(next.attachmentId,'missing_attachment');return next;}
function validateDecisions(preview,decisions){
  assert(decisions&&typeof decisions==='object'&&!Array.isArray(decisions),'invalid_payload');assert(!preview.repeat||decisions.allowRepeat===true,'project_package_duplicate');
  assert(Array.isArray(decisions.materials)&&decisions.materials.length===preview.materials.length,'project_package_material_review');
  const byId=new Map();for(const choice of decisions.materials){identifier(choice.sourceId);assert(!byId.has(choice.sourceId),'duplicate_selection');byId.set(choice.sourceId,choice);}
  for(const row of preview.materials){const choice=byId.get(row.sourceId);assert(choice&&['create','reuse'].includes(choice.action),'project_package_material_review');if(choice.action==='reuse')assert(row.matches.some(match=>match.id===choice.materialId&&match.compatible),'project_package_material_review');if(row.needsReview)assert(choice.reviewed===true,'project_package_material_review');}
  assert(typeof decisions.resetProgress==='boolean','invalid_boolean');text(decisions.name,'name',{required:true,max:300});return byId;
}
export function importProjectPackage(state,payload,context) {
    importOperation(context.operationId);
    const prepared={state:payload.state,digest:payload.digest,manifest:payload.manifest},source=prepared.state,preview=previewProjectImport(state,prepared),choices=validateDecisions(preview,payload.decisions),now=context.now;
    const assets=attachmentMapping(state,source,context.operationId),materialMap=new Map(),categoryMap=new Map(),patternMap=new Map(),revisionMap=new Map();
    for(const metadata of assets.newMetadata){assert(!state.attachments.some(row=>row.id===metadata.id),'duplicate_id');state.attachments.push({...metadata,createdAt:now});}
    source.categories.forEach((category,index)=>{const id=importedId(context.operationId,'category',index);categoryMap.set(category.id,id);assert(!state.categories.some(row=>row.id===id),'duplicate_id');state.categories.push({id,name:category.name,fields:[...category.fields],createdAt:now});});
    source.materials.forEach((material,index)=>{const choice=choices.get(material.id);if(choice.action==='reuse'){materialMap.set(material.id,choice.materialId);return;}const id=importedId(context.operationId,'material',index);assert(!state.materials.some(row=>row.id===id),'duplicate_id');materialMap.set(material.id,id);saveMaterial(state,{...material,id,category:categoryMap.get(material.category)||material.category,attachments:material.attachments.map(id=>assets.mapping.get(id))},context);});
    source.patterns.forEach((pattern,index)=>{const id=importedId(context.operationId,'pattern',index);patternMap.set(pattern.id,id);pattern.revisions.forEach((revision,i)=>revisionMap.set(`${pattern.id}\0${revision.id}`,importedId(context.operationId,'revision',`${index}-${i}`)));});
    source.patterns.forEach(pattern=>{const id=patternMap.get(pattern.id);assert(!state.patterns.some(row=>row.id===id),'duplicate_id');const revisions=pattern.revisions.map(revision=>{return remapPortableRevision(revision,{id:revisionMap.get(`${pattern.id}\0${revision.id}`),materialMap,attachmentMap:assets.mapping,revisionMap:new Map(pattern.revisions.map(row=>[row.id,revisionMap.get(`${pattern.id}\0${row.id}`)]))});});state.patterns.push({...pick(pattern,['kind','name','notes','tags','favorite']),id,archived:false,sourceAttachmentId:pattern.sourceAttachmentId?assets.mapping.get(pattern.sourceAttachmentId):null,revisions,...(pattern.kind==='structured'?{currentRevisionId:revisionMap.get(`${pattern.id}\0${pattern.currentRevisionId}`)}:{}),...(pattern.referenceData?{referenceData:remapReference(pattern.referenceData,assets.mapping)}:{}),createdAt:now,updatedAt:now});});
    const original=source.projects[0],projectId=importedId(context.operationId,'project'),reset=payload.decisions.resetProgress,settings={...portablePlanningSettings(original.settings,{includePrivateNotes:true,includeRecipient:true}),...(original.settings.transferFabric?{transferFabric:{...portableFabricPlan(original.settings.transferFabric),materialId:original.settings.transferFabric.materialId,requiresLocalSelection:true}}:{})};
    if(reset){delete settings.finishing;if(settings.forecast?.manualRemaining)settings.forecast.manualRemaining={full:null,half:null,backstitch:null};}
    if(settings.transferFabric)settings.transferFabric.materialId=materialMap.get(settings.transferFabric.materialId);
    assert(!state.projects.some(row=>row.id===projectId),'duplicate_id');saveProject(state,{...original,id:projectId,name:payload.decisions.name,status:'preparing',completedAt:'',fabricLotId:null,patternId:original.patternId?patternMap.get(original.patternId):null,revisionId:original.revisionId?revisionMap.get(`${original.patternId}\0${original.revisionId}`):null,attachments:[...new Set([...original.attachments,...source.materials.filter(row=>choices.get(row.id).action==='reuse').flatMap(row=>row.attachments)].map(id=>assets.mapping.get(id)))],settings},context);
    const project=state.projects.find(row=>row.id===projectId);project.completed=reset?[]:[...original.completed];project.manualPercent=reset?0:original.manualPercent;project.view=portableWorkView(original.view,{includeMarkers:true,includePrivateNotes:true,resetProgress:reset,mapPatternId:id=>patternMap.get(id),mapRevisionId:(pattern,id)=>revisionMap.get(`${pattern}\0${id}`)}).view;project.progressHistory=reset?[]:original.progressHistory.map(history=>({...pick(history,['completed','manualPercent','savedAt']),patternId:history.patternId?patternMap.get(history.patternId):null,revisionId:history.revisionId?revisionMap.get(`${history.patternId}\0${history.revisionId}`):null,...(history.referenceData?{referenceData:remapReference(history.referenceData,assets.mapping)}:{})}));
    if(original.referenceData){project.referenceData=remapReference(original.referenceData,assets.mapping);if(reset){project.referenceData.annotations=[];project.referenceData.bookmarks=[];}}
    const groups=new Map();for(const need of source.needs){const id=materialMap.get(need.materialId);if(!groups.has(id))groups.set(id,[]);groups.get(id).push(need);}
    for(const [materialId,needs] of groups){const unknown=needs.some(row=>row.quantity===null);saveNeed(state,{projectId,materialId,quantity:unknown?null:add(...needs.map(row=>row.quantity)),confidence:unknown?'unknown':needs.some(row=>row.confidence==='estimated')?'estimated':'exact',source:needs.every(row=>row.source==='pattern')?'pattern':'manual',notes:[...new Set(needs.map(row=>row.notes).filter(Boolean))].join('\n')},context);}
    source.tasks.forEach((task,index)=>saveTask(state,{...task,id:importedId(context.operationId,'task',index),projectId,done:reset?false:task.done},context));
    if(!reset)source.sessions.forEach((session,index)=>saveSession(state,{...session,id:importedId(context.operationId,'session',index),projectId,attachments:session.attachments.map(id=>assets.mapping.get(id)),...(session.work?{work:{...session.work,patternId:patternMap.get(session.work.patternId),revisionId:revisionMap.get(`${session.work.patternId}\0${session.work.revisionId}`)}}:{})},context,{restoreHistorical:true}));
    state.audit.push({id:context.id(),kind:'project_package_import',digest:payload.digest,projectId,date:now,operationId:context.operationId,resetProgress:reset,physicalStockCreated:false});
}
export function projectImportCommand(prepared,decisions,operationId,revision){importOperation(operationId);return {type:'project.package.import',operationId,payload:{state:prepared.state,manifest:prepared.manifest,digest:prepared.digest,decisions}};}
export function importedProjectId(operationId){importOperation(operationId);return importedId(operationId,'project');}
