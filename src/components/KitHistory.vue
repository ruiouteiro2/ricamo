<script setup>
import {computed,ref} from 'vue';
import KitLibrary from './KitLibrary.vue';
import KitOpening from './KitOpening.vue';
import {state,navigate} from '../state';
import {kitMaterialDestination} from '../../core/kit-workflows.mjs';
import {t,number,date,money} from '../i18n';
const props=defineProps({materialId:String});const editing=ref(false),verifying=ref(null);
const openings=computed(()=>{const lotIds=new Set(state.value.lots.filter(row=>row.materialId===props.materialId).map(row=>row.id));return state.value.kitOpenings.filter(row=>lotIds.has(row.kitLotId)).slice().reverse()});
const materialName=id=>state.value.materials.find(row=>row.id===id)?.name||'—';
</script>
<template>
  <section class="panel"><div class="panel-heading"><h2>{{ t('kitContentsAndOpenings') }}</h2><button class="button small" @click="editing=true">{{ t('kitDeclaredContents') }}</button></div><div class="panel-body">
    <p v-if="!openings.length" class="field-help">{{ t('kitNoOpenings') }}</p>
    <details v-for="opening in openings" :key="opening.id" class="form-section"><summary>{{ date(opening.date) }} · {{ t(opening.componentLotIds.length===1?'kitOpenedComponent':'kitOpenedComponents',{count:opening.componentLotIds.length}) }}</summary>
      <p class="field-help">{{ t('kitSharedCost') }}: {{ money(opening.unallocatedCost,opening.currency) }} · {{ t('kitSharedCostHelp') }}</p>
      <template v-if="opening.verification"><p v-if="opening.verification.notes">{{ opening.verification.notes }}</p><p v-if="opening.verification.projectId" class="field-help">{{ t('project') }}: {{ state.projects.find(row=>row.id===opening.verification.projectId)?.name }}</p>
        <section v-for="row in opening.verification.rows" :key="row.id" class="form-section">
          <div class="split-heading"><strong>{{ row.declaration.label }}</strong><span class="badge" :class="{green:row.status==='available',warning:row.status==='unverified'}">{{ t(`kitStatus_${row.status}`) }}</span></div>
          <small v-if="row.origin==='additional'" class="cell-subtitle">{{ t('kitAdditionalComponent') }}</small>
          <div class="stat-row"><span>{{ t('kitDeclaredQuantity') }}</span><span>{{ number(row.declaration.quantity) }} {{ row.declaration.unit?t(`unit_${row.declaration.unit}`):'' }}</span></div>
          <div v-if="row.status==='available'" class="stat-row"><span>{{ t('kitVerifiedAtOpening') }}</span><div><button class="cell-title" @click="navigate('material',kitMaterialDestination(state,row.actualMaterialId))">{{ materialName(row.actualMaterialId) }}</button><small class="cell-subtitle">{{ number(row.quantity) }} {{ t(`unit_${state.lots.find(lot=>lot.id===row.componentLotId)?.unit}`) }}</small></div></div>
          <p v-if="row.notes" class="field-help">{{ row.notes }}</p>
        </section>
        <p class="field-help">{{ t('kitHistoryHelp') }}</p><button v-if="opening.verification.rows.some(row=>row.status==='unverified')" class="button small" @click="verifying=opening.id">{{ t('kitVerifyPending') }}</button>
      </template><div v-else class="stack"><p class="field-help">{{ t('kitLegacyOpening') }}</p><button v-for="lotId in opening.componentLotIds" :key="lotId" class="button text small" @click="navigate('material',kitMaterialDestination(state,state.lots.find(row=>row.id===lotId)?.materialId))">{{ materialName(state.lots.find(row=>row.id===lotId)?.materialId) }}</button></div>
    </details>
  </div></section>
  <KitLibrary v-if="editing" :material-id="materialId" @close="editing=false" />
  <KitOpening v-if="verifying" :opening-id="verifying" @close="verifying=null" />
</template>
