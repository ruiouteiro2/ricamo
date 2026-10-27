import { add, subtract, date, assert } from './shared.mjs';

/** Leaf queries: loans and maintenance hold owned stock; they never create or consume it. */
export function toolLoanReturned(loan) { return add(...loan.events.filter(e => e.kind === 'return').map(e => e.quantity)); }
export function toolLoanLost(loan) { return add(...loan.events.filter(e => e.kind === 'loss' || e.kind === 'discard').map(e => e.quantity)); }
export function toolLoanRemaining(loan) { return subtract(loan.quantity, add(toolLoanReturned(loan), toolLoanLost(loan))); }
export function toolLoanHeld(lot) { return add(...(lot.toolActivity?.loans ?? []).map(toolLoanRemaining)); }
export function toolMaintenanceHeld(lot) { return add(...(lot.toolActivity?.maintenance ?? []).filter(row => row.hold && !row.completedAt).map(row => row.quantity)); }
export function toolHeldQuantity(lot) { return add(toolLoanHeld(lot), toolMaintenanceHeld(lot)); }
export function toolAvailability(lot, reserved = 0) {
  const loaned = toolLoanHeld(lot), maintenance = toolMaintenanceHeld(lot), held = add(loaned, maintenance), committed = add(reserved, held);
  const eligible = lot.status === 'usable' ? lot.quantity : 0;
  return { physical: lot.quantity, reserved, loaned, maintenance, held, committed, available: eligible === null ? null : Math.max(0, subtract(eligible, committed)), conflict: eligible === null ? null : Math.max(0, subtract(committed, eligible)) };
}
export function toolRemovalQuantity(movement) {
  if (!['loss', 'discard', 'count'].includes(movement.kind) || movement.before === null || movement.after === null || movement.after >= movement.before) return 0;
  return subtract(movement.before, movement.after);
}
export function toolLinkedLoss(lot, movementId) {
  return add(...(lot.toolActivity?.loans ?? []).flatMap(row => row.events).filter(event => event.movementId === movementId).map(event => event.quantity));
}
export function toolRecordedLosses(state, lotId) {
  const lot = state.lots.find(row => row.id === lotId); if (!lot) return [];
  const reversed = new Set(state.movements.map(row => row.reversesId).filter(Boolean));
  return state.movements.filter(row => row.lotId === lotId && !reversed.has(row.id)).map(movement => ({ movement, unallocated: Math.max(0, subtract(toolRemovalQuantity(movement), toolLinkedLoss(lot, movement.id))) })).filter(row => row.unallocated > 0).toReversed();
}
/** asOf is explicit, making overdue results repeatable and independent of hidden clocks. */
export function toolReminders(state, asOf) {
  const parsed = date(asOf, 'asOf'); assert(parsed, 'required');
  const today = new Date(parsed).toISOString().slice(0, 10), todayMs = Date.parse(`${today}T00:00:00Z`), rows = [];
  for (const lot of state.lots) {
    for (const loan of lot.toolActivity?.loans ?? []) if (loan.dueDate && toolLoanRemaining(loan) > 0) rows.push({ id: `loan:${lot.id}:${loan.id}`, kind: 'loan', lotId: lot.id, materialId: lot.materialId, activityId: loan.id, title: loan.recipient, dueDate: loan.dueDate, quantity: toolLoanRemaining(loan) });
    for (const maintenance of lot.toolActivity?.maintenance ?? []) if (maintenance.dueDate && !maintenance.completedAt) rows.push({ id: `maintenance:${lot.id}:${maintenance.id}`, kind: 'maintenance', lotId: lot.id, materialId: lot.materialId, activityId: maintenance.id, title: maintenance.description, dueDate: maintenance.dueDate, quantity: maintenance.quantity });
  }
  return rows.map(row => ({ ...row, daysLate: Math.floor((todayMs - Date.parse(`${row.dueDate}T00:00:00Z`)) / 86400000), overdue: row.dueDate < today, dueToday: row.dueDate === today })).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id));
}
