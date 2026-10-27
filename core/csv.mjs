import { quantity } from './shared.mjs';

const normalized = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/[ _-]/g, '');
const aliases = {
  name: ['name','nome','materiale','material','articolo'], category: ['category','categoria'], brand: ['brand','marca'], range: ['range','gamma'], code: ['code','codice','reference','riferimento'],
  quantity: ['quantity','quantita','qty','stock'], unit: ['unit','unita'], location: ['location','posizione','ubicazione'], lotCode: ['lotcode','lotto','dyelot','lot'],
  confidence: ['confidence','precisione'], status: ['status','stato'], notes: ['notes','note'], color: ['color','colour','colore','hex'], minimum: ['minimum','minimo'],
  packageSize: ['packagesize','confezione'], strands: ['strands','filamenti'], currency: ['currency','valuta'], cost: ['cost','costo'], tags: ['tags','etichette'],
};
export const CSV_FIELDS = Object.keys(aliases);
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
  const seen=new Map();
  return rows.slice(1).map((cells,index)=>{
    const issues=[];
    const read=field=>{let value=String(cells[mapping[field]]??'');if(escapedIndex>=0&&cells[escapedIndex]==='apostrophe-v1'&&value.startsWith("'"))value=value.slice(1);return value.trim();};
    const parse=field=>{const value=read(field);if(!value)return null;try{if(decimal===','&&value.includes('.')||decimal==='.'&&value.includes(','))throw new Error();return quantity(value);}catch{issues.push(field);return null;}};
    const material={name:read('name'),category:read('category')||'other',brand:read('brand'),range:read('range'),code:read('code'),unit:read('unit')||'piece',notes:read('notes'),color:read('color'),minimum:parse('minimum'),packageSize:parse('packageSize'),strands:parse('strands'),tags:read('tags').split('|').map(v=>v.trim()).filter(Boolean)};
    if(!material.name)issues.push('name');
    if(!['m','cm','mm','g','kg','piece','skein','spool','pack','m2','strand-m','custom'].includes(material.unit))issues.push('unit');
    if(material.color&&!/^#[a-f0-9]{6}$/i.test(material.color))issues.push('color');
    if(material.strands!==null&&(!Number.isInteger(material.strands)||material.strands<1||material.strands>1000))issues.push('strands');
    const identity=[material.brand,material.range,material.code||material.name].map(normalized).join('|');
    const existing=state.materials.find(row=>normalized(row.brand)===normalized(material.brand)&&normalized(row.range)===normalized(material.range)&&(material.code?row.code===material.code:normalized(row.name)===normalized(material.name)));
    const duplicate=Boolean(existing||seen.has(identity));seen.set(identity,true);
    const amount=parse('quantity');
    const location=state.locations.find(row=>normalized(row.name)===normalized(read('location')));
    const stockPresent=stockIndex>=0?cells[stockIndex]==='1':mapping.quantity>=0;
    const cost=parse('cost');
    const lot=stockPresent?{quantity:amount,confidence:amount===null?'unknown':(['exact','estimated'].includes(read('confidence'))?read('confidence'):'estimated'),status:['usable','blocked','damaged','unverified'].includes(read('status'))?read('status'):'usable',lotCode:read('lotCode'),locationId:location?.id||null,cost:cost===null?null:Math.round(cost*100),currency:read('currency')||state.settings.currency}:null;
    if(read('currency')&&!/^[A-Z]{3}$/.test(read('currency')))issues.push('currency');
    if(existing&&existing.unit!==material.unit)issues.push('unit');
    if(cells.length!==headers.length)issues.push('columns');
    return {line:index+2,material,lot,materialId:existing?.id,duplicate,skip:duplicate&&skipDuplicates,issues:[...new Set(issues)],locationText:read('location'),unknownLocation:read('location')&&!location};
  });
}

export function csvText(headers, rows, delimiter = ';') {
  const encode=value=>{let string=value==null?'':String(value);if(/^[=+\-@\t\r']/.test(string))string="'"+string;return '"'+string.replaceAll('"','""')+'"';};
  return '\uFEFF'+[headers,...rows].map(row=>row.map(encode).join(delimiter)).join('\r\n');
}
export function exportInventory(state, language='it') {
  const headers=['name','category','brand','range','code','unit','quantity','confidence','status','location','lotCode','notes','color','minimum','packageSize','strands','cost','currency','tags','__has_stock','__ricamo_escape'];
  const decimal=value=>value==null?'':String(value).replace('.',language==='it'?',':'.');
  const rows=[];
  for(const material of state.materials){
    const lots=state.lots.filter(row=>row.materialId===material.id);
    for(const lot of lots.length?lots:[null])rows.push([material.name,material.category,material.brand,material.range,material.code,material.unit,decimal(lot?.quantity),lot?.confidence||'',lot?.status||'',state.locations.find(row=>row.id===lot?.locationId)?.name||'',lot?.lotCode||'',material.notes,material.color,decimal(material.minimum),decimal(material.packageSize),decimal(material.strands),lot?.cost==null?'':decimal(lot.cost/100),lot?.currency||state.settings.currency,material.tags.join('|'),lot?'1':'0','apostrophe-v1']);
  }
  return csvText(headers,rows,language==='it'?';':',');
}
