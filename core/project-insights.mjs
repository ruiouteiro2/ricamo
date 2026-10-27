import {normalizeProjectSettings} from './thread-estimate-history.mjs';
import { validateSessionWork } from './session-work.mjs';
export { validateSessionWork } from './session-work.mjs';
import { assert, text, date, find, audit } from './shared.mjs';
import {forecastSettings,validateForecastSettings} from './project-forecast.mjs';
import {checklistTemplateHandlers,validateChecklistTemplates} from './checklist-templates.mjs';
export {projectForecast,forecastSettings} from './project-forecast.mjs';
export {checklistTemplates,availableChecklistTemplates,checklistPreview,templateEditPreview} from './checklist-templates.mjs';
function day(value, field, optional = true) {
  const result = date(value, field);
  assert((optional && !result) || /^\d{4}-\d{2}-\d{2}$/.test(result), 'invalid_date', { field });
  return result;
}
function finishDetails(payload) {
  assert(payload && typeof payload === 'object' && !Array.isArray(payload), 'invalid_finishing_details');
  const result = { finishedDate: day(payload.finishedDate, 'finishedDate'), description: text(payload.description, 'description', { max: 10000 }), careInstructions: text(payload.careInstructions, 'careInstructions', { max: 10000 }), deliveredDate: day(payload.deliveredDate, 'deliveredDate'), recipientNotes: text(payload.recipientNotes, 'recipientNotes', { max: 10000 }) };
  assert(!result.finishedDate || !result.deliveredDate || result.deliveredDate >= result.finishedDate, 'delivery_before_finish'); return result;
}
function saveProjectSetting(state, payload, ctx, key, normalize) {
  const project = find(state, 'projects', payload.projectId), before = project.settings[key] ?? null, value = normalize(payload);
  project.settings = normalizeProjectSettings({ ...project.settings, [key]: value },{state}); project.updatedAt = ctx.now;
  audit(state, ctx, 'project', project.id, key === 'finishing' ? 'finishing_updated' : 'forecast_assumptions_updated', { before, after: value });
}
export const projectInsightHandlers = {
  ...checklistTemplateHandlers,
  'project.finishing': (s,p,c) => saveProjectSetting(s,p,c,'finishing',finishDetails),
  'project.forecastSettings': (s,p,c) => saveProjectSetting(s,p,c,'forecast',forecastSettings),
};
export function validateProjectInsights(state) {
  validateChecklistTemplates(state);
  for (const project of state.projects) { if (project.settings.finishing !== undefined) finishDetails(project.settings.finishing); if (project.settings.forecast !== undefined) validateForecastSettings(project.settings.forecast); }
  for (const session of state.sessions) validateSessionWork(state, session); return state;
}
