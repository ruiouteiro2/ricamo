<script setup>
import {computed,ref} from 'vue';
import {state,dispatch,notify} from '../state';
import {t,number,errorText} from '../i18n';
import {availableChecklistTemplates,checklistPreview} from '../../core/project-insights.mjs';
import ChecklistTemplateEditor from './ChecklistTemplateEditor.vue';
import AppDialog from './AppDialog.vue';
import EntityForm from './EntityForm.vue';
import FormField from './FormField.vue';
const props=defineProps({project:Object});
const manage=ref(false),editor=ref(null),deletion=ref(null);
const dialog=ref(false),form=ref(null),selected=ref(''),mode=ref('append'),confirmed=ref(false),busy=ref(false),error=ref(''),operation=ref('');
const templates=computed(()=>availableChecklistTemplates(state.value));
const tasks=computed(()=>state.value.tasks.filter(row=>row.projectId===props.project.id));
const preview=computed(()=>templates.value.some(row=>row.id===selected.value)?checklistPreview(state.value,props.project.id,selected.value,mode.value):null);
function open(asManage=false){manage.value=asManage;selected.value=templates.value[0]?.id||'';mode.value='append';confirmed.value=false;error.value='';operation.value=crypto.randomUUID();dialog.value=true;}
function save(){const id=crypto.randomUUID();form.value={title:t('saveChecklistTemplate'),fields:[{key:'name',label:t('name'),required:true,wide:true,max:150}],initial:{name:''},submit:draft=>dispatch('template.save',{projectId:props.project.id,name:draft.name},id)};}
async function apply(){busy.value=true;error.value='';try{await dispatch('template.apply',{projectId:props.project.id,templateId:selected.value,mode:mode.value,confirmReplace:confirmed.value},operation.value);dialog.value=false;notify();}catch(caught){error.value=errorText(caught);}finally{busy.value=false;}}
function editTemplate(){editor.value=JSON.parse(JSON.stringify(preview.value.template));}
function requestDelete(){deletion.value={id:selected.value,name:preview.value.template.name,operation:crypto.randomUUID()};error.value='';}
async function removeTemplate(){busy.value=true;error.value='';try{await dispatch('template.delete',{id:deletion.value.id,confirmDelete:true},deletion.value.operation);deletion.value=null;selected.value=templates.value[0]?.id??'';notify()}catch(caught){error.value=errorText(caught)}finally{busy.value=false}}
</script>
<template>
 <div class="toolbar"><button class="button small" :disabled="!tasks.length" @click="save">{{t('saveChecklistTemplate')}}</button><button class="button small" :disabled="!templates.length || ['completed','archived'].includes(project.status)" @click="open(false)">{{t('applyChecklistTemplate')}}</button><button class="button small" @click="open(true)">{{t('manageChecklistTemplates')}}</button></div>
 <p v-if="!templates.length" class="field-help">{{t('templateEmptyHelp')}}</p>
 <EntityForm v-if="form" :title="form.title" :fields="form.fields" :initial="form.initial" :submit="form.submit" @close="form=null" @saved="form=null;notify()"/>
 <AppDialog v-if="dialog" :title="t(manage?'manageChecklistTemplates':'applyChecklistTemplate')" :busy="busy" @close="dialog=false">
  <p v-if="error" class="notice error" role="alert">{{error}}</p>
  <div class="form-grid"><FormField :label="t('checklistTemplate')" wide v-slot="{id}"><select :id="id" v-model="selected"><option v-for="item in templates" :key="item.id" :value="item.id">{{item.name}}</option></select></FormField><FormField v-if="!manage" :label="t('templateApplyMode')" wide v-slot="{id}"><select :id="id" v-model="mode" @change="confirmed=false"><option value="append">{{t('templateAppend')}}</option><option value="replace_unfinished">{{t('templateReplace')}}</option></select></FormField></div>
  <div v-if="manage" class="toolbar"><button class="button" @click="editor={name:'',tasks:[{title:'',stage:'preparation',notes:''}],builtin:true}">{{t('newChecklistTemplate')}}</button><button v-if="preview" class="button" @click="editTemplate">{{t(preview.template.builtin?'copyChecklistTemplate':'editChecklistTemplate')}}</button><button v-if="preview&&!preview.template.builtin" class="button danger" @click="requestDelete">{{t('deleteChecklistTemplate')}}</button></div><p v-if="preview?.template.builtin" class="field-help">{{t('builtInTemplateHelp')}}</p><template v-if="preview"><p v-if="!manage" class="notice">{{t('templatePreviewCounts',{added:number(preview.added,0),removed:number(preview.removed,0),retained:number(preview.retainedCompleted,0)})}}</p><ol><li v-for="(task,index) in preview.template.tasks" :key="index">{{task.title}} <span class="badge">{{t(task.stage)}}</span></li></ol><FormField v-if="!manage&&preview.removed" :label="t('templateReplaceConfirm')" wide v-slot="{id}"><input :id="id" v-model="confirmed" type="checkbox"/></FormField></template>
  <template #footer><button class="button" :disabled="busy" @click="dialog=false">{{t('cancel')}}</button><button v-if="!manage" class="button primary" :disabled="busy || !preview || (preview.removed>0&&!confirmed)" @click="apply">{{t('applyChecklistTemplate')}}</button></template>
 </AppDialog>
 <ChecklistTemplateEditor v-if="editor" :template="editor" @close="editor=null" @saved="id=>{editor=null;selected=id;notify()}"/>
 <AppDialog v-if="deletion" :title="t('deleteChecklistTemplate')" :busy="busy" @close="deletion=null"><p>{{t('deleteTemplateHelp',{name:deletion.name})}}</p><p v-if="error" class="notice error" role="alert">{{error}}</p><template #footer><button class="button" :disabled="busy" @click="deletion=null">{{t('cancel')}}</button><button class="button danger" :disabled="busy" @click="removeTemplate">{{t('deleteChecklistTemplate')}}</button></template></AppDialog>
</template>
