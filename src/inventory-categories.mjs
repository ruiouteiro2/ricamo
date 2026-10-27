import { computed } from 'vue';
import { state, categories } from './state';
import { t } from './i18n';
export const inventoryCategories = computed(() => [...categories.map(value => ({ value, label: t(value) })), ...state.value.categories.filter(row => !categories.includes(row.id)).map(row => ({ value: row.id, label: row.name }))]);
export function categoryLabel(value) { return state.value.categories.find(row => row.id === value)?.name || t(value); }
export function materialCustomFields(material) {
  return [...new Set([...(state.value.categories.find(row => row.id === material.category)?.fields || []), ...Object.keys(material.properties?.custom || {})])];
}
