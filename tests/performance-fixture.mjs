import {createHash} from 'node:crypto';
import {deflateSync} from 'node:zlib';
import {jsPDF} from 'jspdf';
import {createState,executeCommand,validateApplicationState} from '../core/application.mjs';
import {createBlank} from '../core/pattern.mjs';
import {detectFile} from '../core/files.mjs';
const NOW='2026-01-15T12:00:00.000Z';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const ident=(prefix,n)=>`${prefix}-${String(n).padStart(5,'0')}`;
function crc32(bytes){let value=0xffffffff;for(const byte of bytes){value^=byte;for(let i=0;i<8;i++)value=(value>>>1)^((value&1)?0xedb88320:0)}return(value^0xffffffff)>>>0}
export function fixturePng(width,height,pixel){
  const chunk=(type,data)=>{const kind=Buffer.from(type),result=Buffer.alloc(data.length+12);result.writeUInt32BE(data.length);kind.copy(result,4);data.copy(result,8);result.writeUInt32BE(crc32(Buffer.concat([kind,data])),data.length+8);return result};
  const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
  const pixels=Buffer.alloc(height*(1+width*4));for(let y=0;y<height;y++)for(let x=0;x<width;x++){const at=y*(1+width*4)+1+x*4;pixels.set(pixel(x,y),at)}
  return new Uint8Array(Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]));
}
export async function buildRepresentativeFixture(){
  let template=createState(),counter=0;const context={now:NOW,id:()=>`template-${++counter}`};
  const command=(type,payload)=>{template=executeCommand(template,{type,payload,operationId:`template-operation-${++counter}`},context)};
  command('material.save',{id:'material',name:'Fixture',category:'thread',unit:'m',code:'001'});command('lot.add',{id:'lot',materialId:'material',quantity:100});command('project.save',{id:'project',name:'Fixture project'});command('need.save',{projectId:'project',materialId:'material',quantity:150});command('task.save',{id:'task',projectId:'project',title:'Prepare fabric'});command('session.save',{projectId:'project',durationMinutes:20});command('location.save',{id:'location',name:'Shelf'});command('supplier.save',{id:'supplier',name:'Synthetic supplier'});command('purchase.save',{id:'purchase',materialId:'material',quantity:100,status:'ordered',supplierId:'supplier'});
  const state=createState();state.settings.language='en';const assets=[];
  const addAsset=(id,name,data)=>{const metadata={id,name,mime:detectFile(data),size:data.length,digest:sha(data),createdAt:NOW};state.attachments.push(metadata);assets.push({id,data});return metadata};
  for(let i=0;i<50;i++)addAsset(ident('photo',i),`Synthetic photo ${i}.png`,fixturePng(64,64,(x,y)=>[(i*37+x*2)%256,(i*71+y*3)%256,(i*13+x+y)%256,255]));
  const pdf=new jsPDF();pdf.setCreationDate(new Date(NOW));pdf.setFileId('0123456789ABCDEF0123456789ABCDEF');pdf.text('Synthetic embroidery reference — page 1',15,25);pdf.addPage();pdf.text('Synthetic embroidery reference — page 2',15,25);addAsset('reference-file','Synthetic reference.pdf',new Uint8Array(pdf.output('arraybuffer')));
  for(let i=0;i<26;i++)state.locations.push({...template.locations[0],id:ident('location',i),name:i<2?`Cabinet ${i+1}`:`Drawer ${String(i-1).padStart(2,'0')}`,parentId:i<2?null:ident('location',(i-2)%2)});
  state.suppliers=[{...template.suppliers[0],id:'supplier',name:'Synthetic supplier'}];
  const categories=['thread','fabric','tool','storage','preparation','stabilizer','embellishment','finishing','kit','reference','other'];
  const units=['m','piece','piece','piece','g','cm','piece','piece','piece','piece','custom'];
  const expected={materials:5000,lots:5000,movements:20000,projects:50,unknownLots:0,estimatedLots:0,physicalByUnit:{},eligibleByUnit:{},materialPhotoLinks:0,opening:100,received:20,removed:15,knownLotFinal:105};
  for(let i=0;i<5000;i++){
    const category=categories[i%11],unit=units[i%11],unknown=i%17===0,estimated=!unknown&&i%7===0,status=i%13===0?'blocked':'usable',materialId=ident('material',i),lotId=ident('lot',i),locationId=ident('location',2+i%24),photo=i%10===0?[ident('photo',Math.floor(i/10)%50)]:[];
    state.materials.push({...structuredClone(template.materials[0]),id:materialId,name:`Material ${String(i).padStart(5,'0')} ${category}`,brand:i%2?'Personal':'DMC',range:`Range ${i%7}`,code:i===0?'001':i===1?'B5200':String(i).padStart(5,'0'),category,unit,reusable:category==='tool',color:category==='thread'?`#${[(i*43)%256,(i*71)%256,(i*19)%256].map(v=>v.toString(16).padStart(2,'0')).join('')}`:'',packageSize:category==='thread'?8:null,strands:category==='thread'?6:null,divisible:category==='thread',minimum:i%5===0?120:null,favorite:i%23===0,notes:`Synthetic stock reference ${i}`,tags:[`batch-${i%8}`],attachments:photo,properties:category==='fabric'?{fabricType:'aida',countX:14,countY:14,countMeaning:'stitches'}:{}});
    state.lots.push({...structuredClone(template.lots[0]),id:lotId,materialId,unit,quantity:unknown?null:105,confidence:unknown?'unknown':estimated?'estimated':'exact',status,locationId,lotCode:`DYE-${i%97}`,properties:category==='fabric'?{widthCm:40,heightCm:50,countX:14,countY:14,countMeaning:'stitches'}:{}});
    for(let j=0;j<4;j++){
      const kind=unknown?(j===0?'opening':'transfer'):['opening','receipt','loss','discard'][j];
      const operationId=`fixture-op-${i}-${j}`;
      const move={...template.movements[0],id:`movement-${i}-${j}`,lotId,materialId,unit,kind,quantity:unknown?null:[100,20,10,5][j],before:unknown?(j===0?0:null):[0,100,120,110][j],after:unknown?null:[100,120,110,105][j],operationId,date:NOW};
      if(kind==='transfer'){move.fromLocationId=ident('location',2+(i+j-1)%24);move.toLocationId=j===3?locationId:ident('location',2+(i+j)%24)}
      state.movements.push(move);state.operations.push({id:operationId,type:j===0?'lot.add':'stock.move',signature:`sha256:${sha(JSON.stringify(move))}`,date:NOW});
    }
    if(unknown)expected.unknownLots++;else{expected.physicalByUnit[unit]=(expected.physicalByUnit[unit]||0)+105;if(status==='usable')expected.eligibleByUnit[unit]=(expected.eligibleByUnit[unit]||0)+105}if(estimated)expected.estimatedLots++;expected.materialPhotoLinks+=photo.length;
  }
  const colors=Array.from({length:80},(_,i)=>{const rgb=[i%5*48,Math.floor(i/5)%4*64,Math.floor(i/20)*64];return{brand:'Synthetic',code:String(i).padStart(3,'0'),name:`Colour ${i}`,rgb,hex:'#'+rgb.map(v=>v.toString(16).padStart(2,'0')).join(''),symbol:String.fromCharCode(0x2500+i),strands:2,itemId:ident('material',i*11)}});
  for(const [id,name,size,count]of[['small','Small sampler',20,4],['large','Large sampler 500 x 500',500,80]]){const revision=createBlank(size,size,colors.slice(0,count),{id:`revision-${id}`});revision.createdAt=NOW;revision.cells=Array.from({length:size*size},(_,i)=>i%count);state.patterns.push({id:`pattern-${id}`,kind:'structured',name,notes:'Synthetic performance fixture',tags:[],favorite:false,archived:false,revisions:[revision],currentRevisionId:revision.id,sourceAttachmentId:null,createdAt:NOW,updatedAt:NOW})}
  state.patterns.push({id:'pattern-reference',kind:'reference',name:'Two-page reference',notes:'',tags:[],favorite:false,archived:false,revisions:[],sourceAttachmentId:'reference-file',createdAt:NOW,updatedAt:NOW});
  for(let i=0;i<50;i++){
    const projectId=ident('project',i),kind=i%10===9?'reference':i%10===8?'large':'small';
    state.projects.push({...structuredClone(template.projects[0]),id:projectId,name:`Project ${String(i).padStart(2,'0')}`,status:i%4===0?'preparing':'active',patternId:`pattern-${kind}`,revisionId:kind==='reference'?null:`revision-${kind}`,attachments:[ident('photo',i)],completed:kind==='reference'?[]:['c:0','c:1','c:2'],manualPercent:kind==='reference'?25:0});
    for(let j=0;j<10;j++){const material=state.materials[i*10+j];state.needs.push({...template.needs[0],id:`need-${i}-${j}`,projectId,materialId:material.id,unit:material.unit,quantity:j===9?null:150,confidence:j===9?'unknown':'estimated'})}
    for(let j=0;j<4;j++)state.tasks.push({...template.tasks[0],id:`task-${i}-${j}`,projectId,title:`Preparation step ${j+1}`,done:j===0,order:j});
    for(let j=0;j<3;j++)state.sessions.push({...template.sessions[0],id:`session-${i}-${j}`,projectId,date:'2026-01-15',durationMinutes:20+j*5,attachments:j===0?[ident('photo',i)]:[]});
    const material=state.materials[500+i];state.purchases.push({...template.purchases[0],id:`purchase-${i}`,materialId:material.id,unit:material.unit,projectIds:[projectId]});
  }
  expected.attachments=51;expected.patterns={small:{width:20,height:20,colors:4},large:{width:500,height:500,colors:80}};expected.projectPhotoLinks=50;
  validateApplicationState(state);
  const generatedImage=fixturePng(500,500,(x,y)=>[...colors[(y*500+x)%80].rgb,255]);
  return{state,assets,expected,generatedImage,fingerprint:sha(JSON.stringify(state)+assets.map(row=>sha(row.data)).join(''))};
}
