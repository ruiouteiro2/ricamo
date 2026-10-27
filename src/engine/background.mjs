import {lab,deltaE} from './stitch-engine.ts';
import {PatternError} from '../../core/pattern.mjs';

/** Remove only matching pixels connected to an image edge, with four neighbours.
 * Enclosed whites remain stitched. Pixels/alpha in the caller's original stay intact.
 */
export function removeBorderBackground(rgba,{color,tolerance},width,height) {
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>500||height>500||rgba.length!==width*height*4)throw new PatternError('engine.pixelLength');
  const result=new Uint8ClampedArray(rgba),visited=new Uint8Array(width*height),queue=new Int32Array(width*height);
  const target=lab([1,3,5].map(index=>parseInt(color.slice(index,index+2),16))),cache=new Map();
  let head=0,tail=0;
  const include=index=>{
    if(visited[index])return;visited[index]=1;
    const at=index*4,alpha=rgba[at+3]/255;
    let match=alpha===0;
    if(!match){
      const rgb=[0,1,2].map(channel=>Math.round(rgba[at+channel]*alpha+255*(1-alpha)));
      const key=(rgb[0]<<16)|(rgb[1]<<8)|rgb[2];
      match=cache.get(key);
      if(match===undefined){match=deltaE(lab(rgb),target)<=tolerance+1e-9;cache.set(key,match);}
    }
    if(match){result[at+3]=0;queue[tail++]=index;}
  };
  for(let x=0;x<width;x++){include(x);include((height-1)*width+x);}
  for(let y=1;y<height-1;y++){include(y*width);include(y*width+width-1);}
  while(head<tail){const index=queue[head++],x=index%width,y=Math.floor(index/width);if(x)include(index-1);if(x+1<width)include(index+1);if(y)include(index-width);if(y+1<height)include(index+width);}
  return result;
}
