import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {parse} from '@babel/parser';

/** Pinned, authorized upstream sources. Only local URLs enter the distribution. */
function assets(){
    const result=new Map();
    const archive=JSON.parse(gunzipSync(readFileSync(new URL('../vendor/flosscross/runtime.json.gz',import.meta.url))));
    for(const entry of archive.entries){
      if(!/^\/public\/[a-zA-Z0-9_./-]+$/.test(entry.path)||entry.path.includes('..'))throw Error('Invalid studio asset path');
      let source=Buffer.from(entry.data,'base64');
      if(createHash('sha256').update(source).digest('hex')!==entry.sha256)throw Error('Studio asset integrity');
      if(/\.(js|css)$/.test(entry.path))source=Buffer.from(source.toString('utf8').replaceAll('/public/','/studio/public/').replaceAll('src:"/canvas?','src:"/studio/canvas.html?').replace('st.db=new e({name:"FlossCross"})','st.db={getKey:function(){return Promise.resolve()}}').replace('if(!s||!s.model||!s.model.images)return Promise.reject("Empty model")','if(!s||!s.model||!s.model.images)return Promise.resolve()').replace('if(!r||!r.model||!r.model.images)return Promise.reject("Empty model")','if(!r||!r.model||!r.model.images)return Promise.resolve([])'));
      result.set('studio'+entry.path,source);
    }
    const vendor=result.get('studio/public/assets/vendor/vendor-f72735753f.js').toString('utf8'),quantizer=parse(vendor).program.body.filter(node=>vendor.slice(node.start,node.end).includes('window.qImage='));
    if(quantizer.length!==1)throw Error('Cannot isolate pinned Image-Q module');
    result.set('studio/quantizer.js',Buffer.from(vendor.slice(quantizer[0].start,quantizer[0].end)));
    for(const name of ['index.html','canvas.html','bridge.js','theme.css','italian.js','image-tools.js','quantize-worker.js'])result.set('studio/'+name,readFileSync(new URL('../src/schema-studio/'+name,import.meta.url)));
    for(const name of ['nunito-latin-wght-normal.woff2','quicksand-latin-wght-normal.woff2'])result.set('studio/fonts/'+name,readFileSync(new URL('../src/assets/'+name,import.meta.url)));
    return result;
}
export function schemaStudioAssets(){
  return {name:'ricamo-schema-studio',generateBundle(){for(const [fileName,source]of assets())this.emitFile({type:'asset',fileName,source});},configureServer(server){
    const files=assets(),types={html:'text/html',js:'text/javascript',css:'text/css',svg:'image/svg+xml',png:'image/png',woff2:'font/woff2',ttf:'font/ttf'};
    server.middlewares.use((request,response,next)=>{
      const path=new URL(request.url,'http://127.0.0.1').pathname.slice(1),source=files.get(path);
      if(!source)return next();response.setHeader('Content-Type',types[path.split('.').at(-1)]||'application/octet-stream');response.end(source);
    });
  }};
}
