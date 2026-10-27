import {isBead} from './pattern-materials.mjs';
import {matchingRevisionProgress} from './revision-progress.mjs';
import {resetWorkView,workMarkers} from './work-companion.mjs';
import {normalizeProjectSettings} from './thread-estimate-history.mjs';
import { validateSessionWorkAssignment, validateSessionWork } from './session-work.mjs';
import { add, subtract, assert, quantity, text, oneOf, integer, currency, date, stringList, jsonObject, find, optionalRef, recordId, put, activeProject, audit } from './shared.mjs';

export const PROJECT_STATUSES = ['idea', 'preparing', 'ready', 'active', 'paused', 'finishing', 'completed', 'archived'];

export function projectRevision(state, project) {
  if (!project.patternId) return null;
  const pattern = find(state, 'patterns', project.patternId);
  if (pattern.kind === 'reference') return null;
  const revision = pattern.revisions?.find(r => r.id === project.revisionId);
  assert(revision, 'revision_not_found', { patternId: project.patternId, revisionId: project.revisionId });
  return revision;
}

export function saveProject(state, p, ctx) {
  const id = recordId(state, 'projects', p, ctx), existing = state.projects.find(row => row.id === id);
  const source = { ...existing, ...p };
  const patternId = optionalRef(state, 'patterns', source.patternId);
  const pattern = patternId ? find(state, 'patterns', patternId) : null;
  const revisionId = pattern?.kind === 'structured' ? text(source.revisionId || pattern.currentRevisionId, 'revisionId', { required: true, max: 128 }) : null;
  if (revisionId) assert(pattern.revisions?.some(r => r.id === revisionId), 'revision_not_found');
  const status = oneOf(source.status ?? 'idea', PROJECT_STATUSES, 'status');
  if (['completed', 'archived'].includes(status) && !['completed', 'archived'].includes(existing?.status)) {
    assert(!state.reservations.some(r => r.projectId === id && r.quantity > 0), 'close_project_first');
  }
  const designChanged = existing && (existing.patternId !== patternId || existing.revisionId !== revisionId);
  if (p.revisionReview !== undefined) {
    const review=p.revisionReview;
    assert(designChanged && review && typeof review==='object' && !Array.isArray(review) && Object.keys(review).every(key=>['stateRevision','patternId','revisionId','carryProgress'].includes(key)) && typeof review.carryProgress==='boolean','revision_review_invalid');
    assert(Number.isInteger(review.stateRevision) && review.stateRevision===state.revision && review.patternId===existing.patternId && review.revisionId===existing.revisionId,'revision_review_stale');
  }
  if (designChanged && (existing.completed.length || existing.manualPercent || existing.referenceData?.annotations?.length || existing.referenceData?.bookmarks?.length || workMarkers(existing.view).length)) assert(p.acceptRevisionChange === true, 'revision_change_confirmation');
  const project = {
    id, name: text(source.name, 'name', { required: true, max: 300 }),
    technique: text(source.technique ?? 'cross_stitch', 'technique', { required: true, max: 100 }),
    description: text(source.description, 'description', { max: 10000 }), notes: text(source.notes, 'notes', { max: 20000 }),
    recipient: text(source.recipient, 'recipient', { max: 300 }), priority: oneOf(source.priority ?? 'normal', ['low', 'normal', 'high'], 'priority'),
    status, dueDate: date(source.dueDate, 'dueDate'), completedAt: date(source.completedAt, 'completedAt'),
    patternId, revisionId, fabricLotId: optionalRef(state, 'lots', source.fabricLotId),
    budget: integer(source.budget, 'budget', { nullable: true }), currency: currency(source.currency ?? state.settings.currency),
    settings: normalizeProjectSettings(source.settings,{state}), tags: stringList(source.tags), attachments: stringList(source.attachments, 'attachments'),
    completed: designChanged ? [] : (existing?.completed ?? []),
    manualPercent: designChanged ? 0 : (existing?.manualPercent ?? 0),
    view: designChanged ? resetWorkView(existing.view) : existing?.view ?? {}, progressHistory: existing?.progressHistory ?? [],
    ...(!designChanged && existing?.referenceData ? { referenceData: existing.referenceData } : {}),
    ...(source.catalogueReferences !== undefined ? { catalogueReferences: structuredClone(source.catalogueReferences) } : {}),
    createdAt: existing?.createdAt ?? ctx.now, updatedAt: ctx.now,
  };
  if(!existing && project.settings.fabric===undefined){const fabric=pattern?.library?.design?.fabric??pattern?.revisions?.find(row=>row.id===revisionId)?.settings?.fabric;if(fabric)project.settings.fabric=structuredClone(fabric);}
  if (!existing && project.settings.thread === undefined && state.settings.preferences?.threadEstimates) project.settings.thread = structuredClone(state.settings.preferences.threadEstimates);
  if (designChanged) {
    if (p.revisionReview?.carryProgress) {
      const correspondence=matchingRevisionProgress(state,existing,project);
      assert(correspondence.eligible && correspondence.matched>0,'revision_progress_unavailable');
      project.completed=correspondence.completed;
    }
    project.progressHistory.push({ patternId: existing.patternId, revisionId: existing.revisionId, completed: [...existing.completed], manualPercent: existing.manualPercent, savedAt: ctx.now, ...(existing.referenceData ? { referenceData: existing.referenceData } : {}) });
  }
  if (project.fabricLotId) assert(find(state, 'materials', find(state, 'lots', project.fabricLotId).materialId).category === 'fabric', 'not_fabric');
  put(state, 'projects', project);
  audit(state, ctx, 'project', id, existing ? 'updated' : 'created', { designChanged: !!designChanged, carriedProgress: designChanged ? project.completed.length : 0, progressCarryMethod: designChanged && p.revisionReview?.carryProgress ? 'same-grid-thread-v1' : null });
}

