<script setup>
import { ref } from 'vue';
import { X } from '@lucide/vue';
import FormField from './FormField.vue';
import { t, errorText } from '../i18n';
import { ASSET_BATCH_COUNT, ASSET_BATCH_BYTES } from '../../core/entity-assets.mjs';
const props=defineProps({modelValue:{type:Array,default:()=>[]},disabled:Boolean,accept:{type:String,default:'image/png,image/jpeg,image/webp,image/gif'},label:String});
const emit=defineEmits(['update:modelValue']);const error=ref('');
function select(event){
 const files=[...props.modelValue,...Array.from(event.target.files||[])];event.target.value='';error.value='';
 if(files.length>ASSET_BATCH_COUNT||files.reduce((sum,file)=>sum+file.size,0)>ASSET_BATCH_BYTES){error.value=errorText({code:'asset_batch_limit'});return;}
 if(files.some(file=>file.size>25*1024*1024)){error.value=errorText({code:'file_too_large'});return;}
 emit('update:modelValue',files);
}
function remove(index){error.value='';emit('update:modelValue',props.modelValue.filter((_,position)=>position!==index));}
</script>
<template><div class="field-wide form-section"><FormField :label="label||t('photos')" :help="t('stagedAttachmentsHelp',{count:ASSET_BATCH_COUNT,size:ASSET_BATCH_BYTES/1024/1024})" wide v-slot="{id,describedby}"><input :id="id" type="file" :accept="accept" multiple :disabled="disabled" :aria-describedby="describedby" @change="select" /></FormField><p v-if="error" role="alert" class="notice error">{{ error }}</p><div v-for="(file,index) in modelValue" :key="index" class="stat-row"><span>{{ file.name }}</span><button type="button" class="icon-button" :disabled="disabled" :aria-label="t('removeStagedAttachment',{name:file.name})" @click="remove(index)"><X :size="16"/></button></div></div></template>
