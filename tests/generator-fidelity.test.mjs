import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {createCanvas} from '@napi-rs/canvas';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {generate,DEFAULT_SETTINGS,validateSettings,dmcPalette} from '../src/engine/adapter.mjs';
import {LIMITS,SYMBOLS,validateRevision} from '../core/pattern.mjs';
import {portableRevision,validatePortableRevision} from '../core/project-portable-pattern.mjs';
import {normalizePatternFabric,fabricGridFromCm} from '../core/pattern-fabric.mjs';
import {patternPdf} from '../src/pattern-export.mjs';
import {fontBytes,boldFontBytes} from './pdf-helpers.mjs';
const colours=Array.from({length:500},(_,i)=>{const rgb=[i%10*25,Math.floor(i/10)%10*25,Math.floor(i/100)*50];return{brand:'Synthetic',code:String(i).padStart(3,'0'),name:`Colour ${i}`,rgb,hex:'#'+rgb.map(v=>v.toString(16).padStart(2,'0')).join('')}});
const palette={brand:'Synthetic',source:'Synthetic 500-colour fixture',approximate:true,colors:colours};
const rgba=new Uint8ClampedArray(colours.flatMap(c=>[...c.rgb,255]));
test('Fidelity defaults retain every exact available colour through 500-colour portable revisions',()=>{
 assert.equal(DEFAULT_SETTINGS.mode,'detail');assert.equal(DEFAULT_SETTINGS.region,0);assert.equal(DEFAULT_SETTINGS.maxColors,500);assert.equal(LIMITS.colors,500);assert.equal(new Set(SYMBOLS).size,500);
 const result=generate({rgba,palette,settings:{width:500,height:1}});assert.equal(result.colors.length,500);assert.equal(new Set(result.colors.map(c=>c.symbol)).size,500);assert.ok(result.colors.every(c=>c.symbol.length<=2));
 assert.deepEqual(result.cells.map(i=>result.colors[i].code),colours.map(c=>c.code));assert.equal(result.provenance.cleanup.changedCells,0);assert.equal(result.provenance.algorithm,'nearest-CIELAB-CIE76');assert.equal(result.provenance.iterations,0);validateRevision(result);const portable=portableRevision(result,true);validatePortableRevision(portable);assert.deepEqual(portable.cells,result.cells);assert.deepEqual(portable.colors,result.colors);assert.throws(()=>validateSettings({maxColors:501}),{code:'engine.settingRange'});
});
test('Detail mode keeps adjacent RGB tones that the earlier 8-level input rounding merged',()=>{
 const tones={...palette,colors:[101,102].map(v=>({code:String(v),name:String(v),rgb:[v,v,v],hex:'#'+v.toString(16).repeat(3)}))};
 const result=generate({rgba:new Uint8ClampedArray([101,101,101,255,102,102,102,255]),palette:tones,settings:{width:2,height:1,maxColors:2}});assert.equal(result.colors.length,2);assert.deepEqual(result.cells.map(i=>result.colors[i].code),['101','102']);
});
test('Centimetres respect linen over two and unequal fabric counts; persisted portable settings retain identity',()=>{
 const fabric=normalizePatternFabric({type:'linen',countX:32,countY:36,countMeaning:'threads',overX:2,overY:2,brand:'Zweigart',code:'065-141',url:'https://www.casacenina.com/zweigart.html'}),grid=fabricGridFromCm({widthCm:25.4,heightCm:25.4},fabric);assert.equal(grid.width,160);assert.equal(grid.height,180);assert.equal(grid.widthCm,25.4);assert.equal(grid.heightCm,25.4);
 const result=generate({rgba:new Uint8ClampedArray([0,0,0,255]),palette,settings:{width:1,height:1,fabric,count:16}});assert.deepEqual(result.settings.fabric,fabric);const portable=portableRevision(result,true);validatePortableRevision(portable);assert.deepEqual(portable.settings.fabric,fabric);assert.deepEqual(portable.provenance.parameters.fabric,fabric);assert.throws(()=>fabricGridFromCm({widthCm:200,heightCm:200},fabric),{code:'pattern_fabric_size'});
});
test('A real PDF contains unique two-character chart symbols and every 100-colour legend reference',async()=>{
 const old=globalThis.document;globalThis.document={createElement:()=>createCanvas(1,1)};
 try{const result=generate({rgba:rgba.slice(0,400),palette:{...palette,colors:colours.slice(0,100)},settings:{width:10,height:10}}),bytes=await patternPdf(result,{locale:'en',title:'Fidelity legend',fontBytes,boldFontBytes}),task=getDocument({data:bytes,useSystemFonts:false});
 try{const pdf=await task.promise;let text='';for(let i=1;i<=pdf.numPages;i++)text+=(await(await pdf.getPage(i)).getTextContent()).items.map(item=>item.str??'').join(' ')+' ';assert.match(text,/Colour 99/);assert.match(text,/\bAA\b/);assert.match(text,/Full crosses: 100/);}finally{await task.destroy();}
 }finally{if(old===undefined)delete globalThis.document;else globalThis.document=old;}
});
test('Full available palette generation is bounded and measured for a detailed 300 × 300 image',t=>{
 const input=new Uint8ClampedArray(300*300*4);for(let y=0;y<300;y++)for(let x=0;x<300;x++)input.set([Math.round(x/299*255),Math.round(y/299*255),(x*7+y*11)%256,255],(y*300+x)*4);
 const start=performance.now(),result=generate({rgba:input,palette:dmcPalette,settings:{width:300,height:300}}),elapsed=performance.now()-start;assert.equal(result.cells.length,90000);assert.ok(result.colors.length>80);assert.ok(result.colors.length<=500);t.diagnostic(`300×300 detailed full-palette conversion: ${elapsed.toFixed(1)} ms, ${result.colors.length} colours`);assert.ok(elapsed<120000);
});
test('Malformed fabric metadata is rejected at revision import, before persistence or printing',()=>{
 const valid=generate({rgba:new Uint8ClampedArray([0,0,0,255]),palette,settings:{width:1,height:1,fabric:{type:'linen',countX:32,countY:32,countMeaning:'threads',overX:2,overY:2}}});
 for(const fabric of [{...valid.settings.fabric,countX:null},{...valid.settings.fabric,countX:0},{...valid.settings.fabric,url:'javascript:alert(1)'},{...valid.settings.fabric,countMeaning:'stitches',overX:2},null]){const broken=structuredClone(valid);broken.settings.fabric=fabric;assert.throws(()=>validateRevision(broken));}
});
