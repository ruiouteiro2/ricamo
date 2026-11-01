import test from 'node:test';
import assert from 'node:assert/strict';
import snapshot from '../data/madeira-metallic-catalogue.json' with {type:'json'};
import {bundledSupplierProducts, normalizeSupplierProduct, supplierName, supplierNameFromUrl, supplierUrl, supplierIdentity} from '../core/supplier-products.mjs';
import {SupplierCatalogues} from '../desktop/supplier-catalogues.mjs';
import {purchaseUrl} from '../core/pattern-fabric.mjs';
test('official Madeira shade-card snapshot keeps 255 exact range/code identities and approximate RGB provenance',()=>{
 const products=bundledSupplierProducts().filter(row=>row.supplier==='madeira');assert.equal(products.length,255);assert.equal(new Set(products.map(row=>supplierIdentity(row))).size,255);assert.equal(snapshot.evidence.length,255);assert.equal(products.filter(row=>row.colorVariation==='multicolour').length,11);
 assert.deepEqual(Object.fromEntries([...new Set(products.map(row=>row.range))].sort().map(range=>[range,products.filter(row=>row.range===range).length])),{'CR Metallic 20':16,'CR Metallic 40':42,'FS 20':26,'FS 30':21,'FS 40':21,'FS 50':8,'Supertwist 30':121});
 for(const row of products){assert.equal(row.brand,'Madeira');assert.equal(row.type,'metallic');assert.match(row.code,/^\d+$/);assert.match(row.hex,/^#[0-9a-f]{6}$/);assert.equal(row.rgbSource.kind,'approximate');assert.equal(row.pack.lengthM,null);assert.equal(row.pack.unit,null);assert.ok(row.colorName);assert.ok(row.sourceUrl.startsWith('https://www.madeira.com/'));assert.equal(purchaseUrl(row.url),row.url);assert.deepEqual(normalizeSupplierProduct(row),row);}
 assert.equal(products.find(row=>row.range==='FS 40'&&row.code==='4022').colorName,'white gold');assert.equal(supplierName('madeira'),'Madeira');assert.equal(supplierNameFromUrl(snapshot.home),'Madeira');assert.equal(supplierNameFromUrl('https://www.casacenina.fr/test'),'Casa Cenina');assert.throws(()=>supplierUrl('https://www.madeira.com.evil.example/'));assert.throws(()=>purchaseUrl('https://madeira.com.evil.example/'));assert.throws(()=>normalizeSupplierProduct({...products[0],url:'https://www.tessiland.com/it/'}));
});
test('native Madeira search seeds offline records and cannot accidentally start a generic web scan',async()=>{
 let requests=0;const service=new SupplierCatalogues(':memory:',{transport:async()=>{requests++;throw Error('unexpected network');}});
 try{assert.equal(service.search({brand:'Madeira',category:'thread',limit:100}).total,255);assert.equal(service.lookup({brand:'Madeira',range:'FS 40',code:'4022'}).length,1);const status=service.status({supplier:'madeira'})[0];assert.equal(status.products,255);assert.equal(status.updatesAvailable,false);assert.equal(status.complete,false);assert.equal(status.reason,'supplier_snapshot_only');assert.throws(()=>service.start({supplier:'madeira'}),/supplier_snapshot_only/);assert.equal(requests,0);}finally{await service.close();}
});
