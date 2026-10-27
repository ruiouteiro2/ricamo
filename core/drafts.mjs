/** One durable work-in-progress snapshot, separate from published revisions. */
import { assert, assertSafeJson, identifier, text, find } from './shared.mjs';
import { validateRevision } from './pattern.mjs';

export function validatePatternDraft(value, { pattern } = {}) {
  assert(value && typeof value === 'object' && !Array.isArray(value), 'invalid_pattern_draft');
  assertSafeJson(value);
  assert(value.version === 1, 'unsupported_draft_version');
  identifier(value.baseRevisionId, 'baseRevisionId');
  text(value.name, 'name', { max: 300 });
  assert(typeof value.updatedAt === 'string' && Number.isFinite(Date.parse(value.updatedAt)), 'invalid_draft_date');
  validateRevision(value.revision);
  if (pattern) {
    assert(pattern.kind === 'structured', 'structured_pattern_required');
    assert(pattern.revisions.some(revision => revision.id === value.baseRevisionId), 'draft_base_not_found');
  }
  return value;
}

export const draftHandlers = {
  'pattern.draft.save': (state, payload, context) => {
    const pattern = find(state, 'patterns', payload.patternId);
    const next = { version: 1, baseRevisionId: identifier(payload.baseRevisionId, 'baseRevisionId'),
      revision: structuredClone(payload.revision), name: text(payload.name ?? payload.revision?.name, 'name', { max: 300 }), updatedAt: context.now };
    validatePatternDraft(next, { pattern });
    pattern.draft = next;
  },
  'pattern.draft.discard': (state, payload) => {
    const pattern = find(state, 'patterns', payload.patternId);
    assert(pattern.kind === 'structured', 'structured_pattern_required');
    delete pattern.draft;
  },
};
