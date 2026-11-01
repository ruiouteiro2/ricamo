import { supplierFold, supplierIdentity } from '../core/supplier-products.mjs';

/** Only the documented Diamant D-prefix is optional; retain every digit/leading zero. */
export function catalogueCodeQuery({ brand, family, code }) {
  const value = String(code ?? '').trim();
  if (supplierFold(brand) === 'dmc' && family === 'diamant') {
    const match = /^(?:d[\s-]*)?(\d+)$/i.exec(value);
    if (match) return `D${match[1]}`;
  }
  return value;
}

/** Fuzzy search offers choices; automatic selection requires one exact product identity. */
export function exactCatalogueMatch(products, context) {
  const code = catalogueCodeQuery(context);
  if (!code) return { product: null, ambiguous: false };
  const groups = new Map();
  for (const product of products) {
    if (supplierFold(product.brand) !== supplierFold(context.brand)) continue;
    const identity = supplierIdentity(product);
    if (identity !== supplierIdentity({ brand: context.brand, range: product.range, code })) continue;
    if (!groups.has(identity)) groups.set(identity, []);
    groups.get(identity).push(product);
  }
  if (groups.size !== 1) return { product: null, ambiguous: groups.size > 1 };
  const offers = [...groups.values()][0];
  const official = supplierFold(context.brand) === 'dmc' && context.family === 'diamant' ? offers.find(product => product.supplier === 'dmc') : null;
  return { product: official || offers.find(product => product.hex && product.rgbSource) || offers[0], ambiguous: false };
}
