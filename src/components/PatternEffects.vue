<script setup>
import {computed,ref,shallowRef,watch,nextTick,onBeforeUnmount} from 'vue';
import {ChevronLeft,ChevronRight} from '@lucide/vue';
import AppDialog from './AppDialog.vue';
import FormField from './FormField.vue';
import RangeSlider from './RangeSlider.vue';
import MaterialProductPicker from './MaterialProductPicker.vue';
import {EFFECT_MODES,suggestPatternEffects} from '../../core/pattern-effect-suggestions.mjs';
import {colorFromProduct,isBead} from '../../core/pattern-materials.mjs';
import {drawPattern} from '../pattern-render.mjs';
import {t,errorText,number} from '../i18n';

const props=defineProps({revision:{type:Object,required:true},apply:{type:Function,required:true}});
const emit=defineEmits(['close']);
const mode=ref('beads'),chosen=shallowRef(null),picker=ref(true),threshold=ref(88),maximum=ref(100),gap=ref(.25),strands=ref(2);
const attachment=ref(-1),attachmentStrands=ref(1),error=ref(''),busy=ref(false),calculating=ref(false),canvas=ref(),active=ref(0),page=ref(0);
const empty=()=>({points:[],eligible:0,total:0,reason:'effectChooseProduct',spacing:null,limited:false});
const report=shallowRef(empty()),excluded=ref(new Set());let timer;
const key=point=>`${point.x},${point.y}`;
const selected=computed(()=>report.value.points.filter(point=>!excluded.value.has(key(point))));
const threads=computed(()=>props.revision.colors.map((color,index)=>({color,index})).filter(row=>!isBead(row.color)));
const attachmentColor=computed(()=>threads.value.find(row=>row.index===attachment.value)?.color);
const validStrands=computed(()=>{const value=mode.value==='beads'?attachmentStrands.value:strands.value;return mode.value==='beads'&&attachmentColor.value?.blend||Number.isInteger(value)&&value>=1&&value<=12;});
const visible=computed(()=>report.value.points.slice(page.value*20,page.value*20+20));
const scale=computed(()=>Math.min(24,760/props.revision.width,420/props.revision.height));
const focused=computed(()=>report.value.points[active.value]);
const canApply=computed(()=>chosen.value&&!picker.value&&!calculating.value&&!busy.value&&validStrands.value&&!report.value.reason&&selected.value.length&&(mode.value!=='beads'||attachmentColor.value));

