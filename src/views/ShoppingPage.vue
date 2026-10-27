<script setup>
import PurchaseDocuments from '../components/PurchaseDocuments.vue';
import { computed, ref } from 'vue';
import { ShoppingBag, Plus, Download, Search, Truck, Store, RefreshCw, Pencil, PackageCheck, ClipboardList } from '@lucide/vue';
import PageHeader from '../components/PageHeader.vue';
import EmptyState from '../components/EmptyState.vue';
import EntityForm from '../components/EntityForm.vue';
import { state, dispatch, navigate, normalize, locate, notify, statusText } from '../state';
import { storage } from '../storage';
import { t, number, money, date, language, errorText } from '../i18n';
import { shoppingNeeds } from '../../core/commands.mjs';
import { quantity, DomainError, subtract } from '../../core/shared.mjs';

const documentsId=ref(null);
const tab = ref('orders'), search = ref(''), status = ref('open'), priority = ref(''), projectId = ref('');
const form = ref(null), busy = ref(false), error = ref('');
const activeProjects = computed(() => state.value.projects.filter(p => !['completed', 'archived'].includes(p.status)));
const selectedProjects = computed(() => projectId.value ? [projectId.value] : activeProjects.value.map(p => p.id));
const materialById = computed(() => new Map(state.value.materials.map(m => [m.id, m])));
const supplierById = computed(() => new Map(state.value.suppliers.map(s => [s.id, s])));
const requirements = computed(() => shoppingNeeds(state.value, selectedProjects.value));
const matchingRequirements = computed(() => requirements.value.filter(row => matchesMaterial(row.materialId)));
const filteredOrders = computed(() => state.value.purchases.filter(row => {
  if (status.value === 'open' && ['received', 'cancelled'].includes(row.status)) return false;
  if (status.value && status.value !== 'open' && status.value !== row.status) return false;
  if (priority.value && row.priority !== priority.value) return false;
  if (projectId.value && !row.projectIds.includes(projectId.value)) return false;
  const material = materialById.value.get(row.materialId);
  return !search.value || normalize([material?.name, material?.code, material?.brand, row.notes, supplierById.value.get(row.supplierId)?.name].join(' ')).includes(normalize(search.value));
}).sort((a, b) => ({ high: 0, normal: 1, low: 2 }[a.priority] - { high: 0, normal: 1, low: 2 }[b.priority]) || b.createdAt.localeCompare(a.createdAt)));
const filteredSuppliers = computed(() => state.value.suppliers.filter(s => normalize([s.name, s.contact, s.notes].join(' ')).includes(normalize(search.value))).sort((a, b) => a.name.localeCompare(b.name)));
const openOrders = computed(() => state.value.purchases.filter(p => !['received', 'cancelled'].includes(p.status)));
const costs = computed(() => {
  const totals = {};
  for (const order of filteredOrders.value) if (order.unitPrice !== null) totals[order.currency] = (totals[order.currency] || 0) + Math.round(order.quantity * order.unitPrice);
  return Object.entries(totals);
});
const unpriced = computed(() => filteredOrders.value.filter(order => order.unitPrice === null).length);
const materialOptions = computed(() => state.value.materials.filter(m => !m.archived || m.id === form.value?.initial.materialId).map(m => ({ value: m.id, label: `${m.name}${m.code ? ` · ${m.code}` : ''} (${t(m.unit)})` })));
const locationOptions = computed(() => state.value.locations.map(l => ({ value: l.id, label: locate(l.id) })).sort((a, b) => a.label.localeCompare(b.label)));
const supplierOptions = computed(() => state.value.suppliers.map(s => ({ value: s.id, label: s.name })));
const projectOptions = computed(() => state.value.projects.map(p => ({ value: p.id, label: p.name })));
const formFields = computed(() => {
  if (!form.value) return [];
  if (form.value.kind === 'supplier') return [
    { key: 'name', required: true }, { key: 'contact', label: t('supplierContact') },
    { key: 'url', label: t('supplierWebsite'), type: 'url', wide: true }, { key: 'notes', type: 'textarea', wide: true },
  ];
  if (form.value.kind === 'receive') return [
    { key: 'quantity', label: t('receivedQuantity'), type: 'number', required: true, help: t('receiveRemaining', { quantity: number(form.value.remaining, 6), unit: t(form.value.unit) }) },
    { key: 'locationId', label: t('location'), type: 'select', options: locationOptions.value },
    { key: 'lotCode' }, { key: 'confidence', type: 'select', required: true, options: ['exact', 'estimated'] },
    { key: 'costMajor', label: t('deliveryCost'), type: 'number', help: t('deliveryCostHelp', { currency: form.value.currency }) },
    { key: 'date', type: 'date' }, { key: 'notes', type: 'textarea', wide: true },
  ];
  const row = form.value.original;
  const statuses = ['to_buy', 'ordered', 'cancelled'];
  if (row && !statuses.includes(row.status)) statuses.push(row.status);
  return [
    { key: 'materialId', label: t('material'), type: 'select', required: true, wide: true, options: row ? materialOptions.value.filter(option => option.value === row.materialId) : materialOptions.value },
    { key: 'quantity', type: 'number', required: true, help: t('purchaseQuantityHelp') },
    { key: 'status', type: 'select', required: true, options: statuses.map(value => ({ value, label: () => statusText(value) })) },
    { key: 'supplierId', label: t('supplier'), type: 'select', options: supplierOptions.value },
    { key: 'priority', type: 'select', required: true, options: ['low', 'normal', 'high'] },
    { key: 'unitPriceMajor', label: t('unitPrice'), type: 'number', help: t('unitPriceHelp') },
    { key: 'currency', required: true, max: 3 },
    { key: 'projectId', label: t('project'), type: 'select', options: projectOptions.value, when: () => !row || row.projectIds.length <= 1 },
    { key: 'expectedDate', label: t('expectedDelivery'), type: 'date' }, { key: 'notes', type: 'textarea', wide: true },
  ];
});
const formHelp = computed(() => form.value?.kind === 'receive' ? t('receiveHelp') : form.value?.kind === 'supplier' ? t('supplierLocalHelp') : form.value?.original?.projectIds.length > 1 ? t('purchaseMultipleProjects') : t('purchaseFormHelp'));

