import { neon } from "@neondatabase/serverless";
import { createHmac, createHash, timingSafeEqual } from "node:crypto";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const send=(x,s=200)=>Response.json(x,{status:s});
const conn=()=>neon(process.env.LITIX_AUTOLIKES_DATABASE_URL||process.env.LITIX_V2_DATABASE_URL||process.env.DATABASE_URL);
const sha=x=>createHash("sha256").update(x).digest("hex");
function signatureValid(raw,header){
  // NMI Payment Gateway uses Webhook-Signature: t=<nonce>,s=<sha256 HMAC>.
  // This is not the separate NMI Signup API's "Signature" header.
  const key=process.env.LITIX_NMI_WEBHOOK_SIGNING_KEY || process.env.NMI_WEBHOOK_SIGNING_KEY;
  const match=/^t=([a-zA-Z0-9_-]{8,128}),s=([a-f0-9]{64})$/i.exec(String(header||"").trim());
  if(!key || !match)return false;
  const expected=createHmac("sha256",key).update(match[1]+"."+raw).digest();
  return timingSafeEqual(expected,Buffer.from(match[2],"hex"));
}
export async function POST(req){
 const raw=await req.text();
 if(raw.length>32768)return send({error:"Request too large"},413);
 if(!signatureValid(raw,req.headers.get("webhook-signature")))return send({error:"Bad signature"},401);
 let data;try{data=JSON.parse(raw)}catch{return send({error:"Invalid JSON"},400)}
 const eventId=String(data?.event_id||""),type=String(data?.event_type||"");
 const b=data?.event_body||{},providerId=String(b.subscription_id||"");
 if(!eventId||b.features?.is_test_mode!==false)return send({error:"Live event required"},422);
 if(process.env.LITIX_NMI_MERCHANT_ID&&String(b.merchant?.id)!==process.env.LITIX_NMI_MERCHANT_ID)return send({error:"Merchant mismatch"},403);
 const db=conn(),hash=sha(raw);
 try{
  if(type==="recurring.subscription.add"){
   const found=await db.query("select a.customer_id,a.quoted_amount_cents,c.* from litix_autolikes_enrollment_attempts a join litix_auto_boost_campaigns c on c.id=a.campaign_id and c.customer_id=a.customer_id where a.gateway_subscription_id=$1 and a.status='GATEWAY_APPROVED_PENDING_VERIFICATION' and a.consent_at is not null and a.monitoring_consent_at is not null",[providerId]);
   if(found.length!==1)return send({error:"No matching enrollment"},409);
   const c=found[0],handle=String(c.account_ref).replace(/^@/,"");
   if(!/^[a-z0-9._]{1,30}$/i.test(handle))return send({error:"Invalid profile"},422);
   const url=c.platform==="instagram"?"https://www.instagram.com/"+handle+"/":"https://www.tiktok.com/@"+handle;
   await db.query("insert into litix_autolikes_live_subscriptions(id,campaign_id,subscriber_id,provider_subscription_id,target_profile_url,target_handle,platform,service_id,max_likes_per_post,monthly_post_limit,amount_cents) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) on conflict(provider_subscription_id) do nothing",
    ["als_"+sha(providerId).slice(0,40),c.id,c.customer_id,providerId,url,handle.toLowerCase(),c.platform,String(c.service_catalog_id),c.quantity_per_post,c.max_posts_per_month,c.quoted_amount_cents]);
  }
  const matches=await db.query("select s.* from litix_autolikes_live_subscriptions s where s.provider_subscription_id=$1 or exists(select 1 from litix_autolikes_enrollment_attempts a where a.id=$2 and a.gateway_subscription_id=s.provider_subscription_id) limit 1",[providerId,String(b.order_id||"")]);
  if(matches.length!==1)return send({ok:true,ignored:true,reason:"Not an AutoLikes subscription"});
  const s=matches[0];
  // NMI sale-success notifications can be pending settlement. They do not grant fulfillment.
  // The authenticated Query API reconciliation route checks condition=complete and recurring source.
  if(type==="transaction.sale.success")return send({ok:true,awaitingSettledPaymentVerification:true},202);
  if(type==="recurring.subscription.delete" || 
    (["transaction.sale.failure","transaction.refund.success"].includes(type) &&
     (b?.action?.source==="recurring" || b?.source==="recurring"))){
    const stopped=await db.query(
      "with accepted as (insert into litix_autolikes_live_gateway_events(event_id,provider_subscription_id,event_type,payload_sha256) values($1,$2,$3,$4) on conflict do nothing returning event_id) update litix_autolikes_live_subscriptions s set status=$5,payment_status=$6,posts_remaining=0,updated_at=now() from accepted where s.id=$7 returning s.campaign_id",
      [eventId,s.provider_subscription_id,type,hash,type==="recurring.subscription.delete"?"CANCELLED":"PAUSED",type==="transaction.refund.success"?"REFUNDED":"FAILED",s.id]);
    if(stopped.length)await db.query("update litix_auto_boost_campaigns set status='paused',updated_at=now() where id=$1",[stopped[0].campaign_id]);
    return send({ok:true,stopped:stopped.length===1});
  }
  await db.query("insert into litix_autolikes_live_gateway_events(event_id,provider_subscription_id,event_type,payload_sha256) values($1,$2,$3,$4) on conflict do nothing",[eventId,s.provider_subscription_id,type,hash]);
  return send({ok:true,subscriptionId:s.id});
 }catch(e){console.error("AutoLikes NMI ledger error",String(e?.code||"database"));return send({error:"Billing ledger unavailable"},503)}
}
