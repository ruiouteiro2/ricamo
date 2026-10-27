<script setup>
import RevisionImpact from '../components/RevisionImpact.vue';
import {projectRevisionImpact} from '../../core/revision-impact.mjs';
import { studioStorageKey } from '../example-mode.mjs';
import { localDate } from '../../core/calendar.mjs';
import { ref, computed, onBeforeUnmount } from 'vue';
import { ArrowLeft, Pencil, Copy, Check, Plus, Play, Pause, Clock3, ImagePlus, Flower2, Archive, RotateCcw, FileText } from '@lucide/vue';
import { state, dispatch, navigate, notify, statusText, saveEntityWithAssets } from '../state';
import { t, number, date, money, errorText } from '../i18n';
import { projectProgress } from '../../core/projects.mjs';
import { costTotals } from '../../core/purchasing.mjs';
import { projectFields, projectPayload } from '../forms';
import PageHeader from '../components/PageHeader.vue';
import EntityForm from '../components/EntityForm.vue';
import StagedAttachments from '../components/StagedAttachments.vue';
import AttachmentEditorDialog from '../components/AttachmentEditorDialog.vue';
import AttachmentList from '../components/AttachmentList.vue';
import AppDialog from '../components/AppDialog.vue';
import EmptyState from '../components/EmptyState.vue';
import ProjectMaterials from '../components/ProjectMaterials.vue';
import PatternThumbnail from '../components/PatternThumbnail.vue';
import ProjectTransfer from '../components/ProjectTransfer.vue';
import PatternEditor from './PatternEditor.vue';
import ChecklistTemplates from '../components/ChecklistTemplates.vue';
import ProjectForecast from '../components/ProjectForecast.vue';
import ProjectFinishing from '../components/ProjectFinishing.vue';
import CatalogueReferences from '../components/CatalogueReferences.vue';
import ProjectReports from '../components/ProjectReports.vue';
import {sessionEvidenceFields,sessionEvidenceInitial,sessionEvidencePayload} from '../project-session.mjs';
const showTransfer=ref(false);
const props = defineProps({ id: String });
const project = computed(() => state.value.projects.find(row => row.id === props.id));
const workEditor=ref(null);
function changeTab(next){if(next===tab.value)return;if(tab.value==='work'&&workEditor.value)workEditor.value.leaveContext(()=>{tab.value=next});else tab.value=next;}
const tab = ref('overview'), form = ref(null), closing = ref(null), error = ref(''), busy = ref(false);
const progress = computed(() => project.value ? projectProgress(state.value, props.id) : {percent:0});
const sessions = computed(() => state.value.sessions.filter(row => row.projectId === props.id).sort((a,b) => b.date.localeCompare(a.date)));
const minutes = computed(() => sessions.value.reduce((sum,row) => sum + row.durationMinutes, 0));
const tasks = computed(() => state.value.tasks.filter(row => row.projectId === props.id).sort((a,b) => a.order-b.order));
const pattern = computed(() => state.value.patterns.find(row => row.id === project.value?.patternId));
const revision = computed(() => pattern.value?.revisions.find(row => row.id === project.value?.revisionId));
const costs = computed(() => costTotals(state.value, props.id));
const closed = computed(() => ['completed','archived'].includes(project.value?.status));
const addingPhotos = ref(false), sessionPhotos = ref([]), revisionReview=ref(null), revisionError=ref('');
function refreshRevisionReview(){try{revisionReview.value={...revisionReview.value,impact:projectRevisionImpact(state.value,revisionReview.value.payload),operationId:crypto.randomUUID()};revisionError.value='';}catch(caught){revisionError.value=errorText(caught);}}
async function applyRevision(carryProgress){busy.value=true;revisionError.value='';try{const review=revisionReview.value,impact=review.impact;await dispatch('project.save',{...review.payload,acceptRevisionChange:true,revisionReview:{stateRevision:impact.stateRevision,patternId:impact.before.patternId,revisionId:impact.before.revisionId,carryProgress}},review.operationId);revisionReview.value=null;form.value=null;notify();}catch(caught){revisionError.value=errorText(caught);}finally{busy.value=false;}}

