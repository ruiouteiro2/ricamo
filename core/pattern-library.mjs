import {normalizePatternSupplies} from './pattern-supplies.mjs';
import {assert,text,stringList} from './shared.mjs';
const limits={author:300,origin:2000,technique:150,theme:300,difficulty:300,rights:4000};
export function normalizePatternLibrary(value){
 assert(value&&typeof value==='object'&&!Array.isArray(value)&&value.version===1,'invalid_pattern_library');
 assert(Object.keys(value).every(key=>['version','collections','design',...Object.keys(limits)].includes(key)),'invalid_pattern_library');
 const result={version:1};for(const [key,max] of Object.entries(limits)){assert(value[key]===undefined||typeof value[key]==='string','invalid_pattern_library');result[key]=text(value[key],key,{max})}
 if(value.design!==undefined)result.design=normalizePatternSupplies(value.design);
 result.collections=stringList(value.collections??[],'collections',50);return result;
}
export function validatePatternLibrary(state){for(const pattern of state.patterns)if(pattern.library!==undefined)normalizePatternLibrary(pattern.library)}
export function portablePatternLibrary(library,includePrivate=false){if(library===undefined)return undefined;const value=normalizePatternLibrary(library);return {version:1,author:value.author,rights:value.rights,technique:value.technique,theme:value.theme,...(value.design?{design:value.design}:{}),...(includePrivate?{origin:value.origin,difficulty:value.difficulty,collections:value.collections}:{})}}
export function hasPrivatePatternLibrary(library){return Boolean(library&&(library.origin||library.difficulty||library.collections?.length))}
export function patternLibrarySearch(pattern){const library=pattern.library??{};return [pattern.name,pattern.notes,...(pattern.tags??[]),...Object.keys(limits).map(key=>library[key]),...(library.collections??[]),...Object.values(library.design?.fabric??{}),...(library.design?.requirements??[]).flatMap(row=>[row.brand,row.range,row.code,row.name])].filter(Boolean).join(' ')}
export function patternUsage(state,patternId){const rows=[];for(const project of state.projects){if(project.patternId===patternId)rows.push({projectId:project.id,name:project.name,status:project.status,revisionId:project.revisionId,current:true,savedAt:null});for(const entry of project.progressHistory??[])if(entry.patternId===patternId)rows.push({projectId:project.id,name:project.name,status:project.status,revisionId:entry.revisionId,current:false,savedAt:entry.savedAt})}return rows}
