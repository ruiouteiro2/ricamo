import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, executeCommand, validateApplicationState } from '../core/application.mjs';
import { projectForecast } from '../core/project-insights.mjs';
let sequence = 0;
const run = (state, type, payload, operationId = `op-${++sequence}`) => executeCommand(state, { type, payload, operationId }, { now: '2026-10-27T12:00:00Z', id: () => `id-${++sequence}` });
const revision = id => ({ id, name: id, width: 2, height: 1, cells: [0, 0], colors: [{ brand: 'DMC', code: '001', name: 'Red', hex: '#ff0000', rgb: [255, 0, 0], symbol: 'A', strands: 2 }], halfStitches: [], backstitches: [], settings: {} });
const work = { patternId: 'pattern', revisionId: 'r1', kind: 'full', count: 1 };
function fixture() {
  let state = run(createState(), 'pattern.save', { id: 'pattern', name: 'Pattern', revision: revision('r1') });
  state = run(state, 'project.save', { id: 'project', name: 'Project', patternId: 'pattern' });
  state = run(state, 'session.save', { id: 'session', projectId: 'project', date: '2026-10-26', durationMinutes: 5, work });
  state = run(state, 'pattern.save', { id: 'pattern', revision: revision('r2') });
  state = run(state, 'project.save', { id: 'project', revisionId: 'r2' });
  return state;
}
test('Retained historical measurements restore without sharing old progress or annotations', () => {
  const state = fixture();
  state.projects[0].progressHistory = [];
  validateApplicationState(state);
  const forecast = projectForecast(state, 'project', { asOf: '2026-10-27' });
  assert.equal(forecast.sampleSessions, 0);
  assert.equal(forecast.ignoredSessions, 1);
  assert.equal(forecast.stitchingMinutes, null);
  const edited = run(state, 'session.save', { id: 'session', notes: 'Corrected duration', durationMinutes: 6, work: { ...work, count: 2 } });
  assert.equal(edited.sessions[0].durationMinutes, 6);
  assert.equal(edited.sessions[0].work.count, 2);
  assert.equal(edited.sessions[0].work.revisionId, 'r1');
});
test('New sessions cannot borrow an unrelated revision or a historical association omitted from sharing', () => {
  let state = fixture();
  state.projects[0].progressHistory = [];
  const before = structuredClone(state);
  assert.throws(() => run(state, 'session.save', { projectId: 'project', durationMinutes: 3, work }), { code: 'session_revision_mismatch' });
  assert.deepEqual(state, before);
  state = run(state, 'pattern.save', { id: 'unrelated', name: 'Other', revision: revision('other') });
  const unrelated = { ...work, patternId: 'unrelated', revisionId: 'other' };
  assert.throws(() => run(state, 'session.save', { projectId: 'project', durationMinutes: 3, work: unrelated }), { code: 'session_revision_mismatch' });
  assert.throws(() => run(state, 'session.save', { id: 'session', work: unrelated }), { code: 'session_revision_mismatch' });
  state = run(state, 'session.save', { projectId: 'project', durationMinutes: 3, work: { ...work, revisionId: 'r2' } });
  assert.equal(state.sessions.length, 2);
});
test('Known project history admits new measured sessions and idempotent retries remain harmless', () => {
  let state = fixture();
  const payload = { projectId: 'project', durationMinutes: 3, work };
  state = run(state, 'session.save', payload, 'historical-session');
  const before = structuredClone(state);
  state.projects[0].progressHistory = [];
  const replayed = run(state, 'session.save', payload, 'historical-session');
  assert.equal(replayed.sessions.length, before.sessions.length);
  assert.equal(replayed.revision, before.revision);
  assert.throws(() => run(state, 'session.save', { id: 'session', projectId: 'missing' }), /not_found/);
});
test('Restore still rejects invalid immutable references, malformed work and unmeasured duration', () => {
  for (const mutate of [
    state => { state.sessions[0].projectId = 'missing'; },
    state => { state.sessions[0].work.patternId = 'missing'; },
    state => { state.sessions[0].work.revisionId = 'missing'; },
    state => { state.sessions[0].work.kind = 'guess'; },
    state => { state.sessions[0].work.count = 0; },
    state => { state.sessions[0].work.count = '1'; },
    state => { state.sessions[0].work.privateNotes = 'Hidden text'; },
    state => { state.sessions[0].durationMinutes = 0; },
  ]) {
    const state = fixture(); state.projects[0].progressHistory = []; mutate(state);
    assert.throws(() => validateApplicationState(state));
  }
});

test('Malformed work cannot silently erase a saved measurement', () => {
  const state = fixture(), before = structuredClone(state);
  for (const work of [false, 0, '', [], true]) assert.throws(() => run(state, 'session.save', { id: 'session', work }), { code: 'invalid_session_work' });
  assert.deepEqual(state, before);
  const cleared = run(state, 'session.save', { id: 'session', work: null });
  assert.equal(cleared.sessions[0].work, undefined);
});
