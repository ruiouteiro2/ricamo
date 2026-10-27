/** Debounced worker ownership. Superseded completions never enter the UI. */
export function createGenerationPreview({start,onResult,onError,onState,delay=400,setTimer=setTimeout,clearTimer=clearTimeout}){
 let sequence=0,timer=null,active=null,key=null,pending=false,running=false,disposed=false;
 const publish=()=>onState?.({pending,running,key});
 function stop(){if(timer!==null)clearTimer(timer);timer=null;active?.cancel?.();active=null;}
 function cancel(){sequence++;stop();pending=false;running=false;publish();}
 async function launch(token,requested){
  if(disposed||token!==sequence)return;timer=null;pending=false;running=true;publish();
  try{const job=start(requested);active=job;const result=await job.promise;if(disposed||token!==sequence)return;active=null;running=false;publish();onResult(result,requested);}
  catch(error){if(disposed||token!==sequence)return;active=null;running=false;publish();onError?.(error,requested);}
 }
 function request(requested,{immediate=false}={}){
  if(disposed)return;
  if(requested===key&&(pending||running)){if(immediate&&pending){clearTimer(timer);timer=null;launch(sequence,key);}return;}
  sequence++;stop();key=requested;pending=true;running=false;publish();const token=sequence;
  if(immediate)launch(token,requested);else timer=setTimer(()=>launch(token,requested),delay);
 }
 return{request,cancel,dispose(){cancel();disposed=true;},get state(){return{pending,running,key}}};
}
