import { jsPDF } from 'jspdf';
import { counts, validateRevision } from '../core/pattern.mjs';
import { drawPattern } from './pattern-render.mjs';

const words = {
  it: { pattern: 'Schema di ricamo', legend: 'Legenda', stitch: 'Punti croce', half: 'Mezzi punti', back: 'Punto scritto', colors: 'Colori', page: 'Pagina', column: 'Colonne', row: 'Righe', overview: 'Mappa delle pagine', approximation: 'Colori digitali approssimati. Verificare su una cartella fisica.', completed: 'Progresso incluso', noProgress: 'Senza progresso', overlap: 'La fascia evidenziata si ripete dalla pagina precedente e non aumenta le quantità.', code: 'Codice / nome', strands: 'Filamenti', notes: 'Note', scale: 'Schema ingrandito per la lettura, non a grandezza reale.', dimensions: 'Dimensioni in punti' },
  en: { pattern: 'Embroidery pattern', legend: 'Legend', stitch: 'Full crosses', half: 'Half stitches', back: 'Backstitches', colors: 'Colours', page: 'Page', column: 'Columns', row: 'Rows', overview: 'Page map', approximation: 'Approximate digital colours. Check against a physical colour card.', completed: 'Progress included', noProgress: 'Without progress', overlap: 'The shaded strip repeats the previous page and does not increase quantities.', code: 'Code / name', strands: 'Strands', notes: 'Notes', scale: 'Enlarged reading chart, not actual size.', dimensions: 'Dimensions in stitches' },
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
export function patternPdf(revision, { title = '', locale = 'it', paper = 'a4', monochrome = false, completed = [], notes = '', overlap = 2, margin = 14 } = {}) {
  validateRevision(revision);
  const t = words[locale] ?? words.it, doc = new jsPDF({ unit: 'mm', format: paper === 'letter' ? 'letter' : 'a4', compress: true });
  const pageWidth = doc.internal.pageSize.getWidth(), pageHeight = doc.internal.pageSize.getHeight();
  const usableWidth = pageWidth - 2 * margin, cellMm = 3.5, columns = Math.max(10, Math.floor((usableWidth - 8) / cellMm)), rows = Math.max(10, Math.floor((pageHeight - 58 - margin) / cellMm));
  const tiles = pageTiles(revision.width, revision.height, columns, rows, overlap), totals = counts(revision);
  const heading = subtitle => { doc.setTextColor('#29272b'); doc.setFontSize(16); doc.text(String(title || t.pattern).slice(0, 95), margin, 17); doc.setFontSize(9); doc.text(subtitle, margin, 24); };
  heading(t.pattern); doc.setFontSize(10); doc.text(`${t.dimensions}: ${revision.width} × ${revision.height} | ${t.colors}: ${revision.colors.length}`, margin, 34);
  doc.text(`${t.stitch}: ${totals.full} | ${t.half}: ${totals.half} | ${t.back}: ${totals.backstitch}`, margin, 41);
  const coverCell = Math.min(700 / revision.width, 700 / revision.height), cover = drawPattern(document.createElement('canvas'), revision, { cellSize: coverCell, width: revision.width * coverCell, height: revision.height * coverCell, completed });
  const scale = Math.min(usableWidth / cover.width, (pageHeight - 112) / cover.height);
  doc.addImage(cover.toDataURL('image/png'), 'PNG', margin, 49, cover.width * scale, cover.height * scale);
  doc.setFontSize(8); doc.text(t.approximation, margin, pageHeight - 38); doc.text(t.scale, margin, pageHeight - 32);
  doc.text(completed.length ? t.completed : t.noProgress, margin, pageHeight - 26);
  doc.text('Colour data: craft-color-codes / MakeBead, CC BY 4.0.', margin, pageHeight - 20);
  doc.addPage(); heading(t.overview);
  const mapW = Math.min(usableWidth, 160), mapH = Math.min(pageHeight - 100, mapW * revision.height / revision.width), sx = mapW / revision.width, sy = mapH / revision.height;
  doc.setFontSize(8);
  tiles.forEach((tile, index) => { doc.setDrawColor('#94858d'); doc.rect(margin + tile.x * sx, 38 + tile.y * sy, tile.width * sx, tile.height * sy); doc.text(String(index + 1), margin + tile.x * sx + 2, 43 + tile.y * sy); });
  doc.text(doc.splitTextToSize(t.overlap, usableWidth), margin, 48 + mapH);
  const perLegend = Math.floor((pageHeight - 68) / 8);
  for (let start = 0; start < revision.colors.length; start += perLegend) {
    doc.addPage(); heading(t.legend); doc.setFontSize(8); doc.text(t.code, margin + 16, 35); doc.text(`${t.stitch} / ${t.half} / ${t.back}`, pageWidth - margin - 70, 35); doc.text(t.strands, pageWidth - margin - 15, 35);
    revision.colors.slice(start, start + perLegend).forEach((color, offset) => {
      const index = start + offset, y = 44 + offset * 8;
      doc.setFillColor(color.hex); doc.rect(margin, y - 4, 5, 5, 'F'); doc.setTextColor('#29272b'); doc.text(color.symbol ?? String(index + 1), margin + 7, y);
      doc.text(`${color.brand ?? ''} ${color.code} ${color.name}`.slice(0, 52), margin + 16, y);
      const c = totals.byColor[index]; doc.text(`${c.full} / ${c.half} / ${c.backstitch}`, pageWidth - margin - 70, y); doc.text(String(color.strands ?? revision.settings?.strands ?? 2), pageWidth - margin - 12, y);
    });
  }
  tiles.forEach((tile, index) => {
    doc.addPage(); heading(`${t.page} ${index + 1}/${tiles.length} | ${t.column} ${tile.x + 1}–${tile.x + tile.width} | ${t.row} ${tile.y + 1}–${tile.y + tile.height}`);
    const pixels = 14, image = drawPattern(document.createElement('canvas'), revision, { cellSize: pixels, offsetX: tile.x * pixels, offsetY: tile.y * pixels, width: tile.width * pixels, height: tile.height * pixels, grid: true, symbols: true, monochrome, completed });
    const x = margin + 7, y = 36;
    doc.addImage(image.toDataURL('image/png'), 'PNG', x, y, tile.width * cellMm, tile.height * cellMm);
    doc.setFontSize(7); doc.setTextColor('#29272b');
    for (let col = 0; col < tile.width; col++) if (!col || (tile.x + col + 1) % 10 === 0) doc.text(String(tile.x + col + 1), x + col * cellMm, y - 2);
    for (let row = 0; row < tile.height; row++) if (!row || (tile.y + row + 1) % 10 === 0) doc.text(String(tile.y + row + 1), margin, y + (row + .75) * cellMm);
    if (tile.overlapX || tile.overlapY) { doc.setDrawColor('#634453'); doc.setLineWidth(.5); if (tile.overlapX) doc.rect(x, y, tile.overlapX * cellMm, tile.height * cellMm); if (tile.overlapY) doc.rect(x, y, tile.width * cellMm, tile.overlapY * cellMm); }
    doc.setFontSize(7); doc.text(doc.splitTextToSize(t.overlap, usableWidth), margin, pageHeight - 17);
  });
  if (notes) {
    const lines = doc.splitTextToSize(notes, usableWidth), perPage = Math.floor((pageHeight - 55) / 5);
    for (let start = 0; start < lines.length; start += perPage) { doc.addPage(); heading(t.notes); doc.setFontSize(10); doc.text(lines.slice(start, start + perPage), margin, 37); }
  }
  const total = doc.getNumberOfPages();
  for (let n = 1; n <= total; n++) { doc.setPage(n); doc.setFontSize(7); doc.text(`${n} / ${total}`, pageWidth - margin - 12, pageHeight - 8); }
  return new Uint8Array(doc.output('arraybuffer'));
}
