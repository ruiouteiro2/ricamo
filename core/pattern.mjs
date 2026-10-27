import { catalogueReference } from './thread-catalogues.mjs';
import { validateThreadColor, blendSignature } from './thread-recipes.mjs';
/** Immutable, bounded geometry for Ricamo's version-one structured revisions.
 * Cells are whole crosses; half stitches and backstitches remain distinct.
 * The caller assigns revision identities and persists named/autosaved revisions.
 */
export const LIMITS = Object.freeze({ width: 500, height: 500, colors: 80, segments: 250000 });
export const SYMBOLS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&*+=?!:;<>[]{}~';

export class PatternError extends Error {
  constructor(code, details = {}) { super(code); this.name = 'PatternError'; this.code = code; this.details = details; }
}
const fail = (code, details) => { throw new PatternError(code, details); };
const integer = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
const clone = value => structuredClone(value);
const validSize = (width, height) => {
  if (!integer(width, 1, LIMITS.width) || !integer(height, 1, LIMITS.height)) fail('pattern.dimensions', { max: LIMITS.width });
};
const validPoint = (p, x, y) => integer(x, 0, p.width - 1) && integer(y, 0, p.height - 1);
const validColor = (p, color, allowEmpty = false) => integer(color, allowEmpty ? -1 : 0, p.colors.length - 1);
const validVertex = (p, x, y) => Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0 && x <= p.width && y <= p.height && Number.isInteger(x * 2) && Number.isInteger(y * 2);

export function validateColors(colors, { allowEmpty = true } = {}) {
  if (!Array.isArray(colors) || colors.length > LIMITS.colors || (!allowEmpty && !colors.length)) fail('pattern.palette');
  const symbols = new Set();
  for (const [index, color] of colors.entries()) {
    if (!color || typeof color.code !== 'string' || typeof color.name !== 'string' || !/^#[0-9a-f]{6}$/i.test(color.hex)
      || !Array.isArray(color.rgb) || color.rgb.length !== 3 || color.rgb.some(v => !integer(v, 0, 255))) fail('pattern.color', { index });
    if (color.brand !== undefined && typeof color.brand !== 'string') fail('pattern.color', { index });
    if (color.symbol !== undefined) {
      if (typeof color.symbol !== 'string' || !color.symbol.trim() || color.symbol.length > 4 || symbols.has(color.symbol)) fail('pattern.symbol', { index });
      symbols.add(color.symbol);
    }
    validateThreadColor(color);
    if(color.catalogueRef!==undefined)catalogueReference(color.catalogueRef);
    if (color.strands !== undefined && !integer(color.strands, 1, 12)) fail('pattern.strands', { index });
  }
  return colors;
}

export function validateRevision(p) {
  if (!p || typeof p !== 'object' || (p.formatVersion !== undefined && p.formatVersion !== 1) || (p.version !== undefined && p.version !== 1)) fail('pattern.version');
  for (const field of ['quarterStitches', 'threeQuarterStitches', 'knots', 'beads']) if (p[field]?.length) fail('pattern.unsupportedPrimitive', { field });
  validSize(p.width, p.height);
  validateColors(p.colors);
  if (!Array.isArray(p.cells) || p.cells.length !== p.width * p.height || p.cells.some(c => !validColor(p, c, true))) fail('pattern.cells');
  const half = p.halfStitches ?? [], back = p.backstitches ?? [];
  if (!Array.isArray(half) || !Array.isArray(back) || half.length > LIMITS.segments || back.length > LIMITS.segments) fail('pattern.primitives');
  const ids = new Set();
  for (const h of half) {
    if (!h || typeof h.id !== 'string' || !h.id || ids.has(`h:${h.id}`) || !validPoint(p, h.x, h.y) || !validColor(p, h.color) || !['/', '\\'].includes(h.direction)) fail('pattern.halfStitch');
    ids.add(`h:${h.id}`);
  }
  for (const b of back) {
    if (!b || typeof b.id !== 'string' || !b.id || ids.has(`b:${b.id}`) || !validVertex(p, b.x1, b.y1) || !validVertex(p, b.x2, b.y2)
      || (b.x1 === b.x2 && b.y1 === b.y2) || !validColor(p, b.color)) fail('pattern.backstitch');
    ids.add(`b:${b.id}`);
  }
  return p;
}

