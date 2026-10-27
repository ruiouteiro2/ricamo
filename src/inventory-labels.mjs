import { jsPDF } from 'jspdf';
import { inventorySummary } from '../core/inventory.mjs';
import { assert } from '../core/shared.mjs';
import { embedPdfFont, pdfText, PDF_FONT } from './pdf-font.mjs';

export function inventoryLabelItems(state, { materialIds = [], lotIds = [] } = {}) {
  assert(Array.isArray(materialIds) && Array.isArray(lotIds) && materialIds.length + lotIds.length > 0 && materialIds.length + lotIds.length <= 200, 'inventory_batch_limit');
  assert(new Set(materialIds).size === materialIds.length && new Set(lotIds).size === lotIds.length, 'duplicate_selection');
  const materials = new Map(state.materials.map(row => [row.id,row]));
  return [
    ...materialIds.map(id => { const material=materials.get(id); assert(material,'not_found'); return { id, kind:'material', material, quantity:inventorySummary(state,id).physical, location:'' }; }),
    ...lotIds.map(id => { const lot=state.lots.find(row=>row.id===id); assert(lot,'not_found'); const material=materials.get(lot.materialId); assert(material,'not_found'); const names=[],seen=new Set(); let location=lot.locationId; while(location&&!seen.has(location)){seen.add(location);const row=state.locations.find(item=>item.id===location);if(!row)break;names.unshift(row.name);location=row.parentId;} return { id,kind:'lot',material,quantity:lot.quantity,confidence:lot.confidence,lotCode:lot.lotCode,status:lot.status,location:names.join(' / ') }; }),
  ];
}
export async function inventoryLabelsPdf(items, { locale = 'it', paper = 'a4', copies = 1, fontBytes, boldFontBytes } = {}) {
  assert(Array.isArray(items) && items.length > 0 && items.length <= 200 && Number.isInteger(copies) && copies >= 1 && copies <= 10 && items.length * copies <= 500, 'inventory_batch_limit');
  const doc = await embedPdfFont(new jsPDF({ unit: 'mm', format: paper === 'letter' ? 'letter' : 'a4', compress: true }), { fontBytes, boldFontBytes });
  const width = doc.internal.pageSize.getWidth(), height = doc.internal.pageSize.getHeight();
  const margin = 12, gap = 4, labelWidth = (width - 2 * margin - gap) / 2, inner = labelWidth - 8;
  const words = locale === 'en' ? { material: 'Material', lot: 'Lot', unknown: 'Unknown', quantity: 'Physical' } : { material: 'Materiale', lot: 'Lotto', unknown: 'Da verificare', quantity: 'Fisico' };
  const labels = items.flatMap(item => Array.from({ length: copies }, () => item)).map(item => {
    const amount = item.quantity === null ? words.unknown : new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'it-IT', { maximumFractionDigits: 6 }).format(item.quantity);
    const fields = [
      [item.material.name, 10, 'bold'],
      [[item.material.brand, item.material.range].filter(Boolean).join(' '), 8, 'normal'],
      [item.material.code || words[item.kind], 11, 'bold'],
      [`${words.quantity}: ${item.confidence === 'estimated' ? '~ ' : ''}${amount} ${item.material.unit}`, 8, 'normal'],
      [item.kind === 'lot' ? `${words.lot}: ${item.lotCode || '—'} · ${item.location || ''}` : words.material, 8, 'normal'],
      [`ID: ${item.id}`, 6.5, 'normal'],
    ];
    const blocks = fields.map(([value, size, style]) => {
      doc.setFont(PDF_FONT, style); doc.setFontSize(size);
      const lines = doc.splitTextToSize(pdfText(doc, value), inner), lineHeight = size * .42;
      return { lines, size, style, lineHeight, height: lines.length * lineHeight + 2 };
    });
    const labelHeight = Math.max(56, blocks.reduce((total, block) => total + block.height, 8));
    assert(labelHeight <= height - 2 * margin, 'pdf_label_overflow');
    return { blocks, height: labelHeight };
  });
  let y = margin;
  for (let index = 0; index < labels.length; index += 2) {
    const pair = labels.slice(index, index + 2), rowHeight = Math.max(...pair.map(label => label.height));
    if (y + rowHeight > height - margin) { doc.addPage(); y = margin; }
    for (const [column, label] of pair.entries()) {
      const x = margin + column * (labelWidth + gap);
      doc.setDrawColor('#b7aeb4'); doc.rect(x, y, labelWidth, rowHeight); doc.setTextColor('#29272b');
      let baseline = y + 6;
      for (const block of label.blocks) {
        doc.setFont(PDF_FONT, block.style); doc.setFontSize(block.size);
        block.lines.forEach((line, lineIndex) => doc.text(line, x + 4, baseline + lineIndex * block.lineHeight));
        baseline += block.height;
      }
    }
    y += rowHeight + gap;
  }
  return new Uint8Array(doc.output('arraybuffer'));
}
