<script setup>
import {computed,ref} from 'vue';
import {state,dispatch,notify} from '../state';
import {t,number,errorText} from '../i18n';
import {checklistTemplates,checklistPreview} from '../../core/project-insights.mjs';
import AppDialog from './AppDialog.vue';
import EntityForm from './EntityForm.vue';
import FormField from './FormField.vue';
const props=defineProps({project:Object});
const dialog=ref(false),form=ref(null),selected=ref(''),mode=ref('append'),confirmed=ref(false),busy=ref(false),error=ref(''),operation=ref('');
const templates=computed(()=>checklistTemplates(state.value));
const tasks=computed(()=>state.value.tasks.filter(row=>row.projectId===props.project.id));
const preview=computed(()=>selected.value?checklistPreview(state.value,props.project.id,selected.value,mode.value):null);
function open(){selected.value=templates.value[0]?.id||'';mode.value='append';confirmed.value=false;error.value='';operation.value=crypto.randomUUID();dialog.value=true;}
function save(){const id=crypto.randomUUID();form.value={title:t('saveChecklistTemplate'),fields:[{key:'name',label:t('name'),required:true,wide:true,max:150}],initial:{name:''},submit:draft=>dispatch('template.save',{projectId:props.project.id,name:draft.name},id)};}
async function apply(){busy.value=true;error.value='';try{await dispatch('template.apply',{projectId:props.project.id,templateId:selected.value,mode:mode.value,confirmReplace:confirmed.value},operation.value);dialog.value=false;notify();}catch(caught){error.value=errorText(caught);}finally{busy.value=false;}}
</script>
<template>
 <div class="toolbar"><button class="button small" :disabled="!tasks.length" @click="save">{{t('saveChecklistTemplate')}}</button><button class="button small" :disabled="!templates.length || ['completed','archived'].includes(project.status)" @click="open">{{t('applyChecklistTemplate')}}</button></div>
 <p v-if="!templates.length" class="field-help">{{t('templateEmptyHelp')}}</p>
 <EntityForm v-if="form" :title="form.title" :fields="form.fields" :initial="form.initial" :submit="form.submit" @close="form=null" @saved="form=null;notify()"/>
 <AppDialog v-if="dialog" :title="t('applyChecklistTemplate')" :busy="busy" @close="dialog=false">
  <p v-if="error" class="notice error" role="alert">{{error}}</p>
  <div class="form-grid"><FormField :label="t('checklistTemplate')" wide v-slot="{id}"><select :id="id" v-model="selected"><option v-for="item in templates" :key="item.id" :value="item.id">{{item.name}}</option></select></FormField><FormField :label="t('templateApplyMode')" wide v-slot="{id}"><select :id="id" v-model="mode" @change="confirmed=false"><option value="append">{{t('templateAppend')}}</option><option value="replace_unfinished">{{t('templateReplace')}}</option></select></FormField></div>
  <template v-if="preview"><p class="notice">{{t('templatePreviewCounts',{added:number(preview.added,0),removed:number(preview.removed,0),retained:number(preview.retainedCompleted,0)})}}</p><ol><li v-for="(task,index) in preview.template.tasks" :key="index">{{task.title}} <span class="badge">{{t(task.stage)}}</span></li></ol><FormField v-if="preview.removed" :label="t('templateReplaceConfirm')" wide v-slot="{id}"><input :id="id" v-model="confirmed" type="checkbox"/></FormField></template>
  <template #footer><button class="button" :disabled="busy" @click="dialog=false">{{t('cancel')}}</button><button class="button primary" :disabled="busy || !preview || (preview.removed>0&&!confirmed)" @click="apply">{{t('applyChecklistTemplate')}}</button></template>
 </AppDialog>
</template>
