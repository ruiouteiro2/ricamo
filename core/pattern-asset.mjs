import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { assert, assertSafeJson, identifier } from './shared.mjs';

/** Stable IDs keep a retried operation identical after its first commit. */
export function preparePatternAssetCommand(state, asset, pattern, operationId) {
  identifier(operationId, 'operationId');
  assert(pattern && typeof pattern === 'object' && !Array.isArray(pattern), 'invalid_payload');
  assertSafeJson(pattern);
  const operationHash = bytesToHex(sha256(utf8ToBytes(operationId)));
  const existing = state.attachments.find(row => row.digest === asset.digest);
  const metadata = { ...asset, id: existing?.id ?? `asset:${asset.digest}` };
  const payload = structuredClone(pattern);
  payload.id = payload.id ?? `pattern:${operationHash}`;
  payload.sourceAttachmentId = metadata.id;
  payload.kind = payload.kind ?? 'structured';
  assert(['structured', 'reference'].includes(payload.kind), 'invalid_pattern_kind');
  if (payload.kind === 'structured') {
    assert(metadata.mime.startsWith('image/'), 'invalid_file_type');
    assert(payload.revision && typeof payload.revision === 'object' && !Array.isArray(payload.revision), 'pattern_content_required');
    payload.revision.id = payload.revision.id ?? `revision:${operationHash}`;
    const provenance = payload.revision.provenance ?? {}, source = provenance.source ?? {};
    assert(provenance && typeof provenance === 'object' && !Array.isArray(provenance) && source && typeof source === 'object' && !Array.isArray(source), 'invalid_asset_provenance');
    assert(source.digest === undefined || source.digest === metadata.digest, 'asset_digest_mismatch');
    payload.revision.provenance = { ...provenance, source: { ...source, attachmentId: metadata.id, digest: metadata.digest } };
  } else assert(payload.revision === undefined || payload.revision === null, 'invalid_pattern_kind');
  const command = { type: 'pattern.createWithAsset', operationId, payload: { asset: metadata, pattern: payload } };
  assert(JSON.stringify(command).length <= 16 * 1024 * 1024, 'data_too_large');
  return { command, assetId: metadata.id, patternId: payload.id, duplicateAsset: Boolean(existing) };
}

/** Called only by the asset-aware storage bridge; generic renderer commands deny this command. */
export function createPatternWithAsset(state, payload, context, { saveAttachment, savePattern }) {
  const { asset, pattern } = payload;
  assert(!state.patterns.some(row => row.id === pattern.id), 'duplicate_pattern');
  const existing = state.attachments.find(row => row.id === asset.id);
  if (existing) assert(existing.digest === asset.digest && existing.mime === asset.mime && existing.size === asset.size, 'asset_digest_mismatch');
  else saveAttachment(state, asset, context);
  assert(pattern.sourceAttachmentId === asset.id, 'invalid_asset_provenance');
  savePattern(state, pattern, context);
}
