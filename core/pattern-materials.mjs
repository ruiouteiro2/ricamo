import {assert} from './shared.mjs';
import {normalizeSupplierProduct,supplierIdentity} from './supplier-products.mjs';
import {validateThreadColor,blendSignature} from './thread-recipes.mjs';

export const isBead = color => color?.materialKind === 'bead';
export const cellKind = color => isBead(color) ? 'bead' : 'full';

/** A bead is one physical object in a cell, not a cross made with that colour. */
export function validatePatternMaterial(color,{attachment=false,component=false}={}) {
  assert(color.materialKind===undefined||['thread','bead'].includes(color.materialKind),'pattern.materialKind');
  assert(!attachment||!isBead(color),'pattern.attachmentThread');
  assert(!component||!isBead(color),'pattern.beadThread');
  for(const part of [...(color.blend?.components??[]),...(color.blend?.backComponents??[])])validatePatternMaterial(part,{component:true});
  if(color.product!==undefined){
    const product=normalizeSupplierProduct(color.product);
    assert(product.category===(isBead(color)?'embellishment':'thread'),'pattern.materialProduct');
    assert(supplierIdentity(color)===supplierIdentity(product),'pattern.materialProduct');
    if(product.hex)assert(color.hex.toLowerCase()===product.hex,'pattern.materialColor');
  }
  if(color.displayColorUnknown!==undefined)assert(typeof color.displayColorUnknown==='boolean','pattern.materialColor');
  if(isBead(color)){
    assert(!color.blend&&color.strands===undefined&&color.backStrands===undefined,'pattern.beadThread');
    if(color.attachmentThread!==undefined){
      const thread=color.attachmentThread;
      assert(thread&&typeof thread==='object'&&!thread.attachmentThread&&typeof thread.code==='string'&&typeof thread.name==='string'&&/^#[0-9a-f]{6}$/i.test(thread.hex),'pattern.attachmentThread');
      assert(Array.isArray(thread.rgb)&&thread.rgb.length===3&&thread.rgb.every(v=>Number.isInteger(v)&&v>=0&&v<=255),'pattern.attachmentThread');
      assert(Number.isInteger(thread.strands)&&thread.strands>=1&&thread.strands<=12,'pattern.attachmentThread');
      validateThreadColor(thread);validatePatternMaterial(thread,{attachment:true});
    }
  }else assert(color.attachmentThread===undefined,'pattern.attachmentThread');
  return color;
}

export function materialColorIdentity(color){
  return JSON.stringify([color.itemId??'',color.brand??'',color.range??'',color.code||color.product?.id||`name:${color.name}`,color.hex,cellKind(color),color.strands??2,color.backStrands??1,blendSignature(color),color.attachmentThread?materialColorIdentity(color.attachmentThread):null]);
}

/** Unknown screen colour is visibly neutral; it never enters image colour matching. */
export function colorFromProduct(value,{strands=2,attachmentThread}={}){
  const product=normalizeSupplierProduct(value),bead=product.category==='embellishment';
  assert(bead||product.category==='thread','pattern.materialProduct');
  const hex=product.hex??'#aaa6a0';
  const color={brand:product.brand,range:product.range,code:product.code,name:product.name,hex,rgb:[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)),materialKind:bead?'bead':'thread',product,displayColorUnknown:!product.hex};
  if(bead){if(attachmentThread)color.attachmentThread=structuredClone(attachmentThread);}
  else color.strands=strands;
  validateThreadColor(color);validatePatternMaterial(color);return color;
}

/** Screen footprint is relative to fabric pitch; no assumed diameter for unknown beads. */
export function beadFootprint(color,fabric){
  const diameter=color?.product?.beadSizeMm;
  if(!isBead(color)||!diameter||!fabric?.countX||!fabric?.countY)return null;
  const overX=fabric.countMeaning==='threads'?(fabric.overX??2):1,overY=fabric.countMeaning==='threads'?(fabric.overY??2):1;
  const x=diameter/(25.4/fabric.countX*overX),y=diameter/(25.4/fabric.countY*overY);
  return {diameterMm:diameter,x,y,overlaps:x>1||y>1};
}
