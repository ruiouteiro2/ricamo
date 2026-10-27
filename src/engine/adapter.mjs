/** Integration of the original Stitch Studio quantizer; no replacement algorithm. */
import { convert, dmcPalette, anchorPalette } from './stitch-engine.ts';
import { createBlank, validateRevision, SYMBOLS, PatternError } from '../../core/pattern.mjs';

export const ENGINE = Object.freeze({
  name: 'Stitch Studio', version: '0.1.0+ricamo.1', adapterVersion: 1,
  originalSha256: '7eb63a9d4c5915249b638fa6bd1ee35cff1e6f2e3982d8a6ca60b78279fe6052',
  algorithm: 'weighted-CIELAB-kmeans-CIE76', iterations: 8,
  adaptations: ['500x500-limit', '80-color-detail-limit', 'input-validation', 'revision-model'],
});
export const DEFAULT_SETTINGS = Object.freeze({ width: 100, height: 100, count: 14, strands: 2, maxColors: 24, mode: 'balanced', region: 0, waste: 20 });
export const CAPABILITIES = Object.freeze({ width: 500, height: 500, maxColors: 80, modes: { detail: 80, balanced: 40, simple: 16 }, alphaThreshold: 128,
  generation: ['full-cross'], editor: ['full-cross', 'half-stitch', 'backstitch'], dithering: false, cpu: true, cancellableByWorkerTermination: true });
export { dmcPalette, anchorPalette };
const fail = (code, details = {}) => { throw new PatternError(code, details); };
const finite = (n, min, max, integer = false) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max && (!integer || Number.isInteger(n));

export function validateSettings(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('engine.settings');
  const settings = { ...DEFAULT_SETTINGS, ...input };
  const ranges = { width: [1, 500, true], height: [1, 500, true], count: [6, 40], strands: [1, 6, true], maxColors: [1, 80, true], region: [0, 30, true], waste: [0, 100] };
  for (const [field, range] of Object.entries(ranges)) if (!finite(settings[field], ...range)) fail('engine.settingRange', { field, min: range[0], max: range[1], integer: !!range[2] });
  if (!['detail', 'balanced', 'simple'].includes(settings.mode)) fail('engine.mode');
  // Keep only normalized settings; arbitrary caller fields do not enter provenance.
  return Object.fromEntries([...Object.keys(ranges), 'mode'].map(key => [key, settings[key]]));
}

export function validatePalette(palette) {
  if (!palette || typeof palette !== 'object' || typeof palette.brand !== 'string' || typeof palette.source !== 'string'
    || !Array.isArray(palette.colors) || !palette.colors.length || palette.colors.length > 2000) fail('engine.palette');
  const identities = new Set();
  for (let index = 0; index < palette.colors.length; index++) {
    const c = palette.colors[index];
    if (!c || typeof c.code !== 'string' || typeof c.name !== 'string' || !/^#[0-9a-f]{6}$/i.test(c.hex)
      || !Array.isArray(c.rgb) || c.rgb.length !== 3 || c.rgb.some(n => !finite(n, 0, 255, true))) fail('engine.paletteColor', { index });
    const identity = JSON.stringify([c.brand ?? palette.brand, c.range ?? '', c.code, c.itemId ?? '']);
    if (identities.has(identity)) fail('engine.paletteDuplicate', { index });
    identities.add(identity);
  }
  return palette;
}

/** Build a palette only from actual selected holdings. Unknown quantity is a
 * possible held colour, not a claim of sufficient quantity. Eligibility and
 * amount assessment remain separate from image colour matching. */
