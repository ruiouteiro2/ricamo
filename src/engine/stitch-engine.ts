import dmc from './dmc.json' with { type: 'json' };
export interface Color { code:string; name:string; rgb:number[]; hex:string }
export interface Palette { brand:string; colors:Color[]; source:string; approximate:boolean; skeinMeters:number }
export interface Settings { width:number; height:number; count:number; strands:number; maxColors:number; mode:'detail'|'balanced'|'simple'; region:number; waste:number }

export const settingRules = {
 width: { label: 'Larghezza (punti)', min: 1, max: 500, integer: true },
 height: { label: 'Altezza (punti)', min: 1, max: 500, integer: true },
 count: { label: 'Aida (count)', min: 6, max: 40, integer: false },
 strands: { label: 'Fili utilizzati', min: 1, max: 6, integer: true },
 maxColors: { label: 'Colori massimi', min: 1, max: 80, integer: true },
 region: { label: 'Rimuovi aree ≤', min: 0, max: 30, integer: true },
 waste: { label: 'Margine di consumo (%)', min: 0, max: 100, integer: false },
} as const;
export function settingError(key: keyof typeof settingRules, value: unknown): string {
 const r = settingRules[key];
 const range = `${r.min} a ${r.max}`;
 if (typeof value !== 'number' || !Number.isFinite(value)) return `${r.label}: inserisci un numero da ${range}.`;
 if (value < r.min || value > r.max) return `${r.label}: il valore ${value} è fuori dall’intervallo consentito (${range}).`;
 if (r.integer && !Number.isInteger(value)) return `${r.label}: usa un numero intero da ${range}; valore inserito: ${value}.`;
 return '';
}
export function settingsErrors(s: Settings): string[] {
 return (Object.keys(settingRules) as (keyof typeof settingRules)[]).map(key => settingError(key, s[key])).filter(Boolean);
}

