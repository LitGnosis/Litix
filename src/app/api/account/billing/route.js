import { neon } from "@neondatabase/serverless";
import { createHash, randomUUID } from "node:crypto";
import { authenticatedCustomer, customerAuthConfigured } from "../../../../lib/customerAuth.js";
import { accountDatabaseURL, fetchLikesServices } from "../../../../lib/autolikes.mjs";
import { quoteAutoLikesMonth, subscriptionRequestId, privateWorkspaceId, upcomingBillingDate } from "../../../../lib/autoLikesSubscriptions.mjs";
import { nmiRecurringStatus, createRecurringForm, cancelRecurringForm, parseRecurringGatewayResponse } from "../../../../lib/nmiRecurring.mjs";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=30;

const response=(data,status=200)=>Response.json(data,{status,headers:{"cache-control":"private,no-store","x-content-type-options":"nosniff"}});
const sql=()=>neon(accountDatabaseURL());
const live=()=>{const s=nmiRecurringStatus();return s.ready&&s.mode==="production" ? s : null};
const providerKey=()=>process.env.NMI_SECURITY_KEY;
const uuid=key=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(key||""));
const campaignId=id=>/^al_[a-f0-9]{40}$/.test(String(id||""));
const subscriptionId=id=>/^alsub_[a-f0-9]{48}$/.test(String(id||""));
const userContext=async()=>{
 if(!customerAuthConfigured())return {error:response({error:"Customer login is not enabled."},503)};
 const user=await authenticatedCustomer();
 if(!user)return {error:response({error:"Sign in with a verified email."},401)};
 if(!accountDatabaseURL())return {error:response({error:"Customer billing storage unavailable."},503)};
 return {user};
};
const sameOrigin=req=>{
 const origin=req.headers.get("origin");
 if(!origin)return false;
 try{return new URL(origin).origin===new URL(req.url).origin}catch{return false}
};
async function payload(req){
 if(Number(req.headers.get("content-length")||0)>3000)return null;
 try{const text=await req.text();if(text.length>3000)return null;const p=JSON.parse(text);return p&&typeof p==="object"&&!Array.isArray(p)?p:null}catch{return null}
}
async function ownedDraft(db,user,id){
 const rows=await db.query("select id,platform,account_ref,service_catalog_id,quantity_per_post,max_posts_per_month,status from litix_auto_boost_campaigns where id=$1 and customer_id=$2 limit 1",[id,user.id]);
 return rows[0]||null;
}
async function currentQuote(db,user,id){
 const draft=await ownedDraft(db,user,id);
 if(!draft)throw Error("NOT_FOUND");
 const services=await fetchLikesServices(draft.platform);
 return quoteAutoLikesMonth(draft,services);
}
async function gatewayRequest(data){
 const provider=live();
 if(!provider)throw Error("LIVE_NOT_ENABLED");
 // A gateway timeout is ambiguous: never retry an enrollment or cancellation automatically.
 const reply=await fetch(provider.gateway,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:data,signal:AbortSignal.timeout(15000),cache:"no-store"});
 if(!reply.ok)throw Error("PROVIDER_UNCERTAIN");
 return parseRecurringGatewayResponse(await reply.text());
}
function safeSubscription(row){return {id:row.id,campaignId:row.campaign_id,status:row.status,lastPaymentAt:row.last_successful_payment_at,currentPeriodEnd:row.current_period_end,createdAt:row.created_at}}

// GET is read-only; ?campaignId returns a fresh, server-signed-by-context quote, not a browser price.
export async function GET(req){
 const ctx=await userContext();if(ctx.error)return ctx.error;
 try{
  const db=sql(),q=new URL(req.url).searchParams.get("campaignId");
  if(q){
   if(!campaignId(q))return response({error:"Invalid campaign ID."},400);
   const quote=await currentQuote(db,ctx.user,q);
   return response({quote,liveSubscriptionsAvailable:Boolean(live()),
    disclosure:"Monthly auto-renewing billing. An enrollment may charge on the date specified by the gateway. Supplier deliveries are disabled until a payment is independently verified."});
  }
  const rows=await db.query("select id,campaign_id,status,last_successful_payment_at,current_period_end,created_at from litix_recurring_subscriptions where customer_id=$1 order by created_at desc limit 50",[ctx.user.id]);
  const events=await db.query(`select e.provider_event_id,e.event_type,e.verified_at,s.campaign_id
   from litix_autolikes_billing_events e join litix_recurring_subscriptions s
   on s.provider_subscription_item_id=e.provider_subscription_item_id
   where s.customer_id=$1 and e.signature_verified=true order by e.received_at desc limit 50`,[ctx.user.id]);
  return response({subscriptions:rows.map(safeSubscription),history:events.map(e=>({id:e.provider_event_id,type:e.event_type,verifiedAt:e.verified_at,campaignId:e.campaign_id})),recurring:{enabled:Boolean(live()),mode:live()?"production":"unavailable"},message:live()?"Customer-authorized recurring billing is available; supplier delivery requires verified payment evidence.":"Recurring payments are not yet enabled; saved drafts remain available."});
 }catch(e){
  if(e?.message==="NOT_FOUND")return response({error:"Campaign not found in your account."},404);
  console.error("Litix subscription read failed",String(e?.message||"unavailable").slice(0,120));
  return response({error:"Unable to load billing details."},503);
 }
}

