import {createHash,timingSafeEqual} from "node:crypto";
import {runFulfillmentMaintenance} from "../../../../lib/litixFulfillmentAutomation.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const sha=v=>createHash("sha256").update(String(v)).digest();
export function authorizedCron(request,secret=process.env.CRON_SECRET){
 const received=String(request.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 return typeof secret==="string"&&secret.length>=24&&received.length>=24&&
  timingSafeEqual(sha(secret),sha(received));
}
export async function GET(request){
 if(!authorizedCron(request))return Response.json({error:"unauthorized"},{status:401});
 if(process.env.VERCEL_ENV!=="production")return Response.json({disabled:true,environment:"nonproduction"});
 try{
  const outcomes=await runFulfillmentMaintenance();
  return Response.json(outcomes,{headers:{"cache-control":"no-store"}});
 }catch{
  return Response.json({error:"maintenance_unavailable"},{status:503});
 }
}
