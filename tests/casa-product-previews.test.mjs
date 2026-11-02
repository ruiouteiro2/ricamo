import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import catalogue from '../data/dmc-coloris-catalogue.json' with {type:'json'};
import evidence from '../data/casa-product-preview-sources.json' with {type:'json'};
import assets from '../src/assets/casa-product-previews.json' with {type:'json'};
import {bundledSupplierProducts,normalizeSupplierProduct} from '../core/supplier-products.mjs';
import {productPreview,productPreviewStyle} from '../src/product-previews.mjs';
import {SupplierCache} from '../desktop/supplier-cache.mjs';
test('Coloris has exactly 24 observed multicolour skeins with original source previews and no invented RGB',()=>{
 assert.equal(catalogue.products.length,24);assert.deepEqual(catalogue.products.map(p=>p.code),Array.from({length:24},(_,i)=>String(4500+i)));
 for(const p of catalogue.products){const normalized=normalizeSupplierProduct(p);assert.equal(normalized.pack.unit,'skein');assert.equal(normalized.pack.lengthM,8);assert.equal(normalized.pack.strands,6);assert.equal(normalized.pack.divisible,true);assert.equal(normalized.colorVariation,'multicolour');assert.equal(normalized.hex,null);const proof=evidence.evidence.find(e=>e.productUrl===p.url);assert.ok(proof);assert.equal(productPreview(p),assets.images[proof.sha256]);}
 const cache=new SupplierCache(':memory:');try{assert.equal(cache.lookup({brand:'DMC',range:'Coloris',code:'4500',category:'thread'}).length,1);}finally{cache.close();}
});
test('every preview preserves original image bytes and exact source URL, with no crop or guessed product fallback',()=>{
 for(const proof of evidence.evidence){const uri=assets.images[proof.sha256];assert.ok(uri?.startsWith('data:image/'));const bytes=Buffer.from(uri.split(',')[1],'base64');assert.equal(bytes.length,proof.size);assert.equal(createHash('sha256').update(bytes).digest('hex'),proof.sha256);assert.equal(assets.byUrl[proof.productUrl],proof.sha256);assert.ok(proof.imageUrl.startsWith('https://www.casacenina.it/catalog/images/'));}
 assert.equal(productPreviewStyle(catalogue.products[0]).backgroundSize,'contain');assert.equal(productPreview({brand:'Unknown',range:'Coloris',code:'4500',category:'thread'}),'');assert.equal(productPreview({brand:'DMC',range:'Coloris',code:'999999',category:'thread'}),'');
 const p=bundledSupplierProducts().find(p=>p.brand==='DMC'&&p.code==='310'&&p.range==='Mouliné'&&p.supplier==='casa-cenina');assert.ok(p);assert.ok(productPreview(p));assert.equal(productPreview({brand:p.brand,range:p.range,code:p.code,category:p.category,properties:{}}),productPreview(p));
});
