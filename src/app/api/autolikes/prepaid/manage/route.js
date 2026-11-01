import {createHash} from "node:crypto";
import {boosteroSQL} from "../../../../../lib/boosteroFulfillment.mjs";
export const runtime="nodejs";export const dynamic="force-dynamic";
const sha=s=>createHash("sha256").update(s).digest("hex");
const send=(x,status=200)=>Response.json(x,{status,headers:{"cache-control":"private, no-store","referrer-policy":"no-referrer","x-content-type-options":"nosniff"}});
export async function GET(req){
 const token=String(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 if(!/^[0-9a-f-]{73}$/i.test(token))return send({error:"Invalid private order access"},401);
 try{
  const db=boosteroSQL();
  const rows=await db.query(
   "select id,platform,target_profile_url,likes_per_post,posts_limit,amount_cents,payment_status,fulfillment_state,supplier_status,paid_at,period_end,created_at from public.litix_autolikes_prepaid_orders where public_token_hash=$1 limit 1",
   [sha(token)]);
  const r=rows[0];if(!r)return send({error:"Private order not found"},404);
  const state=String(r.fulfillment_state||"");
  return send({order:{
   id:r.id,platform:r.platform,profile:r.target_profile_url,
   likesPerPost:Number(r.likes_per_post),coveredPosts:Number(r.posts_limit),
   paidAmountCents:Number(r.amount_cents),
   payment:r.payment_status,
   status:state==="SUBMITTED"?"Processing":state==="COMPLETED"?"Completed":
    state==="QUEUED"?"Preparing":state==="EXPIRED"?"Expired":
    ["MANUAL_REVIEW","UNKNOWN_OUTCOME"].includes(state)?"Needs support review":
    state==="CLAIMED"?"Activating":r.payment_status==="PAID"?"Preparing":"Payment review",
   deliveryStatus:/^(Pending|In progress|Processing|Completed|Partial|Canceled|Cancelled)$/i.test(String(r.supplier_status||""))?r.supplier_status:null,
   purchasedAt:r.created_at,paidAt:r.paid_at,expiresAt:r.period_end,
   renewsAutomatically:false
  }});
 }catch{return send({error:"Private tracking temporarily unavailable"},503)}
}
