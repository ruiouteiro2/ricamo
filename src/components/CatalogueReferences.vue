<script setup>
import {computed,ref,useId} from 'vue';
import {descriptorValue} from '../../core/material-descriptors.mjs';
import AppDialog from './AppDialog.vue';import FormField from './FormField.vue';
import {state,dispatch,navigate,notify,normalize} from '../state';import {t,errorText} from '../i18n';
const props=defineProps({owner:{type:Object,required:true},ownerType:{type:String,required:true},embedded:Boolean});const emit=defineEmits(['navigate']);
const editing=ref(null),query=ref(''),busy=ref(false),error=ref(''),operationId=ref(''),formId=useId();
const links=computed(()=>props.owner.catalogueReferences??[]);
const materials=computed(()=>new Map(state.value.materials.map(row=>[row.id,row])));
const matches=computed(()=>state.value.materials.filter(row=>row.category==='reference'&&normalize([row.name,row.brand,row.code,descriptorValue(row.properties,'author'),descriptorValue(row.properties,'isbn')].filter(Boolean).join(' ')).includes(normalize(query.value))));
const options=computed(()=>{const rows=matches.value.slice(0,100),selected=materials.value.get(editing.value?.materialId);if(selected&&!rows.some(row=>row.id===selected.id))rows.unshift(selected);return rows;});
function edit(link){editing.value={originalId:link?.materialId??null,materialId:link?.materialId??'',pages:link?.pages??''};query.value='';error.value='';operationId.value=crypto.randomUUID();}
async function save(){if(busy.value)return;busy.value=true;error.value='';try{const current=links.value.filter(row=>row.materialId!==editing.value.originalId);current.push({materialId:editing.value.materialId,pages:editing.value.pages});await dispatch(`${props.ownerType}.references.set`,{id:props.owner.id,references:current},operationId.value);editing.value=null;notify();}catch(caught){error.value=errorText(caught);}finally{busy.value=false;}}
async function remove(link){if(busy.value)return;busy.value=true;error.value='';try{await dispatch(`${props.ownerType}.references.set`,{id:props.owner.id,references:links.value.filter(row=>row.materialId!==link.materialId)});notify();}catch(caught){error.value=errorText(caught);}finally{busy.value=false;}}
function visit(id){emit('navigate');navigate('material',id)}
</script>
<template>
<section :class="embedded?'form-section':'panel'">
 <div class="panel-heading"><h2>{{t('catalogueReferences')}}</h2><button class="button small" :disabled="busy||links.length>=50" @click="edit()">{{t('catalogueReferenceAdd')}}</button></div>
 <div class="panel-body"><p class="field-help">{{t('catalogueReferenceHelp')}}</p><p v-if="error&&!editing" class="notice error" role="alert">{{error}}</p><p v-if="!links.length" class="field-help">{{t('none')}}</p>
 <div v-for="link in links" :key="link.materialId" class="stat-row"><div><button class="button text small" @click="visit(link.materialId)">{{materials.get(link.materialId)?.name}}</button><span v-if="materials.get(link.materialId)?.archived" class="badge">{{t('archived')}}</span><span class="cell-subtitle">{{t('catalogueReferencePages')}}: {{link.pages||t('unknown')}}</span></div><div class="actions"><button class="button small" :disabled="busy" :aria-label="`${t('edit')}: ${materials.get(link.materialId)?.name}`" @click="edit(link)">{{t('edit')}}</button><button class="button small" :disabled="busy" :aria-label="`${t('remove')}: ${materials.get(link.materialId)?.name}`" @click="remove(link)">{{t('remove')}}</button></div></div>
 </div>
</section>
<AppDialog v-if="editing" :title="t('catalogueReferenceEdit')" :busy="busy" @close="editing=null">
 <p v-if="error" class="notice error" role="alert">{{error}}</p><form :id="formId" @submit.prevent="save"><div class="form-grid">
 <FormField :label="t('catalogueReferenceSearch')" wide v-slot="{id}"><input :id="id" v-model="query" type="search"/></FormField>
 <FormField :label="t('catalogueReferenceChoose')" required wide v-slot="{id}"><select :id="id" v-model="editing.materialId" required><option value="">{{t('none')}}</option><option v-for="row in options" :key="row.id" :value="row.id">{{row.name}}{{row.archived?` · ${t('archived')}`:''}}</option></select></FormField>
 <p v-if="matches.length>100" class="field-help">{{t('catalogueReferenceSearchHelp')}}</p>
 <FormField :label="t('catalogueReferencePages')" :help="t('catalogueReferencePageHelp')" wide v-slot="{id,describedby}"><input :id="id" v-model="editing.pages" maxlength="500" :aria-describedby="describedby"/></FormField>
 </div></form><template #footer><button class="button" :disabled="busy" @click="editing=null">{{t('cancel')}}</button><button class="button primary" :form="formId" type="submit" :disabled="busy">{{busy?t('saving'):t('save')}}</button></template>
</AppDialog>
</template>
