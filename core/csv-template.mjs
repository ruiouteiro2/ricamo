import { oneOf } from './shared.mjs';
import { csvText } from './csv.mjs';

/** Empty, importable templates: no example records can enter a real inventory. */
export function inventoryCsvTemplate(language='it') {
  oneOf(language,['it','en'],'language');
  const headers=language==='it'
    ? ['nome','categoria','marca','gamma','codice','unità','quantità','precisione','stato','posizione','lotto','confezione','filamenti','costo','valuta','note','__has_stock']
    : ['name','category','brand','range','code','unit','quantity','confidence','status','location','lotCode','packageSize','strands','cost','currency','notes','__has_stock'];
  return csvText(headers,[],language==='it'?';':',')+'\r\n';
}
