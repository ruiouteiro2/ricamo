import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, applyCommand, inventorySummary, shoppingNeeds, fabricSize, fabricFit, convertQuantity, projectProgress, confirmedConsumption, costTotals, validateState } from '../core/commands.mjs';
import { quantity } from '../core/shared.mjs';

function setup() {
  let state = createState(), sequence = 0;
  const context = { now: '2026-10-27T09:00:00.000Z', id: () => `id-${++sequence}` };
  return {
    get state() { return state; },
    run(type, payload = {}, operationId = `operation-${++sequence}`) {
      state = applyCommand(state, { type, payload, operationId }, context);
      return state;
    },
    replace(value) { state = value; },
    context,
  };
}
function stock(amount = 24, extra = {}) {
  const s = setup();
  s.run('material.save', { id: 'thread', name: 'Cotton', category: 'thread', code: '001', unit: 'm', strands: 6, packageSize: 8, ...extra });
  s.run('lot.add', { id: 'lot', materialId: 'thread', quantity: amount });
  for (const id of ['A', 'B', 'C']) s.run('project.save', { id, name: id });
  return s;
}

test('AC34–36: reservations, consumption and release preserve physical stock and other projects', () => {
  const s = stock();
  s.run('reservation.set', { projectId: 'A', lotId: 'lot', quantity: 10 });
  s.run('reservation.set', { projectId: 'B', lotId: 'lot', quantity: 8 });
  assert.equal(inventorySummary(s.state, 'thread').available, 6);
  assert.equal(inventorySummary(s.state, 'thread').physical, 24);
  s.run('stock.move', { kind: 'consume', lotId: 'lot', projectId: 'A', quantity: 4 });
  let summary = inventorySummary(s.state, 'thread');
  assert.equal(summary.physical, 20); assert.equal(summary.available, 6);
  assert.equal(s.state.reservations.find(r => r.projectId === 'A').quantity, 6);
  assert.equal(s.state.reservations.find(r => r.projectId === 'B').quantity, 8);
  s.run('reservation.set', { projectId: 'A', lotId: 'lot', quantity: 3 });
  summary = inventorySummary(s.state, 'thread');
  assert.equal(summary.physical, 20); assert.equal(summary.available, 9);
});

test('AC37,38,66: aggregate demand shares stock once and protects third-party reservations', () => {
  const s = stock(10);
  s.run('need.save', { projectId: 'A', materialId: 'thread', quantity: 8 });
  s.run('need.save', { projectId: 'B', materialId: 'thread', quantity: 7 });
  assert.equal(shoppingNeeds(s.state, ['A', 'B'])[0].shortfall, 5);
  s.run('reservation.set', { projectId: 'A', lotId: 'lot', quantity: 4 });
  s.run('reservation.set', { projectId: 'B', lotId: 'lot', quantity: 3 });
  let need = shoppingNeeds(s.state, ['A', 'B'])[0];
  assert.equal(need.shortfall, 5); assert.equal(need.free, 3);
  s.run('reservation.set', { projectId: 'C', lotId: 'lot', quantity: 2 });
  need = shoppingNeeds(s.state, ['A', 'B'])[0];
  assert.equal(need.shortfall, 7); assert.equal(need.free, 1);
  assert.equal(s.state.reservations.find(r => r.projectId === 'C').quantity, 2);
});

test('AC39: operation retry is idempotent; changed payload with same ID is rejected', () => {
  const s = stock();
  const payload = { kind: 'consume', lotId: 'lot', projectId: 'A', quantity: 4 };
  s.run('stock.move', payload, 'consume-once');
  const revision = s.state.revision, count = s.state.movements.length;
  s.run('stock.move', payload, 'consume-once');
  assert.equal(s.state.revision, revision); assert.equal(s.state.movements.length, count);
  assert.equal(s.state.lots[0].quantity, 20);
  assert.throws(() => s.run('stock.move', { ...payload, quantity: 5 }, 'consume-once'), { code: 'idempotency_conflict' });
});

