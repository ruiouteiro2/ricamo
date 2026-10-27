import {t} from './i18n';
import {integer} from '../core/shared.mjs';
export function sessionEvidenceFields(project,session) {
 if(!project.revisionId&&!session?.work)return [];
 return [{key:'measured',label:t('sessionMeasuredWork'),type:'checkbox',wide:true,help:t('sessionMeasuredHelp')},{key:'workKind',label:t('stitchKind'),type:'select',required:true,options:['full','half','backstitch'].map(value=>({value,label:()=>t(`workKind_${value}`)})),when:d=>d.measured},{key:'workCount',label:t('sessionStitchCount'),type:'number',required:true,when:d=>d.measured}];
}
export function sessionEvidenceInitial(session){return {measured:Boolean(session?.work),workKind:session?.work?.kind||'full',workCount:session?.work?.count??''};}
export function sessionEvidencePayload(draft,project,session){const{measured,workKind,workCount,...rest}=draft;return {...rest,work:measured?{kind:workKind,count:integer(workCount,'count',{min:1,max:10000000}),patternId:session?.work?.patternId??project.patternId,revisionId:session?.work?.revisionId??project.revisionId}:null};}
