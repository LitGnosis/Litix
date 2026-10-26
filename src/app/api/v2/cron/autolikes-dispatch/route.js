import { neon } from "@neondatabase/serverless";
import { createHash, timingSafeEqual } from "node:crypto";
import { fetchLikesServices, isEligibleLikesService } from "../../../../../lib/autolikes.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const send=(data,status=200)=>Response.json(data,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
const enabled=()=>process.env.VERCEL_ENV==="production" &&
 process.env.LITIX_AUTOLIKES_FULFILLMENT_ENABLED==="true" &&
 process.env.LITIX_AUTOLIKES_EVENT_INGEST_ENABLED==="true" &&
 process.env.LITIX_AUTOLIKES_SOURCE_VERIFIED==="true" &&
 process.env.LITIX_NMI_RECURRING_LIVE_ENABLED==="true";
function authorized(request){
 const expected=process.env.LITIX_CRON_SECRET||process.env.CRON_SECRET;
 const value=(request.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 if(!expected||!value)return false;
 const h=s=>createHash("sha256").update(s).digest();
 return timingSafeEqual(h(value),h(expected));
}
const db=()=>neon(process.env.LITIX_V2_DATABASE_URL||process.env.DATABASE_URL||process.env.POSTGRES_URL);
const digest=s=>createHash("sha256").update(s).digest("hex");
const monthKey=()=>new Date().toISOString().slice(0,7);
async function supplierOrder({serviceId,postUrl,quantity}){
 const key=process.env.SMMGLOB_API_KEY;
 if(!key)throw Error("Supplier credentials not configured");
 const target=new URL(process.env.SMMGLOB_API_URL||"https://smmglob.com/api/v2");
 if(target.protocol!=="https:"||!["smmglob.com","www.smmglob.com"].includes(target.hostname)||target.username||target.password)throw Error("Supplier host invalid");
 const res=await fetch(target,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({
  key,action:"add",service:String(serviceId),link:postUrl,quantity:String(quantity)
 }),signal:AbortSignal.timeout(12000),cache:"no-store"});
 if(!res.ok)throw Error("Supplier HTTP status not confirmed");
 const data=await res.json();
 const id=String(data?.order||"");
 if(!/^\d{1,24}$/.test(id))throw Error("Supplier order reference not confirmed");
 return id;
}
async function choosePaidEvent(sql){
 const rows=await sql.query(`
 select e.event_id,e.workspace_id,e.campaign_id,e.post_url,e.platform,
 c.customer_id,c.account_ref,c.service_catalog_id,c.quantity_per_post,
 c.max_posts_per_month,c.posts_processed_this_month,c.month_key
 from litix_profile_events e
 join litix_auto_boost_campaigns c on c.id=e.campaign_id and c.platform=e.platform
 join litix_profile_watchers w on w.workspace_id=e.workspace_id and w.campaign_id=e.campaign_id
   and w.platform=e.platform and w.profile_handle=e.profile_handle
 join litix_recurring_subscriptions s on s.campaign_id=c.id and s.customer_id=c.customer_id
   and s.workspace_id=e.workspace_id
 where e.state='queued' and c.status='active'
   and w.enabled=true and w.consent_at is not null
   and s.provider='nmi' and s.status='ACTIVE_PAID' and s.current_period_end>now()
   and s.last_successful_payment_at is not null
   and exists(select 1 from litix_autolikes_billing_events b
      where b.provider='nmi' and b.provider_subscription_item_id=s.provider_subscription_item_id
        and b.event_type='PAYMENT_SUCCEEDED' and (b.signature_verified=true or b.verification_method='AUTHENTICATED_QUERY')
        and b.verified_at>=s.last_successful_payment_at-interval '5 minutes')
 order by e.received_at asc limit 1`);
 return rows[0]||null;
}
export async function POST(request){
 if(!authorized(request))return send({error:"Unauthorized"},401);
 if(!enabled())return send({enabled:false,reason:"AutoLikes live fulfillment requires verified recurring billing and permissioned post source."},503);
 if(!(process.env.LITIX_V2_DATABASE_URL||process.env.DATABASE_URL||process.env.POSTGRES_URL))return send({error:"Fulfillment ledger is unavailable."},503);
 const sql=db();
 let event;
 try{event=await choosePaidEvent(sql)}catch{return send({error:"Paid-event ledger unavailable."},503)}
 if(!event)return send({ok:true,processed:0,reason:"No verified paid post event is awaiting fulfillment."});
 const quantity=Number(event.quantity_per_post);
 if(!Number.isSafeInteger(quantity)||quantity<=0)return send({ok:false,error:"Campaign quantity invalid; requires review."},409);
 // Recheck current catalog before each supplier dispatch; do not order a stale service id.
 try{
  const services=await fetchLikesServices(event.platform);
  const service=services.find(x=>String(x.service)===String(event.service_catalog_id));
  if(!service||!isEligibleLikesService(service,event.platform)||quantity<Number(service.min)||quantity>Number(service.max))
   return send({ok:false,error:"Selected Likes service is no longer eligible; requires review."},409);
 }catch{return send({error:"Live supplier service catalog unavailable."},503)}
 const url=String(event.post_url||"");
 const permitted=event.platform==="instagram"?["instagram.com","www.instagram.com"]:["tiktok.com","www.tiktok.com"];
 let post;
 try{post=new URL(url)}catch{}
 if(!post||post.protocol!=="https:"||!permitted.includes(post.hostname)||post.username||post.password||post.hash)return send({error:"Invalid approved post target."},409);
 const claimId="alclaim_"+digest(event.campaign_id+"\n"+url).slice(0,48);
 const fingerprint=digest(event.campaign_id+"\n"+url+"\n"+event.service_catalog_id+"\n"+quantity);
 let claim;
 try{
  claim=await sql.query(`insert into litix_autolikes_delivery_claims
   (id,campaign_id,workspace_id,post_url,service_id,quantity,request_fingerprint,state)
   values($1,$2,$3,$4,$5,$6,$7,'CLAIMED') on conflict do nothing returning id`,
   [claimId,event.campaign_id,event.workspace_id,url,String(event.service_catalog_id),quantity,fingerprint]);
 }catch{return send({error:"Unable to reserve unique supplier order claim."},503)}
 if(!claim.length){
  await sql.query("update litix_profile_events set state='review' where event_id=$1 and state='queued'",[event.event_id]).catch(()=>{});
  return send({ok:true,processed:0,duplicate:true,reason:"An existing claim requires reconciliation; duplicate order suppressed."});
 }
 let reserved;
 try{
  reserved=await sql.query(`update litix_auto_boost_campaigns
    set posts_processed_this_month=case when month_key=$3 then posts_processed_this_month+1 else 1 end,
     month_key=$3,updated_at=now()
    where id=$1 and customer_id=$2 and status='active'
      and (month_key is distinct from $3 or posts_processed_this_month<max_posts_per_month)
    returning id`,[event.campaign_id,event.customer_id,monthKey()]);
 }catch{return send({ok:false,state:"review",message:"Quota reservation outcome uncertain. Supplier order was not submitted; claim retained."},202)}
 if(!reserved.length){
  await sql.query("update litix_autolikes_delivery_claims set state='CANCELLED',updated_at=now() where id=$1 and state='CLAIMED'",[claimId]).catch(()=>{});
  await sql.query("update litix_profile_events set state='ignored',processed_at=now() where event_id=$1 and state='queued'",[event.event_id]).catch(()=>{});
  return send({ok:true,processed:0,reason:"Monthly campaign delivery limit reached."});
 }
 // Once claimed, supplier network calls are NEVER retried automatically.
 try{
  const supplierId=await supplierOrder({serviceId:event.service_catalog_id,postUrl:url,quantity});
  try{
   await sql.query("update litix_autolikes_delivery_claims set state='SUPPLIER_CONFIRMED',supplier_order_id=$2,updated_at=now() where id=$1 and state='CLAIMED'",[claimId,supplierId]);
   await sql.query("update litix_profile_events set state='processed',processed_at=now() where event_id=$1 and state='queued'",[event.event_id]);
  }catch{
   return send({ok:false,state:"review",message:"Supplier accepted the request; its confirmation must be reconciled before any further action."},202);
  }
  return send({ok:true,processed:1,status:"supplier_confirmed",claimId});
 }catch{
  await sql.query("update litix_autolikes_delivery_claims set state='UNKNOWN_OUTCOME',updated_at=now() where id=$1 and state='CLAIMED'",[claimId]).catch(()=>{});
  return send({ok:false,state:"manual_review",message:"Supplier outcome is ambiguous. No automatic retry will occur."},202);
 }
}
// A scheduled GET invokes identical signed, paid, consent and duplicate-claim checks.
export async function GET(request){return POST(request)}
