import test from 'node:test';
import assert from 'node:assert/strict';
import { CASA_CENINA, NIGHTINGALE_SUPPLIES, searchRetailerCatalogue, retailerPurchaseLinks, fabricConfiguration } from '../core/retailer-catalogue.mjs';
import { fabricSize } from '../core/fabric.mjs';
import dmc from '../src/engine/dmc.json' with { type: 'json' };

const all = [...CASA_CENINA.fabrics, ...CASA_CENINA.materials];
test('retailer snapshot has unique safe factual product identities and honest coverage', () => {
  assert.equal(CASA_CENINA.coverage.complete, false);
  assert.equal(CASA_CENINA.coverage.fabricProducts, CASA_CENINA.fabrics.length);
  assert.equal(CASA_CENINA.coverage.fabricCategories, CASA_CENINA.categories.length);
  assert.equal(CASA_CENINA.coverage.fabricCategoryListingsRead, CASA_CENINA.categories.filter(row => row.status === 'listing-read').length);
  assert.equal(new Set(all.map(row => row.id)).size, all.length);
  assert.equal(new Set(all.map(row => row.url)).size, all.length);
  for (const row of [...all, ...CASA_CENINA.categories]) {
    const url = new URL(row.url);
    assert.equal(url.protocol, 'https:');
    assert.ok(['www.casacenina.it', 'www.casacenina.com'].includes(url.hostname));
    assert.equal(url.username + url.password + url.hash + url.search, '');
    assert.ok(row.name && row.name.length < 300);
    assert.ok(!/\b(patchwork|feltro|felt|grigoletto|fat quarter bundles)\b/i.test(`${row.name} ${row.brand}`));
    for (const field of ['price', 'stock', 'hex', 'rgb', 'image', 'description']) assert.equal(Object.hasOwn(row, field), false);
  }
  for (const range of CASA_CENINA.coverage.threadRanges) {
    assert.equal(CASA_CENINA.materials.filter(row => row.brand === range.brand && row.range === range.range).length, range.recordedColors);
    assert.equal(range.recordedColors, range.listedColors);
  }
});

test('search combines category, brand, weave and count without fetching or inventing colours', () => {
  const rows = searchRetailerCatalogue({ category: 'fabric', type: 'linen', brand: 'Zweigart', count: 32, query: 'Belfast bianco' });
  assert.ok(rows.length > 0);
  for (const row of rows) { assert.equal(row.type, 'linen'); assert.equal(row.count, 32); assert.equal(row.brand, 'Zweigart'); }
  assert.equal(searchRetailerCatalogue({ category: 'thread', query: 'DMC Mouline 003' })[0].code, '003');
  assert.deepEqual(searchRetailerCatalogue({ query: 'no such fabric 7638173' }), []);
  assert.throws(() => { CASA_CENINA.fabrics[0].count = 99; }, TypeError);
});

test('linen 32 over two and Aida 16 over one retain the same physical design size', () => {
  const linen = fabricConfiguration(NIGHTINGALE_SUPPLIES.fabric.productId);
  const aidaRow = CASA_CENINA.fabrics.find(row => row.type === 'aida' && row.count === 16);
  const aida = fabricConfiguration(aidaRow);
  assert.equal(linen.countMeaning, 'threads'); assert.equal(linen.overX, 2);
  assert.equal(aida.countMeaning, 'stitches'); assert.equal(aida.overX, 1);
  for (const configuration of [linen, aida]) {
    const size = fabricSize({ width: 230, height: 190, ...configuration });
    assert.equal(size.widthCm, 36.5125); assert.equal(size.heightCm, 30.1625);
  }
  const unknown = CASA_CENINA.fabrics.find(row => row.count === null);
  assert.ok(unknown); assert.equal(fabricConfiguration(unknown), null);
  assert.equal(fabricConfiguration({ id: 'unverified', count: 32 }), null);
  assert.equal(fabricConfiguration({ ...aidaRow, count: 99 }).countX, 16);
});

test('purchase matching distinguishes ranges, zero-padded codes and explicit bundled provenance', () => {
  const exact = retailerPurchaseLinks({ category: 'thread', brand: 'DMC', range: 'Mouliné', code: '003' });
  assert.equal(exact.length, 1); assert.ok(exact[0].url.endsWith('/dmc-mouline-003.html'));
  assert.equal(retailerPurchaseLinks({ brand: 'DMC', range: 'Mouliné', code: '03' })[0].id, exact[0].id);
  assert.deepEqual(retailerPurchaseLinks({ brand: 'DMC', code: '03' }), []);
  assert.deepEqual(retailerPurchaseLinks({ brand: 'DMC', range: 'Pearl Cotton', code: '03' }), []);
  assert.deepEqual(retailerPurchaseLinks({ brand: 'DMC', range: 'Mouliné', code: '3' }), []);
  assert.deepEqual(retailerPurchaseLinks({ brand: 'DMC', range: 'Mouliné', code: '776' }), []);
  assert.equal(retailerPurchaseLinks({ brand: 'Caron', range: 'Waterlilies', code: '253' })[0].brand, 'Caron Collection');
  assert.equal(retailerPurchaseLinks({ category: 'embellishment', brand: 'Mill Hill', range: 'Glass Seed Beads', code: '00479' })[0].code, '00479');
  assert.deepEqual(retailerPurchaseLinks({ brand: 'Mill Hill', range: 'Glass Seed Beads', code: '479' }), []);
  const missing = dmc.filter(color => !retailerPurchaseLinks({ ...color, brand: 'DMC', catalogueRef: { name: 'DMC · MakeBead' } }).length).map(color => color.code);
  assert.deepEqual(missing, ['776']); // Retailer describes 3326 as a replacement, not identical stock.
});

test('Nightingale preset keeps publisher corrections, unknown thread amounts and chart ownership separate', () => {
  assert.equal(NIGHTINGALE_SUPPLIES.width, 230); assert.equal(NIGHTINGALE_SUPPLIES.height, 190);
  assert.equal(NIGHTINGALE_SUPPLIES.requirements.length, 35);
  const beads = NIGHTINGALE_SUPPLIES.requirements.filter(row => row.category === 'embellishment');
  assert.deepEqual(Object.fromEntries(beads.map(row => [row.code, row.quantity])), { '00020': 1, '00479': 2, '02026': 1, '03041': 1, '10101': 1, '80479': 2 });
  assert.ok(beads.every(row => row.unit === 'pack'));
  assert.ok(NIGHTINGALE_SUPPLIES.requirements.filter(row => row.category === 'thread').every(row => row.quantity === null));
  assert.equal(Object.hasOwn(NIGHTINGALE_SUPPLIES, 'cells'), false);
  assert.equal(Object.hasOwn(NIGHTINGALE_SUPPLIES, 'revisions'), false);
  for (const row of NIGHTINGALE_SUPPLIES.requirements) assert.equal(retailerPurchaseLinks(row).length, 1);
});
