import {createBlank} from '../core/pattern.mjs';
export function seedFullBackup(repository) {
 const run=(type,payload)=>repository.execute({type,payload,operationId:crypto.randomUUID()},repository.load().revision);
 run('settings.save',{language:'en',preferences:{materialFilters:{sort:'brandAZ'}}});
 run('material.save',{id:'thread',name:'Stored cotton',category:'thread',unit:'m',brand:'DMC',range:'Mouline',code:'001',minimum:1,properties:{threadSize:'25'}});
 run('lot.add',{id:'known',materialId:'thread',quantity:8,properties:{usageStatus:'partial'}});
 run('lot.add',{id:'unknown',materialId:'thread',quantity:null});
 const originals=[{name:'instructions.pdf',data:new TextEncoder().encode('%PDF-1.4\nBackup fixture\n%%EOF')},{name:'reference.png',data:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQ0AAAAASUVORK5CYII=','base64')}];
 const imported=originals.map(file=>repository.importAsset({...file,operationId:crypto.randomUUID()},repository.load().revision).asset);
 const revision=createBlank(2,1,[{brand:'DMC',code:'001',name:'Cotton',hex:'#222222',rgb:[34,34,34],symbol:'A'}],{id:'revision-one'});revision.cells=[0,0];
 run('pattern.save',{id:'pattern',name:'Pattern with originals',revision,sourceAttachmentId:imported[1].id,attachments:[imported[0].id]});
 run('project.save',{id:'project',name:'Saved work',patternId:'pattern'});
 run('project.progress',{projectId:'project',completed:['c:0'],done:true});
 const next=structuredClone(revision);next.id='revision-two';next.cells=[0,-1];run('pattern.save',{id:'pattern',name:'Pattern with originals',revision:next});
 run('pattern.draft.save',{patternId:'pattern',baseRevisionId:'revision-two',name:'Saved draft',revision:{...next,cells:[-1,0]}});
 run('need.save',{projectId:'project',materialId:'thread',quantity:3});
 run('reservation.set',{projectId:'project',lotId:'known',quantity:2});
 run('stock.move',{kind:'consume',projectId:'project',lotId:'known',quantity:1});
 run('purchase.save',{id:'purchase',materialId:'thread',quantity:4,projectIds:['project']});
 run('purchase.receive',{purchaseId:'purchase',quantity:1});
 run('material.save',{id:'archived',name:'Archived needle',category:'tool',unit:'piece'});run('material.archive',{id:'archived'});
 return {state:repository.load(),originals,imported};
}
