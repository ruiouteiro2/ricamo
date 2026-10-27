import { add, subtract, assert, identifier, text, quantity, integer, oneOf, date, find, audit, activeProject, totalReserved } from './shared.mjs';
import { UNITS, inventorySummary, addLot, setReservation } from './inventory.mjs';
import { saveNeed } from './projects.mjs';
import { openKit } from './fabric.mjs';

const LIMIT = 200;
const object = value => assert(value && typeof value === 'object' && !Array.isArray(value), 'kit_invalid_data');
const exactKeys = (value, keys) => { object(value); assert(Object.keys(value).length === keys.length && Object.keys(value).every(key => keys.includes(key)), 'kit_unsupported_fields'); };
const numeric = (value, nullable = true) => { assert(value === null && nullable || typeof value === 'number', 'kit_invalid_quantity'); const result = quantity(value, { nullable }); assert(result === value, 'kit_invalid_quantity'); return result; };
const timestamp = value => { assert(typeof value === 'string' && value.length > 0, 'invalid_date'); return date(value); };
export function kitPlans(state) { return state.kitLibrary === undefined ? [] : state.kitLibrary.plans; }
function plan(state, id) { const record = kitPlans(state).find(row => row.id === id); assert(record, 'kit_plan_missing'); return record; }
function library(state) { state.kitLibrary ??= { version: 1, plans: [] }; return state.kitLibrary; }
function reference(state, collection, value) { return value ? find(state, collection, value).id : null; }

function component(state, row, kind, ctx) {
  object(row);
  const materialId = reference(state, 'materials', row.materialId), material = materialId && find(state, 'materials', materialId);
  assert(kind !== 'virtual' || material, 'kit_component_material_required');
  const unit = material ? material.unit : row.unit ? oneOf(row.unit, UNITS, 'unit') : null;
  if (material && row.unit) assert(row.unit === material.unit, 'kit_component_unit_changed');
  const amount = quantity(row.quantity, { nullable: true });
  assert(unit || amount === null, 'kit_quantity_requires_unit');
  const substituteMaterialId = reference(state, 'materials', row.substituteMaterialId);
  if (substituteMaterialId) assert(material && substituteMaterialId !== materialId && find(state, 'materials', substituteMaterialId).unit === unit, 'kit_substitute_units');
  return { id: row.id ? identifier(row.id) : ctx.id(), materialId, label: text(row.label || material?.name, 'label', { required: true, max: 300 }), unit, quantity: amount,
    confidence: amount === null ? 'unknown' : oneOf(row.confidence ?? 'exact', ['exact','estimated'], 'confidence'), substituteMaterialId, notes: text(row.notes, 'notes', { max: 2000 }) };
}
function savePlan(state, payload, ctx) {
  const existing = payload.id && kitPlans(state).find(row => row.id === payload.id);
  const kind = oneOf(payload.kind ?? existing?.kind, ['physical','virtual'], 'kind');
  assert(!existing || existing.kind === kind, 'kit_kind_immutable');
  const materialId = kind === 'physical' ? reference(state, 'materials', payload.materialId ?? existing?.materialId) : null;
  assert(kind !== 'physical' || materialId, 'kit_physical_material_required');
  assert(!existing || existing.materialId === materialId, 'kit_material_immutable');
  assert(Array.isArray(payload.components) && payload.components.length <= LIMIT, 'kit_component_limit');
  const id = payload.id ? identifier(payload.id) : ctx.id();
  const record = { id, revision: (existing?.revision ?? 0) + 1, kind, materialId, name: text(payload.name, 'name', { required: true, max: 300 }), patternId: reference(state, 'patterns', payload.patternId),
    notes: text(payload.notes, 'notes', { max: 5000 }), components: payload.components.map(row => component(state, row, kind, ctx)), archived: existing?.archived ?? false, createdAt: existing?.createdAt ?? ctx.now, updatedAt: ctx.now };
  const records = library(state).plans, index = records.findIndex(row => row.id === id);
  if (index < 0) { assert(records.length < LIMIT, 'kit_plan_limit'); records.push(record); } else records[index] = record;
  audit(state, ctx, 'kit_plan', id, existing ? 'updated' : 'created');
}
function archivePlan(state, payload, ctx) {
  const record = plan(state, payload.id); assert(typeof payload.archived === 'boolean', 'invalid_boolean');
  record.archived = payload.archived; record.revision++; record.updatedAt = ctx.now;
  audit(state, ctx, 'kit_plan', record.id, record.archived ? 'archived' : 'restored');
}