export async function POST(req){
 if(!sameOrigin(req))return response({error:"Invalid request origin."},403);
 const ctx=await userContext();if(ctx.error)return ctx.error;
 if(!live())return response({error:"Merchant recurring billing has not been enabled. No charge submitted."},503);
 const data=await payload(req);
 if(!data || !campaignId(data.campaignId) || !uuid(data.requestKey) || data.consentToMonthlyRenewal!==true || data.consentVersion!=="2026-10")return response({error:"Choose a saved campaign and accept the monthly renewal terms."},400);
 const submittedAmount=Number(data.expectedMonthlyCents);
 if(!Number.isSafeInteger(submittedAmount))return response({error:"A confirmed monthly amount is required."},400);
 const token=String(data.paymentToken||"");
 // Do not accept raw card data: Collect.js sends a single-use opaque token only.
 if(!/^[a-zA-Z0-9_.-]{12,300}$/.test(token)||/^\d{12,19}$/.test(token))return response({error:"Provide a secure Collect.js payment token."},400);
 const db=sql(),owner=ctx.user;
 let quote;
 try{quote=await currentQuote(db,owner,data.campaignId)}catch(e){
  return response({error:e?.message==="NOT_FOUND"?"Campaign not found in your account.":"Current supplier pricing is unavailable."},e?.message==="NOT_FOUND"?404:503);
 }
 if(submittedAmount!==quote.monthlyCents)return response({error:"The monthly price changed. Review the updated quote before paying.",quote},409);
 const intentId=subscriptionRequestId(owner.id,data.campaignId,data.requestKey), workspaceId=privateWorkspaceId(owner.id);
 const fingerprint=createHash("sha256").update(JSON.stringify({id:quote.campaignId,serviceId:quote.serviceId,quantity:quote.quantity,posts:quote.maxPosts,amount:quote.monthlyCents})).digest("hex");
 // Persist a durable, unique claim BEFORE talking to the live gateway. Never re-send a claimed token.
 try{
  await db.query("insert into litix_workspaces(id,name,slug,plan,status) values($1,'Litix customer', $2,'starter','active') on conflict do nothing",[workspaceId,"customer-"+workspaceId.slice(5)]);
  const attempt=await db.query(`insert into litix_autolikes_subscription_attempts
   (id,campaign_id,customer_id,workspace_id,request_key,quote_sha256,monthly_amount_cents,consent_version)
   values($1,$2,$3,$4,$5,$6,$7,'2026-10') on conflict do nothing returning id`,
   [intentId,quote.campaignId,owner.id,workspaceId,data.requestKey,fingerprint,quote.monthlyCents]);
  if(!attempt.length)return response({error:"An enrollment request already exists. Review subscription status; do not submit another payment.",requestId:intentId},409);
 }catch(e){
  console.error("Subscription claim failed",String(e?.message||"unavailable").slice(0,120));
  return response({error:"Subscription enrollment storage is unavailable. No charge was submitted."},503);
 }
 try{
  const date=upcomingBillingDate();
  const form=createRecurringForm({amountCents:quote.monthlyCents,dayOfMonth:date.day,startDate:date.initialDate,paymentToken:token,orderId:intentId,email:owner.email},providerKey());
  const result=await gatewayRequest(form);
  if(!result.approved){
   await db.query("update litix_autolikes_subscription_attempts set state='DECLINED',last_gateway_code=$2,updated_at=now() where id=$1",[intentId,result.responseCode||null]).catch(()=>{});
   return response({error:"PayKings did not approve this recurring subscription. No automatic retry will occur.",requestId:intentId},402);
  }
  if(!result.subscriptionId)throw Error("PROVIDER_UNCERTAIN");
  const subscriptionRecord="alrec_"+createHash("sha256").update(intentId+"\n"+result.subscriptionId).digest("hex").slice(0,48);
  try{
   await db.query(`insert into litix_recurring_subscriptions
     (id,workspace_id,provider,provider_subscription_item_id,status,campaign_id,customer_id)
     values($1,$2,'nmi',$3,'PENDING',$4,$5) on conflict(provider_subscription_item_id) do nothing`,
     [subscriptionRecord,workspaceId,result.subscriptionId,quote.campaignId,owner.id]);
   await db.query("update litix_autolikes_subscription_attempts set state='AWAITING_VERIFICATION',provider_subscription_item_id=$2,updated_at=now() where id=$1",[intentId,result.subscriptionId]);
  }catch(e){console.error("Subscription requires reconciliation",String(e?.message||"unknown").slice(0,100));return response({requestId:intentId,status:"review",message:"The gateway accepted enrollment, but the order requires reconciliation. Do not retry or reenter your card."},202)}
  return response({requestId:intentId,subscriptionId:subscriptionRecord,status:"pending_payment_verification",quote,message:"PayKings accepted the monthly subscription request. Automatic fulfillment will begin only after verified successful payment and approved post monitoring."},202);
 }catch(e){
  await db.query("update litix_autolikes_subscription_attempts set state='UNKNOWN_OUTCOME',updated_at=now() where id=$1",[intentId]).catch(()=>{});
  console.error("Recurring enrollment ambiguous; no automatic retry",String(e?.message||"timeout").slice(0,80));
  return response({requestId:intentId,status:"manual_review",message:"Gateway outcome requires review. Do not retry or submit another card payment."},202);
 }
}

