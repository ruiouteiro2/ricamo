import {validateRevision,validateColors,LIMITS,SYMBOLS,paint,PatternError} from './pattern.mjs';
import {isBead,materialColorIdentity} from './pattern-materials.mjs';
import {stableStringify} from './shared.mjs';
import {symbolsForMode} from './pattern-symbols.mjs';

/** One undoable edit. Other occurrences of the previous palette entry stay intact. */
const facts=color=>stableStringify({product:color.product??null,blend:color.blend??null,attachmentThread:color.attachmentThread??null,displayColorUnknown:Boolean(color.displayColorUnknown)});
export function assignCellMaterial(revision,points,color){
  validateRevision(revision);validateColors([color]);
  const next=structuredClone(revision);
  let index=next.colors.findIndex(row=>materialColorIdentity(row)===materialColorIdentity(color)&&facts(row)===facts(color));
  if(index<0){
    if(next.colors.length>=LIMITS.colors)throw new PatternError('pattern.paletteLimit',{max:LIMITS.colors});
    const available=revision.settings?.symbolMode?symbolsForMode(revision.settings.symbolMode,LIMITS.colors):SYMBOLS;
    const symbol=available.find(value=>!next.colors.some(row=>row.symbol===value));
    if(!symbol)throw new PatternError('pattern.symbol');
    next.colors.push({...structuredClone(color),symbol});index=next.colors.length-1;
  }
  if(isBead(color))next.formatVersion=2;
  return paint(next,points,index);
}