test('AC40: physical count reveals conflicts and cannot silently steal another reservation', () => {
  const s = stock(10);
  s.run('reservation.set', { projectId: 'A', lotId: 'lot', quantity: 6 });
  s.run('reservation.set', { projectId: 'B', lotId: 'lot', quantity: 4 });
  s.run('stock.move', { kind: 'count', lotId: 'lot', quantity: 5, reason: 'Physical count' });
  const summary = inventorySummary(s.state, 'thread');
  assert.equal(summary.physical, 5); assert.equal(summary.reserved, 10);
  assert.equal(summary.available, 0); assert.equal(summary.conflicts[0].quantity, 5);
  assert.throws(() => s.run('stock.move', { kind: 'consume', lotId: 'lot', projectId: 'A', quantity: 2 }), { code: 'insufficient_available' });
  s.run('reservation.set', { projectId: 'A', lotId: 'lot', quantity: 1 });
  assert.equal(inventorySummary(s.state, 'thread').conflicts.length, 0);
});

test('AC65: blocked physical material is excluded from usable availability', () => {
  const s = stock(22);
  s.run('lot.add', { id: 'blocked', materialId: 'thread', quantity: 2, status: 'blocked' });
  s.run('reservation.set', { projectId: 'A', lotId: 'lot', quantity: 18 });
  const summary = inventorySummary(s.state, 'thread');
  assert.equal(summary.physical, 24); assert.equal(summary.eligible, 22); assert.equal(summary.available, 4);
  assert.throws(() => s.run('reservation.set', { projectId: 'B', lotId: 'blocked', quantity: 1 }), { code: 'lot_unavailable' });
});

test('unknown stock remains distinct from zero; estimated confidence survives transfer', () => {
  const s = stock(null);
  const summary = inventorySummary(s.state, 'thread');
  assert.equal(summary.physical, null); assert.equal(summary.unknown, 1); assert.equal(summary.available, 0);
  assert.throws(() => s.run('reservation.set', { projectId: 'A', lotId: 'lot', quantity: 1 }), { code: 'unknown_quantity' });
  assert.throws(() => s.run('stock.move', { kind: 'consume', lotId: 'lot', quantity: 1 }), { code: 'unknown_quantity' });
  s.run('stock.move', { kind: 'count', lotId: 'lot', quantity: '1,5', confidence: 'estimated' });
  s.run('location.save', { id: 'box', name: 'Box' });
  s.run('stock.move', { kind: 'transfer', lotId: 'lot', toLocationId: 'box' });
  assert.equal(s.state.lots[0].quantity, 1.5); assert.equal(s.state.lots[0].confidence, 'estimated');
});

test('AC09: partial transfer conserves total and cannot transfer reserved pieces implicitly', () => {
  const s = stock(10);
  s.run('location.save', { id: 'box', name: 'Box' });
  s.run('reservation.set', { projectId: 'A', lotId: 'lot', quantity: 8 });
  assert.throws(() => s.run('stock.move', { kind: 'transfer', lotId: 'lot', quantity: 3, toLocationId: 'box' }), { code: 'insufficient_available' });
  s.run('stock.move', { kind: 'transfer', lotId: 'lot', quantity: 2, toLocationId: 'box' });
  assert.equal(inventorySummary(s.state, 'thread').physical, 10);
  assert.equal(s.state.lots.find(l => l.id === 'lot').quantity, 8);
  assert.equal(s.state.lots.find(l => l.locationId === 'box').quantity, 2);
});

test('stock never becomes negative; rejected transaction leaves caller state intact', () => {
  const s = stock(3), before = structuredClone(s.state);
  assert.throws(() => s.run('stock.move', { kind: 'loss', lotId: 'lot', quantity: 4 }), { code: 'insufficient_physical' });
  assert.deepEqual(s.state, before);
  assert.throws(() => s.run('stock.move', { kind: 'consume', lotId: 'lot', quantity: -1 }), { code: 'invalid_number' });
  assert.throws(() => s.run('material.save', { id: 'thread', name: 'Changed', unit: 'kg' }), { code: 'unit_in_use' });
  assert.equal(s.state.materials[0].name, 'Cotton');
});

