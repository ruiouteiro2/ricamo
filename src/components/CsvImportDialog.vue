<script setup>
import { ref, computed } from 'vue';
import { Upload, AlertTriangle } from '@lucide/vue';
import { state, dispatch, notify } from '../state';
import { t, language, errorText } from '../i18n';
import { parseCsv, detectDelimiter, guessMapping, previewInventory, CSV_FIELDS } from '../../core/csv.mjs';
import { digestBytes } from '../../core/files.mjs';
import AppDialog from './AppDialog.vue';
import FormField from './FormField.vue';
const emit=defineEmits(['close']);
const rows=ref([]),mapping=ref({}),delimiter=ref(';'),decimal=ref(language.value==='it'?',':'.'),encoding=ref('utf-8'),skipDuplicates=ref(true),allowRepeat=ref(false),error=ref(''),busy=ref(false),fileName=ref(''),digest=ref(''),page=ref(0);
let bytes;
const preview=computed(()=>previewInventory(rows.value,mapping.value,state.value,{decimal:decimal.value,skipDuplicates:skipDuplicates.value}));
const invalid=computed(()=>preview.value.filter(row=>!row.skip&&row.issues.length));
const selected=computed(()=>preview.value.filter(row=>!row.skip));
const repeat=computed(()=>state.value.audit.some(row=>row.kind==='csv_import'&&row.digest===digest.value));
function decode(){let value;try{value=new TextDecoder(encoding.value,{fatal:true}).decode(bytes);}catch{throw Object.assign(new Error(),{code:'invalid_file_encoding'});}return value;}
function parse(){try{rows.value=parseCsv(decode(),delimiter.value);mapping.value=guessMapping(rows.value[0]||[]);error.value='';page.value=0;}catch(caught){error.value=errorText(caught);}}
async function fileChosen(event){const file=event.target.files?.[0];if(!file)return;try{if(file.size>10*1024*1024)throw Object.assign(new Error(),{code:'file_too_large'});bytes=new Uint8Array(await file.arrayBuffer());digest.value=await digestBytes(bytes);fileName.value=file.name;if(bytes[0]===255&&bytes[1]===254)encoding.value='utf-16le';else if(bytes[0]===254&&bytes[1]===255)encoding.value='utf-16be';else encoding.value='utf-8';delimiter.value=detectDelimiter(decode());parse();}catch(caught){error.value=errorText(caught);}}
async function commit(){if(busy.value||invalid.value.length||!selected.value.length)return;busy.value=true;try{await dispatch('inventory.import',{digest:digest.value,allowRepeat:allowRepeat.value,createLocations:true,rows:preview.value.map(row=>({...row,lot:row.lot?{...row.lot,locationName:row.locationText}:null}))});notify();emit('close');}catch(caught){error.value=errorText(caught);}finally{busy.value=false;}}
</script>
<template>
  <AppDialog :title="t('importCsv')" wide :busy="busy" @close="emit('close')">
    <p class="notice">{{ t('importHelp') }}</p><p v-if="error" class="notice error" role="alert">{{ error }}</p>
    <FormField :label="t('chooseFile')" v-slot="{id}"><input :id="id" type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" @change="fileChosen" /></FormField>
    <template v-if="rows.length">
      <div class="form-grid form-section"><FormField :label="t('delimiter')" v-slot="{id}"><select :id="id" v-model="delimiter" @change="parse"><option value=";">;</option><option value=",">,</option><option :value="'\t'">Tab</option></select></FormField><FormField :label="t('decimal')" v-slot="{id}"><select :id="id" v-model="decimal"><option value=",">1,5</option><option value=".">1.5</option></select></FormField><FormField :label="t('encoding')" v-slot="{id}"><select :id="id" v-model="encoding" @change="parse"><option value="utf-8">UTF-8</option><option value="utf-16le">UTF-16 LE</option><option value="utf-16be">UTF-16 BE</option><option value="windows-1252">Windows-1252</option></select></FormField></div>
      <details open><summary>{{ t('columnMapping') }}</summary><div class="form-grid"><FormField v-for="field in CSV_FIELDS" :key="field" :label="t(field)" v-slot="{id}"><select :id="id" v-model="mapping[field]"><option :value="-1">{{ t('none') }}</option><option v-for="(header,index) in rows[0]" :key="index" :value="index">{{ header }}</option></select></FormField></div></details>
      <div class="form-section"><label class="checkbox-label"><input v-model="skipDuplicates" type="checkbox" />{{ t('skipDuplicates') }}</label><p class="field-help" style="margin-top:8px">{{ t('csvLocationsHelp') }}</p><p v-if="repeat" class="notice warning" style="margin-top:16px"><AlertTriangle :size="17" />{{ t('repeatImportWarning') }}</p><label v-if="repeat" class="checkbox-label"><input v-model="allowRepeat" type="checkbox" />{{ t('allowRepeatImport') }}</label></div>
      <div class="split-heading"><h3>{{ t('preview') }} · {{ selected.length }} / {{ preview.length }}</h3><span v-if="invalid.length" class="badge danger">{{ invalid.length }} {{ t('invalidRows') }}</span></div>
      <div class="table-wrap"><table><thead><tr><th>#</th><th>{{ t('name') }}</th><th>{{ t('code') }}</th><th>{{ t('quantity') }}</th><th>{{ t('status') }}</th></tr></thead><tbody><tr v-for="row in preview.slice(page*50,page*50+50)" :key="row.line"><td>{{ row.line }}</td><td><input v-if="mapping.name>=0" v-model="rows[row.line-1][mapping.name]" :aria-label="`${t('name')} ${row.line}`" style="min-width:160px" /><span v-else>—</span></td><td><input v-if="mapping.code>=0" v-model="rows[row.line-1][mapping.code]" :aria-label="`${t('code')} ${row.line}`" style="min-width:90px" /><span v-else>—</span></td><td><input v-if="mapping.quantity>=0" v-model="rows[row.line-1][mapping.quantity]" :aria-label="`${t('quantity')} ${row.line}`" style="min-width:90px" /><span v-else>{{ t('unknown') }}</span></td><td><span v-if="row.skip" class="badge">{{ t('skipped') }}</span><span v-else-if="row.issues.length" class="badge danger">{{ row.issues.map(key=>t(key)).join(', ') }}</span><span v-else class="badge green">{{ row.duplicate?t('newLot'):t('ready') }}</span></td></tr></tbody></table></div>
      <div v-if="preview.length>50" class="actions" style="margin-top:12px"><button class="button small" :disabled="page===0" @click="page--">←</button><span>{{ page+1 }} / {{ Math.ceil(preview.length/50) }}</span><button class="button small" :disabled="(page+1)*50>=preview.length" @click="page++">→</button></div>
    </template>
    <template #footer><button class="button" :disabled="busy" @click="emit('close')">{{ t('cancel') }}</button><button class="button primary" :disabled="busy||!selected.length||invalid.length>0||(repeat&&!allowRepeat)" @click="commit"><Upload :size="15" />{{ t('importConfirm') }}</button></template>
  </AppDialog>
</template>
