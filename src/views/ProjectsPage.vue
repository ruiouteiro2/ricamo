<script setup>
import { ref, computed } from 'vue';
import { Plus, Search, FolderHeart, Flower2 } from '@lucide/vue';
import { state, route, navigate, dispatch, notify, normalize, statusText } from '../state';
import { t, number, date } from '../i18n';
import { projectProgress, PROJECT_STATUSES } from '../../core/projects.mjs';
import { projectFields, projectPayload } from '../forms';
import PageHeader from '../components/PageHeader.vue';
import EmptyState from '../components/EmptyState.vue';
import EntityForm from '../components/EntityForm.vue';
import ProjectTransfer from '../components/ProjectTransfer.vue';
import PatternThumbnail from '../components/PatternThumbnail.vue';
const showTransfer = ref(false);
const search = ref(''), filter = ref('active'), showForm = ref(route.value.id === 'new');
const fields = computed(projectFields);
const projects = computed(() => state.value.projects.filter(row => (filter.value === 'all' || (filter.value === 'active' ? !['completed','archived'].includes(row.status) : row.status === filter.value)) && normalize([row.name,row.technique,row.notes,row.recipient].join(' ')).includes(normalize(search.value))).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)));
function revision(project) { return state.value.patterns.find(row => row.id === project.patternId)?.revisions.find(row => row.id === project.revisionId); }
let createdId;
async function create(draft) { createdId = crypto.randomUUID(); await dispatch('project.save', { ...projectPayload(draft), id: createdId }); }
function saved() { showForm.value = false; notify(); navigate('project', createdId); }
</script>
<template>
  <div class="page">
    <PageHeader :eyebrow="t('projects')" :title="t('projectsTitle')" :description="t('projectsSubtitle')"><button class="button" @click="showTransfer = true">{{ t('importProjectPackage') }}</button><button class="button primary" @click="showForm = true"><Plus :size="16" />{{ t('newProject') }}</button></PageHeader>
    <div class="toolbar"><div class="toolbar-search"><Search :size="18" /><input v-model="search" :aria-label="t('search')" :placeholder="t('search')" /></div><select v-model="filter" :aria-label="t('status')"><option value="active">{{ t('active') }}</option><option value="all">{{ t('all') }}</option><option v-for="status in PROJECT_STATUSES" :key="status" :value="status">{{ statusText(status) }}</option></select></div>
    <div v-if="projects.length" class="project-grid"><button v-for="project in projects" :key="project.id" class="project-card" @click="navigate('project',project.id)"><div class="project-cover"><PatternThumbnail v-if="revision(project)" :revision="revision(project)" :label="project.name" /><Flower2 v-else :size="72" :stroke-width=".7" /></div><div class="project-card-body"><div class="inline-row" style="justify-content:space-between"><span class="badge" :class="project.status === 'completed' ? 'green' : 'accent'">{{ statusText(project.status) }}</span><span v-if="project.priority === 'high'" class="badge warning">{{ t('high') }}</span></div><h3>{{ project.name }}</h3><p>{{ t(project.technique) }}<template v-if="project.dueDate"> · {{ date(project.dueDate) }}</template></p><div class="progress-track"><div class="progress-fill" :style="{width: projectProgress(state,project.id).percent + '%'}" /></div><div class="progress-label"><span>{{ t('progress') }}</span><span>{{ number(projectProgress(state,project.id).percent,0) }}%</span></div></div></button></div>
    <section v-else class="panel"><EmptyState :icon="FolderHeart" :title="search || filter !== 'active' ? t('noResults') : t('noProjects')" :description="t('noProjectsBody')"><button class="button primary" @click="showForm=true"><Plus :size="16" />{{ t('newProject') }}</button></EmptyState></section>
    <ProjectTransfer v-if="showTransfer" @close="showTransfer=false" @imported="id=>{showTransfer=false;navigate('project',id)}" />
    <EntityForm v-if="showForm" :title="t('newProject')" :fields="fields" :initial="{name:'',technique:'cross_stitch',status:'idea',priority:'normal',patternId:'',budgetDisplay:''}" :submit="create" wide @close="showForm=false" @saved="saved" />
  </div>
</template>