export function createBlank(width, height, colors = [], metadata = {}) {
  validSize(width, height);
  const p = { ...clone(metadata), width, height, colors: clone(colors), cells: Array(width * height).fill(-1), halfStitches: [], backstitches: [] };
  validateRevision(p);
  return p;
}

export function counts(p) {
  validateRevision(p);
  const byColor = p.colors.map((color, index) => ({ index, color, full: 0, half: 0, backstitch: 0, backstitchLength: 0, total: 0 }));
  for (const index of p.cells) if (index >= 0) { byColor[index].full++; byColor[index].total++; }
  for (const h of p.halfStitches ?? []) { byColor[h.color].half++; byColor[h.color].total++; }
  for (const b of p.backstitches ?? []) { byColor[b.color].backstitch++; byColor[b.color].total++; byColor[b.color].backstitchLength += Math.hypot(b.x2 - b.x1, b.y2 - b.y1); }
  const full = byColor.reduce((n, c) => n + c.full, 0), half = (p.halfStitches ?? []).length, backstitch = (p.backstitches ?? []).length;
  return { full, half, backstitch, total: full + half + backstitch, byColor };
}

export function primitiveKeys(p) {
  validateRevision(p);
  return [...p.cells.flatMap((c, i) => c < 0 ? [] : [`c:${i}`]), ...(p.halfStitches ?? []).map(h => `h:${h.id}`), ...(p.backstitches ?? []).map(b => `b:${b.id}`)];
}

export function paint(p, points, color) {
  validateRevision(p);
  if (!validColor(p, color, true) || !Array.isArray(points)) fail('pattern.paint');
  const indices = points.map(point => {
    if (!point || typeof point !== 'object') fail('pattern.coordinates');
    const x = Array.isArray(point) ? point[0] : point.x, y = Array.isArray(point) ? point[1] : point.y;
    if (!validPoint(p, x, y)) fail('pattern.coordinates', { x, y });
    return y * p.width + x;
  });
  const next = clone(p);
  for (const i of indices) next.cells[i] = color;
  return next;
}

export function fill(p, x, y, color) {
  validateRevision(p);
  if (!validPoint(p, x, y) || !validColor(p, color, true)) fail('pattern.coordinates', { x, y });
  const next = clone(p), start = y * p.width + x, from = p.cells[start];
  if (from === color) return next;
  const pending = [start]; next.cells[start] = color;
  for (let cursor = 0; cursor < pending.length; cursor++) {
    const i = pending[cursor], px = i % p.width, py = Math.floor(i / p.width);
    for (const n of [px ? i - 1 : -1, px < p.width - 1 ? i + 1 : -1, py ? i - p.width : -1, py < p.height - 1 ? i + p.width : -1]) {
      if (n >= 0 && next.cells[n] === from) { next.cells[n] = color; pending.push(n); }
    }
  }
  return next;
}

export function replaceColor(p, from, to) {
  validateRevision(p);
  if (!validColor(p, from) || !validColor(p, to, true)) fail('pattern.colorIndex');
  const next = clone(p);
  next.cells = next.cells.map(c => c === from ? to : c);
  next.halfStitches = (next.halfStitches ?? []).filter(h => !(to < 0 && h.color === from)).map(h => ({ ...h, color: h.color === from ? to : h.color }));
  next.backstitches = (next.backstitches ?? []).filter(b => !(to < 0 && b.color === from)).map(b => ({ ...b, color: b.color === from ? to : b.color }));
  return next;
}

export function line(p, x1, y1, x2, y2, color) {
  validateRevision(p);
  if (!validPoint(p, x1, y1) || !validPoint(p, x2, y2)) fail('pattern.coordinates');
  const points = [], dx = Math.abs(x2 - x1), sx = x1 < x2 ? 1 : -1, dy = -Math.abs(y2 - y1), sy = y1 < y2 ? 1 : -1;
  let error = dx + dy, x = x1, y = y1;
  for (;;) {
    points.push([x, y]); if (x === x2 && y === y2) break;
    const twice = 2 * error;
    if (twice >= dy) { error += dy; x += sx; }
    if (twice <= dx) { error += dx; y += sy; }
  }
  return paint(p, points, color);
}

