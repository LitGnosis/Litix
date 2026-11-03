import {runGuardianCycle,bearerAuthorized} from "../../../../lib/guardianRuntime.mjs";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;

// Guardian checks are divided across three 5-minute runs. Each diagnostic is
// checked once every 15 minutes, instead of blocking a single serverless call.
// Supplier status reconciliation stays on its own cron; never duplicate it here.
export const GUARDIAN_COHORTS=Object.freeze([
 ["website","catalog","paykings_readiness","database","orders"],
 ["boostero","tiktok","instagram","fulfillment","multi_post"],
 ["resend","email_delivery","bluevine_readiness","autolikes","subscriptions"]
]);
export function guardianCohort(now=new Date()){
 return Math.floor(now.getUTCMinutes()/5)%GUARDIAN_COHORTS.length;
}
export async function GET(req){
 const secret=process.env.CRON_SECRET||process.env.LITIX_CRON_SECRET;
 if(!bearerAuthorized(req,secret))return Response.json({error:"Unauthorized"},{status:401,headers:{"cache-control":"no-store"}});
 if(process.env.VERCEL_ENV!=="production")return Response.json({ok:true,skipped:"preview_not_scheduled"},{headers:{"cache-control":"no-store"}});
 const cohort=guardianCohort();
 try{
  const result=await runGuardianCycle({selectedComponents:GUARDIAN_COHORTS[cohort]});
  return Response.json({ok:true,...result,cohort,multiPostStatuses:{skipped:"handled_by_supplier_cron"}},{headers:{"cache-control":"no-store"}});
 }catch{
  console.error("Guardian cycle failed",{code:"GUARDIAN_COHORT_UNAVAILABLE",cohort});
  return Response.json({ok:false,error:"Guardian diagnostic cycle unavailable",cohort},{status:503,headers:{"cache-control":"no-store"}});
 }
}
