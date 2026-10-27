import {SupplierCatalogues} from './supplier-catalogues.mjs';
import {curlSupplierPage} from './supplier-curl.mjs';
import {writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
/** Explicit CLI runner. Cache is separate from personal Ricamo databases. */
export async function runPublicScan({database,suppliers=['casa-cenina','tessiland'],maxPages=5000,report,intervalMs=1000,captureDir}={}){
 if(!database)throw new Error('supplier_cache_path_required');if(captureDir)await mkdir(captureDir,{recursive:true});let capturedBytes=0;const transport=async(...args)=>{const response=await curlSupplierPage(...args);if(captureDir&&response.status===200&&capturedBytes<512*1024*1024){const key=createHash('sha256').update(args[0]).digest('hex'),compressed=gzipSync(response.body);capturedBytes+=compressed.length;await writeFile(join(captureDir,key+'.body.gz'),compressed);await writeFile(join(captureDir,key+'.json'),JSON.stringify({url:args[0],finalUrl:response.url,status:response.status,bytes:response.bytes,retrievedAt:new Date().toISOString()}));}return response;};const service=new SupplierCatalogues(resolve(database),{transport,intervalMs});
 const stop=()=>{for(const supplier of suppliers)service.cancel({supplier});};process.once('SIGINT',stop);process.once('SIGTERM',stop);
 try{for(const supplier of suppliers)service.start({supplier,resume:true,maxPages});await Promise.allSettled([...service.jobs.values()].map(job=>job.promise));const result={retrievedAt:new Date().toISOString(),transport:'curl-public-https',status:service.status()};if(report)await writeFile(report,JSON.stringify(result,null,2)+'\n');return result;}finally{process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);await service.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const args=process.argv.slice(2),value=flag=>args[args.indexOf(flag)+1];if(!args.includes('--database'))throw new Error('Usage: node desktop/supplier-scan.mjs --database PATH --report PATH [--supplier casa-cenina|tessiland] [--max-pages N]');const result=await runPublicScan({database:value('--database'),captureDir:args.includes('--capture-dir')?value('--capture-dir'):undefined,report:args.includes('--report')?value('--report'):undefined,suppliers:args.includes('--supplier')?[value('--supplier')]:undefined,maxPages:args.includes('--max-pages')?Number(value('--max-pages')):5000});console.log(JSON.stringify(result));}
