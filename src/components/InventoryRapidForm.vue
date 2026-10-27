<script setup>
import { inventoryErrorText } from '../inventory-errors.mjs';
import { ref, reactive, computed } from 'vue';
import { Plus, Trash2, ChevronLeft, ChevronRight } from '@lucide/vue';
import AppDialog from './AppDialog.vue';
import FormField from './FormField.vue';
import { state, dispatch, notify, units, locate } from '../state';
import { inventoryCategories } from '../inventory-categories.mjs';
import { t, errorText, number } from '../i18n';
import { previewRapidMaterials, INVENTORY_BATCH_LIMIT } from '../../core/inventory-workflows.mjs';
const emit = defineEmits(['close', 'saved']);
const base = reactive({ brand: '', range: '', category: 'thread', unit: 'm' });
const blank = () => ({ key: crypto.randomUUID(), code: '', name: '', color: '', createLot: true, quantity: '', confidence: 'exact', locationId: '', action: 'create', allowDuplicate: false, materialId: '' });
const entries = ref([blank()]), codesText = ref(''), page = ref(1), preview = ref(null), payload = ref(null), error = ref(''), busy = ref(false);
const pages = computed(() => Math.max(1,Math.ceil(entries.value.length / 10)));
const visible = computed(() => entries.value.slice((page.value - 1) * 10, page.value * 10));
const previewRows = computed(() => preview.value?.rows.slice((page.value - 1) * 10, page.value * 10) || []);
let operationId = crypto.randomUUID();
function addRow() { if (entries.value.length < INVENTORY_BATCH_LIMIT) { entries.value.push(blank()); page.value = pages.value; } }
function removeRow(key) { entries.value = entries.value.filter(row => row.key !== key); if (!entries.value.length) entries.value.push(blank()); page.value = Math.min(page.value, pages.value); }
function pasteCodes() {
  const codes = codesText.value.split(/\r?\n/).map(code => code.trim()).filter(Boolean);
  const retained = entries.value.filter(row => row.code.trim() || row.name.trim() || row.quantity !== '');
  if (!codes.length || retained.length + codes.length > INVENTORY_BATCH_LIMIT) { error.value = t('error.inventory_batch_limit'); return; }
  entries.value = [...retained, ...codes.map(code => ({ ...blank(), code }))]; codesText.value = ''; error.value = ''; page.value = 1;
}
function review() {
  error.value = '';
  try { payload.value = { base: { ...base }, entries: entries.value.map(({ key, ...entry }) => ({ ...entry })), previewRevision: state.value.revision }; preview.value = previewRapidMaterials(state.value, payload.value); operationId = crypto.randomUUID(); page.value = 1; }
  catch (caught) { error.value = inventoryErrorText(caught); }
}
function chooseDuplicate(index, value) {
  const entry = entries.value[index];
  entry.action = value.startsWith('attach:') ? 'attach' : 'create'; entry.materialId = value.startsWith('attach:') ? value.slice(7) : ''; entry.allowDuplicate = value === 'separate';
  if (entry.action === 'attach') entry.createLot = true;
  const currentPage = page.value; review(); page.value = currentPage;
}
async function confirm() {
  busy.value = true; error.value = '';
  try { await dispatch('material.rapid', payload.value, operationId); notify(); emit('saved'); }
  catch (caught) { error.value = inventoryErrorText(caught); if (caught.code === 'inventory_preview_stale') preview.value = null; }
  finally { busy.value = false; }
}
</script>
<template>
  <AppDialog :title="t('rapidEntry')" wide :busy="busy" @close="emit('close')">
    <p class="notice">{{ t('rapidEntryHelp') }}</p><p v-if="error" role="alert" class="notice error">{{ error }}</p>
    <template v-if="!preview"><div class="form-grid"><FormField v-for="field in ['brand','range']" :key="field" :label="t(field)" v-slot="{id}"><input :id="id" v-model="base[field]" maxlength="200" /></FormField><FormField :label="t('category')" v-slot="{id}"><select :id="id" v-model="base.category"><option v-for="option in inventoryCategories" :key="option.value" :value="option.value">{{ option.label }}</option></select></FormField><FormField :label="t('unit')" v-slot="{id}"><select :id="id" v-model="base.unit"><option v-for="unit in units" :key="unit" :value="unit">{{ t(`unit_${unit}`) }}</option></select></FormField></div>
      <details class="form-section"><summary>{{ t('pasteCodes') }}</summary><FormField :label="t('codesOnePerLine')" v-slot="{id}"><textarea :id="id" v-model="codesText" maxlength="40200" /></FormField><button class="button small" @click="pasteCodes">{{ t('addCodes') }}</button></details>
      <p class="field-help form-section">{{ t('unknownHint') }} {{ t('rapidNameHelp') }}</p>
      <div class="table-wrap"><table><thead><tr><th>{{ t('code') }}</th><th>{{ t('name') }}</th><th>{{ t('quantity') }}</th><th>{{ t('entryStockMode') }}</th><th>{{ t('more') }}</th></tr></thead><tbody><template v-for="(entry,index) in visible" :key="entry.key"><tr><td><input v-model="entry.code" :aria-label="t('code')" type="text" maxlength="200" required /></td><td><input v-model="entry.name" :aria-label="t('name')" maxlength="300" /></td><td><input v-model="entry.quantity" :aria-label="t('quantity')" :disabled="!entry.createLot" inputmode="decimal" /></td><td><select v-model="entry.createLot" :aria-label="t('entryStockMode')"><option :value="true">{{ t('createInitialLot') }}</option><option :value="false">{{ t('catalogueOnly') }}</option></select></td><td><button class="icon-button" :aria-label="`${t('removeEntry')} ${(page-1)*10+index+1}`" @click="removeRow(entry.key)"><Trash2 :size="16" /></button></td></tr><tr><td colspan="5"><details><summary>{{ t('entryOptionalDetails',{number:(page-1)*10+index+1}) }}</summary><div class="form-grid"><FormField :label="t('color')" :help="t('optionalColorHelp')" v-slot="{id}"><input :id="id" v-model="entry.color" placeholder="#B04A5D" maxlength="7" /></FormField><template v-if="entry.createLot"><FormField :label="t('confidence')" v-slot="{id}"><select :id="id" v-model="entry.confidence"><option value="exact">{{ t('exact') }}</option><option value="estimated">{{ t('estimated') }}</option></select></FormField><FormField :label="t('location')" wide v-slot="{id}"><select :id="id" v-model="entry.locationId"><option value="">{{ t('none') }}</option><option v-for="location in state.locations" :key="location.id" :value="location.id">{{ locate(location.id) }}</option></select></FormField></template></div></details></td></tr></template></tbody></table></div>
      <button class="button small form-section" :disabled="entries.length >= 200" @click="addRow"><Plus :size="15" />{{ t('addEntry') }}</button>
    </template>
    <template v-else><h3>{{ t('rapidPreview', {materials:preview.materials,lots:preview.lots}) }}</h3><div class="table-wrap"><table><thead><tr><th>{{ t('code') }}</th><th>{{ t('name') }}</th><th>{{ t('quantity') }}</th><th>{{ t('duplicateDecision') }}</th></tr></thead><tbody><tr v-for="row in previewRows" :key="row.index"><td class="mono">{{ row.material.code }}</td><td>{{ row.material.name }}</td><td>{{ row.createLot ? `${number(row.quantity)} ${t(`unit_${row.material.unit}`)}` : t('catalogueOnly') }}</td><td><select v-if="row.duplicate" :value="row.action === 'attach' ? `attach:${row.materialId}` : row.needsDecision ? '' : 'separate'" :aria-label="`${t('duplicateDecision')} ${row.index+1}`" @change="chooseDuplicate(row.index,$event.target.value)"><option value="" disabled>{{ t('chooseDuplicateAction') }}</option><option value="separate">{{ t('keepSeparate') }}</option><option v-for="match in row.matches.filter(item => item.unit === row.material.unit && item.category === row.material.category)" :key="match.id" :value="`attach:${match.id}`">{{ t('addLotToExisting') }}: {{ match.name }}</option></select><span v-else>{{ t('newMaterial') }}</span></td></tr></tbody></table></div><p v-if="!preview.ready" class="notice warning">{{ t('duplicateDecisionRequired') }}</p></template>
    <div v-if="pages > 1" class="panel-heading"><span>{{ t('page') }} {{ page }} / {{ pages }}</span><div class="actions"><button class="icon-button" :aria-label="t('previousPage')" :disabled="page===1" @click="page--"><ChevronLeft :size="18" /></button><button class="icon-button" :aria-label="t('nextPage')" :disabled="page===pages" @click="page++"><ChevronRight :size="18" /></button></div></div>
    <template #footer><button class="button" :disabled="busy" @click="emit('close')">{{ t('cancel') }}</button><button v-if="preview" class="button" :disabled="busy" @click="preview = null">{{ t('back') }}</button><button v-if="!preview" class="button primary" @click="review">{{ t('previewChanges') }}</button><button v-else class="button primary" :disabled="busy || !preview.ready" @click="confirm">{{ t('confirmRapid') }}</button></template>
  </AppDialog>
</template>