/** Pure preview: virtual collections are plans, never a second physical stock unit. */
export function kitPlanPreview(state, { planId, projectId, mode = 'keep', multiplier = 1 }) {
  const selected = plan(state, planId); assert(selected.kind === 'virtual' && !selected.archived, 'kit_virtual_required'); activeProject(state, projectId);
  oneOf(mode, ['keep','replace'], 'mode'); const count = integer(multiplier, 'multiplier', { min: 1, max: 100 });
  const grouped = new Map();
  for (const row of selected.components) {
    const material = find(state, 'materials', row.substituteMaterialId || row.materialId);
    assert(!material.archived && material.unit === row.unit, 'kit_component_unavailable');
    const amount = row.quantity === null ? null : quantity(row.quantity * count);
    const group = grouped.get(material.id);
    if (group) { group.quantity = amount === null || group.quantity === null ? null : quantity(add(group.quantity, amount)); group.estimated ||= row.confidence === 'estimated'; group.componentIds.push(row.id); }
    else grouped.set(material.id, { materialId: material.id, unit: material.unit, quantity: amount, estimated: row.confidence === 'estimated', componentIds: [row.id] });
  }
  const rows = [...grouped.values()].map(row => {
    const existing = state.needs.find(need => need.projectId === projectId && need.materialId === row.materialId);
    const confidence = row.quantity === null ? 'unknown' : row.estimated ? 'estimated' : 'exact';
    const action = existing && mode === 'keep' ? 'keep' : existing && existing.quantity === row.quantity && existing.confidence === confidence ? 'same' : existing ? 'replace' : 'add';
    const stock = inventorySummary(state, row.materialId);
    return { materialId: row.materialId, unit: row.unit, quantity: row.quantity, confidence, componentIds: row.componentIds, previousQuantity: existing?.quantity ?? null, existingNeedId: existing?.id ?? null, action, available: stock.available, unknownStock: stock.unknown };
  });
  return { stateRevision: state.revision, planId, planRevision: selected.revision, projectId, mode, multiplier: count, rows, changes: rows.filter(row => ['add','replace'].includes(row.action)).length };
}
function applyPlan(state, payload, ctx) {
  assert(payload.previewRevision === state.revision, 'kit_preview_stale');
  const preview = kitPlanPreview(state, payload); assert(payload.planRevision === preview.planRevision, 'kit_preview_stale');
  assert(preview.changes > 0, 'kit_no_changes');
  if (preview.rows.some(row => row.action === 'replace')) assert(payload.confirmReplace === true, 'kit_replace_confirmation');
  const before = [];
  for (const row of preview.rows.filter(row => ['add','replace'].includes(row.action))) {
    const previous = state.needs.find(need => need.id === row.existingNeedId); if (previous) before.push(structuredClone(previous));
    saveNeed(state, { projectId: payload.projectId, materialId: row.materialId, quantity: row.quantity, confidence: row.confidence, source: 'manual', notes: previous?.notes ?? '' }, ctx);
  }
  audit(state, ctx, 'project', payload.projectId, 'kit_plan_applied', { planId: preview.planId, planRevision: preview.planRevision, multiplier: preview.multiplier, mode: preview.mode, before, rows: preview.rows.map(({available,unknownStock,...row}) => row), stockChanged: false });
}

