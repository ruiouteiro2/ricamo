import snapshot from '../data/casa-cenina-catalogue.json' with { type: 'json' };

const fold = value => String(value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase();
function freeze(value) { if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } return value; }
/** Public factual snapshot, never a live price, stock or colour-calibration service. */
export const CASA_CENINA = freeze(snapshot);
export const NIGHTINGALE_SUPPLIES = CASA_CENINA.nightingale;
const products = [...CASA_CENINA.fabrics, ...CASA_CENINA.materials];
const byId = new Map(products.map(row => [row.id, row]));
const searchText = new Map(products.map(row => [row.id, fold([row.brand, row.range, row.name, row.colorName, row.code, row.type, row.count].join(' '))]));

export function searchRetailerCatalogue({ category, query = '', brand, type, count } = {}) {
  const terms = fold(query).split(/\s+/).filter(Boolean);
  return products.filter(row => (!category || row.category === category)
    && (!brand || fold(row.brand) === fold(brand)) && (!type || row.type === type)
    && (count === undefined || count === null || count === '' || row.count === Number(count))
    && terms.every(term => searchText.get(row.id).includes(term)));
}

function brandName(value) {
  const name = fold(value);
  return ['caron', 'the caron collection'].includes(name) ? 'caron collection' : name;
}
function rangeName(brand, value) {
  const range = fold(value);
  if (brand === 'dmc' && ['mouline', 'stranded cotton', 'mouline special', 'mouline special 25'].includes(range)) return 'mouline';
  if (brand === 'caron collection' && ['waterlillies', 'waterlilies'].includes(range)) return 'waterlilies';
  if (brand === 'kreinik' && ['#4', '#4 braid', 'very fine braid', 'very fine braid #4'].includes(range)) return 'very fine braid #4';
  return range;
}
const identity = (brand, range, code) => JSON.stringify([brandName(brand), rangeName(brandName(brand), range), fold(code)]);
const byIdentity = new Map();
for (const row of CASA_CENINA.materials) {
  const key = identity(row.brand, row.range, row.code);
  if (!byIdentity.has(key)) byIdentity.set(key, []);
  byIdentity.get(key).push(row);
}
const codeAliases = new Map(CASA_CENINA.codeAliases.map(row => [identity(row.brand, row.range, row.from), fold(row.to)]));

/** Exact identity or a documented alias only; a similar colour is not a substitute. */
export function retailerPurchaseLinks(material = {}) {
  if (!material || typeof material !== 'object') return [];
  if (material.productId) {
    const row = byId.get(material.productId);
    return row && (!material.category || row.category === material.category) ? [row] : [];
  }
  const brand = brandName(material.brand);
  let range = rangeName(brand, material.range);
  if (!range && brand === 'dmc' && material.catalogueRef?.name === 'DMC · MakeBead') range = 'mouline';
  if (!brand || !range || !String(material.code ?? '').trim()) return [];
  const code = codeAliases.get(identity(brand, range, material.code)) ?? fold(material.code);
  return (byIdentity.get(identity(brand, range, code)) ?? []).filter(row => !material.category || row.category === material.category);
}

/** Count is threads/inch for linen/evenweave and stitches/inch for Aida/canvas. */
export function fabricConfiguration(value) {
  const row = typeof value === 'string' ? byId.get(value) : byId.get(value?.id);
  if (!row || row.category !== 'fabric' || row.count === null || row.countMeaning === null) return null;
  return { type: row.type, brand: row.brand, range: row.range, code: row.code ?? '', colorName: row.colorName ?? '', productId: row.id,
    url: row.url, countX: row.count, countY: row.count, countMeaning: row.countMeaning, overX: row.over, overY: row.over };
}
