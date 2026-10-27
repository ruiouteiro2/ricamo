import test from 'node:test';
import assert from 'node:assert/strict';
import { createExampleStudio, EXAMPLE_IDS } from '../core/example-studio.mjs';
import { executeCommand, validateApplicationState } from '../core/application.mjs';
import { inventorySummary } from '../core/inventory.mjs';

for (const language of ['it', 'en']) test(`isolated authored example is valid and teaches physical accounting (${language})`, () => {
  const state = createExampleStudio(language, { now: '2026-10-27T12:00:00.000Z' });
  validateApplicationState(state);
  assert.equal(state.settings.language, language);
  assert.equal(state.settings.preferences.exampleStudioVersion, 1);
  assert.equal(state.materials.length, 5); assert.equal(state.projects.length, 1); assert.equal(state.attachments.length, 0);
  assert.deepEqual(state.materials.filter(row => row.category === 'thread').map(row => row.code), ['001', '010', '100']);
  const known = state.lots.find(row => row.materialId === EXAMPLE_IDS.known);
  const estimated = state.lots.find(row => row.materialId === EXAMPLE_IDS.estimated);
  const unknown = state.lots.find(row => row.materialId === EXAMPLE_IDS.unknown);
  assert.equal(known.quantity, 7.5); assert.equal(known.confidence, 'exact');
  assert.equal(estimated.quantity, 5); assert.equal(estimated.confidence, 'estimated');
  assert.equal(unknown.quantity, null); assert.equal(unknown.confidence, 'unknown');
  assert.equal(state.reservations.find(row => row.lotId === known.id).quantity, 1.5);
  const summary = inventorySummary(state, EXAMPLE_IDS.known);
  assert.equal(summary.physical, 7.5); assert.equal(summary.reserved, 1.5); assert.equal(summary.available, 6);
  assert.equal(state.movements.filter(row => row.kind === 'consume').length, 1);
  const pattern = state.patterns.find(row => row.id === EXAMPLE_IDS.pattern), revision = pattern.revisions[0];
  assert.equal(revision.width, 12); assert.equal(revision.height, 12); assert.equal(revision.cells.length, 144);
  assert.equal(revision.provenance.source, 'ricamo-authored-example');
  const project = state.projects[0]; assert.equal(project.completed.length, 8);
  const nextCell = revision.cells.findIndex((color, index) => color >= 0 && !project.completed.includes(`c:${index}`));
  const changed = executeCommand(state, { type: 'project.progress', operationId: 'practice-progress', payload: { projectId: project.id, completed: [`c:${nextCell}`], done: true } }, { now: '2026-10-27T12:01:00.000Z' });
  assert.equal(changed.projects[0].completed.length, 9);
  assert.deepEqual(changed.lots, state.lots); assert.deepEqual(changed.reservations, state.reservations); assert.deepEqual(changed.movements, state.movements);
  assert.equal(state.sessions[0].work.count, 8); assert.equal(state.sessions[0].durationMinutes, 15);
});

test('example factory is reproducible and creates independent libraries', () => {
  const options = { now: '2026-10-27T12:00:00.000Z' };
  const first = createExampleStudio('en', options), second = createExampleStudio('en', options);
  assert.deepEqual(first, second);
  first.materials[0].name = 'Edited in one example'; first.patterns[0].revisions[0].cells[0] = 0;
  assert.notEqual(first.materials[0].name, second.materials[0].name);
  assert.equal(second.patterns[0].revisions[0].cells[0], -1);
  assert.equal(createExampleStudio('unsupported', options).settings.language, 'it');
});
