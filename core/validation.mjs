import { assert, assertSafeJson, identifier, quantity, integer, text, oneOf, currency, add } from './shared.mjs';
import { UNITS, LOT_STATUSES } from './inventory.mjs';
import { PROJECT_STATUSES, validProgressKeys } from './projects.mjs';

const LIMITS = {
  materials: 50000, lots: 100000, movements: 250000, reservations: 100000,
  projects: 10000, needs: 100000, purchases: 100000, receipts: 100000,
  locations: 10000, suppliers: 10000, patterns: 10000, sessions: 100000,
  attachments: 100000, categories: 1000, tasks: 100000, cuts: 50000,
  kitOpenings: 50000, audit: 500000, operations: 500000,
};

/** Validate restored/imported state before persistence activation; never repair silently. */
export function validateState(state, { validatePattern } = {}) {
  assertSafeJson(state);
  assert(state && state.schemaVersion === 1, 'unsupported_schema', { version: state?.schemaVersion });
  assert(Number.isSafeInteger(state.revision) && state.revision >= 0, 'invalid_revision');
  const indexes = {};
  for (const [name, limit] of Object.entries(LIMITS)) {
    const records = state[name];
    assert(Array.isArray(records) && records.length <= limit, 'invalid_collection', { collection: name, limit });
    const index = new Map();
    for (const record of records) {
      assert(record && typeof record === 'object' && !Array.isArray(record), 'invalid_record', { collection: name });
      identifier(record.id);
      assert(!index.has(record.id), 'duplicate_id', { collection: name, id: record.id });
      index.set(record.id, record);
    }
    indexes[name] = index;
  }
  const ref = (collection, id, optional = false) => {
    if (optional && (id === null || id === undefined || id === '')) return null;
    identifier(id);
    const row = indexes[collection].get(id);
    assert(row, 'broken_reference', { collection, id });
    return row;
  };
  const q = (value, field, nullable = false, signed = false) => {
    if (nullable && value === null) return;
    assert(typeof value === 'number', 'invalid_number', { field });
    const absolute = signed ? Math.abs(value) : value;
    assert(quantity(absolute, { field }) === absolute, 'invalid_precision', { field });
  };
  const money = (value, field) => {
    if (value === null || value === undefined) return;
    assert(typeof value === 'number', 'invalid_integer', { field });
    integer(value, field);
  };
  const attachments = value => {
    assert(Array.isArray(value) && value.length <= 100, 'invalid_attachments');
    value.forEach(id => ref('attachments', id));
  };
  const uniquePair = (records, fields) => {
    const keys = new Set();
    for (const row of records) {
      const key = fields.map(field => row[field]).join('\u0000');
      assert(!keys.has(key), 'duplicate_relation', { fields }); keys.add(key);
    }
  };
  assert(state.settings && typeof state.settings === 'object', 'invalid_settings');
  oneOf(state.settings.language, ['it', 'en'], 'language');
  oneOf(state.settings.paper, ['a4', 'letter'], 'paper');
  currency(state.settings.currency);

  for (const material of state.materials) {
    text(material.name, 'name', { required: true, max: 300 });
    assert(typeof material.code === 'string', 'invalid_code');
    oneOf(material.unit, UNITS, 'unit');
    q(material.minimum, 'minimum', true); q(material.packageSize, 'packageSize', true);
    assert(material.packageSize === null || material.packageSize > 0, 'invalid_package_size');
    if (material.strands !== null) integer(material.strands, 'strands', { min: 1, max: 1000 });
    if (material.mergedInto) ref('materials', material.mergedInto);
    attachments(material.attachments);
  }
  for (const location of state.locations) {
    text(location.name, 'name', { required: true, max: 300 });
    let cursor = location, visited = new Set();
    while (cursor) {
      assert(!visited.has(cursor.id), 'location_cycle');
      assert(visited.size < 100, 'location_too_deep');
      visited.add(cursor.id); cursor = ref('locations', cursor.parentId, true);
    }
  }
  for (const lot of state.lots) {
    const material = ref('materials', lot.materialId);
    assert(lot.unit === material.unit, 'incompatible_units');
    q(lot.quantity, 'lot.quantity', true);
    oneOf(lot.confidence, lot.quantity === null ? ['unknown'] : ['exact', 'estimated'], 'confidence');
    oneOf(lot.status, LOT_STATUSES, 'status');
    assert(lot.status !== 'transformed' || lot.quantity === 0, 'invalid_transformed_lot');
    ref('locations', lot.locationId, true); ref('suppliers', lot.supplierId, true);
    ref('lots', lot.sourceLotId, true); ref('lots', lot.sourceKitLotId, true);
    money(lot.cost, 'lot.cost'); currency(lot.currency);
  }
  for (const movement of state.movements) {
    ref('lots', movement.lotId); const material = ref('materials', movement.materialId);
    assert(movement.unit === material.unit, 'incompatible_units');
    q(movement.quantity, 'movement.quantity', true, movement.kind === 'count');
    q(movement.before, 'movement.before', true); q(movement.after, 'movement.after', true);
    ref('projects', movement.projectId, true); ref('purchases', movement.purchaseId, true);
    ref('movements', movement.reversesId, true); ref('lots', movement.destinationLotId, true);
    money(movement.cost, 'movement.cost');
    if (movement.currency !== undefined) currency(movement.currency);
    identifier(movement.operationId, 'operationId');
  }
  uniquePair(state.reservations, ['projectId', 'lotId']);
  for (const reservation of state.reservations) {
    ref('projects', reservation.projectId);
    const lot = ref('lots', reservation.lotId);
    assert(reservation.materialId === lot.materialId && reservation.unit === lot.unit, 'reservation_identity_mismatch');
    q(reservation.quantity, 'reservation.quantity');
    // Physical counts/loss can create conflicts; preserving them is required, not corruption.
  }
  uniquePair(state.needs, ['projectId', 'materialId']);
  for (const need of state.needs) {
    ref('projects', need.projectId); const material = ref('materials', need.materialId);
    assert(need.unit === material.unit, 'incompatible_units'); q(need.quantity, 'need.quantity', true);
    oneOf(need.confidence, need.quantity === null ? ['unknown'] : ['exact', 'estimated'], 'confidence');
  }
  for (const pattern of state.patterns) {
    oneOf(pattern.kind, ['structured', 'reference'], 'pattern.kind');
    if (validatePattern) validatePattern(pattern);
    if (pattern.kind === 'structured') {
      assert(Array.isArray(pattern.revisions) && pattern.revisions.length > 0 && pattern.revisions.length <= 1000, 'invalid_revisions');
      const ids = new Set();
      for (const revision of pattern.revisions) {
        identifier(revision.id); assert(!ids.has(revision.id), 'duplicate_revision'); ids.add(revision.id);
        integer(revision.width, 'width', { min: 1, max: 1000 }); integer(revision.height, 'height', { min: 1, max: 1000 });
        assert(Array.isArray(revision.cells) && revision.cells.length === revision.width * revision.height && Array.isArray(revision.colors) && revision.colors.length <= 2000, 'invalid_grid');
        assert(revision.cells.every(c => Number.isInteger(c) && c >= -1 && c < revision.colors.length), 'invalid_grid');
        for (const name of ['halfStitches', 'backstitches']) {
          assert(Array.isArray(revision[name] ?? []) && (revision[name]?.length ?? 0) <= 500000, 'invalid_primitives');
          const primitiveIds = new Set();
          for (const primitive of revision[name] ?? []) { identifier(primitive.id); assert(!primitiveIds.has(primitive.id), 'duplicate_primitive'); primitiveIds.add(primitive.id); }
        }
      }
      assert(ids.has(pattern.currentRevisionId), 'revision_not_found');
    }
    ref('attachments', pattern.sourceAttachmentId, true);
  }
  const progressKeys = new Map();
  for (const project of state.projects) {
    text(project.name, 'name', { required: true, max: 300 }); oneOf(project.status, PROJECT_STATUSES, 'status');
    money(project.budget, 'budget'); currency(project.currency);
    ref('lots', project.fabricLotId, true);
    const pattern = ref('patterns', project.patternId, true);
    assert(Array.isArray(project.completed) && new Set(project.completed).size === project.completed.length, 'invalid_progress');
    if (pattern?.kind === 'structured') {
      const revision = pattern.revisions.find(r => r.id === project.revisionId);
      assert(revision, 'revision_not_found');
      const key = `${pattern.id}:${revision.id}`;
      if (!progressKeys.has(key)) progressKeys.set(key, validProgressKeys(revision));
      const valid = progressKeys.get(key);
      assert(project.completed.every(key => valid.has(key)), 'invalid_progress');
    } else assert(project.completed.length === 0, 'invalid_progress');
    q(project.manualPercent, 'manualPercent'); assert(project.manualPercent <= 100, 'invalid_progress');
    attachments(project.attachments);
  }
  const receiptTotals = new Map();
  for (const receipt of state.receipts) {
    q(receipt.quantity, 'receipt.quantity');
    receiptTotals.set(receipt.purchaseId, add(receiptTotals.get(receipt.purchaseId) ?? 0, receipt.quantity));
  }
  for (const purchase of state.purchases) {
    const material = ref('materials', purchase.materialId);
    assert(purchase.unit === material.unit, 'incompatible_units');
    q(purchase.quantity, 'purchase.quantity'); assert(purchase.quantity > 0, 'quantity_positive');
    q(purchase.received, 'purchase.received'); assert(purchase.received <= purchase.quantity, 'receipt_exceeds_order');
    oneOf(purchase.status, ['to_buy', 'ordered', 'partial', 'received', 'cancelled'], 'status');
    assert(Array.isArray(purchase.projectIds), 'invalid_list'); purchase.projectIds.forEach(id => ref('projects', id));
    ref('suppliers', purchase.supplierId, true); money(purchase.unitPrice, 'unitPrice'); currency(purchase.currency);
    const actual = receiptTotals.get(purchase.id) ?? 0;
    assert(actual === purchase.received, 'receipt_total_mismatch');
    if (purchase.status === 'received') assert(actual === purchase.quantity, 'invalid_purchase_status');
  }
  for (const receipt of state.receipts) {
    const purchase = ref('purchases', receipt.purchaseId), lot = ref('lots', receipt.lotId);
    ref('materials', receipt.materialId);
    assert(receipt.materialId === purchase.materialId && receipt.materialId === lot.materialId && receipt.unit === lot.unit, 'receipt_identity_mismatch');
    q(receipt.quantity, 'receipt.quantity'); assert(receipt.quantity > 0, 'quantity_positive');
    money(receipt.cost, 'cost'); currency(receipt.currency); identifier(receipt.operationId);
  }
  for (const task of state.tasks) { ref('projects', task.projectId); text(task.title, 'title', { required: true, max: 500 }); assert(typeof task.done === 'boolean', 'invalid_boolean'); }
  for (const session of state.sessions) {
    ref('projects', session.projectId); q(session.durationMinutes, 'durationMinutes'); assert(session.durationMinutes <= 1440, 'session_too_long'); attachments(session.attachments);
  }
  for (const cut of state.cuts) {
    ref('lots', cut.sourceLotId); assert(Array.isArray(cut.pieceIds) && cut.pieceIds.length > 0, 'invalid_cut'); cut.pieceIds.forEach(id => ref('lots', id));
    q(cut.wasteCm2, 'wasteCm2');
  }
  for (const kit of state.kitOpenings) {
    ref('lots', kit.kitLotId); assert(Array.isArray(kit.componentLotIds), 'invalid_kit'); kit.componentLotIds.forEach(id => ref('lots', id));
    money(kit.cost, 'kit.cost'); money(kit.unallocatedCost, 'kit.unallocatedCost'); currency(kit.currency);
  }
  for (const operation of state.operations) {
    text(operation.type, 'operation.type', { required: true, max: 100 });
    text(operation.signature, 'operation.signature', { required: true, max: 20_000_000 });
  }
  return state;
}
