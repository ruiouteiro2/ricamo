<script setup>
import {computed,ref,watch,onBeforeUnmount} from 'vue';
import FormField from './FormField.vue';
import {ChevronLeft,ChevronRight,RefreshCw} from '@lucide/vue';
import {state,dispatch,notify} from '../state';
import {t,number,errorText} from '../i18n';
import {previewPatternProcurement} from '../../core/pattern-procurement.mjs';
import {componentIdentity} from '../../core/thread-recipes.mjs';
import {lookupSupplierProducts,getSupplierProduct} from '../supplier-catalogues.mjs';
import {openPurchaseLink} from '../purchase-link.mjs';
const props=defineProps({revision:Object,project:Object,fabric:Object,design:Object,configuration:Object,margins:Object,allowApply:Boolean,embedded:Boolean});
const query=ref('');
const products=ref([]),loading=ref(false),error=ref(''),busy=ref(false),page=ref(1),cache=new Map();let timer,requestVersion=0;
const preview=computed(()=>{try{return{value:previewPatternProcurement(state.value,props.revision,{project:props.project,fabric:props.fabric,design:props.design,configuration:props.configuration,margins:props.margins,products:products.value})}}catch(caught){return{error:caught}}});
const rows=computed(()=>preview.value.value?.rows??[]),filtered=computed(()=>rows.value.filter(row=>[row.color.brand,row.color.range,row.color.code,row.color.name].join(' ').toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase()))),pages=computed(()=>Math.max(1,Math.ceil(filtered.value.length/25))),visible=computed(()=>filtered.value.slice((page.value-1)*25,page.value*25));
watch(query,()=>page.value=1);
watch(pages,value=>{page.value=Math.min(page.value,value)});
const requests=computed(()=>{
 const colors=[];for(const color of props.revision?.colors??[]){if(color.blend)colors.push(...color.blend.components,...(color.blend.backComponents??[]));else colors.push(color);if(color.attachmentThread){const thread=color.attachmentThread;colors.push(...(thread.blend?[...thread.blend.components,...(thread.blend.backComponents??[])]:[thread]));}}
 colors.push(...(props.design?.requirements??[]));
 return[...new Map(colors.map(color=>{const row={brand:color.brand??'',range:color.range||((color.catalogueRef?.name==='DMC · MakeBead'&&color.brand==='DMC')?'Mouliné':''),code:color.code??'',category:color.category??(color.materialKind==='bead'?'embellishment':'thread')};return[`${row.category}:${componentIdentity(row)}`,row]})).values()];
});
const clothId=computed(()=>preview.value.value?.fabric?.configuration?.productId??props.fabric?.productId??props.design?.fabric?.productId??props.revision?.settings?.fabric?.productId??'');
async function refresh(force=false){
 const version=++requestVersion;loading.value=true;error.value='';if(force)cache.clear();
 try{
  const queue=[...requests.value];let index=0;
  await Promise.all(Array.from({length:Math.min(6,queue.length)},async()=>{while(index<queue.length){const query=queue[index++],key=`${query.category}:${componentIdentity(query)}`;if(!cache.has(key)){const found=await lookupSupplierProducts(query);if(version!==requestVersion)return;cache.set(key,found);}if(version!==requestVersion)return;}}));
  const cloth=clothId.value?await getSupplierProduct({id:clothId.value}):null;if(version!==requestVersion)return;
  const current=requests.value.flatMap(query=>cache.get(`${query.category}:${componentIdentity(query)}`)??[]);
  products.value=[...new Map([...current,...(cloth?[cloth]:[])].map(product=>[product.id,product])).values()];
 }catch(caught){if(version===requestVersion)error.value=errorText(caught);}finally{if(version===requestVersion)loading.value=false;}
}
watch(()=>JSON.stringify([requests.value,clothId.value]),()=>{clearTimeout(timer);timer=setTimeout(()=>refresh(),250)},{immediate:true});
onBeforeUnmount(()=>{requestVersion++;clearTimeout(timer)});
async function buy(url){try{await openPurchaseLink(url)}catch(caught){error.value=errorText(caught)}}
async function apply(){busy.value=true;error.value='';try{await getPreview();await dispatch('project.procurement.apply',{projectId:props.project.id,products:JSON.parse(JSON.stringify(products.value)),...(props.configuration?{configuration:props.configuration}:{})});notify();}catch(caught){error.value=errorText(caught)}finally{busy.value=false}}
async function getPreview(){clearTimeout(timer);await refresh();if(preview.value.error)throw preview.value.error;if(error.value)throw Object.assign(new Error(error.value),{code:'procurement_lookup_failed'});return JSON.parse(JSON.stringify({...preview.value.value,revisionId:props.revision?.id??null,width:props.revision?.width??null,height:props.revision?.height??null}));}
defineExpose({getPreview});
const display=(value,digits=6)=>value===null||value===undefined?t('unknown'):number(value,digits);
const supplier=product=>product.supplier==='casa-cenina'?'Casa Cenina':product.supplier==='tessiland'?'Tessiland':product.supplier;
const displayUnit=unit=>unit==='ball'?t('procurementBall'):unit==='cone'?t('procurementCone'):t(unit);
</script>
<template>
<section :class="{'form-section':!embedded}">
 <div :class="embedded?'actions':'panel-heading'"><h3 v-if="!embedded">{{t('procurementTitle')}}</h3><span v-else class="field-help">{{t('procurementInventoryHelp')}}</span><button class="button small" :disabled="loading" @click="refresh(true)"><RefreshCw :size="14"/>{{t('procurementRefresh')}}</button></div>
 <p v-if="error" class="notice error" role="alert">{{error}}</p><p v-if="preview.error" class="notice warning" role="status">{{errorText(preview.error)}}</p>
 <template v-else-if="preview.value">
  <div v-if="preview.value.fabric" class="form-section">
   <strong>{{t('fabric')}}</strong><p>{{[preview.value.fabric.configuration.brand,preview.value.fabric.configuration.range,preview.value.fabric.configuration.colorName,preview.value.fabric.configuration.code].filter(Boolean).join(' · ')}}</p>
   <p v-if="preview.value.fabric.size">{{t('procurementFabricSize',{width:display(preview.value.fabric.size.widthCm,2),height:display(preview.value.fabric.size.heightCm,2),cutWidth:display(preview.value.fabric.size.cutWidthCm,2),cutHeight:display(preview.value.fabric.size.cutHeightCm,2)})}}</p><p v-else class="notice warning">{{t('procurementFabricUnknown')}}</p>
   <p class="field-help">{{t('procurementMargins',{left:display(preview.value.fabric.margins.left),right:display(preview.value.fabric.margins.right),top:display(preview.value.fabric.margins.top),bottom:display(preview.value.fabric.margins.bottom)})}}</p>
   <p v-if="preview.value.fabric.lot">{{t('procurementFabricSelected')}}: {{preview.value.fabric.lot.lotCode||preview.value.fabric.lot.id}} · {{t(preview.value.fabric.fit?.fits===true?'procurementFabricFits':preview.value.fabric.fit?.fits===false?'procurementFabricTooSmall':'procurementFabricCheck')}}</p>
   <p v-else class="field-help">{{t('procurementFabricNoLot')}}</p>
   <div class="actions"><button v-for="offer in preview.value.fabric.offers" :key="offer.id" class="button text small" @click="buy(offer.url)">{{t('procurementBuy',{supplier:supplier(offer)})}}</button><button v-if="!preview.value.fabric.offers.length&&preview.value.fabric.url" class="button text small" @click="buy(preview.value.fabric.url)">{{t('buyFabric')}}</button></div>
  </div>
  <p v-if="preview.value.geometryError" class="notice warning">{{t('procurementFabricUnknown')}}</p>
  <p v-for="warning in preview.value.warnings" :key="`${warning.code}:${warning.index}`" class="notice warning" role="status">{{t(warning.code,{code:warning.codeName})}}</p>
  <p v-if="loading" class="field-help" role="status">{{t('procurementLookingUp')}}</p>
  <p v-if="!rows.length" class="notice">{{t('procurementEmpty')}}</p>
  <FormField v-if="rows.length>25" :label="t('searchMaterials')" v-slot="{id}"><input :id="id" v-model="query" type="search"/></FormField>
  <div v-if="rows.length" class="table-wrap"><table><thead><tr><th>{{t('materials')}}</th><th>{{t('procurementRequired')}}</th><th>{{t('procurementAvailable')}}</th><th>{{t('procurementShortage')}}</th><th>{{t('purchaseLinks')}}</th></tr></thead><tbody>
   <tr v-for="row in visible" :key="row.key"><td><div class="material-cell"><span v-if="row.color.hex" class="swatch" :style="{background:row.color.hex}"/><div><strong>{{[row.color.brand,row.color.range,row.color.code].filter(Boolean).join(' · ')}}</strong><small class="cell-subtitle">{{row.color.name}}</small><small v-if="row.ambiguous" class="cell-subtitle">{{t('threadAmbiguous')}}</small></div></div></td>
    <td>{{display(row.required)}} {{displayUnit(row.unit)}}<small v-if="row.manual" class="cell-subtitle">{{t('threadManualPreserved')}}</small><small v-else class="cell-subtitle">{{t(row.source==='counted'?'procurementCounted':row.source==='declared'?'procurementDeclared':'procurementGeometry')}}</small><small v-for="(part,index) in row.declaredParts??[]" :key="index" class="cell-subtitle">{{display(part.quantity)}} {{displayUnit(part.unit)}}</small><small v-if="row.consumed>0" class="cell-subtitle">{{t('procurementRemaining',{quantity:display(row.remaining),unit:displayUnit(row.unit)})}}</small></td>
    <td>{{display(row.stock.available)}} {{displayUnit(row.unit)}}<small v-if="row.stock.status==='untracked'" class="cell-subtitle">{{t('procurementUntracked')}}</small><template v-else><small class="cell-subtitle">{{t('procurementStock',{physical:display(row.stock.physical),own:display(row.stock.ownReserved),other:display(row.stock.elsewhereReserved)})}}</small><small v-if="row.stock.unknown&&row.stock.knownAvailable>0" class="cell-subtitle">{{t('procurementKnownStock',{quantity:display(row.stock.knownAvailable),unit:displayUnit(row.unit)})}}</small></template></td>
    <td>{{display(row.shortage)}} {{displayUnit(row.unit)}}</td>
    <td><div v-for="offer in row.offers" :key="offer.product.id"><button class="button text small" @click="buy(offer.product.url)">{{t('procurementBuy',{supplier:supplier(offer.product)})}}</button><small v-if="offer.packagesRequired!==null" class="cell-subtitle">{{t('procurementPackages',{required:display(offer.packagesRequired,0),missing:display(offer.packagesMissing,0),unit:displayUnit(offer.product.pack.unit)})}}</small><small v-else class="cell-subtitle">{{t('procurementPackageUnknown')}}</small></div><span v-if="!row.offers.length" class="muted">{{t('purchaseLinkUnverified')}}</span></td>
   </tr>
  </tbody></table></div>
  <div v-if="pages>1" class="panel-heading"><span role="status">{{page}} / {{pages}} · {{filtered.length}} {{t('materials')}}</span><div class="actions"><button class="icon-button" :aria-label="t('previousPage')" :disabled="page===1" @click="page--"><ChevronLeft :size="18"/></button><button class="icon-button" :aria-label="t('nextPage')" :disabled="page===pages" @click="page++"><ChevronRight :size="18"/></button></div></div>
  <details v-if="revision" class="form-section"><summary>{{t('procurementAllowances')}}</summary><p class="field-help">{{t('procurementFormula')}}</p><p>{{t('procurementSettings',{waste:preview.value.configuration.waste,travel:preview.value.configuration.crossTravel,batch:preview.value.configuration.batchSize,start:preview.value.configuration.startFinishCm})}}</p><p class="field-help">{{t('procurementPackHelp')}}</p></details>
  <button v-if="allowApply&&project" class="button primary" :disabled="busy||!rows.length||rows.some(row=>row.ambiguous)||['completed','archived'].includes(project.status)" @click="apply">{{t('procurementApply')}}</button>
 </template>
</section>
</template>
