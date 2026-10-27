import { add, subtract, assert, quantity, integer, text, find, optionalRef, movement, totalReserved, audit } from './shared.mjs';
import { addLot } from './inventory.mjs';

/** Count is stitches or fabric threads per inch; over applies only to thread counts. */
export function fabricSize({ width, height, countX, countY = countX, countMeaning = 'stitches', overX = 1, overY = overX, margins = {} }) {
  const w = integer(width, 'width', { min: 1, max: 100000 }), h = integer(height, 'height', { min: 1, max: 100000 });
  const cx = quantity(countX, { positive: true, field: 'countX' }), cy = quantity(countY, { positive: true, field: 'countY' });
  assert(['stitches', 'threads'].includes(countMeaning), 'invalid_count_meaning');
  const ox = integer(overX, 'overX', { min: 1, max: 1000 }), oy = integer(overY, 'overY', { min: 1, max: 1000 });
  const effectiveX = countMeaning === 'threads' ? cx / ox : cx, effectiveY = countMeaning === 'threads' ? cy / oy : cy;
  const widthCm = w / effectiveX * 2.54, heightCm = h / effectiveY * 2.54;
  const normalizedMargins = Object.fromEntries(['left', 'right', 'top', 'bottom'].map(key => [key, quantity(margins[key] ?? 0, { field: `margins.${key}` })]));
  return { widthCm, heightCm, effectiveX, effectiveY, margins: normalizedMargins, cutWidthCm: widthCm + normalizedMargins.left + normalizedMargins.right, cutHeightCm: heightCm + normalizedMargins.top + normalizedMargins.bottom };
}

export function fabricFit({ widthCm, heightCm, requiredWidthCm, requiredHeightCm, allowRotate = true, irregular = false }) {
  if (irregular || [widthCm, heightCm, requiredWidthCm, requiredHeightCm].some(v => v === null || v === undefined || v === '')) return { fits: null, rotated: null, reason: irregular ? 'manual_geometry' : 'missing_dimensions' };
  const w = quantity(widthCm, { positive: true }), h = quantity(heightCm, { positive: true }), rw = quantity(requiredWidthCm, { positive: true }), rh = quantity(requiredHeightCm, { positive: true });
  if (w >= rw && h >= rh) return { fits: true, rotated: false, remainingWidthCm: subtract(w, rw), remainingHeightCm: subtract(h, rh) };
  if (allowRotate && w >= rh && h >= rw) return { fits: true, rotated: true, remainingWidthCm: subtract(w, rh), remainingHeightCm: subtract(h, rw) };
  return { fits: false, rotated: false, reason: 'dimensions_too_small' };
}

