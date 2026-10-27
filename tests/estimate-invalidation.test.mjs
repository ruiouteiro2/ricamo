import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, executeCommand } from '../core/application.mjs';
import { createBlank } from '../core/pattern.mjs';
function fixture() {
  let state = createState(), sequence = 0;
  const run = (type, payload) => { state = executeCommand(state, { type, payload, operationId: `op-${++sequence}` }, { now: '2026-10-27T10:00:00Z', id: () => `generated-${++sequence}` }); return state; };
  run('material.save', { id: 'thread', name: 'Six strand cotton', category: 'thread', code: '001', unit: 'm', strands: 6, divisible: true });
  run('material.save', { id: 'manual', name: 'Manual requirement', unit: 'm' });
  run('material.save', { id: 'fabric-item', name: 'Fabric', category: 'fabric', unit: 'piece' });
  run('lot.add', { id: 'fabric', materialId: 'fabric-item', quantity: 1, properties: { widthCm: 20, heightCm: 20, countX: 14, countY: 14, countMeaning: 'stitches' } });
  const revision = createBlank(10, 10, [{ code: '001', name: 'Cotton', hex: '#aa2255', rgb: [170, 34, 85], symbol: 'A', strands: 2, itemId: 'thread' }], { id: 'r1' }); revision.cells.fill(0);
  run('pattern.save', { id: 'pattern', name: 'Test chart', revision });
  run('project.save', { id: 'project', name: 'Test work', patternId: 'pattern', fabricLotId: 'fabric', settings: { fabric: { overX: 1, overY: 1 } } });
  run('need.save', { projectId: 'project', materialId: 'manual', quantity: 99, source: 'manual' });
  run('project.estimate', { projectId: 'project' });
  return { get state() { return state; }, run, project: () => state.projects.find(row => row.id === 'project'), auto: () => state.needs.find(row => row.projectId === 'project' && row.source === 'pattern') };
}
test('actual fabric count changes archive the old estimate without altering physical stock or manual needs', () => {
  const s = fixture(), previous = s.auto().quantity, stock = structuredClone(s.state.lots);
  s.run('lot.save', { id: 'fabric', properties: { ...s.state.lots[0].properties, countX: 18 } });
  assert.equal(s.auto(), undefined); assert.equal(s.state.needs[0].quantity, 99);
  const history = s.project().settings.threadEstimateHistory[0];
  assert.equal(history.fabric.countX, 14); assert.equal(history.needs[0].quantity, previous); assert.equal(history.reason, 'fabric_changed');
  assert.equal(s.state.lots[0].quantity, stock[0].quantity);
  s.run('project.estimate', { projectId: 'project' });
  assert.ok(s.auto().quantity < previous); assert.equal(s.project().settings.threadEstimate.fabric.countX, 18);
});
test('margin-only edits preserve estimates while changed strand conversions invalidate them', () => {
  const s = fixture(), previous = s.auto().quantity;
  s.run('project.save', { id: 'project', settings: { ...s.project().settings, fabric: { ...s.project().settings.fabric, marginCm: 5 } } });
  assert.equal(s.auto().quantity, previous); assert.ok(s.project().settings.threadEstimate);
  s.run('material.save', { id: 'thread', strands: 3 });
  assert.equal(s.auto(), undefined); assert.equal(s.project().settings.threadEstimateHistory[0].reason, 'conversion_changed');
  s.run('project.estimate', { projectId: 'project' }); assert.ok(Math.abs(s.auto().quantity - previous * 2) <= .000001);
});
test('published revisions remain pinned until explicit change and duplicates inherit no estimate work history', () => {
  const s = fixture(), previous = s.auto().quantity;
  const revision = structuredClone(s.state.patterns[0].revisions[0]); revision.id = 'r2'; revision.cells[0] = -1;
  s.run('pattern.save', { id: 'pattern', revision });
  assert.equal(s.project().revisionId, 'r1'); assert.equal(s.auto().quantity, previous);
  s.run('project.save', { id: 'project', revisionId: 'r2', acceptRevisionChange: true });
  assert.equal(s.auto(), undefined); assert.equal(s.project().settings.threadEstimateHistory[0].needs[0].revisionId, 'r1');
  s.run('project.estimate', { projectId: 'project' });
  const movements = structuredClone(s.state.movements);
  s.run('project.duplicate', { id: 'project' });
  const copy = s.state.projects.find(row => row.id !== 'project');
  assert.equal(copy.settings.threadEstimate, undefined); assert.equal(copy.settings.threadEstimateHistory, undefined);
  assert.deepEqual(copy.completed, []); assert.deepEqual(s.state.movements, movements);
});
