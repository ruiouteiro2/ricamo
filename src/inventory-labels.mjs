import { jsPDF } from 'jspdf';
import { inventorySummary } from '../core/inventory.mjs';
import { assert } from '../core/shared.mjs';

export function inventoryLabelItems(state, { materialIds = [], lotIds = [] } = {}) {
  assert(Array.isArray(materialIds) && Array.isArray(lotIds) && materialIds.length + lotIds.length > 0 && materialIds.length + lotIds.length <= 200, 'inventory_batch_limit');
  assert(new Set(materialIds).size === materialIds.length && new Set(lotIds).size === lotIds.length, 'duplicate_selection');
  const materials = new Map(state.materials.map(row => [row.id,row]));
  return [
    ...materialIds.map(id => { const material=materials.get(id); assert(material,'not_found'); return { id, kind:'material', material, quantity:inventorySummary(state,id).physical, location:'' }; }),
    ...lotIds.map(id => { const lot=state.lots.find(row=>row.id===id); assert(lot,'not_found'); const material=materials.get(lot.materialId); assert(material,'not_found'); const names=[],seen=new Set(); let location=lot.locationId; while(location&&!seen.has(location)){seen.add(location);const row=state.locations.find(item=>item.id===location);if(!row)break;names.unshift(row.name);location=row.parentId;} return { id,kind:'lot',material,quantity:lot.quantity,confidence:lot.confidence,lotCode:lot.lotCode,status:lot.status,location:names.join(' / ') }; }),
  ];
}
export function inventoryLabelsPdf(items, { locale='it',paper='a4',copies=1 } = {}) {
  assert(Array.isArray(items)&&items.length>0&&items.length<=200&&Number.isInteger(copies)&&copies>=1&&copies<=10&&items.length*copies<=500,'inventory_batch_limit');
  const labels=items.flatMap(item=>Array.from({length:copies},()=>item));
  const doc=new jsPDF({unit:'mm',format:paper==='letter'?'letter':'a4',compress:false});
  const width=doc.internal.pageSize.getWidth(),height=doc.internal.pageSize.getHeight(),margin=12,gap=4,labelWidth=(width-2*margin-gap)/2,labelHeight=56,rows=Math.floor((height-2*margin)/ (labelHeight+gap)),perPage=rows*2;
  const words=locale==='en'?{material:'Material',lot:'Lot',unknown:'Unknown',quantity:'Physical',location:'Location'}:{material:'Materiale',lot:'Lotto',unknown:'Da verificare',quantity:'Fisico',location:'Posizione'};
  const clean=value=>String(value??'').replace(/[\u0000-\u001f]/g,' ');
  labels.forEach((item,index)=>{
    if(index&&index%perPage===0)doc.addPage();
    const position=index%perPage,x=margin+(position%2)*(labelWidth+gap),y=margin+Math.floor(position/2)*(labelHeight+gap),inner=labelWidth-8;
    doc.setDrawColor('#b7aeb4');doc.rect(x,y,labelWidth,labelHeight);doc.setTextColor('#29272b');doc.setFont('helvetica','bold');doc.setFontSize(10);
    doc.text(doc.splitTextToSize(clean(item.material.name),inner).slice(0,2),x+4,y+7);
    doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text(doc.splitTextToSize(clean(`${item.material.brand} ${item.material.range}`.trim()),inner).slice(0,1),x+4,y+17);
    doc.setFont('helvetica','bold');doc.setFontSize(11);doc.text(doc.splitTextToSize(clean(item.material.code||words[item.kind]),inner).slice(0,1),x+4,y+23);
    doc.setFont('helvetica','normal');doc.setFontSize(8);const amount=item.quantity===null?words.unknown:new Intl.NumberFormat(locale==='en'?'en-GB':'it-IT',{maximumFractionDigits:6}).format(item.quantity);
    doc.text(`${words.quantity}: ${item.confidence==='estimated'?'~ ':''}${amount} ${item.material.unit}`,x+4,y+29);
    doc.text(doc.splitTextToSize(clean(item.kind==='lot'?`${words.lot}: ${item.lotCode||'—'} · ${item.location||''}`:words.material),inner).slice(0,2),x+4,y+35);
    doc.setFontSize(6.5);doc.text(doc.splitTextToSize(`ID: ${clean(item.id)}`,inner),x+4,y+46);
  });
  return new Uint8Array(doc.output('arraybuffer'));
}
