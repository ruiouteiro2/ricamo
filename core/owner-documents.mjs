import { assert, identifier, find, stringList, audit } from './shared.mjs';

export const DOCUMENT_OWNERS = Object.freeze({ 'purchase.attach': 'purchases', 'receipt.attach': 'receipts', 'location.attach': 'locations' });
export function validateDocumentIntent(payload) {
  assert(payload && typeof payload === 'object' && !Array.isArray(payload), 'invalid_payload');
  assert(Object.keys(payload).every(key => ['id','attachments'].includes(key)), 'document_fields_immutable');
  identifier(payload.id);
}
function appendDocuments(collection, entity, state, payload, context) {
  validateDocumentIntent(payload);
  const owner = find(state, collection, payload.id), incoming = stringList(payload.attachments, 'attachments');
  incoming.forEach(id => find(state, 'attachments', id));
  const references = [...new Set([...(owner.attachments || []), ...incoming])];
  assert(references.length <= 100, 'invalid_attachments');
  const added = references.filter(id => !(owner.attachments || []).includes(id));
  if (!added.length) return;
  owner.attachments = references;
  audit(state, context, entity, owner.id, 'documents_added', { attachmentIds: added });
}
export const documentOwnerHandlers = Object.fromEntries(Object.entries(DOCUMENT_OWNERS).map(([type,collection]) => [type, (state,payload,context) => appendDocuments(collection,type.split('.')[0],state,payload,context)]));

/** Metadata is projected only from IDs referenced by this export's owners. */
export function documentMetadataIndex(state) {
  const byId = new Map(state.attachments.map(row => [row.id,row]));
  return ids => [...new Set(ids)].map(id => {
    const row = byId.get(id); assert(row, 'missing_attachment');
    return { id: row.id, name: row.name, mime: row.mime, size: row.size, digest: row.digest };
  });
}
