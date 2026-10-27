import { add, subtract, assert, quantity, text, identifier, oneOf, integer, currency, date, stringList, jsonObject, find, optionalRef, recordId, put, movement, totalReserved, activeProject, audit } from './shared.mjs';
import { fabricHeldPieces } from './fabric-state.mjs';
import { toolHeldQuantity } from './tool-state.mjs';

export const UNITS = ['m', 'cm', 'mm', 'g', 'kg', 'piece', 'skein', 'spool', 'pack', 'm2', 'strand-m', 'custom'];
export const LOT_STATUSES = ['usable', 'blocked', 'damaged', 'unverified', 'transformed'];

export function saveMaterial(state, p, ctx) {
  const id = recordId(state, 'materials', p, ctx);
  const existing = state.materials.find(m => m.id === id);
  const unit = oneOf(p.unit ?? existing?.unit ?? 'piece', UNITS, 'unit');
  if (existing && unit !== existing.unit) assert(!state.lots.some(l => l.materialId === id), 'unit_in_use', { materialId: id });
  const source = { ...existing, ...p };
  const material = {
    id, name: text(source.name, 'name', { required: true, max: 300 }),
    category: text(source.category ?? 'other', 'category', { required: true, max: 100 }),
    brand: text(source.brand, 'brand', { max: 200 }), range: text(source.range, 'range', { max: 200 }),
    code: text(source.code, 'code', { max: 200 }), unit,
    description: text(source.description, 'description', { max: 10000 }), notes: text(source.notes, 'notes', { max: 20000 }),
    tags: stringList(source.tags), color: text(source.color, 'color', { max: 40 }),
    minimum: quantity(source.minimum, { nullable: true, field: 'minimum' }),
    packageSize: quantity(source.packageSize, { nullable: true, positive: true, field: 'packageSize' }),
    strands: integer(source.strands, 'strands', { nullable: true, min: 1, max: 1000 }),
    divisible: source.divisible === true, reusable: source.reusable === true || source.category === 'tool',
    favorite: source.favorite === true, archived: existing?.archived ?? false,
    properties: jsonObject(source.properties), attachments: stringList(source.attachments, 'attachments'),
    createdAt: existing?.createdAt ?? ctx.now, updatedAt: ctx.now,
  };
  assert(!material.color || /^#[0-9a-f]{6}$/i.test(material.color), 'invalid_color');
  put(state, 'materials', material);
  audit(state, ctx, 'material', id, existing ? 'updated' : 'created');
}

export function archiveMaterial(state, p, ctx) {
  const material = find(state, 'materials', p.id);
  material.archived = p.archived !== false;
  material.updatedAt = ctx.now;
  audit(state, ctx, 'material', material.id, material.archived ? 'archived' : 'restored');
}

export function duplicateMaterial(state, p, ctx) {
  const source = find(state, 'materials', p.id);
  saveMaterial(state, { ...source, id: ctx.id(), name: p.name ?? source.name, archived: false }, ctx);
}

export function mergeMaterial(state, p, ctx) {
  const from = find(state, 'materials', p.sourceId), to = find(state, 'materials', p.targetId);
  assert(from.id !== to.id && !to.archived, 'invalid_merge');
  assert(from.unit === to.unit && from.reusable === to.reusable, 'incompatible_units');
  assert(from.packageSize === to.packageSize && from.strands === to.strands, 'incompatible_conversion');
  for (const collection of ['lots', 'needs', 'purchases']) {
    state[collection].forEach(row => { if (row.materialId === from.id) row.materialId = to.id; });
  }
  for (const project of state.projects) {
    const needs = state.needs.filter(n => n.projectId === project.id && n.materialId === to.id);
    if (needs.length > 1) {
      const retained = needs[0];
      retained.quantity = needs.some(n => n.quantity === null) ? null : add(...needs.map(n => n.quantity));
      retained.confidence = retained.quantity === null ? 'unknown' : needs.some(n => n.confidence === 'estimated') ? 'estimated' : 'exact';
      retained.notes = needs.map(n => n.notes).filter(Boolean).join('\n');
      retained.updatedAt = ctx.now;
      const removedIds = new Set(needs.slice(1).map(n => n.id));
      state.needs = state.needs.filter(n => !removedIds.has(n.id));
    }
  }
  state.reservations.forEach(row => { if (row.materialId === from.id) row.materialId = to.id; });
  state.receipts.forEach(row => {
    if (row.materialId === from.id) { row.sourceMaterialId ??= from.id; row.materialId = to.id; }
  });
  // Historical movements retain their original identity; the source remains as a redirect.
  from.archived = true;
  from.mergedInto = to.id;
  from.updatedAt = ctx.now;
  audit(state, ctx, 'material', from.id, 'merged', { targetId: to.id });
}

export function addLot(state, p, ctx) {
  const material = find(state, 'materials', p.materialId);
  assert(!material.archived, 'material_archived');
  const id = recordId(state, 'lots', p, ctx);
  assert(!state.lots.some(l => l.id === id), 'duplicate_id', { collection: 'lots', id });
  const amount = quantity(p.quantity, { nullable: true });
  const confidence = amount === null ? 'unknown' : oneOf(p.confidence ?? 'exact', ['exact', 'estimated'], 'confidence');
  const lot = {
    id, materialId: material.id, quantity: amount, unit: material.unit, confidence,
    status: oneOf(p.status ?? 'usable', LOT_STATUSES.filter(s => s !== 'transformed'), 'status'),
    locationId: optionalRef(state, 'locations', p.locationId), lotCode: text(p.lotCode, 'lotCode', { max: 200 }),
    notes: text(p.notes, 'notes', { max: 10000 }), properties: jsonObject(p.properties),
    cost: integer(p.cost, 'cost', { nullable: true }), currency: currency(p.currency ?? state.settings.currency),
    acquiredAt: date(p.acquiredAt, 'acquiredAt'), supplierId: optionalRef(state, 'suppliers', p.supplierId),
    createdAt: ctx.now, updatedAt: ctx.now,
  };
  state.lots.push(lot);
  movement(state, ctx, { kind: 'opening', materialId: material.id, lotId: id, quantity: amount, unit: material.unit, before: 0, after: amount, reason: text(p.reason, 'reason'), cost: lot.cost, currency: lot.currency });
  return lot;
}

export function saveLot(state, p, ctx) {
  const lot = find(state, 'lots', p.id);
  assert(!('quantity' in p) || p.quantity === lot.quantity, 'use_stock_count');
  if ('status' in p) lot.status = oneOf(p.status, LOT_STATUSES.filter(s => s !== 'transformed'), 'status');
  if ('confidence' in p) {
    assert(lot.quantity !== null || p.confidence === 'unknown', 'unknown_quantity');
    lot.confidence = oneOf(p.confidence, lot.quantity === null ? ['unknown'] : ['exact', 'estimated'], 'confidence');
  }
  for (const key of ['lotCode', 'notes']) if (key in p) lot[key] = text(p[key], key, { max: key === 'notes' ? 10000 : 200 });
  if ('properties' in p) lot.properties = jsonObject(p.properties);
  lot.updatedAt = ctx.now;
  audit(state, ctx, 'lot', lot.id, 'updated', { status: lot.status });
}

export function stockMove(state, p, ctx) {
  const lot = find(state, 'lots', p.lotId), material = find(state, 'materials', lot.materialId);
  assert(lot.status !== 'transformed', 'lot_transformed');
  const kind = oneOf(p.kind, ['receipt', 'consume', 'loss', 'discard', 'return', 'count', 'transfer'], 'kind');
  const before = lot.quantity;
  const projectId = optionalRef(state, 'projects', p.projectId);
  const reason = text(p.reason, 'reason', { max: 2000 });
  let movementCost = null;
  let amount = quantity(p.quantity, { positive: !['count', 'transfer'].includes(kind), nullable: kind === 'transfer' });
  const ownReserved = projectId ? totalReserved(state, lot.id, [projectId]) : 0;
  const reserved = totalReserved(state, lot.id);
  if (kind === 'transfer') {
    const to = optionalRef(state, 'locations', p.toLocationId);
    assert(to !== lot.locationId, 'same_location');
    if (amount === null || amount === before) {
      const from = lot.locationId;
      lot.locationId = to;
      movement(state, ctx, { kind, lotId: lot.id, materialId: material.id, quantity: before, unit: material.unit, before, after: before, fromLocationId: from, toLocationId: to, projectId, reason });
    } else {
      assert(before !== null, 'unknown_quantity');
      assert(amount > 0 && amount <= subtract(before, reserved), 'insufficient_available', { available: Math.max(0, subtract(before, reserved)) });
      const child = { ...structuredClone(lot), id: ctx.id(), quantity: amount, locationId: to, createdAt: ctx.now, updatedAt: ctx.now, sourceLotId: lot.id };
      if (lot.cost !== null) { child.cost = Math.round(lot.cost * amount / before); lot.cost -= child.cost; }
      lot.quantity = subtract(before, amount);
      state.lots.push(child);
      movement(state, ctx, { kind, lotId: lot.id, materialId: material.id, quantity: amount, unit: material.unit, before, after: lot.quantity, destinationLotId: child.id, fromLocationId: lot.locationId, toLocationId: to, projectId, reason });
    }
  } else if (kind === 'count') {
    lot.quantity = amount;
    lot.confidence = oneOf(p.confidence ?? 'exact', ['exact', 'estimated'], 'confidence');
    if (before !== amount) lot.cost = null;
    movement(state, ctx, { kind, lotId: lot.id, materialId: material.id, quantity: before === null ? null : subtract(amount, before), observedQuantity: amount, unit: material.unit, before, after: amount, projectId, reason });
  } else {
    assert(before !== null, 'unknown_quantity');
    if (kind === 'receipt') {
      lot.quantity = add(before, amount);
      const receiptCost = integer(p.cost, 'cost', { nullable: true });
      movementCost = receiptCost;
      lot.cost = lot.cost !== null && receiptCost !== null ? lot.cost + receiptCost : null;
    } else {
      if (kind === 'consume') {
        assert(!material.reusable, 'tool_not_consumable');
        assert(lot.status === 'usable', 'lot_unavailable');
        if (projectId) activeProject(state, projectId);
        const permitted = Math.max(0, subtract(before, subtract(reserved, ownReserved)));
        assert(amount <= permitted, 'insufficient_available', { available: permitted });
      } else {
        assert(amount <= before, 'insufficient_physical', { physical: before });
        // Explicit physical loss can expose a reservation conflict, never erase it.
      }
      movementCost = lot.cost === null ? null : Math.round(lot.cost * amount / before);
      if (movementCost !== null) lot.cost -= movementCost;
      lot.quantity = subtract(before, amount);
      if (kind === 'consume' && ownReserved > 0) {
        let release = Math.min(amount, ownReserved);
        for (const reservation of state.reservations.filter(r => r.lotId === lot.id && r.projectId === projectId)) {
          const take = Math.min(release, reservation.quantity);
          reservation.quantity = subtract(reservation.quantity, take);
          reservation.updatedAt = ctx.now;
          release = subtract(release, take);
        }
      }
    }
    movement(state, ctx, { kind, lotId: lot.id, materialId: material.id, quantity: amount, unit: material.unit, before, after: lot.quantity, projectId, reason, confidence: lot.confidence, cost: movementCost, currency: lot.currency });
  }
  lot.updatedAt = ctx.now;
}

export function reverseMovement(state, p, ctx) {
  const original = find(state, 'movements', p.movementId);
  assert(['consume', 'loss', 'discard', 'return'].includes(original.kind), 'movement_not_reversible');
  assert(!state.movements.some(m => m.reversesId === original.id), 'already_reversed');
  const lot = find(state, 'lots', original.lotId);
  assert(lot.quantity !== null && lot.status !== 'transformed', 'lot_unavailable');
  const before = lot.quantity;
  lot.quantity = add(before, original.quantity);
  lot.cost = lot.cost !== null && original.cost !== null && original.cost !== undefined ? lot.cost + original.cost : null;
  lot.updatedAt = ctx.now;
  movement(state, ctx, { kind: 'correction', lotId: lot.id, materialId: lot.materialId, quantity: original.quantity, unit: lot.unit, before, after: lot.quantity, projectId: original.projectId, reversesId: original.id, cost: original.cost ?? null, currency: lot.currency, reason: text(p.reason, 'reason', { required: true }) });
}

export function setReservation(state, p, ctx) {
  const project = activeProject(state, p.projectId), lot = find(state, 'lots', p.lotId);
  const material = find(state, 'materials', lot.materialId);
  const amount = quantity(p.quantity);
  const existing = state.reservations.find(r => r.projectId === project.id && r.lotId === lot.id);
  const oldAmount = existing?.quantity ?? 0;
  if (amount > oldAmount) {
    assert(!material.archived && lot.status === 'usable', 'lot_unavailable');
    assert(lot.quantity !== null, 'unknown_quantity');
    const available = Math.max(0, subtract(lot.quantity, subtract(totalReserved(state, lot.id), oldAmount)));
    assert(amount <= available, 'insufficient_available', { available });
  }
  const row = { id: existing?.id ?? ctx.id(), projectId: project.id, lotId: lot.id, materialId: lot.materialId, quantity: amount, unit: material.unit, createdAt: existing?.createdAt ?? ctx.now, updatedAt: ctx.now };
  put(state, 'reservations', row);
  audit(state, ctx, 'reservation', row.id, 'set', { before: oldAmount, after: amount });
}

export function inventorySummary(state, materialId, projectIds) {
  const lots = state.lots.filter(l => l.materialId === materialId && l.status !== 'transformed');
  const knownPhysical = add(...lots.map(l => l.quantity ?? 0));
  const unknown = lots.filter(l => l.quantity === null).length;
  const eligible = add(...lots.filter(l => l.status === 'usable' && l.quantity !== null).map(l => l.quantity));
  const reserved = add(...lots.map(l => totalReserved(state, l.id)));
  const ownReserved = projectIds ? add(...lots.map(l => totalReserved(state, l.id, projectIds))) : 0;
  const conflicts = lots.map(l => ({ lotId: l.id, quantity: Math.max(0, subtract(add(totalReserved(state, l.id), toolHeldQuantity(l)), l.status === 'usable' ? (l.quantity ?? 0) : 0)), projectIds: state.reservations.filter(r => r.lotId === l.id && r.quantity > 0).map(r => r.projectId) })).filter(c => c.quantity > 0);
  // Available is summed per lot, so an over-reserved lot cannot hide free material in a different lot.
  const regionHeld = add(...lots.map(fabricHeldPieces));
  const available = add(...lots.filter(l => l.status === 'usable' && l.quantity !== null).map(l => Math.max(0, subtract(l.quantity, add(totalReserved(state, l.id), fabricHeldPieces(l), toolHeldQuantity(l))))));
  return { physical: unknown ? null : knownPhysical, knownPhysical, eligible, reserved, ownReserved, available, regionHeld, toolHeld: add(...lots.map(toolHeldQuantity)), unknown, estimated: lots.some(l => l.confidence === 'estimated'), conflicts };
}

export function saveLocation(state, p, ctx) {
  const id = recordId(state, 'locations', p, ctx), existing = state.locations.find(l => l.id === id);
  const parentId = optionalRef(state, 'locations', 'parentId' in p ? p.parentId : existing?.parentId);
  let ancestor = parentId;
  while (ancestor) { assert(ancestor !== id, 'location_cycle'); ancestor = find(state, 'locations', ancestor).parentId; }
  put(state, 'locations', { id, attachments: stringList(existing?.attachments ?? p.attachments, 'attachments'), name: text(p.name ?? existing?.name, 'name', { required: true, max: 300 }), parentId, notes: text(p.notes ?? existing?.notes, 'notes', { max: 10000 }), createdAt: existing?.createdAt ?? ctx.now, updatedAt: ctx.now });
}

export function saveSupplier(state, p, ctx) {
  const id = recordId(state, 'suppliers', p, ctx), existing = state.suppliers.find(s => s.id === id), source = { ...existing, ...p };
  const url = text(source.url, 'url', { max: 2000 });
  assert(!url || /^https?:\/\//i.test(url), 'invalid_url');
  put(state, 'suppliers', { id, name: text(source.name, 'name', { required: true, max: 300 }), contact: text(source.contact, 'contact'), url, notes: text(source.notes, 'notes', { max: 10000 }), createdAt: existing?.createdAt ?? ctx.now, updatedAt: ctx.now });
}
