<script setup>
import { computed } from 'vue';
import { state, navigate } from '../state';
import { t } from '../i18n';
import { EXAMPLE_IDS } from '../../core/example-studio.mjs';
const has = (collection, id) => state.value[collection].some(row => row.id === id);
const entries = computed(() => [
  { key: 'exampleKnownLesson', collection: 'materials', page: 'material', id: EXAMPLE_IDS.known, action: 'exampleReviewStock' },
  { key: 'exampleUnknownLesson', collection: 'materials', page: 'material', id: EXAMPLE_IDS.unknown, action: 'exampleReviewUnknown' },
  { key: 'exampleProgressLesson', collection: 'projects', page: 'project', id: EXAMPLE_IDS.project, action: 'exampleOpenProject' },
  { key: 'examplePatternLesson', collection: 'patterns', page: 'pattern', id: EXAMPLE_IDS.pattern, action: 'exampleEditPattern' },
]);
</script>
<template><section class="panel"><div class="panel-heading"><h2>{{ t('exampleTryTitle') }}</h2></div><div class="panel-body"><div v-for="entry in entries" :key="entry.key" class="activity-item"><div><p>{{ t(entry.key) }}</p><button v-if="has(entry.collection,entry.id)" class="button text small" @click="navigate(entry.page,entry.id)">{{ t(entry.action) }}</button></div></div></div></section></template>
