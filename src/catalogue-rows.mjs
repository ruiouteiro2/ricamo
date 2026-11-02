import { bundledSupplierProducts, supplierIdentity, supplierSwatch } from '../core/supplier-products.mjs';
import { isDiscontinued } from '../core/discontinued-materials.mjs';
import { threadCountUnit } from '../core/thread-count-unit.mjs';
import discontinued from '../data/discontinued-materials.json' with {type:'json'};

const byCode = (a, b) => (a.code || a.name).localeCompare(b.code || b.name, undefined, { numeric: true, sensitivity: 'base' });
const isDmcMouline = row => row.brand === 'DMC' && JSON.parse(supplierIdentity(row))[1] === 'mouline';
// Shops list one DMC colour under several rows and spellings: show it once, from the offer the form would choose.
function dmcMoulineArticles(products) {
  const offers = new Map();
  for (const row of products) if (row.category === 'thread' && row.code && isDmcMouline(row)) offers.set(supplierIdentity(row), [...(offers.get(supplierIdentity(row)) ?? []), row]);
  const sold = [...offers.values()].map(rows => {
    const best = rows.find(row => row.hex && row.rgbSource && row.supplier === 'casa-cenina') ?? rows.find(row => row.hex && row.rgbSource) ?? rows.find(row => row.supplier === 'casa-cenina') ?? rows[0];
    return { ...best, colorName: best.colorName || rows.find(row => row.colorName)?.colorName || '' };
  });
  const retired = discontinued.entries.filter(row => row.brand === 'DMC').map(row => supplierSwatch({ id: `discontinued-dmc-${row.code}`, category: 'thread', brand: 'DMC', range: row.range, code: row.code, name: row.name, colorName: row.name }));
  return [...sold, ...retired];
}
const sources = {
  'Mill Hill': products => products.filter(row => row.id.startsWith('casa-mh-')),
  DMC: dmcMoulineArticles,
};
const articles = new Map();
const allArticles = brand => {
  if (!articles.has(brand)) articles.set(brand, sources[brand](bundledSupplierProducts()).sort(byCode));
  return articles.get(brand);
};
const millHillOwned = owned => {
  const codes = new Set(owned.map(material => String(material.code ?? '').trim()).filter(Boolean));
  const products = new Set(owned.map(material => material.properties?.product?.id).filter(Boolean));
  return row => row.code ? codes.has(row.code) : products.has(row.id);
};
const identityOwned = owned => {
  const identities = new Set(owned.map(supplierIdentity));
  return row => identities.has(supplierIdentity(row));
};
export const hasCatalogueRows = brand => Object.hasOwn(sources, brand ?? '');
/** Catalogue articles of this brand not yet in the inventory. A Mill Hill code identifies an article whichever line it was saved under. */
export function missingCatalogueArticles(brand, materials) {
  const owned = materials.filter(material => !material.archived && material.brand === brand);
  const isOwned = brand === 'Mill Hill' ? millHillOwned(owned) : identityOwned(owned);
  return allArticles(brand).filter(row => !isOwned(row)).map(product => ({ product, discontinued: isDiscontinued(product) }));
}
export function catalogueMaterial(product, id) {
  const thread = product.category === 'thread';
  return { id, name: [product.brand, product.range, product.code, thread ? '' : product.colorName].filter(Boolean).join(' · '), category: product.category, brand: product.brand, range: product.range, code: product.code, unit: thread ? threadCountUnit({ brand: product.brand, family: 'mouline', product }) : 'pack', color: product.hex ?? '', tags: [], notes: '', minimum: 1, packageSize: null, strands: product.pack?.strands ?? null, divisible: product.pack?.divisible === true, reusable: false, favorite: false, attachments: [], properties: { custom: {}, product: JSON.parse(JSON.stringify(product)), ...(thread ? { threadFamily: 'mouline', quantityBasis: 'package-count' } : {}) } };
}
