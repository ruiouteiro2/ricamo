import { t } from './i18n';
import { state, statusText } from './state';
import { quantity } from '../core/shared.mjs';

export function projectFields(currency = state.value.settings.currency) {
  return [
    { key: 'name', label: t('name'), required: true, wide: true },
    { key: 'technique', label: t('technique'), type: 'select', required: true, options: ['cross_stitch', 'embroidery', 'blackwork', 'hardanger', 'ribbon', 'beadwork', 'other'] },
    { key: 'status', label: t('status'), type: 'select', required: true, options: ['idea', 'preparing', 'ready', 'active', 'paused', 'finishing'].map(value => ({ value, label: () => statusText(value) })) },
    { key: 'patternId', label: t('choosePattern'), type: 'select', wide: true, options: state.value.patterns.filter(row => !row.archived).map(row => ({ value: row.id, label: row.name })) },
    { key: 'recipient', label: t('recipient') }, { key: 'dueDate', label: t('deadline'), type: 'date' },
    { key: 'priority', label: t('priority'), type: 'select', required: true, options: ['low', 'normal', 'high'] },
    { key: 'budgetDisplay', label: () => `${t('budget')} (${currency})`, type: 'number' },
    { key: 'notes', label: t('notes'), type: 'textarea', wide: true },
  ];
}
export function projectPayload(draft) {
  const payload = { ...draft };
  payload.budget = draft.budgetDisplay === '' || draft.budgetDisplay == null ? null : Math.round(quantity(draft.budgetDisplay) * 100);
  delete payload.budgetDisplay;
  return payload;
}
export function materialOptions() { return state.value.materials.filter(row => !row.archived).map(row => ({ value: row.id, label: [row.brand, row.code, row.name].filter(Boolean).join(' · ') })); }
export function projectOptions() { return state.value.projects.filter(row => !['completed', 'archived'].includes(row.status)).map(row => ({ value: row.id, label: row.name })); }
