<script setup>
import {computed,ref} from 'vue';
import {state,dispatch,notify} from '../state';
import {t,number,date} from '../i18n';
import {localDate} from '../../core/calendar.mjs';
import {projectForecast} from '../../core/project-insights.mjs';
import EntityForm from './EntityForm.vue';
const props=defineProps({project:Object}); const form=ref(null);
const forecast=computed(()=>projectForecast(state.value,props.project.id,{asOf:localDate()}));
function edit(){const operation=crypto.randomUUID();form.value={title:t('forecastAssumptions'),fields:[{key:'weeklyHours',label:t('weeklyAvailableHours'),type:'number'},{key:'extraMinutes',label:t('extraFinishingMinutes'),type:'number',required:true}],initial:{weeklyHours:forecast.value.weeklyHours??'',extraMinutes:forecast.value.extraMinutes},submit:draft=>dispatch('project.forecastSettings',{...draft,projectId:props.project.id},operation)};}
</script>
<template><section class="panel"><div class="panel-heading"><h2>{{t('timeForecast')}}</h2><button class="button small" @click="edit">{{t('forecastAssumptions')}}</button></div><div class="panel-body">
 <p v-if="forecast.reason" class="notice">{{t(forecast.reason)}}</p>
 <template v-else><div class="stat-row"><span>{{t('estimatedStitchingMinutes')}}</span><strong>{{number(forecast.stitchingMinutes)}} {{t('minutes')}}</strong></div><div class="stat-row"><span>{{t('estimatedTotalMinutes')}}</span><strong>{{number(forecast.totalMinutes)}} {{t('minutes')}}</strong></div><div class="stat-row"><span>{{t('estimatedFinishDate')}}</span><strong>{{forecast.estimatedDate?date(forecast.estimatedDate):t('unknown')}}</strong></div><p class="field-help">{{t('forecastScheduleHelp')}}</p></template>
 <div class="stat-row"><span>{{t('extraFinishingMinutes')}}</span><strong>{{number(forecast.extraMinutes)}} {{t('minutes')}}</strong></div><div class="stat-row"><span>{{t('weeklyAvailableHours')}}</span><strong>{{forecast.weeklyHours===null?t('none'):number(forecast.weeklyHours)}}</strong></div>
 <p class="field-help">{{t('forecastEvidence',{sessions:number(forecast.sampleSessions,0),minutes:number(forecast.sampleMinutes),ignored:number(forecast.ignoredSessions,0)})}}</p>
 <div v-if="forecast.byKind.some(row=>row.remaining)" class="table-wrap"><table><thead><tr><th>{{t('stitchKind')}}</th><th>{{t('remaining')}}</th><th>{{t('sampleStitches')}}</th><th>{{t('minutes')}}</th></tr></thead><tbody><tr v-for="row in forecast.byKind.filter(row=>row.remaining||row.sessions)" :key="row.kind"><td>{{t(`workKind_${row.kind}`)}}</td><td>{{number(row.remaining,0)}}</td><td>{{number(row.count,0)}}</td><td>{{row.minutes===null?t('unknown'):number(row.minutes)}}</td></tr></tbody></table></div>
 <p v-if="forecast.scheduleTooFar" class="notice warning">{{t('forecastTooFar')}}</p>
 </div></section><EntityForm v-if="form" :title="form.title" :fields="form.fields" :initial="form.initial" :submit="form.submit" @close="form=null" @saved="form=null;notify()"/></template>
