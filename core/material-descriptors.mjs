import { validateCustomProperties } from './inventory-workflows.mjs';
import { assert, assertSafeJson, jsonObject, date, integer, text } from './shared.mjs';

// Native category descriptors share one registry. User-defined fields remain in properties.custom.
const field = (key, categories, extra = {}) => ({ key, categories, label: `descriptor_${key}`, type: 'text', max: 300, ...extra });
export const MATERIAL_DESCRIPTORS = [
  field('variant', ['*']),
  field('catalogueStatus', ['*'], { type: 'select', options: ['current','discontinued'] }),
  field('replacementSuggestion', ['thread','fabric','tool','preparation','stabilizer','embellishment','finishing'], { type: 'textarea', max: 1000 }),
  field('replacementSource', ['thread','fabric','tool','preparation','stabilizer','embellishment','finishing'], { max: 1000 }),
  field('packagingType', ['thread','preparation','stabilizer','embellishment','finishing'], { type: 'select', options: ['skein','spool','bobbin','cone','ball','loose','pack','custom'] }),
  field('sizeSystem', ['thread'], { max: 100 }),
  field('colourEffect', ['thread','fabric','embellishment'], { max: 300 }),
  field('texture', ['fabric'], { max: 500 }),
  field('treatment', ['fabric','stabilizer','preparation'], { type: 'textarea', max: 1000 }),
  field('toolType', ['tool','storage'], { max: 200 }),
  field('toolSize', ['tool','storage'], { max: 200 }),
  field('usableArea', ['tool','storage'], { max: 200 }),
  field('size', ['embellishment','preparation','stabilizer','finishing'], { max: 200 }),
  field('shape', ['embellishment'], { max: 200 }),
  field('finish', ['embellishment','finishing'], { max: 300 }),
  field('removalMethod', ['preparation','stabilizer'], { type: 'textarea', max: 1000 }),
  field('author', ['reference'], { max: 500 }),
  field('publisher', ['reference'], { max: 300 }),
  field('isbn', ['reference'], { max: 40 }),
  field('edition', ['reference'], { max: 200 }),
  field('pageCount', ['reference'], { type: 'integer', min: 1, max: 100000 }),
  field('relevantPages', ['reference'], { max: 300 }),
  field('techniques', ['reference'], { max: 500 }),
];
export const LOT_DESCRIPTORS = [
  field('packageCondition', ['thread','preparation','stabilizer','embellishment','finishing','kit'], { type: 'select', options: ['sealed','opened','partial','mixed'] }),
  field('washingState', ['fabric'], { type: 'select', options: ['unwashed','washed','preshrunk'] }),
  field('expiryDate', ['preparation','stabilizer','finishing'], { type: 'date' }),
  field('personalReference', ['*'], { max: 200 }),
];
const list = scope => scope === 'lot' ? LOT_DESCRIPTORS : MATERIAL_DESCRIPTORS;
const maps = { material: new Map(MATERIAL_DESCRIPTORS.map(row => [row.key,row])), lot: new Map(LOT_DESCRIPTORS.map(row => [row.key,row])) };
export function descriptorFields(category, scope = 'material', properties = {}) { return list(scope).filter(row => row.categories.includes('*') || row.categories.includes(category) || Object.hasOwn(properties.details || {}, row.key)); }
export function descriptorValue(properties, key) { return properties?.details?.[key]; }
export function setDescriptor(properties, key, value, scope = 'material') {
  assert(list(scope).some(row => row.key === key), 'descriptor_unknown_field');
  properties.details ??= { version: 1 };
  properties.details[key] = value;
}
export function normalizeDescriptorProperties(properties = {}, scope = 'material') {
  const result = jsonObject(properties);
  if (result.details !== undefined) assert(result.details && typeof result.details === 'object' && !Array.isArray(result.details), 'descriptor_invalid');
  if (result.details !== undefined) for (const spec of list(scope)) {
    if (spec.type === 'integer' && Object.hasOwn(result.details, spec.key)) { try { result.details[spec.key] = integer(result.details[spec.key], spec.key, { min: spec.min, max: spec.max, nullable: true }); } catch { assert(false, 'descriptor_invalid'); } }
  }
  validateDescriptorProperties(result, scope);
  return result;
}
export function validateDescriptorProperties(properties, scope = 'material') {
  assert(properties && typeof properties === 'object' && !Array.isArray(properties), 'descriptor_invalid');
  assertSafeJson(properties); assert(JSON.stringify(properties).length <= 100000, 'data_too_large');
  if (scope === 'material') validateCustomProperties(properties);
  if (properties.details === undefined) return properties;
  const details = properties.details;
  assert(details && typeof details === 'object' && !Array.isArray(details), 'descriptor_invalid');
  assert(details.version === 1, 'descriptor_version');
  const fields = maps[scope];
  for (const [key, value] of Object.entries(details)) {
    if (key === 'version') continue;
    const spec = fields.get(key); assert(spec, 'descriptor_unknown_field');
    if (spec.type === 'integer') assert(value === null || typeof value === 'number' && Number.isInteger(value) && value >= spec.min && value <= spec.max, 'descriptor_invalid');
    else {
      assert(typeof value === 'string' && value.length <= spec.max, 'descriptor_invalid'); text(value, key, { max: spec.max });
      if (spec.type === 'select') assert(value === '' || spec.options.includes(value), 'descriptor_invalid');
      if (spec.type === 'date' && value !== '') { assert(/^\d{4}-\d{2}-\d{2}$/.test(value), 'descriptor_invalid'); date(value, key); }
    }
  }
  return properties;
}
export function validateMaterialDescriptors(state) {
  for (const material of state.materials) validateDescriptorProperties(material.properties);
  for (const lot of state.lots) validateDescriptorProperties(lot.properties, 'lot');
  return state;
}
export function recordedDescriptors(properties, scope = 'material') {
  return list(scope).filter(spec => Object.hasOwn(properties?.details || {}, spec.key) && descriptorValue(properties, spec.key) !== '' && descriptorValue(properties, spec.key) !== null).map(spec => ({ ...spec, value: descriptorValue(properties, spec.key) }));
}
/** Include native and custom descriptive values without flattening unrelated internal metadata. */
export function materialDescriptorSearch(material, lots = []) {
  return [material.description, ...['composition','care','threadType','threadSize','fabricType'].map(key => material.properties?.[key]), ...recordedDescriptors(material.properties).map(row => row.value), ...Object.values(material.properties?.custom || {}), ...lots.flatMap(lot => recordedDescriptors(lot.properties, 'lot').map(row => row.value))].join(' ');
}

// Free-form recommendations, citations and treatment/removal instructions follow the package's private-notes choice.
export function portableMaterialDescriptors(properties, includePrivateNotes = false) {
  if (properties.details === undefined) return {};
  validateDescriptorProperties(properties);
  const privateFields = new Set(['replacementSuggestion','replacementSource','treatment','removalMethod']);
  return {details:Object.fromEntries(Object.entries(properties.details).filter(([key])=>includePrivateNotes||!privateFields.has(key)))};
}

export function hasPrivateMaterialDescriptors(properties) {
  return ['replacementSuggestion','replacementSource','treatment','removalMethod'].some(key=>Boolean(properties.details?.[key]));
}