function matchesMaterial(id) {
  const material = materialById.value.get(id);
  return !search.value || normalize([material?.name, material?.code, material?.brand].join(' ')).includes(normalize(search.value));
}
function materialName(id) { return materialById.value.get(id)?.name || t('unknown'); }
function materialCode(id) { const m = materialById.value.get(id); return [m?.brand, m?.range, m?.code].filter(Boolean).join(' · '); }
function projectNames(ids) { return ids.map(id => state.value.projects.find(p => p.id === id)?.name).filter(Boolean).join(', '); }
function major(value) { return value === null || value === undefined ? '' : String(value / 100).replace('.', language.value === 'it' ? ',' : '.'); }
function minor(value) {
  if (value === '' || value === null || value === undefined) return null;
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(String(value).trim())) throw new DomainError('invalid_number');
  return Math.round(quantity(String(value).trim()) * 100);
}
function openPurchase(order = null, requirement = null) {
  const material = requirement ? materialById.value.get(requirement.materialId) : null;
  const amount = requirement ? material?.packageSize ? Math.ceil(requirement.toOrder / material.packageSize) * material.packageSize : requirement.toOrder : 1;
  form.value = { kind: 'purchase', key: crypto.randomUUID(), operationId: crypto.randomUUID(), title: order ? 'editPurchase' : 'newPurchase', original: order,
    initial: order ? { ...order, unitPriceMajor: major(order.unitPrice), projectId: order.projectIds.length === 1 ? order.projectIds[0] : '' } : { materialId: requirement?.materialId || '', quantity: amount, status: 'to_buy', supplierId: '', priority: 'normal', unitPriceMajor: '', currency: state.value.settings.currency, projectId: projectId.value, expectedDate: '', notes: '' },
    requirementProjects: requirement ? requirement.allocations.map(a => a.projectId) : null,
  };
}
function openReceive(order) {
  const remaining = subtract(order.quantity, order.received);
  form.value = { kind: 'receive', key: crypto.randomUUID(), operationId: crypto.randomUUID(), title: 'receive', purchaseId: order.id, remaining, unit: order.unit, currency: order.currency,
    initial: { quantity: remaining, locationId: '', lotCode: '', confidence: 'exact', costMajor: '', date: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10), notes: '' },
  };
}
function openSupplier(supplier = null) {
  form.value = { kind: 'supplier', key: crypto.randomUUID(), operationId: crypto.randomUUID(), title: supplier ? 'editSupplier' : 'newSupplier', initial: supplier ? { ...supplier } : { name: '', contact: '', url: '', notes: '' } };
}
async function submitForm(draft) {
  const current = form.value;
  if (current.kind === 'supplier') await dispatch('supplier.save', draft, current.operationId);
  else if (current.kind === 'receive') {
    const payload = { ...draft, purchaseId: current.purchaseId, quantity: quantity(draft.quantity, { positive: true }) };
    if (payload.quantity > current.remaining) throw new DomainError('receipt_exceeds_order');
    if (draft.costMajor !== '') payload.cost = minor(draft.costMajor);
    delete payload.costMajor;
    await dispatch('purchase.receive', payload, current.operationId);
  } else {
    const payload = { ...draft, quantity: quantity(draft.quantity, { positive: true }), unitPrice: minor(draft.unitPriceMajor), currency: String(draft.currency).trim().toUpperCase(),
      projectIds: current.original?.projectIds.length > 1 ? current.original.projectIds : current.requirementProjects || (draft.projectId ? [draft.projectId] : []), source: current.original?.source || (current.requirementProjects ? 'project' : 'manual'),
    };
    delete payload.unitPriceMajor; delete payload.projectId;
    await dispatch('purchase.save', payload, current.operationId);
  }
}
function saved() { form.value = null; notify(); }
async function generate() {
  if (busy.value) return;
  busy.value = true; error.value = '';
  try { await dispatch('purchase.generate', { projectIds: selectedProjects.value }); tab.value = 'orders'; status.value = 'open'; notify(); }
  catch (caught) { error.value = errorText(caught); }
  finally { busy.value = false; }
}
function csvCell(value) {
  let result = String(value ?? '');
  if (/^[\s]*[=+\-@]/.test(result)) result = `'${result}`;
  return `"${result.replaceAll('"', '""')}"`;
}
async function exportList() {
  if (busy.value) return;
  busy.value = true; error.value = '';
  try {
    const rows = [[t('name'), t('brand'), t('code'), t('quantity'), t('unit'), t('received'), t('status'), t('supplier'), t('unitPrice'), t('currency'), t('projects'), t('notes')],
      ...filteredOrders.value.map(order => { const material = materialById.value.get(order.materialId); return [material?.name, material?.brand, material?.code, number(order.quantity, 6), t(order.unit), number(order.received, 6), statusText(order.status), supplierById.value.get(order.supplierId)?.name, order.unitPrice === null ? '' : number(order.unitPrice / 100, 2), order.currency, projectNames(order.projectIds), order.notes]; })];
    await storage.saveFile({ name: `Ricamo-${language.value === 'it' ? 'acquisti' : 'shopping'}.csv`, data: '\uFEFF' + rows.map(row => row.map(csvCell).join(';')).join('\r\n') });
  } catch (caught) { error.value = errorText(caught); }
  finally { busy.value = false; }
}
async function printList() {
  error.value = '';
  try { await storage.print(); } catch (caught) { error.value = errorText(caught); }
}
</script>

