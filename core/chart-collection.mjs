import catalogue from '../data/pattern-catalogue.json' with { type: 'json' };
import { assert, identifier, oneOf, quantity, date } from './shared.mjs';
export const CHART_BRANDS = [{ id: 'mirabilia', label: 'Mirabilia' }, { id: 'bella-filipina', label: 'Bella Filipina' }];
export const CHART_STATUSES = ['new', 'in_progress', 'completed'];
export const CHART_CATALOGUE = catalogue;
const known = new Set(catalogue.items.map(item => item.id));
export function chartRecord(state, id) { return state.settings.preferences?.chartCollection?.[id] || { owned: false, status: 'new' }; }
export function chartDimensions(item, stitchesPerInch = 16) {
  if (item.widthCm && item.heightCm) return { widthCm: item.widthCm, heightCm: item.heightCm, estimated: false };
  if (!item.stitchesWidth || !item.stitchesHeight) return null;
  const density = quantity(stitchesPerInch, { positive: true });
  return { widthCm: item.stitchesWidth * 2.54 / density, heightCm: item.stitchesHeight * 2.54 / density, estimated: true };
}
export function validateChartCollection(state) {
  const records = state.settings.preferences?.chartCollection;
  if (records === undefined) return;
  assert(records && typeof records === 'object' && !Array.isArray(records), 'invalid_chart_collection');
  assert(Object.keys(records).length <= 10000, 'invalid_chart_collection');
  for (const [id, record] of Object.entries(records)) {
    identifier(id); assert(record && typeof record === 'object' && !Array.isArray(record), 'invalid_chart_collection');
    assert(typeof record.owned === 'boolean', 'invalid_boolean'); oneOf(record.status, CHART_STATUSES, 'status');
    if (record.updatedAt !== undefined) date(record.updatedAt, 'updatedAt');
  }
}
export const chartCollectionHandlers = {
  'chart.collection.save': (state, payload, context) => {
    const id = identifier(payload.id); assert(known.has(id), 'unknown_catalogue_chart');
    assert(typeof payload.owned === 'boolean', 'invalid_boolean');
    const record = { owned: payload.owned, status: oneOf(payload.status, CHART_STATUSES, 'status'), updatedAt: context.now };
    state.settings.preferences ||= {};
    state.settings.preferences.chartCollection ||= {};
    state.settings.preferences.chartCollection[id] = record;
  },
};
