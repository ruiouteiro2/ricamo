import { command, decisions, projectPackageFixture as fixture } from './project-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Repository } from '../desktop/repository.mjs';
import { inspectProjectPackage } from '../core/project-package.mjs';
import { digestBytes } from '../core/files.mjs';

test('Portable blends preserve each physical component, back recipe, generation settings and bounded provenance', async () => {
  const { repo, asset } = fixture(), destination = new Repository(':memory:');
  try {
    const bytes = await repo.exportProject('work', { attachmentIds: [asset.id] });
    assert.doesNotMatch(bytes, /PRIVATE_/);
    const prepared = await inspectProjectPackage(bytes), revision = prepared.state.patterns[0].revisions[0];
    assert.equal(prepared.state.materials.length, 2);
    assert.deepEqual(revision.colors[0].blend.components.map(row => row.strands), [1, 2]);
    assert.equal(revision.colors[0].backStrands, 1);
    assert.equal(revision.settings.count, 14);
    assert.deepEqual(revision.settings.protectedRegions, [{ x: 0, y: 0, width: 1, height: 1 }]);
    assert.equal(revision.provenance.palette.colors[0].itemId, undefined);
    assert.deepEqual(revision.provenance.preference.indices, [0, 1]);
    const result = destination.importProject(prepared, decisions(destination, prepared), 0, randomUUID());
    const imported = result.state.patterns[0].revisions[0];
    assert.ok(imported.colors[0].blend.components.every(row => result.state.materials.some(material => material.id === row.itemId)));
    assert.equal(imported.provenance.source.attachmentId, result.state.attachments[0].id);
    assert.equal(imported.provenance.source.digest, await digestBytes(destination.getAsset(result.state.attachments[0].id)));
    const again = await inspectProjectPackage(await destination.exportProject(result.projectId, { attachmentIds: result.state.attachments.map(row => row.id) }));
    assert.deepEqual(again.state.patterns[0].revisions[0].colors[0].blend, imported.colors[0].blend);
    for (const key of ['lots', 'movements', 'reservations']) assert.equal(result.state[key].length, 0);
  } finally { repo.close(); destination.close(); }
});

test('Unselected original keeps its digest and adjustments without attachment IDs or bytes', async () => {
  const { repo, asset } = fixture();
  try {
    const prepared = await inspectProjectPackage(await repo.exportProject('work', {}));
    assert.equal(prepared.assets.length, 0);
    assert.equal(prepared.state.patterns[0].sourceAttachmentId, null);
    const source = prepared.state.patterns[0].revisions[0].provenance.source;
    assert.equal(source.attachmentId, undefined); assert.equal(source.digest, asset.digest); assert.equal(source.adjustments.width, 100);
  } finally { repo.close(); }
});

test('A blank-grid project can be shared without requiring image provenance', async () => {
  const { repo, revision } = fixture();
  try {
    command(repo, 'pattern.save', { id: 'blank', name: 'Blank grid', revision: { ...revision, id: 'blank-revision', provenance: { source: 'blank' } } });
    command(repo, 'project.save', { id: 'blank-work', name: 'Blank work', patternId: 'blank' });
    const prepared = await inspectProjectPackage(await repo.exportProject('blank-work', {}));
    assert.deepEqual(prepared.state.patterns[0].revisions[0].provenance, { source: 'blank' });
    assert.equal(prepared.assets.length, 0);
  } finally { repo.close(); }
});

test('Portable planning uses the selected piece count and keeps source defaults independent of the destination', async () => {
  const { repo } = fixture(), destination = new Repository(':memory:');
  try {
    command(repo, 'material.createWithLot', { material: { id: 'cloth', name: 'Linen', category: 'fabric', unit: 'piece' }, lot: { id: 'piece', quantity: 1, properties: { widthCm: 30, heightCm: 40, countX: 18, countY: 20, countMeaning: 'threads' } } });
    command(repo, 'project.save', { id: 'work', fabricLotId: 'piece', settings: { fabric: { countX: 14, countY: 14, countMeaning: 'stitches', overX: 2, overY: 2 } } });
    command(destination, 'settings.save', { preferences: { threadDefaults: { backStrands: 6 } } });
    const before = JSON.stringify(repo.load()), prepared = await inspectProjectPackage(await repo.exportProject('work', {}));
    assert.deepEqual(prepared.state.projects[0].settings.fabric, { countX: 18, countY: 20, overX: 2, overY: 2, countMeaning: 'threads' });
    assert.equal(JSON.stringify(repo.load()), before);
    const result = destination.importProject(prepared, decisions(destination, prepared), destination.load().revision, randomUUID());
    assert.equal(result.state.projects[0].settings.thread.backStrands, 1);
    assert.equal(result.state.settings.preferences.threadDefaults.backStrands, 6);
    assert.equal(result.state.lots.length, 0);
  } finally { repo.close(); destination.close(); }
});

