import {timingSafeEqual} from "node:crypto";
import {pollOwnerOrders} from "../../../../../lib/ownerWholesaleOrders.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
export async function GET(req){
 const key=String(process.env.CRON_SECRET||"");
 const value=String(req.headers.get("authorization")||"").replace(/^Bearer /,"");
 if(key.length<24||key.length!==value.length||!timingSafeEqual(Buffer.from(key),Buffer.from(value)))
  return Response.json({error:"Unauthorized"},{status:401,headers:{"cache-control":"no-store"}});
 try{return Response.json(await pollOwnerOrders(),{headers:{"cache-control":"no-store"}})}
 catch{return Response.json({error:"Private supplier polling unavailable"},{status:503,headers:{"cache-control":"no-store"}})}
}