export function duplicateProject(state, p, ctx) {
  const source = find(state, 'projects', p.id), newId = ctx.id();
  const settings = structuredClone(source.settings);
  delete settings.threadEstimate; delete settings.threadEstimateHistory; delete settings.finishing;
  if (settings.forecast?.manualRemaining) settings.forecast.manualRemaining = { full: null, half: null, backstitch: null };
  saveProject(state, { ...source, settings, id: newId, name: p.name ?? source.name, status: 'idea', dueDate: '', completedAt: '' }, ctx);
  for (const need of state.needs.filter(n => n.projectId === source.id)) state.needs.push({ ...structuredClone(need), id: ctx.id(), projectId: newId, createdAt: ctx.now, updatedAt: ctx.now });
  for (const task of state.tasks.filter(t => t.projectId === source.id)) state.tasks.push({ ...structuredClone(task), id: ctx.id(), projectId: newId, done: false, createdAt: ctx.now, updatedAt: ctx.now });
  audit(state, ctx, 'project', newId, 'duplicated', { sourceId: source.id });
}

export function closeProject(state, p, ctx) {
  const project = find(state, 'projects', p.projectId ?? p.id);
  const status = oneOf(p.status ?? 'completed', ['completed', 'archived'], 'status');
  const released = [];
  for (const reservation of state.reservations.filter(r => r.projectId === project.id && r.quantity > 0)) {
    released.push({ lotId: reservation.lotId, quantity: reservation.quantity });
    reservation.quantity = 0;
    reservation.updatedAt = ctx.now;
  }
  project.status = status;
  project.completedAt = status === 'completed' ? ctx.now : project.completedAt;
  project.updatedAt = ctx.now;
  if (p.notes !== undefined) project.notes = text(p.notes, 'notes', { max: 20000 });
  audit(state, ctx, 'project', project.id, status, { released, consumptionCreated: false });
}

