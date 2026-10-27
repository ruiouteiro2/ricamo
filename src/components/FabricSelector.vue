<script setup>
import {computed,ref} from 'vue';
import FormField from './FormField.vue';
import {t,errorText} from '../i18n';
import {FABRIC_TYPES} from '../../core/pattern-fabric.mjs';
import {CASA_CENINA,fabricConfiguration} from '../../core/retailer-catalogue.mjs';
import {openPurchaseLink} from '../purchase-link.mjs';
const props=defineProps({modelValue:{type:Object,required:true}}),emit=defineEmits(['update:modelValue']);
const query=ref(''),error=ref('');
const matches=computed(()=>CASA_CENINA.fabrics.filter(row=>(!props.modelValue.type||row.type===props.modelValue.type)&&[row.name,row.brand,row.range,row.code,row.colorName].join(' ').toLocaleLowerCase().includes(query.value.toLocaleLowerCase())));
const choices=computed(()=>{const rows=matches.value.slice(0,100),selected=CASA_CENINA.fabrics.find(row=>row.id===props.modelValue.productId);if(selected&&!rows.some(row=>row.id===selected.id))rows.unshift(selected);return rows;});
function update(key,value){const next={...props.modelValue,[key]:value};if(['countX','countY','overX','overY','countMeaning'].includes(key)){next.productId='';next.url='';}if(key==='countMeaning'){next.overX=value==='stitches'?1:2;next.overY=next.overX;}emit('update:modelValue',next);}
function type(value){const threads=!['aida','canvas'].includes(value);emit('update:modelValue',{type:value,brand:'',range:'',code:'',colorName:'',productId:'',url:'',countX:threads?28:14,countY:threads?28:14,countMeaning:threads?'threads':'stitches',overX:threads?2:1,overY:threads?2:1});}
function choose(id){const row=CASA_CENINA.fabrics.find(row=>row.id===id);if(!row){emit('update:modelValue',{...props.modelValue,productId:'',url:''});return;}const config=fabricConfiguration(row);emit('update:modelValue',{type:row.type??props.modelValue.type,brand:row.brand??'',range:row.range??'',code:row.code??'',colorName:row.colorName??'',productId:row.id,url:row.url,...(config??{countX:'',countY:'',countMeaning:row.countMeaning??'threads',overX:row.over??2,overY:row.over??2})});}
async function buy(){try{error.value='';await openPurchaseLink(props.modelValue.url);}catch(caught){error.value=errorText(caught);}}
</script>
<template>
<div class="form-grid">
 <FormField :label="t('fabricType')" v-slot="{id}"><select :id="id" :value="modelValue.type??'aida'" @change="type($event.target.value)"><option v-for="kind in FABRIC_TYPES" :key="kind" :value="kind">{{t(`fabricType_${kind}`)}}</option></select></FormField>
 <FormField :label="t('fabricCatalogueSearch')" v-slot="{id}"><input :id="id" v-model="query" type="search" :placeholder="t('fabricCatalogueSearchHint')"/></FormField>
 <FormField :label="t('fabricCatalogueProduct')" wide v-slot="{id}"><select :id="id" :value="modelValue.productId??''" @change="choose($event.target.value)"><option value="">{{t('fabricCustom')}}</option><option v-for="row in choices" :key="row.id" :value="row.id">{{[row.brand,row.name].filter(Boolean).join(' · ')}}</option></select></FormField>
 <p v-if="matches.length>100" class="field-help field-wide">{{t('fabricCatalogueRefine',{count:matches.length})}}</p>
 <template v-if="!modelValue.productId"><FormField v-for="key in ['brand','range','code','colorName']" :key="key" :label="t(key==='colorName'?'color':key)" v-slot="{id}"><input :id="id" :value="modelValue[key]" maxlength="300" @input="update(key,$event.target.value)"/></FormField></template>
 <FormField :label="t('countMeaning')" :help="t('fabricCountMeaningHelp')" v-slot="{id,describedby}"><select :id="id" :aria-describedby="describedby" :value="modelValue.countMeaning" @change="update('countMeaning',$event.target.value)"><option value="stitches">{{t('stitchesPerInch')}}</option><option value="threads">{{t('threadsPerInch')}}</option></select></FormField>
 <FormField v-for="axis in ['X','Y']" :key="axis" :label="t(`count${axis}`)" required v-slot="{id}"><input :id="id" type="number" min="1" max="200" step="any" required :value="modelValue[`count${axis}`]" @input="update(`count${axis}`,$event.target.value===''?'':Number($event.target.value))"/></FormField>
 <template v-if="modelValue.countMeaning==='threads'"><FormField v-for="axis in ['X','Y']" :key="axis" :label="t(`over${axis}`)" required v-slot="{id}"><input :id="id" type="number" min="1" max="20" step="1" required :value="modelValue[`over${axis}`]" @input="update(`over${axis}`,$event.target.value===''?'':Number($event.target.value))"/></FormField></template>
</div>
<p class="field-help">{{t('fabricCatalogueHelp')}}</p><button v-if="modelValue.url" class="button small" type="button" @click="buy">{{t('buyAtCasaCenina')}}</button><p v-if="error" role="alert" class="notice error">{{error}}</p>
</template>