function validateRect(p, rect) {
  if (!rect || !integer(rect.x, 0, p.width - 1) || !integer(rect.y, 0, p.height - 1) || !integer(rect.width, 1, p.width) || !integer(rect.height, 1, p.height)
    || rect.x + rect.width > p.width || rect.y + rect.height > p.height) fail('pattern.selection');
  return rect;
}
export function rectangle(p, rect, color, { filled = false } = {}) {
  validateRevision(p); validateRect(p, rect);
  const points = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) for (let x = rect.x; x < rect.x + rect.width; x++) {
    if (filled || x === rect.x || x === rect.x + rect.width - 1 || y === rect.y || y === rect.y + rect.height - 1) points.push([x, y]);
  }
  return paint(p, points, color);
}

const inRect = (x, y, r) => x >= r.x && y >= r.y && x < r.x + r.width && y < r.y + r.height;
const segmentInRect = (b, r) => b.x1 >= r.x && b.y1 >= r.y && b.x1 <= r.x + r.width && b.y1 <= r.y + r.height
  && b.x2 >= r.x && b.y2 >= r.y && b.x2 <= r.x + r.width && b.y2 <= r.y + r.height;

/** Selection copies whole primitives. Crossing backstitches stay outside the selection;
 * `excludedCrossingSegments` allows the UI to explain this before moving/cropping. */
export function copySelection(p, rect) {
  validateRevision(p); validateRect(p, rect);
  const selection = createBlank(rect.width, rect.height, p.colors);
  for (let y = 0; y < rect.height; y++) for (let x = 0; x < rect.width; x++) selection.cells[y * rect.width + x] = p.cells[(rect.y + y) * p.width + rect.x + x];
  selection.halfStitches = (p.halfStitches ?? []).filter(h => inRect(h.x, h.y, rect)).map(h => ({ ...clone(h), x: h.x - rect.x, y: h.y - rect.y }));
  selection.backstitches = (p.backstitches ?? []).filter(b => segmentInRect(b, rect)).map(b => ({ ...clone(b), x1: b.x1 - rect.x, y1: b.y1 - rect.y, x2: b.x2 - rect.x, y2: b.y2 - rect.y }));
  selection.excludedCrossingSegments = (p.backstitches ?? []).filter(b => !segmentInRect(b, rect) && segmentIntersectsRect(b, rect)).map(b => b.id);
  return selection;
}
export const select = copySelection;
export const copy = copySelection;

function segmentIntersectsRect(b, r) {
  let t0 = 0, t1 = 1;
  const dx = b.x2 - b.x1, dy = b.y2 - b.y1;
  for (const [den, num] of [[-dx, b.x1 - r.x], [dx, r.x + r.width - b.x1], [-dy, b.y1 - r.y], [dy, r.y + r.height - b.y1]]) {
    if (den === 0) { if (num < 0) return false; }
    else { const t = num / den; if (den < 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t); if (t0 > t1) return false; }
  }
  return true;
}

