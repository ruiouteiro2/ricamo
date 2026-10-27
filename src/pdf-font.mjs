/** Shared locally bundled PDF fonts. Node callers inject bytes explicitly. */
export const PDF_FONT = 'RicamoSans';
const cachedFonts = new Map();
async function fontData(bold=false) {
  if (!cachedFonts.has(bold)) {
    const url=bold?new URL('./assets/DejaVuSans-Bold.ttf',import.meta.url):new URL('./assets/DejaVuSans.ttf',import.meta.url);
    cachedFonts.set(bold,fetch(url).then(async response=>{
      if(!response.ok)throw Object.assign(new Error('pdf_font_unavailable'),{code:'pdf_font_unavailable'});
      return new Uint8Array(await response.arrayBuffer());
    }).catch(error=>{cachedFonts.delete(bold);throw error;}));
  }
  return cachedFonts.get(bold);
}
function base64(bytes){let binary='';for(let offset=0;offset<bytes.length;offset+=8192)binary+=String.fromCharCode(...bytes.subarray(offset,offset+8192));return btoa(binary);}
export async function embedPdfFont(doc,{fontBytes,boldFontBytes}={}) {
  const normal=fontBytes??await fontData(),bold=boldFontBytes??(fontBytes?null:await fontData(true));
  for(const [bytes,filename,style]of [[normal,'DejaVuSans.ttf','normal'],[bold,'DejaVuSans-Bold.ttf','bold']]){
    if(!bytes&&style==='bold')continue;
    if(!(bytes instanceof Uint8Array)||bytes.byteLength<10000||bytes.byteLength>2000000)throw Object.assign(new Error('pdf_font_unavailable'),{code:'pdf_font_unavailable'});
    doc.addFileToVFS(filename,base64(bytes));doc.addFont(filename,PDF_FONT,style);doc.setFont(PDF_FONT,style);
    if(!doc.getFont().metadata?.characterToGlyph)throw Object.assign(new Error('pdf_font_unavailable'),{code:'pdf_font_unavailable'});
  }
  doc.setFont(PDF_FONT,'normal');return doc;
}
export function unsupportedPdfCharacters(doc,value) {
  const font=doc.getFont().metadata;
  return [...new Set([...String(value)].filter(char=>!/[\r\n\t]/.test(char)&&(char.length>1||!font.characterToGlyph(char.codePointAt(0)))))];
}
/** Fail visibly instead of silently omitting unsupported user text. */
export function pdfText(doc,value) {
  const text=String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,' '),missing=unsupportedPdfCharacters(doc,text);
  if(missing.length)throw Object.assign(new Error('pdf_unsupported_glyphs'),{code:'pdf_unsupported_glyphs',details:{characters:missing.map(char=>`U+${char.codePointAt(0).toString(16).toUpperCase()}`).join(', ')}});
  return text;
}
