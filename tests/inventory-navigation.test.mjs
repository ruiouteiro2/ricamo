import test from 'node:test';
import assert from 'node:assert/strict';
import {INVENTORY_GROUPS,FABRIC_BRANDS,inventoryContext,inventoryRoute,parseInventoryRoute,matchesInventorySection,inventoryGroup,accessorySection} from '../src/inventory-navigation.mjs';

test('navigation routes retain selected brands and contextual creation defaults',()=>{
  for(const group of INVENTORY_GROUPS)for(const child of group.children){
    const route=inventoryRoute(group.id,child.id),parsed=parseInventoryRoute(route);
    assert.equal(parsed.group,group);assert.equal(parsed.child,child);assert.equal(parsed.showList,true);
    const context=inventoryContext(group,child);assert.equal(context.category,group.category);
    if(child.brand)assert.equal(context.brand,child.brand);else assert.equal(context.section,child.id);
  }
  assert.equal(parseInventoryRoute(null).showList,false);assert.equal(parseInventoryRoute('all').showList,true);
  assert.equal(parseInventoryRoute('category:unknown:bad').group,null);
  assert.equal(inventoryContext(INVENTORY_GROUPS.find(g=>g.id==='beads')).brand,'Mill Hill');
});
test('legacy material categories stay visible without changing inventory or supplier identity',()=>{
  const source={category:'fabric',brand:'Permin',name:'Linen',properties:{product:{id:'retained'}}};
  const before=structuredClone(source);
  assert.equal(matchesInventorySection(source,'fabrics','permin-of-copenhagen'),true);
  assert.equal(matchesInventorySection(source,'threads','anchor'),false);
  assert.equal(matchesInventorySection({category:'thread',brand:'anchor'},'threads','anchor'),true);
  assert.equal(matchesInventorySection({category:'thread',brand:'Another brand'},'threads','all'),true);
  assert.equal(inventoryGroup({category:'storage'}),'accessories');
  assert.deepEqual(source,before);
});
test('accessory subtype is preserved explicitly and inferred for previous records',()=>{
  assert.equal(accessorySection({name:'Forbici da ricamo'}),'scissors');
  assert.equal(accessorySection({name:'Wood embroidery hoop'}),'hoops');
  assert.equal(accessorySection({name:'Needle magnet'}),'needles');
  const material={category:'tool',name:'My set',properties:{inventorySection:'scissors'}};
  assert.equal(matchesInventorySection(material,'accessories','scissors'),true);
  assert.equal(matchesInventorySection(material,'accessories','hoops'),false);
});
test('fabric navigation includes the embroidery brands and excludes the requested groups',()=>{
  assert.equal(FABRIC_BRANDS.length,13);assert.ok(FABRIC_BRANDS.includes('xJuDesign'));
  assert.ok(FABRIC_BRANDS.includes('Dames Of The Needle'));
  for(const excluded of ['Grigoletto','Feltro','Tessuti Patchwork','Vaupel','Tipologie Varie'])assert.equal(FABRIC_BRANDS.includes(excluded),false);
});
