<script setup>
import { computed, ref } from 'vue';
import { Plus, Package, ShoppingBag, LockKeyhole, Calculator, AlertCircle } from '@lucide/vue';
import { state, dispatch, navigate, notify, locate } from '../state';
import { t, number, errorText } from '../i18n';
import { materialOptions } from '../forms';
import { shoppingNeeds } from '../../core/purchasing.mjs';
import { fabricSize } from '../../core/fabric.mjs';
import { fabricProjectFit } from '../../core/fabric-planning.mjs';
import FabricWorkspace from './FabricWorkspace.vue';
import EntityForm from './EntityForm.vue';
import EmptyState from './EmptyState.vue';
import FormField from './FormField.vue';
const props = defineProps({ project: Object });
const form = ref(null), error = ref(''), busy = ref(false);
const fabricWorkspace = ref(false);
const needs = computed(() => shoppingNeeds(state.value, [props.project.id]));
const reservations = computed(() => state.value.reservations.filter(row => row.projectId === props.project.id && row.quantity > 0));
const material = id => state.value.materials.find(row => row.id === id);
const lot = id => state.value.lots.find(row => row.id === id);
const closed = computed(() => ['completed','archived'].includes(props.project.status));
const pattern = computed(() => state.value.patterns.find(row => row.id === props.project.patternId));
const revision = computed(() => pattern.value?.revisions.find(row => row.id === props.project.revisionId));
const fabricLots = computed(() => state.value.lots.filter(row => material(row.materialId)?.category === 'fabric' && row.status === 'usable' && row.quantity > 0));
const size = computed(() => {
  if (!revision.value) return null;
  const piece = lot(props.project.fabricLotId), planned = props.project.settings.fabric || {};
  const config = piece ? { ...planned, countX: piece.properties.countX, countY: piece.properties.countY, countMeaning: piece.properties.countMeaning } : planned;
  if (!config.countX || !config.countY) return null;
  try { return fabricSize({ width: revision.value.width, height: revision.value.height, ...config }); }
  catch { return null; }
});
const fit = computed(() => {
  const piece = lot(props.project.fabricLotId);
  if (!piece || !revision.value) return null;
  return fabricProjectFit(piece, revision.value, props.project.settings.fabric);
});
function openNeed(existing) {
  const row = existing && state.value.needs.find(need => need.projectId === props.project.id && need.materialId === existing.materialId);
  form.value = { title: t('addNeed'), fields: [
    {key:'materialId',label:t('materials'),type:'select',required:true,wide:true,options:materialOptions()},
    {key:'quantity',label:t('planned'),type:'number',help:t('unknownHint')},
    {key:'confidence',label:t('confidence'),type:'select',required:true,options:['estimated','exact']},
    {key:'notes',label:t('notes'),type:'textarea',wide:true},
  ], initial: row ? {...row,confidence:row.confidence==='unknown'?'estimated':row.confidence} : {materialId:'',quantity:'',confidence:'estimated'},
  submit: draft => dispatch('need.save',{...draft,projectId:props.project.id,source:'manual'}) };
}
function reserve(materialId) {
  const options = state.value.lots.filter(row => row.status==='usable' && (!materialId || row.materialId===materialId) && row.quantity !== null).map(row=>({value:row.id,label:`${material(row.materialId)?.name} · ${row.lotCode || locate(row.locationId)} · ${number(row.quantity)} ${t(row.unit)}`}));
  form.value = {title:t('reservation'),help:t('reservationHelp'),fields:[{key:'lotId',label:t('lot'),type:'select',required:true,wide:true,options},{key:'quantity',label:t('reserved'),type:'number',required:true}],initial:{lotId:options[0]?.value||'',quantity:''},submit:draft=>dispatch('reservation.set',{...draft,projectId:props.project.id})};
}
async function release(row) { try {await dispatch('reservation.set',{projectId:props.project.id,lotId:row.lotId,quantity:0});notify();}catch(caught){error.value=errorText(caught);} }
async function shopping() { busy.value=true;try {await dispatch('purchase.generate',{projectIds:[props.project.id]});navigate('shopping');}catch(caught){error.value=errorText(caught);}finally{busy.value=false;} }
function configureFabric() {
  const config = props.project.settings.fabric || {};
  form.value = {title:t('fabric'),help:t('physicalFabricCountHelp'),fields:[
    {key:'fabricLotId',label:t('lot'),type:'select',wide:true,options:fabricLots.value.map(row=>({value:row.id,label:`${material(row.materialId)?.name} · ${row.properties.widthCm??'?'} × ${row.properties.heightCm??'?'} cm · ${locate(row.locationId)}`}))},
    {key:'countX',label:t('countX'),type:'number',required:true,when:draft=>!draft.fabricLotId},{key:'countY',label:t('countY'),type:'number',required:true,when:draft=>!draft.fabricLotId},
    {key:'countMeaning',label:t('countMeaning'),type:'select',required:true,when:draft=>!draft.fabricLotId,options:[{value:'stitches',label:()=>t('stitchesPerInch')},{value:'threads',label:()=>t('threadsPerInch')}]},
    {key:'overX',label:t('overX'),type:'number',required:true},{key:'overY',label:t('overY'),type:'number',required:true},
    ...['left','right','top','bottom'].map(key=>({key,label:`${t(key)} (cm)`,type:'number',required:true})),
  ],initial:{fabricLotId:props.project.fabricLotId||'',countX:config.countX||14,countY:config.countY||14,countMeaning:config.countMeaning||'stitches',overX:config.overX||1,overY:config.overY||1,left:config.margins?.left??3,right:config.margins?.right??3,top:config.margins?.top??3,bottom:config.margins?.bottom??3},submit:async draft=>{
    const numeric=key=>Number(String(draft[key]).replace(',','.'));
    const fabric={countX:numeric('countX'),countY:numeric('countY'),countMeaning:draft.countMeaning,overX:numeric('overX'),overY:numeric('overY'),margins:Object.fromEntries(['left','right','top','bottom'].map(key=>[key,numeric(key)]))};
    fabricSize({width:revision.value?.width||1,height:revision.value?.height||1,...fabric});
    await dispatch('project.save',{id:props.project.id,fabricLotId:draft.fabricLotId,settings:{...props.project.settings,fabric}});
  }};
}
async function estimate() {busy.value=true;error.value='';try{await dispatch('project.estimate',{projectId:props.project.id});notify();}catch(caught){error.value=errorText(caught);}finally{busy.value=false;}}
</script>
<template>
  <div class="stack">
    <p v-if="error" class="notice error" role="alert">{{ error }}</p>
    <section class="panel"><div class="panel-heading"><h2>{{ t('materials') }}</h2><div class="actions"><button v-if="revision && !closed" class="button small" :disabled="busy" @click="estimate"><Calculator :size="15" />{{ t('estimateMaterials') }}</button><button v-if="!closed" class="button small primary" @click="openNeed()"><Plus :size="15" />{{ t('addNeed') }}</button></div></div>
      <div v-if="needs.length" class="table-wrap"><table><thead><tr><th>{{ t('materials') }}</th><th>{{ t('planned') }}</th><th>{{ t('consumed') }}</th><th>{{ t('available') }}</th><th>{{ t('shortage') }}</th><th /></tr></thead><tbody><tr v-for="row in needs" :key="row.materialId"><td><button class="cell-title" @click="navigate('material',row.materialId)">{{ material(row.materialId)?.name }}</button><span class="cell-subtitle">{{ material(row.materialId)?.code }} · {{ t(row.unit) }}</span></td><td><button class="button text small" :disabled="closed" @click="openNeed(row)">{{ number(row.planned) }}</button></td><td>{{ number(row.allocations[0]?.consumed) }}</td><td>{{ number(row.eligibleForGroup) }}<span v-if="row.unknownStock" class="cell-subtitle">+ {{ t('unknown') }}</span></td><td><span class="badge" :class="row.shortfall>0?'warning':'green'">{{ number(row.shortfall) }}</span></td><td><button v-if="!closed" class="button small" @click="reserve(row.materialId)"><LockKeyhole :size="14" />{{ t('reserve') }}</button></td></tr></tbody></table></div>
      <EmptyState v-else :icon="Package" :title="t('empty')" :description="t('aggregateHelp')" compact />
      <div class="panel-body"><p class="field-help">{{ t('aggregateHelp') }}</p><p v-if="revision" class="field-help" style="margin-top:8px">{{ t('estimateHelp') }}</p><button v-if="needs.length && !closed" class="button" style="margin-top:16px" :disabled="busy" @click="shopping"><ShoppingBag :size="16" />{{ t('shopping') }}</button></div>
    </section>
    <section class="panel"><div class="panel-heading"><h2>{{ t('reserved') }}</h2><button v-if="!closed" class="button small" @click="reserve()"><Plus :size="14" />{{ t('reserve') }}</button></div><div class="panel-body"><p v-if="!reservations.length" class="muted">{{ t('empty') }}</p><div v-for="row in reservations" :key="row.id" class="stat-row"><span>{{ material(row.materialId)?.name }}<small class="cell-subtitle">{{ lot(row.lotId)?.lotCode }} · {{ locate(lot(row.lotId)?.locationId) }}</small></span><span>{{ number(row.quantity) }} {{ t(row.unit) }} <button class="button text small" @click="release(row)">{{ t('release') }}</button></span></div></div></section>
    <section class="panel"><div class="panel-heading"><h2>{{ t('fabric') }}</h2><div class="actions"><button v-if="project.fabricLotId" class="button small" @click="fabricWorkspace=true">{{ t('fabricWorkspace') }}</button><button class="button small" :disabled="closed" @click="configureFabric">{{ t('edit') }}</button></div></div><div class="panel-body"><template v-if="size"><div class="stat-row"><span>{{ t('designSize') }}</span><strong>{{ number(size.widthCm) }} × {{ number(size.heightCm) }} cm</strong></div><div class="stat-row"><span>{{ t('cutSize') }}</span><strong>{{ number(size.cutWidthCm) }} × {{ number(size.cutHeightCm) }} cm</strong></div><p v-if="fit" class="notice" :class="fit.fits?'success':'warning'"><AlertCircle :size="16" />{{ fit.fits===true?t('fabricFits'):fit.fits===false?t('fabricDoesNotFit'):t('fabricUnknown') }}</p></template><p v-else class="field-help">{{ t('fabricPlanningHelp') }}</p></div></section>
    <FabricWorkspace v-if="fabricWorkspace && project.fabricLotId" :lot-id="project.fabricLotId" :project-id="project.id" @close="fabricWorkspace=false" />
    <EntityForm v-if="form" :title="form.title" :fields="form.fields" :initial="form.initial" :help="form.help" :submit="form.submit" wide @close="form=null" @saved="form=null;notify()" />
  </div>
</template>
