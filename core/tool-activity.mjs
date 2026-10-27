import { assert, quantity, integer, text, identifier, date, currency, oneOf, find, totalReserved, audit, add, subtract } from './shared.mjs';
import { stockMove } from './inventory.mjs';
import { toolLoanRemaining, toolLoanLost, toolHeldQuantity, toolAvailability, toolRemovalQuantity, toolLinkedLoss, toolRecordedLosses } from './tool-state.mjs';

import { localDate } from './calendar.mjs';

const MAX_RECORDS = 200, MAX_EVENTS = 1000;
const day = (value, field, required = false) => { const result = date(value, field); assert(!required || result, 'required', { field }); assert(!result || /^\d{4}-\d{2}-\d{2}$/.test(result), 'tool_date_only', { field }); return result; };
const when = (value, field, ctx, earliest = '') => { const result = day(value ?? localDate(ctx.now), field, true); assert(result <= localDate(ctx.now), 'tool_future_event'); assert(!earliest || result >= earliest, 'tool_date_order'); return result; };
const amount = (lot, value) => { const result = quantity(value, { positive: true }); assert(lot.unit !== 'piece' || Number.isInteger(result), 'tool_whole_pieces'); return result; };
const tool = (state, id) => { const lot = find(state, 'lots', id), material = find(state, 'materials', lot.materialId); assert(material.reusable === true, 'tool_reusable_required'); return { lot, material }; };
const activity = lot => lot.toolActivity ??= { schemaVersion: 1, loans: [], maintenance: [] };
function available(state, lot, material, requested) {
  assert(!material.archived && lot.status === 'usable', 'lot_unavailable'); assert(lot.quantity !== null, 'unknown_quantity');
  assert(lot.unit !== 'piece' || Number.isInteger(lot.quantity), 'tool_whole_pieces');
  const free = toolAvailability(lot, totalReserved(state, lot.id)).available;
  assert(requested <= free, 'tool_insufficient_available', { available: free });
}
function loan(state, p) { const { lot, material } = tool(state, p.lotId), row = lot.toolActivity?.loans.find(row => row.id === p.loanId); assert(row, 'tool_loan_not_found'); return { lot, material, row }; }
function maintenance(state, p) { const { lot } = tool(state, p.lotId), row = lot.toolActivity?.maintenance.find(row => row.id === p.maintenanceId); assert(row, 'tool_maintenance_not_found'); return { lot, row }; }
function event(row, fields, ctx) { assert(row.events.length < MAX_EVENTS, 'tool_history_limit'); const result = { id: identifier(ctx.id()), operationId: ctx.operationId, recordedAt: ctx.now, ...fields }; row.events.push(result); return result; }
function closeLoan(row) { if (toolLoanRemaining(row) === 0) { const at = row.events.filter(e => e.kind !== 'amend').map(e => e.date).sort().at(-1); row.closedAt = at; row.returnedAt = toolLoanLost(row) === 0 ? at : ''; } }

