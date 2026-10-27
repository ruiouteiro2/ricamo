<script setup>
import { computed } from 'vue';
import FormField from './FormField.vue';
import { t, number } from '../i18n';
import { descriptorFields, descriptorValue, setDescriptor, recordedDescriptors } from '../../core/material-descriptors.mjs';
const props=defineProps({properties:{type:Object,required:true},category:{type:String,required:true},scope:{type:String,default:'material'},readonly:Boolean});
const fields=computed(()=>props.readonly?recordedDescriptors(props.properties,props.scope):descriptorFields(props.category,props.scope,props.properties));
function update(field,event){setDescriptor(props.properties,field.key,event.target.value,props.scope)}
function displayed(field){return field.type==='select'?t(`descriptorOption_${field.value}`):field.type==='integer'?number(field.value,0):field.value}
</script>
<template>
  <div v-if="readonly"><template v-for="field in fields" :key="field.key"><div v-if="scope==='lot'" class="cell-subtitle descriptor-value">{{ t(field.label) }}: {{ displayed(field) }}</div><div v-else class="stat-row"><span>{{ t(field.label) }}</span><span class="descriptor-value">{{ displayed(field) }}</span></div></template></div>
  <div v-else class="form-grid">
    <FormField v-for="field in fields" :key="field.key" :label="t(field.label)" :wide="field.type==='textarea'" :help="['replacementSuggestion','replacementSource','usableArea','packageCondition'].includes(field.key)?t(`descriptorHelp_${field.key}`):undefined" v-slot="{id,describedby}">
      <select v-if="field.type==='select'" :id="id" :value="descriptorValue(properties,field.key)??''" :aria-describedby="describedby" @change="update(field,$event)"><option value="">{{ t('unknown') }}</option><option v-for="value in field.options" :key="value" :value="value">{{ t(`descriptorOption_${value}`) }}</option></select>
      <textarea v-else-if="field.type==='textarea'" :id="id" :value="descriptorValue(properties,field.key)??''" :maxlength="field.max" :aria-describedby="describedby" @input="update(field,$event)" />
      <input v-else :id="id" :value="descriptorValue(properties,field.key)??''" :type="field.type==='date'?'date':'text'" :inputmode="field.type==='integer'?'numeric':undefined" :maxlength="field.type==='integer'?6:field.max" :aria-describedby="describedby" @input="update(field,$event)" />
    </FormField>
  </div>
</template>

<style scoped>
.descriptor-value{min-width:0;overflow-wrap:anywhere}
</style>
