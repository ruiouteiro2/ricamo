<script setup>
import { reactive, ref, computed, useId, watch, onBeforeUnmount } from 'vue';
import AppDialog from './AppDialog.vue';
import FormField from './FormField.vue';
import { catalogueCodeQuery, exactCatalogueMatch } from '../material-catalogue-match.mjs';
import { productPreview, productPreviewStyle, sameColourSwatch } from '../product-previews.mjs';
import CatalogueAutoPreview from './CatalogueAutoPreview.vue';
import ThreadReferenceLink from './ThreadReferenceLink.vue';
import {supplierLookup, supplierSearch, supplierFacets} from '../supplier-catalogues.mjs';
import {supplierIdentity,supplierSwatch,SUPPLIER_CATEGORIES} from '../../core/supplier-products.mjs';
import { normalizeDescriptorProperties } from '../../core/material-descriptors.mjs';
import { state, units, saveEntityWithAssets, dispatch } from '../state';
import { t, errorText } from '../i18n';
import { INVENTORY_GROUPS, customInventoryGroups, inventoryGroup, accessorySection, threadReferenceFor, threadRangeMatchesSize } from '../inventory-navigation.mjs';
import { duplicateMaterials } from '../../core/material-duplicates.mjs';
import { convertQuantity } from '../../core/fabric.mjs';
import { openPurchaseLink } from '../purchase-link.mjs';
import { quantity } from '../../core/shared.mjs';
import {threadCountUnit} from '../../core/thread-count-unit.mjs';
import { materialEditSnapshot } from '../../core/material-edit.mjs';

