import {assert,find,oneOf,audit} from './shared.mjs';
const countUnits=['skein','spool','ball','cone','pack'];
export function threadCountUnit({brand='',family,properties={},product}={}){
 const name=brand.trim().toLowerCase(),kind=family??properties.threadFamily;
 if(['madeira','p&g'].includes(name)||['spool','diamant'].includes(kind))return 'spool';
 const pack=(product??properties.product)?.pack?.unit;
 return countUnits.includes(pack)?pack:'skein';
}
/** Correct legacy entry counts mislabelled as metres; never divide entered counts. */
export function setThreadCountUnit(state,payload,context){
 const material=find(state,'materials',payload.materialId),target=oneOf(payload.unit,countUnits,'unit');
 assert(material.category==='thread'&&payload.preserveCounts===true,'thread_count_confirmation');
 if(material.unit===target)return;
 assert(['m',...countUnits].includes(material.unit),'thread_count_unit_review');
 const lots=state.lots.filter(l=>l.materialId===material.id);
 // A geometric need or an order may represent real metres rather than an entry
 // count; those linked workflows require a separate explicit physical conversion.
 assert(!state.needs.some(row=>row.materialId===material.id)&&!state.purchases.some(row=>row.materialId===material.id)&&!state.receipts.some(row=>row.materialId===material.id)&&!state.reservations.some(row=>row.materialId===material.id&&row.quantity>0)&&!lots.some(l=>l.status==='transformed'),'thread_count_unit_review');
 const previous=material.unit,previousPackageSize=material.packageSize;
 material.unit=target;material.packageSize=null;material.minimum=1;material.updatedAt=context.now;
 material.properties.quantityBasis='package-count';
 for(const collection of ['lots','movements','reservations'])for(const row of state[collection].filter(row=>row.materialId===material.id)){row.unit=target;if('updatedAt' in row)row.updatedAt=context.now;}
 audit(state,context,'material',material.id,'count-unit-corrected',{from:previous,to:target,preservedNumericCounts:true,previousPackageSize});
}
export const threadCountHandlers={'material.setThreadCountUnit':setThreadCountUnit};
