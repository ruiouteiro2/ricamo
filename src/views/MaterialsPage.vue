<script setup>
import { PURCHASE_SELECTION_LIMIT } from '../../core/selection-purchases.mjs';
import { useVirtualInventory } from '../virtual-inventory.mjs';
import { productPreview, productPreviewStyle } from '../product-previews.mjs';
import { CHART_CATALOGUE } from '../../core/chart-collection.mjs';
import { INVENTORY_GROUPS, customInventoryGroups, inventoryGroup, accessorySection, parseInventoryRoute, inventoryRoute, inventoryContext, matchesInventorySection } from '../inventory-navigation.mjs';
import { materialSearchDescriptors } from '../material-descriptors.mjs';
import { isDiscontinued } from '../../core/discontinued-materials.mjs';
import { hasCatalogueRows, missingCatalogueArticles, catalogueMaterial } from '../catalogue-rows.mjs';
import { computed, ref, watch, nextTick } from 'vue';
import { Plus, Search, Package, CircleAlert, Download, ChevronLeft, ChevronRight, Heart, PackageOpen, Pencil, Trash2, ShoppingCart } from '@lucide/vue';
import PageHeader from '../components/PageHeader.vue';
import EmptyState from '../components/EmptyState.vue';
import InventoryCategoryIcon from '../components/InventoryCategoryIcon.vue';
import AppDialog from '../components/AppDialog.vue';
import FormField from '../components/FormField.vue';
import ThreadReferenceLink from '../components/ThreadReferenceLink.vue';
import MaterialForm from '../components/MaterialForm.vue';
import InventoryBulkForm from '../components/InventoryBulkForm.vue';
import InventoryLabels from '../components/InventoryLabels.vue';
import InventoryRapidForm from '../components/InventoryRapidForm.vue';
import KitLibrary from '../components/KitLibrary.vue';
import { inventoryCategories as categoryOptions, categoryLabel as categoryName } from '../inventory-categories.mjs';
import { state, route, navigate, notify, normalize, locate, dispatch } from '../state';
import { t, number, errorText, language } from '../i18n';
import { paginationEnabled, pageTotal, pageRows } from '../pagination.mjs';
import { quantity } from '../../core/shared.mjs';
import CategoryManager from '../components/CategoryManager.vue';
import { inventorySummary } from '../../core/inventory.mjs';