test('Finishing and forecast round-trip through explicit privacy choices; new-work reset clears old delivery', async () => {
  const { repo } = fixture(), destination = new Repository(':memory:');
  try {
    command(repo, 'project.finishing', { projectId: 'work', finishedDate: '2026-10-26', deliveredDate: '2026-10-27', description: 'PRIVATE_FINISH', careInstructions: 'PRIVATE_CARE', recipientNotes: 'PRIVATE_DELIVERY' });
    command(repo, 'project.forecastSettings', { projectId: 'work', weeklyHours: 4, extraMinutes: 20 });
    const publicText = await repo.exportProject('work', {}); assert.doesNotMatch(publicText, /PRIVATE_/);
    const publicPackage = await inspectProjectPackage(publicText);
    assert.equal(publicPackage.state.projects[0].settings.finishing.finishedDate, '2026-10-26');
    assert.deepEqual(publicPackage.state.projects[0].settings.forecast, repo.load().projects.find(row=>row.id==='work').settings.forecast);
    const prepared = await inspectProjectPackage(await repo.exportProject('work', { includePrivateNotes: true, includeRecipient: true }));
    const result = destination.importProject(prepared, decisions(destination, prepared), 0, randomUUID());
    assert.equal(result.state.projects[0].settings.finishing.recipientNotes, 'PRIVATE_DELIVERY');
    const reset = destination.importProject(prepared, { ...decisions(destination, prepared), allowRepeat: true, resetProgress: true }, destination.load().revision, randomUUID());
    assert.equal(reset.state.projects.find(row => row.id === reset.projectId).settings.finishing, undefined);
  } finally { repo.close(); destination.close(); }
});

test('Inspection rejects hidden fields in portable mechanical metadata even with a recomputed digest', async () => {
  const { repo } = fixture();
  try {
    for (const mutate of [
      content => { content.state.patterns[0].revisions[0].provenance.source.ownerNotes = 'hidden'; },
      content => { content.state.patterns[0].revisions[0].colors[0].blend.components[0].notes = 'hidden'; },
      content => { content.state.projects[0].settings.ownerNotes = 'hidden'; },
    ]) {
      const envelope = JSON.parse(await repo.exportProject('work', {})), content = JSON.parse(envelope.payload);
      mutate(content); envelope.payload = JSON.stringify(content); envelope.sha256 = await digestBytes(new TextEncoder().encode(envelope.payload));
      await assert.rejects(() => inspectProjectPackage(JSON.stringify(envelope)), { code: 'project_package_privacy' });
    }
  } finally { repo.close(); }
});

test('Measured historical sessions include immutable source revisions without exporting old progress', async () => {
  const { repo, revision } = fixture(), destination = new Repository(':memory:');
  try {
    command(repo, 'session.save', { projectId: 'work', date: '2026-10-26', durationMinutes: 20, work: { kind: 'full', count: 2, patternId: 'p', revisionId: 'r1' }, notes: 'PRIVATE_SESSION' });
    command(repo, 'pattern.save', { id: 'p', revision: { ...revision, id: 'r2', cells: [0, -1] } });
    command(repo, 'project.save', { id: 'work', revisionId: 'r2', acceptRevisionChange: true });
    const prepared = await inspectProjectPackage(await repo.exportProject('work', { includeSessions: true, includeHistory: false }));
    assert.equal(prepared.state.patterns[0].revisions.length, 2); assert.equal(prepared.state.projects[0].progressHistory.length, 0);
    assert.equal(prepared.state.sessions[0].work.revisionId, 'r1'); assert.equal(prepared.state.sessions[0].notes, '');
    const result = destination.importProject(prepared, decisions(destination, prepared), 0, randomUUID());
    const session = result.state.sessions[0], project = result.state.projects[0];
    assert.notEqual(session.work.revisionId, project.revisionId);
    assert.ok(result.state.patterns.find(row => row.id === session.work.patternId).revisions.some(row => row.id === session.work.revisionId));
    assert.equal(project.progressHistory.length, 0);
    command(destination, 'session.save', { id: session.id, notes: 'Edited after import' });
    assert.equal(destination.load().sessions[0].work.count, 2);
    assert.throws(() => command(destination, 'session.save', { projectId: project.id, durationMinutes: 20, work: session.work, restoreHistorical: true }), { code: 'session_revision_mismatch' });
  } finally { repo.close(); destination.close(); }
});


test('Portable manual forecasts preserve assumptions; new-work copies clear previous remaining counts', async () => {
  const { repo } = fixture(), destination = new Repository(':memory:');
  try {
    command(repo, 'project.save', { id: 'manual-work', name: 'Reference-free embroidery' });
    command(repo, 'project.forecastSettings', { projectId: 'manual-work', method: 'manual', weeklyHours: 6, extraMinutes: 12, manualSeconds: { full: 45, half: 30 }, manualRemaining: { full: 120, half: 0, backstitch: 0 } });
    const original = repo.load().projects.find(row => row.id === 'manual-work').settings.forecast;
    const prepared = await inspectProjectPackage(await repo.exportProject('manual-work', {}));
    assert.deepEqual(prepared.state.projects[0].settings.forecast, original);
    const kept = destination.importProject(prepared, decisions(destination, prepared), 0, randomUUID());
    assert.deepEqual(kept.state.projects.find(row => row.id === kept.projectId).settings.forecast, original);
    const reset = destination.importProject(prepared, { ...decisions(destination, prepared), allowRepeat: true, resetProgress: true }, destination.load().revision, randomUUID());
    const resetForecast = reset.state.projects.find(row => row.id === reset.projectId).settings.forecast;
    assert.deepEqual(resetForecast.manualRemaining, { full: null, half: null, backstitch: null });
    assert.deepEqual(resetForecast.manualSeconds, original.manualSeconds); assert.equal(resetForecast.weeklyHours, 6);
    const before = repo.load().projects.map(row => row.id);
    command(repo, 'project.duplicate', { id: 'manual-work', name: 'New embroidery' });
    const duplicate = repo.load().projects.find(row => !before.includes(row.id));
    assert.deepEqual(duplicate.settings.forecast.manualRemaining, { full: null, half: null, backstitch: null });
    assert.deepEqual(duplicate.settings.forecast.manualSeconds, original.manualSeconds);
    assert.deepEqual(repo.load().projects.find(row => row.id === 'manual-work').settings.forecast, original);
  } finally { repo.close(); destination.close(); }
});
