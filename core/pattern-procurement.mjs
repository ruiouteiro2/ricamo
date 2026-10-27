import {supplierIdentity,normalizeSupplierProduct} from './supplier-products.mjs';
import {counts} from './pattern.mjs';
import {estimateThreads,threadEstimateConfiguration,archivePatternNeeds} from './estimates.mjs';
import {fabricSize,convertQuantity,productPackageCapacity} from './fabric.mjs';
import {componentIdentity,threadComponents} from './thread-recipes.mjs';
import {createPatternMaterialResolver} from './thread-estimate-workflow.mjs';
import {projectFabricConfig} from './design-size.mjs';
import {fabricProjectFit} from './fabric-planning.mjs';
import {saveMaterial} from './inventory.mjs';
import {saveNeed,projectRevision,confirmedConsumption} from './projects.mjs';
import {assert,quantity,add,find,activeProject,audit,totalReserved} from './shared.mjs';

const quantityInUnit=(value,from,to,material)=>value===0?0:convertQuantity(value,from,to,material);
const canonicalUnit=category=>category==='thread'?'strand-m':category==='embellishment'?'piece':null;
const commercialColor=color=>({...color,range:color.range||((color.catalogueRef?.name==='DMC · MakeBead'&&color.brand==='DMC')?'Mouliné':'')});
const identity=(color,category)=>`${category}:${color.brand&&color.code?supplierIdentity(commercialColor(color)):color.product?.id?`product:${color.product.id}`:componentIdentity(color)}`;
const productOf=value=>value?.product??value?.properties?.product;
const uniqueProducts=products=>[...new Map(products.filter(Boolean).map(row=>[row.id??row.url,row])).values()];
function matchesProduct(product,color,category){return product?.category===category&&(color.product?.id===product.id||(Boolean(color.brand&&color.code)&&supplierIdentity(product)===supplierIdentity(commercialColor(color))));}
function roundUpPacks(value,capacity){if(value===0)return 0;return value===null||capacity===null?null:Math.ceil(Math.max(0,quantity(value))/capacity-1e-12);}

/** Fill a missing conversion from one unambiguous verified SKU, without editing inventory. */
export function procurementConversionMaterial(material,color,products=[]) {
  if(!material||productOf(material))return material;
  const unit=canonicalUnit(material.category);
  if(!unit||convertQuantity(1,material.unit,unit,material)!==null)return material;
  const candidates=uniqueProducts([color.product,...products.filter(product=>matchesProduct(product,color,material.category))]);
  const known=candidates.map(product=>({product,quantity:convertQuantity(1,material.unit,unit,{...material,product})})).filter(row=>row.quantity!==null);
  if(!known.length||new Set(known.map(row=>row.quantity)).size!==1)return material;
  return{...material,product:known[0].product};
}

