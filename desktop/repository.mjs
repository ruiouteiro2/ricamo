import { preparePatternAssetCommand } from '../core/pattern-asset.mjs';
import { createProjectPackage, projectExportManifest, projectImportAssets, projectImportCommand, importedProjectId } from '../core/project-package.mjs';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { executeCommand, createState, validateApplicationState } from '../core/application.mjs';
import { DomainError } from '../core/commands.mjs';
import { detectFile, safeDisplayName, boundedBytes } from '../core/files.mjs';
import { createBackup } from '../core/backup.mjs';

export class Repository {
  constructor(path) {
    // Inspect an existing file without journal changes or schema writes, including
    // future data versions that this application must never downgrade.
    if (path !== ':memory:' && existsSync(path)) {
      const probe = new DatabaseSync(path, { readOnly: true });
      try {
        const version = probe.prepare('PRAGMA user_version').get().user_version;
        if (version > 1) throw new DomainError('unsupported_schema');
        const tables = probe.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
        if (tables.some(row => row.name === 'application_state')) {
          const row = probe.prepare('SELECT revision,data FROM application_state WHERE id=1').get();
          if (!row) throw new DomainError('invalid_storage');
          const state = JSON.parse(row.data);
          validateApplicationState(state);
          if (row.revision !== state.revision) throw new DomainError('invalid_revision');
        } else if (tables.length || version !== 0) throw new DomainError('unsupported_schema');
      } finally { probe.close(); }
    }
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    try {
    const version = this.db.prepare('PRAGMA user_version').get().user_version;
    if (version > 1) throw new DomainError('unsupported_schema');
    if (version === 1) validateApplicationState(this.load());
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
    this.db.exec(`CREATE TABLE IF NOT EXISTS application_state (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS assets (id TEXT PRIMARY KEY, data BLOB NOT NULL);
      PRAGMA user_version=1;`);
    this.db.prepare('INSERT OR IGNORE INTO application_state(id,revision,data) VALUES(1,0,?)').run(JSON.stringify(createState()));
    validateApplicationState(this.load());
    } catch (error) { this.db.close(); throw error; }
  }
  load() { return JSON.parse(this.db.prepare('SELECT data FROM application_state WHERE id=1').get().data); }
  execute(command, expectedRevision, asset = null) {
    const serialized = JSON.stringify(command);
    if (serialized.length > 16 * 1024 * 1024) throw new DomainError('data_too_large');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const current = this.load();
      const previous = current.operations.find(row => row.id === command.operationId);
      if (!previous && current.revision !== expectedRevision) throw new DomainError('stale_revision');
      const next = executeCommand(current, command);
      const assets = asset ? (Array.isArray(asset) ? asset : [asset]) : [];
      if (next.revision !== current.revision) for (const item of assets) this.db.prepare('INSERT INTO assets(id,data) VALUES(?,?)').run(item.id, item.data);
      this.db.prepare('UPDATE application_state SET revision=?,data=? WHERE id=1').run(next.revision, JSON.stringify(next));
      this.db.exec('COMMIT');
      return next;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  importAsset({ name, data, operationId }, expectedRevision) {
    const bytes = boundedBytes(data);
    const mime = detectFile(bytes), digest = createHash('sha256').update(bytes).digest('hex');
    const state = this.load();
    const existing = state.attachments.find(item => item.digest === digest);
    if (existing) return { state, asset: existing, duplicate: true };
    const id = randomUUID();
    const payload = { id, name: safeDisplayName(name), mime, size: bytes.length, digest };
    const next = this.execute({ type: 'attachment.add', payload, operationId }, expectedRevision, { id, data: bytes });
    return { state: next, asset: next.attachments.find(item => item.id === id), duplicate: false };
  }
  createPatternWithAsset({ name, data, pattern, operationId }, expectedRevision) {
    const bytes = new Uint8Array(boundedBytes(data));
    const metadata = { name: safeDisplayName(name), mime: detectFile(bytes), size: bytes.length, digest: createHash('sha256').update(bytes).digest('hex') };
    const prepared = preparePatternAssetCommand(this.load(), metadata, pattern, operationId);
    const state = this.execute(prepared.command, expectedRevision, prepared.duplicateAsset ? null : { id: prepared.assetId, data: bytes });
    return { state, asset: state.attachments.find(row => row.id === prepared.assetId), patternId: prepared.patternId, duplicateAsset: prepared.duplicateAsset };
  }
  getAsset(id) {
    if (typeof id !== 'string' || !/^[a-zA-Z0-9_.:-]{1,128}$/.test(id)) throw new DomainError('invalid_id');
    const row = this.db.prepare('SELECT data FROM assets WHERE id=?').get(id);
    if (!row) throw new DomainError('file_not_found');
    return new Uint8Array(row.data);
  }
  async backup() {
    // Snapshot both metadata and immutable BLOBs in the same read transaction.
    this.db.exec('BEGIN');
    let state, assets;
    try {
      state = this.load();
      assets = this.db.prepare('SELECT id,data FROM assets').all().map(row => ({ id: row.id, data: new Uint8Array(row.data) }));
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    return createBackup(state, assets);
  }
  restore(prepared, expectedRevision) {
    validateApplicationState(prepared.state);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const current = this.load();
      if (current.revision !== expectedRevision) throw new DomainError('stale_revision');
      const state = structuredClone(prepared.state);
      state.revision = current.revision + 1;
      this.db.exec('DELETE FROM assets');
      for (const asset of prepared.assets) this.db.prepare('INSERT INTO assets(id,data) VALUES(?,?)').run(asset.id, asset.data);
      this.db.prepare('UPDATE application_state SET revision=?,data=? WHERE id=1').run(state.revision, JSON.stringify(state));
      this.db.exec('COMMIT');
      return state;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
async exportProject(projectId, options = {}) {
  this.db.exec('BEGIN');
  let state, assets;
  try {
    state = this.load();
    const manifest = projectExportManifest(state, projectId, options);
    const ids = new Set([...manifest.requiredAttachmentIds, ...(options.attachmentIds || [])]);
    assets = [...ids].map(id => ({ id, data: this.getAsset(id) }));
    this.db.exec('COMMIT');
  } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  return createProjectPackage(state, projectId, assets, options);
}
importProject(prepared, decisions, expectedRevision, operationId) {
  const current = this.load();
  const assets = projectImportAssets(current, prepared, operationId);
  const command = projectImportCommand(prepared, decisions, operationId, expectedRevision);
  const state = this.execute(command, expectedRevision, assets);
  return { state, projectId: importedProjectId(operationId) };
}

  close() { this.db.close(); }
}
