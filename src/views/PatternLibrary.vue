<script setup>
import ReferenceBatchImport from '../components/ReferenceBatchImport.vue';
import { computed, ref, shallowRef, reactive, onBeforeUnmount, watch, nextTick } from 'vue';
import { Star, Plus, ImagePlus, Grid2X2, FileUp, Search, Archive, Copy, FolderPlus, FileImage, X, RotateCw, FlipHorizontal2, FlipVertical2 } from '@lucide/vue';
import PageHeader from '../components/PageHeader.vue';
import EmptyState from '../components/EmptyState.vue';
import AppDialog from '../components/AppDialog.vue';
import FormField from '../components/FormField.vue';
import PatternDetails from '../components/PatternDetails.vue';
import {patternLibrarySearch} from '../../core/pattern-library.mjs';
import PatternThumbnail from '../components/PatternThumbnail.vue';
import {selectedThreadPalette,threadCatalogueVersions} from '../thread-catalogues.mjs';
import GeneratorOptions from '../components/GeneratorOptions.vue';
import {watchPaletteRestrictions} from '../generator-palette.mjs';
import {fabricSize} from '../../core/fabric.mjs';
import GeneratorQuality from '../components/GeneratorQuality.vue';
import { state, dispatch, navigate, notify, createPatternWithAsset, normalize } from '../state';
import { detectFile, digestBytes } from '../../core/files.mjs';
import { t, number, date, errorText } from '../i18n';
import { dmcPalette, inventoryPalette, preferredInventoryPalette, validateSettings, prepareBackground, DEFAULT_SETTINGS, importLegacy } from '../engine/adapter.mjs';
import { createBlank, validateRevision, counts } from '../../core/pattern.mjs';
import { drawPattern } from '../pattern-render.mjs';
import {prepareStandalonePattern} from '../../core/pattern-import.mjs';

const referenceBatch=ref(false);
const collection=ref(''),technique=ref(''),favorites=ref(false);
const collectionOptions=computed(()=>[...new Set(state.value.patterns.flatMap(p=>p.library?.collections??[]))].sort((a,b)=>a.localeCompare(b)));
const techniqueOptions=computed(()=>[...new Set(state.value.patterns.map(p=>p.library?.technique).filter(Boolean))].sort((a,b)=>a.localeCompare(b)));
const search = ref(''), filter = ref('active'), dialog = ref(''), error = ref(''), busy = ref(false);
const imageInput = ref(), nativeInput = ref(), sourceCanvas = ref(), resultCanvas = ref();
const title = ref(''), sourceAsset = ref(null), bitmap = ref(null), generated = shallowRef(null), paletteKind = ref('catalogue');
const sourceFile = shallowRef(null), previous=shallowRef(null);
const generationOptions=reactive({background:{mode:'transparent',color:'#ffffff',tolerance:12},fixedColors:[],excludedColors:[]}),restrictionsReset=ref(false);
const catalogueId=ref('bundled-dmc'),catalogueVersions=computed(()=>threadCatalogueVersions(state.value));
const livePalette=computed(()=>{try{return paletteKind.value==='inventory'?inventoryPalette(state.value.materials,state.value.lots):paletteKind.value==='preferred'?preferredInventoryPalette(state.value.materials,state.value.lots,{tolerance:preferenceTolerance.value}):selectedThreadPalette(state.value,catalogueId.value);}catch{return null}});
const physical=computed(()=>{try{return fabricSize({width:settings.width,height:settings.height,countX:settings.count})}catch{return null}});

