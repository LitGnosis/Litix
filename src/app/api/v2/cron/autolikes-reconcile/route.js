import { neon } from "@neondatabase/serverless";
import { createHash, timingSafeEqual } from "node:crypto";
import { parseNmiTransactionEvidence, paidPeriodEnd } from "../../../../lib/nmiQueryEvidence.mjs";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=30;
const send=(data,status=200)=>Response.json(data,{status,headers:{"cache-control":"no-store"}});
const dbUrl=()=>process.env.LITIX_V2_DATABASE_URL||process.env.DATABASE_URL||process.env.POSTGRES_URL;
const enabled=()=>process.env.VERCEL_ENV==="production" &&
 process.env.LITIX_NMI_RECURRING_LIVE_ENABLED==="true" &&
 process.env.LITIX_NMI_RECURRING_MERCHANT_APPROVED==="true" &&
 process.env.LITIX_NMI_QUERY_RECONCILIATION_ENABLED==="true";
const authenticated=req=>{
 const secret=process.env.LITIX_CRON_SECRET||process.env.CRON_SECRET;
 const supplied=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 if(!secret||!supplied)return false;
 const h=s=>createHash("sha256").update(s).digest();
 return timingSafeEqual(h(secret),h(supplied));
};
const queryUrl=()=>{
 const u=new URL(process.env.NMI_QUERY_GATEWAY_URL||"https://paykings.transactiongateway.com/api/query.php");
 if(u.protocol!=="https:"||!["paykings.transactiongateway.com","secure.nmi.com"].includes(u.hostname)||
  u.pathname!=="/api/query.php"||u.search||u.hash||u.username||u.password)throw Error("Query API URL is not approved");
 return u.toString();
};
const fingerprint=v=>createHash("sha256").update(v).digest("hex");
export async function POST(req){
 if(!authenticated(req))return send({error:"Unauthorized"},401);
 if(!enabled())return send({enabled:false,reason:"NMI recurring-query reconciliation has not been approved."},503);
 if(!dbUrl()||!process.env.NMI_SECURITY_KEY)return send({error:"Recurring query storage or credentials unavailable."},503);
 const sql=neon(dbUrl());
 let rows;
 try{
  rows=await sql.query(`select s.id,s.campaign_id,s.workspace_id,s.provider_subscription_item_id,
       s.last_successful_payment_at,a.monthly_amount_cents,a.monitoring_consent_at,
       c.platform,c.account_ref
    from litix_recurring_subscriptions s
    join litix_autolikes_subscription_attempts a
     on a.provider_subscription_item_id=s.provider_subscription_item_id
      and a.campaign_id=s.campaign_id and a.customer_id=s.customer_id
    join litix_auto_boost_campaigns c
     on c.id=s.campaign_id and c.customer_id=s.customer_id
    where s.provider='nmi' and s.status in ('PENDING','ACTIVE_PAID','PAST_DUE')
      and a.state='AWAITING_VERIFICATION'
    order by coalesce(s.last_successful_payment_at,s.created_at) asc limit 5`);
 }catch{return send({error:"Subscription ledger could not be read."},503)}
 let verified=0,unchanged=0,manualReview=0;
 for(const row of rows){
  const sub=String(row.provider_subscription_item_id);
  if(!/^\d{1,30}$/.test(sub)){manualReview++;continue}
  let transactions;
  try{
   const res=await fetch(queryUrl(),{
    method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({security_key:process.env.NMI_SECURITY_KEY,report_type:"transaction",
     subscription_id:sub,source:"recurring",action_type:"sale"}),
    signal:AbortSignal.timeout(12000),cache:"no-store"
   });
   if(!res.ok)throw Error("Non-success from Query API");
   transactions=parseNmiTransactionEvidence(await res.text(),sub,Number(row.monthly_amount_cents));
  }catch{manualReview++;continue}
  const newPayments=transactions.filter(p=>!row.last_successful_payment_at||
    new Date(p.paidAt)>new Date(row.last_successful_payment_at));
  if(!newPayments.length){unchanged++;continue}
  newPayments.sort((a,b)=>a.paidAt.localeCompare(b.paidAt));
  for(const paid of newPayments){
   const id="nmiq_"+fingerprint(sub+"\n"+paid.transactionId).slice(0,54);
   try{
    // Query evidence is NOT a signed webhook. Mark verification method explicitly.
    await sql.query(`insert into litix_autolikes_billing_events
      (id,provider,provider_event_id,provider_subscription_item_id,event_type,
       signature_verified,verified_at,payload_sha256,verification_method)
     values($1,'nmi',$2,$3,'PAYMENT_SUCCEEDED',false,now(),$4,'AUTHENTICATED_QUERY')
     on conflict(provider,provider_event_id) do nothing`,
     [id,"nmi-query-"+paid.transactionId,sub,fingerprint(JSON.stringify({id:paid.transactionId,subscription:sub,amount:row.monthly_amount_cents,paidAt:paid.paidAt}))]);
    const status=await sql.query(`update litix_recurring_subscriptions
      set status='ACTIVE_PAID',last_successful_payment_at=$2::timestamptz,
      current_period_end=$3::timestamptz,updated_at=now()
      where id=$1 and status in ('PENDING','ACTIVE_PAID','PAST_DUE')
       and (last_successful_payment_at is null or last_successful_payment_at<$2::timestamptz)
      returning id,campaign_id`,
     [row.id,paid.paidAt,paidPeriodEnd(paid.paidAt)]);
    if(!status.length){unchanged++;continue}
    // Enable campaign only after a settled matching recurring transaction.
    await sql.query("update litix_auto_boost_campaigns set status='active',updated_at=now() where id=$1 and status='draft'",[row.campaign_id]);
    // Profile monitoring requires separately recorded customer consent.
    // API-based platform ownership / post detection remains separately gated.
    if(row.monitoring_consent_at && ["instagram","tiktok"].includes(row.platform) &&
      /^@[a-z0-9._]{1,30}$/i.test(String(row.account_ref||""))){
      const watcherId="alwatch_"+fingerprint(row.workspace_id+"\\n"+row.platform+"\\n"+row.account_ref).slice(0,40);
      await sql.query(`insert into litix_profile_watchers
       (id,workspace_id,platform,profile_handle,campaign_id,customer_id,consent_at,enabled)
       select $1,$2,$3,$4,s.campaign_id,s.customer_id,a.monitoring_consent_at,true
       from litix_recurring_subscriptions s
       join litix_autolikes_subscription_attempts a on a.provider_subscription_item_id=s.provider_subscription_item_id
       where s.id=$5 and s.status='ACTIVE_PAID' and a.monitoring_consent_at is not null
       on conflict (workspace_id,platform,profile_handle) do nothing`,
       [watcherId,row.workspace_id,row.platform,row.account_ref,row.id]);
    }
    verified++;
   }catch{manualReview++}
  }
 }
 return send({ok:true,scanned:rows.length,verified,unchanged,manualReview,
  note:"Only matching settled recurring transactions activate a subscription. No charges or supplier orders were created."});
}
export async function GET(req){
 if(!authenticated(req))return send({error:"Unauthorized"},401);
 return send({enabled:enabled(),verificationMethod:"Authenticated NMI Query API; independent gateway read only"});
}
