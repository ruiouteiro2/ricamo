import { assert,identifier } from '../core/shared.mjs';
import { FILE_LIMIT,detectFile,digestBytes,safeDisplayName } from '../core/files.mjs';
export const REFERENCE_COUNT=20,REFERENCE_BYTES=100*1024*1024;
const fields=['id','operationId','filename','size','name','digest','status','error','duplicate','decision','attempted'];
const errorCode=error=>String(error?.code||error?.message||'reference_import_failed').slice(0,300);
export function referenceReport(rows){return JSON.stringify({version:1,rows:rows.map(row=>Object.fromEntries(fields.map(key=>[key,row[key]])))});}
export function restoreReferenceReport(raw,state){
 if(!raw)return [];assert(typeof raw==='string'&&raw.length<=64000,'reference_report_invalid');const value=JSON.parse(raw);
 assert(value.version===1&&Array.isArray(value.rows)&&value.rows.length<=REFERENCE_COUNT,'reference_report_invalid');
 const seen=new Set();let total=0;
 return value.rows.map(source=>{const row=Object.fromEntries(fields.map(key=>[key,source[key]]));identifier(row.id);identifier(row.operationId);assert(!seen.has(row.id),'reference_report_invalid');seen.add(row.id);
  assert(typeof row.filename==='string'&&row.filename.length<=200&&typeof row.name==='string'&&row.name.length<=300&&Number.isSafeInteger(row.size)&&row.size>=0,'reference_report_invalid');total+=row.size;assert(total<=REFERENCE_BYTES,'reference_report_invalid');assert(['pending','saving','saved','failed','skipped'].includes(row.status)&&['','create','skip'].includes(row.decision)&&typeof row.duplicate==='boolean'&&typeof row.attempted==='boolean','reference_report_invalid');assert(row.digest===null||/^[0-9a-f]{64}$/.test(row.digest),'reference_report_invalid');assert(typeof row.error==='string'&&row.error.length<=300,'reference_report_invalid');
  const pattern=state.patterns.find(pattern=>pattern.id===row.id),asset=state.attachments.find(asset=>asset.id===pattern?.sourceAttachmentId);
  if(pattern?.kind==='reference'&&asset?.digest===row.digest)row.status='saved';else if(row.status==='saved'||row.status==='saving'){row.status='failed';row.error='reference_result_unconfirmed';}
  if(row.status!=='saved'&&!row.duplicate&&state.attachments.some(asset=>asset.digest===row.digest)){row.duplicate=true;row.decision='';}
  return {...row,file:null};
 });
}
async function capture(file){
 const name=safeDisplayName(file.name);if(file.size>FILE_LIMIT)return {filename:name,size:file.size,file:null,digest:null,error:'file_too_large'};
 try{const bytes=new Uint8Array(await file.arrayBuffer());assert(bytes.length===file.size,'invalid_file_data');const digest=await digestBytes(bytes);let error='';try{detectFile(bytes);}catch(caught){error=errorCode(caught);}return {filename:name,size:bytes.length,file:new File([bytes],name),digest,error};}
 catch(error){return {filename:name,size:file.size,file:null,digest:null,error:errorCode(error)};}
}
export async function prepareReferenceBatch(files,state,id=()=>crypto.randomUUID()){
 files=Array.from(files);assert(files.length>0&&files.length<=REFERENCE_COUNT&&files.reduce((sum,file)=>sum+file.size,0)<=REFERENCE_BYTES,'asset_batch_limit');
 const digests=new Set(state.attachments.map(row=>row.digest)),rows=[];
 for(const file of files){const captured=await capture(file),duplicate=Boolean(captured.digest&&digests.has(captured.digest));if(captured.digest)digests.add(captured.digest);rows.push({...captured,id:id(),operationId:id(),name:captured.filename.replace(/\.[^.]+$/,'')||captured.filename,status:captured.error?'failed':'pending',duplicate,decision:duplicate?'':'create',attempted:false});}
 return rows;
}
export async function reselectReferenceFiles(rows,files){
 files=Array.from(files);assert(files.length<=REFERENCE_COUNT&&files.reduce((sum,file)=>sum+file.size,0)<=REFERENCE_BYTES,'asset_batch_limit');let matched=0;
 for(const file of files){const captured=await capture(file),matches=rows.filter(row=>row.status!=='saved'&&row.status!=='skipped'&&row.filename===captured.filename&&row.size===captured.size&&row.digest===captured.digest);for(const row of matches){row.file=captured.file;matched++;}}
 assert(matched>0,'reference_reselect_mismatch');return matched;
}
/** One already-proven asset+reference transaction at a time. A stop never interrupts a transaction. */
export async function runReferenceBatch(rows,{mode='pending',importOne,persist,changed=()=>{},stopped=()=>false,yieldBetween=()=>new Promise(resolve=>setTimeout(resolve,0))}){
 for(const row of rows){
  if(stopped())break;if(row.status!==(mode==='failed'?'failed':'pending'))continue;
  if(row.duplicate&&!row.decision)continue;
  if(row.decision==='skip'){row.status='skipped';persist(rows);changed();continue;}
  if(!row.file){row.status='failed';row.error='reference_reselect_needed';persist(rows);changed();continue;}
  assert(row.name.trim(),'required');row.name=row.name.trim();row.attempted=true;row.status='saving';row.error='';try{persist(rows);}catch(error){row.status='failed';row.error='reference_report_write_failed';changed();throw error;}changed();
  try{const result=await importOne(row.file,{id:row.id,name:row.name,kind:'reference'},row.operationId);assert(result.patternId===row.id,'reference_result_unconfirmed');row.status='saved';}
  catch(error){row.status='failed';row.error=errorCode(error);}
  persist(rows);changed();await yieldBetween();
 }
}
