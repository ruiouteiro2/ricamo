/** Domain primitives shared by inventory and projects. No storage or UI effects. */
export class DomainError extends Error {
  constructor(code, details = {}) {
    super(code);
    this.name = 'DomainError';
    this.code = code;
    this.details = details;
  }
}

export function assert(condition, code, details) {
  if (!condition) throw new DomainError(code, details);
}

export const SCALE = 1_000_000;
export function quantity(value, { nullable = false, positive = false, field = 'quantity' } = {}) {
  if (nullable && (value === null || value === undefined || value === '')) return null;
  let n = value;
  if (typeof n === 'string') {
    const s = n.trim();
    assert(/^-?\d+(?:[.,]\d{1,6})?$/.test(s), 'invalid_number', { field, value });
    n = Number(s.replace(',', '.'));
  }
  assert(typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1_000_000_000, 'invalid_number', { field, value });
  const scaled = Math.round(n * SCALE);
  assert(Number.isSafeInteger(scaled), 'invalid_number', { field, value });
  assert(!positive || scaled > 0, 'quantity_positive', { field });
  return scaled / SCALE;
}

export function add(...values) { return values.reduce((sum, n) => sum + Math.round(n * SCALE), 0) / SCALE; }
export function subtract(a, b) { return (Math.round(a * SCALE) - Math.round(b * SCALE)) / SCALE; }
export function text(value, field, { required = false, max = 2000 } = {}) {
  if (value === undefined || value === null) value = '';
  assert(typeof value === 'string' && value.length <= max, 'invalid_text', { field, max });
  assert(!required || value.trim().length > 0, 'required', { field });
  return value.trim();
}
export function identifier(value, field = 'id') {
  assert(typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,128}$/.test(value), 'invalid_id', { field });
  return value;
}
export function oneOf(value, allowed, field) {
  assert(allowed.includes(value), 'invalid_choice', { field, value, allowed });
  return value;
}
export function bool(value, field) {
  assert(typeof value === 'boolean', 'invalid_boolean', { field });
  return value;
}
export function integer(value, field, { min = 0, max = 1_000_000_000, nullable = false } = {}) {
  if (nullable && (value === null || value === undefined || value === '')) return null;
  const n = quantity(value, { field });
  assert(Number.isInteger(n) && n >= min && n <= max, 'invalid_integer', { field, min, max });
  return n;
}
export function currency(value = 'EUR') {
  assert(typeof value === 'string' && /^[A-Z]{3}$/.test(value), 'invalid_currency');
  return value;
}
export function date(value, field = 'date') {
  const s = text(value, field, { max: 40 });
  if (!s) return '';
  assert(/^\d{4}-\d{2}-\d{2}(T[^\s]+)?$/.test(s) && Number.isFinite(Date.parse(s)), 'invalid_date', { field });
  if (s.length === 10) assert(new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s, 'invalid_date', { field });
  return s;
}
export function stringList(value = [], field = 'tags', max = 100) {
  assert(Array.isArray(value) && value.length <= max, 'invalid_list', { field });
  return [...new Set(value.map(v => text(v, field, { required: true, max: 200 })))];
}
export function jsonObject(value = {}, field = 'properties') {
  assert(value && typeof value === 'object' && !Array.isArray(value), 'invalid_object', { field });
  assertSafeJson(value);
  assert(JSON.stringify(value).length <= 100_000, 'data_too_large', { field });
  return structuredClone(value);
}
export function assertSafeJson(value, depth = 0) {
  assert(depth <= 20, 'data_too_deep');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') { assert(Number.isFinite(value), 'invalid_number'); return; }
  assert(typeof value === 'object', 'invalid_data');
  if (Array.isArray(value)) { value.forEach(v => assertSafeJson(v, depth + 1)); return; }
  assert(Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null, 'invalid_object');
  for (const [key, child] of Object.entries(value)) {
    assert(!['__proto__', 'prototype', 'constructor'].includes(key), 'unsafe_key');
    assertSafeJson(child, depth + 1);
  }
}
export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
export function find(state, collection, id, { optional = false } = {}) {
  if (optional && !id) return null;
  identifier(id, `${collection}Id`);
  const record = state[collection].find(item => item.id === id);
  assert(record, 'not_found', { collection, id });
  return record;
}
export function optionalRef(state, collection, id) {
  if (id === '' || id === null || id === undefined) return null;
  return find(state, collection, id).id;
}
export function recordId(state, collection, payload, context) {
  if (payload.id) return identifier(payload.id);
  const id = identifier(context.id());
  assert(!state[collection].some(item => item.id === id), 'duplicate_id', { collection, id });
  return id;
}
export function put(state, collection, record) {
  const index = state[collection].findIndex(item => item.id === record.id);
  if (index < 0) state[collection].push(record);
  else state[collection][index] = record;
  return record;
}
export function movement(state, context, fields) {
  const row = { id: context.id(), date: context.now, operationId: context.operationId, ...fields };
  state.movements.push(row);
  return row;
}
export function activeProject(state, id) {
  const project = find(state, 'projects', id);
  assert(!['completed', 'archived'].includes(project.status), 'project_closed', { projectId: id });
  return project;
}
export function totalReserved(state, lotId, projectIds) {
  const selected = projectIds ? new Set(projectIds) : null;
  return add(...state.reservations.filter(r => r.lotId === lotId && (!selected || selected.has(r.projectId))).map(r => r.quantity));
}
export function audit(state, context, entity, id, action, details = {}) {
  state.audit.push({ id: context.id(), date: context.now, operationId: context.operationId, entity, entityId: id, action, details });
}
