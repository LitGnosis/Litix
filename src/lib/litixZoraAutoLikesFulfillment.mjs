// Future supplier-managed AutoLikes order dispatch/reconciliation.
// An authenticated, scheduled worker must call these functions after the Zora
// account is configured and a real test proves future-post delivery.
// This module never charges a card and NEVER touches Boostero supplier orders.
import {randomUUID} from "node:crypto";
import {boosteroSQL} from "./boosteroFulfillment.mjs";
import {zoraProviderConfigured,zoraSupplier,quoteZoraPrepaid,zoraSubscriptionPayload} from "./litixZoraAutoLikesSupplier.mjs";

export async function dispatchZoraAutoLikes({
 sql=boosteroSQL(), supplier=zoraSupplier, env=process.env, limit=2
}={}){
 if(!zoraProviderConfigured(env))return {enabled:false,checked:0,submitted:0};
 const rows=await sql.query(
  "select z.litix_order_id,z.platform,z.service_id,z.wholesale_reserved_cents,p.target_profile_url,p.tier_id,p.posts_limit,p.likes_per_post,p.amount_cents,p.paid_at,p.period_end from public.litix_zora_autolikes_subscriptions z join public.litix_autolikes_prepaid_orders p on p.id=z.litix_order_id where z.state='QUEUED' and p.payment_status='PAID' and p.payment_transaction_id is not null and p.paid_at is not null and p.period_end>now() order by z.created_at asc limit $1",
  [Math.max(1,Math.min(Number(limit)||2,4))]);
 let submitted=0,manualReview=0,unknown=0;
 for(const order of rows){
  let params;
  try{
   const services=await supplier("services",{}, {env});
   const quote=quoteZoraPrepaid({services,platform:order.platform,profile:order.target_profile_url,
    tierId:order.tier_id,posts:Number(order.posts_limit)},env);
   if(quote.supplierServiceId!==order.service_id||
    quote.likesPerPost!==Number(order.likes_per_post)||
    quote.wholesaleCents>Number(order.wholesale_reserved_cents)||
    quote.amountCents>Number(order.amount_cents))throw Error("zora_price_or_service_changed");
   const balance=await supplier("balance",{}, {env});
   const reserved=await sql.query(
    "select coalesce(sum(wholesale_reserved_cents),0)::bigint cents from public.litix_zora_autolikes_subscriptions where state='SUBMITTED'");
   if(!Number.isFinite(Number(balance.balance))||
    Number(balance.balance)*100<Number(reserved[0]?.cents||0)+Number(order.wholesale_reserved_cents))
    throw Error("zora_insufficient_wallet");
   const start=new Date(order.paid_at);
   if(!Number.isFinite(start.getTime()))throw Error("zora_paid_date_missing");
   params=zoraSubscriptionPayload(quote,start);
  }catch{
   await sql.query(
    "update public.litix_zora_autolikes_subscriptions set state='MANUAL_REVIEW',error_code='PREFLIGHT_FAILED',updated_at=now() where litix_order_id=$1 and state='QUEUED'",
    [order.litix_order_id]).catch(()=>{});
   manualReview++;continue;
  }
  const claim=randomUUID();
  const selected=await sql.query(
   "update public.litix_zora_autolikes_subscriptions z set state='CLAIMED',claim_token=$2::uuid,updated_at=now() from public.litix_autolikes_prepaid_orders p where z.litix_order_id=$1 and z.litix_order_id=p.id and z.state='QUEUED' and p.payment_status='PAID' and p.payment_transaction_id is not null and p.paid_at is not null returning z.litix_order_id",
   [order.litix_order_id,claim]);
  if(!selected.length)continue;
  try{
   // API v2 does NOT support supplier-side idempotency, so NEVER auto-retry add.
   const result=await supplier("subscription",params,{claimed:true,platform:order.platform,env});
   const supplierId=String(result.order||"");
   const saved=await sql.query(
    "update public.litix_zora_autolikes_subscriptions set state='SUBMITTED',supplier_order_id=$3,supplier_status='Pending',updated_at=now() where litix_order_id=$1 and claim_token=$2::uuid and state='CLAIMED' returning litix_order_id",
    [order.litix_order_id,claim,supplierId]);
   if(!saved.length)throw Error("zora_supplier_order_storage_unknown");
   submitted++;
  }catch{
   await sql.query(
    "update public.litix_zora_autolikes_subscriptions set state='UNKNOWN_OUTCOME',error_code='SUPPLIER_RECONCILIATION_REQUIRED',updated_at=now() where litix_order_id=$1 and claim_token=$2::uuid and state='CLAIMED'",
    [order.litix_order_id,claim]).catch(()=>{});
   unknown++;
  }
 }
 return {enabled:true,checked:rows.length,submitted,manualReview,unknown};
}
export async function syncZoraAutoLikes({
 sql=boosteroSQL(),supplier=zoraSupplier,env=process.env,limit=10
}={}){
 if(!zoraProviderConfigured(env))return {enabled:false,checked:0};
 const rows=await sql.query(
  "select litix_order_id,supplier_order_id from public.litix_zora_autolikes_subscriptions where state='SUBMITTED' and supplier_order_id ~ '^[0-9]+$' order by last_checked_at asc nulls first limit $1",
  [Math.max(1,Math.min(Number(limit)||10,20))]);
 let updated=0,errors=0;
 for(const row of rows){
  try{
   const result=await supplier("status",{order:String(row.supplier_order_id)},{env});
   const status=String(result?.status||"");
   if(!/^(Pending|In progress|Processing|Completed|Partial|Canceled|Cancelled)$/i.test(status)){errors++;continue}
   const next=/^Completed$/i.test(status)?"COMPLETED":/^Cancel(l)?ed$/i.test(status)?"MANUAL_REVIEW":"SUBMITTED";
   await sql.query(
    "update public.litix_zora_autolikes_subscriptions set supplier_status=$2,state=$3,last_checked_at=now(),updated_at=now() where litix_order_id=$1 and state='SUBMITTED'",
    [row.litix_order_id,status,next]);
   updated++;
  }catch{errors++}
 }
 return {enabled:true,checked:rows.length,updated,errors};
}
