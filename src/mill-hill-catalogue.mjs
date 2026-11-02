import { bundledSupplierProducts } from '../core/supplier-products.mjs';
import { isDiscontinued } from '../core/discontinued-materials.mjs';

let articles;
const allArticles = () => articles ??= bundledSupplierProducts().filter(row => row.id.startsWith('casa-mh-')).sort((a, b) => (a.code || a.name).localeCompare(b.code || b.name));
/** Catalogue articles not yet in the inventory. A code identifies an article whichever line it was saved under. */
export function missingMillHillArticles(materials) {
  const owned = materials.filter(material => !material.archived && material.brand === 'Mill Hill');
  const codes = new Set(owned.map(material => String(material.code ?? '').trim()).filter(Boolean));
  const products = new Set(owned.map(material => material.properties?.product?.id).filter(Boolean));
  return allArticles().filter(row => row.code ? !codes.has(row.code) : !products.has(row.id)).map(product => ({ product, discontinued: isDiscontinued(product) }));
}
export function millHillMaterial(product, id) {
  return { id, name: [product.brand, product.range, product.code, product.colorName].filter(Boolean).join(' · '), category: product.category, brand: product.brand, range: product.range, code: product.code, unit: 'pack', color: product.hex ?? '', tags: [], notes: '', minimum: 1, packageSize: null, strands: null, divisible: false, reusable: false, favorite: false, attachments: [], properties: { custom: {}, product: JSON.parse(JSON.stringify(product)) } };
}