function validateComponent(state, row, kind, { historical = false } = {}) {
  exactKeys(row, ['id','materialId','label','unit','quantity','confidence','substituteMaterialId','notes']); identifier(row.id);
  text(row.label, 'label', { required: true, max: 300 }); text(row.notes, 'notes', { max: 2000 });
  const material = row.materialId === null ? null : find(state, 'materials', row.materialId); assert(kind !== 'virtual' || material, 'kit_component_material_required');
  if (row.unit !== null) oneOf(row.unit, UNITS, 'unit'); numeric(row.quantity);
  assert(row.unit || row.quantity === null, 'kit_quantity_requires_unit');
  assert(row.quantity === null ? row.confidence === 'unknown' : ['exact','estimated'].includes(row.confidence), 'kit_invalid_confidence');
  if (!historical && material) assert(row.unit === material.unit, 'kit_component_unit_changed');
  if (row.substituteMaterialId !== null) { const replacement = find(state, 'materials', row.substituteMaterialId); assert(material && replacement.id !== material.id && (historical || replacement.unit === row.unit), 'kit_substitute_units'); }
}
function validatePlan(state, record) {
  exactKeys(record, ['id','revision','kind','materialId','name','patternId','notes','components','archived','createdAt','updatedAt']); identifier(record.id); assert(typeof record.revision === 'number', 'kit_invalid_revision'); integer(record.revision, 'revision', { min: 1 });
  oneOf(record.kind, ['physical','virtual'], 'kind'); text(record.name, 'name', { required: true, max: 300 }); text(record.notes, 'notes', { max: 5000 });
  assert(typeof record.archived === 'boolean', 'invalid_boolean'); timestamp(record.createdAt); timestamp(record.updatedAt);
  if (record.patternId !== null) find(state, 'patterns', record.patternId);
  if (record.kind === 'physical') { const kit = find(state, 'materials', record.materialId); if (!record.archived) assert(kit.category === 'kit' && kit.unit === 'piece', 'not_physical_kit'); }
  else assert(record.materialId === null, 'kit_virtual_has_no_stock');
  assert(Array.isArray(record.components) && record.components.length <= LIMIT, 'kit_component_limit'); const ids = new Set();
  for (const row of record.components) { validateComponent(state,row,record.kind,{historical:record.archived}); assert(!ids.has(row.id), 'duplicate_id'); ids.add(row.id); assert(!record.materialId || row.materialId !== record.materialId && row.substituteMaterialId !== record.materialId, 'kit_contains_itself'); }
}

