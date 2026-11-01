import {createHash,randomUUID} from "node:crypto";
import {boosteroSQL,boosteroProductionReady} from "../../../../lib/boosteroFulfillment.mjs";
import {boosteroProduction} from "../../../../lib/boosteroReadOnly.mjs";
import {nativeAutoLikesQuote} from "../../../../lib/boosteroNativeAutoLikes.mjs";
import {autoLikesRecurringCheckoutReady,nmiAutoLikesEnrollmentForm,nmiAutoLikesCall} from "../../../../lib/nmiAutoLikesRecurring.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const sha=s=>createHash("sha256").update(String(s)).digest("hex");
const send=(data,status=200)=>Response.json(data,{status,headers:{"cache-control":"no-store","referrer-policy":"no-referrer","x-content-type-options":"nosniff"}});
async function sendManagementEmail(email,link){
 const key=process.env.RESEND_API_KEY||process.env.LITIX_RESEND_API_KEY,from=process.env.EMAIL_FROM;
 if(!key||!from)return false;
 try{
  const r=await fetch("https://api.resend.com/emails",{
   method:"POST",headers:{"authorization":"Bearer "+key,"content-type":"application/json",
    "Idempotency-Key":"litix-autolikes-"+sha(link).slice(0,36)},
   cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9500),
   body:JSON.stringify({from,to:[email],subject:"Litix AutoLikes — subscription request received",
    text:"Your Litix AutoLikes subscription request was received. Delivery only starts after payment is independently verified.\nManage or cancel here: "+link+"\nIf you do not recognize this request, contact litixsocial@gmail.com."})
  });
  return r.ok;
 }catch{return false}
}
export async function POST(request){
 const origin=request.headers.get("origin");
 if(!origin||origin!==new URL(request.url).origin)return send({error:"Invalid request origin"},403);
 // Hard deny charging before merchant recurring capability is independently authorized.
 if(!autoLikesRecurringCheckoutReady()||!boosteroProductionReady())
  return send({error:"AutoLikes recurring checkout is not activated; no payment attempted"},503);
 let input;
 try{const raw=await request.text();if(raw.length>4000)throw Error();input=JSON.parse(raw)}
 catch{return send({error:"Invalid subscription request"},400)}
 const email=String(input?.email||"").trim().toLowerCase(),requestKey=String(input?.requestKey||"");
 const token=String(input?.paymentToken||""),id=String(input?.serviceId||"").replace(/^litix_/,"");
 const consent=input?.recurringConsent===true&&input?.monitoringConsent===true;
 const dayOfMonth=Number(input?.dayOfMonth);
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||
  !/^[0-9a-f-]{36}$/i.test(requestKey)||!/^\d{1,12}$/.test(id)||!consent||
  ![ "instagram","tiktok" ].includes(input?.platform)||!Number.isSafeInteger(dayOfMonth)||dayOfMonth<1||dayOfMonth>28)
  return send({error:"Contact, consent, billing day or service is invalid"},422);
 let quote;
 try{
  const catalog=await boosteroProduction("services");
  const service=catalog.find(x=>String(x.service??x.id)===id);
  quote=nativeAutoLikesQuote({service,platform:input.platform,profile:input.profile,
   quantityPerPost:input.quantityPerPost,posts:input.posts,delay:input.delay??0});
 }catch{return send({error:"Live subscription service or price not verified; no charge attempted"},409)}
 const db=boosteroSQL(),customerId="alusr_"+sha(email).slice(0,40),campaignId="al_"+sha(email+":"+requestKey).slice(0,40);
 const attemptId="alat_"+sha(email+":"+requestKey).slice(0,40);
 const priceHash=sha(JSON.stringify([quote.serviceId,quote.platform,quote.username,quote.quantityPerPost,
  quote.posts,quote.delay,quote.totalCents]));
 try{
  // Fail closed BEFORE the gateway call if private subscription/claim tables
  // have not been provisioned. An approved payment must never create an
  // unmanageable subscription with no portal or delivery ledger.
  await db.query("select subscription_id from public.litix_autolikes_native_portal where false");
  await db.query("select id from public.litix_autolikes_native_cycles where false");
  await db.query(
   "insert into public.litix_auto_boost_campaigns(id,customer_id,email,platform,account_ref,service_catalog_id,quantity_per_post,max_posts_per_month,status) values($1,$2,$3,$4,$5,$6,$7,$8,'paused') on conflict(id) do nothing",
   [campaignId,customerId,email,quote.platform,quote.profileUrl,quote.serviceId,quote.quantityPerPost,quote.posts]);
  const claimed=await db.query(
   "insert into public.litix_autolikes_enrollment_attempts(id,customer_id,campaign_id,request_key,quoted_amount_cents,price_fingerprint,consent_at,consent_version,status,monitoring_consent_at) values($1,$2,$3,$4,$5,$6,now(),'native-v1','REQUESTED',now()) on conflict do nothing returning id",
   [attemptId,customerId,campaignId,requestKey,quote.totalCents,priceHash]);
  if(!claimed.length)return send({error:"This subscription request was already processed. No second payment attempted; check your email or contact Litix."},409);
 }catch{return send({error:"Unable to reserve the subscription safely; no payment attempted"},503)}
 let result;
 try{
  const paymentForm=nmiAutoLikesEnrollmentForm({amountCents:quote.totalCents,paymentToken:token,dayOfMonth,orderId:campaignId});
  result=await nmiAutoLikesCall(paymentForm);
 }catch{
  await db.query("update public.litix_autolikes_enrollment_attempts set status='UNKNOWN_OUTCOME',updated_at=now() where id=$1 and status='REQUESTED'",[attemptId]).catch(()=>{});
  return send({state:"UNKNOWN_OUTCOME",message:"Gateway result cannot be verified. Do not attempt another payment; contact Litix support."},202);
 }
 if(!result.approved){
  await db.query("update public.litix_autolikes_enrollment_attempts set status='DECLINED',response_code=$2,updated_at=now() where id=$1",[attemptId,result.responseCode]).catch(()=>{});
  return send({error:"The recurring subscription was not approved. No supplier order placed."},402);
 }
 if(!result.subscriptionId){
  await db.query("update public.litix_autolikes_enrollment_attempts set status='UNKNOWN_OUTCOME',updated_at=now() where id=$1",[attemptId]).catch(()=>{});
  return send({state:"UNKNOWN_OUTCOME",message:"Subscription provider did not return a verified ID. Do not retry; contact support."},202);
 }
 const subscriptionId="als_"+sha(campaignId+":"+result.subscriptionId).slice(0,40);
 const secret=randomUUID()+"-"+randomUUID(),tokenSha=sha(secret);
 try{
  await db.query(
   "insert into public.litix_autolikes_live_subscriptions(id,campaign_id,subscriber_id,provider_subscription_id,target_profile_url,target_handle,platform,service_id,max_likes_per_post,monthly_post_limit,posts_remaining,amount_cents,status,payment_status) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0,$11,'PAUSED','PENDING') on conflict(id) do nothing",
   [subscriptionId,campaignId,customerId,result.subscriptionId,quote.profileUrl,quote.username,quote.platform,
    quote.serviceId,quote.quantityPerPost,quote.posts,quote.totalCents]);
  await db.query(
   "insert into public.litix_autolikes_native_portal(subscription_id,email,token_sha256) values($1,$2,$3) on conflict(subscription_id) do nothing",
   [subscriptionId,email,tokenSha]);
  await db.query(
   "update public.litix_autolikes_enrollment_attempts set status='GATEWAY_APPROVED_PENDING_VERIFICATION',gateway_subscription_id=$2,updated_at=now() where id=$1 and status='REQUESTED'",
   [attemptId,result.subscriptionId]);
 }catch{
  await db.query("update public.litix_autolikes_enrollment_attempts set status='UNKNOWN_OUTCOME',gateway_subscription_id=$2,updated_at=now() where id=$1",[attemptId,result.subscriptionId]).catch(()=>{});
  return send({state:"UNKNOWN_OUTCOME",message:"Subscription approved but receipt recording needs review. Do not purchase again; contact support."},202);
 }
 const link=new URL("/autolikes/manage",request.url);link.searchParams.set("token",secret);
 const emailed=await sendManagementEmail(email,link.toString());
 return send({subscriptionId,state:"PENDING_SETTLEMENT",monthlyAmountCents:quote.totalCents,
  monthlyPosts:quote.posts,likesPerPost:quote.quantityPerPost,
  portalUrl:link.toString(),emailSent:emailed,
  message:"Recurring enrollment accepted. No supplier subscription is submitted until NMI verifies an actual settled payment."},202);
}
