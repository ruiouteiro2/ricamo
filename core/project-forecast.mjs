import {cellKind} from './pattern-materials.mjs';
import { assert, quantity, integer, oneOf, date, find } from './shared.mjs';

export const FORECAST_KINDS = Object.freeze(['full', 'half', 'backstitch', 'bead']);
const fields = ['method', 'weeklyHours', 'extraMinutes', 'manualSeconds', 'manualRemaining'];

function values(value, kind) {
  assert(value && typeof value === 'object' && !Array.isArray(value), 'invalid_forecast_settings');
  assert(Object.keys(value).every(key => FORECAST_KINDS.includes(key)), 'invalid_forecast_settings');
  return Object.fromEntries(FORECAST_KINDS.map(key => {
    if (kind === 'count' && typeof value[key] === 'number') {
      assert(Number.isInteger(value[key]), 'invalid_integer', { field: key });
    }
    const n = kind === 'count'
      ? integer(value[key], key, { nullable: true, min: 0, max: 10000000 })
      : quantity(value[key], { nullable: true, field: key });
    assert(kind === 'count' || n === null || (n > 0 && n <= 86400), 'forecast_rate_range');
    return [key, n];
  }));
}

export function forecastSettings(payload = {}) {
  assert(payload && typeof payload === 'object' && !Array.isArray(payload), 'invalid_forecast_settings');
  const method = oneOf(payload.method ?? 'measured', ['measured', 'manual'], 'method');
  const weeklyHours = quantity(payload.weeklyHours, { nullable: true, field: 'weeklyHours' });
  const extraMinutes = quantity(payload.extraMinutes ?? 0, { field: 'extraMinutes' });
  assert(weeklyHours === null || weeklyHours > 0 && weeklyHours <= 168, 'weekly_hours_range');
  assert(extraMinutes <= 1000000, 'finishing_minutes_range');
  return {
    method, weeklyHours, extraMinutes,
    manualSeconds: values(payload.manualSeconds ?? {}, 'rate'),
    manualRemaining: values(payload.manualRemaining ?? {}, 'count'),
  };
}

/** Restore accepts typed stored values; command normalization also accepts form strings. */
export function validateForecastSettings(value) {
  assert(value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).every(key => fields.includes(key)), 'invalid_forecast_settings');
  if (value.method !== undefined) assert(typeof value.method === 'string', 'invalid_forecast_settings');
  for (const key of ['weeklyHours', 'extraMinutes']) {
    if (value[key] !== undefined) {
      assert((key === 'weeklyHours' && value[key] === null) || typeof value[key] === 'number', 'invalid_forecast_settings');
    }
  }
  for (const key of ['manualSeconds', 'manualRemaining']) {
    if (value[key] === undefined) continue;
    assert(value[key] && typeof value[key] === 'object' && !Array.isArray(value[key]), 'invalid_forecast_settings');
    for (const n of Object.values(value[key])) assert(n === null || typeof n === 'number', 'invalid_forecast_settings');
  }
  forecastSettings(value);
}

/** Estimates never mutate progress. Only positive remaining work requires a rate. */
export function projectForecast(state, projectId, { asOf } = {}) {
  const today = date(String(asOf ?? '').slice(0, 10), 'asOf');
  assert(/^\d{4}-\d{2}-\d{2}$/.test(today), 'invalid_date');
  const project = find(state, 'projects', projectId);
  const pattern = state.patterns.find(row => row.id === project.patternId);
  const revision = pattern?.revisions?.find(row => row.id === project.revisionId);
  const settings = forecastSettings(project.settings.forecast ?? {});
  const structured = pattern?.kind === 'structured' && Boolean(revision);
  const result = {
    asOf: today, revisionId: project.revisionId, method: settings.method,
    countSource: structured ? 'grid' : 'manual', mode: 'unavailable',
    reason: 'forecast_structured_required', byKind: [], sampleSessions: 0,
    sampleMinutes: 0, ignoredSessions: 0, stitchingMinutes: null,
    extraMinutes: settings.extraMinutes, totalMinutes: null, weeklyHours: settings.weeklyHours,
    estimatedDate: null, scheduleTooFar: false,
  };
  if (!structured && settings.method === 'measured') return result;

  // A manual percentage never supplies primitive counts. Blank manual counts remain unknown.
  const remaining = structured ? { full: 0, half: 0, backstitch: 0, bead: 0 } : { ...settings.manualRemaining };
  if (structured) {
    const completed = new Set(project.completed);
    revision.cells.forEach((color, index) => {
      if (color >= 0 && !completed.has(`c:${index}`)) remaining[cellKind(revision.colors[color])]++;
    });
    for (const half of revision.halfStitches ?? []) if (!completed.has(`h:${half.id}`)) remaining.half++;
    for (const back of revision.backstitches ?? []) if (!completed.has(`b:${back.id}`)) remaining.backstitch++;
  }
  const samples = Object.fromEntries(FORECAST_KINDS.map(kind => [kind, { count: 0, sampleMinutes: 0, sessions: 0 }]));
  if (settings.method === 'measured') {
    for (const session of state.sessions.filter(row => row.projectId === projectId)) {
      const work = session.work;
      if (session.date.slice(0, 10) > today || !work || work.patternId !== project.patternId
        || work.revisionId !== project.revisionId || session.durationMinutes <= 0
        || work.count <= 0 || !samples[work.kind]) {
        result.ignoredSessions++;
        continue;
      }
      const sample = samples[work.kind];
      sample.count += work.count;
      sample.sampleMinutes += session.durationMinutes;
      sample.sessions++;
      result.sampleSessions++;
      result.sampleMinutes += session.durationMinutes;
    }
  }
  result.byKind = FORECAST_KINDS.map(kind => {
    const sample = samples[kind];
    const seconds = settings.method === 'manual' ? settings.manualSeconds[kind]
      : sample.count > 0 ? sample.sampleMinutes * 60 / sample.count : null;
    return {
      kind, remaining: remaining[kind], ...sample, secondsPerPrimitive: seconds,
      minutes: remaining[kind] === null ? null : remaining[kind] === 0 ? 0
        : seconds === null ? null : remaining[kind] * seconds / 60,
    };
  });
  if (result.byKind.some(row => row.remaining === null)) {
    result.reason = 'forecast_manual_counts_required';
    return result;
  }
  if (result.byKind.some(row => row.minutes === null)) {
    result.reason = settings.method === 'manual' ? 'forecast_manual_rates_required' : 'forecast_samples_required';
    return result;
  }
  result.mode = settings.method;
  result.reason = '';
  result.stitchingMinutes = result.byKind.reduce((sum, row) => sum + row.minutes, 0);
  result.totalMinutes = result.stitchingMinutes + result.extraMinutes;
  if (!result.totalMinutes) result.estimatedDate = today;
  else if (result.weeklyHours) {
    const days = Math.ceil(result.totalMinutes * 7 / (result.weeklyHours * 60));
    if (days > 36525) result.scheduleTooFar = true;
    else result.estimatedDate = new Date(Date.parse(`${today}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
  }
  return result;
}
