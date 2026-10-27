import { APP_VERSION } from './version.mjs';
import { validateApplicationState } from './application.mjs';
import { oneOf } from './shared.mjs';

const collections=['materials','lots','movements','reservations','patterns','projects','needs','tasks','sessions','purchases','receipts','locations','suppliers','attachments'];
/** Whitelist counts and validation outcome; never copy user records or paths. */
export function createDiagnostics(state,{storage='sqlite',createdAt=new Date().toISOString()}={}) {
  oneOf(storage,['sqlite','indexeddb'],'storage');
  let valid=true;try{validateApplicationState(state)}catch{valid=false}
  return {format:'ricamo-diagnostics',version:1,applicationVersion:APP_VERSION,createdAt,schemaVersion:Number.isInteger(state?.schemaVersion)?state.schemaVersion:null,revision:Number.isInteger(state?.revision)?state.revision:null,storage,validation:valid?'passed':'failed',counts:Object.fromEntries(collections.map(key=>[key,Array.isArray(state?.[key])?state[key].length:0])),containsRecords:false,containsFiles:false,containsPaths:false};
}
