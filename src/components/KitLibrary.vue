<script setup>
import { computed, ref, useId, watch } from 'vue';
import { Plus } from '@lucide/vue';
import AppDialog from './AppDialog.vue';
import FormField from './FormField.vue';
import { state, dispatch, notify, navigate, units, normalize } from '../state';
import { t, number } from '../i18n';
import { inventoryErrorText } from '../inventory-errors.mjs';
import { kitPlans, kitPlanPreview } from '../../core/kit-workflows.mjs';
const props = defineProps({ materialId: String, selectedMaterialIds: { type: Array, default: () => [] } });
const emit = defineEmits(['close']);
const formId = useId(), selected = ref(''), showArchived = ref(false), draft = ref(null), baseline = ref(''), busy = ref(false), error = ref(''), discard = ref(false);
const componentPage = ref(1), materialSearch = ref('');
const projectId = ref(''), applyMode = ref('keep'), multiplier = ref(1), preview = ref(null), confirmReplace = ref(false);
let operationId = crypto.randomUUID();
const physical = computed(() => Boolean(props.materialId));
const plans = computed(() => kitPlans(state.value).filter(row => row.kind === (physical.value ? 'physical' : 'virtual') && (!physical.value || row.materialId === props.materialId) && (showArchived.value || !row.archived)));
const current = computed(() => kitPlans(state.value).find(row => row.id === selected.value));
const materials = computed(() => state.value.materials.filter(row => !row.archived && row.id !== props.materialId));
const candidates = computed(() => materials.value.filter(row=>normalize([row.name,row.code,row.brand,row.range].join(' ')).includes(normalize(materialSearch.value))).slice(0,100));
const componentPages = computed(()=>Math.max(1,Math.ceil((draft.value?.components.length||0)/5)));
const visibleComponents = computed(()=>(draft.value?.components||[]).slice((componentPage.value-1)*5,componentPage.value*5));
watch(componentPages,count=>{componentPage.value=Math.min(componentPage.value,count)});
function choices(row) { const selected=state.value.materials.find(item=>item.id===row.materialId); return selected?[selected,...candidates.value.filter(item=>item.id!==selected.id)]:candidates.value; }
const projects = computed(() => state.value.projects.filter(row => !['completed','archived'].includes(row.status)));
const changed = computed(() => draft.value && JSON.stringify(draft.value) !== baseline.value);
const materialName = id => state.value.materials.find(row => row.id === id)?.name || '—';
const clone = value => JSON.parse(JSON.stringify(value));
function line(materialId = '') { const material = state.value.materials.find(row => row.id === materialId); return { id: crypto.randomUUID(), materialId, label: material?.name || '', quantity: '', unit: material?.unit || '', confidence: 'exact', substituteMaterialId: '', notes: '' }; }
function start(record) {
  error.value = ''; preview.value = null; discard.value = false; componentPage.value=1; materialSearch.value='';
  draft.value = record ? clone(record) : { id: crypto.randomUUID(), kind: physical.value ? 'physical' : 'virtual', materialId: props.materialId || null, name: physical.value ? materialName(props.materialId) : '', patternId: '', notes: '', components: props.selectedMaterialIds.length ? props.selectedMaterialIds.map(id => line(id)) : [line()] };
  for (const row of draft.value.components) { const material = state.value.materials.find(item => item.id === row.materialId); if (material && row.unit !== material.unit) { row.unit = material.unit; row.quantity = ''; } row.quantity ??= ''; row.materialId ||= ''; row.unit ||= ''; row.substituteMaterialId ||= ''; row.confidence = row.confidence === 'estimated' ? 'estimated' : 'exact'; }
  baseline.value = JSON.stringify(draft.value); operationId = crypto.randomUUID();
}
function changeMaterial(row) { const material = state.value.materials.find(item => item.id === row.materialId); row.label = material?.name || ''; row.unit = material?.unit || ''; row.quantity = ''; row.substituteMaterialId = ''; }
function substitutes(row) { const selected=state.value.materials.find(item=>item.id===row.substituteMaterialId); const matches=candidates.value.filter(item=>item.id!==row.materialId&&item.unit===row.unit&&item.id!==selected?.id);return selected?[selected,...matches]:matches; }
function addComponent() { draft.value.components.push(line());componentPage.value=componentPages.value; }
function close() { if (busy.value) return; if (changed.value) discard.value = true; else emit('close'); }
async function save() {
  busy.value = true; error.value = '';
  try { await dispatch('kit.plan.save', clone(draft.value), operationId); selected.value = draft.value.id; draft.value = null; notify(); }
  catch (caught) { error.value = inventoryErrorText(caught); }
  finally { busy.value = false; }
}
async function archive() {
  busy.value = true; error.value = '';
  try { await dispatch('kit.plan.archive', { id: current.value.id, archived: !current.value.archived }); preview.value = null; showArchived.value = true; notify(); }
  catch (caught) { error.value = inventoryErrorText(caught); }
  finally { busy.value = false; }
}
function review() {
  error.value = ''; confirmReplace.value = false;
  try { preview.value = kitPlanPreview(state.value, { planId: selected.value, projectId: projectId.value, mode: applyMode.value, multiplier: multiplier.value }); operationId = crypto.randomUUID(); }
  catch (caught) { error.value = inventoryErrorText(caught); }
}
async function apply() {
  busy.value = true; error.value = '';
  try { const p = preview.value; await dispatch('kit.plan.apply', { planId: p.planId, planRevision: p.planRevision, projectId: p.projectId, mode: p.mode, multiplier: p.multiplier, previewRevision: p.stateRevision, confirmReplace: confirmReplace.value }, operationId); preview.value = null; notify(); }
  catch (caught) { error.value = inventoryErrorText(caught); }
  finally { busy.value = false; }
}
if (props.selectedMaterialIds.length) start();
if (props.materialId) { const saved = kitPlans(state.value).find(row => row.kind === 'physical' && row.materialId === props.materialId && !row.archived); if (saved) selected.value = saved.id; else start(); }
</script>
<template>
  <AppDialog :title="physical ? t('kitDeclaredContents') : t('kitCollections')" wide :busy="busy" @close="close">
    <p class="notice">{{ physical ? t('kitDeclarationHelp') : t('kitVirtualHelp') }}</p>
    <p v-if="error" class="notice error" role="alert">{{ error }}</p>
    <p v-if="discard" class="notice warning" role="alert">{{ t('discardHelp') }}</p>
    <form v-if="draft" :inert="busy" :id="formId" @submit.prevent="save">
      <div class="form-grid">
        <FormField :label="t('name')" required v-slot="{id}"><input :id="id" v-model="draft.name" required maxlength="300" /></FormField>
        <FormField :label="t('kitAssociatedPattern')" v-slot="{id}"><select :id="id" v-model="draft.patternId"><option value="">{{ t('kitNoPattern') }}</option><option v-for="pattern in state.patterns" :key="pattern.id" :value="pattern.id">{{ pattern.name }}</option></select></FormField>
        <FormField :label="t('notes')" wide v-slot="{id}"><textarea :id="id" v-model="draft.notes" rows="2" maxlength="5000" /></FormField>
      </div>
      <FormField :label="t('kitFindMaterials')" :help="t('kitFindMaterialsHelp')" v-slot="{id}"><input :id="id" v-model="materialSearch" type="search" /></FormField>
      <section v-for="(row,index) in visibleComponents" :key="row.id" class="form-section" role="group" :aria-label="t('kitLineLabel',{count:(componentPage-1)*5+index+1})">
        <div class="split-heading"><h3>{{ t('kitLineLabel',{count:(componentPage-1)*5+index+1}) }}</h3><button class="button text small" type="button" @click="draft.components.splice((componentPage-1)*5+index,1)">{{ t('remove') }}</button></div>
        <div class="form-grid">
          <FormField :label="t('materials')" :required="!physical" v-slot="{id}"><select :id="id" v-model="row.materialId" :required="!physical" @change="changeMaterial(row)"><option value="">{{ physical ? t('kitNotIdentified') : t('chooseMaterial') }}</option><option v-for="material in choices(row)" :key="material.id" :value="material.id" :disabled="material.archived">{{ material.name }} · {{ material.code }} · {{ t(`unit_${material.unit}`) }}</option></select></FormField>
          <FormField :label="t('kitComponentDescription')" required v-slot="{id}"><input :id="id" v-model="row.label" required maxlength="300" /></FormField>
          <FormField :label="physical ? t('kitDeclaredQuantity') : t('kitPlannedQuantity')" :help="t('unknownHint')" v-slot="{id,describedby}"><input :id="id" v-model="row.quantity" inputmode="decimal" :aria-describedby="describedby" /></FormField>
          <FormField :label="t('unit')" v-slot="{id}"><select :id="id" v-model="row.unit" :disabled="Boolean(row.materialId)"><option value="">{{ t('unknown') }}</option><option v-for="unit in units" :key="unit" :value="unit">{{ t(`unit_${unit}`) }}</option></select></FormField>
          <FormField :label="t('confidence')" v-slot="{id}"><select :id="id" v-model="row.confidence" :disabled="row.quantity==='' "><option value="exact">{{ t('exact') }}</option><option value="estimated">{{ t('estimated') }}</option></select></FormField>
          <FormField :label="t('kitPlannedReplacement')" :help="t('kitReplacementHelp')" v-slot="{id}"><select :id="id" v-model="row.substituteMaterialId" :disabled="!row.materialId"><option value="">{{ t('kitNoReplacement') }}</option><option v-for="material in substitutes(row)" :key="material.id" :value="material.id">{{ material.name }} · {{ material.code }}</option></select></FormField>
          <FormField :label="t('notes')" wide v-slot="{id}"><input :id="id" v-model="row.notes" maxlength="2000" /></FormField>
        </div>
      </section>
      <div v-if="componentPages>1" class="panel-heading"><span>{{ t('page') }} {{ componentPage }} / {{ componentPages }}</span><div class="actions"><button class="button small" type="button" :disabled="componentPage===1" @click="componentPage--">{{ t('previousPage') }}</button><button class="button small" type="button" :disabled="componentPage===componentPages" @click="componentPage++">{{ t('nextPage') }}</button></div></div>
      <button class="button" type="button" :disabled="draft.components.length>=200" @click="addComponent"><Plus :size="16" />{{ t('addComponent') }}</button>
    </form>
    <template v-else>
      <div class="form-grid"><FormField :label="physical ? t('kitDeclaredContents') : t('kitCollections')" v-slot="{id}"><select :id="id" v-model="selected" @change="preview=null"><option value="">{{ t('kitChooseList') }}</option><option v-for="record in plans" :key="record.id" :value="record.id">{{ record.name }}{{ record.archived ? ` · ${t('archived')}` : '' }}</option></select></FormField><label class="checkbox-label"><input v-model="showArchived" type="checkbox" />{{ t('kitShowArchived') }}</label></div>
      <div class="actions form-section"><button class="button" :disabled="physical && plans.some(row=>!row.archived)" @click="start()"><Plus :size="16" />{{ t('kitNewList') }}</button><button v-if="current" class="button" @click="start(current)">{{ t('edit') }}</button><button v-if="current" class="button" @click="archive">{{ current.archived ? t('restore') : t('archive') }}</button></div>
      <template v-if="current">
        <p v-if="current.notes">{{ current.notes }}</p><button v-if="current.patternId" class="button text small" @click="navigate('pattern',current.patternId);emit('close')">{{ t('kitAssociatedPattern') }}: {{ state.patterns.find(row=>row.id===current.patternId)?.name }}</button>
        <div class="table-wrap form-section"><table><thead><tr><th>{{ t('component') }}</th><th>{{ physical ? t('kitDeclaredQuantity') : t('kitPlannedQuantity') }}</th><th>{{ t('kitPlannedReplacement') }}</th></tr></thead><tbody><tr v-for="row in current.components" :key="row.id"><td>{{ row.label }}<small v-if="row.notes" class="cell-subtitle">{{ row.notes }}</small></td><td>{{ row.confidence==='estimated' ? '≈ ' : '' }}{{ number(row.quantity) }} {{ row.unit ? t(`unit_${row.unit}`) : '' }}</td><td>{{ row.substituteMaterialId ? materialName(row.substituteMaterialId) : '—' }}</td></tr></tbody></table></div>
        <section v-if="!physical && !current.archived" class="form-section">
          <h3>{{ t('kitApplyToProject') }}</h3><p class="field-help">{{ t('kitApplyHelp') }}</p>
          <div class="form-grid"><FormField :label="t('project')" v-slot="{id}"><select :id="id" v-model="projectId" @change="preview=null"><option value="">{{ t('kitChooseProject') }}</option><option v-for="project in projects" :key="project.id" :value="project.id">{{ project.name }}</option></select></FormField><FormField :label="t('kitListCopies')" v-slot="{id}"><input :id="id" v-model="multiplier" type="number" min="1" max="100" step="1" @input="preview=null" /></FormField><FormField :label="t('kitExistingRequirements')" wide v-slot="{id}"><select :id="id" v-model="applyMode" @change="preview=null"><option value="keep">{{ t('kitKeepRequirements') }}</option><option value="replace">{{ t('kitReplaceRequirements') }}</option></select></FormField></div>
          <button class="button form-section" :disabled="!projectId" @click="review">{{ t('preview') }}</button>
          <template v-if="preview"><div class="table-wrap form-section"><table><thead><tr><th>{{ t('materials') }}</th><th>{{ t('kitPlannedQuantity') }}</th><th>{{ t('kitCurrentRequirement') }}</th><th>{{ t('available') }}</th><th>{{ t('kitChange') }}</th></tr></thead><tbody><tr v-for="row in preview.rows" :key="row.materialId"><td>{{ materialName(row.materialId) }}</td><td>{{ number(row.quantity) }} {{ t(`unit_${row.unit}`) }}</td><td>{{ row.existingNeedId ? number(row.previousQuantity) : '—' }}</td><td>{{ number(row.available) }}<small v-if="row.unknownStock" class="cell-subtitle">{{ t('plusUnknown') }}</small></td><td>{{ t(`kitChange_${row.action}`) }}</td></tr></tbody></table></div><p v-if="!preview.changes" class="notice">{{ t('kitNothingToApply') }}</p><label v-if="preview.rows.some(row=>row.action==='replace')" class="checkbox-label"><input v-model="confirmReplace" type="checkbox" />{{ t('kitConfirmReplacement') }}</label><button class="button primary form-section" :disabled="!preview.changes || preview.rows.some(row=>row.action==='replace')&&!confirmReplace" @click="apply">{{ t('kitApplyReviewed') }}</button></template>
        </section>
      </template>
    </template>
    <template #footer><template v-if="discard"><button class="button" @click="discard=false">{{ t('back') }}</button><button class="button danger" @click="emit('close')">{{ t('discardChanges') }}</button></template><template v-else><button class="button" :disabled="busy" @click="close">{{ t('close') }}</button><button v-if="draft" class="button primary" :form="formId" type="submit" :disabled="busy">{{ t('save') }}</button></template></template>
  </AppDialog>
</template>
