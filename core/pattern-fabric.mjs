import { assert, text, quantity, integer, oneOf } from './shared.mjs';
import { fabricSize } from './fabric.mjs';
export const FABRIC_TYPES = Object.freeze(['aida','linen','evenweave','canvas','hardanger','afghan','band','other']);
const fields=['type','brand','range','code','colorName','productId','url','countX','countY','countMeaning','overX','overY','margins'];
export function purchaseUrl(value='') {
  assert(typeof value==='string'&&value.length<=2000,'purchase_link_invalid');
  if(!value)return '';
  let url;try{url=new URL(value);}catch{assert(false,'purchase_link_invalid');}
  assert(url.protocol==='https:'&&!url.username&&!url.password&&['www.casacenina.it','www.casacenina.com','www.casacenina.fr','www.casacenina.es','casacenina.it','casacenina.com','casacenina.fr','casacenina.es','www.tessiland.com','tessiland.com'].includes(url.hostname)&&!url.port,'purchase_link_invalid');
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
  if(value.margins!==undefined){
    const sides=['left','right','top','bottom'];
    assert(value.margins&&typeof value.margins==='object'&&!Array.isArray(value.margins)&&Object.keys(value.margins).every(key=>sides.includes(key)),'pattern_fabric_invalid');
    result.margins=Object.fromEntries(sides.map(side=>{const margin=quantity(value.margins[side]===undefined?0:value.margins[side],{field:`margins.${side}`});assert(margin<=1000,'pattern_fabric_invalid');return[side,margin];}));
  }
  return result;
}
export function fabricGridFromCm({widthCm,heightCm},fabric) {
  const config=normalizePatternFabric(fabric),widthValue=quantity(widthCm,{positive:true}),heightValue=quantity(heightCm,{positive:true});
  const effectiveX=config.countX/(config.countMeaning==='threads'?config.overX:1),effectiveY=config.countY/(config.countMeaning==='threads'?config.overY:1);
  const width=Math.round(widthValue/2.54*effectiveX),height=Math.round(heightValue/2.54*effectiveY);
  assert(width>=1&&width<=500&&height>=1&&height<=500,'pattern_fabric_size');
  return {width,height,...fabricSize({width,height,...config})};
}

/** Display density uses centimetres while the persisted contract remains counts per inch. */
export function fabricDensityPerCm(fabric){
 const config=normalizePatternFabric(fabric),x=config.countX/2.54,y=config.countY/2.54;
 return{x,y,effectiveX:x/(config.countMeaning==='threads'?config.overX:1),effectiveY:y/(config.countMeaning==='threads'?config.overY:1)};
}
export function fabricWithDensityPerCm(fabric,{x,y=x}){
 const dx=quantity(x,{positive:true,field:'densityX'}),dy=quantity(y,{positive:true,field:'densityY'});
 // Round only the stored conversion, not the user's width or physical aspect ratio.
 return normalizePatternFabric({...fabric,countX:Math.round(dx*2.54*1e6)/1e6,countY:Math.round(dy*2.54*1e6)/1e6,...(fabric.productId?{code:''}:{}),productId:'',url:''});
}
