import {createHash,timingSafeEqual} from "node:crypto";
import {reconcileNativeAutoLikes,dispatchNativeAutoLikes,
 nativeAutoLikesReconcileReady,nativeAutoLikesDispatchReady,syncNativeAutoLikesStatuses} from "../../../../lib/nativeAutoLikesFulfillment.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const send=(body,status=200)=>Response.json(body,{status,headers:{"cache-control":"no-store"}});
const authorized=req=>{
 const expected=String(process.env.CRON_SECRET||""),actual=String(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 if(expected.length<24||!actual)return false;
 const sha=s=>createHash("sha256").update(s).digest();
 return timingSafeEqual(sha(expected),sha(actual));
};
export async function GET(req){
 if(!authorized(req))return send({error:"Unauthorized"},401);
 if(process.env.VERCEL_ENV!=="production")return send({ok:true,skipped:"not_production"});
 if(!nativeAutoLikesReconcileReady()||!nativeAutoLikesDispatchReady())
  return send({ok:true,enabled:false,reconcilerReady:nativeAutoLikesReconcileReady(),
   fulfillmentReady:nativeAutoLikesDispatchReady(),supplierOrders:0});
 try{
  const payments=await reconcileNativeAutoLikes({limit:3});
  // Only independently verified NMI receipts may open durable paid cycles.
  const supplier=await dispatchNativeAutoLikes({limit:2});
  const tracking=await syncNativeAutoLikesStatuses({limit:8});
  return send({ok:true,enabled:true,payments,supplier,tracking});
 }catch{
  return send({ok:false,error:"AutoLikes reconciliation requires review; existing orders unaffected"},503);
 }
}
