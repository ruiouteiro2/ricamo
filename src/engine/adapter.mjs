import {supplierSwatch,normalizeSupplierProduct} from '../../core/supplier-products.mjs';
import {SYMBOL_MODES,symbolsForMode} from '../../core/pattern-symbols.mjs';
import {normalizePatternFabric} from '../../core/pattern-fabric.mjs';
import {catalogueReference} from '../../core/thread-catalogues.mjs';
import {normalizeBackground} from '../../core/generation-background.mjs';
import {removeBorderBackground} from './background.mjs';
/** Integration of the original Stitch Studio quantizer; no replacement algorithm. */
import { convert, dmcPalette, anchorPalette } from './stitch-engine.ts';
import { createBlank, validateRevision, SYMBOLS, PatternError } from '../../core/pattern.mjs';

export const ENGINE = Object.freeze({
  name: 'Stitch Studio', version: '0.1.0+ricamo.5', adapterVersion: 5,
  originalSha256: '7eb63a9d4c5915249b638fa6bd1ee35cff1e6f2e3982d8a6ca60b78279fe6052',
  algorithm: 'weighted-CIELAB-kmeans-CIE76', iterations: 8,
  adaptations: ['500x500-limit', '500-color-detail-limit', 'exact-detail-rgb', 'cached-farthest-seeding', 'full-palette-nearest-detail', 'input-validation', 'revision-model', 'bounded-inventory-preference', 'protected-cleanup-regions'],
});
export const DEFAULT_SETTINGS = Object.freeze({ width: 300, height: 300, count: 14, strands: 2, maxColors: 500, mode: 'detail', region: 0, waste: 20 });
export const CAPABILITIES = Object.freeze({ width: 500, height: 500, maxColors: 500, modes: { detail: 500, balanced: 40, simple: 16 }, alphaThreshold: 128,
  generation: ['full-cross'], editor: ['full-cross', 'half-stitch', 'backstitch'], dithering: false, cpu: true, cancellableByWorkerTermination: true });
export { dmcPalette, anchorPalette };
const fail = (code, details = {}) => { throw new PatternError(code, details); };
const finite = (n, min, max, integer = false) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max && (!integer || Number.isInteger(n));

export function validateSettings(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('engine.settings');
  const settings = { ...DEFAULT_SETTINGS, ...input };
  const ranges = { width: [1, 500, true], height: [1, 500, true], count: [1, 200], strands: [1, 6, true], maxColors: [1, 500, true], region: [0, 30, true], waste: [0, 100] };
  for (const [field, range] of Object.entries(ranges)) if (!finite(settings[field], ...range)) fail('engine.settingRange', { field, min: range[0], max: range[1], integer: !!range[2] });
  if (!['detail', 'balanced', 'simple'].includes(settings.mode)) fail('engine.mode');
  // Keep only normalized settings; arbitrary caller fields do not enter provenance.
  const protectedRegions=input.protectedRegions??[];
  if(!Array.isArray(protectedRegions)||protectedRegions.length>20)fail('engine.protectedRegions');
  for(const r of protectedRegions)if(!r||!finite(r.x,0,settings.width-1,true)||!finite(r.y,0,settings.height-1,true)||!finite(r.width,1,settings.width,true)||!finite(r.height,1,settings.height,true)||r.x+r.width>settings.width||r.y+r.height>settings.height)fail('engine.protectedRegions');
  const options = {};
  if(input.symbolMode!==undefined){if(!SYMBOL_MODES.includes(input.symbolMode))fail('pattern.symbolMode');options.symbolMode=input.symbolMode;}
  if(input.fabric!==undefined)options.fabric=normalizePatternFabric(input.fabric);
  if(input.background!==undefined)options.background=normalizeBackground(input.background);
  for(const key of ['fixedColors','excludedColors'])if(input[key]!==undefined){
    const indices=input[key];if(!Array.isArray(indices)||indices.length>(key==='fixedColors'?500:6000)||new Set(indices).size!==indices.length||indices.some(i=>!finite(i,0,5999,true)))fail('engine.colorConstraints');
    if(indices.length)options[key]=[...indices];
  }
  return {...options,...Object.fromEntries([...Object.keys(ranges), 'mode'].map(key => [key, settings[key]])),...(protectedRegions.length?{protectedRegions:protectedRegions.map(({x,y,width,height})=>({x,y,width,height}))}:{})};
}