const spoolOnlyBrand = brand => ['madeira', 'p&g'].includes(String(brand || '').trim().toLowerCase());
const props = defineProps({ material: Object, defaults:{type:Object,default:()=>({})}, context: { type: Object, default: () => ({}) } });
const emit = defineEmits(['close', 'saved', 'bulk']);
const original = props.material ? JSON.parse(JSON.stringify(props.material)) : null;
const originalInventory = original ? materialEditSnapshot(state.value, original.id) : null;
const previewProduct = ref(null), explicitCatalogue = ref(false);
const formId = useId(), operationId = crypto.randomUUID(), materialId = props.material?.id || crypto.randomUUID();
const draft = reactive({ name: '', category: 'thread', brand: '', range: '', code: '', unit: 'skein', color: '#8b6477', tagsText: '', notes: '', minimum: 1, packageSize: '', strands: '', divisible: false, reusable: false, favorite: false, properties: {}, attachments: [], ...JSON.parse(JSON.stringify(props.material || {})) });
draft.tagsText = (props.material?.tags || []).join(', ');
const stock = reactive({ enabled: !props.material, quantity: '', confidence: 'exact', status: 'usable', locationId: '', lotCode: '', cost: '', currency: state.value.settings.currency, supplierId: '', widthCm: '', heightCm: '', properties: {} });
const busy = ref(false), error = ref(''), photoFiles = ref([]);
const isEdit = computed(() => Boolean(props.material));
const groupId = ref(props.context.groupId || props.defaults.groupId || inventoryGroup(draft));
const inventoryGroups = computed(() => [...INVENTORY_GROUPS, ...customInventoryGroups(state.value.categories)]);
const activeGroup = computed(() => inventoryGroups.value.find(group => group.id === groupId.value));
const accessoryId = ref(props.context.section || props.defaults.section || (original ? accessorySection(draft) : 'needles'));
if (!props.material) {
  draft.category = activeGroup.value.category;
  draft.brand = props.context.brand || props.defaults.brand || (activeGroup.value.children.length === 1 ? activeGroup.value.children[0].brand : '');
  draft.unit = draft.category === 'thread' ? threadCountUnit({brand:draft.brand}) : 'piece';
}
const brandLabel = brand => activeGroup.value.children.find(child => child.brand === brand)?.label || brand;
const brandOptions = computed(() => groupId.value === 'accessories' ? catalogueFacets.value.brands : activeGroup.value.children.map(child => child.brand).filter(Boolean));
watch(groupId, () => {
  draft.category = activeGroup.value.category;
  draft.brand = activeGroup.value.children.length === 1 ? activeGroup.value.children[0].brand : '';
  draft.range = ''; draft.code = ''; draft.name = ''; draft.color = ''; draft.properties = { custom: {} };
  draft.unit = draft.category === 'thread' ? threadCountUnit({brand:draft.brand}) : 'piece';
});
watch(accessoryId, () => {
  if (groupId.value !== 'accessories' || !draft.properties.product) return;
  delete draft.properties.product;
  draft.name = ''; draft.range = ''; draft.code = ''; draft.color = ''; draft.unit = 'piece';
});
const lookupBusy=ref(false);let lookupTimer,lookupToken=0;
const catalogueCategory=computed(()=>SUPPLIER_CATEGORIES.includes(draft.category));
const colourCategory=computed(()=>['thread','fabric','embellishment'].includes(draft.category));
draft.properties.custom ||= {};
const duplicate = ref(null), duplicateError = ref('');
const duplicateTarget = computed(() => state.value.materials.find(material => material.id === duplicate.value?.targetId));
const duplicateCountUnit=computed(()=>duplicateTarget.value?.category==='thread'?threadCountUnit(duplicateTarget.value):duplicateTarget.value?.unit);
function duplicateQuantity(targetId) {
  const target = state.value.materials.find(material => material.id === targetId);
  if(target.category==='thread'&&target.unit==='m')return duplicate.value.lot.quantity;
  return convertQuantity(duplicate.value.lot.quantity, duplicate.value.material.unit, target.unit, target) ?? '';
}
async function confirmDuplicate() {
  if (busy.value) return;
  busy.value = true; duplicateError.value = '';
  try {
    const amount = quantity(duplicateQuantity(duplicate.value.targetId), { positive: true });
    const target = duplicateTarget.value;
    await dispatch('material.addDuplicateStock', { materialId: target.id, material: duplicate.value.material, unit: duplicateCountUnit.value, threadCountUnit: target.category==='thread', lot: { ...duplicate.value.lot, quantity: amount } }, operationId);
    duplicate.value = null; emit('saved', target.id);
  } catch (caught) { duplicateError.value = errorText(caught); }
  finally { busy.value = false; }
}
const threadFamilies = computed(() => spoolOnlyBrand(draft.brand) ? ['spool'] : ['mouline', 'special', 'silk', 'wool', 'spool', 'pearl', ...(draft.brand.trim().toLowerCase() === 'dmc' ? ['diamant'] : []), ...(['dmc', 'anchor'].includes(draft.brand.trim().toLowerCase()) ? ['alsace'] : []), ...(draft.brand.trim().toLowerCase() === 'dmc' ? ['mat'] : [])]);
const savedFamily = original && draft.range ? familyOf(draft) : props.defaults.threadFamily || draft.properties.threadFamily || 'mouline';
const threadFamily = ref(threadFamilies.value.includes(savedFamily) ? savedFamily : threadFamilies.value[0]);
const threadReference = computed(() => {
  const child = activeGroup.value.children.find(item => item.brand === draft.brand);
  return threadReferenceFor(child, threadFamily.value, draft.properties.threadSize);
});
const isDmcPerle = computed(() => draft.category === 'thread' && draft.brand.trim().toLowerCase() === 'dmc' && threadFamily.value === 'pearl');
if (!props.material && props.defaults.threadFormat && isDmcPerle.value) draft.properties.threadFormat = props.defaults.threadFormat;
const threadFormat = computed({ get: () => draft.properties.threadFormat || draft.unit, set: value => { draft.properties.threadFormat = value; draft.unit = value; } });
watch(isDmcPerle, value => { if (!value) delete draft.properties.threadFormat; });
// A catalogue article keeps its own length only in its own format: another format's length would skew estimates.
function applyThreadFormat(properties) {
  if (!isDmcPerle.value) { delete properties.threadFormat; return; }
  properties.threadFormat = draft.unit;
  const pack = properties.product?.pack;
  if (pack && pack.unit !== draft.unit) properties.product = { ...properties.product, pack: { ...pack, unit: draft.unit, lengthM: null } };
}
const threadFormatName = properties => properties.threadFormat ? t(`threadFormat_${properties.threadFormat}`) : '';
if(draft.category==='thread')draft.unit=threadCountUnit({brand:draft.brand,family:threadFamily.value,properties:draft.properties});
const usageStatus = ref(originalInventory?.usageStatus || 'new');
if (originalInventory) stock.quantity = originalInventory.quantity ?? '';
const displayProduct = computed(() => previewProduct.value || draft.properties.product);
watch(displayProduct,product=>{if(draft.category==='thread')draft.unit=threadCountUnit({brand:draft.brand,family:threadFamily.value,properties:draft.properties,product});});
const quantityHelp = computed(() => `${t(`unit_${draft.unit}`)}. ${originalInventory?.quantity !== null && isEdit.value ? t('materialEditQuantityHelp') : t('unknownHint')}`);

