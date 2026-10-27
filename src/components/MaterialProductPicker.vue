<script setup>
import {ref,watch,onBeforeUnmount,computed} from 'vue';
import {ChevronLeft,ChevronRight} from '@lucide/vue';
import FormField from './FormField.vue';
import {supplierSearch,supplierFacets} from '../supplier-catalogues.mjs';
import {t,errorText,number} from '../i18n';

const props=defineProps({category:{type:String,default:'thread'},initialBrand:{type:String,default:''},initialCode:{type:String,default:''}});
const emit=defineEmits(['select']);
const colourCategory=computed(()=>['thread','fabric','embellishment'].includes(props.category));
const brand=ref(props.initialBrand),range=ref(''),query=ref(props.initialCode),offset=ref(0),items=ref([]),total=ref(0),facets=ref({brands:[],ranges:[]}),busy=ref(false),error=ref('');
const limit=12;let timer,request=0,facetRequest=0;
async function loadFacets(){const token=++facetRequest;try{const result=await supplierFacets({category:props.category,brand:brand.value});if(token===facetRequest)facets.value=result;}catch(caught){if(token===facetRequest)error.value=errorText(caught);}}
async function search(){const token=++request;busy.value=true;error.value='';try{const result=await supplierSearch({category:props.category,brand:brand.value,range:range.value,query:query.value,offset:offset.value,limit});if(token===request){items.value=result.items;total.value=result.total;}}catch(caught){if(token===request){error.value=errorText(caught);items.value=[];total.value=0;}}finally{if(token===request)busy.value=false;}}
watch(()=>props.category,()=>{brand.value='';range.value='';query.value='';loadFacets();});
watch(brand,()=>{range.value='';loadFacets();});
watch([brand,range,query,()=>props.category],()=>{offset.value=0;clearTimeout(timer);request++;busy.value=true;timer=setTimeout(search,250);},{immediate:true});
watch(offset,search);loadFacets();
onBeforeUnmount(()=>{clearTimeout(timer);request++;facetRequest++;});
</script>
<template>
 <section class="stack" :aria-busy="busy">
  <div class="form-grid">
   <FormField :label="t('brand')" v-slot="{id}"><select :id="id" v-model="brand"><option value="">{{t('allBrands')}}</option><option v-if="brand&&!facets.brands.includes(brand)" :value="brand">{{brand}}</option><option v-for="value in facets.brands" :key="value" :value="value">{{value}}</option></select></FormField>
   <FormField :label="t(category==='thread'?'threadProductType':'materialProductType')" v-slot="{id}"><select :id="id" v-model="range"><option value="">{{t('allMaterialTypes')}}</option><option v-for="value in facets.ranges" :key="value" :value="value">{{value}}</option></select></FormField>
   <FormField :label="t(colourCategory?'materialColorCode':'materialArticleCode')" wide v-slot="{id}"><input :id="id" v-model="query" type="search" :placeholder="t(colourCategory?'materialCodeSearchExample':'materialArticleSearch')" maxlength="200"/></FormField>
  </div>
  <p v-if="error" class="notice error" role="alert">{{error}}</p>
  <p class="field-help" role="status">{{busy?t('loading'):t('materialMatches',{count:number(total,0)})}}</p>
  <div v-if="items.length" class="table-wrap"><table><thead><tr><th>{{t('materials')}}</th><th>{{t('supplier')}}</th><th><span class="sr-only">{{t('selectMaterial')}}</span></th></tr></thead><tbody>
   <tr v-for="product in items" :key="product.id"><td><span v-if="colourCategory" class="swatch" :style="{background:product.hex??'#aaa6a0'}" aria-hidden="true"/> <strong>{{product.brand}} {{product.code}}</strong><span class="cell-subtitle">{{product.range}} · {{product.colorName||product.name}}</span><span v-if="colourCategory&&!product.hex" class="cell-subtitle">{{t('materialColorUnavailable')}}</span></td><td>{{product.supplier==='tessiland'?'Tessiland':'Casa Cenina'}}</td><td><button type="button" class="button small" :disabled="busy" @click="emit('select',product)">{{t('selectMaterial')}}</button></td></tr>
  </tbody></table></div>
  <p v-else-if="!busy&&!error" class="notice">{{t('materialNoMatches')}}</p>
  <div v-if="total>limit" class="actions"><button type="button" class="button small" :disabled="busy||offset===0" :aria-label="t('previous')" @click="offset=Math.max(0,offset-limit)"><ChevronLeft :size="16"/></button><span class="field-help">{{offset+1}}–{{Math.min(offset+limit,total)}} / {{number(total,0)}}</span><button type="button" class="button small" :disabled="busy||offset+limit>=total" :aria-label="t('next')" @click="offset+=limit"><ChevronRight :size="16"/></button></div>
 </section>
</template>
