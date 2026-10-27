import {appendProcurementPages} from './pattern-procurement-pdf.mjs';
import {fabricSize} from '../core/fabric.mjs';
import { jsPDF } from 'jspdf';
import { counts, validateRevision } from '../core/pattern.mjs';
import { drawPattern } from './pattern-render.mjs';
import { embedPdfFont, pdfText } from './pdf-font.mjs';
import { appendPatternLegend } from './pattern-legend.mjs';

const words = {
  it: { pattern: 'Schema di ricamo', legend: 'Legenda', bead:'Perline / decorazioni', stitch: 'Punti croce', half: 'Mezzi punti', back: 'Punto scritto', colors: 'Colori', page: 'Pagina', column: 'Colonne', row: 'Righe', overview: 'Mappa delle pagine', approximation: 'Colori digitali approssimati. Verificare su una cartella fisica.', completed: 'Progresso incluso', noProgress: 'Senza progresso', overlap: 'La fascia evidenziata si ripete dalla pagina precedente e non aumenta le quantità.', code: 'Codice / nome', strands: 'Numero di fili', notes: 'Note', scale: 'Schema ingrandito per la lettura, non a grandezza reale.', dimensions: 'Dimensioni in punti' },
  en: { pattern: 'Embroidery pattern', legend: 'Legend', bead:'Beads / embellishments', stitch: 'Full crosses', half: 'Half stitches', back: 'Backstitches', colors: 'Colours', page: 'Page', column: 'Columns', row: 'Rows', overview: 'Page map', approximation: 'Approximate digital colours. Check against a physical colour card.', completed: 'Progress included', noProgress: 'Without progress', overlap: 'The shaded strip repeats the previous page and does not increase quantities.', code: 'Code / name', strands: 'Strands', notes: 'Notes', scale: 'Enlarged reading chart, not actual size.', dimensions: 'Dimensions in stitches' },
};
export function pageTiles(width, height, columns = 50, rows = 60, overlap = 2) {
  if (![width, height, columns, rows, overlap].every(Number.isInteger) || width < 1 || height < 1 || columns <= overlap || rows <= overlap || overlap < 0) throw Error('invalid_page_geometry');
  const tiles = [];
  for (let y = 0, r = 0; y < height; y += rows - overlap, r++) {
    for (let x = 0, c = 0; x < width; x += columns - overlap, c++) {
      tiles.push({ x, y, width: Math.min(columns, width - x), height: Math.min(rows, height - y), row: r, column: c, overlapX: x ? overlap : 0, overlapY: y ? overlap : 0 });
      if (x + columns >= width) break;
    }
    if (y + rows >= height) break;
  }
  return tiles;
}
export async function patternPng(revision, { symbols = false, monochrome = false, completed = [] } = {}) {
  validateRevision(revision);
  const cellSize = Math.min(symbols ? 8 : 6, 4096 / Math.max(revision.width, revision.height));
  const canvas = drawPattern(document.createElement('canvas'), revision, { cellSize, width: revision.width * cellSize, height: revision.height * cellSize, maxDimension:4096, grid: symbols, symbols, monochrome, completed });
  const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(Error('image_export_failed')), 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}
