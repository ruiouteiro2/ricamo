<script setup>
import { patternLibrarySearch } from '../core/pattern-library.mjs';
import { materialSearchDescriptors } from './material-descriptors.mjs';
import { APP_VERSION } from '../core/version.mjs';
import { ref, computed, onMounted, onBeforeUnmount, defineAsyncComponent } from 'vue';
import { House, Package, FolderHeart, Grid2X2, ShoppingBag, MapPin, Settings2, BookOpen, Search, CheckCheck, Flower2 } from '@lucide/vue';
import { state, ready, loadingError, saving, toast, route, navigate, initialise, changeLanguage, normalize } from './state';
import { t, language, errorText } from './i18n';
import { windowControls, onCloseRequest } from './storage';
import { exampleMode } from './example-mode.mjs';
import ExampleBanner from './components/ExampleBanner.vue';
const HomePage=defineAsyncComponent(()=>import('./views/HomePage.vue'));
const MaterialsPage=defineAsyncComponent(()=>import('./views/MaterialsPage.vue'));
const MaterialDetail=defineAsyncComponent(()=>import('./views/MaterialDetail.vue'));
const ProjectsPage=defineAsyncComponent(()=>import('./views/ProjectsPage.vue'));
const ProjectDetail=defineAsyncComponent(()=>import('./views/ProjectDetail.vue'));
const PatternLibrary=defineAsyncComponent(()=>import('./views/PatternLibrary.vue'));
const PatternEditor=defineAsyncComponent(()=>import('./views/PatternEditor.vue'));
const ShoppingPage=defineAsyncComponent(()=>import('./views/ShoppingPage.vue'));
const LocationsPage=defineAsyncComponent(()=>import('./views/LocationsPage.vue'));
const SettingsPage=defineAsyncComponent(()=>import('./views/SettingsPage.vue'));
const HelpPage=defineAsyncComponent(()=>import('./views/HelpPage.vue'));
const views={home:HomePage,materials:MaterialsPage,material:MaterialDetail,projects:ProjectsPage,project:ProjectDetail,patterns:PatternLibrary,pattern:PatternEditor,shopping:ShoppingPage,locations:LocationsPage,settings:SettingsPage,help:HelpPage};
const navigation=[{page:'home',icon:House},{page:'materials',icon:Package},{page:'projects',icon:FolderHeart},{page:'patterns',icon:Grid2X2},{page:'shopping',icon:ShoppingBag}];
const utility=[{page:'locations',icon:MapPin},{page:'settings',icon:Settings2},{page:'help',icon:BookOpen}];
const current=computed(()=>({material:'materials',project:'projects',pattern:'patterns'})[route.value.page]||route.value.page);
const search=ref(''),searchInput=ref(),languageError=ref(''),pendingDraft=ref(false);
let unsubscribeClose;
function draftStatus(event){pendingDraft.value=event.detail?.pending===true;if(windowControls?.setCloseGuard)windowControls.setCloseGuard(pendingDraft.value).catch(error=>{languageError.value=errorText(error);});}
function requestClose(){const event=new CustomEvent('ricamo:before-close',{cancelable:true});if(window.dispatchEvent(event))windowControls?.finishClose().catch(()=>{});}
const results=computed(()=>{
  const query=normalize(search.value);if(query.length<2)return [];
  return [...state.value.materials.map(row=>({...row,page:'material',area:'materials'})),...state.value.projects.map(row=>({...row,page:'project',area:'projects'})),...state.value.patterns.map(row=>({...row,page:'pattern',area:'patterns'})),...state.value.locations.map(row=>({...row,page:'locations',area:'locations'}))].filter(row=>normalize([row.id,row.name,row.brand,row.code,row.notes,...(row.tags||[]),row.page==='material'?materialSearchDescriptors(row):row.page==='pattern'?patternLibrarySearch(row):''].join(' ')).includes(query)).sort((a,b)=>Number(b.code===search.value)-Number(a.code===search.value)).slice(0,8);
});
function choose(result){navigate(result.page,result.id);search.value='';}
function shortcut(event){if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();searchInput.value?.focus();}if(event.key==='Escape')search.value='';}
async function setLanguage(event){try{await changeLanguage(event.target.value);languageError.value='';}catch(error){languageError.value=errorText(error);}}
onMounted(()=>{initialise();window.addEventListener('keydown',shortcut);window.addEventListener('ricamo:draft-state',draftStatus);window.addEventListener('ricamo:request-close',requestClose);if(onCloseRequest)unsubscribeClose=onCloseRequest(requestClose);});
onBeforeUnmount(()=>{window.removeEventListener('keydown',shortcut);window.removeEventListener('ricamo:draft-state',draftStatus);window.removeEventListener('ricamo:request-close',requestClose);unsubscribeClose?.();});
</script>
<template>
  <div v-if="!ready" class="loading"><div v-if="loadingError"><h1>Ricamo</h1><p role="alert">{{ loadingError }}</p><button class="button primary" @click="initialise">{{ t('retry') }}</button></div><span v-else>Ricamo…</span></div>
  <div v-else class="app-shell">
    <a href="#main-content" class="sr-only">{{ t('skipContent') }}</a>
    <aside class="sidebar"><div class="brand"><Flower2 class="brand-mark" :stroke-width="1.1" aria-hidden="true" /><span class="brand-name">ricamo<span class="brand-dot">.</span></span></div><p class="nav-group-label">{{ t('studio') }}</p><nav class="nav-list" :aria-label="t('studio')"><button v-for="item in navigation" :key="item.page" class="nav-item" :class="{selected:current===item.page}" :title="t(item.page)" :aria-label="t(item.page)" :aria-current="current===item.page?'page':undefined" @click="navigate(item.page)"><component :is="item.icon" :size="19" :stroke-width="1.6" /><span class="nav-label">{{ t(item.page) }}</span><span v-if="item.page==='projects'&&state.projects.filter(row=>row.status==='active').length" class="nav-count" aria-hidden="true">{{ state.projects.filter(row=>row.status==='active').length }}</span></button></nav><p class="nav-group-label">{{ t('tools') }}</p><nav class="nav-list" :aria-label="t('tools')"><button v-for="item in utility" :key="item.page" class="nav-item" :class="{selected:current===item.page}" :title="t(item.page)" :aria-label="t(item.page)" :aria-current="current===item.page?'page':undefined" @click="navigate(item.page)"><component :is="item.icon" :size="19" :stroke-width="1.6" /><span class="nav-label">{{ t(item.page) }}</span></button></nav><div class="sidebar-bottom"><p class="offline-indicator"><span class="offline-dot" />{{ t('offline') }}</p><small class="muted" style="font-size:.65rem">Ricamo · {{ APP_VERSION }}</small></div></aside>
    <div class="workspace"><header class="topbar"><div class="global-search"><Search :size="18" /><input ref="searchInput" v-model="search" :placeholder="t('search')" :aria-label="t('search')" autocomplete="off" /><span class="search-shortcut">Ctrl K</span><div v-if="search.length>=2" class="search-results"><button v-for="result in results" :key="`${result.page}-${result.id}`" class="search-result" @click="choose(result)"><strong>{{ result.name }}</strong><small>{{ t(result.area) }}<template v-if="result.code"> · {{ result.code }}</template></small></button><p v-if="!results.length" class="field-help" style="padding:12px">{{ t('noResults') }}</p></div></div><div class="topbar-right"><span class="save-state" role="status"><CheckCheck :size="15" />{{ saving?t('saving'):pendingDraft?t('unsaved'):t('saved') }}</span><select class="language-switch" :value="language" :aria-label="t('language')" @change="setLanguage"><option value="it">IT</option><option value="en">EN</option></select><button class="icon-button" :aria-label="t('help')" @click="navigate('help')"><BookOpen :size="19" /></button></div></header><p v-if="languageError" class="notice error" role="alert">{{ languageError }}</p><ExampleBanner v-if="exampleMode"/><main id="main-content"><component :is="views[route.page]||HomePage" :id="route.id" :key="`${route.page}-${route.id||''}`" /></main></div>
    <div v-if="toast" class="toast" role="status">{{ toast }}</div>
  </div>
</template>
