import { applyCommand, createState, validateState } from './commands.mjs';
import { assert, text, identifier, find, put, stringList } from './shared.mjs';
import { saveMaterial, addLot } from './inventory.mjs';
import { validateRevision } from './pattern.mjs';

export { createState };
const handlers = {
  'material.createWithLot': (state, payload, context) => {
    const id = payload.material.id || context.id();
    saveMaterial(state, { ...payload.material, id }, context);
    if (payload.lot) addLot(state, { ...payload.lot, materialId: id }, context);
  },
  'pattern.save': (state, p, ctx) => {
    const id = p.id ? identifier(p.id) : ctx.id();
    const existing = state.patterns.find(item => item.id === id);
    const kind = p.kind ?? existing?.kind ?? 'structured';
    assert(['structured', 'reference'].includes(kind), 'invalid_pattern_kind');
    const pattern = { ...existing, id, kind, name: text(p.name ?? existing?.name, 'name', { required: true, max: 300 }),
      notes: text(p.notes ?? existing?.notes, 'notes', { max: 20000 }), tags: stringList(p.tags ?? existing?.tags),
      sourceAttachmentId: p.sourceAttachmentId ?? existing?.sourceAttachmentId ?? null,
      favorite: p.favorite ?? existing?.favorite ?? false, archived: p.archived ?? existing?.archived ?? false,
      createdAt: existing?.createdAt ?? ctx.now, updatedAt: ctx.now, revisions: existing?.revisions ?? [] };
    if (pattern.sourceAttachmentId) find(state, 'attachments', pattern.sourceAttachmentId);
    if (p.revision) {
      assert(kind === 'structured', 'invalid_pattern_kind');
      const revision = structuredClone(p.revision);
      revision.id = revision.id ? identifier(revision.id) : ctx.id();
      assert(!pattern.revisions.some(row => row.id === revision.id), 'duplicate_revision');
      revision.parentId = pattern.currentRevisionId ?? null;
      revision.createdAt = ctx.now;
      validateRevision(revision);
      pattern.revisions = [...pattern.revisions, revision];
      pattern.currentRevisionId = revision.id;
    }
    assert(kind === 'reference' ? Boolean(pattern.sourceAttachmentId) : pattern.revisions.length > 0, 'pattern_content_required');
    put(state, 'patterns', pattern);
  },
  'pattern.duplicate': (state, p, ctx) => {
    const source = find(state, 'patterns', p.id);
    const current = source.revisions.find(row => row.id === source.currentRevisionId);
    handlers['pattern.save'](state, { ...source, id: ctx.id(), name: p.name || source.name, revision: current ? { ...current, id: ctx.id() } : undefined }, ctx);
  },
  'attachment.add': (state, p, ctx) => {
    assert(typeof p.digest === 'string' && /^[a-f0-9]{64}$/.test(p.digest), 'invalid_file_digest');
    assert(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'].includes(p.mime), 'invalid_file_type');
    assert(Number.isSafeInteger(p.size) && p.size > 0 && p.size <= 25 * 1024 * 1024, 'file_too_large');
    const id = identifier(p.id);
    assert(!state.attachments.some(row => row.id === id), 'duplicate_attachment');
    state.attachments.push({ id, name: text(p.name, 'name', { required: true, max: 250 }), mime: p.mime, size: p.size, digest: p.digest, createdAt: ctx.now });
  },
  'inventory.import': (state, p, ctx) => {
    assert(Array.isArray(p.rows) && p.rows.length > 0 && p.rows.length <= 5000, 'invalid_import');
    assert(typeof p.digest === 'string' && /^[a-f0-9]{64}$/.test(p.digest), 'invalid_file_digest');
    assert(!state.audit.some(row => row.kind === 'csv_import' && row.digest === p.digest) || p.allowRepeat === true, 'duplicate_import');
    for (const row of p.rows) {
      if (row.skip) continue;
      const id = row.materialId || ctx.id();
      if (!row.materialId) saveMaterial(state, { ...row.material, id }, ctx);
      else find(state, 'materials', id);
      if (row.lot) addLot(state, { ...row.lot, materialId: id }, ctx);
    }
    state.audit.push({ id: ctx.id(), kind: 'csv_import', digest: p.digest, date: ctx.now, rows: p.rows.filter(row => !row.skip).length });
  },
};

export function executeCommand(state, command, context = {}) {
  return applyCommand(state, command, { ...context, handlers });
}

export function validateApplicationState(state) {
  validateState(state);
  const seenAttachments = new Set();
  for (const attachment of state.attachments) {
    identifier(attachment.id);
    assert(!seenAttachments.has(attachment.id), 'duplicate_attachment');
    seenAttachments.add(attachment.id);
    assert(/^[a-f0-9]{64}$/.test(attachment.digest), 'invalid_file_digest');
    assert(Number.isSafeInteger(attachment.size) && attachment.size > 0 && attachment.size <= 25 * 1024 * 1024, 'file_too_large');
  }
  for (const pattern of state.patterns) {
    identifier(pattern.id);
    assert(['structured', 'reference'].includes(pattern.kind), 'invalid_pattern_kind');
    assert(Array.isArray(pattern.revisions), 'invalid_pattern_revisions');
    for (const revision of pattern.revisions) validateRevision(revision);
    if (pattern.kind === 'structured') assert(pattern.revisions.some(row => row.id === pattern.currentRevisionId), 'invalid_current_revision');
    if (pattern.sourceAttachmentId) assert(seenAttachments.has(pattern.sourceAttachmentId), 'missing_attachment');
  }
  return state;
}
