import {boosteroProduction} from "./boosteroReadOnly.mjs";
// Retry only side-effect-free supplier reads. NEVER retry add/refill on timeout.
const allowed=new Set(["status","services","balance"]);
const transient=(error)=>/boostero_(?:network_unknown_outcome|invalid_json|batch_invalid_response|http_5\d\d|http_429)/.test(
 String(error?.message||""));
export async function boosteroResilientRead(action,parameters={},options={}){
 if(!allowed.has(action))throw Error("supplier_read_action_only");
 const operation=options.operation||boosteroProduction;
 let error;
 for(let attempt=0;attempt<3;attempt++){
  try{return await operation(action,parameters)}
  catch(e){
   error=e;
   if(!transient(e)||attempt===2)break;
   const backoff=Math.min(1200,250*2**attempt);
   await new Promise(resolve=>setTimeout(resolve,backoff));
  }
 }
 console.error("litix_supplier_read_failed",{action,code:String(error?.message||"unknown").slice(0,72)});
 throw error;
}
