<script setup>
import { computed, shallowRef, ref, reactive, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { ChevronLeft, ChevronRight, RotateCw, Maximize, Move, Highlighter, Square, Minus, Type, Undo2, Redo2, BookmarkPlus, Download, Trash2, Pencil, X } from '@lucide/vue';
import { getDocument, GlobalWorkerOptions, AnnotationMode, PasswordResponses } from 'pdfjs-dist/build/pdf.mjs';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { jsPDF } from 'jspdf';
import AppDialog from './AppDialog.vue';
import FormField from './FormField.vue';
import { state, dispatch, notify } from '../state';
import { storage } from '../storage';
import { t, language, errorText } from '../i18n';
import { createReferenceData, originalPoint } from '../../core/references.mjs';
import { drawReferenceAnnotations, appendReferenceNotes } from '../reference-render.mjs';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
const props = defineProps({ patternId: { type: String, required: true }, projectId: String });
const pattern = computed(() => state.value.patterns.find(row => row.id === props.patternId));
const project = computed(() => props.projectId ? state.value.projects.find(row => row.id === props.projectId) : null);
const owner = computed(() => project.value ?? pattern.value);
const attachment = computed(() => state.value.attachments.find(row => row.id === pattern.value?.sourceAttachmentId));
const data = computed(() => owner.value?.referenceData ?? (attachment.value ? createReferenceData(attachment.value.id) : null));
const isPdf = computed(() => attachment.value?.mime === 'application/pdf');
const contentLocked = computed(() => Boolean(project.value && ['completed', 'archived'].includes(project.value.status)));
const view = reactive({ page: 1, zoom: 1, rotation: 0, scrollX: 0, scrollY: 0 });
const totalPages = ref(1), goPage = ref(1), tool = ref('pan'), color = ref('#f5c842'), loading = ref(false), rendering = ref(false), error = ref(''), saveError = ref(''), saving = ref(false);
const baseCanvas = ref(), overlay = ref(), stage = ref(), pageSize = reactive({ width: 600, height: 800 }), selectedId = ref(null), preview = shallowRef(null);
const dialog = ref(''), annotationDraft = reactive({}), bookmarkLabel = ref(''), password = ref(''), passwordWrong = ref(false), exporting = ref(false), exportProgress = ref(0), exportAll = ref(false), exportLanguage = ref(language.value);
const history = shallowRef([]), future = shallowRef([]), imageBitmap = shallowRef(null), pdfDocument = shallowRef(null);
const pageAnnotations = computed(() => (data.value?.annotations ?? []).filter(mark => mark.page === view.page));
const bookmarks = computed(() => data.value?.bookmarks ?? []);
const bytes = shallowRef(null), sourceReady = ref(false);
let loadingTask, renderTask, exportRenderTask, sourceVersion = 0, renderVersion = 0, renderPromise = Promise.resolve(), viewTimer, resizeObserver, currentPointer, updatePassword, cancelExport = false, mounted = false;
const tools = [['pan',Move],['highlight',Highlighter],['rectangle',Square],['line',Minus],['text',Type]];
const payload = extra => ({ patternId: props.patternId, ...(props.projectId ? { projectId: props.projectId } : {}), attachmentId: attachment.value.id, ...extra });
function readableError(caught) {
  if (caught?.name === 'PasswordException') return t('referenceEncrypted');
  if (caught?.name === 'InvalidPDFException' || /Invalid PDF/i.test(caught?.message ?? '')) return t('referenceInvalidPdf');
  return t('referenceLoadFailed');
}
async function disposeSource() {
  renderVersion++; renderTask?.cancel(); renderTask = null;
  try { await loadingTask?.destroy(); } catch { /* A cancelled parse already rejects its own promise. */ }
  loadingTask = null; pdfDocument.value = null; imageBitmap.value?.close(); imageBitmap.value = null; sourceReady.value = false;
}
async function load() {
  const version = ++sourceVersion; loading.value = true; error.value = ''; bytes.value = null; clearTimeout(viewTimer);
  await disposeSource(); history.value = []; future.value = []; selectedId.value = null;
  if (!attachment.value) { error.value = t('referenceLoadFailed'); loading.value = false; return; }
  Object.assign(view, data.value.view); goPage.value = view.page;
  try {
    const original = new Uint8Array(await storage.getAsset(attachment.value.id));
    if (version !== sourceVersion) return;
    bytes.value = original;
    if (isPdf.value) {
      const assets = new URL('pdfjs/', document.baseURI).href;
      loadingTask = getDocument({ data: original.slice(), cMapUrl: `${assets}cmaps/`, cMapPacked: true,
        standardFontDataUrl: `${assets}standard_fonts/`, wasmUrl: `${assets}wasm/`, iccUrl: `${assets}iccs/`,
        useWorkerFetch: true, useSystemFonts: false, disableFontFace: true,
        isEvalSupported: false, enableXfa: false, disableAutoFetch: true, disableRange: true, disableStream: true,
        maxImageSize: 40_000_000, canvasMaxAreaInBytes: 32_000_000, enableHWA: false, verbosity: 0 });
      loadingTask.onPassword = (callback, reason) => { if (version !== sourceVersion) return callback(new Error('cancelled')); updatePassword = callback; password.value = ''; passwordWrong.value = reason === PasswordResponses.INCORRECT_PASSWORD; dialog.value = 'password'; };
      const documentProxy = await loadingTask.promise;
      if (version !== sourceVersion) { await documentProxy.destroy(); return; }
      if (documentProxy.numPages > 10000) throw Error('reference_page_limit');
      pdfDocument.value = documentProxy; totalPages.value = documentProxy.numPages;
    } else {
      const image = await createImageBitmap(new Blob([original], { type: attachment.value.mime }), { imageOrientation: 'from-image' });
      if (image.width * image.height > 40_000_000) { image.close(); throw Error('reference_image_limit'); }
      if (version !== sourceVersion) { image.close(); return; }
      imageBitmap.value = image; totalPages.value = 1;
    }
    view.page = Math.min(view.page, totalPages.value); goPage.value = view.page; sourceReady.value = true; dialog.value = '';
    await nextTick(); await queueRender(true);
    if (data.value.pageCount !== totalPages.value) await dispatch('reference.save', payload({ pageCount: totalPages.value, view: { ...view } }));
  } catch (caught) { if (version === sourceVersion) { error.value = readableError(caught); sourceReady.value = false; dialog.value = ''; } }
  finally { if (version === sourceVersion) loading.value = false; }
}
watch([() => props.patternId, () => props.projectId, () => attachment.value?.id], () => { if (mounted) load(); });
function queueRender(restoreScroll = false) {
  const version = ++renderVersion; renderTask?.cancel(); rendering.value = true;
  renderPromise = renderPromise.catch(() => {}).then(async () => {
    if (!sourceReady.value || version !== renderVersion || !baseCanvas.value || !stage.value) return;
    const page = view.page, rotation = view.rotation, zoom = view.zoom;
    try {
      let pdfPage, normalWidth, normalHeight;
      if (pdfDocument.value) { pdfPage = await pdfDocument.value.getPage(page); const normal = pdfPage.getViewport({ scale: 1, rotation: pdfPage.rotate }); normalWidth = normal.width; normalHeight = normal.height; }
      else { normalWidth = imageBitmap.value.width; normalHeight = imageBitmap.value.height; }
      if (version !== renderVersion) return;
      const rotatedWidth = rotation % 180 ? normalHeight : normalWidth, rotatedHeight = rotation % 180 ? normalWidth : normalHeight;
      const fit = Math.min((stage.value.clientWidth - 24) / rotatedWidth, (stage.value.clientHeight - 24) / rotatedHeight);
      const cssWidth = Math.max(1, Math.round(rotatedWidth * fit * zoom)), cssHeight = Math.max(1, Math.round(rotatedHeight * fit * zoom));
      const backingRatio = Math.min(window.devicePixelRatio || 1, 2, 2400 / Math.max(cssWidth, cssHeight), Math.sqrt(4_000_000 / (cssWidth * cssHeight)));
      const temporary = document.createElement('canvas'); temporary.width = Math.max(1, Math.round(cssWidth * backingRatio)); temporary.height = Math.max(1, Math.round(cssHeight * backingRatio));
      if (pdfPage) {
        const viewport = pdfPage.getViewport({ scale: temporary.width / rotatedWidth, rotation: (pdfPage.rotate + rotation) % 360 });
        renderTask = pdfPage.render({ canvas: temporary, viewport, annotationMode: AnnotationMode.ENABLE, intent: 'display' });
        await renderTask.promise;
      } else drawImage(temporary, rotation);
      if (version !== renderVersion) return;
      pageSize.width = cssWidth; pageSize.height = cssHeight;
      baseCanvas.value.width = temporary.width; baseCanvas.value.height = temporary.height; baseCanvas.value.getContext('2d').drawImage(temporary, 0, 0);
      overlay.value.width = temporary.width; overlay.value.height = temporary.height; redrawAnnotations();
      await nextTick();
      if (restoreScroll) { stage.value.scrollLeft = view.scrollX * Math.max(0, stage.value.scrollWidth - stage.value.clientWidth); stage.value.scrollTop = view.scrollY * Math.max(0, stage.value.scrollHeight - stage.value.clientHeight); }
      if (pdfPage) pdfPage.cleanup();
    } catch (caught) { if (version === renderVersion && caught?.name !== 'RenderingCancelledException') error.value = readableError(caught); }
    finally { if (version === renderVersion) { rendering.value = false; renderTask = null; } }
  });
  return renderPromise;
}
function drawImage(canvas, rotation) {
  const context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.translate(canvas.width / 2, canvas.height / 2); context.rotate(rotation * Math.PI / 180);
  const width = rotation % 180 ? canvas.height : canvas.width, height = rotation % 180 ? canvas.width : canvas.height;
  context.drawImage(imageBitmap.value, -width / 2, -height / 2, width, height);
}
function redrawAnnotations() { if (overlay.value) drawReferenceAnnotations(overlay.value, pageAnnotations.value, { rotation: view.rotation, selectedId: selectedId.value, preview: preview.value }); }
watch([() => JSON.stringify(pageAnnotations.value), selectedId, preview], redrawAnnotations);
function persistView() {
  clearTimeout(viewTimer); if (!sourceReady.value) return;
  viewTimer = setTimeout(() => dispatch('reference.save', payload({ view: { ...view } })).catch(caught => { saveError.value = errorText(caught); }), 350);
}
function scroll() { if (!stage.value || rendering.value) return; view.scrollX = stage.value.scrollLeft / Math.max(1, stage.value.scrollWidth - stage.value.clientWidth); view.scrollY = stage.value.scrollTop / Math.max(1, stage.value.scrollHeight - stage.value.clientHeight); persistView(); }
function changePage(number) {
  if (!Number.isInteger(Number(number))) return;
  view.page = Math.max(1, Math.min(totalPages.value, Number(number))); goPage.value = view.page; view.scrollX = 0; view.scrollY = 0; selectedId.value = null; preview.value = null;
  queueRender(true); persistView();
}
function changeZoom() { view.zoom = Math.max(.25, Math.min(4, Number(view.zoom) || 1)); queueRender(true); persistView(); }
function rotatePage() { view.rotation = (view.rotation + 90) % 360; queueRender(true); persistView(); }
function fitPage() { view.zoom = 1; view.scrollX = 0; view.scrollY = 0; queueRender(true); persistView(); }
function point(event) { const rect = overlay.value.getBoundingClientRect(); return originalPoint({ x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) }, view.rotation); }
function shape(a, b, type) {
  const base = { id: crypto.randomUUID(), page: view.page, type, color: color.value, opacity: type === 'highlight' ? .35 : 1, text: '' };
  if (type === 'line') return { ...base, x: a.x, y: a.y, x2: b.x, y2: b.y };
  return { ...base, x: Math.min(a.x,b.x), y: Math.min(a.y,b.y), width: Math.abs(a.x-b.x), height: Math.abs(a.y-b.y) };
}
function pointerDown(event) {
  if (!sourceReady.value || rendering.value || exporting.value || event.button !== 0) return;
  overlay.value.setPointerCapture(event.pointerId);
  if (tool.value === 'pan' || event.altKey) { currentPointer = { pan: true, x: event.clientX, y: event.clientY, left: stage.value.scrollLeft, top: stage.value.scrollTop }; return; }
  if (contentLocked.value || saving.value) return;
  const at = point(event);
  if (tool.value === 'text') { startText(at); return; }
  currentPointer = { start: at, type: tool.value }; preview.value = null;
}
function pointerMove(event) {
  if (!currentPointer) return;
  if (currentPointer.pan) { stage.value.scrollLeft = currentPointer.left - (event.clientX - currentPointer.x); stage.value.scrollTop = currentPointer.top - (event.clientY - currentPointer.y); return; }
  preview.value = shape(currentPointer.start, point(event), currentPointer.type);
}
async function pointerUp() {
  if (!currentPointer) return;
  const mark = preview.value; currentPointer = null; preview.value = null;
  if (!mark || (mark.type !== 'line' && (mark.width < .0001 || mark.height < .0001)) || (mark.type === 'line' && mark.x === mark.x2 && mark.y === mark.y2)) return;
  await updateAnnotations([...(data.value.annotations ?? []), mark]);
}
function cancelPointer() { currentPointer = null; preview.value = null; }
async function updateAnnotations(annotations, { trackHistory = true } = {}) {
  if (saving.value || contentLocked.value) return false;
  saving.value = true; saveError.value = '';
  try { const old = structuredClone(data.value.annotations); await dispatch('reference.save', payload({ annotations })); if (trackHistory) { history.value = [...history.value, old].slice(-30); future.value = []; } return true; }
  catch (caught) { saveError.value = errorText(caught); return false; } finally { saving.value = false; }
}
function startText(at = { x: .15, y: .15 }) { Object.keys(annotationDraft).forEach(key => delete annotationDraft[key]); Object.assign(annotationDraft, { id: crypto.randomUUID(), page: view.page, type: 'text', ...at, color: color.value === '#f5c842' ? '#634453' : color.value, opacity: 1, text: '' }); dialog.value = 'annotation'; }
function editAnnotation(mark) { Object.keys(annotationDraft).forEach(key => delete annotationDraft[key]); Object.assign(annotationDraft, structuredClone(mark)); selectedId.value = mark.id; dialog.value = 'annotation'; }
async function saveAnnotation() {
  const mark = JSON.parse(JSON.stringify(annotationDraft)), old = data.value.annotations.findIndex(row => row.id === mark.id);
  const annotations = [...data.value.annotations]; if (old < 0) annotations.push(mark); else annotations[old] = mark;
  if (await updateAnnotations(annotations)) dialog.value = '';
}
async function deleteAnnotation(mark) { if (await updateAnnotations(data.value.annotations.filter(row => row.id !== mark.id))) { selectedId.value = null; dialog.value = ''; } }
async function undo(redo = false) {
  const from = redo ? future : history, to = redo ? history : future;
  if (!from.value.length || saving.value || contentLocked.value) return;
  const old = structuredClone(data.value.annotations), target = from.value.at(-1);
  if (await updateAnnotations(target, { trackHistory: false })) { from.value = from.value.slice(0, -1); to.value = [...to.value, old]; }
}
async function saveBookmark() {
  if (saving.value || !bookmarkLabel.value.trim() || contentLocked.value) return;
  saving.value = true;
  try { await dispatch('reference.save', payload({ bookmarks: [...bookmarks.value, { id: crypto.randomUUID(), page: view.page, x: view.scrollX, y: view.scrollY, label: bookmarkLabel.value }] })); dialog.value = ''; bookmarkLabel.value = ''; }
  catch (caught) { saveError.value = errorText(caught); } finally { saving.value = false; }
}
async function deleteBookmark(id) { try { await dispatch('reference.save', payload({ bookmarks: bookmarks.value.filter(b => b.id !== id) })); } catch (caught) { saveError.value = errorText(caught); } }
function gotoBookmark(mark) { view.page = mark.page; goPage.value = mark.page; view.scrollX = mark.x; view.scrollY = mark.y; queueRender(true); persistView(); }
async function downloadOriginal() { try { await storage.saveFile({ name: attachment.value.name, data: bytes.value ?? await storage.getAsset(attachment.value.id) }); } catch (caught) { saveError.value = errorText(caught); } }
function sendPassword() { if (updatePassword) { const callback = updatePassword; updatePassword = null; dialog.value = ''; callback(password.value); password.value = ''; } }
function cancelPassword() { updatePassword?.(new Error('cancelled')); updatePassword = null; password.value = ''; dialog.value = ''; }
async function exportAnnotated() {
  if (!sourceReady.value || exporting.value) return;
  exporting.value = true; cancelExport = false; exportProgress.value = 0; error.value = ''; dialog.value = '';
  try {
    const pages = exportAll.value ? Array.from({length:totalPages.value},(_,i)=>i+1) : [view.page];
    const exportMarks = structuredClone(data.value.annotations);
    if (pages.length > 300) throw Object.assign(Error(),{code:'reference_export_limit'});
    let pdfOut;
    for (const [index, pageNumber] of pages.entries()) {
      if (cancelExport) return;
      let page, width, height;
      if (pdfDocument.value) { page = await pdfDocument.value.getPage(pageNumber); const viewport = page.getViewport({scale:1,rotation:page.rotate}); width=viewport.width;height=viewport.height; }
      else { width=imageBitmap.value.width;height=imageBitmap.value.height; }
      const scale = Math.min(2, 1800 / Math.max(width,height));
      const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
      if(page){exportRenderTask=page.render({canvas,viewport:page.getViewport({scale,rotation:page.rotate}),annotationMode:AnnotationMode.ENABLE,intent:'print'});await exportRenderTask.promise;exportRenderTask=null;}
      else drawImage(canvas,0);
      drawReferenceAnnotations(canvas,exportMarks.filter(mark=>mark.page===pageNumber),{rotation:0,clear:false});
      const landscape=width>height, paperWidth=landscape?297:210,paperHeight=landscape?210:297,margin=12;
      if(!pdfOut)pdfOut=new jsPDF({orientation:landscape?'landscape':'portrait',unit:'mm',format:'a4',compress:true});else pdfOut.addPage('a4',landscape?'landscape':'portrait');
      const ratio=Math.min((paperWidth-margin*2)/canvas.width,(paperHeight-36)/canvas.height);
      pdfOut.addImage(canvas.toDataURL('image/jpeg',.92),'JPEG',(paperWidth-canvas.width*ratio)/2,16,canvas.width*ratio,canvas.height*ratio);
      pdfOut.setFontSize(8);pdfOut.text(`${pattern.value.name.slice(0,80)} · ${pageNumber} / ${totalPages.value}`,margin,9);
      pdfOut.text(exportLanguage.value==='en'?'Reference with annotations — not an editable stitch chart.':'Riferimento con annotazioni — non è uno schema di punti modificabile.',margin,paperHeight-9);
      page?.cleanup();exportProgress.value=index+1;await new Promise(resolve=>setTimeout(resolve,0));
    }
    if (!cancelExport) appendReferenceNotes(pdfOut, exportMarks.filter(mark=>pages.includes(mark.page)), {locale:exportLanguage.value});
    if(!cancelExport)await storage.saveFile({name:`${pattern.value.name.replace(/[<>:"/\\|?*]/g,'-').slice(0,100)}-annotated.pdf`,data:new Uint8Array(pdfOut.output('arraybuffer'))});
  }catch(caught){if(cancelExport)return;error.value=caught.code==='reference_export_limit'?t('referenceExportLimit'):t('referenceExportFailed');}
  finally{exporting.value=false;}
}
function stopExport() { cancelExport=true;exportRenderTask?.cancel(); }
function beforeNavigate(event) { if (saving.value || exporting.value || dialog.value === 'annotation') { event.preventDefault(); saveError.value = t('referenceFinishEditing'); } else if(sourceReady.value && attachment.value) { clearTimeout(viewTimer); dispatch('reference.save',payload({view:{...view}})).catch(caught=>notify(errorText(caught))); } }
function beforeUnload(event) { if (saving.value || exporting.value || dialog.value === 'annotation') { event.preventDefault(); event.returnValue = ''; } }
onMounted(async()=>{mounted=true;window.addEventListener('ricamo:before-navigate',beforeNavigate);window.addEventListener('beforeunload',beforeUnload);await load();resizeObserver=new ResizeObserver(()=>{if(sourceReady.value)queueRender(true)});if(stage.value)resizeObserver.observe(stage.value);});
onBeforeUnmount(()=>{mounted=false;sourceVersion++;stopExport();clearTimeout(viewTimer);resizeObserver?.disconnect();window.removeEventListener('ricamo:before-navigate',beforeNavigate);window.removeEventListener('beforeunload',beforeUnload);disposeSource();});
</script>

