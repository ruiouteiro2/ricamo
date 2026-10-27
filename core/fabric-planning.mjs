import {validateFabricGeometry,fabricGeometryKnown,fabricRectangleClear,childFabricGeometry,fabricPlacement} from './fabric-geometry.mjs';
import { add, subtract, assert, quantity, integer, text, identifier, oneOf, find, activeProject, optionalRef, totalReserved, movement, audit, stableStringify } from './shared.mjs';
import { cutFabric, fabricSize } from './fabric.mjs';
import { activeFabricRegions, fabricHeldPieces } from './fabric-state.mjs';
export { activeFabricRegions, fabricHeldPieces } from './fabric-state.mjs';

export const FABRIC_PLAN_VERSION = 'rect-cm-1';
const LIMIT_CM = 30000, MAX_REGIONS = 100;
const SIDES = ['left', 'right', 'top', 'bottom'];
const REMNANTS = ['top', 'bottom', 'left', 'right'];
const FACTORS = { mm: .1, cm: 1, m: 100, in: 2.54 };
const closed = project => ['completed', 'archived'].includes(project.status);
const clone = value => structuredClone(value);
const cm = (value, field, positive = false) => { const n = quantity(value, { field, positive }); assert(n <= LIMIT_CM, 'fabric_dimension_limit', { field, limit: LIMIT_CM }); return n; };
const scaled = value => BigInt(Math.round(value * 1e6));
const areaUnits = r => scaled(r.widthCm) * scaled(r.heightCm);
const area = r => Number(areaUnits(r)) / 1e12;
const same = (a, b) => stableStringify(a) === stableStringify(b);
const margins = value => Object.fromEntries(SIDES.map(side => [side, cm(value?.[side] ?? 0, side)]));
const boundary = lot => {
  const p = lot.properties, m = margins(p.usableMargins);
  const widthCm = cm(p.widthCm, 'widthCm', true), heightCm = cm(p.heightCm, 'heightCm', true);
  assert(add(m.left, m.right) < widthCm && add(m.top, m.bottom) < heightCm, 'fabric_margins_exceed_piece');
  return { widthCm, heightCm, margins: m, usable: { xCm: m.left, yCm: m.top, widthCm: subtract(widthCm, add(m.left, m.right)), heightCm: subtract(heightCm, add(m.top, m.bottom)) } };
};
export function toCentimetres(value, unit = 'cm') { oneOf(unit, Object.keys(FACTORS), 'unit'); return cm(quantity(value) * FACTORS[unit], 'dimension'); }
export function rectanglesOverlap(a, b) { return a.xCm < add(b.xCm, b.widthCm) && b.xCm < add(a.xCm, a.widthCm) && a.yCm < add(b.yCm, b.heightCm) && b.yCm < add(a.yCm, a.heightCm); }
const contains = (outer, inner) => inner.xCm >= outer.xCm && inner.yCm >= outer.yCm && add(inner.xCm, inner.widthCm) <= add(outer.xCm, outer.widthCm) && add(inner.yCm, inner.heightCm) <= add(outer.yCm, outer.heightCm);
function rectangle(p) {
  const unit = p.unit ?? 'cm';
  const xCm = toCentimetres(p.x ?? p.xCm ?? 0, unit), yCm = toCentimetres(p.y ?? p.yCm ?? 0, unit);
  let widthCm = toCentimetres(p.width ?? p.widthCm, unit), heightCm = toCentimetres(p.height ?? p.heightCm, unit);
  assert(widthCm > 0 && heightCm > 0, 'quantity_positive');
  if (p.rotated === true) [widthCm, heightCm] = [heightCm, widthCm];
  return { xCm, yCm, widthCm, heightCm };
}
function piece(state, id, available = true) {
  const lot = find(state, 'lots', id), material = find(state, 'materials', lot.materialId);
  assert(material.category === 'fabric' && lot.unit === 'piece', 'not_fabric_piece');
  if (available) assert(lot.quantity === 1 && lot.status === 'usable' && !material.archived, 'fabric_piece_unavailable');
  return lot;
}
function ensurePlan(lot) { return lot.fabricPlan ??= { schemaVersion: 1, geometryVersion: FABRIC_PLAN_VERSION, regions: [] }; }

