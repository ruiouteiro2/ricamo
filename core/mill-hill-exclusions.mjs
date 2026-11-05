import exclusions from '../data/mill-hill-excluded-products.json' with {type:'json'};

const fold=value=>String(value??'').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g,'');
const names=new Set(exclusions.names.map(fold));
for(const alias of ['Pet Spider','Denali Santa','Paisley Pumpkin','Festive Fairy Cottage','Toucan'])names.add(fold(alias));
/** Explicit title matches only: Honey kits must never hide Honey-coloured beads. */
export function isExcludedMillHillProduct(product){
  if(fold(product?.brand)!=='millhill')return false;
  let title=String(product.colorName||product.name||'');
  const collection=/^(?:(?:season(?:al)?|charmed|chared)\s+ornament(?:\s+kit)?|ornaments?\s+kit|ornamenti\s+kit|(?:spring|autumn|autun|winter)\s+(?:series|season)|buttons\s+and\s+beads|laurel\s+burch|christmas\s+village|book\s+learning|(?:mittens|magi|angel)\s+trilogy|(?:timberline|tmberline|polar|medieval|tropical)\s+santas|spring\s+bouquet(?:\s+pins)?|decorazioni\s+i\s+volti\s+di\s+babbo\s+natale)\s*[:\-]?\s*/i;
  for(let i=0;i<3;i++)title=title.replace(collection,'');
  title=title.replace(/\s*[:\-]\s*(?:antique keys|main street|country lane|christmas village)\s*$/i,'');
  return names.has(fold(title));
}
