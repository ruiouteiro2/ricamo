import {assert,text,quantity,oneOf,find,activeProject,audit} from './shared.mjs';
import {normalizePatternFabric,purchaseUrl} from './pattern-fabric.mjs';
import {saveMaterial,UNITS} from './inventory.mjs';
import {saveNeed} from './projects.mjs';
export function normalizePatternSupplies(value){
  assert(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>['fabric','widthCm','heightCm','requirements','sourceUrl'].includes(key)),'pattern_supplies_invalid');
  const result={widthCm:quantity(value.widthCm,{nullable:true,positive:true}),heightCm:quantity(value.heightCm,{nullable:true,positive:true}),sourceUrl:purchaseUrl(value.sourceUrl??'')};
  if(value.fabric!==undefined&&value.fabric!==null)result.fabric=normalizePatternFabric(value.fabric);
  assert(Array.isArray(value.requirements??[])&&(value.requirements??[]).length<=1000,'pattern_supplies_invalid');
  result.requirements=(value.requirements??[]).map(row=>{
    assert(row&&typeof row==='object'&&!Array.isArray(row)&&Object.keys(row).every(key=>['category','brand','range','code','name','quantity','unit','url'].includes(key)),'pattern_supplies_invalid');
    return {category:oneOf(row.category??'thread',['thread','fabric','embellishment','tool','preparation','stabilizer','finishing','other'],'category'),...Object.fromEntries(['brand','range','code'].map(key=>[key,text(row[key],key,{max:200})])),name:text(row.name,'name',{required:true,max:300}),quantity:quantity(row.quantity,{nullable:true}),unit:oneOf(row.unit??'piece',UNITS,'unit'),url:purchaseUrl(row.url??'')};
  });
  return result;
}
/** Explicit requirements become planning needs; no lots or movements are created. */
export function applyPatternSupplies(state,payload,context){
  const project=activeProject(state,payload.projectId),pattern=find(state,'patterns',project.patternId);
  assert(pattern.library?.design,'pattern_supplies_missing');const design=normalizePatternSupplies(pattern.library.design);
  const identity=row=>JSON.stringify([row.category,row.brand,row.range,row.code,row.unit,row.code?'':row.name]);
  const requirements=new Map();for(const row of design.requirements){const key=identity(row);if(!requirements.has(key))requirements.set(key,{...row});else {const previous=requirements.get(key);previous.quantity=previous.quantity===null||row.quantity===null?null:quantity(previous.quantity+row.quantity);}}
  let created=0,retained=0;
  for(const row of requirements.values()){
    const matches=state.materials.filter(material=>!material.archived&&identity(material)===identity(row));assert(matches.length<=1,'pattern_supplies_ambiguous');
    let material=matches[0];if(!material){const id=context.id();saveMaterial(state,{...row,id,properties:row.url?{purchaseUrl:row.url}:{}},context);material=find(state,'materials',id);}
    if(state.needs.some(need=>need.projectId===project.id&&need.materialId===material.id)){retained++;continue;}
    saveNeed(state,{projectId:project.id,materialId:material.id,quantity:row.quantity,source:'manual',confidence:'exact'},context);created++;
  }
  audit(state,context,'project',project.id,'pattern_supplies_added',{patternId:pattern.id,created,retained});
}
