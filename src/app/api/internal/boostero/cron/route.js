import {timingSafeEqual} from "node:crypto";
import {syncBoosteroStatuses,boosteroProductionReady,deliverLitixCustomerUpdates} from "../../../../../lib/boosteroFulfillment.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
export async function GET(req){
 const expected=String(process.env.CRON_SECRET||"");
 const bearer=String(req.headers.get("authorization")||"").replace(/^Bearer /,"");
 if(expected.length<24||expected.length!==bearer.length||!timingSafeEqual(Buffer.from(expected),Buffer.from(bearer)))
  return Response.json({error:"Unauthorized"},{status:401,headers:{"cache-control":"no-store"}});
 if(!boosteroProductionReady())return Response.json({ok:true,skipped:"boostero_disabled"});
 try{
  const results=await syncBoosteroStatuses();
  const notifications=await deliverLitixCustomerUpdates({limit:5});
  return Response.json({ok:true,...results,customerNotifications:notifications},{headers:{"cache-control":"no-store"}});
 }catch{return Response.json({ok:false,error:"Private supplier polling unavailable"},{status:503,headers:{"cache-control":"no-store"}})}
}
