import {randomUUID} from "node:crypto";
import {boosteroProduction} from "./boosteroReadOnly.mjs";
import {boosteroSQL,boosteroProductionReady,dispatchBoostero,deliverLitixCustomerUpdates} from "./boosteroFulfillment.mjs";
import {queueCustomerDeliveryChange} from "./litixCustomerUpdates.mjs";
import {secureTrackUrl} from "./litixFulfillmentSecurity.mjs";

const ADMIN_EMAIL="litixsocial@gmail.com";
const guarded=()=>process.env.VERCEL_ENV==="production"&&
 process.env.LITIX_AUTOMATED_FULFILLMENT_ENABLED==="true"&&boosteroProductionReady();
const safePreDispatch=new Set(["boostero_insufficient_balance"]);
const number=(v)=>Number.isFinite(Number(v))?Number(v):null;

export async function sendLitixTransactionalEmail({to,subject,text,key,fetcher=fetch}){
 const token=process.env.RESEND_API_KEY||process.env.LITIX_RESEND_API_KEY;
 if(!token)throw Error("confirmation_email_unconfigured");
 const res=await fetcher("https://api.resend.com/emails",{
  method:"POST",cache:"no-store",redirect:"error",signal:AbortSignal.timeout(12000),
  headers:{"authorization":"Bearer "+token,"content-type":"application/json","Idempotency-Key":key},
  body:JSON.stringify({from:"Litix <orders@litix.net>",to:[to],subject,text})
 });
 if(!res.ok)throw Error("email_gateway_unavailable");
 return true;
}

/** Insert only for a recovered sale whose original checkout did not finish.
 * Normal completed checkouts already send an immediate boosteroNotice receipt.
 */
export async function recordCapturedCheckout(sql,{eventId,type,transactionId,orderId,amountCents,bodyHash}){
 const existing=await sql.query(
  "select o.id,o.payment_state,o.payment_transaction_id,o.amount_cents,f.payment_mode,f.state from public.litix_v2_orders o join public.litix_boostero_fulfillment f on f.litix_order_id=o.id where o.id=$1",
  [orderId]);
 if(existing.length!==1)return {accepted:false,reason:"unknown_order"};
 const order=existing[0];
 if(order.payment_mode!=="card"||Number(order.amount_cents)!==amountCents||
    (order.payment_transaction_id&&order.payment_transaction_id!==transactionId)||
    !["processing","review","paid"].includes(order.payment_state))
  return {accepted:false,reason:"payment_order_mismatch"};
 await sql.query(
  "insert into public.litix_paykings_webhook_events(event_id,transaction_id,order_id,event_type,body_sha256) values($1,$2,$3,$4,$5) on conflict(event_id) do nothing",
  [eventId,transactionId,orderId,type,bodyHash]);
 const changed=await sql.query(
  "with approved as (update public.litix_v2_orders o set payment_state='paid',payment_transaction_id=$2,updated_at=now() where o.id=$1 and o.amount_cents=$3 and o.payment_state in ('processing','review','paid') and (o.payment_transaction_id is null or o.payment_transaction_id=$2) and exists (select 1 from public.litix_boostero_fulfillment f where f.litix_order_id=o.id and f.payment_mode='card') returning o.id), queued as (update public.litix_boostero_fulfillment f set state='QUEUED',updated_at=now() where f.litix_order_id in (select id from approved) and f.state='PENDING_PAYMENT' returning f.litix_order_id) select id from approved",
  [orderId,transactionId,amountCents]);
 if(changed.length!==1)return {accepted:false,reason:"payment_conflict"};
 await sql.query(
  "update public.litix_paykings_webhook_events set state='processed',processed_at=now() where event_id=$1 and transaction_id=$2",
  [eventId,transactionId]);
 if(order.payment_state!=="paid"){
  await sql.query(
   "insert into public.litix_automation_confirmations(litix_order_id) values($1) on conflict do nothing",
   [orderId]);
 }
 return {accepted:true,recovered:order.payment_state!=="paid"};
}

