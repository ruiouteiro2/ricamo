// Fabric brands from Casa Cenina's embroidery-fabric navigation, checked 2026-11-01.
// Excludes Grigoletto, felt, patchwork, Vaupel and miscellaneous types.
export const FABRIC_BRANDS = ['Zweigart', 'Permin of Copenhagen', 'Anchor', 'DMC',
  'Dames Of The Needle', 'Lady Dot Creates', 'Mani di Donna', 'MP Studia',
  'Picture This Plus', 'Polstitches Designs', 'R & R Reproductions', 'Weeks Dye Works', 'xJuDesign'];
const brandChild = brand => ({ id: brand.toLowerCase().replace(/[^a-z0-9]+/g, '-'), label: brand, brand });
const CASA_DMC = 'https://www.casacenina.it/fili-e-filati/dmc/';
const DMC_REFERENCES = [
  { name: 'DMC Mouliné', source: 'Casa Cenina', family: 'mouline', url: `${CASA_DMC}dmc-mouline/` },
  { name: 'DMC filati speciali', source: 'Casa Cenina', family: 'special', url: 'https://www.casacenina.it/filati.html#dmc' },
  { name: 'DMC Satin', source: 'Casa Cenina', family: 'silk', url: `${CASA_DMC}dmc-satin/` },
  { name: 'DMC Lana Colbert', source: 'Casa Cenina', family: 'wool', url: `${CASA_DMC}dmc-lana-colbert/` },
  { name: 'DMC Mouliné - Cono', source: 'Casa Cenina', family: 'spool', url: `${CASA_DMC}dmc-mouline-cono/` },
  { name: 'DMC Perlé', source: 'Casa Cenina', family: 'pearl', url: 'https://www.casacenina.it/filati.html#dmc' },
  ...[3, 5, 8, 12].map(size => ({ name: `DMC Perlé #${size}`, source: 'Casa Cenina', family: 'pearl', size: String(size), url: `${CASA_DMC}dmc-perle-${size}/` })),
  { name: 'DMC Diamant', source: 'Casa Cenina', family: 'diamant', url: `${CASA_DMC}dmc-diamant/` },
  { name: "DMC Coton Perlé - Retors d'Alsace", source: 'Casa Cenina', family: 'alsace', url: 'https://www.casacenina.it/filati.html#dmc' },
  ...[5, 8, 12].map(size => ({ name: `DMC Coton Perlé - Retors d'Alsace #${size}`, source: 'Casa Cenina', family: 'alsace', size: String(size), url: `${CASA_DMC}dmc-coton-perle-retors-d-alsace-${size}/` })),
  { name: 'DMC Coton Retors Mat', source: 'DMC', family: 'mat', url: 'https://www.dmc.com/IT/it/products/dmc-wool-tapestry/retors-mat-cotton' },
];
// Lines of the Mill Hill catalogue, most used first. Each code belongs to one line only.
export const MILL_HILL_LINES = ['Glass Seed Beads', 'Antique Glass Seed Beads', 'Petite Glass Seed Beads', 'Seed Frosted Beads', 'Beads 6/0', 'Beads 8/0', 'Pebble Beads', 'Bugle Beads', 'Magnifica', 'Glass Treasures', 'Crystal Treasures', 'Metal Treasures', 'Glow in the Dark', 'Economy and Mini-Packs', 'Bottoni', 'Bells'];
export const INVENTORY_GROUPS = [
  { id: 'threads', category: 'thread', labelKey: 'inventoryThreads', children: ['DMC','Anchor','Profilo','P&G','Madeira'].map(brand => ({ ...brandChild(brand), label: brand === 'Madeira' ? 'Metallici Madeira' : brand, ...(brand === 'DMC' ? { reference: DMC_REFERENCES[0], references: DMC_REFERENCES } : {}), ...(brand === 'Profilo' ? { reference: { name: 'Profilo 6 Mouliné', source: 'Casa Cenina', url: 'https://www.casacenina.it/fili-e-filati/profilo/profilo-6-mouline/' } } : {}), ...(brand === 'P&G' ? { reference: { name: 'Filo rame verniciato', source: 'Tombolo e Disegni', url: 'https://www.tombolodisegnishop.it/prodotto/filo-rame-verniciato-030/' } } : {}) })) },
  { id: 'beads', category: 'embellishment', labelKey: 'inventoryBeads', children: ['Mill Hill'].map(brand => ({ ...brandChild(brand), reference: { name: 'Mill Hill', source: 'Casa Cenina', url: 'https://www.casacenina.it/mill-hill/?filter_id=8' } })) },
  { id: 'fabrics', category: 'fabric', labelKey: 'inventoryFabrics', children: FABRIC_BRANDS.map(brandChild) },
  { id: 'accessories', category: 'tool', labelKey: 'inventoryAccessories', children: [
    { id: 'needles', labelKey: 'inventoryNeedles' }, { id: 'scissors', labelKey: 'inventoryScissors' }, { id: 'hoops', labelKey: 'inventoryHoops' },
  ] },
];
const fold = value => String(value || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase();
const threadSize = value => { const match = String(value ?? '').match(/\d+/); return match ? String(Number(match[0])) : ''; };
export function threadReferenceFor(child, family, size = '') {
  const references = child?.references?.filter(reference => !reference.family || reference.family === family) || [];
  const exactSize = threadSize(size);
  return (exactSize ? references.find(reference => threadSize(reference.size) === exactSize) : null)
    || references.find(reference => !reference.size)
    || ((!child?.reference?.family || child.reference.family === family) ? child?.reference : null)
    || null;
}
export function threadRangeMatchesSize(range, family, size = '') {
  const expected = threadSize(size);
  if (!expected || !['pearl', 'alsace'].includes(family)) return true;
  return threadSize(range) === expected;
}
const isCustomCategory = value => String(value ?? '').startsWith('custom-');
export const customInventoryGroups = (categories = []) => categories.filter(row => isCustomCategory(row.id)).map(row => ({ id: row.id, category: row.id, label: row.name, children: [], custom: true }));
export function inventoryGroup(material) {
  if (isCustomCategory(material.category)) return material.category;
  return ({ thread: 'threads', embellishment: 'beads', fabric: 'fabrics' })[material.category] || 'accessories';
}
export function accessorySection(material) {
  if (['needles','scissors','hoops'].includes(material.properties?.inventorySection)) return material.properties.inventorySection;
  const words = fold([material.name, material.range, material.properties?.toolType].join(' '));
  if (/forbic|scissor/.test(words)) return 'scissors';
  if (/telaio|telai|hoop|frame/.test(words)) return 'hoops';
  return 'needles';
}
export function matchesInventorySection(material, groupId, childId = '') {
  if (!groupId) return true;
  if (inventoryGroup(material) !== groupId) return false;
  if (!childId || childId === 'all') return true;
  const child = INVENTORY_GROUPS.find(group => group.id === groupId)?.children.find(item => item.id === childId);
  if (!child) return false;
  if (groupId === 'accessories') return accessorySection(material) === childId;
  const brand = fold(material.brand);
  if (child.brand === 'Permin of Copenhagen') return ['permin','permin of copenhagen'].includes(brand);
  return brand === fold(child.brand);
}
export function inventoryRoute(groupId = '', childId = '') { return groupId ? `category:${groupId}${childId ? `:${childId}` : ''}` : null; }
export function parseInventoryRoute(id, categories = []) {
  const [, groupId, childId = ''] = String(id || '').split(':');
  const group = [...INVENTORY_GROUPS, ...customInventoryGroups(categories)].find(item => item.id === groupId);
  const child = group?.children.find(item => item.id === childId);
  return { group: group || null, child: child || null, showList: id === 'all' || Boolean(group && childId === 'all') || Boolean(child) || Boolean(group?.custom) };
}
export function inventoryContext(group, child = null) {
  return group ? { groupId: group.id, category: group.category, brand: child?.brand || (group.children.length === 1 ? group.children[0].brand : ''), section: group.id === 'accessories' ? child?.id || '' : '' } : {};
}
