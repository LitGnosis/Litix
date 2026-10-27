import {runGuardianCycle,bearerAuthorized} from "../../../../lib/guardianRuntime.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
export async function GET(req){
 const secret=process.env.CRON_SECRET||process.env.LITIX_CRON_SECRET;
 if(!bearerAuthorized(req,secret))return Response.json({error:"Unauthorized"},{status:401});
 if(process.env.VERCEL_ENV!=="production")return Response.json({ok:true,skipped:"preview_not_scheduled"});
 try{
  const result=await runGuardianCycle();
  return Response.json({ok:true,...result},{headers:{"cache-control":"no-store"}});
 }catch(e){
  console.error("Guardian cycle unable to complete",{code:"GUARDIAN_CHECK_FAILURE"});
  return Response.json({ok:false,error:"Guardian diagnostic storage or probe failed"},{status:503});
 }
}