export async function sendPendingConfirmations({sql=boosteroSQL(),limit=5}={}){
 let sent=0,failed=0;
 for(let i=0;i<limit;i++){
  const rows=await sql.query(
   "with selected as (select litix_order_id from public.litix_automation_confirmations where state='queued' and next_attempt_at<=now() and attempts<5 order by next_attempt_at limit 1 for update skip locked) update public.litix_automation_confirmations c set state='sending',attempts=attempts+1 from selected where c.litix_order_id=selected.litix_order_id returning c.litix_order_id,c.attempts");
  if(!rows.length)break;
  const item=rows[0];
  try{
   const o=await sql.query(
    "select id,email,service_name,quantity,amount_cents from public.litix_v2_orders where id=$1 and payment_state='paid'",
    [item.litix_order_id]);
   if(o.length!==1)throw Error("paid_order_missing");
   const data=o[0];
   const body=["Litix — Payment and order confirmed","Order number: "+data.id,
    "Service: "+data.service_name,"Quantity: "+Number(data.quantity).toLocaleString("en-US"),
    "Total paid: USD $"+(Number(data.amount_cents)/100).toFixed(2),
    "Track your order privately: "+secureTrackUrl(data.id),
    "If delivery is still processing, please do not purchase a duplicate order."].join("\n");
   await sendLitixTransactionalEmail({to:data.email,subject:"Litix — Payment confirmed and private tracking",
    text:body,key:"litix-automation-confirmation/"+data.id});
   await sql.query("update public.litix_automation_confirmations set state='sent',sent_at=now(),last_error=null where litix_order_id=$1 and state='sending'",[data.id]);
   sent++;
  }catch{
   failed++;
   await sql.query(
    "update public.litix_automation_confirmations set state=case when attempts>=5 then 'review' else 'queued' end,next_attempt_at=now()+interval '5 minutes',last_error='send_unavailable' where litix_order_id=$1 and state='sending'",
    [item.litix_order_id]).catch(()=>{});
  }
 }
 return {sent,failed};
}

export async function checkBoosteroBalance({operation=boosteroProduction,sql=boosteroSQL(),notify=true}={}){
 const b=await operation("balance");
 const amount=Number(b.balance);
 if(!Number.isFinite(amount)||amount<0)throw Error("supplier_balance_invalid");
 const low=amount<50;
 if(low&&notify){
  const inserted=await sql.query(
   "insert into public.litix_supplier_balance_alerts(alert_day,balance_usd) values(current_date,$1) on conflict do nothing returning alert_day",
   [amount]);
  if(inserted.length){
   try{
    await sendLitixTransactionalEmail({to:ADMIN_EMAIL,subject:"Litix — Boostero balance below $50",
     text:"Supplier balance is USD $"+amount.toFixed(2)+". Top up and inspect outstanding paid orders. Litix does not automatically charge a wallet.",
     key:"litix-balance-alert/"+new Date().toISOString().slice(0,10)});
    await sql.query("update public.litix_supplier_balance_alerts set state='sent' where alert_day=current_date");
   }catch{
    await sql.query("update public.litix_supplier_balance_alerts set state='review' where alert_day=current_date").catch(()=>{});
   }
  }
 }
 return {low,balance:amount,currency:String(b.currency||"USD")};
}

export async function resumeSafeBoosteroDispatch({sql=boosteroSQL(),dispatch=dispatchBoostero,limit=5}={}){
 if(!guarded())return {disabled:true};
 // Recovery may requeue ONLY a definite failure before the supplier add call.
 // Timeout, crash after add, and UNKNOWN_OUTCOME must NEVER be repeated.
 const candidates=await sql.query(
  "select f.litix_order_id,f.state,f.error_code,f.attempted_at,(select count(*)::integer from public.litix_boostero_attempts a where a.litix_order_id=f.litix_order_id and a.kind='add') as attempts from public.litix_boostero_fulfillment f join public.litix_v2_orders o on o.id=f.litix_order_id where o.payment_state='paid' and o.payment_transaction_id is not null and o.metadata->>'supplier'='boostero' and f.payment_mode='card' and f.supplier_order_id is null and ((f.state='QUEUED') or (f.state='REJECTED' and f.error_code='boostero_insufficient_balance')) order by f.updated_at asc limit $1",
  [Math.min(limit,10)]);
 let submitted=0,review=0,waiting=0;
 for(const item of candidates){
  const attempts=Number(item.attempts||0);
  if(attempts>=3){
   await sql.query("update public.litix_boostero_fulfillment set state='MANUAL_REVIEW',error_code='max_safe_attempts_reached',updated_at=now() where litix_order_id=$1 and state in('REJECTED','QUEUED') and supplier_order_id is null",[item.litix_order_id]);
   await sql.query(
    "insert into public.litix_automation_reviews(litix_order_id,reason) values($1,'max_safe_attempts_reached') on conflict do nothing",
    [item.litix_order_id]);
   review++;continue;
  }
  if(item.state==="REJECTED"){
   if(!safePreDispatch.has(item.error_code)){review++;continue;}
   const elapsed=Date.now()-new Date(item.attempted_at||0).getTime();
   const backoff=120000*2**Math.max(0,attempts-1);
   if(elapsed<backoff){waiting++;continue;}
   const changed=await sql.query(
    "update public.litix_boostero_fulfillment set state='QUEUED',updated_at=now() where litix_order_id=$1 and state='REJECTED' and error_code='boostero_insufficient_balance' and supplier_order_id is null returning litix_order_id",
    [item.litix_order_id]);
   if(!changed.length)continue;
  }
  const outcome=await dispatch(item.litix_order_id,{sql}).catch(()=>({submitted:false,state:"UNKNOWN_OUTCOME"}));
  if(outcome.submitted)submitted++;
  if(outcome.state==="UNKNOWN_OUTCOME")review++;
 }
 return {checked:candidates.length,submitted,review,waiting};
}