function verificationRow(state, raw, declaration, origin, kitId, ctx) {
  object(raw); const status = oneOf(raw.status, ['available','missing','unverified'], 'status');
  const material = status === 'available' ? find(state, 'materials', raw.actualMaterialId) : null;
  if (material) assert(!material.archived && material.id !== kitId, 'kit_component_unavailable');
  if (status !== 'available') assert(raw.quantity === null || raw.quantity === undefined || raw.quantity === '', 'kit_pending_has_no_stock');
  const amount = status === 'available' ? quantity(raw.quantity, { nullable: true }) : null;
  return { id: declaration.id, declaration: structuredClone(declaration), origin, status, actualMaterialId: material?.id ?? null, quantity: amount,
    confidence: amount === null ? 'unknown' : oneOf(raw.confidence ?? 'exact', ['exact','estimated'], 'confidence'), lotCode: text(raw.lotCode, 'lotCode', { max: 200 }), notes: text(raw.notes, 'notes', { max: 2000 }),
    componentLotId: null, verifiedAt: status === 'unverified' ? null : ctx.now };
}
function reserveComponents(state, opening, rows, payload, ctx) {
  if (!payload.reserveComponents) return;
  assert(opening.verification.projectId, 'kit_project_required'); activeProject(state, opening.verification.projectId);
  for (const row of rows) if (row.status === 'available' && row.quantity !== null && row.quantity > 0) setReservation(state, { projectId: opening.verification.projectId, lotId: row.componentLotId, quantity: row.quantity }, ctx);
}
function openVerified(state, payload, ctx) {
  assert(payload.confirmed === true, 'kit_open_confirmation');
  const kitLot = find(state,'lots',payload.lotId), kit = find(state,'materials',kitLot.materialId);
  const definition = payload.planId ? plan(state,payload.planId) : null;
  if (definition) assert(definition.kind === 'physical' && !definition.archived && definition.materialId === kit.id && definition.revision === payload.planRevision, 'kit_preview_stale');
  const declarations = definition?.components ?? [], byId = new Map(declarations.map(row=>[row.id,row]));
  assert(Array.isArray(payload.rows) && payload.rows.length <= LIMIT, 'kit_component_limit');
  const seen = new Set(), rows = payload.rows.map(raw => {
    object(raw); identifier(raw.id); assert(!seen.has(raw.id), 'duplicate_id'); seen.add(raw.id);
    let declared = byId.get(raw.id); const origin = declared ? 'declared' : 'additional';
    if (!declared) declared = component(state, { id: raw.id, materialId: raw.actualMaterialId || null, label: raw.label, quantity: null }, 'physical', ctx);
    return verificationRow(state,raw,declared,origin,kit.id,ctx);
  });
  assert(declarations.every(row=>seen.has(row.id)), 'kit_declared_row_missing');
  const projectId = reference(state,'projects',payload.projectId); if (projectId) activeProject(state,projectId);
  assert(typeof payload.reserveComponents === 'boolean', 'invalid_boolean');
  const own = projectId ? totalReserved(state,kitLot.id,[projectId]) : 0, transferred = Math.min(own,1);
  if (transferred) setReservation(state,{projectId,lotId:kitLot.id,quantity:subtract(own,transferred)},ctx);
  const available = rows.filter(row=>row.status==='available');
  openKit(state,{lotId:kitLot.id,confirmEmpty:true,components:available.map(row=>({materialId:row.actualMaterialId,quantity:row.quantity,confidence:row.confidence,lotCode:row.lotCode,notes:row.notes}))},ctx);
  const opening = state.kitOpenings[state.kitOpenings.length-1];
  state.movements[state.movements.length-1].projectId = projectId;
  for (const [index,row] of available.entries()) row.componentLotId = opening.componentLotIds[index];
  opening.verification = { version:1,revision:1,planId:definition?.id??null,planRevision:definition?.revision??null,definitionName:definition?.name??kit.name,patternId:definition?.patternId??null,projectId,reservationTransferred:transferred,rows,notes:text(payload.notes,'notes',{max:5000}),updatedAt:ctx.now };
  reserveComponents(state,opening,available,payload,ctx);
  audit(state,ctx,'kit',opening.id,'contents_verified',{available:available.length,missing:rows.filter(row=>row.status==='missing').length,pending:rows.filter(row=>row.status==='unverified').length,projectId,reservationTransferred:transferred});
}
function reconcileOpening(state,payload,ctx) {
  assert(payload.confirmed === true,'kit_open_confirmation'); const opening = find(state,'kitOpenings',payload.openingId), verification = opening.verification;
  assert(verification && verification.revision === payload.openingRevision,'kit_preview_stale');
  assert(Array.isArray(payload.rows) && payload.rows.length > 0 && payload.rows.length <= LIMIT,'kit_component_limit');
  assert(typeof payload.reserveComponents === 'boolean','invalid_boolean');
  const kitLot = find(state,'lots',opening.kitLotId), seen = new Set(), changed = [];
  for (const raw of payload.rows) {
    object(raw); identifier(raw.id); assert(!seen.has(raw.id),'duplicate_id'); seen.add(raw.id);
    const index = verification.rows.findIndex(row=>row.id===raw.id), previous = verification.rows[index];
    assert(previous && previous.status === 'unverified','kit_already_verified'); assert(raw.status !== 'unverified','kit_no_changes');
    const row = verificationRow(state,raw,previous.declaration,previous.origin,kitLot.materialId,ctx);
    if (row.status === 'available') {
      const lot = addLot(state,{materialId:row.actualMaterialId,quantity:row.quantity,confidence:row.confidence,lotCode:row.lotCode,notes:row.notes,locationId:kitLot.locationId,cost:null,currency:opening.currency},ctx);
      lot.sourceKitLotId = kitLot.id; lot.kitOpeningId = opening.id;
      const movement = state.movements[state.movements.length-1]; movement.kind = 'kit_component'; movement.kitOpeningId = opening.id;
      opening.componentLotIds.push(lot.id); row.componentLotId = lot.id;
    }
    verification.rows[index] = row; changed.push(row);
  }
  reserveComponents(state,opening,changed,payload,ctx); verification.revision++; verification.updatedAt = ctx.now;
  audit(state,ctx,'kit',opening.id,'pending_contents_reconciled',{rows:changed.map(row=>({id:row.id,status:row.status,componentLotId:row.componentLotId})),kitQuantityChanged:false});
}
export function kitMaterialDestination(state,id) {
  const seen = new Set(); let material = find(state,'materials',id);
  while (material.mergedInto) { assert(!seen.has(material.id),'kit_invalid_relation'); seen.add(material.id); material = find(state,'materials',material.mergedInto); }
  return material.id;
}
function validateOpening(state,opening,receipts,events) {
  if (opening.verification === undefined) return;
  const value = opening.verification;
  exactKeys(value,['version','revision','planId','planRevision','definitionName','patternId','projectId','reservationTransferred','rows','notes','updatedAt']);
  assert(value.version===1,'kit_unsupported_version'); assert(typeof value.revision==='number','kit_invalid_revision'); integer(value.revision,'revision',{min:1});
  if (value.planId!==null) { const definition = plan(state,value.planId); assert(definition.kind==='physical' && typeof value.planRevision==='number' && Number.isInteger(value.planRevision) && value.planRevision>=1 && value.planRevision<=definition.revision,'kit_invalid_relation'); }
  else assert(value.planRevision===null,'kit_invalid_relation');
  text(value.definitionName,'definitionName',{required:true,max:300}); text(value.notes,'notes',{max:5000}); timestamp(value.updatedAt);
  if(value.patternId!==null)find(state,'patterns',value.patternId);if(value.projectId!==null)find(state,'projects',value.projectId);
  numeric(value.reservationTransferred,false);assert(value.reservationTransferred<=1 && (value.projectId || value.reservationTransferred===0),'kit_invalid_relation');
  assert(Array.isArray(value.rows)&&value.rows.length<=LIMIT,'kit_component_limit');const ids=new Set(),lots=new Set();
  const kitLot=find(state,'lots',opening.kitLotId);
  assert(opening.unallocatedCost === opening.cost, 'kit_cost_allocation');
  const event=events.get(opening.id);assert(event&&event.lotId===kitLot.id&&event.quantity===1&&(event.projectId??null)===value.projectId,'kit_invalid_relation');
  assert(event.before!==null && event.before>=1 && event.after===subtract(event.before,1) && kitMaterialDestination(state,event.materialId)===kitMaterialDestination(state,kitLot.materialId),'kit_invalid_relation');
  for(const row of value.rows){
    exactKeys(row,['id','declaration','origin','status','actualMaterialId','quantity','confidence','lotCode','notes','componentLotId','verifiedAt']);identifier(row.id);assert(!ids.has(row.id),'duplicate_id');ids.add(row.id);
    validateComponent(state,row.declaration,'physical',{historical:true});assert(row.declaration.id===row.id,'kit_invalid_relation');oneOf(row.origin,['declared','additional'],'origin');oneOf(row.status,['available','missing','unverified'],'status');
    text(row.lotCode,'lotCode',{max:200});text(row.notes,'notes',{max:2000});numeric(row.quantity);
    if(row.status==='unverified')assert(row.verifiedAt===null,'kit_invalid_relation');else timestamp(row.verifiedAt);
    if(row.status==='available'){
      const material=find(state,'materials',row.actualMaterialId),lot=find(state,'lots',row.componentLotId);
      assert(kitMaterialDestination(state,material.id)===kitMaterialDestination(state,lot.materialId)&&kitMaterialDestination(state,material.id)!==kitMaterialDestination(state,kitLot.materialId),'kit_invalid_relation');
      assert(lot.sourceKitLotId===opening.kitLotId&&lot.kitOpeningId===opening.id&&!lots.has(lot.id),'kit_invalid_relation');lots.add(lot.id);
      assert(row.quantity===null?row.confidence==='unknown':['exact','estimated'].includes(row.confidence),'kit_invalid_confidence');
      const receipt=receipts.get(lot.id);
      assert(receipt&&receipt.kitOpeningId===opening.id&&receipt.quantity===row.quantity&&receipt.cost===null&&kitMaterialDestination(state,receipt.materialId)===kitMaterialDestination(state,row.actualMaterialId),'kit_invalid_relation');
      assert(receipt.before===0 && receipt.after===row.quantity,'kit_invalid_relation');
    }else assert(row.componentLotId===null&&row.actualMaterialId===null&&row.quantity===null&&row.confidence==='unknown','kit_pending_has_no_stock');
  }
  assert(opening.componentLotIds.length===lots.size&&opening.componentLotIds.every(id=>lots.has(id)),'kit_invalid_relation');
}

