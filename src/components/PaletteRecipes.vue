<script setup>
import {computed,reactive,ref} from 'vue';
import {Plus,Trash2} from '@lucide/vue';
import AppDialog from './AppDialog.vue';
import FormField from './FormField.vue';
import {state} from '../state';
import {t,errorText} from '../i18n';
import {dmcPalette} from '../engine/adapter.mjs';
import {makeBlendColor} from '../../core/thread-recipes.mjs';
import {SYMBOLS} from '../../core/pattern.mjs';
import {symbolsForMode} from '../../core/pattern-symbols.mjs';
const props=defineProps({color:Object,symbolMode:String,colors:{type:Array,default:()=>[]},apply:{type:Function,required:true}}),emit=defineEmits(['close']);
const error=ref(''),busy=ref(false),search=ref('');
const blank=()=>({brand:'',range:'',code:'',name:'',hex:'#808080',strands:1,choice:''});
const fromComponent=row=>({...structuredClone(row),choice:row.itemId?`inventory:${row.itemId}`:row.brand==='DMC'&&!row.range&&dmcPalette.colors.some(c=>c.code===row.code)?`catalogue:${row.code}`:'custom'});
const form=reactive({code:props.color?.code||`MIX-${props.colors.length+1}`,name:props.color?.name||'',symbol:props.color?.symbol||[...(props.symbolMode?symbolsForMode(props.symbolMode,500):SYMBOLS)].find(symbol=>!props.colors.some(c=>c.symbol===symbol))||'',
  components:props.color?.blend?.components.map(fromComponent)||(props.color?[fromComponent({...props.color,strands:1}),blank()]:[blank(),blank()]),ownBack:Boolean(props.color?.blend?.backComponents),backComponents:props.color?.blend?.backComponents?.map(fromComponent)||[]});
