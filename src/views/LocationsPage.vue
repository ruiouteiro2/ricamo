<script setup>
import { computed, ref } from 'vue';
import { Archive, Boxes, ChevronRight, FolderOpen, MapPin, Package, Pencil, Plus, Search, Printer, ArrowLeft } from '@lucide/vue';
import PageHeader from '../components/PageHeader.vue';
import EmptyState from '../components/EmptyState.vue';
import EntityForm from '../components/EntityForm.vue';
import FormField from '../components/FormField.vue';
import { state, dispatch, navigate, normalize, locate, notify, statusText } from '../state';
import { storage } from '../storage';
import { t, number, errorText } from '../i18n';

const search = ref(''), contentSearch = ref(''), selectedId = ref(''), includeChildren = ref(true);
const form = ref(null), labelMode = ref(null), labelWidth = ref(90), labelHeight = ref(50), busy = ref(false), error = ref('');
const materialById = computed(() => new Map(state.value.materials.map(material => [material.id, material])));
const locationById = computed(() => new Map(state.value.locations.map(location => [location.id, location])));
const physicalLots = computed(() => state.value.lots.filter(lot => lot.status !== 'transformed' && (lot.quantity === null || lot.quantity > 0)));
const unassignedCount = computed(() => physicalLots.value.filter(lot => !lot.locationId).length);
const selected = computed(() => selectedId.value && selectedId.value !== '__unassigned' ? locationById.value.get(selectedId.value) : null);
const sortedLocations = computed(() => state.value.locations.filter(location => normalize(`${locate(location.id)} ${location.notes}`).includes(normalize(search.value))).sort((a, b) => locate(a.id).localeCompare(locate(b.id))));
const contents = computed(() => {
  if (!selectedId.value) return [];
  const ids = includeChildren.value && selected.value ? descendants(selected.value.id) : new Set([selectedId.value]);
  return physicalLots.value.filter(lot => selectedId.value === '__unassigned' ? !lot.locationId : ids.has(lot.locationId)).filter(lot => {
    const material = materialById.value.get(lot.materialId);
    return normalize([material?.name, material?.code, material?.brand, lot.lotCode, lot.notes].join(' ')).includes(normalize(contentSearch.value));
  }).sort((a, b) => (materialById.value.get(a.materialId)?.name || '').localeCompare(materialById.value.get(b.materialId)?.name || ''));
});
const formFields = computed(() => {
  const excluded = form.value?.initial.id ? descendants(form.value.initial.id) : new Set();
  return [
    { key: 'name', required: true, wide: true },
    { key: 'parentId', label: t('parentLocation'), type: 'select', wide: true, options: state.value.locations.filter(location => !excluded.has(location.id)).map(location => ({ value: location.id, label: locate(location.id) })).sort((a, b) => a.label.localeCompare(b.label)) },
    { key: 'notes', type: 'textarea', wide: true },
  ];
});
const labelDimensionsValid = computed(() => Number.isFinite(Number(labelWidth.value)) && Number.isFinite(Number(labelHeight.value)) && Number(labelWidth.value) >= 30 && Number(labelWidth.value) <= 180 && Number(labelHeight.value) >= 20 && Number(labelHeight.value) <= 250);

function descendants(id) {
  const ids = new Set([id]); let changed = true;
  while (changed) {
    changed = false;
    for (const location of state.value.locations) if (location.parentId && ids.has(location.parentId) && !ids.has(location.id)) { ids.add(location.id); changed = true; }
  }
  return ids;
}
function depth(location) {
  let count = 0, current = location, seen = new Set();
  while (current?.parentId && !seen.has(current.id)) { seen.add(current.id); current = locationById.value.get(current.parentId); count++; }
  return count;
}
function locationLotCount(id) { return physicalLots.value.filter(lot => lot.locationId === id).length; }
function locationMaterialCount(id) { return new Set(physicalLots.value.filter(lot => lot.locationId === id).map(lot => lot.materialId)).size; }
function selectLocation(id) { selectedId.value = id; contentSearch.value = ''; }
function openForm(location = null, parentId = '') {
  form.value = { key: crypto.randomUUID(), operationId: crypto.randomUUID(), title: location ? 'editLocation' : 'addLocation', initial: location ? { ...location, parentId: location.parentId || '' } : { id: crypto.randomUUID(), name: '', parentId, notes: '' } };
}
async function submitForm(draft) { await dispatch('location.save', { ...draft, parentId: draft.parentId || null }, form.value.operationId); }
function saved() { selectedId.value = form.value.initial.id; form.value = null; notify(); }
function openLabel(location) { labelMode.value = location; error.value = ''; }
async function printLabel() {
  if (busy.value || !labelDimensionsValid.value) return;
  busy.value = true; error.value = '';
  try { await storage.print(); } catch (caught) { error.value = errorText(caught); }
  finally { busy.value = false; }
}
</script>