test('AC04 and locale parsing: commercial codes survive; separators do not become thousands', () => {
  const s = stock();
  assert.equal(s.state.materials[0].code, '001');
  s.run('material.save', { id: 'thread', code: 'B5200' });
  assert.equal(s.state.materials[0].code, 'B5200');
  assert.equal(quantity('1,5'), 1.5); assert.equal(quantity('1.5'), 1.5);
  assert.throws(() => quantity('1,234.5'), { code: 'invalid_number' });
  assert.throws(() => s.run('material.save', { name: 'Invalid', code: 1 }), { code: 'invalid_text' });
});

test('fixed precision prevents cumulative decimal stock drift', () => {
  const s = stock(1);
  for (let i = 0; i < 10; i++) s.run('stock.move', { kind: 'consume', lotId: 'lot', quantity: 0.1 });
  assert.equal(s.state.lots[0].quantity, 0);
});

test('AC23: partial receipts enter stock once, orders themselves never do', () => {
  const s = stock(0);
  s.run('purchase.save', { id: 'order', materialId: 'thread', quantity: 8, unitPrice: 125, status: 'ordered' });
  assert.equal(inventorySummary(s.state, 'thread').physical, 0);
  s.run('purchase.receive', { purchaseId: 'order', quantity: 3 }, 'receive-once');
  s.run('purchase.receive', { purchaseId: 'order', quantity: 3 }, 'receive-once');
  assert.equal(inventorySummary(s.state, 'thread').physical, 3);
  assert.equal(s.state.purchases[0].status, 'partial'); assert.equal(s.state.receipts.length, 1);
  assert.equal(s.state.receipts[0].cost, 375);
  assert.throws(() => s.run('purchase.receive', { purchaseId: 'order', quantity: 6 }), { code: 'receipt_exceeds_order' });
  s.run('purchase.receive', { purchaseId: 'order', quantity: 5 });
  assert.equal(s.state.purchases[0].status, 'received'); assert.equal(inventorySummary(s.state, 'thread').physical, 8);
});

test('generated shopping list recalculates without duplicating manual or derived rows', () => {
  const s = stock(0);
  s.run('need.save', { projectId: 'A', materialId: 'thread', quantity: 9 });
  s.run('purchase.save', { id: 'manual', materialId: 'thread', quantity: 1 });
  s.run('purchase.generate', { projectIds: ['A'] });
  s.run('purchase.generate', { projectIds: ['A'] });
  assert.equal(s.state.purchases.length, 2);
  assert.equal(s.state.purchases.find(p => p.source === 'project').quantity, 16);
  assert.equal(s.state.purchases.find(p => p.id === 'manual').quantity, 1);
});

test('AC08,27: tool assignment and closure do not consume or create stock', () => {
  const s = stock(1, { category: 'tool', unit: 'piece' });
  s.run('reservation.set', { projectId: 'A', lotId: 'lot', quantity: 1 });
  assert.throws(() => s.run('stock.move', { kind: 'consume', lotId: 'lot', projectId: 'A', quantity: 1 }), { code: 'tool_not_consumable' });
  const moves = s.state.movements.length;
  s.run('project.close', { projectId: 'A' });
  assert.equal(inventorySummary(s.state, 'thread').physical, 1); assert.equal(inventorySummary(s.state, 'thread').available, 1);
  assert.equal(s.state.movements.length, moves);
});