function previewStats(value){return t('generationPreviewStats',{width:value.width,height:value.height,colors:value.colors.length,stitches:counts(value).total,limit:value.settings.maxColors});}
const settings = reactive({ ...DEFAULT_SETTINGS }), adjustments = reactive({ x: 0, y: 0, width: 100, height: 100, rotation: 0, flipX: false, flipY: false, brightness: 100, contrast: 100 });
const protectedRegions=ref([]),protection=reactive({x:1,y:1,width:3,height:3}),protectionReset=ref(false),preferenceTolerance=ref(6);
const keepRatio = ref(true), taskId = ref(null), pendingInput = ref(null), previewVersion = ref('');
watchPaletteRestrictions(()=>[paletteKind.value,livePalette.value],generationOptions,()=>{restrictionsReset.value=true;});
let worker, timeout, sourceToken = 0, creationAttempt;
const patterns = computed(() => state.value.patterns.filter(p => filter.value === 'all' || (filter.value === 'archived' ? p.archived : !p.archived)).filter(p => normalize(patternLibrarySearch(p)).includes(normalize(search.value))).filter(p=>(!collection.value||p.library?.collections?.includes(collection.value))&&(!technique.value||p.library?.technique===technique.value)&&(!favorites.value||p.favorite)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
const fingerprint = () => JSON.stringify({ settings, adjustments,generationOptions, paletteKind: paletteKind.value, catalogueId:catalogueId.value, preferenceTolerance:preferenceTolerance.value,protectedRegions:protectedRegions.value,inventory:paletteKind.value==='catalogue'?null:{materials:state.value.materials,lots:state.value.lots,reservations:state.value.reservations},source: sourceAsset.value?.digest });
const stalePreview = computed(() => Boolean(generated.value) && previewVersion.value !== fingerprint());
const current = pattern => pattern.revisions?.find(r => r.id === pattern.currentRevisionId);
const validDimensions = () => {
  if (!bitmap.value) return;
  const w = bitmap.value.width * adjustments.width, h = bitmap.value.height * adjustments.height;
  return adjustments.rotation % 180 ? h / w : w / h;
};
function resizeFrom(axis) {
  if (!keepRatio.value || !bitmap.value) return;
  const ratio = validDimensions();
  if (!ratio || !Number.isFinite(settings[axis])) return;
  if (axis === 'width') settings.height = Math.max(1, Math.min(500, Math.round(settings.width / ratio)));
  else settings.width = Math.max(1, Math.min(500, Math.round(settings.height * ratio)));
}
function transformed(width, height) {
  if (!bitmap.value) throw Error('image_required');
  const crop = adjustments;
  if (![crop.x, crop.y, crop.width, crop.height].every(Number.isFinite) || crop.x < 0 || crop.y < 0 || crop.width <= 0 || crop.height <= 0 || crop.x + crop.width > 100 || crop.y + crop.height > 100) throw Object.assign(Error(), { code: 'patternCrop' });
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const quarter = crop.rotation % 180 !== 0;
  ctx.translate(width / 2, height / 2); ctx.rotate(crop.rotation * Math.PI / 180); ctx.scale(crop.flipX ? -1 : 1, crop.flipY ? -1 : 1);
  ctx.filter = `brightness(${crop.brightness}%) contrast(${crop.contrast}%)`;
  const outWidth = quarter ? height : width, outHeight = quarter ? width : height;
  ctx.drawImage(bitmap.value, bitmap.value.width * crop.x / 100, bitmap.value.height * crop.y / 100, bitmap.value.width * crop.width / 100, bitmap.value.height * crop.height / 100, -outWidth / 2, -outHeight / 2, outWidth, outHeight);
  return canvas;
}
function drawSource() {
  if (!bitmap.value || !sourceCanvas.value) return;
  try {
    const ratio = validDimensions() || 1, w = ratio >= 1 ? 440 : Math.round(300 * ratio), h = ratio >= 1 ? Math.round(440 / ratio) : 300;
    const removal=generationOptions.background.mode==='remove';
    const rendered = transformed(removal?settings.width:Math.max(1,w),removal?settings.height:Math.max(1,h));
    if(generationOptions.background.mode!=='transparent'){const context=rendered.getContext('2d'),pixels=context.getImageData(0,0,rendered.width,rendered.height);pixels.data.set(prepareBackground(pixels.data,generationOptions.background,rendered.width,rendered.height));context.putImageData(pixels,0,0);}
    sourceCanvas.value.width=Math.max(1,w);sourceCanvas.value.height=Math.max(1,h);const preview=sourceCanvas.value.getContext('2d');preview.imageSmoothingEnabled=!removal;preview.drawImage(rendered,0,0,sourceCanvas.value.width,sourceCanvas.value.height);
    const overlay=sourceCanvas.value.getContext('2d');overlay.strokeStyle='#b06e12';overlay.lineWidth=2;for(const r of protectedRegions.value)overlay.strokeRect(r.x/settings.width*sourceCanvas.value.width,r.y/settings.height*sourceCanvas.value.height,r.width/settings.width*sourceCanvas.value.width,r.height/settings.height*sourceCanvas.value.height);
  } catch { /* Input validation is shown when generation is requested. */ }
}
watch(()=>generationOptions.background,drawSource,{deep:true});
watch(adjustments, () => { resizeFrom('width'); drawSource(); });
watch(()=>JSON.stringify([adjustments.x,adjustments.y,adjustments.width,adjustments.height,adjustments.rotation,adjustments.flipX,adjustments.flipY,settings.width,settings.height]),()=>{if(protectedRegions.value.length){protectedRegions.value=[];protectionReset.value=true;}drawSource();});
watch(protectedRegions,drawSource,{deep:true});
function addProtection(){error.value='';const r={x:protection.x-1,y:protection.y-1,width:protection.width,height:protection.height};if(!Object.values(r).every(Number.isInteger)||r.x<0||r.y<0||r.width<1||r.height<1||r.x+r.width>settings.width||r.y+r.height>settings.height||protectedRegions.value.length>=20){error.value=t('protectionInvalid');return}protectedRegions.value=[...protectedRegions.value,r];protectionReset.value=false;}

watch(generated, async value => { await nextTick(); if (value && resultCanvas.value) { const cellSize = Math.min(440 / value.width, 300 / value.height); drawPattern(resultCanvas.value, value, { cellSize, width: value.width * cellSize, height: value.height * cellSize }); } });
function cancelGeneration() { taskId.value = null; worker?.terminate(); worker = null; clearTimeout(timeout); busy.value = false; }
function closeDialog() { cancelGeneration();previous.value=null;generated.value=null; dialog.value = ''; error.value = ''; bitmap.value?.close(); bitmap.value = null; sourceFile.value = null; sourceAsset.value = null; creationAttempt = null; sourceToken++; }
function startBlank() { error.value = ''; title.value = ''; Object.assign(settings, DEFAULT_SETTINGS, { width: 60, height: 60 }); dialog.value = 'blank'; }
async function chooseImage(event) {
  const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
  const token = ++sourceToken; error.value = ''; busy.value = true;
  let decoded;
  try {
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type) || file.size > 25 * 1024 * 1024) throw Object.assign(Error(), { code: 'invalid_file' });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = detectFile(bytes), digest = await digestBytes(bytes);
    decoded = await createImageBitmap(file, { imageOrientation: 'from-image' });
    if (decoded.width * decoded.height > 40_000_000 || decoded.width > 20000 || decoded.height > 20000) { decoded.close(); throw Object.assign(Error(), { code: 'file_too_large' }); }
    if (token !== sourceToken) { decoded.close(); return; }
    bitmap.value?.close(); bitmap.value = decoded; sourceFile.value = file;
    sourceAsset.value = { id: null, name: file.name, mime, digest, size: bytes.length }; title.value = file.name.replace(/\.[^.]+$/, '');
    Object.assign(adjustments, { x: 0, y: 0, width: 100, height: 100, rotation: 0, flipX: false, flipY: false, brightness: 100, contrast: 100 });
    Object.assign(settings, DEFAULT_SETTINGS);Object.assign(generationOptions,{background:{mode:'transparent',color:'#ffffff',tolerance:12},fixedColors:[],excludedColors:[]});previous.value=null;restrictionsReset.value=false;protectedRegions.value=[];protectionReset.value=false; keepRatio.value = true; resizeFrom('width'); generated.value = null; dialog.value = 'image';
    await nextTick(); drawSource();
  } catch (caught) { error.value = errorText(caught); }
  finally { if (decoded && decoded !== bitmap.value) decoded.close(); if (token === sourceToken) busy.value = false; }
}
function generate() {
  if (busy.value) return;
  error.value = '';
  try {
    const effectiveSettings=validateSettings({...settings,protectedRegions:protectedRegions.value,...(generationOptions.background.mode==='transparent'?{}:{background:{mode:generationOptions.background.mode,...(['color','remove'].includes(generationOptions.background.mode)?{color:generationOptions.background.color}:{}),...(generationOptions.background.mode==='remove'?{tolerance:generationOptions.background.tolerance}:{})}}),fixedColors:generationOptions.fixedColors,excludedColors:generationOptions.excludedColors});
    const effectivePalette = paletteKind.value === 'inventory' ? inventoryPalette(state.value.materials, state.value.lots) : paletteKind.value==='preferred'?preferredInventoryPalette(state.value.materials,state.value.lots,{tolerance:preferenceTolerance.value}):selectedThreadPalette(state.value,catalogueId.value);
    const canvas = transformed(effectiveSettings.width, effectiveSettings.height), rgba = canvas.getContext('2d').getImageData(0, 0, effectiveSettings.width, effectiveSettings.height).data;
    const id = crypto.randomUUID(), inputHash = fingerprint(); taskId.value = id; busy.value = true;
    worker = new Worker(new URL('../engine/worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = event => {
      if (event.data.id !== taskId.value) return;
      const result = event.data; cancelGeneration();
      if (result.error) error.value = patternError(result.error);
      else { previous.value=generated.value;generated.value = result.result; previewVersion.value = inputHash; }
    };
    worker.onerror = () => { cancelGeneration(); error.value = t('generationFailed'); };
    timeout = setTimeout(() => { if (taskId.value === id) { cancelGeneration(); error.value = t('generationTimeout'); } }, 120000);
    worker.postMessage({ id, rgba, settings: effectiveSettings, palette: effectivePalette, source: { attachmentId: sourceAsset.value.id, digest: sourceAsset.value.digest, adjustments: { ...adjustments } } }, [rgba.buffer]);
  } catch (caught) { cancelGeneration(); error.value = patternError(caught); }
}
function patternError(caught) { const code = caught?.code || caught?.message; return code === 'engine.inventoryPaletteEmpty' ? t('inventoryPaletteEmpty') : code === 'patternCrop' ? t('patternCrop') : errorText(caught); }
async function saveNew() {
  if (busy.value || !title.value.trim()) return;
  busy.value = true; error.value = '';
  try {
    let revision;
    if (dialog.value === 'blank') revision = createBlank(settings.width, settings.height, dmcPalette.colors.filter(c => ['310', 'B5200', '321', '700', '444', '820'].includes(c.code)).map((c, i) => ({ ...c, brand: 'DMC', symbol: 'ABCDEF'[i], strands: 2 })), { settings: { ...settings }, provenance: { source: 'blank' } });
    else { if (!generated.value || stalePreview.value) throw Error('stale_preview'); revision = structuredClone(generated.value); }
    revision.name = t('initialRevision');
    let id;
    if (dialog.value === 'image') {
      const pattern = { name: title.value.trim(), kind: 'structured', revision };
      const fingerprint = JSON.stringify(pattern);
      if (creationAttempt?.fingerprint !== fingerprint) creationAttempt = { fingerprint, operationId: crypto.randomUUID() };
      const result = await createPatternWithAsset(sourceFile.value, pattern, creationAttempt.operationId);
      id = result.patternId;
    } else {
      id = crypto.randomUUID(); revision.id = crypto.randomUUID();
      await dispatch('pattern.save', { id, name: title.value.trim(), sourceAttachmentId: null, revision });
    }
    closeDialog(); notify(t('patternSaved')); navigate('pattern', id);
  } catch (caught) { error.value = patternError(caught); }
  finally { busy.value = false; }
}
async function importNative(event) {
  const file = event.target.files?.[0]; event.target.value = ''; if (!file || busy.value) return;
  error.value = ''; busy.value = true;
  try {
    if (file.size > 25 * 1024 * 1024) throw Object.assign(Error(), { code: 'file_too_large' });
    const data = JSON.parse(await file.text()); let revision, name;
    if (data.format === 'ricamo-pattern' && data.version === 1) { revision = structuredClone(data.revision); validateRevision(revision); name = data.name; }
    else { revision = importLegacy(data); name = data.title; }
    pendingInput.value = { ...prepareStandalonePattern(revision), name: typeof name === 'string' ? name : file.name };
    title.value = pendingInput.value.name; dialog.value = 'native';
  } catch (caught) { error.value = errorText(caught); } finally { busy.value = false; }
}
async function confirmImport() {
  if (busy.value || !title.value.trim()) return;
  busy.value = true;
  try { const id = crypto.randomUUID(); await dispatch('pattern.save', { id, name: title.value, revision: { ...pendingInput.value.revision, id: crypto.randomUUID() } }); closeDialog(); navigate('pattern', id); notify(); }
  catch (caught) { error.value = errorText(caught); } finally { busy.value = false; }
}
async function favorite(pattern){try{await dispatch('pattern.save',{id:pattern.id,favorite:!pattern.favorite})}catch(caught){error.value=errorText(caught)}}
async function archive(pattern) { try { await dispatch('pattern.save', { id: pattern.id, archived: !pattern.archived }); notify(); } catch (caught) { error.value = errorText(caught); } }
async function duplicate(pattern) { try { await dispatch('pattern.duplicate', { id: pattern.id, name: `${pattern.name} — ${t('copyLabel')}` }); notify(); } catch (caught) { error.value = errorText(caught); } }
async function project(pattern) {
  try { const id = crypto.randomUUID(); await dispatch('project.save', { id, name: pattern.name, patternId: pattern.id, revisionId: pattern.currentRevisionId, status: 'preparing' }); navigate('project', id); notify(); }
  catch (caught) { error.value = errorText(caught); }
}
onBeforeUnmount(() => { cancelGeneration(); bitmap.value?.close(); sourceToken++; });
</script>

<template>
  <section class="page">
    <PageHeader :eyebrow="t('patterns')" :title="t('patternsTitle')" :description="t('patternsSubtitle')">
      <button class="button" :disabled="busy" @click="startBlank"><Grid2X2 :size="17" />{{ t('blankPattern') }}</button>
      <button class="button primary" :disabled="busy" @click="imageInput.click()"><ImagePlus :size="17" />{{ t('fromImage') }}</button>
    </PageHeader>
    <input ref="imageInput" class="sr-only" tabindex="-1" type="file" accept="image/png,image/jpeg,image/webp,image/gif" @change="chooseImage" />
    <input ref="nativeInput" class="sr-only" tabindex="-1" type="file" accept=".json,.ricamopattern,.stitch.json" @change="importNative" />
    <p v-if="error && !dialog" role="alert" class="notice error">{{ error }}</p>
    <div class="toolbar"><div class="toolbar-search"><Search :size="18" /><input v-model="search" :aria-label="t('searchPatterns')" :placeholder="t('searchPatterns')" /></div><select v-model="filter" :aria-label="t('status')"><option value="active">{{ t('active') }}</option><option value="archived">{{ t('archived') }}</option><option value="all">{{ t('all') }}</option></select><button class="button" :disabled="busy" @click="referenceBatch=true"><FileUp :size="16" />{{ t('importReference') }}</button><button class="button" :disabled="busy" @click="nativeInput.click()">{{ t('importPattern') }}</button></div>
    <div class="toolbar"><FormField :label="t('libraryCollections')" v-slot="{id}"><select :id="id" v-model="collection"><option value="">{{t('all')}}</option><option v-for="value in collectionOptions" :key="value" :value="value">{{value}}</option></select></FormField><FormField :label="t('library_technique')" v-slot="{id}"><select :id="id" v-model="technique"><option value="">{{t('all')}}</option><option v-for="value in techniqueOptions" :key="value" :value="value">{{value}}</option></select></FormField><label class="checkbox-label"><input v-model="favorites" type="checkbox"/>{{t('libraryFavoritesOnly')}}</label></div>
    <EmptyState v-if="!patterns.length" :icon="Grid2X2" :title="search ? t('noResults') : t('emptyPatterns')" :description="t('emptyPatternsBody')"><button class="button primary" @click="imageInput.click()">{{ t('fromImage') }}</button><button class="button" @click="startBlank">{{ t('blankPattern') }}</button></EmptyState>
    <div v-else class="project-grid">
      <article v-for="pattern in patterns" :key="pattern.id" class="project-card">
        <button class="project-cover" style="width:100%;border:0" :aria-label="`${t('openPattern')}: ${pattern.name}`" @click="navigate('pattern', pattern.id)"><PatternThumbnail v-if="current(pattern)" :revision="current(pattern)" :label="pattern.name" /><FileImage v-else :size="45" :stroke-width="1" /></button>
        <div class="project-card-body"><span v-if="pattern.draft" class="badge warning" style="margin-right:6px">{{ t('draftSaved') }}</span><span class="badge">{{ pattern.kind === 'reference' ? t('reference') : `${current(pattern)?.width} × ${current(pattern)?.height} ${t('stitches')}` }}</span><h3><button class="cell-title" @click="navigate('pattern', pattern.id)">{{ pattern.name }}</button></h3><p>{{ current(pattern)?.colors.length ?? '—' }} {{ t('colors') }} · {{ date(pattern.updatedAt) }}</p><div class="actions" style="flex-wrap:wrap"><PatternDetails :pattern="pattern"/><button class="icon-button" :aria-label="`${t('favorite')}: ${pattern.name}`" :aria-pressed="pattern.favorite" @click="favorite(pattern)"><Star :size="16" :fill="pattern.favorite?'currentColor':'none'"/></button><button class="button small" @click="project(pattern)"><FolderPlus :size="15" />{{ t('createProject') }}</button><button class="icon-button" :aria-label="`${t('duplicate')}: ${pattern.name}`" @click="duplicate(pattern)"><Copy :size="16" /></button><button class="icon-button" :aria-label="`${pattern.archived ? t('restore') : t('archive')}: ${pattern.name}`" @click="archive(pattern)"><Archive :size="16" /></button></div></div>
      </article>
    </div>

    <AppDialog v-if="dialog" :title="dialog === 'image' ? t('fromImage') : dialog === 'blank' ? t('blankPattern') : t('importPattern')" wide :busy="busy" @close="closeDialog">
      <p v-if="error" role="alert" class="notice error">{{ error }}</p>
      <FormField :label="t('name')" required v-slot="{ id }"><input :id="id" v-model="title" maxlength="300" autofocus /></FormField>
      <template v-if="dialog !== 'native'">
        <div class="form-section"><div class="form-grid"><FormField :label="`${t('width')} (${t('stitches')})`" v-slot="{ id }"><input :id="id" v-model.number="settings.width" type="number" min="1" max="500" @change="resizeFrom('width')" /></FormField><FormField :label="`${t('height')} (${t('stitches')})`" v-slot="{ id }"><input :id="id" v-model.number="settings.height" type="number" min="1" max="500" @change="resizeFrom('height')" /></FormField></div></div>
      </template>
      <template v-if="dialog === 'image'">
        <label class="checkbox-label"><input v-model="keepRatio" type="checkbox" @change="resizeFrom('width')" />{{ t('keepRatio') }}</label>
        <div class="form-section"><div class="form-grid"><FormField :label="t('palette')" v-slot="{ id }"><select :id="id" v-model="paletteKind"><option value="catalogue">{{ t('catalogue') }}</option><option value="inventory">{{ t('inventoryOnly') }}</option><option value="preferred">{{t('inventoryPreferred')}}</option></select></FormField><FormField v-if="paletteKind==='catalogue'" :label="t('threadCatalogueVersion')" v-slot="{id}"><select :id="id" v-model="catalogueId"><option v-for="row in catalogueVersions" :key="row.id" :value="row.id">{{row.name}} · {{row.version}}</option></select></FormField><FormField :label="t('maxColors')" v-slot="{ id }"><input :id="id" v-model.number="settings.maxColors" type="number" min="1" max="80" /></FormField><FormField :label="t('mode')" v-slot="{ id }"><select :id="id" v-model="settings.mode"><option v-for="mode in ['detail','balanced','simple']" :key="mode" :value="mode">{{ t(mode) }}</option></select></FormField><FormField :label="t('fabricCount')" v-slot="{ id }"><input :id="id" v-model.number="settings.count" type="number" min="6" max="40" step="0.1" /></FormField></div></div>
        <p v-if="physical" class="notice" role="status">{{t('generationPhysical',{width:number(physical.widthCm,2),height:number(physical.heightCm,2),columns:settings.width,rows:settings.height,count:settings.count})}}</p>
        <GeneratorOptions v-model:background="generationOptions.background" v-model:fixed="generationOptions.fixedColors" v-model:excluded="generationOptions.excludedColors" :palette="livePalette" :limit="Math.min(settings.maxColors,settings.mode==='simple'?16:settings.mode==='balanced'?40:80)"/><p v-if="restrictionsReset" class="notice warning">{{t('generationRestrictionsReset')}}</p>
        <p v-if="paletteKind!=='catalogue'" class="notice">{{t('inventoryGenerationHelp')}}</p><FormField v-if="paletteKind==='preferred'" :label="t('preferenceTolerance')" :help="t('preferenceRule')" v-slot="{id,describedby}"><input :id="id" v-model.number="preferenceTolerance" :aria-describedby="describedby" type="number" min="0" max="15" step="0.5" /></FormField>
        <details class="form-section"><summary>{{ t('imageAdjustments') }}</summary><div class="form-grid" style="margin-top:16px"><FormField v-for="field in ['x','y','width','height']" :key="field" :label="t(`crop_${field}`)" v-slot="{ id }"><input :id="id" v-model.number="adjustments[field]" type="number" :min="field === 'width' || field === 'height' ? 1 : 0" max="100" /></FormField><FormField :label="t('brightness')" v-slot="{ id }"><input :id="id" v-model.number="adjustments.brightness" type="range" min="20" max="180" /></FormField><FormField :label="t('contrast')" v-slot="{ id }"><input :id="id" v-model.number="adjustments.contrast" type="range" min="20" max="180" /></FormField><FormField :label="t('removeRegions')" :help="t('removeRegionsHelp')" v-slot="{ id }"><input :id="id" v-model.number="settings.region" type="number" min="0" max="30" /></FormField></div><div class="actions" style="margin-top:14px"><button class="button small" @click="adjustments.rotation = (adjustments.rotation + 90) % 360"><RotateCw :size="16" />{{ t('rotate') }}</button><button class="button small" :aria-pressed="adjustments.flipX" @click="adjustments.flipX = !adjustments.flipX"><FlipHorizontal2 :size="16" />{{ t('flipHorizontal') }}</button><button class="button small" :aria-pressed="adjustments.flipY" @click="adjustments.flipY = !adjustments.flipY"><FlipVertical2 :size="16" />{{ t('flipVertical') }}</button></div></details>
        <details class="form-section"><summary>{{t('protectedRegions')}}</summary><p class="field-help">{{t('protectionHelp')}}</p><p v-if="protectionReset" class="notice warning">{{t('protectionReset')}}</p><div class="form-grid"><FormField v-for="key in ['x','y','width','height']" :key="key" :label="t(`protection_${key}`)" v-slot="{id}"><input :id="id" v-model.number="protection[key]" type="number" min="1" :max="key==='x'||key==='width'?settings.width:settings.height" /></FormField></div><button class="button small" :disabled="protectedRegions.length>=20" @click="addProtection">{{t('addProtection')}}</button><div v-for="(rect,index) in protectedRegions" :key="index" class="stat-row"><span>{{rect.x+1}}, {{rect.y+1}} · {{rect.width}} × {{rect.height}}</span><button class="button text small" @click="protectedRegions=protectedRegions.filter((_,i)=>i!==index)">{{t('remove')}}</button></div></details>
        <div class="form-section"><h3>{{ t('sourcePreview') }}</h3><canvas ref="sourceCanvas" class="transparency-surface" role="img" :aria-label="t('sourcePreview')" style="max-width:100%;height:auto" /></div><div class="form-grid form-section"><div v-if="previous"><h3>{{t('previousGeneration')}}</h3><p class="field-help">{{previewStats(previous)}}</p><div class="project-cover"><PatternThumbnail :revision="previous" :label="t('previousGeneration')"/></div></div><div><h3>{{ t('currentGeneration') }}</h3><p v-if="generated" class="field-help">{{previewStats(generated)}}</p><div v-if="generated" class="project-cover"><canvas ref="resultCanvas" role="img" :aria-label="t('preview')" /></div><p v-else class="muted">{{ t('generatePreviewHelp') }}</p><p v-if="stalePreview" class="notice warning">{{ t('stalePreview') }}</p></div></div>
        <p v-if="previous" class="notice">{{t('generationComparisonHelp')}}</p><GeneratorQuality v-if="generated && !stalePreview" :revision="generated" /><p class="notice">{{t(generationOptions.background.mode==='remove'?'generationRemovalHelp':generationOptions.background.mode==='transparent'?'generationTransparentHelp':'generationCompositeHelp')}}</p><p v-if="busy" role="status" class="notice">{{ t('generating') }}</p>
      </template>
      <template v-if="dialog === 'native' && pendingInput"><p class="notice">{{ pendingInput.revision.width }} × {{ pendingInput.revision.height }} {{ t('stitches') }} · {{ pendingInput.revision.colors.length }} {{ t('colors') }}. {{ t('nativeImportHelp') }}</p><p v-if="pendingInput.detachedBindings" class="notice">{{t('standaloneBindingsDetached',{count:pendingInput.detachedBindings})}}</p><PatternThumbnail :revision="pendingInput.revision" :label="title" /></template>
      <template #footer><button v-if="busy && taskId" class="button" @click="cancelGeneration">{{ t('cancelGeneration') }}</button><button v-else class="button" :disabled="busy" @click="closeDialog">{{ t('cancel') }}</button><button v-if="dialog === 'image'" class="button" :disabled="busy" @click="generate">{{ t('generate') }}</button><button class="button primary" :disabled="busy || !title.trim() || (dialog === 'image' && (!generated || stalePreview))" @click="dialog === 'native' ? confirmImport() : saveNew()">{{ t('save') }}</button></template>
    </AppDialog>
  </section>
<ReferenceBatchImport v-if="referenceBatch" @close="referenceBatch=false"/>
</template>
