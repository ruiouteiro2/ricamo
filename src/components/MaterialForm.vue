<script setup>
import { reactive, ref, computed, useId, watch, onBeforeUnmount } from 'vue';
import { AlertTriangle } from '@lucide/vue';
import AppDialog from './AppDialog.vue';
import FormField from './FormField.vue';
import MaterialProductPicker from './MaterialProductPicker.vue';
import {supplierLookup, supplierSearch, supplierFacets} from '../supplier-catalogues.mjs';
import {supplierIdentity,supplierSwatch,SUPPLIER_CATEGORIES} from '../../core/supplier-products.mjs';
import MaterialDescriptors from './MaterialDescriptors.vue';
import { normalizeDescriptorProperties } from '../../core/material-descriptors.mjs';
import StagedAttachments from './StagedAttachments.vue';
import { state, categories, units, locate, saveEntityWithAssets, dispatch } from '../state';
import { t, errorText } from '../i18n';
import { inventoryCategories, materialCustomFields } from '../inventory-categories.mjs';
import { INVENTORY_GROUPS, inventoryGroup, accessorySection } from '../inventory-navigation.mjs';
import { duplicateMaterials } from '../../core/material-duplicates.mjs';
import { convertQuantity } from '../../core/fabric.mjs';
import { quantity } from '../../core/shared.mjs';