export function inventoryPalette(items, lots, { itemIds, includeUnknown = true } = {}) {
  const itemList = Array.isArray(items) ? items : Object.values(items ?? {});
  const lotList = Array.isArray(lots) ? lots : Object.values(lots ?? {});
  const selection = itemIds ? new Set(itemIds) : null;
  const colors = [];
  for (const item of itemList) {
    if (item.archived || (item.category !== undefined && item.category !== 'thread') || (selection && !selection.has(item.id))) continue;
    const held = lotList.some(lot => {
      if (lot.materialId !== item.id || lot.archived) return false;
      const status = lot.condition ?? lot.status ?? 'usable';
      if (!['usable', 'available', 'good'].includes(status)) return false;
      const quantity = lot.quantity ?? lot.qty;
      return (quantity == null && includeUnknown) || (Number.isFinite(quantity) && quantity > 0);
    });
    if (!held) continue;
    const hex = item.hex ?? item.color ?? item.attributes?.hex ?? item.attributes?.color;
    if (typeof hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(hex)) continue;
    const code = item.code ?? item.reference ?? '';
    if (typeof code !== 'string') continue;
    colors.push({ brand: item.brand ?? '', range: item.range ?? '', itemId: item.id, code, name: item.name ?? code,
      hex, rgb: [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16)) });
  }
  if (!colors.length) fail('engine.inventoryPaletteEmpty');
  return validatePalette({ brand: 'Inventory', source: 'user-inventory', approximate: true, colors });
}

export function generate({ rgba, settings: input, palette = dmcPalette, source = null, metadata = {} }) {
  const settings = validateSettings(input);
  validatePalette(palette);
  if (!(rgba instanceof Uint8ClampedArray) && !(rgba instanceof Uint8Array)) fail('engine.pixelBuffer');
  if (rgba.length !== settings.width * settings.height * 4) fail('engine.pixelLength', { expected: settings.width * settings.height * 4, actual: rgba.length });
  let visible = false;
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] >= CAPABILITIES.alphaThreshold) { visible = true; break; }
  if (!visible) fail('engine.emptyImage');
  // All mutable inputs are copied: conversion must not mutate caller palettes.
  const effectivePalette = structuredClone(palette);
  let result;
  try { result = convert(new Uint8ClampedArray(rgba), settings, effectivePalette); }
  catch (error) { throw new PatternError('engine.generationFailed', { cause: error instanceof PatternError ? error.code : 'quantizer' }); }
  const colors = result.colors.map((color, index) => ({ ...color, brand: color.brand ?? palette.brand, symbol: SYMBOLS[index], strands: settings.strands }));
  const revision = createBlank(settings.width, settings.height, colors, metadata);
  revision.cells = result.cells;
  revision.settings = settings;
  revision.provenance = { ...ENGINE, parameters: structuredClone(settings), palette: { brand: palette.brand, source: palette.source, approximate: palette.approximate !== false,
    colors: effectivePalette.colors.map(c => ({ brand: c.brand ?? palette.brand, range: c.range ?? '', code: c.code, hex: c.hex, ...(c.itemId ? { itemId: c.itemId } : {}) })) },
    source: source == null ? null : structuredClone(source), alphaPolicy: { emptyBelow: 128, partialBackground: '#ffffff' }, effectiveColorLimit: Math.min(settings.maxColors, CAPABILITIES.modes[settings.mode], palette.colors.length) };
  validateRevision(revision);
  return revision;
}
export const generatePattern = generate;

/** Source v1 is an editable full-cross format only. No interpretation of PDFs,
 * external source URLs or unsupported primitive collections is performed. */
export function importLegacy(value, metadata = {}) {
  if (!value || value.version !== 1 || !value.settings || !Array.isArray(value.colors) || !Array.isArray(value.cells)) fail('engine.legacyFormat');
  if (['halfStitches', 'backstitches', 'quarterStitches', 'threeQuarterStitches', 'knots', 'beads'].some(field => value[field]?.length)) fail('engine.legacyUnsupportedPrimitives');
  const settings = validateSettings(value.settings);
  const colors = value.colors.map((c, index) => ({ ...structuredClone(c), brand: c.brand ?? value.palette?.brand ?? '', symbol: SYMBOLS[index], strands: settings.strands }));
  const revision = createBlank(settings.width, settings.height, colors, { ...metadata, name: metadata.name ?? value.title ?? '' });
  revision.cells = [...value.cells]; revision.settings = settings;
  revision.provenance = { ...ENGINE, importedFormat: 'stitch-studio-v1', sourceAuthor: typeof value.author === 'string' ? value.author : '', sourceImageEmbedded: typeof value.source === 'string' && /^data:image\/(png|jpeg|webp|gif);base64,/i.test(value.source) };
  validateRevision(revision);
  return revision;
}
