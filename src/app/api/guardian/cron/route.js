import {runGuardianCycle,bearerAuthorized} from "../../../../lib/guardianRuntime.mjs";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;

export async function GET(req){
 const secret=process.env.CRON_SECRET||process.env.LITIX_CRON_SECRET;
 if(!bearerAuthorized(req,secret))
  return Response.json({error:"Unauthorized"},{status:401,headers:{"cache-control":"no-store"}});
 if(process.env.VERCEL_ENV!=="production")
  return Response.json({ok:true,skipped:"preview_not_scheduled"},{headers:{"cache-control":"no-store"}});
 // Guardian performs health checks only. Supplier status polling has a separate
 // phase-bounded authenticated cron, preventing overlapping expensive calls.
 try{
  const guardian=await runGuardianCycle();
  return Response.json({ok:true,...guardian},{headers:{"cache-control":"no-store"}});
 }catch{
  console.error("Litix Guardian cycle failed",{code:"GUARDIAN_CYCLE_UNAVAILABLE"});
  return Response.json({ok:false,error:"Guardian monitoring unavailable"},
   {status:503,headers:{"cache-control":"no-store"}});
 }
}
