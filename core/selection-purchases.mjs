import { assert, find, quantity } from './shared.mjs';
import { saveMaterial } from './inventory.mjs';
import { duplicateMaterials } from './material-duplicates.mjs';
import { savePurchase } from './purchasing.mjs';

/** One transaction, including catalogue material creation; operation retries are idempotent. */
export function purchaseSelection(state, payload, context) {
  assert(Array.isArray(payload.rows) && payload.rows.length > 0 && payload.rows.length <= 200, 'invalid_list');
  const seen = new Set();
  for (const row of payload.rows) {
    const amount = quantity(row.quantity, { positive: true });
    let material;
    if (row.materialId) material = find(state, 'materials', row.materialId);
    else {
      assert(row.material && !row.material.archived, 'invalid_material');
      const matches = duplicateMaterials(state, row.material);
      assert(matches.length <= 1, 'material_duplicate');
      material = matches[0];
      if (!material) {
        const id = context.id();
        saveMaterial(state, { ...row.material, id }, context);
        material = find(state, 'materials', id);
      }
    }
    assert(!material.archived && !seen.has(material.id), 'material_duplicate');
    seen.add(material.id);
    savePurchase(state, { materialId: material.id, quantity: amount, status: 'to_buy', source: 'manual', projectIds: [] }, context);
  }
}