const identity = c => JSON.stringify([c.itemId ?? '', c.brand ?? '', c.range ?? '', c.code, c.hex, c.strands ?? 2, c.backStrands ?? 1, blendSignature(c)]);
function mergeColors(target, source, usedIndices) {
  const colors = clone(target), map = [];
  const symbols = new Set(colors.map(c => c.symbol).filter(Boolean));
  for (const [sourceIndex, color] of source.entries()) {
    if (!usedIndices.has(sourceIndex)) { map.push(-1); continue; }
    let index = colors.findIndex(c => identity(c) === identity(color));
    if (index < 0) {
      if (colors.length >= LIMITS.colors) fail('pattern.paletteLimit', { max: LIMITS.colors });
      const added = clone(color);
      if (!added.symbol || symbols.has(added.symbol)) added.symbol = [...SYMBOLS].find(s => !symbols.has(s));
      if (!added.symbol) fail('pattern.symbol');
      symbols.add(added.symbol); colors.push(added); index = colors.length - 1;
    }
    map.push(index);
  }
  return { colors, map };
}
function unusedId(id, used) {
  if (!used.has(id)) { used.add(id); return id; }
  let suffix = 1; while (used.has(`${id}-copy-${suffix}`)) suffix++;
  const next = `${id}-copy-${suffix}`; used.add(next); return next;
}
export function pasteSelection(p, selection, x, y, { overwriteEmpty = false } = {}) {
  validateRevision(p); validateRevision(selection);
  validateRect(p, { x, y, width: selection.width, height: selection.height });
  const usedIndices = new Set(selection.cells.filter(c => c >= 0));
  for (const h of selection.halfStitches ?? []) usedIndices.add(h.color);
  for (const b of selection.backstitches ?? []) usedIndices.add(b.color);
  const next = clone(p), merged = mergeColors(p.colors, selection.colors, usedIndices); next.colors = merged.colors;
  for (let sy = 0; sy < selection.height; sy++) for (let sx = 0; sx < selection.width; sx++) {
    const color = selection.cells[sy * selection.width + sx];
    if (color >= 0 || overwriteEmpty) next.cells[(y + sy) * p.width + x + sx] = color < 0 ? -1 : merged.map[color];
  }
  next.halfStitches ??= []; next.backstitches ??= [];
  const halfIds = new Set(next.halfStitches.map(h => h.id)), backIds = new Set(next.backstitches.map(b => b.id));
  next.halfStitches.push(...(selection.halfStitches ?? []).map(h => ({ ...clone(h), id: unusedId(h.id, halfIds), x: h.x + x, y: h.y + y, color: merged.map[h.color] })));
  next.backstitches.push(...(selection.backstitches ?? []).map(b => ({ ...clone(b), id: unusedId(b.id, backIds), x1: b.x1 + x, y1: b.y1 + y, x2: b.x2 + x, y2: b.y2 + y, color: merged.map[b.color] })));
  validateRevision(next);
  return next;
}
export const paste = pasteSelection;

export function moveSelection(p, rect, x, y) {
  const selection = copySelection(p, rect), next = clone(p);
  if (selection.excludedCrossingSegments.length) fail('pattern.crossingSegments', { ids: selection.excludedCrossingSegments });
  validateRect(p, { x, y, width: rect.width, height: rect.height });
  for (let py = rect.y; py < rect.y + rect.height; py++) for (let px = rect.x; px < rect.x + rect.width; px++) next.cells[py * p.width + px] = -1;
  next.halfStitches = (next.halfStitches ?? []).filter(h => !inRect(h.x, h.y, rect));
  next.backstitches = (next.backstitches ?? []).filter(b => !segmentInRect(b, rect));
  return pasteSelection(next, selection, x, y, { overwriteEmpty: true });
}

export function rotateSelection(p, turns = 1) {
  validateRevision(p);
  if (!Number.isInteger(turns)) fail('pattern.rotation');
  let next = clone(p);
  for (let turn = 0; turn < ((turns % 4) + 4) % 4; turn++) {
    const old = next, width = old.height, height = old.width;
    next = { ...clone(old), width, height, cells: Array(width * height).fill(-1) };
    for (let y = 0; y < old.height; y++) for (let x = 0; x < old.width; x++) next.cells[x * width + old.height - 1 - y] = old.cells[y * old.width + x];
    next.halfStitches = (old.halfStitches ?? []).map(h => ({ ...clone(h), x: old.height - 1 - h.y, y: h.x, direction: h.direction === '/' ? '\\' : '/' }));
    next.backstitches = (old.backstitches ?? []).map(b => ({ ...clone(b), x1: old.height - b.y1, y1: b.x1, x2: old.height - b.y2, y2: b.x2 }));
  }
  return next;
}
export const rotate = rotateSelection;
export function flipSelection(p, axis = 'horizontal') {
  validateRevision(p);
  if (!['horizontal', 'vertical'].includes(axis)) fail('pattern.axis');
  const next = clone(p), horizontal = axis === 'horizontal';
  for (let y = 0; y < p.height; y++) for (let x = 0; x < p.width; x++) next.cells[(horizontal ? y : p.height - 1 - y) * p.width + (horizontal ? p.width - 1 - x : x)] = p.cells[y * p.width + x];
  next.halfStitches = (p.halfStitches ?? []).map(h => ({ ...clone(h), x: horizontal ? p.width - 1 - h.x : h.x, y: horizontal ? h.y : p.height - 1 - h.y, direction: h.direction === '/' ? '\\' : '/' }));
  next.backstitches = (p.backstitches ?? []).map(b => ({ ...clone(b), x1: horizontal ? p.width - b.x1 : b.x1, x2: horizontal ? p.width - b.x2 : b.x2, y1: horizontal ? b.y1 : p.height - b.y1, y2: horizontal ? b.y2 : p.height - b.y2 }));
  return next;
}
export const flip = flipSelection;