export function saveNeed(state, p, ctx) {
  const project = activeProject(state, p.projectId), material = find(state, 'materials', p.materialId);
  const previous = p.id ? find(state, 'needs', p.id) : state.needs.find(n => n.projectId === project.id && n.materialId === material.id);
  if (previous) assert(previous.projectId === project.id && previous.materialId === material.id, 'need_identity_changed');
  const amount = quantity(p.quantity, { nullable: true });
  put(state, 'needs', {
    id: previous?.id ?? ctx.id(), projectId: project.id, materialId: material.id, quantity: amount, unit: material.unit,
    source: oneOf(p.source ?? previous?.source ?? 'manual', ['manual', 'estimate', 'pattern'], 'source'),
    confidence: amount === null ? 'unknown' : oneOf(p.confidence ?? (previous?.confidence === 'unknown' ? 'estimated' : previous?.confidence) ?? 'estimated', ['exact', 'estimated'], 'confidence'),
    notes: text(p.notes ?? previous?.notes, 'notes', { max: 10000 }), createdAt: previous?.createdAt ?? ctx.now, updatedAt: ctx.now,
  });
}

export function confirmedConsumption(state, projectId, materialId) {
  const lotIds = new Set(state.lots.filter(l => l.materialId === materialId).map(l => l.id));
  const movements = state.movements.filter(m => m.projectId === projectId && (m.materialId === materialId || lotIds.has(m.lotId)));
  // Opening a kit for a project fulfils its kit-unit need; components remain physical stock.
  const consumptionIds = new Set(movements.filter(m => ['consume', 'kit_open'].includes(m.kind)).map(m => m.id));
  return Math.max(0, subtract(add(...movements.filter(m => ['consume', 'kit_open'].includes(m.kind)).map(m => m.quantity)), add(...movements.filter(m => m.kind === 'correction' && consumptionIds.has(m.reversesId)).map(m => m.quantity))));
}

export function saveTask(state, p, ctx) {
  const existing = p.id ? state.tasks.find(t => t.id === p.id) : null;
  const projectId = p.projectId ?? existing?.projectId;
  find(state, 'projects', projectId);
  if (existing) assert(existing.projectId === projectId, 'task_project_changed');
  const source = { ...existing, ...p };
  put(state, 'tasks', {
    id: recordId(state, 'tasks', p, ctx), projectId,
    title: text(source.title, 'title', { required: true, max: 500 }),
    stage: oneOf(source.stage ?? 'preparation', ['preparation', 'work', 'finishing', 'custom'], 'stage'),
    done: source.done === true, notes: text(source.notes, 'notes', { max: 10000 }),
    order: integer(source.order ?? 0, 'order', { max: 100000 }), dueDate: date(source.dueDate, 'dueDate'),
    createdAt: existing?.createdAt ?? ctx.now, updatedAt: ctx.now,
  });
}

export function saveSession(state, p, ctx, { restoreHistorical = false } = {}) {
  const existing = p.id ? state.sessions.find(s => s.id === p.id) : null;
  const projectId = p.projectId ?? existing?.projectId;
  find(state, 'projects', projectId);
  if (existing) assert(existing.projectId === projectId, 'session_project_changed');
  const source = { ...existing, ...p };
  const durationMinutes = quantity(source.durationMinutes, { field: 'durationMinutes' });
  assert(durationMinutes <= 1440, 'session_too_long');
  const session = {
    id: recordId(state, 'sessions', p, ctx), projectId,
    date: date(source.date ?? ctx.now, 'date'), durationMinutes, ...(source.work !== undefined && source.work !== null ? { work: structuredClone(source.work) } : {}),
    notes: text(source.notes, 'notes', { max: 10000 }), source: oneOf(source.source ?? 'manual', ['manual', 'timer'], 'source'),
    attachments: stringList(source.attachments, 'attachments'), createdAt: existing?.createdAt ?? ctx.now, updatedAt: ctx.now,
  };
  if (restoreHistorical) validateSessionWork(state, session);
  else validateSessionWorkAssignment(state, session, existing);
  put(state, 'sessions', session);
}

