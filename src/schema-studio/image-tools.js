/* Offline presets and cancellable conversion for the Vue 2 chart workspace. */
(()=>{
 const text={it:{label:'Livello di realismo',realism:'Massimo realismo',faithful:'Fotografico',balanced:'Equilibrato',simple:'Semplificato',invalid:'Inserisci un numero intero di colori tra 2 e 2000, oppure scegli un livello di realismo.',help:'Più colori conservano sfumature e dettagli. Il dettaglio dipende anche dal numero di punti; nessuno schema riproduce esattamente una fotografia.'},en:{label:'Realism level',realism:'Maximum realism',faithful:'Photographic',balanced:'Balanced',simple:'Simplified',invalid:'Enter a whole colour count between 2 and 2000, or choose a realism level.',help:'More colours preserve shading and detail. Detail also depends on the stitch count; a chart cannot reproduce a photograph exactly.'}};
 for(const name of ['s-image-processor','s-colors-reducer']){
  const component=Vue.component(name).options,originalRender=component.render;
  component.methods.reduceColors=function(fixed){
   if(this.isDestroyed)return;this.setReady(false);this.__quantWorker?.terminate();clearTimeout(this.__quantTimeout);
   if(!Number.isInteger(Number(this.reduceOptions.colors))||Number(this.reduceOptions.colors)<2||Number(this.reduceOptions.colors)>2000)return;
   try{
    if(name==='s-image-processor')this.updateImageData();if(!this.imageData)return;
    const worker=new Worker('/studio/quantize-worker.js');this.__quantWorker=worker;
    const fail=error=>{if(this.__quantWorker!==worker)return;worker.terminate();clearTimeout(this.__quantTimeout);this.__quantWorker=null;this.setReady(false);this.$emit('error',error);};
    worker.onerror=()=>fail(Error('generationFailed'));
    worker.onmessage=({data})=>{
     if(this.isDestroyed||this.__quantWorker!==worker)return;
     if(data.error){fail(Error(data.error));return;}worker.terminate();clearTimeout(this.__quantTimeout);this.__quantWorker=null;
     if(!fixed){this.resultColors=data.colors.map(row=>name==='s-image-processor'?this.filteredDict[row.rgb.join('_')]?{...this.filteredDict[row.rgb.join('_')],a:row.a,sys:this.paletteId}:null:{id:'0',name:'',...row}).filter(Boolean);if(name==='s-image-processor')this.rawColors=this.resultColors.slice();}
     for(let i=0;i<data.rgba.length;i+=4){const color=this.filteredDict[[data.rgba[i],data.rgba[i+1],data.rgba[i+2]].join('_')];if(color)data.rgba.set(color.initialRgb,i);}
     this.buffer=data.rgba;this.debouncedCountCalc?.();this.setReady(true);
    };
    this.__quantTimeout=setTimeout(()=>fail(Error('generationTimeout')),60000);
    worker.postMessage({width:this.imageData.width,height:this.imageData.height,rgba:this.imageData.data,palette:JSON.parse(JSON.stringify(this.reduceOptions.palette)),distance:this.distance,quantization:this.paletteQuantization,colors:this.reduceOptions.colors,minAlpha:this.minAlpha,dithering:this.withDithering,fixed:fixed?JSON.parse(JSON.stringify(this.resultColors)):null});
   }catch(error){this.$emit('error',error);}
  };
  const hooks=component.beforeDestroy||[];component.beforeDestroy=[...(Array.isArray(hooks)?hooks:[hooks]),function(){this.__quantWorker?.terminate();clearTimeout(this.__quantTimeout);}];
  if(name==='s-image-processor')component.render=function(h){
   const words=text[this.$i18n.locale]||text.en;
   const valid=Number.isInteger(Number(this.reduceOptions.colors))&&Number(this.reduceOptions.colors)>=2&&Number(this.reduceOptions.colors)<=2000;
   return h('div',[h('div',{class:'ricamo-realism'},[h('strong',words.label),h('div',{class:'row q-gutter-sm'},['realism','faithful','balanced','simple'].map((key,index)=>h('q-btn',{props:{outline:true,color:'primary',label:words[key]},on:{click:()=>{this.reduceOptions.colors=Math.min(this.reduceOptions.palette.length,[500,120,40,16][index]);this.withDithering=index===0;this.updateColors();}}}))),h('p',{attrs:{role:valid?'note':'status'}},valid?words.help:words.invalid)]),originalRender.call(this)]);
  };
 }
 const list=Vue.component('s-colors-list').options;
 // The old pair scan and reduction loop were synchronous too; postpone them until requested.
 list.methods.calcDistances=function(){this.rawDistances=[];};
 list.methods.reduceColors=function(count){
  this.__paletteWorker?.terminate();clearTimeout(this.__paletteTimeout);
  const worker=new Worker('/studio/quantize-worker.js');this.__paletteWorker=worker;
  let parent=this.$parent;while(parent&&typeof parent.reducePostColors!=='function')parent=parent.$parent;
  parent?.setReady(false);
  const fail=()=>{if(this.__paletteWorker!==worker)return;worker.terminate();clearTimeout(this.__paletteTimeout);this.__paletteWorker=null;this.$q.notify({type:'warning',message:this.$t('image.defaultError')});};
  worker.onerror=fail;worker.onmessage=({data})=>{if(this.__paletteWorker!==worker)return;if(data.error){fail();return;}worker.terminate();clearTimeout(this.__paletteTimeout);this.__paletteWorker=null;const removed=new Set(data.removed);this.resultColors=this.opaqColors.filter((color,index)=>{const keep=!removed.has(index),sys=this.sysColors[index];sys.active=keep;color.tr=sys.state.transparent;return keep;});this.$emit('reduce',{colors:[...this.resultColors,...this.transpColors]});};
  this.__paletteTimeout=setTimeout(fail,60000);worker.postMessage({kind:'reduce',count:Number(count),colors:this.opaqColors.map((row,i)=>({rgb:Array.from(row.rgb),lock:Boolean(this.sysColors[i].state.lock)}))});
 };
 const hooks=list.beforeDestroy||[];list.beforeDestroy=[...(Array.isArray(hooks)?hooks:[hooks]),function(){this.__paletteWorker?.terminate();clearTimeout(this.__paletteTimeout);}];
})();
