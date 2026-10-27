<script setup>
import { computed, ref, useId } from 'vue';
import { Plus } from '@lucide/vue';
import AppDialog from './AppDialog.vue';
import FormField from './FormField.vue';
import { state, dispatch, notify, normalize } from '../state';
import { t, number, money } from '../i18n';
import { inventoryErrorText } from '../inventory-errors.mjs';
import { kitPlans } from '../../core/kit-workflows.mjs';
const props = defineProps({ lotId: String, openingId: String });
const emit = defineEmits(['close']);
const formId = useId(), operationId = crypto.randomUUID(), busy = ref(false), error = ref(''), notes = ref('');
const opening = props.openingId ? state.value.kitOpenings.find(row=>row.id===props.openingId) : null;
const source = state.value.lots.find(row=>row.id===(opening?.kitLotId||props.lotId));
const definition = kitPlans(state.value).find(row=>row.kind==='physical'&&row.materialId===source?.materialId&&!row.archived);
const owners = [...new Set(state.value.reservations.filter(row=>row.lotId===source?.id&&row.quantity>0).map(row=>row.projectId))];
const projectId = ref(opening?.verification.projectId || (owners.length===1 ? owners[0] : ''));
const activeProjects = computed(()=>state.value.projects.filter(row=>!['completed','archived'].includes(row.status)));
const projectActive = computed(()=>activeProjects.value.some(row=>row.id===projectId.value));
const reserve = ref(Boolean(projectId.value)&&projectActive.value);
const materials = computed(()=>state.value.materials.filter(row=>!row.archived&&row.id!==source?.materialId));
function rowFrom(declaration,extra={}) { return { id:declaration.id,label:declaration.label,status:'unverified',actualMaterialId:declaration.substituteMaterialId||declaration.materialId||'',quantity:'',confidence:'exact',lotCode:'',notes:declaration.notes||'',declaration,...extra }; }
function additional() { return { id:crypto.randomUUID(),label:'',status:'available',actualMaterialId:'',quantity:'',confidence:'exact',lotCode:'',notes:'' }; }
const componentPage=ref(1),materialSearch=ref('');
const rows = ref(opening ? opening.verification.rows.filter(row=>row.status==='unverified').map(row=>rowFrom(row.declaration,{notes:row.notes})) : definition?.components.length ? definition.components.map(row=>rowFrom(JSON.parse(JSON.stringify(row)))) : [additional()]);
const componentPages=computed(()=>Math.max(1,Math.ceil(rows.value.length/5)));
const visibleRows=computed(()=>rows.value.slice((componentPage.value-1)*5,componentPage.value*5));
const candidates=computed(()=>materials.value.filter(row=>normalize([row.name,row.code,row.brand,row.range].join(' ')).includes(normalize(materialSearch.value))).slice(0,100));
function choices(row){const selected=materials.value.find(item=>item.id===row.actualMaterialId);return selected?[selected,...candidates.value.filter(item=>item.id!==selected.id)]:candidates.value}
function addComponent(){rows.value.push(additional());componentPage.value=componentPages.value}
function removeComponent(index){rows.value.splice((componentPage.value-1)*5+index,1);componentPage.value=Math.min(componentPage.value,componentPages.value)}
const changedRows = computed(()=>rows.value.filter(row=>row.status!=='unverified'));
const available = computed(()=>rows.value.filter(row=>row.status==='available'));
const pending = computed(()=>rows.value.filter(row=>row.status==='unverified').length);
const sharedCost = opening ? opening.unallocatedCost : source?.cost===null||!source?.quantity ? null : Math.round(source.cost/source.quantity);
function statusChanged(row) { if(row.status!=='available')row.quantity=''; }
function materialChanged(row) { const material=materials.value.find(item=>item.id===row.actualMaterialId);if(!row.declaration)row.label=material?.name||'';row.quantity=''; }
function payloadRows(list) { return list.map(({declaration,...row})=>({...row,quantity:row.status==='available'?row.quantity:null})); }
async function save() {
  busy.value=true;error.value='';
  try {
    if(opening)await dispatch('kit.opening.verify',{openingId:opening.id,openingRevision:opening.verification.revision,confirmed:true,reserveComponents:reserve.value&&projectActive.value,rows:payloadRows(changedRows.value)},operationId);
    else await dispatch('kit.openVerified',{lotId:source.id,planId:definition?.id||null,planRevision:definition?.revision||null,confirmed:true,projectId:projectId.value||null,reserveComponents:reserve.value&&projectActive.value,notes:notes.value,rows:payloadRows(rows.value)},operationId);
    notify();emit('close');
  }catch(caught){error.value=inventoryErrorText(caught)}finally{busy.value=false}
}
</script>
<template>
  <AppDialog :title="opening?t('kitVerifyPending'):t('openKit')" wide :busy="busy" @close="emit('close')">
    <p class="notice">{{ opening?t('kitPendingHelp'):t('kitActualContentsHelp') }}</p>
    <p v-if="error" class="notice error" role="alert">{{ error }}</p>
    <p class="field-help">{{ t('kitSharedCost') }}: <strong>{{ money(sharedCost,opening?.currency||source.currency) }}</strong> · {{ t('kitSharedCostHelp') }}</p>
    <form :id="formId" :inert="busy" @submit.prevent="save">
      <div class="form-grid">
        <FormField :label="t('project')" :help="t('kitReservationTransferHelp')" v-slot="{id}"><select :id="id" v-model="projectId" :disabled="Boolean(opening)" @change="reserve=Boolean(projectId)"><option value="">{{ t('kitNoProject') }}</option><option v-for="project in state.projects" :key="project.id" :value="project.id" :disabled="['completed','archived'].includes(project.status)">{{ project.name }}</option></select></FormField>
        <label class="checkbox-label"><input v-model="reserve" type="checkbox" :disabled="!projectId||!projectActive" />{{ t('kitReserveVerified') }}</label>
      </div>
      <FormField :label="t('kitFindMaterials')" :help="t('kitFindMaterialsHelp')" v-slot="{id}"><input :id="id" v-model="materialSearch" type="search" /></FormField>
      <section v-for="(row,index) in visibleRows" :key="row.id" class="form-section" role="group" :aria-label="t('kitLineLabel',{count:(componentPage-1)*5+index+1})">
        <div class="split-heading"><h3>{{ row.declaration?.label||t('kitLineLabel',{count:(componentPage-1)*5+index+1}) }}</h3><button v-if="!row.declaration&&!opening" class="button text small" type="button" :disabled="rows.length===1" @click="removeComponent(index)">{{ t('remove') }}</button></div>
        <p v-if="row.declaration" class="field-help">{{ t('kitDeclaredQuantity') }}: {{ number(row.declaration.quantity) }} {{ row.declaration.unit?t(`unit_${row.declaration.unit}`):'' }}<span v-if="row.declaration.substituteMaterialId"> · {{ t('kitPlannedReplacement') }}: {{ state.materials.find(item=>item.id===row.declaration.substituteMaterialId)?.name }}</span></p>
        <div class="form-grid">
          <FormField :label="t('kitVerificationStatus')" v-slot="{id}"><select :id="id" v-model="row.status" @change="statusChanged(row)"><option value="available">{{ t('kitStatus_available') }}</option><option value="missing">{{ t('kitStatus_missing') }}</option><option value="unverified">{{ t('kitStatus_unverified') }}</option></select></FormField>
          <FormField v-if="!row.declaration" :label="t('kitComponentDescription')" required v-slot="{id}"><input :id="id" v-model="row.label" required maxlength="300" /></FormField>
          <template v-if="row.status==='available'">
            <FormField :label="t('kitActualMaterial')" required v-slot="{id}"><select :id="id" v-model="row.actualMaterialId" required @change="materialChanged(row)"><option value="">{{ t('chooseMaterial') }}</option><option v-for="material in choices(row)" :key="material.id" :value="material.id">{{ material.name }} · {{ material.code }} · {{ t(`unit_${material.unit}`) }}</option></select></FormField>
            <FormField :label="t('kitActualQuantity')" :help="t('kitUnknownActualHelp')" v-slot="{id,describedby}"><input :id="id" v-model="row.quantity" inputmode="decimal" :aria-describedby="describedby" /></FormField>
            <FormField :label="t('confidence')" v-slot="{id}"><select :id="id" v-model="row.confidence" :disabled="row.quantity===''"><option value="exact">{{ t('exact') }}</option><option value="estimated">{{ t('estimated') }}</option></select></FormField>
            <FormField :label="t('lotCode')" v-slot="{id}"><input :id="id" v-model="row.lotCode" maxlength="200" /></FormField>
          </template>
          <FormField :label="t('notes')" wide v-slot="{id}"><input :id="id" v-model="row.notes" maxlength="2000" /></FormField>
        </div>
      </section>
      <div v-if="componentPages>1" class="panel-heading"><span>{{ t('page') }} {{ componentPage }} / {{ componentPages }}</span><div class="actions"><button class="button small" type="button" :disabled="componentPage===1" @click="componentPage--">{{ t('previousPage') }}</button><button class="button small" type="button" :disabled="componentPage===componentPages" @click="componentPage++">{{ t('nextPage') }}</button></div></div>
      <button v-if="!opening" class="button" type="button" :disabled="rows.length>=200" @click="addComponent"><Plus :size="16" />{{ t('kitAddActualComponent') }}</button>
      <FormField v-if="!opening" :label="t('kitOpeningNotes')" v-slot="{id}"><textarea :id="id" v-model="notes" maxlength="5000" rows="2" /></FormField>
      <p class="notice form-section">{{ t('kitOpeningSummary',{available:available.length,pending}) }}</p>
    </form>
    <template #footer><button class="button" :disabled="busy" @click="emit('close')">{{ t('cancel') }}</button><button class="button primary" :form="formId" type="submit" :disabled="busy||Boolean(opening)&&!changedRows.length">{{ opening?t('kitConfirmVerification'):t('confirmKitOpening') }}</button></template>
  </AppDialog>
</template>
