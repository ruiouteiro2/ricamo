<script setup>
import { ref } from 'vue';
import AppDialog from './AppDialog.vue';
import StagedAttachments from './StagedAttachments.vue';
import { saveEntityWithAssets } from '../state';
import { t,errorText } from '../i18n';
const props=defineProps({type:{type:String,required:true},ownerId:{type:String,required:true},attachmentIds:{type:Array,default:()=>[]},title:String,accept:String});
const emit=defineEmits(['close','saved']);const files=ref([]),busy=ref(false),error=ref(''),operationId=crypto.randomUUID();
async function save(){if(busy.value||!files.value.length)return;busy.value=true;error.value='';try{await saveEntityWithAssets(props.type,{id:props.ownerId,attachments:[...props.attachmentIds]},files.value,operationId);emit('saved');}catch(caught){error.value=errorText(caught);}finally{busy.value=false;}}
</script>
<template><AppDialog :title="title||t('photos')" :busy="busy" @close="emit('close')"><p v-if="error" role="alert" class="notice error">{{ error }}</p><StagedAttachments v-model="files" :disabled="busy" :accept="accept" :label="title"/><template #footer><button class="button" :disabled="busy" @click="emit('close')">{{ t('cancel') }}</button><button class="button primary" :disabled="busy||!files.length" @click="save">{{ busy?t('saving'):t('save') }}</button></template></AppDialog></template>
