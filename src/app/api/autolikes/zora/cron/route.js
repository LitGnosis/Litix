import {createHash,timingSafeEqual} from "node:crypto";
import {dispatchZoraAutoLikes,syncZoraAutoLikes} from "../../../../../lib/litixZoraAutoLikesFulfillment.mjs";
import {zoraProviderConfigured} from "../../../../../lib/litixZoraAutoLikesSupplier.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const send=(data,status=200)=>Response.json(data,{status,headers:{"cache-control":"no-store"}});
function authorized(request){
 const secret=String(process.env.CRON_SECRET||"");
 const given=String(request.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 if(secret.length<24||!given)return false;
 const digest=x=>createHash("sha256").update(x).digest();
 return timingSafeEqual(digest(secret),digest(given));
}
export async function GET(request){
 if(!authorized(request))return send({error:"Unauthorized"},401);
 if(!zoraProviderConfigured())return send({ok:true,enabled:false,reason:"Supplier account is not verified or configured."});
 try{
  const dispatch=await dispatchZoraAutoLikes({limit:2});
  const tracking=await syncZoraAutoLikes({limit:10});
  return send({ok:true,enabled:true,dispatch,tracking});
 }catch{
  return send({ok:false,error:"Supplier reconciliation failed; inspect protected server logs."},503);
 }
}