// Cancellation is customer-owned, claimed once and sent to the existing PayKings gateway.
export async function PATCH(req){
 if(!sameOrigin(req))return response({error:"Invalid request origin."},403);
 const ctx=await userContext();if(ctx.error)return ctx.error;
 if(!live())return response({error:"Recurring billing management is not enabled."},503);
 const data=await payload(req);
 if(!data || data.action!=="cancel" || !subscriptionId(data.subscriptionId))return response({error:"Select a valid subscription to cancel."},400);
 const db=sql(),owner=ctx.user;
 let rows;
 try{rows=await db.query("select id,provider_subscription_item_id,status from litix_recurring_subscriptions where id=$1 and customer_id=$2 limit 1",[data.subscriptionId,owner.id])}catch{return response({error:"Billing records unavailable."},503)}
 if(!rows.length)return response({error:"Subscription not found in your account."},404);
 if(["CANCELLED","EXPIRED"].includes(rows[0].status))return response({status:"cancelled",alreadyCancelled:true});
 const claimId="alcancel_"+createHash("sha256").update(owner.id+"\n"+rows[0].id).digest("hex").slice(0,48);
 try{
  const ins=await db.query("insert into litix_autolikes_cancellation_attempts(id,subscription_id,customer_id) values($1,$2,$3) on conflict do nothing returning id",[claimId,rows[0].id,owner.id]);
  if(!ins.length)return response({error:"Cancellation already requested. Please check billing status; do not retry."},409);
 }catch{return response({error:"Cannot start cancellation safely."},503)}
 try{
  const result=await gatewayRequest(cancelRecurringForm(rows[0].provider_subscription_item_id,providerKey()));
  if(!result.approved)throw Error("CANCELLATION_UNCERTAIN");
  await db.query("update litix_recurring_subscriptions set status='CANCELLED',updated_at=now() where id=$1 and customer_id=$2",[rows[0].id,owner.id]);
  await db.query("update litix_autolikes_cancellation_attempts set state='CANCELLED',updated_at=now() where id=$1",[claimId]);
  return response({status:"cancelled",message:"Recurring subscription cancellation acknowledged by PayKings."});
 }catch{
  await db.query("update litix_autolikes_cancellation_attempts set state='UNKNOWN_OUTCOME',updated_at=now() where id=$1",[claimId]).catch(()=>{});
  return response({status:"review",message:"Cancellation outcome is being reviewed. It has not been marked cancelled until confirmed."},202);
 }
}
