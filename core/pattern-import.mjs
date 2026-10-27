import {validateRevision} from './pattern.mjs';
/** Standalone schemes have no reviewed material-ID mapping. Detach all bindings;
 * estimation may resolve unique catalogue identities in the destination library. */
export function prepareStandalonePattern(revision){
  validateRevision(revision);const copy=structuredClone(revision);let detachedBindings=0;
  const detach=color=>{if(Object.hasOwn(color,'itemId')){if(color.itemId!==null&&color.itemId!=='')detachedBindings++;delete color.itemId;}if(color.attachmentThread){detach(color.attachmentThread);for(const row of [...(color.attachmentThread.blend?.components??[]),...(color.attachmentThread.blend?.backComponents??[])])detach(row);}};
  for(const color of copy.colors){detach(color);for(const component of color.blend?.components??[])detach(component);for(const component of color.blend?.backComponents??[])detach(component);}
  validateRevision(copy);return{revision:copy,detachedBindings};
}
