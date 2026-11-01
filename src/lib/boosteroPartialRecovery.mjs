// Supplier status read-only recovery policy for a previously Partial child.
// Never requests an add, refill, cancel, replacement or card payment.
import {boosteroChildState} from "./boosteroStatusBatch.mjs";
export function reconciledMultiPostState(previousState,snapshot){
 const now=String(snapshot?.status||"").trim().toLowerCase();
 const state=String(previousState||"");
 if(state==="MANUAL_REVIEW"){
  const remaining=snapshot?.remains;
  return (["completed","complete"].includes(now)&&Number.isSafeInteger(remaining)&&remaining===0)
   ?"COMPLETED":"MANUAL_REVIEW";
 }
 // A missing remaining count on a submitted order must not be turned
 // into a customer-visible delivered order just because an API says Completed.
 if(["completed","complete"].includes(now)&&snapshot?.remains!==0)
  return "MANUAL_REVIEW";
 return boosteroChildState(now);
}
