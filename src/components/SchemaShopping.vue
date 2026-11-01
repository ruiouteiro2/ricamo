<script setup>
import {computed,ref} from 'vue';
import {ShoppingCart} from '@lucide/vue';
import AppDialog from './AppDialog.vue';
import {state,dispatch,notify} from '../state';
import {t,number,errorText} from '../i18n';
import {schemaSupplySource,previewSchemaPurchases,schemaShoppingSelections} from '../../core/schema-shopping.mjs';
import {UNITS} from '../../core/inventory.mjs';
const props=defineProps({kind:{type:String,required:true},id:{type:String,required:true}});
const open=ref(false),busy=ref(false),error=ref(''),corrections=ref([]),saved=ref(false);
const selection=computed(()=>({kind:props.kind,id:props.id,corrections:corrections.value}));
const source=computed(()=>schemaSupplySource(state.value,selection.value));
const selected=computed(()=>schemaShoppingSelections(state.value).some(row=>row.kind===props.kind&&row.id===props.id));
const preview=computed(()=>{try{return previewSchemaPurchases(state.value,selection.value);}catch{return null;}});
function show(){error.value='';saved.value=false;const prior=schemaShoppingSelections(state.value).find(row=>row.kind===props.kind&&row.id===props.id);corrections.value=structuredClone(prior?.corrections??[]);open.value=true;}
function value(row,index,key){return corrections.value.find(row=>row.index===index)?.[key]??row[key]??'';}
function change(row,index,key,input){let entry=corrections.value.find(row=>row.index===index);if(!entry){entry={index,quantity:row.quantity??null,unit:row.unit??null};corrections.value.push(entry);}entry[key]=input===''?null:key==='quantity'?Number(input):input;saved.value=false;}
async function select(){busy.value=true;error.value='';try{await dispatch('schema.purchaseMissing',JSON.parse(JSON.stringify(selection.value)));saved.value=true;notify();}catch(caught){error.value=errorText(caught);}finally{busy.value=false;}}
const display=value=>value===null||value===undefined?t('schemaCheck'):number(value);
</script>
<template>
<button class="button small" :aria-label="`${t('schemaShopping')}: ${source.name}`" @click="show"><ShoppingCart :size="16"/>{{t('schemaShopping')}}<span v-if="selected"> ?</span></button>
<AppDialog v-if="open" :title="`${t('schemaShopping')}: ${source.name}`" wide :busy="busy" @close="open=false">
 <p class="field-help">{{t('schemaShoppingHelp')}}</p><p v-if="kind==='chart'" class="field-help">{{t('schemaSourceHelp')}}</p>
 <p v-if="error" class="notice error" role="alert">{{error}}</p><p v-if="saved" class="notice" role="status">{{t('schemaSelected')}}</p>
 <p v-if="!source.requirements.length" class="notice">{{t('schemaSuppliesMissing')}}</p>
 <template v-else>
  <details class="form-section" :open="source.requirements.some(row=>!row.unit||row.quantity===null)"><summary>{{t('schemaEditRequirements')}}</summary><div class="table-wrap"><table><thead><tr><th>{{t('material')}}</th><th>{{t('procurementRequired')}}</th><th>{{t('unit')}}</th></tr></thead><tbody><tr v-for="(row,index) in source.requirements" :key="index"><td>{{row.name}}</td><td><input type="number" min="0" step="any" :aria-label="`${t('quantity')}: ${row.name}`" :value="value(row,index,'quantity')" @input="change(row,index,'quantity',$event.target.value)"/></td><td><select :aria-label="`${t('unit')}: ${row.name}`" :value="value(row,index,'unit')" @change="change(row,index,'unit',$event.target.value)"><option value="">{{t('schemaCheck')}}</option><option v-for="unit in UNITS" :key="unit" :value="unit">{{t(`unit_${unit}`)}}</option></select></td></tr></tbody></table></div></details>
  <section v-if="preview" class="form-section"><h3>{{t('schemaCombined')}}</h3><div class="table-wrap"><table><thead><tr><th>{{t('material')}}</th><th>{{t('procurementRequired')}}</th><th>{{t('procurementAvailable')}}</th><th>{{t('schemaPending')}}</th><th>{{t('toOrder')}}</th></tr></thead><tbody><tr v-for="row in preview.rows" :key="row.key"><td>{{row.name}}<span class="cell-subtitle">{{t(`unit_${row.unit}`)}}</span></td><td>{{display(row.required)}}</td><td>{{display(row.available)}}</td><td>{{display(row.pending)}}</td><td><strong>{{row.suppressed?t('restockExcluded'):display(row.toBuy)}}</strong></td></tr></tbody></table></div><p v-for="(issue,index) in preview.issues" :key="index" class="field-help">{{issue.name}}: {{t(issue.reason)}}</p></section>
  <p class="field-help">{{t('schemaCheckHelp')}}</p>
 </template>
 <template #footer><button class="button" :disabled="busy" @click="open=false">{{t('close')}}</button><button class="button primary" :disabled="busy||!source.requirements.length||!preview" @click="select">{{t('schemaShoppingSelect')}}</button></template>
</AppDialog>
</template>
