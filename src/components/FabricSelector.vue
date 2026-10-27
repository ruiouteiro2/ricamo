<script setup>
import {computed,ref,watch,onBeforeUnmount} from 'vue';
import FormField from './FormField.vue';
import {t,errorText,number} from '../i18n';
import {FABRIC_TYPES,fabricDensityPerCm,fabricWithDensityPerCm} from '../../core/pattern-fabric.mjs';
import {bundledSupplierProducts,supplierFabricConfiguration} from '../../core/supplier-products.mjs';
import {searchSupplierProducts,getSupplierProduct} from '../supplier-catalogues.mjs';
const props=defineProps({modelValue:{type:Object,required:true}}),emit=defineEmits(['update:modelValue']);
const query=ref(''),error=ref(''),loading=ref(false),manual=ref(false),total=ref(0),products=ref(bundledSupplierProducts().filter(row=>row.category==='fabric'));
let timer,request=0;
const signature=config=>JSON.stringify([config.countX,config.countY,config.countMeaning,config.overX,config.overY]);
const density=computed(()=>{try{return fabricDensityPerCm(props.modelValue);}catch{return null;}});
const uniformMargin=computed(()=>{const values=['left','right','top','bottom'].map(side=>props.modelValue.margins?.[side]??0);return values.every(value=>value===values[0])?values[0]:'';});
const preserveMargins=next=>({...next,...(props.modelValue.margins===undefined?{}:{margins:{...props.modelValue.margins}})});
const matches=computed(()=>products.value.filter(row=>row.type===props.modelValue.type&&[row.name,row.brand,row.code,row.colorName].join(' ').toLocaleLowerCase().includes(query.value.toLocaleLowerCase())));
const densities=computed(()=>{const map=new Map();for(const row of products.value){if(row.type!==props.modelValue.type||!row.fabric)continue;const config=supplierFabricConfiguration(row);try{map.set(signature(config),{...config,...fabricDensityPerCm(config)});}catch{/* Unmeasured fabrics need manual geometry. */}}if(density.value)map.set(signature(props.modelValue),{...props.modelValue,...density.value});return [...map.entries()].sort((a,b)=>a[1].x-b[1].x);});
const choices=computed(()=>matches.value.filter(row=>!row.fabric||signature(supplierFabricConfiguration(row))===signature(props.modelValue)));
const measuredChoices=computed(()=>choices.value.filter(row=>row.fabric)),unmeasuredChoices=computed(()=>choices.value.filter(row=>!row.fabric));
const manufacturer=row=>/^(casa\s*cenina|tessiland)$/i.test(row.brand??'')?'':row.brand;
const colourLabel=row=>[row.colorName||row.name,row.code,manufacturer(row)].filter(Boolean).join(' · ');
const selected=computed(()=>products.value.find(row=>row.id===props.modelValue.productId));
const indicative=computed(()=>{
 if(selected.value?.hex)return{hex:selected.value.hex,label:t('fabricSwatchApproximate')};
 const name=(selected.value?.colorName||props.modelValue.colorName||'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
 const tones=[[/\b(white|bianco|blanc|branco)\b/,'#f7f5ee'],[/\b(ivory|avorio|ecru)\b/,'#eee4c9'],[/\b(natural|naturale|grezzo|raw)\b/,'#cfc1a1'],[/\b(black|nero|noir|preto)\b/,'#242424'],[/\b(red|rosso|rouge)\b/,'#a54346'],[/\b(blue|blu|bleu)\b/,'#697f9b'],[/\b(pink|rosa|rose)\b/,'#c898a1'],[/\b(green|verde|vert)\b/,'#78927a'],[/\b(grey|gray|grigio|gris)\b/,'#a3a3a0']].filter(([expression])=>expression.test(name));
 return tones.length===1?{hex:tones[0][1],label:t('fabricSwatchFromName')}:{hex:null,label:t('fabricSwatchUnknown')};
});
async function refresh(){const token=++request;loading.value=true;error.value='';try{const rows=[];let offset=0;do{const page=await searchSupplierProducts({category:'fabric',type:props.modelValue.type,query:query.value,offset,limit:100});if(token!==request)return;rows.push(...page.items);total.value=page.total;offset+=page.items.length;if(!page.items.length)break;}while(offset<total.value&&offset<1000);if(props.modelValue.productId&&!rows.some(row=>row.id===props.modelValue.productId)){const current=await getSupplierProduct({id:props.modelValue.productId});if(token!==request)return;if(current)rows.push(current);}products.value=rows;}catch(caught){if(token===request)error.value=errorText(caught);}finally{if(token===request)loading.value=false;}}
watch([()=>props.modelValue.type,query],()=>{clearTimeout(timer);request++;timer=setTimeout(refresh,250);},{immediate:true});
onBeforeUnmount(()=>{request++;clearTimeout(timer);});
function emitManual(next){emit('update:modelValue',{...next,...(props.modelValue.productId?{code:''}:{}),productId:'',url:''});}
function type(value){const threads=!['aida','canvas'].includes(value);manual.value=false;query.value='';emit('update:modelValue',preserveMargins({type:value,brand:'',range:'',code:'',colorName:'',productId:'',url:'',countX:threads?28:14,countY:threads?28:14,countMeaning:threads?'threads':'stitches',overX:threads?2:1,overY:threads?2:1}));}
function chooseDensity(value){if(value==='custom'){manual.value=true;return;}const row=densities.value.find(([key])=>key===value)?.[1];if(row){manual.value=false;emitManual({...props.modelValue,countX:row.countX,countY:row.countY,countMeaning:row.countMeaning,overX:row.overX,overY:row.overY});}}
function choose(id){if(!id){manual.value=true;emitManual({...props.modelValue});return;}const row=products.value.find(row=>row.id===id);if(row){manual.value=!row.fabric;emit('update:modelValue',preserveMargins(supplierFabricConfiguration(row)));}}
function updateMargin(value){emit('update:modelValue',{...props.modelValue,margins:Object.fromEntries(['left','right','top','bottom'].map(side=>[side,value===''?'':Number(value)]))});}
function updateDensity(axis,value){error.value='';try{const current={x:props.modelValue.countX/2.54,y:props.modelValue.countY/2.54};emit('update:modelValue',fabricWithDensityPerCm(props.modelValue,{x:axis==='X'?value:current.x,y:axis==='Y'?value:current.y}));}catch(caught){emitManual({...props.modelValue,[`count${axis}`]:value===''?'':Number(value)*2.54});error.value=errorText(caught);}}
function update(key,value){const next={...props.modelValue,[key]:value};if(key==='countMeaning'){next.overX=value==='stitches'?1:2;next.overY=next.overX;}emitManual(next);}
</script>
<template>
<div class="form-grid">
 <FormField :label="t('fabricType')" v-slot="{id}"><select :id="id" :value="modelValue.type??'aida'" @change="type($event.target.value)"><option v-for="kind in FABRIC_TYPES" :key="kind" :value="kind">{{t(`fabricType_${kind}`)}}</option></select></FormField>
 <FormField :label="t('fabricDensity')" v-slot="{id}"><select :id="id" :value="manual?'custom':signature(modelValue)" @change="chooseDensity($event.target.value)"><option v-for="[key,row] in densities" :key="key" :value="key">{{number(row.x,3)}} {{t(row.countMeaning==='threads'?'fabricThreadsCm':'fabricStitchesCm')}}{{row.x!==row.y?` × ${number(row.y,3)}`:''}}</option><option value="custom">{{t('fabricDensityCustom')}}</option></select></FormField>
 <FormField :label="t('fabricFindColour')" wide v-slot="{id}"><input :id="id" v-model="query" type="search" :placeholder="t('fabricFindColourHelp')"/></FormField>
 <FormField :label="t('fabricChooseColour')" wide v-slot="{id}"><select :id="id" :value="modelValue.productId??''" @change="choose($event.target.value)"><option value="">{{t('fabricOwnColour')}}</option><optgroup v-if="measuredChoices.length" :label="t('fabricDensityMatched')"><option v-for="row in measuredChoices" :key="row.id" :value="row.id">{{colourLabel(row)}}</option></optgroup><optgroup v-if="unmeasuredChoices.length" :label="t('fabricDensityUnmeasured')"><option v-for="row in unmeasuredChoices" :key="row.id" :value="row.id">{{colourLabel(row)}}</option></optgroup></select></FormField>
</div>
<p v-if="density" class="notice">{{t('fabricEffectiveDensity',{x:number(density.effectiveX,3),y:number(density.effectiveY,3)})}}<span v-if="modelValue.countMeaning==='threads'">{{t('fabricOverSummary',{x:modelValue.overX,y:modelValue.overY})}}</span></p>
<div v-if="selected||modelValue.colorName" class="material-cell"><span class="swatch" :class="{'transparency-surface':!indicative.hex}" :style="{backgroundColor:indicative.hex||undefined}" aria-hidden="true"/><div><strong>{{selected?.colorName||selected?.name||modelValue.colorName}}</strong><span class="cell-subtitle">{{manufacturer(selected||modelValue)}} {{selected?.code||modelValue.code}} · {{indicative.label}}</span></div></div>
<FormField :label="t('fabricExtraMargin')" :help="t('fabricExtraMarginHelp')" v-slot="{id,describedby}"><input :id="id" :value="uniformMargin" :placeholder="t('fabricDifferentMargins')" :aria-describedby="describedby" type="number" min="0" max="1000" step=".5" @input="updateMargin($event.target.value)"/></FormField>
<p v-if="loading" class="field-help" role="status">{{t('fabricSearching')}}</p><p v-if="total>1000" class="field-help">{{t('fabricCatalogueRefine',{count:total})}}</p>
<details class="form-section" :open="manual"><summary>{{t('fabricManualGeometry')}}</summary><div class="form-grid">
 <FormField v-if="!modelValue.productId" :label="t('brand')" v-slot="{id}"><input :id="id" :value="modelValue.brand" maxlength="300" @input="update('brand',$event.target.value)"/></FormField><FormField v-if="!modelValue.productId" :label="t('fabricColourCode')" v-slot="{id}"><input :id="id" :value="modelValue.code" maxlength="300" @input="update('code',$event.target.value)"/></FormField>
 <FormField v-if="!modelValue.productId" :label="t('fabricColourName')" v-slot="{id}"><input :id="id" :value="modelValue.colorName" maxlength="300" @input="update('colorName',$event.target.value)"/></FormField>
 <FormField :label="t('fabricDensityMeaning')" v-slot="{id}"><select :id="id" :value="modelValue.countMeaning" @change="update('countMeaning',$event.target.value)"><option value="stitches">{{t('fabricStitchesCm')}}</option><option value="threads">{{t('fabricThreadsCm')}}</option></select></FormField>
 <FormField v-for="axis in ['X','Y']" :key="axis" :label="t(`fabricDensity${axis}`)" v-slot="{id}"><input :id="id" :value="density?Number(density[axis==='X'?'x':'y'].toFixed(6)):''" type="number" min="0.01" max="78.740157" step="any" @change="updateDensity(axis,$event.target.value===''?'':Number($event.target.value))"/></FormField>
 <template v-if="modelValue.countMeaning==='threads'"><FormField v-for="axis in ['X','Y']" :key="axis" :label="t(`fabricOver${axis}`)" v-slot="{id}"><input :id="id" :value="modelValue[`over${axis}`]" type="number" min="1" max="20" step="1" @input="update(`over${axis}`,$event.target.value===''?'':Number($event.target.value))"/></FormField></template>
</div><p class="field-help">{{t('fabricManualClearsProduct')}}</p></details>
<p v-if="error" role="alert" class="notice error">{{error}}</p>
</template>