/** Pure simulation. The source and requested rectangle are never mutated. */
export function previewFabricCut(lot, input) {
  const bounds = boundary(lot), requested = rectangle(input);
  assert(contains({ xCm: 0, yCm: 0, ...bounds }, requested), 'cut_outside_fabric');
  assert(contains(bounds.usable,requested),'fabric_region_outside_usable');
  assert(fabricRectangleClear(lot,requested),'fabric_geometry_collision');
  const { xCm: x, yCm: y, widthCm: w, heightCm: h } = requested;
  const rectangles = [
    { key: 'cut', role: 'cut', ...requested },
    { key: 'top', role: 'remnant', xCm: 0, yCm: 0, widthCm: bounds.widthCm, heightCm: y },
    { key: 'bottom', role: 'remnant', xCm: 0, yCm: add(y, h), widthCm: bounds.widthCm, heightCm: subtract(bounds.heightCm, add(y, h)) },
    { key: 'left', role: 'remnant', xCm: 0, yCm: y, widthCm: x, heightCm: h },
    { key: 'right', role: 'remnant', xCm: add(x, w), yCm: y, widthCm: subtract(bounds.widthCm, add(x, w)), heightCm: h },
  ].filter(r => r.widthCm > 0 && r.heightCm > 0);
  const discard = input.discardRemnants ?? [];
  assert(Array.isArray(discard) && discard.length <= 4 && new Set(discard).size === discard.length && discard.every(key => REMNANTS.includes(key) && rectangles.some(r => r.key === key)), 'fabric_invalid_waste');
  const totalUnits = areaUnits(bounds);
  assert(rectangles.reduce((sum, r) => sum + areaUnits(r), 0n) === totalUnits, 'fabric_area_mismatch');
  const wasteUnits = rectangles.filter(r => discard.includes(r.key)).reduce((sum, r) => sum + areaUnits(r), 0n);
  return { version: FABRIC_PLAN_VERSION, ...bounds, requested, rectangles: rectangles.map(r => ({ ...r, waste: discard.includes(r.key), areaCm2: area(r) })), totalAreaCm2: area(bounds), wasteCm2: quantity(Number(wasteUnits) / 1e12), areaUnits: String(totalUnits), manualGeometry: lot.properties.irregular === true, defectsDescriptive: Boolean(lot.properties.defects) };
}

/** Uses the actual piece's count; project margins/over-thread settings remain explicit. */
export function fabricProjectFit(lot, design, settings = {}) {
  try {
    const bounds = boundary(lot), p = lot.properties;
    if (p.countX == null || p.countY == null) return { fits: null, reason: 'fabric_count_unknown' };
    const candidates = [false, true].map(rotated => {
      const m = margins(settings.margins);
      const rotatedMargins = rotated ? { left: m.bottom, right: m.top, top: m.left, bottom: m.right } : m;
      const size = fabricSize({ width: rotated ? design.height : design.width, height: rotated ? design.width : design.height, countX: p.countX, countY: p.countY, countMeaning: p.countMeaning ?? 'stitches', overX: settings.overX ?? 1, overY: settings.overY ?? 1, margins: rotatedMargins });
      return { rotated, ...size, fits: size.cutWidthCm <= bounds.usable.widthCm && size.cutHeightCm <= bounds.usable.heightCm };
    });
    if(p.geometry||activeFabricRegions(lot).length){for(const candidate of candidates)if(candidate.fits)candidate.position=fabricPlacement(lot,candidate.cutWidthCm,candidate.cutHeightCm,bounds.usable);const match=candidates.find(c=>c.position)??candidates.find(c=>c.fits)??candidates[0],known=fabricGeometryKnown(lot);return{...match,fits:known&&match.position?true:candidates.every(c=>!c.fits)?false:null,boundingFits:match.fits,reason:!known?'fabric_manual_geometry':match.position?null:'fabric_geometry_place_manually',candidates,usable:bounds.usable};}
    const match = candidates.find(c => c.fits) ?? candidates[0];
    const manual = p.irregular === true || Boolean(p.defects) || p.unusableBorder === true;
    return { ...match, fits: manual ? null : match.fits, boundingFits: match.fits, reason: manual ? 'fabric_manual_geometry' : match.fits ? null : 'dimensions_too_small', candidates, usable: bounds.usable };
  } catch (error) { return { fits: null, reason: error.code ?? 'missing_dimensions' }; }
}

