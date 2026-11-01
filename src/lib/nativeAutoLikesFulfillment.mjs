// Safe server-only monthly AutoLikes reconciliation and native Boostero fulfillment.
// NMI query is READ-ONLY. Supplier "add" occurs at most once per paid cycle.
// No worker executes without both explicit production gates.
import {createHash,randomUUID} from "node:crypto";
import {boosteroSQL,boosteroProductionReady} from "./boosteroFulfillment.mjs";
import {boosteroProduction} from "./boosteroReadOnly.mjs";
import {nativeAutoLikesQuote,nativeAutoLikesSupplierParams} from "./boosteroNativeAutoLikes.mjs";
import {parseNmiTransactionEvidence,paidPeriodEnd} from "./nmiQueryEvidence.mjs";
const hash=s=>createHash("sha256").update(String(s)).digest("hex");
const digits=s=>/^\d{1,30}$/.test(String(s));
const credentialReady=()=>process.env.NMI_SECURITY_KEY&&process.env.NMI_SECURITY_KEY.length>=16;
export const nativeAutoLikesReconcileReady=()=>process.env.VERCEL_ENV==="production"&&
 process.env.LITIX_AUTOLIKES_NMI_RECONCILE_ENABLED==="true"&&
 process.env.LITIX_NMI_RECURRING_MERCHANT_APPROVED==="true"&&!!credentialReady()&&!!process.env.LITIX_BOOSTERO_DATABASE_URL;
export const nativeAutoLikesDispatchReady=()=>process.env.VERCEL_ENV==="production"&&
 process.env.LITIX_AUTOLIKES_DISPATCH_ENABLED==="true"&&boosteroProductionReady()&&
 nativeAutoLikesReconcileReady();

