<script setup>
import CatalogueReferenceUsage from '../components/CatalogueReferenceUsage.vue';
import MaterialDescriptors from '../components/MaterialDescriptors.vue';
import { lotDescriptorInitial, lotDescriptorFields, lotDescriptorProperties } from '../material-descriptors.mjs';
import { computed, ref, watch } from 'vue';
import { ChevronLeft, Plus, Pencil, Copy, Archive, Package, ChevronsLeftRight, CircleAlert, Scissors, ImagePlus, RotateCcw, Heart } from '@lucide/vue';
import PageHeader from '../components/PageHeader.vue';
import EmptyState from '../components/EmptyState.vue';
import EntityForm from '../components/EntityForm.vue';
import InventoryLabels from '../components/InventoryLabels.vue';
import StockCountDialog from '../components/StockCountDialog.vue';
import { categoryLabel } from '../inventory-categories.mjs';
import MaterialForm from '../components/MaterialForm.vue';
import AttachmentEditorDialog from '../components/AttachmentEditorDialog.vue';
import AttachmentList from '../components/AttachmentList.vue';
import FabricWorkspace from '../components/FabricWorkspace.vue';
import KitHistory from '../components/KitHistory.vue';
import KitOpening from '../components/KitOpening.vue';
import ToolActivity from '../components/ToolActivity.vue';
import { state, dispatch, navigate, notify, locate } from '../state';
import { t, number, date, money, errorText } from '../i18n';
import { inventorySummary } from '../../core/inventory.mjs';
import { quantity } from '../../core/shared.mjs';

