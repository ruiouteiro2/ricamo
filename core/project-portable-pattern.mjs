import { assert, integer, quantity, text, identifier, oneOf } from './shared.mjs';
import { validateRevision } from './pattern.mjs';

const copy = (value, keys) => Object.fromEntries(keys.filter(key => value?.[key] !== undefined).map(key => [key, structuredClone(value[key])]));
const componentFields = ['brand', 'range', 'code', 'name', 'hex', 'strands', 'itemId'];
const object = value => { assert(value && typeof value === 'object' && !Array.isArray(value), 'project_package_settings'); return value; };
function strings(value, keys) {
  return Object.fromEntries(keys.filter(key => value[key] !== undefined).map(key => [key, text(value[key], key, { max: 1000 })]));
}
function numeric(value, keys) {
  return Object.fromEntries(keys.filter(key => value[key] !== undefined).map(key => [key, quantity(value[key], { field: key })]));
}
function boolean(value, key, result) {
  if (value[key] !== undefined) { assert(typeof value[key] === 'boolean', 'project_package_settings'); result[key] = value[key]; }
}
function settings(value) {
  object(value);
  const result = numeric(value, ['width', 'height', 'count', 'strands', 'maxColors', 'region', 'waste']);
  if (value.mode !== undefined) result.mode = oneOf(value.mode, ['detail', 'balanced', 'simple'], 'mode');
  if (value.protectedRegions !== undefined) {
    assert(Array.isArray(value.protectedRegions) && value.protectedRegions.length <= 20, 'project_package_settings');
    result.protectedRegions = value.protectedRegions.map(rect => Object.fromEntries(['x', 'y', 'width', 'height'].map(key => [key, integer(object(rect)[key], key, { min: key === 'x' || key === 'y' ? 0 : 1, max: 500 })])));
  }
  return result;
}
function provenance(value, attachmentIds, revisionIds) {
  object(value);
  const result = { ...strings(value, ['name', 'version', 'originalSha256', 'algorithm', 'importedFormat']), ...numeric(value, ['adapterVersion', 'iterations', 'effectiveColorLimit']) };
  boolean(value, 'sourceImageEmbedded', result);
  boolean(value, 'edited', result);
  if (value.editorBaseRevisionId) {
    result.edited = true;
    if (revisionIds.has(value.editorBaseRevisionId)) result.editorBaseRevisionId = identifier(value.editorBaseRevisionId);
  }
  if (value.adaptations !== undefined) {
    assert(Array.isArray(value.adaptations) && value.adaptations.length <= 100, 'project_package_settings');
    result.adaptations = value.adaptations.map(item => text(item, 'adaptation', { max: 100 }));
  }
  if (value.parameters !== undefined) result.parameters = settings(value.parameters);
  if (value.alphaPolicy !== undefined) {
    const alpha = object(value.alphaPolicy);
    result.alphaPolicy = { emptyBelow: integer(alpha.emptyBelow, 'emptyBelow', { min: 0, max: 255 }), partialBackground: text(alpha.partialBackground, 'partialBackground', { max: 7 }) };
    assert(/^#[0-9a-f]{6}$/i.test(result.alphaPolicy.partialBackground), 'project_package_settings');
  }
  if (value.palette !== undefined) {
    const palette = object(value.palette);
    assert(Array.isArray(palette.colors) && palette.colors.length <= 6000, 'project_package_settings');
    result.palette = { ...strings(palette, ['brand', 'source']), colors: palette.colors.map(color => {
      object(color); const row = strings(color, ['brand', 'range', 'code', 'hex']);
      assert(/^#[0-9a-f]{6}$/i.test(row.hex), 'project_package_settings');
      if (color.rgb !== undefined) { assert(Array.isArray(color.rgb) && color.rgb.length === 3, 'project_package_settings'); row.rgb = color.rgb.map(number => integer(number, 'rgb', { min: 0, max: 255 })); }
      // Candidate palette identities survive without exporting unrelated local IDs.
      return row;
    }) };
    boolean(palette, 'approximate', result.palette);
  }
  if (value.preference != null) {
    const preference = object(value.preference);
    assert(Array.isArray(preference.indices) && preference.indices.length <= 6000, 'project_package_settings');
    result.preference = { ...numeric(preference, ['version', 'tolerance', 'maxDistance']), ...strings(preference, ['metric', 'stage', 'holdings']), indices: preference.indices.map(index => integer(index, 'index', { min: 0, max: (result.palette?.colors.length ?? 0) - 1 })) };
  }
  if (value.cleanup !== undefined) result.cleanup = { ...numeric(object(value.cleanup), ['changedCells']), ...strings(value.cleanup, ['protection']) };
  if (value.source === 'blank') result.source = 'blank';
  else if (value.source != null) {
    const source = object(value.source), output = {};
    if (source.digest !== undefined) { assert(typeof source.digest === 'string' && /^[a-f0-9]{64}$/.test(source.digest), 'project_package_integrity'); output.digest = source.digest; }
    if (source.attachmentId && attachmentIds.has(source.attachmentId)) output.attachmentId = identifier(source.attachmentId);
    if (source.adjustments !== undefined) {
      const adjustments = object(source.adjustments);
      output.adjustments = numeric(adjustments, ['x', 'y', 'width', 'height', 'rotation', 'brightness', 'contrast']);
      for (const key of ['flipX', 'flipY']) boolean(adjustments, key, output.adjustments);
    }
    result.source = output;
  }
  return result;
}

/** Whitelist mechanical metadata at every level; files and private notes stay opt-in. */
export function portableRevision(revision, privateNotes, { attachmentIds = new Set(), revisionIds = new Set() } = {}) {
  validateRevision(revision);
  const result = copy(revision, ['id', 'name', 'width', 'height', 'cells', 'createdAt']);
  result.parentId = revisionIds.has(revision.parentId) ? revision.parentId : null;
  result.halfStitches = (revision.halfStitches ?? []).map(row => copy(row, ['id', 'x', 'y', 'color', 'direction']));
  result.backstitches = (revision.backstitches ?? []).map(row => copy(row, ['id', 'x1', 'y1', 'x2', 'y2', 'color']));
  result.colors = revision.colors.map(color => {
    const row = copy(color, ['brand', 'range', 'code', 'name', 'hex', 'rgb', 'symbol', 'strands', 'backStrands', 'itemId']);
    if (color.blend) row.blend = { version: 1, components: color.blend.components.map(component => copy(component, componentFields)), ...(color.blend.backComponents ? { backComponents: color.blend.backComponents.map(component => copy(component, componentFields)) } : {}) };
    return row;
  });
  if (revision.settings !== undefined) result.settings = settings(revision.settings);
  if (revision.provenance !== undefined) result.provenance = provenance(revision.provenance, attachmentIds, revisionIds);
  if (privateNotes && revision.notes) result.notes = revision.notes;
  return result;
}
export function colorMaterialIds(color) {
  return [color.itemId, ...(color.blend?.components ?? []).map(row => row.itemId), ...(color.blend?.backComponents ?? []).map(row => row.itemId)].filter(Boolean);
}
export function remapPortableRevision(revision, { id, materialMap, attachmentMap, revisionMap }) {
  const result = portableRevision(revision, true, { attachmentIds: new Set(attachmentMap.keys()), revisionIds: new Set(revisionMap.keys()) });
  result.id = id;
  if (result.parentId) result.parentId = revisionMap.get(result.parentId);
  if (result.provenance?.editorBaseRevisionId) result.provenance.editorBaseRevisionId = revisionMap.get(result.provenance.editorBaseRevisionId);
  const remap = color => { if (color.itemId) { assert(materialMap.has(color.itemId), 'broken_reference'); color.itemId = materialMap.get(color.itemId); } };
  for (const color of result.colors) { remap(color); color.blend?.components.forEach(remap); color.blend?.backComponents?.forEach(remap); }
  const source = result.provenance?.source;
  if (source?.attachmentId) source.attachmentId = attachmentMap.get(source.attachmentId);
  return result;
}

function knownKeys(value, canonical) {
  if (!value || typeof value !== 'object') return;
  assert(canonical && typeof canonical === 'object', 'project_package_privacy');
  for (const key of Object.keys(value)) {
    assert(Object.hasOwn(canonical, key), 'project_package_privacy');
    knownKeys(value[key], canonical[key]);
  }
}
export function validatePortableRevision(revision, options) {
  const canonical = portableRevision(revision, true, options);
  for (const key of ['colors', 'settings', 'provenance']) if (revision[key] !== undefined) knownKeys(revision[key], canonical[key]);
  assert(!revision.parentId || options.revisionIds.has(revision.parentId), 'revision_not_found');
}