const inventory=computed(()=>state.value.materials.filter(row=>!row.archived && row.category==='thread'));
function catalogueFor(component){return dmcPalette.colors.filter(row=>`catalogue:${row.code}`===component.choice || `${row.code} ${row.name}`.toLowerCase().includes(search.value.toLowerCase()));}
function select(row){
 const separator=row.choice.indexOf(':'),source=separator<0?row.choice:row.choice.slice(0,separator),key=row.choice.slice(separator+1);if(source==='custom'){delete row.itemId;return;}
 const value=source==='inventory'?inventory.value.find(item=>item.id===key):dmcPalette.colors.find(item=>item.code===key);if(!value)return;
 const strands=row.strands,choice=row.choice;Object.keys(row).forEach(key=>delete row[key]);
 Object.assign(row,{brand:source==='inventory'?value.brand:'DMC',range:value.range||'',code:value.code,name:value.name,hex:source==='inventory'?value.color||'#808080':value.hex,strands,choice,...(source==='inventory'?{itemId:value.id}:{})});
}
function toggleBack(){if(form.ownBack&&!form.backComponents.length)form.backComponents=form.components.map(row=>({...row}));}
const clean=rows=>rows.map(row=>({brand:row.brand||'',range:row.range||'',code:row.code,name:row.name,hex:row.hex,strands:Number(row.strands),...(row.itemId?{itemId:row.itemId}:{})}));
const candidate=computed(()=>{try{return makeBlendColor({code:form.code,name:form.name,symbol:form.symbol,components:clean(form.components),...(form.ownBack?{backComponents:clean(form.backComponents)}:{})})}catch{return null}});
function friendly(caught){const code=caught?.code;if(code==='blend_duplicate')return t('blendDuplicate');if(code==='blend_strands'||code==='blend_back_strands'||code==='invalid_integer')return t('blendStrandLimit');if(code==='blend_components')return t('blendComponentsHelp');return errorText(caught);}
async function save(){error.value='';busy.value=true;try{const color=makeBlendColor({code:form.code,name:form.name,symbol:form.symbol,components:clean(form.components),...(form.ownBack?{backComponents:clean(form.backComponents)}:{})});if(!color.symbol.trim()||color.symbol.length>4||props.colors.some(row=>row!==props.color&&row.symbol===color.symbol))throw Object.assign(Error(),{code:'blend_symbol'});const accepted=await props.apply(color);if(accepted===false)throw Error('blend_apply_failed');emit('close');}catch(caught){error.value=caught.code==='blend_symbol'?t('blendSymbolUnique'):friendly(caught);}finally{busy.value=false;}}
</script>
<template>
 <AppDialog :title="t(color?.blend?'blendEdit':'blendCreate')" wide :busy="busy" @close="emit('close')">
  <p class="notice">{{t('blendHelp')}}</p><p v-if="error" class="notice error" role="alert">{{error}}</p>
  <div class="form-grid"><FormField :label="t('name')" required v-slot="{id}"><input :id="id" v-model="form.name" maxlength="300" autofocus /></FormField><FormField :label="t('code')" required v-slot="{id}"><input :id="id" v-model="form.code" maxlength="200" /></FormField><FormField :label="t('symbol')" required v-slot="{id}"><input :id="id" v-model="form.symbol" maxlength="4" /></FormField><FormField :label="t('searchColors')" v-slot="{id}"><input :id="id" v-model="search" /></FormField></div>
  <template v-for="section in [{key:'components',label:t('blendFullHalf')},{key:'backComponents',label:t('blendOutline')}]" :key="section.key">
   <template v-if="section.key==='components'||form.ownBack"><h3>{{section.label}}</h3>
    <div v-for="(row,index) in form[section.key]" :key="index" class="panel panel-body" style="margin-top:12px"><div class="form-grid">
     <FormField :label="t('blendComponent',{number:index+1})" wide v-slot="{id}"><select :id="id" v-model="row.choice" @change="select(row)"><option value="">{{t('threadChoose')}}</option><optgroup :label="t('threadInventory')"><option v-for="item in inventory" :key="item.id" :value="`inventory:${item.id}`">{{item.brand}} {{item.range}} {{item.code}} · {{item.name}}</option></optgroup><optgroup :label="t('catalogue')"><option v-for="item in catalogueFor(row)" :key="item.code" :value="`catalogue:${item.code}`">DMC {{item.code}} · {{item.name}}</option></optgroup><option value="custom">{{t('customColor')}}</option></select></FormField>
     <template v-if="row.choice==='custom'"><FormField v-for="key in ['brand','range','code','name']" :key="key" :label="`${t('blendComponent',{number:index+1})} · ${t(key)}`" :required="['code','name'].includes(key)" v-slot="{id}"><input :id="id" v-model="row[key]" maxlength="200" /></FormField><FormField :label="t('color')" v-slot="{id}"><input :id="id" v-model="row.hex" type="color" /></FormField></template>
     <FormField :label="t('blendWholeStrands',{number:index+1})" required v-slot="{id}"><input :id="id" v-model.number="row.strands" type="number" min="1" max="12" step="1" /></FormField><div class="actions"><span class="swatch" :style="{background:row.hex}" /><span>{{row.brand}} {{row.range}} {{row.code}}</span><button class="icon-button" :disabled="form[section.key].length<=(section.key==='components'?2:1)" :aria-label="`${t('remove')} ${t('blendComponent',{number:index+1})}`" @click="form[section.key].splice(index,1)"><Trash2 :size="16" /></button></div>
    </div></div><button class="button small" style="margin:12px 0" :disabled="form[section.key].length>=12" @click="form[section.key].push(blank())"><Plus :size="15" />{{t('blendAddComponent')}}</button>
   </template>
   <label v-if="section.key==='components'" class="checkbox-label" style="margin:12px 0"><input v-model="form.ownBack" type="checkbox" @change="toggleBack" />{{t('blendOwnBack')}}</label>
  </template>
  <p class="field-help">{{t('blendBackHelp')}}</p><p v-if="candidate" class="notice"><span class="swatch" :style="{background:candidate.hex}" /> {{t('blendPreview',{full:candidate.strands,back:candidate.backStrands})}}</p>
  <template #footer><button class="button" :disabled="busy" @click="emit('close')">{{t('cancel')}}</button><button class="button primary" :disabled="busy" @click="save">{{t('blendApply')}}</button></template>
 </AppDialog>
</template>
