import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { assert, assertSafeJson, identifier } from './shared.mjs';
import { boundedBytes, detectFile, safeDisplayName } from './files.mjs';

export const ASSET_BATCH_COUNT = 20;
export const ASSET_BATCH_BYTES = 100 * 1024 * 1024;
const OWNER_TYPES = new Set(['material.save', 'material.createWithLot', 'project.save', 'session.save']);

/** Capture immutable, bounded originals before hashing or awaiting a transaction. */
export function captureAssetBatch(files) {
  assert(Array.isArray(files) && files.length <= ASSET_BATCH_COUNT, 'asset_batch_limit');
  let total = 0;
  const captured = files.map(file => {
    assert(file && typeof file.name === 'string', 'invalid_file_name');
    const bytes = boundedBytes(file.data); total += bytes.byteLength;
    assert(total <= ASSET_BATCH_BYTES, 'asset_batch_limit');
    return { name: safeDisplayName(file.name), bytes };
  });
  return captured.map(file => { const data = new Uint8Array(file.bytes); return { name: file.name, data, mime: detectFile(data), size: data.byteLength }; });
}
function validateOwner(owner) {
  assert(owner && typeof owner === 'object' && !Array.isArray(owner) && OWNER_TYPES.has(owner.type), 'invalid_asset_owner');
  assert(owner.payload && typeof owner.payload === 'object' && !Array.isArray(owner.payload), 'invalid_payload');
  assertSafeJson(owner);
  if (owner.type === 'material.createWithLot') assert(owner.payload.material && typeof owner.payload.material === 'object' && !Array.isArray(owner.payload.material), 'invalid_payload');
  return owner;
}
/** Existing domain guards and all after-hooks must see the real owner command. */
export function entityAssetOwnerCommand(command) {
  if (command.type !== 'entity.saveWithAssets') return command;
  const owner = validateOwner(command.payload?.owner);
  return { ...owner, operationId: command.operationId };
}
export function prepareEntityAssetCommand(state, metadata, owner, operationId) {
  identifier(operationId, 'operationId'); validateOwner(owner);
  assert(Array.isArray(metadata) && metadata.length <= ASSET_BATCH_COUNT, 'asset_batch_limit');
  const capturedOwner = structuredClone(owner), hash = bytesToHex(sha256(utf8ToBytes(operationId)));
  const entity = capturedOwner.type === 'material.createWithLot' ? capturedOwner.payload.material : capturedOwner.payload;
  const kind = capturedOwner.type.split('.')[0]; entity.id ??= `${kind}:${hash}`;
  identifier(entity.id);
  if (capturedOwner.type === 'material.createWithLot' && capturedOwner.payload.lot) capturedOwner.payload.lot.id ??= `lot:${hash}`;
  // Existing references are part of the caller's immutable Save intent. Do not
  // derive them from current state, which would change replay signatures later.
  assert(Array.isArray(entity.attachments ?? []), 'invalid_attachments');
  const references = [...(entity.attachments ?? [])], assets = [], fresh = [], seen = new Set();
  let size = 0;
  for (const raw of metadata) {
    size += raw.size; assert(Number.isSafeInteger(size) && size <= ASSET_BATCH_BYTES, 'asset_batch_limit');
    if (seen.has(raw.digest)) continue;
    seen.add(raw.digest);
    const existing = state.attachments.find(row => row.digest === raw.digest);
    const asset = { id: existing?.id ?? `asset:${raw.digest}`, name: raw.name, mime: raw.mime, size: raw.size, digest: raw.digest };
    assets.push(asset); if (!existing) fresh.push(asset);
    if (!references.includes(asset.id)) references.push(asset.id);
  }
  entity.attachments = references;
  const command = { type: 'entity.saveWithAssets', payload: { owner: capturedOwner, assets }, operationId };
  assert(JSON.stringify(command).length <= 16 * 1024 * 1024, 'data_too_large');
  return { command, ownerId: entity.id, assets, fresh };
}
export function saveEntityWithAssets(state, payload, context, { saveAttachment, ownerHandlers }) {
  const owner = validateOwner(payload.owner);
  assert(Array.isArray(payload.assets) && payload.assets.length <= ASSET_BATCH_COUNT, 'asset_batch_limit');
  const references = owner.type === 'material.createWithLot' ? owner.payload.material.attachments : owner.payload.attachments;
  assert(Array.isArray(references), 'invalid_attachments');
  let size = 0; const ids = new Set();
  for (const asset of payload.assets) {
    size += asset.size; assert(Number.isSafeInteger(size) && size <= ASSET_BATCH_BYTES, 'asset_batch_limit');
    assert(!ids.has(asset.id) && references.includes(asset.id), 'invalid_attachments'); ids.add(asset.id);
    const existing = state.attachments.find(row => row.id === asset.id);
    if (existing) assert(existing.digest === asset.digest && existing.mime === asset.mime && existing.size === asset.size, 'asset_digest_mismatch');
    else saveAttachment(state, asset, context);
  }
  assert(Object.hasOwn(ownerHandlers, owner.type), 'invalid_asset_owner');
  const collection = owner.type.startsWith('material.') ? 'materials' : owner.type.startsWith('project.') ? 'projects' : 'sessions';
  const entity = owner.type === 'material.createWithLot' ? owner.payload.material : owner.payload;
  const existingOwner = state[collection].find(row => row.id === entity.id);
  const savedPayload = structuredClone(owner.payload), savedEntity = owner.type === 'material.createWithLot' ? savedPayload.material : savedPayload;
  // This bridge adds attachments. Never unlink files added by another writer,
  // nor mutate/delete metadata or originals shared with another owner.
  savedEntity.attachments = [...new Set([...(existingOwner?.attachments || []), ...entity.attachments])];
  ownerHandlers[owner.type](state, savedPayload, context);
}
