<script setup>
import {computed,ref,watch,onBeforeUnmount} from 'vue';
import AppDialog from './AppDialog.vue';import FormField from './FormField.vue';import FabricSelector from './FabricSelector.vue';
import {dispatch,notify} from '../state';import {t,number,errorText} from '../i18n';
import {normalizePatternFabric} from '../../core/pattern-fabric.mjs';import {normalizePatternSupplies} from '../../core/pattern-supplies.mjs';import {fabricSize} from '../../core/fabric.mjs';import {UNITS} from '../../core/inventory.mjs';
import PatternProcurement from './PatternProcurement.vue';
import {searchSupplierProducts} from '../supplier-catalogues.mjs';
import {CASA_CENINA,NIGHTINGALE_SUPPLIES} from '../../core/retailer-catalogue.mjs';import {openPurchaseLink} from '../purchase-link.mjs';
const props=defineProps({pattern:{type:Object,required:true},project:Object});
const editing=ref(null),error=ref(''),busy=ref(false),search=ref('');
const revision=computed(()=>props.pattern.revisions.find(row=>row.id===(props.project?.revisionId??props.pattern.currentRevisionId)));
const design=computed(()=>props.pattern.library?.design??{});
const fabric=computed(()=>design.value.fabric??revision.value?.settings?.fabric);
const dimensions=computed(()=>{if(design.value.widthCm&&design.value.heightCm)return {widthCm:design.value.widthCm,heightCm:design.value.heightCm};if(revision.value&&fabric.value){try{return fabricSize({...fabric.value,width:revision.value.width,height:revision.value.height})}catch{}}return null;});
const matches=ref([]),searching=ref(false);let searchTimer,searchVersion=0;
watch(search,()=>{clearTimeout(searchTimer);const version=++searchVersion;if(!search.value.trim()){matches.value=[];return;}searchTimer=setTimeout(async()=>{searching.value=true;try{const result=await searchSupplierProducts({query:search.value,limit:80});if(version===searchVersion)matches.value=result.items;}catch(caught){if(version===searchVersion)error.value=errorText(caught);}finally{if(version===searchVersion)searching.value=false;}},250);});
onBeforeUnmount(()=>{searchVersion++;clearTimeout(searchTimer)});
const categories=computed(()=>CASA_CENINA.categories.filter(row=>!row.type||row.type===fabric.value?.type));
function edit(){error.value='';editing.value={fabric:structuredClone(fabric.value??normalizePatternFabric()),widthCm:dimensions.value?.widthCm??'',heightCm:dimensions.value?.heightCm??'',sourceUrl:design.value.sourceUrl??'',requirements:structuredClone(design.value.requirements??[])};}
function add(row){editing.value.requirements.push(row?{category:row.category,brand:row.brand??'',range:row.range??'',code:row.code??'',name:row.name,quantity:'',unit:row.pack?.unit??(row.category==='thread'?'strand-m':'piece'),url:row.url,product:JSON.parse(JSON.stringify(row))}:{category:'thread',brand:'',range:'',code:'',name:'',quantity:'',unit:'strand-m',url:''});}
function changeRequirement(row,key,value){row[key]=value;if(['brand','range','code','category'].includes(key)){delete row.product;row.url='';if(['thread','embellishment'].includes(row.category))row.name=[row.brand,row.range,row.code].filter(Boolean).join(' · ');}}