function familyOf(product) {
  if (spoolOnlyBrand(product.brand ?? draft.brand)) return 'spool';
  const range = String(product.range || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  if (String(product.brand ?? draft.brand).trim().toLowerCase() === 'dmc' && range === 'diamant') return 'diamant';
  if (String(product.brand ?? draft.brand).trim().toLowerCase() === 'dmc' && /retors mat/.test(range)) return 'mat';
  if (/alsac|fiorentin/.test(range)) return 'alsace';
  if (/silk|seta|soie|waterlil/.test(range)) return 'silk';
  if (/wool|lana|laine/.test(range)) return 'wool';
  if (/perl|pearl/.test(range)) return 'pearl';
  if (/spool|rocchett|rocca|spoletta|bobina|bobbin|cucit/.test(range)) return 'spool';
  if (/^(6 )?(mouline|stranded cotton)( special( 25)?)?$/.test(range)) return 'mouline';
  return 'special';
}
function familyLabel(family) {
  return t(`entryFamily_${family === 'alsace' && draft.brand.trim().toLowerCase() === 'anchor' ? 'florentine' : family}`);
}
watch(() => [threadFamily.value, draft.brand], ([value]) => {
  if (draft.category !== 'thread') return;
  draft.unit=threadCountUnit({brand:draft.brand,family:value,properties:draft.properties,product:displayProduct.value&&familyOf(displayProduct.value)===value?displayProduct.value:undefined});
  if (!threadFamilies.value.includes(value)) { threadFamily.value = threadFamilies.value[0]; return; }
  draft.properties.threadFamily = value;
  if (draft.properties.product && draft.properties.product.brand === draft.brand && familyOf(draft.properties.product) === value) return;
  draft.range = familyLabel(value);
});
watch(() => draft.properties.threadSize, value => {
  if (draft.category !== 'thread' || !draft.properties.product || threadRangeMatchesSize(draft.properties.product.range, threadFamily.value, value)) return;
  delete draft.properties.product;
  previewProduct.value = null;
  explicitCatalogue.value = false;
  draft.range = familyLabel(threadFamily.value);
  draft.color = '';
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
const catalogueBusy = ref(false), catalogueError = ref(''), catalogueAmbiguous = ref(false);
const matchingBusy = computed(() => draft.category === 'thread' && catalogueBusy.value);
let catalogueTimer, catalogueToken = 0;
const sameColour = computed(() => {
  // The menu may list longer codes that merely contain this one (4145 for 414), which are not this colour.
  if (draft.brand !== 'DMC' || displayProduct.value || catalogueBusy.value || catalogueAmbiguous.value) return null;
  const swatch = sameColourSwatch({ family: threadFamily.value, size: draft.properties.threadSize, code: draft.code });
  return swatch && { ...swatch, otherLine: swatch.line !== threadFamily.value, lineLabel: familyLabel(swatch.line) };
});
const catalogueOptions = computed(() => {
  const selected = displayProduct.value;
  return selected && !catalogueItems.value.some(item => item.id === selected.id)
    ? [selected, ...catalogueItems.value] : catalogueItems.value;
});
watch(() => [draft.category, draft.brand, threadFamily.value, draft.properties.threadSize, accessoryId.value, draft.code], () => {
  previewProduct.value = null;
  clearTimeout(catalogueTimer);
  const token = ++catalogueToken;
  catalogueBusy.value = true;
  catalogueError.value = ''; catalogueAmbiguous.value = false;
  catalogueTimer = setTimeout(async () => {
    try {
      const facets = await supplierFacets({ category: draft.category, brand: draft.brand });
      const context = { brand: draft.brand, family: threadFamily.value, code: draft.code };
      const query = catalogueCodeQuery(context);
      let products;
      if (draft.category === 'thread') {
        const ranges = facets.ranges.filter(range => familyOf({ range }) === threadFamily.value && threadRangeMatchesSize(range, threadFamily.value, draft.properties.threadSize));
        const results = await Promise.all(ranges.map(async range => {
          const args = { category: 'thread', brand: draft.brand, range, query, limit: 100, ...(draft.brand === 'DMC' && threadFamily.value === 'diamant' ? { supplier: 'dmc' } : {}) };
          const [result, exact] = await Promise.all([
            supplierSearch(args),
            query ? supplierLookup({ category: 'thread', brand: args.brand, range, code: query }) : Promise.resolve([]),
          ]);
          const exactOffers = exact.filter(product => !args.supplier || product.supplier === args.supplier);
          result.items = [...new Map([...exactOffers, ...result.items].map(product => [product.id, product])).values()];
          if (draft.brand === 'Madeira') for (let offset = 100; offset < Math.min(result.total, 300); offset += 100) result.items.push(...(await supplierSearch({ ...args, offset })).items);
          return result;
        }));
        products = results.flatMap(result => result.items).filter(product => familyOf(product) === threadFamily.value);
      } else {
        const result = await supplierSearch({ category: draft.category, brand: draft.brand, query: draft.code, limit: 100 });
        products = result.items.filter(product => draft.category !== 'tool' || accessorySection(product) === accessoryId.value);
      }
      if (token !== catalogueToken) return;
      catalogueItems.value = products.slice(0, draft.brand === 'Madeira' ? 300 : 100);
      catalogueFacets.value = facets;
      if (draft.category === 'thread') {
        const match = exactCatalogueMatch(products, context);
        catalogueAmbiguous.value = match.ambiguous;
        if (match.product) {
          if (isEdit.value) { previewProduct.value = match.product; draft.range = match.product.range; draft.code = match.product.code; draft.color = match.product.hex || (supplierIdentity(match.product) === supplierIdentity(original) ? original.color || '' : ''); }
          else if (draft.properties.product?.id !== match.product.id) chooseProduct(match.product, { automatic: true });
        }
        if (!match.product && !match.ambiguous && query) {
          const swatch = supplierSwatch({ brand: context.brand, range: draft.range || familyLabel(threadFamily.value), code: query });
          if (swatch.hex) { draft.color = swatch.hex; draft.properties.colorSource = swatch.rgbSource; }
        }
      }
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
  explicitCatalogue.value = true;
  if (product.category === 'thread') {
    threadFamily.value = familyOf(product);
    draft.properties.threadFamily = threadFamily.value;
  }
  draft.category = product.category;
  if (isEdit.value) { previewProduct.value = product; draft.brand = product.brand; draft.range = product.range; draft.code = product.code; } else chooseProduct(product);
}
function chooseProduct(product, { automatic = false } = {}){
  delete draft.properties.colorSource;
  Object.assign(draft,{name:product.name,brand:product.brand,range:product.range,code:product.code,color:product.hex??''});
  draft.properties.product=JSON.parse(JSON.stringify(product));
  if(!isEdit.value){
    draft.unit=product.category==='thread'?threadCountUnit({brand:product.brand,family:familyOf(product),properties:draft.properties,product}):units.includes(product.pack.unit)?product.pack.unit:'piece';
    if(spoolOnlyBrand(product.brand))draft.unit='spool';
    if(product.brand==='Madeira'){draft.properties.threadSize=product.range.match(/(\d+)$/)?.[1]||'';}
    draft.packageSize=draft.unit==='m'?product.pack.lengthM??'':'';
  }
  draft.strands=product.pack.strands??'';draft.divisible=product.pack.divisible===true;
  if(product.fabric)Object.assign(draft.properties,product.fabric,{fabricType:product.type});
  if(['cotton','pearl','silk','wool','rayon','polyester','metallic','variegated','ribbon','other'].includes(product.type))draft.properties.threadType=product.type;
}
watch(()=>[draft.category,draft.brand,draft.range,draft.code],()=>{
  clearTimeout(lookupTimer);const token=++lookupToken;lookupBusy.value=false;
  const snapshot=draft.properties.product;
  if(snapshot&&snapshot.category===draft.category&&supplierIdentity(snapshot)===supplierIdentity(draft)){delete draft.properties.colorSource;draft.color=snapshot.hex??'';return;}
  if(snapshot){delete draft.properties.product;draft.strands='';draft.divisible=false;draft.packageSize='';}
  delete draft.properties.colorSource;
  if(!catalogueCategory.value)return;
  if (isEdit.value && draft.category === 'thread' && supplierIdentity(draft) === supplierIdentity(original)) { draft.color = original.color || ''; return; }
  draft.color='';
  if (draft.category === 'thread') return;
  if(!draft.brand||!draft.range||!draft.code)return;
  lookupBusy.value=true;
  lookupTimer=setTimeout(async()=>{try{const rows=await supplierLookup({category:draft.category,brand:draft.brand,range:draft.range,code:draft.code});if(token!==lookupToken)return;const product=(draft.brand==='DMC'&&threadFamily.value==='diamant'?rows.find(row=>row.supplier==='dmc'):null)??rows.find(row=>row.hex)??rows[0];if(product){draft.properties.product=product;draft.color=product.hex??'';draft.strands=product.pack.strands??'';draft.divisible=product.pack.divisible===true;if(draft.unit==='m')draft.packageSize=product.pack.lengthM??'';}else{const swatch=supplierSwatch({brand:draft.brand,range:draft.range,code:draft.code});if(swatch.hex){draft.color=swatch.hex;draft.properties.colorSource=swatch.rgbSource;}}}catch(caught){if(token===lookupToken)error.value=errorText(caught);}finally{if(token===lookupToken)lookupBusy.value=false;}},250);
},{immediate:true});
onBeforeUnmount(()=>{clearTimeout(lookupTimer);lookupToken++;});
function optionalNumber(value, field) { return quantity(value, { nullable: true, field }); }
function price(value) {
  if (value === '' || value === null) return null;
  const number = quantity(value, { field: 'cost' });
  if (Math.abs(number * 100 - Math.round(number * 100)) > 0.000001) throw Object.assign(new Error(), { code: 'invalid_number' });
  return Math.round(number * 100);
}
async function openMadeiraCatalogue() { try { await openPurchaseLink('https://www.madeira.com/it-it/materiali-da-ricamo/filati-industriali/metallizzati'); } catch (caught) { error.value = errorText(caught); } }
function openBulkEntry() {
  emit('bulk', { brand: draft.brand, range: draft.category === 'thread' ? familyLabel(threadFamily.value) : draft.range, category: draft.category, unit: draft.unit });
}
async function save() {
  if (busy.value||lookupBusy.value||matchingBusy.value) return;
  busy.value = true; error.value = '';
  try {
    if (isEdit.value) {
      const properties = JSON.parse(JSON.stringify(original.properties));
      if (draft.properties.threadSize !== undefined) properties.threadSize = draft.properties.threadSize;
      if (draft.category === 'thread') properties.threadFamily = threadFamily.value;
      if (groupId.value === 'accessories') properties.inventorySection = accessoryId.value;
      const candidate = { ...original, brand: draft.brand, range: draft.brand.trim().toLowerCase() === 'p&g' && !displayProduct.value ? familyLabel('spool') : draft.range || (draft.category === 'thread' ? familyLabel(threadFamily.value) : ''), code: draft.code, minimum: 1, unit: draft.category==='thread'?draft.unit:original.unit, packageSize:draft.category==='thread'?null:original.packageSize, properties };
      const identityChanged = supplierIdentity(candidate) !== supplierIdentity(original);
      const selected = displayProduct.value;
      if (identityChanged || explicitCatalogue.value) {
        delete candidate.properties.product; delete candidate.properties.colorSource;
        candidate.color = draft.color || ''; candidate.packageSize = null; candidate.strands = null; candidate.divisible = false;
        if (selected && supplierIdentity(selected) === supplierIdentity(candidate)) {
          candidate.properties.product = JSON.parse(JSON.stringify(selected)); candidate.color = selected.hex || '';
          candidate.strands = selected.pack.strands; candidate.divisible = selected.pack.divisible === true;
          candidate.packageSize = candidate.unit === 'm' ? selected.pack.lengthM : null;
          if (['cotton','pearl','silk','wool','rayon','polyester','metallic','variegated','ribbon','other'].includes(selected.type)) candidate.properties.threadType = selected.type;
          if (selected.fabric) Object.assign(candidate.properties, selected.fabric, { fabricType: selected.type });
        }
      }
      applyThreadFormat(candidate.properties);
      const sizeChanged = String(properties.threadSize || '') !== String(original.properties.threadSize || '') || candidate.unit !== original.unit;
      candidate.name = draft.category === 'thread' ? (identityChanged || sizeChanged ? [candidate.brand, candidate.range, candidate.code, properties.threadSize, threadFormatName(candidate.properties)].filter(value => String(value ?? '').trim()).join(' \u00b7 ') : original.name) : draft.name;
      await dispatch('material.saveInventory', { material: candidate, quantity: optionalNumber(stock.quantity, 'quantity'), usageStatus: usageStatus.value, threadCountUnit: draft.category==='thread', expected: originalInventory.fingerprint }, operationId);
      emit('saved', candidate.id); return;
    }
    if (!isEdit.value) {
      if (draft.category === 'thread') {
        draft.properties.threadFamily = threadFamily.value;
        draft.properties.quantityBasis = 'package-count';
        applyThreadFormat(draft.properties);
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
    const payload = { ...JSON.parse(JSON.stringify(draft)), name: isEdit.value || draft.category !== 'thread' ? draft.name : [draft.brand, draft.range, draft.code, draft.properties.threadSize, threadFormatName(draft.properties)].filter(value => String(value ?? '').trim()).join(' · '), id: materialId, tags: draft.tagsText.split(',').map(tag => tag.trim()).filter(Boolean), minimum: 1, packageSize: optionalNumber(draft.packageSize, 'packageSize'), strands: optionalNumber(draft.strands, 'strands'), properties };
    delete payload.tagsText;
    let lot = null;
    if (!isEdit.value && stock.enabled) {
      lot = { quantity: optionalNumber(stock.quantity, 'quantity'), confidence: stock.confidence, status: stock.status, locationId: stock.locationId || null, lotCode: stock.lotCode, cost: price(stock.cost), currency: stock.currency.toUpperCase(), supplierId: stock.supplierId || null, properties: normalizeDescriptorProperties(JSON.parse(JSON.stringify(stock.properties)), 'lot') };
      if (draft.category === 'fabric') lot.properties = { ...lot.properties, widthCm: optionalNumber(stock.widthCm, 'widthCm'), heightCm: optionalNumber(stock.heightCm, 'heightCm'), irregular: false, countX: properties.countX ?? null, countY: properties.countY ?? null, countMeaning: properties.countMeaning || 'stitches' };
    }
    if (!isEdit.value) {
      const matches = duplicateMaterials(state.value, payload);
      if (matches.length) {
        duplicate.value = { material: payload, lot, matches: matches.map(material => ({ id: material.id, name: material.name })), targetId: matches[0].id };
        duplicateError.value = ''; return;
      }
    }
    await saveEntityWithAssets('material.createWithLot', { material: payload, lot }, photoFiles.value, operationId);
    emit('saved', payload.id);
  } catch (caught) { error.value = errorText(caught); }
  finally { busy.value = false; }
}
</script>

<template>
  <AppDialog :title="t(isEdit ? 'editMaterial' : 'addMaterial')" wide :busy="busy" @close="emit('close')">
    <p v-if="error" class="notice error" role="alert">{{ error }}</p>
    <form :id="formId" @submit.prevent="save">
        <div class="form-grid">
          <FormField v-if="!isEdit && !context.groupId" :label="t('category')" required v-slot="{ id }"><select :id="id" v-model="groupId"><option v-for="group in inventoryGroups" :key="group.id" :value="group.id">{{ group.label || t(group.labelKey) }}</option></select></FormField>
          <FormField v-if="draft.category !== 'thread'" :label="t('name')" required wide v-slot="{ id }"><input :id="id" v-model="draft.name" autofocus required maxlength="300" /></FormField>
          <FormField :label="t('brand')" :required="groupId !== 'accessories' && !activeGroup.custom" v-slot="{ id }"><output v-if="context.brand" :id="id" class="notice">{{ brandLabel(draft.brand) }}</output><input v-else-if="activeGroup.custom" :id="id" v-model="draft.brand" maxlength="200" /><select v-else :id="id" v-model="draft.brand" :required="groupId !== 'accessories'"><option value="">{{ t('allBrands') }}</option><option v-if="draft.brand && !brandOptions.includes(draft.brand)" :value="draft.brand">{{ draft.brand }}</option><option v-for="brand in brandOptions" :key="brand" :value="brand">{{ brandLabel(brand) }}</option></select></FormField>
          <FormField v-if="draft.category === 'thread'" :label="t('addMaterialType')" required v-slot="{ id }"><select :id="id" v-model="threadFamily" required><option v-for="family in threadFamilies" :key="family" :value="family">{{ familyLabel(family) }}</option></select></FormField>
          <FormField v-else-if="groupId === 'accessories'" :label="t('addMaterialType')" v-slot="{ id }"><output v-if="context.section" :id="id" class="notice">{{ t(activeGroup.children.find(child => child.id === accessoryId).labelKey) }}</output><select v-else :id="id" v-model="accessoryId"><option v-for="child in activeGroup.children" :key="child.id" :value="child.id">{{ t(child.labelKey) }}</option></select></FormField>
          <FormField v-else :label="t('addMaterialType')" v-slot="{ id }"><input :id="id" v-model="draft.range" maxlength="200" /></FormField>
          <FormField :label="t(draft.category === 'tool' ? 'materialArticleCode' : 'addMaterialColorCode')" v-slot="{ id }"><input :id="id" v-model="draft.code" :autofocus="draft.category==='thread'" maxlength="200" /></FormField>
          <FormField v-if="draft.category === 'thread'" :label="t('addMaterialThickness')" v-slot="{ id }"><input :id="id" v-model="draft.properties.threadSize" maxlength="100" /></FormField>
          <FormField v-if="isDmcPerle" :label="t('threadFormat')" v-slot="{ id }"><select :id="id" v-model="threadFormat"><option v-for="format in ['skein','ball']" :key="format" :value="format">{{ t(`threadFormat_${format}`) }}</option></select></FormField>
          <FormField v-if="!activeGroup.custom" :label="t('addMaterialCatalogue')" :help="t('addMaterialCatalogueHelp')" wide v-slot="{ id, describedby }"><CatalogueAutoPreview :product="displayProduct" :color="draft.color" :code="draft.code" :busy="catalogueBusy" :ambiguous="catalogueAmbiguous" :error="catalogueError" :options-count="catalogueOptions.length" :same-colour="sameColour" /><select :id="id" class="catalogue-select" :value="displayProduct?.id || ''" :disabled="catalogueBusy" :aria-describedby="describedby" @change="selectCatalogue"><button type="button"><selectedcontent /></button><option :key="catalogueBusy ? 'busy' : 'idle'" value="">{{ catalogueBusy ? t('loading') : t('addMaterialCataloguePlaceholder') }}</option><option v-for="product in catalogueOptions" :key="product.id" :value="product.id"><span class="catalogue-swatch" :class="{ 'catalogue-swatch-unknown': !product.hex && !productPreview(product) }" :style="{ backgroundColor: product.hex || undefined, ...productPreviewStyle(product) }" aria-hidden="true"></span><span>{{ [product.brand, product.range, product.code, product.colorName || (product.supplier === 'dmc' && product.range === 'Diamant' ? '' : product.name)].filter(Boolean).join(' · ') }}<small v-if="!product.hex && !productPreview(product)"> — {{ t('materialColorUnavailable') }}</small></span></option></select></FormField>
          <FormField :label="t('addMaterialOwnedQuantity')" :help="quantityHelp" v-slot="{ id, describedby }"><input :id="id" v-model="stock.quantity" inputmode="decimal" :aria-describedby="describedby" /></FormField>
          <FormField :label="t('minimum')" :help="`${draft.category==='thread'?t(`unit_${draft.unit}`)+'. ':''}${t('minimumStockHelp')}`" v-slot="{ id, describedby }"><input :id="id" value="1" readonly :aria-describedby="describedby" /></FormField>
          <FormField :label="t('status')" v-slot="{ id }"><select :id="id" v-model="usageStatus"><option v-for="status in ['new','partial','nearly_finished','finished']" :key="status" :value="status">{{ t(`entryStatus_${status}`) }}</option></select></FormField>
        </div>
        <p v-if="draft.brand === 'Madeira'" class="field-help">{{ t('madeiraCatalogueHelp') }} <button type="button" class="button text small" @click="openMadeiraCatalogue">{{ t('madeiraOfficialCatalogue') }}</button></p>
        <ThreadReferenceLink :reference="threadReference" />
        <p v-if="catalogueError" class="notice error" role="alert">{{ catalogueError }}</p>
    </form>
    <template #footer><button v-if="!isEdit" type="button" class="button" :disabled="busy" @click="openBulkEntry">{{ t('addMultipleMaterials') }}</button><span class="dialog-footer-spacer"></span><button type="button" class="button" :disabled="busy" @click="emit('close')">{{ t('cancel') }}</button><button class="button primary" type="submit" :form="formId" :disabled="busy||lookupBusy||matchingBusy">{{ busy ? t('saving') : t('save') }}</button></template>
  </AppDialog>
  <AppDialog v-if="duplicate" :title="t('duplicateEntryTitle')" :busy="busy" @close="duplicate=null">
    <p class="notice warning">{{ t('duplicateEntryHelp') }}</p>
    <p v-if="duplicateError" class="notice error" role="alert">{{ duplicateError }}</p>
    <FormField v-if="duplicate.matches.length > 1" :label="t('material')" v-slot="{ id }"><select :id="id" v-model="duplicate.targetId" autofocus><option v-for="match in duplicate.matches" :key="match.id" :value="match.id">{{ match.name }}</option></select></FormField>
    <p v-else><strong>{{ duplicateTarget?.name }}</strong></p>
    <p class="duplicate-quantity-summary"><span>{{ t('duplicateQuantityLabel') }}</span><strong>{{ duplicateQuantity(duplicate.targetId) }} {{ t(`unit_${duplicateCountUnit}`) }}</strong></p>
    <p class="field-help">{{ t('duplicateQuantityHelp') }}</p>
    <template #footer><button class="button" :disabled="busy" @click="duplicate=null">{{ t('cancel') }}</button><button class="button primary" :disabled="busy" @click="confirmDuplicate">{{ busy ? t('saving') : t('duplicateConfirmQuantity') }}</button></template>
  </AppDialog>
</template>