test('AC28: duplicate project copies plan and tasks but never execution or reservations', () => {
  const s = stock();
  s.run('need.save', { projectId: 'A', materialId: 'thread', quantity: 8 });
  s.run('task.save', { projectId: 'A', title: 'Mount hoop', done: true });
  s.run('project.progress', { projectId: 'A', manualPercent: 50 });
  s.run('session.save', { projectId: 'A', durationMinutes: 30 });
  s.run('reservation.set', { projectId: 'A', lotId: 'lot', quantity: 10 });
  s.run('project.duplicate', { id: 'A', name: 'Repeat' });
  const clone = s.state.projects.find(p => p.name === 'Repeat');
  assert.equal(clone.manualPercent, 0); assert.equal(clone.status, 'idea');
  assert.equal(s.state.sessions.filter(row => row.projectId === clone.id).length, 0);
  assert.equal(s.state.reservations.filter(row => row.projectId === clone.id).length, 0);
  assert.equal(s.state.tasks.find(row => row.projectId === clone.id).done, false);
  assert.equal(s.state.needs.find(row => row.projectId === clone.id).quantity, 8);
});

test('AC24,26: progress is a set of real primitives, independent of stock and revision changes', () => {
  const s = stock();
  const state = structuredClone(s.state);
  state.patterns.push({ id: 'pattern', kind: 'structured', currentRevisionId: 'r1', revisions: [
    { id: 'r1', width: 2, height: 2, cells: [0, -1, 0, 1], colors: [], halfStitches: [{ id: 'half' }], backstitches: [{ id: 'line' }] },
    { id: 'r2', width: 2, height: 2, cells: [-1, 0, 0, 1], colors: [], halfStitches: [], backstitches: [] },
  ] });
  s.replace(state);
  s.run('project.save', { id: 'A', patternId: 'pattern', revisionId: 'r1' });
  s.run('project.progress', { projectId: 'A', completed: ['c:0', 'h:half'] });
  s.run('project.progress', { projectId: 'A', completed: ['c:0', 'h:half'] });
  assert.equal(projectProgress(s.state, 'A').completed, 2); assert.equal(projectProgress(s.state, 'A').total, 5);
  assert.equal(inventorySummary(s.state, 'thread').physical, 24);
  assert.throws(() => s.run('project.progress', { projectId: 'A', completed: ['c:1'] }), { code: 'invalid_progress' });
  assert.throws(() => s.run('project.save', { id: 'A', revisionId: 'r2' }), { code: 'revision_change_confirmation' });
  s.run('project.save', { id: 'A', revisionId: 'r2', acceptRevisionChange: true });
  assert.equal(projectProgress(s.state, 'A').completed, 0);
  assert.equal(s.state.projects.find(p => p.id === 'A').progressHistory.find(history => history.revisionId === 'r1').completed.length, 2);
});

test('CALC01 and AC41: density semantics, per-axis counts, margins and dimension fit', () => {
  assert.equal(fabricSize({ width: 140, height: 140, countX: 14 }).widthCm, 25.4);
  assert.equal(fabricSize({ width: 140, height: 140, countX: 28, countMeaning: 'threads', overX: 2 }).widthCm, 25.4);
  assert.equal(fabricSize({ width: 140, height: 140, countX: 28, countMeaning: 'threads' }).widthCm, 12.7);
  assert.equal(fabricSize({ width: 140, height: 160, countX: 14, countY: 16 }).heightCm, 25.4);
  const result = fabricSize({ width: 140, height: 140, countX: 14, overX: 2, margins: { left: 3, right: 3, top: 3, bottom: 3 } });
  assert.equal(result.cutWidthCm, 31.4); assert.equal(result.cutHeightCm, 31.4);
  assert.equal(fabricFit({ widthCm: 30, heightCm: 40, requiredWidthCm: 31.4, requiredHeightCm: 31.4 }).fits, false);
  assert.equal(fabricFit({ widthCm: 30, heightCm: 40, requiredWidthCm: 35, requiredHeightCm: 25 }).rotated, true);
  assert.equal(fabricFit({ widthCm: null, heightCm: 40, requiredWidthCm: 31.4, requiredHeightCm: 31.4 }).fits, null);
});

