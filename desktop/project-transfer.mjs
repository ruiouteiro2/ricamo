import { randomUUID } from 'node:crypto';
import { inspectProjectPackage, previewProjectImport } from '../core/project-package.mjs';

/** Per-window native transfer capabilities. Full prepared bytes never cross back to the renderer. */
export class ProjectTransferService {
  constructor(repository) { this.repository=repository; this.pending=null; this.timer=null; }
  async inspect(text) {
    const prepared=await inspectProjectPackage(text),state=this.repository.load(),token=randomUUID();
    clearTimeout(this.timer);
    this.pending={token,prepared,operationId:randomUUID(),expires:Date.now()+10*60_000};
    this.timer=setTimeout(()=>{if(this.pending?.token===token)this.pending=null},10*60_000);this.timer.unref?.();
    return {token,revision:state.revision,preview:previewProjectImport(state,prepared)};
  }
  import(token,decisions,revision) {
    if(!this.pending||this.pending.token!==token||Date.now()>this.pending.expires)throw Object.assign(new Error(),{code:'invalid_project_token'});
    const captured=this.pending;this.pending=null;clearTimeout(this.timer);this.timer=null;
    return this.repository.importProject(captured.prepared,decisions,revision,captured.operationId);
  }
  export(projectId,options) { return this.repository.exportProject(projectId,options); }
}
