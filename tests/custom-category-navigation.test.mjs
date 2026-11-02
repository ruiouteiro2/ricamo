import test from 'node:test';
import assert from 'node:assert/strict';
import {customInventoryGroups,inventoryGroup,inventoryContext,inventoryRoute,matchesInventorySection,parseInventoryRoute} from '../src/inventory-navigation.mjs';

const categories=[{id:'custom-a',name:'Telai antichi',fields:[]},{id:'old-id',name:'Without prefix',fields:[]}];

test('custom categories become inventory groups that open their own list',()=>{
 const [group,...rest]=customInventoryGroups(categories);
 assert.deepEqual(rest,[]);assert.equal(group.label,'Telai antichi');
 const parsed=parseInventoryRoute(inventoryRoute(group.id),categories);
 assert.equal(parsed.group.id,'custom-a');assert.equal(parsed.showList,true);
 assert.deepEqual(inventoryContext(parsed.group),{groupId:'custom-a',category:'custom-a',brand:'',section:''});
});

test('materials stay in their own category',()=>{
 const custom={category:'custom-a',brand:''},thread={category:'thread',brand:'DMC'},other={category:'other',brand:''};
 assert.equal(inventoryGroup(custom),'custom-a');assert.equal(inventoryGroup(thread),'threads');assert.equal(inventoryGroup(other),'accessories');
 assert.equal(matchesInventorySection(custom,'custom-a'),true);
 assert.equal(matchesInventorySection(thread,'custom-a'),false);
 assert.equal(matchesInventorySection(custom,'threads'),false);
 assert.equal(parseInventoryRoute('category:threads',categories).showList,false);
 assert.equal(parseInventoryRoute('category:custom-missing',categories).group,null);
});
