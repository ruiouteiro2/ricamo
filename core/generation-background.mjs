import {PatternError} from './pattern.mjs';

/** Mechanical settings shared by generation and portable project validation. */
export function normalizeBackground(value,code='engine.background') {
  const fail=()=>{throw new PatternError(code)};
  if(!value||typeof value!=='object'||Array.isArray(value)||!['transparent','white','color','remove'].includes(value.mode))fail();
  const colored=['color','remove'].includes(value.mode),remove=value.mode==='remove';
  const keys=['mode',...(colored?['color']:[]),...(remove?['tolerance']:[])];
  if(Object.keys(value).some(key=>!keys.includes(key)))fail();
  if(colored&&(typeof value.color!=='string'||!/^#[0-9a-f]{6}$/i.test(value.color)))fail();
  if(remove&&(typeof value.tolerance!=='number'||!Number.isFinite(value.tolerance)||value.tolerance<0||value.tolerance>80))fail();
  return {mode:value.mode,...(colored?{color:value.color.toLowerCase()}:{}),...(remove?{tolerance:value.tolerance}:{})};
}
