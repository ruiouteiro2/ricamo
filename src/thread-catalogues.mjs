import {dmcPalette} from './engine/adapter.mjs';
import {catalogueDigest,threadCataloguePalette} from '../core/thread-catalogues.mjs';
const data={name:'DMC · MakeBead',version:'Stitch Studio 0.1.0 snapshot',source:'MakeBead craft-color-codes; bundled source SHA-256 945ea492f930959edac79cf81b7b4363930a7cf9cfa1c43705f328edbc466aed',license:'CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/ — attribution: MakeBead craft-color-codes',colors:dmcPalette.colors.map(row=>({brand:'DMC',range:'',code:row.code,name:row.name,hex:row.hex}))};
export const bundledThreadCatalogue=Object.freeze({id:'bundled-dmc',...data,digest:catalogueDigest(data),bundled:true});
export const threadCatalogueVersions=state=>[bundledThreadCatalogue,...(state.threadCatalogues??[])];
export function selectedThreadPalette(state,id){const record=threadCatalogueVersions(state).find(row=>row.id===id);if(!record)throw Object.assign(new Error(),{code:'thread_catalogue_missing'});return threadCataloguePalette(record);}
