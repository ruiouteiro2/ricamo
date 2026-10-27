import {assert,integer,oneOf} from './shared.mjs';
export const SYMBOL_MODES=Object.freeze(['letters','alphanumeric','special']);
const alphabets=Object.freeze({letters:'ABCDEFGHIJKLMNOPQRSTUVWXYZ',alphanumeric:'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',special:'○●□■◇◆△▲▽▼☆★+×÷=≠±∞∩∪⊕⊗@#%&?'});
/** Stable single glyphs followed by unique pairs, supported by the bundled PDF font. */
export function symbolsForMode(mode,count=500){
 oneOf(mode,SYMBOL_MODES,'symbolMode');integer(count,'count',{min:0,max:500});
 const alphabet=[...alphabets[mode]],result=alphabet.slice(0,count);
 for(const first of alphabet)for(const second of alphabet){if(result.length>=count)return result;result.push(first+second);}
 assert(result.length>=count,'pattern.symbol');return result.slice(0,count);
}
export function assignSymbols(revision,mode){
 assert(revision&&Array.isArray(revision.colors),'pattern.palette');
 const symbols=symbolsForMode(mode,revision.colors.length),next=structuredClone(revision);
 next.colors=next.colors.map((color,index)=>({...color,symbol:symbols[index]}));next.settings={...next.settings,symbolMode:mode};return next;
}
