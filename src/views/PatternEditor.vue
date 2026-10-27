<script setup>
import { computed, shallowRef, ref, reactive, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { ArrowLeft, Save, Undo2, Redo2, Pencil, Eraser, PaintBucket, Move, Minus, Square, Slash, MousePointer2, Check, Download, Plus, Copy, ClipboardPaste, RotateCw, FlipHorizontal2, FlipVertical2, Maximize, FileImage } from '@lucide/vue';
import PatternDetails from '../components/PatternDetails.vue';
import PageHeader from '../components/PageHeader.vue';
import EmptyState from '../components/EmptyState.vue';
import AppDialog from '../components/AppDialog.vue';
import FormField from '../components/FormField.vue';
import ReferenceReader from '../components/ReferenceReader.vue';
import ThreadSubstitutions from '../components/ThreadSubstitutions.vue';
import PaletteRecipes from '../components/PaletteRecipes.vue';
import EditorInserts from '../components/EditorInserts.vue';
import WorkCompanion from '../components/WorkCompanion.vue';
import {workProgress} from '../../core/work-companion.mjs';
import {integer} from '../../core/shared.mjs';
import { state, dispatch, navigate, notify, normalize } from '../state';
import { storage, windowControls } from '../storage';
import { createDraftAutosave } from '../editor-draft.mjs';
import { t, language, number, errorText } from '../i18n';
import {selectedThreadPalette,threadCatalogueVersions} from '../thread-catalogues.mjs';
import { validateRevision, counts, paint, fill, line, rectangle, replaceColor, copySelection, pasteSelection, moveSelection, rotate, flip, resize, resizeImpact, addHalfStitch, addBackstitch, SYMBOLS } from '../../core/pattern.mjs';
import { drawPattern } from '../pattern-render.mjs';
import { patternPng, patternPdf } from '../pattern-export.mjs';

const props = defineProps({ id: { type: String, required: true }, projectId: String });
const project = computed(() => props.projectId ? state.value.projects.find(p => p.id === props.projectId) : null);
const pattern = computed(() => state.value.patterns.find(p => p.id === (props.projectId?project.value?.patternId:props.id)));
const progressMode = computed(() => Boolean(props.projectId));
const chosenRevisionId = ref('');
const persisted = computed(() => pattern.value?.revisions.find(r => r.id === (project.value?.revisionId || chosenRevisionId.value || pattern.value.currentRevisionId)));
const draft = shallowRef(null), history = shallowRef([]), future = shallowRef([]), dirty = ref(false), error = ref(''), working = ref(false);
const canvas = ref(), stage = ref(), zoom = ref(12), showCenter = ref(true), grid = ref(true), symbols = ref(false), monochrome = ref(false), selected = ref(0), highlight = ref(false), tool = ref('pan');
const cursor = reactive({ x: 0, y: 0 }), selection = ref(null), clipboard = shallowRef(null), dialog = ref(''), name = ref('');
const viewport = reactive({ left: 0, top: 0, width: 900, height: 520 });
const resizeForm = reactive({ width: 100, height: 100, offsetX: 0, offsetY: 0 });
const exportForm = reactive({ kind: 'pdf', locale: language.value, paper: 'a4', orientation:'portrait', margin:14, monochrome: false, progress: true });
const colorSearch = ref(''), newColor = reactive({ code: '', name: '', hex: '#634453', brand: '', strands: 2, symbol: '' }), replacement = ref(0), symbolDraft = ref(''), strandDraft = ref(2);
const pendingProgress = ref(null), progressHistory = shallowRef([]), progressFuture = shallowRef([]), revisionNotes = ref('');
const recipeIndex=ref(-1),backStrandDraft=ref(1);
const baseRevisionId = ref(''), recoveryHold = ref(false), recovery = shallowRef(null);
const draftStatus = shallowRef({pending:false,saving:false,hasDraft:false,savedAt:null,error:null});
const workType=ref('all'),paletteQuery=ref(''),markerPanel=ref(),coordinateDraft=reactive({column:1,row:1});
const viewStatus=shallowRef({pending:false,saving:false,hasDraft:false,savedAt:null,error:null});
let viewLoading=false,workScope={patternId:null,revisionId:null};
let pointer = null, resizeObserver, frame, allowLeave = false, pendingNavigation = null, lastSeenKey = '';
let closeRequested=false;
const completed = computed(() => new Set(project.value?.completed ?? []));
const metrics = computed(() => draft.value ? counts(draft.value) : null);
const completedSignature=computed(()=>project.value?.completed.join('|')??'');
const workMetrics=computed(()=>progressMode.value&&draft.value?workProgress(draft.value,completedSignature.value?completedSignature.value.split('|'):[]):null);
const paletteRows=computed(()=>{const query=paletteQuery.value.trim().toLocaleLowerCase();return(draft.value?.colors??[]).map((color,index)=>({color,index})).filter(({color})=>!query||[color.brand,color.range,color.code,color.name,color.symbol,...(color.blend?.components??[]).flatMap(c=>[c.brand,c.range,c.code,c.name])].join(' ').toLocaleLowerCase().includes(query))});
const colourCatalogueId=ref('bundled-dmc'),colourCatalogueVersions=computed(()=>threadCatalogueVersions(state.value));
const existingColors = computed(() => {const palette=selectedThreadPalette(state.value,colourCatalogueId.value);return palette.colors.filter(c=>normalize([c.brand,c.range,c.code,c.name].join(' ')).includes(normalize(colorSearch.value))).slice(0,60).map(color=>({...color,catalogueRef:palette.catalogue}));});
const selectedColor = computed(() => draft.value?.colors[selected.value]);
const totalWidth = computed(() => (draft.value?.width ?? 1) * zoom.value), totalHeight = computed(() => (draft.value?.height ?? 1) * zoom.value);
const tools = computed(() => progressMode.value ? [ ['pan',Move],['mark',Check],['unmark',Eraser],['select',MousePointer2] ] : [ ['pan',Move],['paint',Pencil],['erase',Eraser],['fill',PaintBucket],['line',Minus],['rectangle',Square],['half',Slash],['backstitch',Slash],['select',MousePointer2] ]);
const blockedWork = computed(() => progressMode.value && ['completed', 'archived'].includes(project.value?.status));
const impact = computed(() => { try { return draft.value ? resizeImpact(draft.value, resizeForm.width, resizeForm.height, resizeForm) : null; } catch { return null; } });

const draftAutosave = createDraftAutosave({
  snapshot: () => ({ patternId: props.id, baseRevisionId: baseRevisionId.value, name: name.value,
    revision: { ...structuredClone(draft.value), notes: revisionNotes.value } }),
  save: async value => { const next = await dispatch('pattern.draft.save', value); return next.patterns.find(row => row.id === value.patternId).draft; },
  discard: () => dispatch('pattern.draft.discard', {patternId:props.id}),
  onStatus: value => {
    const before=draftStatus.value, changed=before.pending!==value.pending || before.hasDraft!==value.hasDraft || before.savedAt!==value.savedAt;
    if(changed || before.saving!==value.saving || before.error!==value.error)draftStatus.value=value;
    if(changed)publishAutosaveStatus();
  },
});
function publishAutosaveStatus(){window.dispatchEvent(new CustomEvent('ricamo:draft-state',{detail:{pending:draftStatus.value.pending||viewStatus.value.pending,hasDraft:draftStatus.value.hasDraft,savedAt:draftStatus.value.savedAt||viewStatus.value.savedAt}}));}
const viewAutosave=createDraftAutosave({snapshot:()=>({projectId:props.projectId,...workScope,view:{zoom:zoom.value,x:stage.value?.scrollLeft??0,y:stage.value?.scrollTop??0,cursor:{...cursor},selectedColor:selected.value,grid:grid.value,symbols:symbols.value,monochrome:monochrome.value,highlight:highlight.value,workType:workType.value}}),save:async payload=>{const next=await dispatch('project.work.view',payload);return next.projects.find(row=>row.id===payload.projectId)},discard:async()=>{},onStatus:value=>{viewStatus.value=value;publishAutosaveStatus();},delay:700});
const draftBase = computed(() => pattern.value?.revisions.find(row=>row.id === (recovery.value?.baseRevisionId || baseRevisionId.value)));
const oldDraftBase = computed(() => Boolean(baseRevisionId.value && pattern.value?.currentRevisionId !== baseRevisionId.value));
function changed() { if (progressMode.value || recoveryHold.value || !draft.value) return; dirty.value = true; error.value='';draftAutosave.changed(); }
function canEdit() { if (recoveryHold.value) { error.value=t('draftResumeToEdit'); return false; } return !working.value && !progressMode.value; }
async function loadSavedRevision(id, { offerRecovery = false } = {}) {
  error.value='';viewLoading=true;
  if(viewStatus.value.pending)await viewAutosave.discard();
  if (!pattern.value || pattern.value.kind !== 'structured') { draft.value=null;viewLoading=false;return; }
  const saved = pattern.value.revisions.find(row=>row.id === id);if(!saved){viewLoading=false;return;}
  workScope={patternId:pattern.value.id,revisionId:saved.id};viewAutosave.reset();
  chosenRevisionId.value=saved.id; baseRevisionId.value=saved.id; draft.value=structuredClone(saved);
  name.value=saved.name || t('revision'); revisionNotes.value=saved.notes || ''; dirty.value=false;
  history.value=[];future.value=[];progressHistory.value=[];progressFuture.value=[];selected.value=0;selection.value=null;
  recovery.value=!progressMode.value && pattern.value.draft ? structuredClone(pattern.value.draft) : null;
  recoveryHold.value=Boolean(recovery.value); draftAutosave.reset({hasDraft:recoveryHold.value,savedAt:recovery.value?.updatedAt});
  tool.value=progressMode.value?'mark':'pan'; if(offerRecovery && recoveryHold.value)dialog.value='recover';
  await nextTick();
  const view=project.value?.view,scoped=view?.patternId===pattern.value.id&&view?.revisionId===saved.id;
  selected.value=scoped?view.selectedColor??0:0;Object.assign(cursor,scoped?view.cursor??{x:0,y:0}:{x:0,y:0});
  grid.value=scoped?view.grid??true:true;symbols.value=scoped?view.symbols??false:false;monochrome.value=scoped?view.monochrome??false:false;highlight.value=scoped?view.highlight??false:false;workType.value=scoped?view.workType??'all':'all';
  if(scoped&&view.zoom&&stage.value){zoom.value=view.zoom;await nextTick();stage.value.scrollLeft=view.x??0;stage.value.scrollTop=view.y??0;}else fit();
  await nextTick();viewLoading=false;scheduleDraw();

}
function resumeDraft() {
  const saved=pattern.value?.draft; if(!saved)return;
  chosenRevisionId.value=saved.baseRevisionId;baseRevisionId.value=saved.baseRevisionId;draft.value=structuredClone(saved.revision);
  name.value=saved.name || t('revision');revisionNotes.value=saved.revision.notes||'';dirty.value=true;recoveryHold.value=false;recovery.value=null;
  history.value=[];future.value=[];draftAutosave.reset({hasDraft:true,savedAt:saved.updatedAt});dialog.value='';nextTick(()=>{fit();scheduleDraw();});
}
function openSaved() { dialog.value='';recoveryHold.value=Boolean(pattern.value?.draft); }
async function discardRecovery() {
  working.value=true;
  try { await draftAutosave.discard();dialog.value='';await loadSavedRevision(pattern.value.currentRevisionId); }
  catch(caught){error.value=errorText(caught);}finally{working.value=false;}
}
async function retryDraft() { try {await draftAutosave.flush();error.value='';}catch(caught){error.value=errorText(caught);} }
function draftTime(value) { return value ? new Date(value).toLocaleString(language.value==='en'?'en-GB':'it-IT') : ''; }

function draw() {
  if (!draft.value || !canvas.value || !stage.value) return;
  viewport.left = stage.value.scrollLeft; viewport.top = stage.value.scrollTop; viewport.width = stage.value.clientWidth; viewport.height = stage.value.clientHeight;
  drawPattern(canvas.value, draft.value, { cellSize: zoom.value, offsetX: viewport.left, offsetY: viewport.top,
    width: Math.min(viewport.width, totalWidth.value), height: Math.min(viewport.height, totalHeight.value), grid: grid.value, symbols: symbols.value, monochrome: monochrome.value,
    completed: progressMode.value ? completed.value : [], highlightColor: highlight.value ? selected.value : -1, selection: selection.value, centerGuide:showCenter.value, cursor });
}
function scheduleDraw() { cancelAnimationFrame(frame); frame = requestAnimationFrame(draw); }
function fit() {
  if (!stage.value || !draft.value) return;
  zoom.value = Math.max(1, Math.min(36, Math.floor(Math.min(stage.value.clientWidth / draft.value.width, stage.value.clientHeight / draft.value.height) * 10) / 10));
  stage.value.scrollLeft = 0; stage.value.scrollTop = 0; scheduleDraw();
}
function scroll() { scheduleDraw(); saveViewSoon(); }
function saveViewSoon() { if(project.value&&!viewLoading&&draft.value&&workScope.patternId===project.value.patternId&&workScope.revisionId===project.value.revisionId)viewAutosave.changed(); }

watch([() => props.id, () => props.projectId,()=>project.value?.patternId,()=>project.value?.revisionId], async () => {
  error.value='';dialog.value='';chosenRevisionId.value='';
  if (!pattern.value || pattern.value.kind !== 'structured') { await viewAutosave.discard();draft.value=null;draftAutosave.reset();viewLoading=false;return; }
  await loadSavedRevision(project.value?.revisionId || pattern.value.currentRevisionId,{offerRecovery:!progressMode.value});
}, {immediate:true});
watch([zoom, grid, symbols, selected,monochrome,highlight,workType,showCenter], () => { scheduleDraw(); saveViewSoon(); });
watch([monochrome, highlight, selection, draft, () => JSON.stringify(project.value?.completed ?? [])], scheduleDraw);
watch(cursor,()=>{coordinateDraft.column=cursor.x+1;coordinateDraft.row=cursor.y+1;scheduleDraw();saveViewSoon();});
function edit(operation) {
  if (!canEdit() || !draft.value) return false;
  try { const previous = draft.value, next = operation(previous); validateRevision(next); history.value = [...history.value, previous].slice(-20); future.value = []; draft.value = next; changed(); error.value = ''; return true; }
  catch (caught) { error.value = errorText(caught); return false; }
}
function undo() {
  if(working.value)return;
  if (progressMode.value) return undoProgress(false);
  if (!history.value.length) return; future.value = [...future.value, draft.value]; draft.value = history.value.at(-1); history.value = history.value.slice(0, -1); changed();
}
function redo() {
  if(working.value)return;
  if (progressMode.value) return undoProgress(true);
  if (!future.value.length) return; history.value = [...history.value, draft.value]; draft.value = future.value.at(-1); future.value = future.value.slice(0, -1); changed();
}
function coordinates(event, vertex = false) {
  const rect = canvas.value.getBoundingClientRect();
  let x = (event.clientX - rect.left + viewport.left) / zoom.value, y = (event.clientY - rect.top + viewport.top) / zoom.value;
  if (vertex) { x = Math.round(x * 2) / 2; y = Math.round(y * 2) / 2; return { x: Math.max(0, Math.min(draft.value.width, x)), y: Math.max(0, Math.min(draft.value.height, y)) }; }
  return { x: Math.max(0, Math.min(draft.value.width - 1, Math.floor(x))), y: Math.max(0, Math.min(draft.value.height - 1, Math.floor(y))) };
}
const area = (a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x) + 1, height: Math.abs(b.y - a.y) + 1 });
function pointerDown(event) {
  if (!draft.value || working.value || event.button !== 0) return;
  if (recoveryHold.value && !['pan','select'].includes(tool.value) && !event.altKey) { dialog.value='recover';return; }
  canvas.value.focus(); canvas.value.setPointerCapture(event.pointerId);
  const at = coordinates(event); Object.assign(cursor, at);
  pointer = { start: at, end: at, vertex: coordinates(event, true), clientX: event.clientX, clientY: event.clientY, left: stage.value.scrollLeft, top: stage.value.scrollTop, previous: draft.value, changed: false, tool: event.altKey ? 'pan' : tool.value };
  if (pointer.tool === 'pan') return;
  if (pointer.tool === 'select') { selection.value = area(at, at); return; }
  if (progressMode.value) { selection.value = area(at, at); return; }
  if (!draft.value.colors.length && pointer.tool !== 'erase') { pointer = null; dialog.value = 'color'; return; }
  if (pointer.tool === 'fill') { edit(p => fill(p, at.x, at.y, selected.value)); pointer = null; }
  else if (pointer.tool === 'half') { edit(p => addHalfStitch(p, { id: crypto.randomUUID(), x: at.x, y: at.y, color: selected.value, direction: event.shiftKey ? '\\' : '/' })); pointer = null; }
  else if (['paint', 'erase'].includes(pointer.tool)) stroke(at);
}
function stroke(at) {
  if (!pointer || lastSeenKey === `${at.x}:${at.y}`) return;
  const from = pointer.end;
  try { draft.value = line(draft.value, from.x, from.y, at.x, at.y, pointer.tool === 'erase' ? -1 : selected.value); pointer.end = at; pointer.changed = true; lastSeenKey = `${at.x}:${at.y}`; changed(); }
  catch (caught) { error.value = errorText(caught); }
}
function pointerMove(event) {
  if (!draft.value || working.value) return;
  const at = coordinates(event); Object.assign(cursor, at);
  if (!pointer) return;
  if (pointer.tool === 'pan') { stage.value.scrollLeft = pointer.left - (event.clientX - pointer.clientX); stage.value.scrollTop = pointer.top - (event.clientY - pointer.clientY); return; }
  if (pointer.tool === 'select' || progressMode.value) { pointer.end = at; selection.value = area(pointer.start, at); return; }
  if (['paint', 'erase'].includes(pointer.tool)) stroke(at);
  else { pointer.end = at; selection.value = area(pointer.start, at); }
}
function pointerUp(event) {
  if (!pointer) return;
  const active = pointer; pointer = null; lastSeenKey = '';
  if (active.tool === 'pan' || active.tool === 'select') return;
  if (progressMode.value) { if (blockedWork.value) return; requestMark(active.tool === 'unmark' ? 'remove' : 'add', selection.value); return; }
  if (active.changed) { history.value = [...history.value, active.previous].slice(-20); future.value = []; }
  else if (active.tool === 'line') edit(p => line(p, active.start.x, active.start.y, active.end.x, active.end.y, selected.value));
  else if (active.tool === 'rectangle') edit(p => rectangle(p, area(active.start, active.end), selected.value, { filled: event.shiftKey }));
  else if (active.tool === 'backstitch') { const end = coordinates(event, true); if (active.vertex.x !== end.x || active.vertex.y !== end.y) edit(p => addBackstitch(p, { id: crypto.randomUUID(), x1: active.vertex.x, y1: active.vertex.y, x2: end.x, y2: end.y, color: selected.value })); }
  selection.value = null; scheduleDraw();
}
function keysInRect(rect) {
  const keys = [], p = draft.value;
  for (let y = rect.y; y < rect.y + rect.height; y++) for (let x = rect.x; x < rect.x + rect.width; x++) { const i = y * p.width + x; if ((workType.value==='all'||workType.value==='full') && p.cells[i] >= 0 && (!highlight.value || p.cells[i] === selected.value)) keys.push(`c:${i}`); }
  for (const h of p.halfStitches ?? []) if ((workType.value==='all'||workType.value==='half') && h.x >= rect.x && h.x < rect.x + rect.width && h.y >= rect.y && h.y < rect.y + rect.height && (!highlight.value || h.color === selected.value)) keys.push(`h:${h.id}`);
  for (const b of p.backstitches ?? []) if ((workType.value==='all'||workType.value==='backstitch') && Math.min(b.x1,b.x2) >= rect.x && Math.max(b.x1,b.x2) <= rect.x + rect.width && Math.min(b.y1,b.y2) >= rect.y && Math.max(b.y1,b.y2) <= rect.y + rect.height && (!highlight.value || b.color === selected.value)) keys.push(`b:${b.id}`);
  return keys;
}
function requestMark(mode, rect = selection.value) {
  if (!rect || blockedWork.value) return;
  const keys = keysInRect(rect);
  if (!keys.length) { notify(t('noStitchesSelected')); return; }
  pendingProgress.value = { mode, keys,...workScope };
  if (rect.width * rect.height > 1 || keys.length > 1) dialog.value = 'progress';
  else confirmProgress();
}
async function confirmProgress() {
  if (!pendingProgress.value || working.value) return;
  working.value = true;
  try { const previous = [...project.value.completed]; await dispatch('project.progress', { projectId: props.projectId, patternId:pendingProgress.value.patternId,revisionId:pendingProgress.value.revisionId, completed: pendingProgress.value.keys, mode: pendingProgress.value.mode }); progressHistory.value = [...progressHistory.value, previous].slice(-20); progressFuture.value = []; pendingProgress.value = null; dialog.value = ''; selection.value = null; }
  catch (caught) { error.value = errorText(caught); } finally { working.value = false; }
}
async function undoProgress(redo) {
  const source = redo ? progressFuture : progressHistory, destination = redo ? progressHistory : progressFuture;
  if (!source.value.length || working.value || blockedWork.value) return;
  working.value = true;
  try { const previous = [...project.value.completed]; await dispatch('project.progress', { projectId: props.projectId, ...workScope, completed: source.value.at(-1), mode: 'replace' }); source.value = source.value.slice(0, -1); destination.value = [...destination.value, previous]; }
  catch (caught) { error.value = errorText(caught); } finally { working.value = false; }
}
function keydown(event) {
  if (!draft.value || working.value) return;
  if ((event.ctrlKey || event.metaKey) && ['z', 'y', 's', 'c', 'v'].includes(event.key.toLowerCase())) {
    event.preventDefault(); const key = event.key.toLowerCase();
    if (key === 'z') event.shiftKey ? redo() : undo(); else if (key === 'y') redo(); else if (key === 's') progressMode.value?retryWorkView():openSave(); else if (key === 'c') copy(); else if (key === 'v') paste(); return;
  }
  if(progressMode.value&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&['b','p'].includes(event.key.toLowerCase())){event.preventDefault();markerPanel.value?.open(event.key.toLowerCase()==='p'?'parked':'bookmark');return;}
  const movements = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (movements[event.key]) {
    event.preventDefault(); cursor.x = Math.max(0, Math.min(draft.value.width - 1, cursor.x + movements[event.key][0])); cursor.y = Math.max(0, Math.min(draft.value.height - 1, cursor.y + movements[event.key][1]));
    if (cursor.x * zoom.value < stage.value.scrollLeft || cursor.x * zoom.value > stage.value.scrollLeft + stage.value.clientWidth - zoom.value) stage.value.scrollLeft = Math.max(0, cursor.x * zoom.value - stage.value.clientWidth / 2);
    if (cursor.y * zoom.value < stage.value.scrollTop || cursor.y * zoom.value > stage.value.scrollTop + stage.value.clientHeight - zoom.value) stage.value.scrollTop = Math.max(0, cursor.y * zoom.value - stage.value.clientHeight / 2);
  } else if (event.code === 'Space' && progressMode.value) { event.preventDefault(); requestMark(tool.value === 'unmark' ? 'remove' : 'add', { ...cursor, width: 1, height: 1 }); }
  else if (event.code === 'Space' && !progressMode.value && !['pan','select'].includes(tool.value)) { event.preventDefault(); if (tool.value === 'fill') edit(p => fill(p,cursor.x,cursor.y,selected.value)); else if (tool.value === 'half') edit(p => addHalfStitch(p,{id:crypto.randomUUID(),...cursor,color:selected.value,direction:event.shiftKey ? '\\' : '/'})); else edit(p => paint(p,[[cursor.x,cursor.y]],tool.value === 'erase' ? -1 : selected.value)); }
  else if (event.key === 'Escape') { selection.value = null; tool.value = 'pan'; }
}
function copy() { if (selection.value) { clipboard.value = copySelection(draft.value, selection.value); if (clipboard.value.excludedCrossingSegments.length) notify(t('crossingSegmentsHelp')); else notify(t('selectionCopied')); } }
function moveSelected() { if (selection.value && !progressMode.value) { edit(p => moveSelection(p,selection.value,cursor.x,cursor.y)); selection.value = null; } }
function paste() { if (clipboard.value && !progressMode.value) edit(p => pasteSelection(p, clipboard.value, cursor.x, cursor.y)); }
function transform(kind) {
  if (selection.value) {
    clipboard.value = kind === 'rotate' ? rotate(copySelection(draft.value, selection.value)) : flip(copySelection(draft.value, selection.value), kind);
    notify(t('transformedSelectionHelp'));
  } else edit(p => kind === 'rotate' ? rotate(p) : flip(p, kind));
}
function openResize() { Object.assign(resizeForm, { width: draft.value.width, height: draft.value.height, offsetX: 0, offsetY: 0 }); dialog.value = 'resize'; }
function applyResize() { if (!impact.value) return; edit(p => resize(p, resizeForm.width, resizeForm.height, { ...resizeForm, allowCrop: true })); dialog.value = ''; selection.value = null; nextTick(fit); }
function openSave() { if (dirty.value && !progressMode.value) { if(!name.value.trim())name.value=t('revision');dialog.value='save'; } }
async function saveRevision() {
  if (working.value || !name.value.trim()) return;
  working.value=true;
  try {
    await draftAutosave.flush();
    const revision={...structuredClone(draft.value),id:crypto.randomUUID(),name:name.value,notes:revisionNotes.value,
      provenance:{...draft.value.provenance,editorBaseRevisionId:baseRevisionId.value}};
    await dispatch('pattern.save',{id:props.id,revision,clearDraft:true});
    dialog.value='';await loadSavedRevision(revision.id);notify(t('patternSaved'));
  }catch(caught){error.value=errorText(caught);}finally{working.value=false;}
}
function applyThreadSubstitution(color) { return edit(p=>({...structuredClone(p),colors:p.colors.map((row,index)=>index===selected.value?color:row)})); }
function applyRecipe(color) {
  const index=recipeIndex.value;
  const applied=edit(p=>({...structuredClone(p),colors:index<0?[...p.colors,color]:p.colors.map((row,i)=>i===index?color:row)}));
  if(applied)selected.value=index<0?draft.value.colors.length-1:index;
  return applied;
}
function addColor(color) {
  if (!canEdit()) return;
  if (draft.value.colors.length >= 80) { error.value = t('paletteLimit'); return; }
  const symbol = [...SYMBOLS].find(s => !draft.value.colors.some(c => c.symbol === s));
  edit(p => ({ ...structuredClone(p), colors: [...p.colors, { ...color, symbol, strands: Number(color.strands) || 2 }] }));
  selected.value = draft.value.colors.length - 1; dialog.value = '';
}
function addCustomColor() { const hex = newColor.hex; addColor({ brand: newColor.brand, code: newColor.code || String(draft.value.colors.length + 1), name: newColor.name || newColor.code || t('customColor'), hex, rgb: [1,3,5].map(i => parseInt(hex.slice(i, i + 2), 16)), strands: newColor.strands }); }
function saveSymbol() {
  if (edit(p => ({ ...structuredClone(p), colors: p.colors.map((c, i) => i === selected.value ? { ...c, symbol: symbolDraft.value, strands: strandDraft.value, backStrands:backStrandDraft.value } : c) }))) dialog.value = '';
}
function removeColor() {
  if (metrics.value.byColor[selected.value]?.total) { error.value = t('removeColorHelp'); return; }
  const index = selected.value;
  edit(p => ({ ...structuredClone(p), colors: p.colors.filter((_, i) => i !== index), cells: p.cells.map(c => c > index ? c - 1 : c), halfStitches: p.halfStitches.map(h => ({ ...h, color: h.color > index ? h.color - 1 : h.color })), backstitches: p.backstitches.map(b => ({ ...b, color: b.color > index ? b.color - 1 : b.color })) }));
  selected.value = Math.max(0, Math.min(index, draft.value.colors.length - 1)); dialog.value = '';
}
async function exportPattern() {
  if (working.value) return;
  working.value = true;
  try {
    const fileName = pattern.value.name.replace(/[<>:"/\\|?*]/g, '-').slice(0, 100), revision = structuredClone(exportForm.kind === 'native' ? persisted.value : draft.value);
    const options = { title: pattern.value.name, locale: exportForm.locale, paper: exportForm.paper, orientation: exportForm.orientation, margin: exportForm.margin, monochrome: exportForm.monochrome, completed: exportForm.progress && progressMode.value ? [...completed.value] : [], notes: revisionNotes.value, thread: project.value?.settings?.thread ?? {} };
    const data = exportForm.kind === 'pdf' ? await patternPdf(revision, options) : exportForm.kind === 'png' ? await patternPng(revision, { ...options, symbols: true }) : JSON.stringify({ format: 'ricamo-pattern', version: 1, name: pattern.value.name, revision }, null, 2);
    const saved = await storage.saveFile({ name: `${fileName}.${exportForm.kind === 'native' ? 'ricamopattern' : exportForm.kind}`, data });
    if (saved === false) return;
    dialog.value = ''; notify();
  } catch (caught) { error.value = errorText(caught); } finally { working.value = false; }
}
async function createProject() { if (dirty.value) { error.value = t('saveBeforeProject'); return; } try { const id = crypto.randomUUID(); await dispatch('project.save', { id, name: pattern.value.name, patternId: pattern.value.id, revisionId: persisted.value?.id, status: 'preparing' }); navigate('project', id); } catch (caught) { error.value = errorText(caught); } }
function beforeUnload(event) { if (draftStatus.value.pending||viewStatus.value.pending) { event.preventDefault(); event.returnValue=''; } }
function beforeNavigate(event) { if(progressMode.value&&viewStatus.value.pending&&!allowLeave){event.preventDefault();pendingNavigation=event.detail;leaveWork();return;} if (dirty.value && !allowLeave) { event.preventDefault();pendingNavigation=event.detail;dialog.value='discard'; } }
function stay() { pendingNavigation=null;dialog.value=''; }
async function leaveEditor(discardChanges = false) {
  if (working.value) return;working.value=true;
  try {
    if (discardChanges) await draftAutosave.discard(); else await draftAutosave.flush();
    const destination=pendingNavigation;pendingNavigation=null;dialog.value='';allowLeave=true;
    if(destination?.revisionId) await loadSavedRevision(destination.revisionId);
    else navigate(destination?.page || 'patterns',destination?.id || null);
    allowLeave=false;
  }catch(caught){error.value=errorText(caught);}finally{working.value=false;}
}
async function leaveWork(discard=false){if(working.value)return;working.value=true;try{if(discard)await viewAutosave.discard();else await viewAutosave.flush();const target=pendingNavigation;pendingNavigation=null;dialog.value='';allowLeave=true;if(target?.action)target.action();else navigate(target?.page||'project',target?.id||props.projectId);allowLeave=false;}catch(caught){error.value=errorText(caught);dialog.value='workViewLeave';}finally{working.value=false;}}
function leaveContext(action){if(!viewStatus.value.pending){action();return;}pendingNavigation={action};leaveWork();}
defineExpose({leaveContext});
async function retryWorkView(){try{await viewAutosave.flush();error.value='';}catch(caught){error.value=errorText(caught);}}
function changeRevision(event) {
  const id=event.target.value;event.target.value=persisted.value.id;
  if(dirty.value){pendingNavigation={revisionId:id};dialog.value='discard';return;}
  loadSavedRevision(id);
}
async function flushForClose(discardChanges = false) {
  if (working.value) return;closeRequested=false;working.value=true;
  try {
    const autosave=progressMode.value?viewAutosave:draftAutosave;
    if(discardChanges)await autosave.discard();else await autosave.flush();
    if(discardChanges)dirty.value=false;
    dialog.value='';if(windowControls)await windowControls.finishClose();
  }catch(caught){error.value=errorText(caught);dialog.value=progressMode.value?'closeWorkView':'closeDraft';}finally{working.value=false;}
}
function stayAfterCloseFailure() { closeRequested=false;dialog.value='';windowControls?.cancelClose?.().catch(caught=>{error.value=errorText(caught);}); }
function stayAfterWorkFailure() { if(dialog.value==='closeWorkView')stayAfterCloseFailure();else stay(); }
function beforeClose(event) { if(draftStatus.value.pending||viewStatus.value.pending){event.preventDefault();closeRequested=true;if(!working.value)flushForClose();} }
watch(working,value=>{if(!value && closeRequested)flushForClose();});
function selectWorkColor(index){selected.value=index;highlight.value=true;paletteQuery.value='';}
function gotoMarker(marker){if(marker.patternId!==workScope.patternId||marker.revisionId!==workScope.revisionId){error.value=t('work_marker_other_revision');return;}if(marker.color!==null)selectWorkColor(marker.color);if(marker.stitchKind)workType.value=marker.stitchKind;moveCursor(marker.x,marker.y);}
function moveCursor(x,y){Object.assign(cursor,{x,y});stage.value.scrollLeft=Math.max(0,x*zoom.value-stage.value.clientWidth/2);stage.value.scrollTop=Math.max(0,y*zoom.value-stage.value.clientHeight/2);canvas.value?.focus({preventScroll:true});stage.value.scrollIntoView({block:'nearest',inline:'nearest'});saveViewSoon();}
function centerView(){if(!draft.value||!stage.value)return;error.value='';showCenter.value=true;Object.assign(cursor,{x:Math.floor((draft.value.width-1)/2),y:Math.floor((draft.value.height-1)/2)});stage.value.scrollLeft=Math.max(0,draft.value.width*zoom.value/2-stage.value.clientWidth/2);stage.value.scrollTop=Math.max(0,draft.value.height*zoom.value/2-stage.value.clientHeight/2);canvas.value?.focus({preventScroll:true});stage.value.scrollIntoView({block:'nearest',inline:'nearest'});scheduleDraw();saveViewSoon();}
function gotoCoordinate(){try{moveCursor(integer(coordinateDraft.column,'column',{min:1,max:draft.value.width})-1,integer(coordinateDraft.row,'row',{min:1,max:draft.value.height})-1);error.value='';}catch(caught){error.value=t('editorCoordinateRange',{columns:draft.value.width,rows:draft.value.height});}}
onMounted(() => { window.addEventListener('beforeunload', beforeUnload);window.addEventListener('ricamo:before-close',beforeClose); window.addEventListener('ricamo:before-navigate', beforeNavigate); resizeObserver = new ResizeObserver(scheduleDraw); if (stage.value) resizeObserver.observe(stage.value); });
onBeforeUnmount(() => { viewAutosave.dispose();draftAutosave.dispose();window.dispatchEvent(new CustomEvent('ricamo:draft-state',{detail:{pending:false,hasDraft:false,savedAt:null}}));window.removeEventListener('ricamo:before-close',beforeClose);window.removeEventListener('beforeunload', beforeUnload); window.removeEventListener('ricamo:before-navigate', beforeNavigate); resizeObserver?.disconnect(); cancelAnimationFrame(frame); });
</script>

<template>
  <section class="page">
    <button class="button text" @click="navigate(projectId ? 'project' : 'patterns', projectId || null)"><ArrowLeft :size="16" />{{ projectId ? t('project') : t('patterns') }}</button>
    <EmptyState v-if="!pattern" :icon="FileImage" :title="t('noResults')" />
    <template v-else>
      <PageHeader :eyebrow="progressMode ? t('work') : t('patterns')" :title="pattern.name" :description="pattern.kind === 'reference' ? t('referenceEditorHelp') : progressMode ? t('progressDoesNotConsume') : t('editorHelp')"><PatternDetails v-if="!progressMode" :pattern="pattern"/><span v-if="dirty" class="badge" :class="draftStatus.pending?'warning':'green'">{{ t(draftStatus.pending?'draftPending':'draftSaved') }}</span><button v-if="!progressMode" class="button" @click="createProject">{{ t('createProject') }}</button><button v-if="draft" class="button" @click="dialog = 'export'"><Download :size="16" />{{ t('export') }}</button><button v-if="!progressMode && draft" class="button primary" :disabled="!dirty || working" @click="openSave"><Save :size="16" />{{ t('newRevision') }}</button></PageHeader>
      <p v-if="error" role="alert" class="notice error">{{ error }}</p><p v-if="!progressMode && dirty" class="notice" :class="{error:draftStatus.error}" role="status">{{ draftStatus.error?t('draftSaveFailed'):draftStatus.pending?t('draftPendingHelp'):t('draftSavedHelp',{time:draftTime(draftStatus.savedAt)}) }} <button v-if="draftStatus.error" class="button small" @click="retryDraft">{{ t('retry') }}</button></p><p v-if="recoveryHold" class="notice warning">{{ t('draftResumeToEdit') }} <button class="button small" @click="dialog='recover'">{{ t('draftRecovery') }}</button></p><p v-if="!progressMode && dirty && oldDraftBase" class="notice warning">{{ t('draftOldBase') }}</p><p v-if="blockedWork" class="notice warning">{{ t('reopenToProgress') }}</p>
      <ReferenceReader v-if="pattern.kind === 'reference'" :pattern-id="pattern.id" :project-id="projectId" />
      <template v-else-if="draft">
        <div class="toolbar"><select v-if="!progressMode" :value="persisted?.id" :aria-label="t('revision')" @change="changeRevision"><option v-for="r in pattern.revisions" :key="r.id" :value="r.id">{{ r.name || t('revision') }} · {{ r.createdAt?.slice(0,10) }}</option></select><span class="badge">{{ draft.width }} × {{ draft.height }} {{ t('stitches') }}</span><span class="badge">{{ number(metrics.full,0) }} {{ t('fullCrosses') }} · {{ number(metrics.half,0) }} {{ t('half') }} · {{ number(metrics.backstitch,0) }} {{ t('backstitch') }}</span><span v-if="progressMode" class="badge green">{{ completed.size }} / {{ metrics.total }} {{ t('completedPrimitives') }}</span></div>
        <div class="editor-tools" role="toolbar" :aria-label="t('drawingTools')"><button v-for="[key, icon] in tools" :key="key" class="icon-button" :class="{selected:tool === key}" :aria-label="t(key)" :title="t(key)" :aria-pressed="tool === key" :disabled="blockedWork && key !== 'pan' && key !== 'select'" @click="tool = key"><component :is="icon" :size="19" /></button><button class="icon-button" :disabled="progressMode ? !progressHistory.length || working : !history.length" :aria-label="t('undo')" :title="t('undo')" @click="undo"><Undo2 :size="18" /></button><button class="icon-button" :disabled="progressMode ? !progressFuture.length || working : !future.length" :aria-label="t('redo')" :title="t('redo')" @click="redo"><Redo2 :size="18" /></button><label class="checkbox-label"><input v-model="grid" type="checkbox" />{{ t('grid') }}</label><label class="checkbox-label"><input v-model="symbols" type="checkbox" />{{ t('symbols') }}</label><label class="checkbox-label"><input v-model="monochrome" type="checkbox" />{{ t('monochrome') }}</label><button class="button small" @click="fit"><Maximize :size="14" />{{ t('fit') }}</button><label class="sr-only" for="pattern-zoom">{{ t('zoom') }}</label><input id="pattern-zoom" v-model.number="zoom" type="range" min="1" max="36" step="0.5" style="width:110px" /><span class="muted">{{ number(zoom / 12 * 100,0) }}%</span></div>
        <form class="toolbar" @submit.prevent="gotoCoordinate"><FormField v-if="progressMode" :label="t('workTargetType')" v-slot="{id}"><select :id="id" v-model="workType"><option value="all">{{t('all')}}</option><option v-for="kind in ['full','half','backstitch']" :key="kind" :value="kind">{{t(`workKind_${kind}`)}}</option></select></FormField><FormField :label="t('workColumn')" v-slot="{id}"><input :id="id" v-model="coordinateDraft.column" inputmode="numeric"/></FormField><FormField :label="t('workRow')" v-slot="{id}"><input :id="id" v-model="coordinateDraft.row" inputmode="numeric"/></FormField><button class="button" type="submit">{{t('workGotoCoordinate')}}</button><button class="button" type="button" @click="centerView">{{t('editorCenterView')}}</button><label class="checkbox-label"><input v-model="showCenter" type="checkbox"/>{{t('editorCenterGuide')}}</label></form><p v-if="showCenter" class="field-help">{{t('editorCenterHelp',{x:number(draft.width/2,1),y:number(draft.height/2,1)})}}</p><p v-if="progressMode" class="field-help">{{t('workKeyboardHelp')}}</p><p v-if="progressMode&&viewStatus.pending" class="notice" :class="{error:viewStatus.error}" role="status">{{t(viewStatus.error?'workPositionFailed':'workPositionPending')}} <button v-if="viewStatus.error" class="button small" @click="retryWorkView">{{t('retry')}}</button></p>
        <div class="editor-layout"><div>
          <div ref="stage" class="editor-stage" @scroll="scroll"><div :style="{position:'relative',width:`${totalWidth}px`,height:`${totalHeight}px`}"><canvas ref="canvas" tabindex="0" role="img" :aria-label="`${pattern.name}. ${t('canvasKeyboardHelp')} ${progressMode?t('workKeyboardHelp'):''}`" :style="{position:'absolute',left:`${viewport.left}px`,top:`${viewport.top}px`,cursor:tool === 'pan' ? 'grab' : 'crosshair'}" @pointerdown="pointerDown" @pointermove="pointerMove" @pointerup="pointerUp" @pointercancel="pointerUp" @keydown="keydown" /></div></div>
          <p class="cell-subtitle" aria-live="polite">{{ t('coordinate') }}: {{ cursor.x + 1 }}, {{ cursor.y + 1 }} · {{ draft.cells[cursor.y * draft.width + cursor.x] >= 0 ? draft.colors[draft.cells[cursor.y * draft.width + cursor.x]].code : t('emptyCell') }} · {{ t('canvasKeyboardHelp') }}</p>
          <div v-if="selection" class="notice"><span>{{ t('selection') }}: {{ selection.width }} × {{ selection.height }} ({{ selection.x + 1 }}, {{ selection.y + 1 }})</span><div class="actions"><template v-if="progressMode"><button class="button small" :disabled="working || blockedWork" @click="requestMark('add')">{{ t('mark') }}</button><button class="button small" :disabled="working || blockedWork" @click="requestMark('remove')">{{ t('unmark') }}</button></template><template v-else><button class="button small" @click="copy"><Copy :size="14" />{{ t('copySelection') }}</button><button class="button small" @click="moveSelected"><Move :size="14" />{{ t('moveToCursor') }}</button></template></div></div>
          <div v-if="!progressMode" class="editor-tools"><button class="button small" :disabled="!clipboard" @click="paste"><ClipboardPaste :size="14" />{{ t('pasteAtCursor') }}</button><button class="button small" @click="transform('rotate')"><RotateCw :size="14" />{{ t('rotate') }}</button><button class="button small" @click="transform('horizontal')"><FlipHorizontal2 :size="14" />{{ t('flipHorizontal') }}</button><button class="button small" @click="transform('vertical')"><FlipVertical2 :size="14" />{{ t('flipVertical') }}</button><button class="button small" :disabled="recoveryHold || working" @click="dialog='inserts'">{{t('editorInserts')}}</button><button class="button small" @click="openResize">{{ t('resizeGrid') }}</button></div>
          <div v-if="!progressMode" class="panel panel-body"><FormField :label="t('notes')" v-slot="{ id }"><textarea :id="id" v-model="revisionNotes" :readonly="recoveryHold || working" maxlength="20000" @input="changed" /></FormField></div>
          <WorkCompanion v-else ref="markerPanel" :project="project" :pattern-id="pattern.id" :revision="draft" :cursor="cursor" :selected-color="selected" :work-type="workType" :blocked="blockedWork" @goto="gotoMarker" @select-color="selectWorkColor"/>

        </div>
        <aside class="panel"><div class="panel-heading"><h2>{{ t('palette') }}</h2><button v-if="!progressMode" class="icon-button" :aria-label="t('addColor')" @click="dialog = 'color'"><Plus :size="18" /></button></div><div class="panel-body" style="padding:12px"><label class="checkbox-label" style="margin:0 0 12px"><input v-model="highlight" type="checkbox" />{{ t('highlightColor') }}</label><FormField :label="t('workFindReference')" v-slot="{id}"><input :id="id" v-model="paletteQuery" type="search"/></FormField><p v-if="progressMode" class="field-help">{{t('workPaletteCountHelp')}}</p><div class="palette-list"><button v-for="{color,index} in paletteRows" :key="index" class="palette-item" :class="{selected:selected === index}" :aria-pressed="selected === index" @click="selected = index"><span class="swatch" :style="{background:color.hex,color:(color.rgb[0]+color.rgb[1]+color.rgb[2]) > 390 ? '#111' : '#fff'}">{{ color.symbol }}</span><div><strong class="mono">{{ color.code }}</strong><small class="cell-subtitle">{{ color.brand }}</small></div><span :title="progressMode?t('workRemainingOfTotal',{remaining:workMetrics.byColor[index].remaining,total:metrics.byColor[index].total}):''">{{progressMode?`${workMetrics.byColor[index].remaining} / `:''}}{{ metrics.byColor[index].total }}</span></button></div><button v-if="!progressMode" class="button small" style="margin-top:12px" :disabled="draft.colors.length>=80 || recoveryHold" @click="recipeIndex=-1;dialog='blend'">{{t('blendCreate')}}</button><p v-if="!draft.colors.length" class="muted">{{ t('addColorHelp') }}</p><template v-if="selectedColor"><h3 style="margin:18px 0 6px">{{ selectedColor.name }}</h3><p v-if="selectedColor.catalogueRef" class="field-help">{{t('threadCatalogueVersion')}}: {{selectedColor.catalogueRef.name}} · {{selectedColor.catalogueRef.version}}</p><p v-if="selectedColor.blend" class="field-help">{{t('blendPaletteSummary',{components:selectedColor.blend.components.map(row=>`${row.strands} × ${row.brand} ${row.range||''} ${row.code}`).join(' + ')})}}</p><button v-if="!progressMode && selectedColor.blend" class="button small" :disabled="recoveryHold" @click="recipeIndex=selected;dialog='blend'">{{t('blendEdit')}}</button><button v-if="!progressMode && !selectedColor.blend" class="button small" :disabled="recoveryHold" @click="recipeIndex=selected;dialog='blend'">{{t('blendConvert')}}</button><p class="cell-subtitle">{{ selectedColor.strands ?? 2 }} {{ t('strands') }}</p><div v-if="!progressMode" class="stack" style="gap:8px"><button v-if="!selectedColor.blend" class="button small" :disabled="recoveryHold" @click="dialog='threadSubstitution'">{{t('threadSubstitutions')}}</button><button class="button small" @click="replacement = selected; symbolDraft = selectedColor.symbol; strandDraft = selectedColor.strands || 2; backStrandDraft=selectedColor.backStrands || 1; dialog = 'paletteEdit'">{{ t('editColor') }}</button></div></template></div></aside></div>
      </template>
    </template>

    <EditorInserts v-if="dialog==='inserts'" :pattern="draft" :selection="selection" :cursor="cursor" :selected-color="selected" :apply="edit" @close="dialog=''" />
    <ThreadSubstitutions v-if="dialog==='threadSubstitution'" :color="selectedColor" :apply="applyThreadSubstitution" @close="dialog=''"/>
    <PaletteRecipes v-if="dialog==='blend'" :color="recipeIndex<0?undefined:draft.colors[recipeIndex]" :colors="draft.colors" :apply="applyRecipe" @close="dialog=''" />
    <AppDialog v-if="dialog === 'save'" :title="t('newRevision')" :busy="working" @close="dialog = ''"><p v-if="error" role="alert" class="notice error">{{ error }}</p><p class="notice">{{ t('revisionPinnedHelp') }}</p><FormField :label="t('revisionName')" required v-slot="{ id }"><input :id="id" v-model="name" :disabled="working" maxlength="300" autofocus @input="changed" /></FormField><template #footer><button class="button" @click="dialog = ''">{{ t('cancel') }}</button><button class="button primary" :disabled="working || !name.trim()" @click="saveRevision">{{ t('save') }}</button></template></AppDialog>
    <AppDialog v-if="dialog === 'color'" :title="t('addColor')" wide @close="dialog = ''"><p v-if="error" role="alert" class="notice error">{{ error }}</p><FormField :label="t('threadCatalogueVersion')" v-slot="{id}"><select :id="id" v-model="colourCatalogueId"><option v-for="row in colourCatalogueVersions" :key="row.id" :value="row.id">{{row.name}} · {{row.version}}</option></select></FormField><input v-model="colorSearch" :aria-label="t('threadSearchColors')" :placeholder="t('threadSearchColors')" /><p class="field-help">{{t('threadCatalogueColorLimit')}}</p><div class="palette-list" style="margin-top:16px"><button v-for="color in existingColors" :key="JSON.stringify([color.brand,color.range,color.code])" class="palette-item" @click="addColor(color)"><span class="swatch" :style="{background:color.hex}" /><strong>{{color.brand}} {{color.range}} {{ color.code }}</strong> {{ color.name }}</button></div><details class="form-section"><summary>{{ t('customColor') }}</summary><div class="form-grid" style="margin-top:16px"><FormField v-for="field in ['name','brand','code']" :key="field" :label="t(field)" v-slot="{id}"><input :id="id" v-model="newColor[field]" maxlength="100" /></FormField><FormField :label="t('color')" v-slot="{id}"><input :id="id" v-model="newColor.hex" type="color" /></FormField></div><button class="button" style="margin-top:16px" @click="addCustomColor">{{ t('addColor') }}</button></details></AppDialog>
    <AppDialog v-if="dialog === 'paletteEdit'" :title="t('editColor')" @close="dialog = ''"><p v-if="error" role="alert" class="notice error">{{ error }}</p><p class="notice">{{ t('paletteEditHelp') }}</p><div class="form-grid"><FormField :label="t('symbol')" v-slot="{id}"><input :id="id" v-model="symbolDraft" maxlength="4" /></FormField><FormField :label="t('strands')" v-slot="{id}"><input :id="id" v-model.number="strandDraft" :disabled="Boolean(selectedColor?.blend)" type="number" min="1" max="12" /></FormField><FormField :label="t('threadSetting_backStrands')" v-slot="{id}"><input :id="id" v-model.number="backStrandDraft" :disabled="Boolean(selectedColor?.blend)" type="number" min="1" max="12" /></FormField><button class="button" @click="saveSymbol">{{ t('saveSymbol') }}</button><FormField :label="t('replaceWith')" v-slot="{id}"><select :id="id" v-model.number="replacement"><option v-for="(color,index) in draft.colors" :key="index" :value="index">{{ color.code }} · {{ color.name }}</option></select></FormField><button class="button" :disabled="selected === replacement" @click="edit(p => replaceColor(p,selected,replacement)); dialog = ''">{{ t('replaceColor') }}</button></div><p class="cell-subtitle">{{ t('removeColorHelp') }}</p><button class="button danger" :disabled="metrics.byColor[selected]?.total > 0" @click="removeColor">{{ t('remove') }}</button></AppDialog>
    <AppDialog v-if="dialog === 'resize'" :title="t('resizeGrid')" @close="dialog = ''"><p v-if="error" role="alert" class="notice error">{{ error }}</p><div class="form-grid"><FormField v-for="field in ['width','height','offsetX','offsetY']" :key="field" :label="t(field)" v-slot="{id}"><input :id="id" v-model.number="resizeForm[field]" type="number" :min="field.startsWith('offset') ? -500 : 1" max="500" /></FormField></div><p v-if="impact?.removed.length" class="notice warning">{{ t('cropImpact', {count:impact.removed.length}) }}</p><p class="notice">{{ t('revisionPinnedHelp') }}</p><template #footer><button class="button" @click="dialog = ''">{{ t('cancel') }}</button><button class="button primary" :disabled="!impact" @click="applyResize">{{ impact?.removed.length ? t('confirmCrop') : t('confirm') }}</button></template></AppDialog>
    <AppDialog v-if="dialog === 'progress'" :title="t('confirmProgress')" :busy="working" @close="dialog = ''"><p v-if="error" role="alert" class="notice error">{{ error }}</p><p>{{ t('progressImpact',{count:pendingProgress?.keys.length}) }}</p><p class="notice">{{ t('progressDoesNotConsume') }}</p><template #footer><button class="button" :disabled="working" @click="dialog = ''">{{ t('cancel') }}</button><button class="button primary" :disabled="working" @click="confirmProgress">{{ pendingProgress?.mode === 'remove' ? t('unmark') : t('mark') }}</button></template></AppDialog>
    <AppDialog v-if="dialog === 'export'" :title="t('export')" :busy="working" @close="dialog = ''"><p v-if="error" role="alert" class="notice error">{{ error }}</p><p v-if="exportForm.kind==='pdf'" class="field-help">{{t('readingPdfSettingsHelp')}}</p><div class="form-grid"><FormField :label="t('type')" v-slot="{id}"><select :id="id" v-model="exportForm.kind"><option value="pdf">PDF</option><option value="png">PNG</option><option value="native">Ricamo (.ricamopattern)</option></select></FormField><FormField :label="t('language')" v-slot="{id}"><select :id="id" v-model="exportForm.locale"><option value="it">Italiano</option><option value="en">English</option></select></FormField><FormField :label="t('paper')" v-slot="{id}"><select :id="id" v-model="exportForm.paper"><option value="a4">A4</option><option value="letter">Letter</option></select></FormField><template v-if="exportForm.kind==='pdf'"><FormField :label="t('pdfOrientation')" v-slot="{id}"><select :id="id" v-model="exportForm.orientation"><option value="portrait">{{t('pdfPortrait')}}</option><option value="landscape">{{t('pdfLandscape')}}</option></select></FormField><FormField :label="t('pdfMargin')" :help="t('pdfMarginHelp')" v-slot="{id,describedby}"><input :id="id" v-model.number="exportForm.margin" type="number" min="5" max="40" step="0.5" :aria-describedby="describedby" /></FormField></template><label class="checkbox-label"><input v-model="exportForm.monochrome" type="checkbox" />{{ t('monochrome') }}</label><label v-if="progressMode" class="checkbox-label"><input v-model="exportForm.progress" type="checkbox" />{{ t('includeProgress') }}</label></div><p v-if="exportForm.kind==='native' && dirty" class="notice">{{ t('draftNativeSavedOnly') }}</p><p class="notice">{{ t('exportScaleHelp') }}</p><template #footer><button class="button" :disabled="working" @click="dialog = ''">{{ t('cancel') }}</button><button class="button primary" :disabled="working" @click="exportPattern">{{ working ? t('saving') : t('export') }}</button></template></AppDialog>
    <AppDialog v-if="dialog==='recover'" :title="t('draftRecovery')" :busy="working" @close="openSaved"><p v-if="error" role="alert" class="notice error">{{ error }}</p><p>{{ t('draftRecoveryHelp',{name:recovery?.name || draftBase?.name || t('revision'),time:draftTime(recovery?.updatedAt)}) }}</p><p class="notice">{{ t('draftBaseLabel',{name:draftBase?.name || recovery?.baseRevisionId}) }}</p><p v-if="recovery?.baseRevisionId!==pattern.currentRevisionId" class="notice warning">{{ t('draftOldBase') }}</p><template #footer><button class="button" :disabled="working" @click="openSaved">{{ t('draftOpenSaved') }}</button><button class="button danger" :disabled="working" @click="discardRecovery">{{ t('draftDiscard') }}</button><button class="button primary" :disabled="working" @click="resumeDraft">{{ t('draftResume') }}</button></template></AppDialog>
    <AppDialog v-if="dialog==='discard'" :title="t('draftLeaveTitle')" :busy="working" @close="stay"><p v-if="error" role="alert" class="notice error">{{ error }}</p><p>{{ t('draftLeaveHelp') }}</p><template #footer><button class="button" :disabled="working" @click="stay">{{ t('draftStay') }}</button><button class="button danger" :disabled="working" @click="leaveEditor(true)">{{ t('discardChanges') }}</button><button class="button primary" :disabled="working" @click="leaveEditor(false)">{{ t('draftSaveLeave') }}</button></template></AppDialog>
    <AppDialog v-if="dialog==='workViewLeave'||dialog==='closeWorkView'" :title="t('workPositionFailed')" :busy="working" @close="stayAfterWorkFailure"><p class="notice error">{{t('workPositionFailureHelp')}}</p><p v-if="error" role="alert">{{error}}</p><template #footer><button class="button" :disabled="working" @click="stayAfterWorkFailure">{{t('draftStay')}}</button><button class="button danger" :disabled="working" @click="dialog==='closeWorkView'?flushForClose(true):leaveWork(true)">{{t('workLeaveWithoutPosition')}}</button><button class="button primary" :disabled="working" @click="dialog==='closeWorkView'?flushForClose(false):leaveWork(false)">{{t('retry')}}</button></template></AppDialog>
    <AppDialog v-if="dialog==='closeDraft'" :title="t('draftCloseFailed')" :busy="working" @close="stayAfterCloseFailure"><p v-if="error" role="alert" class="notice error">{{ error }}</p><p class="notice error">{{ t('draftSaveFailed') }}</p><template #footer><button class="button" :disabled="working" @click="stayAfterCloseFailure">{{ t('draftStay') }}</button><button class="button danger" :disabled="working" @click="flushForClose(true)">{{ t('draftDiscardClose') }}</button><button class="button primary" :disabled="working" @click="flushForClose(false)">{{ t('draftRetryClose') }}</button></template></AppDialog>
  </section>
</template>
