<script setup>
import { computed, ref, watch } from 'vue';
import { ArrowLeft, Plus, Pencil, Copy, Archive, Package, ArrowRightLeft, CircleAlert, Scissors, ImagePlus, Download, RotateCcw, Heart } from '@lucide/vue';
import PageHeader from '../components/PageHeader.vue';
import EmptyState from '../components/EmptyState.vue';
import AppDialog from '../components/AppDialog.vue';
import EntityForm from '../components/EntityForm.vue';
import FormField from '../components/FormField.vue';
import MaterialForm from '../components/MaterialForm.vue';
import { state, dispatch, navigate, notify, locate, importAsset, assetUrl } from '../state';
import { storage } from '../storage';
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
const editing = ref(false), modal = ref(null), pageError = ref(''), busy = ref(false), photos = ref([]);
const attachmentInput = ref();
const categoryName = computed(() => state.value.categories.find(row => row.id === material.value?.category)?.name || t(material.value?.category || 'other'));
const stockKinds = computed(() => ['receipt', ...(material.value?.reusable ? [] : ['consume']), 'count', 'transfer', 'loss', 'discard', 'return']);
const projectOptions = computed(() => projects.value.map(row => ({ value: row.id, label: row.name })));
const locationOptions = computed(() => state.value.locations.map(row => ({ value: row.id, label: locate(row.id) })));
const currentLot = computed(() => modal.value?.lotId ? state.value.lots.find(row => row.id === modal.value.lotId) : null);
const modalOperation = ref('');
watch(() => props.id, () => { modal.value = null; editing.value = false; pageError.value = ''; historyPage.value = 1; });
let attachmentRequest = 0;
watch(() => material.value?.attachments.join('|'), async () => {
  const request = ++attachmentRequest, rows = [];
  for (const id of material.value?.attachments || []) {
    const metadata = state.value.attachments.find(row => row.id === id);
    if (!metadata) continue;
    try { rows.push({ ...metadata, url: metadata.mime.startsWith('image/') ? await assetUrl(id) : null }); }
    catch { rows.push({ ...metadata, unavailable: true }); }
  }
  if (request === attachmentRequest) photos.value = rows;
}, { immediate: true });
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
async function addPhotos(event) {
  busy.value = true; pageError.value = '';
  try {
    const ids = [...material.value.attachments];
    for (const file of event.target.files) { const asset = await importAsset(file); if (!ids.includes(asset.id)) ids.push(asset.id); }
    await dispatch('material.save', { id: props.id, attachments: ids }); notify();
  } catch (error) { pageError.value = errorText(error); }
  finally { busy.value = false; event.target.value = ''; }
}
async function downloadAttachment(attachment) {
  try { await storage.saveFile({ name: attachment.name, data: await storage.getAsset(attachment.id) }); }
  catch (error) { pageError.value = errorText(error); }
}
const formConfig = computed(() => {
  if (!modal.value) return null;
  const mode = modal.value.kind, lot = currentLot.value;
  if (mode === 'lot') return { title: t('addLot'), help: t('unknownHint'), initial: { quantity: '', confidence: 'exact', status: 'usable', locationId: '', lotCode: '', cost: '', currency: state.value.settings.currency, widthCm: '', heightCm: '', notes: '', ...modal.value.initial }, fields: [
    { key: 'quantity', type: 'number' }, { key: 'confidence', type: 'select', required: true, options: ['exact', 'estimated'] },
    { key: 'locationId', label: t('location'), type: 'select', options: locationOptions.value }, { key: 'lotCode' },
    { key: 'status', type: 'select', required: true, options: ['usable', 'blocked', 'damaged', 'unverified'] }, { key: 'acquiredAt', label: t('acquiredAt'), type: 'date' },
    ...(material.value.category === 'fabric' ? [{ key: 'widthCm', label: t('fabricWidthCm'), type: 'number' }, { key: 'heightCm', label: t('fabricHeightCm'), type: 'number' }, { key: 'irregular', label: t('irregularFabric'), type: 'checkbox' }] : []),
    { key: 'cost', type: 'number', help: t('lotCostHelp') }, { key: 'currency', max: 3 }, { key: 'supplierId', label: t('supplier'), type: 'select', options: state.value.suppliers.map(row => ({ value: row.id, label: row.name })) }, { key: 'notes', type: 'textarea', wide: true },
  ], submit: async draft => {
    const { widthCm, heightCm, irregular, ...rest } = draft;
    await dispatch('lot.add', { ...rest, materialId: props.id, quantity: optionalNumber(draft.quantity), cost: cost(draft.cost), currency: draft.currency.toUpperCase(), properties: material.value.category === 'fabric' ? { widthCm: optionalNumber(widthCm), heightCm: optionalNumber(heightCm), irregular: Boolean(irregular) } : {} }, modalOperation.value);
  } };
  if (mode === 'lotEdit') return { title: t('editLot'), help: t('lotEditHelp'), initial: { status: lot.status, confidence: lot.confidence, lotCode: lot.lotCode, notes: lot.notes, widthCm: lot.properties.widthCm ?? '', heightCm: lot.properties.heightCm ?? '', irregular: lot.properties.irregular || false }, fields: [
    { key: 'lotCode' }, { key: 'status', type: 'select', required: true, options: ['usable', 'blocked', 'damaged', 'unverified'] }, { key: 'confidence', type: 'select', required: true, options: lot.quantity === null ? ['unknown'] : ['exact','estimated'] },
    ...(material.value.category === 'fabric' ? [{ key: 'widthCm', label: t('fabricWidthCm'), type: 'number' }, { key: 'heightCm', label: t('fabricHeightCm'), type: 'number' }, { key: 'irregular', label: t('irregularFabric'), type: 'checkbox' }] : []), { key: 'notes', type: 'textarea', wide: true },
  ], submit: async draft => { const { widthCm, heightCm, irregular, ...rest } = draft; await dispatch('lot.save', { id: lot.id, ...rest, properties: { ...lot.properties, ...(material.value.category === 'fabric' ? { widthCm: optionalNumber(widthCm), heightCm: optionalNumber(heightCm), irregular: Boolean(irregular) } : {}) } }, modalOperation.value); } };
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

const cutDraft = ref({ widthCm: '', heightCm: '', xCm: '0', yCm: '0', projectId: '', reason: '' });
const cutError = ref('');
const cutPreview = computed(() => {
  const lot = currentLot.value;
  if (!lot || modal.value?.kind !== 'cut') return null;
  try {
    const w = quantity(cutDraft.value.widthCm, { positive: true }), h = quantity(cutDraft.value.heightCm, { positive: true }), x = quantity(cutDraft.value.xCm), y = quantity(cutDraft.value.yCm);
    const sw = quantity(lot.properties.widthCm, { positive: true }), sh = quantity(lot.properties.heightCm, { positive: true });
    return { valid: x + w <= sw && y + h <= sh, x, y, width: w, height: h, sourceWidth: sw, sourceHeight: sh, area: sw * sh, cutArea: w * h };
  } catch { return null; }
});
function openCut(lot) { cutDraft.value = { widthCm: '', heightCm: '', xCm: '0', yCm: '0', projectId: '', reason: '' }; cutError.value = ''; openModal('cut', lot.id); }
async function confirmCut() {
  if (busy.value || !cutPreview.value?.valid) return;
  busy.value = true; cutError.value = '';
  try { await dispatch('fabric.cut', { lotId: currentLot.value.id, ...cutDraft.value, projectId: cutDraft.value.projectId || null }, modalOperation.value); done(); }
  catch (error) { cutError.value = errorText(error); }
  finally { busy.value = false; }
}
const kitComponents = ref([]), kitError = ref('');
const componentMaterials = computed(() => state.value.materials.filter(row => row.id !== props.id && !row.archived));
function addComponent() { kitComponents.value.push({ key: crypto.randomUUID(), materialId: '', quantity: '', confidence: 'exact', lotCode: '' }); }
function openKit(lot) { kitComponents.value = []; kitError.value = ''; addComponent(); openModal('kit', lot.id); }
async function confirmKit() {
  if (busy.value) return;
  busy.value = true; kitError.value = '';
  try { const components = kitComponents.value.map(({ key, ...row }) => ({ ...row, quantity: optionalNumber(row.quantity) })); await dispatch('kit.open', { lotId: currentLot.value.id, components }, modalOperation.value); done(); }
  catch (error) { kitError.value = errorText(error); }
  finally { busy.value = false; }
}
</script>

<template>
  <div v-if="material">
    <button class="button text" @click="navigate('materials')"><ArrowLeft :size="16" />{{ t('materials') }}</button>
    <PageHeader :eyebrow="categoryName" :title="material.name" :description="[material.brand, material.range, material.code].filter(Boolean).join(' · ')">
      <button class="button" :disabled="busy" @click="duplicate"><Copy :size="16" />{{ t('duplicate') }}</button>
      <button class="button" :disabled="material.archived" @click="openModal('merge')">{{ t('mergeMaterial') }}</button>
      <button class="button" @click="openModal('archive')"><Archive :size="16" />{{ t(material.archived ? 'restore' : 'archive') }}</button>
      <button class="button primary" @click="editing = true"><Pencil :size="16" />{{ t('edit') }}</button>
    </PageHeader>
    <p v-if="pageError" class="notice error" role="alert">{{ pageError }}</p>
    <p v-if="material.archived" class="notice">{{ t('archivedMaterialHelp') }}</p>
    <div v-if="summary.conflicts.length" class="notice error" role="alert"><CircleAlert :size="18" /><div><strong>{{ t('conflict') }}</strong><p v-for="conflict in summary.conflicts" :key="conflict.lotId">{{ lotName(lots.find(lot => lot.id === conflict.lotId)) }}: {{ number(conflict.quantity) }} {{ t(`unit_${material.unit}`) }} · {{ conflict.projectIds.map(projectName).join(', ') }}</p><p>{{ t('reservationConflictHelp') }}</p></div></div>
    <div class="metrics">
      <div class="metric"><div class="metric-top">{{ t('physical') }}<Package :size="18" /></div><div class="metric-value">{{ summary.estimated ? '≈ ' : '' }}{{ number(summary.physical) }}</div><div class="metric-caption">{{ t(`unit_${material.unit}`) }}<span v-if="summary.unknown"> · {{ t('knownAtLeast') }} {{ number(summary.knownPhysical) }}</span></div></div>
      <div class="metric"><div class="metric-top">{{ t('eligible') }}</div><div class="metric-value">{{ number(summary.eligible) }}</div><div class="metric-caption">{{ t('eligibleHelpShort') }}</div></div>
      <div class="metric"><div class="metric-top">{{ t('reserved') }}</div><div class="metric-value">{{ number(summary.reserved) }}</div><div class="metric-caption">{{ number(reservations.length, 0) }} {{ t('activeReservations') }}</div></div>
      <div class="metric"><div class="metric-top">{{ t('available') }}</div><div class="metric-value">{{ number(summary.available) }}</div><div class="metric-caption">{{ summary.unknown ? t('plusUnknown') : t('quantityHelpShort') }}</div></div>
    </div>
    <div class="two-columns">
      <div class="stack">
        <section class="panel">
          <div class="panel-heading"><h2>{{ t('lots') }}</h2><button class="button small" :disabled="material.archived" @click="openModal('lot')"><Plus :size="15" />{{ t('addLot') }}</button></div>
          <EmptyState v-if="!lots.length" compact :icon="Package" :title="t('noLots')" :description="t('noLotsHelp')"><button class="button primary" :disabled="material.archived" @click="openModal('lot')">{{ t('addLot') }}</button></EmptyState>
          <div v-else class="table-wrap"><table><thead><tr><th>{{ t('lot') }}</th><th>{{ t('quantity') }}</th><th>{{ t('status') }}</th><th>{{ t('more') }}</th></tr></thead><tbody>
            <tr v-for="lot in lots" :key="lot.id">
              <td><strong>{{ lot.lotCode || lot.id.slice(0, 8) }}</strong><span class="cell-subtitle">{{ locate(lot.locationId) }}</span><span v-if="material.category === 'fabric'" class="cell-subtitle">{{ number(lot.properties.widthCm) }} × {{ number(lot.properties.heightCm) }} cm <span v-if="lot.properties.irregular">· {{ t('irregularFabric') }}</span></span><span v-if="lot.sourceLotId" class="cell-subtitle">{{ t('cutFrom') }} {{ state.lots.find(row => row.id === lot.sourceLotId)?.lotCode || lot.sourceLotId.slice(0,8) }}</span></td>
              <td>{{ lot.confidence === 'estimated' ? '≈ ' : '' }}{{ number(lot.quantity) }}<span class="cell-subtitle">{{ t(`unit_${material.unit}`) }}</span><span v-if="lotReserved(lot.id)" class="cell-subtitle">{{ t('reserved') }}: {{ number(lotReserved(lot.id)) }}</span><span v-if="lot.cost !== null" class="cell-subtitle">{{ money(lot.cost, lot.currency) }}</span></td>
              <td><span class="badge" :class="{ green: lot.status === 'usable', warning: ['blocked','unverified'].includes(lot.status), danger: lot.status === 'damaged' }">{{ t(lot.status) }}</span></td>
              <td><div v-if="lot.status !== 'transformed'" class="actions"><button class="icon-button" :aria-label="`${t('editLot')}: ${lotName(lot)}`" @click="openModal('lotEdit', lot.id)"><Pencil :size="16" /></button><button class="icon-button" :aria-label="`${t('movement')}: ${lotName(lot)}`" @click="openModal('stock', lot.id)"><ArrowRightLeft :size="17" /></button><button class="button small" :disabled="!projects.length" @click="openModal('reserve', lot.id)">{{ t('reserve') }}</button></div><div v-if="material.category === 'fabric' && material.unit === 'piece' && lot.status === 'usable' && lot.quantity === 1 && !lot.properties.irregular && lot.properties.widthCm && lot.properties.heightCm" class="actions"><button class="button text small" @click="openCut(lot)"><Scissors :size="14" />{{ t('cutFabric') }}</button></div><button v-if="material.category === 'kit' && material.unit === 'piece' && lot.status === 'usable' && lot.quantity >= 1" class="button text small" @click="openKit(lot)">{{ t('openKit') }}</button></td>
            </tr>
          </tbody></table></div>
        </section>
        <section v-if="reservations.length" class="panel"><div class="panel-heading"><h2>{{ t('reserved') }}</h2></div><div class="panel-body"><div v-for="reservation in reservations" :key="reservation.id" class="stat-row"><div><button class="cell-title" @click="navigate('project', reservation.projectId)">{{ projectName(reservation.projectId) }}</button><span class="cell-subtitle">{{ lotName(lots.find(row => row.id === reservation.lotId)) }}</span></div><div class="actions"><strong>{{ number(reservation.quantity) }} {{ t(`unit_${material.unit}`) }}</strong><button class="icon-button" :aria-label="t('edit')" @click="openModal('reserve', reservation.lotId, { projectId: reservation.projectId, quantity: reservation.quantity })"><Pencil :size="16" /></button></div></div></div></section>
        <section class="panel"><div class="panel-heading"><h2>{{ t('history') }}</h2><span class="muted">{{ number(movements.length, 0) }}</span></div><EmptyState v-if="!movements.length" compact :title="t('noMovements')" /><div v-else class="table-wrap"><table><thead><tr><th>{{ t('date') }}</th><th>{{ t('type') }}</th><th>{{ t('quantity') }}</th><th>{{ t('notes') }}</th><th></th></tr></thead><tbody><tr v-for="movement in history" :key="movement.id"><td>{{ date(movement.date) }}<span class="cell-subtitle">{{ state.lots.find(row => row.id === movement.lotId)?.lotCode || movement.lotId.slice(0,8) }}</span></td><td>{{ t(movement.kind) }}<span v-if="movement.projectId" class="cell-subtitle">{{ projectName(movement.projectId) }}</span></td><td>{{ number(movement.quantity) }}<span class="cell-subtitle">{{ number(movement.before) }} → {{ number(movement.after) }}</span></td><td>{{ movement.reason || '—' }}</td><td><button v-if="['consume','loss','discard','return'].includes(movement.kind) && !state.movements.some(row => row.reversesId === movement.id)" class="icon-button" :aria-label="t('reverseMovement')" @click="openModal('reverse', null, { movementId: movement.id })"><RotateCcw :size="16" /></button></td></tr></tbody></table></div><div v-if="historyPages > 1" class="panel-heading"><small class="muted">{{ t('page') }} {{ historyPage }} / {{ historyPages }}</small><div class="actions"><button class="button small" :disabled="historyPage <= 1" @click="historyPage--">{{ t('previousPage') }}</button><button class="button small" :disabled="historyPage >= historyPages" @click="historyPage++">{{ t('nextPage') }}</button></div></div></section>
      </div>
      <aside class="stack">
        <section class="panel"><div class="panel-heading"><h2>{{ t('details') }}</h2><span class="swatch" :style="{ backgroundColor: material.color || undefined }"><Heart v-if="material.favorite" :size="17" /></span></div><div class="panel-body"><p class="field-help">{{ t('quantityHelp') }}</p><div v-for="[label, value] in [[t('brand'),material.brand],[t('range'),material.range],[t('code'),material.code],[t('minimum'),material.minimum === null ? '' : number(material.minimum)],[t('packageSize'),material.packageSize === null ? '' : number(material.packageSize)],[t('strands'),material.strands],[t('composition'),material.properties.composition]]" :key="label" class="stat-row"><span>{{ label }}</span><span>{{ value || '—' }}</span></div><div v-if="material.tags.length" class="actions form-section"><span v-for="tag in material.tags" :key="tag" class="badge">{{ tag }}</span></div><div v-if="material.properties.care" class="form-section"><h3>{{ t('careInstructions') }}</h3><p>{{ material.properties.care }}</p></div><div v-if="material.notes" class="form-section"><h3>{{ t('notes') }}</h3><p>{{ material.notes }}</p></div></div></section>
        <section class="panel"><div class="panel-heading"><h2>{{ t('photosAndFiles') }}</h2><button class="icon-button" :disabled="busy" :aria-label="t('addAttachment')" @click="attachmentInput.click()"><ImagePlus :size="18" /></button><input ref="attachmentInput" class="sr-only" type="file" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf" multiple @change="addPhotos" /></div><div class="panel-body"><p v-if="!photos.length" class="field-help">{{ t('photoHelp') }}</p><div v-else class="attachment-list"><div v-for="photo in photos" :key="photo.id" class="attachment"><img v-if="photo.url" :src="photo.url" :alt="photo.name" /><span v-else class="badge">{{ photo.unavailable ? t('fileUnavailable') : 'PDF' }}</span><small>{{ photo.name }}</small><button class="button text small" @click="downloadAttachment(photo)"><Download :size="14" />{{ t('export') }}</button></div></div></div></section>
      </aside>
    </div>
    <MaterialForm v-if="editing" :material="material" @close="editing = false" @saved="editing = false; notify()" />
    <EntityForm v-if="formConfig" :key="modalOperation" v-bind="formConfig" @close="modal = null" @saved="done" />
    <AppDialog v-if="modal?.kind === 'cut'" :title="t('cutFabric')" wide :busy="busy" @close="modal = null">
      <p class="notice">{{ t('cutHelp') }}</p><p v-if="cutError" class="notice error" role="alert">{{ cutError }}</p>
      <form id="fabric-cut-form" @submit.prevent="confirmCut"><div class="form-grid"><FormField :label="t('fabricWidthCm')" required v-slot="{ id }"><input :id="id" v-model="cutDraft.widthCm" inputmode="decimal" required /></FormField><FormField :label="t('fabricHeightCm')" required v-slot="{ id }"><input :id="id" v-model="cutDraft.heightCm" inputmode="decimal" required /></FormField><FormField :label="t('offsetX')" required v-slot="{ id }"><input :id="id" v-model="cutDraft.xCm" inputmode="decimal" required /></FormField><FormField :label="t('offsetY')" required v-slot="{ id }"><input :id="id" v-model="cutDraft.yCm" inputmode="decimal" required /></FormField><FormField :label="t('project')" :help="t('cutProjectHelp')" v-slot="{ id, describedby }"><select :id="id" v-model="cutDraft.projectId" :aria-describedby="describedby"><option value="">{{ t('none') }}</option><option v-for="project in projects" :key="project.id" :value="project.id">{{ project.name }}</option></select></FormField><FormField :label="t('reason')" v-slot="{ id }"><input :id="id" v-model="cutDraft.reason" maxlength="2000" /></FormField></div>
      <div v-if="cutPreview" class="form-section"><p :class="['notice', cutPreview.valid ? 'success' : 'error']">{{ t(cutPreview.valid ? 'cutFits' : 'cutDoesNotFit') }} · {{ t('cutSourceSize') }} {{ number(cutPreview.sourceWidth) }} × {{ number(cutPreview.sourceHeight) }} cm</p><svg v-if="cutPreview.valid" role="img" :aria-label="t('cutPreview')" :viewBox="`0 0 ${cutPreview.sourceWidth} ${cutPreview.sourceHeight}`" width="100%" height="200"><rect width="100%" height="100%" fill="#eae1db" stroke="#a58b92" stroke-width="0.3" /><rect :x="cutPreview.x" :y="cutPreview.y" :width="cutPreview.width" :height="cutPreview.height" fill="#634453" stroke="#fffefa" stroke-width="0.3" /></svg><p class="field-help">{{ t('remainingFabricArea') }}: {{ number(cutPreview.area - cutPreview.cutArea) }} cm²</p></div></form>
      <template #footer><button class="button" :disabled="busy" @click="modal = null">{{ t('cancel') }}</button><button class="button primary" type="submit" form="fabric-cut-form" :disabled="busy || !cutPreview?.valid">{{ t('confirmPhysicalCut') }}</button></template>
    </AppDialog>
    <AppDialog v-if="modal?.kind === 'kit'" :title="t('openKit')" wide :busy="busy" @close="modal = null">
      <p class="notice">{{ t('kitOpenHelp') }}</p><p v-if="kitError" class="notice error" role="alert">{{ kitError }}</p><form id="kit-open-form" @submit.prevent="confirmKit"><section v-for="(component, index) in kitComponents" :key="component.key" class="form-section"><div class="split-heading"><h3>{{ t('component') }} {{ index + 1 }}</h3><button class="button text small" type="button" :disabled="kitComponents.length === 1" @click="kitComponents.splice(index, 1)">{{ t('remove') }}</button></div><div class="form-grid"><FormField :label="t('materials')" required wide v-slot="{ id }"><select :id="id" v-model="component.materialId" required><option value="">{{ t('chooseMaterial') }}</option><option v-for="row in componentMaterials" :key="row.id" :value="row.id">{{ row.name }} · {{ row.code }} · {{ t(`unit_${row.unit}`) }}</option></select></FormField><FormField :label="t('quantity')" :help="t('unknownHint')" v-slot="{ id, describedby }"><input :id="id" v-model="component.quantity" inputmode="decimal" :aria-describedby="describedby" /></FormField><FormField :label="t('confidence')" v-slot="{ id }"><select :id="id" v-model="component.confidence"><option value="exact">{{ t('exact') }}</option><option value="estimated">{{ t('estimated') }}</option></select></FormField><FormField :label="t('lotCode')" v-slot="{ id }"><input :id="id" v-model="component.lotCode" maxlength="200" /></FormField></div></section><button class="button" type="button" @click="addComponent"><Plus :size="16" />{{ t('addComponent') }}</button></form>
      <template #footer><button class="button" :disabled="busy" @click="modal = null">{{ t('cancel') }}</button><button class="button primary" form="kit-open-form" type="submit" :disabled="busy || !componentMaterials.length">{{ t('confirmKitOpening') }}</button></template>
    </AppDialog>
  </div>
  <EmptyState v-else :icon="Package" :title="t('materialNotFound')"><button class="button" @click="navigate('materials')">{{ t('back') }}</button></EmptyState>
</template>