/** Stock is read per lot: reservations outside this project never meet its requirements. */
export function ingredientStock(state,material,unit,projectId){
  if(!material)return{status:'untracked',physical:null,available:null,knownAvailable:0,ownReserved:null,elsewhereReserved:null,unknown:true};
  const lots=state.lots.filter(row=>row.materialId===material.id&&row.status!=='transformed');
  let physical=0,available=0,ownReserved=0,elsewhereReserved=0,physicalUnknown=false,availableUnknown=false;
  const convert=value=>quantityInUnit(value,material.unit,unit,material);
  for(const lot of lots){
    const amount=convert(lot.quantity);if(amount===null)physicalUnknown=true;else physical=add(physical,amount);
    const own=projectId?totalReserved(state,lot.id,[projectId]):0,total=totalReserved(state,lot.id),outside=quantity(Math.max(0,total-own));
    const external=convert(outside);if(external===null&&outside>0)elsewhereReserved=null;else if(elsewhereReserved!==null)elsewhereReserved=add(elsewhereReserved,external??0);
    if(lot.status!=='usable')continue;
    if(lot.quantity===null){availableUnknown=true;continue;}
    const eligible=Math.max(0,lot.quantity-outside),free=convert(eligible),reserved=convert(Math.min(own,eligible));
    if(free===null)availableUnknown=true;else available=add(available,free);
    if(reserved===null&&own>0)ownReserved=null;else if(ownReserved!==null)ownReserved=add(ownReserved,reserved??0);
  }
  return{status:'tracked',physical:physicalUnknown?null:physical,available:availableUnknown?null:available,knownAvailable:available,ownReserved,elsewhereReserved,unknown:availableUnknown};
}
function fabricSummary(state,revision,project,fabric,design,margins,products){
  if(!fabric)return null;
  const allowance={left:0,right:0,top:0,bottom:0,...(margins??fabric.margins??{})};
  let size=null;
  try{if(revision)size=fabricSize({...fabric,width:revision.width,height:revision.height,margins:allowance});
    else if(design?.widthCm&&design?.heightCm)size={widthCm:design.widthCm,heightCm:design.heightCm,margins:allowance,cutWidthCm:add(design.widthCm,allowance.left,allowance.right),cutHeightCm:add(design.heightCm,allowance.top,allowance.bottom)};
  }catch{ /* Unknown measured fabric stays unknown instead of falling back to a guessed count. */ }
  const lot=project?.fabricLotId?state.lots.find(row=>row.id===project.fabricLotId):null;
  let fit=null;if(lot&&revision&&size){try{fit=fabricProjectFit(lot,revision,{...fabric,margins:allowance});}catch{}}
  const material=lot?state.materials.find(row=>row.id===lot.materialId):null,product=productOf(material);
  const configuration=material?{...fabric,brand:material.brand??'',range:material.range??'',code:material.code??'',colorName:product?.colorName||material.name,productId:product?.id??'',url:product?.url??material.properties?.purchaseUrl??''}:fabric;
  const offers=uniqueProducts([product??configuration.product,...products.filter(row=>row.category==='fabric'&&(row.id===configuration.productId||row.url===configuration.url))]);
  return{configuration,size,margins:allowance,lot,fit,offers,url:configuration.url??''};
}
/** Pure, stock-read-only comparison. Products are local factual snapshots supplied by the caller. */
export function previewPatternProcurement(state,revision,{project=null,fabric,design=null,configuration,margins,products=[]}={}){
  const actualLot=project?.fabricLotId?find(state,'lots',project.fabricLotId):null;
  const cloth=actualLot?projectFabricConfig(project,actualLot):project?.settings?.fabric??fabric??design?.fabric??revision?.settings?.fabric;
  const settings=threadEstimateConfiguration(configuration??project?.settings?.thread??{strands:revision?.settings?.strands??2});
  const ingredients=new Map(),warnings=[],resolveMaterial=createPatternMaterialResolver(state),productIndex=new Map(),productsById=new Map(products.map(row=>[row.id,row]));let estimates=[],geometryError=null;
  for(const product of products){const key=`${product.category}:${supplierIdentity(product)}`;if(!productIndex.has(key))productIndex.set(key,[]);productIndex.get(key).push(product);}
  const related=(color,category)=>color.brand&&color.code?(productIndex.get(`${category}:${supplierIdentity(commercialColor(color))}`)??[]):productsById.get(color.product?.id)?.category===category?[productsById.get(color.product.id)]:[];
  const addIngredient=(color,category,required,unit,source,index)=>{
    let material=null,ambiguous=false;
    try{material=resolveMaterial(color,category);}catch(error){if(error.code!=='thread_material_ambiguous')throw error;ambiguous=true;}
    const key=material?`id:${material.id}`:identity(color,category);
    if(!ingredients.has(key))ingredients.set(key,{key,color,category,material,ambiguous,required:0,unit,source,paletteSources:[],filamentMetres:0});
    const row=ingredients.get(key);assert(row.unit===unit,'procurement_unit_conflict');
    row.required=row.required===null||required===null?null:add(row.required,required);if(index!==undefined)row.paletteSources.push(index);
    if(unit==='strand-m')row.filamentMetres=row.required;
    return row;
  };
  if(revision){
    const summary=counts(revision);
    try{estimates=estimateThreads(revision,{...settings,...cloth});}catch(error){if(error.code!=='fabric_count_unknown'&&error.code!=='invalid_count_meaning')throw error;geometryError=error.code;}
    if(!geometryError){for(const estimate of estimates)for(const component of estimate.components)if(component.filamentMetres>0)addIngredient(component.color,'thread',component.filamentMetres,'strand-m','geometry',estimate.index);}
    for(const count of summary.byColor){
      if(!count.total)continue;const color=revision.colors[count.index];
      if(color.materialKind==='bead'){
        addIngredient(color,'embellishment',count.bead??0,'piece','counted',count.index);
        if(!color.attachmentThread)warnings.push({code:'procurement_fastening_unknown',index:count.index,codeName:color.code});
        else if(geometryError)for(const component of threadComponents(color.attachmentThread,'full',{},count.index))addIngredient(component,'thread',null,'strand-m','geometry',count.index);
      }else if(geometryError){for(const type of ['full','half','back'])if(count[type==='back'?'backstitch':type])for(const component of threadComponents(color,type,settings,count.index))addIngredient(component,'thread',null,'strand-m','geometry',count.index);}
    }
  }
  const declarations=new Map();
  for(const declared of design?.requirements??[]){
    const category=declared.category??'thread',unit=canonicalUnit(category),offers=related(declared,category);
    const sourceProduct=declared.product??offers.find(row=>row.url===declared.url)??procurementConversionMaterial({...declared,category,properties:{}},declared,offers)?.product;
    const conversion={unit:declared.unit,product:sourceProduct},convertible=unit&&quantityInUnit(1,declared.unit,unit,conversion)!==null;
    const targetUnit=convertible?unit:declared.unit,targetQuantity=convertible?quantityInUnit(declared.quantity,declared.unit,unit,conversion):declared.quantity;
    let material;try{material=resolveMaterial(declared,category);}catch{/* The ingredient resolver below exposes ambiguity. */}
    const key=material?`id:${material.id}`:identity(declared,category);
    if(!declarations.has(key))declarations.set(key,{key,color:{...declared,...(sourceProduct?{product:sourceProduct}:{})},category,unit:targetUnit,quantity:0,known:false,conflict:false,parts:[]});
    const group=declarations.get(key);group.parts.push({quantity:declared.quantity,unit:declared.unit});group.known||=declared.quantity!==null;
    if(group.unit!==targetUnit){if(!group.conflict)warnings.push({code:'procurement_unit_conflict',index:key,codeName:declared.code});group.conflict=true;group.unit=unit??group.unit;}
    group.quantity=group.conflict||group.quantity===null||targetQuantity===null?null:add(group.quantity,targetQuantity);
  }
  for(const group of declarations.values()){
    const previous=ingredients.get(group.key);
    if(previous){previous.declared=group.parts;if(group.quantity!==null||group.known||group.conflict){previous.geometry={quantity:previous.required,unit:previous.unit};previous.required=group.quantity;previous.unit=group.unit;previous.source='declared';}if(group.conflict)previous.declaredParts=group.parts;continue;}
    const row=addIngredient(group.color,group.category,group.quantity,group.unit,'declared');if(group.conflict)row.declaredParts=group.parts;
  }
  const rows=[...ingredients.values()].map(row=>{
    const matching=related(row.color,row.category),conversionMaterial=procurementConversionMaterial(row.material,row.color,matching);
    const manual=row.material&&project?state.needs.find(need=>need.projectId===project.id&&need.materialId===row.material.id&&need.source==='manual'):null;
    const required=manual?quantityInUnit(manual.quantity,manual.unit,row.unit,conversionMaterial):row.required;
    const consumed=project&&row.material?quantityInUnit(confirmedConsumption(state,project.id,row.material.id),row.material.unit,row.unit,conversionMaterial):0;
    const remaining=required===null||consumed===null?null:quantity(Math.max(0,required-consumed));
    const stock=ingredientStock(state,conversionMaterial,row.unit,project?.id);
    const knownShortage=remaining===null?null:quantity(Math.max(0,remaining-stock.knownAvailable));
    const shortage=remaining===null?null:knownShortage===0?0:stock.available===null?null:knownShortage;
    const offers=uniqueProducts([row.color.product,productOf(row.material),...matching]).map(product=>{
      const measure=canonicalUnit(row.category),capacity=measure?productPackageCapacity(product,measure):null;
      const sourceMaterial=conversionMaterial??{unit:row.unit,product:row.color.product};
      const total=measure?quantityInUnit(required,row.unit,measure,sourceMaterial):null,missing=measure?quantityInUnit(shortage,row.unit,measure,sourceMaterial):null;
      const samePack=row.unit===product.pack.unit&&(row.color.product?.id===product.id||productOf(row.material)?.id===product.id);
      return{product,capacity,measure,packagesRequired:samePack?roundUpPacks(required,1):roundUpPacks(total,capacity),packagesMissing:samePack?roundUpPacks(shortage,1):roundUpPacks(missing,capacity)};
    });
    if(row.category==='thread'&&required!==0&&offers.some(offer=>offer.product.suitability==='verify-technique'))warnings.push({code:'procurement_suitability_unknown',index:row.key,codeName:[row.color.brand,row.color.range,row.color.code].filter(Boolean).join(' · ')});
    return{...row,conversionMaterial,required,remaining,consumed,manual:Boolean(manual),manualQuantity:manual?.quantity??null,stock,shortage,knownShortage,offers};
  });
  return{rows,configuration:settings,fabric:fabricSummary(state,revision,project,cloth,design,margins,products),geometryError,warnings,method:revision?.colors.some(color=>color.materialKind==='bead')?'ricamo-geometric-v3':'ricamo-geometric-v2'};
}