export function saveFabricPlan(state, p, ctx) {
  const lot = piece(state, p.lotId), current = lot.properties;
  assert(!activeFabricRegions(lot).length, 'fabric_regions_active');
  const unit = p.unit ?? 'cm', optionalCount = (value, field) => value == null || value === '' ? null : quantity(value, { positive: true, field });
  const properties = { ...current,
    widthCm: p.width === undefined ? current.widthCm : toCentimetres(p.width, unit), heightCm: p.height === undefined ? current.heightCm : toCentimetres(p.height, unit),
    countX: optionalCount('countX' in p ? p.countX : current.countX, 'countX'), countY: optionalCount('countY' in p ? p.countY : current.countY, 'countY'),
    countMeaning: oneOf(p.countMeaning ?? current.countMeaning ?? 'stitches', ['stitches', 'threads'], 'countMeaning'),
    usableMargins: p.usableMargins ? Object.fromEntries(SIDES.map(side => [side, toCentimetres(p.usableMargins[side] ?? 0, unit)])) : margins(current.usableMargins),
    irregular: p.irregular ?? current.irregular ?? false,
    defects: text(p.defects ?? current.defects, 'defects', { max: 4000 }), geometryNotes: text(p.geometryNotes ?? current.geometryNotes, 'geometryNotes', { max: 4000 }),
    washState: oneOf(p.washState ?? current.washState ?? 'unknown', ['unknown', 'unwashed', 'prewashed'], 'washState'),
  };
  assert(typeof properties.irregular === 'boolean', 'invalid_boolean');
  if(p.geometry!==undefined){if(p.geometry===null)delete properties.geometry;else properties.geometry=clone(p.geometry);}
  validateFabricGeometry(properties);
  boundary({ properties });
  lot.properties = properties; ensurePlan(lot); lot.updatedAt = ctx.now;
  audit(state, ctx, 'lot', lot.id, 'fabric_metadata');
}
export function reserveFabricRegion(state, p, ctx) {
  const lot = piece(state, p.lotId), project = activeProject(state, p.projectId), bounds = boundary(lot), plan = ensurePlan(lot);
  assert(totalReserved(state, lot.id) === 0, 'fabric_whole_piece_reserved');
  const existing = p.id ? plan.regions.find(r => r.id === p.id) : null;
  if (p.id) assert(existing && existing.projectId === project.id && existing.status === 'active', 'fabric_region_owner');
  assert(existing || plan.regions.length < MAX_REGIONS, 'fabric_region_limit');
  const rect = rectangle(p);
  assert(contains(bounds.usable, rect), 'fabric_region_outside_usable');
  assert(fabricRectangleClear(lot,rect),'fabric_geometry_collision');
  assert(!activeFabricRegions(lot).some(r => r.id !== existing?.id && rectanglesOverlap(r, rect)), 'fabric_region_overlap');
  const manual = !fabricGeometryKnown(lot);
  assert(!manual || p.manualConfirmed === true, 'fabric_manual_confirmation');
  const row = { id: existing?.id ?? identifier(ctx.id()), projectId: project.id, ...rect, rotated: p.rotated === true, status: 'active', manualConfirmed: p.manualConfirmed === true, notes: text(p.notes, 'notes', { max: 2000 }), createdAt: existing?.createdAt ?? ctx.now, updatedAt: ctx.now, operationId: ctx.operationId };
  if (existing) Object.assign(existing, row); else plan.regions.push(row);
  lot.updatedAt = ctx.now; audit(state, ctx, 'fabric_region', row.id, existing ? 'updated' : 'reserved', { lotId: lot.id, projectId: project.id });
}
export function releaseFabricRegion(state, p, ctx) {
  const lot = piece(state, p.lotId, false), row = lot.fabricPlan?.regions.find(r => r.id === p.id);
  assert(row && row.projectId === p.projectId, 'fabric_region_owner');
  assert(row.status === 'active', 'fabric_region_inactive');
  row.status = 'released'; row.updatedAt = ctx.now; row.releaseReason = text(p.reason, 'reason');
  lot.updatedAt = ctx.now; audit(state, ctx, 'fabric_region', row.id, 'released', { lotId: lot.id, projectId: row.projectId });
}

