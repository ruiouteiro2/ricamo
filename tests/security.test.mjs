import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Repository } from '../desktop/repository.mjs';
import { createState, executeCommand } from '../core/application.mjs';
import { inspectBackup } from '../core/backup.mjs';
import { digestBytes, FILE_LIMIT } from '../core/files.mjs';

const command = (type, payload, operationId = crypto.randomUUID()) => ({ type, payload, operationId });
const materialState = () => executeCommand(createState(), command('material.createWithLot', {
  material: { id: 'thread', name: 'Synthetic thread', code: '001', category: 'thread', unit: 'm' },
  lot: { id: 'thread-lot', quantity: null },
}));
async function envelope(state) {
  const payload = JSON.stringify({ state, assets: [] });
  return JSON.stringify({ format: 'ricamo-backup', version: 1, appVersion: '0.1.0', createdAt: '2026-10-27T00:00:00Z', sha256: await digestBytes(new TextEncoder().encode(payload)), payload });
}
const fixture = () => { const directory = mkdtempSync(join(tmpdir(), 'ricamo-security-')); return { path: join(directory, 'library.sqlite'), cleanup: () => rmSync(directory, { recursive: true, force: true }) }; };

test('asset import rejects scalar allocation and oversized bytes before allocating another buffer', () => {
  const repo = new Repository(':memory:');
  try {
    const baseline = process.memoryUsage().arrayBuffers;
    assert.throws(() => repo.importAsset({ name: 'scalar.png', data: FILE_LIMIT + 1024 * 1024, operationId: 'scalar' }, 0));
    assert.ok(process.memoryUsage().arrayBuffers - baseline < 1024 * 1024, 'numeric IPC data must not become a privileged allocation size');
    const oversized = new Uint8Array(FILE_LIMIT + 1);
    const allocated = process.memoryUsage().arrayBuffers;
    assert.throws(() => repo.importAsset({ name: 'oversized.png', data: oversized, operationId: 'oversized' }, 0));
    assert.ok(process.memoryUsage().arrayBuffers - allocated < 1024 * 1024, 'oversized input must be rejected before a duplicate allocation');
    assert.equal(repo.load().revision, 0);
    assert.equal(repo.load().attachments.length, 0);
  } finally { repo.close(); }
});

test('malformed but correctly hashed backups cannot replace persisted state', async () => {
  const repo = new Repository(':memory:');
  try {
    repo.execute(command('material.save', { id: 'existing', name: 'Preserved material' }), 0);
    const before = JSON.stringify(repo.load());
    for (const [field, value] of [['tags', undefined], ['tags', null], ['tags', {}], ['properties', undefined], ['properties', null], ['properties', []]]) {
      const state = materialState();
      if (value === undefined) delete state.materials[0][field]; else state.materials[0][field] = value;
      const serialized = await envelope(state);
      await assert.rejects(() => inspectBackup(serialized), `invalid material.${field} must not pass restore preflight`);
    }
    assert.equal(JSON.stringify(repo.load()), before);
  } finally { repo.close(); }
});

test('valid backup retains unknown quantities and leading-zero catalogue codes', async () => {
  const state = materialState();
  const prepared = await inspectBackup(await envelope(state));
  assert.equal(prepared.state.materials[0].code, '001');
  assert.equal(prepared.state.lots[0].quantity, null);
  assert.equal(prepared.state.lots[0].confidence, 'unknown');
});

test('attachment references must be validated before a command becomes durable', () => {
  const f = fixture(); let repo = new Repository(f.path);
  try {
    const before = JSON.stringify(repo.load());
    assert.throws(() => repo.execute(command('material.save', { id: 'broken', name: 'Synthetic', attachments: ['missing-attachment'] }), 0));
    assert.equal(JSON.stringify(repo.load()), before);
    repo.close(); repo = new Repository(f.path);
    assert.equal(repo.load().revision, 0);
    assert.equal(repo.load().materials.length, 0);
  } finally { repo.close(); f.cleanup(); }
});

test('command dispatch rejects inherited Object methods without incrementing revision', () => {
  const repo = new Repository(':memory:');
  try {
    for (const type of ['toString', 'constructor', 'valueOf', '__defineGetter__']) {
      assert.throws(() => repo.execute(command(type, {}), 0), { code: 'unknown_command' });
    }
    assert.equal(repo.load().revision, 0);
    assert.equal(repo.load().operations.length, 0);
  } finally { repo.close(); }
});

for (const marker of ['sqlite', 'application']) test(`future ${marker} schema rejection leaves original database bytes and tables unchanged`, () => {
  const f = fixture();
  try {
    const raw = new DatabaseSync(f.path);
    if (marker === 'sqlite') raw.exec("CREATE TABLE future_data(id INTEGER PRIMARY KEY,value TEXT); INSERT INTO future_data VALUES(1,'Synthetic future data'); PRAGMA user_version=2;");
    else {
      raw.exec('CREATE TABLE application_state(id INTEGER PRIMARY KEY,revision INTEGER NOT NULL,data TEXT NOT NULL); PRAGMA user_version=1;');
      raw.prepare('INSERT INTO application_state VALUES(1,0,?)').run(JSON.stringify({ ...createState(), schemaVersion: 2 }));
    }
    const tablesBefore = raw.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
    raw.close();
    const before = readFileSync(f.path);
    assert.throws(() => new Repository(f.path), { code: 'unsupported_schema' });
    assert.deepEqual(readFileSync(f.path), before);
    const check = new DatabaseSync(f.path, { readOnly: true });
    try { assert.deepEqual(check.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all(), tablesBefore); }
    finally { check.close(); }
  } finally { f.cleanup(); }
});

test('stock retries remain idempotent and conflicting or stale commands remain atomic', () => {
  const repo = new Repository(':memory:');
  try {
    repo.execute(command('material.createWithLot', { material: { id: 'm', name: 'Synthetic', unit: 'm' }, lot: { id: 'l', quantity: 10 } }), 0);
    const consume = command('stock.move', { lotId: 'l', kind: 'consume', quantity: 3 }, 'retry-stock');
    repo.execute(consume, 1); repo.execute(consume, 1);
    assert.throws(() => repo.execute({ ...consume, payload: { ...consume.payload, quantity: 2 } }, 2), { code: 'idempotency_conflict' });
    assert.throws(() => repo.execute({ ...consume, operationId: 'stale-stock' }, 1), { code: 'stale_revision' });
    assert.equal(repo.load().lots[0].quantity, 7);
    assert.equal(repo.load().revision, 2);
    assert.equal(repo.load().movements.filter(row => row.kind === 'consume').length, 1);
  } finally { repo.close(); }
});
