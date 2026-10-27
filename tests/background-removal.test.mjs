import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {once} from 'node:events';
import {generate,prepareBackground,validateSettings} from '../src/engine/adapter.mjs';
import {portableRevision,validatePortableRevision} from '../core/project-portable-pattern.mjs';
import {counts} from '../core/pattern.mjs';

const palette={brand:'Synthetic',source:'test',colors:[{code:'00',name:'Black',hex:'#000000',rgb:[0,0,0]},{code:'01',name:'White',hex:'#ffffff',rgb:[255,255,255]}]};
const background={mode:'remove',color:'#ffffff',tolerance:0};
function motif(){const bytes=new Uint8ClampedArray(5*5*4).fill(255);for(let y=1;y<4;y++)for(let x=1;x<4;x++)if(x!==2||y!==2)bytes.set([0,0,0,255],(y*5+x)*4);return bytes}
test('Border removal preserves enclosed white, caller bytes and exact portable regeneration',()=>{
  const rgba=motif(),original=rgba.slice(),settings={width:5,height:5,maxColors:2,background};
  const prepared=prepareBackground(rgba,background,5,5);
  assert.equal(prepared[3],0);assert.equal(prepared[(2*5+2)*4+3],255);assert.deepEqual(rgba,original);
  const revision=generate({rgba,palette,settings});assert.equal(counts(revision).full,9);assert.equal(revision.colors[revision.cells[12]].code,'01');assert.equal(revision.provenance.adapterVersion,4);assert.equal(revision.provenance.alphaPolicy.emptyBelow,128);
  const portable=portableRevision({...revision,id:'r'},false);validatePortableRevision(portable,{revisionIds:new Set(['r']),attachmentIds:new Set()});
  assert.deepEqual(generate({rgba,palette,settings:portable.settings}).cells,revision.cells);
});
test('Tolerance only expands matching edge regions; malformed geometry and settings reject',()=>{
  const rgba=motif();rgba.set([250,250,250,255],0);
  assert.equal(prepareBackground(rgba,background,5,5)[3],255);
  assert.equal(prepareBackground(rgba,{...background,tolerance:3},5,5)[3],0);
  assert.equal(prepareBackground(rgba,{...background,tolerance:3},5,5)[(2*5+2)*4+3],255);
  assert.throws(()=>prepareBackground(rgba,background,6,5),{code:'engine.pixelLength'});
  for(const value of [{...background,tolerance:-1},{...background,tolerance:81},{...background,tolerance:NaN},{...background,tolerance:'3'},{...background,sourcePath:'private'},{mode:'remove',color:'#fff'}])assert.throws(()=>validateSettings({width:5,height:5,background:value}),{code:'engine.background'});
  assert.throws(()=>generate({rgba:new Uint8ClampedArray(100).fill(255),palette,settings:{width:5,height:5,background}}),{code:'engine.emptyImage'});
});
test('Actual worker removes the opaque border while retaining the enclosed white cell',async()=>{
  const path=new URL('../src/engine/worker.js',import.meta.url).href;
  const worker=new Worker(new URL(`data:text/javascript,${encodeURIComponent(`import {parentPort} from 'node:worker_threads';globalThis.self={postMessage:value=>parentPort.postMessage(value)};await import(${JSON.stringify(path)});parentPort.on('message',data=>self.onmessage({data}));`)}`),{type:'module'});
  try{worker.postMessage({id:'remove',rgba:motif(),palette,settings:{width:5,height:5,maxColors:2,background}});const[result]=await once(worker,'message');assert.equal(result.id,'remove');assert.equal(result.error,undefined);assert.equal(counts(result.result).full,9);assert.equal(result.result.colors[result.result.cells[12]].code,'01');}finally{await worker.terminate();}
});