export function cutPlannedFabric(state, p, ctx) {
  const lot = piece(state, p.lotId), regions = activeFabricRegions(lot);
  const selected = p.regionId ? regions.find(r => r.id === p.regionId) : null;
  assert(!p.regionId || selected, 'fabric_region_inactive');
  assert(regions.length === (selected ? 1 : 0), 'fabric_other_regions');
  if (selected && (p.width !== undefined || p.widthCm !== undefined)) assert(same(rectangle(p), { xCm: selected.xCm, yCm: selected.yCm, widthCm: selected.widthCm, heightCm: selected.heightCm }), 'fabric_region_changed');
  const projectId = selected?.projectId ?? optionalRef(state, 'projects', p.projectId);
  if (selected && p.projectId) assert(projectId === p.projectId, 'fabric_region_owner');
  if (projectId) activeProject(state, projectId);
  assert(!lot.properties.irregular&&!lot.properties.geometry?.outline, 'manual_geometry');
  assert(fabricGeometryKnown(lot) || p.manualConfirmed === true, 'fabric_manual_confirmation');
  const input = selected ? { ...selected, unit: 'cm', rotated: false, discardRemnants: p.discardRemnants } : p;
  const preview = previewFabricCut(lot, input), before = clone(lot);
  const project = projectId ? find(state, 'projects', projectId) : null;
  const projectBefore = project?.fabricLotId ?? null;
  if (selected) { selected.status = 'cut'; selected.updatedAt = ctx.now; }
  const index = state.cuts.length;
  cutFabric(state, { lotId: lot.id, ...preview.requested, projectId, reason: p.reason }, ctx);
  const cut = state.cuts[index];
  let wasteCost = lot.cost === null ? null : 0;
  for (let i = 0; i < cut.pieceIds.length; i++) {
    const child = find(state, 'lots', cut.pieceIds[i]), rect = preview.rectangles[i];
    delete child.fabricPlan;
    if(before.properties.geometry)child.properties.geometry=childFabricGeometry(before,rect);
    child.properties.usableMargins = { left: Math.max(0, subtract(preview.margins.left, rect.xCm)), right: Math.max(0, subtract(add(rect.xCm, rect.widthCm), subtract(preview.widthCm, preview.margins.right))), top: Math.max(0, subtract(preview.margins.top, rect.yCm)), bottom: Math.max(0, subtract(add(rect.yCm, rect.heightCm), subtract(preview.heightCm, preview.margins.bottom))) };
    // Remnants entirely inside unusable border remain real pieces, with an explicit warning.
    if (add(child.properties.usableMargins.left, child.properties.usableMargins.right) >= rect.widthCm || add(child.properties.usableMargins.top, child.properties.usableMargins.bottom) >= rect.heightCm) { child.properties.usableMargins = margins(); child.properties.unusableBorder = true; }
    if (rect.waste) {
      const cost = child.cost; if (cost !== null) wasteCost += cost;
      child.quantity = 0; child.status = 'transformed'; child.cost = cost === null ? null : 0; child.properties.cutRole = 'waste';
      movement(state, ctx, { kind: 'cut_waste', lotId: child.id, materialId: child.materialId, quantity: 1, unit: 'piece', before: 1, after: 0, cutId: cut.id, cost, currency: child.currency, projectId });
    }
    if (rect.role === 'cut' && project) {
      project.fabricLotId = child.id; project.updatedAt = ctx.now;
      if (!state.reservations.some(r => r.lotId === child.id && r.projectId === project.id && r.quantity > 0)) state.reservations.push({ id: ctx.id(), projectId: project.id, materialId: child.materialId, lotId: child.id, quantity: 1, unit: 'piece', createdAt: ctx.now, updatedAt: ctx.now });
    }
  }
  if (selected) selected.cutId = cut.id;
  cut.wasteCm2 = preview.wasteCm2;
  cut.planning = { version: FABRIC_PLAN_VERSION, sourceBefore: before, sourceAfter: clone(lot), outputs: cut.pieceIds.map(id => clone(find(state, 'lots', id))), rectangles: preview.rectangles, areaUnits: preview.areaUnits, wasteCost, regionId: selected?.id ?? null, projectId, projectBefore, projectAfter: project?.fabricLotId ?? null };
  audit(state, ctx, 'fabric_cut', cut.id, 'cut', { sourceLotId: lot.id, pieceIds: cut.pieceIds, wasteCm2: cut.wasteCm2, wasteCost });
}

