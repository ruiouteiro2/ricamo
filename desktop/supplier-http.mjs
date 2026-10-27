import https from 'node:https';
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import {createGunzip,createInflate,createBrotliDecompress} from 'node:zlib';
import {supplierUrl} from '../core/supplier-products.mjs';
const failure=code=>Object.assign(new Error(code),{code});
export function publicAddress(address){
 if(isIP(address)===4){const [a,b]=address.split('.').map(Number);return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&[0,168].includes(b)||a===100&&b>=64&&b<=127||a===198&&[18,19,51].includes(b)||a===203&&b===0);}
 if(isIP(address)===6){const a=address.toLowerCase();return /^[23]/.test(a)&&!/^2001:(?:db8|0):/.test(a);}return false;
}
export async function resolvePublicSupplier(hostname,{signal,timeoutMs=25000}={}){
 if(signal?.aborted)throw failure('supplier_cancelled');let timer,abort;
 try{const addresses=await Promise.race([lookup(hostname,{all:true}),new Promise((_,reject)=>{abort=()=>reject(failure('supplier_cancelled'));signal?.addEventListener('abort',abort,{once:true});timer=setTimeout(()=>reject(failure('supplier_timeout')),timeoutMs);})]);if(!addresses.length||addresses.some(row=>!publicAddress(row.address)))throw failure('supplier_private_address');return addresses;}
 finally{clearTimeout(timer);if(abort)signal?.removeEventListener('abort',abort);}
}
/** Public allowlisted HTTPS only, pinned public DNS, no cookies, bounded redirects and body. */
export async function fetchSupplierPage(url,supplier,{signal,maxBytes=8*1024*1024,timeoutMs=25000,maxRedirects=4}={}){
 const deadline=Date.now()+timeoutMs;let current=supplierUrl(url,{supplier});for(let redirect=0;redirect<=maxRedirects;redirect++){
  if(signal?.aborted)throw failure('supplier_cancelled');if(Date.now()>=deadline)throw failure('supplier_timeout');const parsed=new URL(current),addresses=await resolvePublicSupplier(parsed.hostname,{signal,timeoutMs:Math.max(1,deadline-Date.now())});
  const response=await new Promise((resolve,reject)=>{let settled=false;const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);error?reject(error):resolve(value);};
   const req=https.request(parsed,{method:'GET',headers:{'User-Agent':'Ricamo/0.6 (+offline embroidery catalogue; public pages only)','Accept':'text/html,application/xml,text/xml,text/plain;q=0.9','Accept-Encoding':'gzip, deflate, br'},lookup:(_host,opts,callback)=>opts.all?callback(null,[addresses[0]]):callback(null,addresses[0].address,addresses[0].family)},res=>{
    const status=res.statusCode??0;if(status>=300&&status<400){finish(null,{status,location:res.headers.location,bytes:0,body:''});res.destroy();return;}
    const encoding=res.headers['content-encoding'];let stream=res;if(encoding==='gzip')stream=res.pipe(createGunzip());else if(encoding==='deflate')stream=res.pipe(createInflate());else if(encoding==='br')stream=res.pipe(createBrotliDecompress());else if(encoding&&encoding!=='identity'){res.destroy();finish(failure('supplier_encoding'));return;}
    const parts=[];let size=0;stream.on('data',chunk=>{size+=chunk.length;if(size>maxBytes){stream.destroy();req.destroy();finish(failure('supplier_page_size'));}else parts.push(chunk);});stream.on('error',()=>finish(failure('supplier_network')));stream.on('end',()=>finish(null,{status,body:Buffer.concat(parts).toString('utf8'),bytes:size,contentType:String(res.headers['content-type']??''),url:current}));
   });const abort=()=>{req.destroy();finish(failure('supplier_cancelled'));};const timer=setTimeout(()=>{req.destroy();finish(failure('supplier_timeout'));},Math.max(1,deadline-Date.now()));signal?.addEventListener('abort',abort,{once:true});req.on('error',()=>finish(failure(signal?.aborted?'supplier_cancelled':'supplier_network')));req.end();
  });
  if(response.location){if(redirect===maxRedirects)throw failure('supplier_redirect_limit');current=supplierUrl(new URL(response.location,current).href,{supplier});continue;}return response;
 }throw failure('supplier_redirect_limit');
}
export function robotsPolicy(body){const groups=[];let agents=[],rules=[],seenRule=false;const sitemaps=[];let delay=0;const flush=()=>{if(agents.length)groups.push({agents,rules});agents=[];rules=[];seenRule=false;};for(const raw of String(body).split(/\r?\n/)){const line=raw.split('#')[0].trim(),split=line.indexOf(':');if(split<0)continue;const key=line.slice(0,split).trim().toLowerCase(),value=line.slice(split+1).trim();if(key==='sitemap'){sitemaps.push(value);continue;}if(key==='user-agent'){if(seenRule)flush();agents.push(value.toLowerCase());continue;}if(['allow','disallow'].includes(key)){seenRule=true;if(value)rules.push({allow:key==='allow',path:value});}if(key==='crawl-delay'&&agents.some(a=>a==='*'||a.includes('ricamo'))){const n=Number(value);if(Number.isFinite(n)&&n>0)delay=n;}}
 flush();const selected=groups.filter(g=>g.agents.some(a=>a.includes('ricamo'))),active=selected.length?selected:groups.filter(g=>g.agents.includes('*'));return{rules:active.flatMap(g=>g.rules),sitemaps,delay};}
export function robotsAllowed(url,policy){const value=new URL(url).pathname+new URL(url).search;let winner=null;for(const rule of policy.rules){const pattern=rule.path.split('*').map(part=>part.replace(/[.+?^{}()|[\]\\]/g,'\\$&')).join('.*');const exact=pattern.endsWith('$'),expression=new RegExp('^'+(exact?pattern.slice(0,-1)+'$':pattern));if(expression.test(value)&&(!winner||rule.path.length>winner.path.length||rule.path.length===winner.path.length&&rule.allow))winner=rule;}return winner?.allow??true;}
