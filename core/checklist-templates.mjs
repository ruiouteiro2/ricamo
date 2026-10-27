import {assert,identifier,text,oneOf,date,find,audit,jsonObject} from './shared.mjs';import {saveTask} from './projects.mjs';
const stages=['preparation','work','finishing','custom'];
const builtins=[
  {
    "id": "builtin:cross-stitch",
    "name": [
      "Punto croce: dall’idea alla finitura",
      "Cross stitch: planning to finishing"
    ],
    "tasks": [
      [
        "preparation",
        "Conferma schema, count e dimensioni del tessuto",
        "Confirm pattern, fabric count and dimensions"
      ],
      [
        "preparation",
        "Controlla fili, lotti e quantità necessarie",
        "Check threads, dye lots and required quantities"
      ],
      [
        "preparation",
        "Prepara il tessuto e una prova di tensione",
        "Prepare the fabric and a tension sample"
      ],
      [
        "work",
        "Ricama e registra il lavoro per tipo di punto",
        "Stitch and record work by stitch type"
      ],
      [
        "work",
        "Controlla punti mancanti e contorni",
        "Review missing stitches and outlines"
      ],
      [
        "finishing",
        "Conferma montaggio e istruzioni di cura dei materiali",
        "Confirm mounting and material care instructions"
      ]
    ]
  },
  {
    "id": "builtin:surface",
    "name": [
      "Ricamo libero con riferimento",
      "Surface embroidery from a reference"
    ],
    "tasks": [
      [
        "preparation",
        "Allega il riferimento e annota le dimensioni previste",
        "Attach the reference and note planned dimensions"
      ],
      [
        "preparation",
        "Elenca punti, fili e materiali",
        "List stitches, threads and materials"
      ],
      [
        "preparation",
        "Prepara il trasferimento del disegno e una prova",
        "Prepare the design transfer and a sample"
      ],
      [
        "work",
        "Lavora per sezioni e registra tempo e consumi reali",
        "Work by section and record time and actual consumption"
      ],
      [
        "finishing",
        "Controlla il lavoro e scegli la finitura",
        "Review the work and choose the finish"
      ]
    ]
  },
  {
    "id": "builtin:finishing",
    "name": [
      "Finitura e consegna",
      "Finishing and delivery"
    ],
    "tasks": [
      [
        "finishing",
        "Controlla punti, contorni e fili da fermare",
        "Review stitches, outlines and thread ends"
      ],
      [
        "finishing",
        "Consulta le istruzioni di cura registrate",
        "Consult the recorded care instructions"
      ],
      [
        "finishing",
        "Conferma dimensioni e materiali del montaggio",
        "Confirm mounting dimensions and materials"
      ],
      [
        "finishing",
        "Fotografa il lavoro completato",
        "Photograph the finished work"
      ],
      [
        "finishing",
        "Registra destinatario e dettagli della consegna",
        "Record recipient and delivery details"
      ]
    ]
  }
];
function definition(task){assert(task&&typeof task==='object'&&!Array.isArray(task)&&Object.keys(task).every(key=>['title','stage','notes'].includes(key)),'invalid_template_task');if(task.notes!==undefined)assert(typeof task.notes==='string','invalid_template_task');return{title:text(task.title,'title',{required:true,max:500}),stage:oneOf(task.stage,stages,'stage'),notes:text(task.notes,'notes',{max:10000})};}
function definitions(tasks){assert(Array.isArray(tasks)&&tasks.length>0&&tasks.length<=100,'template_task_limit');return tasks.map(definition);}
export function checklistTemplates(state){return state.settings.preferences?.checklistTemplates===undefined?[]:state.settings.preferences.checklistTemplates;}
export function availableChecklistTemplates(state,locale=state.settings.language){const i=locale==='en'?1:0;return[...builtins.map(b=>({id:b.id,builtin:true,name:b.name[i],tasks:b.tasks.map(row=>({stage:row[0],title:row[i+1],notes:''}))})),...checklistTemplates(state)];}
export function checklistPreview(state,projectId,templateId,mode='append'){find(state,'projects',projectId);const template=availableChecklistTemplates(state).find(row=>row.id===templateId);assert(template,'template_not_found');oneOf(mode,['append','replace_unfinished'],'mode');const tasks=state.tasks.filter(row=>row.projectId===projectId);return{template,added:template.tasks.length,removed:mode==='replace_unfinished'?tasks.filter(row=>!row.done).length:0,retainedCompleted:tasks.filter(row=>row.done).length};}
export function templateEditPreview(before,draft){const after={name:text(draft.name,'name',{required:true,max:150}),tasks:definitions(draft.tasks)};return{before,after,changes:Array.from({length:Math.max(before?.tasks.length??0,after.tasks.length)},(_,index)=>({index,before:before?.tasks[index]??null,after:after.tasks[index]??null})).filter(row=>JSON.stringify(row.before)!==JSON.stringify(row.after)),renamed:before?.name!==after.name};}
function write(state,items){assert(items.length<=50,'template_limit');state.settings.preferences=jsonObject({...state.settings.preferences,checklistTemplates:items});}
function create(state,p,ctx,sourceProjectId){const items=checklistTemplates(state),id=p.id?identifier(p.id):ctx.id();assert(!id.startsWith('builtin:')&&!items.some(t=>t.id===id),'duplicate_id');const row={id,name:text(p.name,'name',{required:true,max:150}),tasks:definitions(p.tasks),createdAt:ctx.now,updatedAt:ctx.now};write(state,[...items,row]);audit(state,ctx,'template',id,'created',sourceProjectId?{projectId:sourceProjectId}:{});}
function saveFromProject(state,p,ctx){find(state,'projects',p.projectId);const tasks=state.tasks.filter(row=>row.projectId===p.projectId).sort((a,b)=>a.order-b.order).map(({title,stage,notes})=>({title,stage,notes}));create(state,{name:p.name,tasks},ctx,p.projectId);}
function update(state,p,ctx){const items=checklistTemplates(state),old=items.find(row=>row.id===p.id);assert(old,'template_not_found');const preview=templateEditPreview(old,{name:p.name??old.name,tasks:p.tasks??old.tasks});write(state,items.map(row=>row.id===old.id?{...old,...preview.after,updatedAt:ctx.now}:row));audit(state,ctx,'template',old.id,'updated',{renamed:preview.renamed,changedRows:preview.changes.length});}
function remove(state,p,ctx){assert(p.confirmDelete===true,'template_delete_confirmation');const items=checklistTemplates(state);assert(items.some(row=>row.id===p.id),'template_not_found');write(state,items.filter(row=>row.id!==p.id));audit(state,ctx,'template',p.id,'deleted');}
function apply(state,p,ctx){const project=find(state,'projects',p.projectId);assert(!['completed','archived'].includes(project.status),'project_closed');const preview=checklistPreview(state,project.id,p.templateId,p.mode);if(preview.removed)assert(p.confirmReplace===true,'template_replace_confirmation');if(p.mode==='replace_unfinished')state.tasks=state.tasks.filter(row=>row.projectId!==project.id||row.done);const existing=state.tasks.filter(row=>row.projectId===project.id),start=existing.reduce((n,row)=>Math.max(n,row.order+1),0);assert(start+preview.added<=100000,'template_task_limit');for(const[index,task]of preview.template.tasks.entries())saveTask(state,{...task,projectId:project.id,done:false,dueDate:'',order:start+index},ctx);audit(state,ctx,'project',project.id,'template_applied',{templateId:p.templateId,mode:p.mode??'append',added:preview.added,removed:preview.removed,retainedCompleted:preview.retainedCompleted});}
export const checklistTemplateHandlers={'template.save':saveFromProject,'template.create':create,'template.update':update,'template.delete':remove,'template.apply':apply};
export function validateChecklistTemplates(state){const items=checklistTemplates(state);assert(Array.isArray(items)&&items.length<=50,'template_limit');const ids=new Set();for(const row of items){assert(row&&typeof row==='object'&&Object.keys(row).every(key=>['id','name','tasks','createdAt','updatedAt'].includes(key)),'invalid_template_task');identifier(row.id);assert(!row.id.startsWith('builtin:')&&!ids.has(row.id),'duplicate_id');ids.add(row.id);text(row.name,'name',{required:true,max:150});assert(typeof row.createdAt==='string'&&row.createdAt.length,'invalid_date');date(row.createdAt,'createdAt');if(row.updatedAt!==undefined){assert(typeof row.updatedAt==='string'&&row.updatedAt.length,'invalid_date');date(row.updatedAt,'updatedAt');}definitions(row.tasks);}return state;}