const editing = ref(null), deleting = ref(null), actionBusy = ref(false), actionError = ref('');
async function removeMaterial() {
  actionBusy.value = true; actionError.value = '';
  try { await dispatch('material.removeFromInventory', { id: deleting.value.id }); selected.value = selected.value.filter(id => id !== deleting.value.id); deleting.value = null; notify(); }
  catch (error) { actionError.value = errorText(error); }
  finally { actionBusy.value = false; }
}
function edited() { editing.value = null; notify(); }
const props = defineProps({ initialAction: String });
const adding = ref(props.initialAction === 'new' || route.value.id === 'new'), workflow = ref(''), selected = ref([]), selectedCatalogue = ref([]), rapidDefaults = ref({});
const customGroups = computed(() => customInventoryGroups(state.value.categories)), managingCategories = ref(false);
const section = computed(() => parseInventoryRoute(route.value.id, state.value.categories));
const addContext = ref({}), addDefaults = ref({}), addFormVersion = ref(0);
const tileLabel = tile => tile.labelKey ? t(tile.labelKey) : tile.label;
const tiles = computed(() => section.value.group ? section.value.group.children : [...INVENTORY_GROUPS, ...customGroups.value, { id: 'charts', labelKey: 'patterns' }]);
function openTile(tile) { if (tile.id === 'charts') { navigate('materialCharts'); return; } navigate('materials', section.value.group ? inventoryRoute(section.value.group.id, tile.id) : inventoryRoute(tile.id)); }
function addTo(group = section.value.group, child = section.value.child) { addDefaults.value={}; addContext.value = inventoryContext(group, child); adding.value = true; }
function addToTile(tile) { if (tile.id === 'charts') { navigate('materialCharts'); return; } addTo(section.value.group || tile, section.value.group ? tile : null); }
function tileCount(tile) { if (tile.id === 'charts') return CHART_CATALOGUE.items.length; return state.value.materials.filter(material => !material.archived && matchesInventorySection(material, section.value.group?.id || tile.id, section.value.group ? tile.id : '')).length; }
let remembered = state.value.settings.preferences?.materialFilters || {};
try { remembered = JSON.parse(sessionStorage.getItem('ricamo:material-view') || 'null') || remembered; } catch { /* Invalid view preferences never replace application data. */ }
const search = ref(remembered.search || ''), category = ref(remembered.category || ''), location = ref(remembered.location || ''), filter = ref(remembered.filter || 'active'), sort = ref(remembered.sort || 'nameAZ'), page = ref(remembered.page || 1);
const preferenceBusy = ref(false), preferenceError = ref('');
function currentView() { return { search: search.value, category: category.value, location: location.value, filter: filter.value, sort: sort.value, page: page.value }; }
function applyView(view) { search.value=view.search||'';category.value=view.category||'';location.value=view.location||'';filter.value=view.filter||'active';sort.value=view.sort||'nameAZ';page.value=1;selected.value=[];selectedCatalogue.value=[]; }
watch([search, category, location, filter, sort, page], () => { try { sessionStorage.setItem('ricamo:material-view', JSON.stringify(currentView())); } catch { /* Preference storage may be unavailable; inventory remains usable. */ } });
async function rememberFilters() { preferenceBusy.value = true; preferenceError.value = ''; try { await dispatch('settings.save', { preferences: { ...state.value.settings.preferences, materialFilters: currentView() } }); notify(); } catch(error) { preferenceError.value = errorText(error); } finally { preferenceBusy.value = false; } }
if (section.value.group) applyView({});
const inventoryTable = ref(null);
watch([page, search, category, location, filter, sort], async () => {
  await nextTick();
  inventoryTable.value?.scrollTo({ top: 0 });
});
const pageSize = 50;
watch(() => props.initialAction, value => { if (value === 'new') adding.value = true; });
watch(() => route.value.id, value => { if (value === 'new') adding.value = true; });
watch([search, category, location, filter, sort], () => { page.value = 1; });
watch([category, location, filter], () => { selected.value=[]; selectedCatalogue.value=[]; });
const rows = computed(() => {
  const lots = new Map(), reservations = new Map(), projects = new Map(), lotsById = new Map(state.value.lots.map(row=>[row.id,row]));
  const link=(materialId,projectId)=>{if(!projectId)return;if(!projects.has(materialId))projects.set(materialId,new Set());projects.get(materialId).add(projectId);};
  for (const lot of state.value.lots) { if (!lots.has(lot.materialId)) lots.set(lot.materialId, []); lots.get(lot.materialId).push(lot); }
  for (const row of state.value.reservations) { if (!reservations.has(row.lotId)) reservations.set(row.lotId, []); reservations.get(row.lotId).push(row); if(row.quantity>0)link(row.materialId,row.projectId); }
  for(const row of state.value.needs)link(row.materialId,row.projectId);
  for(const row of state.value.movements)if(row.projectId)link(lotsById.get(row.lotId)?.materialId||row.materialId,row.projectId);
  for(const row of state.value.projects)if(row.fabricLotId)link(lotsById.get(row.fabricLotId)?.materialId,row.id);
  return state.value.materials.filter(material => matchesInventorySection(material, section.value.group?.id, section.value.child?.id)).map(material => {
    const holdings = lots.get(material.id) || [];
    const summary = inventorySummary({ lots: holdings, reservations: holdings.flatMap(lot => reservations.get(lot.id) || []) }, material.id);
    const locationIds = [...new Set(holdings.filter(lot => lot.status !== 'transformed').map(lot => lot.locationId))];
    const locationNames = locationIds.map(locate);
    return { material, holdings, summary, locationIds, locationNames, projectIds:projects.get(material.id)||new Set(), search: normalize([material.id, material.name, material.brand, material.range, material.code, material.notes, ...material.tags, ...locationNames, ...holdings.flatMap(lot=>[lot.id,lot.lotCode,lot.notes]),materialSearchDescriptors(material,holdings)].join(' ')), low: material.minimum !== null && summary.available < material.minimum };
  });
});
function isPartiallyUsed(row) {
  return row.holdings.some(lot => lot.status !== 'transformed' && lot.quantity !== 0 &&
    (lot.properties?.usageStatus === 'partial' || lot.properties?.details?.packageCondition === 'partial'));
}
const showMetrics = computed(() => !section.value.group || ['threads','beads','fabrics'].includes(section.value.group.id) || section.value.child?.id === 'needles');
const filtered = computed(() => {
  const query = normalize(search.value);
  return rows.value.filter(row => {
    if (filter.value === 'archived' ? !row.material.archived : row.material.archived) return false;
    if (filter.value === 'low' && !row.low) return false;
    if (filter.value === 'review' && !row.summary.unknown && !row.summary.conflicts.length) return false;
    if (filter.value === 'partial' && !isPartiallyUsed(row)) return false;
    if (filter.value === 'favorite' && !row.material.favorite) return false;
    if (category.value && !matchesInventorySection(row.material, [...INVENTORY_GROUPS, ...customGroups.value].find(group => group.category === category.value)?.id)) return false;
    if (location.value && !row.locationIds.includes(location.value)) return false;
    return !query || row.search.includes(query);
  }).sort((a, b) => sort.value === 'recent' ? b.material.createdAt.localeCompare(a.material.createdAt) : sort.value === 'nameZA' ? b.material.name.localeCompare(a.material.name) : sort.value==='codeAZ' ? a.material.code.localeCompare(b.material.code) || a.material.name.localeCompare(b.material.name) : sort.value==='brandAZ' ? a.material.brand.localeCompare(b.material.brand)||a.material.range.localeCompare(b.material.range)||a.material.code.localeCompare(b.material.code) : a.material.name.localeCompare(b.material.name));
});
// Catalogue membership changes with inventory, never with checkbox selection or search.
const missingArticles = computed(() => hasCatalogueRows(section.value.child?.brand) ? missingCatalogueArticles(section.value.child.brand, state.value.materials) : []);
const catalogueById = computed(() => new Map(missingArticles.value.map(row => [row.product.id, row])));
const materialById = computed(() => new Map(rows.value.map(row => [row.material.id, row.material])));
// Catalogue articles not yet in the inventory follow the owned rows, greyed out, and can only be ordered.
const catalogueRows = computed(() => {
  const brand = section.value.child?.brand;
  if (!hasCatalogueRows(brand) || filter.value !== 'active' || location.value || category.value) return [];
  const query = normalize(search.value);
  return missingArticles.value.filter(({ product }) => !query || normalize([product.brand, product.range, product.code, product.colorName].join(' ')).includes(query));
});
const entries = computed(() => [...filtered.value, ...catalogueRows.value]);
const pageCount = computed(() => pageTotal(entries.value.length, pageSize));
watch(pageCount, count => { page.value = Math.min(page.value, count); });
const pageEntries = computed(() => pageRows(entries.value, page.value, pageSize));
const virtualInventory = useVirtualInventory(pageEntries, inventoryTable);
const renderedEntries = virtualInventory.rows;
const visible = computed(() => renderedEntries.value.filter(row => row.material));
const visibleCatalogue = computed(() => renderedEntries.value.filter(row => row.product));
const ordering = ref(null), orderBusy = ref(false), orderError = ref('');
let orderOperationId;
const selectionCount = computed(() => selected.value.length + selectedCatalogue.value.length);
// Resolve only selected IDs; catalogue indexing is cached independently of selection.
const orderableSelection = computed(() => [
  ...selected.value.map(id => materialById.value.get(id)).filter(material => material && !material.archived && !isDiscontinued(material)).map(material => ({ materialId: material.id, material })),
  ...selectedCatalogue.value.map(id => catalogueById.value.get(id)).filter(row => row && !row.discontinued).map(row => ({ product: row.product })),
]);
const purchasableCatalogue = computed(() => catalogueRows.value.filter(row => !row.discontinued));
const allCatalogueSelected = computed(() => purchasableCatalogue.value.length > 0 && purchasableCatalogue.value.every(row => selectedCatalogue.value.includes(row.product.id)));
function selectAllCatalogue() {
  const ids = new Set([...selectedCatalogue.value, ...purchasableCatalogue.value.map(row => row.product.id)]);
  if (ids.size + selected.value.length > PURCHASE_SELECTION_LIMIT) { notify(t('catalogueSelectionLimit', { count: PURCHASE_SELECTION_LIMIT })); return; }
  selectedCatalogue.value = [...ids];
}
function beginOrder(rows) {
  ordering.value = rows.map(row => ({ ...row, quantity: 1 })); orderOperationId = crypto.randomUUID(); orderError.value = '';
}
function orderArticle(product) { beginOrder([{ product }]); }
function orderName(row) { return row.material?.name || [row.product.brand, row.product.range, row.product.code, row.product.colorName].filter(Boolean).join(' \u00b7 '); }
function orderUnit(row) { return row.material?.unit || catalogueMaterial(row.product, 'preview').unit; }
async function placeOrder() {
  if (orderBusy.value) return;
  orderBusy.value = true; orderError.value = '';
  try {
    const rows = ordering.value.map(row => ({ quantity: quantity(row.quantity, { positive: true }), ...(row.materialId ? { materialId: row.materialId } : { material: catalogueMaterial(row.product, crypto.randomUUID()) }) }));
    await dispatch('purchase.selection', { rows }, orderOperationId);
    ordering.value = null; selected.value=[]; selectedCatalogue.value=[]; notify(t('catalogueOrderAdded'));
  } catch (error) { orderError.value = errorText(error); }
  finally { orderBusy.value = false; }
}
const pageSelected=computed(()=>pageEntries.value.length>0&&pageEntries.value.every(row=>row.material ? selected.value.includes(row.material.id) : selectedCatalogue.value.includes(row.product.id)));
const pagePartSelected=computed(()=>pageEntries.value.some(row=>row.material ? selected.value.includes(row.material.id) : selectedCatalogue.value.includes(row.product.id)));
function selectRow(target, id, checked) {
  const selection = target === 'catalogue' ? selectedCatalogue : selected;
  if (!checked) selection.value = selection.value.filter(value => value !== id);
  else if (!selection.value.includes(id) && selectionCount.value < PURCHASE_SELECTION_LIMIT && (target === 'catalogue' || selected.value.length < 200)) selection.value = [...selection.value, id];
}
async function togglePage(event){
  const remove = pageSelected.value;
  for (const row of pageEntries.value) {
    const target = row.material ? selected : selectedCatalogue, id = row.material?.id || row.product.id;
    if (remove) target.value=target.value.filter(value=>value!==id);
    else if (!target.value.includes(id) && selectionCount.value<200) target.value=[...target.value,id];
  }
  await nextTick();
  // A capped selection can leave the computed all-selected value false before and after a native click.
  if (event?.target) { event.target.checked = pageSelected.value; event.target.indeterminate = !pageSelected.value && pagePartSelected.value; }
}
const activeRows = computed(() => rows.value.filter(row => !row.material.archived));
const lowCount = computed(() => activeRows.value.filter(row => row.low).length);
const reviewCount = computed(() => activeRows.value.filter(row => row.summary.unknown || row.summary.conflicts.length).length);
const partialCount = computed(() => activeRows.value.filter(isPartiallyUsed).length);
function clear() { applyView({}); }
function openRapid(defaults) { rapidDefaults.value = defaults; adding.value = false; workflow.value = 'rapid'; }
function closeForm() { adding.value = false; addDefaults.value={}; if (route.value.id === 'new') route.value = { ...route.value, id: null }; }
function created(id) {
  const material = state.value.materials.find(item => item.id === id);
  const context = addContext.value;
  if(state.value.settings.preferences?.keepMaterialFormOpen!==false){
    addDefaults.value={groupId:inventoryGroup(material),brand:material.brand,threadFamily:material.properties.threadFamily,threadFormat:material.properties.threadFormat,section:accessorySection(material)};
    addFormVersion.value++;notify(t('materialSavedContinue'));return;
  }
  closeForm(); notify();
  if (context.groupId) {
    const group = [...INVENTORY_GROUPS, ...customGroups.value].find(item => item.id === context.groupId);
    const child = group.children.find(item => item.brand ? matchesInventorySection(material, group.id, item.id) : item.id === context.section);
    navigate('materials', inventoryRoute(group.id, child?.id || 'all'));
  } else navigate('material', id);
}
function workflowSaved(){workflow.value='';selected.value=[];}
</script>
<template>
  <div class="page inventory-page">
    <PageHeader :eyebrow="t('materials')" :title="section.child ? tileLabel(section.child) : section.group ? tileLabel(section.group) : t('inventoryTitle')" :description="!section.group || section.showList ? t('inventorySubtitle') : undefined">
      <button v-if="!section.group || section.showList" class="button" @click="navigate('settings')"><Download :size="16" />{{ t('inventoryDataTools') }}</button>
      <button v-if="section.showList" class="button primary" @click="addTo()"><Plus :size="17" />{{ t('addMaterial') }}</button>
      <button v-else-if="!section.group" class="button primary" @click="managingCategories = true"><Plus :size="17" />{{ t('addCategory') }}</button>
    </PageHeader>
    <nav class="inventory-breadcrumb" :aria-label="t('inventoryNavigation')">
      <button class="button text" @click="navigate('materials')">{{ t('materials') }}</button>
      <template v-if="section.group"><ChevronRight :size="15" /><button class="button text" @click="navigate('materials', inventoryRoute(section.group.id))">{{ tileLabel(section.group) }}</button></template>
      <template v-if="section.child"><ChevronRight :size="15" /><span>{{ tileLabel(section.child) }}</span></template>
      <span v-else-if="section.showList">{{ t('all') }}</span>
    </nav>
    <section v-if="!section.showList" class="inventory-category-grid" :class="{ 'inventory-subcategory-grid': section.group }" :aria-label="t(section.group ? 'inventorySubcategories' : 'inventoryCategories')">
      <article v-for="tile in tiles" :key="tile.id" class="panel inventory-category-card">
        <button class="inventory-category-link" @click="openTile(tile)"><InventoryCategoryIcon :group="section.group?.id || tile.id" :size="32" /><h2>{{ tileLabel(tile) }}</h2><span class="muted">{{ number(tileCount(tile), 0) }} {{ t(tile.id === 'charts' ? 'patterns' : 'materials').toLowerCase() }}</span><ChevronRight :size="20" /></button>
        <div class="panel-body"><button class="button" @click="addToTile(tile)"><Plus :size="16" />{{ t('add') }}</button><ThreadReferenceLink :reference="tile.reference" /></div>
      </article>
    </section>
    <template v-if="section.showList">
    <ThreadReferenceLink :reference="section.child?.reference" />
    <div v-if="showMetrics" class="metrics">
      <button class="metric" @click="filter = 'active'"><div class="metric-top">{{ t('inventoryTotalMaterials') }}<Package :size="18" /></div><div class="metric-value">{{ number(activeRows.length, 0) }}</div><div class="metric-caption">{{ t('materialCount') }}</div></button>
      <button class="metric" @click="filter = 'low'"><div class="metric-top">{{ t('lowStock') }}<CircleAlert :size="18" /></div><div class="metric-value">{{ number(lowCount, 0) }}</div><div class="metric-caption">{{ t('belowMinimum') }}</div></button>
      <button class="metric" @click="filter = 'review'"><div class="metric-top">{{ t('needsReview') }}<Search :size="18" /></div><div class="metric-value">{{ number(reviewCount, 0) }}</div><div class="metric-caption">{{ t('unknownOrConflicted') }}</div></button>
      <button class="metric" @click="filter = 'partial'"><div class="metric-top">{{ t('inventoryPartiallyUsed') }}<PackageOpen :size="18" /></div><div class="metric-value">{{ number(partialCount, 0) }}</div><div class="metric-caption">{{ t('inventoryPartialHelp') }}</div></button>
    </div>
    <div class="toolbar">
      <div class="toolbar-search"><Search :size="17" /><input v-model="search" :aria-label="t('searchMaterials')" :placeholder="t('searchMaterials')" /></div>
      <select v-model="category" :aria-label="t('category')"><option value="">{{ t('allCategories') }}</option><option v-for="option in categoryOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select>
      <select v-model="location" :aria-label="t('location')"><option value="">{{ t('allLocations') }}</option><option v-for="item in state.locations" :key="item.id" :value="item.id">{{ locate(item.id) }}</option></select>
      <select v-model="filter" :aria-label="t('status')"><option value="active">{{ t('active') }}</option><option value="low">{{ t('lowStock') }}</option><option value="review">{{ t('needsReview') }}</option><option value="partial">{{ t('inventoryPartiallyUsed') }}</option><option value="favorite">{{ t('favorite') }}</option><option value="archived">{{ t('archived') }}</option></select>
      <select v-model="sort" :aria-label="t('sort')"><option value="nameAZ">{{ t('nameAZ') }}</option><option value="recent">{{ t('recent') }}</option><option value="nameZA">{{ t('nameZA') }}</option><option value="codeAZ">{{ t('codeAZ') }}</option><option value="brandAZ">{{ t('brandAZ') }}</option></select>
      <button v-if="purchasableCatalogue.length" class="button" :disabled="allCatalogueSelected" @click="selectAllCatalogue">{{ t('selectAllGreyed') }} ({{ number(purchasableCatalogue.length, 0) }})</button><button class="button small" :disabled="preferenceBusy" @click="rememberFilters">{{ t('rememberFilters') }}</button>
    </div>
    <p v-if="preferenceError" role="alert" class="notice error">{{ preferenceError }}</p>
    <section class="panel">

      <div v-if="selectionCount" class="panel-heading"><span>{{ t(selectedCatalogue.length ? 'selectedPurchaseCount' : 'selectedMaterialCount',{count:selectionCount}) }}</span><div class="actions"><button class="button small" @click="selected=[];selectedCatalogue=[]">{{ t('clearSelection') }}</button><button class="button primary small" :disabled="!orderableSelection.length" @click="beginOrder(orderableSelection)"><ShoppingCart :size="16" />{{ t('sendToShopping') }}</button><button v-if="selected.length && !selectedCatalogue.length" class="button small" @click="workflow='collectionSelection'">{{ t('kitCreateFromSelection') }}</button><button v-if="selected.length && !selectedCatalogue.length" class="button small" @click="workflow='labels'">{{ t('inventoryLabels') }}</button><button v-if="selected.length && !selectedCatalogue.length" class="button primary small" @click="workflow='bulk'">{{ t('bulkEdit') }}</button></div></div>
      <EmptyState v-if="!rows.length && !catalogueRows.length" :icon="Package" :title="t('emptyMaterials')" :description="t('emptyMaterialsBody')"><button class="button primary" @click="addTo()"><Plus :size="16" />{{ t('addMaterial') }}</button></EmptyState>
      <EmptyState v-else-if="!entries.length" :icon="Search" :title="t('noResults')"><button class="button" @click="clear">{{ t('clearFilters') }}</button></EmptyState>
      <template v-else>
        <div ref="inventoryTable" class="table-wrap" @scroll.passive="virtualInventory.update">
          <table class="inventory-table" :aria-rowcount="entries.length + 1">
            <colgroup><col style="width:52px" /><col /><col style="width:14%" /><col style="width:14%" /><col style="width:12%" /><col style="width:10%" /><col style="width:176px" /></colgroup>
            <thead><tr><th><input type="checkbox" :checked="pageSelected" :indeterminate="!pageSelected && pagePartSelected" :aria-label="t('selectVisibleMaterials')" @change="togglePage" /></th><th>{{ t('name') }}</th><th>{{ t('category') }}</th><th>{{ t('physical') }}</th><th>{{ t('available') }}</th><th><span class="sr-only">{{ t('status') }}</span></th><th>{{ t('actions') }}</th></tr></thead>
            <tbody><tr v-if="virtualInventory.before.value" aria-hidden="true" class="inventory-spacer"><td colspan="7" :style="{ height: `${virtualInventory.before.value}px` }"></td></tr><tr v-for="row in visible" :key="row.material.id" :data-inventory-row="`material:${row.material.id}`" v-memo="[language, row, selected.includes(row.material.id), (selected.length >= 200 || selectionCount >= PURCHASE_SELECTION_LIMIT)]"><td><input :checked="selected.includes(row.material.id)" @change="selectRow('material', row.material.id, $event.target.checked)" :value="row.material.id" type="checkbox" :disabled="(selected.length>=200 || selectionCount>=PURCHASE_SELECTION_LIMIT) && !selected.includes(row.material.id)" :aria-label="t('selectMaterial',{name:row.material.name})" /></td>
              <td><div class="material-cell"><span class="swatch" :style="{ backgroundColor: row.material.color || undefined, ...productPreviewStyle(row.material) }"><Package v-if="!row.material.color && !productPreview(row.material)" :size="18" /></span><div><button class="cell-title" @click="navigate('material', row.material.id)">{{ row.material.name }} <Heart v-if="row.material.favorite" :size="12" /></button><span v-if="isDiscontinued(row.material)" class="badge discontinued-badge">{{ t('descriptorOption_discontinued') }}</span><span class="cell-subtitle">{{ [row.material.brand, row.material.range, row.material.code].filter(Boolean).join(' · ') || '—' }}</span></div></div></td>
              <td>{{ categoryName(row.material.category) }}</td>
              <td>{{ row.summary.estimated ? '≈ ' : '' }}{{ number(row.summary.physical) }}<small v-if="row.summary.physical !== null" class="cell-subtitle">{{ t(`unit_${row.material.unit}`) }}</small><small v-else-if="row.summary.knownPhysical" class="cell-subtitle">{{ t('knownAtLeast') }} {{ number(row.summary.knownPhysical) }}</small></td>
              <td><strong>{{ number(row.summary.available) }}</strong><span v-if="row.summary.unknown" class="cell-subtitle">{{ t('plusUnknown') }}</span></td>
              <td><span v-if="row.summary.conflicts.length" class="badge danger">{{ t('conflict') }}</span><span v-else-if="row.low" class="badge warning">{{ t('lowStock') }}</span><span v-else-if="row.material.archived" class="badge">{{ t('archived') }}</span></td>
              <td><div class="actions">
                <button class="icon-button" :aria-label="t('editThreadNamed', { name: row.material.name })" :title="t('edit')" @click="editing=row.material"><Pencil :size="18" /></button>
                <button class="icon-button" :aria-label="t('deleteThreadNamed', { name: row.material.name })" :title="t('deleteThread')" @click="deleting=row.material; actionError='' "><Trash2 :size="18" /></button>
                <button v-if="!isDiscontinued(row.material)" class="icon-button" :aria-label="t('shopThreadNamed', { name: row.material.name })" :title="t('sendToShopping')" @click="navigate('shopping', row.material.id)"><ShoppingCart :size="18" /></button>
              </div></td>
            </tr></tbody>
            <tbody v-if="visibleCatalogue.length" class="catalogue-rows"><tr v-for="{ product, discontinued } in visibleCatalogue" :key="product.id" :data-inventory-row="`catalogue:${product.id}`" v-memo="[language, product, discontinued, selectedCatalogue.includes(product.id), selectionCount >= PURCHASE_SELECTION_LIMIT]"><td><input :checked="selectedCatalogue.includes(product.id)" @change="selectRow('catalogue', product.id, $event.target.checked)" :value="product.id" type="checkbox" :disabled="selectionCount>=PURCHASE_SELECTION_LIMIT && !selectedCatalogue.includes(product.id)" :aria-label="t('selectMaterial',{name:[product.code,product.colorName].filter(Boolean).join(' \u00b7 ')})" /></td>
              <td><div class="material-cell"><span class="swatch" :style="{ backgroundColor: product.hex || undefined, ...productPreviewStyle(product) }"><Package v-if="!product.hex && !productPreview(product)" :size="18" /></span><div><span class="cell-title">{{ [product.code, product.colorName].filter(Boolean).join(' · ') }}</span><span v-if="discontinued" class="badge discontinued-badge">{{ t('descriptorOption_discontinued') }}</span><span class="cell-subtitle">{{ [product.brand, product.range].join(' · ') }}</span></div></div></td>
              <td>{{ categoryName(product.category) }}</td><td>—</td><td>—</td><td></td>
              <td><div class="actions"><button v-if="!discontinued" class="icon-button" :aria-label="t('shopThreadNamed', { name: [product.code, product.colorName].filter(Boolean).join(' · ') })" :title="t('sendToShopping')" @click="orderArticle(product)"><ShoppingCart :size="18" /></button></div></td>
            </tr></tbody>
            <tbody v-if="virtualInventory.after.value"><tr aria-hidden="true" class="inventory-spacer"><td colspan="7" :style="{ height: `${virtualInventory.after.value}px` }"></td></tr></tbody>
          </table>
        </div>
        <div class="panel-heading"><small class="muted">{{ number(filtered.length, 0) }} {{ t('materials').toLowerCase() }}<template v-if="catalogueRows.length"> · {{ t('catalogueNotOwned', { count: number(catalogueRows.length, 0) }) }}</template><template v-if="paginationEnabled"> · {{ t('page') }} {{ page }} / {{ pageCount }}</template></small><div v-if="paginationEnabled" class="actions"><button class="icon-button" :disabled="page <= 1" :aria-label="t('previousPage')" @click="page--"><ChevronLeft :size="18" /></button><button class="icon-button" :disabled="page >= pageCount" :aria-label="t('nextPage')" @click="page++"><ChevronRight :size="18" /></button></div></div>
      </template>
    </section>
    </template>
    <KitLibrary v-if="workflow==='collections'||workflow==='collectionSelection'" :selected-material-ids="workflow==='collectionSelection'?selected:[]" @close="workflow=''" />
    <InventoryBulkForm v-if="workflow==='bulk'" :ids="selected" @close="workflow=''" @saved="workflowSaved" />
    <InventoryLabels v-if="workflow==='labels'" :material-ids="selected" @close="workflow=''" />
    <InventoryRapidForm v-if="workflow==='rapid'" :defaults="rapidDefaults" @close="workflow=''" @saved="workflowSaved" />
    <MaterialForm v-if="editing" :key="editing.id" :material="editing" @close="editing=null" @saved="edited" />
    <AppDialog v-if="deleting" :title="t('deleteThread')" :busy="actionBusy" @close="deleting=null">
      <p>{{ t('deleteThreadConfirm', { name: deleting.name }) }}</p><p class="field-help">{{ t('deleteThreadHelp') }}</p>
      <p v-if="actionError" role="alert" class="notice error">{{ actionError }}</p>
      <template #footer><button class="button" :disabled="actionBusy" @click="deleting=null">{{ t('cancel') }}</button><button class="button primary" :disabled="actionBusy" @click="removeMaterial">{{ t('deleteThread') }}</button></template>
    </AppDialog>
    <AppDialog v-if="ordering" :title="t('sendToShopping')" :busy="orderBusy" @close="ordering=null">
      <form id="catalogue-order" @submit.prevent="placeOrder"><div v-for="(row,index) in ordering" :key="row.materialId || row.product.id" class="form-section"><p><strong>{{ orderName(row) }}</strong></p>
      <FormField :label="t('quantity')" :help="t(`unit_${orderUnit(row)}`)" required v-slot="{ id }"><input :id="id" v-model="row.quantity" inputmode="decimal" required :autofocus="index===0" /></FormField></div></form>
      <p v-if="orderError" role="alert" class="notice error">{{ orderError }}</p>
      <template #footer><button class="button" :disabled="orderBusy" @click="ordering=null">{{ t('cancel') }}</button><button class="button primary" type="submit" form="catalogue-order" :disabled="orderBusy">{{ orderBusy ? t('saving') : t('sendToShopping') }}</button></template>
    </AppDialog>
    <CategoryManager v-if="managingCategories" @close="managingCategories = false" />
    <MaterialForm v-if="adding" :key="addFormVersion" :context="addContext" :defaults="addDefaults" @close="closeForm" @saved="created" @bulk="openRapid" />
  </div>
</template>
