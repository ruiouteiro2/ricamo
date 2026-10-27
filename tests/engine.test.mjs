import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { once } from 'node:events';
import { performance } from 'node:perf_hooks';
import { generate, validateSettings, validatePalette, inventoryPalette, importLegacy, DEFAULT_SETTINGS, ENGINE } from '../src/engine/adapter.mjs';
import { convert, dmcPalette, settingRules, settingsErrors, symbols } from '../src/engine/stitch-engine.ts';
import { createBlank, validateRevision, counts, primitiveKeys, paint, fill, replaceColor, line, rectangle, copySelection,
  pasteSelection, moveSelection, rotate, flip, resize, resizeImpact, addHalfStitch, addBackstitch, removePrimitive, SYMBOLS } from '../core/pattern.mjs';

const colors = [
  { brand: 'Personal', code: '001', name: 'Black', hex: '#000000', rgb: [0, 0, 0], symbol: 'A', strands: 2 },
  { brand: 'Personal', code: 'B5200', name: 'White', hex: '#ffffff', rgb: [255, 255, 255], symbol: 'B', strands: 2 },
  { brand: 'Personal', code: 'red', name: 'Red', hex: '#ff0000', rgb: [255, 0, 0], symbol: 'C', strands: 2 },
];
const palette = { brand: 'Personal', source: 'test-fixture', approximate: true, colors };
const settings = { ...DEFAULT_SETTINGS, width: 3, height: 2, mode: 'detail', maxColors: 3 };
const rgba = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255, 255, 0, 0, 255, 0, 0, 0, 0, 255, 255, 255, 255, 255, 0, 0, 127]);
const throwsCode = (fn, code) => assert.throws(fn, error => error.code === code);
const blank = (w = 4, h = 3) => createBlank(w, h, colors, { id: 'revision-1', name: 'Test', notes: 'Preserved metadata' });

// Engine source compatibility and integration, not a replacement mock.
test('original engine is reused exactly for quantization and transparency', () => {
  const before = structuredClone(palette), result = generate({ rgba, settings, palette });
  const original = convert(rgba, settings, palette);
  assert.deepEqual(result.cells, original.cells);
  assert.deepEqual(result.colors.map(c => c.code), original.colors.map(c => c.code));
  assert.equal(result.cells[3], -1); assert.equal(result.cells[5], -1);
  assert.notEqual(result.cells[1], -1); // actual white must remain stitched
  assert.equal(counts(result).total, 4);
  assert.deepEqual(palette, before);
  assert.equal(result.provenance.originalSha256, ENGINE.originalSha256);
  assert.deepEqual(result.provenance.parameters, settings);
});

test('RGBA shape, settings, empty images and empty palettes fail with stable codes', () => {
  throwsCode(() => generate({ rgba: new Uint8Array(4), settings, palette }), 'engine.pixelLength');
  throwsCode(() => generate({ rgba: [], settings, palette }), 'engine.pixelBuffer');
  throwsCode(() => generate({ rgba: new Uint8ClampedArray(24), settings, palette }), 'engine.emptyImage');
  throwsCode(() => generate({ rgba, settings: { ...settings, width: 501 }, palette }), 'engine.settingRange');
  throwsCode(() => generate({ rgba, settings, palette: { ...palette, colors: [] } }), 'engine.palette');
  for (const width of [NaN, Infinity, 0, -1, 1.2, '3']) throwsCode(() => validateSettings({ ...settings, width }), 'engine.settingRange');
  throwsCode(() => validateSettings({ ...settings, mode: 'fake-dither' }), 'engine.mode');
});