export async function queryNmiAutoLikesTransactions(subscriptionId,amountCents,{fetcher=fetch}={}){
 if(!digits(subscriptionId)||!Number.isSafeInteger(amountCents)||amountCents<100||amountCents>2000000||
  !credentialReady())throw Error("nmi_subscription_query_not_authorized");
 let response;
 try{
  response=await fetcher("https://paykings.transactiongateway.com/api/query.php",{
   method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},
   body:new URLSearchParams({security_key:process.env.NMI_SECURITY_KEY,
    subscription_id:String(subscriptionId),source:"recurring",condition:"complete",report_type:"transaction"}).toString(),
   cache:"no-store",redirect:"error",signal:AbortSignal.timeout(15000)
  });
 }catch{throw Error("nmi_subscription_query_unavailable");}
 if(!response.ok)throw Error("nmi_subscription_query_http_error");
 const xml=await response.text();
 return parseNmiTransactionEvidence(xml,subscriptionId,amountCents);
}
export function nativeCycleEvidence(transaction,subscription){
 if(!transaction||!digits(transaction.transactionId)||!digits(transaction.subscriptionId)||
  transaction.subscriptionId!==String(subscription.provider_subscription_id))return null;
 const when=new Date(transaction.paidAt),created=new Date(subscription.created_at);
 if(!Number.isFinite(when.getTime())||!Number.isFinite(created.getTime())||
  when.getTime()<created.getTime()-5*60000||when.getTime()>Date.now()+120000)return null;
 const expiresAt=paidPeriodEnd(transaction.paidAt),expires=new Date(expiresAt);
 if(expires.getTime()<=Date.now()||expires.getTime()>Date.now()+40*86400000)return null;
 return {transactionId:transaction.transactionId,subscriptionId:String(subscription.id),
  paidAt:transaction.paidAt,periodKey:transaction.paidAt.slice(0,7),
  expiresAt,amountCents:Number(subscription.amount_cents),
  eventId:"nmiq_"+hash(transaction.transactionId).slice(0,48),
  cycleId:"alnc_"+hash(String(subscription.id)+":"+transaction.paidAt.slice(0,7)).slice(0,40)};
}
export async function reconcileNativeAutoLikes({sql=boosteroSQL(),query=queryNmiAutoLikesTransactions,limit=4}={}){
 if(!nativeAutoLikesReconcileReady())return {enabled:false,scanned:0,verified:0};
 const subscriptions=await sql.query(
  "select id,provider_subscription_id,amount_cents,created_at,status from public.litix_autolikes_live_subscriptions where status in('ACTIVE','PAUSED') and provider_subscription_id ~ '^[0-9]+$' order by created_at desc limit $1",
  [Math.max(1,Math.min(8,limit))]);
 let verified=0,errors=0,cycles=0;
 for(const s of subscriptions){
  try{
   const payments=await query(String(s.provider_subscription_id),Number(s.amount_cents));
   for(const txn of payments){
    const evidence=nativeCycleEvidence(txn,s);
    if(!evidence)continue;
    // Trusted query receipt, no unverified HTTP webhook is allowed to set paid.
    await sql.query(
     "insert into public.litix_autolikes_live_gateway_events(event_id,provider_subscription_id,event_type,transaction_id,payload_sha256) values($1,$2,'PAYMENT_SUCCEEDED',$3,$4) on conflict do nothing",
     [evidence.eventId,s.provider_subscription_id,evidence.transactionId,hash("verified NMI query:"+evidence.transactionId)]);
    await sql.query(
     "update public.litix_autolikes_live_subscriptions set payment_status='PAID',last_paid_at=$2::timestamptz,billing_cycle_end=$3::timestamptz,status=case when status='PAUSED' and not exists(select 1 from public.litix_autolikes_live_cancellations where subscription_id=$1) then 'ACTIVE' else status end,updated_at=now() where id=$1 and (last_paid_at is null or last_paid_at<$2::timestamptz)",
     [s.id,evidence.paidAt,evidence.expiresAt]);
    // Only new verified receipts create one period, and cancelled campaigns never restart.
    const added=await sql.query(
     "insert into public.litix_autolikes_native_cycles(id,subscription_id,provider_transaction_id,period_key,paid_at,expires_at,amount_cents,state) select $1,$2,$3,$4,$5::timestamptz,$6::timestamptz,$7,'QUEUED' where exists(select 1 from public.litix_autolikes_live_subscriptions v where v.id=$2 and v.status='ACTIVE' and v.payment_status='PAID') and not exists(select 1 from public.litix_autolikes_live_cancellations c where c.subscription_id=$2) on conflict do nothing returning id",
     [evidence.cycleId,evidence.subscriptionId,evidence.transactionId,evidence.periodKey,evidence.paidAt,evidence.expiresAt,evidence.amountCents]);
    cycles+=added.length;verified++;
   }
  }catch{errors++;}
 }
 return {enabled:true,scanned:subscriptions.length,verified,queuedCycles:cycles,errors};
}
export async function dispatchNativeAutoLikes({sql=boosteroSQL(),operation=boosteroProduction,limit=2}={}){
 if(!nativeAutoLikesDispatchReady())return {enabled:false,submitted:0,requiresReview:0};
 const queued=await sql.query(
  "select c.id,c.expires_at,c.amount_cents,c.provider_transaction_id,s.id as subscription_id,s.platform,s.target_profile_url,s.service_id,s.max_likes_per_post,s.monthly_post_limit from public.litix_autolikes_native_cycles c join public.litix_autolikes_live_subscriptions s on s.id=c.subscription_id where c.state='QUEUED' and c.expires_at>now() and s.status='ACTIVE' and s.payment_status='PAID' and s.billing_cycle_end>=c.expires_at and s.last_paid_at is not null and exists(select 1 from public.litix_autolikes_live_gateway_events e where e.transaction_id=c.provider_transaction_id and e.provider_subscription_id=s.provider_subscription_id and e.event_type='PAYMENT_SUCCEEDED') order by c.created_at asc limit $1",
  [Math.max(1,Math.min(4,limit))]);
 let submitted=0,requiresReview=0;
 for(const item of queued){
  let quote,params;
  try{
   const services=await operation("services");
   const service=services.find(x=>String(x.service??x.id)===String(item.service_id));
   quote=nativeAutoLikesQuote({service,platform:item.platform,profile:item.target_profile_url,
    quantityPerPost:Number(item.max_likes_per_post),posts:Number(item.monthly_post_limit)});
   if(quote.totalCents>Number(item.amount_cents))throw Error("supplier_price_increase");
   params=nativeAutoLikesSupplierParams({quote,periodEnd:item.expires_at});
   const wallet=await operation("balance");
   if(String(wallet.currency||"USD").toUpperCase()!=="USD"||
    !Number.isFinite(Number(wallet.balance))||Number(wallet.balance)<quote.wholesaleCents/100)
    throw Error("supplier_wallet_insufficient");
  }catch{
   // Preflight failed safely; no supplier add, requires owner review.
   await sql.query("update public.litix_autolikes_native_cycles set state='MANUAL_REVIEW',error_code='PREFLIGHT_FAILED',updated_at=now() where id=$1 and state='QUEUED'",[item.id]);
   requiresReview++;continue;
  }
  const attemptId=randomUUID();
  const claimed=await sql.query(
   "update public.litix_autolikes_native_cycles set state='DISPATCHING',attempt_id=$2::uuid,claimed_at=now(),updated_at=now() where id=$1 and state='QUEUED' and expires_at>now() and exists(select 1 from public.litix_autolikes_live_subscriptions s where s.id=subscription_id and s.status='ACTIVE' and s.payment_status='PAID' and s.billing_cycle_end>=expires_at) returning id",
   [item.id,attemptId]);
  if(!claimed.length)continue;
  try{
   const response=await operation("subscription",params,{claimed:true});
   const order=String(response.order||"");
   if(!digits(order))throw Error("supplier_order_unconfirmed");
   const stored=await sql.query(
    "update public.litix_autolikes_native_cycles set state='SUBMITTED',supplier_order_id=$3,updated_at=now() where id=$1 and attempt_id=$2::uuid and state='DISPATCHING' returning id",
    [item.id,attemptId,order]);
   if(!stored.length)throw Error("supplier_receipt_storage_uncertain");
   submitted++;
  }catch{
   // Never retry any claimed supplier add. The outcome may have succeeded.
   await sql.query("update public.litix_autolikes_native_cycles set state='UNKNOWN_OUTCOME',error_code='SUPPLIER_RECONCILE_REQUIRED',updated_at=now() where id=$1 and attempt_id=$2::uuid and state='DISPATCHING'",[item.id,attemptId]).catch(()=>{});
   requiresReview++;
  }
 }
 return {enabled:true,checked:queued.length,submitted,requiresReview};
}

