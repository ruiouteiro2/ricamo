import { DomainError, assert, assertSafeJson, text, identifier, stableStringify, oneOf, jsonObject, stringList, recordId, put } from './shared.mjs';
import { saveMaterial, archiveMaterial, duplicateMaterial, mergeMaterial, addLot, saveLot, stockMove, reverseMovement, setReservation, saveLocation, saveSupplier } from './inventory.mjs';
import { saveProject, duplicateProject, closeProject, saveNeed, saveTask, saveSession, updateProgress, saveProjectView } from './projects.mjs';
import { savePurchase, receivePurchase, generatePurchases } from './purchasing.mjs';
import { cutFabric, openKit } from './fabric.mjs';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

export { DomainError };
export { inventorySummary } from './inventory.mjs';
export { projectProgress, confirmedConsumption } from './projects.mjs';
export { shoppingNeeds, costTotals } from './purchasing.mjs';
export { fabricSize, fabricFit, convertQuantity } from './fabric.mjs';
export { validateState } from './validation.mjs';

const COLLECTIONS = ['materials', 'lots', 'movements', 'reservations', 'projects', 'needs', 'purchases', 'receipts', 'locations', 'suppliers', 'patterns', 'sessions', 'attachments', 'categories', 'tasks', 'cuts', 'kitOpenings', 'audit', 'operations'];
export function createState() {
  return { schemaVersion: 1, revision: 0, settings: { language: 'it', currency: 'EUR', paper: 'a4' }, ...Object.fromEntries(COLLECTIONS.map(name => [name, []])) };
}

export function validateStateShape(state) {
  assert(state?.schemaVersion === 1, 'unsupported_schema', { version: state?.schemaVersion });
  assert(Number.isSafeInteger(state.revision) && state.revision >= 0, 'invalid_revision');
  for (const name of COLLECTIONS) assert(Array.isArray(state[name]), 'invalid_collection', { collection: name });
  assert(state.settings && ['it', 'en'].includes(state.settings.language), 'invalid_settings');
}

const handlers = {
  'material.save': saveMaterial, 'material.archive': archiveMaterial, 'material.duplicate': duplicateMaterial, 'material.merge': mergeMaterial,
  'lot.add': addLot, 'lot.save': saveLot,
  'stock.move': stockMove, 'stock.reverse': reverseMovement, 'reservation.set': setReservation,
  'location.save': saveLocation, 'supplier.save': saveSupplier,
  'project.save': saveProject, 'project.duplicate': duplicateProject, 'project.close': closeProject,
  'project.progress': updateProgress, 'project.view': saveProjectView,
  'need.save': saveNeed, 'session.save': saveSession, 'task.save': saveTask,
  'purchase.save': savePurchase, 'purchase.receive': receivePurchase, 'purchase.generate': generatePurchases,
  'fabric.cut': cutFabric, 'kit.open': openKit,
  'settings.save': (state, p) => {
    if ('language' in p) state.settings.language = oneOf(p.language, ['it', 'en'], 'language');
    if ('paper' in p) state.settings.paper = oneOf(p.paper, ['a4', 'letter'], 'paper');
    if ('currency' in p) { assert(/^[A-Z]{3}$/.test(p.currency), 'invalid_currency'); state.settings.currency = p.currency; }
    if ('preferences' in p) state.settings.preferences = jsonObject(p.preferences);
  },
  'category.save': (state, p, ctx) => {
    const id = recordId(state, 'categories', p, ctx);
    put(state, 'categories', { id, name: text(p.name, 'name', { required: true, max: 200 }), fields: stringList(p.fields, 'fields'), createdAt: state.categories.find(c => c.id === id)?.createdAt ?? ctx.now });
  },
};

/**
 * Pure transactional command entry point. Mutates only a clone and returns only after
 * all rules pass. Persistence must commit this result atomically with its operation ID.
 * Optional context.handlers permits separately owned pattern/attachment commands while
 * preserving this validation, revision and idempotency boundary.
 */
export function applyCommand(state, command, context = {}) {
  validateStateShape(state);
  assertSafeJson(command);
  assert(command && typeof command === 'object' && typeof command.type === 'string', 'invalid_command');
  const operationId = identifier(command.operationId, 'operationId');
  const payload = command.payload ?? {};
  assert(payload && typeof payload === 'object' && !Array.isArray(payload), 'invalid_payload');
  const canonical = stableStringify({ type: command.type, payload });
  const signature = `sha256:${bytesToHex(sha256(utf8ToBytes(canonical)))}`;
  const previous = state.operations.find(operation => operation.id === operationId);
  if (previous) {
    // Backups made before compact signatures remain replay-compatible.
    assert(previous.signature === signature || previous.signature === canonical, 'idempotency_conflict', { operationId });
    return structuredClone(state);
  }
  const handler = Object.hasOwn(handlers, command.type) ? handlers[command.type] : context.handlers && Object.hasOwn(context.handlers, command.type) ? context.handlers[command.type] : null;
  assert(typeof handler === 'function', 'unknown_command', { type: command.type });
  const now = typeof context.now === 'function' ? context.now() : context.now ?? new Date().toISOString();
  assert(Number.isFinite(Date.parse(now)), 'invalid_date');
  const ctx = { now, id: context.id ?? (() => globalThis.crypto.randomUUID()), operationId };
  const next = structuredClone(state);
  handler(next, payload, ctx);
  next.revision++;
  next.operations.push({ id: operationId, type: command.type, signature, date: now });
  return next;
}