test('source and adapter extension accepts 500 cells and 80 distinct colours', () => {
  assert.equal(settingRules.width.max, 500); assert.equal(settingRules.height.max, 500); assert.equal(settingRules.maxColors.max, 80);
  assert.equal(settingsErrors({ ...settings, width: 500, height: 500, maxColors: 80 }).length, 0);
  assert.ok(new Set(symbols).size >= 80); assert.ok(new Set(SYMBOLS).size >= 80);
  const eighty = Array.from({ length: 80 }, (_, i) => {
    const rgb = [i % 5 * 48, Math.floor(i / 5) % 4 * 64, Math.floor(i / 20) * 64];
    return { code: String(i).padStart(3, '0'), name: `Test ${i}`, rgb, hex: '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('') };
  });
  const data = new Uint8ClampedArray(eighty.flatMap(c => [...c.rgb, 255]));
  const result = generate({ rgba: data, settings: { ...settings, width: 80, height: 1, maxColors: 80 }, palette: { ...palette, colors: eighty } });
  assert.equal(result.colors.length, 80); assert.equal(new Set(result.colors.map(c => c.symbol)).size, 80);
  assert.equal(counts(result).full, 80);
});

test('500 by 500 generation is measured with real engine and bounded palette', t => {
  const data = new Uint8ClampedArray(500 * 500 * 4);
  for (let i = 0; i < 250000; i++) data.set(i % 2 ? [0, 0, 0, 255] : [255, 255, 255, 255], i * 4);
  const start = performance.now();
  const result = generate({ rgba: data, settings: { ...settings, width: 500, height: 500, maxColors: 80 }, palette });
  const elapsed = performance.now() - start;
  assert.equal(result.cells.length, 250000); assert.equal(counts(result).total, 250000);
  t.diagnostic(`500x500 two-colour generation: ${elapsed.toFixed(1)} ms; this is not the full 80-colour load benchmark.`);
});

test('inventory palette filters actual holdings without inventing sufficient quantities', () => {
  const items = colors.map((c, i) => ({ ...c, id: `i${i}` }));
  const lots = [{ materialId: 'i0', quantity: 4, condition: 'usable' }, { materialId: 'i1', quantity: null, condition: 'usable' }, { materialId: 'i2', quantity: 12, condition: 'damaged' }];
  const p = inventoryPalette(items, lots);
  assert.deepEqual(p.colors.map(c => c.code), ['001', 'B5200']);
  assert.equal(inventoryPalette(items, lots, { includeUnknown: false }).colors.length, 1);
  throwsCode(() => inventoryPalette(items, lots, { itemIds: ['i2'] }), 'engine.inventoryPaletteEmpty');
  const result = generate({ rgba, settings, palette: p });
  assert.ok(result.colors.every(c => ['i0', 'i1'].includes(c.itemId)));
});

test('commercial code identity includes brand and range, not code alone', () => {
  assert.doesNotThrow(() => validatePalette({ ...palette, colors: [colors[0], { ...colors[0], brand: 'Another' }] }));
  throwsCode(() => validatePalette({ ...palette, colors: [colors[0], colors[0]] }), 'engine.paletteDuplicate');
});

test('legacy import preserves geometry and code strings, rejects future and special formats', () => {
  const legacy = { version: 1, title: 'Legacy', author: 'A', settings, palette, colors, cells: [0, 1, 2, -1, 0, -1] };
  const revision = importLegacy(legacy, { id: 'import' });
  assert.deepEqual(revision.cells, legacy.cells); assert.equal(revision.colors[0].code, '001'); assert.equal(revision.id, 'import');
  throwsCode(() => importLegacy({ ...legacy, version: 2 }), 'engine.legacyFormat');
  throwsCode(() => importLegacy({ ...legacy, halfStitches: [{ id: 'h' }] }), 'engine.legacyUnsupportedPrimitives');
});

// Geometry invariants, round trips and immutability.
test('blank and validation keep empty cells distinct from first palette entry', () => {
  const p = blank(); assert.equal(counts(p).total, 0); assert.deepEqual(primitiveKeys(p), []);
  throwsCode(() => validateRevision({ ...p, cells: [0] }), 'pattern.cells');
  throwsCode(() => validateRevision({ ...p, formatVersion: 2 }), 'pattern.version');
  throwsCode(() => validateRevision({ ...p, colors: [colors[0], { ...colors[1], symbol: 'A' }] }), 'pattern.symbol');
  assert.equal(createBlank(1, 1).cells[0], -1);
});

test('painting is immutable, bounded and preserves metadata', () => {
  const p = blank(), next = paint(p, [[0, 0], { x: 3, y: 2 }], 0);
  assert.equal(counts(p).total, 0); assert.equal(counts(next).full, 2); assert.equal(next.notes, p.notes);
  throwsCode(() => paint(p, [[4, 0]], 0), 'pattern.coordinates');
  throwsCode(() => paint(p, [[0, 0]], 99), 'pattern.paint');
  assert.equal(counts(paint(next, [[0, 0]], -1)).full, 1);
});

test('fill stays inside four-connected boundary and preserves original', () => {
  const p = line(blank(5, 4), 2, 0, 2, 3, 0), filled = fill(p, 0, 0, 1);
  assert.equal(counts(filled).byColor[1].full, 8); assert.equal(filled.cells[4], -1); assert.equal(counts(p).full, 4);
  assert.deepEqual(fill(filled, 0, 0, 1), filled);
});

test('line endpoints and rectangle edges are included once', () => {
  const p = line(blank(5, 5), 0, 0, 4, 4, 0); assert.equal(counts(p).full, 5);
  assert.equal(p.cells[0], 0); assert.equal(p.cells[24], 0);
  assert.equal(counts(rectangle(blank(5, 5), { x: 1, y: 1, width: 3, height: 3 }, 0)).full, 8);
  assert.equal(counts(rectangle(blank(5, 5), { x: 1, y: 1, width: 3, height: 3 }, 0, { filled: true })).full, 9);
});

function mixed() {
  let p = paint(blank(), [[0, 0], [3, 2]], 0);
  p = addHalfStitch(p, { id: 'half', x: 1, y: 1, color: 1, direction: '/' });
  return addBackstitch(p, { id: 'back', x1: 0.5, y1: 0.5, x2: 4, y2: 3, color: 2 });
}

test('counts and progress keys distinguish full, half and line primitives', () => {
  const p = mixed(), c = counts(p);
  assert.deepEqual({ full: c.full, half: c.half, backstitch: c.backstitch, total: c.total }, { full: 2, half: 1, backstitch: 1, total: 4 });
  assert.equal(c.byColor[2].backstitchLength, Math.hypot(3.5, 2.5));
  assert.deepEqual(primitiveKeys(p), ['c:0', 'c:11', 'h:half', 'b:back']);
  assert.equal(counts(removePrimitive(p, 'h:half')).half, 0);
  assert.equal(counts(removePrimitive(p, 'b:back')).backstitch, 0);
});

test('invalid half stitches and backstitches are rejected, including duplicate IDs', () => {
  const p = mixed();
  throwsCode(() => addHalfStitch(p, { id: 'new', x: 0.5, y: 0, color: 0, direction: '/' }), 'pattern.halfStitch');
  throwsCode(() => addBackstitch(p, { id: 'new', x1: 0, y1: 0, x2: 0.3, y2: 1, color: 0 }), 'pattern.backstitch');
  throwsCode(() => addBackstitch(p, { id: 'new', x1: 0, y1: 0, x2: 0, y2: 0, color: 0 }), 'pattern.backstitch');
  throwsCode(() => validateRevision({ ...p, halfStitches: [...p.halfStitches, p.halfStitches[0]] }), 'pattern.halfStitch');
});

test('four rotations and two flips exactly recover all geometry', () => {
  const p = mixed();
  assert.deepEqual(rotate(p, 4), p);
  let rotated = p; for (let i = 0; i < 4; i++) rotated = rotate(rotated);
  assert.deepEqual(rotated, p);
  assert.deepEqual(flip(flip(p, 'horizontal'), 'horizontal'), p);
  assert.deepEqual(flip(flip(p, 'vertical'), 'vertical'), p);
  assert.equal(rotate(p).halfStitches[0].direction, '\\');
  assert.equal(rotate(p).width, 3); assert.equal(rotate(p).height, 4);
  assert.deepEqual(counts(rotate(p)).byColor.map(c => c.total), counts(p).byColor.map(c => c.total));
});

test('copy and paste preserve types, remap palettes and avoid duplicate primitive IDs', () => {
  const p = mixed(), selection = copySelection(p, { x: 0, y: 0, width: 4, height: 3 });
  const destination = createBlank(8, 6, [...colors].reverse().map((c, i) => ({ ...c, symbol: String(i) })));
  const next = pasteSelection(destination, selection, 2, 2);
  assert.equal(next.cells[2 * 8 + 2], 2); assert.equal(next.halfStitches[0].color, 1); assert.equal(next.backstitches[0].color, 0);
  assert.equal(counts(next).total, 4);
  const twice = pasteSelection(next, selection, 0, 0);
  assert.equal(new Set(twice.halfStitches.map(h => h.id)).size, 2);
  assert.equal(new Set(twice.backstitches.map(b => b.id)).size, 2);
  assert.equal(counts(destination).total, 0);
});

test('selection identifies crossing segments and move refuses silent loss', () => {
  const p = mixed(), rect = { x: 0, y: 0, width: 2, height: 2 };
  const selection = copySelection(p, rect);
  assert.deepEqual(selection.excludedCrossingSegments, ['back']);
  throwsCode(() => moveSelection(p, rect, 2, 0), 'pattern.crossingSegments');
});

test('move selection handles overlapping source/destination and keeps stable IDs', () => {
  let p = paint(blank(5, 4), [[0, 0], [1, 0]], 0);
  p = addHalfStitch(p, { id: 'stable', x: 0, y: 1, color: 1, direction: '/' });
  const next = moveSelection(p, { x: 0, y: 0, width: 2, height: 2 }, 1, 0);
  assert.equal(next.cells[0], -1); assert.equal(next.cells[1], 0); assert.equal(next.cells[2], 0);
  assert.equal(next.halfStitches[0].id, 'stable'); assert.equal(next.halfStitches[0].x, 1);
});

test('resize preserves every type, flags progress review and requires crop confirmation', () => {
  const p = mixed(), next = resize(p, 6, 5, { offsetX: 1, offsetY: 1 });
  assert.equal(counts(next).total, 4); assert.equal(next.cells[7], 0); assert.equal(next.halfStitches[0].x, 2);
  assert.equal(next.backstitches[0].x1, 1.5);
  assert.equal(resizeImpact(p, 5, 3).requiresProgressReview, true);
  throwsCode(() => resize(p, 2, 2), 'pattern.cropConfirmation');
  const cropped = resize(p, 2, 2, { allowCrop: true });
  assert.equal(counts(cropped).full, 1); assert.equal(counts(cropped).half, 1); assert.equal(counts(cropped).backstitch, 0);
  assert.equal(counts(p).total, 4);
});

test('replace or erase a reference affects all primitive types explicitly', () => {
  let p = mixed(); p = replaceColor(p, 1, 0); p = replaceColor(p, 2, 0);
  assert.equal(counts(p).byColor[0].total, 4);
  const cleared = replaceColor(p, 0, -1);
  assert.equal(counts(cleared).total, 0); assert.equal(counts(p).total, 4);
});

function worker() {
  const path = new URL('../src/engine/worker.js', import.meta.url).href;
  return new Worker(new URL(`data:text/javascript,${encodeURIComponent(`import { parentPort } from 'node:worker_threads'; globalThis.self={postMessage:(value)=>parentPort.postMessage(value)}; await import(${JSON.stringify(path)}); parentPort.on('message',data=>self.onmessage({data}));`)}`), { type: 'module' });
}

test('real worker returns bound job IDs and structured errors', async () => {
  const w = worker();
  try {
    w.postMessage({ id: 'job-1', rgba, settings, palette });
    const [response] = await once(w, 'message'); assert.equal(response.id, 'job-1'); assert.equal(counts(response.result).total, 4);
    w.postMessage({ id: 'job-2', rgba: new Uint8Array(0), settings, palette });
    const [error] = await once(w, 'message'); assert.equal(error.id, 'job-2'); assert.equal(error.error.code, 'engine.pixelLength');
  } finally { await w.terminate(); }
});

test('terminating a busy worker permits a fresh independent generation', async () => {
  const w = worker();
  const data = new Uint8ClampedArray(500 * 500 * 4); data.fill(255);
  w.postMessage({ id: 'cancelled', rgba: data, settings: { ...settings, width: 500, height: 500 }, palette: dmcPalette });
  await w.terminate();
  const next = worker();
  try { next.postMessage({ id: 'fresh', rgba, settings, palette }); const [response] = await once(next, 'message'); assert.equal(response.id, 'fresh'); assert.equal(counts(response.result).total, 4); }
  finally { await next.terminate(); }
});


test('paste imports only colours used by selected geometry', () => {
  const selection = paint(blank(1, 1), [[0, 0]], 0);
  const destination = createBlank(2, 2, [colors[0]]);
  const next = pasteSelection(destination, selection, 0, 0);
  assert.equal(next.colors.length, 1); assert.equal(next.cells[0], 0);
});

test('unsupported primitive collections and malformed edit points are rejected', () => {
  throwsCode(() => validateRevision({ ...blank(), quarterStitches: [{ x: 0 }] }), 'pattern.unsupportedPrimitive');
  throwsCode(() => validateRevision({ ...blank(), version: 7 }), 'pattern.version');
  throwsCode(() => paint(blank(), [null], 0), 'pattern.coordinates');
  throwsCode(() => removePrimitive(blank(), null), 'pattern.primitiveKey');
});

test('500 by 500 grid with 80 actual colours preserves palette bound and geometry', t => {
  const colors = Array.from({ length: 80 }, (_, i) => {
    const rgb = [i % 5 * 48, Math.floor(i / 5) % 4 * 64, Math.floor(i / 20) * 64];
    return { code: String(i), name: `Colour ${i}`, rgb, hex: '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('') };
  });
  const data = new Uint8ClampedArray(500 * 500 * 4);
  for (let i = 0; i < 250000; i++) data.set([...colors[i % 80].rgb, 255], i * 4);
  const start = performance.now(), rssBefore = process.memoryUsage().rss;
  const revision = generate({ rgba: data, settings: { ...settings, width: 500, height: 500, maxColors: 80, region: 0 }, palette: { ...palette, colors } });
  const elapsed = performance.now() - start, rssAfter = process.memoryUsage().rss;
  assert.equal(revision.colors.length, 80); assert.equal(counts(revision).full, 250000);
  assert.ok(revision.cells.every(n => n >= 0 && n < 80));
  t.diagnostic(`500x500/80 actual colours: ${elapsed.toFixed(1)} ms; RSS before ${(rssBefore / 1048576).toFixed(1)} MiB, after ${(rssAfter / 1048576).toFixed(1)} MiB (not peak measurement).`);
});


test('inventory palette uses canonical materialId, excludes blocked lots and fabric colours', () => {
  const materials = [
    { id: 'thread', name: 'Held thread', code: '001', color: '#123456', category: 'thread' },
    { id: 'blocked', name: 'Blocked thread', code: '002', color: '#234567', category: 'thread' },
    { id: 'fabric', name: 'Fabric', code: '003', color: '#345678', category: 'fabric' },
    { id: 'legacy', name: 'No canonical lot', code: '004', color: '#456789', category: 'thread' },
  ];
  const lots = [
    { materialId: 'thread', quantity: 2, condition: 'usable' },
    { materialId: 'blocked', quantity: 10, condition: 'blocked' },
    { materialId: 'fabric', quantity: 1, condition: 'usable' },
    { itemId: 'legacy', quantity: 5, condition: 'usable' },
  ];
  const result = inventoryPalette(materials, lots);
  assert.deepEqual(result.colors.map(c => c.itemId), ['thread']);
  assert.equal(result.colors[0].hex, '#123456');
  assert.deepEqual(result.colors[0].rgb, [18, 52, 86]);
  throwsCode(() => inventoryPalette(materials, lots, { itemIds: ['blocked'] }), 'engine.inventoryPaletteEmpty');
});
