import {runGuardianCycle,bearerAuthorized,guardianDb} from "../../../../lib/guardianRuntime.mjs";
import {syncBoosteroMultiStatuses} from "../../../../lib/boosteroMultiPostFulfillment.mjs";
import {boosteroProductionReady} from "../../../../lib/boosteroFulfillment.mjs";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;

export async function GET(req){
 const secret=process.env.CRON_SECRET||process.env.LITIX_CRON_SECRET;
 if(!bearerAuthorized(req,secret))return Response.json({error:"Unauthorized"},{status:401});
 if(process.env.VERCEL_ENV!=="production")return Response.json({ok:true,skipped:"preview_not_scheduled"});
 
 // This trusted, already-operating five-minute Guardian schedule supplies an
 // independent read-only status-reconciliation path for paid Boostero multi-post
 // children. The polling helper only uses supplier action=status, never add,
 // refill, cancel, checkout or supplier wallet debit. Existing supplier IDs
 // remain authoritative, preventing duplicate likes purchases.
 const enabled=process.env.LITIX_MULTIPOST_AUTO_FULFILL_ENABLED==="true"&&boosteroProductionReady();
 const poll=enabled?syncBoosteroMultiStatuses({limit:2}):
  Promise.resolve({checked:0,failed:0,skipped:"multi_post_disabled"});
 const [guardian,delivery]=await Promise.allSettled([runGuardianCycle(),poll]);
 const posts=delivery.status==="fulfilled"?delivery.value:{checked:0,failed:1};
 // Preserve bounded, non-sensitive supplier poll diagnostics in the existing
 // Guardian run ledger, so owner checks can distinguish a disabled worker,
 // failed supplier API, and successful status reconciliation.
 if(guardian.status==="fulfilled"){
  const diagnostic={
   enabled,checked:Number(posts.checked||0),failed:Number(posts.failed||0),
   skipped:String(posts.skipped||"").slice(0,48),
   transport:delivery.status==="fulfilled"?"completed":"failed"
  };
  try{
   await guardianDb().query(
    "update public.litix_guardian_runs set diag=coalesce(diag,'{}'::jsonb) || jsonb_build_object('boosteroMultiPoll',$2::jsonb) where id=$1",
    [guardian.value.runId,JSON.stringify(diagnostic)]);
  }catch{
   console.warn("Litix status check diagnostics unavailable",{code:"GUARDIAN_POLL_AUDIT_WRITE"});
  }
 }
 // No customer data, credentials, supplier IDs or post URLs in cron logs.
 if(Number(posts.failed||0)>0){
  console.warn("Litix multi-post status polling failed",{checked:Number(posts.checked||0),failed:Number(posts.failed||0)});
 }else if(Number(posts.checked||0)>0){
  console.info("Litix multi-post statuses refreshed",{checked:Number(posts.checked||0)});
 }
 if(guardian.status==="rejected"){
  console.error("Guardian cycle unable to complete",{code:"GUARDIAN_CHECK_FAILURE"});
  return Response.json({ok:false,error:"Guardian diagnostic storage or probe failed",
   multiPostStatuses:posts},{status:503,headers:{"cache-control":"no-store"}});
 }
 return Response.json({ok:true,...guardian.value,multiPostStatuses:posts},{headers:{"cache-control":"no-store"}});
}
