import { assert, text, quantity, integer, oneOf } from './shared.mjs';
import { fabricSize } from './fabric.mjs';
export const FABRIC_TYPES = Object.freeze(['aida','linen','evenweave','canvas','hardanger','afghan','band','other']);
const fields=['type','brand','range','code','colorName','productId','url','countX','countY','countMeaning','overX','overY'];
export function purchaseUrl(value='') {
  assert(typeof value==='string'&&value.length<=2000,'purchase_link_invalid');
  if(!value)return '';
  let url;try{url=new URL(value);}catch{assert(false,'purchase_link_invalid');}
  assert(url.protocol==='https:'&&!url.username&&!url.password&&['www.casacenina.it','www.casacenina.com','www.casacenina.fr','www.casacenina.es','casacenina.it','casacenina.com','casacenina.fr','casacenina.es'].includes(url.hostname)&&!url.port,'purchase_link_invalid');
  return url.href;
}
export function normalizePatternFabric(value={}) {
  assert(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>fields.includes(key)),'pattern_fabric_invalid');
  const result={type:oneOf(value.type??'aida',FABRIC_TYPES,'fabricType'),...Object.fromEntries(['brand','range','code','colorName','productId'].map(key=>[key,text(value[key],key,{max:300})])),url:purchaseUrl(value.url??'')};
  result.countX=quantity(value.countX===undefined?14:value.countX,{positive:true,field:'countX'});result.countY=quantity(value.countY===undefined?result.countX:value.countY,{positive:true,field:'countY'});
  assert(result.countX<=200&&result.countY<=200,'pattern_fabric_invalid');
  result.countMeaning=oneOf(value.countMeaning??(result.type==='aida'?'stitches':'threads'),['stitches','threads'],'countMeaning');
  result.overX=integer(value.overX??(result.countMeaning==='threads'?2:1),'overX',{min:1,max:20});result.overY=integer(value.overY??result.overX,'overY',{min:1,max:20});
  if(result.countMeaning==='stitches')assert(result.overX===1&&result.overY===1,'pattern_fabric_over');
  return result;
}
export function fabricGridFromCm({widthCm,heightCm},fabric) {
  const config=normalizePatternFabric(fabric),widthValue=quantity(widthCm,{positive:true}),heightValue=quantity(heightCm,{positive:true});
  const effectiveX=config.countX/(config.countMeaning==='threads'?config.overX:1),effectiveY=config.countY/(config.countMeaning==='threads'?config.overY:1);
  const width=Math.round(widthValue/2.54*effectiveX),height=Math.round(heightValue/2.54*effectiveY);
  assert(width>=1&&width<=500&&height>=1&&height<=500,'pattern_fabric_size');
  return {width,height,...fabricSize({width,height,...config})};
}
