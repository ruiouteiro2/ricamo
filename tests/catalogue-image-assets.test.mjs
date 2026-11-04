import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync}from'node:fs';import{resolve}from'node:path';import{createHash}from'node:crypto';
import{catalogueImages}from'../build/catalogue-images.mjs';
test('Catalogue photo manifests use local URLs while preserving original image bytes and identities',()=>{
 const path=resolve('src/assets/dmc-diamant-previews.json'),original=JSON.parse(readFileSync(path,'utf8')),files=new Map(),plugin=catalogueImages();
 const manifest=JSON.parse(plugin.load.call({emitFile:file=>files.set(file.fileName,file.source)},path));assert.deepEqual(Object.keys(manifest),Object.keys(original));assert.ok(files.size>0);
 for(const [key,url]of Object.entries(manifest)){const bytes=Buffer.from(original[key].split(',')[1],'base64'),hash=createHash('sha256').update(bytes).digest('hex');assert.match(url,new RegExp('^/catalogue-images/'+hash+'\\.(jpg|png|webp|gif)$'));assert.deepEqual(files.get(url.slice(1)),bytes);}
 assert.equal(plugin.load.call({},resolve('package.json')),undefined);
});
