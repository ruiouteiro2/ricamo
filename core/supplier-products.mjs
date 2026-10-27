import {assert,assertSafeJson,text} from './shared.mjs';
import {CASA_CENINA} from './retailer-catalogue.mjs';
import dmc from '../src/engine/dmc.json' with {type:'json'};
import acquired from '../data/supplier-catalogue.json' with {type:'json'};
import supplement from '../data/casa-supplier-supplement.json' with {type:'json'};
import anchor from '../data/anchor-stranded-palette.json' with {type:'json'};
import lightEffects from '../data/dmc-light-effects-swatches.json' with {type:'json'};

export const SUPPLIER_CATEGORIES=Object.freeze(['thread','fabric','embellishment','tool','preparation','stabilizer','finishing','storage','kit','reference']);
export const SUPPLIERS=Object.freeze([
  {id:'casa-cenina',name:'Casa Cenina',hosts:['www.casacenina.it','casacenina.it'],home:'https://www.casacenina.it/'},
  {id:'tessiland',name:'Tessiland',hosts:['www.tessiland.com','tessiland.com'],home:'https://www.tessiland.com/it/'},
]);
const anchorAliases=new Map([...(anchor.aliases??[]).map(row=>[row.from,row.to]),...anchor.colors.filter(row=>row.sourceLabel!==row.code).map(row=>[row.sourceLabel,row.code])]);
const LINK_HOSTS=new Set([...SUPPLIERS.flatMap(row=>row.hosts),'www.casacenina.com','www.casacenina.fr','www.casacenina.es']);
export function supplierUrl(value,{supplier=null}={}){
  assert(typeof value==='string'&&value.length<=2000,'supplier_url');let url;try{url=new URL(value)}catch{assert(false,'supplier_url')}
  const allowed=supplier?SUPPLIERS.find(row=>row.id===supplier)?.hosts:LINK_HOSTS;
  assert(url.protocol==='https:'&&!url.username&&!url.password&&(!url.port||url.port==='443')&&(allowed instanceof Set?allowed.has(url.hostname):allowed?.includes(url.hostname)),'supplier_url');
  assert(!/[\x00-\x1f\x7f]/.test(value),'supplier_url');return url.href;
}
const bounded=(value,max=300)=>text(String(value??'').replace(/<[^>]*>/g,''),'value',{max});
const number=(value,{integer=false,max=1000000}={})=>{if(value===null||value===undefined)return null;assert(typeof value==='number'&&Number.isFinite(value)&&value>0&&value<=max&&(!integer||Number.isInteger(value)),'supplier_product');return value;};
export const supplierFold=value=>String(value??'').normalize('NFD').replace(/\p{Diacritic}/gu,'').trim().toLowerCase();
export function supplierIdentity(value){let brand=supplierFold(value.brand),range=supplierFold(value.range);if(['caron','the caron collection'].includes(brand))brand='caron collection';if(brand==='caron collection'&&range==='waterlillies')range='waterlilies';if(brand==='kreinik'&&['#4','#4 braid','very fine braid'].includes(range))range='very fine braid #4';if(brand==='anchor'&&['mouline','stranded mouline','stranded cotton mouline'].includes(range))range='stranded cotton';if(brand==='dmc'&&['mouline special','mouline special 25','stranded cotton'].includes(range))range='mouline';let code=supplierFold(value.code);if(brand==='dmc'&&range==='mouline'){const alias=CASA_CENINA.codeAliases.find(row=>supplierFold(row.from)===code);if(alias)code=supplierFold(alias.to);}if(brand==='anchor'&&range==='stranded cotton')code=anchorAliases.get(code)??code;return JSON.stringify(code?[brand,range,code]:[brand,range,code,value.product?.id??value.properties?.product?.id??(value.supplier?value.id:'')??'']);}
/** Compact facts only. Raw descriptions/HTML/unknown fields never cross into projects. */
export function normalizeSupplierProduct(value){
  assert(value&&typeof value==='object'&&!Array.isArray(value),'supplier_product');assertSafeJson(value);
  assert(SUPPLIERS.some(row=>row.id===value.supplier),'supplier_product');assert(SUPPLIER_CATEGORIES.includes(value.category),'supplier_product');
  const id=bounded(value.id,200);assert(id,'supplier_product');const url=supplierUrl(value.url),sourceUrl=supplierUrl(value.sourceUrl??value.url);
  const owner=value.supplier==='tessiland'?'tessiland':'casacenina';assert(new URL(url).hostname.includes(owner)&&new URL(sourceUrl).hostname.includes(owner),'supplier_product');
  assert(value.colorVariation===undefined||value.colorVariation===null||value.colorVariation==='multicolour','supplier_product');
  const result={id,colorVariation:value.colorVariation??null,supplier:value.supplier,category:value.category,type:bounded(value.type,100),brand:bounded(value.brand,200),range:bounded(value.range,200),code:bounded(value.code,200),name:bounded(value.name),colorName:bounded(value.colorName),hex:null,rgbSource:null,url,
    pack:{unit:null,lengthM:null,strands:null,divisible:null,pieces:null,weightG:null},beadSizeMm:number(value.beadSizeMm,{max:1000}),fabric:null,suitability:value.suitability?bounded(value.suitability,300):null,sourceUrl,retrievedAt:bounded(value.retrievedAt,40),verification:bounded(value.verification??'product-page',50)};
  assert(result.name&&result.retrievedAt&&!Number.isNaN(Date.parse(result.retrievedAt)),'supplier_product');
  if(value.hex!==undefined&&value.hex!==null){assert(/^#[a-f0-9]{6}$/i.test(value.hex)&&value.rgbSource&&['approximate','manufacturer','retailer'].includes(value.rgbSource.kind),'supplier_product');let rgbUrl;try{rgbUrl=new URL(value.rgbSource.sourceUrl)}catch{assert(false,'supplier_product')};assert(rgbUrl.protocol==='https:'&&!rgbUrl.username&&!rgbUrl.password&&rgbUrl.href.length<=2000,'supplier_product');result.hex=value.hex.toLowerCase();result.rgbSource={kind:value.rgbSource.kind,sourceUrl:rgbUrl.href,label:bounded(value.rgbSource.label,300)};}
  const p=value.pack??{};assert(p&&typeof p==='object'&&!Array.isArray(p),'supplier_product');
  if(p.unit!==undefined&&p.unit!==null){assert(['skein','spool','ball','pack','piece','cone'].includes(p.unit),'supplier_product');result.pack.unit=p.unit;}
  for(const key of ['lengthM','weightG'])result.pack[key]=number(p[key]);for(const key of ['strands','pieces'])result.pack[key]=number(p[key],{integer:true,max:key==='strands'?100:1000000});
  assert(p.divisible===undefined||p.divisible===null||typeof p.divisible==='boolean','supplier_product');result.pack.divisible=p.divisible??null;
  if(value.fabric){const f=value.fabric;assert(value.category==='fabric'&&['threads','stitches'].includes(f.countMeaning),'supplier_product');result.fabric={countX:number(f.countX,{max:200}),countY:number(f.countY,{max:200}),countMeaning:f.countMeaning,overX:number(f.overX,{integer:true,max:20}),overY:number(f.overY,{integer:true,max:20})};}
  assert(JSON.stringify(result).length<=8000,'supplier_product');return result;
}
export function supplierFabricConfiguration(product){const row=normalizeSupplierProduct(product);if(row.category!=='fabric')return null;const stitchCount=['aida','canvas'].includes(row.type);return{type:row.type||'other',brand:row.brand,range:row.range,code:row.code,colorName:row.colorName,productId:row.id,url:row.url,countX:row.fabric?.countX??'',countY:row.fabric?.countY??'',countMeaning:row.fabric?.countMeaning??(stitchCount?'stitches':'threads'),overX:row.fabric?.overX??(stitchCount?1:2),overY:row.fabric?.overY??(stitchCount?1:2)};}

const dmcSwatches=new Map(dmc.map(row=>[supplierIdentity({brand:'DMC',range:'Mouliné',code:row.code}),row]));
const anchorSwatches=new Map(anchor.colors.map(row=>[supplierIdentity(row),row]));
const effectSwatches=new Map(lightEffects.colours.map(row=>[supplierIdentity({brand:lightEffects.brand,range:lightEffects.range,code:row.code}),row]));
export function supplierSwatch(product){const effect=effectSwatches.get(supplierIdentity(product));if(effect)return{...product,hex:product.hex??effect.hex.toLowerCase(),rgbSource:product.rgbSource??effect.rgbSource,colorVariation:effect.multicolourObserved?'multicolour':product.colorVariation??null};if(product.hex)return product;const anchorColor=anchorSwatches.get(supplierIdentity(product));if(anchorColor)return {...product,hex:anchorColor.hex,rgbSource:anchorColor.rgbSource};const swatch=dmcSwatches.get(supplierIdentity(product));return swatch?{...product,hex:swatch.hex.toLowerCase(),rgbSource:{kind:'approximate',sourceUrl:'https://github.com/makebead/craft-color-codes',label:'MakeBead DMC snapshot · CC BY 4.0 · indicative digital colour'}}:product;}
export const SUPPLIER_SNAPSHOT_COVERAGE=acquired.coverage;
export const BUNDLED_SUPPLIER_EXCLUSIONS=Object.freeze((acquired.sourcePages??[]).filter(page=>['excluded','non-material'].includes(page.outcome)).map(page=>Object.freeze({supplier:'tessiland',url:page.url,retrievedAt:page.retrievedAt})));
export function bundledSupplierProducts(){const legacy=[...CASA_CENINA.fabrics,...CASA_CENINA.materials].map(row=>normalizeSupplierProduct(supplierSwatch({
 ...row,supplier:'casa-cenina',type:row.type??(row.category==='embellishment'?'bead':row.range==='Mouliné'?'mouline':row.brand==='Kreinik'?'metallic':'thread'),retrievedAt:CASA_CENINA.retrievedAt,
 pack:row.brand==='DMC'&&row.range==='Mouliné'?{unit:'skein',lengthM:8,strands:6,divisible:true}:row.category==='embellishment'?{unit:'pack'}:{},
 fabric:row.category==='fabric'&&row.countMeaning?{countX:row.count,countY:row.count,countMeaning:row.countMeaning,overX:row.over,overY:row.over}:null,
})));return [...legacy,...[...acquired.products,...supplement.products].map(row=>normalizeSupplierProduct(supplierSwatch(row)))];}

/** Catalogue pack facts are valid only for the exact saved material identity. */
export function validateSupplierMaterial(material){
 const raw=material?.properties?.product;if(raw===undefined||raw===null)return null;const product=normalizeSupplierProduct(raw);
 assert(material.category===product.category&&supplierIdentity(material)===supplierIdentity(product),'supplier_material_identity');
 for(const [provided,normalized]of[[raw,product],[raw.pack,product.pack],[raw.rgbSource,product.rgbSource],[raw.fabric,product.fabric]])if(provided)assert(Object.keys(provided).every(key=>Object.hasOwn(normalized,key)),'supplier_product');
 return product;
}

/** Eligibility for automatic embroidery suggestions; uncertain yarn stays searchable. */
export function isEmbroideryProduct(product){if(product?.suitability==='verify-technique')return false;if(product?.suitability==='embroidery-declared')return true;const[brand,range]=JSON.parse(supplierIdentity(product??{}));return brand==='dmc'&&['mouline','diamant','diamant grande','light effects'].includes(range)||brand==='anchor'&&range==='stranded cotton'||brand==='caron collection'&&range==='waterlilies'||brand==='kreinik'&&range==='very fine braid #4';}
