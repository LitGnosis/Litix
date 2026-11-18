import {randomUUID} from "node:crypto";
import {boosteroSQL,hashBoostero,boosteroProductionReady} from "../../../../lib/boosteroFulfillment.mjs";
import {boosteroProduction} from "../../../../lib/boosteroReadOnly.mjs";
import {curatedSupplierSnapshot} from "../../../../lib/curatedCatalog.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=45;
const headers={"cache-control":"private, no-store","referrer-policy":"no-referrer","x-robots-tag":"noindex"};
const send=(data,status=200)=>Response.json(data,{status,headers});
const apiRefill=row=>row?.refill===true||row?.refillable===true||String(row?.refill)==="1";
export async function POST(request){
 const origin=request.headers.get("origin");
 if(origin&&origin!==new URL(request.url).origin)return send({error:"Invalid request origin."},403);
 if(Number(request.headers.get("content-length")||0)>4000)return send({error:"Request is too large."},413);
 let body;try{body=await request.json()}catch{return send({error:"Invalid request."},400)}
 const id=String(body?.orderId||""),token=String(body?.token||"");
 if(!/^ltx2_[a-f0-9-]{36}$/.test(id)||token.length<25||token.length>150)
  return send({error:"Use your private Litix tracking link."},400);
 if(!boosteroProductionReady())return send({error:"Refills are temporarily unavailable. Contact Litix support."},503);
 const sql=boosteroSQL();
 let rows;
 try{rows=await sql.query(
  "select o.payment_state,f.state,f.supplier_service_id,f.supplier_order_id from public.litix_v2_orders o join public.litix_boostero_fulfillment f on f.litix_order_id=o.id where o.id=$1 and o.tracking_token_hash=$2",
  [id,hashBoostero(token)])}
 catch{return send({error:"Order verification temporarily unavailable."},503)}
 if(rows.length!==1)return send({error:"Order not found."},404);
 const row=rows[0];
 if(row.payment_state!=="paid"||row.state!=="COMPLETED"||
  !/^\d{1,12}$/.test(String(row.supplier_service_id||""))||
  !/^\d{1,24}$/.test(String(row.supplier_order_id||"")))
  return send({error:"This order is not currently eligible for a refill."},409);
 let service;
 try{
  const live=await curatedSupplierSnapshot();
  service=live.find(s=>String(s.service)===String(row.supplier_service_id));
 }catch{return send({error:"Refill eligibility cannot be verified. Try again later."},503)}
 if(!service||!apiRefill(service))return send({error:"A refill is not available for this service."},409);
 const attemptId="refill_"+randomUUID();
 // UNIQUE(litix_order_id,kind) ensures simultaneous taps or uncertain responses
 // cannot produce multiple provider actions.
 try{
  await sql.query("insert into public.litix_boostero_attempts (id,litix_order_id,kind,state) values($1,$2,'refill','STARTED')",
   [attemptId,id]);
 }catch{return send({error:"A refill has already been requested. Contact support if it needs review."},409)}
 try{
  const result=await boosteroProduction("refill",{order:String(row.supplier_order_id)},{adminApproved:true});
  const accepted=Boolean(result?.refill||result?.success===true);
  await sql.query("update public.litix_boostero_attempts set state=$2,finished_at=now(),error_code=$3 where id=$1",
   [attemptId,accepted?"CONFIRMED":"UNKNOWN_OUTCOME",accepted?null:"provider_response_unconfirmed"]);
  if(!accepted)return send({requested:false,requiresReview:true,message:"Your request needs Litix support review."},202);
  return send({requested:true,message:"Your refill request was submitted. Track your order for updates."},202);
 }catch{
  await sql.query("update public.litix_boostero_attempts set state='UNKNOWN_OUTCOME',error_code='needs_reconciliation',finished_at=now() where id=$1",
   [attemptId]).catch(()=>{});
  return send({requested:false,requiresReview:true,message:"Your request needs support review. Please do not submit it again."},202);
 }
}
