<script setup>
import {computed,ref,watch} from 'vue';
import {Info} from '@lucide/vue';
import PatternSupplies from './PatternSupplies.vue';
import CatalogueReferences from './CatalogueReferences.vue';
import AppDialog from './AppDialog.vue';import EntityForm from './EntityForm.vue';
import {state,dispatch,navigate,notify} from '../state';import {t,date} from '../i18n';
import {patternUsage} from '../../core/pattern-library.mjs';
const props=defineProps({pattern:{type:Object,required:true}});
const open=ref(false),editing=ref(false),usagePage=ref(1);
const keys=['author','origin','technique','theme','difficulty','rights'];
const usage=computed(()=>open.value?patternUsage(state.value,props.pattern.id):[]);
const usagePages=computed(()=>Math.max(1,Math.ceil(usage.value.length/20)));
const visibleUsage=computed(()=>usage.value.slice((usagePage.value-1)*20,usagePage.value*20));
watch(usagePages,pages=>{usagePage.value=Math.min(usagePage.value,pages)});
const fields=computed(()=>[{key:'name',label:()=>t('name'),required:true,max:300},...keys.map(key=>({key,label:()=>t(`library_${key}`),type:['origin','rights'].includes(key)?'textarea':'text',wide:['origin','rights'].includes(key),max:{origin:2000,technique:150,rights:4000}[key]??300})),{key:'collections',label:()=>t('libraryCollections'),type:'textarea',wide:true,max:10000,help:()=>t('libraryListHelp')},{key:'tags',label:()=>t('tags'),type:'textarea',wide:true,max:20000,help:()=>t('libraryListHelp')},{key:'notes',label:()=>t('notes'),type:'textarea',wide:true},{key:'favorite',label:()=>t('favorite'),type:'checkbox'}]);
const initial=computed(()=>({name:props.pattern.name,...Object.fromEntries(keys.map(key=>[key,props.pattern.library?.[key]??''])),collections:(props.pattern.library?.collections??[]).join('\n'),tags:(props.pattern.tags??[]).join('\n'),notes:props.pattern.notes??'',favorite:props.pattern.favorite}));
const list=value=>value.split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
async function save(draft){await dispatch('pattern.save',{id:props.pattern.id,name:draft.name,notes:draft.notes,tags:list(draft.tags),favorite:draft.favorite,library:{...props.pattern.library,version:1,...Object.fromEntries(keys.map(key=>[key,draft[key]])),collections:list(draft.collections)}})}
function visit(row){open.value=false;navigate('project',row.projectId)}
</script>
<template>
<button class="button small" :aria-label="`${t('libraryDetails')}: ${pattern.name}`" @click="usagePage=1;open=true"><Info :size="15"/>{{t('libraryDetails')}}</button>
<AppDialog v-if="open&&!editing" :title="`${t('libraryDetails')}: ${pattern.name}`" wide @close="open=false">
 <p class="field-help">{{t('libraryPrivacyHelp')}}</p>
 <div class="table-wrap"><table><tbody><template v-for="key in keys" :key="key"><tr v-if="pattern.library?.[key]"><th scope="row">{{t(`library_${key}`)}}</th><td style="white-space:pre-wrap;overflow-wrap:anywhere">{{pattern.library[key]}}</td></tr></template><tr><th scope="row">{{t('libraryCollections')}}</th><td>{{pattern.library?.collections?.join(' · ')||t('none')}}</td></tr><tr><th scope="row">{{t('tags')}}</th><td>{{pattern.tags?.join(' · ')||t('none')}}</td></tr></tbody></table></div>
 <p v-if="pattern.notes" style="white-space:pre-wrap;overflow-wrap:anywhere">{{pattern.notes}}</p>
 <PatternSupplies :pattern="pattern"/>
 <CatalogueReferences owner-type="pattern" :owner="pattern" embedded @navigate="open=false"/>
 <section class="form-section"><h3>{{t('libraryUsage')}}</h3><p v-if="!usage.length" class="field-help">{{t('libraryUnused')}}</p><div v-else class="table-wrap"><table><thead><tr><th>{{t('project')}}</th><th>{{t('status')}}</th><th>{{t('revision')}}</th><th>{{t('libraryUseKind')}}</th></tr></thead><tbody><tr v-for="(row,index) in visibleUsage" :key="index"><td><button class="button text small" @click="visit(row)">{{row.name}}</button></td><td>{{t(row.status)}}</td><td>{{row.revisionId||'—'}}</td><td>{{t(row.current?'libraryUseCurrent':'libraryUseHistory')}}<small v-if="row.savedAt" class="cell-subtitle">{{date(row.savedAt)}}</small></td></tr></tbody></table></div><div v-if="usagePages>1" class="panel-heading"><span role="status">{{t('page')}} {{usagePage}} / {{usagePages}}</span><div class="actions"><button class="button small" type="button" :disabled="usagePage===1" @click="usagePage--">{{t('previousPage')}}</button><button class="button small" type="button" :disabled="usagePage===usagePages" @click="usagePage++">{{t('nextPage')}}</button></div></div></section>
 <template #footer><button class="button" @click="open=false">{{t('close')}}</button><button class="button primary" @click="editing=true">{{t('edit')}}</button></template>
</AppDialog>
<EntityForm v-if="open&&editing" :title="t('libraryEditDetails')" wide :help="t('libraryPrivacyHelp')" :fields="fields" :initial="initial" :submit="save" @close="editing=false" @saved="editing=false;notify()"/>
</template>