<template>
  <div class="stack">
    <p class="notice">{{ t('referenceAnnotationHelp') }}</p>
    <p v-if="error" class="notice error" role="alert">{{ error }}</p><p v-if="saveError" class="notice error" role="alert">{{ saveError }}</p>
    <div class="toolbar"><button class="button" @click="downloadOriginal"><Download :size="16" />{{ t('saveReference') }}</button><button class="button" :disabled="!sourceReady || exporting" @click="dialog='export'">{{ t('referenceExport') }}</button><button v-if="error" class="button" @click="load">{{ t('retry') }}</button><span v-if="saving" role="status" class="muted">{{ t('saving') }}</span></div>
    <p v-if="loading" class="notice" role="status">{{ t('referenceLoading') }}</p>
    <div v-if="exporting" class="notice" role="status"><span>{{ t('referenceExporting',{page:exportProgress}) }}</span><button class="button small" @click="stopExport">{{ t('cancel') }}</button></div>
    <template v-if="sourceReady">
      <div class="editor-tools"><button class="icon-button" :disabled="view.page<=1 || exporting" :aria-label="t('referencePrevious')" @click="changePage(view.page-1)"><ChevronLeft :size="18" /></button><FormField :label="t('referencePage')" v-slot="{id}"><input :id="id" v-model.number="goPage" :disabled="exporting" type="number" min="1" :max="totalPages" style="width:85px" @change="changePage(goPage)" @keydown.enter="changePage(goPage)" /></FormField><span>/ {{ totalPages }}</span><button class="icon-button" :disabled="view.page>=totalPages || exporting" :aria-label="t('referenceNext')" @click="changePage(view.page+1)"><ChevronRight :size="18" /></button><button class="button small" :disabled="exporting" @click="fitPage"><Maximize :size="14" />{{ t('fit') }}</button><FormField :label="t('zoom')" v-slot="{id}"><select :id="id" v-model.number="view.zoom" :disabled="exporting" @change="changeZoom"><option v-for="value in [.25,.5,.75,1,1.5,2,3,4]" :key="value" :value="value">{{ value*100 }}%</option></select></FormField><button class="button small" :disabled="exporting" @click="rotatePage"><RotateCw :size="14" />{{ t('rotate') }}</button><button class="button small" :disabled="contentLocked || saving || exporting" @click="bookmarkLabel=`${t('referencePage')} ${view.page}`;dialog='bookmark'"><BookmarkPlus :size="14" />{{ t('referenceAddBookmark') }}</button></div>
      <div class="editor-layout"><div>
        <div class="editor-tools" role="toolbar" :aria-label="t('referenceTools')"><button v-for="[key,icon] in tools" :key="key" class="icon-button" :class="{selected:tool===key}" :aria-pressed="tool===key" :aria-label="t(`referenceTool_${key}`)" :title="t(`referenceTool_${key}`)" :disabled="key!=='pan' && (contentLocked || saving || exporting)" @click="tool=key"><component :is="icon" :size="18" /></button><input v-model="color" type="color" :aria-label="t('color')" style="width:52px" /><button class="icon-button" :disabled="!history.length || saving || contentLocked || exporting" :aria-label="t('undo')" @click="undo()"><Undo2 :size="18" /></button><button class="icon-button" :disabled="!future.length || saving || contentLocked || exporting" :aria-label="t('redo')" @click="undo(true)"><Redo2 :size="18" /></button><button class="button small" :disabled="contentLocked || saving || exporting" @click="startText()">{{ t('referenceAddNote') }}</button></div>
        <div ref="stage" class="editor-stage" style="padding:12px" @scroll="scroll" :aria-busy="rendering"><div :style="{position:'relative',width:`${pageSize.width}px`,height:`${pageSize.height}px`,margin:'0 auto'}"><canvas ref="baseCanvas" :style="{width:`${pageSize.width}px`,height:`${pageSize.height}px`,imageRendering:'auto'}" role="img" :aria-label="`${pattern.name} · ${t('referencePage')} ${view.page}`" /><canvas ref="overlay" :style="{position:'absolute',inset:0,width:`${pageSize.width}px`,height:`${pageSize.height}px`,background:'transparent',imageRendering:'auto',cursor:tool==='pan'?'grab':'crosshair'}" :aria-label="t('referenceAnnotationCanvas')" @pointerdown="pointerDown" @pointermove="pointerMove" @pointerup="pointerUp" @pointercancel="cancelPointer" /></div></div>
        <p class="cell-subtitle">{{ t('referenceCanvasHelp') }}</p>
      </div><aside class="stack"><section class="panel"><div class="panel-heading"><h2>{{ t('referenceAnnotations') }}</h2><span class="badge">{{ pageAnnotations.length }}</span></div><div class="panel-body"><p v-if="!pageAnnotations.length" class="muted">{{ t('referenceNoAnnotations') }}</p><article v-for="mark in pageAnnotations" :key="mark.id" style="margin-bottom:18px"><strong>{{ t(`referenceTool_${mark.type}`) }}</strong><p style="font-size:.8rem;white-space:pre-wrap;overflow-wrap:anywhere">{{ mark.text || t('referenceRegion') }}</p><div class="actions"><button class="button small" :disabled="contentLocked || saving || exporting" @click="editAnnotation(mark)"><Pencil :size="14" />{{ t('edit') }}</button><button class="icon-button" :disabled="contentLocked || saving || exporting" :aria-label="`${t('remove')}: ${mark.text || t('referenceRegion')}`" @click="deleteAnnotation(mark)"><Trash2 :size="15" /></button></div></article></div></section><section class="panel"><div class="panel-heading"><h2>{{ t('bookmarks') }}</h2></div><div class="panel-body"><p v-if="!bookmarks.length" class="muted">{{ t('referenceNoBookmarks') }}</p><div v-for="mark in bookmarks" :key="mark.id" class="inline-row"><button class="button text" :disabled="exporting" @click="gotoBookmark(mark)">{{ mark.page }} · {{ mark.label }}</button><button class="icon-button" :disabled="contentLocked || saving" :aria-label="`${t('remove')}: ${mark.label}`" @click="deleteBookmark(mark.id)"><X :size="14" /></button></div></div></section></aside></div>
    </template>
    <AppDialog v-if="dialog==='annotation'" :title="t('referenceEditNote')" :busy="saving" @close="dialog=''"><p v-if="saveError" role="alert" class="notice error">{{ saveError }}</p><div class="form-grid"><FormField :label="t('notes')" wide :required="annotationDraft.type==='text'" v-slot="{id}"><textarea :id="id" v-model="annotationDraft.text" maxlength="2000" autofocus /></FormField><FormField :label="t('color')" v-slot="{id}"><input :id="id" v-model="annotationDraft.color" type="color" /></FormField><FormField :label="t('referenceOpacity')" v-slot="{id}"><input :id="id" v-model.number="annotationDraft.opacity" type="range" min="0.1" max="1" step="0.05" /></FormField></div><template #footer><button class="button" :disabled="saving" @click="dialog=''">{{ t('cancel') }}</button><button class="button primary" :disabled="saving || (annotationDraft.type==='text'&&!annotationDraft.text?.trim())" @click="saveAnnotation">{{ t('save') }}</button></template></AppDialog>
    <AppDialog v-if="dialog==='bookmark'" :title="t('referenceAddBookmark')" :busy="saving" @close="dialog=''"><p v-if="saveError" role="alert" class="notice error">{{ saveError }}</p><FormField :label="t('name')" required v-slot="{id}"><input :id="id" v-model="bookmarkLabel" maxlength="300" autofocus /></FormField><template #footer><button class="button" @click="dialog=''">{{ t('cancel') }}</button><button class="button primary" :disabled="saving||!bookmarkLabel.trim()" @click="saveBookmark">{{ t('save') }}</button></template></AppDialog>
    <AppDialog v-if="dialog==='password'" :title="t('referencePassword')" @close="cancelPassword"><p class="notice">{{ t(passwordWrong?'referenceWrongPassword':'referencePasswordHelp') }}</p><FormField :label="t('referencePassword')" v-slot="{id}"><input :id="id" v-model="password" type="password" autocomplete="off" @keydown.enter="sendPassword" autofocus /></FormField><template #footer><button class="button" @click="cancelPassword">{{ t('cancel') }}</button><button class="button primary" :disabled="!password" @click="sendPassword">{{ t('confirm') }}</button></template></AppDialog>
    <AppDialog v-if="dialog==='export'" :title="t('referenceExport')" @close="dialog=''"><p class="notice">{{ t('referenceExportHelp') }}</p><label class="checkbox-label"><input v-model="exportAll" type="checkbox" :disabled="totalPages>300" />{{ t('referenceAllPages',{count:totalPages}) }}</label><FormField :label="t('language')" v-slot="{id}"><select :id="id" v-model="exportLanguage"><option value="it">Italiano</option><option value="en">English</option></select></FormField><template #footer><button class="button" @click="dialog=''">{{ t('cancel') }}</button><button class="button primary" @click="exportAnnotated">{{ t('export') }}</button></template></AppDialog>
  </div>
</template>