const props = defineProps({ material: Object, context: { type: Object, default: () => ({}) } });
const emit = defineEmits(['close', 'saved']);
const formId = useId(), operationId = crypto.randomUUID(), materialId = props.material?.id || crypto.randomUUID();
const draft = reactive({ name: '', category: 'thread', brand: '', range: '', code: '', unit: 'm', color: '#8b6477', tagsText: '', notes: '', minimum: 1, packageSize: '', strands: '', divisible: false, reusable: false, favorite: false, properties: {}, attachments: [], ...JSON.parse(JSON.stringify(props.material || {})) });
draft.tagsText = (props.material?.tags || []).join(', ');
const stock = reactive({ enabled: !props.material, quantity: '', confidence: 'exact', status: 'usable', locationId: '', lotCode: '', cost: '', currency: state.value.settings.currency, supplierId: '', widthCm: '', heightCm: '', properties: {} });
const busy = ref(false), error = ref(''), photoFiles = ref([]);
const isEdit = computed(() => Boolean(props.material));
const groupId = ref(props.context.groupId || inventoryGroup(draft));
const activeGroup = computed(() => INVENTORY_GROUPS.find(group => group.id === groupId.value));
const accessoryId = ref(props.context.section || 'needles');
if (!props.material) {
  draft.category = activeGroup.value.category;
  draft.brand = props.context.brand || (activeGroup.value.children.length === 1 ? activeGroup.value.children[0].brand : '');
  draft.unit = draft.category === 'thread' ? 'm' : 'piece';
}
const brandLabel = brand => activeGroup.value.children.find(child => child.brand === brand)?.label || brand;
const brandOptions = computed(() => groupId.value === 'accessories' ? catalogueFacets.value.brands : activeGroup.value.children.map(child => child.brand).filter(Boolean));
watch(groupId, () => {
  draft.category = activeGroup.value.category;
  draft.brand = activeGroup.value.children.length === 1 ? activeGroup.value.children[0].brand : '';
  draft.range = ''; draft.code = ''; draft.name = ''; draft.color = ''; draft.properties = { custom: {} };
  draft.unit = draft.category === 'thread' ? 'm' : 'piece';
});
watch(accessoryId, () => {
  if (groupId.value !== 'accessories' || !draft.properties.product) return;
  delete draft.properties.product;
  draft.name = ''; draft.range = ''; draft.code = ''; draft.color = ''; draft.unit = 'piece';
});
const showCatalogue=ref(!props.material),lookupBusy=ref(false);let lookupTimer,lookupToken=0;
const catalogueCategory=computed(()=>SUPPLIER_CATEGORIES.includes(draft.category));
const colourCategory=computed(()=>['thread','fabric','embellishment'].includes(draft.category));
const categoryOptions = inventoryCategories;
draft.properties.custom ||= {};
const customFields = computed(() => materialCustomFields(draft));
const unitLocked = computed(() => props.material && state.value.lots.some(lot => lot.materialId === props.material.id));
const similar = computed(() => {
  if (!draft.code.trim() && !draft.name.trim()) return [];
  return state.value.materials.filter(item => item.id !== props.material?.id && !item.archived && (
    draft.code.trim() ? item.code === draft.code.trim() && item.brand.toLowerCase() === draft.brand.trim().toLowerCase() && item.range.toLowerCase() === draft.range.trim().toLowerCase() : item.name.toLowerCase() === draft.name.trim().toLowerCase()
  )).slice(0, 4);
});
const duplicate = ref(null), duplicateError = ref('');
const duplicateTarget = computed(() => state.value.materials.find(material => material.id === duplicate.value?.targetId));
function duplicateQuantity(targetId) {
  const target = state.value.materials.find(material => material.id === targetId);
  return convertQuantity(duplicate.value.lot.quantity, duplicate.value.material.unit, target.unit, target) ?? '';
}
async function confirmDuplicate() {
  if (busy.value) return;
  busy.value = true; duplicateError.value = '';
  try {
    const amount = quantity(duplicate.value.quantity, { positive: true });
    const target = duplicateTarget.value;
    await dispatch('material.addDuplicateStock', { materialId: target.id, material: duplicate.value.material, unit: target.unit, lot: { ...duplicate.value.lot, quantity: amount } }, operationId);
    duplicate.value = null; emit('saved', target.id);
  } catch (caught) { duplicateError.value = errorText(caught); }
  finally { busy.value = false; }
}
const threadFamilies = computed(() => draft.brand.trim().toLowerCase() === 'madeira' ? ['spool'] : ['mouline', 'special', 'silk', 'wool', 'spool', 'pearl', ...(['dmc', 'anchor'].includes(draft.brand.trim().toLowerCase()) ? ['alsace'] : [])]);
const threadFamily = ref(threadFamilies.value.includes(draft.properties.threadFamily) ? draft.properties.threadFamily : threadFamilies.value[0]);
const usageStatus = ref('new');
function familyOf(product) {
  const range = String(product.range || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  if (/alsac|fiorentin/.test(range)) return 'alsace';
  if (/silk|seta|soie|waterlil/.test(range)) return 'silk';
  if (/wool|lana|laine/.test(range)) return 'wool';
  if (/perl|pearl/.test(range)) return 'pearl';
  if (/spool|rocchett|rocca|spoletta|bobina|bobbin|cucit/.test(range)) return 'spool';
  if (/^(mouline|stranded cotton)( special( 25)?)?$/.test(range)) return 'mouline';
  return 'special';
}
function familyLabel(family) {
  return t(`entryFamily_${family === 'alsace' && draft.brand.trim().toLowerCase() === 'anchor' ? 'florentine' : family}`);
}
watch(() => [threadFamily.value, draft.brand], ([value]) => {
  if (draft.category !== 'thread') return;
  if (!threadFamilies.value.includes(value)) { threadFamily.value = threadFamilies.value[0]; return; }
  draft.properties.threadFamily = value;
  if (draft.properties.product && draft.properties.product.brand === draft.brand && familyOf(draft.properties.product) === value) return;
  draft.range = familyLabel(value);
});
watch(usageStatus, value => {
  if (value === 'finished') stock.quantity = '0';
  else if (String(stock.quantity).trim() === '0') stock.quantity = '';
});
watch(() => stock.quantity, value => {
  if (String(value).trim() !== '' && Number(String(value).replace(',', '.')) === 0) usageStatus.value = 'finished';
  else if (usageStatus.value === 'finished') usageStatus.value = 'partial';
});
const catalogueItems = ref([]), catalogueFacets = ref({ brands: [], ranges: [] });
const catalogueBusy = ref(false), catalogueError = ref('');
let catalogueTimer, catalogueToken = 0;
const catalogueOptions = computed(() => {
  const selected = draft.properties.product;
  return selected && !catalogueItems.value.some(item => item.id === selected.id)
    ? [selected, ...catalogueItems.value] : catalogueItems.value;
});
watch(() => [draft.category, draft.brand, threadFamily.value, accessoryId.value, draft.code], () => {
  if (isEdit.value) return;
  clearTimeout(catalogueTimer);
  const token = ++catalogueToken;
  catalogueBusy.value = true;
  catalogueError.value = '';
  catalogueTimer = setTimeout(async () => {
    try {
      const facets = await supplierFacets({ category: draft.category, brand: draft.brand });
      let products;
      if (draft.category === 'thread') {
        const ranges = facets.ranges.filter(range => familyOf({ range }) === threadFamily.value);
        const results = await Promise.all(ranges.map(range => supplierSearch({ category: 'thread', brand: draft.brand, range, query: draft.code, limit: 100 })));
        products = results.flatMap(result => result.items).filter(product => familyOf(product) === threadFamily.value);
      } else {
        const result = await supplierSearch({ category: draft.category, brand: draft.brand, query: draft.code, limit: 100 });
        products = result.items.filter(product => draft.category !== 'tool' || accessorySection(product) === accessoryId.value);
      }
      if (token !== catalogueToken) return;
      catalogueItems.value = products.slice(0, 100);
      catalogueFacets.value = facets;
    } catch (caught) {
      if (token === catalogueToken) catalogueError.value = errorText(caught);
    } finally {
      if (token === catalogueToken) catalogueBusy.value = false;
    }
  }, 250);
}, { immediate: true });
onBeforeUnmount(() => { clearTimeout(catalogueTimer); catalogueToken++; });
function selectCatalogue(event) {
  const product = catalogueOptions.value.find(item => item.id === event.target.value);
  if (!product) return;
  if (product.category === 'thread') {
    threadFamily.value = familyOf(product);
    draft.properties.threadFamily = threadFamily.value;
  }
  draft.category = product.category;
  chooseProduct(product);
}
function chooseProduct(product){
  delete draft.properties.colorSource;
  Object.assign(draft,{name:product.name,brand:product.brand,range:product.range,code:product.code,color:product.hex??''});
  draft.properties.product=JSON.parse(JSON.stringify(product));
  if(!isEdit.value){
    draft.unit=units.includes(product.pack.unit)?product.pack.unit:product.category==='thread'?'m':'piece';
    draft.packageSize=draft.unit==='m'?product.pack.lengthM??'':'';
  }
  draft.strands=product.pack.strands??'';draft.divisible=product.pack.divisible===true;
  if(product.fabric)Object.assign(draft.properties,product.fabric,{fabricType:product.type});
  if(['cotton','pearl','silk','wool','rayon','polyester','metallic','variegated','ribbon','other'].includes(product.type))draft.properties.threadType=product.type;
  showCatalogue.value=false;
}
watch(()=>[draft.category,draft.brand,draft.range,draft.code],()=>{
  clearTimeout(lookupTimer);const token=++lookupToken;lookupBusy.value=false;
  const snapshot=draft.properties.product;
  if(snapshot&&snapshot.category===draft.category&&supplierIdentity(snapshot)===supplierIdentity(draft)){delete draft.properties.colorSource;draft.color=snapshot.hex??'';return;}
  if(snapshot){delete draft.properties.product;draft.strands='';draft.divisible=false;draft.packageSize='';}
  delete draft.properties.colorSource;
  if(!catalogueCategory.value)return;
  draft.color='';if(!draft.brand||!draft.range||!draft.code)return;
  lookupBusy.value=true;
  lookupTimer=setTimeout(async()=>{try{const rows=await supplierLookup({category:draft.category,brand:draft.brand,range:draft.range,code:draft.code});if(token!==lookupToken)return;const product=rows.find(row=>row.hex)??rows[0];if(product){draft.properties.product=product;draft.color=product.hex??'';draft.strands=product.pack.strands??'';draft.divisible=product.pack.divisible===true;if(draft.unit==='m')draft.packageSize=product.pack.lengthM??'';}else{const swatch=supplierSwatch({brand:draft.brand,range:draft.range,code:draft.code});if(swatch.hex){draft.color=swatch.hex;draft.properties.colorSource=swatch.rgbSource;}}}catch(caught){if(token===lookupToken)error.value=errorText(caught);}finally{if(token===lookupToken)lookupBusy.value=false;}},250);
},{immediate:true});
onBeforeUnmount(()=>{clearTimeout(lookupTimer);lookupToken++;});
function chooseCategory() {
  showCatalogue.value=true;

  if (!isEdit.value) {
    if (['fabric', 'tool', 'kit', 'reference', 'storage'].includes(draft.category)) draft.unit = 'piece';
    else if (draft.category === 'thread') draft.unit = 'm';
  }
}
function optionalNumber(value, field) { return quantity(value, { nullable: true, field }); }
function price(value) {
  if (value === '' || value === null) return null;
  const number = quantity(value, { field: 'cost' });
  if (Math.abs(number * 100 - Math.round(number * 100)) > 0.000001) throw Object.assign(new Error(), { code: 'invalid_number' });
  return Math.round(number * 100);
}
async function save() {
  if (busy.value||lookupBusy.value) return;
  busy.value = true; error.value = '';
  try {
    if (!isEdit.value) {
      if (draft.category === 'thread') {
        draft.properties.threadFamily = threadFamily.value;
        if (!draft.range) draft.range = familyLabel(threadFamily.value);
      }
      if (groupId.value === 'accessories') {
        draft.properties.inventorySection = accessoryId.value;
        if (!draft.range) draft.range = t(activeGroup.value.children.find(child => child.id === accessoryId.value).labelKey);
      }
      stock.properties.usageStatus = usageStatus.value;
      stock.properties.details = { version: 1, packageCondition: usageStatus.value === 'new' ? 'sealed' : 'partial' };
    }
    const properties = normalizeDescriptorProperties(JSON.parse(JSON.stringify(draft.properties)));
    properties.custom = Object.fromEntries(Object.entries(properties.custom || {}).map(([key,value]) => [key,String(value ?? '')]));
    for (const key of ['countX', 'countY']) if (key in properties) properties[key] = optionalNumber(properties[key], key);
    const payload = { ...JSON.parse(JSON.stringify(draft)), name: isEdit.value || draft.category !== 'thread' ? draft.name : [draft.brand, draft.range, draft.code, draft.properties.threadSize].filter(value => String(value ?? '').trim()).join(' · '), id: materialId, tags: draft.tagsText.split(',').map(tag => tag.trim()).filter(Boolean), minimum: 1, packageSize: optionalNumber(draft.packageSize, 'packageSize'), strands: optionalNumber(draft.strands, 'strands'), properties };
    delete payload.tagsText;
    let lot = null;
    if (!isEdit.value && stock.enabled) {
      lot = { quantity: optionalNumber(stock.quantity, 'quantity'), confidence: stock.confidence, status: stock.status, locationId: stock.locationId || null, lotCode: stock.lotCode, cost: price(stock.cost), currency: stock.currency.toUpperCase(), supplierId: stock.supplierId || null, properties: normalizeDescriptorProperties(JSON.parse(JSON.stringify(stock.properties)), 'lot') };
      if (draft.category === 'fabric') lot.properties = { ...lot.properties, widthCm: optionalNumber(stock.widthCm, 'widthCm'), heightCm: optionalNumber(stock.heightCm, 'heightCm'), irregular: false, countX: properties.countX ?? null, countY: properties.countY ?? null, countMeaning: properties.countMeaning || 'stitches' };
    }
    if (!isEdit.value) {
      const matches = duplicateMaterials(state.value, payload);
      if (matches.length) {
        duplicate.value = { material: payload, lot, matches: matches.map(material => ({ id: material.id, name: material.name })), targetId: matches[0].id, quantity: '' };
        duplicate.value.quantity = duplicateQuantity(matches[0].id);
        duplicateError.value = ''; return;
      }
    }
    if (isEdit.value) await saveEntityWithAssets('material.save', payload, photoFiles.value, operationId);
    else await saveEntityWithAssets('material.createWithLot', { material: payload, lot }, photoFiles.value, operationId);
    emit('saved', payload.id);
  } catch (caught) { error.value = errorText(caught); }
  finally { busy.value = false; }
}
</script>

<template>
  <AppDialog :title="t(isEdit ? 'editMaterial' : 'addMaterial')" wide :busy="busy" @close="emit('close')">
    <p v-if="error" class="notice error" role="alert">{{ error }}</p>
    <form :id="formId" @submit.prevent="save">
      <template v-if="!isEdit">
        <div class="form-grid">
          <FormField v-if="!context.groupId" :label="t('category')" required v-slot="{ id }"><select :id="id" v-model="groupId"><option v-for="group in INVENTORY_GROUPS" :key="group.id" :value="group.id">{{ t(group.labelKey) }}</option></select></FormField>
          <FormField v-if="draft.category !== 'thread'" :label="t('name')" required wide v-slot="{ id }"><input :id="id" v-model="draft.name" required maxlength="300" /></FormField>
          <FormField :label="t('brand')" :required="groupId !== 'accessories'" v-slot="{ id }"><output v-if="context.brand" :id="id" class="notice">{{ brandLabel(draft.brand) }}</output><select v-else :id="id" v-model="draft.brand" :required="groupId !== 'accessories'"><option value="">{{ t('allBrands') }}</option><option v-if="draft.brand && !brandOptions.includes(draft.brand)" :value="draft.brand">{{ draft.brand }}</option><option v-for="brand in brandOptions" :key="brand" :value="brand">{{ brandLabel(brand) }}</option></select></FormField>
          <FormField v-if="draft.category === 'thread'" :label="t('addMaterialType')" required v-slot="{ id }"><select :id="id" v-model="threadFamily" required><option v-for="family in threadFamilies" :key="family" :value="family">{{ familyLabel(family) }}</option></select></FormField>
          <FormField v-else-if="groupId === 'accessories'" :label="t('addMaterialType')" v-slot="{ id }"><output v-if="context.section" :id="id" class="notice">{{ t(activeGroup.children.find(child => child.id === accessoryId).labelKey) }}</output><select v-else :id="id" v-model="accessoryId"><option v-for="child in activeGroup.children" :key="child.id" :value="child.id">{{ t(child.labelKey) }}</option></select></FormField>
          <FormField v-else :label="t('addMaterialType')" v-slot="{ id }"><input :id="id" v-model="draft.range" maxlength="200" /></FormField>
          <FormField :label="t(draft.category === 'tool' ? 'materialArticleCode' : 'addMaterialColorCode')" v-slot="{ id }"><input :id="id" v-model="draft.code" maxlength="200" /></FormField>
          <FormField v-if="draft.category === 'thread'" :label="t('addMaterialThickness')" v-slot="{ id }"><input :id="id" v-model="draft.properties.threadSize" maxlength="100" /></FormField>
          <FormField :label="t('addMaterialCatalogue')" :help="t('addMaterialCatalogueHelp')" wide v-slot="{ id, describedby }"><select :id="id" class="catalogue-select" :value="draft.properties.product?.id || ''" :disabled="catalogueBusy" :aria-describedby="describedby" @change="selectCatalogue"><button type="button"><selectedcontent /></button><option value="">{{ catalogueBusy ? t('loading') : t('addMaterialCataloguePlaceholder') }}</option><option v-for="product in catalogueOptions" :key="product.id" :value="product.id"><span class="catalogue-swatch" :class="{ 'catalogue-swatch-unknown': !product.hex }" :style="{ backgroundColor: product.hex || undefined }" aria-hidden="true"></span><span>{{ [product.brand, product.range, product.code, product.colorName || product.name].filter(Boolean).join(' · ') }}<small v-if="!product.hex"> — {{ t('materialColorUnavailable') }}</small></span></option></select></FormField>
          <FormField :label="t('addMaterialOwnedQuantity')" :help="`${t(`unit_${draft.unit}`)}. ${t('unknownHint')}`" v-slot="{ id, describedby }"><input :id="id" v-model="stock.quantity" inputmode="decimal" :aria-describedby="describedby" /></FormField>
          <FormField :label="t('minimum')" :help="t('minimumStockHelp')" v-slot="{ id, describedby }"><input :id="id" value="1" readonly :aria-describedby="describedby" /></FormField>
          <FormField :label="t('status')" v-slot="{ id }"><select :id="id" v-model="usageStatus"><option v-for="status in ['new','partial','finished']" :key="status" :value="status">{{ t(`entryStatus_${status}`) }}</option></select></FormField>
        </div>
        <p v-if="catalogueError" class="notice error" role="alert">{{ catalogueError }}</p>
      </template>
      <template v-else>
      <div class="form-grid">
        <FormField :label="t('name')" required wide v-slot="{ id }"><input :id="id" v-model="draft.name" required maxlength="300" autofocus :placeholder="t('materialNameExample')" /></FormField>
        <FormField :label="t('category')" required v-slot="{ id }"><select :id="id" v-model="draft.category" @change="chooseCategory"><option v-if="!categoryOptions.some(option => option.value === draft.category)" :value="draft.category">{{ t('inventoryAccessories') }}</option><option v-for="option in categoryOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></FormField>
        <FormField :label="t('unit')" :help="unitLocked ? t('unitLockedHelp') : t('unitHelp')" v-slot="{ id, describedby }"><select :id="id" v-model="draft.unit" :disabled="unitLocked" :aria-describedby="describedby"><option v-for="unit in units" :key="unit" :value="unit">{{ t(`unit_${unit}`) }}</option></select></FormField>
        <FormField v-if="colourCategory" :label="t('materialAutoColor')" wide v-slot="{id}"><output :id="id" class="actions"><span class="swatch" :style="{background:draft.color||'#aaa6a0'}" aria-hidden="true"/>{{lookupBusy?t('loading'):draft.properties.product?.colorName||draft.color||t('materialColorUnavailable')}}</output></FormField>
      </div>
      <p v-if="draft.properties.product?.colorVariation==='multicolour'" class="field-help">{{t('materialMulticolour')}}</p>
      <section v-if="catalogueCategory" class="form-section">
        <h3>{{t('chooseCatalogueMaterial')}}</h3>
        <MaterialProductPicker v-if="showCatalogue" :key="draft.category" :category="draft.category" :initial-brand="draft.brand" :initial-code="draft.code" @select="chooseProduct"/>
        <div v-else class="notice"><span>{{draft.brand}} {{draft.range}} · {{draft.code}}</span><button type="button" class="button small" @click="showCatalogue=true">{{t('changeMaterial')}}</button></div>
      </section>
      <details class="form-section"><summary>{{t('manualMaterialIdentity')}}</summary><div class="form-grid">
        <FormField :label="t('brand')" v-slot="{id}"><input :id="id" v-model="draft.brand" maxlength="200"/></FormField>
        <FormField :label="t(draft.category==='thread'?'threadProductType':'materialProductType')" v-slot="{id}"><input :id="id" v-model="draft.range" maxlength="200"/></FormField>
        <FormField :label="t(colourCategory?'materialColorCode':'materialArticleCode')" :help="t('codeHelp')" v-slot="{id,describedby}"><input :id="id" v-model="draft.code" maxlength="200" :aria-describedby="describedby"/></FormField>
        <FormField v-if="!catalogueCategory" :label="t('color')" v-slot="{id}"><input :id="id" v-model="draft.color" type="color"/></FormField>
      </div><p v-if="colourCategory" class="field-help">{{t('materialAutoColorHelp')}}</p></details>
      <div v-if="similar.length" class="notice warning form-section"><AlertTriangle :size="18" /><div><strong>{{ t('duplicates') }}</strong><p v-for="item in similar" :key="item.id">{{ item.name }} · {{ item.brand }} {{ item.code }}</p><p>{{ t('duplicateMaterialHelp') }}</p></div></div>
      <section v-if="!isEdit" class="form-section">
        <h3><label class="checkbox-label"><input v-model="stock.enabled" type="checkbox" />{{ t('initialStock') }}</label></h3>
        <div v-if="stock.enabled" class="form-grid">
          <FormField :label="t('quantity')" :help="t('unknownHint')" v-slot="{ id, describedby }"><input :id="id" v-model="stock.quantity" inputmode="decimal" :aria-describedby="describedby" /></FormField>
          <FormField :label="t('confidence')" v-slot="{ id }"><select :id="id" v-model="stock.confidence"><option value="exact">{{ t('exact') }}</option><option value="estimated">{{ t('estimated') }}</option></select></FormField>
          <FormField :label="t('location')" v-slot="{ id }"><select :id="id" v-model="stock.locationId"><option value="">{{ t('none') }}</option><option v-for="location in state.locations" :key="location.id" :value="location.id">{{ locate(location.id) }}</option></select></FormField>
          <FormField :label="t('lotCode')" v-slot="{ id }"><input :id="id" v-model="stock.lotCode" maxlength="200" /></FormField>
          <template v-if="draft.category === 'fabric'">
            <FormField :label="t('fabricWidthCm')" v-slot="{ id }"><input :id="id" v-model="stock.widthCm" inputmode="decimal" /></FormField>
            <FormField :label="t('fabricHeightCm')" v-slot="{ id }"><input :id="id" v-model="stock.heightCm" inputmode="decimal" /></FormField>
          </template>
        </div>
      </section>
      <section v-if="customFields.length" class="form-section"><h3>{{ t('customFields') }}</h3><div class="form-grid"><FormField v-for="field in customFields" :key="field" :label="field" v-slot="{id}"><input :id="id" v-model="draft.properties.custom[field]" maxlength="1000" /></FormField></div><p class="field-help">{{ t('customValuesHelp') }}</p></section>
      <details>
        <summary>{{ t('advanced') }}</summary>
        <section class="form-section"><h3>{{ t('materialCategoryDetails') }}</h3><p class="muted">{{ t('materialDescriptorHelp') }}</p><MaterialDescriptors :properties="draft.properties" :category="draft.category" /></section>
        <div class="form-grid">
          <FormField :label="t('minimum')" v-slot="{ id }"><input :id="id" value="1" readonly /></FormField>
          <FormField :label="t('packageSize')" :help="t('packageSizeHelp')" v-slot="{ id, describedby }"><input :id="id" v-model="draft.packageSize" inputmode="decimal" :aria-describedby="describedby" /></FormField>
          <template v-if="draft.category === 'thread'">
            <FormField :label="t('threadType')" v-slot="{ id }"><select :id="id" v-model="draft.properties.threadType"><option value="">{{ t('unknown') }}</option><option v-for="type in ['cotton','pearl','silk','wool','rayon','polyester','metallic','variegated','ribbon','other']" :key="type" :value="type">{{ t(`thread_${type}`) }}</option></select></FormField>
            <FormField :label="t('strands')" :help="t('strandsHelp')" v-slot="{ id, describedby }"><input :id="id" v-model="draft.strands" inputmode="numeric" :aria-describedby="describedby" /></FormField>
            <FormField :label="t('divisible')" v-slot="{ id }"><input :id="id" v-model="draft.divisible" type="checkbox" /></FormField>
            <FormField :label="t('threadSize')" v-slot="{ id }"><input :id="id" v-model="draft.properties.threadSize" maxlength="100" /></FormField>
          </template>
          <template v-if="draft.category === 'fabric'">
            <FormField :label="t('fabricType')" v-slot="{ id }"><select :id="id" v-model="draft.properties.fabricType"><option value="">{{ t('unknown') }}</option><option v-for="type in ['aida','linen','evenweave','canvas','hardanger','afghan','band','soluble','garment','other']" :key="type" :value="type">{{ t(`fabric_${type}`) }}</option></select></FormField>
            <FormField :label="t('countMeaning')" v-slot="{ id }"><select :id="id" v-model="draft.properties.countMeaning"><option value="stitches">{{ t('countStitches') }}</option><option value="threads">{{ t('countThreads') }}</option></select></FormField>
            <FormField :label="t('countHorizontal')" v-slot="{ id }"><input :id="id" v-model="draft.properties.countX" inputmode="decimal" /></FormField>
            <FormField :label="t('countVertical')" v-slot="{ id }"><input :id="id" v-model="draft.properties.countY" inputmode="decimal" /></FormField>
          </template>
          <FormField :label="t('description')" wide v-slot="{id}"><textarea :id="id" v-model="draft.description" maxlength="10000" /></FormField>
          <FormField :label="t('composition')" v-slot="{ id }"><input :id="id" v-model="draft.properties.composition" maxlength="300" /></FormField>
          <FormField :label="t('tags')" :help="t('tagsHelp')" v-slot="{ id, describedby }"><input :id="id" v-model="draft.tagsText" :aria-describedby="describedby" /></FormField>
          <FormField :label="t('careInstructions')" wide v-slot="{ id }"><textarea :id="id" v-model="draft.properties.care" maxlength="5000" /></FormField>
          <FormField :label="t('notes')" wide v-slot="{ id }"><textarea :id="id" v-model="draft.notes" maxlength="20000" /></FormField>
          <FormField :label="t('favorite')" v-slot="{ id }"><input :id="id" v-model="draft.favorite" type="checkbox" /></FormField>
          <FormField :label="t('reusable')" v-slot="{ id }"><input :id="id" v-model="draft.reusable" type="checkbox" :disabled="draft.category === 'tool'" /></FormField>
          <StagedAttachments v-model="photoFiles" :disabled="busy"/>
          <template v-if="!isEdit && stock.enabled">
            <FormField :label="t('cost')" :help="t('lotCostHelp')" v-slot="{ id, describedby }"><input :id="id" v-model="stock.cost" inputmode="decimal" :aria-describedby="describedby" /></FormField>
            <FormField :label="t('currency')" v-slot="{ id }"><input :id="id" v-model="stock.currency" maxlength="3" pattern="[A-Za-z]{3}" /></FormField>
            <FormField :label="t('supplier')" v-slot="{ id }"><select :id="id" v-model="stock.supplierId"><option value="">{{ t('none') }}</option><option v-for="supplier in state.suppliers" :key="supplier.id" :value="supplier.id">{{ supplier.name }}</option></select></FormField>
            <FormField :label="t('status')" v-slot="{ id }"><select :id="id" v-model="stock.status"><option v-for="status in ['usable','blocked','damaged','unverified']" :key="status" :value="status">{{ t(status) }}</option></select></FormField>
          </template>
        </div>
        <section v-if="!isEdit && stock.enabled" class="form-section"><h3>{{ t('lotCategoryDetails') }}</h3><MaterialDescriptors :properties="stock.properties" :category="draft.category" scope="lot" /></section>
      </details>
      </template>
    </form>
    <template #footer><button type="button" class="button" :disabled="busy" @click="emit('close')">{{ t('cancel') }}</button><button class="button primary" type="submit" :form="formId" :disabled="busy||lookupBusy">{{ busy ? t('saving') : t('save') }}</button></template>
  </AppDialog>
  <AppDialog v-if="duplicate" :title="t('duplicateEntryTitle')" :busy="busy" @close="duplicate=null">
    <p class="notice warning">{{ t('duplicateEntryHelp') }}</p>
    <p v-if="duplicateError" class="notice error" role="alert">{{ duplicateError }}</p>
    <FormField v-if="duplicate.matches.length > 1" :label="t('material')" v-slot="{ id }"><select :id="id" v-model="duplicate.targetId" @change="duplicate.quantity=duplicateQuantity(duplicate.targetId)"><option v-for="match in duplicate.matches" :key="match.id" :value="match.id">{{ match.name }}</option></select></FormField>
    <p v-else><strong>{{ duplicateTarget?.name }}</strong></p>
    <FormField :label="t('duplicateQuantityLabel')" :help="t(`unit_${duplicateTarget?.unit}`)" required v-slot="{ id, describedby }"><input :id="id" v-model="duplicate.quantity" inputmode="decimal" :aria-describedby="describedby" required autofocus /></FormField>
    <p class="field-help">{{ t('duplicateQuantityHelp') }}</p>
    <template #footer><button class="button" :disabled="busy" @click="duplicate=null">{{ t('cancel') }}</button><button class="button primary" :disabled="busy" @click="confirmDuplicate">{{ busy ? t('saving') : t('duplicateConfirmQuantity') }}</button></template>
  </AppDialog>
</template>
