import {assert,integer,quantity,oneOf} from './shared.mjs';
import {validateRevision} from './pattern.mjs';
import {normalizePatternFabric} from './pattern-fabric.mjs';
import {normalizeSupplierProduct,isEmbroideryProduct} from './supplier-products.mjs';
import {isBead} from './pattern-materials.mjs';

export const EFFECT_MODES=Object.freeze(['beads','metallic','wool']);
export const EFFECT_SUGGESTION_VERSION=1;

/** Screen-colour heuristics only. No image/object classifier and no revision mutation. */
export function suggestPatternEffects(revision,{mode,product,threshold=mode==='wool'?.12:.88,maxCandidates=100,gapMm=.25}={}){
  validateRevision(revision);
  oneOf(mode,EFFECT_MODES,'effectMode');
  quantity(threshold,{field:'threshold'});assert(threshold>=0&&threshold<=1,'pattern_effect_invalid');
  integer(maxCandidates,'maxCandidates',{min:1,max:1000});
  quantity(gapMm,{field:'gapMm'});assert(gapMm>=0&&gapMm<=5,'pattern_effect_invalid');
  const result={version:EFFECT_SUGGESTION_VERSION,points:[],eligible:0,total:0,reason:null,spacing:null,limited:false};
  if(!product)return {...result,reason:'effectChooseProduct'};
  const material=normalizeSupplierProduct(product);
  const description=[material.type,material.range,material.name].join(' ').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
  if(mode==='beads'&&material.category!=='embellishment'||mode!=='beads'&&material.category!=='thread')return {...result,reason:'effectWrongProduct'};
  if(mode!=='beads'&&!isEmbroideryProduct(material))return {...result,reason:'effectEmbroideryRequired'};
  if(mode==='metallic'&&!/metallic|metall|\blame\b|light effects/.test(description))return {...result,reason:'effectMetallicRequired'};
  if(mode==='wool'&&(!/\bwool\b|\blana\b/.test(description)||material.suitability!=='embroidery-declared'))return {...result,reason:'effectWoolRequired'};

  let pitchX,pitchY;
  if(mode==='beads'){
    if(!material.beadSizeMm)return {...result,reason:'effectBeadSizeRequired'};
    let fabric;try{fabric=normalizePatternFabric(revision.settings?.fabric);}catch{return {...result,reason:'effectFabricRequired'};}
    if(!revision.settings?.fabric)return {...result,reason:'effectFabricRequired'};
    pitchX=25.4/fabric.countX*(fabric.countMeaning==='threads'?fabric.overX:1);
    pitchY=25.4/fabric.countY*(fabric.countMeaning==='threads'?fabric.overY:1);
    result.spacing={diameterMm:material.beadSizeMm,gapMm,pitchX,pitchY};
  }
  const palette=revision.colors.map(color=>({brightness:(.2126*color.rgb[0]+.7152*color.rgb[1]+.0722*color.rgb[2])/255,chroma:(Math.max(...color.rgb)-Math.min(...color.rgb))/255,bead:isBead(color)}));
  const candidates=[],existing=[];
  for(let y=0;y<revision.height;y++)for(let x=0;x<revision.width;x++){
    const index=revision.cells[y*revision.width+x];if(index<0)continue;
    const color=palette[index];
    if(color.bead){
      if(mode==='beads'){
        const diameter=revision.colors[index].product?.beadSizeMm;
        if(!diameter)return {...result,reason:'effectExistingSizeRequired'};
        existing.push({x:(x+.5)*pitchX,y:(y+.5)*pitchY,r:diameter/2});
        if(existing.length>10000)return {...result,reason:'effectExistingLimit'};
      }
      continue;
    }
    const soft=mode==='wool';
    if(soft?(color.chroma>threshold||color.brightness<.2||color.brightness>.92):color.brightness<threshold)continue;
    let count=0,sum=0,bright=0,delta=0;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      if(!dx&&!dy)continue;const nx=x+dx,ny=y+dy;
      if(nx<0||ny<0||nx>=revision.width||ny>=revision.height)continue;
      const neighbor=palette[revision.cells[ny*revision.width+nx]];if(!neighbor||neighbor.bead)continue;
      count++;sum+=neighbor.brightness;delta+=Math.abs(color.brightness-neighbor.brightness);if(neighbor.brightness>=threshold)bright++;
    }
    if(count<3)continue;
    if(soft?delta/count>.08:bright>2||color.brightness-sum/count<.12)continue;
    candidates.push({x,y,score:soft?1-color.chroma-delta/count:color.brightness-sum/count});
  }
  result.eligible=candidates.length;
  candidates.sort((a,b)=>b.score-a.score||a.y-b.y||a.x-b.x);
  if(mode!=='beads'){
    result.total=candidates.length;
    // A bounded, evenly distributed sample avoids showing only the top-left of a flat region.
    const selected=candidates.length<=maxCandidates?candidates:Array.from({length:maxCandidates},(_,i)=>candidates[Math.floor(i*candidates.length/maxCandidates)]);
    result.points=selected.map(({x,y})=>({x,y}));return result;
  }
  const radius=material.beadSizeMm/2,placed=[...existing];let comparisons=0;
  for(const point of candidates){
    const x=(point.x+.5)*pitchX,y=(point.y+.5)*pitchY;
    if(x<radius||y<radius||x+radius>revision.width*pitchX||y+radius>revision.height*pitchY)continue;
    let overlaps=false;
    for(const other of placed){
      if(++comparisons>2_000_000){result.limited=true;result.total=result.points.length;return result;}
      const distance=radius+other.r+gapMm-1e-9;
      if((x-other.x)**2+(y-other.y)**2<distance**2){overlaps=true;break;}
    }
    if(overlaps)continue;
    result.points.push({x:point.x,y:point.y});placed.push({x,y,r:radius});
    if(result.points.length>=maxCandidates)break;
  }
  result.total=result.points.length;
  return result;
}