/** Reading-chart geometry only. Physical transfer uses physical-print.mjs. */
export function patternPageLayout({ paper = 'a4', orientation = 'portrait', margin = 14, cellMm=4.5, headerHeight = 17.5 } = {}) {
  cellMm=Number(cellMm);
  margin = typeof margin === 'string' && margin.trim() ? Number(margin.replace(',', '.')) : margin;
  if (!['a4', 'letter'].includes(paper) || !['portrait', 'landscape'].includes(orientation) || !Number.isFinite(margin) || margin < 5 || margin > 40 || !Number.isFinite(headerHeight) || headerHeight < 0 || !Number.isFinite(cellMm) || cellMm<3.5 || cellMm>8) throw Object.assign(Error('pdf_page_settings'), { code: 'pdf_page_settings' });
  const portrait = paper === 'letter' ? [215.9, 279.4] : [210, 297];
  const [width, height] = orientation === 'landscape' ? [...portrait].reverse() : portrait;
  const usableWidth = width - 2 * margin, gridX = margin + 7, gridY = margin + headerHeight + 4;
  const columns = Math.floor((usableWidth - 8) / cellMm), rows = Math.floor((height - margin - 20 - gridY) / cellMm);
  if (columns <= 2 || rows <= 2) throw Object.assign(Error('pdf_export_limit'), { code: 'pdf_export_limit' });
  return { width, height, margin, usableWidth, cellMm, gridX, gridY, columns, rows };
}
export async function patternPreviewTiles(revision, {title='',locale='it',paper='a4',orientation='portrait',margin=14,cellMm=4.5,overlap=2}={}) {
  const initial=patternPageLayout({paper,orientation,margin,cellMm}),doc=new jsPDF({unit:'mm',format:paper,orientation});
  await embedPdfFont(doc);doc.setFontSize(16);
  const lines=doc.splitTextToSize(String(title||(words[locale]??words.it).pattern),initial.usableWidth);
  const layout=patternPageLayout({paper,orientation,margin,cellMm,headerHeight:lines.length*6.5+11});
  return pageTiles(revision.width,revision.height,layout.columns,layout.rows,overlap);
}
export async function patternPdf(revision, { title = '', locale = 'it', paper = 'a4', orientation = 'portrait', monochrome = false, completed = [], notes = '', overlap = 2, margin = 14, cellMm=4.5, thread = {}, design, procurement, fontBytes, boldFontBytes } = {}) {
  validateRevision(revision);
  const initial = patternPageLayout({ paper, orientation, margin,cellMm }); margin = initial.margin;
  const t = words[locale] ?? words.it, doc = new jsPDF({ unit: 'mm', format: paper, orientation, compress: true });
  await embedPdfFont(doc, { fontBytes, boldFontBytes });
  await globalThis.document?.fonts?.load('12px RicamoSymbols');
  pdfText(doc, title); pdfText(doc, notes);
  doc.setFontSize(16);
  const titleLines = doc.splitTextToSize(String(title || t.pattern), initial.usableWidth), titleHeight = titleLines.length * 6.5;
  const layout = patternPageLayout({ paper, orientation, margin,cellMm, headerHeight: titleHeight + 11 });
  const { width: pageWidth, height: pageHeight, usableWidth, cellMm:readingCellMm, columns, rows, gridX, gridY } = layout;
  const tiles = pageTiles(revision.width, revision.height, columns, rows, overlap), totals = counts(revision);
  if(tiles.length+2>500)throw Object.assign(Error('pdf_export_limit'),{code:'pdf_export_limit'});
  const heading = subtitle => {
    doc.setTextColor(monochrome?'#292929':'#29272b'); doc.setFontSize(16); doc.text(titleLines, margin, margin + 6, { lineHeightFactor: 6.5 / (16 * 25.4 / 72) });
    doc.setFontSize(9); const lines = doc.splitTextToSize(subtitle, usableWidth);
    if (lines.length > 2) throw Object.assign(Error('pdf_export_limit'), { code: 'pdf_export_limit' });
    doc.text(lines, margin, margin + titleHeight + 5, { lineHeightFactor: 4 / (9 * 25.4 / 72) });
  };
  heading(t.pattern); doc.setFontSize(10);
  const facts = [ `${t.dimensions}: ${revision.width} × ${revision.height} | ${t.colors}: ${revision.colors.length}`, `${t.stitch}: ${totals.full} | ${t.half}: ${totals.half} | ${t.back}: ${totals.backstitch}${totals.bead?` | ${t.bead}: ${totals.bead}`:''}` ].flatMap(line => doc.splitTextToSize(line, usableWidth));
  const fabric=procurement?.fabric?.configuration??design?.fabric??revision.settings?.fabric;if(fabric){const physical=fabricSize({width:revision.width,height:revision.height,...fabric});facts.push(...doc.splitTextToSize(`${locale==='en'?'Fabric':'Tessuto'}: ${[fabric.brand,fabric.range,fabric.colorName,fabric.code].filter(Boolean).join(' ')} · ${physical.widthCm.toFixed(2)} × ${physical.heightCm.toFixed(2)} cm · ${(fabric.countX/2.54).toFixed(2)} × ${(fabric.countY/2.54).toFixed(2)} ${locale==='en'?'per cm':'per cm'} (${fabric.countX} × ${fabric.countY} ct)`,usableWidth));}
  doc.text(facts, margin, gridY + 2, { lineHeightFactor: 5 / (10 * 25.4 / 72) });
  const imageY = gridY + facts.length * 5 + 5;
  doc.setFontSize(8);
  const remarks = [t.approximation, t.scale, completed.length ? t.completed : t.noProgress, 'Colour data: craft-color-codes / MakeBead, CC BY 4.0.'].flatMap(line => doc.splitTextToSize(line, usableWidth));
  const remarksY = pageHeight - margin - 10 - (remarks.length - 1) * 4;
  const coverCell = Math.min(700 / revision.width, 700 / revision.height), cover = drawPattern(document.createElement('canvas'), revision, { cellSize: coverCell, width: revision.width * coverCell, height: revision.height * coverCell, fabric,completed });
  if(monochrome){const ctx=cover.getContext('2d'),pixels=ctx.getImageData(0,0,cover.width,cover.height);for(let i=0;i<pixels.data.length;i+=4){const gray=Math.round(.2126*pixels.data[i]+.7152*pixels.data[i+1]+.0722*pixels.data[i+2]);pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=gray;}ctx.putImageData(pixels,0,0);}
  const scale = Math.min(usableWidth / cover.width, (remarksY - 7 - imageY) / cover.height);
  if (!(scale > 0)) throw Object.assign(Error('pdf_export_limit'), { code: 'pdf_export_limit' });
  doc.addImage(cover.toDataURL('image/png'), 'PNG', margin, imageY, cover.width * scale, cover.height * scale,undefined,'FAST');
  doc.text(remarks, margin, remarksY, { lineHeightFactor: 4 / (8 * 25.4 / 72) });
  doc.addPage(); heading(t.overview);
  const mapScale = Math.min(usableWidth / revision.width, (pageHeight - margin - gridY - 35) / revision.height);
  const mapH = revision.height * mapScale;
  doc.setFontSize(8);
  tiles.forEach((tile, index) => { doc.setDrawColor(monochrome?'#666666':'#94858d'); doc.rect(margin + tile.x * mapScale, gridY + tile.y * mapScale, tile.width * mapScale, tile.height * mapScale); doc.text(String(index + 1), Math.min(margin + tile.x * mapScale + 1, pageWidth - margin - doc.getTextWidth(String(index + 1))), gridY + tile.y * mapScale + 4); });
  doc.text(doc.splitTextToSize(t.overlap, usableWidth), margin, gridY + mapH + 10);
  appendPatternLegend(doc, revision, { locale, totals, margin, thread, monochrome, top: margin + 6, bottomMargin: margin + 10,includePurchaseLinks:!procurement });
  appendProcurementPages(doc,procurement,{locale,margin});
  for(const [index,tile] of tiles.entries()){
    if(doc.getNumberOfPages()>=500)throw Object.assign(Error('pdf_export_limit'),{code:'pdf_export_limit'});
    if(index%4===0)await new Promise(resolve=>setTimeout(resolve,0));
    doc.addPage(); heading(`${t.page} ${index + 1}/${tiles.length} | ${t.column} ${tile.x + 1}–${tile.x + tile.width} | ${t.row} ${tile.y + 1}–${tile.y + tile.height}`);
    const pixels = 54, image = drawPattern(document.createElement('canvas'), revision, { cellSize: pixels, offsetX: tile.x * pixels, offsetY: tile.y * pixels, width: tile.width * pixels, height: tile.height * pixels,maxDimension:4096,fabric, grid: true, symbols: true, monochrome, completed });
    doc.addImage(image.toDataURL('image/png'), 'PNG', gridX, gridY, tile.width * readingCellMm, tile.height * readingCellMm,undefined,'FAST');
    doc.setFontSize(7); doc.setTextColor(monochrome?'#292929':'#29272b');
    for (let col = 0; col < tile.width; col++) if (!col || (tile.x + col + 1) % 10 === 0) doc.text(String(tile.x + col + 1), Math.min(gridX + col * readingCellMm, pageWidth - margin - doc.getTextWidth(String(tile.x + col + 1))), gridY - 2);
    for (let row = 0; row < tile.height; row++) if (!row || (tile.y + row + 1) % 10 === 0) doc.text(String(tile.y + row + 1), margin, gridY + (row + .75) * readingCellMm);
    if (tile.overlapX || tile.overlapY) { doc.setDrawColor(monochrome?'#333333':'#634453'); doc.setLineWidth(.5); if (tile.overlapX) doc.rect(gridX, gridY, tile.overlapX * readingCellMm, tile.height * readingCellMm); if (tile.overlapY) doc.rect(gridX, gridY, tile.width * readingCellMm, tile.overlapY * readingCellMm); }
    doc.setFontSize(7); doc.text(doc.splitTextToSize(t.overlap, usableWidth), margin, pageHeight - margin - 13);
  }
  if (notes) {
    doc.setFontSize(10); const lines = doc.splitTextToSize(notes, usableWidth), perPage = Math.floor((pageHeight - margin - 13 - gridY) / 5);
    for (let start = 0; start < lines.length; start += perPage) { if(doc.getNumberOfPages()>=500)throw Object.assign(Error('pdf_export_limit'),{code:'pdf_export_limit'});doc.addPage(); heading(t.notes); doc.setFontSize(10); doc.text(lines.slice(start, start + perPage), margin, gridY + 3, { lineHeightFactor: 5 / (10 * 25.4 / 72) }); }
  }
  const total = doc.getNumberOfPages();
  for (let n = 1; n <= total; n++) { doc.setPage(n); doc.setFontSize(7); doc.text(`${n} / ${total}`, pageWidth - margin, pageHeight - margin - 1, { align: 'right' }); }
  return new Uint8Array(doc.output('arraybuffer'));
}
