import {createHash,timingSafeEqual} from "node:crypto";
import {dispatchPrepaidAutoLikes,syncPrepaidAutoLikes,prepaidAutoLikesEnabled} from "../../../../../lib/litixPrepaidAutoLikesFulfillment.mjs";
export const runtime="nodejs";export const dynamic="force-dynamic";export const maxDuration=60;
const send=(b,s=200)=>Response.json(b,{status:s,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
function authorized(req){
 const expected=String(process.env.CRON_SECRET||"");
 const got=String(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 if(expected.length<24||!got)return false;
 const h=s=>createHash("sha256").update(s).digest();
 return timingSafeEqual(h(expected),h(got));
}
export async function GET(req){
 if(!authorized(req))return send({error:"Unauthorized"},401);
 if(!prepaidAutoLikesEnabled())return send({ok:true,enabled:false,submitted:0});
 try{
  const dispatch=await dispatchPrepaidAutoLikes({limit:2});
  const tracking=await syncPrepaidAutoLikes({limit:10});
  return send({ok:true,enabled:true,dispatch,tracking});
 }catch{return send({ok:false,error:"Prepaid AutoLikes reconciliation unavailable"},503)}
}
