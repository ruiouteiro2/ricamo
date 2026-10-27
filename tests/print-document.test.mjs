import test from 'node:test';
import assert from 'node:assert/strict';
import { documentPrintPlan, documentPrintBatches, printPdfDocument } from '../src/print-document.mjs';

test('document printing preserves PDF physical dimensions and page order', () => {
  const rows = documentPrintPlan([{ width: 612, height: 792 }, { width: 1190.5511811, height: 841.8897638 }]);
  assert.ok(Math.abs(rows[0].widthMm - 215.9) < .00001); assert.ok(Math.abs(rows[0].heightMm - 279.4) < .00001);
  assert.equal(rows[0].canvasWidth, 1224); assert.equal(rows[0].canvasHeight, 1584);
  assert.ok(Math.abs(rows[1].widthMm - 420) < .00001); assert.ok(Math.abs(rows[1].heightMm - 297) < .00001);
  assert.equal(rows[1].canvasWidth, 2382); assert.equal(rows[1].canvasHeight, 1684);
});

test('document printing rejects malformed, oversized and excessive total raster work before rendering', () => {
  for (const row of [null, undefined, { width: -1, height: 1 }, { width: NaN, height: 1 }, { width: 1, height: Infinity }]) assert.throws(() => documentPrintPlan([row]), { code: 'print_document_invalid' });
  for (const rows of [[], Array.from({length:201},()=>({width:1,height:1})), [{width:5000,height:10}], Array.from({length:200},()=>({width:612,height:792}))]) assert.throws(() => documentPrintPlan(rows), { code: 'print_document_limit' });
  assert.equal(documentPrintPlan(Array.from({length:20},()=>({width:612,height:792}))).length, 20);
});


test('invalid bytes and cancelled preparation never enter document rendering', async () => {
  await assert.rejects(printPdfDocument(new Uint8Array()), { code: 'print_document_limit' });
  await assert.rejects(printPdfDocument('https://example.com/document.pdf'), { code: 'print_document_limit' });
  const controller = new AbortController(); controller.abort();
  assert.equal(await printPdfDocument(new Uint8Array([1]), { signal: controller.signal }), false);
});


test('large complete charts adapt uniformly between 96 and 144 dpi inside the retained-pixel budget', () => {
  for (const count of [75,120]) {
    const rows = documentPrintPlan(Array.from({length:count},()=>({width:595.28,height:841.89})));
    assert.equal(rows.length,count);
    assert.ok(rows.every(row=>row.scale>=96/72 && row.scale<=2));
    assert.equal(new Set(rows.map(row=>row.scale)).size,1);
    assert.ok(rows.reduce((sum,row)=>sum+row.canvasWidth*row.canvasHeight,0)<=128_000_000);
    assert.ok(rows[0].scale<2, 'full chart should fit by adapting its resolution');
    assert.ok(Math.abs(rows[0].widthMm-210)<.01);
  }
});


test('Five hundred readable A4 pages split into bounded jobs without dropping or duplicating pages',()=>{
 const dimensions=Array.from({length:500},()=>({width:595.28,height:841.89}));
 const jobs=documentPrintBatches(dimensions);assert.ok(jobs.length>1);
 assert.deepEqual(jobs.flatMap(job=>job.plan.map((_,index)=>job.start+index)),Array.from({length:500},(_,i)=>i));
 for(const job of jobs){assert.ok(job.plan.length<=200);assert.ok(job.plan.reduce((sum,row)=>sum+row.canvasWidth*row.canvasHeight,0)<=128000000);assert.ok(job.plan.every(row=>row.scale>=96/72));}
 assert.throws(()=>documentPrintBatches([...dimensions,dimensions[0]]),{code:'print_document_limit'});
 assert.throws(()=>documentPrintBatches([{width:10,height:10},{width:Infinity,height:10}]),{code:'print_document_invalid'});
});
