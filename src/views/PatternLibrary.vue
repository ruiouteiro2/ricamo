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
import {selectedThreadPalette,threadCatalogueVersions,supplierThreadCatalogues} from '../thread-catalogues.mjs';
import GeneratorOptions from '../components/GeneratorOptions.vue';
import RangeSlider from '../components/RangeSlider.vue';
import FabricSelector from '../components/FabricSelector.vue';
import {normalizePatternFabric,fabricGridFromCm} from '../../core/pattern-fabric.mjs';
import {watchPaletteRestrictions} from '../generator-palette.mjs';
import {fabricSize} from '../../core/fabric.mjs';
import GeneratorQuality from '../components/GeneratorQuality.vue';
import PatternProcurement from '../components/PatternProcurement.vue';
import {searchSupplierProducts} from '../supplier-catalogues.mjs';
import {createGenerationPreview} from '../generation-preview.mjs';
import {SYMBOL_MODES} from '../../core/pattern-symbols.mjs';
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
const generationOptions=reactive({background:{mode:'white',color:'#ffffff',tolerance:12},fixedColors:[],excludedColors:[]}),restrictionsReset=ref(false);
const supplierCatalogues=shallowRef([]),catalogueWarning=ref('');
const catalogueId=ref('bundled-casa-dmc'),catalogueVersions=computed(()=>threadCatalogueVersions(state.value,supplierCatalogues.value));
function catalogueLabel(row){if(row.id==='bundled-casa-dmc')return 'DMC · Mouliné';if(row.id==='bundled-dmc')return `DMC · Mouliné · ${t('generationOriginalPalette')}`;return row.id.startsWith('supplier-')||row.id==='bundled-anchor-stranded'?row.name:`${row.name} · ${row.version}`;}
const livePalette=computed(()=>{try{return paletteKind.value==='inventory'?inventoryPalette(state.value.materials,state.value.lots):paletteKind.value==='preferred'?preferredInventoryPalette(state.value.materials,state.value.lots,{tolerance:preferenceTolerance.value}):selectedThreadPalette(state.value,catalogueId.value,supplierCatalogues.value);}catch{return null}});
const fabric=ref(normalizePatternFabric({type:'aida',countX:14,countY:14,countMeaning:'stitches',overX:1,overY:1,margins:{left:5,right:5,top:5,bottom:5}}));
const dimensions=reactive({widthCm:20,heightCm:20});
const physical=computed(()=>{try{return fabricSize({width:settings.width,height:settings.height,...fabric.value})}catch{return null}});