function editProject() {
  const current = project.value;
  form.value = {title:t('edit'),wide:true,fields:[...projectFields(project.value.currency),
    {key:'useLatestRevision',label:t('useLatestRevision'),type:'checkbox',wide:true,when:draft=>Boolean(draft.patternId)}],
  initial:{...current,status:closed.value?'idea':current.status,budgetDisplay:current.budget===null?'':current.budget/100,useLatestRevision:false,acceptRevisionChange:false},submit:async draft=>{
    const submitted=projectPayload(draft),actual=state.value.projects.find(row=>row.id===props.id);
    const payload=Object.fromEntries(['id','name','technique','status','patternId','recipient','dueDate','priority','budget','notes'].map(key=>[key,submitted[key]]));
    payload.patternId=payload.patternId||null;
    payload.revisionId=payload.patternId===actual.patternId&&!draft.useLatestRevision?actual.revisionId:state.value.patterns.find(row=>row.id===payload.patternId)?.currentRevisionId||null;
    if(payload.patternId!==actual.patternId||payload.revisionId!==actual.revisionId){
      form.value.initial=draft;revisionError.value='';revisionReview.value={payload,impact:projectRevisionImpact(state.value,payload),operationId:crypto.randomUUID()};return false;
    }
    await dispatch('project.save',payload);
  }};
}
function addTask(existing) {
  form.value={title:t('addTask'),fields:[{key:'title',label:t('task'),required:true,wide:true},{key:'stage',label:t('type'),type:'select',required:true,options:['preparation','work','finishing','custom']},{key:'dueDate',label:t('deadline'),type:'date'},{key:'notes',label:t('notes'),type:'textarea',wide:true}],initial:existing||{title:'',stage:tab.value==='finishing'?'finishing':'preparation',order:tasks.value.length},submit:draft=>dispatch('task.save',{...draft,projectId:props.id})};
}
async function toggleTask(task) {try{await dispatch('task.save',{id:task.id,done:!task.done});}catch(caught){error.value=errorText(caught);}}
function addSession(existing, timer = false) {
  sessionPhotos.value=[];const operationId=crypto.randomUUID();
  form.value={session:true,title:t('addSession'),fields:[{key:'durationMinutes',label:t('minutes'),type:'number',required:true},{key:'date',label:t('date'),type:'date',required:true},...sessionEvidenceFields(project.value,existing),{key:'notes',label:t('notes'),type:'textarea',wide:true}],initial:{...(existing||{durationMinutes:timer?Math.round(elapsed.value/600)/100:'',date:localDate(),notes:''}),...sessionEvidenceInitial(existing)},help:timer?t('timerHelp'):'',submit:async draft=>{
    await saveEntityWithAssets('session.save',{...sessionEvidencePayload(draft,project.value,existing),projectId:props.id,source:timer?'timer':existing?.source||'manual',attachments:[...(existing?.attachments||[])]},sessionPhotos.value,operationId);
    if(timer){elapsed.value=0;localStorage.removeItem(studioStorageKey(`ricamo-timer-${props.id}`));}
  }};
}
function manualProgress() {form.value={title:t('manualProgress'),fields:[{key:'manualPercent',label:t('manualProgress'),type:'number',required:true,wide:true}],initial:{manualPercent:project.value.manualPercent},submit:draft=>dispatch('project.progress',{...draft,projectId:props.id})};}
async function duplicate() {try{const before=new Set(state.value.projects.map(row=>row.id));await dispatch('project.duplicate',{id:props.id});const created=state.value.projects.find(row=>!before.has(row.id));notify();navigate('project',created.id);}catch(caught){error.value=errorText(caught);}}
async function finish() {busy.value=true;try{await dispatch('project.close',{projectId:props.id,status:closing.value});closing.value=null;notify();}catch(caught){error.value=errorText(caught);}finally{busy.value=false;}}
async function reopen() {try{await dispatch('project.save',{id:props.id,status:'preparing'});notify();}catch(caught){error.value=errorText(caught);}}
const elapsed=ref(Number(localStorage.getItem(studioStorageKey(`ricamo-timer-${props.id}`))||0)),running=ref(false);let ticker,lastTick;
function stopTimer(){running.value=false;clearInterval(ticker);localStorage.setItem(studioStorageKey(`ricamo-timer-${props.id}`),String(elapsed.value));}
function startTimer(){if(running.value)return;running.value=true;lastTick=performance.now();ticker=setInterval(()=>{const now=performance.now(),delta=now-lastTick;lastTick=now;if(delta>5000){stopTimer();notify(t('timerHelp'));return;}elapsed.value+=delta;localStorage.setItem(studioStorageKey(`ricamo-timer-${props.id}`),String(elapsed.value));},1000);}
function saveTimer(){stopTimer();addSession(null,true);}
onBeforeUnmount(stopTimer);
</script>
<template>
  <div v-if="project" class="page">
    <button class="button text small" style="margin-bottom:16px" @click="navigate('projects')"><ArrowLeft :size="15" />{{ t('projects') }}</button>
    <PageHeader :eyebrow="`${t(project.technique)} · ${statusText(project.status)}`" :title="project.name" :description="project.recipient ? `${t('recipient')}: ${project.recipient}` : ''"><button class="button" @click="showTransfer=true">{{ t('exportProjectPackage') }}</button><button class="button" @click="editProject"><Pencil :size="15" />{{ t('edit') }}</button><button class="button" @click="duplicate"><Copy :size="15" />{{ t('duplicate') }}</button><button v-if="!closed" class="button primary" @click="tab='work'"><Play :size="15" />{{ t('work') }}</button><button v-else class="button primary" @click="reopen"><RotateCcw :size="15" />{{ t('reopenProject') }}</button></PageHeader>
    <p v-if="error" role="alert" class="notice error">{{ error }}</p>
    <nav class="tabs" :aria-label="t('project')"><button v-for="item in ['overview','materials','work','journal','finishing']" :key="item" :class="{selected:tab===item}" :aria-current="tab===item?'page':undefined" @click="changeTab(item)">{{ t(item) }}</button></nav>
    <div v-if="tab==='overview'" class="two-columns"><div class="stack">
      <section class="panel"><div class="panel-heading"><h2>{{ t('progress') }}</h2><span class="badge accent">{{ statusText(project.status) }}</span></div><div class="panel-body"><div class="inline-row" style="justify-content:space-between;margin-bottom:18px"><span class="metric-value">{{ number(progress.percent,1) }}%</span><span class="muted" style="font-size:.8rem">{{ progress.mode==='structured'?`${number(progress.completed,0)} / ${number(progress.total,0)} ${t('stitches')}`:t('manualProgress') }}</span></div><div class="progress-track"><div class="progress-fill" :style="{width:progress.percent+'%'}" /></div><div class="stat-row"><span>{{ t('totalTime') }}</span><strong>{{ number(minutes) }} {{ t('minutes') }}</strong></div><div v-if="project.dueDate" class="stat-row"><span>{{ t('deadline') }}</span><strong>{{ date(project.dueDate) }}</strong></div><div class="stat-row"><span>{{ t('priority') }}</span><strong>{{ t(project.priority) }}</strong></div><div v-if="project.budget!==null" class="stat-row"><span>{{ t('budget') }}</span><strong>{{ money(project.budget,project.currency) }}</strong></div><div v-for="(amount,currency) in costs" :key="currency" class="stat-row"><span>{{ t('consumed') }} · {{ t('cost') }}</span><strong>{{ money(amount,currency) }}</strong></div></div></section>
      <ProjectForecast :project="project" /><section class="panel"><div class="panel-heading"><h2>{{ t('checklist') }}</h2><button class="button small" @click="addTask()"><Plus :size="14" />{{ t('addTask') }}</button></div><div class="panel-body"><ChecklistTemplates :project="project" /><p v-if="!tasks.length" class="muted">{{ t('empty') }}</p><div v-for="task in tasks" :key="task.id" class="task-row" :class="{finished:task.done}"><input :id="`task-${task.id}`" type="checkbox" :checked="task.done" @change="toggleTask(task)" /><label :for="`task-${task.id}`">{{ task.title }}<small v-if="task.dueDate" class="cell-subtitle">{{ date(task.dueDate) }}</small></label><span class="badge">{{ t(task.stage) }}</span><button class="icon-button" :aria-label="t('edit')" @click="addTask(task)"><Pencil :size="15" /></button></div></div></section>
      <section v-if="project.notes" class="panel"><div class="panel-heading"><h2>{{ t('notes') }}</h2></div><div class="panel-body"><p style="white-space:pre-wrap;font-size:.88rem">{{ project.notes }}</p></div></section>
    </div><aside class="stack"><CatalogueReferences owner-type="project" :owner="project"/><ProjectReports :project="project" /><section class="panel"><div class="project-cover" style="height:220px"><PatternThumbnail v-if="revision" :revision="revision" :label="pattern.name" /><Flower2 v-else :size="90" :stroke-width=".7" /></div><div class="panel-body"><h2>{{ pattern?.name || t('noPattern') }}</h2><p v-if="revision" class="field-help">{{ revision.width }} × {{ revision.height }} {{ t('stitches') }} · {{ revision.colors.length }} {{ t('colors') }}</p><p v-if="revision" class="field-help">{{ t('revision') }}: {{ revision.name || date(revision.createdAt) }}</p><button v-if="pattern" class="button" style="margin-top:15px" @click="navigate('pattern',pattern.id)"><FileText :size="16" />{{ t('openPattern') }}</button></div></section><section class="panel"><div class="panel-body"><div class="split-heading"><h2>{{ t('photos') }}</h2><button class="icon-button" :aria-label="t('addPhoto')" :disabled="busy" @click="addingPhotos=true"><ImagePlus :size="18" /></button></div><AttachmentList :ids="project.attachments"/><p v-if="!project.attachments.length" class="field-help">{{ t('photoHelp') }}</p></div></section></aside></div>
    <ProjectMaterials v-if="tab==='materials'" :project="project" />
    <section v-if="tab==='work'">
      <PatternEditor ref="workEditor" v-if="revision" :id="pattern.id" :project-id="project.id" />
      <div v-else class="panel"><EmptyState :icon="Flower2" :title="t('manualProgress')" :description="t('manualProgressHelp')"><button v-if="!closed" class="button primary" @click="manualProgress">{{ t('edit') }} · {{ number(project.manualPercent) }}%</button></EmptyState></div>
      <div class="panel" style="margin-top:22px"><div class="panel-body"><div class="inline-row" style="flex-wrap:wrap"><Clock3 :size="20" /><strong class="mono" style="font-size:1.5rem">{{ String(Math.floor(elapsed/3600000)).padStart(2,'0') }}:{{ String(Math.floor(elapsed/60000)%60).padStart(2,'0') }}:{{ String(Math.floor(elapsed/1000)%60).padStart(2,'0') }}</strong><button v-if="!running" class="button" :disabled="closed" @click="startTimer"><Play :size="15" />{{ t('startTimer') }}</button><button v-else class="button" @click="stopTimer"><Pause :size="15" />{{ t('pauseTimer') }}</button><button class="button primary" :disabled="!elapsed" @click="saveTimer">{{ t('saveSession') }}</button></div><p class="field-help" style="margin-top:12px">{{ t('timerHelp') }}</p></div></div>
    </section>
    <section v-if="tab==='journal'" class="panel"><div class="panel-heading"><h2>{{ t('sessions') }} · {{ number(minutes) }} {{ t('minutes') }}</h2><button class="button primary small" @click="addSession()"><Plus :size="15" />{{ t('addSession') }}</button></div><div v-if="sessions.length" class="table-wrap"><table><thead><tr><th>{{ t('date') }}</th><th>{{ t('minutes') }}</th><th>{{ t('notes') }}</th><th /></tr></thead><tbody><tr v-for="session in sessions" :key="session.id"><td>{{ date(session.date) }}</td><td>{{ number(session.durationMinutes) }}</td><td style="white-space:pre-wrap">{{ session.notes }}<AttachmentList :ids="session.attachments"/></td><td><button class="icon-button" :aria-label="t('edit')" @click="addSession(session)"><Pencil :size="16" /></button></td></tr></tbody></table></div><EmptyState v-else :icon="Clock3" :title="t('empty')" :description="t('timerHelp')" compact /></section>
    <ProjectFinishing v-if="tab==='finishing'" :project="project"/><section v-if="tab==='finishing'" class="panel"><div class="panel-heading"><h2>{{ t('finishing') }}</h2><button class="button small" @click="addTask()"><Plus :size="15" />{{ t('addTask') }}</button></div><div class="panel-body"><p class="notice">{{ t('completeHelp') }}</p><div v-for="task in tasks.filter(row=>row.stage==='finishing')" :key="task.id" class="task-row"><input :id="`finish-${task.id}`" type="checkbox" :checked="task.done" @change="toggleTask(task)" /><label :for="`finish-${task.id}`">{{ task.title }}</label><button class="icon-button" :aria-label="t('edit')" @click="addTask(task)"><Pencil :size="15" /></button></div><div class="actions" style="margin-top:24px;flex-wrap:wrap"><button v-if="!closed" class="button primary" @click="closing='completed'"><Check :size="16" />{{ t('completeProject') }}</button><button v-if="project.status!=='archived'" class="button" @click="closing='archived'"><Archive :size="16" />{{ t('archive') }}</button><button v-if="closed" class="button" @click="reopen"><RotateCcw :size="16" />{{ t('reopenProject') }}</button><button class="button" @click="duplicate"><Copy :size="16" />{{ t('duplicate') }}</button></div></div></section>
    <AttachmentEditorDialog v-if="addingPhotos" type="project.save" :owner-id="id" :attachment-ids="project.attachments" :title="t('photos')" @close="addingPhotos=false" @saved="addingPhotos=false;notify()"/>
    <ProjectTransfer v-if="showTransfer" :project-id="id" @close="showTransfer=false" />
    <EntityForm v-if="form && !revisionReview" :title="form.title" :fields="form.fields" :initial="form.initial" :submit="form.submit" :wide="form.wide" :help="form.help" @close="form=null;sessionPhotos=[]" @saved="form=null;sessionPhotos=[];notify()"><template v-if="form.session" #default="{busy}"><AttachmentList :ids="form.initial.attachments||[]"/><StagedAttachments v-model="sessionPhotos" :disabled="busy"/></template></EntityForm>
    <RevisionImpact v-if="revisionReview" :impact="revisionReview.impact" :busy="busy" :stale="state.revision!==revisionReview.impact.stateRevision" :error="revisionError" @back="revisionReview=null" @refresh="refreshRevisionReview" @confirm="applyRevision"/>
    <AppDialog v-if="closing" :title="closing==='completed'?t('completeProject'):t('archive')" :busy="busy" @close="closing=null"><p>{{ t('completeHelp') }}</p><p v-if="tasks.some(row=>!row.done)" class="notice warning">{{ t('unfinishedTasks') }}: {{ tasks.filter(row=>!row.done).length }}</p><template #footer><button class="button" :disabled="busy" @click="closing=null">{{ t('cancel') }}</button><button class="button primary" :disabled="busy" @click="finish">{{ t('confirm') }}</button></template></AppDialog>
  </div>
  <div v-else class="page"><EmptyState :title="t('noResults')"><button class="button" @click="navigate('projects')">{{ t('back') }}</button></EmptyState></div>
</template>