export async function syncLitixBoosteroOrders({sql=boosteroSQL(),operation=boosteroProduction,limit=40}={}){
 if(!boosteroProductionReady())return {disabled:true};
 const records=await sql.query(
  "select f.litix_order_id,f.supplier_order_id,f.supplier_status,o.quantity,o.supplier_cost_cents from public.litix_boostero_fulfillment f join public.litix_v2_orders o on o.id=f.litix_order_id where f.state='SUBMITTED' and f.supplier_order_id is not null and o.payment_state='paid' and (f.checked_at is null or f.checked_at<now()-interval '2 minutes') order by f.checked_at nulls first limit $1",
  [Math.min(100,Math.max(1,limit))]);
 if(!records.length)return {checked:0,failed:0,review:0};
 const ids=records.map(r=>String(r.supplier_order_id));
 const result=await operation("status",{orders:ids});
 let checked=0,failed=0,review=0;
 for(const item of records){
  const data=result[String(item.supplier_order_id)];
  const name=String(data?.status||"").toLowerCase().trim();
  const valid=["pending","processing","in progress","in_progress","completed","complete","partial","canceled","cancelled"].includes(name);
  if(!valid){failed++;continue;}
  const remains=data.remains===null||data.remains===undefined?null:Number(data.remains);
  const start=data.start_count===null||data.start_count===undefined?null:Number(data.start_count);
  if(remains!==null&&(!Number.isSafeInteger(remains)||remains<0||remains>Number(item.quantity))){failed++;continue;}
  const snapshot={provider:"boostero",status:String(data.status).slice(0,75),start_count:Number.isSafeInteger(start)?start:null,
   remains,charge:Number.isFinite(Number(data.charge))?String(data.charge):null,checked_at:new Date().toISOString()};
  const final=["completed","complete"].includes(name)&&remains===0;
  const needsReview=["canceled","cancelled","partial"].includes(name)||(["completed","complete"].includes(name)&&remains!==0);
  const state=needsReview?"MANUAL_REVIEW":final?"COMPLETED":"SUBMITTED";
  try{
   await queueCustomerDeliveryChange({sql,orderId:item.litix_order_id,
    supplierOrderId:item.supplier_order_id,previous:item.supplier_status,latest:snapshot,
    state,quantity:Number(item.quantity)});
   await sql.query(
    "update public.litix_boostero_fulfillment set state=$3,supplier_status=$4::jsonb,checked_at=now(),updated_at=now() where litix_order_id=$1 and supplier_order_id=$2 and state='SUBMITTED'",
    [item.litix_order_id,item.supplier_order_id,state,JSON.stringify(snapshot)]);
   await sql.query(
    "update public.litix_v2_orders set fulfillment_state=$3,last_supplier_status=$4::jsonb,updated_at=now() where id=$1 and supplier_order_id=$2 and payment_state='paid'",
    [item.litix_order_id,item.supplier_order_id,needsReview?"manual_review":final?"completed":"processing",JSON.stringify(snapshot)]);
   if(needsReview){
    const charge=number(data.charge);
    const estimate=charge!==null&&remains!==null&&Number(item.quantity)>0?
      Number((charge*remains/Number(item.quantity)).toFixed(5)):null;
    await sql.query(
     "insert into public.litix_automation_reviews(litix_order_id,reason,supplier_order_id,supplier_status,remains,supplier_charge_usd,estimated_supplier_credit_usd) values($1,$2,$3,$4,$5,$6,$7) on conflict(litix_order_id,reason) do update set remains=excluded.remains,supplier_status=excluded.supplier_status,estimated_supplier_credit_usd=excluded.estimated_supplier_credit_usd,updated_at=now()",
     [item.litix_order_id,name,item.supplier_order_id,data.status,remains,charge,estimate]);
    review++;
   }
   checked++;
  }catch{failed++;}
 }
 return {checked,failed,review};
}
export async function runFulfillmentMaintenance({sql=boosteroSQL()}={}){
 if(!guarded())return {disabled:true};
 const balance=await checkBoosteroBalance({sql}).catch(()=>({unavailable:true}));
 const dispatch=await resumeSafeBoosteroDispatch({sql}).catch(()=>({failed:true}));
 const tracking=await syncLitixBoosteroOrders({sql}).catch(()=>({failed:true}));
 const confirmations=await sendPendingConfirmations({sql}).catch(()=>({failed:true}));
 const updates=await deliverLitixCustomerUpdates({sql,limit:5}).catch(()=>({failed:true}));
 return {balance,dispatch,tracking,confirmations,updates};
}