const props = defineProps({ id: String });
const material = computed(() => state.value.materials.find(row => row.id === props.id));
const summary = computed(() => material.value ? inventorySummary(state.value, props.id) : null);
const lots = computed(() => state.value.lots.filter(row => row.materialId === props.id).sort((a, b) => a.status === 'transformed' ? 1 : b.status === 'transformed' ? -1 : b.createdAt.localeCompare(a.createdAt)));
const historyPage = ref(1), historySize = 30;
const movements = computed(() => state.value.movements.filter(row => row.materialId === props.id || lots.value.some(lot => lot.id === row.lotId)).toReversed());
const historyPages = computed(() => Math.max(1, Math.ceil(movements.value.length / historySize)));
const history = computed(() => movements.value.slice((historyPage.value - 1) * historySize, historyPage.value * historySize));
const reservations = computed(() => state.value.reservations.filter(row => row.materialId === props.id && row.quantity > 0));
const projects = computed(() => state.value.projects.filter(row => !['completed', 'archived'].includes(row.status)));
const labeling = ref(null), counting=ref(false);
const editing = ref(false), modal = ref(null), pageError = ref(''), busy = ref(false);
const addingAttachments = ref(false);
const categoryName = computed(() => categoryLabel(material.value?.category || 'other'));
const stockKinds = computed(() => ['receipt', ...(material.value?.reusable ? [] : ['consume']), 'count', 'transfer', 'loss', 'discard', 'return']);
const projectOptions = computed(() => projects.value.map(row => ({ value: row.id, label: row.name })));
const locationOptions = computed(() => state.value.locations.map(row => ({ value: row.id, label: locate(row.id) })));
const currentLot = computed(() => modal.value?.lotId ? state.value.lots.find(row => row.id === modal.value.lotId) : null);
const modalOperation = ref('');
watch(() => props.id, () => { modal.value = null; editing.value = false; pageError.value = ''; historyPage.value = 1; });
function lotName(lot) { return lot ? [lot.lotCode || lot.id.slice(0, 8), locate(lot.locationId)].join(' · ') : '—'; }
function lotReserved(lotId) { return state.value.reservations.filter(row => row.lotId === lotId).reduce((sum, row) => sum + row.quantity, 0); }
function projectName(id) { return state.value.projects.find(row => row.id === id)?.name || '—'; }
function openModal(kind, lotId = null, initial = {}) { modalOperation.value = crypto.randomUUID(); modal.value = { kind, lotId, initial }; }
function done() { modal.value = null; notify(); }
function optionalNumber(value, field = 'quantity') { return quantity(value, { nullable: true, field }); }
function cost(value) { const amount = optionalNumber(value, 'cost'); if (amount === null) return null; if (Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001) throw Object.assign(new Error(), { code: 'invalid_number' }); return Math.round(amount * 100); }
async function duplicate() {
  busy.value = true; pageError.value = '';
  try { const before = new Set(state.value.materials.map(row => row.id)); const next = await dispatch('material.duplicate', { id: props.id, name: `${material.value.name} ${t('copySuffix')}` }); const copy = next.materials.find(row => !before.has(row.id)); notify(); if (copy) navigate('material', copy.id); }
  catch (error) { pageError.value = errorText(error); }
  finally { busy.value = false; }
}
const formConfig = computed(() => {
  if (!modal.value) return null;
  const mode = modal.value.kind, lot = currentLot.value;
  if (mode === 'lot') return { title: t('addLot'), help: t('unknownHint'), initial: { quantity: '', confidence: 'exact', status: 'usable', locationId: '', lotCode: '', cost: '', currency: state.value.settings.currency, widthCm: '', heightCm: '', notes: '', ...lotDescriptorInitial(material.value.category), ...modal.value.initial }, fields: [
    { key: 'quantity', type: 'number' }, { key: 'confidence', type: 'select', required: true, options: ['exact', 'estimated'] },
    { key: 'locationId', label: t('location'), type: 'select', options: locationOptions.value }, { key: 'lotCode' },
    { key: 'status', type: 'select', required: true, options: ['usable', 'blocked', 'damaged', 'unverified'] }, { key: 'acquiredAt', label: t('acquiredAt'), type: 'date' },
    ...(material.value.category === 'fabric' ? [{ key: 'widthCm', label: t('fabricWidthCm'), type: 'number' }, { key: 'heightCm', label: t('fabricHeightCm'), type: 'number' }, { key: 'irregular', label: t('irregularFabric'), type: 'checkbox' }] : []),
    ...lotDescriptorFields(material.value.category), { key: 'cost', type: 'number', help: t('lotCostHelp') }, { key: 'currency', max: 3 }, { key: 'supplierId', label: t('supplier'), type: 'select', options: state.value.suppliers.map(row => ({ value: row.id, label: row.name })) }, { key: 'notes', type: 'textarea', wide: true },
  ], submit: async draft => {
    const { widthCm, heightCm, irregular, ...rest } = draft;
    await dispatch('lot.add', { ...rest, materialId: props.id, quantity: optionalNumber(draft.quantity), cost: cost(draft.cost), currency: draft.currency.toUpperCase(), properties: { ...lotDescriptorProperties(draft), ...(material.value.category === 'fabric' ? { widthCm: optionalNumber(widthCm), heightCm: optionalNumber(heightCm), irregular: Boolean(irregular) } : {}) } }, modalOperation.value);
  } };
  if (mode === 'lotEdit') return { title: t('editLot'), help: t('lotEditHelp'), initial: { ...lotDescriptorInitial(material.value.category,lot.properties), status: lot.status, confidence: lot.confidence, lotCode: lot.lotCode, notes: lot.notes, widthCm: lot.properties.widthCm ?? '', heightCm: lot.properties.heightCm ?? '', irregular: lot.properties.irregular || false }, fields: [
    { key: 'lotCode' }, { key: 'status', type: 'select', required: true, options: ['usable', 'blocked', 'damaged', 'unverified'] }, { key: 'confidence', type: 'select', required: true, options: lot.quantity === null ? ['unknown'] : ['exact','estimated'] },
    ...(material.value.category === 'fabric' ? [{ key: 'widthCm', label: t('fabricWidthCm'), type: 'number' }, { key: 'heightCm', label: t('fabricHeightCm'), type: 'number' }, { key: 'irregular', label: t('irregularFabric'), type: 'checkbox' }] : []), ...lotDescriptorFields(material.value.category,lot.properties), { key: 'notes', type: 'textarea', wide: true },
  ], submit: async draft => { const { widthCm, heightCm, irregular, ...rest } = draft; await dispatch('lot.save', { id: lot.id, ...rest, properties: { ...lotDescriptorProperties(draft,lot.properties), ...(material.value.category === 'fabric' ? { widthCm: optionalNumber(widthCm), heightCm: optionalNumber(heightCm), irregular: Boolean(irregular) } : {}) } }, modalOperation.value); } };
  if (mode === 'stock') return { title: t('movement'), help: t('stockMovementHelp'), initial: { kind: modal.value.initial.kind || 'receipt', quantity: '', projectId: '', toLocationId: '', reason: '', cost: '' }, fields: [
    { key: 'kind', label: t('type'), type: 'select', required: true, options: stockKinds.value }, { key: 'quantity', type: 'number', help: t('movementQuantityHelp') },
    { key: 'projectId', label: t('project'), type: 'select', options: projectOptions.value, when: draft => draft.kind === 'consume' },
    { key: 'toLocationId', label: t('destination'), type: 'select', options: locationOptions.value, when: draft => draft.kind === 'transfer' },
    { key: 'cost', type: 'number', help: `${t('lotCostHelp')} (${lot.currency})`, when: draft => draft.kind === 'receipt' },
    { key: 'reason', type: 'textarea', wide: true },
  ], submit: async draft => { await dispatch('stock.move', { lotId: lot.id, kind: draft.kind, quantity: draft.kind === 'transfer' ? optionalNumber(draft.quantity) : quantity(draft.quantity), projectId: draft.kind === 'consume' ? draft.projectId || null : null, toLocationId: draft.kind === 'transfer' ? draft.toLocationId || null : null, reason: draft.reason, ...(draft.kind === 'receipt' ? { cost: cost(draft.cost) } : {}) }, modalOperation.value); } };
  if (mode === 'reserve') return { title: t('reservation'), help: t('reservationHelp'), initial: { projectId: '', quantity: '', ...modal.value.initial }, fields: [
    { key: 'projectId', label: t('project'), type: 'select', required: true, options: projectOptions.value }, { key: 'quantity', type: 'number', required: true },
  ], submit: async draft => { await dispatch('reservation.set', { projectId: draft.projectId, lotId: lot.id, quantity: quantity(draft.quantity) }, modalOperation.value); } };
  if (mode === 'merge') return { title: t('mergeMaterial'), help: t('mergeMaterialHelp'), initial: { targetId: '' }, fields: [{ key: 'targetId', label: t('mergeInto'), type: 'select', required: true, options: state.value.materials.filter(row => row.id !== props.id && !row.archived && row.unit === material.value.unit && row.reusable === material.value.reusable && row.packageSize === material.value.packageSize && row.strands === material.value.strands).map(row => ({ value: row.id, label: [row.name, row.brand, row.code].filter(Boolean).join(' · ') })) }], submit: async draft => { await dispatch('material.merge', { sourceId: props.id, targetId: draft.targetId }, modalOperation.value); notify(); navigate('material', draft.targetId); } };
  if (mode === 'archive') return { title: t(material.value.archived ? 'restore' : 'archive'), help: t('archiveMaterialHelp'), initial: {}, fields: [], submit: async () => { await dispatch('material.archive', { id: props.id, archived: !material.value.archived }, modalOperation.value); } };
  if (mode === 'reverse') return { title: t('reverseMovement'), help: t('reverseMovementHelp'), initial: { reason: '' }, fields: [{ key: 'reason', type: 'textarea', wide: true, required: true }], submit: async draft => { await dispatch('stock.reverse', { movementId: modal.value.initial.movementId, reason: draft.reason }, modalOperation.value); } };
  return null;
});

