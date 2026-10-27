import { mkdir, readFile, readdir, unlink, stat } from 'node:fs/promises';
import { join, isAbsolute } from 'node:path';
import { randomUUID } from 'node:crypto';
import { inspectBackup } from '../core/backup.mjs';
import { DomainError } from '../core/commands.mjs';
import { atomicWrite } from './filesystem.mjs';

export async function writeBackup(path, text) {
  await inspectBackup(text);
  await atomicWrite(path, text, bytes => inspectBackup(bytes.toString('utf8')));
}
function validateConfig(config) {
  if (!config || typeof config.enabled !== 'boolean' || !Number.isInteger(config.intervalMinutes) || config.intervalMinutes < 5 || config.intervalMinutes > 1440 || !Number.isInteger(config.retention) || config.retention < 1 || config.retention > 100 || !/^[a-f0-9-]{36}$/.test(config.owner)) throw new DomainError('invalid_backup_preferences');
  if (config.externalDirectory !== null && (typeof config.externalDirectory !== 'string' || config.externalDirectory.length > 4096 || !isAbsolute(config.externalDirectory))) throw new DomainError('invalid_backup_preferences');
  return config;
}
async function readJson(path) {
  if ((await stat(path)).size > 100000) throw new DomainError('invalid_backup_preferences');
  return JSON.parse(await readFile(path, 'utf8'));
}

export class BackupManager {
  constructor(repository, dataDirectory) {
    this.repository = repository; this.dataDirectory = dataDirectory;
    this.localDirectory = join(dataDirectory, 'backups');
    this.configPath = join(dataDirectory, 'backup-preferences.json');
    this.statusPath = join(dataDirectory, 'backup-history.json');
    this.config = { enabled: true, intervalMinutes: 30, retention: 7, externalDirectory: null, owner: randomUUID() };
    this.history = { lastLocal: null, lastExternal: null, lastManual: null, lastError: null };
    this.running = null;
  }
  async initialise() {
    await mkdir(this.localDirectory, { recursive: true });
    try { this.config = validateConfig(await readJson(this.configPath)); }
    catch (error) {
      if (error.code === 'ENOENT') await atomicWrite(this.configPath, JSON.stringify(this.config));
      else this.history.lastError = { code: 'invalid_backup_preferences', date: new Date().toISOString(), destination: this.localDirectory };
    }
    try {
      const history = await readJson(this.statusPath);
      for (const key of ['lastLocal', 'lastExternal', 'lastManual', 'lastError']) {
        const item = history[key];
        if (item && typeof item.date === 'string' && Number.isFinite(Date.parse(item.date)) && typeof item.destination === 'string') this.history[key] ??= item;
      }
    } catch { /* An unavailable status log must not block operational data. */ }
    return this.status();
  }
  status() { return { ...this.config, owner: undefined, ...structuredClone(this.history), localDirectory: this.localDirectory, running: Boolean(this.running) }; }
  async configure(patch) {
    if (!patch || Object.keys(patch).some(key => !['enabled', 'intervalMinutes', 'retention'].includes(key))) throw new DomainError('invalid_backup_preferences');
    const next = validateConfig({ ...this.config, ...patch });
    await atomicWrite(this.configPath, JSON.stringify(next)); this.config = next;
    return this.status();
  }
  async chooseExternal(directory) {
    const next = validateConfig({ ...this.config, externalDirectory: directory });
    await atomicWrite(this.configPath, JSON.stringify(next)); this.config = next;
    return this.status();
  }
  async recordManual(destination) {
    this.history.lastManual = { date: new Date().toISOString(), destination };
    await this.persistStatus();
  }
  async persistStatus() { await atomicWrite(this.statusPath, JSON.stringify(this.history)); }
  async retain(directory) {
    const suffix = `-${this.config.owner}-automatic.ricamobackup`;
    const files = (await readdir(directory)).filter(name => name.startsWith('Ricamo-') && name.endsWith(suffix)).sort().reverse();
    for (const name of files.slice(this.config.retention)) await unlink(join(directory, name));
  }
  async run(label = 'automatic') {
    if (!['automatic', 'before-restore', 'manual-local'].includes(label)) throw new DomainError('invalid_backup_label');
    if (this.running) {
      await this.running;
      if (label === 'before-restore') return this.run(label);
      return this.status();
    }
    this.running = this.perform(label);
    try { await this.running; }
    finally { this.running = null; }
    return this.status();
  }
  async perform(label) {
    const date = new Date().toISOString();
    const filename = `Ricamo-${date.replace(/[:.]/g, '-')}-${this.config.owner}-${label}.ricamobackup`;
    this.history.lastError = null;
    try {
      const text = await this.repository.backup();
      await mkdir(this.localDirectory, { recursive: true });
      const path = join(this.localDirectory, filename);
      await writeBackup(path, text);
      this.history.lastLocal = { date, destination: path };
      if (label === 'automatic') await this.retain(this.localDirectory);
      if (this.config.externalDirectory && label !== 'before-restore') {
        try {
          const externalPath = join(this.config.externalDirectory, filename);
          await writeBackup(externalPath, text);
          this.history.lastExternal = { date, destination: externalPath };
          if (label === 'automatic') await this.retain(this.config.externalDirectory);
        } catch (error) { this.history.lastError = { code: 'external_backup_failed', date, destination: this.config.externalDirectory }; }
      }
      await this.persistStatus();
    } catch (error) {
      this.history.lastError = { code: error.code || 'backup_failed', date, destination: this.localDirectory };
      await this.persistStatus().catch(() => {});
      throw error;
    }
  }
  start() {
    this.stop();
    this.timer = setInterval(() => {
      if (!this.config.enabled || this.running) return;
      const elapsed = Date.now() - Date.parse(this.history.lastLocal?.date || '1970-01-01');
      if (elapsed >= this.config.intervalMinutes * 60000) this.run().catch(() => {});
    }, 60000);
    this.timer.unref?.();
  }
  stop() { clearInterval(this.timer); }
}
