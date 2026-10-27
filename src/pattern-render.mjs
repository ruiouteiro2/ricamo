/** Canvas rendering shared by editor, thumbnails and tiled exports. Offsets and
 * sizes are pixels. The caller controls the bounded canvas backing store. */
export function drawPattern(canvas, revision, options = {}) {
  const cell = options.cellSize ?? 12, offsetX = options.offsetX ?? 0, offsetY = options.offsetY ?? 0;
  const cap = Math.min(4096, options.maxDimension ?? 2400);
  const width = Math.max(1, Math.min(cap, Math.ceil(options.width ?? revision.width * cell)));
  const height = Math.max(1, Math.min(cap, Math.ceil(options.height ?? revision.height * cell)));
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height); ctx.fillStyle = options.monochrome?'#fff':'#fffefa'; ctx.fillRect(0, 0, width, height);
  const completed = options.completed instanceof Set ? options.completed : new Set(options.completed ?? []);
  const left = Math.max(0, Math.floor(offsetX / cell)), top = Math.max(0, Math.floor(offsetY / cell));
  const right = Math.min(revision.width, Math.ceil((offsetX + width) / cell)), bottom = Math.min(revision.height, Math.ceil((offsetY + height) / cell));
  const opacity = color => options.highlightColor == null || options.highlightColor < 0 || options.highlightColor === color ? 1 : 0.2;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `${Math.max(5, cell * 0.62)}px monospace`;
  for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
    const index = y * revision.width + x, colorIndex = revision.cells[index];
    if (colorIndex < 0) continue;
    const color = revision.colors[colorIndex], px = x * cell - offsetX, py = y * cell - offsetY;
    ctx.globalAlpha = opacity(colorIndex); ctx.fillStyle = options.monochrome ? '#fff' : color.hex; ctx.fillRect(px, py, cell, cell);
    if (options.symbols && cell >= 7) {
      ctx.fillStyle = options.monochrome || (color.rgb[0] * .2126 + color.rgb[1] * .7152 + color.rgb[2] * .0722 > 145) ? (options.monochrome?'#171717':'#17151a') : '#fff';
      ctx.fillText(color.symbol ?? String(colorIndex + 1), px + cell / 2, py + cell / 2, cell * .86);
    }
    if (completed.has(`c:${index}`)) {
      ctx.globalAlpha = .7; ctx.fillStyle = '#fff'; ctx.fillRect(px, py, cell, cell);
      ctx.globalAlpha = 1; ctx.strokeStyle = options.monochrome?'#222222':'#225945'; ctx.lineWidth = Math.max(1, cell / 12); ctx.beginPath(); ctx.moveTo(px + cell * .18, py + cell * .52); ctx.lineTo(px + cell * .4, py + cell * .74); ctx.lineTo(px + cell * .83, py + cell * .23); ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  if (options.grid && cell >= 4) {
    for (let x = left; x <= right; x++) { ctx.strokeStyle = options.monochrome?(x%10?'#2a2a2a2b':'#2a2a2a8c'):(x % 10 ? '#2a25322b' : '#2a25328c'); ctx.lineWidth = x % 10 ? .5 : 1; ctx.beginPath(); ctx.moveTo(x * cell - offsetX, 0); ctx.lineTo(x * cell - offsetX, height); ctx.stroke(); }
    for (let y = top; y <= bottom; y++) { ctx.strokeStyle = options.monochrome?(y%10?'#2a2a2a2b':'#2a2a2a8c'):(y % 10 ? '#2a25322b' : '#2a25328c'); ctx.lineWidth = y % 10 ? .5 : 1; ctx.beginPath(); ctx.moveTo(0, y * cell - offsetY); ctx.lineTo(width, y * cell - offsetY); ctx.stroke(); }
  }
  for (const h of revision.halfStitches ?? []) {
    if (h.x < left || h.x >= right || h.y < top || h.y >= bottom) continue;
    ctx.globalAlpha = opacity(h.color); ctx.strokeStyle = completed.has(`h:${h.id}`) ? (options.monochrome?'#222222':'#225945') : options.monochrome ? '#171717' : revision.colors[h.color].hex;
    ctx.lineWidth = Math.max(1.5, cell * .16); ctx.beginPath();
    const x = h.x * cell - offsetX, y = h.y * cell - offsetY;
    ctx.moveTo(x + cell * .12, y + cell * (h.direction === '/' ? .88 : .12)); ctx.lineTo(x + cell * .88, y + cell * (h.direction === '/' ? .12 : .88)); ctx.stroke();
  }
  for (const b of revision.backstitches ?? []) {
    if (Math.max(b.x1, b.x2) * cell < offsetX || Math.min(b.x1, b.x2) * cell > offsetX + width || Math.max(b.y1, b.y2) * cell < offsetY || Math.min(b.y1, b.y2) * cell > offsetY + height) continue;
    ctx.globalAlpha = opacity(b.color); ctx.strokeStyle = completed.has(`b:${b.id}`) ? (options.monochrome?'#222222':'#225945') : options.monochrome ? '#171717' : revision.colors[b.color].hex;
    ctx.lineWidth = Math.max(1.2, cell * .12); ctx.beginPath(); ctx.moveTo(b.x1 * cell - offsetX, b.y1 * cell - offsetY); ctx.lineTo(b.x2 * cell - offsetX, b.y2 * cell - offsetY); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if(options.centerGuide) {
    const x=revision.width*cell/2-offsetX,y=revision.height*cell/2-offsetY;
    ctx.save();ctx.strokeStyle='#a34b22';ctx.lineWidth=1.5;ctx.setLineDash([5,4]);
    ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,height);ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke();ctx.restore();
  }
  if (options.selection) {
    const r = options.selection; ctx.strokeStyle = '#634453'; ctx.lineWidth = 2; ctx.setLineDash([5, 3]); ctx.fillStyle = '#63445318';
    ctx.fillRect(r.x * cell - offsetX, r.y * cell - offsetY, r.width * cell, r.height * cell); ctx.strokeRect(r.x * cell - offsetX, r.y * cell - offsetY, r.width * cell, r.height * cell); ctx.setLineDash([]);
  }
  if (options.cursor) {
    ctx.lineWidth = 2; ctx.strokeStyle = '#15121a'; ctx.strokeRect(options.cursor.x * cell - offsetX + 1, options.cursor.y * cell - offsetY + 1, cell - 2, cell - 2);
  }
  return canvas;
}
export function thumbnail(revision, maxSize = 600, options = {}) {
  const cellSize = Math.min(maxSize / revision.width, maxSize / revision.height);
  return drawPattern(document.createElement('canvas'), revision, { ...options, cellSize, width: Math.ceil(revision.width * cellSize), height: Math.ceil(revision.height * cellSize) }).toDataURL('image/png');
}
