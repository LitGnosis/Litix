import {boosteroSQL,boosteroProductionReady} from "../../../../lib/boosteroFulfillment.mjs";
import {boosteroProduction} from "../../../../lib/boosteroReadOnly.mjs";
import {decodeTrackingToken} from "../../../../lib/litixFulfillmentSecurity.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=30;
const reply=(data,status=200)=>Response.json(data,{status,headers:{"cache-control":"private, no-store","referrer-policy":"no-referrer"}});
export async function POST(request){
 if(!boosteroProductionReady()||process.env.LITIX_AUTOMATED_FULFILLMENT_ENABLED!=="true")
  return reply({error:"Refill requests are temporarily unavailable"},503);
 if(request.headers.get("origin")!==new URL(request.url).origin)return reply({error:"same_origin_required"},403);
 let token;
 try{
  const raw=await request.text();
  if(Buffer.byteLength(raw)>1000)return reply({error:"Invalid request"},400);
  token=JSON.parse(raw).token;
 }catch{return reply({error:"Invalid request"},400);}
 const id=decodeTrackingToken(token);
 if(!id)return reply({error:"Invalid private tracking link"},401);
 const sql=boosteroSQL();
 try{
  const found=await sql.query(
   "select o.id,o.supplier_order_id,f.supplier_service_id,f.state from public.litix_v2_orders o join public.litix_boostero_fulfillment f on f.litix_order_id=o.id where o.id=$1 and o.payment_state='paid' and o.fulfillment_state='completed' and f.state='COMPLETED' and o.supplier_order_id is not null and f.supplier_order_id=o.supplier_order_id",
   [id]);
  if(found.length!==1)return reply({error:"This order is not eligible for a refill"},409);
  const order=found[0];
  const services=await boosteroProduction("services");
  const service=services.find(x=>String(x.service)===String(order.supplier_service_id));
  if(!(service?.refill===true||service?.refill===1||String(service?.refill)==="1"))
   return reply({error:"This service does not support API refills"},409);
  const claim=await sql.query(
   "insert into public.litix_refill_requests(litix_order_id,state) values($1,'requested') on conflict do nothing returning litix_order_id",
   [id]);
  if(!claim.length)return reply({accepted:true,alreadyRequested:true});
  // Recorded request is durable before attempting any supplier action.
  // Automatic refills are independently gated until merchant policy is approved.
  if(process.env.LITIX_AUTOMATED_REFILL_ENABLED!=="true")
   return reply({accepted:true,status:"requested",message:"Your refill request was recorded for a support review."},202);
  try{
   const response=await boosteroProduction("refill",{order:order.supplier_order_id},{adminApproved:true});
   const refillId=String(response?.refill||"");
   if(!/^\d{1,24}$/.test(refillId))throw Error("refill_outcome_unknown");
   await sql.query("update public.litix_refill_requests set state='submitted',supplier_refill_id=$2,updated_at=now() where litix_order_id=$1 and state='requested'",
    [id,refillId]);
   return reply({accepted:true,status:"submitted"});
  }catch{
   // The supplier may have processed the refill before disconnecting. Never resend blindly.
   await sql.query("update public.litix_refill_requests set state='review',updated_at=now() where litix_order_id=$1 and state='requested'",[id]).catch(()=>{});
   return reply({accepted:true,status:"review",message:"Your refill request needs verification. Do not submit it again."},202);
  }
 }catch{return reply({error:"Refill verification is temporarily unavailable"},503);}
}
