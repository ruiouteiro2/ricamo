import {isBead} from '../core/pattern-materials.mjs';
import {purchaseUrl} from '../core/pattern-fabric.mjs';
import {retailerPurchaseLinks} from '../core/retailer-catalogue.mjs';
import { threadComponents } from '../core/thread-recipes.mjs';
import { pdfText } from './pdf-font.mjs';

/** Both print layouts use the same physical filament recipes as estimation. */
export function appendPatternLegend(doc, revision, { locale = 'it', totals, margin = 14, thread = {}, top = 20, bottomMargin = 20, monochrome = false, includePurchaseLinks=true } = {}) {
  const english = locale === 'en';
  const title = english ? 'Material legend' : 'Legenda dei materiali';
  const full = english ? 'Full / half' : 'Croce / mezzo punto';
  const back = english ? 'Backstitch' : 'Punto scritto';
  const configuration = { strands: revision.settings?.strands ?? 2, ...thread };
  const width = doc.internal.pageSize.getWidth() - margin * 2 - 16;
  const bottom = doc.internal.pageSize.getHeight() - bottomMargin;
  let y = bottom + 1;
  const newPage = () => {
    if (doc.getNumberOfPages() >= 500) throw Object.assign(new Error('pdf_export_limit'), { code: 'pdf_export_limit' });
    doc.addPage(); doc.setFontSize(16); doc.text(title, margin, top); y = top + 14;
  };
  const identity = color => [color.brand, color.range, color.code, color.name].filter(Boolean).join(' ');
  for (const [index, color] of revision.colors.entries()) {
    const recipe = type => threadComponents(color, type, configuration, index)
      .map(component => `${component.strands} × ${identity(component)}`).join(' + ');
    const count = totals?.byColor[index];
    const rows = [identity(color)];
    if(color.product?.colorVariation==='multicolour')rows.push(english?'Multicolour thread: the digital swatch is an indicative average.':'Filo multicolore: il campione digitale è una media indicativa.');
    if(isBead(color)){rows.push(`${english?'Beads / embellishments':'Perline / decorazioni'}: ${count?.bead??0}`);rows.push(color.attachmentThread?`${english?'Attachment thread':'Filo di fissaggio'}: ${color.attachmentThread.strands} × ${identity(color.attachmentThread)}`:(english?'Attachment thread not selected':'Filo di fissaggio da scegliere'));}
    else if (count) rows.push(`${english ? 'Full / half / back' : 'Croce / mezzo / scritto'}: ${count.full} / ${count.half} / ${count.backstitch}`);
    if (!isBead(color)&&color.blend) rows.push(`${full}: ${recipe('full')}`, `${back}: ${recipe('back')}`);
    else if(!isBead(color))rows.push(`${full}: ${threadComponents(color, 'full', configuration, index)[0].strands} · ${back}: ${threadComponents(color, 'back', configuration, index)[0].strands} ${english ? 'threads' : 'fili'}`);
    if (y + 18 > bottom) newPage();
    doc.setFillColor(monochrome?'#ffffff':color.hex);doc.setDrawColor('#333333');if(isBead(color))doc.circle(margin+2.5,y-.5,2.5,'FD');else doc.rect(margin,y-3,5,5,monochrome?'FD':'F');
    doc.setFontSize(9); doc.text(pdfText(doc, color.symbol ?? String(index + 1)), margin + 7, y);
    for (const row of rows) {
      doc.setFontSize(9);
      for (const line of doc.splitTextToSize(pdfText(doc, row), width)) {
        if (y > bottom) { newPage(); doc.setFontSize(9); }
        doc.text(line, margin + 16, y); y += 4.5;
      }
    }
    const components=isBead(color)?[color,...(color.attachmentThread?[color.attachmentThread]:[])]:[...threadComponents(color,'full',configuration,index),...threadComponents(color,'back',configuration,index)];
    const products=includePurchaseLinks?[...new Map(components.flatMap(component=>[...(component.product?[component.product]:[]),...retailerPurchaseLinks(component)]).map(product=>[product.url,product])).values()]:[];
    for(const product of products){const url=purchaseUrl(product.url);if(y>bottom)newPage();doc.setFontSize(8);const supplier=new URL(url).hostname.includes('tessiland')?'Tessiland':'Casa Cenina';for(const line of doc.splitTextToSize(pdfText(doc,`${english?'Buy':'Acquista'}: ${supplier} · ${product.brand} ${product.code}`),width)){if(y>bottom)newPage();doc.textWithLink(line,margin+16,y,{url});y+=4.5;}}
    y += 5;
  }
}
