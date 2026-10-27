import { jsPDF } from 'jspdf';
import { inventorySummary } from '../core/inventory.mjs';
import { assert, quantity } from '../core/shared.mjs';
import { embedPdfFont, pdfText, PDF_FONT } from './pdf-font.mjs';

function locationPath(state,id){const names=[],seen=new Set();while(id&&!seen.has(id)){seen.add(id);const row=state.locations.find(item=>item.id===id);if(!row)break;names.unshift(row.name);id=row.parentId;}return names.join(' / ');}
/** Labels refer to existing records, never to generated stock or synthetic IDs. */
export function inventoryLabelItems(state, { materialIds = [], lotIds = [], projectIds = [], locationIds = [] } = {}) {
  const selections=[materialIds,lotIds,projectIds,locationIds];
  assert(selections.every(Array.isArray)&&selections.reduce((n,rows)=>n+rows.length,0)>0&&selections.reduce((n,rows)=>n+rows.length,0)<=200,'inventory_batch_limit');
  assert(selections.every(rows=>new Set(rows).size===rows.length),'duplicate_selection');
  const materials=new Map(state.materials.map(row=>[row.id,row]));
  return [
    ...materialIds.map(id=>{const material=materials.get(id);assert(material,'not_found');return{id,kind:'material',name:material.name,material,quantity:inventorySummary(state,id).physical,location:''};}),
    ...lotIds.map(id=>{const lot=state.lots.find(row=>row.id===id);assert(lot,'not_found');const material=materials.get(lot.materialId);assert(material,'not_found');return{id,kind:'lot',name:material.name,material,quantity:lot.quantity,confidence:lot.confidence,lotCode:lot.lotCode,status:lot.status,location:locationPath(state,lot.locationId),dimensions:material.category==='fabric'&&!lot.properties?.irregular&&Number.isFinite(lot.properties?.widthCm)&&Number.isFinite(lot.properties?.heightCm)?{width:lot.properties?.widthCm,height:lot.properties?.heightCm}:null,remnant:lot.properties?.cutRole==='remnant'};}),
    ...projectIds.map(id=>{const project=state.projects.find(row=>row.id===id);assert(project,'not_found');const pattern=state.patterns.find(row=>row.id===project.patternId),revision=pattern?.revisions?.find(row=>row.id===project.revisionId);return{id,kind:'project',name:project.name,patternName:pattern?.name??'',revisionName:revision?.name||revision?.id||''};}),
    ...locationIds.map(id=>{const location=state.locations.find(row=>row.id===id);assert(location,'not_found');return{id,kind:'location',name:location.name,location:locationPath(state,id)};}),
  ];
}
/** This exact geometry drives both the dialog preview and the PDF sheet. */
export function labelSheetLayout({paper='a4',labelWidth=90,labelHeight=56}={}){
  assert(['a4','letter'].includes(paper),'pdf_label_dimensions');
  labelWidth=quantity(labelWidth,{field:'labelWidth'});labelHeight=quantity(labelHeight,{field:'labelHeight'});
  assert(labelWidth>=30&&labelWidth<=180&&labelHeight>=20&&labelHeight<=250,'pdf_label_dimensions');
  const [width,height]=paper==='letter'?[215.9,279.4]:[210,297],margin=12,gap=4;
  const columns=Math.floor((width-2*margin+gap)/(labelWidth+gap)),rows=Math.floor((height-2*margin+gap)/(labelHeight+gap));
  assert(columns>0&&rows>0,'pdf_label_dimensions');
  return{paper,width,height,margin,gap,labelWidth,labelHeight,columns,rows,perPage:columns*rows};
}
export function inventoryLabelFields(item,locale='it'){
  const words=locale==='en'?{material:'Material',lot:'Lot',project:'Project',location:'Location / container',pattern:'Pattern',revision:'Revision',unknown:'Unknown',quantity:'Physical',remnant:'Remnant'}:{material:'Materiale',lot:'Lotto',project:'Progetto',location:'Posizione / contenitore',pattern:'Schema',revision:'Revisione',unknown:'Da verificare',quantity:'Fisico',remnant:'Rimanenza'};
  assert(item&&typeof item.id==='string'&&item.id.length>0&&['material','lot','project','location'].includes(item.kind),'not_found');
  const number=value=>new Intl.NumberFormat(locale==='en'?'en-GB':'it-IT',{maximumFractionDigits:6}).format(value);
  let fields;
  if(item.kind==='project')fields=[[item.name,10,'bold'],[words.project,8,'normal'],[item.patternName?`${words.pattern}: ${item.patternName}`:'',8,'normal'],[item.revisionName?`${words.revision}: ${item.revisionName}`:'',8,'normal']];
  else if(item.kind==='location')fields=[[item.name,10,'bold'],[words.location,8,'normal'],[item.location,8,'normal']];
  else {
    const amount=item.quantity==null?words.unknown:number(item.quantity);
    fields=[[item.material.name,10,'bold'],[[item.material.brand,item.material.range].filter(Boolean).join(' '),8,'normal'],[item.material.code||words[item.kind],11,'bold'],[`${words.quantity}: ${item.confidence==='estimated'?'~ ':''}${amount} ${item.material.unit}`,8,'normal'],[item.kind==='lot'?`${words.lot}: ${item.lotCode||'—'}${item.location?' · '+item.location:''}`:words.material,8,'normal']];
    if(item.remnant)fields.push([words.remnant,8,'normal']);
    if(item.dimensions)fields.push([`${number(item.dimensions.width)} × ${number(item.dimensions.height)} cm`,8,'normal']);
  }
  fields.push([`ID: ${item.id}`,6.5,'normal']);
  return fields.filter(([value])=>String(value??'').trim()).map(([value,size,style])=>({value:String(value),size,style}));
}
function fitLabel(doc,item,locale,width,height){
  const padding=3,inner=width-padding*2,fields=inventoryLabelFields(item,locale);
  for(const scale of [1,.9,.8,.7,.65]){
    const blocks=fields.map(field=>{const size=Math.max(6.5,field.size*scale);doc.setFont(PDF_FONT,field.style);doc.setFontSize(size);const lines=doc.splitTextToSize(pdfText(doc,field.value),inner),lineHeight=size*.42;return{...field,size,lines,lineHeight,height:lines.length*lineHeight+.7};});
    if(blocks.reduce((total,block)=>total+block.height,0)<=height-padding*2)return blocks;
  }
  assert(false,'pdf_label_overflow',{id:item.id});
}
export async function inventoryLabelsPdf(items, { locale='it',paper='a4',copies=1,labelWidth=90,labelHeight=56,fontBytes,boldFontBytes } = {}) {
  assert(Array.isArray(items)&&items.length>0&&items.length<=200&&Number.isInteger(copies)&&copies>=1&&copies<=10&&items.length*copies<=500,'inventory_batch_limit');
  const layout=labelSheetLayout({paper,labelWidth,labelHeight});
  const doc=await embedPdfFont(new jsPDF({unit:'mm',format:paper,compress:true}),{fontBytes,boldFontBytes});
  // Preflight every complete text before drawing a sheet; overflow never becomes a partial export.
  const prepared=items.map(item=>fitLabel(doc,item,locale,layout.labelWidth,layout.labelHeight));
  const labels=prepared.flatMap(blocks=>Array.from({length:copies},()=>blocks));
  for(const [index,blocks]of labels.entries()){
    const slot=index%layout.perPage;if(index&&slot===0)doc.addPage();
    const column=slot%layout.columns,row=Math.floor(slot/layout.columns),x=layout.margin+column*(layout.labelWidth+layout.gap),y=layout.margin+row*(layout.labelHeight+layout.gap);
    doc.setDrawColor('#b7aeb4');doc.rect(x,y,layout.labelWidth,layout.labelHeight);doc.setTextColor('#29272b');let top=y+3;
    for(const block of blocks){doc.setFont(PDF_FONT,block.style);doc.setFontSize(block.size);const baseline=top+block.size*25.4/72;block.lines.forEach((line,i)=>doc.text(line,x+3,baseline+i*block.lineHeight));top+=block.height;}
  }
  return new Uint8Array(doc.output('arraybuffer'));
}
