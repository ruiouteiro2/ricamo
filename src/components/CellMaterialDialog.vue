<script setup>
import {computed,ref,shallowRef} from 'vue';
import {ExternalLink} from '@lucide/vue';
import AppDialog from './AppDialog.vue';
import FormField from './FormField.vue';
import MaterialProductPicker from './MaterialProductPicker.vue';
import {isBead,colorFromProduct,beadFootprint} from '../../core/pattern-materials.mjs';
import {t,errorText,number} from '../i18n';
import {openPurchaseLink} from '../purchase-link.mjs';

const props=defineProps({revision:{type:Object,required:true},x:Number,y:Number,apply:{type:Function,required:true}});
const emit=defineEmits(['close']);
const original=props.revision.colors[props.revision.cells[props.y*props.revision.width+props.x]];
const chosen=shallowRef(original??null),category=ref(isBead(original)?'embellishment':'thread'),catalogue=ref(!original),error=ref('');
const strands=ref(original?.strands??2),attachment=ref(original?.attachmentThread?-2:original&&!isBead(original)?props.revision.colors.indexOf(original):-1),attachmentStrands=ref(original?.attachmentThread?.strands??1);
const threads=computed(()=>props.revision.colors.map((color,index)=>({color,index})).filter(row=>!isBead(row.color)));
const storedAttachment=shallowRef(original?.attachmentThread??null);
const attachmentColor=computed(()=>attachment.value===-2?storedAttachment.value:props.revision.colors[attachment.value]);
const footprint=computed(()=>beadFootprint(chosen.value,props.revision.settings?.fabric));
const currentLabel=computed(()=>chosen.value?[chosen.value.brand,chosen.value.range,chosen.value.code,chosen.value.name].filter(Boolean).join(' · '):t('cellEmpty'));
function chooseProduct(product){try{chosen.value=colorFromProduct(product,{strands:strands.value});catalogue.value=false;error.value='';}catch(caught){error.value=errorText(caught);}}
function chooseExisting(index){chosen.value=props.revision.colors[Number(index)];strands.value=chosen.value?.strands??2;category.value=isBead(chosen.value)?'embellishment':'thread';if(isBead(chosen.value)){storedAttachment.value=chosen.value.attachmentThread??null;attachment.value=storedAttachment.value?-2:-1;attachmentStrands.value=storedAttachment.value?.strands??1;}catalogue.value=false;}
function changeCategory(value){category.value=value;catalogue.value=true;}
async function buy(){try{await openPurchaseLink(chosen.value.product.url);}catch(caught){error.value=errorText(caught);}}
function save(){
 try{
  error.value='';const color=JSON.parse(JSON.stringify(chosen.value));
  if(isBead(color)){
   delete color.strands;delete color.backStrands;
   if(attachmentColor.value){color.attachmentThread=JSON.parse(JSON.stringify(attachmentColor.value));if(!color.attachmentThread.blend)color.attachmentThread.strands=attachmentStrands.value;}
   else delete color.attachmentThread;
  }else if(!color.blend)color.strands=strands.value;
  if(props.apply(color)!==false)emit('close');
 }catch(caught){error.value=errorText(caught);}
}
</script>
<template>
 <AppDialog :title="t('cellMaterialTitle',{x:x+1,y:y+1})" wide @close="emit('close')">
  <p v-if="error" class="notice error" role="alert">{{error}}</p>
  <p class="field-help">{{t('cellMaterialHelp')}}</p>
  <div class="tabs"><button type="button" :class="{active:category==='thread'}" @click="changeCategory('thread')">{{t('cellThreads')}}</button><button type="button" :class="{active:category==='embellishment'}" @click="changeCategory('embellishment')">{{t('cellBeads')}}</button></div>
  <MaterialProductPicker v-if="catalogue" :key="category" :category="category" :initial-brand="category==='thread'&&!isBead(original)?original?.brand??'':''" :initial-code="category==='thread'&&!isBead(original)?original?.code??'':''" @select="chooseProduct"/>
  <div v-else class="panel"><div class="panel-body"><p><span class="swatch" :style="{background:chosen?.hex}"/> {{currentLabel}}</p><p v-if="chosen?.displayColorUnknown" class="field-help">{{t('materialColorUnavailable')}}</p><div class="actions"><button type="button" class="button small" @click="catalogue=true">{{t('changeMaterial')}}</button><button v-if="chosen?.product?.url" type="button" class="button small" @click="buy"><ExternalLink :size="14"/>{{t('buyMaterial')}}</button></div></div></div>
  <FormField v-if="revision.colors.length" :label="t('cellExistingPalette')" v-slot="{id}"><select :id="id" :value="revision.colors.indexOf(chosen)" @change="chooseExisting($event.target.value)"><option :value="-1" disabled>{{t('selectMaterial')}}</option><option v-for="(color,index) in revision.colors" :key="index" :value="index">{{color.symbol}} · {{color.brand}} {{color.range}} {{color.code}} · {{color.name}}</option></select></FormField>
  <template v-if="chosen"><p v-if="chosen.product?.suitability==='verify-technique'" class="notice warning">{{t('materialTechniqueUnknown')}}</p>
   <template v-if="isBead(chosen)">
    <p class="notice">{{t('beadOnePerCell')}} <span v-if="footprint">{{number(footprint.diameterMm,2)}} mm · {{number(footprint.x,2)}} × {{number(footprint.y,2)}} {{t('gridCells')}}</span><span v-else>{{t('beadSizeUnknown')}}</span></p>
    <p v-if="footprint?.overlaps" class="notice warning">{{t('beadOverlapWarning')}}</p>
    <div class="form-grid"><FormField :label="t('beadAttachmentThread')" v-slot="{id}"><select :id="id" v-model.number="attachment"><option :value="-1">{{t('beadAttachmentUnknown')}}</option><option v-if="storedAttachment" :value="-2">{{storedAttachment.brand}} {{storedAttachment.code}} · {{storedAttachment.name}}</option><option v-for="row in threads" :key="row.index" :value="row.index">{{row.color.brand}} {{row.color.range}} {{row.color.code}} · {{row.color.name}}</option></select></FormField><FormField v-if="attachmentColor" :label="t('strands')" v-slot="{id}"><input :id="id" v-model.number="attachmentStrands" type="number" min="1" max="12" :disabled="Boolean(attachmentColor.blend)"/></FormField></div>
    <p v-if="!attachmentColor" class="notice warning">{{t('beadAttachmentRequiredHelp')}}</p>
   </template>
   <FormField v-else :label="t('strands')" :help="t('cellStrandsHelp')" v-slot="{id,describedby}"><input :id="id" v-model.number="strands" type="number" min="1" max="12" :disabled="Boolean(chosen.blend)" :aria-describedby="describedby"/></FormField>
  </template>
  <template #footer><button type="button" class="button" @click="emit('close')">{{t('cancel')}}</button><button type="button" class="button primary" :disabled="!chosen||catalogue" @click="save">{{t('applyToCell')}}</button></template>
 </AppDialog>
</template>