export function createToolLoan(state, p, ctx) {
  const { lot, material } = tool(state, p.lotId), requested = amount(lot, p.quantity); available(state, lot, material, requested);
  const records = activity(lot).loans; assert(records.length < MAX_RECORDS, 'tool_history_limit');
  const loanedAt = when(p.loanedAt, 'loanedAt', ctx), dueDate = day(p.dueDate, 'dueDate'); assert(!dueDate || dueDate >= loanedAt, 'tool_date_order');
  const row = { id: identifier(ctx.id()), quantity: requested, recipient: text(p.recipient, 'recipient', { required: true, max: 300 }), loanedAt, dueDate, notes: text(p.notes, 'notes', { max: 4000 }), returnedAt: '', closedAt: '', events: [], createdAt: ctx.now, operationId: ctx.operationId };
  records.push(row); lot.updatedAt = ctx.now; audit(state, ctx, 'tool_loan', row.id, 'loaned', { lotId: lot.id, quantity: requested });
}
export function returnToolLoan(state, p, ctx) {
  const { lot, row } = loan(state, p), requested = amount(lot, p.quantity), at = when(p.returnedAt, 'returnedAt', ctx, row.loanedAt);
  assert(requested <= toolLoanRemaining(row), 'tool_exceeds_outstanding');
  event(row, { kind: 'return', quantity: requested, date: at, notes: text(p.notes, 'notes', { max: 4000 }) }, ctx); closeLoan(row);
  lot.updatedAt = ctx.now; audit(state, ctx, 'tool_loan', row.id, 'returned', { lotId: lot.id, quantity: requested, physicalChanged: false });
}
export function amendToolLoan(state, p, ctx) {
  const { lot, row } = loan(state, p), dueDate = day(p.dueDate ?? row.dueDate, 'dueDate'); assert(!dueDate || dueDate >= row.loanedAt, 'tool_date_order');
  const before = { recipient: row.recipient, dueDate: row.dueDate, notes: row.notes }, after = { recipient: text(p.recipient ?? row.recipient, 'recipient', { required: true, max: 300 }), dueDate, notes: text(p.notes ?? row.notes, 'notes', { max: 4000 }) };
  event(row, { kind: 'amend', quantity: 0, date: localDate(ctx.now), before, after }, ctx); Object.assign(row, after); lot.updatedAt = ctx.now;
  audit(state, ctx, 'tool_loan', row.id, 'amended', { lotId: lot.id });
}
export function recordToolLoanLoss(state, p, ctx) {
  assert(p.confirmed === true, 'tool_confirm_loss');
  const { lot, row } = loan(state, p), requested = amount(lot, p.quantity), at = when(p.lostAt, 'lostAt', ctx, row.loanedAt), reason = text(p.reason, 'reason', { required: true, max: 2000 });
  assert(requested <= toolLoanRemaining(row), 'tool_exceeds_outstanding');
  let original, kind = oneOf(p.kind ?? 'loss', ['loss', 'discard'], 'kind');
  if (p.movementId) {
    const candidate = toolRecordedLosses(state, lot.id).find(item => item.movement.id === p.movementId);
    assert(candidate && requested <= candidate.unallocated, 'tool_loss_already_allocated');
    original = candidate.movement; assert(original.date.slice(0, 10) >= row.loanedAt, 'tool_loss_reference'); kind = original.kind === 'discard' ? 'discard' : 'loss';
  } else {
    stockMove(state, { lotId: lot.id, kind, quantity: requested, reason }, ctx); original = state.movements.at(-1); original.toolLoanId = row.id;
  }
  event(row, { kind, quantity: requested, date: at, notes: reason, movementId: original.id, physicalEffect: p.movementId ? 'already_recorded' : 'recorded_now' }, ctx); closeLoan(row);
  lot.updatedAt = ctx.now; audit(state, ctx, 'tool_loan', row.id, kind, { lotId: lot.id, quantity: requested, movementId: original.id, physicalChanged: !p.movementId });
}
export function recordToolMaintenance(state, p, ctx) {
  const { lot, material } = tool(state, p.lotId), requested = amount(lot, p.quantity), startedAt = when(p.startedAt, 'startedAt', ctx), dueDate = day(p.dueDate, 'dueDate');
  const completedAt = p.completedAt ? when(p.completedAt, 'completedAt', ctx, startedAt) : '';
  assert(!dueDate || dueDate >= startedAt, 'tool_date_order'); assert(typeof p.hold === 'boolean', 'invalid_boolean');
  if (p.hold && !completedAt) available(state, lot, material, requested);
  const records = activity(lot).maintenance; assert(records.length < MAX_RECORDS, 'tool_history_limit');
  const row = { id: identifier(ctx.id()), quantity: requested, hold: p.hold, startedAt, dueDate, completedAt, description: text(p.description, 'description', { required: true, max: 500 }), cost: integer(p.cost, 'cost', { nullable: true }), currency: currency(p.currency ?? state.settings.currency), partsNotes: text(p.partsNotes, 'partsNotes', { max: 4000 }), notes: text(p.notes, 'notes', { max: 4000 }), createdAt: ctx.now, operationId: ctx.operationId, events: [] };
  records.push(row); lot.updatedAt = ctx.now; audit(state, ctx, 'tool_maintenance', row.id, completedAt ? 'recorded' : 'started', { lotId: lot.id, quantity: requested, holding: p.hold && !completedAt });
}
export function completeToolMaintenance(state, p, ctx) {
  const { lot, row } = maintenance(state, p); assert(!row.completedAt, 'tool_maintenance_completed');
  const at = when(p.completedAt, 'completedAt', ctx, row.startedAt), cost = p.cost === undefined ? row.cost : integer(p.cost, 'cost', { nullable: true });
  assert(!p.currency || p.currency === row.currency, 'tool_cost_currency_changed');
  event(row, { kind: 'complete', quantity: row.quantity, date: at, previousCost: row.cost, cost, notes: text(p.notes, 'notes', { max: 4000 }) }, ctx);
  row.completedAt = at; row.cost = cost; lot.updatedAt = ctx.now;
  audit(state, ctx, 'tool_maintenance', row.id, 'completed', { lotId: lot.id, physicalChanged: false });
}

