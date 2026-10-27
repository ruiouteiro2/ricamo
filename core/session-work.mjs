import { assert, identifier, integer, oneOf, find } from './shared.mjs';
const fields = new Set(['kind', 'count', 'patternId', 'revisionId']);
/** A saved measurement owns its immutable revision references, independently of optional progress history. */
export function validateSessionWork(state, session) {
  if (session.work === undefined || session.work === null) return;
  const work = session.work;
  assert(work && typeof work === 'object' && !Array.isArray(work) && Object.keys(work).every(key => fields.has(key)), 'invalid_session_work');
  oneOf(work.kind, ['full', 'half', 'backstitch'], 'kind');
  assert(typeof work.count === 'number', 'invalid_session_work');
  integer(work.count, 'count', { min: 1, max: 10000000 });
  identifier(session.projectId); find(state, 'projects', session.projectId);
  identifier(work.patternId); identifier(work.revisionId);
  const pattern = find(state, 'patterns', work.patternId);
  assert(pattern.kind === 'structured' && pattern.revisions.some(row => row.id === work.revisionId), 'invalid_session_revision');
  assert(session.durationMinutes > 0, 'measured_session_duration');
}
/** Admit new associations only through the project's current pin or recorded progress history. */
export function validateSessionWorkAssignment(state, session, previous) {
  validateSessionWork(state, session);
  if (!session.work) return;
  const work = session.work;
  const retained = previous?.id === session.id && previous.projectId === session.projectId && previous.work?.patternId === work.patternId && previous.work?.revisionId === work.revisionId;
  if (retained) return;
  const project = find(state, 'projects', session.projectId);
  const associated = project.patternId === work.patternId && project.revisionId === work.revisionId || project.progressHistory.some(row => row.patternId === work.patternId && row.revisionId === work.revisionId);
  assert(associated, 'session_revision_mismatch');
}