/** Split a single rectangular piece into the requested cut and nonoverlapping remnants. */
export function cutFabric(state, p, ctx) {
  const source = find(state, 'lots', p.lotId), material = find(state, 'materials', source.materialId);
  assert(material.category === 'fabric' && source.unit === 'piece', 'not_fabric_piece');
  assert(source.status === 'usable' && source.quantity === 1, 'fabric_piece_unavailable');
  assert(!source.properties.irregular, 'manual_geometry');
  const projectId = optionalRef(state, 'projects', p.projectId);
  const own = projectId ? totalReserved(state, source.id, [projectId]) : 0;
  assert(totalReserved(state, source.id) === own, 'fabric_reserved_elsewhere');
  const width = quantity(source.properties.widthCm, { positive: true, field: 'widthCm' }), height = quantity(source.properties.heightCm, { positive: true, field: 'heightCm' });
  const x = quantity(p.xCm ?? 0), y = quantity(p.yCm ?? 0), w = quantity(p.widthCm, { positive: true }), h = quantity(p.heightCm, { positive: true });
  assert(add(x, w) <= width && add(y, h) <= height, 'cut_outside_fabric');
  const rectangles = [
    { role: 'cut', xCm: x, yCm: y, widthCm: w, heightCm: h },
    { role: 'remnant', xCm: 0, yCm: 0, widthCm: width, heightCm: y },
    { role: 'remnant', xCm: 0, yCm: add(y, h), widthCm: width, heightCm: subtract(height, add(y, h)) },
    { role: 'remnant', xCm: 0, yCm: y, widthCm: x, heightCm: h },
    { role: 'remnant', xCm: add(x, w), yCm: y, widthCm: subtract(width, add(x, w)), heightCm: h },
  ].filter(r => r.widthCm > 0 && r.heightCm > 0);
  const cutId = ctx.id(), pieceIds = [], originalCost = source.cost;
  let allocatedCost = 0;
  for (let index = 0; index < rectangles.length; index++) {
    const rectangle = rectangles[index], id = ctx.id();
    // Floor interim allocations, then carry the residual cents to the final piece.
    // Rounding each part independently could produce a negative final allocation.
    const cost = originalCost === null ? null : index === rectangles.length - 1 ? originalCost - allocatedCost : Math.floor(originalCost * rectangle.widthCm * rectangle.heightCm / (width * height));
    if (cost !== null) allocatedCost += cost;
    const child = { ...structuredClone(source), id, quantity: 1, cost, sourceLotId: source.id, cutId, properties: { ...source.properties, widthCm: rectangle.widthCm, heightCm: rectangle.heightCm, cutRole: rectangle.role }, createdAt: ctx.now, updatedAt: ctx.now };
    state.lots.push(child);
    pieceIds.push(id);
    movement(state, ctx, { kind: 'cut_piece', lotId: id, materialId: material.id, quantity: 1, unit: 'piece', before: 0, after: 1, sourceLotId: source.id, cutId, projectId, cost, currency: source.currency });
    if (rectangle.role === 'cut' && own > 0) state.reservations.push({ id: ctx.id(), projectId, materialId: material.id, lotId: id, quantity: 1, unit: 'piece', createdAt: ctx.now, updatedAt: ctx.now });
  }
  for (const reservation of state.reservations.filter(r => r.lotId === source.id)) { reservation.quantity = 0; reservation.updatedAt = ctx.now; }
  source.quantity = 0;
  source.cost = originalCost === null ? null : 0;
  source.status = 'transformed';
  source.updatedAt = ctx.now;
  state.cuts.push({ id: cutId, sourceLotId: source.id, pieceIds, rectangles, originalWidthCm: width, originalHeightCm: height, wasteCm2: 0, date: ctx.now, operationId: ctx.operationId });
  movement(state, ctx, { kind: 'cut_source', lotId: source.id, materialId: material.id, quantity: 1, unit: 'piece', before: 1, after: 0, cutId, projectId, reason: text(p.reason, 'reason') });
}

export function openKit(state, p, ctx) {
  const kitLot = find(state, 'lots', p.lotId), kit = find(state, 'materials', kitLot.materialId);
  assert(kit.category === 'kit' && kit.unit === 'piece', 'not_physical_kit');
  assert(kitLot.status === 'usable' && kitLot.quantity !== null && kitLot.quantity >= 1, 'kit_unavailable');
  assert(totalReserved(state, kitLot.id) <= subtract(kitLot.quantity, 1), 'kit_reserved');
  assert(Array.isArray(p.components) && (p.components.length > 0 || p.confirmEmpty === true) && p.components.length <= 1000, 'invalid_components');
  const originalQuantity = kitLot.quantity;
  const kitCost = kitLot.cost === null ? null : Math.round(kitLot.cost / originalQuantity);
  const openingId = ctx.id(), componentLotIds = [];
  const declaredCosts = p.components.map(component => integer(component.cost, 'component.cost', { nullable: true }));
  const hasCosts = declaredCosts.some(cost => cost !== null);
  if (hasCosts) assert(kitCost !== null && declaredCosts.every(cost => cost !== null) && declaredCosts.reduce((sum, cost) => sum + cost, 0) === kitCost, 'kit_cost_allocation');
  for (let i = 0; i < p.components.length; i++) {
    const component = p.components[i];
    assert(component.materialId !== kit.id, 'kit_contains_itself');
    const lot = addLot(state, { ...component, cost: hasCosts ? declaredCosts[i] : null, currency: kitLot.currency, locationId: component.locationId ?? kitLot.locationId }, ctx);
    lot.sourceKitLotId = kitLot.id;
    lot.kitOpeningId = openingId;
    const createdMovement = state.movements[state.movements.length - 1];
    createdMovement.kind = 'kit_component';
    createdMovement.kitOpeningId = openingId;
    componentLotIds.push(lot.id);
  }
  kitLot.quantity = subtract(originalQuantity, 1);
  if (kitCost !== null) kitLot.cost -= kitCost;
  kitLot.updatedAt = ctx.now;
  movement(state, ctx, { kind: 'kit_open', lotId: kitLot.id, materialId: kit.id, quantity: 1, unit: kit.unit, before: originalQuantity, after: kitLot.quantity, kitOpeningId: openingId });
  state.kitOpenings.push({ id: openingId, kitLotId: kitLot.id, componentLotIds, cost: kitCost, unallocatedCost: hasCosts ? 0 : kitCost, currency: kitLot.currency, date: ctx.now, operationId: ctx.operationId });
  audit(state, ctx, 'kit', kitLot.id, 'opened', { componentLotIds });
}

