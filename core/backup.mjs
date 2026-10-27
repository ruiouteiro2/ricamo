import { APP_VERSION } from './version.mjs';
import { validateApplicationState } from './application.mjs';
import { FileError, BACKUP_LIMIT, digestBytes, bytesToBase64, base64ToBytes, detectFile } from './files.mjs';

export async function createBackup(state, assets) {
  validateApplicationState(state);
  const content = { state, assets: assets.map(asset => ({ id: asset.id, data: bytesToBase64(asset.data) })) };
  const payload = JSON.stringify(content);
  const bytes = new TextEncoder().encode(payload);
  if (bytes.length > BACKUP_LIMIT) throw new FileError('backup_too_large');
  const envelope = JSON.stringify({ format: 'ricamo-backup', version: 1, appVersion: APP_VERSION, createdAt: new Date().toISOString(), sha256: await digestBytes(bytes), payload });
  if (new TextEncoder().encode(envelope).length > BACKUP_LIMIT) throw new FileError('backup_too_large');
  return envelope;
}

export async function inspectBackup(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > BACKUP_LIMIT) throw new FileError('backup_too_large');
  let envelope, content;
  try { envelope = JSON.parse(text); } catch { throw new FileError('invalid_backup'); }
  if (envelope.format !== 'ricamo-backup' || envelope.version !== 1 || typeof envelope.payload !== 'string') throw new FileError('unsupported_backup');
  if (await digestBytes(new TextEncoder().encode(envelope.payload)) !== envelope.sha256) throw new FileError('backup_integrity');
  try { content = JSON.parse(envelope.payload); } catch { throw new FileError('invalid_backup'); }
  validateApplicationState(content.state);
  if (!Array.isArray(content.assets) || content.assets.length !== content.state.attachments.length) throw new FileError('backup_assets');
  const assets = [], ids = new Set();
  for (const asset of content.assets) {
    const metadata = content.state.attachments.find(row => row.id === asset.id);
    if (!metadata || ids.has(asset.id)) throw new FileError('backup_assets');
    ids.add(asset.id);
    const data = base64ToBytes(asset.data);
    if (data.length !== metadata.size || await digestBytes(data) !== metadata.digest || detectFile(data) !== metadata.mime) throw new FileError('backup_integrity');
    assets.push({ id: asset.id, data });
  }
  return { state: content.state, assets, createdAt: envelope.createdAt, appVersion: envelope.appVersion,
    summary: { materials: content.state.materials.length, projects: content.state.projects.length, patterns: content.state.patterns.length, attachments: assets.length } };
}
