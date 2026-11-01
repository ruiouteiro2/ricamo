import { computed } from 'vue';
import { state } from './state';
import { INVENTORY_GROUPS, inventoryGroup } from './inventory-navigation.mjs';
import { t } from './i18n';
export const inventoryCategories = computed(() => INVENTORY_GROUPS.map(group => ({ value: group.category, label: t(group.labelKey) })));
export function categoryLabel(value) { return t(INVENTORY_GROUPS.find(group => group.id === inventoryGroup({ category: value })).labelKey); }
export function materialCustomFields(material) {
  return [...new Set([...(state.value.categories.find(row => row.id === material.category)?.fields || []), ...Object.keys(material.properties?.custom || {})])];
}
