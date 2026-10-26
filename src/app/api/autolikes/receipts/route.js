import { neon } from "@neondatabase/serverless";
import { createHash, timingSafeEqual } from "node:crypto";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;

const reply=(body,status=200)=>Response.json(body,{status,headers:{"cache-control":"no-store"}});
function authorized(req){
 const expected=process.env.CRON_SECRET||process.env.LITIX_CRON_SECRET;
 const provided=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 if(!expected||!provided)return false;
 const hash=v=>createHash("sha256").update(v).digest();
 return timingSafeEqual(hash(expected),hash(provided));
}
function eligibleEmail(raw){
 const email=String(raw||"").trim();
 return email.length<=254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)?email:null;
}
export async function GET(req){
 if(!authorized(req))return reply({error:"Unauthorized"},401);
 if(process.env.VERCEL_ENV!=="production" ||
    process.env.LITIX_AUTOLIKES_RECEIPTS_ENABLED!=="true" ||
    !process.env.LITIX_AUTOLIKES_DATABASE_URL ||
    !process.env.RESEND_API_KEY)
   return reply({enabled:false,emailsSent:0},503);
 const sql=neon(process.env.LITIX_AUTOLIKES_DATABASE_URL);
 try{
  const candidates=await sql.query(
   "select e.event_id,c.email,s.campaign_id,s.platform,s.target_handle,s.amount_cents,s.billing_cycle_end "+
   "from litix_autolikes_live_gateway_events e "+
   "join litix_autolikes_live_subscriptions s on s.provider_subscription_id=e.provider_subscription_id "+
   "join litix_auto_boost_campaigns c on c.id=s.campaign_id and c.customer_id=s.subscriber_id "+
   "where e.event_type='AUTHENTICATED_SETTLED_RECURRING_SALE' "+
   "and not exists(select 1 from litix_autolikes_receipt_attempts r where r.event_id=e.event_id) "+
   "order by e.received_at asc limit 5"
  );
  let sent=0,unknown=0,skipped=0;
  for(const row of candidates){
   const to=eligibleEmail(row.email);
   if(!to){skipped++;continue;}
   // The unique insert must happen before any external side effect.
   const claim=await sql.query(
    "insert into litix_autolikes_receipt_attempts(event_id,state) values($1,'CLAIMED') "+
    "on conflict do nothing returning event_id",[row.event_id]);
   if(!claim.length){skipped++;continue;}
   const intervalEnd=row.billing_cycle_end?new Date(row.billing_cycle_end).toISOString().slice(0,10):"See your account";
   const total=(Number(row.amount_cents)/100).toFixed(2);
   const subject="Litix AutoLikes — monthly subscription payment confirmation";
   const body={
    from:"Litix <receipts@litix.net>",
    to:[to],
    subject,
    text:"Your Litix AutoLikes subscription payment has been recorded after gateway settlement verification.\n"+
      "Platform: "+row.platform+"\nProfile: @"+row.target_handle+"\nAmount: $"+total+" USD\n"+
      "Current billing period ends: "+intervalEnd+"\n"+
      "Review your subscription and delivery status: https://www.litix.net/account\n"+
      "You can request cancellation from your subscription account page.\n"+
      "Questions? Reply to this message.\n"
   };
   try{
    const idempotencyKey="litix-autolikes-"+createHash("sha256").update(row.event_id).digest("hex");
    const response=await fetch("https://api.resend.com/emails",{
      method:"POST",
      headers:{
        authorization:"Bearer "+process.env.RESEND_API_KEY,
        "content-type":"application/json",
        "Idempotency-Key":idempotencyKey
      },
      body:JSON.stringify(body),cache:"no-store",signal:AbortSignal.timeout(12000)
    });
    if(!response.ok)throw new Error("RESEND_HTTP_"+response.status);
    const data=await response.json();
    if(typeof data?.id!=="string"||data.id.length>150)throw new Error("RESEND_RESPONSE_UNRECOGNIZED");
    await sql.query(
     "update litix_autolikes_receipt_attempts set state='SENT',provider_email_id=$2,updated_at=now() where event_id=$1 and state='CLAIMED'",
     [row.event_id,data.id]);
    sent++;
   }catch(e){
    // Unknown delivery outcome: never replay automatically; reconcile with Resend first.
    await sql.query(
     "update litix_autolikes_receipt_attempts set state='UNKNOWN_OUTCOME',updated_at=now() where event_id=$1 and state='CLAIMED'",
     [row.event_id]);
    console.error("AutoLikes subscription receipt requires reconciliation",String(e?.message||"provider_failure").slice(0,50));
    unknown++;
   }
  }
  return reply({ok:true,emailsSent:sent,requiresReconciliation:unknown,skipped});
 }catch(e){
  console.error("AutoLikes receipt worker database error",String(e?.code||"db_unavailable"));
  return reply({error:"Receipt worker temporarily unavailable"},503);
 }
}