function chooseProduct(product){try{chosen.value=colorFromProduct(product,{strands:strands.value});picker.value=false;excluded.value=new Set();error.value='';}catch(caught){error.value=errorText(caught);}}
watch(mode,value=>{chosen.value=null;picker.value=true;threshold.value=value==='wool'?12:88;excluded.value=new Set();attachment.value=-1;});
watch([()=>props.revision,mode,chosen,threshold,maximum,gap],()=>{
  clearTimeout(timer);calculating.value=true;
  timer=setTimeout(()=>{
    try{report.value=suggestPatternEffects(props.revision,{mode:mode.value,product:chosen.value?.product,threshold:threshold.value/100,maxCandidates:maximum.value,gapMm:gap.value});error.value='';}
    catch(caught){report.value=empty();error.value=errorText(caught);}
    calculating.value=false;page.value=0;active.value=0;
  },150);
},{immediate:true});
function toggle(point){const values=new Set(excluded.value);values.has(key(point))?values.delete(key(point)):values.add(key(point));excluded.value=values;}
function selectAll(){excluded.value=new Set();}
function selectNone(){excluded.value=new Set(report.value.points.map(key));}
function draw(){
  if(!canvas.value)return;
  drawPattern(canvas.value,props.revision,{cellSize:scale.value,width:props.revision.width*scale.value,height:props.revision.height*scale.value,grid:false,symbols:false});
  const context=canvas.value.getContext('2d'),styles=getComputedStyle(canvas.value),accent=styles.getPropertyValue('--accent').trim(),green=styles.getPropertyValue('--green').trim();
  report.value.points.forEach((point,index)=>{
    const included=!excluded.value.has(key(point)),x=(point.x+.5)*scale.value,y=(point.y+.5)*scale.value;
    const rx=Math.max(2,(report.value.spacing?report.value.spacing.diameterMm/report.value.spacing.pitchX/2:.4)*scale.value),ry=Math.max(2,(report.value.spacing?report.value.spacing.diameterMm/report.value.spacing.pitchY/2:.4)*scale.value);
    context.beginPath();context.ellipse(x,y,rx,ry,0,0,2*Math.PI);context.fillStyle=included?green+'80':'#ffffffb0';context.fill();context.lineWidth=index===active.value?3:1.5;context.strokeStyle=index===active.value?accent:included?green:'#716b70';context.stroke();
  });
}
watch([report,excluded,active,()=>props.revision],async()=>{await nextTick();draw();});
function clickPreview(event){
  const box=canvas.value.getBoundingClientRect(),x=(event.clientX-box.left)/box.width*canvas.value.width,y=(event.clientY-box.top)/box.height*canvas.value.height;
  let best=-1,distance=9;report.value.points.forEach((point,index)=>{const current=Math.hypot(x-(point.x+.5)*scale.value,y-(point.y+.5)*scale.value);if(current<distance){distance=current;best=index;}});
  if(best>=0){active.value=best;page.value=Math.floor(best/20);toggle(report.value.points[best]);}
}
function previewKey(event){
  if(!report.value.points.length)return;
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();const direction={ArrowLeft:-1,ArrowRight:1,ArrowUp:-20,ArrowDown:20}[event.key];active.value=Math.max(0,Math.min(report.value.points.length-1,active.value+direction));page.value=Math.floor(active.value/20);}
  if([' ','Enter'].includes(event.key)){event.preventDefault();toggle(focused.value);}
}
async function apply(){
  if(!canApply.value)return;busy.value=true;error.value='';
  try{
    const color=JSON.parse(JSON.stringify(chosen.value));
    if(isBead(color)){color.attachmentThread=JSON.parse(JSON.stringify(attachmentColor.value));if(!color.attachmentThread.blend)color.attachmentThread.strands=attachmentStrands.value;}
    else color.strands=strands.value;
    if(await props.apply(selected.value.map(point=>({...point})),color)!==false)emit('close');
  }catch(caught){error.value=errorText(caught);}finally{busy.value=false;}
}
onBeforeUnmount(()=>clearTimeout(timer));
</script>

