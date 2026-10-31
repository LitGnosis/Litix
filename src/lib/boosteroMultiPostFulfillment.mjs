import {randomUUID} from "node:crypto";
import {boosteroSQL,boosteroProductionReady,verifyBoosteroQuote} from "./boosteroFulfillment.mjs";
import {boosteroProduction} from "./boosteroReadOnly.mjs";
import {boosteroQuote} from "./boosteroFulfillment.mjs";

// Only invoked after a parent order was inserted and before the one PayKings charge.
// One SQL command stages all selected canonical URLs. An absent schema fails closed.
export async function stageBoosteroPostChildren(orderId,serviceId,posts,{sql=boosteroSQL()}={}){
 if(!/^ltx2_[a-f0-9-]{36}$/.test(String(orderId))||!/^\d{1,12}$/.test(String(serviceId))||
    !Array.isArray(posts)||posts.length<2||posts.length>5)throw Error("invalid_post_ledger_input");
 const payload=posts.map((p,i)=>({ordinal:i+1,destination:p.link,quantity:p.quantity,retail_cents:p.amountCents}));
 const rows=await sql.query(
  "insert into public.litix_boostero_multi_posts(parent_order_id,ordinal,supplier_service_id,destination,quantity,retail_cents,state) select $1,(p->>'ordinal')::smallint,$2,p->>'destination',(p->>'quantity')::int,(p->>'retail_cents')::int,'PENDING_PAYMENT' from jsonb_array_elements($3::jsonb) p on conflict do nothing returning ordinal",
  [orderId,String(serviceId),JSON.stringify(payload)]);
 if(rows.length!==posts.length)throw Error("post_ledger_incomplete_no_charge");
 return true;
}

// This is a *separate* paid-state verification; an unapproved or ambiguous
// gateway response cannot enqueue or dispatch any child to the supplier.
export async function releasePaidBoosteroPosts(orderId,{sql=boosteroSQL()}={}){
 const rows=await sql.query(
  "update public.litix_boostero_multi_posts p set state='QUEUED',updated_at=now() where p.parent_order_id=$1 and p.state='PENDING_PAYMENT' and exists(select 1 from public.litix_v2_orders o where o.id=p.parent_order_id and o.payment_state='paid' and o.payment_transaction_id is not null and o.metadata->>'supplier'='boostero') returning p.ordinal",
  [orderId]);
 return rows.length;
}