<template>
  <section class="page">
  <PageHeader :eyebrow="t('shopping')" :title="t('shoppingTitle')" :description="t('shoppingSubtitle')">
    <button class="button" :disabled="busy" @click="printList">{{ t('print') }}</button>
    <button v-if="tab === 'orders'" class="button" :disabled="busy || !filteredOrders.length" @click="exportList"><Download :size="16" />{{ t('export') }}</button>
    <button class="button primary" :disabled="!materialOptions.length" @click="openPurchase()"><Plus :size="17" />{{ t('newPurchase') }}</button>
  </PageHeader>
  <p v-if="error" role="alert" class="notice error">{{ error }}</p>
  <div class="metrics">
    <div class="metric"><div class="metric-top">{{ t('to_buy') }}<ShoppingBag :size="18" /></div><div class="metric-value">{{ number(openOrders.filter(o => o.status === 'to_buy').length, 0) }}</div><div class="metric-caption">{{ t('purchaseRows') }}</div></div>
    <div class="metric"><div class="metric-top">{{ t('outstanding') }}<Truck :size="18" /></div><div class="metric-value">{{ number(openOrders.filter(o => ['ordered','partial'].includes(o.status)).length, 0) }}</div><div class="metric-caption">{{ t('purchaseRows') }}</div></div>
    <div class="metric"><div class="metric-top">{{ t('shortage') }}<ClipboardList :size="18" /></div><div class="metric-value">{{ number(requirements.filter(n => n.knownShortfall > 0).length, 0) }}</div><div class="metric-caption">{{ t('materialsInSelectedProjects') }}</div></div>
    <div class="metric"><div class="metric-top">{{ t('suppliers') }}<Store :size="18" /></div><div class="metric-value">{{ number(state.suppliers.length, 0) }}</div><div class="metric-caption">{{ t('localContacts') }}</div></div>
  </div>
  <nav class="tabs" :aria-label="t('shoppingSections')">
    <button v-for="section in ['orders','requirements','suppliers']" :key="section" :class="{ selected: tab === section }" :aria-current="tab === section ? 'page' : undefined" @click="tab = section; search = ''">{{ t(section) }}</button>
  </nav>
  <div class="toolbar">
    <div class="toolbar-search"><Search :size="17" /><input v-model="search" :aria-label="t('searchShopping')" :placeholder="t('searchShopping')" /></div>
    <select v-if="tab !== 'suppliers'" v-model="projectId" :aria-label="t('project')"><option value="">{{ t(tab === 'requirements' ? 'allActiveProjects' : 'allProjects') }}</option><option v-for="project in state.projects" :key="project.id" :value="project.id">{{ project.name }}</option></select>
    <select v-if="tab === 'orders'" v-model="status" :aria-label="t('status')"><option value="open">{{ t('openPurchases') }}</option><option value="">{{ t('all') }}</option><option v-for="value in ['to_buy','ordered','partial','received','cancelled']" :key="value" :value="value">{{ statusText(value) }}</option></select>
    <select v-if="tab === 'orders'" v-model="priority" :aria-label="t('priority')"><option value="">{{ t('allPriorities') }}</option><option v-for="value in ['high','normal','low']" :key="value" :value="value">{{ t(value) }}</option></select>
    <button v-if="tab === 'suppliers'" class="button" @click="openSupplier()"><Plus :size="16" />{{ t('newSupplier') }}</button>
  </div>
  <template v-if="tab === 'orders'">
    <div class="panel">
      <div v-if="filteredOrders.length" class="table-wrap"><table><caption class="sr-only">{{ t('orders') }}</caption><thead><tr><th>{{ t('material') }}</th><th>{{ t('quantity') }}</th><th>{{ t('received') }}</th><th>{{ t('status') }}</th><th>{{ t('supplier') }}</th><th>{{ t('estimatedTotal') }}</th><th><span class="sr-only">{{ t('actions') }}</span></th></tr></thead><tbody>
        <tr v-for="order in filteredOrders" :key="order.id">
          <td><button class="cell-title" @click="navigate('material', order.materialId)">{{ materialName(order.materialId) }}</button><span class="cell-subtitle mono">{{ materialCode(order.materialId) }}</span><span v-if="order.projectIds.length" class="cell-subtitle">{{ projectNames(order.projectIds) }}</span><span v-if="order.expectedDate" class="cell-subtitle">{{ t('expectedDelivery') }}: {{ date(order.expectedDate) }}</span></td>
          <td>{{ number(order.quantity, 6) }}<span class="cell-subtitle">{{ t(order.unit) }}</span></td>
          <td>{{ number(order.received, 6) }}<span class="cell-subtitle">{{ t('remaining') }}: {{ number(subtract(order.quantity, order.received), 6) }}</span></td>
          <td><span class="badge" :class="{ green: order.status === 'received', accent: order.status === 'ordered', warning: order.status === 'partial' }">{{ statusText(order.status) }}</span><span v-if="order.priority !== 'normal'" class="cell-subtitle">{{ t('priority') }}: {{ t(order.priority) }}</span></td>
          <td>{{ supplierById.get(order.supplierId)?.name || '—' }}</td>
          <td>{{ order.unitPrice === null ? t('unknown') : money(Math.round(order.quantity * order.unitPrice), order.currency) }}</td>
          <td><div class="actions"><button class="button small" @click="documentsId=order.id">{{ t('purchaseDocuments') }}</button><button class="icon-button" :aria-label="t('editNamedPurchase', { name: materialName(order.materialId) })" @click="openPurchase(order)"><Pencil :size="16" /></button><button v-if="!['received','cancelled'].includes(order.status)" class="button small" @click="openReceive(order)"><PackageCheck :size="15" />{{ t('receive') }}</button></div></td>
        </tr>
      </tbody></table></div>
      <EmptyState v-else :icon="ShoppingBag" :title="state.purchases.length ? t('noResults') : t('emptyShopping')" :description="t('emptyShoppingBody')">
        <button v-if="!state.materials.length" class="button primary" @click="navigate('materials')">{{ t('addMaterial') }}</button>
        <button v-else class="button primary" @click="openPurchase()">{{ t('newPurchase') }}</button>
      </EmptyState>
    </div>
    <div v-if="filteredOrders.length" class="panel-body">
      <p class="muted"><strong>{{ t('estimatedTotalsByCurrency') }}</strong></p>
      <div v-for="[currencyCode, total] in costs" :key="currencyCode" class="stat-row"><span>{{ currencyCode }}</span><strong>{{ money(total, currencyCode) }}</strong></div>
      <p v-if="unpriced" class="field-help">{{ t('unpricedRows', { count: number(unpriced, 0) }) }}</p>
    </div>
  </template>
  <template v-else-if="tab === 'requirements'">
    <p class="notice">{{ t('aggregateHelp') }}</p>
    <div class="panel"><div class="panel-heading"><h2>{{ t('requirements') }}</h2><button class="button primary" :disabled="busy || !requirements.some(r => !r.unknownDemand && r.toOrder > 0)" @click="generate"><RefreshCw :size="16" />{{ busy ? t('saving') : t('generateShopping') }}</button></div>
      <div v-if="matchingRequirements.length" class="table-wrap"><table><caption class="sr-only">{{ t('requirements') }}</caption><thead><tr><th>{{ t('material') }}</th><th>{{ t('remaining') }}</th><th>{{ t('availableForProjects') }}</th><th>{{ t('ordered') }}</th><th>{{ t('shortage') }}</th><th>{{ t('toOrder') }}</th><th><span class="sr-only">{{ t('actions') }}</span></th></tr></thead><tbody>
        <tr v-for="need in matchingRequirements" :key="need.materialId">
          <td><button class="cell-title" @click="navigate('material', need.materialId)">{{ materialName(need.materialId) }}</button><span class="cell-subtitle mono">{{ materialCode(need.materialId) }}</span><span class="cell-subtitle">{{ projectNames(need.allocations.map(a => a.projectId)) }}</span><span v-if="need.unknownStock || need.unknownDemand" class="badge warning">{{ t('needsReview') }}</span></td>
          <td>{{ number(need.remaining, 6) }}<span class="cell-subtitle">{{ t(need.unit) }}</span></td>
          <td>{{ number(need.eligibleForGroup, 6) }}<span v-if="need.estimatedStock" class="cell-subtitle">{{ t('estimated') }}</span><span class="cell-subtitle">{{ t('reserved') }}: {{ number(need.reserved, 6) }}</span></td>
          <td>{{ number(need.ordered, 6) }}</td>
          <td><span :class="{ 'badge warning': need.knownShortfall > 0 }">{{ number(need.shortfall, 6) }}</span></td>
          <td>{{ number(need.toOrder, 6) }}<span v-if="need.packageCount !== null && need.toOrder > 0" class="cell-subtitle">{{ t('packageRoundingHelp') }}</span></td>
          <td><button class="button small" :disabled="need.unknownDemand || !need.toOrder" @click="openPurchase(null, need)"><Plus :size="15" />{{ t('add') }}</button></td>
        </tr>
      </tbody></table></div>
      <EmptyState v-else :icon="ClipboardList" :title="t('noRequirements')" :description="t('noRequirementsHelp')"><button class="button" @click="navigate('projects')">{{ t('projects') }}</button></EmptyState>
    </div>
  </template>
  <template v-else>
    <div class="panel"><div v-if="filteredSuppliers.length" class="table-wrap"><table><caption class="sr-only">{{ t('suppliers') }}</caption><thead><tr><th>{{ t('name') }}</th><th>{{ t('supplierContact') }}</th><th>{{ t('orders') }}</th><th>{{ t('notes') }}</th><th><span class="sr-only">{{ t('actions') }}</span></th></tr></thead><tbody>
      <tr v-for="supplier in filteredSuppliers" :key="supplier.id"><td><strong>{{ supplier.name }}</strong><span v-if="supplier.url" class="cell-subtitle">{{ supplier.url }}</span></td><td>{{ supplier.contact || '—' }}</td><td>{{ number(state.purchases.filter(p => p.supplierId === supplier.id).length, 0) }}</td><td>{{ supplier.notes || '—' }}</td><td><button class="icon-button" :aria-label="t('editNamedSupplier', { name: supplier.name })" @click="openSupplier(supplier)"><Pencil :size="16" /></button></td></tr>
    </tbody></table></div><EmptyState v-else :icon="Store" :title="t('noSuppliers')" :description="t('supplierLocalHelp')"><button class="button primary" @click="openSupplier()">{{ t('newSupplier') }}</button></EmptyState></div>
  </template>
  <EntityForm v-if="form" :key="form.key" :title="t(form.title)" :fields="formFields" :initial="form.initial" :submit="submitForm" :help="formHelp" :confirm-label="form.kind === 'receive' ? t('receive') : t('save')" wide @close="form = null" @saved="saved" />
<PurchaseDocuments v-if="documentsId" :purchase-id="documentsId" @close="documentsId=null"/>

  </section>
</template>
