import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

/** Keep original photo bytes, but load only pictures actually shown on screen.
 * Large inline base64 catalogues otherwise enter every importing route's JS heap. */
export function catalogueImages(){
 return {name:'ricamo-catalogue-images',enforce:'pre',apply:'build',load(id){
  if(!/[\\/]src[\\/]assets[\\/][a-z-]+-previews\.json$/.test(id))return;
  const emitted=new Set();
  const replace=value=>{
   if(typeof value==='string'){
    const match=/^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=]+)$/.exec(value);if(!match)return value;
    const source=Buffer.from(match[2],'base64'),digest=createHash('sha256').update(source).digest('hex'),fileName=`catalogue-images/${digest}.${match[1]==='jpeg'?'jpg':match[1]}`;
    if(!emitted.has(fileName)){this.emitFile({type:'asset',fileName,source});emitted.add(fileName);}return '/'+fileName;
   }
   if(Array.isArray(value))return value.map(replace);
   if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,row])=>[key,replace(row)]));
   return value;
  };
  return JSON.stringify(replace(JSON.parse(readFileSync(id,'utf8'))));
 }};
}