test('AC10: rectangular cut preserves area, origin and costs without original duplication', () => {
  const s = stock(1, { category: 'fabric', unit: 'piece' });
  s.run('lot.save', { id: 'lot', properties: { widthCm: 50, heightCm: 60 } });
  s.run('fabric.cut', { lotId: 'lot', xCm: 5, yCm: 10, widthCm: 20, heightCm: 30 });
  const original = s.state.lots.find(l => l.id === 'lot'), pieces = s.state.lots.filter(l => l.sourceLotId === 'lot');
  assert.equal(original.quantity, 0); assert.equal(original.status, 'transformed');
  assert.equal(pieces.reduce((area, l) => area + l.properties.widthCm * l.properties.heightCm, 0), 3000);
  assert.equal(pieces.length, 5); assert.equal(s.state.cuts.length, 1);
  assert.throws(() => s.run('fabric.cut', { lotId: 'lot', widthCm: 5, heightCm: 5 }), { code: 'fabric_piece_unavailable' });
});

test('AC07: opening a kit transfers physical content once and keeps shared cost separate', () => {
  const s = stock(2, { category: 'kit', unit: 'piece' });
  s.run('material.save', { id: 'component', name: 'Floss', unit: 'm', category: 'thread' });
  s.run('kit.open', { lotId: 'lot', components: [{ materialId: 'component', quantity: 8 }] }, 'open-once');
  s.run('kit.open', { lotId: 'lot', components: [{ materialId: 'component', quantity: 8 }] }, 'open-once');
  assert.equal(inventorySummary(s.state, 'thread').physical, 1);
  assert.equal(inventorySummary(s.state, 'component').physical, 8);
  assert.equal(s.state.kitOpenings.length, 1);
});

test('AC43: conversion is explicit, unknown conversion stays unknown', () => {
  assert.equal(convertQuantity(8, 'm', 'strand-m', { strands: 6 }), 48);
  assert.equal(convertQuantity(12, 'strand-m', 'm', { strands: 6 }), 2);
  assert.equal(convertQuantity(8, 'g', 'm', {}), null);
  assert.equal(convertQuantity(2, 'skein', 'm', { unit: 'm', packageSize: 8 }), 16);
  assert.equal(convertQuantity(2, 'skein', 'm', { unit: 'm', packageSize: null }), null);
});

test('compensating correction restores physical stock and confirmed demand without inventing reservations', () => {
  const s = stock(10);
  s.run('stock.move', { kind: 'consume', lotId: 'lot', projectId: 'A', quantity: 2 });
  const movementId = s.state.movements.at(-1).id;
  assert.equal(confirmedConsumption(s.state, 'A', 'thread'), 2);
  s.run('stock.reverse', { movementId, reason: 'Incorrect measurement' });
  assert.equal(confirmedConsumption(s.state, 'A', 'thread'), 0);
  assert.equal(inventorySummary(s.state, 'thread').physical, 10);
  assert.throws(() => s.run('stock.reverse', { movementId, reason: 'Again' }), { code: 'already_reversed' });
});

test('AC44: cost totals retain separate currencies', () => {
  const s = stock(0);
  s.run('lot.add', { id: 'eur', materialId: 'thread', quantity: 10, cost: 500, currency: 'EUR' });
  s.run('lot.add', { id: 'usd', materialId: 'thread', quantity: 10, cost: 800, currency: 'USD' });
  s.run('stock.move', { kind: 'consume', lotId: 'eur', projectId: 'A', quantity: 2 });
  s.run('stock.move', { kind: 'consume', lotId: 'usd', projectId: 'A', quantity: 3 });
  assert.deepEqual(costTotals(s.state, 'A'), { EUR: 100, USD: 240 });
});

