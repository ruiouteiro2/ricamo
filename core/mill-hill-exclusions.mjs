import exclusions from '../data/mill-hill-excluded-products.json' with {type:'json'};

const fold=value=>String(value??'').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g,'');
const names=new Set(exclusions.names.map(fold));
for(const alias of ['Pet Spider','Denali Santa','Paisley Pumpkin','Festive Fairy Cottage','Toucan'])names.add(fold(alias));
/** Explicit title matches only: Honey kits must never hide Honey-coloured beads. */
export function isExcludedMillHillProduct(product){
  if(fold(product?.brand)!=='millhill')return false;
  const title=String(product.colorName||product.name||'').replace(/^(?:(?:seasonal?|charmed)\s+ornament(?:\s+kit)?|ornaments?\s+kit|ornamenti\s+kit|(?:spring|autumn|winter)\s+(?:series|season)|buttons\s+and\s+beads|laurel\s+burch)\s*[:\-]?\s*/i,'');
  return names.has(fold(title));
}