export function validateKitWorkflows(state) {
  if (state.kitLibrary !== undefined) {
    exactKeys(state.kitLibrary, ['version','plans']); assert(state.kitLibrary.version === 1, 'kit_unsupported_version');
    assert(Array.isArray(state.kitLibrary.plans) && state.kitLibrary.plans.length <= LIMIT, 'kit_plan_limit'); const ids = new Set(), physical = new Set();
    for (const record of state.kitLibrary.plans) { validatePlan(state,record); assert(!ids.has(record.id), 'duplicate_id'); ids.add(record.id); if (record.kind === 'physical' && !record.archived) { assert(!physical.has(record.materialId), 'kit_duplicate_definition'); physical.add(record.materialId); } }
  }
  const verified=state.kitOpenings.filter(opening=>opening.verification!==undefined),ids=new Set(verified.map(opening=>opening.id)),receipts=new Map(),events=new Map();
  if(verified.length)for(const move of state.movements)if(ids.has(move.kitOpeningId)){
    if(move.kind==='kit_component'){assert(!receipts.has(move.lotId),'kit_invalid_relation');receipts.set(move.lotId,move)}
    if(move.kind==='kit_open'){assert(!events.has(move.kitOpeningId),'kit_invalid_relation');events.set(move.kitOpeningId,move)}
  }
  for (const opening of verified) validateOpening(state,opening,receipts,events);
  return state;
}

/** Active plans follow catalogue merges; opening snapshots keep their original identities. */
export function afterKitCommand(state, command, ctx) {
  if (command.type !== 'material.merge') return;
  const {sourceId,targetId} = command.payload;
  const source = find(state,'materials',sourceId), target = find(state,'materials',targetId);
  for (const record of kitPlans(state).filter(row=>!row.archived)) {
    let changed = false;
    if (record.materialId === sourceId) { record.materialId = targetId; changed = true; }
    for (const row of record.components) {
      if (row.materialId === sourceId) { row.materialId = targetId; if(row.label === source.name)row.label = target.name; changed = true; }
      if (row.substituteMaterialId === sourceId) { row.substituteMaterialId = targetId; changed = true; }
      if (row.substituteMaterialId === row.materialId) row.substituteMaterialId = null;
    }
    if (changed) { record.revision++; record.updatedAt = ctx.now; audit(state,ctx,'kit_plan',record.id,'material_merged',{sourceId,targetId}); }
  }
}

export const kitWorkflowHandlers = { 'kit.plan.save': savePlan, 'kit.plan.archive': archivePlan, 'kit.plan.apply': applyPlan, 'kit.openVerified': openVerified, 'kit.opening.verify': reconcileOpening };
