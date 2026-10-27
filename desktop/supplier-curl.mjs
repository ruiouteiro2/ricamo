import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {supplierUrl} from '../core/supplier-products.mjs';
import {resolvePublicSupplier} from './supplier-http.mjs';
const failure=code=>Object.assign(new Error(code),{code});
/** Optional command-line acquisition transport for the explicitly requested curl scan. */
export async function curlSupplierPage(raw,supplier,{signal,maxBytes=8*1024*1024,timeoutMs=25000}={}){
 const deadline=Date.now()+timeoutMs;let url=supplierUrl(raw,{supplier});for(let redirects=0;redirects<5;redirects++){
  if(signal?.aborted)throw failure('supplier_cancelled');if(Date.now()>=deadline)throw failure('supplier_timeout');const target=new URL(url),addresses=await resolvePublicSupplier(target.hostname,{signal,timeoutMs:Math.max(1,deadline-Date.now())});const address=addresses[0].family===6?`[${addresses[0].address}]`:addresses[0].address;
  const dir=await mkdtemp(join(tmpdir(),'ricamo-public-scan-')),header=join(dir,'headers');let result;
  try{result=await new Promise((resolve,reject)=>{const chunks=[];let bytes=0,settled=false;const child=spawn('curl',['--silent','--show-error','--noproxy','*','--user-agent','Ricamo/0.6 public catalogue scanner','--compressed','--proto','=https','--max-time',String(Math.max(1,Math.ceil((deadline-Date.now())/1000))),'--max-filesize',String(maxBytes),'--resolve',`${target.hostname}:443:${address}`,'--dump-header',header,url],{stdio:['ignore','pipe','pipe']});let code=null;const stop=(error)=>{if(settled)return;settled=true;signal?.removeEventListener('abort',abort);child.kill();reject(error);};const abort=()=>stop(failure('supplier_cancelled'));signal?.addEventListener('abort',abort,{once:true});child.stdout.on('data',chunk=>{bytes+=chunk.length;if(bytes>maxBytes)stop(failure('supplier_page_size'));else chunks.push(chunk);});child.stderr.on('data',()=>{});child.on('error',()=>stop(failure('supplier_curl_missing')));child.on('close',exit=>{if(settled)return;settled=true;signal?.removeEventListener('abort',abort);code=exit;if(code!==0)reject(failure(code===28?'supplier_timeout':code===63?'supplier_page_size':'supplier_network'));else resolve({body:Buffer.concat(chunks).toString('utf8'),bytes});});});
   const headers=await readFile(header,'utf8');const responses=headers.split(/\r?\n\r?\n/).filter(part=>/^HTTP\//.test(part));const last=responses.at(-1)??'',status=Number(last.match(/^HTTP\/\S+\s+(\d+)/)?.[1]??0),location=last.match(/^location:\s*(.+)$/im)?.[1]?.trim();if(status>=300&&status<400&&location){url=supplierUrl(new URL(location,url).href,{supplier});continue;}return{...result,status,url,contentType:last.match(/^content-type:\s*(.+)$/im)?.[1]?.trim()??''};
  }finally{await rm(dir,{recursive:true,force:true});}
 }throw failure('supplier_redirect_limit');
}
