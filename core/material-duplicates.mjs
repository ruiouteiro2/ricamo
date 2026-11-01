import { supplierIdentity, supplierFold } from './supplier-products.mjs';
import { assert, find, quantity } from './shared.mjs';
import { addLot } from './inventory.mjs';

export function duplicateMaterials(state, candidate) {
  const code = String(candidate.code || '').trim();
  const name = supplierFold(candidate.name);
  if (!code && !name) return [];
  return state.materials.filter(material => {
    if (material.id === candidate.id || material.archived || material.category !== candidate.category) return false;
    const a = supplierFold(material.properties?.threadSize), b = supplierFold(candidate.properties?.threadSize);
    if (a && b && a !== b) return false;
    return code ? supplierIdentity(material) === supplierIdentity(candidate)
      : name === supplierFold(material.name) && supplierFold(material.brand) === supplierFold(candidate.brand);
  });
}
export const duplicateMaterialHandlers = {
  'material.addDuplicateStock': (state, payload, context) => {
    const target = find(state, 'materials', payload.materialId);
    assert(duplicateMaterials(state, payload.material).some(material => material.id === target.id), 'duplicate_target_changed');
    assert(payload.unit === target.unit, 'incompatible_units');
    const amount = quantity(payload.lot?.quantity, { positive: true });
    addLot(state, { ...payload.lot, id: undefined, materialId: target.id, quantity: amount }, context);
  },
};
