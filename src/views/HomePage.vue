<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue';
import { Plus, ArrowUpRight, Package, FolderHeart, Grid2X2, ShoppingBag, MoveRight, Activity, Flower2 } from '@lucide/vue';
import { state, navigate, statusText } from '../state';
import { t, number, date } from '../i18n';
import { projectProgress } from '../../core/projects.mjs';
import { shoppingNeeds } from '../../core/purchasing.mjs';
import { toolReminders } from '../../core/tool-state.mjs';
import { localDate } from '../../core/calendar.mjs';
import PageHeader from '../components/PageHeader.vue';
import EmptyState from '../components/EmptyState.vue';
import PatternThumbnail from '../components/PatternThumbnail.vue';
const projects = computed(() => state.value.projects.filter(row => !['completed', 'archived'].includes(row.status)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3));
const shortages = computed(() => shoppingNeeds(state.value).filter(row => row.shortfall > 0));
const today = ref(localDate());
let dayTimer;
onMounted(() => { dayTimer = setInterval(() => { today.value = localDate(); }, 60000); });
onBeforeUnmount(() => clearInterval(dayTimer));
const reminders = computed(() => toolReminders(state.value, today.value).filter(row => row.daysLate >= -7).slice(0, 5));
const activity = computed(() => [...state.value.movements].reverse().slice(0, 5));
const material = id => state.value.materials.find(row => row.id === id);
function revision(project) { return state.value.patterns.find(row => row.id === project.patternId)?.revisions.find(row => row.id === project.revisionId); }
</script>
<template>
  <div class="page">
    <PageHeader :eyebrow="t('welcome')" :title="t('home')"><button class="button primary" @click="navigate('projects', 'new')"><Plus :size="16" />{{ t('newProject') }}</button></PageHeader>
    <section class="hero"><div><p class="eyebrow">RICAMO · {{ t('studio') }}</p><h1>{{ t('today') }}</h1><p>{{ t('homeBody') }}</p><button class="button" @click="navigate(projects.length ? 'project' : 'materials', projects[0]?.id || 'new')">{{ projects.length ? t('inProgress') : t('addMaterial') }}<MoveRight :size="16" /></button></div><div class="hero-art" aria-hidden="true"><div class="thread-hoop"><Flower2 :stroke-width=".7" /></div></div></section>
    <div class="metrics">
      <div class="metric"><div class="metric-top">{{ t('materials') }}<Package :size="18" /></div><div class="metric-value">{{ number(state.materials.filter(row => !row.archived).length, 0) }}</div><span class="metric-caption">{{ t('materialCount') }}</span></div>
      <div class="metric"><div class="metric-top">{{ t('projects') }}<FolderHeart :size="18" /></div><div class="metric-value">{{ number(state.projects.filter(row => !['completed','archived'].includes(row.status)).length, 0) }}</div><span class="metric-caption">{{ t('inProgress') }}</span></div>
      <div class="metric"><div class="metric-top">{{ t('patterns') }}<Grid2X2 :size="18" /></div><div class="metric-value">{{ number(state.patterns.filter(row => !row.archived).length, 0) }}</div><span class="metric-caption">{{ t('patternsTitle') }}</span></div>
      <div class="metric"><div class="metric-top">{{ t('shopping') }}<ShoppingBag :size="18" /></div><div class="metric-value">{{ number(shortages.length, 0) }}</div><span class="metric-caption">{{ t('shortage') }}</span></div>
    </div>
    <div class="two-columns"><div class="stack">
      <section><div class="split-heading"><h2>{{ t('inProgress') }}</h2><button class="button text small" @click="navigate('projects')">{{ t('viewAll') }}<ArrowUpRight :size="14" /></button></div>
        <div v-if="projects.length" class="project-grid" style="grid-template-columns:repeat(auto-fit,minmax(210px,1fr))"><button v-for="project in projects" :key="project.id" class="project-card" @click="navigate('project',project.id)"><div class="project-cover"><PatternThumbnail v-if="revision(project)" :revision="revision(project)" :label="project.name" /><Flower2 v-else :size="62" :stroke-width=".7" /></div><div class="project-card-body"><span class="badge accent">{{ statusText(project.status) }}</span><h3>{{ project.name }}</h3><p>{{ t(project.technique) }}</p><div class="progress-track"><div class="progress-fill" :style="{width: projectProgress(state, project.id).percent + '%'}" /></div><div class="progress-label"><span>{{ t('progress') }}</span><span>{{ number(projectProgress(state,project.id).percent,0) }}%</span></div></div></button></div>
        <div v-else class="panel"><EmptyState :icon="FolderHeart" :title="t('noProjects')" :description="t('noProjectsBody')" compact><button class="button primary" @click="navigate('projects','new')"><Plus :size="16" />{{ t('newProject') }}</button></EmptyState></div>
      </section>
      <section><h2>{{ t('quickStart') }}</h2><div class="quick-actions"><button class="quick-action" @click="navigate('materials','new')"><Package :size="22" /><span><strong>{{ t('materials') }}</strong><small>{{ t('inventoryAction') }}</small></span></button><button class="quick-action" @click="navigate('projects','new')"><FolderHeart :size="22" /><span><strong>{{ t('projects') }}</strong><small>{{ t('projectAction') }}</small></span></button><button class="quick-action" @click="navigate('patterns','new')"><Grid2X2 :size="22" /><span><strong>{{ t('patterns') }}</strong><small>{{ t('patternAction') }}</small></span></button></div></section>
    </div><aside class="stack"><section v-if="reminders.length" class="panel"><div class="panel-heading"><h2>{{ t('toolRemindersTitle') }}</h2></div><div class="panel-body"><div v-for="reminder in reminders" :key="reminder.id" class="activity-item"><Package :size="16" /><div><button class="cell-title" @click="navigate('material',reminder.materialId)">{{ material(reminder.materialId)?.name }}</button><p>{{ reminder.title }}</p><small :class="{ 'badge warning': reminder.overdue }">{{ t('toolDueDate') }}: {{ date(reminder.dueDate) }} · {{ reminder.overdue ? t('toolOverdue') : reminder.dueToday ? t('today') : t('toolDueSoon') }}</small></div></div></div></section><section class="panel"><div class="panel-heading"><h2>{{ t('recentActivity') }}</h2><Activity :size="18" class="muted" /></div><div class="panel-body"><p v-if="!activity.length" class="muted" style="font-size:.83rem">{{ t('noActivity') }}</p><div v-for="row in activity" :key="row.id" class="activity-item"><Package :size="16" /><div><p>{{ material(row.materialId)?.name || row.materialId }}</p><small>{{ t(row.kind === 'opening' ? 'receipt' : row.kind) }} · {{ number(row.quantity) }} {{ t(row.unit) }}<br>{{ date(row.date || row.createdAt) }}</small></div></div></div></section></aside></div>
  </div>
</template>
