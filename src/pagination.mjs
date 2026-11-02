import { computed } from 'vue';
import { state } from './state';

/** Lists are split into pages unless the user turned this preference off in Settings. */
export const paginationEnabled = computed(() => state.value.settings.preferences?.paginateLists !== false);
export const pageTotal = (count, size) => paginationEnabled.value ? Math.max(1, Math.ceil(count / size)) : 1;
export const pageRows = (rows, page, size) => paginationEnabled.value ? rows.slice((page - 1) * size, page * size) : rows;
