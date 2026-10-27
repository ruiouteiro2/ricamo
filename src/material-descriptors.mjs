import { t } from './i18n';
import { descriptorFields, descriptorValue, setDescriptor, normalizeDescriptorProperties, recordedDescriptors, materialDescriptorSearch } from '../core/material-descriptors.mjs';

export function lotDescriptorInitial(category, properties = {}) {
  return Object.fromEntries(descriptorFields(category,'lot',properties).map(field=>[`descriptor_${field.key}`,descriptorValue(properties,field.key)??'']));
}
export function lotDescriptorFields(category, properties = {}) {
  return descriptorFields(category,'lot',properties).map(field=>({ key:`descriptor_${field.key}`,label:t(field.label),type:field.type==='select'?'select':field.type==='date'?'date':'text',...(field.options?{options:field.options.map(value=>({value,label:t(`descriptorOption_${value}`)}))}:{}),...(field.key==='packageCondition'?{help:t('descriptorHelp_packageCondition')}:{}),max:field.max }));
}
export function lotDescriptorProperties(draft, existing = {}) {
  const properties=JSON.parse(JSON.stringify(existing));
  for(const[key,value]of Object.entries(draft))if(key.startsWith('descriptor_'))setDescriptor(properties,key.slice(11),value,'lot');
  return normalizeDescriptorProperties(properties,'lot');
}
export function materialSearchDescriptors(material,lots=[]) {
  return [materialDescriptorSearch(material,lots),...recordedDescriptors(material.properties).filter(row=>row.type==='select').map(row=>t(`descriptorOption_${row.value}`)),...lots.flatMap(lot=>recordedDescriptors(lot.properties,'lot').filter(row=>row.type==='select').map(row=>t(`descriptorOption_${row.value}`)))].join(' ');
}
