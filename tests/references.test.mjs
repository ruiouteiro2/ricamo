import test from 'node:test';
import assert from 'node:assert/strict';
import { createReferenceData, validateReferenceData, referenceHandlers, displayPoint, originalPoint, displayRect } from '../core/references.mjs';
const context = { now:'2026-10-27T12:00:00Z', operationId:'operation', id:()=>crypto.randomUUID() };
function fixture(mime='application/pdf') { return { patterns:[{id:'pattern',kind:'reference',sourceAttachmentId:'asset'}], projects:[{id:'project',patternId:'pattern',status:'active',completed:[]}], attachments:[{id:'asset',mime}], movements:[],lots:[{id:'lot',quantity:4}],audit:[] }; }
const mark = { id:'annotation',page:2,type:'text',x:.2,y:.3,color:'#634453',opacity:1,text:'Note 001' };
const run = (state, extra={}) => referenceHandlers['reference.save'](state,{patternId:'pattern',attachmentId:'asset',...extra},context);
const code = (fn,code) => assert.throws(fn,error=>error.code===code);

test('reference save preserves original, stock and progress; project and library marks are separate',()=>{
 const state=fixture();run(state,{pageCount:2,annotations:[mark]});run(state,{projectId:'project',pageCount:2,annotations:[{...mark,id:'project-mark'}]});
 assert.equal(state.patterns[0].sourceAttachmentId,'asset');assert.equal(state.patterns[0].referenceData.annotations[0].id,'annotation');assert.equal(state.projects[0].referenceData.annotations[0].id,'project-mark');assert.equal(state.movements.length,0);assert.equal(state.lots[0].quantity,4);assert.deepEqual(state.projects[0].completed,[]);
});
test('view updates preserve marks and bookmarks and permit closed project navigation',()=>{
 const state=fixture();run(state,{projectId:'project',pageCount:2,annotations:[mark],bookmarks:[{id:'b',page:2,x:0,y:.4,label:'Continue'}]});state.projects[0].status='completed';run(state,{projectId:'project',view:{page:2,zoom:2,rotation:90,scrollX:.2,scrollY:.7}});
 assert.equal(state.projects[0].referenceData.annotations.length,1);assert.equal(state.projects[0].referenceData.bookmarks.length,1);assert.equal(state.projects[0].referenceData.view.page,2);
 code(()=>run(state,{projectId:'project',annotations:[]}), 'project_closed');
});
test('wrong project, wrong attachment and nonreference patterns are rejected',()=>{
 const state=fixture();state.projects[0].patternId='other';code(()=>run(state,{projectId:'project'}),'reference_project_mismatch');code(()=>run(state,{attachmentId:'other'}),'reference_attachment_changed');state.patterns[0].kind='structured';code(()=>run(state),'reference_pattern_required');
});
test('coordinates, page bounds, duplicate identities and future formats fail before mutation',()=>{
 const state=fixture();run(state,{pageCount:2,annotations:[mark]});const before=structuredClone(state);
 code(()=>run(state,{annotations:[{...mark,x:1.1}]}),'reference_coordinate');assert.deepEqual(state,before);
 code(()=>run(state,{annotations:[mark,mark]}),'reference_duplicate_id');code(()=>run(state,{annotations:[{...mark,page:3}]}),'invalid_integer');code(()=>validateReferenceData({...createReferenceData('asset'),version:2}),'reference_version');
});
test('rectangle and line validation cannot place shapes outside page or collapse them',()=>{
 const state=fixture();run(state,{pageCount:1});
 code(()=>run(state,{annotations:[{...mark,page:1,type:'rectangle',x:.9,width:.2,height:.2}]}),'reference_coordinate');
 code(()=>run(state,{annotations:[{...mark,page:1,type:'line',x2:.2,y2:.3}]}),'reference_empty_shape');
 code(()=>run(state,{annotations:[{...mark,page:1,type:'text',text:''}]}),'required');
});
test('image references only allow one page and state remains unchanged on rejection',()=>{
 const state=fixture('image/png');run(state);assert.equal(state.patterns[0].referenceData.pageCount,1);const before=structuredClone(state);code(()=>run(state,{pageCount:2}),'reference_image_page');assert.deepEqual(state,before);code(()=>run(state,{annotations:[mark]}),'invalid_integer');
});
test('view values are bounded and annotation text is plain bounded data',()=>{
 const data=createReferenceData('asset');code(()=>validateReferenceData({...data,view:{...data.view,zoom:9}}),'reference_value');code(()=>validateReferenceData({...data,view:{...data.view,rotation:45}}),'invalid_choice');
 const state=fixture();run(state,{pageCount:2,annotations:[{...mark,text:'<script>alert(1)</script>'}]});assert.equal(state.patterns[0].referenceData.annotations[0].text,'<script>alert(1)</script>');code(()=>run(state,{annotations:[{...mark,text:'x'.repeat(2001)}]}),'invalid_text');
});
test('malformed bookmark records are rejected with a domain error',()=>{ const data=createReferenceData('asset');code(()=>validateReferenceData({...data,bookmarks:[null]}),'reference_bookmark'); });

test('normalized geometry is reversible across rotations and rectangles preserve area',()=>{
 const point={x:.23,y:.64};for(const rotation of[0,90,180,270]){const result=originalPoint(displayPoint(point,rotation),rotation);assert.ok(Math.abs(result.x-point.x)<1e-12);assert.ok(Math.abs(result.y-point.y)<1e-12);const rect=displayRect({x:.2,y:.3,width:.4,height:.2},rotation);assert.ok(Math.abs(rect.width*rect.height-.08)<1e-12)}
});
