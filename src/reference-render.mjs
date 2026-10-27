import { displayPoint, displayRect } from '../core/references.mjs';

export function drawReferenceAnnotations(canvas, annotations, { rotation = 0, selectedId = null, preview = null, clear = true } = {}) {
  const context = canvas.getContext('2d'), width = canvas.width, height = canvas.height;
  if (clear) context.clearRect(0, 0, width, height);
  const marks = preview ? [...annotations, preview] : annotations;
  for (const mark of marks) {
    context.save(); context.strokeStyle = mark.color; context.fillStyle = mark.color;
    context.lineWidth = Math.max(1.5, Math.min(width, height) * .003); context.globalAlpha = mark.opacity;
    if (mark.type === 'line') {
      const a = displayPoint(mark, rotation), b = displayPoint({ x: mark.x2, y: mark.y2 }, rotation);
      context.beginPath(); context.moveTo(a.x * width, a.y * height); context.lineTo(b.x * width, b.y * height); context.stroke();
    } else if (mark.type === 'text') {
      const point = displayPoint(mark, rotation), fontSize = Math.max(12, Math.min(32, width * .023));
      context.font = `${fontSize}px "Segoe UI", sans-serif`; context.textBaseline = 'top';
      const lines = wrapText(context, mark.text, Math.max(60, Math.min(width * .42, width - point.x * width - 10)));
      const x = Math.min(point.x * width, width - 70), y = Math.min(point.y * height, height - fontSize * 1.3);
      context.globalAlpha = .92; context.fillStyle = '#fffefa'; context.fillRect(x - 4, y - 3, Math.min(width - x, Math.max(...lines.map(line => context.measureText(line).width), 30) + 8), fontSize * 1.25 * lines.length + 5);
      context.globalAlpha = mark.opacity; context.fillStyle = mark.color;
      lines.forEach((line, index) => context.fillText(line, x, y + index * fontSize * 1.25));
    } else {
      const rect = displayRect(mark, rotation);
      if (mark.type === 'highlight') context.fillRect(rect.x * width, rect.y * height, rect.width * width, rect.height * height);
      else context.strokeRect(rect.x * width, rect.y * height, rect.width * width, rect.height * height);
    }
    if (selectedId === mark.id && mark.type !== 'text' && mark.type !== 'line') {
      const rect = displayRect(mark, rotation); context.globalAlpha = 1; context.strokeStyle = '#29272b'; context.setLineDash([6, 4]); context.strokeRect(rect.x * width, rect.y * height, rect.width * width, rect.height * height);
    }
    context.restore();
  }
}
function wrapText(context, text, maxWidth) {
  const lines = [];
  for (const paragraph of String(text).split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && context.measureText(candidate).width > maxWidth) { lines.push(line); line = word; } else line = candidate;
    }
    lines.push(line);
  }
  return lines.slice(0, 50);
}

/** Raster marks can extend past an edge. Include complete note text in a printable
 * appendix, bounded together with the document to avoid unbounded PDF growth. */
export function appendReferenceNotes(pdf, annotations, { locale = 'it', maxPages = 300 } = {}) {
  const notes = annotations.filter(mark => mark.text?.trim());
  if (!notes.length) return 0;
  const english = locale === 'en', firstCount = pdf.getNumberOfPages();
  let y;
  function addPage() {
    if (pdf.getNumberOfPages() >= maxPages) throw Object.assign(new Error('reference_export_limit'), { code: 'reference_export_limit' });
    pdf.addPage('a4', 'portrait'); pdf.setTextColor(41, 39, 43); pdf.setFontSize(14);
    pdf.text(english ? 'Reference notes' : 'Note del riferimento', 14, 18); y = 29;
  }
  addPage();
  for (const [index, mark] of notes.entries()) {
    if (y > 265) addPage();
    pdf.setFontSize(10); pdf.text(`${english ? 'Page' : 'Pagina'} ${mark.page} · ${english ? 'Note' : 'Nota'} ${index + 1}`, 14, y); y += 7;
    pdf.setFontSize(9);
    for (const line of pdf.splitTextToSize(mark.text, 182)) {
      if (y > 282) { addPage(); pdf.setFontSize(9); }
      pdf.text(line, 14, y); y += 4.5;
    }
    y += 6;
  }
  return pdf.getNumberOfPages() - firstCount;
}
