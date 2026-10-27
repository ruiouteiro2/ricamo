<script setup>
import {computed,reactive,ref} from 'vue';
import AppDialog from './AppDialog.vue';
import FormField from './FormField.vue';
import {state,dispatch,notify} from '../state';
import {t,number,errorText} from '../i18n';
import {threadEstimateConfiguration} from '../../core/estimates.mjs';
import {previewProjectThreadNeeds,threadCalibrationCandidate} from '../../core/thread-estimate-workflow.mjs';
import {confirmedConsumption} from '../../core/projects.mjs';
const props=defineProps({project:{type:Object,required:true}}),emit=defineEmits(['close']);
const form=reactive(threadEstimateConfiguration(props.project.settings.thread??{})),busy=ref(false),error=ref(''),saveDefaults=ref(false),calibrationMaterial=ref(''),confirmedComplete=ref(false),calibrationApplied=ref(false);
const fields=[['crossTravel',0,10,.1],['halfTravel',0,10,.1],['outlineReturn',1,10,.1],['batchSize',1,10000,1],['startFinishCm',0,200,1],['waste',0,100,1],['strands',1,12,1],['backStrands',1,12,1],['calibrationFactor',.1,10,.01]];
const preview=computed(()=>{try{return{value:previewProjectThreadNeeds(state.value,props.project,form)}}catch(error){return{error}}});
const candidates=computed(()=>preview.value.value?.rows.filter(row=>row.material && confirmedConsumption(state.value,props.project.id,row.material.id)>0)??[]);
const calibration=computed(()=>{if(!calibrationMaterial.value)return{};try{return{value:threadCalibrationCandidate(state.value,props.project,calibrationMaterial.value,form)}}catch(error){return{error}}});
function changed(){calibrationApplied.value=false;}
function friendly(caught){const map={fabric_count_unknown:'threadFabricUnknown',thread_material_ambiguous:'threadAmbiguous',calibration_consumption_unknown:'threadCalibrationUnknown',calibration_revision_changed:'threadCalibrationRevision',calibration_factor_range:'threadCalibrationRange',thread_estimate_configuration:'threadSettingsInvalid',invalid_integer:'threadSettingsInvalid'};return map[caught?.code]?t(map[caught.code]):errorText(caught);}
function applyCalibration(){if(calibration.value.value && confirmedComplete.value){form.calibrationFactor=calibration.value.value.factor;calibrationApplied.value=true;}}
async function save(){busy.value=true;error.value='';try{await dispatch('project.estimate',{projectId:props.project.id,configuration:threadEstimateConfiguration(form),saveDefaults:saveDefaults.value,...(calibrationApplied.value?{calibration:{materialId:calibrationMaterial.value,confirmedComplete:confirmedComplete.value}}:{})});notify();emit('close');}catch(caught){error.value=friendly(caught);}finally{busy.value=false;}}
</script>
<template>
 <AppDialog :title="t('threadEstimateSettings')" wide :busy="busy" @close="emit('close')">
  <p class="notice">{{t('threadEstimateHelp')}}</p><p v-if="error" class="notice error" role="alert">{{error}}</p>
  <div class="form-grid"><FormField v-for="[key,min,max,step] in fields" :key="key" :label="t(`threadSetting_${key}`)" :help="t(`threadSettingHelp_${key}`)" v-slot="{id,describedby}"><input :id="id" v-model.number="form[key]" :aria-describedby="describedby" type="number" :min="min" :max="max" :step="step" @input="changed" /></FormField></div>
  <p v-if="preview.error" class="notice warning" role="status">{{friendly(preview.error)}}</p>
  <template v-else-if="preview.value"><h3>{{t('threadPreview')}}</h3><p class="field-help">{{t('threadFabricUsed',{x:preview.value.fabric.countX,y:preview.value.fabric.countY})}}</p>
   <div class="table-wrap"><table><thead><tr><th>{{t('materials')}}</th><th>{{t('threadFilamentMetres')}}</th><th>{{t('planned')}}</th></tr></thead><tbody><tr v-for="row in preview.value.rows" :key="row.key"><td>{{row.color.brand}} {{row.color.range}} {{row.color.code}}<small class="cell-subtitle">{{row.color.name}}</small></td><td>{{number(row.filamentMetres,4)}} {{t('strand-m')}}</td><td>{{(row.manual?row.manualQuantity:row.quantity)===null?t('unknown'):number(row.manual?row.manualQuantity:row.quantity,4)}} {{t(row.unit)}}<small v-if="row.manual" class="cell-subtitle">{{t('threadManualPreserved')}}</small><small v-if="row.quantity===null" class="cell-subtitle">{{t('threadConversionUnknown')}}</small></td></tr></tbody></table></div><p v-if="!preview.value.rows.length" class="notice">{{t('threadNoStitches')}}</p>
  </template>
  <details class="form-section"><summary>{{t('threadCalibrate')}}</summary><p class="notice">{{t('threadCalibrationHelp')}}</p><p v-if="!candidates.length" class="field-help">{{t('threadCalibrationNoConsumption')}}</p><template v-else><FormField :label="t('materials')" v-slot="{id}"><select :id="id" v-model="calibrationMaterial" @change="changed"><option value="">{{t('threadChoose')}}</option><option v-for="row in candidates" :key="row.material.id" :value="row.material.id">{{row.material.name}} · {{row.material.code}}</option></select></FormField><p v-if="calibration.error" class="notice warning">{{friendly(calibration.error)}}</p><template v-if="calibration.value"><p>{{t('threadCalibrationValues',{actual:number(calibration.value.actualQuantity,4),unit:t(calibration.value.actualUnit),filaments:number(calibration.value.actualFilamentMetres,4),factor:number(calibration.value.factor,4)})}}</p><label class="checkbox-label"><input v-model="confirmedComplete" type="checkbox" @change="changed" />{{t('threadCalibrationConfirm')}}</label><button class="button" :disabled="!confirmedComplete" @click="applyCalibration">{{t('threadCalibrationApply')}}</button><p v-if="calibrationApplied" class="notice">{{t('threadCalibrationPending')}}</p></template></template></details>
  <label class="checkbox-label" style="margin-top:18px"><input v-model="saveDefaults" type="checkbox" />{{t('threadSaveDefaults')}}</label>
  <template #footer><button class="button" :disabled="busy" @click="emit('close')">{{t('cancel')}}</button><button class="button primary" :disabled="busy || Boolean(preview.error)" @click="save">{{t('threadApplyEstimates')}}</button></template>
 </AppDialog>
</template>