function openCut(lot) { openModal('cut', lot.id); }
function openKit(lot) { openModal('kit', lot.id); }

</script>

<template>
  <div v-if="material" class="page">
    <StockCountDialog v-if="counting" :material-ids="[id]" @close="counting=false" @saved="counting=false"/>
    <AttachmentEditorDialog v-if="addingAttachments" type="material.save" :owner-id="id" :attachment-ids="material.attachments" :title="t('photosAndFiles')" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf" @close="addingAttachments=false" @saved="addingAttachments=false;notify()"/>
    <button class="button text" @click="navigate('materials')"><ChevronLeft :size="16" />{{ t('materials') }}</button>
    <PageHeader :eyebrow="categoryName" :title="material.name" :description="[material.brand, material.range, material.code].filter(Boolean).join(' · ')"><button class="button" @click="counting=true">{{ t('stockCountTitle') }}</button>
      <button class="button" :disabled="busy" @click="duplicate"><Copy :size="16" />{{ t('duplicate') }}</button>
      <button class="button" :disabled="material.archived" @click="openModal('merge')">{{ t('mergeMaterial') }}</button>
      <button class="button" @click="openModal('archive')"><Archive :size="16" />{{ t(material.archived ? 'restore' : 'archive') }}</button>
      <button class="button" @click="labeling = { materialIds: [material.id] }">{{ t('inventoryLabels') }}</button>
      <button class="button primary" @click="editing = true"><Pencil :size="16" />{{ t('edit') }}</button>
    </PageHeader>
    <p v-if="pageError" class="notice error" role="alert">{{ pageError }}</p>
    <p v-if="material.archived" class="notice">{{ t('archivedMaterialHelp') }}</p>
    <div v-if="summary.conflicts.length" class="notice error" role="alert"><CircleAlert :size="18" /><div><strong>{{ t('conflict') }}</strong><p v-for="conflict in summary.conflicts" :key="conflict.lotId">{{ lotName(lots.find(lot => lot.id === conflict.lotId)) }}: {{ number(conflict.quantity) }} {{ t(`unit_${material.unit}`) }} · {{ conflict.projectIds.map(projectName).join(', ') }}</p><p>{{ t('reservationConflictHelp') }}</p><button class="button small" @click="counting=true">{{ t('stockCountTitle') }}</button></div></div>
    <div class="metrics">
      <div class="metric"><div class="metric-top">{{ t('physical') }}<Package :size="18" /></div><div class="metric-value">{{ summary.estimated ? '≈ ' : '' }}{{ number(summary.physical) }}</div><div class="metric-caption">{{ t(`unit_${material.unit}`) }}<span v-if="summary.unknown"> · {{ t('knownAtLeast') }} {{ number(summary.knownPhysical) }}</span></div></div>
      <div class="metric"><div class="metric-top">{{ t('eligible') }}</div><div class="metric-value">{{ number(summary.eligible) }}</div><div class="metric-caption">{{ t('eligibleHelpShort') }}</div></div>
      <div class="metric"><div class="metric-top">{{ t('reserved') }}</div><div class="metric-value">{{ number(summary.reserved) }}</div><div class="metric-caption">{{ number(reservations.length, 0) }} {{ t('activeReservations') }}</div></div>
      <div class="metric"><div class="metric-top">{{ t('available') }}</div><div class="metric-value">{{ number(summary.available) }}</div><div class="metric-caption">{{ summary.unknown ? t('plusUnknown') : t('quantityHelpShort') }}</div></div>
    </div>
    <div class="two-columns">
      <div class="stack">
        <CatalogueReferenceUsage v-if="material.category==='reference'" :material-id="id"/>
        <section class="panel">
          <div class="panel-heading"><h2>{{ t('lots') }}</h2><button class="button small" :disabled="material.archived" @click="openModal('lot')"><Plus :size="15" />{{ t('addLot') }}</button></div>
          <EmptyState v-if="!lots.length" compact :icon="Package" :title="t('noLots')" :description="t('noLotsHelp')"><button class="button primary" :disabled="material.archived" @click="openModal('lot')">{{ t('addLot') }}</button></EmptyState>
          <div v-else class="table-wrap"><table><thead><tr><th>{{ t('lot') }}</th><th>{{ t('quantity') }}</th><th>{{ t('status') }}</th><th>{{ t('more') }}</th></tr></thead><tbody>
            <tr v-for="lot in lots" :key="lot.id">
              <td><strong>{{ lot.lotCode || lot.id.slice(0, 8) }}</strong><span class="cell-subtitle">{{ locate(lot.locationId) }}</span><span v-if="material.category === 'fabric'" class="cell-subtitle">{{ number(lot.properties.widthCm) }} × {{ number(lot.properties.heightCm) }} cm <span v-if="lot.properties.irregular">· {{ t('irregularFabric') }}</span></span><span v-if="lot.sourceLotId" class="cell-subtitle">{{ t('cutFrom') }} {{ state.lots.find(row => row.id === lot.sourceLotId)?.lotCode || lot.sourceLotId.slice(0,8) }}</span><MaterialDescriptors :properties="lot.properties" :category="material.category" scope="lot" readonly /></td>
              <td>{{ lot.confidence === 'estimated' ? '≈ ' : '' }}{{ number(lot.quantity) }}<span class="cell-subtitle">{{ t(`unit_${material.unit}`) }}</span><span v-if="lotReserved(lot.id)" class="cell-subtitle">{{ t('reserved') }}: {{ number(lotReserved(lot.id)) }}</span><span v-if="lot.cost !== null" class="cell-subtitle">{{ money(lot.cost, lot.currency) }}</span></td>
              <td><span class="badge" :class="{ green: lot.status === 'usable', warning: ['blocked','unverified'].includes(lot.status), danger: lot.status === 'damaged' }">{{ t(lot.status) }}</span></td>
              <td><button v-if="material.reusable" class="button text small" @click="openModal('toolActivity',lot.id)">{{ t('toolActivity') }}</button><button class="button text small" @click="labeling = { lotIds: [lot.id] }">{{ t('lotLabel') }}</button><div v-if="lot.status !== 'transformed'" class="actions"><button class="icon-button" :aria-label="`${t('editLot')}: ${lotName(lot)}`" @click="openModal('lotEdit', lot.id)"><Pencil :size="16" /></button><button class="icon-button" :aria-label="`${t('movement')}: ${lotName(lot)}`" @click="openModal('stock', lot.id)"><ChevronsLeftRight :size="17" /></button><button class="button small" :disabled="!projects.length" @click="openModal('reserve', lot.id)">{{ t('reserve') }}</button></div><div v-if="material.category === 'fabric' && material.unit === 'piece'" class="actions"><button class="button text small" @click="openCut(lot)"><Scissors :size="14" />{{ t('fabricWorkspace') }}</button></div><button v-if="material.category === 'kit' && material.unit === 'piece' && lot.status === 'usable' && lot.quantity >= 1" class="button text small" @click="openKit(lot)">{{ t('openKit') }}</button></td>
            </tr>
          </tbody></table></div>
        </section>
        <section v-if="reservations.length" class="panel"><div class="panel-heading"><h2>{{ t('reserved') }}</h2></div><div class="panel-body"><div v-for="reservation in reservations" :key="reservation.id" class="stat-row"><div><button class="cell-title" @click="navigate('project', reservation.projectId)">{{ projectName(reservation.projectId) }}</button><span class="cell-subtitle">{{ lotName(lots.find(row => row.id === reservation.lotId)) }}</span></div><div class="actions"><strong>{{ number(reservation.quantity) }} {{ t(`unit_${material.unit}`) }}</strong><button class="icon-button" :aria-label="t('edit')" @click="openModal('reserve', reservation.lotId, { projectId: reservation.projectId, quantity: reservation.quantity })"><Pencil :size="16" /></button></div></div></div></section>
        <p v-if="summary.regionHeld" class="notice">{{ t('fabricRegionalStockHelp') }}</p><section class="panel"><div class="panel-heading"><h2>{{ t('history') }}</h2><span class="muted">{{ number(movements.length, 0) }}</span></div><EmptyState v-if="!movements.length" compact :title="t('noMovements')" /><div v-else class="table-wrap"><table><thead><tr><th>{{ t('date') }}</th><th>{{ t('type') }}</th><th>{{ t('quantity') }}</th><th>{{ t('notes') }}</th><th></th></tr></thead><tbody><tr v-for="movement in history" :key="movement.id"><td>{{ date(movement.date) }}<span class="cell-subtitle">{{ state.lots.find(row => row.id === movement.lotId)?.lotCode || movement.lotId.slice(0,8) }}</span></td><td>{{ t(movement.kind) }}<span v-if="movement.projectId" class="cell-subtitle">{{ projectName(movement.projectId) }}</span></td><td>{{ number(movement.quantity) }}<span class="cell-subtitle">{{ number(movement.before) }} › {{ number(movement.after) }}</span></td><td>{{ movement.reason || '—' }}</td><td><button v-if="['consume','loss','discard','return'].includes(movement.kind) && !state.movements.some(row => row.reversesId === movement.id)" class="icon-button" :aria-label="t('reverseMovement')" @click="openModal('reverse', null, { movementId: movement.id })"><RotateCcw :size="16" /></button></td></tr></tbody></table></div><div v-if="historyPages > 1" class="panel-heading"><small class="muted">{{ t('page') }} {{ historyPage }} / {{ historyPages }}</small><div class="actions"><button class="button small" :disabled="historyPage <= 1" @click="historyPage--">{{ t('previousPage') }}</button><button class="button small" :disabled="historyPage >= historyPages" @click="historyPage++">{{ t('nextPage') }}</button></div></div></section>
      </div>
      <aside class="stack">
        <KitHistory v-if="material.category==='kit'&&material.unit==='piece'" :material-id="material.id" />
        <section class="panel"><div class="panel-heading"><h2>{{ t('details') }}</h2><span class="swatch" :style="{ backgroundColor: material.color || undefined }"><Heart v-if="material.favorite" :size="17" /></span></div><div class="panel-body"><p class="field-help">{{ t('quantityHelp') }}</p><div v-for="[label, value] in [[t('brand'),material.brand],[t('range'),material.range],[t('code'),material.code],[t('minimum'),material.minimum === null ? '' : number(material.minimum)],[t('packageSize'),material.packageSize === null ? '' : number(material.packageSize)],[t('strands'),material.strands],[t('composition'),material.properties.composition]]" :key="label" class="stat-row"><span>{{ label }}</span><span>{{ value || '—' }}</span></div><div v-for="[field,value] in Object.entries(material.properties.custom || {})" :key="field" class="stat-row"><span>{{ field }}</span><span>{{ value || '—' }}</span></div><MaterialDescriptors :properties="material.properties" :category="material.category" readonly /><p v-if="material.description" class="form-section">{{ material.description }}</p><div v-if="material.tags.length" class="actions form-section"><span v-for="tag in material.tags" :key="tag" class="badge">{{ tag }}</span></div><div v-if="material.properties.care" class="form-section"><h3>{{ t('careInstructions') }}</h3><p>{{ material.properties.care }}</p></div><div v-if="material.notes" class="form-section"><h3>{{ t('notes') }}</h3><p>{{ material.notes }}</p></div></div></section>
        <section class="panel"><div class="panel-heading"><h2>{{ t('photosAndFiles') }}</h2><button class="icon-button" :disabled="busy" :aria-label="t('addAttachment')" @click="addingAttachments=true"><ImagePlus :size="18" /></button></div><div class="panel-body"><p v-if="!material.attachments.length" class="field-help">{{ t('photoHelp') }}</p><AttachmentList :ids="material.attachments"/></div></section>
      </aside>
    </div>
    <InventoryLabels v-if="labeling" v-bind="labeling" @close="labeling = null" />
    <MaterialForm v-if="editing" :material="material" @close="editing = false" @saved="editing = false; notify()" />
    <EntityForm v-if="formConfig" :key="modalOperation" v-bind="formConfig" @close="modal = null" @saved="done" />
    <ToolActivity v-if="modal?.kind === 'toolActivity'" :lot-id="currentLot.id" @close="modal=null" />
    <FabricWorkspace v-if="modal?.kind === 'cut'" :lot-id="currentLot.id" @close="modal=null" />
    <KitOpening v-if="modal?.kind === 'kit'" :lot-id="currentLot.id" @close="modal=null" />
  </div>
  <EmptyState v-else :icon="Package" :title="t('materialNotFound')"><button class="button" @click="navigate('materials')">{{ t('back') }}</button></EmptyState>
</template>
