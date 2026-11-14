import {boosteroSQL,boosteroProductionReady} from "../../../../lib/boosteroFulfillment.mjs";
import {boosteroProduction} from "../../../../lib/boosteroReadOnly.mjs";
import {decodeTrackingToken} from "../../../../lib/litixFulfillmentSecurity.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=20;
const output=(body,status=200)=>Response.json(body,{status,headers:{"cache-control":"private, no-store","referrer-policy":"no-referrer","x-content-type-options":"nosniff"}});
export async function GET(request){
 const url=new URL(request.url);
 const id=decodeTrackingToken(url.searchParams.get("token")||"");
 if(!id)return output({error:"Invalid private tracking link"},401);
 try{
  const sql=boosteroSQL();
  const rows=await sql.query(
   "select o.id,o.service_name,o.quantity,o.amount_cents,o.payment_state,o.fulfillment_state,o.last_supplier_status,o.supplier_order_id,f.supplier_service_id,f.state as supplier_state,f.supplier_status from public.litix_v2_orders o join public.litix_boostero_fulfillment f on f.litix_order_id=o.id where o.id=$1 and o.payment_state='paid' and f.payment_mode='card'",
   [id]);
  if(rows.length!==1)return output({error:"Order not found"},404);
  const o=rows[0],state=String(o.fulfillment_state||"").toLowerCase();
  const details=o.supplier_status?.status?o.supplier_status:o.last_supplier_status||{};
  const remains=details.remains==null?null:Number(details.remains);
  const start=details.start_count==null?null:Number(details.start_count);
  const safeRemains=Number.isSafeInteger(remains)&&remains>=0&&remains<=Number(o.quantity)?remains:null;
  const safeStart=Number.isSafeInteger(start)&&start>=0?start:null;
  const needsReview=["failed","canceled","cancelled","manual_review","review","partial"].includes(state);
  const completed=state==="completed"&&safeRemains===0;
  let refillEligible=false;
  if(boosteroProductionReady()&&o.supplier_order_id&&completed){
   const prior=await sql.query("select state from public.litix_refill_requests where litix_order_id=$1",[id]);
   if(!prior.length){
    try{
     const services=await boosteroProduction("services");
     const item=services.find(x=>String(x.service)===String(o.supplier_service_id));
     refillEligible=item?.refill===true||item?.refill===1||String(item?.refill)==="1";
    }catch{}
   }
  }
  const progressStep=completed?4:needsReview?2:
   ["processing","in_progress"].includes(state)?3:o.supplier_order_id?2:1;
  return output({order:{
   id:o.id,service:o.service_name,quantity:Number(o.quantity),totalUSD:(Number(o.amount_cents)/100).toFixed(2),
   payment:"paid",status:details.status||state,startCount:safeStart,remains:safeRemains,
   checkedAt:details.checked_at||null,progressStep,refillEligible,reviewRequired:needsReview
  }});
 }catch{return output({error:"Tracking temporarily unavailable"},503);}
}
