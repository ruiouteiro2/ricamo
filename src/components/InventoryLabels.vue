<script setup>
import { inventoryErrorText } from '../inventory-errors.mjs';
import { computed, ref, watch } from 'vue';
import AppDialog from './AppDialog.vue';
import FormField from './FormField.vue';
import { state, notify } from '../state';
import { storage } from '../storage';
import { t, language, number } from '../i18n';
import { inventoryLabelItems, inventoryLabelFields, inventoryLabelsPdf, labelSheetLayout } from '../inventory-labels.mjs';
const props=defineProps({materialIds:{type:Array,default:()=>[]},lotIds:{type:Array,default:()=>[]},projectIds:{type:Array,default:()=>[]},locationIds:{type:Array,default:()=>[]},initialWidth:{type:Number,default:90},initialHeight:{type:Number,default:56}});
const emit=defineEmits(['close']);
const kind=ref(props.projectIds.length?'projects':props.locationIds.length?'locations':props.lotIds.length?'lots':'materials'),paper=ref(state.value.settings.paper),copies=ref(1),labelWidth=ref(props.initialWidth),labelHeight=ref(props.initialHeight),busy=ref(false),error=ref('');
watch([kind,paper,copies,labelWidth,labelHeight],()=>{error.value=''});
const ids=computed(()=>kind.value==='projects'?{projectIds:props.projectIds}:kind.value==='locations'?{locationIds:props.locationIds}:kind.value==='materials'?{materialIds:props.materialIds}:{lotIds:props.lotIds.length?props.lotIds:state.value.lots.filter(lot=>props.materialIds.includes(lot.materialId)).map(lot=>lot.id)});
const count=computed(()=>Object.values(ids.value).reduce((n,rows)=>n+rows.length,0));
const prepared=computed(()=>{if(!count.value)return{items:[]};try{return{items:inventoryLabelItems(state.value,ids.value)}}catch(error){return{items:[],error}}});
const samples=computed(()=>prepared.value.items.slice(0,4));
const layout=computed(()=>{try{return labelSheetLayout({paper:paper.value,labelWidth:labelWidth.value,labelHeight:labelHeight.value})}catch{return null}});
const validCopies=computed(()=>Number.isInteger(Number(copies.value))&&Number(copies.value)>=1&&Number(copies.value)<=10);
const total=computed(()=>validCopies.value?count.value*Number(copies.value):0),pages=computed(()=>layout.value?Math.ceil(total.value/layout.value.perPage):0);
const valid=computed(()=>Boolean(layout.value)&&validCopies.value&&count.value>0&&count.value<=200&&total.value<=500&&!prepared.value.error);
async function download(){if(busy.value||!valid.value)return;busy.value=true;error.value='';try{const data=await inventoryLabelsPdf(inventoryLabelItems(state.value,ids.value),{locale:language.value,paper:paper.value,copies:Number(copies.value),labelWidth:labelWidth.value,labelHeight:labelHeight.value});if(await storage.saveFile({name:'Ricamo-labels.pdf',data}))notify();}catch(caught){error.value=inventoryErrorText(caught)}finally{busy.value=false}}
</script>
<template>
 <AppDialog :title="t('inventoryLabels')" :busy="busy" @close="emit('close')">
  <p class="notice">{{t('labelsHelp')}}</p><p v-if="error||prepared.error" class="notice error" role="alert">{{error||inventoryErrorText(prepared.error)}}</p>
  <div class="form-grid">
   <FormField :label="t('labelContent')" v-slot="{id}"><select :id="id" v-model="kind" :disabled="busy"><option v-if="materialIds.length" value="materials">{{t('materials')}}</option><option v-if="materialIds.length||lotIds.length" value="lots">{{t('lots')}}</option><option v-if="projectIds.length" value="projects">{{t('projects')}}</option><option v-if="locationIds.length" value="locations">{{t('locations')}}</option></select></FormField>
   <FormField :label="t('paper')" v-slot="{id}"><select :id="id" v-model="paper" :disabled="busy"><option value="a4">A4</option><option value="letter">Letter</option></select></FormField>
   <FormField :label="t('labelWidth')" v-slot="{id}"><input :id="id" v-model="labelWidth" :disabled="busy" type="number" min="30" max="180" step="0.5"/></FormField>
   <FormField :label="t('labelExactHeight')" v-slot="{id}"><input :id="id" v-model="labelHeight" :disabled="busy" type="number" min="20" max="250" step="0.5"/></FormField>
   <FormField :label="t('labelCopies')" v-slot="{id}"><input :id="id" v-model="copies" :disabled="busy" type="number" min="1" max="10"/></FormField>
  </div>
  <p class="field-help">{{t('labelFixedSizeHelp')}}</p><p v-if="!layout" class="notice error" role="alert">{{t('pdf_label_dimensions')}}</p><p v-if="!validCopies||count>200||total>500" class="notice warning">{{t('labelLimit')}}</p>
  <p class="form-section">{{t('labelCount',{count:total})}}</p><p v-if="layout" class="notice" role="status">{{t('labelSheetSummary',{width:number(layout.labelWidth,6),height:number(layout.labelHeight,6),columns:layout.columns,rows:layout.rows,perPage:layout.perPage,pages})}}</p>
  <details v-if="layout&&total" class="form-section"><summary>{{t('labelSheetPreview')}}</summary><svg :viewBox="`0 0 ${layout.width} ${layout.height}`" width="180" :height="180*layout.height/layout.width" role="img" :aria-label="t('labelSheetPreview')"><rect x="0.5" y="0.5" :width="layout.width-1" :height="layout.height-1" fill="var(--surface)" stroke="var(--muted)"/><rect v-for="index in Math.min(total,layout.perPage)" :key="index" :x="layout.margin+(index-1)%layout.columns*(layout.labelWidth+layout.gap)" :y="layout.margin+Math.floor((index-1)/layout.columns)*(layout.labelHeight+layout.gap)" :width="layout.labelWidth" :height="layout.labelHeight" fill="var(--accent-soft)" stroke="var(--accent)" stroke-width="0.4"/></svg></details>
  <div class="stack"><div v-for="item in samples" :key="`${item.kind}:${item.id}`" class="panel panel-body" style="overflow-wrap:anywhere"><strong>{{item.name}}</strong><p v-for="(field,index) in inventoryLabelFields(item,language).slice(1)" :key="index" class="field-help mono">{{field.value}}</p></div></div><p v-if="count>4" class="field-help">{{t('labelPreviewSample')}}</p>
  <template #footer><button class="button" :disabled="busy" @click="emit('close')">{{t('close')}}</button><button class="button primary" :disabled="busy||!valid" @click="download">{{t('downloadLabels')}}</button></template>
 </AppDialog>
</template>
