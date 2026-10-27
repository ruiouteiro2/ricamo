import { purchaseUrl } from '../core/pattern-fabric.mjs';
/** Open a verified retailer URL only following an explicit user gesture. */
export async function openPurchaseLink(value) {
  const url=purchaseUrl(value);
  if(!url)throw Object.assign(new Error('purchase_link_invalid'),{code:'purchase_link_invalid'});
  if(window.ricamo?.openPurchaseLink){const result=await window.ricamo.openPurchaseLink(url);if(result?.error)throw Object.assign(new Error(result.error.message??result.error.code),result.error);return result?.value??result;}
  window.open(url,'_blank','noopener,noreferrer');return true;
}
