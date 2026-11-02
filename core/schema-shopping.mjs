import chartSupplies from '../data/chart-supplies.json' with {type:'json'};
import {CHART_CATALOGUE} from './chart-collection.mjs';
import {bundledSupplierProducts,supplierIdentity} from './supplier-products.mjs';
import {previewPatternProcurement} from './pattern-procurement.mjs';
import {normalizePatternSupplies} from './pattern-supplies.mjs';
import {convertQuantity} from './fabric.mjs';
import {inventorySummary,saveMaterial,UNITS} from './inventory.mjs';
import {savePurchase} from './purchasing.mjs';
import {isDiscontinued} from './discontinued-materials.mjs';
import {assert,find,oneOf,quantity,add,subtract} from './shared.mjs';
let products;
const catalogue=()=>products??=new Map(bundledSupplierProducts().map(p=>[p.id,p]));
const productOf=row=>row.product??row.properties?.product;
const identity=row=>`${row.category}:${row.code?supplierIdentity(row):row.url||productOf(row)?.url||row.properties?.purchaseUrl||JSON.stringify([row.brand,row.range,row.name])}`;
const urlKey=value=>String(value??'').replace(/^https:\/\/www\.casacenina\.(?:com|fr|es)\//,'https://www.casacenina.it/');
function stockMatches(state,row,key){
 const active=state.materials.filter(m=>!m.archived&&m.category===row.category);
 const url=urlKey(row.url||productOf(row)?.url);
 const exact=active.filter(m=>identity(m)===key||(url&&urlKey(productOf(m)?.url||m.properties?.purchaseUrl)===url));
 if(exact.length)return {materials:exact,ambiguous:false};
 if(!row.code||!row.brand||row.range)return {materials:[],ambiguous:false};
 const loose=active.filter(m=>m.brand.toLocaleLowerCase()===row.brand.toLocaleLowerCase()&&m.code===row.code);
 return {materials:loose,ambiguous:new Set(loose.map(m=>m.range)).size>1};
}
export function schemaSupplySource(state,selection){
 const kind=oneOf(selection.kind,['chart','pattern'],'kind');
 if(kind==='chart'){
  const item=CHART_CATALOGUE.items.find(row=>row.id===selection.id);assert(item,'unknown_catalogue_chart');
  const source=chartSupplies.charts[item.id];
  return {name:item.name,sourceUrl:item.sourceUrl,requirements:(source?.requirements??[]).map(row=>({...row,...(row.productId&&catalogue().has(row.productId)?{product:catalogue().get(row.productId)}:{})}))};
 }
 const pattern=find(state,'patterns',selection.id);
 const design=pattern.library?.design;
 if(design?.requirements?.length)return {name:pattern.name,sourceUrl:design.sourceUrl??'',requirements:normalizePatternSupplies(design).requirements};
 const linked=CHART_CATALOGUE.items.find(row=>row.sourceUrl===(design?.sourceUrl||pattern.library?.origin));
 if(linked)return {...schemaSupplySource(state,{kind:'chart',id:linked.id}),name:pattern.name};
 const revision=pattern.revisions.find(row=>row.id===pattern.currentRevisionId);
 if(revision){
  const preview=previewPatternProcurement(state,revision,{design,products:[...catalogue().values()]});
  return {name:pattern.name,estimated:true,requirements:preview.rows.map(row=>{const offer=row.offers.find(offer=>offer.packagesRequired!==null&&offer.product.pack.unit);return {category:row.category,brand:row.color.brand??'',range:row.color.range??'',code:row.color.code??'',name:row.color.name||row.color.code||'Material',quantity:offer?offer.packagesRequired:row.required,unit:offer?offer.product.pack.unit:row.unit,...(offer?{product:offer.product,url:offer.product.url}:{} )};})};
 }
 return {name:pattern.name,sourceUrl:design?.sourceUrl??'',requirements:[]};
}
export function normalizeSchemaSelection(state,value){
 const kind=oneOf(value.kind,['chart','pattern'],'kind');const source=schemaSupplySource(state,{kind,id:value.id});
 const corrections=value.corrections??[];assert(Array.isArray(corrections)&&corrections.length<=1000,'pattern_supplies_invalid');
 const seen=new Set();
 return {kind,id:value.id,corrections:corrections.map(row=>{assert(Number.isInteger(row.index)&&row.index>=0&&row.index<source.requirements.length&&!seen.has(row.index),'pattern_supplies_invalid');seen.add(row.index);return{index:row.index,quantity:quantity(row.quantity,{nullable:true}),unit:row.unit===null?null:oneOf(row.unit,UNITS,'unit')};})};
}
export function schemaShoppingSelections(state){return state.settings.preferences?.schemaShopping??[];}
export function validateSchemaShopping(state){
 const rows=schemaShoppingSelections(state);assert(Array.isArray(rows)&&rows.length<=100,'pattern_supplies_invalid');
 const keys=new Set();for(const row of rows){const key=`${row.kind}:${row.id}`;assert(!keys.has(key),'pattern_supplies_invalid');keys.add(key);normalizeSchemaSelection(state,row);}
}
export function previewSchemaPurchases(state,selection){
 const selected=normalizeSchemaSelection(state,selection),source=schemaSupplySource(state,selected);
 const selections=[...schemaShoppingSelections(state).filter(row=>row.kind!==selected.kind||row.id!==selected.id),selected];
 const grouped=new Map(),issues=[];
 for(const entry of selections){
  const definition=schemaSupplySource(state,entry),corrections=new Map(entry.corrections.map(row=>[row.index,row]));
  definition.requirements.forEach((original,index)=>{
   const corrected=corrections.get(index),row={...original,...corrected};delete row.index;
   if(row.quantity===null||!row.unit){issues.push({name:row.name,reason:'schema_quantity_unknown'});return;}
   if(row.quantity===0)return;
   const key=identity(row);if(!grouped.has(key))grouped.set(key,{...row,required:0,names:[]});
   const group=grouped.get(key),amount=convertQuantity(row.quantity,row.unit,group.unit,{unit:group.unit,product:productOf(group)??productOf(row)});
   if(amount===null){group.invalid=true;issues.push({name:row.name,reason:'schema_unit_unknown'});}else group.required=add(group.required,amount);
   if(!group.names.includes(definition.name))group.names.push(definition.name);
  });
 }
 const rows=[...grouped.entries()].map(([key,row])=>{
  const match=stockMatches(state,row,key),matches=match.materials;
  let available=0,pending=0,unknown=Boolean(row.invalid||match.ambiguous);
  for(const material of matches){
   const summary=inventorySummary(state,material.id);const conversion={...material,product:productOf(material)??productOf(row)};
   const amount=convertQuantity(summary.available,material.unit,row.unit,conversion);
   if(amount===null||summary.unknown)unknown=true;else available=add(available,amount);
   for(const order of state.purchases.filter(p=>p.materialId===material.id&&['to_buy','ordered','partial'].includes(p.status))){const value=convertQuantity(subtract(order.quantity,order.received),material.unit,row.unit,conversion);if(value===null)unknown=true;else pending=add(pending,value);}
  }
  const suppressed=isDiscontinued(row)||matches.some(m=>m.properties.restockSuppressed===true||isDiscontinued(m));
  const missing=unknown?null:Math.max(0,subtract(row.required,add(available,pending)));
  const toBuy=missing===null?null:['skein','spool','pack','piece','cone','ball'].includes(row.unit)?Math.max(0,Math.ceil(missing-1e-12)):missing;
  return {...row,key,matches:matches.map(m=>m.id),available:unknown?null:available,pending,toBuy,suppressed};
 });
 return {source,selected,selections,rows,issues};
}
export function purchaseSchemaMissing(state,payload,context){
 const preview=previewSchemaPurchases(state,payload);assert(preview.source.requirements.length,'schema_supplies_missing');
 state.settings.preferences ||= {};
 state.settings.preferences.schemaShopping=preview.selections;
 for(const row of preview.rows){
  if(row.toBuy===null||row.toBuy<=0||row.suppressed)continue;
  let material=row.matches.map(id=>find(state,'materials',id)).find(m=>m.unit===row.unit);
  // Orders use the actual pack unit; a second identity row is created only when
  // an existing stock unit cannot represent a whole purchased pack exactly.
  if(!material&&row.matches.length){
   const target=find(state,'materials',row.matches[0]),converted=convertQuantity(row.toBuy,row.unit,target.unit,{...target,product:productOf(target)??productOf(row)});
   if(converted!==null){savePurchase(state,{materialId:target.id,quantity:converted,source:'manual',notes:row.names.join(' ? ')},context);continue;}
  }
  if(!material){const id=context.id();saveMaterial(state,{id,name:row.name,category:row.category,brand:row.brand??'',range:row.range??'',code:row.code??'',unit:row.unit,color:row.product?.hex??'',properties:{...(row.product?{product:row.product}:{}),...(row.url?{purchaseUrl:row.url}:{})}},context);material=find(state,'materials',id);}
  savePurchase(state,{materialId:material.id,quantity:row.toBuy,source:'manual',notes:row.names.join(' ? ')},context);
 }
}
export function unselectSchemaShopping(state,payload){
 const selection=normalizeSchemaSelection(state,payload);
 state.settings.preferences ||= {};
 state.settings.preferences.schemaShopping=schemaShoppingSelections(state).filter(row=>row.kind!==selection.kind||row.id!==selection.id);
}
export const schemaShoppingHandlers={'schema.purchaseMissing':purchaseSchemaMissing,'schema.unselectShopping':unselectSchemaShopping};
