/** Recipes describe physical whole filaments, never prepared-mix inventory. */
import { assert, text, identifier, integer, assertSafeJson } from './shared.mjs';
export const componentIdentity = value => JSON.stringify([(value.brand||'').trim(),(value.range||'').trim(),(value.code||'').trim()||`name:${(value.name||'').trim()}`]);
export const boundIdentity = value => value.itemId ? `id:${value.itemId}` : componentIdentity(value);
const sum = rows => rows.reduce((total, row) => total + row.strands, 0);
function validateComponents(rows, minimum) {
  assert(Array.isArray(rows) && rows.length >= minimum && rows.length <= 12, 'blend_components');
  const identities = new Set(), ids = new Set();
  for (const row of rows) {
    assert(row && typeof row === 'object' && !row.blend, 'blend_component');
    text(row.brand ?? '', 'brand', { max:200 });text(row.range ?? '', 'range', { max:200 });
    text(row.code, 'code', { required:true,max:200 });text(row.name, 'name', { required:true,max:300 });
    assert(/^#[0-9a-f]{6}$/i.test(row.hex), 'blend_color');integer(row.strands,'strands',{min:1,max:12});
    if(row.itemId){identifier(row.itemId);assert(!ids.has(row.itemId),'blend_duplicate');ids.add(row.itemId);}
    const key=componentIdentity(row);assert(!identities.has(key),'blend_duplicate');identities.add(key);
  }
  assert(sum(rows)<=12,'blend_strands');return rows;
}
export function validateThreadColor(color) {
  if(color.backStrands !== undefined)integer(color.backStrands,'backStrands',{min:1,max:12});
  if(!color.blend)return color;
  assertSafeJson(color.blend);assert(color.blend.version===1,'blend_version');
  validateComponents(color.blend.components,2);
  if(color.blend.backComponents !== undefined)validateComponents(color.blend.backComponents,1);
  assert(color.strands===sum(color.blend.components),'blend_strands');
  const back=color.blend.backComponents ?? color.blend.components;
  if(color.backStrands!==undefined)assert(color.backStrands===sum(back),'blend_back_strands');
  return color;
}
export function blendSignature(color) {
  if(!color.blend)return '';
  const signature=rows=>rows.map(row=>[boundIdentity(row),row.strands]).sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);
  return JSON.stringify([signature(color.blend.components),signature(color.blend.backComponents??color.blend.components)]);
}
export function makeBlendColor({code,name,symbol,components,backComponents}) {
  validateComponents(components,2);if(backComponents)validateComponents(backComponents,1);
  const normalized=rows=>rows.map(row=>({brand:(row.brand||'').trim(),range:(row.range||'').trim(),code:row.code.trim(),name:row.name.trim(),hex:row.hex.toLowerCase(),strands:row.strands,...(row.itemId?{itemId:row.itemId}:{})}));
  const blend={version:1,components:normalized(components),...(backComponents?{backComponents:normalized(backComponents)}:{})};
  const strands=sum(components),rgb=[1,3,5].map(offset=>Math.round(components.reduce((n,row)=>n+parseInt(row.hex.slice(offset,offset+2),16)*row.strands,0)/strands));
  const result={brand:'',range:'',code:text(code,'code',{required:true,max:200}),name:text(name,'name',{required:true,max:300}),symbol,
    strands,backStrands:sum(backComponents??components),rgb,hex:`#${rgb.map(n=>n.toString(16).padStart(2,'0')).join('')}`,blend};
  validateThreadColor(result);return result;
}
export function threadComponents(color,type,configuration={},index=0) {
  validateThreadColor(color);
  if(color.blend){
    const rows=type==='back'?color.blend.backComponents??color.blend.components:color.blend.components;
    if(type!=='back' && configuration.colorStrands?.[index]!==undefined)assert(Number(configuration.colorStrands[index])===sum(rows),'blend_strands');
    return structuredClone(rows);
  }
  const strands=Number(type==='back' ? color.backStrands??configuration.backStrands??1 : configuration.colorStrands?.[index]??color.strands??configuration.strands??2);
  integer(strands,'strands',{min:1,max:12});return [{...structuredClone(color),strands}];
}
