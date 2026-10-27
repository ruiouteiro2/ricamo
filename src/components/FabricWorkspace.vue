<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { Scissors, Ruler, RotateCcw, LockKeyhole, Pencil, ArrowLeft } from '@lucide/vue';
import { state, dispatch, notify } from '../state';
import { t, number, date, money, errorText } from '../i18n';
import { activeFabricRegions, previewFabricCut, fabricProjectFit, fabricCutDependencies, toCentimetres } from '../../core/fabric-planning.mjs';
import {fabricSize} from '../../core/fabric.mjs';
import {projectFabricConfig} from '../../core/design-size.mjs';
import DesignSizeSummary from './DesignSizeSummary.vue';
import AppDialog from './AppDialog.vue';
import FormField from './FormField.vue';
const props = defineProps({ lotId: { type: String, required: true }, projectId: String });
const emit = defineEmits(['close']);
const focusedId = ref(props.lotId), tab = ref('plan'), stage = ref(''), busy = ref(false), error = ref(null), selectedRegionId = ref(''), targetRegion = ref(null), targetCut = ref(null), reason = ref('');
const lot = computed(() => state.value.lots.find(row => row.id === focusedId.value));
const material = computed(() => state.value.materials.find(row => row.id === lot.value?.materialId));
const available = computed(() => lot.value?.quantity === 1 && lot.value?.status === 'usable' && !material.value?.archived);
const regions = computed(() => lot.value ? activeFabricRegions(lot.value) : []);
const projects = computed(() => state.value.projects.filter(row => !['completed', 'archived'].includes(row.status)));
const cuts = computed(() => state.value.cuts.filter(row => row.sourceLotId === focusedId.value));
const lotName = row => row?.lotCode || row?.id.slice(0, 8) || '';
const projectName = id => state.value.projects.find(row => row.id === id)?.name || '—';
const translateError = caught => { const code = caught?.code || caught?.message || ''; return t(code) !== code ? t(code) : errorText(caught); };
const displayError = computed(() => error.value ? translateError(error.value) : '');
const draft = reactive({ unit: 'cm', x: '0', y: '0', width: '', height: '', rotated: false, projectId: props.projectId || '', manualConfirmed: false, notes: '', discardRemnants: [] });
const metadata = reactive({});
const sides = ['left', 'right', 'top', 'bottom'];
const units = ['cm', 'mm', 'm', 'in'];
const selectedProject = computed(() => state.value.projects.find(p => p.id === draft.projectId));
const design = computed(() => {
  const project = selectedProject.value, pattern = state.value.patterns.find(p => p.id === project?.patternId);
  return pattern?.kind === 'structured' ? pattern.revisions.find(r => r.id === project.revisionId) : null;
});
const fit = computed(() => lot.value && design.value ? fabricProjectFit(lot.value, design.value, selectedProject.value.settings.fabric) : null);
const fullGridSize=computed(()=>{if(!design.value||!lot.value)return null;try{return fabricSize({...projectFabricConfig(selectedProject.value,lot.value),width:design.value.width,height:design.value.height})}catch{return null}});
const simulation = computed(() => {
  if (!lot.value || !draft.width || !draft.height) return null;
  try { return { ...previewFabricCut(lot.value, { ...draft, discardRemnants: [] }), error: null }; }
  catch (caught) { return { error: caught }; }
});
const preview = computed(() => {
  if (!simulation.value || simulation.value.error) return null;
  return previewFabricCut(lot.value, { ...draft, discardRemnants: draft.discardRemnants.filter(key => simulation.value.rectangles.some(row => row.key === key)) });
});
const manual = computed(() => lot.value?.properties.irregular || lot.value?.properties.defects || lot.value?.properties.unusableBorder);
const canCut = computed(() => available.value && preview.value && !lot.value.properties.irregular && (!manual.value || draft.manualConfirmed));
const dependencies = computed(() => targetCut.value ? fabricCutDependencies(state.value, targetCut.value.id) : []);
const stageTitle = computed(() => stage.value === 'cut' ? t('confirmPhysicalCut') : stage.value === 'undo' ? t('fabricUndoCut') : stage.value === 'release' ? t('fabricReleaseRegion') : t('fabricWorkspace'));
let operationId = crypto.randomUUID(), commandSignature = '';
function newOperation() { operationId = crypto.randomUUID(); commandSignature = ''; }
function resetPlan() {
  selectedRegionId.value = ''; Object.assign(draft, { unit: 'cm', x: '0', y: '0', width: '', height: '', rotated: false, projectId: props.projectId || '', manualConfirmed: false, notes: '', discardRemnants: [] });
  error.value = null; stage.value = ''; newOperation();
}
watch(() => props.lotId, id => { focusedId.value = id; resetPlan(); });
watch(focusedId, () => { resetPlan(); tab.value = available.value ? 'plan' : 'history'; });
function changeUnit(event) {
  const next = event.target.value;
  for (const key of ['x', 'y', 'width', 'height']) if (draft[key] !== '') {
    try { draft[key] = String(Math.round(toCentimetres(draft[key], draft.unit) / toCentimetres(1, next) * 1e6) / 1e6); } catch { /* Invalid draft text remains visible for correction. */ }
  }
  draft.unit = next;
}
function changeMetadataUnit(event) {
  const next = event.target.value, convert = value => { try { return String(Math.round(toCentimetres(value, metadata.unit) / toCentimetres(1, next) * 1e6) / 1e6); } catch { return value; } };
  metadata.width = convert(metadata.width); metadata.height = convert(metadata.height);
  for (const side of sides) metadata.usableMargins[side] = convert(metadata.usableMargins[side]);
  metadata.unit = next;
}
function useDesign() {
  if (!fit.value?.cutWidthCm) return;
  selectedRegionId.value = ''; Object.assign(draft, { unit: 'cm', x: String(fit.value.usable.xCm), y: String(fit.value.usable.yCm), width: String(Math.ceil(fit.value.cutWidthCm * 1e6) / 1e6), height: String(Math.ceil(fit.value.cutHeightCm * 1e6) / 1e6), rotated: false, discardRemnants: [] }); newOperation();
}
function loadRegion(region) {
  selectedRegionId.value = region.id; Object.assign(draft, { unit: 'cm', x: String(region.xCm), y: String(region.yCm), width: String(region.widthCm), height: String(region.heightCm), rotated: false, projectId: region.projectId, manualConfirmed: region.manualConfirmed, notes: region.notes, discardRemnants: [] }); tab.value = 'plan'; error.value = null; newOperation();
}
async function run(type, payload, onSuccess = () => {}) {
  if (busy.value) return;
  const signature = JSON.stringify({ type, payload });
  if (signature !== commandSignature) { newOperation(); commandSignature = signature; }
  busy.value = true; error.value = null;
  try { await dispatch(type, payload, operationId); newOperation(); onSuccess(); notify(); }
  catch (caught) { error.value = caught; }
  finally { busy.value = false; }
}
function reserveRegion() {
  return run('fabric.region.reserve', { ...draft, lotId: focusedId.value, ...(selectedRegionId.value ? { id: selectedRegionId.value } : {}) }, () => { const rect = preview.value.requested; selectedRegionId.value = regions.value.find(r => r.projectId === draft.projectId && ['xCm','yCm','widthCm','heightCm'].every(key => r[key] === rect[key]))?.id || ''; });
}
function beginCut() { error.value = null; stage.value = 'cut'; newOperation(); }
function confirmCut() {
  const payload = { ...draft, lotId: focusedId.value, reason: draft.notes, discardRemnants: draft.discardRemnants.filter(key => preview.value.rectangles.some(row => row.key === key)), ...(selectedRegionId.value ? { regionId: selectedRegionId.value } : {}) };
  return run('fabric.plan.cut', payload, () => { stage.value = ''; tab.value = 'history'; selectedRegionId.value = ''; });
}
function beginRelease(region) { targetRegion.value = region; stage.value = 'release'; error.value = null; newOperation(); }
function confirmRelease() { return run('fabric.region.release', { lotId: focusedId.value, id: targetRegion.value.id, projectId: targetRegion.value.projectId, reason: 'manual' }, () => { stage.value = ''; if (selectedRegionId.value === targetRegion.value.id) selectedRegionId.value = ''; }); }
function beginUndo(cut) { targetCut.value = cut; stage.value = 'undo'; reason.value = ''; error.value = null; newOperation(); }
function confirmUndo() { return run('fabric.cut.reverse', { cutId: targetCut.value.id, reason: reason.value }, () => { stage.value = ''; tab.value = 'history'; }); }
function editMetadata() {
  const p = lot.value.properties;
  Object.assign(metadata, { width: p.widthCm ?? '', height: p.heightCm ?? '', unit: 'cm', countX: p.countX ?? '', countY: p.countY ?? '', countMeaning: p.countMeaning || 'stitches', irregular: p.irregular === true, defects: p.defects || '', geometryNotes: p.geometryNotes || '', washState: p.washState || 'unknown', usableMargins: Object.fromEntries(sides.map(side => [side, p.usableMargins?.[side] ?? 0])) });
  error.value = null; tab.value = 'details'; newOperation();
}
function saveMetadata() { return run('fabric.plan.save', { ...metadata, lotId: focusedId.value }, () => { tab.value = 'plan'; }); }
function cutReservation(cut) { return state.value.reservations.find(r => cut.pieceIds.includes(r.lotId) && r.projectId === cut.planning?.projectId && r.quantity > 0); }
function releaseCutReservation(cut) { const reservation = cutReservation(cut); if (!reservation) return; newOperation(); return run('reservation.set', { projectId: reservation.projectId, lotId: reservation.lotId, quantity: 0 }); }
</script>

