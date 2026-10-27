import { quantity, date, stableStringify, oneOf } from './shared.mjs';
import { setDescriptor, validateDescriptorProperties, MATERIAL_DESCRIPTORS, LOT_DESCRIPTORS } from './material-descriptors.mjs';

const normalized = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/[ _-]/g, '');
const aliases = {
  name: ['name','nome','materiale','material','articolo'], category: ['category','categoria'], brand: ['brand','marca'], range: ['range','gamma'], code: ['code','codice','reference','riferimento'],
  quantity: ['quantity','quantita','qty','stock'], unit: ['unit','unita'], location: ['location','posizione','ubicazione'], lotCode: ['lotcode','lotto','dyelot','lot'],
  confidence: ['confidence','precisione'], status: ['status','stato'], notes: ['notes','note'], color: ['color','colour','colore','hex'], minimum: ['minimum','minimo'],
  packageSize: ['packagesize','confezione'], strands: ['strands','filamenti'], currency: ['currency','valuta'], cost: ['cost','costo'], tags: ['tags','etichette'],
};
const descriptorColumns = [
  ['descriptor_author','author','material',['author','autore','autor']],
  ['descriptor_publisher','publisher','material',['publisher','editore','editora']],
  ['descriptor_isbn','isbn','material',['isbn']],
  ['descriptor_pageCount','pageCount','material',['pagecount','pages','pagine','paginas']],
  ['descriptor_relevantPages','relevantPages','material',['relevantpages','pagineutili']],
  ['descriptor_techniques','techniques','material',['techniques','tecniche']],
  ['descriptor_toolType','toolType','material',['tooltype','tipostrumento']],
  ['descriptor_toolSize','toolSize','material',['toolsize','needleSize','misurastrumento'].map(normalized)],
  ['descriptor_catalogueStatus','catalogueStatus','material',['cataloguestatus','statocatalogo']],
  ['descriptor_packageCondition','packageCondition','lot',['packagecondition','statoconfezione']],
];
const exportedDescriptorColumns=[...descriptorColumns];
const extraAliases={variant:['variante'],replacementSuggestion:['sostituzioneconsigliata'],replacementSource:['fontesostituzione'],packagingType:['tipoconfezione'],sizeSystem:['sistemaspessore'],colourEffect:['effettocolore'],texture:['trama'],treatment:['trattamento'],usableArea:['areautile'],size:['dimensione'],shape:['forma'],finish:['finitura'],removalMethod:['metodorimozione'],edition:['edizione'],washingState:['lavaggio'],expiryDate:['scadenza'],personalReference:['riferimentopersonale']};
for(const[scope,fields]of [['material',MATERIAL_DESCRIPTORS],['lot',LOT_DESCRIPTORS]])for(const field of fields)if(!descriptorColumns.some(([,key])=>key===field.key))descriptorColumns.push([`descriptor_${field.key}`,field.key,scope,[normalized(field.key),...(extraAliases[field.key]||[])]]);
Object.assign(aliases, { description:['description','descrizione'],divisible:['divisible','divisibile'],reusable:['reusable','riutilizzabile'],favorite:['favorite','favourite','preferito'],composition:['composition','composizione'],materialProperties:['materialproperties','properties','proprieta'],lotProperties:['lotproperties','proprietalotto'],lotNotes:['lotnotes','notelotto'],acquiredAt:['acquiredat','dataacquisto'] });
for(const[key,,,names]of descriptorColumns)aliases[key]=[normalized(key),...names];
export const CSV_FIELDS = Object.keys(aliases);
export const CSV_PRIMARY_FIELDS = CSV_FIELDS.filter(key=>!key.startsWith('descriptor_')&&!['materialProperties','lotProperties','description','divisible','reusable','favorite','composition','lotNotes','acquiredAt'].includes(key));
export function inventoryCsvIdentity(material) { return stableStringify([normalized(material.brand),normalized(material.range),material.code?'code':'name',material.code||normalized(material.name)]); }
function propertiesFromCsv(read,field,scope,issues) {
  const raw=read(field);if(!raw)return{};
  try{const properties=JSON.parse(raw);validateDescriptorProperties(properties,scope);return properties}catch{issues.push(field);return{}}
}
function descriptiveColumns(read,mapping,material,lot,issues){
  const boolean=key=>{const value=read(key).toLowerCase();if(!value)return false;if(['1','true','yes','si','sì'].includes(value))return true;if(['0','false','no'].includes(value))return false;issues.push(key);return false};
  material.description=read('description');for(const key of ['divisible','reusable','favorite'])material[key]=boolean(key);
  material.properties=propertiesFromCsv(read,'materialProperties','material',issues);
  const lotProperties=propertiesFromCsv(read,'lotProperties','lot',issues);
  if(mapping.composition>=0&&(read('composition')||Object.hasOwn(material.properties,'composition')))material.properties.composition=read('composition');
  for(const[key,property,scope]of descriptorColumns){if(!(mapping[key]>=0))continue;const properties=scope==='lot'?lotProperties:material.properties;let value=read(key);if(!value&&!Object.hasOwn(properties.details||{},property))continue;
    if(property==='pageCount'){try{value=value===''?null:quantity(value);if(value!==null&&!Number.isInteger(value))throw new Error()}catch{issues.push(key);continue}}
    try{setDescriptor(properties,property,value,scope);validateDescriptorProperties(properties,scope)}catch{issues.push(key)}
  }
  if(lot){lot.properties=lotProperties;lot.notes=read('lotNotes');try{lot.acquiredAt=date(read('acquiredAt'))}catch{issues.push('acquiredAt')}}
  else if(Object.keys(lotProperties).length)issues.push('csvLotPropertiesWithoutStock');
  for(const[properties,scope,field]of [[material.properties,'material','materialProperties'],[lotProperties,'lot','lotProperties']])try{validateDescriptorProperties(properties,scope)}catch{issues.push(field)}
}

