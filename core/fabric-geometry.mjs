import {assert,quantity,add} from './shared.mjs';
const LIMIT=30000,EPS=1e-9;
const keys=(value,allowed)=>assert(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>allowed.includes(key)),'fabric_geometry_invalid');
const coordinate=value=>{assert(typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=LIMIT&&quantity(value)===value,'fabric_geometry_invalid');return value};
// Fixed-point orientation also represents edge midpoints (half a micro-centimetre).
const cross=(a,b,c)=>{const q=n=>BigInt(Math.round(n*2e6)),ax=q(a[0]),ay=q(a[1]);return Number((q(b[0])-ax)*(q(c[1])-ay)-(q(b[1])-ay)*(q(c[0])-ax))};
const on=(a,b,p)=>cross(a,b,p)===0&&p[0]>=Math.min(a[0],b[0])-EPS&&p[0]<=Math.max(a[0],b[0])+EPS&&p[1]>=Math.min(a[1],b[1])-EPS&&p[1]<=Math.max(a[1],b[1])+EPS;
function intersects(a,b,c,d){const x=cross(a,b,c),y=cross(a,b,d),z=cross(c,d,a),w=cross(c,d,b);return x*y<0&&z*w<0||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b)}
export function shapePoints(shape){return shape.type==='rect'?[[shape.xCm,shape.yCm],[add(shape.xCm,shape.widthCm),shape.yCm],[add(shape.xCm,shape.widthCm),add(shape.yCm,shape.heightCm)],[shape.xCm,add(shape.yCm,shape.heightCm)]]:shape.points.map(p=>[p.xCm,p.yCm])}
const edges=points=>points.map((p,i)=>[p,points[(i+1)%points.length]]);
function validateShape(shape,width,height){
 keys(shape,shape?.type==='rect'?['type','xCm','yCm','widthCm','heightCm']:['type','points']);assert(['rect','polygon'].includes(shape.type),'fabric_geometry_invalid');
 if(shape.type==='rect'){for(const key of ['xCm','yCm','widthCm','heightCm'])coordinate(shape[key]);assert(shape.widthCm>0&&shape.heightCm>0,'fabric_geometry_invalid')}
 else{assert(Array.isArray(shape.points)&&shape.points.length>=3&&shape.points.length<=24,'fabric_geometry_invalid');for(const p of shape.points){keys(p,['xCm','yCm']);coordinate(p.xCm);coordinate(p.yCm)}}
 const pts=shapePoints(shape),lines=edges(pts);assert(pts.every(p=>p[0]<=width&&p[1]<=height),'fabric_geometry_bounds');
 const scaled=n=>BigInt(Math.round(n*1e6));assert(pts.reduce((sum,p,i)=>{const q=pts[(i+1)%pts.length];return sum+scaled(p[0])*scaled(q[1])-scaled(q[0])*scaled(p[1])},0n)!==0n,'fabric_geometry_invalid');
 for(let i=0;i<lines.length;i++){const[a,b]=lines[i];assert(a[0]!==b[0]||a[1]!==b[1],'fabric_geometry_invalid');for(let j=i+1;j<lines.length;j++){if(j===i+1||i===0&&j===lines.length-1)continue;assert(!intersects(...lines[i],...lines[j]),'fabric_geometry_self_intersection')}}
 return shape;
}
/** Shapes retain their original measured frame; descendants carry only a bounded window offset. */
export function validateFabricGeometry(properties){
 const g=properties.geometry;if(g===undefined)return;
 keys(g,['version','frameWidthCm','frameHeightCm','offsetXCm','offsetYCm','complete','outline','defects']);assert(g.version===1&&typeof g.complete==='boolean','fabric_geometry_invalid');
 for(const key of ['frameWidthCm','frameHeightCm','offsetXCm','offsetYCm'])coordinate(g[key]);assert(g.frameWidthCm>0&&g.frameHeightCm>0,'fabric_geometry_invalid');
 assert(typeof properties.widthCm==='number'&&typeof properties.heightCm==='number'&&properties.widthCm>0&&properties.heightCm>0&&add(g.offsetXCm,properties.widthCm)<=g.frameWidthCm&&add(g.offsetYCm,properties.heightCm)<=g.frameHeightCm,'fabric_geometry_bounds');
 assert(Array.isArray(g.defects)&&g.defects.length<=16,'fabric_geometry_invalid');if(g.outline!==null)validateShape(g.outline,g.frameWidthCm,g.frameHeightCm);g.defects.forEach(s=>validateShape(s,g.frameWidthCm,g.frameHeightCm));
}
export function fabricGeometryKnown(lot){const p=lot.properties,g=p.geometry;if(p.unusableBorder)return true;return g?g.complete&&(!p.irregular||g.outline!==null)&&!p.unusableBorder:!p.irregular&&!p.defects&&!p.unusableBorder}
export function childFabricGeometry(lot,rect){const g=lot.properties.geometry;return g?{...structuredClone(g),offsetXCm:add(g.offsetXCm,rect.xCm),offsetYCm:add(g.offsetYCm,rect.yCm)}:undefined}
const rectPoints=r=>[[r.xCm,r.yCm],[add(r.xCm,r.widthCm),r.yCm],[add(r.xCm,r.widthCm),add(r.yCm,r.heightCm)],[r.xCm,add(r.yCm,r.heightCm)]];
const merge=intervals=>{const out=[];for(const row of intervals.sort((a,b)=>a[0]-b[0])){const last=out.at(-1);if(last&&row[0]<=last[1])last[1]=Math.max(last[1],row[1]);else out.push([...row])}return out};
function atX(poly,x){const ys=[];for(const[a,b]of edges(poly))if(x>Math.min(a[0],b[0])&&x<Math.max(a[0],b[0]))ys.push(a[1]+(x-a[0])*(b[1]-a[1])/(b[0]-a[0]));ys.sort((a,b)=>a-b);const rows=[];for(let i=0;i+1<ys.length;i+=2)rows.push([ys[i],ys[i+1]]);return rows}
function intersection(a,b){const rows=[];for(const x of a)for(const y of b){const lo=Math.max(x[0],y[0]),hi=Math.min(x[1],y[1]);if(hi>lo)rows.push([lo,hi])}return rows}
/** Integrate vertical intervals between every boundary crossing. Union intervals count overlap once. */
function areaInside(outer,excluded,window){
 if(window.widthCm<=0||window.heightCm<=0)return 0;
 const polys=[outer,...excluded,rectPoints(window)],lines=polys.flatMap(edges),breaks=polys.flatMap(p=>p.map(v=>v[0]));
 for(let i=0;i<lines.length;i++)for(let j=i+1;j<lines.length;j++){const[a,b]=lines[i],[c,d]=lines[j],rx=b[0]-a[0],ry=b[1]-a[1],sx=d[0]-c[0],sy=d[1]-c[1],den=rx*sy-ry*sx;if(den===0)continue;const t=((c[0]-a[0])*sy-(c[1]-a[1])*sx)/den,u=((c[0]-a[0])*ry-(c[1]-a[1])*rx)/den;if(t>0&&t<1&&u>0&&u<1)breaks.push(a[0]+t*rx)}
 const xs=[...new Set(breaks.filter(x=>x>=window.xCm&&x<=window.xCm+window.widthCm))].sort((a,b)=>a-b);let area=0;
 for(let i=0;i+1<xs.length;i++){const width=xs[i+1]-xs[i];if(width<=0)continue;const x=(xs[i]+xs[i+1])/2,inside=intersection(atX(outer,x),[[window.yCm,window.yCm+window.heightCm]]),blocked=merge(excluded.flatMap(p=>atX(p,x)));let length=inside.reduce((sum,[lo,hi])=>sum+hi-lo,0);for(const row of intersection(inside,blocked))length-=row[1]-row[0];area+=Math.max(0,length)*width}return Math.max(0,area);
}
function scene(lot){const p=lot.properties,g=p.geometry,ox=g?.offsetXCm??0,oy=g?.offsetYCm??0;return{outer:g?.outline?shapePoints(g.outline):rectPoints({xCm:0,yCm:0,widthCm:g?.frameWidthCm??p.widthCm,heightCm:g?.frameHeightCm??p.heightCm}),defects:g?.defects.map(shapePoints)??[],ox,oy}}
function windowFor(lot,rect){const{ox,oy}=scene(lot);return{xCm:add(ox,rect.xCm),yCm:add(oy,rect.yCm),widthCm:rect.widthCm,heightCm:rect.heightCm}}
function pointInside(point,poly,boundary=false){let inside=false;for(const[a,b]of edges(poly)){if(on(a,b,point))return boundary;if((a[1]>point[1])!==(b[1]>point[1])&&((b[1]>a[1])===(cross(a,b,point)>0)))inside=!inside}return inside}
const strictInRect=(p,r)=>p[0]>r.xCm&&p[0]<add(r.xCm,r.widthCm)&&p[1]>r.yCm&&p[1]<add(r.yCm,r.heightCm);
const properCross=(a,b,c,d)=>cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0;
function overlapsRectangle(poly,rect){const corners=rectPoints(rect),lines=edges(poly),box=edges(corners);return poly.some(p=>strictInRect(p,rect))||lines.some(([a,b])=>strictInRect([(a[0]+b[0])/2,(a[1]+b[1])/2],rect))||corners.some(p=>pointInside(p,poly))||pointInside([rect.xCm+rect.widthCm/2,rect.yCm+rect.heightCm/2],poly)||lines.some(line=>box.some(edge=>properCross(...line,...edge)))}
export function fabricRectangleClear(lot,rect){
 if(lot.properties.unusableBorder)return false;
 if(!lot.properties.geometry)return true;
 const{outer,defects}=scene(lot),window=windowFor(lot,rect),corners=rectPoints(window),lines=edges(outer),box=edges(corners);
 if(!pointInside([window.xCm+window.widthCm/2,window.yCm+window.heightCm/2],outer)||!corners.every(p=>pointInside(p,outer,true))||outer.some(p=>strictInRect(p,window))||lines.some(([a,b])=>strictInRect([(a[0]+b[0])/2,(a[1]+b[1])/2],window))||lines.some(line=>box.some(edge=>properCross(...line,...edge))))return false;
 return !defects.some(poly=>overlapsRectangle(poly,window));
}
export function fabricAreaSummary(lot,{wholeReserved=0}={}){
 const p=lot.properties;if(!Number.isFinite(p.widthCm)||!Number.isFinite(p.heightCm))return{known:false,usableAreaCm2:null,availableAreaCm2:null};
 validateFabricGeometry(p);if(p.unusableBorder)return{known:true,usableAreaCm2:0,availableAreaCm2:lot.quantity==null?null:0,mappedUsableAreaCm2:0};const{outer,defects,ox,oy}=scene(lot),m=p.usableMargins??{},window={xCm:add(ox,m.left??0),yCm:add(oy,m.top??0),widthCm:p.widthCm-(m.left??0)-(m.right??0),heightCm:p.heightCm-(m.top??0)-(m.bottom??0)};
 const mappedUsableAreaCm2=areaInside(outer,defects,window),regions=(lot.fabricPlan?.regions??[]).filter(r=>r.status==='active').map(r=>rectPoints(windowFor(lot,r))),known=fabricGeometryKnown(lot);
 return{known,usableAreaCm2:known?mappedUsableAreaCm2:null,availableAreaCm2:!known||lot.quantity==null||lot.quantity>1?null:lot.quantity===0||lot.status!=='usable'||wholeReserved>0?0:regions.length?areaInside(outer,[...defects,...regions],window):mappedUsableAreaCm2,mappedUsableAreaCm2};
}
/** Bounded placement suggestions, not an exhaustive arbitrary-polygon packing solver. */
export function fabricPlacement(lot,width,height,usable){
 const round=n=>Math.round(n*1e6)/1e6,w=Math.ceil(width*1e6)/1e6,h=Math.ceil(height*1e6)/1e6,{outer,defects,ox,oy}=scene(lot),regions=(lot.fabricPlan?.regions??[]).filter(r=>r.status==='active');
 const pts=[...outer,...defects.flat(),...regions.flatMap(rectPoints).map(([x,y])=>[x+ox,y+oy])];
 const xs=[...new Set([usable.xCm,usable.xCm+usable.widthCm-w,...pts.flatMap(p=>[p[0]-ox,p[0]-ox-w])].map(round))].filter(x=>x>=usable.xCm&&x+w<=usable.xCm+usable.widthCm+EPS).sort((a,b)=>a-b);
 const ys=[...new Set([usable.yCm,usable.yCm+usable.heightCm-h,...pts.flatMap(p=>[p[1]-oy,p[1]-oy-h])].map(round))].filter(y=>y>=usable.yCm&&y+h<=usable.yCm+usable.heightCm+EPS).sort((a,b)=>a-b);
 let count=0;for(const y of ys)for(const x of xs){if(++count>256)return null;const rect={xCm:x,yCm:y,widthCm:w,heightCm:h};if(regions.some(r=>x<add(r.xCm,r.widthCm)&&r.xCm<x+w&&y<add(r.yCm,r.heightCm)&&r.yCm<y+h))continue;if(fabricRectangleClear(lot,rect))return rect}return null;
}