test('domain rejects future schema, unsafe JSON, broken references and location cycles', () => {
  const s = stock();
  assert.throws(() => applyCommand({ ...s.state, schemaVersion: 2 }, { type: 'settings.save', payload: {}, operationId: 'future' }), { code: 'unsupported_schema' });
  assert.throws(() => s.run('material.save', JSON.parse('{"name":"x","properties":{"__proto__":{"polluted":true}}}')), { code: 'unsafe_key' });
  assert.throws(() => s.run('lot.add', { materialId: 'absent', quantity: 1 }), { code: 'not_found' });
  s.run('location.save', { id: 'room', name: 'Room' });
  s.run('location.save', { id: 'box', name: 'Box', parentId: 'room' });
  assert.throws(() => s.run('location.save', { id: 'room', name: 'Room', parentId: 'box' }), { code: 'location_cycle' });
});

test('language changes preserve every material and project value', () => {
  const s = stock();
  const materials = structuredClone(s.state.materials), projects = structuredClone(s.state.projects);
  s.run('settings.save', { language: 'en' });
  assert.deepEqual(s.state.materials, materials); assert.deepEqual(s.state.projects, projects);
  assert.equal(s.state.settings.language, 'en');
});

test('deep restore validation preserves legitimate unknowns/conflicts and rejects corrupted relationships', () => {
  const s = stock(10);
  s.run('reservation.set', { projectId: 'A', lotId: 'lot', quantity: 8 });
  s.run('stock.move', { kind: 'count', lotId: 'lot', quantity: 5 });
  s.run('lot.add', { materialId: 'thread', quantity: null });
  assert.equal(validateState(s.state), s.state);
  const broken = structuredClone(s.state);
  broken.reservations[0].projectId = 'absent';
  assert.throws(() => validateState(broken), { code: 'broken_reference' });
  const duplicates = structuredClone(s.state); duplicates.materials.push({ ...duplicates.materials[0] });
  assert.throws(() => validateState(duplicates), { code: 'duplicate_id' });
  const negative = structuredClone(s.state); negative.lots[0].quantity = -1;
  assert.throws(() => validateState(negative), { code: 'invalid_number' });
  const incompatible = structuredClone(s.state); incompatible.lots[0].unit = 'kg';
  assert.throws(() => validateState(incompatible), { code: 'incompatible_units' });
});

test('material merge preserves lots/receipts and consolidates demand before counting consumption', () => {
  const s = stock(10);
  s.run('material.save', { id: 'duplicate', name: 'Duplicate', unit: 'm', strands: 6, packageSize: 8 });
  s.run('need.save', { projectId: 'A', materialId: 'thread', quantity: 5 });
  s.run('need.save', { projectId: 'A', materialId: 'duplicate', quantity: 7 });
  s.run('purchase.save', { id: 'order', materialId: 'duplicate', quantity: 2, status: 'ordered' });
  s.run('purchase.receive', { purchaseId: 'order', quantity: 2 });
  s.run('stock.move', { kind: 'consume', lotId: 'lot', projectId: 'A', quantity: 2 });
  s.run('reservation.set', { projectId: 'A', lotId: 'lot', quantity: 1 });
  s.run('material.merge', { sourceId: 'duplicate', targetId: 'thread' });
  assert.equal(s.state.needs.length, 1); assert.equal(s.state.needs[0].quantity, 12);
  assert.equal(shoppingNeeds(s.state, ['A'])[0].remaining, 10);
  assert.equal(s.state.materials.find(m => m.id === 'duplicate').mergedInto, 'thread');
  assert.equal(validateState(s.state), s.state);
});

test('historical consumption costs stay fixed after receipts at a different price', () => {
  const s = stock(0);
  s.run('lot.add', { id: 'priced', materialId: 'thread', quantity: 10, cost: 1000 });
  s.run('stock.move', { kind: 'consume', lotId: 'priced', projectId: 'A', quantity: 2 });
  s.run('stock.move', { kind: 'receipt', lotId: 'priced', quantity: 2, cost: 400 });
  assert.deepEqual(costTotals(s.state, 'A'), { EUR: 200 });
  s.run('stock.move', { kind: 'consume', lotId: 'priced', projectId: 'B', quantity: 1 });
  assert.deepEqual(costTotals(s.state, 'B'), { EUR: 120 });
  assert.equal(s.state.lots.find(l => l.id === 'priced').cost, 1080);
  assert.equal(validateState(s.state), s.state);
});

