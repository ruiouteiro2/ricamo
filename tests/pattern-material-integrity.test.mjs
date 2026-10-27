import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import {createBlank,validateRevision} from '../core/pattern.mjs';
import {colorFromProduct} from '../core/pattern-materials.mjs';
import {bundledSupplierProducts} from '../core/supplier-products.mjs';
import {makeBlendColor} from '../core/thread-recipes.mjs';
import {portableRevision} from '../core/project-portable-pattern.mjs';
import {matchingRevisionProgress} from '../core/revision-progress.mjs';
import {drawPattern} from '../src/pattern-render.mjs';
const products=bundledSupplierProducts(),a=products.find(row=>row.category==='thread'&&row.brand==='DMC'&&row.code==='310'),b=products.find(row=>row.category==='thread'&&row.brand==='DMC'&&row.code==='321');
const black=colorFromProduct(a),red=colorFromProduct(b),bead=colorFromProduct({...products.find(row=>row.category==='embellishment'),beadSizeMm:4});
function blend(){const color=makeBlendColor({code:'mix',name:'Synthetic blend',components:[{...black,strands:1},{...red,strands:1}],backComponents:[{...red,strands:1}]});color.blend.components[0].product=a;color.blend.components[1].product=b;color.blend.backComponents[0].product=b;return color;}

test('oversized bead footprints remain visible over neighbouring cross backgrounds in all directions',()=>{
 const blue={brand:'Synthetic',code:'B',name:'Blue fixture',hex:'#0000ff',rgb:[0,0,255],strands:2};const revision=createBlank(3,3,[blue,bead],{settings:{fabric:{countX:16,countY:16}}});revision.cells.fill(0);revision.cells[4]=1;
 const canvas=createCanvas(60,60);drawPattern(canvas,revision,{cellSize:20});const pixel=(x,y)=>[...canvas.getContext('2d').getImageData(x,y,1,1).data];const expected=[...bead.rgb,255];for(const [x,y]of [[10,30],[50,30],[30,10],[30,50]])assert.deepEqual(pixel(x,y),expected);assert.deepEqual(pixel(0,0),[0,0,255,255]);
});

test('beads and bead supplier products cannot masquerade as full, back or fastening blend threads',()=>{
 for(const type of ['components','backComponents'])for(const disguise of ['kind','product']){const color=blend(),part=color.blend[type][0];if(disguise==='kind')part.materialKind='bead';else part.product=bead.product;assert.throws(()=>createBlank(1,1,[color]));assert.throws(()=>createBlank(1,1,[{...bead,attachmentThread:color}]));}
 const valid=createBlank(1,1,[blend(),{...bead,attachmentThread:blend()}]);validateRevision(valid);
});

test('portable full, back and fastening blends retain normalized product and pack facts without private extras',()=>{
 const mixed=blend();mixed.blend.components[0].privateNote='Do not export this';const revision=createBlank(1,1,[mixed,{...bead,attachmentThread:blend()}],{id:'original'}),portable=portableRevision(revision,false);validateRevision(portable);
 for(const color of [portable.colors[0],portable.colors[1].attachmentThread]){assert.deepEqual(color.blend.components[0].product,a);assert.deepEqual(color.blend.components[1].product,b);assert.deepEqual(color.blend.backComponents[0].product,b);}assert.equal(portable.colors[0].blend.components[0].privateNote,undefined);
});

function correspondence(oldColor,nextColor=oldColor,materials=[]){const old=createBlank(1,1,[oldColor],{id:'old'}),next=createBlank(1,1,[nextColor],{id:'next'});old.cells=[0];next.cells=[0];const before={id:'project',patternId:'pattern',revisionId:'old',settings:{fabric:{countX:16,countY:16}},completed:['c:0']};return matchingRevisionProgress({materials,lots:[],patterns:[{id:'pattern',kind:'structured',revisions:[old,next]}]},before,{...before,revisionId:'next'});}
test('bead completion carry requires a SKU/product identity or an actual embellishment binding',()=>{
 const anonymous={...bead,brand:'',range:'',code:'',name:'Bead'};delete anonymous.product;
 assert.equal(correspondence(anonymous).matched,0);assert.equal(correspondence({...anonymous,itemId:'missing'}).matched,0);assert.equal(correspondence({...anonymous,itemId:'actual'},undefined,[{id:'actual',category:'thread'}]).matched,0);assert.equal(correspondence({...anonymous,itemId:'actual'},undefined,[{id:'actual',category:'embellishment'}]).matched,1);
 assert.equal(correspondence(bead).matched,1);assert.equal(correspondence({...bead,attachmentThread:black},{...bead,attachmentThread:red}).matched,0);
});
