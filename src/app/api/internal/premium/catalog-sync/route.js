import {timingSafeEqual} from "node:crypto";
import {neon} from "@neondatabase/serverless";
import {boosteroReadOnly,boosteroProduction} from "../../../../../lib/boosteroReadOnly.mjs";
import {syncPremiumCatalog} from "../../../../../lib/boosteroPremiumSync.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
export async function GET(req){
 const expected=String(process.env.CRON_SECRET||"");
 const received=String(req.headers.get("authorization")||"").replace(/^Bearer /,"");
 if(expected.length<24||received.length!==expected.length||
    !timingSafeEqual(Buffer.from(received),Buffer.from(expected)))
  return Response.json({error:"Unauthorized"},{status:401,headers:{"cache-control":"no-store"}});
 const preview=process.env.VERCEL_ENV==="preview";
 if(!preview&&!(process.env.VERCEL_ENV==="production"&&process.env.LITIX_PREMIUM_BOOSTERO_LIVE==="true"))
  return Response.json({ok:true,skipped:"premium_not_released"});
 if(!process.env.LITIX_PREMIUM_DATABASE_URL)
  return Response.json({error:"Staging/catalog database unavailable"},{status:503});
 try{
  const raw=preview?await boosteroReadOnly("services"):await boosteroProduction("services");
  const result=await syncPremiumCatalog({raw,sql:neon(process.env.LITIX_PREMIUM_DATABASE_URL)});
  return Response.json({ok:true,...result},{headers:{"cache-control":"no-store"}});
 }catch(e){
  console.error("Premium supplier inventory sync failed",{error:String(e.message||"sync_failed").slice(0,80)});
  return Response.json({error:"Supplier sync failed; existing approvals preserved"},{status:503,headers:{"cache-control":"no-store"}});
 }
}