export function validProgressKeys(revision) {
  const keys = new Set();
  revision.cells.forEach((color, i) => { if (color >= 0) keys.add(`c:${i}`); });
  for (const half of revision.halfStitches ?? []) keys.add(`h:${half.id}`);
  for (const segment of revision.backstitches ?? []) keys.add(`b:${segment.id}`);
  return keys;
}

export function updateProgress(state, p, ctx) {
  const project = activeProject(state, p.projectId), revision = projectRevision(state, project);
  if (revision) {
    assert(p.manualPercent === undefined, 'structured_progress_required');
    assert((p.patternId === undefined || p.patternId === project.patternId) && (p.revisionId === undefined || p.revisionId === project.revisionId), 'stale_revision');
    assert(Array.isArray(p.completed) && p.completed.length <= 1_000_000, 'invalid_progress');
    const valid = validProgressKeys(revision);
    assert(p.completed.every(key => typeof key === 'string' && valid.has(key)), 'invalid_progress');
    const mode = oneOf(p.mode ?? 'add', ['add', 'remove', 'replace'], 'mode');
    const completed = new Set(mode === 'replace' ? [] : project.completed);
    for (const key of p.completed) { if (mode === 'remove') completed.delete(key); else completed.add(key); }
    project.completed = [...completed].sort();
  } else {
    const percent = quantity(p.manualPercent, { field: 'manualPercent' });
    assert(percent <= 100, 'invalid_progress');
    project.manualPercent = percent;
  }
  project.updatedAt = ctx.now;
}

export function saveProjectView(state, p, ctx) {
  const project = find(state, 'projects', p.projectId);
  assert(project.view.workVersion !== 1, 'work_view_command_required');
  project.view = jsonObject(p.view, 'view');
  project.updatedAt = ctx.now;
}

export function projectProgress(state, projectId) {
  const project = find(state, 'projects', projectId), revision = projectRevision(state, project);
  if (!revision) return { mode: 'manual', percent: project.manualPercent, completed: null, total: null };
  // Count geometry without allocating one string and Set entry per full cross.
  // Domain mutation/restore validation still uses validProgressKeys independently.
  let crossTotal = 0,beadTotal=0;
  for (const color of revision.cells) if (color >= 0){if(isBead(revision.colors?.[color]))beadTotal++;else crossTotal++;}
  const halfKeys = new Set((revision.halfStitches ?? []).map(row => `h:${row.id}`));
  const backKeys = new Set((revision.backstitches ?? []).map(row => `b:${row.id}`));
  const completed = project.completed.filter(key => {
    if (typeof key !== 'string') return false;
    if (key.startsWith('h:')) return halfKeys.has(key);
    if (key.startsWith('b:')) return backKeys.has(key);
    if (!/^c:(0|[1-9][0-9]*)$/.test(key)) return false;
    const index = Number(key.slice(2));
    return index < revision.cells.length && revision.cells[index] >= 0;
  });
  const total = crossTotal + beadTotal + halfKeys.size + backKeys.size;
  return { mode: 'structured', percent: total ? completed.length / total * 100 : 0, completed: completed.length, total,
    cross: { completed: completed.filter(key => key.startsWith('c:')&&!isBead(revision.colors?.[revision.cells[Number(key.slice(2))]])).length, total: crossTotal },
    bead: { completed: completed.filter(key => key.startsWith('c:')&&isBead(revision.colors?.[revision.cells[Number(key.slice(2))]])).length, total: beadTotal },
    half: { completed: completed.filter(key => key.startsWith('h:')).length, total: revision.halfStitches?.length ?? 0 },
    backstitch: { completed: completed.filter(key => key.startsWith('b:')).length, total: revision.backstitches?.length ?? 0 } };
}
