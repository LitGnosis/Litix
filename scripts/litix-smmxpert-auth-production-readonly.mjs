// One-time supplier AUTHENTICATION PROBE. Production-targeted build only.
// No gateway or order methods; no customer action; no provider key logging.
// Remove this from prebuild after checking the result.
import {supplierTrialReadOnly,summarizeSupplierTrialServices} from "../src/lib/supplierTrialReadOnly.mjs";

const key=process.env.LITIX_SMMXPERT_API_KEY;
if(!key){
 console.log("SMMXPERT_AUTH_PROBE",JSON.stringify({status:"key_unavailable_for_this_build",noPurchase:true}));
}else{
 const result={authenticated:false,services:0,currency:null,noPurchase:true};
 let phase="services";
 const transport=async (url,opts)=>{
  const response=await fetch(url,opts);
  if(!response.ok)console.log("SMMXPERT_AUTH_HTTP",JSON.stringify({phase,httpStatus:response.status}));
  return response;
 };
 try{
  const started=Date.now();
  const catalog=await supplierTrialReadOnly({provider:"smmxpert",action:"services",key,transport});
  const metrics=summarizeSupplierTrialServices(catalog);
  result.authenticated=true;
  result.services=metrics.count;
  result.validity=metrics.invalidCount;
  result.platformCounts=metrics.platformCounts;
  result.catalogLatencyMs=Date.now()-started;
  phase="balance";
  const wallet=await supplierTrialReadOnly({provider:"smmxpert",action:"balance",key,transport});
  result.currency=wallet.currency; // intentionally omit balance amount
  result.balanceCheck="ok";
 }catch(e){
  result.code=String(e?.message||"unknown_error").slice(0,72);
  result.failedPhase=phase;
 }
 console.log("SMMXPERT_AUTH_PROBE",JSON.stringify(result));
 if(!result.authenticated||result.balanceCheck!=="ok"||!result.services)process.exitCode=1;
}
