import { neon } from "@neondatabase/serverless";
import { createHash, timingSafeEqual } from "node:crypto";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const reply=(data,status=200)=>Response.json(data,{status,headers:{"cache-control":"no-store"}});
const fingerprint=x=>createHash("sha256").update(x).digest("hex");
function authorized(req){
 const expected=process.env.LITIX_CRON_SECRET;
 const token=(req.headers.get("authorization")||"").replace(/^Bearer\\s+/i,"");
 if(!expected||!token)return false;
 const a=Buffer.from(fingerprint(token),"hex"),b=Buffer.from(fingerprint(expected),"hex");
 return timingSafeEqual(a,b);
}
const db=()=>neon(process.env.LITIX_V2_DATABASE_URL||process.env.DATABASE_URL||process.env.POSTGRES_URL);
async function supplierAdd({service,link,quantity}){
 const key=process.env.SMMGLOB_API_KEY;
 const url=new URL(process.env.SMMGLOB_API_URL||"https://smmglob.com/api/v2");
 if(!key||url.protocol!=="https:"||!["smmglob.com","www.smmglob.com"].includes(url.hostname))throw Error("SUPPLIER_NOT_CONFIGURED");
 const response=await fetch(url,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({key,action:"add",service,link,quantity:String(quantity)}),cache:"no-store",signal:AbortSignal.timeout(17000)});
 if(!response.ok)throw Error("SUPPLIER_HTTP_"+response.status);
 const body=await response.json();
 if(body?.error)throw Error("SUPPLIER_REJECTED");
 if(!/^[0-9]+$/.test(String(body?.order||"")))throw Error("SUPPLIER_UNKNOWN_RESPONSE");
 return String(body.order);
}
export async function GET(req){
 if(!authorized(req))return reply({error:"Unauthorized"},401);
 if(process.env.LITIX_AUTOLIKES_DISPATCH_ENABLED!=="true")return reply({enabled:false,processed:0},503);
 if(!process.env.SMMGLOB_API_KEY)return reply({error:"Supplier unavailable"},503);
 const sql=db();
 // Verify active payment evidence and exact customer/campaign pairing AGAIN at dispatch time.
 const rows=await sql.query(`
 select e.event_id,e.workspace_id,e.campaign_id,e.post_url,c.service_catalog_id,c.quantity_per_post
 from litix_profile_events e
 join litix_auto_boost_campaigns c on c.id=e.campaign_id and c.status='active'
 join litix_profile_watchers w on w.workspace_id=e.workspace_id and w.campaign_id=c.id
   and w.customer_id=c.customer_id and w.enabled=true and w.consent_at is not null
   and w.platform=e.platform and w.profile_handle=e.profile_handle
 join litix_recurring_subscriptions s on s.workspace_id=e.workspace_id and s.campaign_id=c.id
   and s.customer_id=c.customer_id and s.status='ACTIVE_PAID' and s.provider='nmi'
   and s.current_period_end>now() and s.last_successful_payment_at is not null
 where e.state='queued'
   and exists(select 1 from litix_autolikes_billing_events b
     where b.provider='nmi' and b.provider_subscription_item_id=s.provider_subscription_item_id
       and b.event_type='PAYMENT_SUCCEEDED' and b.signature_verified=true
       and b.verified_at>=s.last_successful_payment_at-interval '5 minutes')
   and not exists(select 1 from litix_autolikes_delivery_claims d where d.campaign_id=e.campaign_id and d.post_url=e.post_url)
 order by e.received_at asc limit 5`);
 let confirmed=0,unknown=0,skipped=0;
 for(const event of rows){
  const service=String(event.service_catalog_id),quantity=Number(event.quantity_per_post);
  if(!/^[0-9]+$/.test(service)||!Number.isSafeInteger(quantity)||quantity<1){skipped++;continue;}
  const id="ald_"+fingerprint(event.campaign_id+"|"+event.post_url).slice(0,40);
  const fp=fingerprint([event.campaign_id,event.post_url,service,quantity].join("|"));
  // The insert is the durable single-attempt gate. Concurrent cron requests cannot both dispatch.
  const claimed=await sql.query(`
    insert into litix_autolikes_delivery_claims(id,campaign_id,workspace_id,post_url,service_id,quantity,state,request_fingerprint)
    values($1,$2,$3,$4,$5,$6,'CLAIMED',$7)
    on conflict do nothing returning id`,[id,event.campaign_id,event.workspace_id,event.post_url,service,quantity,fp]);
  if(!claimed.length){skipped++;continue;}
  try {
   const supplierOrder=await supplierAdd({service,link:event.post_url,quantity});
   await sql.query("update litix_autolikes_delivery_claims set state='SUPPLIER_CONFIRMED',supplier_order_id=$2,updated_at=now() where id=$1 and state='CLAIMED'",[id,supplierOrder]);
   await sql.query("update litix_profile_events set state='processed',processed_at=now() where event_id=$1 and state='queued'",[event.event_id]);
   confirmed++;
  }catch(err){
   // NEVER retry an ambiguous external request without human/provider reconciliation.
   await sql.query("update litix_autolikes_delivery_claims set state='UNKNOWN_OUTCOME',updated_at=now() where id=$1 and state='CLAIMED'",[id]);
   console.error("AutoLikes supplier dispatch requires reconciliation",id,String(err?.message||"unknown").slice(0,80));
   unknown++;
  }
 }
 return reply({ok:true,attempted:confirmed+unknown,confirmed,requiresReconciliation:unknown,skipped});
}
