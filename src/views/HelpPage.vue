<script setup>
import { ref, computed } from 'vue';
import { Search, BookOpen } from '@lucide/vue';
import { t, language } from '../i18n';
import { normalize } from '../state';
import { helpTopics } from '../help';
import PageHeader from '../components/PageHeader.vue';
import EmptyState from '../components/EmptyState.vue';
const search=ref('');
const topics=computed(()=>helpTopics.map(topic=>({id:topic.id,title:topic.title[language.value==='en'?1:0],body:topic.body[language.value==='en'?1:0]})).filter(topic=>normalize(topic.title+' '+topic.body).includes(normalize(search.value))));
</script>
<template><div class="page"><PageHeader :eyebrow="t('help')" :title="t('helpTitle')" /><div class="toolbar"><div class="toolbar-search"><Search :size="18" /><input v-model="search" :placeholder="t('helpSearch')" :aria-label="t('helpSearch')" /></div></div><div class="help-grid"><article v-for="topic in topics" :id="topic.id" :key="topic.id" class="panel help-article"><h2>{{ topic.title }}</h2><p>{{ topic.body }}</p></article></div><EmptyState v-if="!topics.length" :icon="BookOpen" :title="t('noResults')" /></div></template>
