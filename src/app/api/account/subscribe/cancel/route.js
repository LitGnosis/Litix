import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { authenticatedCustomer, customerAuthConfigured } from "../../../../../lib/customerAuth.js";
import { accountDatabaseURL } from "../../../../../lib/autolikes.mjs";
import { cancelRecurringForm } from "../../../../../lib/nmiRecurring.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=30;
const respond=(value,status=200)=>Response.json(value,{status,headers:{"cache-control":"private, no-store"}});
export async function POST(request){
 let origin;try{origin=new URL(request.headers.get("origin")).origin;}catch{}
 if(!origin||origin!==new URL(request.url).origin)return respond({error:"Invalid origin"},403);
 if(!customerAuthConfigured())return respond({error:"Customer login unavailable"},503);
 const customer=await authenticatedCustomer();
 if(!customer)return respond({error:"Sign in first"},401);
 if(process.env.VERCEL_ENV!=="production"||!process.env.NMI_SECURITY_KEY)
   return respond({error:"Live recurring billing connection unavailable"},503);
 let body;
 try{const raw=await request.text();if(raw.length>1200)throw Error("invalid");body=JSON.parse(raw);}
 catch{return respond({error:"Invalid request"},400);}
 const campaignId=String(body?.campaignId||"");
 if(!/^al_[a-f0-9]{40}$/.test(campaignId))return respond({error:"Invalid campaign"},422);
 if(!accountDatabaseURL())return respond({error:"Billing database unavailable"},503);
 const sql=neon(accountDatabaseURL());
 try{
  const rows=await sql.query("select id,provider_subscription_id,status from litix_autolikes_live_subscriptions where campaign_id=$1 and subscriber_id=$2 limit 1",[campaignId,customer.id]);
  if(!rows.length)return respond({error:"Subscription not found"},404);
  const sub=rows[0];
  if(sub.status==="CANCELLED")return respond({ok:true,cancelled:true,reused:true});
  // Insert before any external call: one cancellation request per provider subscription.
  const claimed=await sql.query(
   "insert into litix_autolikes_live_cancellations(id,subscription_id,subscriber_id,gateway_subscription_id) values($1,$2,$3,$4) on conflict(subscription_id) do nothing returning id",
   ["alc_"+randomUUID(),sub.id,customer.id,sub.provider_subscription_id]);
  if(!claimed.length)return respond({error:"Cancellation already submitted; confirm its outcome before retrying"},409);
  await sql.query("update litix_autolikes_live_subscriptions set status='PAUSED',posts_remaining=0,updated_at=now() where id=$1 and subscriber_id=$2",[sub.id,customer.id]);
  let form;
  try{form=cancelRecurringForm(sub.provider_subscription_id,process.env.NMI_SECURITY_KEY);}
  catch{return respond({error:"Provider cancellation requires review; campaign is paused"},503);}
  let responseCode=null,approved=false;
  try{
   const res=await fetch("https://paykings.transactiongateway.com/api/transact.php",{
    method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:form,
    signal:AbortSignal.timeout(18000),cache:"no-store"
   });
   if(res.ok){
    const text=await res.text();
    const params=new URLSearchParams(text);
    responseCode=String(params.get("response_code")||"").slice(0,12);
    approved=params.get("response")==="1"&&responseCode==="100";
   }
  }catch{}
  if(!approved){
   await sql.query("update litix_autolikes_live_cancellations set state='UNKNOWN_OUTCOME',provider_response_code=$2,updated_at=now() where subscription_id=$1",[sub.id,responseCode]);
   return respond({cancelled:false,paused:true,message:"Cancellation outcome needs merchant reconciliation. Deliveries have been paused."},202);
  }
  await sql.query("update litix_autolikes_live_cancellations set state='CONFIRMED',provider_response_code=$2,updated_at=now() where subscription_id=$1",[sub.id,responseCode]);
  await sql.query("update litix_autolikes_live_subscriptions set status='CANCELLED',posts_remaining=0,updated_at=now() where id=$1",[sub.id]);
  await sql.query("update litix_auto_boost_campaigns set status='paused',updated_at=now() where id=$1",[campaignId]);
  return respond({ok:true,cancelled:true});
 }catch(e){
  console.error("AutoLikes cancellation needs reconciliation",String(e?.code||"provider"));
  return respond({error:"Cancellation outcome requires merchant review. Do not repeat the request."},503);
 }
}