<template>
  <AppDialog v-if="lot" :title="stageTitle" wide :busy="busy" @close="emit('close')">
    <div class="split-heading"><div><strong>{{ material.name }} · {{ lotName(lot) }}</strong><p class="field-help">{{ number(lot.properties.widthCm) }} × {{ number(lot.properties.heightCm) }} cm · {{ t(lot.status) }}</p></div><button v-if="lot.sourceLotId && !stage" class="button text small" @click="focusedId=lot.sourceLotId"><ArrowLeft :size="14" />{{ t('fabricSourcePiece') }}</button></div>
    <p v-if="displayError" class="notice error" role="alert">{{ displayError }}</p>
    <template v-if="stage==='cut'">
      <p class="notice warning">{{ t('fabricConfirmHelp') }}</p>
      <div class="stat-row"><span>{{ t('fabricCutSize') }}</span><strong>{{ number(preview.requested.widthCm) }} × {{ number(preview.requested.heightCm) }} cm</strong></div>
      <div class="stat-row"><span>{{ t('project') }}</span><strong>{{ projectName(draft.projectId) }}</strong></div>
      <div class="stat-row"><span>{{ t('fabricWasteArea') }}</span><strong>{{ number(preview.wasteCm2) }} cm²</strong></div>
      <p v-if="regions.length > (selectedRegionId?1:0)" class="notice warning">{{ t('fabric_other_regions') }}</p>
    </template>
    <template v-else-if="stage==='release'">
      <p>{{ t('fabricReleaseHelp', { project: projectName(targetRegion.projectId) }) }}</p><p class="field-help">{{ number(targetRegion.widthCm) }} × {{ number(targetRegion.heightCm) }} cm · {{ t('fabricStockUnchanged') }}</p>
    </template>
    <template v-else-if="stage==='undo'">
      <p class="notice warning">{{ t('fabricUndoHelp') }}</p>
      <ul v-if="dependencies.length" class="field-help"><li v-for="(block,index) in dependencies" :key="index">{{ t(block.code) }}<template v-if="block.lotId"> · {{ lotName(state.lots.find(row=>row.id===block.lotId)) }}</template></li></ul>
      <FormField :label="t('reason')" required v-slot="{id}"><textarea :id="id" v-model="reason" maxlength="2000" /></FormField>
    </template>
    <template v-else>
      <nav class="tabs" :aria-label="t('fabricWorkspace')"><button :class="{selected:tab==='plan'}" @click="tab='plan'">{{ t('fabricPlan') }}</button><button :class="{selected:tab==='details'}" :disabled="!available || regions.length>0" @click="editMetadata">{{ t('fabricPieceDetails') }}</button><button :class="{selected:tab==='history'}" @click="tab='history'">{{ t('fabricCutHistory') }} · {{ cuts.length }}</button></nav>
      <template v-if="tab==='plan'">
        <p class="notice">{{ t('fabricPlanHelp') }}</p>
        <p v-if="manual" class="notice warning">{{ t('fabricManualHelp') }}</p>
        <p v-if="!available" class="notice warning">{{ t('fabric_piece_unavailable') }}</p>
        <div v-if="available" class="form-grid">
          <FormField :label="t('project')" wide v-slot="{id}"><select :id="id" v-model="draft.projectId" :disabled="!!selectedRegionId"><option value="">{{ t('none') }}</option><option v-for="project in projects" :key="project.id" :value="project.id">{{ project.name }}</option></select></FormField>
          <div v-if="design" class="wide"><DesignSizeSummary :revision="design" :grid="fullGridSize"/></div><template v-if="fit"><div class="wide"><p class="notice" :class="fit.fits===true?'success':'warning'">{{ t(fit.fits===true?'fabricFits':fit.fits===false?'fabricDoesNotFit':'fabricUnknown') }}<template v-if="fit.cutWidthCm"> · {{ number(fit.cutWidthCm) }} × {{ number(fit.cutHeightCm) }} cm <span v-if="fit.rotated">({{ t('fabricRotated') }})</span></template></p><p class="field-help">{{ t('fabricCountHelp') }}</p><button v-if="fit.cutWidthCm" class="button small" @click="useDesign"><Ruler :size="14" />{{ t('fabricUseDesign') }}</button></div></template>
          <FormField :label="t('fabricInputUnit')" v-slot="{id}"><select :id="id" :value="draft.unit" @change="changeUnit"><option v-for="unit in units" :key="unit" :value="unit">{{ unit==='in'?t('fabricInches'):unit }}</option></select></FormField>
          <FormField :label="t('fabricWidth')" required v-slot="{id}"><input :id="id" v-model="draft.width" inputmode="decimal" /></FormField>
          <FormField :label="t('fabricHeight')" required v-slot="{id}"><input :id="id" v-model="draft.height" inputmode="decimal" /></FormField>
          <FormField :label="`${t('fabricOffsetX')} (${draft.unit})`" required v-slot="{id}"><input :id="id" v-model="draft.x" inputmode="decimal" /></FormField>
          <FormField :label="`${t('fabricOffsetY')} (${draft.unit})`" required v-slot="{id}"><input :id="id" v-model="draft.y" inputmode="decimal" /></FormField>
          <label class="checkbox-label"><input v-model="draft.rotated" type="checkbox" />{{ t('fabricRotateCut') }}</label>
          <FormField :label="t('notes')" wide v-slot="{id}"><textarea :id="id" v-model="draft.notes" maxlength="2000" /></FormField>
          <label v-if="manual" class="checkbox-label wide"><input v-model="draft.manualConfirmed" type="checkbox" />{{ t('fabricManualConfirm') }}</label>
        </div>
        <p v-if="simulation?.error" class="notice warning" role="status">{{ translateError(simulation.error) }}</p>
        <div v-if="preview" class="form-section">
          <svg class="fabric-map" role="img" :aria-label="t('fabricDiagramHelp')" :viewBox="`0 0 ${preview.widthCm} ${preview.heightCm}`"><rect class="fabric-whole" x="0" y="0" :width="preview.widthCm" :height="preview.heightCm" /><rect class="fabric-usable" :x="preview.usable.xCm" :y="preview.usable.yCm" :width="preview.usable.widthCm" :height="preview.usable.heightCm" /><rect v-for="region in regions" :key="region.id" class="fabric-region" :x="region.xCm" :y="region.yCm" :width="region.widthCm" :height="region.heightCm" /><rect class="fabric-request" :x="preview.requested.xCm" :y="preview.requested.yCm" :width="preview.requested.widthCm" :height="preview.requested.heightCm" /></svg>
          <p class="field-help">{{ t('fabricDiagramHelp') }}</p><div class="stat-row"><span>{{ t(manual?'fabricBoundingArea':'fabricTotalArea') }}</span><strong>{{ number(preview.totalAreaCm2) }} cm²</strong></div>
          <h3>{{ t('fabricRemnants') }}</h3><p class="field-help">{{ t('fabricWasteHelp') }}</p>
          <label v-for="rect in preview.rectangles.filter(row=>row.role==='remnant')" :key="rect.key" class="checkbox-label fabric-remnant"><input v-model="draft.discardRemnants" type="checkbox" :value="rect.key" />{{ t('fabricDiscardSide', { side: t(`fabricSide_${rect.key}`) }) }} · {{ number(rect.widthCm) }} × {{ number(rect.heightCm) }} cm</label>
          <div class="stat-row"><span>{{ t('fabricWasteArea') }}</span><strong>{{ number(preview.wasteCm2) }} cm²</strong></div>
        </div>
        <div v-if="available" class="actions fabric-actions"><button class="button" :disabled="busy || !preview || !draft.projectId || (manual && !draft.manualConfirmed)" @click="reserveRegion"><LockKeyhole :size="15" />{{ t(selectedRegionId?'fabricUpdateRegion':'fabricReserveRegion') }}</button><button class="button primary" :disabled="busy || !canCut" @click="beginCut"><Scissors :size="15" />{{ t('confirmPhysicalCut') }}</button><button v-if="selectedRegionId" class="button text" @click="resetPlan">{{ t('fabricNewPlan') }}</button></div>
        <section class="form-section"><h3>{{ t('fabricReservedRegions') }} · {{ regions.length }}</h3><p v-if="!regions.length" class="field-help">{{ t('empty') }}</p><div v-for="region in regions" :key="region.id" class="stat-row"><span><strong>{{ projectName(region.projectId) }}</strong><small class="cell-subtitle">{{ number(region.widthCm) }} × {{ number(region.heightCm) }} cm · X {{ number(region.xCm) }}, Y {{ number(region.yCm) }}</small></span><div class="actions"><button class="button small" :disabled="busy" @click="loadRegion(region)"><Pencil :size="14" />{{ t('fabricLoadRegion') }}</button><button class="button text small" :disabled="busy" @click="beginRelease(region)">{{ t('release') }}</button></div></div></section>
      </template>
      <template v-else-if="tab==='details'">
        <p class="notice">{{ t('fabricDetailsHelp') }}</p><div class="form-grid">
          <FormField :label="t('fabricInputUnit')" v-slot="{id}"><select :id="id" :value="metadata.unit" @change="changeMetadataUnit"><option v-for="unit in units" :key="unit" :value="unit">{{ unit==='in'?t('fabricInches'):unit }}</option></select></FormField>
          <FormField :label="t('fabricWidth')" required v-slot="{id}"><input :id="id" v-model="metadata.width" inputmode="decimal" /></FormField><FormField :label="t('fabricHeight')" required v-slot="{id}"><input :id="id" v-model="metadata.height" inputmode="decimal" /></FormField>
          <FormField v-for="key in ['countX','countY']" :key="key" :label="t(key)" v-slot="{id}"><input :id="id" v-model="metadata[key]" inputmode="decimal" /></FormField>
          <FormField :label="t('countMeaning')" v-slot="{id}"><select :id="id" v-model="metadata.countMeaning"><option value="stitches">{{ t('stitchesPerInch') }}</option><option value="threads">{{ t('threadsPerInch') }}</option></select></FormField>
          <FormField v-for="side in sides" :key="side" :label="t('fabricUnusableEdge',{side:t(`fabricSide_${side}`)})" v-slot="{id}"><input :id="id" v-model="metadata.usableMargins[side]" inputmode="decimal" /></FormField>
          <FormField :label="t('fabricWashState')" v-slot="{id}"><select :id="id" v-model="metadata.washState"><option v-for="value in ['unknown','unwashed','prewashed']" :key="value" :value="value">{{ t(`fabricWash_${value}`) }}</option></select></FormField>
          <label class="checkbox-label"><input v-model="metadata.irregular" type="checkbox" />{{ t('irregularFabric') }}</label>
          <FormField :label="t('fabricDefects')" wide v-slot="{id}"><textarea :id="id" v-model="metadata.defects" maxlength="4000" /></FormField><FormField :label="t('fabricGeometryNotes')" wide v-slot="{id}"><textarea :id="id" v-model="metadata.geometryNotes" maxlength="4000" /></FormField>
        </div><div class="actions fabric-actions"><button class="button primary" :disabled="busy" @click="saveMetadata">{{ t('save') }}</button><button class="button" :disabled="busy" @click="tab='plan'">{{ t('cancel') }}</button></div>
      </template>
      <template v-else>
        <p class="notice">{{ t('fabricHistoryHelp') }}</p><p v-if="!cuts.length" class="field-help">{{ t('empty') }}</p>
        <section v-for="cut in cuts" :key="cut.id" class="form-section"><div class="split-heading"><h3>{{ date(cut.date) }} · {{ t(cut.reversed?'fabricCutReversed':'cutFabric') }}</h3><button v-if="cut.planning && !cut.reversed" class="button small" :disabled="busy" @click="beginUndo(cut)"><RotateCcw :size="14" />{{ t('fabricUndoCut') }}</button></div>
          <div class="stat-row"><span>{{ t('fabricWasteArea') }}</span><strong>{{ number(cut.wasteCm2) }} cm²<template v-if="cut.planning?.wasteCost != null"> · {{ money(cut.planning.wasteCost,lot.currency) }}</template></strong></div>
          <div v-for="id in cut.pieceIds" :key="id" class="stat-row"><button class="button text small" @click="focusedId=id">{{ lotName(state.lots.find(row=>row.id===id)) }}</button><span>{{ number(state.lots.find(row=>row.id===id)?.properties.widthCm) }} × {{ number(state.lots.find(row=>row.id===id)?.properties.heightCm) }} cm · {{ t(state.lots.find(row=>row.id===id)?.status) }}</span></div>
          <button v-if="cutReservation(cut)" class="button" :disabled="busy" @click="releaseCutReservation(cut)">{{ t('fabricReleaseCutReservation', { project: projectName(cut.planning.projectId) }) }}</button>
        </section>
      </template>
    </template>
    <template #footer><button class="button" :disabled="busy" @click="stage ? (stage='',error=null) : emit('close')">{{ t(stage?'cancel':'close') }}</button><button v-if="stage==='cut'" class="button primary" :disabled="busy || !canCut" @click="confirmCut">{{ t('confirmPhysicalCut') }}</button><button v-if="stage==='release'" class="button primary" :disabled="busy" @click="confirmRelease">{{ t('fabricReleaseRegion') }}</button><button v-if="stage==='undo'" class="button primary" :disabled="busy || dependencies.length>0 || !reason.trim()" @click="confirmUndo">{{ t('fabricUndoCut') }}</button></template>
  </AppDialog>
</template>

<style scoped>
.fabric-map{display:block;width:100%;height:240px;margin:16px 0;border:1px solid var(--line);background:var(--paper)}
.fabric-map rect{stroke-width:.6;vector-effect:non-scaling-stroke}.fabric-whole{fill:var(--line);stroke:var(--muted)}.fabric-usable{fill:var(--surface);stroke:var(--muted);stroke-dasharray:4 3}.fabric-region{fill:var(--accent-soft);stroke:var(--accent)}.fabric-request{fill:transparent;stroke:var(--accent);stroke-width:3;stroke-dasharray:7 3}.fabric-remnant{margin:12px 0}.fabric-actions{margin-top:20px;flex-wrap:wrap}.wide{grid-column:1/-1}
</style>