function previewStats(value){return t('generationPreviewStats',{width:value.width,height:value.height,colors:value.colors.length,stitches:counts(value).total,limit:value.settings.maxColors});}
const settings = reactive({ ...DEFAULT_SETTINGS, symbolMode:'special' }), adjustments = reactive({ x: 0, y: 0, width: 100, height: 100, rotation: 0, flipX: false, flipY: false, brightness: 100, contrast: 100 });
const protectionMode=ref(false),protectionDrag=ref(null),previewStyle=ref('white'),previewZoom=ref(12),previewStage=ref(),previewViewport=reactive({left:0,top:0,width:680,height:320});
const protectedRegions=ref([]),protection=reactive({x:1,y:1,width:3,height:3}),protectionReset=ref(false),preferenceTolerance=ref(6);
const keepRatio = ref(true), taskId = ref(null), pendingInput = ref(null), previewVersion = ref('');
watchPaletteRestrictions(()=>[paletteKind.value,livePalette.value],generationOptions,()=>{restrictionsReset.value=true;});
let sourceToken = 0, creationAttempt, whiteOverview;
const generationState=shallowRef({pending:false,running:false,key:null}),symbolChosen=ref(false),previewChosen=ref(false);
const previewBusy=computed(()=>generationState.value.pending||generationState.value.running);
const patterns = computed(() => state.value.patterns.filter(p => filter.value === 'all' || (filter.value === 'archived' ? p.archived : !p.archived)).filter(p => normalize(patternLibrarySearch(p)).includes(normalize(search.value))).filter(p=>(!collection.value||p.library?.collections?.includes(collection.value))&&(!technique.value||p.library?.technique===technique.value)&&(!favorites.value||p.favorite)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
const fingerprint = () => JSON.stringify({ settings, dimensions, fabric:fabric.value, adjustments,generationOptions, paletteKind: paletteKind.value, catalogueId:catalogueId.value,catalogueDigest:livePalette.value?.catalogue?.digest, preferenceTolerance:preferenceTolerance.value,protectedRegions:protectedRegions.value,inventory:paletteKind.value==='catalogue'?null:{materials:state.value.materials,lots:state.value.lots,reservations:state.value.reservations},source: sourceAsset.value?.digest });
const stalePreview = computed(() => Boolean(generated.value) && previewVersion.value !== fingerprint());
const current = pattern => pattern.revisions?.find(r => r.id === pattern.currentRevisionId);
const validDimensions = () => {
  if (!bitmap.value) return;
  const w = bitmap.value.width * adjustments.width, h = bitmap.value.height * adjustments.height;
  return adjustments.rotation % 180 ? h / w : w / h;
};
function syncDimensions(){if(physical.value){dimensions.widthCm=Number(physical.value.widthCm.toFixed(3));dimensions.heightCm=Number(physical.value.heightCm.toFixed(3));}}
function applyCentimetres(axis){
  try{error.value='';const ratio=validDimensions();if(keepRatio.value&&bitmap.value&&ratio){if(axis==='width')dimensions.heightCm=Number((dimensions.widthCm/ratio).toFixed(4));else if(axis==='height')dimensions.widthCm=Number((dimensions.heightCm*ratio).toFixed(4));}
    const geometry=fabricGridFromCm(dimensions,fabric.value);settings.width=geometry.width;settings.height=geometry.height;settings.count=geometry.effectiveX;settings.fabric=normalizePatternFabric(fabric.value);return true;
  }catch(caught){error.value=errorText(caught);return false;}
}
function resizeFrom(axis) {
  const ratio=validDimensions(),geometry=physical.value;
  if(keepRatio.value&&bitmap.value&&ratio&&geometry&&Number.isFinite(settings[axis])){
    let width=settings.width,height=settings.height;
    if(axis==='width')height=Math.max(1,Math.round(width/ratio*geometry.effectiveY/geometry.effectiveX));else width=Math.max(1,Math.round(height*ratio*geometry.effectiveX/geometry.effectiveY));
    const scale=Math.min(1,500/width,500/height);settings.width=Math.max(1,Math.round(width*scale));settings.height=Math.max(1,Math.round(height*scale));
  }
  syncDimensions();
}
watch(fabric,()=>applyCentimetres(),{deep:true});
function adjustCrop(field,value){adjustments[field]=value;if(field==='x'&&adjustments.x+adjustments.width>100)adjustments.width=100-adjustments.x;if(field==='y'&&adjustments.y+adjustments.height>100)adjustments.height=100-adjustments.y;if(field==='width'&&adjustments.x+value>100)adjustments.x=100-value;if(field==='height'&&adjustments.y+value>100)adjustments.y=100-value;}
function transformed(width, height) {
  if (!bitmap.value) throw Error('image_required');
  const crop = adjustments;
  if (![crop.x, crop.y, crop.width, crop.height].every(Number.isFinite) || crop.x < 0 || crop.y < 0 || crop.width <= 0 || crop.height <= 0 || crop.x + crop.width > 100 || crop.y + crop.height > 100) throw Object.assign(Error(), { code: 'patternCrop' });
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
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
    const overlay=sourceCanvas.value.getContext('2d');overlay.strokeStyle='#634453';overlay.fillStyle='#63445330';overlay.lineWidth=2;for(const r of [...protectedRegions.value,...(protectionDrag.value?[protectionDrag.value.rect]:[])]){const x=r.x/settings.width*sourceCanvas.value.width,y=r.y/settings.height*sourceCanvas.value.height,w=r.width/settings.width*sourceCanvas.value.width,h=r.height/settings.height*sourceCanvas.value.height;overlay.fillRect(x,y,w,h);overlay.strokeRect(x,y,w,h);}
  } catch { /* Input validation is shown when generation is requested. */ }
}
watch(()=>generationOptions.background,drawSource,{deep:true});
watch(adjustments, () => { applyCentimetres('width'); drawSource(); });
watch(()=>JSON.stringify([adjustments.x,adjustments.y,adjustments.width,adjustments.height,adjustments.rotation,adjustments.flipX,adjustments.flipY,settings.width,settings.height]),()=>{if(protectedRegions.value.length){protectedRegions.value=[];protectionReset.value=true;}drawSource();});
watch(protectedRegions,drawSource,{deep:true});
function addProtection(){error.value='';const r={x:protection.x-1,y:protection.y-1,width:protection.width,height:protection.height};if(!Object.values(r).every(Number.isInteger)||r.x<0||r.y<0||r.width<1||r.height<1||r.x+r.width>settings.width||r.y+r.height>settings.height||protectedRegions.value.length>=20){error.value=t('protectionInvalid');return}protectedRegions.value=[...protectedRegions.value,r];protectionReset.value=false;}

function protectionPoint(event){const box=sourceCanvas.value.getBoundingClientRect();return{x:Math.max(0,Math.min(settings.width-1,Math.floor((event.clientX-box.left)/box.width*settings.width))),y:Math.max(0,Math.min(settings.height-1,Math.floor((event.clientY-box.top)/box.height*settings.height)))}}
function beginProtection(event){if(!protectionMode.value||settings.region===0||protectedRegions.value.length>=20||event.button!==0)return;event.preventDefault();sourceCanvas.value.setPointerCapture(event.pointerId);const start=protectionPoint(event);protectionDrag.value={start,rect:{...start,width:1,height:1}};drawSource();}
function moveProtection(event){if(!protectionDrag.value)return;const at=protectionPoint(event),start=protectionDrag.value.start;protectionDrag.value.rect={x:Math.min(start.x,at.x),y:Math.min(start.y,at.y),width:Math.abs(start.x-at.x)+1,height:Math.abs(start.y-at.y)+1};drawSource();}
function endProtection(event){if(!protectionDrag.value)return;if(event.type!=='pointercancel'){moveProtection(event);protectedRegions.value=[...protectedRegions.value,protectionDrag.value.rect];protectionReset.value=false;}protectionDrag.value=null;drawSource();}
function previewScroll(){const el=previewStage.value;if(!el)return;Object.assign(previewViewport,{left:el.scrollLeft,top:el.scrollTop,width:el.clientWidth,height:el.clientHeight});drawPreview();}
function drawPreview(){
 const value=generated.value,canvas=resultCanvas.value;if(!value||!canvas)return;
 // Downsample a bounded symbol chart for Fit: hiding tiny symbols would make a white chart appear empty.
 if(previewStyle.value==='white'&&previewZoom.value<7){
  if(whiteOverview?.revision!==value)whiteOverview={revision:value,canvas:drawPattern(document.createElement('canvas'),value,{cellSize:8,width:value.width*8,height:value.height*8,maxDimension:4096,grid:true,symbols:true,monochrome:true})};
  canvas.width=previewViewport.width;canvas.height=previewViewport.height;const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';context.drawImage(whiteOverview.canvas,-previewViewport.left,-previewViewport.top,value.width*previewZoom.value,value.height*previewZoom.value);return;
 }
 drawPattern(canvas,value,{cellSize:previewZoom.value,width:previewViewport.width,height:previewViewport.height,offsetX:previewViewport.left,offsetY:previewViewport.top,grid:true,symbols:true,monochrome:previewStyle.value==='white'});
}
async function fitPreview(){await nextTick();if(!generated.value||!previewStage.value)return;previewZoom.value=Math.max(.25,Math.floor(Math.min(previewStage.value.clientWidth/generated.value.width,previewStage.value.clientHeight/generated.value.height)*4)/4);previewStage.value.scrollLeft=0;previewStage.value.scrollTop=0;previewScroll();}
watch([generated,previewStyle,previewZoom],async()=>{await nextTick();previewScroll();});
function cancelGeneration(){preview.cancel();taskId.value=null;}
function closeDialog() { cancelGeneration();whiteOverview=null;previous.value=null;generated.value=null; dialog.value = ''; error.value = ''; bitmap.value?.close(); bitmap.value = null; sourceFile.value = null; sourceAsset.value = null; creationAttempt = null; sourceToken++; }
function prepareFabric(){try{return normalizePatternFabric(fabric.value);}catch{fabric.value=normalizePatternFabric({margins:{left:5,right:5,top:5,bottom:5}});return fabric.value;}}
function startBlank(){error.value='';title.value='';Object.assign(settings,DEFAULT_SETTINGS,{symbolMode:'letters'});settings.fabric=prepareFabric();dimensions.widthCm=20;dimensions.heightCm=20;applyCentimetres();dialog.value='blank';}
async function loadSupplierPalettes(){catalogueWarning.value='';try{const rows=[];let offset=0,total=0;do{const page=await searchSupplierProducts({category:'thread',hasRgb:true,offset,limit:100});rows.push(...page.items);total=page.total;offset+=page.items.length;if(!page.items.length)break;}while(offset<total&&offset<6000);supplierCatalogues.value=supplierThreadCatalogues(rows);if(offset<total)catalogueWarning.value=t('generationCatalogueLimit');}catch(caught){catalogueWarning.value=errorText(caught);}}
async function chooseImage(event) {
  const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
  cancelGeneration();const token = ++sourceToken; error.value = ''; busy.value = true;
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
    Object.assign(settings, DEFAULT_SETTINGS,{symbolMode:'special'});symbolChosen.value=false;previewChosen.value=false;previewStyle.value='white';settings.fabric=prepareFabric();settings.count=fabric.value.countX/(fabric.value.countMeaning==='threads'?fabric.value.overX:1);Object.assign(generationOptions,{background:{mode:'white',color:'#ffffff',tolerance:12},fixedColors:[],excludedColors:[]});previous.value=null;restrictionsReset.value=false;protectedRegions.value=[];protectionReset.value=false; keepRatio.value=true;dimensions.widthCm=20;dimensions.heightCm=20;applyCentimetres('width');generated.value=null; dialog.value = 'image';
    await loadSupplierPalettes();await nextTick(); drawSource();
  } catch (caught) { error.value = errorText(caught); }
  finally { if (decoded && decoded !== bitmap.value) decoded.close(); if (token === sourceToken) busy.value = false; }
}
function startGeneration(){
 const effectiveSettings=validateSettings({...settings,fabric:fabric.value,protectedRegions:protectedRegions.value,...(generationOptions.background.mode==='transparent'?{}:{background:{mode:generationOptions.background.mode,...(['color','remove'].includes(generationOptions.background.mode)?{color:generationOptions.background.color}:{}),...(generationOptions.background.mode==='remove'?{tolerance:generationOptions.background.tolerance}:{})}}),fixedColors:[],excludedColors:generationOptions.excludedColors});
 const effectivePalette=paletteKind.value==='inventory'?inventoryPalette(state.value.materials,state.value.lots):paletteKind.value==='preferred'?preferredInventoryPalette(state.value.materials,state.value.lots,{tolerance:preferenceTolerance.value}):selectedThreadPalette(state.value,catalogueId.value,supplierCatalogues.value);
 const image=transformed(effectiveSettings.width,effectiveSettings.height),rgba=image.getContext('2d').getImageData(0,0,effectiveSettings.width,effectiveSettings.height).data,id=crypto.randomUUID(),worker=new Worker(new URL('../engine/worker.js',import.meta.url),{type:'module'});taskId.value=id;let timeout;
 const stop=()=>{clearTimeout(timeout);worker.terminate();if(taskId.value===id)taskId.value=null;};
 const promise=new Promise((resolve,reject)=>{worker.onmessage=event=>{if(event.data.id!==id)return;stop();event.data.error?reject(event.data.error):resolve(event.data.result);};worker.onerror=()=>{stop();reject(Object.assign(new Error(),{code:'generationFailed'}));};timeout=setTimeout(()=>{stop();reject(Object.assign(new Error(),{code:'generationTimeout'}));},120000);worker.postMessage({id,rgba,settings:effectiveSettings,palette:effectivePalette,source:{attachmentId:sourceAsset.value.id,digest:sourceAsset.value.digest,adjustments:{...adjustments}}},[rgba.buffer]);});
 return{promise,cancel:stop};
}
const preview=createGenerationPreview({start:startGeneration,onState:value=>generationState.value=value,onResult:(value,key)=>{previous.value=generated.value;generated.value=value;previewVersion.value=key;error.value='';},onError:caught=>error.value=patternError(caught)});
function schedulePreview(immediate=false){if(dialog.value!=='image'||!bitmap.value||busy.value)return;if(!applyCentimetres()){preview.cancel();return;}const key=fingerprint();if(!immediate&&generated.value&&previewVersion.value===key){preview.cancel();return;}preview.request(key,{immediate});}
function generate(){schedulePreview(true);}
function chooseSymbols(mode){symbolChosen.value=true;settings.symbolMode=mode;}
function choosePreviewStyle(style){previewChosen.value=true;previewStyle.value=style;if(style==='white'&&!symbolChosen.value)settings.symbolMode='special';}
watch(()=>generationOptions.background.mode,mode=>{if(!symbolChosen.value)settings.symbolMode=mode==='white'?'special':'letters';if(!previewChosen.value)previewStyle.value=mode==='white'?'white':'color';});
watch([fingerprint,dialog,busy],()=>schedulePreview(),{flush:'post'});
function patternError(caught) { const code = caught?.code || caught?.message; return code === 'engine.inventoryPaletteEmpty' ? t('inventoryPaletteEmpty') : code === 'patternCrop' ? t('patternCrop') : errorText(caught); }
async function saveNew() {
  if (busy.value || !title.value.trim()) return;
  busy.value = true; error.value = '';
  try {
    if(dialog.value==='blank'&&!applyCentimetres())return;
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
onBeforeUnmount(() => { preview.dispose(); bitmap.value?.close(); sourceToken++; });
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
        <div class="form-section"><div class="form-grid"><FormField :label="`${t('width')} (cm)`" v-slot="{id}"><input :id="id" v-model.number="dimensions.widthCm" type="number" min="0.01" step="0.01" @input="applyCentimetres('width')"/></FormField><FormField :label="`${t('height')} (cm)`" v-slot="{id}"><input :id="id" v-model.number="dimensions.heightCm" :readonly="keepRatio&&dialog==='image'" type="number" min="0.01" step="0.01" @input="applyCentimetres('height')"/></FormField></div><p v-if="physical" class="field-help">{{t('generationActualSize',{width:number(physical.widthCm,2),height:number(physical.heightCm,2),columns:settings.width,rows:settings.height})}}</p></div>
        <p v-if="dialog==='image'" class="field-help">{{t('generationDesiredSizeHelp')}}</p><FabricSelector v-model="fabric"/>
        <details class="form-section"><summary>{{t('generationGridAdvanced')}}</summary><div class="form-grid"><FormField :label="`${t('width')} (${t('stitches')})`" v-slot="{id}"><input :id="id" v-model.number="settings.width" type="number" min="1" max="500" @change="resizeFrom('width')"/></FormField><FormField :label="`${t('height')} (${t('stitches')})`" v-slot="{id}"><input :id="id" v-model.number="settings.height" type="number" min="1" max="500" @change="resizeFrom('height')"/></FormField></div></details>
      </template>
      <template v-if="dialog === 'image'">
        <label class="checkbox-label"><input v-model="keepRatio" type="checkbox" @change="applyCentimetres('width')" />{{ t('keepRatio') }}</label>
        <div class="form-section"><div class="form-grid"><FormField :label="t('palette')" v-slot="{ id }"><select :id="id" v-model="paletteKind"><option value="catalogue">{{ t('catalogue') }}</option><option value="inventory">{{ t('inventoryOnly') }}</option><option value="preferred">{{t('inventoryPreferred')}}</option></select></FormField><FormField v-if="paletteKind==='catalogue'" :label="t('generationThreadType')" v-slot="{id}"><select :id="id" v-model="catalogueId"><option v-for="row in catalogueVersions" :key="row.id" :value="row.id">{{catalogueLabel(row)}}</option></select></FormField><FormField :label="t('generationStrands')" :help="t('generationStrandsHelp')" v-slot="{id,describedby}"><input :id="id" v-model.number="settings.strands" :aria-describedby="describedby" type="number" min="1" max="6" step="1"/></FormField><FormField :label="t('maxColors')" v-slot="{ id }"><input :id="id" v-model.number="settings.maxColors" type="number" min="1" max="500" /></FormField><FormField :label="t('mode')" v-slot="{ id }"><select :id="id" v-model="settings.mode"><option v-for="mode in ['detail','balanced','simple']" :key="mode" :value="mode">{{ t(mode) }}</option></select></FormField></div></div>
        <p class="notice">{{t('generationFidelityHelp')}}</p><p class="field-help">{{t('generationSupplierColoursHelp')}}</p><p v-if="catalogueWarning" class="notice warning">{{catalogueWarning}}</p>
        <GeneratorOptions v-model:background="generationOptions.background" v-model:excluded="generationOptions.excludedColors" :palette="livePalette" /><p v-if="restrictionsReset" class="notice warning">{{t('generationRestrictionsReset')}}</p>
        <p v-if="paletteKind!=='catalogue'" class="notice">{{t('inventoryGenerationHelp')}}</p><FormField v-if="paletteKind==='preferred'" :label="t('preferenceTolerance')" :help="t('preferenceRule')" v-slot="{id,describedby}"><input :id="id" v-model.number="preferenceTolerance" :aria-describedby="describedby" type="number" min="0" max="15" step="0.5" /></FormField>
        <details class="form-section"><summary>{{ t('imageAdjustments') }}</summary><div class="form-grid" style="margin-top:16px"><FormField v-for="field in ['x','y','width','height']" :key="field" :label="t(`crop_${field}`)" v-slot="{ id }"><RangeSlider :id="id" :model-value="adjustments[field]" :min="field==='width'||field==='height'?1:0" :max="field==='x'||field==='y'?99:100" unit="%" @update:model-value="adjustCrop(field,$event)"/></FormField><FormField :label="t('brightness')" v-slot="{ id }"><RangeSlider :id="id" v-model="adjustments.brightness" :min="20" :max="180" unit="%"/></FormField><FormField :label="t('contrast')" v-slot="{ id }"><RangeSlider :id="id" v-model="adjustments.contrast" :min="20" :max="180" unit="%"/></FormField><FormField :label="t('removeRegions')" :help="t('removeRegionsHelp')" v-slot="{ id }"><RangeSlider :id="id" v-model="settings.region" :min="0" :max="30"/></FormField></div><div class="actions" style="margin-top:14px"><button class="button small" @click="adjustments.rotation = (adjustments.rotation + 90) % 360"><RotateCw :size="16" />{{ t('rotate') }}</button><button class="button small" :aria-pressed="adjustments.flipX" @click="adjustments.flipX = !adjustments.flipX"><FlipHorizontal2 :size="16" />{{ t('flipHorizontal') }}</button><button class="button small" :aria-pressed="adjustments.flipY" @click="adjustments.flipY = !adjustments.flipY"><FlipVertical2 :size="16" />{{ t('flipVertical') }}</button></div></details>
        <details v-if="settings.region>0" class="form-section"><summary>{{t('protectionKeyboard')}}</summary><p class="field-help">{{t('protectionHelp')}}</p><p v-if="protectionReset" class="notice warning">{{t('protectionReset')}}</p><div class="form-grid"><FormField v-for="key in ['x','y','width','height']" :key="key" :label="t(`protection_${key}`)" v-slot="{id}"><input :id="id" v-model.number="protection[key]" type="number" min="1" :max="key==='x'||key==='width'?settings.width:settings.height" /></FormField></div><button class="button small" :disabled="protectedRegions.length>=20" @click="addProtection">{{t('addProtection')}}</button><div v-for="(rect,index) in protectedRegions" :key="index" class="stat-row"><span>{{rect.x+1}}, {{rect.y+1}} · {{rect.width}} × {{rect.height}}</span><button class="button text small" @click="protectedRegions=protectedRegions.filter((_,i)=>i!==index)">{{t('remove')}}</button></div></details>
        <div class="form-section"><h3>{{t('sourcePreview')}}</h3><p class="field-help">{{t(settings.region>0?'protectionDragHelp':'protectionCleanupOff')}}</p><div v-if="settings.region>0" class="actions"><button class="button small" :aria-pressed="protectionMode" :disabled="protectedRegions.length>=20" @click="protectionMode=!protectionMode">{{t('protectionDraw')}}</button><button class="button text small" :disabled="!protectedRegions.length" @click="protectedRegions=[]">{{t('protectionClear')}}</button><span class="badge">{{protectedRegions.length}} / 20</span></div><canvas ref="sourceCanvas" class="transparency-surface" role="img" :aria-label="t('sourcePreview')" :style="{maxWidth:'100%',height:'auto',touchAction:protectionMode?'none':'auto',cursor:protectionMode?'crosshair':'default'}" @pointerdown="beginProtection" @pointermove="moveProtection" @pointerup="endProtection" @pointercancel="endProtection"/></div><div class="form-section"><div v-if="previous"><h3>{{t('previousGeneration')}}</h3><p class="field-help">{{previewStats(previous)}}</p><div class="project-cover"><PatternThumbnail :revision="previous" :label="t('previousGeneration')"/></div></div><div><h3>{{ t('currentGeneration') }}</h3><p v-if="generated" class="field-help">{{previewStats(generated)}}</p><template v-if="generated"><div class="toolbar"><div class="segmented" role="group" :aria-label="t('generationChartStyle')"><button :class="{selected:previewStyle==='color'}" :aria-pressed="previewStyle==='color'" @click="choosePreviewStyle('color')">{{t('generationColorSymbols')}}</button><button :class="{selected:previewStyle==='white'}" :aria-pressed="previewStyle==='white'" @click="choosePreviewStyle('white')">{{t('generationWhiteSymbols')}}</button></div><button class="button small" @click="fitPreview">{{t('fit')}}</button><button class="button small" @click="previewZoom=14">{{t('generationReadSymbols')}}</button></div><FormField :label="t('generationSymbols')" v-slot="{id}"><select :id="id" :value="settings.symbolMode" @change="chooseSymbols($event.target.value)"><option v-for="mode in SYMBOL_MODES" :key="mode" :value="mode">{{t(`symbolMode_${mode}`)}}</option></select></FormField><FormField :label="t('zoom')" v-slot="{id}"><RangeSlider :id="id" v-model="previewZoom" :min="0.25" :max="32" :step="0.25"/></FormField><div ref="previewStage" class="editor-stage" style="height:320px;min-height:240px" @scroll="previewScroll"><div :style="{position:'relative',width:`${generated.width*previewZoom}px`,height:`${generated.height*previewZoom}px`}"><canvas ref="resultCanvas" role="img" :aria-label="t('generationChartPreview')" :style="{position:'absolute',left:`${previewViewport.left}px`,top:`${previewViewport.top}px`}"/></div></div><p class="field-help">{{t('generationChartHelp')}}</p></template><p v-else class="muted">{{ t('generatePreviewHelp') }}</p><p v-if="stalePreview&&!previewBusy" class="notice warning">{{ t('stalePreview') }}</p></div></div>
        <p v-if="previous" class="notice">{{t('generationComparisonHelp')}}</p><GeneratorQuality v-if="generated && !stalePreview" :revision="generated" /><details v-if="generated&&!stalePreview" class="form-section"><summary>{{t('generationMaterialsReview')}}</summary><PatternProcurement :revision="generated" :fabric="fabric"/></details><p class="notice">{{t(generationOptions.background.mode==='remove'?'generationRemovalHelp':generationOptions.background.mode==='transparent'?'generationTransparentHelp':'generationCompositeHelp')}}</p><p v-if="previewBusy" role="status" class="notice">{{t(generationState.running?'generating':'generationLiveQueued')}}</p>
      </template>
      <template v-if="dialog === 'native' && pendingInput"><p class="notice">{{ pendingInput.revision.width }} × {{ pendingInput.revision.height }} {{ t('stitches') }} · {{ pendingInput.revision.colors.length }} {{ t('colors') }}. {{ t('nativeImportHelp') }}</p><p v-if="pendingInput.detachedBindings" class="notice">{{t('standaloneBindingsDetached',{count:pendingInput.detachedBindings})}}</p><PatternThumbnail :revision="pendingInput.revision" :label="title" /></template>
      <template #footer><button v-if="previewBusy" class="button" @click="cancelGeneration">{{ t('cancelGeneration') }}</button><button v-else class="button" :disabled="busy" @click="closeDialog">{{ t('cancel') }}</button><button v-if="dialog === 'image'" class="button" :disabled="busy" @click="generate">{{t('generationUpdateNow')}}</button><button class="button primary" :disabled="busy || !title.trim() || (dialog === 'image' && (!generated || stalePreview || previewBusy))" @click="dialog === 'native' ? confirmImport() : saveNew()">{{ t('save') }}</button></template>
    </AppDialog>
  </section>
<ReferenceBatchImport v-if="referenceBatch" @close="referenceBatch=false"/>
</template>
