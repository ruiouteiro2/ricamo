import test from 'node:test';
import assert from 'node:assert/strict';
import {createBlank} from '../core/pattern.mjs';
import {normalizePatternFabric} from '../core/pattern-fabric.mjs';
import {bundledSupplierProducts} from '../core/supplier-products.mjs';
import {colorFromProduct} from '../core/pattern-materials.mjs';
import {suggestPatternEffects} from '../core/pattern-effect-suggestions.mjs';
const products=bundledSupplierProducts();
const bead={...products.find(p=>p.category==='embellishment'),beadSizeMm:3};
const thread=products.find(p=>p.category==='thread');
const palette=[{brand:'Synthetic',code:'black',name:'Black',hex:'#111111',rgb:[17,17,17],symbol:'A'},{brand:'Synthetic',code:'white',name:'White',hex:'#ffffff',rgb:[255,255,255],symbol:'B'}];
function highlights(){const r=createBlank(9,9,palette,{settings:{fabric:normalizePatternFabric({countX:25.4,countY:25.4})}});r.cells.fill(0);for(const y of [2,4,6])for(const x of [2,4,6])r.cells[y*9+x]=1;return r;}
test('Bead candidates use actual millimetre pitch and avoid overlap without mutating the chart',()=>{
  const revision=highlights(),before=structuredClone(revision),result=suggestPatternEffects(revision,{mode:'beads',product:bead,gapMm:.25});
  assert.equal(result.eligible,9);assert.equal(result.points.length,4);assert.equal(result.spacing.pitchX,1);
  for(const a of result.points)for(const b of result.points)if(a!==b)assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=3.25);
  assert.deepEqual(revision,before);
});
test('Unknown bead size, missing fabric and unknown existing bead footprints block automatic placement',()=>{
  const revision=highlights();assert.equal(suggestPatternEffects(revision,{mode:'beads',product:{...bead,beadSizeMm:null}}).reason,'effectBeadSizeRequired');
  const missing=structuredClone(revision);delete missing.settings.fabric;assert.equal(suggestPatternEffects(missing,{mode:'beads',product:bead}).reason,'effectFabricRequired');
  revision.formatVersion=2;revision.colors.push({...colorFromProduct({...bead,beadSizeMm:null}),symbol:'C'});revision.cells[4*9+4]=2;
  assert.equal(suggestPatternEffects(revision,{mode:'beads',product:bead}).reason,'effectExistingSizeRequired');
});
test('Existing physical beads exclude nearby highlights, and uniform white backgrounds are not isolated highlights',()=>{
  const revision=highlights();revision.formatVersion=2;revision.colors.push({...colorFromProduct({...bead,beadSizeMm:4}),symbol:'C'});revision.cells[4*9+4]=2;
  const result=suggestPatternEffects(revision,{mode:'beads',product:bead});assert.equal(result.points.length,0);
  const white=highlights();white.cells.fill(1);assert.equal(suggestPatternEffects(white,{mode:'beads',product:bead}).eligible,0);
});
test('Wool requires explicit embroidery suitability; low-chroma suggestions stay bounded and distinct',()=>{
  const revision=highlights();revision.colors[0]={...palette[0],rgb:[150,150,150],hex:'#969696'};revision.cells.fill(0);
  const wool={...thread,type:'embroidery wool',name:'Synthetic embroidery wool',suitability:'embroidery-declared'};
  assert.equal(suggestPatternEffects(revision,{mode:'wool',product:{...wool,suitability:null}}).reason,'effectWoolRequired');
  assert.equal(suggestPatternEffects(revision,{mode:'wool',product:{...wool,suitability:'verify-technique'}}).reason,'effectEmbroideryRequired');
  const result=suggestPatternEffects(revision,{mode:'wool',product:wool,maxCandidates:12});assert.equal(result.eligible,81);assert.equal(result.points.length,12);assert.equal(new Set(result.points.map(p=>`${p.x},${p.y}`)).size,12);
  assert.equal(suggestPatternEffects(revision,{mode:'metallic',product:thread}).reason,'effectMetallicRequired');
  assert.throws(()=>suggestPatternEffects(revision,{mode:'wool',product:wool,maxCandidates:1001}));
});
test('Declared metallic thread can highlight actual bright cells, never transparent cells or a product of another category',()=>{
  const revision=highlights(),metallic={...thread,type:'metallic thread',name:'Synthetic metallic'};
  assert.equal(suggestPatternEffects(revision,{mode:'metallic',product:metallic}).points.length,9);
  revision.cells.fill(-1);assert.equal(suggestPatternEffects(revision,{mode:'metallic',product:metallic}).points.length,0);
  assert.equal(suggestPatternEffects(revision,{mode:'beads',product:metallic}).reason,'effectWrongProduct');
});