export async function syncNativeAutoLikesStatuses({sql=boosteroSQL(),operation=boosteroProduction,limit=8}={}){
 if(!nativeAutoLikesDispatchReady())return {enabled:false,checked:0};
 const rows=await sql.query(
  "select id,supplier_order_id from public.litix_autolikes_native_cycles where state='SUBMITTED' and supplier_order_id ~ '^[0-9]+$' order by last_checked_at asc nulls first limit $1",
  [Math.max(1,Math.min(20,limit))]);
 let checked=0,updated=0,failed=0;
 for(const item of rows){
  try{
   const result=await operation("status",{order:String(item.supplier_order_id)});
   const status=String(result?.status||"").slice(0,80);
   if(!/^(Pending|In progress|Processing|Completed|Partial|Canceled|Cancelled)$/i.test(status)){
    failed++;continue;
   }
   const terminal=/^Completed$/i.test(status);
   await sql.query(
    "update public.litix_autolikes_native_cycles set supplier_status=$2,last_checked_at=now(),state=case when $3::boolean then 'COMPLETED' else state end,updated_at=now() where id=$1 and state='SUBMITTED'",
    [item.id,status,terminal]);
   updated++;
  }catch{failed++;}
  checked++;
 }
 return {enabled:true,checked,updated,failed};
}
