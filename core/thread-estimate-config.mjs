import {assert,integer} from './shared.mjs';

export const THREAD_ESTIMATE_DEFAULTS=Object.freeze({strands:2,backStrands:1,waste:20,crossTravel:1,halfTravel:1,outlineReturn:2,batchSize:80,startFinishCm:12,calibrationFactor:1});
export function threadEstimateConfiguration(value={}) {
  assert(value && typeof value==='object' && !Array.isArray(value),'thread_estimate_configuration');
  const result={...THREAD_ESTIMATE_DEFAULTS};
  for(const [key,min,max] of [['strands',1,12],['backStrands',1,12],['waste',0,100],['crossTravel',0,10],['halfTravel',0,10],['outlineReturn',1,10],['batchSize',1,10000],['startFinishCm',0,200],['calibrationFactor',.1,10]]){
    const raw=value[key]===undefined?result[key]:value[key];assert(raw!=='' && raw!==null,'thread_estimate_configuration',{field:key});const number=typeof raw==='string'?Number(raw.replace(',','.')):raw;
    assert(Number.isFinite(number)&&number>=min&&number<=max,'thread_estimate_configuration',{field:key});
    if(['strands','backStrands','batchSize'].includes(key))integer(number,key,{min,max});result[key]=number;
  }
  if(value.colorStrands){assert(value.colorStrands && typeof value.colorStrands==='object' && !Array.isArray(value.colorStrands),'thread_estimate_configuration');for(const [index,strands] of Object.entries(value.colorStrands)){assert(/^(?:[0-9]|[1-7][0-9])$/.test(index),'thread_estimate_configuration');integer(strands,'strands',{min:1,max:12});}result.colorStrands={...value.colorStrands};}
  return result;
}
