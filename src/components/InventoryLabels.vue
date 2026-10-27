<script setup>
import { inventoryErrorText } from '../inventory-errors.mjs';
import { computed, ref } from 'vue';
import AppDialog from './AppDialog.vue';
import FormField from './FormField.vue';
import { state, notify } from '../state';
import { storage } from '../storage';
import { t, number, errorText, language } from '../i18n';
import { inventoryLabelItems, inventoryLabelsPdf } from '../inventory-labels.mjs';
const props=defineProps({materialIds:{type:Array,default:()=>[]},lotIds:{type:Array,default:()=>[]}});
const emit=defineEmits(['close']);
const kind=ref(props.lotIds.length?'lots':'materials'),paper=ref(state.value.settings.paper),copies=ref(1),busy=ref(false),error=ref('');
const ids=computed(()=>kind.value==='materials'?{materialIds:props.materialIds}:{lotIds:props.lotIds.length?props.lotIds:state.value.lots.filter(lot=>props.materialIds.includes(lot.materialId)).map(lot=>lot.id)});
const count=computed(()=>(ids.value.materialIds||ids.value.lotIds).length);
const samples=computed(()=>{try{return inventoryLabelItems(state.value,ids.value).slice(0,4)}catch{return[]}});
async function download(){busy.value=true;error.value='';try{const data=await inventoryLabelsPdf(inventoryLabelItems(state.value,ids.value),{locale:language.value,paper:paper.value,copies:Number(copies.value)});if(await storage.saveFile({name:'Ricamo-labels.pdf',data}))notify();}catch(caught){error.value=inventoryErrorText(caught)}finally{busy.value=false}}
</script>
<template>
  <AppDialog :title="t('inventoryLabels')" :busy="busy" @close="emit('close')"><p class="notice">{{ t('labelsHelp') }}</p><p v-if="error" class="notice error" role="alert">{{ error }}</p><div class="form-grid"><FormField :label="t('labelContent')" v-slot="{id}"><select :id="id" v-model="kind"><option v-if="materialIds.length" value="materials">{{ t('materials') }}</option><option value="lots">{{ t('lots') }}</option></select></FormField><FormField :label="t('paper')" v-slot="{id}"><select :id="id" v-model="paper"><option value="a4">A4</option><option value="letter">Letter</option></select></FormField><FormField :label="t('labelCopies')" v-slot="{id}"><input :id="id" v-model="copies" type="number" min="1" max="10" /></FormField></div><p class="form-section">{{ t('labelCount',{count:count*Number(copies)}) }}</p><p v-if="count>200||count*Number(copies)>500" class="notice warning">{{ t('labelLimit') }}</p><div class="stack"><div v-for="item in samples" :key="item.id" class="panel panel-body"><strong>{{ item.material.name }}</strong><p class="mono">{{ item.material.brand }} {{ item.material.code }}</p><small>{{ item.location }} · {{ number(item.quantity) }} {{ t(`unit_${item.material.unit}`) }}</small><p class="field-help mono">ID: {{ item.id }}</p></div></div><p v-if="count>4" class="field-help">{{ t('labelPreviewSample') }}</p><template #footer><button class="button" :disabled="busy" @click="emit('close')">{{ t('close') }}</button><button class="button primary" :disabled="busy||!count||count>200||count*Number(copies)>500" @click="download">{{ t('downloadLabels') }}</button></template></AppDialog>
</template>