export async function dispatchBoosteroPost(orderId,ordinal,{sql=boosteroSQL(),operation=boosteroProduction,quote=verifyBoosteroQuote}={}){
 if(!boosteroProductionReady())throw Error("boostero_live_not_enabled");
 if(!Number.isSafeInteger(ordinal)||ordinal<1||ordinal>5)throw Error("invalid_post_ordinal");
 const attempt=randomUUID();
 // Durable, one-way atomic claim. Payment must be verified on the parent.
 // A claimed post is NEVER auto-retried after a network timeout.
 const claimed=await sql.query(
  "update public.litix_boostero_multi_posts p set state='DISPATCHING',attempt_id=$3,attempted_at=now(),updated_at=now() where p.parent_order_id=$1 and p.ordinal=$2 and p.state='QUEUED' and p.attempt_id is null and p.supplier_order_id is null and exists(select 1 from public.litix_v2_orders o where o.id=p.parent_order_id and o.payment_state='paid' and o.payment_transaction_id is not null and o.metadata->>'supplier'='boostero') returning p.supplier_service_id,p.destination,p.quantity,p.retail_cents",
  [orderId,ordinal,attempt]);
 if(claimed.length!==1)return {ordinal,state:"NOT_CLAIMED",submitted:false};
 const item=claimed[0];
 let supplierCalled=false;
 try{
  // Recheck current service, costs and available wallet balance immediately
  // before each individual supplier purchase.
  const {quote:verified,service}=await quote(String(item.supplier_service_id),Number(item.quantity),sql);
  const live=boosteroQuote({service,quantity:Number(item.quantity)});
  // A paid child keeps its charged historical price when catalog floors rise.
  // No supplier add occurs unless its charged amount still covers 160% of live wholesale.
  if(Number(item.retail_cents)<Math.ceil(live.costUSD*160-1e-8)||verified.serviceId!==String(item.supplier_service_id))
   throw Error("supplier_retail_not_covered");
  const balance=await operation("balance");
  if(!Number.isFinite(Number(balance.balance))||Number(balance.balance)<live.costUSD)
   throw Error("supplier_balance_insufficient");
  supplierCalled=true;
  const receipt=await operation("add",{
   service:String(item.supplier_service_id),link:item.destination,quantity:Number(item.quantity)
  },{claimed:true});
  if(!/^[0-9]{1,24}$/.test(String(receipt.order||"")))throw Error("supplier_unconfirmed");
  const rows=await sql.query(
   "update public.litix_boostero_multi_posts set state='SUBMITTED',supplier_order_id=$4,supplier_status=$5::jsonb,updated_at=now() where parent_order_id=$1 and ordinal=$2 and state='DISPATCHING' and attempt_id=$3 returning ordinal",
   [orderId,ordinal,attempt,String(receipt.order),JSON.stringify({status:"Pending"})]);
  if(rows.length!==1)throw Error("supplier_receipt_storage_uncertain");
  return {ordinal,state:"SUBMITTED",submitted:true};
 }catch(error){
  const code=String(error?.message||"unknown").slice(0,90);
  // Once any network add is attempted, even a 500/timeout is ambiguous.
  // No automatic retry. Owner must reconcile with the provider.
  const state=supplierCalled?"UNKNOWN_OUTCOME":"MANUAL_REVIEW";
  await sql.query(
   "update public.litix_boostero_multi_posts set state=$4,error_code=$5,updated_at=now() where parent_order_id=$1 and ordinal=$2 and state='DISPATCHING' and attempt_id=$3",
   [orderId,ordinal,attempt,state,code]).catch(()=>{});
  return {ordinal,state,submitted:false,requiresReview:true};
 }
}

export async function dispatchBoosteroMultiPosts(orderId,{sql=boosteroSQL(),operation=boosteroProduction,quote=verifyBoosteroQuote}={}){
 const rows=await sql.query(
  "select ordinal from public.litix_boostero_multi_posts where parent_order_id=$1 and state='QUEUED' order by ordinal limit 5",[orderId]);
 // Use bounded parallel requests. Each unique child is individually
 // claimed. No supplier operation runs for an unverified paid parent.
 const settled=await Promise.allSettled(rows.map(({ordinal})=>
  dispatchBoosteroPost(orderId,Number(ordinal),{sql,operation,quote})));
 const statuses=settled.map((s,i)=>s.status==="fulfilled"?s.value:{ordinal:Number(rows[i].ordinal),state:"UNKNOWN_OUTCOME",submitted:false});
 const after=await sql.query(
  "select state from public.litix_boostero_multi_posts where parent_order_id=$1 order by ordinal limit 5",[orderId]);
 const complete=after.length>=2&&after.every(p=>p.state==="SUBMITTED"||p.state==="COMPLETED");
 // Parent fulfillment never advertises fully submitted until ALL children have
 // confirmed supplier IDs. Partial/unknown outcomes require owner reconciliation.
 const parentState=complete?"submitted":"manual_review";
 await sql.query(
  "update public.litix_v2_orders set fulfillment_state=$2,updated_at=now() where id=$1 and payment_state='paid'",
  [orderId,parentState]).catch(()=>{});
 await sql.query(
  "update public.litix_boostero_fulfillment set state=$2,updated_at=now() where litix_order_id=$1 and state='MANUAL_REVIEW'",
  [orderId,complete?"SUBMITTED":"MANUAL_REVIEW"]).catch(()=>{});
 return {submitted:complete,state:complete?"MULTI_SUBMITTED":"MANUAL_REVIEW",posts:statuses,requiresReview:!complete};
}


