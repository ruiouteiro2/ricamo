import {counts} from './pattern.mjs';
/** Four-neighbour regions of full crosses; diagonal contact is not connectivity. */
export function reviewPattern(revision,{rareThreshold=5,smallThreshold=3}={}) {
  const summary=counts(revision),seen=new Uint8Array(revision.cells.length),regions=[];let smallRegions=0,isolated=0;
  for(let start=0;start<revision.cells.length;start++){
    if(seen[start]||revision.cells[start]<0)continue;const color=revision.cells[start],queue=[start];seen[start]=1;
    for(let q=0;q<queue.length;q++){const i=queue[q],x=i%revision.width,y=Math.floor(i/revision.width);for(const n of[x>0?i-1:-1,x<revision.width-1?i+1:-1,y>0?i-revision.width:-1,y<revision.height-1?i+revision.width:-1])if(n>=0&&!seen[n]&&revision.cells[n]===color){seen[n]=1;queue.push(n)}}
    if(queue.length<=smallThreshold){smallRegions++;if(queue.length===1)isolated++;if(regions.length<100)regions.push({color,size:queue.length,x:start%revision.width,y:Math.floor(start/revision.width)})}
  }
  return{...summary,usedColors:summary.byColor.filter(row=>row.total>0).length,rareColors:summary.byColor.filter(row=>row.total>0&&row.total<=rareThreshold),smallRegions,isolated,regions,rareThreshold,smallThreshold};
}
