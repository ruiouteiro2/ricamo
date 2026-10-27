<script setup>
import { computed, ref, watch } from 'vue';
import { Plus, Search, Package, CircleAlert, Download, ChevronLeft, ChevronRight, Heart, MapPin } from '@lucide/vue';
import PageHeader from '../components/PageHeader.vue';
import EmptyState from '../components/EmptyState.vue';
import MaterialForm from '../components/MaterialForm.vue';
import { state, route, navigate, notify, normalize, categories, locate, dispatch } from '../state';
import { t, number, errorText } from '../i18n';
import { inventorySummary } from '../../core/inventory.mjs';

const props = defineProps({ initialAction: String });
const adding = ref(props.initialAction === 'new' || route.value.id === 'new');
let remembered = state.value.settings.preferences?.materialFilters || {};
try { remembered = JSON.parse(sessionStorage.getItem('ricamo:material-view') || 'null') || remembered; } catch { /* Ignore invalid view preferences, never application data. */ }
const search = ref(remembered.search || ''), category = ref(remembered.category || ''), location = ref(remembered.location || ''), filter = ref(remembered.filter || 'active'), sort = ref(remembered.sort || 'nameAZ'), page = ref(remembered.page || 1);
const preferenceBusy = ref(false), preferenceError = ref('');
function currentView() { return { search: search.value, category: category.value, location: location.value, filter: filter.value, sort: sort.value, page: page.value }; }
watch([search, category, location, filter, sort, page], () => { try { sessionStorage.setItem('ricamo:material-view', JSON.stringify(currentView())); } catch { /* View remains usable when browser preference storage is unavailable. */ } });
async function rememberFilters() { preferenceBusy.value = true; preferenceError.value = ''; try { await dispatch('settings.save', { preferences: { ...state.value.settings.preferences, materialFilters: currentView() } }); notify(); } catch(error) { preferenceError.value = errorText(error); } finally { preferenceBusy.value = false; } }
const pageSize = 50;
watch(() => props.initialAction, value => { if (value === 'new') adding.value = true; });
watch(() => route.value.id, value => { if (value === 'new') adding.value = true; });
watch([search, category, location, filter, sort], () => { page.value = 1; });
const rows = computed(() => {
  const lots = new Map(), reservations = new Map();
  for (const lot of state.value.lots) { if (!lots.has(lot.materialId)) lots.set(lot.materialId, []); lots.get(lot.materialId).push(lot); }
  for (const reservation of state.value.reservations) { if (!reservations.has(reservation.lotId)) reservations.set(reservation.lotId, []); reservations.get(reservation.lotId).push(reservation); }
  return state.value.materials.map(material => {
    const holdings = lots.get(material.id) || [];
    const summary = inventorySummary({ lots: holdings, reservations: holdings.flatMap(lot => reservations.get(lot.id) || []) }, material.id);
    const locationIds = [...new Set(holdings.filter(lot => lot.status !== 'transformed').map(lot => lot.locationId))];
    const locationNames = locationIds.map(locate);
    return { material, holdings, summary, locationIds, locationNames, search: normalize([material.name, material.brand, material.range, material.code, material.notes, ...material.tags, ...locationNames].join(' ')), low: material.minimum !== null && summary.available < material.minimum };
  });
});
const filtered = computed(() => {
  const query = normalize(search.value);
  return rows.value.filter(row => {
    if (filter.value === 'archived' ? !row.material.archived : row.material.archived) return false;
    if (filter.value === 'low' && !row.low) return false;
    if (filter.value === 'review' && !row.summary.unknown && !row.summary.conflicts.length) return false;
    if (filter.value === 'favorite' && !row.material.favorite) return false;
    if (category.value && row.material.category !== category.value) return false;
    if (location.value && !row.locationIds.includes(location.value)) return false;
    return !query || row.search.includes(query);
  }).sort((a, b) => sort.value === 'recent' ? b.material.createdAt.localeCompare(a.material.createdAt) : a.material.name.localeCompare(b.material.name));
});
const pageCount = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize)));
watch(pageCount, count => { page.value = Math.min(page.value, count); });
const visible = computed(() => filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize));
const activeRows = computed(() => rows.value.filter(row => !row.material.archived));
const lowCount = computed(() => activeRows.value.filter(row => row.low).length);
const reviewCount = computed(() => activeRows.value.filter(row => row.summary.unknown || row.summary.conflicts.length).length);
const locationCount = computed(() => new Set(state.value.lots.filter(row => row.status !== 'transformed' && row.locationId).map(row => row.locationId)).size);
const categoryOptions = computed(() => [...categories.map(value => ({ value, label: t(value) })), ...state.value.categories.map(row => ({ value: row.id, label: row.name }))]);
function categoryName(value) { return state.value.categories.find(row => row.id === value)?.name || t(value); }
function clear() { search.value = ''; category.value = ''; location.value = ''; filter.value = 'active'; }
function closeForm() { adding.value = false; if (route.value.id === 'new') route.value = { ...route.value, id: null }; }
function created(id) { closeForm(); notify(); navigate('material', id); }
</script>