/** Read-only dependency report; no timestamps alone are trusted for undo eligibility. */
export function fabricCutDependencies(state, cutId) {
  const cut = find(state, 'cuts', cutId), plan = cut.planning, blockers = [];
  const block = (code, lotId = null) => blockers.push({ code, lotId });
  if (!plan || plan.version !== FABRIC_PLAN_VERSION) return [{ code: 'fabric_undo_legacy' }];
  if (cut.reversed) return [{ code: 'fabric_cut_already_reversed' }];
  const source = find(state, 'lots', cut.sourceLotId);
  if (!same(source, plan.sourceAfter)) block('fabric_undo_source_changed', source.id);
  for (const expected of plan.outputs) {
    const lot = find(state, 'lots', expected.id);
    if (!same(lot, expected)) block('fabric_undo_piece_changed', lot.id);
    if (state.movements.some(m => (m.lotId === lot.id || m.destinationLotId === lot.id) && m.operationId !== cut.operationId)) block('fabric_undo_moved', lot.id);
    if (state.audit.some(a => a.entity === 'lot' && a.entityId === lot.id && a.operationId !== cut.operationId)) block('fabric_undo_piece_changed', lot.id);
    if (totalReserved(state, lot.id) > 0 || activeFabricRegions(lot).length) block('fabric_undo_reserved', lot.id);
    if (state.cuts.some(c => c.sourceLotId === lot.id)) block('fabric_undo_downstream', lot.id);
    if (state.projects.some(p => p.fabricLotId === lot.id && (p.id !== plan.projectId || lot.id !== plan.projectAfter))) block('fabric_undo_linked', lot.id);
    if ((state.loans ?? []).some(l => l.lotId === lot.id)) block('fabric_undo_loaned', lot.id);
  }
  return blockers;
}
export function reverseFabricCut(state, p, ctx) {
  const cut = find(state, 'cuts', p.cutId), blockers = fabricCutDependencies(state, cut.id);
  assert(!blockers.length, 'fabric_undo_blocked', { blockers });
  const reason = text(p.reason, 'reason', { required: true }), plan = cut.planning, source = find(state, 'lots', cut.sourceLotId);
  Object.assign(source, clone(plan.sourceBefore), { updatedAt: ctx.now });
  // Undo is physical correction, not an implicit renewal of released project reservations.
  for (const region of activeFabricRegions(source)) { region.status = 'released'; region.updatedAt = ctx.now; region.releaseReason = 'fabric_cut_reversed'; }
  for (const id of cut.pieceIds) {
    const lot = find(state, 'lots', id), before = lot.quantity, cost = lot.cost;
    lot.quantity = 0; lot.status = 'transformed'; lot.cost = cost === null ? null : 0; lot.updatedAt = ctx.now; lot.reversedCutId = cut.id;
    movement(state, ctx, { kind: 'cut_undo_piece', lotId: id, materialId: lot.materialId, quantity: before, unit: lot.unit, before, after: 0, cutId: cut.id, cost, currency: lot.currency, reason });
  }
  if (plan.projectId) {
    const project = find(state, 'projects', plan.projectId);
    if (project.fabricLotId === plan.projectAfter) { project.fabricLotId = plan.projectBefore; project.updatedAt = ctx.now; }
  }
  movement(state, ctx, { kind: 'cut_undo_source', lotId: source.id, materialId: source.materialId, quantity: 1, unit: 'piece', before: 0, after: 1, cutId: cut.id, cost: source.cost, currency: source.currency, reason });
  cut.reversed = { date: ctx.now, operationId: ctx.operationId, reason };
  audit(state, ctx, 'fabric_cut', cut.id, 'reversed', { sourceLotId: source.id, pieceIds: cut.pieceIds });
}

