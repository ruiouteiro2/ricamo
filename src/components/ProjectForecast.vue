<script setup>
import {computed,ref} from 'vue';
import {state,notify} from '../state';
import {t,number,date} from '../i18n';
import {localDate} from '../../core/calendar.mjs';
import {projectForecast} from '../../core/project-insights.mjs';
import ForecastSettings from './ForecastSettings.vue';
const props=defineProps({project:Object}); const form=ref(null);
const forecast=computed(()=>projectForecast(state.value,props.project.id,{asOf:localDate()}));
function edit(){form.value=true;}
</script>
<template><section class="panel"><div class="panel-heading"><h2>{{t('timeForecast')}}</h2><button class="button small" @click="edit">{{t('forecastAssumptions')}}</button></div><div class="panel-body">
 <p class="badge">{{t(forecast.method==='manual'?'forecastManual':'forecastMeasured')}}</p><p v-if="forecast.method==='manual'" class="field-help">{{t('forecastManualHelp')}}</p>
 <p v-if="forecast.reason" class="notice">{{t(forecast.reason)}}</p>
 <template v-else><div class="stat-row"><span>{{t('estimatedStitchingMinutes')}}</span><strong>{{number(forecast.stitchingMinutes)}} {{t('minutes')}}</strong></div><div class="stat-row"><span>{{t('estimatedTotalMinutes')}}</span><strong>{{number(forecast.totalMinutes)}} {{t('minutes')}}</strong></div><div class="stat-row"><span>{{t('estimatedFinishDate')}}</span><strong>{{forecast.estimatedDate?date(forecast.estimatedDate):t('unknown')}}</strong></div><p class="field-help">{{t('forecastScheduleHelp')}}</p></template>
 <div class="stat-row"><span>{{t('extraFinishingMinutes')}}</span><strong>{{number(forecast.extraMinutes)}} {{t('minutes')}}</strong></div><div class="stat-row"><span>{{t('weeklyAvailableHours')}}</span><strong>{{forecast.weeklyHours===null?t('unknown'):number(forecast.weeklyHours)}}</strong></div>
 <p v-if="forecast.method==='measured'" class="field-help">{{t('forecastEvidence',{sessions:number(forecast.sampleSessions,0),minutes:number(forecast.sampleMinutes),ignored:number(forecast.ignoredSessions,0)})}}</p>
 <div v-if="forecast.byKind.length" class="table-wrap"><table><thead><tr><th>{{t('forecastPrimitiveKind')}}</th><th>{{t('remaining')}}</th><th>{{t(forecast.method==='manual'?'forecastSecondsPerPrimitive':'sampleStitches')}}</th><th>{{t('minutes')}}</th></tr></thead><tbody><tr v-for="row in forecast.byKind" :key="row.kind"><td>{{t(`workKind_${row.kind}`)}}</td><td>{{number(row.remaining,0)}}</td><td>{{forecast.method==='manual'?number(row.secondsPerPrimitive):number(row.count,0)}}</td><td>{{row.minutes===null?t('unknown'):number(row.minutes)}}</td></tr></tbody></table></div>
 <p v-if="forecast.scheduleTooFar" class="notice warning">{{t('forecastTooFar')}}</p>
 </div></section><ForecastSettings v-if="form" :project="project" :structured="forecast.countSource==='grid'" @close="form=null" @saved="form=null;notify()"/></template>