<template>
  <div>
    <PageHeader :eyebrow="t('materials')" :title="t('inventoryTitle')" :description="t('inventorySubtitle')">
      <button class="button" @click="navigate('settings')"><Download :size="16" />{{ t('inventoryDataTools') }}</button>
      <button class="button primary" @click="adding = true"><Plus :size="17" />{{ t('addMaterial') }}</button>
    </PageHeader>
    <div class="metrics">
      <div class="metric"><div class="metric-top">{{ t('materials') }}<Package :size="18" /></div><div class="metric-value">{{ number(activeRows.length, 0) }}</div><div class="metric-caption">{{ t('materialCount') }}</div></div>
      <button class="metric" @click="filter = 'low'"><div class="metric-top">{{ t('lowStock') }}<CircleAlert :size="18" /></div><div class="metric-value">{{ number(lowCount, 0) }}</div><div class="metric-caption">{{ t('belowMinimum') }}</div></button>
      <button class="metric" @click="filter = 'review'"><div class="metric-top">{{ t('needsReview') }}<Search :size="18" /></div><div class="metric-value">{{ number(reviewCount, 0) }}</div><div class="metric-caption">{{ t('unknownOrConflicted') }}</div></button>
      <div class="metric"><div class="metric-top">{{ t('locations') }}<MapPin :size="18" /></div><div class="metric-value">{{ number(locationCount, 0) }}</div><div class="metric-caption">{{ t('occupiedLocations') }}</div></div>
    </div>
    <div class="toolbar">
      <div class="toolbar-search"><Search :size="17" /><input v-model="search" :aria-label="t('searchMaterials')" :placeholder="t('searchMaterials')" /></div>
      <select v-model="category" :aria-label="t('category')"><option value="">{{ t('allCategories') }}</option><option v-for="option in categoryOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select>
      <select v-model="location" :aria-label="t('location')"><option value="">{{ t('allLocations') }}</option><option v-for="item in state.locations" :key="item.id" :value="item.id">{{ locate(item.id) }}</option></select>
      <select v-model="filter" :aria-label="t('status')"><option value="active">{{ t('active') }}</option><option value="low">{{ t('lowStock') }}</option><option value="review">{{ t('needsReview') }}</option><option value="favorite">{{ t('favorite') }}</option><option value="archived">{{ t('archived') }}</option></select>
      <select v-model="sort" :aria-label="t('sort')"><option value="nameAZ">{{ t('nameAZ') }}</option><option value="recent">{{ t('recent') }}</option></select>
      <button class="button small" :disabled="preferenceBusy" @click="rememberFilters">{{ t('rememberFilters') }}</button>
    </div>
    <p v-if="preferenceError" role="alert" class="notice error">{{ preferenceError }}</p>
    <section class="panel">
      <EmptyState v-if="!rows.length" :icon="Package" :title="t('emptyMaterials')" :description="t('emptyMaterialsBody')"><button class="button primary" @click="adding = true"><Plus :size="16" />{{ t('addMaterial') }}</button></EmptyState>
      <EmptyState v-else-if="!filtered.length" :icon="Search" :title="t('noResults')"><button class="button" @click="clear">{{ t('clearFilters') }}</button></EmptyState>
      <template v-else>
        <div class="table-wrap">
          <table>
            <thead><tr><th>{{ t('name') }}</th><th>{{ t('category') }}</th><th>{{ t('physical') }}</th><th>{{ t('reserved') }}</th><th>{{ t('available') }}</th><th>{{ t('location') }}</th><th><span class="sr-only">{{ t('status') }}</span></th></tr></thead>
            <tbody><tr v-for="row in visible" :key="row.material.id">
              <td><div class="material-cell"><span class="swatch" :style="{ backgroundColor: row.material.color || undefined }"><Package v-if="!row.material.color" :size="18" /></span><div><button class="cell-title" @click="navigate('material', row.material.id)">{{ row.material.name }} <Heart v-if="row.material.favorite" :size="12" /></button><span class="cell-subtitle">{{ [row.material.brand, row.material.range, row.material.code].filter(Boolean).join(' · ') || '—' }}</span></div></div></td>
              <td>{{ categoryName(row.material.category) }}</td>
              <td>{{ row.summary.estimated ? '≈ ' : '' }}{{ number(row.summary.physical) }}<small v-if="row.summary.physical !== null" class="cell-subtitle">{{ t(`unit_${row.material.unit}`) }}</small><small v-else-if="row.summary.knownPhysical" class="cell-subtitle">{{ t('knownAtLeast') }} {{ number(row.summary.knownPhysical) }}</small></td>
              <td>{{ number(row.summary.reserved) }}</td>
              <td><strong>{{ number(row.summary.available) }}</strong><span v-if="row.summary.unknown" class="cell-subtitle">{{ t('plusUnknown') }}</span></td>
              <td><span v-for="name in row.locationNames.slice(0, 2)" :key="name" class="cell-subtitle">{{ name }}</span><span v-if="row.locationNames.length > 2" class="cell-subtitle">+{{ row.locationNames.length - 2 }}</span><span v-if="!row.locationNames.length">—</span></td>
              <td><span v-if="row.summary.conflicts.length" class="badge danger">{{ t('conflict') }}</span><span v-else-if="row.low" class="badge warning">{{ t('lowStock') }}</span><span v-else-if="row.material.archived" class="badge">{{ t('archived') }}</span></td>
            </tr></tbody>
          </table>
        </div>
        <div class="panel-heading"><small class="muted">{{ number(filtered.length, 0) }} {{ t('materials').toLowerCase() }} · {{ t('page') }} {{ page }} / {{ pageCount }}</small><div class="actions"><button class="icon-button" :disabled="page <= 1" :aria-label="t('previousPage')" @click="page--"><ChevronLeft :size="18" /></button><button class="icon-button" :disabled="page >= pageCount" :aria-label="t('nextPage')" @click="page++"><ChevronRight :size="18" /></button></div></div>
      </template>
    </section>
    <MaterialForm v-if="adding" @close="closeForm" @saved="created" />
  </div>
</template>
