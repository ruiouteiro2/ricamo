/* Same upstream Image-Q algorithm, isolated from the UI thread. */
self.window=self;
importScripts('quantizer.js');
self.onmessage=({data:m})=>{
 try{
  if(m.kind==='reduce'){
   if(!Array.isArray(m.colors)||m.colors.length>2000||!Number.isInteger(m.count)||m.count<1)throw Error('studio_invalid_data');
   const distance=new qImage.distance.PNGQuant(),pairs=[],removed=[],selected=new Set();
   for(let i=0;i<m.colors.length;i++)for(let j=i+1;j<m.colors.length;j++){const a=m.colors[i].rgb,b=m.colors[j].rgb;pairs.push({i,j,d:distance.calculateNormalized({r:a[0],g:a[1],b:a[2],a:255},{r:b[0],g:b[1],b:b[2],a:255})});}
   pairs.sort((a,b)=>a.d-b.d);
   while(removed.length<m.colors.length-m.count){const pair=pairs.find(p=>(!m.colors[p.i].lock||!m.colors[p.j].lock)&&!selected.has(p.i)&&!selected.has(p.j));if(!pair)break;const a=m.colors[pair.i],b=m.colors[pair.j],sum=a.rgb.reduce((n,v)=>n+v,0),other=b.rgb.reduce((n,v)=>n+v,0),index=a.lock||b.lock?(a.lock?pair.j:pair.i):sum>125?(sum<other?pair.i:pair.j):(other<sum?pair.i:pair.j);removed.push(index);selected.add(index);}
   self.postMessage({removed});return;
  }
  const q=self.qImage,names={'euclidean-bt709':'EuclideanBT709',euclidean:'Euclidean','color-metric':'CMetric',pngquant:'PNGQuant',manhattan:'Manhattan','manhattan-bt709':'ManhattanBT709','manhattan-nommyde':'ManhattanNommyde',ciede2000:'CIEDE2000','cie94-graphic-arts':'CIE94GraphicArts','cie94-textiles':'CIE94Textiles'};
  if(!names[m.distance]||m.width*m.height>90000||m.rgba.length!==m.width*m.height*4)throw Error('studio_invalid_data');
  const distance=new q.distance[names[m.distance]](),image=q.utils.PointContainer.fromImageData({data:m.rgba,width:m.width,height:m.height}),transparent=q.utils.Point.createByRGBA(0,0,0,0),all=new q.utils.Palette();
  for(const rgb of m.palette)all.add(q.utils.Point.createByRGBA(...rgb,255));all.add(transparent);
  let palette=all;
  if(m.fixed){palette=new q.utils.Palette();for(const row of m.fixed)palette.add(q.utils.Point.createByRGBA(...row.rgb,row.a));palette.add(transparent);}
  else if(m.colors<m.palette.length){
   const reduced=q.buildPaletteSync([image],{colorDistanceFormula:m.distance,paletteQuantization:m.quantization,colors:m.colors}),used=new Set();palette=new q.utils.Palette();
   for(const point of reduced._pointArray){const nearest=point.a<m.minAlpha?point:all.getNearestColor(distance,point);if(!used.has(nearest)){used.add(nearest);palette.add(nearest);}}
  }
  const points=(m.dithering?new q.image.ErrorDiffusionArray(distance,q.image.ErrorDiffusionArrayKernel.SierraLite):new q.image.NearestColor(distance)).quantizeSync(image,palette);
  const hidden=new Set((m.fixed??[]).filter(r=>r.tr).map(r=>[...r.rgb,r.a].join('_')));
  if(hidden.size){const values=points.getPointArray();for(let i=0;i<values.length;i++)if(hidden.has(values[i].rgba.join('_')))values[i]=transparent;}
  const rgba=points.toUint8Array(),colors=palette._pointArray.map(p=>({rgb:[p.r,p.g,p.b],a:p.a}));
  self.postMessage({rgba,colors},[rgba.buffer]);
 }catch(error){self.postMessage({error:error.message||'generationFailed'});}
};
