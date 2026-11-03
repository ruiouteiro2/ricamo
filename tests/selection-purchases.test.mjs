import test from 'node:test';
import assert from 'node:assert/strict';
import { Repository } from '../desktop/repository.mjs';
import { catalogueMaterial, missingCatalogueArticles } from '../src/catalogue-rows.mjs';
const product = code => missingCatalogueArticles('DMC', []).find(row => row.product.code === code).product;
const material = code => catalogueMaterial(product(code), `candidate-${code}`);
test('mixed inventory/catalogue selection persists atomically and retries do not duplicate orders', () => {
  const repo = new Repository(':memory:');
  try {
    repo.execute({type:'material.createWithLot', operationId:'seed',payload:{material:material('321'),lot:{quantity:2}}},0);
    const before=repo.load(), id=before.materials[0].id;
    const command={type:'purchase.selection',operationId:'selection',payload:{rows:[{materialId:id,quantity:3},{material:material('310'),quantity:4}]}};
    repo.execute(command,1);repo.execute(command,1);
    const after=repo.load();assert.equal(after.materials.length,2);assert.deepEqual(after.purchases.map(row=>row.quantity),[3,4]);assert.deepEqual(after.lots,before.lots);
    assert.equal(after.purchases[0].materialId,id);assert.equal(after.purchases[1].unit,'skein');
    const saved=JSON.stringify(after);
    for(const rows of [
      [{material:material('666'),quantity:1},{materialId:id,quantity:-1}],
      [{materialId:id,quantity:1},{materialId:id,quantity:2}],
      [{material:{...material('666'),properties:{details:{version:1,catalogueStatus:'discontinued'}}},quantity:1}],
    ]) {
      assert.throws(()=>repo.execute({type:'purchase.selection',operationId:crypto.randomUUID(),payload:{rows}},after.revision));assert.equal(JSON.stringify(repo.load()),saved);
    }
  } finally { repo.close(); }
});


test('catalogue selections above 200 persist together and reuse existing identities', () => {
  const repo = new Repository(':memory:');
  try {
    const products = missingCatalogueArticles('DMC', []).slice(0, 250);
    const rows = products.map(({product}, index) => ({material: catalogueMaterial(product, `catalogue-${index}`), quantity: 1}));
    const command = {type:'purchase.selection',operationId:'large-catalogue-selection',payload:{rows}};
    const start = performance.now(); repo.execute(command,0); repo.execute(command,0);
    const saved = repo.load(); assert.equal(saved.purchases.length,250); assert.equal(saved.materials.length,250); assert.equal(saved.lots.length,0); assert.equal(saved.movements.length,0);
    repo.execute({type:'purchase.selection',operationId:'reuse-identity',payload:{rows:[{material:saved.materials[0],quantity:2}]}},saved.revision);
    assert.equal(repo.load().materials.length,250); assert.equal(repo.load().purchases.length,251);
    console.log(`250-item purchase selection and retry: ${Math.round(performance.now()-start)} ms`);
  } finally { repo.close(); }
});