<template>
 <AppDialog :title="t('patternEffects')" wide @close="!busy&&emit('close')">
  <p class="notice">{{t('effectHeuristicHelp')}}</p>
  <p v-if="error" role="alert" class="notice error">{{error}}</p>
  <FormField :label="t('effectMode')" v-slot="{id}"><select :id="id" v-model="mode" :disabled="busy"><option v-for="value in EFFECT_MODES" :key="value" :value="value">{{t(`effectMode_${value}`)}}</option></select></FormField>
  <p class="field-help">{{t(mode==='wool'?'effectSoftHelp':'effectHighlightHelp')}}</p>
  <MaterialProductPicker v-if="picker" :key="mode" :category="mode==='beads'?'embellishment':'thread'" @select="chooseProduct"/>
  <div v-else class="panel"><div class="panel-body"><p><span class="swatch" :style="{background:chosen?.hex}"/> {{chosen?.brand}} {{chosen?.range}} {{chosen?.code}} · {{chosen?.name}}</p><p v-if="chosen?.displayColorUnknown" class="field-help">{{t('materialColorUnavailable')}}</p><button class="button small" :disabled="busy" @click="picker=true">{{t('changeMaterial')}}</button></div></div>
  <template v-if="chosen&&!picker">
   <div class="form-grid">
    <FormField :label="t(mode==='wool'?'effectChroma':'effectBrightness')" v-slot="{id}"><RangeSlider :id="id" v-model="threshold" :min="mode==='wool'?0:70" :max="mode==='wool'?35:100" :step="1" unit="%" :disabled="busy"/></FormField>
    <FormField :label="t('effectMaximum')" v-slot="{id}"><RangeSlider :id="id" v-model="maximum" :min="1" :max="1000" :step="1" :disabled="busy"/></FormField>
    <FormField v-if="mode==='beads'" :label="t('effectGap')" v-slot="{id}"><RangeSlider :id="id" v-model="gap" :min="0" :max="5" :step=".05" unit=" mm" :disabled="busy"/></FormField>
    <FormField v-else :label="t('strands')" v-slot="{id}"><input :id="id" v-model.number="strands" type="number" min="1" max="12" :disabled="busy"/></FormField>
   </div>
   <div v-if="mode==='beads'" class="form-grid">
    <FormField :label="t('beadAttachmentThread')" v-slot="{id}"><select :id="id" v-model.number="attachment" :disabled="busy"><option :value="-1">{{t('effectChooseAttachment')}}</option><option v-for="row in threads" :key="row.index" :value="row.index">{{row.color.brand}} {{row.color.range}} {{row.color.code}} · {{row.color.name}}</option></select></FormField>
    <FormField v-if="attachmentColor" :label="t('strands')" v-slot="{id}"><input :id="id" v-model.number="attachmentStrands" type="number" min="1" max="12" :disabled="busy||Boolean(attachmentColor.blend)"/></FormField>
   </div>
   <p v-if="calculating" class="field-help" role="status">{{t('effectCalculating')}}</p>
   <p v-else-if="report.reason" class="notice warning">{{t(report.reason)}}</p>
   <template v-else>
    <p class="notice" role="status">{{t('effectCandidateCounts',{selected:selected.length,count:report.points.length,eligible:report.eligible})}}</p>
    <p v-if="report.spacing" class="field-help">{{t('effectSpacing',{diameter:number(report.spacing.diameterMm,2),gap:number(report.spacing.gapMm,2)})}}</p>
    <p v-if="report.limited" class="notice warning">{{t('effectSearchBound')}}</p>
    <p v-if="mode==='beads'&&!attachmentColor" class="field-help">{{t('effectAttachmentRequired')}}</p>
    <div class="actions"><button class="button small" :disabled="busy||!report.points.length" @click="selectAll">{{t('effectSelectAll')}}</button><button class="button small" :disabled="busy||!selected.length" @click="selectNone">{{t('effectSelectNone')}}</button></div>
    <p class="field-help">{{t('effectPreviewHelp')}}</p>
    <canvas ref="canvas" role="application" tabindex="0" :aria-label="t('effectPreview')" style="display:block;max-width:100%;height:auto;cursor:pointer" @click="!busy&&clickPreview($event)" @keydown="!busy&&previewKey($event)"/>
    <p v-if="focused" class="field-help" aria-live="polite">{{t('effectFocused',{x:focused.x+1,y:focused.y+1,state:t(excluded.has(key(focused))?'effectExcluded':'effectIncluded')})}}</p>
    <details v-if="report.points.length" class="form-section"><summary>{{t('effectCoordinates')}}</summary><div class="table-wrap"><table><thead><tr><th>{{t('effectInclude')}}</th><th>{{t('insertColumn')}}</th><th>{{t('insertRow')}}</th></tr></thead><tbody><tr v-for="point in visible" :key="key(point)"><td><input type="checkbox" :checked="!excluded.has(key(point))" :aria-label="t('effectCandidateAt',{x:point.x+1,y:point.y+1})" :disabled="busy" @change="toggle(point)"/></td><td>{{point.x+1}}</td><td>{{point.y+1}}</td></tr></tbody></table></div><div v-if="report.points.length>20" class="actions"><button class="button small" :disabled="page===0" :aria-label="t('previous')" @click="page--"><ChevronLeft :size="16"/></button><span>{{page*20+1}}–{{Math.min((page+1)*20,report.points.length)}} / {{report.points.length}}</span><button class="button small" :disabled="(page+1)*20>=report.points.length" :aria-label="t('next')" @click="page++"><ChevronRight :size="16"/></button></div></details>
   </template>
  </template>
  <template #footer><button class="button" :disabled="busy" @click="emit('close')">{{t('cancel')}}</button><button class="button primary" :disabled="!canApply" @click="apply">{{t('effectApply',{count:selected.length})}}</button></template>
 </AppDialog>
</template>