// Existing owner-authenticated Litix cron can call this as bounded, read-only
// status polling. Never creates supplier orders or card charges.
export async function syncBoosteroMultiStatuses({sql=boosteroSQL(),operation=boosteroProduction,limit=8}={}){
 if(!boosteroProductionReady())return {checked:0,failed:0,skipped:"boostero_disabled"};
 const batch=await sql.query(
  "select parent_order_id,ordinal,supplier_order_id from public.litix_boostero_multi_posts where state='SUBMITTED' and supplier_order_id is not null and (checked_at is null or checked_at<now()-interval '15 minutes') order by checked_at nulls first limit $1",
  [Math.min(8,Math.max(1,Number(limit)||8))]);
 let checked=0,failed=0;
 for(const item of batch){
  try{
   const result=await operation("status",{order:String(item.supplier_order_id)});
   const status=String(result?.status||"").toLowerCase();
   const state=status==="completed"?"COMPLETED":
    ["canceled","cancelled","failed","error"].includes(status)?"MANUAL_REVIEW":"SUBMITTED";
   const saved=await sql.query(
    "update public.litix_boostero_multi_posts set state=$4,supplier_status=$5::jsonb,error_code=NULL,checked_at=now(),updated_at=now() where parent_order_id=$1 and ordinal=$2 and supplier_order_id=$3 and state='SUBMITTED' returning parent_order_id",
    [item.parent_order_id,item.ordinal,item.supplier_order_id,state,JSON.stringify({status:result?.status||"Unknown",remains:result?.remains??null})]);
   if(!saved.length)continue;
   const summary=await sql.query(
    "select state from public.litix_boostero_multi_posts where parent_order_id=$1",[item.parent_order_id]);
   if(summary.length>=2&&summary.every(p=>p.state==="COMPLETED")){
    await sql.query("update public.litix_v2_orders set fulfillment_state='completed',updated_at=now() where id=$1 and payment_state='paid'",[item.parent_order_id]);
    await sql.query("update public.litix_boostero_fulfillment set state='COMPLETED',updated_at=now() where litix_order_id=$1 and state in('SUBMITTED','MANUAL_REVIEW')",[item.parent_order_id]);
   }else if(state==="MANUAL_REVIEW"){
    await sql.query("update public.litix_v2_orders set fulfillment_state='manual_review',updated_at=now() where id=$1 and payment_state='paid'",[item.parent_order_id]);
    await sql.query("update public.litix_boostero_fulfillment set state='MANUAL_REVIEW',updated_at=now() where litix_order_id=$1",[item.parent_order_id]);
   }
   checked++;
  }catch(error){
   failed++;
   // Supplier response failures never make the order eligible for another add.
   // Keep the existing supplier ID and SUBMITTED state for reconciliation.
   const reason=String(error?.message||"");
   const code=/unauthorized|auth|key_unconfigured|provider_rejected/.test(reason)?
    "status_auth_or_provider_rejected":/timeout|network|http_/.test(reason)?
    "status_transport_unavailable":/invalid_json/.test(reason)?
    "status_invalid_supplier_response":"status_poll_unavailable";
   await sql.query(
    "update public.litix_boostero_multi_posts set error_code=$4 where parent_order_id=$1 and ordinal=$2 and supplier_order_id=$3 and state='SUBMITTED'",
    [item.parent_order_id,item.ordinal,item.supplier_order_id,code]).catch(()=>{});
  }
 }
 return {checked,failed};
}


// Scheduled continuation for paid children left QUEUED after a process crash.
// Never touches claimed DISPATCHING, SUBMITTED or unknown-outcome rows.
export async function resumeBoosteroMultiQueue({sql=boosteroSQL(),limitParents=1}={}){
 if(!boosteroProductionReady())return {resumed:0,skipped:"boostero_disabled"};
 const parents=await sql.query(
  "select distinct p.parent_order_id from public.litix_boostero_multi_posts p join public.litix_v2_orders o on o.id=p.parent_order_id where p.state='QUEUED' and o.payment_state='paid' and o.payment_transaction_id is not null and o.metadata->>'supplier'='boostero' order by p.parent_order_id limit $1",
  [Math.min(2,Math.max(1,Number(limitParents)||1))]);
 let resumed=0,failed=0;
 for(const {parent_order_id} of parents){
  try{await dispatchBoosteroMultiPosts(parent_order_id,{sql});resumed++}
  catch{failed++}
 }
 return {resumed,failed};
}
