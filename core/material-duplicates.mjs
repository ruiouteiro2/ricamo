import {setThreadCountUnit} from './thread-count-unit.mjs';
import { supplierIdentity, supplierFold } from './supplier-products.mjs';
import { assert, find, quantity } from './shared.mjs';
import { addLot } from './inventory.mjs';

// A DMC Perlé skein and ball of one colour are separate stock, so they never merge.
const dmcPerleFormat = material => supplierFold(material.brand) === 'dmc' && (material.properties?.threadFamily === 'pearl' || /^(perle|pearl)/.test(supplierFold(material.range))) && ['skein', 'ball'].includes(material.unit) ? material.unit : '';

export function duplicateMaterials(state, candidate) {
  const code = String(candidate.code || '').trim();
  const name = supplierFold(candidate.name);
  if (!code && !name) return [];
  return state.materials.filter(material => {
    if (material.id === candidate.id || material.archived || material.category !== candidate.category) return false;
    const a = supplierFold(material.properties?.threadSize), b = supplierFold(candidate.properties?.threadSize);
    if (a && b && a !== b) return false;
    const formatA = dmcPerleFormat(material), formatB = dmcPerleFormat(candidate);
    if (formatA && formatB && formatA !== formatB) return false;
    return code ? supplierIdentity(material) === supplierIdentity(candidate)
      : name === supplierFold(material.name) && supplierFold(material.brand) === supplierFold(candidate.brand);
  });
}
export const duplicateMaterialHandlers = {
  'material.addDuplicateStock': (state, payload, context) => {
    const target = find(state, 'materials', payload.materialId);
    assert(duplicateMaterials(state, payload.material).some(material => material.id === target.id), 'duplicate_target_changed');
    if(payload.threadCountUnit===true&&target.unit!==payload.unit)setThreadCountUnit(state,{materialId:target.id,unit:payload.unit,preserveCounts:true},context);
    assert(payload.unit === target.unit, 'incompatible_units');
    const amount = quantity(payload.lot?.quantity, { positive: true });
    addLot(state, { ...payload.lot, id: undefined, materialId: target.id, quantity: amount }, context);
  },
};
