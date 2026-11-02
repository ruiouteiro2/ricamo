<script setup>
import { ref } from 'vue';
import { Download, Upload, ShieldCheck, Languages, FileSpreadsheet, Info } from '@lucide/vue';
import { state, dispatch, notify } from '../state';
import { storage, desktop } from '../storage';
import { exampleMode } from '../example-mode.mjs';
import { t, language, errorText } from '../i18n';
import { createDiagnostics } from '../../core/diagnostics.mjs';
import { exportOpenData } from '../../core/open-exports.mjs';
import { APP_VERSION as applicationVersion } from '../../core/version.mjs';
import PageHeader from '../components/PageHeader.vue';
import FormField from '../components/FormField.vue';
import AppDialog from '../components/AppDialog.vue';
import CsvImportDialog from '../components/CsvImportDialog.vue';
import ThreadCatalogueManager from '../components/ThreadCatalogueManager.vue';
import SupplierCatalogues from '../components/SupplierCatalogues.vue';
import FullBackupPanel from '../components/FullBackupPanel.vue';
const diagnostics=ref(null);
const exportFormat=ref('csv'), exporting=ref(false);
const showImport=ref(false),error=ref('');
async function setting(key,value){try{await dispatch('settings.save',{[key]:value});notify();}catch(caught){error.value=errorText(caught);}}
const entryPreferenceBusy=ref(false);
async function setMaterialEntryPreference(event){
 const control=event.target;entryPreferenceBusy.value=true;error.value='';
 try{await dispatch('settings.save',{preferences:{...state.value.settings.preferences,keepMaterialFormOpen:control.checked}});notify();}
 catch(caught){error.value=errorText(caught);control.checked=state.value.settings.preferences?.keepMaterialFormOpen!==false;}
 finally{entryPreferenceBusy.value=false;}
}
async function exportData(type){if(exporting.value)return;exporting.value=true;error.value='';const format=exportFormat.value;try{const data=exportOpenData(state.value,type,{format,language:language.value});if(await storage.saveFile({name:`ricamo-${type}.${format}`,data}))notify();}catch(caught){error.value=errorText(caught);}finally{exporting.value=false;}}
function inspectDiagnostics(){diagnostics.value=JSON.stringify(createDiagnostics(state.value,{storage:desktop?'sqlite':'indexeddb'}),null,2)}
async function saveDiagnostics(){if(exporting.value)return;exporting.value=true;error.value='';try{if(await storage.saveFile({name:'ricamo-diagnostics.json',data:diagnostics.value}))notify()}catch(caught){error.value=errorText(caught)}finally{exporting.value=false}}
</script>
<template>
  <div class="page"><PageHeader :eyebrow="t('settings')" :title="t('settingsTitle')" />
    <p v-if="error" class="notice error" role="alert">{{ error }}</p>
    <section class="panel material-entry-settings"><div class="panel-heading"><h2>{{t('materialEntrySettings')}}</h2></div><div class="panel-body"><label class="checkbox-label" for="keep-material-form-open"><input id="keep-material-form-open" class="switch-control" type="checkbox" role="switch" :checked="state.settings.preferences?.keepMaterialFormOpen!==false" :disabled="entryPreferenceBusy" aria-describedby="material-entry-preference-help" @change="setMaterialEntryPreference"/>{{t('keepMaterialFormOpen')}}</label><p id="material-entry-preference-help" class="field-help">{{t('keepMaterialFormOpenHelp')}}</p></div></section>
    <div class="settings-grid"><SupplierCatalogues/><ThreadCatalogueManager/><section class="panel"><div class="panel-heading"><h2>{{ t('preferences') }}</h2><Languages :size="20" class="muted" /></div><div class="panel-body"><div class="form-grid"><FormField :label="t('language')" wide v-slot="{id}"><select :id="id" :value="state.settings.language" @change="setting('language',$event.target.value)"><option value="it">Italiano</option><option value="en">English</option></select></FormField><FormField :label="t('currency')" v-slot="{id}"><select :id="id" :value="state.settings.currency" @change="setting('currency',$event.target.value)"><option v-for="currency in ['EUR','GBP','USD','CHF','CAD','AUD','JPY','BRL']" :key="currency">{{ currency }}</option></select></FormField><FormField :label="t('paper')" v-slot="{id}"><select :id="id" :value="state.settings.paper" @change="setting('paper',$event.target.value)"><option value="a4">A4</option><option value="letter">Letter</option></select></FormField></div></div></section>
    <FullBackupPanel />
    <section class="panel"><div class="panel-heading"><h2>{{ t('data') }}</h2><FileSpreadsheet :size="20" class="muted" /></div><div class="panel-body"><p class="field-help">{{ t('importHelp') }}</p><FormField :label="t('openExportFormat')" v-slot="{id}"><select :id="id" v-model="exportFormat" :disabled="exporting"><option value="csv">CSV</option><option value="tsv">TSV</option><option value="json">JSON</option></select></FormField><p class="field-help">{{t('openExportHelp')}}</p><p v-if="exporting" class="field-help" role="status">{{t('openExportPreparing')}}</p><div class="actions" style="margin:18px 0;flex-wrap:wrap"><button class="button primary" @click="showImport=true"><Upload :size="16" />{{ t('importCsv') }}</button><button class="button" :disabled="exporting" @click="exportData('inventory')"><Download :size="16" />{{ t('openExportInventory') }}</button></div><div class="actions" style="flex-wrap:wrap"><button v-for="type in ['movements','projects','purchases']" :key="type" class="button small" :disabled="exporting" @click="exportData(type)">{{ t('export') }} · {{ t(type==='movements'?'history':type==='purchases'?'shopping':type) }}</button></div></div></section>
    <section class="panel"><div class="panel-heading"><h2>{{ t('about') }}</h2><Info :size="20" class="muted" /></div><div class="panel-body"><h3 style="font-family:Georgia,serif;font-size:25px;font-weight:400">Ricamo <span class="muted" style="font:12px 'Segoe UI',sans-serif">{{applicationVersion}}</span></h3><p class="notice"><ShieldCheck :size="20" />{{ t('privacy') }}</p><div class="actions form-section"><button class="button small" @click="inspectDiagnostics">{{t('diagnosticsTitle')}}</button></div><p class="field-help">{{ t('colorAttribution') }}</p><p class="field-help" style="margin-top:12px">Vue · Electron · SQLite · jsPDF · Lucide</p><p v-if="!desktop && !exampleMode" class="notice warning" style="margin-top:16px">{{ t('browserPreviewHelp') }}</p></div></section></div>
<AppDialog v-if="diagnostics" :title="t('diagnosticsTitle')" wide :busy="exporting" @close="diagnostics=null"><p class="notice">{{t('diagnosticsHelp')}}</p><p v-if="error" class="notice error" role="alert">{{error}}</p><FormField :label="t('diagnosticsPreview')" v-slot="{id}"><textarea :id="id" :value="diagnostics" readonly rows="18" class="mono"/></FormField><template #footer><button class="button" :disabled="exporting" @click="diagnostics=null">{{t('close')}}</button><button class="button primary" :disabled="exporting" @click="saveDiagnostics"><Download :size="16"/>{{t('export')}}</button></template></AppDialog>
    <CsvImportDialog v-if="showImport" @close="showImport=false" />
  </div>
</template>
