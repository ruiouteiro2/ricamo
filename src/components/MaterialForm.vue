<script setup>
import { reactive, ref, computed, useId, watch, onBeforeUnmount } from 'vue';
import { AlertTriangle } from '@lucide/vue';
import AppDialog from './AppDialog.vue';
import FormField from './FormField.vue';
import MaterialProductPicker from './MaterialProductPicker.vue';
import {supplierLookup} from '../supplier-catalogues.mjs';
import {supplierIdentity,supplierSwatch,SUPPLIER_CATEGORIES} from '../../core/supplier-products.mjs';
import MaterialDescriptors from './MaterialDescriptors.vue';
import { normalizeDescriptorProperties } from '../../core/material-descriptors.mjs';
import StagedAttachments from './StagedAttachments.vue';
import { state, categories, units, locate, saveEntityWithAssets } from '../state';
import { t, errorText } from '../i18n';
import { inventoryCategories, materialCustomFields } from '../inventory-categories.mjs';
import { quantity } from '../../core/shared.mjs';

const props = defineProps({ material: Object });
const emit = defineEmits(['close', 'saved']);
const formId = useId(), operationId = crypto.randomUUID(), materialId = props.material?.id || crypto.randomUUID();
const draft = reactive({ name: '', category: 'thread', brand: '', range: '', code: '', unit: 'm', color: '#8b6477', tagsText: '', notes: '', minimum: '', packageSize: '', strands: '', divisible: false, reusable: false, favorite: false, properties: {}, attachments: [], ...JSON.parse(JSON.stringify(props.material || {})) });
draft.tagsText = (props.material?.tags || []).join(', ');
const stock = reactive({ enabled: !props.material, quantity: '', confidence: 'exact', status: 'usable', locationId: '', lotCode: '', cost: '', currency: state.value.settings.currency, supplierId: '', widthCm: '', heightCm: '', properties: {} });
const busy = ref(false), error = ref(''), photoFiles = ref([]);
const isEdit = computed(() => Boolean(props.material));
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
    const properties = normalizeDescriptorProperties(JSON.parse(JSON.stringify(draft.properties)));
    properties.custom = Object.fromEntries(Object.entries(properties.custom || {}).map(([key,value]) => [key,String(value ?? '')]));
    for (const key of ['countX', 'countY']) if (key in properties) properties[key] = optionalNumber(properties[key], key);
    const payload = { ...JSON.parse(JSON.stringify(draft)), id: materialId, tags: draft.tagsText.split(',').map(tag => tag.trim()).filter(Boolean), minimum: optionalNumber(draft.minimum, 'minimum'), packageSize: optionalNumber(draft.packageSize, 'packageSize'), strands: optionalNumber(draft.strands, 'strands'), properties };
    delete payload.tagsText;
    let lot = null;
    if (!isEdit.value && stock.enabled) {
      lot = { quantity: optionalNumber(stock.quantity, 'quantity'), confidence: stock.confidence, status: stock.status, locationId: stock.locationId || null, lotCode: stock.lotCode, cost: price(stock.cost), currency: stock.currency.toUpperCase(), supplierId: stock.supplierId || null, properties: normalizeDescriptorProperties(JSON.parse(JSON.stringify(stock.properties)), 'lot') };
      if (draft.category === 'fabric') lot.properties = { ...lot.properties, widthCm: optionalNumber(stock.widthCm, 'widthCm'), heightCm: optionalNumber(stock.heightCm, 'heightCm'), irregular: false, countX: properties.countX ?? null, countY: properties.countY ?? null, countMeaning: properties.countMeaning || 'stitches' };
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
      <div class="form-grid">
        <FormField :label="t('name')" required wide v-slot="{ id }"><input :id="id" v-model="draft.name" required maxlength="300" autofocus :placeholder="t('materialNameExample')" /></FormField>
        <FormField :label="t('category')" required v-slot="{ id }"><select :id="id" v-model="draft.category" @change="chooseCategory"><option v-for="option in categoryOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></FormField>
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
          <FormField :label="t('minimum')" v-slot="{ id }"><input :id="id" v-model="draft.minimum" inputmode="decimal" /></FormField>
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
    </form>
    <template #footer><button type="button" class="button" :disabled="busy" @click="emit('close')">{{ t('cancel') }}</button><button class="button primary" type="submit" :form="formId" :disabled="busy||lookupBusy">{{ busy ? t('saving') : t('save') }}</button></template>
  </AppDialog>
</template>
