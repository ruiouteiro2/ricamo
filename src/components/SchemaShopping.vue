<script setup>
import {computed,ref} from 'vue';
import {ShoppingCart,Check} from '@lucide/vue';
import AppDialog from './AppDialog.vue';
import {state,dispatch,notify} from '../state';
import {t,number,errorText} from '../i18n';
import {schemaSupplySource,previewSchemaPurchases,schemaShoppingSelections} from '../../core/schema-shopping.mjs';
import {CHART_CATALOGUE} from '../../core/chart-collection.mjs';
const props=defineProps({kind:{type:String,required:true},id:{type:String,required:true}});
const open=ref(false),busy=ref(false),error=ref(''),corrections=ref([]),saved=ref(false);
const selection=computed(()=>({kind:props.kind,id:props.id,corrections:corrections.value}));
const name=computed(()=>props.kind==='chart'?CHART_CATALOGUE.items.find(row=>row.id===props.id)?.name:state.value.patterns.find(row=>row.id===props.id)?.name);
const source=computed(()=>schemaSupplySource(state.value,selection.value));
const selected=computed(()=>schemaShoppingSelections(state.value).some(row=>row.kind===props.kind&&row.id===props.id));
const preview=computed(()=>{try{return previewSchemaPurchases(state.value,selection.value);}catch{return null;}});
function show(){error.value='';saved.value=false;const prior=schemaShoppingSelections(state.value).find(row=>row.kind===props.kind&&row.id===props.id);corrections.value=structuredClone(prior?.corrections??[]);open.value=true;}
function value(row,index,key){const corrected=corrections.value.find(row=>row.index===index);return (corrected?corrected[key]:row[key])??'';}
async function select(){busy.value=true;error.value='';try{await dispatch('schema.purchaseMissing',JSON.parse(JSON.stringify(selection.value)));saved.value=true;notify();}catch(caught){error.value=errorText(caught);}finally{busy.value=false;}}
async function unselect(){busy.value=true;error.value='';try{await dispatch('schema.unselectShopping',{kind:props.kind,id:props.id});saved.value=false;notify();}catch(caught){error.value=errorText(caught);}finally{busy.value=false;}}
const display=value=>value===null||value===undefined||value===''?t('schemaCheck'):number(value);
</script>
<template>
<button class="button small" :aria-label="`${t('schemaShopping')}: ${name}`" @click="show"><ShoppingCart :size="16"/>{{t('schemaShopping')}}<Check v-if="selected" :size="14"/></button>
<AppDialog v-if="open" :title="`${t('schemaShopping')}: ${name}`" wide :busy="busy" @close="open=false">
 <p class="field-help">{{t('schemaShoppingHelp')}}</p><p v-if="source.estimated" class="notice">{{t('schemaEstimatedHelp')}}</p><p v-if="kind==='chart'" class="field-help">{{t('schemaSourceHelp')}}</p>
 <p v-if="error" class="notice error" role="alert">{{error}}</p><p v-if="saved" class="notice" role="status">{{t('schemaSelected')}}</p>
 <p v-if="!source.requirements.length" class="notice">{{t(kind==='chart'?'schemaChartSuppliesMissing':'schemaSuppliesMissing')}}</p>
 <template v-else>
  <details class="form-section" :open="source.requirements.some(row=>!row.unit||row.quantity===null)"><summary>{{t('schemaEditRequirements')}}</summary><div class="table-wrap"><table><thead><tr><th>{{t('material')}}</th><th>{{t('procurementRequired')}}</th><th>{{t('unit')}}</th></tr></thead><tbody><tr v-for="(row,index) in source.requirements" :key="index"><td>{{row.name}}</td><td>{{display(value(row,index,'quantity'))}}</td><td>{{value(row,index,'unit')?t(`unit_${value(row,index,'unit')}`):t('schemaCheck')}}</td></tr></tbody></table></div></details>
  <section v-if="preview" class="form-section"><h3>{{t('schemaCombined')}}</h3><div class="table-wrap"><table><thead><tr><th>{{t('material')}}</th><th>{{t('procurementRequired')}}</th><th>{{t('procurementAvailable')}}</th><th>{{t('to_buy')}}</th></tr></thead><tbody><tr v-for="row in preview.rows" :key="row.key"><td>{{row.name}}<span class="cell-subtitle">{{t(`unit_${row.unit}`)}}</span></td><td>{{display(row.required)}}</td><td>{{display(row.available)}}</td><td><strong>{{row.suppressed?t('restockExcluded'):display(row.toBuy)}}</strong></td></tr></tbody></table></div><p v-for="(issue,index) in preview.issues" :key="index" class="field-help">{{issue.name}}: {{t(issue.reason)}}</p></section>
  <p class="field-help">{{t('schemaCheckHelp')}}</p><p v-if="selected" class="field-help">{{t('schemaUnselectHelp')}}</p>
 </template>
 <template #footer><button v-if="selected" class="button" :disabled="busy" @click="unselect">{{t('schemaUnselect')}}</button><button class="button" :disabled="busy" @click="open=false">{{t('close')}}</button><button class="button primary" :disabled="busy||!source.requirements.length||!preview" @click="select">{{t('schemaShoppingSelect')}}</button></template>
</AppDialog>
</template>
