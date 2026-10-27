import {normalizeProjectSettings} from './thread-estimate-history.mjs';
import { validateSessionWork } from './session-work.mjs';
export { validateSessionWork } from './session-work.mjs';
import { assert, identifier, text, integer, quantity, date, oneOf, find, audit, jsonObject } from './shared.mjs';
import { saveTask } from './projects.mjs';
const kinds = ['full', 'half', 'backstitch'];
const stages = ['preparation', 'work', 'finishing', 'custom'];
function day(value, field, optional = true) {
  const result = date(value, field);
  assert((optional && !result) || /^\d{4}-\d{2}-\d{2}$/.test(result), 'invalid_date', { field });
  return result;
}
function definition(task) {
  return { title: text(task.title, 'title', { required: true, max: 500 }), stage: oneOf(task.stage, stages, 'stage'), notes: text(task.notes, 'notes', { max: 10000 }) };
}
export function checklistTemplates(state) { return state.settings.preferences?.checklistTemplates === undefined ? [] : state.settings.preferences.checklistTemplates; }
export function checklistPreview(state, projectId, templateId, mode = 'append') {
  find(state, 'projects', projectId);
  const template = checklistTemplates(state).find(row => row.id === templateId);
  assert(template, 'template_not_found');
  oneOf(mode, ['append', 'replace_unfinished'], 'mode');
  const tasks = state.tasks.filter(row => row.projectId === projectId);
  return { template, added: template.tasks.length, removed: mode === 'replace_unfinished' ? tasks.filter(row => !row.done).length : 0, retainedCompleted: tasks.filter(row => row.done).length };
}
function saveTemplate(state, payload, ctx) {
  find(state, 'projects', payload.projectId);
  const tasks = state.tasks.filter(row => row.projectId === payload.projectId).sort((a,b) => a.order-b.order);
  assert(tasks.length > 0 && tasks.length <= 100, 'template_task_limit');
  const templates = checklistTemplates(state); assert(templates.length < 50, 'template_limit');
  const name = text(payload.name, 'name', { required: true, max: 150 });
  const template = { id: ctx.id(), name, tasks: tasks.map(definition), createdAt: ctx.now };
  state.settings.preferences = jsonObject({ ...state.settings.preferences, checklistTemplates: [...templates, template] });
  audit(state, ctx, 'template', template.id, 'created', { projectId: payload.projectId });
}
function applyTemplate(state, payload, ctx) {
  const project = find(state, 'projects', payload.projectId);
  assert(!['completed','archived'].includes(project.status), 'project_closed');
  const preview = checklistPreview(state, project.id, payload.templateId, payload.mode);
  if (preview.removed) assert(payload.confirmReplace === true, 'template_replace_confirmation');
  if (payload.mode === 'replace_unfinished') state.tasks = state.tasks.filter(row => row.projectId !== project.id || row.done);
  const existing = state.tasks.filter(row => row.projectId === project.id), start = existing.reduce((max,row) => Math.max(max,row.order+1),0);
  assert(start + preview.added <= 100000, 'template_task_limit');
  for (const [index, task] of preview.template.tasks.entries()) saveTask(state, { ...definition(task), projectId: project.id, done: false, dueDate: '', order: start+index }, ctx);
  audit(state, ctx, 'project', project.id, 'template_applied', { templateId: payload.templateId, mode: payload.mode ?? 'append', added: preview.added, removed: preview.removed, retainedCompleted: preview.retainedCompleted });
}
function finishDetails(payload) {
  assert(payload && typeof payload === 'object' && !Array.isArray(payload), 'invalid_finishing_details');
  const result = { finishedDate: day(payload.finishedDate, 'finishedDate'), description: text(payload.description, 'description', { max: 10000 }), careInstructions: text(payload.careInstructions, 'careInstructions', { max: 10000 }), deliveredDate: day(payload.deliveredDate, 'deliveredDate'), recipientNotes: text(payload.recipientNotes, 'recipientNotes', { max: 10000 }) };
  assert(!result.finishedDate || !result.deliveredDate || result.deliveredDate >= result.finishedDate, 'delivery_before_finish'); return result;
}
function forecastSettings(payload) {
  assert(payload && typeof payload === 'object' && !Array.isArray(payload), 'invalid_forecast_settings');
  const weeklyHours = quantity(payload.weeklyHours, { nullable: true, field: 'weeklyHours' }), extraMinutes = quantity(payload.extraMinutes ?? 0, { field: 'extraMinutes' });
  assert(weeklyHours === null || weeklyHours > 0 && weeklyHours <= 168, 'weekly_hours_range'); assert(extraMinutes <= 1000000, 'finishing_minutes_range'); return { weeklyHours, extraMinutes };
}
function saveProjectSetting(state, payload, ctx, key, normalize) {
  const project = find(state, 'projects', payload.projectId), before = project.settings[key] ?? null, value = normalize(payload);
  project.settings = normalizeProjectSettings({ ...project.settings, [key]: value },{state}); project.updatedAt = ctx.now;
  audit(state, ctx, 'project', project.id, key === 'finishing' ? 'finishing_updated' : 'forecast_assumptions_updated', { before, after: value });
}
export const projectInsightHandlers = {
  'template.save': saveTemplate, 'template.apply': applyTemplate,
  'project.finishing': (s,p,c) => saveProjectSetting(s,p,c,'finishing',finishDetails),
  'project.forecastSettings': (s,p,c) => saveProjectSetting(s,p,c,'forecast',forecastSettings),
};
export function validateProjectInsights(state) {
  const templates = checklistTemplates(state); assert(Array.isArray(templates) && templates.length <= 50, 'template_limit'); const ids = new Set();
  for (const template of templates) {
    identifier(template.id); assert(!ids.has(template.id),'duplicate_id'); ids.add(template.id);
    text(template.name,'name',{required:true,max:150}); assert(typeof template.createdAt === 'string' && Number.isFinite(Date.parse(template.createdAt)),'invalid_date');
    assert(Array.isArray(template.tasks) && template.tasks.length > 0 && template.tasks.length <= 100,'template_task_limit');
    for (const task of template.tasks) { definition(task); assert(!('id' in task) && !('done' in task),'invalid_template_task'); }
  }
  for (const project of state.projects) { if (project.settings.finishing !== undefined) finishDetails(project.settings.finishing); if (project.settings.forecast !== undefined) forecastSettings(project.settings.forecast); }
  for (const session of state.sessions) validateSessionWork(state, session); return state;
}
export function projectForecast(state, projectId, { asOf } = {}) {
  const today = day(String(asOf ?? '').slice(0,10),'asOf',false);
  const project = find(state,'projects',projectId), pattern = state.patterns.find(row => row.id === project.patternId), revision = pattern?.revisions.find(row => row.id === project.revisionId), assumptions = forecastSettings(project.settings.forecast ?? {});
  const result = { asOf: today, revisionId: project.revisionId, mode: 'unavailable', reason: 'forecast_structured_required', byKind: [], sampleSessions: 0, sampleMinutes: 0, ignoredSessions: 0, stitchingMinutes: null, extraMinutes: assumptions.extraMinutes, totalMinutes: null, weeklyHours: assumptions.weeklyHours, estimatedDate: null, scheduleTooFar: false };
  if (pattern?.kind !== 'structured' || !revision) return result;
  const completed = new Set(project.completed), remaining = { full:0, half:0, backstitch:0 };
  revision.cells.forEach((color,index) => { if(color >= 0 && !completed.has(`c:${index}`)) remaining.full++; });
  for (const stitch of revision.halfStitches ?? []) if (!completed.has(`h:${stitch.id}`)) remaining.half++;
  for (const stitch of revision.backstitches ?? []) if (!completed.has(`b:${stitch.id}`)) remaining.backstitch++;
  const samples = Object.fromEntries(kinds.map(kind => [kind,{ count:0,sampleMinutes:0,sessions:0 }]));
  for (const session of state.sessions.filter(row => row.projectId === projectId)) {
    const work = session.work;
    if (session.date.slice(0,10) > today || !work || work.patternId !== project.patternId || work.revisionId !== project.revisionId || session.durationMinutes <= 0 || work.count <= 0 || !samples[work.kind]) { result.ignoredSessions++; continue; }
    const sample = samples[work.kind]; sample.count += work.count; sample.sampleMinutes += session.durationMinutes; sample.sessions++; result.sampleSessions++; result.sampleMinutes += session.durationMinutes;
  }
  result.byKind = kinds.map(kind => ({ kind, remaining: remaining[kind], ...samples[kind], minutes: !remaining[kind] ? 0 : samples[kind].count > 0 ? remaining[kind] * samples[kind].sampleMinutes / samples[kind].count : null }));
  if(result.byKind.some(row => row.minutes === null)) {result.reason='forecast_samples_required'; return result;}
  result.mode='measured'; result.reason=''; result.stitchingMinutes=result.byKind.reduce((sum,row)=>sum+row.minutes,0); result.totalMinutes=result.stitchingMinutes+result.extraMinutes;
  if (!result.totalMinutes) result.estimatedDate=today;
  else if(result.weeklyHours){ const days=Math.ceil(result.totalMinutes*7/(result.weeklyHours*60)); if(days>36525) result.scheduleTooFar=true; else result.estimatedDate=new Date(Date.parse(`${today}T00:00:00Z`)+days*86400000).toISOString().slice(0,10); }
  return result;
}