/** Call from applyCommand AFTER idempotency lookup, BEFORE invoking any handler. */
export function guardFabricCommand(state, command) {
  const p = command.payload ?? {}, type = command.type;
  const id = type === 'lot.save' ? p.id : type === 'stock.reverse' ? state.movements.find(m => m.id === p.movementId)?.lotId : p.lotId;
  const lot = state.lots.find(row => row.id === id);
  if (type === 'fabric.cut' && (lot?.fabricPlan || lot?.properties.geometry || lot?.properties.unusableBorder || lot?.properties.defects || Object.values(lot?.properties.usableMargins??{}).some(value=>Number(value)>0))) assert(false, 'fabric_use_planner');
  if (lot && activeFabricRegions(lot).length) {
    if (['stock.move', 'stock.reverse', 'fabric.cut', 'lot.save'].includes(type) || type === 'reservation.set' && quantity(p.quantity) > 0) assert(false, 'fabric_regions_active');
  }
  if (type === 'lot.save' && lot?.status === 'transformed' && state.materials.find(m => m.id === lot.materialId)?.category === 'fabric') assert(false, 'lot_transformed');
  if (type === 'project.save' && ['completed', 'archived'].includes(p.status) && state.lots.some(l => activeFabricRegions(l).some(r => r.projectId === p.id))) assert(false, 'close_project_first');
}
/** Call after the normal handler, within the same cloned transaction/context. */
export function afterFabricCommand(state, command, ctx) {
  if (command.type !== 'project.close') return;
  const projectId = command.payload.projectId ?? command.payload.id;
  for (const lot of state.lots) for (const region of activeFabricRegions(lot).filter(r => r.projectId === projectId)) {
    region.status = 'released'; region.updatedAt = ctx.now; region.releaseReason = 'project_closed'; lot.updatedAt = ctx.now;
    audit(state, ctx, 'fabric_region', region.id, 'released_on_close', { lotId: lot.id, projectId });
  }
}
export const fabricPlanningHandlers = Object.freeze({ 'fabric.plan.save': saveFabricPlan, 'fabric.region.reserve': reserveFabricRegion, 'fabric.region.release': releaseFabricRegion, 'fabric.plan.cut': cutPlannedFabric, 'fabric.cut.reverse': reverseFabricCut });