const packageUnits = ['skein','spool','pack','ball','cone'];
const lengthUnits = {mm:.001,cm:.01,m:1};
const positiveNumber = value => typeof value === 'number' && Number.isFinite(value) && value > 0;
const supplierProduct = material => material?.product ?? material?.properties?.product;
/** Physical separability is distinct from the number of filaments used in a stitch. */
function separableFilaments(material) {
  const pack=supplierProduct(material)?.pack;
  if(pack){
    if(pack.divisible===false)return 1;
    if(pack.divisible===true && Number.isInteger(pack.strands) && pack.strands>0)return pack.strands;
    return null;
  }
  // Legacy `material.strands` is an explicitly entered filament conversion, not inferred from a brand.
  return positiveNumber(material?.strands)?material.strands:null;
}
function measurementFactor(unit,material,dimension) {
  const product=supplierProduct(material),pack=product?.pack;
  if(dimension==='thread'){
    if(unit==='strand-m')return 1;
    const filaments=separableFilaments(material);
    if(lengthUnits[unit])return filaments===null?null:lengthUnits[unit]*filaments;
    if(['g','kg'].includes(unit)&&positiveNumber(pack?.weightG)&&positiveNumber(pack?.lengthM)&&filaments!==null)return (unit==='kg'?1000:1)*pack.lengthM*filaments/pack.weightG;
    if(pack?.unit===unit && positiveNumber(pack.lengthM) && filaments!==null)return pack.lengthM*filaments;
  }else{
    if(unit==='piece')return 1;
    if(pack?.unit===unit && Number.isInteger(pack.pieces) && pack.pieces>0)return pack.pieces;
  }
  if(packageUnits.includes(unit) && material?.unit!==unit && positiveNumber(material?.packageSize)){
    const base=measurementFactor(material.unit,{...material,packageSize:null},dimension);
    return base===null?null:base*material.packageSize;
  }
  return null;
}
/** Exact declared package content; decorative plies and approximate bead counts are not conversion facts. */
export function productPackageCapacity(product,measurementUnit) {
  if(!product?.pack?.unit || !['strand-m','piece'].includes(measurementUnit))return null;
  return measurementFactor(product.pack.unit,{unit:product.pack.unit,product},measurementUnit==='strand-m'?'thread':'piece');
}
export function convertQuantity(value, from, to, material={}) {
  const amount = quantity(value, { nullable: true });
  if (amount === null) return null;
  if (from === to) return amount;
  const weight = { g: 1, kg: 1000 };
  if (lengthUnits[from] && lengthUnits[to]) return quantity(amount * lengthUnits[from] / lengthUnits[to]);
  if (weight[from] && weight[to]) return quantity(amount * weight[from] / weight[to]);
  for(const dimension of ['thread','piece']){
    const source=measurementFactor(from,material,dimension),target=measurementFactor(to,material,dimension);
    if(source!==null&&target!==null)return quantity(amount*source/target);
  }
  if (packageUnits.includes(from) && to === material.unit && material.packageSize && from !== material.unit) return quantity(amount * material.packageSize);
  return null;
}
