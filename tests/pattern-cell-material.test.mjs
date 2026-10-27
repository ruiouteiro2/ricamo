import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import {createBlank,counts,validateRevision,addHalfStitch,addBackstitch,copySelection,pasteSelection,rotate,resize} from '../core/pattern.mjs';
import {assignCellMaterial} from '../core/pattern-cell-material.mjs';
import {colorFromProduct,beadFootprint} from '../core/pattern-materials.mjs';
import {bundledSupplierProducts} from '../core/supplier-products.mjs';
import {workProgress} from '../core/work-companion.mjs';
import {createState,executeCommand} from '../core/application.mjs';
import {projectProgress} from '../core/projects.mjs';
import {projectForecast} from '../core/project-forecast.mjs';
import {matchingRevisionProgress} from '../core/revision-progress.mjs';
import {portableRevision,remapPortableRevision,colorMaterialIds} from '../core/project-portable-pattern.mjs';
import {prepareStandalonePattern} from '../core/pattern-import.mjs';
import {drawPattern} from '../src/pattern-render.mjs';

const thread={brand:'DMC',range:'Mouliné',code:'310',name:'Black',hex:'#000000',rgb:[0,0,0],strands:2,symbol:'A'};
const fabric={type:'linen',countX:32,countY:32,countMeaning:'threads',overX:2,overY:2};
const product={...bundledSupplierProducts().find(row=>row.category==='embellishment'),beadSizeMm:2.5};
const bead=colorFromProduct(product,{attachmentThread:{...thread,strands:1}});
function revision(){const row=createBlank(3,2,[thread],{id:'r1',settings:{fabric}});row.cells.fill(0);return row;}
let sequence=0;
const run=(state,type,payload)=>executeCommand(state,{type,payload,operationId:`cell-${++sequence}`},{now:'2026-10-27T16:00:00Z',id:()=>`cell-${++sequence}`});

test('Two bead placements replace two crosses, retain their fastening thread and survive geometry transforms',()=>{
 const original=revision(),result=assignCellMaterial(original,[[0,0],[1,0]],bead);
 assert.deepEqual(original.cells,[0,0,0,0,0,0]);assert.equal(result.formatVersion,2);
 const metrics=counts(result);assert.equal(metrics.full,4);assert.equal(metrics.bead,2);assert.equal(metrics.total,6);
 assert.equal(result.colors[1].attachmentThread.strands,1);
 assert.throws(()=>validateRevision({...result,formatVersion:1}));
 assert.throws(()=>addHalfStitch(result,{id:'h',x:0,y:0,color:1,direction:'/'}));
 assert.throws(()=>addBackstitch(result,{id:'b',x1:0,y1:0,x2:1,y2:1,color:1}));
 const selection=copySelection(result,{x:0,y:0,width:2,height:1});
 const pasted=pasteSelection(createBlank(3,2),rotate(selection),0,0);
 assert.equal(counts(pasted).bead,2);assert.equal(pasted.formatVersion,2);
 assert.equal(counts(resize(pasted,4,3)).bead,2);
 const footprint=beadFootprint(bead,fabric);assert.ok(Math.abs(footprint.x-2.5/(25.4/16))<1e-12);assert.equal(footprint.overlaps,true);
});

test('Bead progress and timed work are distinct from crosses and never consume stock',()=>{
 const row=assignCellMaterial(revision(),[[0,0],[1,0]],bead);
 let state=run(createState(),'pattern.save',{id:'p',name:'Mixed materials',revision:row});
 state=run(state,'project.save',{id:'project',name:'Sampler',patternId:'p'});
 state=run(state,'project.progress',{projectId:'project',completed:['c:0','c:2']});
 assert.deepEqual(projectProgress(state,'project').bead,{completed:1,total:2});
 assert.deepEqual(projectProgress(state,'project').cross,{completed:1,total:4});
 assert.equal(workProgress(row,['c:0','c:0','c:2']).byKind.bead.done,1);
 assert.deepEqual(state.movements,[]);assert.deepEqual(state.reservations,[]);
 state=run(state,'project.forecastSettings',{projectId:'project',method:'manual',weeklyHours:1,manualSeconds:{full:10,bead:20}});
 const forecast=projectForecast(state,'project',{asOf:'2026-10-27'});
 assert.equal(forecast.byKind.find(row=>row.kind==='bead').remaining,1);
 assert.ok(Math.abs(forecast.stitchingMinutes-50/60)<1e-12);
});

