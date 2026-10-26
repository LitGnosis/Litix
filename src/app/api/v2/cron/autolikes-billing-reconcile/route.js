import { neon } from "@neondatabase/serverless";
import { createHash, timingSafeEqual } from "node:crypto";
import { nmiRecurringStatus } from "../../../../../lib/nmiRecurring.mjs";
import { parseNmiTransactionEvidence, paidPeriodEnd } from "../../../../../lib/nmiQueryEvidence.mjs";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=30;
const send=(v,status=200)=>Response.json(v,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
function authorized(req){
 const value=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 const secret=process.env.LITIX_CRON_SECRET||process.env.CRON_SECRET;
 if(!secret||!value)return false;
 const h=x=>createHash("sha256").update(x).digest();
 return timingSafeEqual(h(value),h(secret));
}
const enabled=()=>{
 const status=nmiRecurringStatus();
 return process.env.VERCEL_ENV==="production"&&status.ready&&process.env.LITIX_AUTOLIKES_BILLING_RECONCILE_ENABLED==="true";
};
const db=()=>neon(process.env.LITIX_V2_DATABASE_URL||process.env.DATABASE_URL||process.env.POSTGRES_URL);
const evidenceId=txn=>"nmiq_"+createHash("sha256").update(String(txn)).digest("hex").slice(0,48);
const fingerprint=txn=>createHash("sha256").update("authenticated-nmi-query\n"+txn).digest("hex");
async function queryProvider(providerSubId) {
 if(!/^\d{1,30}$/.test(String(providerSubId)))throw Error("Invalid NMI subscription");
 const response=await fetch("https://paykings.transactiongateway.com/api/query.php",{
  method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},
  body:new URLSearchParams({security_key:process.env.NMI_SECURITY_KEY,subscription_id:String(providerSubId),source:"recurring",condition:"complete",report_type:"transaction"}),
  cache:"no-store",signal:AbortSignal.timeout(13000)
 });
 if(!response.ok)throw Error("NMI query failed");
 return response.text();
}
// Vercel Cron sends authenticated GET requests. Apply the same checks as POST.
export async function GET(req){return POST(req)}
export async function POST(req){
 if(!authorized(req))return send({error:"Unauthorized"},401);
 if(!enabled())return send({enabled:false,error:"Live recurring reconciliation is disabled."},503);
 if(!(process.env.LITIX_V2_DATABASE_URL||process.env.DATABASE_URL||process.env.POSTGRES_URL))return send({error:"Billing ledger unavailable."},503);
 const sql=db();let subscriptions;
 try{
  subscriptions=await sql.query(`select s.id,s.workspace_id,s.customer_id,s.campaign_id,s.provider_subscription_item_id,
    s.current_period_end,a.monthly_amount_cents,a.created_at,a.monitoring_consent_at,
    c.platform,c.account_ref
   from litix_recurring_subscriptions s
   join litix_autolikes_subscription_attempts a on a.provider_subscription_item_id=s.provider_subscription_item_id
   join litix_auto_boost_campaigns c on c.id=s.campaign_id and c.customer_id=s.customer_id
   where s.provider='nmi' and s.status in ('PENDING','ACTIVE_PAID','PAST_DUE')
   order by s.created_at asc limit 8`);
 }catch{return send({error:"Unable to query pending subscription records."},503)}
 let inspected=0,verified=0,reviews=0;
 for(const sub of subscriptions){
  inspected++;
  try{
   const xml=await queryProvider(sub.provider_subscription_item_id);
   const candidates=parseNmiTransactionEvidence(xml,sub.provider_subscription_item_id,Number(sub.monthly_amount_cents));
   // Consume only independently settled recurring transactions since subscription creation.
   for(const txn of candidates){
    const when=new Date(txn.paidAt),created=new Date(sub.created_at);
    if(when.getTime()<created.getTime()-5*60*1000||when.getTime()>Date.now()+120000)continue;
    const periodEnd=paidPeriodEnd(txn.paidAt);
    const recorded=await sql.query(`insert into litix_autolikes_billing_events
      (id,provider,provider_event_id,provider_subscription_item_id,event_type,signature_verified,
       verification_method,verified_at,payload_sha256)
      values($1,'nmi',$2,$3,'PAYMENT_SUCCEEDED',false,'AUTHENTICATED_QUERY',$4,$5)
      on conflict(provider,provider_event_id) do nothing returning id`,
     [evidenceId(txn.transactionId),txn.transactionId,txn.subscriptionId,txn.paidAt,fingerprint(txn.transactionId)]);
    // Re-run idempotent database activation even when payment evidence already exists.
    // A previous run may have failed between writing evidence and enabling a watcher.
    const state=new Date(periodEnd)>new Date()?"ACTIVE_PAID":"PAST_DUE";
    await sql.query(`update litix_recurring_subscriptions
      set status=$2,last_successful_payment_at=$3::timestamptz,current_period_end=$4::timestamptz,updated_at=now()
      where id=$1 and (last_successful_payment_at is null or last_successful_payment_at<$3::timestamptz)`,
     [sub.id,state,txn.paidAt,periodEnd]);
    if(state==="ACTIVE_PAID" && sub.monitoring_consent_at &&
      ["instagram","tiktok"].includes(String(sub.platform)) &&
      /^@[a-z0-9._]{1,30}$/i.test(String(sub.account_ref||""))){
     // Create only a customer-consented watcher. Platform API access and post
     // source verification remain separately required before any dispatch.
     const watcherId="alwatch_"+createHash("sha256")
       .update(sub.workspace_id+"\\n"+sub.platform+"\\n"+sub.account_ref)
       .digest("hex").slice(0,40);
     await sql.query(`insert into litix_profile_watchers
       (id,workspace_id,platform,profile_handle,campaign_id,customer_id,consent_at,enabled)
       values($1,$2,$3,$4,$5,$6,$7,true)
       on conflict(workspace_id,platform,profile_handle) do nothing`,
       [watcherId,sub.workspace_id,sub.platform,sub.account_ref,sub.campaign_id,sub.customer_id,sub.monitoring_consent_at]);
     await sql.query("update litix_auto_boost_campaigns set status='active',updated_at=now() where id=$1 and status='draft'",[sub.campaign_id]);
    }
    if(recorded.length)verified++;
   }
  }catch{
   // Any gateway error is non-authoritative. Never mark an unpaid subscription paid.
   reviews++;
  }
 }
 return send({ok:true,inspected,verifiedPayments:verified,requiresReview:reviews,chargesCustomers:false,supplierOrdersSubmitted:0});
}