/** Called after replay detection, before the existing command handler. */
export function guardToolCommand(state, command) {
  const p = command.payload ?? {}, type = command.type;
  const lotId = type === 'lot.save' ? p.id : type === 'stock.reverse' ? state.movements.find(row => row.id === p.movementId)?.lotId : p.lotId;
  const lot = state.lots.find(row => row.id === lotId); if (!lot) return;
  const material = state.materials.find(row => row.id === lot.materialId);
  if (type === 'lot.save' && ('toolActivity' in p || material?.reusable && lot.status === 'transformed' && 'status' in p)) assert(false, 'tool_activity_managed');
  if (type === 'stock.move' && p.quantity != null && p.quantity !== '' && material?.reusable && lot.unit === 'piece') assert(Number.isInteger(quantity(p.quantity)), 'tool_whole_pieces');
  if (type === 'reservation.set' && material?.reusable) {
    const requested = quantity(p.quantity), old = state.reservations.find(r => r.projectId === p.projectId && r.lotId === lot.id)?.quantity ?? 0;
    assert(lot.unit !== 'piece' || Number.isInteger(requested), 'tool_whole_pieces');
    if (requested > old) { const free = toolAvailability(lot, totalReserved(state, lot.id)).available; assert(free !== null && subtract(requested, old) <= free, 'tool_insufficient_available', { available: free ?? 0 }); }
  }
  if (type === 'stock.move' && p.kind === 'transfer' && toolHeldQuantity(lot) > 0) assert(false, 'tool_transfer_held');
  if (['fabric.cut', 'fabric.plan.cut', 'kit.open'].includes(type) && lot.toolActivity) assert(false, 'tool_activity_transform');
  if (type === 'stock.reverse' && toolLinkedLoss(lot, p.movementId) > 0) assert(false, 'tool_loss_reversal_dependency');
}
/** Closed history belongs to the source; a transferred split retains its sourceLotId only. */
export function afterToolCommand(state, command, ctx) {
  if (command.type !== 'stock.move' || command.payload.kind !== 'transfer') return;
  for (const move of state.movements.filter(m => m.operationId === ctx.operationId && m.destinationLotId)) delete find(state, 'lots', move.destinationLotId).toolActivity;
}
export const toolActivityHandlers = Object.freeze({ 'tool.loan': createToolLoan, 'tool.return': returnToolLoan, 'tool.loan.amend': amendToolLoan, 'tool.loanLoss': recordToolLoanLoss, 'tool.maintenance': recordToolMaintenance, 'tool.maintenance.complete': completeToolMaintenance });