function preset(){const row=NIGHTINGALE_SUPPLIES;editing.value={fabric:structuredClone(row.fabric),widthCm:row.widthCm??230/16*2.54,heightCm:row.heightCm??190/16*2.54,sourceUrl:row.sourceUrl??row.url,requirements:structuredClone(row.requirements)};}
async function save(){busy.value=true;error.value='';try{const value=normalizePatternSupplies(editing.value);if(revision.value&&value.fabric){const actual=fabricSize({...value.fabric,width:revision.value.width,height:revision.value.height});value.widthCm=actual.widthCm;value.heightCm=actual.heightCm;}await dispatch('pattern.save',{id:props.pattern.id,library:{version:1,...props.pattern.library,design:value}});editing.value=null;notify();}catch(caught){error.value=errorText(caught);}finally{busy.value=false;}}
async function buy(url){try{error.value='';await openPurchaseLink(url);}catch(caught){error.value=errorText(caught);}}
</script>
<template>
<section class="form-section">
 <div class="panel-heading"><h3>{{t('patternSupplies')}}</h3><button class="button small" @click="edit">{{t('edit')}}</button></div>
 <p v-if="error&&!editing" class="notice error" role="alert">{{error}}</p>
 <PatternProcurement :revision="revision" :project="project" :fabric="fabric" :design="design" :allow-apply="Boolean(project)" embedded/>
 <details class="form-section"><summary>{{t('fabricBrowseCategories')}}</summary><p class="field-help">{{t('fabricCoverageHelp')}}</p><div class="actions"><button v-for="category in categories" :key="category.id" class="button text small" @click="buy(category.url)">{{category.name}}</button></div></details>
</section>
<AppDialog v-if="editing" :title="t('patternSupplies')" wide :busy="busy" @close="editing=null">
 <p v-if="error" class="notice error" role="alert">{{error}}</p>
 <FabricSelector v-model="editing.fabric"/>
 <div class="form-grid"><FormField v-for="key in ['widthCm','heightCm']" :key="key" :label="`${t(key==='widthCm'?'width':'height')} (cm)`" v-slot="{id}"><input :id="id" v-model="editing[key]" type="number" min="0.000001" step="any"/></FormField><FormField :label="t('patternSourceLink')" wide v-slot="{id}"><input :id="id" v-model="editing.sourceUrl" type="url" maxlength="2000"/></FormField></div>
 <section class="form-section"><h3>{{t('patternRequiredMaterials')}}</h3><p class="field-help">{{t('patternRequiredMaterialsHelp')}}</p>
 <FormField :label="t('searchMaterials')" v-slot="{id}"><input :id="id" v-model="search" type="search"/></FormField><div v-if="search" class="actions"><button v-for="row in matches" :key="row.id" class="button small" @click="add(row)">{{[row.brand,row.range,row.code].filter(Boolean).join(' · ')}}</button></div>
 <div v-for="(row,index) in editing.requirements" :key="index" class="form-section"><div class="form-grid"><FormField :label="t('category')" v-slot="{id}"><select :id="id"  :value="row.category" @change="changeRequirement(row,'category',$event.target.value)"><option v-for="kind in ['thread','fabric','embellishment','tool','preparation','stabilizer','finishing','other']" :key="kind" :value="kind">{{t(kind)}}</option></select></FormField><FormField v-for="key in ['brand','range','code','name']" :key="key" :label="t(key==='range'?'procurementMaterialType':key==='code'?'procurementColorCode':key)" v-slot="{id}"><input :id="id" :value="row[key]" :readonly="key==='name'&&['thread','embellishment'].includes(row.category)&&Boolean(row.code)" @input="changeRequirement(row,key,$event.target.value)" :maxlength="key==='name'?300:200" :required="key==='name'"/></FormField><FormField :label="t('planned')" :help="t('unknownHint')" v-slot="{id}"><input :id="id" v-model="row.quantity" type="number" min="0" step="any"/></FormField><FormField :label="t('unit')" v-slot="{id}"><select :id="id" v-model="row.unit"><option v-for="unit in UNITS" :key="unit" :value="unit">{{t(unit)}}</option></select></FormField><FormField :label="t('purchaseLinks')" wide v-slot="{id}"><input :id="id" v-model="row.url" type="url" maxlength="2000"/></FormField></div><button class="button text small" @click="editing.requirements.splice(index,1)">{{t('remove')}}</button></div>
 <div class="actions"><button class="button small" :disabled="editing.requirements.length>=1000" @click="add()">{{t('addNeed')}}</button><button class="button small" @click="preset">{{t('nightingalePreset')}}</button></div><p class="field-help">{{t('nightingalePresetHelp')}}</p>
 </section>
 <template #footer><button class="button" :disabled="busy" @click="editing=null">{{t('cancel')}}</button><button class="button primary" :disabled="busy" @click="save">{{t('save')}}</button></template>
</AppDialog>
</template>
