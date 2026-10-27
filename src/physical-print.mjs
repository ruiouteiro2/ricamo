import {jsPDF} from 'jspdf';
import {assert,quantity} from '../core/shared.mjs';
import {fabricSize} from '../core/fabric.mjs';
import {counts,validateRevision} from '../core/pattern.mjs';
import {pageTiles} from './pattern-export.mjs';
import {drawPattern} from './pattern-render.mjs';
import {appendPatternLegend} from './pattern-legend.mjs';
import {embedPdfFont,pdfText} from './pdf-font.mjs';
const words={en:{title:'Print calibration',help:'Print at 100% / Actual size. Disable Fit to page. Measure both axes after printing. This PDF defines geometry; it cannot calibrate your printer.',square:'100 × 100 mm square',ruler:'100 mm ruler',inch:'1 inch = 25.4 mm',physical:'Actual-size transfer pattern',count:'Effective stitches per inch (X / Y)',size:'Declared design dimensions (mm)',source:'Source stitches counted once',overlap:'Repeated overlap: align grid corners and trim the repeated strip. Repeated stitches are not additional work.',page:'Tile',cells:'Cells',revision:'Revision',legend:'Pinned palette legend',full:'Full crosses',half:'Half stitches',back:'Backstitch segments',strands:'strands'},it:{title:'Calibrazione di stampa',help:'Stampare al 100% / Dimensioni effettive. Disattivare Adatta alla pagina. Misurare entrambi gli assi dopo la stampa. Il PDF definisce la geometria; non calibra la stampante.',square:'Quadrato 100 × 100 mm',ruler:'Righello 100 mm',inch:'1 pollice = 25,4 mm',physical:'Schema di trasferimento a grandezza reale',count:'Punti effettivi per pollice (X / Y)',size:'Dimensioni dichiarate del disegno (mm)',source:'Punti sorgente contati una sola volta',overlap:'Sovrapposizione ripetuta: allineare gli angoli della griglia e rifilare la fascia ripetuta. I punti ripetuti non sono lavoro aggiuntivo.',page:'Tessera',cells:'Celle',revision:'Revisione',legend:'Legenda della tavolozza fissata',full:'Punti croce',half:'Mezzi punti',back:'Segmenti di punto scritto',strands:'filamenti'}};
export function printCorrection(measuredMm,targetMm=100){const measured=quantity(measuredMm,{positive:true}),target=quantity(targetMm,{positive:true});assert(measured>=1&&measured<=1000&&target>=1&&target<=1000,'invalid_print_measurement');return target/measured*100;}
function calibrationPage(doc,t){doc.setFontSize(17);doc.text(t.title,15,20);doc.setFontSize(10);doc.text(doc.splitTextToSize(t.help,doc.internal.pageSize.getWidth()-30),15,29);doc.setLineWidth(.2);doc.rect(25,68,100,100);doc.text(t.square,25,63);doc.line(25,182,125,182);for(let i=0;i<=100;i++){const h=i%10?2:4;doc.line(25+i,182,25+i,182-h);}doc.text(t.ruler,25,190);doc.line(25,207,50.4,207);doc.line(25,203,25,211);doc.line(50.4,203,50.4,211);doc.text(t.inch,25,219);}
export async function calibrationPdf({locale='it',paper='a4',fontBytes}={}){const doc=await embedPdfFont(new jsPDF({unit:'mm',format:paper==='letter'?'letter':'a4',compress:true}),{fontBytes});calibrationPage(doc,words[locale]??words.it);return new Uint8Array(doc.output('arraybuffer'));}
export function physicalGeometry(revision,{countX,countY=countX,countMeaning='stitches',overX=1,overY=overX,paper='a4',overlap=2}={}){
 validateRevision(revision);const size=fabricSize({width:revision.width,height:revision.height,countX,countY,countMeaning,overX,overY}),cellX=25.4/size.effectiveX,cellY=25.4/size.effectiveY;
 const width=paper==='letter'?215.9:210,height=paper==='letter'?279.4:297,columns=Math.floor((width-30)/cellX),rows=Math.floor((height-65)/cellY);
 assert(columns>overlap&&rows>overlap&&Math.min(columns,revision.width)<=512&&Math.min(rows,revision.height)<=512,'physical_print_geometry');
 const pageCount=Math.max(1,Math.ceil((revision.width-overlap)/(columns-overlap)))*Math.max(1,Math.ceil((revision.height-overlap)/(rows-overlap)));assert(pageCount<=200,'physical_print_pages');
 return {cellX,cellY,widthMm:size.widthCm*10,heightMm:size.heightCm*10,effectiveX:size.effectiveX,effectiveY:size.effectiveY,tiles:pageTiles(revision.width,revision.height,columns,rows,overlap),totals:counts(revision)};
}
export async function physicalPatternPdf(revision,{title='',locale='it',paper='a4',fontBytes,...options}={}){
 const geometry=physicalGeometry(revision,{...options,paper}),t=words[locale]??words.it,doc=await embedPdfFont(new jsPDF({unit:'mm',format:paper==='letter'?'letter':'a4',compress:true}),{fontBytes});calibrationPage(doc,t);
 doc.addPage();doc.setFontSize(17);doc.text(t.physical,15,20);let y=30;const width=doc.internal.pageSize.getWidth();
 const line=value=>{doc.setFontSize(9);const lines=doc.splitTextToSize(pdfText(doc,value),width-30);doc.text(lines,15,y);y+=lines.length*4.5+3;};
 line(title);line(`${t.revision}: ${revision.id}`);line(`${t.count}: ${geometry.effectiveX} / ${geometry.effectiveY}`);line(`${t.size}: ${geometry.widthMm.toFixed(2)} × ${geometry.heightMm.toFixed(2)}`);line(`${t.source}: ${geometry.totals.full} / ${geometry.totals.half} / ${geometry.totals.backstitch}`);line(`${t.full} / ${t.half} / ${t.back}`);line(t.overlap);
 const mapY=y+5,mapScale=Math.min(150/revision.width,Math.max(30,doc.internal.pageSize.getHeight()-mapY-20)/revision.height);geometry.tiles.forEach((tile,index)=>{const x=15+tile.x*mapScale,top=mapY+tile.y*mapScale;doc.rect(x,top,tile.width*mapScale,tile.height*mapScale);doc.text(String(index+1),x+1,top+4);});
 appendPatternLegend(doc,revision,{locale,totals:geometry.totals,margin:15,thread:options.thread});
 for(const [index,tile]of geometry.tiles.entries()){
  doc.addPage();doc.setFontSize(10);doc.text(`${t.page} ${index+1}/${geometry.tiles.length} · ${t.cells}: ${tile.x+1}–${tile.x+tile.width} / ${tile.y+1}–${tile.y+tile.height}`,15,17);
  const pixels=Math.min(20,4096/Math.max(tile.width,tile.height)),canvas=drawPattern(document.createElement('canvas'),revision,{cellSize:pixels,offsetX:tile.x*pixels,offsetY:tile.y*pixels,width:tile.width*pixels,height:tile.height*pixels,maxDimension:4096,symbols:true,grid:true,monochrome:true});
  const x=15,y=28,w=tile.width*geometry.cellX,h=tile.height*geometry.cellY;doc.addImage(canvas.toDataURL('image/png'),'PNG',x,y,w,h);doc.setLineWidth(.15);doc.rect(x,y,w,h);if(tile.overlapX)doc.rect(x,y,tile.overlapX*geometry.cellX,h);if(tile.overlapY)doc.rect(x,y,w,tile.overlapY*geometry.cellY);
  for(const [cx,cy]of [[x,y],[x+w,y],[x,y+h],[x+w,y+h]]){doc.line(cx-2,cy,cx+2,cy);doc.line(cx,cy-2,cx,cy+2);}doc.setFontSize(8);doc.text(doc.splitTextToSize(t.overlap,doc.internal.pageSize.getWidth()-30),15,doc.internal.pageSize.getHeight()-20);
 }
 return new Uint8Array(doc.output('arraybuffer'));
}
