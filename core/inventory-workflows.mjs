import { assert, identifier, text, quantity, stringList, bool, oneOf, find, optionalRef } from './shared.mjs';
import { saveMaterial, addLot, UNITS } from './inventory.mjs';

export const INVENTORY_BATCH_LIMIT = 200;
export const BULK_FIELDS = ['brand', 'range', 'minimum', 'favorite', 'tags', 'notes'];
function inEntry(index, action) {
  try { return action(); }
  catch (error) { error.details = { ...error.details, row: index + 1 }; throw error; }
}
const identity = (brand, range, code) => JSON.stringify([brand.trim().toLocaleLowerCase(), range.trim().toLocaleLowerCase(), code.trim()]);
function selectedMaterials(state, ids) {
  assert(Array.isArray(ids) && ids.length > 0 && ids.length <= INVENTORY_BATCH_LIMIT, 'inventory_batch_limit');
  assert(new Set(ids).size === ids.length, 'duplicate_selection');
  return ids.map(id => find(state, 'materials', identifier(id)));
}
export function previewBulkMaterials(state, { ids, changes }) {
  const materials = selectedMaterials(state, ids);
  assert(changes && typeof changes === 'object' && !Array.isArray(changes), 'invalid_payload');
  const keys = Object.keys(changes);
  assert(keys.length > 0 && keys.every(key => BULK_FIELDS.includes(key)), 'inventory_bulk_fields');
  const normalized = {};
  for (const key of keys) {
    if (key === 'minimum') normalized[key] = quantity(changes[key], { nullable: true, field: key });
    else if (key === 'favorite') normalized[key] = bool(changes[key], key);
    else if (key === 'tags') normalized[key] = stringList(changes[key]);
    else normalized[key] = text(changes[key], key, { max: key === 'notes' ? 20000 : 200 });
  }
  return { changes: normalized, rows: materials.map(material => ({ id: material.id, name: material.name, changes: keys.map(key => ({ key, before: material[key], after: normalized[key] })) })) };
}
export function previewRapidMaterials(state, { base, entries }) {
  assert(base && typeof base === 'object', 'invalid_payload');
  assert(Array.isArray(entries) && entries.length > 0 && entries.length <= INVENTORY_BATCH_LIMIT, 'inventory_batch_limit');
  const common = { brand: text(base.brand, 'brand', { max: 200 }), range: text(base.range, 'range', { max: 200 }), category: text(base.category, 'category', { required: true, max: 100 }), unit: oneOf(base.unit, UNITS, 'unit') };
  const codes = entries.map((entry,index) => inEntry(index, () => { assert(entry && typeof entry === 'object' && !Array.isArray(entry), 'invalid_payload'); return text(entry.code, 'code', { required: true, max: 200 }); }));
  const counts = new Map(); codes.forEach(code => counts.set(code, (counts.get(code) || 0) + 1));
  const materialIndex = new Map();
  for (const material of state.materials) {
    if (material.archived) continue;
    const key = identity(material.brand, material.range, material.code);
    if (!materialIndex.has(key)) materialIndex.set(key, []);
    materialIndex.get(key).push(material);
  }
  const rows = entries.map((entry, index) => inEntry(index, () => {
    const code = codes[index], matches = materialIndex.get(identity(common.brand, common.range, code)) || [];
    const action = oneOf(entry.action ?? 'create', ['create', 'attach'], 'action');
    const duplicate = matches.length > 0 || counts.get(code) > 1;
    assert(typeof entry.createLot === 'boolean', 'invalid_boolean');
    let target = null;
    if (action === 'attach') {
      target = find(state, 'materials', entry.materialId);
      assert(matches.some(row => row.id === target.id), 'rapid_target_mismatch');
      assert(entry.createLot === true, 'rapid_attach_requires_lot');
      assert(target.unit === common.unit && target.category === common.category, 'incompatible_units');
    }
    const material = { ...common, code, name: text(target?.name || entry.name || `${common.brand} ${code}`.trim(), 'name', { required: true, max: 300 }), color: text(target?.color || entry.color, 'color', { max: 40 }) };
    assert(!material.color || /^#[0-9a-f]{6}$/i.test(material.color), 'invalid_color');
    const amount = quantity(entry.quantity, { nullable: true });
    const confidence = amount === null ? 'unknown' : oneOf(entry.confidence || 'exact', ['exact', 'estimated'], 'confidence');
    const locationId = optionalRef(state, 'locations', entry.locationId);
    return { index, material, materialId: target?.id ?? null, action, createLot: entry.createLot, quantity: amount, confidence, locationId, duplicate, matches: matches.map(row => ({ id: row.id, name: row.name, unit: row.unit, category: row.category })), needsDecision: duplicate && action === 'create' && entry.allowDuplicate !== true };
  }));
  return { rows, ready: rows.every(row => !row.needsDecision), materials: rows.filter(row => row.action === 'create').length, lots: rows.filter(row => row.createLot).length };
}
function previewIsCurrent(state, payload) { assert(payload.previewRevision === state.revision, 'inventory_preview_stale'); }
export const inventoryWorkflowHandlers = {
  'material.bulk': (state, payload, context) => {
    previewIsCurrent(state, payload);
    const preview = previewBulkMaterials(state, payload);
    for (const row of preview.rows) saveMaterial(state, { id: row.id, ...preview.changes }, context);
  },
  'material.rapid': (state, payload, context) => {
    previewIsCurrent(state, payload);
    const preview = previewRapidMaterials(state, payload);
    assert(preview.ready, 'rapid_duplicate_decision');
    for (const row of preview.rows) {
      const id = row.materialId || context.id();
      if (row.action === 'create') saveMaterial(state, { ...row.material, id }, context);
      if (row.createLot) addLot(state, { materialId: id, quantity: row.quantity, confidence: row.confidence, locationId: row.locationId }, context);
    }
  },
};

/** Optional validator integrated by the application boundary for custom user metadata. */
export function validateInventoryWorkflowState(state) {
  const views = state.settings.preferences?.inventoryViews;
  if (views !== undefined) {
    assert(Array.isArray(views) && views.length <= 30, 'inventory_view_limit');
    const ids = new Set(), names = new Set();
    const allowed = ['search','category','location','filter','sort','page','stock','reservation','project','lotStatus'];
    for (const view of views) {
      identifier(view.id); text(view.name,'viewName',{required:true,max:100});
      assert(!ids.has(view.id) && !names.has(view.name),'inventory_view_name'); ids.add(view.id); names.add(view.name);
      assert(view.filters && typeof view.filters === 'object' && !Array.isArray(view.filters),'invalid_payload');
      assert(Object.keys(view.filters).every(key=>allowed.includes(key)),'invalid_payload');
      for (const [key,value] of Object.entries(view.filters)) {
        if(key==='page') assert(Number.isInteger(value)&&value>0&&value<=100000,'invalid_number');
        else { assert(typeof value==='string','invalid_text'); text(value,key,{max:key==='search'?2000:200}); }
      }
    }
  }
  for (const category of state.categories) {
    text(category.name, 'name', { required: true, max: 200 });
    assert(Array.isArray(category.fields) && category.fields.length <= 100, 'invalid_custom_fields');
    assert(new Set(category.fields).size === category.fields.length, 'invalid_custom_fields');
    for (const field of category.fields) { text(field, 'field', { required: true, max: 200 }); assert(!['__proto__','prototype','constructor'].includes(field), 'invalid_custom_fields'); }
  }
  for (const material of state.materials) validateCustomProperties(material.properties);
  return state;
}

/** Shared by persisted-state validation and CSV preflight; native descriptors never replace custom fields. */
export function validateCustomProperties(properties) {
  const fields = properties.custom;
  if (fields === undefined) return;
  assert(fields && typeof fields === 'object' && !Array.isArray(fields), 'invalid_custom_fields');
  assert(Object.keys(fields).length <= 100, 'invalid_custom_fields');
  for (const [key,value] of Object.entries(fields)) { text(key,'field',{required:true,max:200}); assert(typeof value==='string','invalid_custom_fields'); text(value,'value',{max:1000}); }
}