/** Also invoke on backup/import activation, after base references/schema validation. */
export function validateFabricPlanning(state) {
  const regionIds = new Set();
  for (const lot of state.lots) {
    if (state.materials.find(m => m.id === lot.materialId)?.category === 'fabric') {
      const props = lot.properties; validateFabricGeometry(props);
      for (const key of ['widthCm', 'heightCm']) if (props[key] != null) assert(typeof props[key] === 'number' && cm(props[key], key, true) === props[key], 'invalid_precision');
      for (const key of ['countX', 'countY']) if (props[key] != null) assert(typeof props[key] === 'number' && quantity(props[key], { positive: true }) === props[key], 'invalid_precision');
      if (props.countMeaning !== undefined) oneOf(props.countMeaning, ['stitches', 'threads'], 'countMeaning');
      if (props.washState !== undefined) oneOf(props.washState, ['unknown', 'unwashed', 'prewashed'], 'washState');
      for(const key of ['irregular','unusableBorder'])if(props[key]!==undefined)assert(typeof props[key]==='boolean','invalid_boolean');
      if(props.usableMargins!==undefined){margins(props.usableMargins);for(const key of ['left','right','top','bottom'])if(props.usableMargins[key]!==undefined)assert(typeof props.usableMargins[key]==='number'&&cm(props.usableMargins[key],key)===props.usableMargins[key],'invalid_precision');}
      text(props.defects, 'defects', { max: 4000 }); text(props.geometryNotes, 'geometryNotes', { max: 4000 });
    }
    if (!lot.fabricPlan) continue;
    const plan = lot.fabricPlan;
    piece(state, lot.id, false);
    assert(plan.schemaVersion === 1 && plan.geometryVersion === FABRIC_PLAN_VERSION, 'fabric_plan_version');
    assert(Array.isArray(plan.regions) && plan.regions.length <= MAX_REGIONS, 'fabric_region_limit');
    const active = activeFabricRegions(lot), bounds = active.length ? boundary(lot) : null;
    if (active.length) { assert(lot.quantity === 1 && lot.status === 'usable', 'fabric_piece_unavailable'); assert(totalReserved(state, lot.id) === 0, 'fabric_whole_piece_reserved'); }
    for (const region of plan.regions) {
      identifier(region.id); assert(!regionIds.has(region.id), 'duplicate_id'); regionIds.add(region.id);
      const project = find(state, 'projects', region.projectId);
      oneOf(region.status, ['active', 'released', 'cut'], 'status');
      for (const key of ['xCm', 'yCm', 'widthCm', 'heightCm']) assert(typeof region[key] === 'number' && cm(region[key], key, key === 'widthCm' || key === 'heightCm') === region[key], 'invalid_precision');
      assert(typeof region.rotated === 'boolean' && typeof region.manualConfirmed === 'boolean', 'invalid_boolean'); text(region.notes, 'notes', { max: 2000 });
      identifier(region.operationId);
      if (region.cutId) find(state, 'cuts', region.cutId);
      if (region.status === 'active') { assert(!closed(project), 'project_closed'); assert(contains(bounds.usable, region), 'fabric_region_outside_usable'); assert(fabricRectangleClear(lot,region),'fabric_geometry_collision'); assert(fabricGeometryKnown(lot) || region.manualConfirmed, 'fabric_manual_confirmation'); }
    }
    for (let i = 0; i < active.length; i++) for (let j = i + 1; j < active.length; j++) assert(!rectanglesOverlap(active[i], active[j]), 'fabric_region_overlap');
  }
  for (const cut of state.cuts.filter(c => c.planning)) {
    const p = cut.planning;
    assert(p && p.sourceBefore?.properties && p.sourceAfter?.properties && Array.isArray(p.outputs) && Array.isArray(p.rectangles), 'fabric_invalid_receipt');
    assert(p.sourceBefore.unit === 'piece' && p.sourceBefore.status === 'usable' && p.sourceAfter.status === 'transformed' && p.sourceAfter.materialId === p.sourceBefore.materialId, 'fabric_invalid_receipt');
    find(state, 'materials', p.sourceBefore.materialId);
    for(const snapshot of [p.sourceBefore,p.sourceAfter,...p.outputs])validateFabricGeometry(snapshot.properties);
    assert(same(p.sourceBefore.properties.geometry??null,p.sourceAfter.properties.geometry??null),'fabric_invalid_receipt');
    assert(p.sourceAfter.cost === (p.sourceBefore.cost === null ? null : 0), 'fabric_cost_mismatch');
    assert(p.rectangles.length > 0 && p.rectangles[0].role === 'cut' && !p.rectangles[0].waste && p.rectangles.filter(r => r.role === 'cut').length === 1, 'fabric_invalid_receipt');
    for (const r of p.rectangles) {
      for (const key of ['xCm', 'yCm', 'widthCm', 'heightCm']) assert(typeof r[key] === 'number' && cm(r[key], key, key === 'widthCm' || key === 'heightCm') === r[key], 'invalid_precision');
      assert(typeof r.waste === 'boolean', 'fabric_invalid_receipt');
    }
    assert(p.version === FABRIC_PLAN_VERSION && p.sourceBefore.id === cut.sourceLotId && p.sourceAfter.id === cut.sourceLotId, 'fabric_invalid_receipt');
    assert(p.sourceBefore.quantity === 1 && p.sourceAfter.quantity === 0, 'fabric_invalid_receipt');
    assert(p.outputs.length === cut.pieceIds.length && p.rectangles.length === cut.pieceIds.length && p.outputs.length <= 5, 'fabric_invalid_receipt');
    const original = { widthCm: cm(cut.originalWidthCm, 'widthCm', true), heightCm: cm(cut.originalHeightCm, 'heightCm', true) };
    assert(p.sourceBefore.properties.widthCm === original.widthCm && p.sourceBefore.properties.heightCm === original.heightCm, 'fabric_invalid_receipt');
    assert(String(areaUnits(original)) === p.areaUnits, 'fabric_area_mismatch');
    assert(p.rectangles.reduce((sum, r) => sum + areaUnits(r), 0n) === areaUnits(original), 'fabric_area_mismatch');
    let outputCost = 0, unknownCost = false, wasteUnits = 0n;
    for (let i = 0; i < p.outputs.length; i++) {
      const out = p.outputs[i], r = p.rectangles[i];
      assert(same(out.properties.geometry??null,childFabricGeometry(p.sourceBefore,r)??null),'fabric_invalid_receipt');
      assert(out.materialId === p.sourceBefore.materialId && out.unit === 'piece' && out.properties.cutRole === (r.waste ? 'waste' : r.role), 'fabric_invalid_receipt');
      assert(out.id === cut.pieceIds[i] && out.sourceLotId === cut.sourceLotId && out.cutId === cut.id, 'fabric_invalid_receipt');
      assert(out.properties.widthCm === r.widthCm && out.properties.heightCm === r.heightCm, 'fabric_invalid_receipt');
      assert(contains({ xCm: 0, yCm: 0, ...original }, r), 'fabric_area_mismatch');
      for (let j = i + 1; j < p.rectangles.length; j++) assert(!rectanglesOverlap(r, p.rectangles[j]), 'fabric_area_mismatch');
      assert(out.quantity === (r.waste ? 0 : 1), 'fabric_invalid_receipt');
      if (out.cost === null) unknownCost = true; else outputCost += integer(out.cost, 'cost');
      if (r.waste) wasteUnits += areaUnits(r);
      assert(state.movements.some(m => m.lotId === out.id && m.cutId === cut.id && m.kind === 'cut_piece' && m.operationId === cut.operationId), 'fabric_invalid_receipt');
    }
    assert(quantity(Number(wasteUnits) / 1e12) === cut.wasteCm2, 'fabric_area_mismatch');
    if (p.sourceBefore.cost === null) assert(unknownCost && p.wasteCost === null, 'fabric_cost_mismatch');
    else assert(!unknownCost && outputCost + integer(p.wasteCost, 'wasteCost') === integer(p.sourceBefore.cost, 'cost'), 'fabric_cost_mismatch');
    if (p.projectId) { find(state, 'projects', p.projectId); assert(p.projectAfter === cut.pieceIds[0], 'fabric_invalid_receipt'); }
    if (p.projectBefore) find(state, 'lots', p.projectBefore);
    if (cut.reversed) { identifier(cut.reversed.operationId); text(cut.reversed.reason, 'reason', { required: true }); }
  }
  return state;
}
