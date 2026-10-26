import { neon } from "@neondatabase/serverless";
import { createHash, timingSafeEqual } from "node:crypto";
import { parseNmiTransactionEvidence, paidPeriodEnd } from "../../../../lib/nmiQueryEvidence.mjs";
import { parseProfileTarget } from "../../../../lib/autolikes.mjs";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const send=(x,status=200)=>Response.json(x,{status,headers:{"cache-control":"no-store"}});
const sha=v=>createHash("sha256").update(String(v)).digest("hex");
function authenticated(req){
 const secret=process.env.CRON_SECRET||process.env.LITIX_CRON_SECRET;
 const got=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 return Boolean(secret&&got)&&timingSafeEqual(Buffer.from(sha(secret),"hex"),Buffer.from(sha(got),"hex"));
}
const db=()=>neon(process.env.LITIX_AUTOLIKES_DATABASE_URL||process.env.LITIX_V2_DATABASE_URL||process.env.DATABASE_URL);
const enabled=()=>process.env.VERCEL_ENV==="production" &&
 process.env.NMI_GATEWAY_MODE==="PRODUCTION" &&
 process.env.LITIX_NMI_RECURRING_MERCHANT_APPROVED==="true" &&
 process.env.LITIX_AUTOLIKES_BILLING_RECONCILE_ENABLED==="true" &&
 Boolean(process.env.NMI_SECURITY_KEY&&process.env.LITIX_AUTOLIKES_DATABASE_URL);

async function verifyProviderSubscription(subscriptionId) {
 if(!/^\d{1,30}$/.test(String(subscriptionId)))throw Error("Invalid subscription");
 const response=await fetch("https://paykings.transactiongateway.com/api/query.php",{
  method:"POST",
  headers:{"content-type":"application/x-www-form-urlencoded"},
  body:new URLSearchParams({
   security_key:process.env.NMI_SECURITY_KEY,
   subscription_id:String(subscriptionId),source:"recurring",
   condition:"complete",report_type:"transaction"
  }),
  cache:"no-store",signal:AbortSignal.timeout(12500)
 });
 if(!response.ok)throw Error("NMI query failed");
 const xml=await response.text();
 if(xml.length>500000)throw Error("NMI response oversized");
 return xml;
}
// Read-only query to NMI: does not create charges or supplier orders.
// Paid state changes only when an authenticated settled recurring sale matches amount and subscription.
export async function GET(req) {
 if(!authenticated(req))return send({error:"Unauthorized"},401);
 if(!enabled())return send({enabled:false,chargesCustomers:false},503);
 const sql=db();let candidates;
 try{
  candidates=await sql.query(`select a.gateway_subscription_id,a.customer_id,a.campaign_id,
   a.quoted_amount_cents,a.created_at,c.platform,c.account_ref,c.service_catalog_id,
   c.quantity_per_post,c.max_posts_per_month
   from litix_autolikes_enrollment_attempts a
   join litix_auto_boost_campaigns c on c.id=a.campaign_id and c.customer_id=a.customer_id
   where a.gateway_subscription_id ~ '^[0-9]{1,30}$'
     and a.status='GATEWAY_APPROVED_PENDING_VERIFICATION' and a.consent_at is not null
   order by a.created_at asc limit 5`);
 }catch{return send({error:"Subscription ledger unavailable"},503);}
 let inspected=0,paid=0,unconfirmed=0,review=0;
 for(const a of candidates){
  inspected++;
  try {
   const subId=String(a.gateway_subscription_id);
   const records=parseNmiTransactionEvidence(
     await verifyProviderSubscription(subId),subId,Number(a.quoted_amount_cents));
   if(!records.length){unconfirmed++;continue;}
   const target=parseProfileTarget(a.account_ref,a.platform);
   if(!target.ok||!/^[0-9]+$/.test(String(a.service_catalog_id)) ||
      !Number.isSafeInteger(Number(a.quantity_per_post)) ||
      !Number.isSafeInteger(Number(a.max_posts_per_month))) {review++;continue;}
   const internalId="als_"+sha(subId).slice(0,40);
   // Create the entitlement only in response to independent settled payment proof.
   await sql.query(`insert into litix_autolikes_live_subscriptions
    (id,campaign_id,subscriber_id,provider_subscription_id,target_profile_url,target_handle,
     platform,service_id,max_likes_per_post,monthly_post_limit,amount_cents)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    on conflict (provider_subscription_id) do nothing`,
    [internalId,a.campaign_id,a.customer_id,subId,target.profileUrl,target.handle.toLowerCase(),
     a.platform,String(a.service_catalog_id),Number(a.quantity_per_post),
     Number(a.max_posts_per_month),Number(a.quoted_amount_cents)]);
   for(const record of records){
    const when=new Date(record.paidAt),started=new Date(a.created_at);
    if(when.getTime()<started.getTime()-300000||when.getTime()>Date.now()+120000)continue;
    const eventId="nmiquery_"+sha(record.transactionId).slice(0,40);
    const fp=sha("authenticated-nmi-query|"+record.transactionId+"|"+subId);
    const end=paidPeriodEnd(record.paidAt);
    const applied=await sql.query(`with accepted as (
     insert into litix_autolikes_live_gateway_events
       (event_id,provider_subscription_id,event_type,transaction_id,payload_sha256)
     values($1,$2,'AUTHENTICATED_SETTLED_RECURRING_SALE',$3,$4)
     on conflict do nothing returning event_id)
     update litix_autolikes_live_subscriptions s set
       status='ACTIVE',payment_status='PAID',
       last_paid_at=$5::timestamptz,billing_cycle_end=$6::timestamptz,
       posts_remaining=s.monthly_post_limit,updated_at=now()
     from accepted where s.provider_subscription_id=$2 and s.status<>'CANCELLED'
       and (s.last_paid_at is null or s.last_paid_at<$5::timestamptz)
     returning s.campaign_id`,
     [eventId,subId,record.transactionId,fp,record.paidAt,end]);
    if(applied.length) {
     await sql.query("update litix_auto_boost_campaigns set status='active',updated_at=now() where id=$1 and status in ('draft','paused')",[applied[0].campaign_id]);
     paid++;
    }
   }
  }catch(e){review++;console.error("AutoLikes NMI reconciliation pending",String(e?.code||"provider"));}
 }
 return send({ok:true,inspected,settledPaymentsRecorded:paid,unconfirmed,requiresReview:review,chargesCustomers:false,supplierOrdersSubmitted:0});
}
