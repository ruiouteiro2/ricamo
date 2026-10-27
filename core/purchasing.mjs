import { add, subtract, assert, quantity, text, oneOf, integer, currency, date, find, optionalRef, recordId, put, audit, totalReserved } from './shared.mjs';
import { addLot } from './inventory.mjs';
import { confirmedConsumption } from './projects.mjs';

export function savePurchase(state, p, ctx) {
  const id = recordId(state, 'purchases', p, ctx), existing = state.purchases.find(row => row.id === id);
  const source = { ...existing, ...p }, material = find(state, 'materials', source.materialId);
  if (existing) assert(existing.materialId === material.id, 'purchase_material_changed');
  const received = add(...state.receipts.filter(r => r.purchaseId === id).map(r => r.quantity));
  const amount = quantity(source.quantity, { positive: true });
  assert(amount >= received, 'less_than_received', { received });
  let status = oneOf(source.status ?? 'to_buy', ['to_buy', 'ordered', 'partial', 'received', 'cancelled'], 'status');
  if (status === 'received') assert(received >= amount, 'receive_purchase_first');
  if (status === 'partial') assert(received > 0 && received < amount, 'invalid_purchase_status');
  if (status !== 'cancelled' && received > 0) status = received >= amount ? 'received' : 'partial';
  const projectIds = source.projectIds ?? [];
  assert(Array.isArray(projectIds) && projectIds.length <= 1000, 'invalid_list', { field: 'projectIds' });
  projectIds.forEach(id => find(state, 'projects', id));
  put(state, 'purchases', {
    id, materialId: material.id, quantity: amount, unit: material.unit, received, status,
    projectIds: [...new Set(projectIds)], supplierId: optionalRef(state, 'suppliers', source.supplierId),
    unitPrice: integer(source.unitPrice, 'unitPrice', { nullable: true }), currency: currency(source.currency ?? state.settings.currency),
    priority: oneOf(source.priority ?? 'normal', ['low', 'normal', 'high'], 'priority'),
    notes: text(source.notes, 'notes', { max: 10000 }), expectedDate: date(source.expectedDate, 'expectedDate'),
    source: oneOf(source.source ?? 'manual', ['manual', 'project'], 'source'),
    createdAt: existing?.createdAt ?? ctx.now, updatedAt: ctx.now,
  });
}

export function receivePurchase(state, p, ctx) {
  const purchase = find(state, 'purchases', p.purchaseId);
  assert(!['cancelled', 'received'].includes(purchase.status), 'purchase_closed');
  const amount = quantity(p.quantity, { positive: true });
  const alreadyReceived = add(...state.receipts.filter(r => r.purchaseId === purchase.id).map(r => r.quantity));
  assert(amount <= subtract(purchase.quantity, alreadyReceived), 'receipt_exceeds_order', { remaining: subtract(purchase.quantity, alreadyReceived) });
  const cost = p.cost !== undefined ? integer(p.cost, 'cost', { nullable: true }) : purchase.unitPrice === null ? null : Math.round(purchase.unitPrice * amount);
  const lot = addLot(state, { ...p, id: undefined, materialId: purchase.materialId, quantity: amount, cost, currency: purchase.currency, supplierId: purchase.supplierId, acquiredAt: p.date ?? ctx.now, reason: 'purchase' }, ctx);
  const lastMovement = state.movements[state.movements.length - 1];
  lastMovement.kind = 'receipt';
  lastMovement.purchaseId = purchase.id;
  state.receipts.push({ id: ctx.id(), purchaseId: purchase.id, lotId: lot.id, materialId: purchase.materialId, quantity: amount, unit: purchase.unit, cost, currency: purchase.currency, date: ctx.now, operationId: ctx.operationId });
  purchase.received = add(alreadyReceived, amount);
  purchase.status = purchase.received === purchase.quantity ? 'received' : 'partial';
  purchase.updatedAt = ctx.now;
}