export function validatePalette(palette) {
  if (!palette || typeof palette !== 'object' || typeof palette.brand !== 'string' || typeof palette.source !== 'string'
    || !Array.isArray(palette.colors) || !palette.colors.length || palette.colors.length > 6000) fail('engine.palette');
  if(palette.catalogue!==undefined)catalogueReference(palette.catalogue);
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
  const colors = [],heldIds=new Set();
  for(const lot of lotList){
    if(lot.archived)continue;
    const status=lot.status??lot.condition??'usable',quantity=lot.quantity??lot.qty;
    if(['usable','available','good'].includes(status)&&((quantity==null&&includeUnknown)||(Number.isFinite(quantity)&&quantity>0)))heldIds.add(lot.materialId);
  }
  for (const item of itemList) {
    if (item.archived || (item.category !== undefined && item.category !== 'thread') || (selection && !selection.has(item.id)) || !heldIds.has(item.id)) continue;
    const known=supplierSwatch(item.properties?.product??item);
    if(known.colorVariation==='multicolour'||item.properties?.product?.suitability==='verify-technique')continue;
    const hex = item.hex ?? item.color ?? item.attributes?.hex ?? item.attributes?.color;
    if (typeof hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(hex)) continue;
    const code = item.code ?? item.reference ?? '';
    if (typeof code !== 'string') continue;
    colors.push({ brand: item.brand ?? '', range: item.range ?? '', itemId: item.id, code, name: item.name ?? code,
      hex, rgb: [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16)),...(item.properties?.product&&(!item.properties.product.hex||item.properties.product.hex.toLowerCase()===hex.toLowerCase())?{product:normalizeSupplierProduct(item.properties.product)}:{}) });
  }
  if (!colors.length) fail('engine.inventoryPaletteEmpty');
  return validatePalette({ brand: 'Inventory', source: 'user-inventory', approximate: true, colors });
}

/** Preference never means availability or sufficient stock: reserved and unmeasured usable holdings remain eligible. */
export function preferredInventoryPalette(items,lots,{tolerance=6}={}) {
  if(!finite(tolerance,0,15))fail('engine.preferenceTolerance');
  let owned;try{owned=inventoryPalette(items,lots).colors}catch(error){if(error.code!=='engine.inventoryPaletteEmpty')throw error;owned=[];}
  return validatePalette({brand:'Inventory + DMC',source:'user-inventory + '+dmcPalette.source,approximate:true,
    colors:[...owned,...dmcPalette.colors.map(c=>({...c,brand:'DMC'}))],
    preference:{version:1,indices:owned.map((_,i)=>i),tolerance,maxDistance:20,metric:'CIE76',stage:'cluster-to-palette',holdings:'positive-or-unmeasured-usable-including-reserved'}});
}
function conversionOptions(settings,palette){
  const protectedMask=new Uint8Array(settings.width*settings.height);
  for(const r of settings.protectedRegions??[])for(let y=r.y;y<r.y+r.height;y++)protectedMask.fill(1,y*settings.width+r.x,y*settings.width+r.x+r.width);
  const preference=palette.preference;
  if(preference && (preference.version!==1||!Array.isArray(preference.indices)||preference.indices.length>palette.colors.length||new Set(preference.indices).size!==preference.indices.length||preference.indices.some(i=>!finite(i,0,palette.colors.length-1,true))||!finite(preference.tolerance,0,15)||preference.maxDistance!==20))fail('engine.preference');
  return {protectedMask,...(preference?{preferredIndices:preference.indices,preferenceTolerance:preference.tolerance,maxPreferenceDistance:20}:{})};
}

