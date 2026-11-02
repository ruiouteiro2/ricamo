import catalogue from '../data/discontinued-materials.json' with {type:'json'};
import { descriptorValue } from './material-descriptors.mjs';
import { supplierFold, supplierIdentity } from './supplier-products.mjs';

const dmcKey = code => supplierIdentity({ brand: 'DMC', range: 'Mouliné', code });
const millHill = new Map(catalogue.entries.filter(row => row.brand === 'Mill Hill').map(row => [row.code, row]));
const dmc = new Map(catalogue.entries.filter(row => row.brand === 'DMC').map(row => [dmcKey(row.code), row]));
/** Mill Hill numbers an article once across lines; a DMC code is out of production only in the line the list covers. */
export function discontinuedEntry(material) {
  const code = String(material?.code ?? '').trim();
  if (!code) return null;
  const brand = supplierFold(material.brand);
  if (brand === 'mill hill') return millHill.get(code) ?? null;
  return brand === 'dmc' ? dmc.get(supplierIdentity({ brand: 'DMC', range: material.range, code })) ?? null : null;
}
/** A status she set on the material outranks the list, in both directions. */
export function isDiscontinued(material) {
  const status = descriptorValue(material?.properties, 'catalogueStatus');
  return status ? status === 'discontinued' : Boolean(discontinuedEntry(material));
}
