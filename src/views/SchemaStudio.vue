<script setup>
import {ref,onMounted,onBeforeUnmount,watch} from 'vue';
import {ChevronLeft,RefreshCw} from '@lucide/vue';
import {state,dispatch,navigate} from '../state';
import {language,t,errorText} from '../i18n';
import {storage,windowControls} from '../storage';
import {validateStudioModel} from '../../core/schema-studio.mjs';
import {boundedBytes,detectFile} from '../../core/files.mjs';

const frame=ref(),loading=ref(true),pending=ref(false),error=ref('');
const channel='ricamo-schema-studio-v1';let nextRoute=null,closing=false,timeout;
function post(message){frame.value?.contentWindow?.postMessage({channel,...message},location.origin==='null'?'*':location.origin);}
function publish(){window.dispatchEvent(new CustomEvent('ricamo:draft-state',{detail:{pending:pending.value}}));}
async function receive(event){
  if(event.source!==frame.value?.contentWindow||event.origin!==location.origin||event.data?.channel!==channel)return;
  const message=event.data;
  if(message.type==='hello'){post({type:'init',payload:{entries:state.value.schemaStudio?.entries??{},language:language.value}});return;}
  if(message.type==='ready'){loading.value=false;clearTimeout(timeout);return;}
  if(message.type==='status'){
    pending.value=message.payload?.pending===true;error.value=message.payload?.error?errorText({code:message.payload.error}):'';publish();
    if(!pending.value&&!error.value){if(closing)windowControls?.finishClose?.();else if(nextRoute){const target=nextRoute;nextRoute=null;navigate(target.page,target.id);}}
    return;
  }
  if(!['write','validate','export','image'].includes(message.type)||typeof message.id!=='string')return;
  try{
    if(message.type==='write')await dispatch('studio.write',message.payload);
    else if(message.type==='validate')validateStudioModel(message.payload?.model);
    else if(message.type==='image'){if(!detectFile(boundedBytes(message.payload?.data)).startsWith('image/'))throw Object.assign(Error(),{code:'invalid_file_type'});}
    else await storage.saveFile({name:message.payload?.name,data:message.payload?.data});
    post({type:'reply',id:message.id,payload:true});
  }catch(caught){error.value=errorText(caught);post({type:'reply',id:message.id,error:caught.code||'storage_error'});}
}
function beforeNavigate(event){if(pending.value){event.preventDefault();nextRoute=event.detail;post({type:'flush'});}}
function beforeClose(event){if(pending.value){event.preventDefault();closing=true;post({type:'flush'});}}
function retry(){error.value='';post({type:'flush'});}
function reload(){loading.value=true;error.value='';frame.value.src='/studio/index.html';}
watch(language,value=>post({type:'language',payload:value}));
onMounted(()=>{window.addEventListener('message',receive);window.addEventListener('ricamo:before-navigate',beforeNavigate);window.addEventListener('ricamo:before-close',beforeClose);timeout=setTimeout(()=>{if(loading.value)error.value=t('schemaStudioLoadError');},15000);});
onBeforeUnmount(()=>{clearTimeout(timeout);window.removeEventListener('message',receive);window.removeEventListener('ricamo:before-navigate',beforeNavigate);window.removeEventListener('ricamo:before-close',beforeClose);window.dispatchEvent(new CustomEvent('ricamo:draft-state',{detail:{pending:false}}));});
</script>
<template>
 <section class="schema-studio-page">
  <div class="schema-studio-heading"><button class="button small" @click="navigate('patterns')"><ChevronLeft :size="16"/>{{t('patterns')}}</button><h1>{{t('schemaStudio')}}</h1><span class="badge" :class="pending?'warning':'green'" role="status">{{t(pending?'saving':'saved')}}</span><button v-if="error" class="button small" @click="pending?retry():reload()"><RefreshCw :size="14"/>{{t('retry')}}</button></div>
  <p v-if="error" class="notice error" role="alert">{{error}}</p><p v-if="loading" class="notice" role="status">{{t('schemaStudioLoading')}}</p>
  <iframe ref="frame" src="/studio/index.html" :title="t('schemaStudio')" class="schema-studio-frame" sandbox="allow-scripts allow-same-origin allow-downloads"/>
 </section>
</template>
<style scoped>
.schema-studio-page{padding:16px 20px 0;display:flex;flex-direction:column;height:calc(100vh - 76px);min-height:500px}.schema-studio-heading{display:flex;align-items:center;gap:14px;padding-bottom:14px;flex-wrap:wrap}.schema-studio-heading h1{font-size:1.3rem;margin:0;flex:1}.schema-studio-frame{display:block;width:100%;flex:1;min-height:360px;border:1px solid var(--line);border-radius:var(--radius);background:var(--paper)}.schema-studio-page>.notice{margin-bottom:12px}@media(max-width:850px){.schema-studio-page{height:calc(100vh - 64px);padding:12px 10px 0}}
</style>