/** Keep alpha, composite it, or explicitly remove matching border-connected pixels. */
export function prepareBackground(rgba, background, width, height) {
  if(background?.mode==='remove')return removeBorderBackground(rgba,normalizeBackground(background),width,height);
  const result=new Uint8ClampedArray(rgba);
  if(!background||background.mode==='transparent')return result;
  const hex=background.mode==='white'?'#ffffff':background.color;
  const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
  for(let i=0;i<result.length;i+=4){const alpha=result[i+3]/255;for(let c=0;c<3;c++)result[i+c]=Math.round(result[i+c]*alpha+rgb[c]*(1-alpha));result[i+3]=255;}
  return result;
}
function constrainedPalette(palette,settings){
  const fixed=settings.fixedColors??[],excluded=new Set(settings.excludedColors??[]);
  if([...fixed,...excluded].some(i=>i>=palette.colors.length))fail('engine.colorConstraints');
  if(fixed.some(i=>excluded.has(i)))fail('engine.constraintConflict');
  const indices=palette.colors.map((_,i)=>i).filter(i=>!excluded.has(i));
  if(!indices.length)fail('engine.paletteEmpty');
  const limit=Math.min(settings.maxColors,CAPABILITIES.modes[settings.mode],indices.length);
  if(fixed.length>limit)fail('engine.fixedColorLimit',{limit});
  const map=new Map(indices.map((i,j)=>[i,j])),effective=structuredClone(palette);
  effective.colors=indices.map(i=>effective.colors[i]);
  if(palette.preference)effective.preference={...structuredClone(palette.preference),indices:palette.preference.indices.filter(i=>map.has(i)).map(i=>map.get(i))};
  return {palette:effective,fixedIndices:fixed.map(i=>map.get(i)),limit};
}

export function generate({ rgba, settings: input, palette = dmcPalette, source = null, metadata = {} }) {
  const settings = validateSettings(input);
  validatePalette(palette);
  if (!(rgba instanceof Uint8ClampedArray) && !(rgba instanceof Uint8Array)) fail('engine.pixelBuffer');
  if (rgba.length !== settings.width * settings.height * 4) fail('engine.pixelLength', { expected: settings.width * settings.height * 4, actual: rgba.length });
  const prepared=prepareBackground(rgba,settings.background,settings.width,settings.height);
  let visible = false;
  for (let i = 3; i < prepared.length; i += 4) if (prepared[i] >= CAPABILITIES.alphaThreshold) { visible = true; break; }
  if (!visible) fail('engine.emptyImage');
  // All mutable inputs are copied: conversion must not mutate caller palettes.
  if(settings.fixedColors?.length||settings.excludedColors?.length)conversionOptions(settings,palette);
  const restriction=constrainedPalette(palette,settings),effectivePalette=restriction.palette;
  let result;
  try { result = convert(prepared, settings, effectivePalette, {...conversionOptions(settings,effectivePalette),...(restriction.fixedIndices.length?{fixedIndices:restriction.fixedIndices}:{})}); }
  catch (error) { throw new PatternError('engine.generationFailed', { cause: error instanceof PatternError ? error.code : 'quantizer' }); }
  const symbols=settings.symbolMode?symbolsForMode(settings.symbolMode,result.colors.length):SYMBOLS;
  const colors = result.colors.map((color, index) => ({ ...color, brand: color.brand ?? palette.brand, symbol: symbols[index], strands: settings.strands, ...(palette.catalogue?{catalogueRef:structuredClone(palette.catalogue)}:{}) }));
  const revision = createBlank(settings.width, settings.height, colors, metadata);
  revision.cells = result.cells;
  revision.settings = settings;
  const directDetail=settings.mode==='detail'&&settings.maxColors>=effectivePalette.colors.length&&!restriction.fixedIndices.length;
  const advanced=settings.background||settings.fixedColors?.length||settings.excludedColors?.length;
  revision.provenance = { ...ENGINE,algorithm:directDetail?'nearest-CIELAB-CIE76':ENGINE.algorithm,iterations:directDetail?0:ENGINE.iterations,...(advanced?{adaptations:[...ENGINE.adaptations,'explicit-alpha-background','fixed-excluded-palette-indices',...(settings.background?.mode==='remove'?['border-connected-background-removal']:[])]}:{ }), parameters: structuredClone(settings), palette: { brand: palette.brand, source: palette.source, approximate: palette.approximate !== false, ...(palette.catalogue?{catalogue:structuredClone(palette.catalogue)}:{}),
    colors: palette.colors.map(c => ({ brand: c.brand ?? palette.brand, range: c.range ?? '', code: c.code, hex: c.hex, rgb: [...c.rgb], ...(c.itemId ? { itemId: c.itemId } : {}) })) },
    preference: palette.preference??null, cleanup:{changedCells:result.cleanupChanged,protection:'keep-whole-four-connected-regions-touching-protected-output-grid-rectangles'}, source: source == null ? null : structuredClone(source), alphaPolicy: { emptyBelow: ['white','color'].includes(settings.background?.mode)?0:128, partialBackground: settings.background?.mode==='color'?settings.background.color:'#ffffff' }, effectiveColorLimit: restriction.limit };
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
