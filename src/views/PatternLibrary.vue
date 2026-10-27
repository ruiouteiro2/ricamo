<script setup>
import { computed, ref, shallowRef, reactive, onBeforeUnmount, watch, nextTick } from 'vue';
import { Plus, ImagePlus, Grid2X2, FileUp, Search, Archive, Copy, FolderPlus, FileImage, X, RotateCw, FlipHorizontal2, FlipVertical2 } from '@lucide/vue';
import PageHeader from '../components/PageHeader.vue';
import EmptyState from '../components/EmptyState.vue';
import AppDialog from '../components/AppDialog.vue';
import FormField from '../components/FormField.vue';
import PatternThumbnail from '../components/PatternThumbnail.vue';
import { state, dispatch, navigate, notify, importAsset, normalize } from '../state';
import { t, number, date, errorText } from '../i18n';
import { dmcPalette, inventoryPalette, DEFAULT_SETTINGS, importLegacy } from '../engine/adapter.mjs';
import { createBlank, validateRevision } from '../../core/pattern.mjs';
import { drawPattern } from '../pattern-render.mjs';

const search = ref(''), filter = ref('active'), dialog = ref(''), error = ref(''), busy = ref(false);
const imageInput = ref(), referenceInput = ref(), nativeInput = ref(), sourceCanvas = ref(), resultCanvas = ref();
const title = ref(''), sourceAsset = ref(null), bitmap = ref(null), generated = shallowRef(null), paletteKind = ref('catalogue');
const settings = reactive({ ...DEFAULT_SETTINGS }), adjustments = reactive({ x: 0, y: 0, width: 100, height: 100, rotation: 0, flipX: false, flipY: false, brightness: 100, contrast: 100 });
const keepRatio = ref(true), taskId = ref(null), pendingInput = ref(null), previewVersion = ref('');
let worker, timeout, sourceToken = 0;
const patterns = computed(() => state.value.patterns.filter(p => filter.value === 'all' || (filter.value === 'archived' ? p.archived : !p.archived)).filter(p => normalize([p.name, p.notes, ...(p.tags ?? [])].join(' ')).includes(normalize(search.value))).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
const fingerprint = () => JSON.stringify({ settings, adjustments, paletteKind: paletteKind.value, source: sourceAsset.value?.id });
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
    const rendered = transformed(Math.max(1, w), Math.max(1, h));
    sourceCanvas.value.width = rendered.width; sourceCanvas.value.height = rendered.height; sourceCanvas.value.getContext('2d').drawImage(rendered, 0, 0);
  } catch { /* Input validation is shown when generation is requested. */ }
}
watch(adjustments, () => { resizeFrom('width'); drawSource(); });
watch(generated, async value => { await nextTick(); if (value && resultCanvas.value) { const cellSize = Math.min(440 / value.width, 300 / value.height); drawPattern(resultCanvas.value, value, { cellSize, width: value.width * cellSize, height: value.height * cellSize }); } });
function cancelGeneration() { taskId.value = null; worker?.terminate(); worker = null; clearTimeout(timeout); busy.value = false; }
function closeDialog() { cancelGeneration(); dialog.value = ''; error.value = ''; bitmap.value?.close(); bitmap.value = null; sourceToken++; }
function startBlank() { error.value = ''; title.value = ''; Object.assign(settings, DEFAULT_SETTINGS, { width: 60, height: 60 }); dialog.value = 'blank'; }
async function chooseImage(event) {
  const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
  const token = ++sourceToken; error.value = ''; busy.value = true;
  try {
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type) || file.size > 25 * 1024 * 1024) throw Object.assign(Error(), { code: 'invalid_file' });
    const decoded = await createImageBitmap(file, { imageOrientation: 'from-image' });
    if (decoded.width * decoded.height > 40_000_000 || decoded.width > 20000 || decoded.height > 20000) { decoded.close(); throw Object.assign(Error(), { code: 'file_too_large' }); }
    if (token !== sourceToken) { decoded.close(); return; }
    const asset = await importAsset(file);
    bitmap.value?.close(); bitmap.value = decoded; sourceAsset.value = asset; title.value = file.name.replace(/\.[^.]+$/, '');
    Object.assign(adjustments, { x: 0, y: 0, width: 100, height: 100, rotation: 0, flipX: false, flipY: false, brightness: 100, contrast: 100 });
    Object.assign(settings, DEFAULT_SETTINGS); keepRatio.value = true; resizeFrom('width'); generated.value = null; dialog.value = 'image';
    await nextTick(); drawSource();
  } catch (caught) { error.value = errorText(caught); }
  finally { if (token === sourceToken) busy.value = false; }
}
function generate() {
  if (busy.value) return;
  error.value = '';
  try {
    const effectivePalette = paletteKind.value === 'inventory' ? inventoryPalette(state.value.materials, state.value.lots) : dmcPalette;
    const canvas = transformed(settings.width, settings.height), rgba = canvas.getContext('2d').getImageData(0, 0, settings.width, settings.height).data;
    const id = crypto.randomUUID(), inputHash = fingerprint(); taskId.value = id; busy.value = true;
    worker = new Worker(new URL('../engine/worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = event => {
      if (event.data.id !== taskId.value) return;
      const result = event.data; cancelGeneration();
      if (result.error) error.value = patternError(result.error);
      else { generated.value = result.result; previewVersion.value = inputHash; }
    };
    worker.onerror = () => { cancelGeneration(); error.value = t('generationFailed'); };
    timeout = setTimeout(() => { if (taskId.value === id) { cancelGeneration(); error.value = t('generationTimeout'); } }, 120000);
    worker.postMessage({ id, rgba, settings: JSON.parse(JSON.stringify(settings)), palette: effectivePalette, source: { attachmentId: sourceAsset.value.id, digest: sourceAsset.value.digest, adjustments: { ...adjustments } } }, [rgba.buffer]);
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
    revision.id = crypto.randomUUID(); revision.name = t('initialRevision');
    const id = crypto.randomUUID(); await dispatch('pattern.save', { id, name: title.value.trim(), sourceAttachmentId: dialog.value === 'image' ? sourceAsset.value.id : null, revision });
    closeDialog(); notify(t('patternSaved')); navigate('pattern', id);
  } catch (caught) { error.value = patternError(caught); }
  finally { busy.value = false; }
}
async function reference(event) {
  const file = event.target.files?.[0]; event.target.value = ''; if (!file || busy.value) return;
  busy.value = true; error.value = '';
  try { const asset = await importAsset(file), id = crypto.randomUUID(); await dispatch('pattern.save', { id, name: file.name.replace(/\.[^.]+$/, ''), kind: 'reference', sourceAttachmentId: asset.id }); navigate('pattern', id); notify(); }
  catch (caught) { error.value = errorText(caught); } finally { busy.value = false; }
}
async function importNative(event) {
  const file = event.target.files?.[0]; event.target.value = ''; if (!file || busy.value) return;
  error.value = ''; busy.value = true;
  try {
    if (file.size > 25 * 1024 * 1024) throw Object.assign(Error(), { code: 'file_too_large' });
    const data = JSON.parse(await file.text()); let revision, name;
    if (data.format === 'ricamo-pattern' && data.version === 1) { revision = structuredClone(data.revision); validateRevision(revision); name = data.name; }
    else { revision = importLegacy(data); name = data.title; }
    pendingInput.value = { revision, name: typeof name === 'string' ? name : file.name };
    title.value = pendingInput.value.name; dialog.value = 'native';
  } catch (caught) { error.value = errorText(caught); } finally { busy.value = false; }
}
async function confirmImport() {
  if (busy.value || !title.value.trim()) return;
  busy.value = true;
  try { const id = crypto.randomUUID(); await dispatch('pattern.save', { id, name: title.value, revision: { ...pendingInput.value.revision, id: crypto.randomUUID() } }); closeDialog(); navigate('pattern', id); notify(); }
  catch (caught) { error.value = errorText(caught); } finally { busy.value = false; }
}
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
    <input ref="referenceInput" class="sr-only" tabindex="-1" type="file" accept="application/pdf,image/png,image/jpeg,image/webp,image/gif" @change="reference" />
    <input ref="nativeInput" class="sr-only" tabindex="-1" type="file" accept=".json,.ricamopattern,.stitch.json" @change="importNative" />
    <p v-if="error && !dialog" role="alert" class="notice error">{{ error }}</p>
    <div class="toolbar"><div class="toolbar-search"><Search :size="18" /><input v-model="search" :aria-label="t('searchPatterns')" :placeholder="t('searchPatterns')" /></div><select v-model="filter" :aria-label="t('status')"><option value="active">{{ t('active') }}</option><option value="archived">{{ t('archived') }}</option><option value="all">{{ t('all') }}</option></select><button class="button" :disabled="busy" @click="referenceInput.click()"><FileUp :size="16" />{{ t('importReference') }}</button><button class="button" :disabled="busy" @click="nativeInput.click()">{{ t('importPattern') }}</button></div>
    <EmptyState v-if="!patterns.length" :icon="Grid2X2" :title="search ? t('noResults') : t('emptyPatterns')" :description="t('emptyPatternsBody')"><button class="button primary" @click="imageInput.click()">{{ t('fromImage') }}</button><button class="button" @click="startBlank">{{ t('blankPattern') }}</button></EmptyState>
    <div v-else class="project-grid">
      <article v-for="pattern in patterns" :key="pattern.id" class="project-card">
        <button class="project-cover" style="width:100%;border:0" :aria-label="`${t('openPattern')}: ${pattern.name}`" @click="navigate('pattern', pattern.id)"><PatternThumbnail v-if="current(pattern)" :revision="current(pattern)" :label="pattern.name" /><FileImage v-else :size="45" :stroke-width="1" /></button>
        <div class="project-card-body"><span v-if="pattern.draft" class="badge warning" style="margin-right:6px">{{ t('draftSaved') }}</span><span class="badge">{{ pattern.kind === 'reference' ? t('reference') : `${current(pattern)?.width} × ${current(pattern)?.height} ${t('stitches')}` }}</span><h3><button class="cell-title" @click="navigate('pattern', pattern.id)">{{ pattern.name }}</button></h3><p>{{ current(pattern)?.colors.length ?? '—' }} {{ t('colors') }} · {{ date(pattern.updatedAt) }}</p><div class="actions" style="flex-wrap:wrap"><button class="button small" @click="project(pattern)"><FolderPlus :size="15" />{{ t('createProject') }}</button><button class="icon-button" :aria-label="`${t('duplicate')}: ${pattern.name}`" @click="duplicate(pattern)"><Copy :size="16" /></button><button class="icon-button" :aria-label="`${pattern.archived ? t('restore') : t('archive')}: ${pattern.name}`" @click="archive(pattern)"><Archive :size="16" /></button></div></div>
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
        <div class="form-section"><div class="form-grid"><FormField :label="t('palette')" v-slot="{ id }"><select :id="id" v-model="paletteKind"><option value="catalogue">{{ t('catalogue') }}</option><option value="inventory">{{ t('inventoryOnly') }}</option></select></FormField><FormField :label="t('maxColors')" v-slot="{ id }"><input :id="id" v-model.number="settings.maxColors" type="number" min="1" max="80" /></FormField><FormField :label="t('mode')" v-slot="{ id }"><select :id="id" v-model="settings.mode"><option v-for="mode in ['detail','balanced','simple']" :key="mode" :value="mode">{{ t(mode) }}</option></select></FormField><FormField :label="t('fabricCount')" v-slot="{ id }"><input :id="id" v-model.number="settings.count" type="number" min="6" max="40" step="0.1" /></FormField></div></div>
        <details class="form-section"><summary>{{ t('imageAdjustments') }}</summary><div class="form-grid" style="margin-top:16px"><FormField v-for="field in ['x','y','width','height']" :key="field" :label="t(`crop_${field}`)" v-slot="{ id }"><input :id="id" v-model.number="adjustments[field]" type="number" :min="field === 'width' || field === 'height' ? 1 : 0" max="100" /></FormField><FormField :label="t('brightness')" v-slot="{ id }"><input :id="id" v-model.number="adjustments.brightness" type="range" min="20" max="180" /></FormField><FormField :label="t('contrast')" v-slot="{ id }"><input :id="id" v-model.number="adjustments.contrast" type="range" min="20" max="180" /></FormField><FormField :label="t('removeRegions')" :help="t('removeRegionsHelp')" v-slot="{ id }"><input :id="id" v-model.number="settings.region" type="number" min="0" max="30" /></FormField></div><div class="actions" style="margin-top:14px"><button class="button small" @click="adjustments.rotation = (adjustments.rotation + 90) % 360"><RotateCw :size="16" />{{ t('rotate') }}</button><button class="button small" :aria-pressed="adjustments.flipX" @click="adjustments.flipX = !adjustments.flipX"><FlipHorizontal2 :size="16" />{{ t('flipHorizontal') }}</button><button class="button small" :aria-pressed="adjustments.flipY" @click="adjustments.flipY = !adjustments.flipY"><FlipVertical2 :size="16" />{{ t('flipVertical') }}</button></div></details>
        <div class="form-grid form-section"><div><h3>{{ t('sourcePreview') }}</h3><canvas ref="sourceCanvas" role="img" :aria-label="t('sourcePreview')" style="max-width:100%;height:auto" /></div><div><h3>{{ t('preview') }}</h3><canvas v-if="generated" ref="resultCanvas" role="img" :aria-label="t('preview')" style="max-width:100%;height:auto;image-rendering:pixelated" /><p v-else class="muted">{{ t('generatePreviewHelp') }}</p><p v-if="stalePreview" class="notice warning">{{ t('stalePreview') }}</p></div></div>
        <p class="notice">{{ t('transparentHelp') }}</p><p v-if="busy" role="status" class="notice">{{ t('generating') }}</p>
      </template>
      <template v-if="dialog === 'native' && pendingInput"><p class="notice">{{ pendingInput.revision.width }} × {{ pendingInput.revision.height }} {{ t('stitches') }} · {{ pendingInput.revision.colors.length }} {{ t('colors') }}. {{ t('nativeImportHelp') }}</p><PatternThumbnail :revision="pendingInput.revision" :label="title" /></template>
      <template #footer><button v-if="busy && taskId" class="button" @click="cancelGeneration">{{ t('cancelGeneration') }}</button><button v-else class="button" :disabled="busy" @click="closeDialog">{{ t('cancel') }}</button><button v-if="dialog === 'image'" class="button" :disabled="busy" @click="generate">{{ t('generate') }}</button><button class="button primary" :disabled="busy || !title.trim() || (dialog === 'image' && (!generated || stalePreview))" @click="dialog === 'native' ? confirmImport() : saveNew()">{{ t('save') }}</button></template>
    </AppDialog>
  </section>
</template>
