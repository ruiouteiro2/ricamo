import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { Repository } from '../desktop/repository.mjs';
import { createBlank } from '../core/pattern.mjs';
const png = () => Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64'));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const revision = () => ({ ...createBlank(2, 1, [{ brand: 'DMC', code: '001', name: 'Red', hex: '#ff0000', rgb: [255, 0, 0], symbol: 'A', strands: 2 }]), cells: [0, -1], provenance: { engine: 'stitch-studio', parameters: { width: 2 }, source: { digest: digest(png()), adjustments: { rotation: 90 } } } });
const imageRequest = (operationId = 'image-save') => ({ name: 'image.png', data: png(), operationId, pattern: { name: 'Image pattern', kind: 'structured', revision: revision() } });
const referenceRequest = (operationId = 'reference-save') => ({ name: 'reference.pdf', data: new TextEncoder().encode('%PDF-1.7\n%%EOF'), operationId, pattern: { name: 'Reference pattern', kind: 'reference' } });
const blobCount = repo => repo.db.prepare('SELECT COUNT(*) count FROM assets').get().count;

test('Image bytes, digest, provenance and pattern commit once and survive reopening', () => {
  const directory = mkdtempSync(join(tmpdir(), 'ricamo-atomic-pattern-')), path = join(directory, 'library.sqlite');
  let repo = new Repository(path);
  try {
    const input = imageRequest(), untouched = structuredClone(input), result = repo.createPatternWithAsset(input, 0);
    assert.equal(result.state.revision, 1); assert.equal(result.state.operations.length, 1); assert.equal(result.state.patterns.length, 1); assert.equal(blobCount(repo), 1);
    const pattern = result.state.patterns[0], source = pattern.revisions[0].provenance.source;
    assert.equal(pattern.sourceAttachmentId, result.asset.id); assert.equal(source.attachmentId, result.asset.id); assert.equal(source.digest, digest(input.data)); assert.equal(source.adjustments.rotation, 90);
    assert.deepEqual(input, untouched);
    repo.close(); repo = new Repository(path);
    assert.deepEqual(repo.getAsset(result.asset.id), input.data); assert.equal(repo.load().patterns[0].id, result.patternId);
    const replay = repo.createPatternWithAsset(input, 0);
    assert.equal(replay.state.revision, 1); assert.equal(replay.state.patterns.length, 1); assert.equal(blobCount(repo), 1);
    assert.throws(() => repo.createPatternWithAsset({ ...input, pattern: { ...input.pattern, name: 'Changed' } }, 1), { code: 'idempotency_conflict' });
  } finally { repo.close(); rmSync(directory, { recursive: true, force: true }); }
});
test('Reference creation is atomic, retries are stable and shared original files are deduplicated', () => {
  const repo = new Repository(':memory:');
  try {
    const first = repo.createPatternWithAsset(referenceRequest(), 0);
    assert.equal(first.state.revision, 1); assert.equal(first.state.patterns[0].kind, 'reference');
    assert.equal(repo.createPatternWithAsset(referenceRequest(), 0).state.patterns.length, 1);
    const second = repo.createPatternWithAsset(referenceRequest('another-pattern'), 1);
    assert.equal(second.duplicateAsset, true); assert.equal(second.asset.id, first.asset.id); assert.equal(second.state.patterns.length, 2); assert.equal(blobCount(repo), 1);
  } finally { repo.close(); }
});
test('A failure after BLOB insertion rolls back bytes, metadata, pattern, operation and revision', () => {
  const repo = new Repository(':memory:');
  try {
    const before = repo.load();
    repo.db.exec("CREATE TRIGGER fail_state BEFORE UPDATE ON application_state BEGIN SELECT RAISE(ABORT, 'synthetic state failure'); END;");
    assert.throws(() => repo.createPatternWithAsset(imageRequest(), 0), /synthetic state failure/);
    assert.deepEqual(repo.load(), before); assert.equal(blobCount(repo), 0);
    repo.db.exec('DROP TRIGGER fail_state');
    const retried = repo.createPatternWithAsset(imageRequest(), 0);
    assert.equal(retried.state.patterns.length, 1); assert.equal(blobCount(repo), 1);
  } finally { repo.close(); }
});
test('Invalid patterns, files, provenance and stale writers leave no orphan attachments', () => {
  const repo = new Repository(':memory:');
  try {
    for (const request of [
      { ...imageRequest(), pattern: { ...imageRequest().pattern, name: '' } },
      { ...imageRequest(), pattern: { ...imageRequest().pattern, revision: { ...revision(), cells: [99, -1] } } },
      { ...imageRequest(), pattern: { ...imageRequest().pattern, revision: { ...revision(), provenance: { source: { digest: '0'.repeat(64) } } } } },
      { ...imageRequest(), data: new Uint8Array([1, 2, 3]) },
      { ...imageRequest(), data: new Uint8Array(25 * 1024 * 1024 + 1) },
      { ...imageRequest(), data: referenceRequest().data },
    ]) {
      assert.throws(() => repo.createPatternWithAsset(request, 0));
      assert.equal(repo.load().revision, 0); assert.equal(repo.load().attachments.length, 0); assert.equal(blobCount(repo), 0);
    }
    repo.execute({ type: 'project.save', payload: { name: 'Other writer' }, operationId: 'other' }, 0);
    assert.throws(() => repo.createPatternWithAsset(imageRequest(), 0), { code: 'stale_revision' });
    assert.equal(repo.load().revision, 1); assert.equal(blobCount(repo), 0);
  } finally { repo.close(); }
});
test('Previously imported immutable files are reused, and creation cannot overwrite an existing pattern', () => {
  const repo = new Repository(':memory:');
  try {
    const prior = repo.importAsset({ name: 'original.png', data: png(), operationId: 'original' }, 0);
    const saved = repo.createPatternWithAsset(imageRequest(), 1);
    assert.equal(saved.asset.id, prior.asset.id); assert.equal(saved.asset.name, 'original.png'); assert.equal(blobCount(repo), 1);
    const before = repo.load();
    assert.throws(() => repo.createPatternWithAsset({ ...referenceRequest(), pattern: { ...referenceRequest().pattern, id: saved.patternId } }, before.revision), { code: 'duplicate_pattern' });
    assert.deepEqual(repo.load(), before); assert.equal(blobCount(repo), 1);
  } finally { repo.close(); }
});
