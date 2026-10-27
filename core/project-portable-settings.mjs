import { assert, quantity, integer, oneOf, identifier } from './shared.mjs';
const sides = ['left', 'right', 'top', 'bottom'];
const fabricNumbers = ['countX', 'countY', 'overX', 'overY'];
const threadNumbers = ['strands', 'backStrands', 'waste', 'crossTravel', 'halfTravel', 'outlineReturn', 'batchSize', 'startFinishCm', 'calibrationFactor'];
function object(value) { assert(value && typeof value === 'object' && !Array.isArray(value), 'project_package_settings'); return value; }
function numbers(value, keys) { object(value); return Object.fromEntries(keys.filter(key => value[key] !== undefined).map(key => [key, quantity(value[key], { nullable: true, field: key })])); }
function margins(value) { return numbers(value, sides); }
/** Mechanical values only: never clone free-form settings into an export. */
export function portableFabricSettings(value) {
  const result = numbers(value, fabricNumbers);
  if (value.countMeaning !== undefined) result.countMeaning = oneOf(value.countMeaning, ['stitches', 'threads'], 'countMeaning');
  if (value.margins !== undefined) result.margins = margins(value.margins);
  return result;
}
export function portableThreadSettings(value) {
  const result = numbers(value, threadNumbers);
  if (value.colorStrands !== undefined) { object(value.colorStrands); result.colorStrands = Object.fromEntries(Object.entries(value.colorStrands).filter(([key]) => /^(?:[0-9]|[1-7][0-9])$/.test(key)).map(([key, strands]) => [key, integer(strands, 'strands', { min: 1, max: 100 })])); }
  return result;
}
export function portablePlanningSettings(settings) {
  const result = {};
  if (settings.fabric !== undefined) result.fabric = portableFabricSettings(settings.fabric);
  if (settings.thread !== undefined) result.thread = portableThreadSettings(settings.thread);
  return result;
}
export function portableFabricPlan(value) {
  const result = numbers(value, ['widthCm', 'heightCm', 'countX', 'countY']);
  if (value.countMeaning !== undefined) result.countMeaning = oneOf(value.countMeaning, ['stitches', 'threads'], 'countMeaning');
  if (value.washState !== undefined) result.washState = oneOf(value.washState, ['unknown', 'unwashed', 'prewashed'], 'washState');
  if (value.usableMargins !== undefined) result.usableMargins = margins(value.usableMargins);
  if (value.irregular !== undefined) { assert(typeof value.irregular === 'boolean', 'project_package_settings'); result.irregular = value.irregular; }
  return result;
}
function sameKeys(source, projection) { assert(Object.keys(object(source)).every(key => Object.hasOwn(projection, key)), 'project_package_privacy'); }
/** Reject hidden free-form properties in incoming mechanical blocks too. */
export function validatePortablePlanningSettings(settings) {
  if (settings.fabric !== undefined) { const value = settings.fabric, projected = portableFabricSettings(value); sameKeys(value, projected); if (value.margins !== undefined) sameKeys(value.margins, projected.margins); }
  if (settings.thread !== undefined) { const value = settings.thread, projected = portableThreadSettings(value); sameKeys(value, projected); if (value.colorStrands !== undefined) sameKeys(value.colorStrands, projected.colorStrands); }
  if (settings.transferFabric !== undefined) { const value = settings.transferFabric, projected = portableFabricPlan(value); identifier(value.materialId); assert(value.requiresLocalSelection === true, 'project_package_stock'); sameKeys(value, { ...projected, materialId: value.materialId, requiresLocalSelection: true }); if (value.usableMargins !== undefined) sameKeys(value.usableMargins, projected.usableMargins); }
}