test('Changing a completed cross into a bead does not carry its completion into the new revision',()=>{
 let state=run(createState(),'pattern.save',{id:'p',name:'Sampler',revision:revision()});
 state=run(state,'project.save',{id:'project',name:'Sampler',patternId:'p'});
 state=run(state,'project.progress',{projectId:'project',completed:['c:0','c:1']});
 const changed=assignCellMaterial(revision(),[[0,0]],bead);changed.id='r2';
 state=run(state,'pattern.save',{id:'p',name:'Sampler',revision:changed});
 const before=state.projects[0],after={...before,revisionId:'r2'};
 assert.deepEqual(matchingRevisionProgress(state,before,after).completed,['c:1']);
});

test('Portable patterns retain product facts and detach or remap fastening-thread inventory bindings',()=>{
 const row=assignCellMaterial(revision(),[[0,0]],{...bead,itemId:'bead-stock',attachmentThread:{...thread,itemId:'thread-stock'}});
 const portable=portableRevision(row,false);assert.equal(portable.formatVersion,2);assert.equal(portable.colors[1].product.url,product.url);
 assert.deepEqual(colorMaterialIds(portable.colors[1]),['bead-stock','thread-stock']);
 const mapped=remapPortableRevision(row,{id:'copy',materialMap:new Map([['bead-stock','b2'],['thread-stock','t2']]),attachmentMap:new Map(),revisionMap:new Map()});
 assert.equal(mapped.colors[1].attachmentThread.itemId,'t2');
 const detached=prepareStandalonePattern(row);assert.equal(detached.detachedBindings,2);assert.equal(detached.revision.colors[1].attachmentThread.itemId,undefined);
 assert.throws(()=>validateRevision({...row,colors:[thread,{...row.colors[1],attachmentThread:{...bead,strands:1}}]}));
});

test('Beads render as physical circular footprints, and monochrome output remains achromatic',()=>{
 const row=assignCellMaterial(revision(),[[1,0]],{...bead,product:{...product,beadSizeMm:null}});
 const canvas=createCanvas(60,40);drawPattern(canvas,row,{cellSize:20});
 const rgba=(x,y)=>[...canvas.getContext('2d').getImageData(x,y,1,1).data];
 assert.deepEqual(rgba(1,1).slice(0,3),[0,0,0]);assert.deepEqual(rgba(21,1).slice(0,3),[255,254,250]);
 drawPattern(canvas,row,{cellSize:20,monochrome:true,symbols:true,grid:true});
 const data=canvas.getContext('2d').getImageData(0,0,60,40).data;
 for(let i=0;i<data.length;i+=4){assert.equal(data[i],data[i+1]);assert.equal(data[i+1],data[i+2]);}
});

test('selecting a supplier product retains new pack facts without changing other cells',()=>{
 const product=bundledSupplierProducts().find(p=>p.brand==='DMC'&&p.range==='Mouliné'&&p.code==='310');
 const base=createBlank(2,1,[thread]);base.cells.fill(0);
 const chosen=colorFromProduct(product),next=assignCellMaterial(base,[[0,0]],chosen);
 assert.equal(next.colors[next.cells[0]].product.id,product.id);
 assert.equal(next.cells[1],0);assert.equal(next.colors[0].product,undefined);
 const repeated=assignCellMaterial(next,[[1,0]],chosen);assert.equal(repeated.colors.length,next.colors.length);assert.equal(repeated.cells[0],repeated.cells[1]);
});