<template>
  <template v-if="labelMode">
    <PageHeader class="label-preview-heading" :eyebrow="t('locations')" :title="t('storageLabel')" :description="t('labelPrintHelp')">
      <button class="button" @click="labelMode = null"><ArrowLeft :size="16" />{{ t('back') }}</button>
      <button class="button primary" :disabled="busy || !labelDimensionsValid" @click="printLabel"><Printer :size="16" />{{ t('print') }}</button>
    </PageHeader>
    <p v-if="error" class="notice error" role="alert">{{ error }}</p>
    <div class="toolbar">
      <FormField :label="t('labelWidth')" v-slot="{ id }"><input :id="id" v-model="labelWidth" type="number" min="30" max="180" /></FormField>
      <FormField :label="t('labelHeight')" v-slot="{ id }"><input :id="id" v-model="labelHeight" type="number" min="20" max="250" /></FormField>
      <p class="field-help">{{ t('labelSizeHelp') }}</p>
    </div>
    <p v-if="!labelDimensionsValid" class="notice error" role="alert">{{ t('labelSizeHelp') }}</p>
    <div class="table-wrap"><article class="panel panel-body" :style="{ width: `${labelDimensionsValid ? labelWidth : 90}mm`, minHeight: `${labelDimensionsValid ? labelHeight : 50}mm`, overflowWrap: 'anywhere' }">
      <p class="eyebrow">{{ t('location') }}</p><h2>{{ labelMode.name }}</h2><p class="cell-subtitle">{{ locate(labelMode.id) }}</p><p class="mono">{{ labelMode.id }}</p>
    </article></div>
  </template>
  <template v-else>
    <PageHeader :eyebrow="t('locations')" :title="t('locationsTitle')" :description="t('locationsSubtitle')">
      <button class="button primary" @click="openForm()"><Plus :size="17" />{{ t('addLocation') }}</button>
    </PageHeader>
    <div class="metrics">
      <div class="metric"><div class="metric-top">{{ t('locations') }}<MapPin :size="18" /></div><div class="metric-value">{{ number(state.locations.length, 0) }}</div><div class="metric-caption">{{ t('storagePlaces') }}</div></div>
      <div class="metric"><div class="metric-top">{{ t('storedLots') }}<Package :size="18" /></div><div class="metric-value">{{ number(physicalLots.filter(lot => lot.locationId).length, 0) }}</div><div class="metric-caption">{{ t('knownLocations') }}</div></div>
      <div class="metric"><div class="metric-top">{{ t('unassignedStorage') }}<Archive :size="18" /></div><div class="metric-value">{{ number(unassignedCount, 0) }}</div><div class="metric-caption">{{ t('lotsWithoutLocation') }}</div></div>
      <div class="metric"><div class="metric-top">{{ t('materials') }}<Boxes :size="18" /></div><div class="metric-value">{{ number(new Set(physicalLots.map(lot => lot.materialId)).size, 0) }}</div><div class="metric-caption">{{ t('materialsWithStock') }}</div></div>
    </div>
    <div class="toolbar"><div class="toolbar-search"><Search :size="17" /><input v-model="search" :aria-label="t('searchLocations')" :placeholder="t('searchLocations')" /></div><button class="button" :class="{ primary: selectedId === '__unassigned' }" @click="selectLocation('__unassigned')">{{ t('unassignedStorage') }} ({{ number(unassignedCount, 0) }})</button></div>
    <div v-if="!state.locations.length && !selectedId" class="panel"><EmptyState :icon="FolderOpen" :title="t('emptyLocations')" :description="t('emptyLocationsBody')"><button class="button primary" @click="openForm()">{{ t('addLocation') }}</button></EmptyState></div>
    <div v-else class="stack">
      <div class="panel"><div class="table-wrap" v-if="sortedLocations.length"><table><caption class="sr-only">{{ t('locations') }}</caption><thead><tr><th>{{ t('name') }}</th><th>{{ t('storedLots') }}</th><th>{{ t('materials') }}</th><th><span class="sr-only">{{ t('actions') }}</span></th></tr></thead><tbody>
        <tr v-for="location in sortedLocations" :key="location.id">
          <td><div class="inline-row" :style="{ paddingInlineStart: `${Math.min(depth(location), 6) * 14}px` }"><ChevronRight v-if="location.parentId" :size="14" class="muted" /><FolderOpen v-else :size="18" class="muted" /><div><button class="cell-title" :aria-expanded="selectedId === location.id" @click="selectLocation(location.id)">{{ location.name }}</button><span v-if="location.parentId" class="cell-subtitle">{{ locate(location.parentId) }}</span></div></div></td>
          <td>{{ number(locationLotCount(location.id), 0) }}</td><td>{{ number(locationMaterialCount(location.id), 0) }}</td>
          <td><div class="actions"><button class="icon-button" :aria-label="t('editNamedLocation', { name: location.name })" @click="openForm(location)"><Pencil :size="16" /></button><button class="icon-button" :aria-label="t('printNamedLocation', { name: location.name })" @click="openLabel(location)"><Printer :size="16" /></button><button class="button small" @click="openForm(null, location.id)"><Plus :size="15" />{{ t('addInside') }}</button></div></td>
        </tr>
      </tbody></table></div><EmptyState v-else compact :title="t('noResults')" /></div>
      <section v-if="selectedId" class="panel" :aria-label="t('storageContents')"><div class="panel-heading"><div><h2>{{ selected?.name || t('unassignedStorage') }}</h2><span v-if="selected" class="cell-subtitle">{{ locate(selected.id) }}</span></div><button v-if="selected" class="button small" @click="openForm(selected)"><Pencil :size="15" />{{ t('edit') }}</button></div>
        <div class="panel-body"><p v-if="selected?.notes">{{ selected.notes }}</p><p class="field-help">{{ t('storageMoveHelp') }}</p><div class="toolbar"><div class="toolbar-search"><Search :size="17" /><input v-model="contentSearch" :aria-label="t('searchMaterials')" :placeholder="t('searchMaterials')" /></div><label v-if="selected" class="checkbox-label"><input v-model="includeChildren" type="checkbox" />{{ t('includeChildLocations') }}</label></div></div>
        <div v-if="contents.length" class="table-wrap"><table><caption class="sr-only">{{ t('storageContents') }}</caption><thead><tr><th>{{ t('material') }}</th><th>{{ t('lotCode') }}</th><th>{{ t('quantity') }}</th><th>{{ t('location') }}</th><th>{{ t('status') }}</th><th><span class="sr-only">{{ t('actions') }}</span></th></tr></thead><tbody>
          <tr v-for="lot in contents" :key="lot.id"><td><button class="cell-title" @click="navigate('material', lot.materialId)">{{ materialById.get(lot.materialId)?.name || t('unknown') }}</button><span class="cell-subtitle mono">{{ [materialById.get(lot.materialId)?.brand, materialById.get(lot.materialId)?.code].filter(Boolean).join(' · ') }}</span></td><td>{{ lot.lotCode || '—' }}</td><td>{{ number(lot.quantity, 6) }}<span class="cell-subtitle">{{ t(lot.unit) }} · {{ t(lot.confidence) }}</span></td><td>{{ lot.locationId ? locate(lot.locationId) : t('unassignedStorage') }}</td><td><span class="badge" :class="{ warning: lot.status !== 'usable' }">{{ statusText(lot.status) }}</span></td><td><button class="button small" @click="navigate('material', lot.materialId)">{{ t('viewMaterial') }}<ChevronRight :size="15" /></button></td></tr>
        </tbody></table></div><EmptyState v-else compact :icon="Package" :title="t('emptyLocationContents')" :description="t('emptyLocationContentsHelp')"><button class="button" @click="navigate('materials')">{{ t('materials') }}</button></EmptyState>
      </section>
      <p v-else class="notice">{{ t('selectStorageHelp') }}</p>
    </div>
    <EntityForm v-if="form" :key="form.key" :title="t(form.title)" :fields="formFields" :initial="form.initial" :submit="submitForm" :help="t('locationFormHelp')" @close="form = null" @saved="saved" />
  </template>
</template>

<style scoped>
@media print { .label-preview-heading { display: none !important; } }
</style>
