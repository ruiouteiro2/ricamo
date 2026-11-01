<script setup>
import { computed, ref, reactive, watch } from 'vue';
import { ChevronRight, CheckCircle2, Search, ExternalLink } from '@lucide/vue';
import PageHeader from '../components/PageHeader.vue';
import InventoryCategoryIcon from '../components/InventoryCategoryIcon.vue';
import { CHART_CATALOGUE, CHART_BRANDS, CHART_STATUSES, chartRecord, chartDimensions } from '../../core/chart-collection.mjs';
import { chartPreview } from '../pattern-catalogue.mjs';
import { state, route, navigate, dispatch } from '../state';
import { openPurchaseLink } from '../purchase-link.mjs';
import { t, number, date, errorText } from '../i18n';
const brand = computed(() => CHART_BRANDS.find(item => item.id === route.value.id));
const search = ref(''), ownership = ref('all'), status = ref('all'), density = ref(16), page = ref(1);
const busy = reactive({}), error = ref('');
const record = item => chartRecord(state.value, item.id);
const entries = computed(() => CHART_CATALOGUE.items.filter(item => !brand.value || item.brandId === brand.value.id));
const counts = computed(() => ({ total: entries.value.length, owned: entries.value.filter(item => record(item).owned).length, working: entries.value.filter(item => record(item).status === 'in_progress').length, completed: entries.value.filter(item => record(item).status === 'completed').length }));
const filtered = computed(() => entries.value.filter(item => {
  const saved = record(item), text = `${item.name} ${item.brand} ${item.sourceId}`.toLocaleLowerCase();
  return text.includes(search.value.trim().toLocaleLowerCase()) && (ownership.value === 'all' || saved.owned === (ownership.value === 'owned')) && (status.value === 'all' || saved.status === status.value);
}));
const pageCount = computed(() => Math.max(1, Math.ceil(filtered.value.length / 24)));
const visible = computed(() => filtered.value.slice((page.value - 1) * 24, page.value * 24));
watch(pageCount, count => { page.value = Math.min(page.value, count); });
watch([search, ownership, status], () => { page.value = 1; });
function dimensions(item) { const size = chartDimensions(item, density.value); return size ? `${number(size.widthCm, 1)} × ${number(size.heightCm, 1)} cm` : t('chartSizeUnavailable'); }
function estimated(item) { return chartDimensions(item, density.value)?.estimated; }
function brandCount(id) { return CHART_CATALOGUE.items.filter(item => item.brandId === id).length; }
async function update(item, patch, control) {
  if (busy[item.id]) return;
  busy[item.id] = true; error.value = '';
  try { await dispatch('chart.collection.save', { id: item.id, ...record(item), ...patch }); }
  catch (caught) { error.value = errorText(caught); if (control.type === 'checkbox') control.checked = record(item).owned; else control.value = record(item).status; }
  finally { busy[item.id] = false; }
}
async function source(item) { error.value = ''; try { await openPurchaseLink(item.sourceUrl); } catch (caught) { error.value = errorText(caught); } }
</script>
<template>
  <div class="page">
    <PageHeader :eyebrow="t('materials')" :title="brand ? brand.label : t('patterns')" :description="t('chartCatalogueHelp')" />
    <nav class="inventory-breadcrumb" :aria-label="t('inventoryNavigation')"><button class="button text" @click="navigate('materials')">{{ t('materials') }}</button><ChevronRight :size="15" /><button class="button text" @click="navigate('materialCharts')">{{ t('patterns') }}</button><template v-if="brand"><ChevronRight :size="15" /><span>{{ brand.label }}</span></template></nav>
    <div v-if="!brand" class="inventory-category-grid">
      <article v-for="author in CHART_BRANDS" :key="author.id" class="panel inventory-category-card"><button class="inventory-category-link" @click="navigate('materialCharts', author.id)"><InventoryCategoryIcon group="charts" :size="32" /><h2>{{ author.label }}</h2><span class="muted">{{ number(brandCount(author.id), 0) }} {{ t('patterns').toLowerCase() }}</span><ChevronRight :size="20" /></button></article>
    </div>
    <template v-else>
      <div class="metrics"><div v-for="(count, key) in counts" :key="key" class="metric"><div class="metric-top">{{ t(`chartCount_${key}`) }}</div><div class="metric-value">{{ number(count, 0) }}</div></div></div>
      <div class="toolbar"><div class="toolbar-search"><Search :size="17" /><input v-model="search" :aria-label="t('chartSearch')" :placeholder="t('chartSearch')" /></div><select v-model="ownership" :aria-label="t('chartOwnershipFilter')"><option value="all">{{ t('all') }}</option><option value="owned">{{ t('chartOwned') }}</option><option value="not_owned">{{ t('chartNotOwned') }}</option></select><select v-model="status" :aria-label="t('status')"><option value="all">{{ t('all') }}</option><option v-for="value in CHART_STATUSES" :key="value" :value="value">{{ t(`chartStatus_${value}`) }}</option></select><label class="field-help">{{ t('chartDensity') }}<select v-model.number="density" :aria-label="t('chartDensity')"><option v-for="value in [11,14,16,18,20,22]" :key="value" :value="value">{{ value }} {{ t('chartStitchesPerInch') }}</option></select></label></div>
      <p class="field-help">{{ t('chartSizeHelp') }}</p><p v-if="error" class="notice error" role="alert">{{ error }}</p>
      <div class="chart-catalogue-grid">
        <article v-for="item in visible" :key="item.id" class="panel chart-catalogue-card" :class="{ 'chart-completed': record(item).status === 'completed' }" :data-chart-id="item.id">
          <div class="chart-cover"><img v-if="chartPreview(item)" :src="chartPreview(item)" :alt="item.name" loading="lazy" /><span v-else>{{ t('chartPreviewUnavailable') }}</span></div>
          <div class="panel-body chart-card-body"><h2>{{ item.name }}</h2><p v-if="record(item).status === 'completed'" class="chart-completed-label"><CheckCircle2 :size="18" />{{ t('completed') }}</p>
            <p><strong>{{ dimensions(item) }}</strong><span v-if="estimated(item)" class="cell-subtitle">{{ t('chartEstimated') }} · {{ density }} {{ t('chartStitchesPerInch') }}</span><span v-else-if="item.widthCm" class="cell-subtitle">{{ t('chartDeclaredSize') }}</span></p>
            <p v-if="item.stitchesWidth" class="field-help">{{ item.stitchesWidth }} × {{ item.stitchesHeight }} {{ t('chartStitches') }}</p>
            <label class="checkbox-label" :for="`owned-${item.id}`"><input :id="`owned-${item.id}`" type="checkbox" :checked="record(item).owned" :disabled="busy[item.id]" @change="update(item, { owned: $event.target.checked }, $event.target)" />{{ t('chartOwned') }}</label>
            <label :for="`state-${item.id}`">{{ t('status') }}</label><select :id="`state-${item.id}`" :value="record(item).status" :disabled="busy[item.id]" @change="update(item, { status: $event.target.value }, $event.target)"><option v-for="value in CHART_STATUSES" :key="value" :value="value">{{ t(`chartStatus_${value}`) }}</option></select>
            <button class="button text small" @click="source(item)"><ExternalLink :size="14" />Casa Cenina</button>
          </div>
        </article>
      </div>
      <p v-if="!filtered.length" class="notice">{{ t('noResults') }}</p>
      <div class="actions form-section"><button class="button" :disabled="page === 1" @click="page--">{{ t('previousPage') }}</button><span>{{ number(filtered.length,0) }} {{ t('patterns').toLowerCase() }} · {{ page }} / {{ pageCount }}</span><button class="button" :disabled="page === pageCount" @click="page++">{{ t('nextPage') }}</button></div>
    </template>
    <p class="field-help form-section">Casa Cenina · {{ t('chartCatalogueChecked') }} {{ date(CHART_CATALOGUE.checkedAt) }} · {{ t('chartCatalogueAttribution') }}</p>
  </div>
</template>