/** Aggregate demand once, and protect reservations belonging to projects outside the selected group. */
export function shoppingNeeds(state, projectIds) {
  const ids = new Set(projectIds ?? state.projects.filter(p => !['completed', 'archived'].includes(p.status)).map(p => p.id));
  const needs = state.needs.filter(n => ids.has(n.projectId));
  const materialIds = [...new Set(needs.map(n => n.materialId))];
  return materialIds.map(materialId => {
    const material = find(state, 'materials', materialId), rows = needs.filter(n => n.materialId === materialId);
    const allocations = rows.map(need => {
      const consumed = confirmedConsumption(state, need.projectId, materialId);
      return { projectId: need.projectId, planned: need.quantity, consumed, remaining: need.quantity === null ? null : Math.max(0, subtract(need.quantity, consumed)) };
    });
    const unknownDemand = allocations.some(a => a.remaining === null);
    const remaining = add(...allocations.map(a => a.remaining ?? 0));
    const lots = state.lots.filter(l => l.materialId === materialId && l.status === 'usable');
    const unknownStock = lots.some(l => l.quantity === null);
    const usableForGroup = add(...lots.filter(l => l.quantity !== null).map(lot => {
      const outside = add(...state.reservations.filter(r => r.lotId === lot.id && !ids.has(r.projectId)).map(r => r.quantity));
      return Math.max(0, subtract(lot.quantity, outside));
    }));
    const reserved = add(...state.reservations.filter(r => r.materialId === materialId && ids.has(r.projectId)).map(r => r.quantity));
    const free = add(...lots.filter(l => l.quantity !== null).map(lot => Math.max(0, subtract(lot.quantity, totalReserved(state, lot.id)))));
    const shortfall = Math.max(0, subtract(remaining, usableForGroup));
    const ordered = add(...state.purchases.filter(p => p.materialId === materialId && ['ordered', 'partial'].includes(p.status) && (!p.projectIds.length || p.projectIds.some(id => ids.has(id)))).map(p => Math.max(0, subtract(p.quantity, p.received))));
    const packageCount = material.packageSize ? Math.ceil(shortfall / material.packageSize) : null;
    return { materialId, unit: material.unit, allocations, planned: unknownDemand ? null : add(...rows.map(r => r.quantity)), remaining: unknownDemand ? null : remaining, knownRemaining: remaining,
      eligibleForGroup: usableForGroup, reserved, free, shortfall: unknownDemand ? null : shortfall, knownShortfall: shortfall, unknownDemand, unknownStock,
      ordered, toOrder: unknownDemand ? null : Math.max(0, subtract(shortfall, ordered)), packageCount, purchaseQuantity: packageCount === null ? shortfall : quantity(packageCount * material.packageSize),
    };
  });
}

export function generatePurchases(state, p, ctx) {
  const projectIds = p.projectIds ?? state.projects.filter(project => !['completed', 'archived'].includes(project.status)).map(project => project.id);
  projectIds.forEach(id => find(state, 'projects', id));
  const groupKey = [...new Set(projectIds)].sort().join('|');
  const summary = shoppingNeeds(state, projectIds);
  const existingRows = state.purchases.filter(row => row.source === 'project' && row.status === 'to_buy' && [...row.projectIds].sort().join('|') === groupKey);
  for (const row of existingRows) {
    const need = summary.find(n => n.materialId === row.materialId);
    if (!need || (!need.unknownDemand && need.toOrder <= 0)) { row.status = 'cancelled'; row.updatedAt = ctx.now; }
  }
  for (const need of summary) {
    if (need.unknownDemand || need.toOrder <= 0) continue;
    const material = find(state, 'materials', need.materialId);
    const amount = material.packageSize ? quantity(Math.ceil(need.toOrder / material.packageSize) * material.packageSize) : need.toOrder;
    const existing = state.purchases.find(row => row.materialId === material.id && row.source === 'project' && row.status === 'to_buy' && [...row.projectIds].sort().join('|') === groupKey);
    savePurchase(state, { id: existing?.id, materialId: material.id, quantity: amount, projectIds, source: 'project', status: 'to_buy', notes: existing?.notes ?? '' }, ctx);
  }
  audit(state, ctx, 'purchase', groupKey || 'all', 'generated', { projectIds });
}

export function costTotals(state, projectId) {
  const totals = {};
  for (const movement of state.movements.filter(m => m.projectId === projectId && m.kind === 'consume')) {
    if (movement.cost === null || movement.cost === undefined) continue;
    const reversed = state.movements.some(m => m.reversesId === movement.id);
    if (reversed) continue;
    const code = movement.currency;
    totals[code] = (totals[code] ?? 0) + movement.cost;
  }
  return totals;
}
