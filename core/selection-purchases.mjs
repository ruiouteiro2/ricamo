import { assert, find, quantity } from './shared.mjs';
import { saveMaterial } from './inventory.mjs';
import { duplicateMaterials } from './material-duplicates.mjs';
import { supplierIdentity, supplierFold } from './supplier-products.mjs';
import { savePurchase } from './purchasing.mjs';

export const PURCHASE_SELECTION_LIMIT = 5000;

/** One transaction, including catalogue material creation; operation retries are idempotent. */
export function purchaseSelection(state, payload, context) {
  assert(Array.isArray(payload.rows) && payload.rows.length > 0 && payload.rows.length <= PURCHASE_SELECTION_LIMIT, 'invalid_list');
  const seen = new Set(), byIdentity = new Map(), byName = new Map();
  const identityKey = material => JSON.stringify([material.category, supplierIdentity(material)]);
  const nameKey = material => JSON.stringify([material.category, supplierFold(material.brand), supplierFold(material.name)]);
  const index = material => {
    if (material.archived) return;
    for (const [map, key] of [[byIdentity, identityKey(material)], [byName, nameKey(material)]]) {
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(material);
    }
  };
  state.materials.forEach(index);
  for (const row of payload.rows) {
    const amount = quantity(row.quantity, { positive: true });
    let material;
    if (row.materialId) material = find(state, 'materials', row.materialId);
    else {
      assert(row.material && !row.material.archived, 'invalid_material');
      const candidates = String(row.material.code || '').trim() ? byIdentity.get(identityKey(row.material)) : byName.get(nameKey(row.material));
      const matches = duplicateMaterials({ materials: candidates || [] }, { ...row.material, id: undefined });
      assert(matches.length <= 1, 'material_duplicate');
      material = matches[0];
      if (!material) {
        const id = context.id();
        saveMaterial(state, { ...row.material, id }, context);
        material = find(state, 'materials', id);
        index(material);
      }
    }
    assert(!material.archived && !seen.has(material.id), 'material_duplicate');
    seen.add(material.id);
    savePurchase(state, { materialId: material.id, quantity: amount, status: 'to_buy', source: 'manual', projectIds: [] }, context);
  }
}
