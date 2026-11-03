/* Ricamo integration. Upstream UI/geometry stays isolated from the Vue 3 host. */
(() => {
  'use strict';
  const channel='ricamo-schema-studio-v1',origin=location.origin;
  let serial=0,started=false,language='en',pending=0,timer,modelPending=false,lastError=null;
  const requests=new Map(),entries=new Map(),dirty=new Map(),waiters=[];
  const send=message=>parent.postMessage({channel,...message},origin);
  const request=(type,payload)=>new Promise((resolve,reject)=>{const id=String(++serial);requests.set(id,{resolve,reject});send({type,id,payload});});
  const status=()=>send({type:'status',payload:{pending:pending>0||dirty.size>0||modelPending,error:lastError}});
  function captureModel(){
    const state=st.vueStore?.state.model,key=st.slotsSv.keys.model;
    if(state?.model&&key){const previous=entries.get(key);if(!previous||JSON.stringify(JSON.parse(previous).model)!==JSON.stringify(state.model))st.slotsSv.saveModel({state});}
    if(st.vueStore){const settings=Object.fromEntries(['mainPalette','systemPalette'].filter(k=>k in st.vueStore.state.settings).map(k=>[k,st.vueStore.state.settings[k]]));if(Object.keys(settings).length){const value={v:st.v,settings},json=JSON.stringify(value);if(entries.get('Global.Settings')!==json)write('Global.Settings',value).catch(()=>{});}}
    modelPending=false;
  }
  async function flush(){
    captureModel();clearTimeout(timer);if(!dirty.size){status();return;}
    const changes=[...dirty].map(([key,json])=>({key,json})),batch=waiters.splice(0);dirty.clear();pending++;status();
    try{await request('write',{changes});lastError=null;batch.forEach(row=>row.resolve());}
    catch(error){for(const row of changes)if(!dirty.has(row.key))dirty.set(row.key,entries.get(row.key)??null);batch.forEach(row=>row.reject(error));lastError=error.message;status();}
    finally{pending--;status();}
  }
  function write(key,value,remove=false){
    const json=remove?null:JSON.stringify(value);
    if(json!==null&&json.length>24*1024*1024)return Promise.reject(Error('studio_too_large'));
    if(remove)entries.delete(key);else entries.set(key,json);
    dirty.set(key,json);status();clearTimeout(timer);timer=setTimeout(flush,120);
    return new Promise((resolve,reject)=>waiters.push({resolve,reject}));
  }
  function localStorageAdapter(){
    return new Proxy({getItem:key=>entries.has('local:'+key)?JSON.parse(entries.get('local:'+key)):null,
      setItem:(key,value)=>{write('local:'+key,String(value)).catch(()=>{});},removeItem:key=>{write('local:'+key,null,true).catch(()=>{});}},
      {ownKeys:()=>[...entries.keys()].filter(k=>k.startsWith('local:')).map(k=>k.slice(6)),getOwnPropertyDescriptor:()=>({enumerable:true,configurable:true})});
  }
  function start(payload){
    if(started)return;started=true;language=payload.language||'en';
    for(const [key,json]of Object.entries(payload.entries||{}))entries.set(key,json);
    st.db={promise:Promise.resolve(),getKey:key=>Promise.resolve(entries.has(key)?JSON.parse(entries.get(key)):undefined),setKey:(key,value)=>write(key,value),deleteKey:key=>write(key,null,true),getAllKeys:()=>Promise.resolve([...entries.keys()].filter(k=>!k.startsWith('local:'))),getAll:()=>Promise.resolve([...entries].filter(([k])=>!k.startsWith('local:')).map(([,v])=>JSON.parse(v)))};
    st.misc.lcStorage=localStorageAdapter();st.misc.sendExeption=(error,context)=>console.warn(context,error?.message||error);st.misc.sendEvent=()=>{};
    st.locales.en.dashboard.title='Chart studio';st.locales.en.dashboard.dashboard='Your charts';st.locales.en.dashboard.storage='Saved in Ricamo';st.locales.en.dashboard.slot='Chart';
    st.misc.exportFile=(name,data)=>{const value=data instanceof Blob?data.arrayBuffer():Promise.resolve(data);value.then(data=>request('export',{name,data})).catch(error=>{lastError=error.message;status();});return true;};
    st.classes.ExportPdfClass.prototype.saveToFile=function({fileName}){st.misc.exportFile(fileName,this.doc.output('arraybuffer'));};
    const read=st.misc.safeFileText;st.misc.safeFileText=(file,context)=>file.size>25*1024*1024?Promise.reject(Error('studio_too_large')):read(file,context);
    const importSlot=st.slotsSv.importSlotData.bind(st.slotsSv);st.slotsSv.importSlotData=async(slot,data)=>{await request('validate',{model:data.model});return importSlot(slot,data);};
    const saveModel=st.slotsSv.saveModel;st.slotsSv.saveModel=function(args){if(args.state?.model&&this.keys.model)return saveModel.call(this,args);};
    const sourcer=Vue.component('s-image-sourcer'),openImage=sourcer.options.methods.openFile;
    sourcer.options.methods.openFile=async function(file){try{if(!file||file.size>25*1024*1024)throw Error('studio_too_large');await request('image',{data:await file.arrayBuffer()});openImage.call(this,file);}catch(error){this.$emit('error',error);}};
    // Hash routing works under the bounded local asset protocol and never navigates outside this document.
    st.lists.routerData.resources.mode='hash';
    const root=Vue.component('s-root-view'),before=root.options.beforeMount||[];
    root.options.beforeMount=[...(Array.isArray(before)?before:[before]),function(){this.$i18n.locale=language;}];
    // Account/network links belong to the website, not to the offline desktop workspace.
    document.addEventListener('click',event=>{const link=event.target.closest('a[href]');if(link&&/^https?:/i.test(link.getAttribute('href')))event.preventDefault();},true);
    const script=document.createElement('script');script.src='public/assets/scripts/lastbody-6ed7cc7053.js';script.onload=()=>{
      const settings=entries.get('Global.Settings');if(settings)st.vueStore.commit('settings/setSettings',{updates:JSON.parse(settings).settings,noSave:true});
      st.vueStore.subscribe(mutation=>{if(/^(model\/(startAct|continueAct|endAct|cancelAct|undoAct|redoAct|applyFilter)|settings\/setSetting)/.test(mutation.type)){modelPending=true;status();clearTimeout(timer);timer=setTimeout(flush,600);}});
      send({type:'ready'});
    };document.body.appendChild(script);
  }
  addEventListener('message',event=>{
    if(event.source!==parent||event.origin!==origin||event.data?.channel!==channel)return;
    const message=event.data;
    if(message.type==='init')start(message.payload);
    else if(message.type==='reply'){const promise=requests.get(message.id);if(!promise)return;requests.delete(message.id);message.error?promise.reject(Error(message.error)):promise.resolve(message.payload);}
    else if(message.type==='flush'){flush();}
    else if(message.type==='language'&&st.i18n){language=message.payload;st.i18n.vueI18n.locale=language;}
  });
  addEventListener('beforeunload',event=>{if(pending||dirty.size){event.preventDefault();event.returnValue='';}});
  send({type:'hello'});
})();
