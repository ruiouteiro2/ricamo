// Fabric brands from Casa Cenina's embroidery-fabric navigation, checked 2026-11-01.
// Excludes Grigoletto, felt, patchwork, Vaupel and miscellaneous types.
export const FABRIC_BRANDS = ['Zweigart', 'Permin of Copenhagen', 'Anchor', 'DMC',
  'Dames Of The Needle', 'Lady Dot Creates', 'Mani di Donna', 'MP Studia',
  'Picture This Plus', 'Polstitches Designs', 'R & R Reproductions', 'Weeks Dye Works', 'xJuDesign'];
const brandChild = brand => ({ id: brand.toLowerCase().replace(/[^a-z0-9]+/g, '-'), label: brand, brand });
export const INVENTORY_GROUPS = [
  { id: 'threads', category: 'thread', labelKey: 'inventoryThreads', children: ['DMC','Anchor','Profilo'].map(brandChild) },
  { id: 'beads', category: 'embellishment', labelKey: 'inventoryBeads', children: ['Mill Hill'].map(brandChild) },
  { id: 'fabrics', category: 'fabric', labelKey: 'inventoryFabrics', children: FABRIC_BRANDS.map(brandChild) },
  { id: 'accessories', category: 'tool', labelKey: 'inventoryAccessories', children: [
    { id: 'needles', labelKey: 'inventoryNeedles' }, { id: 'scissors', labelKey: 'inventoryScissors' }, { id: 'hoops', labelKey: 'inventoryHoops' },
  ] },
];
const fold = value => String(value || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase();
export function inventoryGroup(material) {
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
export function parseInventoryRoute(id) {
  const [, groupId, childId = ''] = String(id || '').split(':');
  const group = INVENTORY_GROUPS.find(item => item.id === groupId);
  const child = group?.children.find(item => item.id === childId);
  return { group: group || null, child: child || null, showList: id === 'all' || Boolean(group && childId === 'all') || Boolean(child) };
}
export function inventoryContext(group, child = null) {
  return group ? { groupId: group.id, category: group.category, brand: child?.brand || (group.children.length === 1 ? group.children[0].brand : ''), section: group.id === 'accessories' ? child?.id || '' : '' } : {};
}