export function detectDelimiter(text) {
  const scores = [',',';','\t'].map(delimiter => {
    try { const rows = parseCsv(text.slice(0, 20000), delimiter); const sample = rows.slice(0, 10); return { delimiter, score: sample.length ? sample.reduce((sum,row)=>sum+row.length,0)/sample.length : 0 }; }
    catch { return { delimiter, score: 0 }; }
  });
  return scores.sort((a,b)=>b.score-a.score)[0].delimiter;
}
export function parseCsv(text, delimiter = detectDelimiter(text)) {
  if (typeof text !== 'string' || text.length > 10 * 1024 * 1024 || ![',',';','\t'].includes(delimiter)) throw Object.assign(new Error('invalid_csv'), { code: 'invalid_csv' });
  text = text.replace(/^\uFEFF/, '');
  const rows = []; let row = [], field = '', quoted = false, afterQuote = false;
  for (let i=0;i<text.length;i++) {
    const char=text[i];
    if (quoted) {
      if(char==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;afterQuote=true;}}
      else field+=char;
    } else if (char==='"' && field==='') quoted=true;
    else if (char===delimiter){row.push(field);field='';afterQuote=false;}
    else if (char==='\n'||char==='\r') {if(char==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(value=>value!==''))rows.push(row);row=[];field='';afterQuote=false;}
    else {if(afterQuote && !/\s/.test(char))throw Object.assign(new Error('invalid_csv_quote'),{code:'invalid_csv'});field+=char;}
    if(rows.length>5001||field.length>100000)throw Object.assign(new Error('csv_too_large'),{code:'file_too_large'});
  }
  if(quoted)throw Object.assign(new Error('invalid_csv_quote'),{code:'invalid_csv'});
  if(field!==''||row.length){row.push(field);rows.push(row);}
  return rows;
}
export function guessMapping(headers) {
  return Object.fromEntries(CSV_FIELDS.map(field => [field, headers.findIndex(header=>aliases[field].includes(normalized(header)))]));
}
export function previewInventory(rows, mapping, state, { decimal = ',', skipDuplicates = true } = {}) {
  const headers=rows[0]||[], escapedIndex=headers.indexOf('__ricamo_escape'), stockIndex=headers.indexOf('__has_stock');
  const seen=new Map(), identities=new Map();for(const material of state.materials){const key=inventoryCsvIdentity(material);if(!identities.has(key))identities.set(key,material)}
  return rows.slice(1).map((cells,index)=>{
    const issues=[];
    const read=field=>{let value=String(cells[mapping[field]]??'');if(escapedIndex>=0&&cells[escapedIndex]==='apostrophe-v1'&&value.startsWith("'"))value=value.slice(1);return value.trim();};
    const parse=field=>{const value=read(field);if(!value)return null;try{if(decimal===','&&value.includes('.')||decimal==='.'&&value.includes(','))throw new Error();return quantity(value);}catch{issues.push(field);return null;}};
    const material={name:read('name'),category:read('category')||'other',brand:read('brand'),range:read('range'),code:read('code'),unit:read('unit')||'piece',notes:read('notes'),color:read('color'),minimum:parse('minimum'),packageSize:parse('packageSize'),strands:parse('strands'),tags:read('tags').split('|').map(v=>v.trim()).filter(Boolean)};
    if(!material.name)issues.push('name');
    if(!['m','cm','mm','g','kg','piece','skein','spool','pack','m2','strand-m','custom'].includes(material.unit))issues.push('unit');
    if(material.color&&!/^#[a-f0-9]{6}$/i.test(material.color))issues.push('color');
    if(material.strands!==null&&(!Number.isInteger(material.strands)||material.strands<1||material.strands>1000))issues.push('strands');
    const identity=inventoryCsvIdentity(material);
    const existing=identities.get(identity);
    const duplicate=Boolean(existing||seen.has(identity));
    const amount=parse('quantity');
    const location=state.locations.find(row=>normalized(row.name)===normalized(read('location')));
    const stockPresent=stockIndex>=0?cells[stockIndex]==='1':mapping.quantity>=0;
    const cost=parse('cost');
    const lot=stockPresent?{quantity:amount,confidence:amount===null?'unknown':(['exact','estimated'].includes(read('confidence'))?read('confidence'):'estimated'),status:['usable','blocked','damaged','unverified'].includes(read('status'))?read('status'):'usable',lotCode:read('lotCode'),locationId:location?.id||null,cost:cost===null?null:Math.round(cost*100),currency:read('currency')||state.settings.currency}:null;
    descriptiveColumns(read,mapping,material,lot,issues);
    const signature=stableStringify(material);if(seen.has(identity)&&seen.get(identity)!==signature)issues.push('csvMetadataConflict');else seen.set(identity,signature);
    if(read('currency')&&!/^[A-Z]{3}$/.test(read('currency')))issues.push('currency');
    if(existing&&existing.unit!==material.unit)issues.push('unit');
    if(cells.length!==headers.length)issues.push('columns');
    return {line:index+2,material,lot,materialId:existing?.id,duplicate,skip:duplicate&&skipDuplicates,issues:[...new Set(issues)],locationText:read('location'),unknownLocation:read('location')&&!location,metadataPreserved:Boolean(existing)};
  });
}

export function csvText(headers, rows, delimiter = ';') {
  const encode=value=>{let string=value==null?'':String(value);if(/^[=+\-@\t\r']/.test(string))string="'"+string;return '"'+string.replaceAll('"','""')+'"';};
  return '\uFEFF'+[headers,...rows].map(row=>row.map(encode).join(delimiter)).join('\r\n');
}
export function exportInventory(state, language='it', delimiter = language === 'it' ? ';' : ',') {
  oneOf(delimiter, [';',',','\t'], 'delimiter');
  const extraHeaders=['description','divisible','reusable','favorite','composition','materialProperties','lotProperties','lotNotes','acquiredAt',...exportedDescriptorColumns.map(([key])=>key)];
  const headers=['name','category','brand','range','code','unit','quantity','confidence','status','location','lotCode','notes','color','minimum','packageSize','strands','cost','currency','tags','__has_stock','__ricamo_escape',...extraHeaders];
  const decimal=value=>value==null?'':String(value).replace('.',language==='it'?',':'.');
  const rows=[],holdings=new Map();for(const lot of state.lots){if(!holdings.has(lot.materialId))holdings.set(lot.materialId,[]);holdings.get(lot.materialId).push(lot)}
  for(const material of state.materials){
    const lots=holdings.get(material.id)||[];
    for(const lot of lots.length?lots:[null])rows.push([material.name,material.category,material.brand,material.range,material.code,material.unit,decimal(lot?.quantity),lot?.confidence||'',lot?.status||'',state.locations.find(row=>row.id===lot?.locationId)?.name||'',lot?.lotCode||'',material.notes,material.color,decimal(material.minimum),decimal(material.packageSize),decimal(material.strands),lot?.cost==null?'':decimal(lot.cost/100),lot?.currency||state.settings.currency,material.tags.join('|'),lot?'1':'0','apostrophe-v1',material.description,material.divisible,material.reusable,material.favorite,material.properties?.composition,JSON.stringify(material.properties||{}),lot?JSON.stringify(lot.properties||{}):'',lot?.notes||'',lot?.acquiredAt||'',...exportedDescriptorColumns.map(([,key,scope])=>(scope==='lot'?lot?.properties:material.properties)?.details?.[key]??'')]);
  }
  return csvText(headers,rows,delimiter);
}
