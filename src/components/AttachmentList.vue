<script setup>
import { ref,watch,onBeforeUnmount } from 'vue';
import { Download } from '@lucide/vue';
import { state,assetUrl } from '../state';
import { storage } from '../storage';
import { t,errorText } from '../i18n';
const props=defineProps({ids:{type:Array,default:()=>[]}});const rows=ref([]),error=ref('');let generation=0;
watch(()=>props.ids.map(id=>`${id}:${state.value.attachments.find(row=>row.id===id)?.digest}`).join('|'),async()=>{const token=++generation;const next=await Promise.all(props.ids.map(async id=>{const metadata=state.value.attachments.find(row=>row.id===id);try{return {...metadata,id,url:metadata?.mime.startsWith('image/')?await assetUrl(id):null};}catch{return {...metadata,id,unavailable:true};}}));if(token===generation)rows.value=next;},{immediate:true});
onBeforeUnmount(()=>{generation++;});
async function download(row){error.value='';try{await storage.saveFile({name:row.name,data:await storage.getAsset(row.id)});}catch(caught){error.value=errorText(caught);}}
</script>
<template><div v-if="rows.length" class="attachment-list"><div v-for="row in rows" :key="row.id" class="attachment"><img v-if="row.url" :src="row.url" :alt="row.name"/><span v-else class="badge">{{ row.unavailable?t('fileUnavailable'):'PDF' }}</span><small>{{ row.name }}</small><button type="button" class="button text small" @click="download(row)"><Download :size="14"/>{{ t('export') }}</button></div></div><p v-if="error" role="alert" class="notice error">{{ error }}</p></template>