/** Backup and command validation preserve physical conflicts, rather than erasing commitments. */
export function validateToolActivity(state) {
  const ids = new Set(), movements = new Map(state.movements.map(row => [row.id, row])), reversed = new Set(state.movements.map(row => row.reversesId).filter(Boolean));
  let recordCount = 0, eventCount = 0;
  const unique = id => { identifier(id); assert(!ids.has(id), 'tool_duplicate_id'); ids.add(id); };
  const eventDate = (value, earliest) => { const result = day(value, 'event.date', true); assert(result >= earliest, 'tool_date_order'); return result; };
  for (const lot of state.lots) {
    if (!lot.toolActivity) continue;
    tool(state, lot.id); const activity = lot.toolActivity;
    assert(activity.schemaVersion === 1, 'tool_activity_version');
    assert(Array.isArray(activity.loans) && Array.isArray(activity.maintenance) && activity.loans.length <= MAX_RECORDS && activity.maintenance.length <= MAX_RECORDS, 'tool_history_limit');
    recordCount += activity.loans.length + activity.maintenance.length; assert(recordCount <= 100000, 'tool_history_limit');
    const allocation = new Map();
    for (const row of activity.loans) {
      unique(row.id); assert(typeof row.createdAt === 'string' && Number.isFinite(Date.parse(row.createdAt)), 'invalid_date'); assert(typeof row.quantity === 'number' && amount(lot, row.quantity) === row.quantity, 'invalid_precision');
      const started = day(row.loanedAt, 'loanedAt', true), due = day(row.dueDate, 'dueDate'); assert(!due || due >= started, 'tool_date_order');
      text(row.recipient, 'recipient', { required: true, max: 300 }); text(row.notes, 'notes', { max: 4000 }); identifier(row.operationId);
      assert(Array.isArray(row.events) && row.events.length <= MAX_EVENTS, 'tool_history_limit');
      for (const e of row.events) {
        unique(e.id); identifier(e.operationId); eventDate(e.date, started); assert(Number.isFinite(Date.parse(e.recordedAt)), 'invalid_date');
        oneOf(e.kind, ['return', 'loss', 'discard', 'amend'], 'kind');
        if (e.kind === 'amend') { assert(e.quantity === 0 && e.before && e.after, 'tool_invalid_event'); for (const part of [e.before, e.after]) { text(part.recipient, 'recipient', { required: true, max: 300 }); text(part.notes, 'notes', { max: 4000 }); const due = day(part.dueDate, 'dueDate'); assert(!due || due >= started, 'tool_date_order'); } }
        else { assert(typeof e.quantity === 'number' && amount(lot, e.quantity) === e.quantity, 'invalid_precision'); text(e.notes, 'notes', { max: 4000 }); }
        if (e.kind === 'loss' || e.kind === 'discard') {
          const move = movements.get(e.movementId); assert(move && move.lotId === lot.id && toolRemovalQuantity(move) > 0 && !reversed.has(move.id) && move.date.slice(0, 10) >= started, 'tool_loss_reference');
          assert(e.kind === (move.kind === 'discard' ? 'discard' : 'loss'), 'tool_loss_reference');
          oneOf(e.physicalEffect, ['recorded_now', 'already_recorded'], 'physicalEffect');
          if (e.physicalEffect === 'recorded_now') assert(move.operationId === e.operationId && move.toolLoanId === row.id, 'tool_loss_reference');
          allocation.set(move.id, add(allocation.get(move.id) ?? 0, e.quantity));
        }
      }
      eventCount += row.events.length; assert(toolLoanRemaining(row) >= 0, 'tool_exceeds_outstanding');
      const isClosed = toolLoanRemaining(row) === 0;
      assert(Boolean(row.closedAt) === isClosed && Boolean(row.returnedAt) === (isClosed && toolLoanLost(row) === 0), 'tool_invalid_closed_state');
      if (row.closedAt) { eventDate(row.closedAt, started); assert(row.closedAt === row.events.filter(e => e.kind !== 'amend').map(e => e.date).sort().at(-1), 'tool_invalid_closed_state'); } if (row.returnedAt) { eventDate(row.returnedAt, started); assert(row.returnedAt === row.closedAt, 'tool_invalid_closed_state'); }
    }
    for (const [movementId, used] of allocation) assert(used <= toolRemovalQuantity(movements.get(movementId)), 'tool_loss_already_allocated');
    for (const row of activity.maintenance) {
      unique(row.id); identifier(row.operationId); assert(typeof row.createdAt === 'string' && Number.isFinite(Date.parse(row.createdAt)), 'invalid_date'); assert(typeof row.quantity === 'number' && amount(lot, row.quantity) === row.quantity, 'invalid_precision');
      const started = day(row.startedAt, 'startedAt', true), due = day(row.dueDate, 'dueDate'); assert(!due || due >= started, 'tool_date_order');
      if (row.completedAt) eventDate(row.completedAt, started); assert(typeof row.hold === 'boolean', 'invalid_boolean');
      text(row.description, 'description', { required: true, max: 500 }); text(row.notes, 'notes', { max: 4000 }); text(row.partsNotes, 'partsNotes', { max: 4000 });
      if (row.cost !== null) assert(typeof row.cost === 'number' && integer(row.cost, 'cost') === row.cost, 'invalid_integer'); currency(row.currency);
      assert(Array.isArray(row.events) && row.events.length <= MAX_EVENTS, 'tool_history_limit');
      for (const e of row.events) {
        unique(e.id); identifier(e.operationId); assert(typeof e.recordedAt === 'string' && Number.isFinite(Date.parse(e.recordedAt)), 'invalid_date'); assert(e.kind === 'complete' && e.quantity === row.quantity && e.date === row.completedAt && e.cost === row.cost, 'tool_invalid_event'); eventDate(e.date, started);
        for (const key of ['cost', 'previousCost']) if (e[key] !== null) assert(typeof e[key] === 'number' && integer(e[key], key) === e[key], 'invalid_integer'); text(e.notes, 'notes', { max: 4000 });
      }
      assert(row.events.length <= 1, 'tool_invalid_event'); eventCount += row.events.length;
    }
    quantity(toolHeldQuantity(lot));
    assert(eventCount <= 250000, 'tool_history_limit');
  }
  return state;
}
