// Litix native AutoLikes prepaid fulfillment. All supplier operations require a
// durable paid order and atomic one-time claim; ambiguous results are NEVER retried.
import {randomUUID} from "node:crypto";
import {boosteroProduction} from "./boosteroReadOnly.mjs";
import {boosteroSQL,boosteroProductionReady} from "./boosteroFulfillment.mjs";
import {quotePrepaidAutoLikes,prepaidNativeSupplierParams} from "./litixPrepaidAutoLikes.mjs";
export const prepaidAutoLikesEnabled=()=>process.env.VERCEL_ENV==="production"&&
 process.env.LITIX_AUTOLIKES_PREPAID_ENABLED==="true"&&
 !!process.env.NMI_SECURITY_KEY&&boosteroProductionReady();
export async function dispatchPrepaidAutoLikes({
 sql=boosteroSQL(),supplier=boosteroProduction,limit=2
}={}){
 if(!prepaidAutoLikesEnabled())return {enabled:false,attempts:0};
 const pending=await sql.query(
  "select id,service_id,platform,target_profile_url,likes_per_post,posts_limit,tier_id,amount_cents,wholesale_reserved_cents,period_end from public.litix_autolikes_prepaid_orders where payment_status='PAID' and fulfillment_state='QUEUED' and period_end>now() order by created_at asc limit $1",
  [Math.max(1,Math.min(4,limit))]);
 let submitted=0,review=0,unknown=0;
 for(const order of pending){
  let params;
  try{
   const services=await supplier("services");
   const selected=services.find(s=>String(s.service??s.id)===order.service_id);
   const quote=quotePrepaidAutoLikes({services:selected?[selected]:[],platform:order.platform,
    profile:order.target_profile_url,tierId:order.tier_id,posts:Number(order.posts_limit)});
   if(quote.supplierServiceId!==order.service_id||
    quote.likesPerPost!==Number(order.likes_per_post)||
    quote.wholesaleCents>Number(order.wholesale_reserved_cents)||
    quote.amountCents>Number(order.amount_cents))throw Error("price_changed");
   const wallet=await supplier("balance");
   // Boostero collects wholesale as each post arrives. Reserve enough visible
   // balance for this entire plan plus other already-submitted live plans.
   const reserved=await sql.query(
    "select coalesce(sum(wholesale_reserved_cents),0)::bigint as cents from public.litix_autolikes_prepaid_orders where fulfillment_state='SUBMITTED' and period_end>now()");
   const held=Number(reserved[0]?.cents||0);
   if(!Number.isFinite(Number(wallet.balance))||Number(wallet.balance)<(held+Number(order.wholesale_reserved_cents))/100)
    throw Error("balance_not_reserved");
   params=prepaidNativeSupplierParams(quote,new Date(order.period_end).getTime()-30*86400000);
  }catch{
   await sql.query(
    "update public.litix_autolikes_prepaid_orders set fulfillment_state='MANUAL_REVIEW',error_code='SERVICE_OR_WALLET_PREFLIGHT',updated_at=now() where id=$1 and fulfillment_state='QUEUED'",
    [order.id]).catch(()=>{});
   review++;continue;
  }
  const claim=randomUUID();
  const won=await sql.query(
   "update public.litix_autolikes_prepaid_orders set fulfillment_state='CLAIMED',claim_token=$2::uuid,updated_at=now() where id=$1 and fulfillment_state='QUEUED' and payment_status='PAID' and payment_transaction_id is not null and paid_at is not null and period_end>now() returning id",
   [order.id,claim]);
  if(!won.length)continue;
  try{
   const result=await supplier("prepaid_subscription",params,{claimed:true});
   const supplierOrder=String(result.order||"");
   if(!/^\d{1,24}$/.test(supplierOrder))throw Error("supplier_order_not_confirmed");
   const stored=await sql.query(
    "update public.litix_autolikes_prepaid_orders set fulfillment_state='SUBMITTED',supplier_order_id=$3,supplier_status='Pending',updated_at=now() where id=$1 and claim_token=$2::uuid and fulfillment_state='CLAIMED' returning id",
    [order.id,claim,supplierOrder]);
   if(!stored.length)throw Error("supplier_order_storage_unknown");
   submitted++;
  }catch{
   // The supplier may have accepted the request even on timeout. Block repeats.
   await sql.query(
    "update public.litix_autolikes_prepaid_orders set fulfillment_state='UNKNOWN_OUTCOME',error_code='SUPPLIER_RECONCILIATION_REQUIRED',updated_at=now() where id=$1 and claim_token=$2::uuid and fulfillment_state='CLAIMED'",
    [order.id,claim]).catch(()=>{});
   unknown++;
  }
 }
 return {enabled:true,checked:pending.length,submitted,manualReview:review,unknown};
}
export async function syncPrepaidAutoLikes({sql=boosteroSQL(),supplier=boosteroProduction,limit=8}={}){
 if(!prepaidAutoLikesEnabled())return {enabled:false,checked:0};
 const rows=await sql.query(
  "select id,supplier_order_id from public.litix_autolikes_prepaid_orders where fulfillment_state='SUBMITTED' and supplier_order_id ~ '^[0-9]+$' order by last_checked_at asc nulls first limit $1",
  [Math.max(1,Math.min(20,limit))]);
 let updated=0,errors=0;
 for(const row of rows){
  try{
   const state=await supplier("status",{order:String(row.supplier_order_id)});
   const status=String(state?.status||"");
   if(!/^(Pending|In progress|Processing|Completed|Partial|Canceled|Cancelled)$/i.test(status)){errors++;continue}
   const next=/^Completed$/i.test(status)?"COMPLETED":/^Cancel(l)?ed$/i.test(status)?"MANUAL_REVIEW":"SUBMITTED";
   await sql.query(
    "update public.litix_autolikes_prepaid_orders set supplier_status=$2,fulfillment_state=$3,last_checked_at=now(),updated_at=now() where id=$1 and fulfillment_state='SUBMITTED'",
    [row.id,status,next]);
   updated++;
  }catch{errors++}
 }
 return {enabled:true,checked:rows.length,updated,errors};
}