export interface Project { version:1; title:string; author:string; settings:Settings; palette:Palette; colors:Color[]; cells:number[]; source?:string; crop?:number[] }
export const symbols = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&*+=?!/:;<>[]{}';
export const dmcPalette:Palette={brand:'DMC',colors:dmc,source:'Dati colore: craft-color-codes di MakeBead (https://makebead.com), CC BY 4.0. Digital RGB approximations.',approximate:true,skeinMeters:8};
// Initial, approximate subset: Anchor codes paired with common DMC equivalents.
const anchorPairs:Record<string,string>={'310':'403','B5200':'1','321':'47','349':'13','666':'46','817':'13','740':'316','741':'304','742':'303','444':'290','307':'289','700':'228','701':'227','702':'226','703':'238','704':'256','796':'134','797':'133','798':'131','799':'130','820':'134','995':'410','996':'433','550':'102','552':'99','554':'96','208':'110','209':'109','210':'108','211':'342','3799':'236','317':'400','318':'399','414':'235','415':'398','762':'234','3865':'2',' Blanc':'2','3371':'382','801':'359','938':'380','434':'310','435':'1046','436':'1045','437':'362','738':'361','739':'366','945':'881','754':'1012','761':'1021','3713':'1020'};
export const anchorPalette:Palette={brand:'Anchor',source:'Selezione iniziale approssimata; RGB derivati da equivalenti DMC. Verificare su una cartella Anchor fisica prima dell’uso commerciale.',approximate:true,skeinMeters:8,colors:Object.entries(anchorPairs).filter(([k])=>dmc.some(c=>c.code===k)).filter(([,v],i,a)=>a.findIndex(x=>x[1]===v)===i).map(([code,anchor])=>({...dmc.find(c=>c.code===code)!,code:anchor}))};
export function lab(rgb:number[]):number[] { const [r,g,b]=rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}); const f=(v:number)=>v>.008856?Math.cbrt(v):7.787*v+16/116;const x=f((r*.4124564+g*.3575761+b*.1804375)/.95047),y=f(r*.2126729+g*.7151522+b*.072175),z=f((r*.0193339+g*.119192+b*.9503041)/1.08883);return [116*y-16,500*(x-y),200*(y-z)] }
export function deltaE(a:number[],b:number[]):number{return Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2])} // CIE76, Euclidean CIELAB
function nearest(v:number[],centers:number[][]):number {let best=0,min=Infinity;for(let i=0;i<centers.length;i++){const d=deltaE(v,centers[i]);if(d<min){best=i;min=d}}return best}
export function simplify(cells:number[],w:number,h:number,threshold:number,protectedMask?:Uint8Array):number[]{
 if(threshold<=0)return [...cells];const result=[...cells],seen=new Uint8Array(cells.length);
 for(let start=0;start<cells.length;start++){
  if(seen[start]||result[start]<0)continue;
  const color=result[start],region=[start],local=new Set([start]),border=new Map<number,number>();
  for(let q=0;q<region.length;q++){const i=region[q],x=i%w,y=Math.floor(i/w);for(const n of [x>0?i-1:-1,x<w-1?i+1:-1,y>0?i-w:-1,y<h-1?i+w:-1]){if(n<0)continue;if(result[n]===color){if(!local.has(n)){local.add(n);region.push(n)}}else if(result[n]>=0)border.set(result[n],(border.get(result[n])||0)+1)}}
  region.forEach(i=>seen[i]=1);
  if(region.length<=threshold&&border.size&&!region.some(i=>protectedMask?.[i])){const replacement=[...border].sort((a,b)=>b[1]-a[1]||a[0]-b[0])[0][0];region.forEach(i=>result[i]=replacement)}
 }return result;
}
export interface ConversionOptions {fixedIndices?:number[];preferredIndices?:number[];preferenceTolerance?:number;maxPreferenceDistance?:number;protectedMask?:Uint8Array}
export function convert(rgba:Uint8ClampedArray,s:Settings,p:Palette,options:ConversionOptions={}):{colors:Color[];cells:number[];cleanupChanged:number}{
 const pixels:number[][]=[],indices:number[]=[];const histogram=new Map<string,{lab:number[];n:number}>();
 for(let i=0;i<rgba.length;i+=4){if(rgba[i+3]<128){indices.push(-1);continue}const alpha=rgba[i+3]/255;const rgb=[0,1,2].map(j=>Math.min(255,Math.round((rgba[i+j]*alpha+255*(1-alpha))/8)*8));const l=lab(rgb);indices.push(pixels.length);pixels.push(l);const key=rgb.join(',');const row=histogram.get(key);if(row)row.n++;else histogram.set(key,{lab:l,n:1})}
 if(!pixels.length)throw Error('L’immagine non contiene punti visibili.');
 const rows=[...histogram.values()].sort((a,b)=>b.n-a.n);const k=Math.min(s.maxColors,rows.length,p.colors.length,s.mode==='simple'?16:s.mode==='balanced'?40:80);const centers=[rows[0].lab];
 while(centers.length<k){let winner=rows[0],best=-1;for(const row of rows){const score=deltaE(row.lab,centers[nearest(row.lab,centers)])**2*Math.sqrt(row.n);if(score>best){best=score;winner=row}}if(best<1e-8)break;centers.push([...winner.lab])}
 for(let iteration=0;iteration<8;iteration++){const sums=centers.map(()=>[0,0,0,0]);for(const row of rows){const sum=sums[nearest(row.lab,centers)];for(let j=0;j<3;j++)sum[j]+=row.lab[j]*row.n;sum[3]+=row.n}for(let j=0;j<centers.length;j++)if(sums[j][3])centers[j]=sums[j].slice(0,3).map(v=>v/sums[j][3])}
 const paletteLabs=p.colors.map(c=>lab(c.rgb));const preferred=options.preferredIndices??[];
 const choose=(center:number[])=>{const best=nearest(center,paletteLabs);let owned=-1,distance=Infinity;for(const index of preferred){const d=deltaE(center,paletteLabs[index]);if(d<distance){owned=index;distance=d}}return owned>=0&&distance<=deltaE(center,paletteLabs[best])+(options.preferenceTolerance??0)&&distance<=(options.maxPreferenceDistance??20)?owned:best};
 const fixed=options.fixedIndices??[];const chosen=fixed.length?[...new Set([...fixed,...centers.map(choose)])].slice(0,Math.min(s.maxColors,p.colors.length,s.mode==='simple'?16:s.mode==='balanced'?40:80)):[...new Set(centers.map(choose))];const colors=chosen.map(i=>p.colors[i]);const labs=chosen.map(i=>paletteLabs[i]);let cells=indices.map(i=>i<0?-1:nearest(pixels[i],labs));
 const before=cells;cells=simplify(cells,s.width,s.height,s.region,options.protectedMask);const cleanupChanged=cells.reduce((n,value,i)=>n+(value!==before[i]?1:0),0);const used=[...new Set([...(fixed.length?fixed.map((_,i)=>i):[]),...cells.filter(i=>i>=0)])].sort((a,b)=>a-b);const remap=new Map(used.map((n,i)=>[n,i]));return {colors:used.map(i=>colors[i]),cells:cells.map(i=>i<0?-1:remap.get(i)!),cleanupChanged};
}
export function counts(p:Project):number[]{const n=p.colors.map(()=>0);p.cells.forEach(i=>{if(i>=0)n[i]++});return n}
export function consumption(stitches:number,s:Settings,meters=8){const pitch=.0254/s.count;const doubleLength=stitches*pitch*(2*Math.SQRT2+2)*(1+s.waste/100)+Math.ceil(stitches/80)*.12;const singleMeters=doubleLength*s.strands;return {meters:singleMeters,skeins:stitches?Math.ceil(singleMeters/(meters*6)):0}}
export function validateProject(value:unknown):Project{
 const p=value as Project;if(!p||p.version!==1||!p.settings||!Array.isArray(p.cells)||!Array.isArray(p.colors)||!p.palette)throw Error('Formato del progetto non valido.');
 const s=p.settings;const issues=settingsErrors(s);if(issues.length)throw Error(issues.join(" "));
 if(!Number.isInteger(s.width)||!Number.isInteger(s.height)||p.cells.length!==s.width*s.height||p.colors.length>80||!p.colors.length||p.cells.some(i=>!Number.isInteger(i)||i< -1||i>=p.colors.length))throw Error('Griglia non valida.');
 if(!['detail','balanced','simple'].includes(s.mode)||typeof p.title!=='string'||typeof p.author!=='string')throw Error('Metadati non validi.');
 validatePalette(p.palette);for(const c of p.colors)validateColor(c);if(p.source&&!(p.source==='/exemplo.svg'||/^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,/i.test(p.source)))throw Error('L’immagine del progetto deve essere incorporata, senza URL esterni.');if(p.crop&&(!Array.isArray(p.crop)||p.crop.length!==4||p.crop.some(v=>!Number.isFinite(v)||v<0||v>100)||p.crop[2]<=0||p.crop[3]<=0||p.crop[0]+p.crop[2]>100||p.crop[1]+p.crop[3]>100))throw Error('Ritaglio non valido.');return p;
}
function validateColor(c:Color){if(!c||typeof c.code!=='string'||typeof c.name!=='string'||!/^#[0-9a-f]{6}$/i.test(c.hex)||!Array.isArray(c.rgb)||c.rgb.length!==3||c.rgb.some(v=>!Number.isFinite(v)||v<0||v>255))throw Error('Colore non valido.');}
export function validatePalette(value:unknown):Palette{const p=value as Palette;if(!p||typeof p.brand!=='string'||typeof p.source!=='string'||!Array.isArray(p.colors)||!p.colors.length||p.colors.length>2000||!Number.isFinite(p.skeinMeters)||p.skeinMeters<=0)throw Error('Tavolozza non valida.');p.colors.forEach(validateColor);if(new Set(p.colors.map(c=>c.code)).size!==p.colors.length)throw Error('Codici colore duplicati.');return p}
