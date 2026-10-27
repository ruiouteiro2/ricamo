import {validateRevision} from './pattern.mjs';
import {fabricSize} from './fabric.mjs';
import {assert} from './shared.mjs';

/** Grid-vertex coordinates, including half-step backstitch vertices; empty is null.
 * Full/half stitches occupy a whole cell. Thread thickness is not a geometric margin.
 * This read-only measurement never chooses a cut or changes a material requirement.
 */
export function stitchedBounds(revision){
  validateRevision(revision);
  let x=Infinity,y=Infinity,right=-Infinity,bottom=-Infinity;
  const include=(left,top,r,b)=>{x=Math.min(x,left);y=Math.min(y,top);right=Math.max(right,r);bottom=Math.max(bottom,b)};
  for(let i=0;i<revision.cells.length;i++)if(revision.cells[i]>=0){const cx=i%revision.width,cy=Math.floor(i/revision.width);include(cx,cy,cx+1,cy+1)}
  for(const stitch of revision.halfStitches??[])include(stitch.x,stitch.y,stitch.x+1,stitch.y+1);
  for(const segment of revision.backstitches??[])include(Math.min(segment.x1,segment.x2),Math.min(segment.y1,segment.y2),Math.max(segment.x1,segment.x2),Math.max(segment.y1,segment.y2));
  return x===Infinity?null:{x,y,right,bottom,width:right-x,height:bottom-y};
}
export function physicalStitchedBounds(bounds,grid){
  if(bounds===null||grid===null)return null;
  assert(Number.isFinite(grid.effectiveX)&&grid.effectiveX>0&&Number.isFinite(grid.effectiveY)&&grid.effectiveY>0,'invalid_count_meaning');
  return{...bounds,xCm:bounds.x/grid.effectiveX*2.54,yCm:bounds.y/grid.effectiveY*2.54,widthCm:bounds.width/grid.effectiveX*2.54,heightCm:bounds.height/grid.effectiveY*2.54};
}
export function physicalDesignSize(revision,config){
  const bounds=stitchedBounds(revision),grid=fabricSize({...config,width:revision.width,height:revision.height});
  return{grid,bounds,stitched:physicalStitchedBounds(bounds,grid)};
}
export function projectFabricConfig(project,lot){
  const planned=project.settings?.fabric??{};
  return lot?{...planned,countX:lot.properties?.countX??null,countY:lot.properties?.countY??null,countMeaning:lot.properties?.countMeaning??'stitches'}:planned;
}
