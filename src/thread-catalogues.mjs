import {normalizeSupplierProduct,supplierIdentity,isEmbroideryProduct} from '../core/supplier-products.mjs';
import anchor from '../data/anchor-stranded-palette.json' with {type:'json'};
import {CASA_CENINA,retailerPurchaseLinks} from '../core/retailer-catalogue.mjs';
import {dmcPalette} from './engine/adapter.mjs';
import {catalogueDigest,threadCataloguePalette} from '../core/thread-catalogues.mjs';
const data={name:'DMC · MakeBead',version:'Stitch Studio 0.1.0 snapshot',source:'MakeBead craft-color-codes; bundled source SHA-256 945ea492f930959edac79cf81b7b4363930a7cf9cfa1c43705f328edbc466aed',license:'CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/ — attribution: MakeBead craft-color-codes',colors:dmcPalette.colors.map(row=>({brand:'DMC',range:'',code:row.code,name:row.name,hex:row.hex}))};
export const bundledThreadCatalogue=Object.freeze({id:'bundled-dmc',...data,digest:catalogueDigest(data),bundled:true});
const retailerData={...data,name:'DMC Mouliné · Casa Cenina',version:`Verified product links ${CASA_CENINA.retrievedAt}`,source:`${data.source}; Casa Cenina verified product snapshot ${CASA_CENINA.retrievedAt}; digital RGB approximations, not measured retailer colours`,colors:data.colors.map(color=>({...color,range:'Mouliné'})).filter(color=>retailerPurchaseLinks(color).length)};
export const retailerThreadCatalogue=Object.freeze({id:'bundled-casa-dmc',...retailerData,digest:catalogueDigest(retailerData),bundled:true});
const anchorData={name:'Anchor · Stranded Cotton',version:anchor.retrievedAt,source:`${anchor.sourceUrl}; SHA-256 ${anchor.sourceSha256}; ${anchor.method}`,license:'Indicative digital RGB sampled from the published shade card, not measured thread colours. No colour-card redistribution licence is inferred.',colors:anchor.colors.map(({brand,range,code,name,hex})=>({brand,range,code,name,hex}))};
export const anchorThreadCatalogue=Object.freeze({id:'bundled-anchor-stranded',...anchorData,digest:catalogueDigest(anchorData),bundled:true});
export function threadCatalogueVersions(state,supplierCatalogues=[]){const current=supplierCatalogues.find(row=>row.products?.length&&JSON.parse(supplierIdentity(row.products[0])).slice(0,2).join('|')==='dmc|mouline');return[current?{...current,id:'bundled-casa-dmc'}:retailerThreadCatalogue,anchorThreadCatalogue,bundledThreadCatalogue,...supplierCatalogues.filter(row=>row!==current),...(state.threadCatalogues??[])];}
export function selectedThreadPalette(state,id,supplierCatalogues=[]){
 const record=threadCatalogueVersions(state,supplierCatalogues).find(row=>row.id===id)??supplierCatalogues.find(row=>row.id===id);if(!record)throw Object.assign(new Error(),{code:'thread_catalogue_missing'});
 const palette=threadCataloguePalette(record),products=new Map(supplierCatalogues.flatMap(row=>row.products??[]).map(row=>[supplierIdentity(row),row]));
 palette.colors=palette.colors.map(color=>{const product=products.get(supplierIdentity(color));return product?{...color,product:structuredClone(product)}:color;});return palette;
}
/** Keep material families separate; an absent sourced RGB never becomes an invented colour. */
export function supplierThreadCatalogues(products){
 const groups=new Map();
 for(const value of products){const row=normalizeSupplierProduct(value);if(row.category!=='thread'||row.colorVariation==='multicolour'||!isEmbroideryProduct(row)||!row.hex||!row.rgbSource||!row.brand||!row.code)continue;const key=JSON.stringify(JSON.parse(supplierIdentity(row)).slice(0,2));if(!groups.has(key))groups.set(key,new Map());const group=groups.get(key),identity=supplierIdentity(row);if(!group.has(identity))group.set(identity,row);}
 return [...groups.entries()].map(([identity,group])=>{const rows=[...group.values()].sort((a,b)=>a.code.localeCompare(b.code,undefined,{numeric:true})),data={name:[rows[0].brand,rows[0].range].filter(Boolean).join(' · '),version:rows.map(row=>row.retrievedAt).sort().at(-1),source:'Locally cached public product facts; digital colours retain the declared source in each product snapshot.',license:'See the declared source for each indicative RGB. No physical colour calibration or colour-card redistribution licence is inferred.',colors:rows.map(row=>({brand:row.brand,range:row.range,code:row.code,name:row.name,hex:row.hex}))};return{id:`supplier-${catalogueDigest(identity).slice(0,16)}`,...data,digest:catalogueDigest(data),products:rows,bundled:false};}).sort((a,b)=>a.name.localeCompare(b.name));
}
