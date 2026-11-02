import { computed } from 'vue';
import { state } from './state';
import { INVENTORY_GROUPS, customInventoryGroups, inventoryGroup } from './inventory-navigation.mjs';
import { t } from './i18n';
export const inventoryCategories = computed(() => [...INVENTORY_GROUPS.map(group => ({ value: group.category, label: t(group.labelKey) })), ...customInventoryGroups(state.value.categories).map(group => ({ value: group.category, label: group.label }))]);
export function categoryLabel(value) { const custom = customInventoryGroups(state.value.categories).find(group => group.category === value); if (custom) return custom.label; return t(INVENTORY_GROUPS.find(group => group.id === inventoryGroup({ category: value })).labelKey); }
export function materialCustomFields(material) {
  return [...new Set([...(state.value.categories.find(row => row.id === material.category)?.fields || []), ...Object.keys(material.properties?.custom || {})])];
}