test('resolving derived demand cancels stale suggested purchase without deleting history', () => {
  const s = stock(0);
  s.run('need.save', { projectId: 'A', materialId: 'thread', quantity: 4 });
  s.run('purchase.generate', { projectIds: ['A'] });
  s.run('need.save', { projectId: 'A', materialId: 'thread', quantity: 0 });
  s.run('purchase.generate', { projectIds: ['A'] });
  assert.equal(s.state.purchases.length, 1); assert.equal(s.state.purchases[0].status, 'cancelled');
});

test('failed component verification rolls back entire kit opening', () => {
  const s = stock(1, { category: 'kit', unit: 'piece' });
  s.run('material.save', { id: 'component', name: 'Floss', unit: 'm' });
  const before = structuredClone(s.state);
  assert.throws(() => s.run('kit.open', { lotId: 'lot', components: [{ materialId: 'component', quantity: 8 }, { materialId: 'absent', quantity: 1 }] }), { code: 'not_found' });
  assert.deepEqual(s.state, before);
});

test('unknown demand can be measured later without retaining an unknown confidence flag', () => {
  const s = stock();
  s.run('need.save', { projectId: 'A', materialId: 'thread', quantity: null });
  assert.equal(shoppingNeeds(s.state, ['A'])[0].shortfall, null);
  s.run('need.save', { projectId: 'A', materialId: 'thread', quantity: 8 });
  assert.equal(s.state.needs[0].confidence, 'estimated');
  assert.equal(validateState(s.state), s.state);
});

test('fabric cutting conserves tiny currency amounts without negative rounding residuals', () => {
  const s = stock(0, { category: 'fabric', unit: 'piece' });
  s.run('lot.add', { id: 'fabric', materialId: 'thread', quantity: 1, cost: 2, properties: { widthCm: 100, heightCm: 100 } });
  s.run('fabric.cut', { lotId: 'fabric', xCm: 2, yCm: 26, widthCm: 55, heightCm: 48 });
  const pieces = s.state.lots.filter(l => l.sourceLotId === 'fabric');
  assert.equal(pieces.reduce((total, l) => total + l.cost, 0), 2);
  assert.ok(pieces.every(l => l.cost >= 0 && Number.isInteger(l.cost)));
  assert.equal(validateState(s.state), s.state);
});


test('unmeasured stock never becomes a definite shortage or an automatic order', () => {
  const s = stock(0);
  s.run('need.save', { projectId: 'A', materialId: 'thread', quantity: 8 });
  s.run('purchase.generate', { projectIds: ['A'] });
  assert.equal(s.state.purchases[0].quantity, 8);
  s.run('lot.add', { id: 'unmeasured', materialId: 'thread', quantity: null, confidence: 'unknown' });
  let row = shoppingNeeds(s.state, ['A'])[0];
  assert.equal(row.shortfall, null); assert.equal(row.toOrder, null); assert.equal(row.purchaseQuantity, null);
  assert.equal(row.knownShortfall, 8);
  s.run('purchase.generate', { projectIds: ['A'] });
  assert.equal(s.state.purchases.filter(p => p.status === 'to_buy').length, 0);
  s.run('stock.move', { lotId: 'unmeasured', kind: 'count', quantity: 10, reason: 'Measured remaining length' });
  row = shoppingNeeds(s.state, ['A'])[0]; assert.equal(row.shortfall, 0); assert.equal(row.toOrder, 0);
  s.run('lot.add', { id: 'another-unknown', materialId: 'thread', quantity: null, confidence: 'unknown' });
  assert.equal(shoppingNeeds(s.state, ['A'])[0].shortfall, 0, 'known stock alone already covers the need');
});
