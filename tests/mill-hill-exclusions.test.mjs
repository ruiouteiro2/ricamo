import test from 'node:test';
import assert from 'node:assert/strict';
import {isExcludedMillHillProduct} from '../core/mill-hill-exclusions.mjs';
import {bundledSupplierProducts} from '../core/supplier-products.mjs';
import {SupplierCache} from '../desktop/supplier-cache.mjs';

test('requested Mill Hill titles are excluded without broad colour or brand matches',()=>{
 for(const name of ['Large Lilac Star','Seasonal Ornament: Honey','Ornament Kit: Police Officer','Season Ornament: Pet Spider'])assert.equal(isExcludedMillHillProduct({brand:'Mill Hill',name}),true,name);
 for(const product of [{brand:'DMC',name:'Small Aqua Star'},{brand:'Mill Hill',name:'Crystal Honey Transparent Rainbow'},{brand:'Mill Hill',name:'Small Aqua Star Matte'},{brand:'Mill Hill',name:'Pumpkin'}])assert.equal(isExcludedMillHillProduct(product),false);
 assert.equal(bundledSupplierProducts().filter(isExcludedMillHillProduct).length,0);
});
test('supplier refresh cannot reinsert an explicitly excluded title',()=>{
 const cache=new SupplierCache(':memory:',{seed:false});
 try{const product={id:'excluded-fixture',supplier:'casa-cenina',category:'embellishment',type:'bead',brand:'Mill Hill',range:'Buttons',code:'',name:'Small Aqua Star',url:'https://www.casacenina.it/mill-hill/small-aqua-star.html',sourceUrl:'https://www.casacenina.it/mill-hill/',retrievedAt:'2026-11-05T00:00:00Z'};
 cache.put(product);assert.equal(cache.get({id:product.id}),null);
 cache.put({...product,id:'kept-fixture',name:'Small Aqua Star Matte'});assert.ok(cache.get({id:'kept-fixture'}));
 }finally{cache.close();}
});