/** Cropping must be explicitly acknowledged. Any partly outside segment is removed
 * as a whole, listed in impact, and never flattened into another primitive type. */
export function resizeImpact(p, width, height, { offsetX = 0, offsetY = 0 } = {}) {
  validateRevision(p); validSize(width, height);
  if (!Number.isInteger(offsetX) || !Number.isInteger(offsetY)) fail('pattern.coordinates');
  const box = { width, height }, removed = [];
  p.cells.forEach((color, i) => { if (color >= 0 && !validPoint(box, i % p.width + offsetX, Math.floor(i / p.width) + offsetY)) removed.push(`c:${i}`); });
  for (const h of p.halfStitches ?? []) if (!validPoint(box, h.x + offsetX, h.y + offsetY)) removed.push(`h:${h.id}`);
  for (const b of p.backstitches ?? []) if (!validVertex(box, b.x1 + offsetX, b.y1 + offsetY) || !validVertex(box, b.x2 + offsetX, b.y2 + offsetY)) removed.push(`b:${b.id}`);
  return { removed, coordinateChange: width !== p.width || offsetX !== 0 || offsetY !== 0, requiresProgressReview: width !== p.width || height !== p.height || offsetX !== 0 || offsetY !== 0 };
}
export function resize(p, width, height, { offsetX = 0, offsetY = 0, allowCrop = false } = {}) {
  const impact = resizeImpact(p, width, height, { offsetX, offsetY });
  if (impact.removed.length && !allowCrop) fail('pattern.cropConfirmation', { removed: impact.removed });
  const next = { ...clone(p), width, height, cells: Array(width * height).fill(-1) };
  p.cells.forEach((color, i) => { const x = i % p.width + offsetX, y = Math.floor(i / p.width) + offsetY; if (validPoint(next, x, y)) next.cells[y * width + x] = color; });
  next.halfStitches = (p.halfStitches ?? []).filter(h => !impact.removed.includes(`h:${h.id}`)).map(h => ({ ...clone(h), x: h.x + offsetX, y: h.y + offsetY }));
  next.backstitches = (p.backstitches ?? []).filter(b => !impact.removed.includes(`b:${b.id}`)).map(b => ({ ...clone(b), x1: b.x1 + offsetX, y1: b.y1 + offsetY, x2: b.x2 + offsetX, y2: b.y2 + offsetY }));
  return next;
}

export function addHalfStitch(p, h) {
  const next = clone(p); next.halfStitches = [...(next.halfStitches ?? []).filter(old => old.id !== h.id), clone(h)]; validateRevision(next); return next;
}
export function addBackstitch(p, b) {
  const next = clone(p); next.backstitches = [...(next.backstitches ?? []).filter(old => old.id !== b.id), clone(b)]; validateRevision(next); return next;
}
export function removePrimitive(p, key) {
  validateRevision(p);
  const next = clone(p);
  if (typeof key !== 'string') fail('pattern.primitiveKey');
  if (/^c:\d+$/.test(key)) { const index = Number(key.slice(2)); if (!integer(index, 0, next.cells.length - 1)) fail('pattern.coordinates'); next.cells[index] = -1; }
  else if (key.startsWith('h:')) next.halfStitches = (next.halfStitches ?? []).filter(h => h.id !== key.slice(2));
  else if (key.startsWith('b:')) next.backstitches = (next.backstitches ?? []).filter(b => b.id !== key.slice(2));
  else fail('pattern.primitiveKey');
  return next;
}
