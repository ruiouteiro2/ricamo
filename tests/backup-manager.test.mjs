import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Repository } from '../desktop/repository.mjs';
import { BackupManager, writeBackup } from '../desktop/backup-manager.mjs';
import { inspectBackup } from '../core/backup.mjs';

test('automatic snapshots verify before retention and survive unavailable external destinations', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'ricamo-backups-'));
  const repository = new Repository(join(directory, 'app.sqlite'));
  try {
    const manager = new BackupManager(repository, directory); await manager.initialise();
    await manager.configure({ retention: 1, intervalMinutes: 5 });
    const other = join(directory, 'backups', 'unrelated.ricamobackup'); writeFileSync(other, 'keep');
    const file = join(directory, 'not-a-directory'); writeFileSync(file, 'file');
    await manager.chooseExternal(file);
    const first = await manager.run();
    assert.equal(first.lastError.code, 'external_backup_failed'); assert.equal(first.running, false);
    await inspectBackup(readFileSync(first.lastLocal.destination, 'utf8'));
    repository.execute({ type: 'material.save', operationId: 'm', payload: { id: 'm', name: '001' } }, 0);
    const second = await manager.run();
    const checked = await inspectBackup(readFileSync(second.lastLocal.destination, 'utf8'));
    assert.equal(checked.state.materials[0].name, '001');
    assert.equal(readdirSync(join(directory, 'backups')).filter(name => name.endsWith('-automatic.ricamobackup')).length, 1);
    assert.equal(readFileSync(other, 'utf8'), 'keep');
    const reloaded = new BackupManager(repository, directory); await reloaded.initialise();
    assert.equal(reloaded.status().retention, 1); assert.equal(reloaded.status().lastLocal.destination, second.lastLocal.destination);
    await assert.rejects(manager.configure({ externalDirectory: directory }), { code: 'invalid_backup_preferences' });
  } finally { repository.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('invalid replacement never replaces a good backup or removes the last recoverable snapshot', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'ricamo-backup-atomic-'));
  const repository = new Repository(':memory:');
  try {
    const manager = new BackupManager(repository, directory); await manager.initialise();
    const first = await manager.run(); const original = readFileSync(first.lastLocal.destination, 'utf8');
    await assert.rejects(writeBackup(first.lastLocal.destination, '{}'));
    assert.equal(readFileSync(first.lastLocal.destination, 'utf8'), original);
    manager.repository = { backup: async () => { throw Object.assign(new Error(), { code: 'ENOSPC' }); } };
    await assert.rejects(manager.run(), { code: 'ENOSPC' });
    assert.equal(readFileSync(first.lastLocal.destination, 'utf8'), original);
    assert.equal(manager.status().lastError.code, 'ENOSPC');
    assert.equal(readdirSync(join(directory, 'backups')).some(name => name.endsWith('.tmp')), false);
  } finally { repository.close(); rmSync(directory, { recursive: true, force: true }); }
});
