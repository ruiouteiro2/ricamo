import {purchaseUrl} from '../core/pattern-fabric.mjs';
import {pdfText} from './pdf-font.mjs';

/** Print the same stock-read-only snapshot that the user reviewed in the editor. */
export function appendProcurementPages(doc,preview,{locale='it',margin=14}={}){
 if(!preview)return;
 const en=locale==='en',width=doc.internal.pageSize.getWidth()-margin*2,bottom=doc.internal.pageSize.getHeight()-margin-10;
 const title=en?'Materials and quantities':'Materiali e quantità';
 const units=en?{'strand-m':'m of individual strand',piece:'pieces',skein:'skeins',spool:'spools',pack:'packs',ball:'balls',cone:'cones'}:{'strand-m':'m di singolo filo',piece:'pezzi',skein:'matasse',spool:'rocchetti',pack:'confezioni',ball:'gomitoli',cone:'rocche'};
 const unit=value=>units[value]??value;
 const number=value=>value===null||value===undefined?(en?'unknown':'da verificare'):new Intl.NumberFormat(en?'en-GB':'it-IT',{maximumFractionDigits:3}).format(value);
 let y=bottom+1;
 function page(){if(doc.getNumberOfPages()>=500)throw Object.assign(Error('pdf_export_limit'),{code:'pdf_export_limit'});doc.addPage();doc.setFontSize(15);doc.setTextColor('#252525');doc.text(title,margin,margin+6);y=margin+15;}
 function line(value,{url,size=9}={}){doc.setFontSize(size);const lines=doc.splitTextToSize(pdfText(doc,value),width);for(const text of lines){if(y>bottom)page();doc.setFontSize(size);if(url)doc.textWithLink(text,margin,y,{url:purchaseUrl(url)});else doc.text(text,margin,y);y+=4.5;}}
 page();
 line(en?'Thread quantities are geometric estimates, including the selected travel, start/finish and waste allowances. Beads are counted individually.':'Le quantità di filo sono stime geometriche con i margini scelti per passaggi, avvio, chiusura e scarto. Le perline sono contate singolarmente.',{size:8});
 line(en?'Inventory is a snapshot at export. Progress does not consume stock.':'Le scorte corrispondono al momento dell’esportazione. Il progresso non consuma materiale.',{size:8});y+=3;
 if(preview.fabric){const cloth=preview.fabric,config=cloth.configuration,size=cloth.size;
  line(`${en?'Fabric':'Tessuto'}: ${[config.brand,config.range,config.colorName,config.code].filter(Boolean).join(' ')}`);
  if(size)line(`${en?'Embroidery':'Ricamo'}: ${number(size.widthCm)} × ${number(size.heightCm)} cm · ${en?'Cut including margins':'Taglio con margini'}: ${number(size.cutWidthCm)} × ${number(size.cutHeightCm)} cm`);
  if(cloth.url)line(en?'Buy selected fabric':'Acquista il tessuto scelto',{url:cloth.url});
  if(cloth.lot)line(`${en?'Selected inventory piece':'Pezzo scelto in inventario'}: ${cloth.lot.lotCode||cloth.lot.id}`);
  y+=4;
 }
 for(const row of preview.rows){
  if(y+20>bottom)page();
  line([row.color.brand,row.color.range,row.color.code,row.color.name].filter(Boolean).join(' · '));
  line(`${en?'Required':'Fabbisogno'}: ${number(row.required)} ${unit(row.unit)} · ${en?'Available for this project':'Disponibile per questo progetto'}: ${number(row.stock.available)} ${unit(row.unit)} · ${en?'Missing':'Mancano'}: ${number(row.shortage)} ${unit(row.unit)}`,{size:8});
  if(row.stock.ownReserved)line(`${en?'Already reserved for this project':'Già riservato per questo progetto'}: ${number(row.stock.ownReserved)} ${unit(row.unit)}`,{size:8});
  if(row.stock.status==='untracked')line(en?'This material is not yet recorded in inventory.':'Questo materiale non è ancora registrato nell’inventario.',{size:8});
  for(const offer of row.offers){const product=offer.product,supplier=product.supplier==='tessiland'?'Tessiland':'Casa Cenina';line(`${supplier} · ${en?'Total':'Totale'}: ${number(offer.packagesRequired)} ${unit(product.pack.unit??'pack')} · ${en?'To buy':'Da acquistare'}: ${number(offer.packagesMissing)} ${unit(product.pack.unit??'pack')}`,{url:product.url,size:8});}
  if(!row.offers.length)line(en?'No verified purchase link for this material.':'Nessun collegamento di acquisto verificato per questo materiale.',{size:8});
  y+=3;
 }
 const warnings={procurement_fastening_unknown:en?'Bead attachment thread has not been selected; requirements are incomplete.':'Filo di fissaggio delle perline da scegliere; fabbisogno incompleto.',procurement_unit_conflict:en?'Declared quantities use incompatible units; check them before purchasing.':'Le quantità dichiarate usano unità non compatibili: controllale prima dell’acquisto.',procurement_suitability_unknown:en?'Check yarn thickness and embroidery suitability before purchasing; quantities need verification.':'Verifica spessore e idoneità del filato al ricamo prima dell’acquisto; controlla le quantità.'};
 for(const warning of preview.warnings??[])if(warnings[warning.code])line(`${warning.codeName??''}: ${warnings[warning.code]}`);
}