/** Explicit command: create planning needs only, never stock, reservations, purchases or consumption. */
export function applyProjectProcurement(state,payload,context){
  const project=activeProject(state,payload.projectId),pattern=find(state,'patterns',project.patternId),revision=projectRevision(state,project);
  assert(payload.products===undefined||(Array.isArray(payload.products)&&payload.products.length<=2000),'supplier_invalid_product');
  const products=(payload.products??[]).map(normalizeSupplierProduct);
  const preview=previewPatternProcurement(state,revision,{project,design:pattern.library?.design,configuration:payload.configuration,products});
  assert(preview.rows.length,'procurement_empty');
  assert(!preview.rows.some(row=>row.ambiguous),'thread_material_ambiguous');
  archivePatternNeeds(state,project,context,'procurement_reestimated');
  for(const row of preview.rows){
    let material=row.material;
    if(!material){const id=context.id();saveMaterial(state,{id,name:row.color.name||row.color.code,category:row.category,brand:row.color.brand??'',range:row.color.range??'',code:row.color.code??'',color:row.color.hex??'',unit:row.unit,properties:row.color.product?{product:structuredClone(row.color.product)}:{}},context);material=find(state,'materials',id);}
    if(state.needs.some(need=>need.projectId===project.id&&need.materialId===material.id&&need.source==='manual'))continue;
    const value=quantityInUnit(row.required,row.unit,material.unit,row.conversionMaterial??material);
    saveNeed(state,{projectId:project.id,materialId:material.id,quantity:value,source:'pattern',confidence:row.source==='geometry'?'estimated':'exact'},context);
    const need=state.needs.find(need=>need.projectId===project.id&&need.materialId===material.id);
    need.estimate={method:preview.method,revisionId:revision?.id??null,filamentMetres:row.unit==='strand-m'?row.required:null,assumptions:preview.configuration,
      procurement:{unit:row.unit,required:row.required,source:row.source,paletteSources:row.paletteSources,attachmentThreadUnknown:preview.warnings.filter(warning=>warning.code==='procurement_fastening_unknown'&&row.paletteSources.includes(warning.index)).length>0},
      conversion:{unit:material.unit,strands:material.strands??null,quantity:value,...(productOf(row.conversionMaterial??material)?{product:structuredClone(productOf(row.conversionMaterial??material))}:{})}};
  }
  if(revision){const source=preview.fabric?.configuration;const fabric=source&&!preview.geometryError?{countX:source.countX,countY:source.countY??source.countX,countMeaning:source.countMeaning??'stitches',overX:source.overX??1,overY:source.overY??source.overX??1}:null;project.settings.thread=preview.configuration;project.settings.threadEstimate={method:preview.method,fabric,configuration:preview.configuration,revisionId:revision.id,updatedAt:context.now};}
  project.updatedAt=context.now;audit(state,context,'project',project.id,'procurement_planned',{materials:preview.rows.length,unknown:preview.rows.filter(row=>row.required===null).length,fasteningUnknown:preview.warnings.filter(row=>row.code==='procurement_fastening_unknown').length});
}
