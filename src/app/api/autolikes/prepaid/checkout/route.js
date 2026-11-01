// Independent ONE-TIME PayKings payment. Does not use or modify recurring APIs
// or existing Litix orders. All supplier operations occur only after durable PAID.
import {randomUUID,createHash} from "node:crypto";
import {boosteroProduction} from "../../../../../lib/boosteroReadOnly.mjs";
import {boosteroSQL,boosteroProductionReady} from "../../../../../lib/boosteroFulfillment.mjs";
import {quotePrepaidAutoLikes} from "../../../../../lib/litixPrepaidAutoLikes.mjs";
import {prepaidAutoLikesEnabled,dispatchPrepaidAutoLikes} from "../../../../../lib/litixPrepaidAutoLikesFulfillment.mjs";
import {after} from "next/server";
export const runtime="nodejs";export const dynamic="force-dynamic";export const maxDuration=60;
const hash=s=>createHash("sha256").update(String(s)).digest("hex");
const reply=(b,s=200)=>Response.json(b,{status:s,headers:{"cache-control":"no-store","referrer-policy":"no-referrer","x-content-type-options":"nosniff"}});
async function emailReceipt(to,portal,orderId,amountCents,posts,likes){
 const key=process.env.RESEND_API_KEY||process.env.LITIX_RESEND_API_KEY,from=process.env.EMAIL_FROM;
 if(!key||!from)return;
 const text="Your Litix AutoLikes prepaid order is recorded.\n"+
  "Order: "+orderId+"\nPaid: $"+(amountCents/100).toFixed(2)+
  "\nPlan: "+likes+" Likes per new post; up to "+posts+" future posts for 30 days. No recurring charges.\n"+
  "Manage your order privately: "+portal+
  "\nSupplier monitoring begins after payment and fulfillment verification. "+
  "Need assistance? litixsocial@gmail.com";
 try{await fetch("https://api.resend.com/emails",{method:"POST",
  headers:{"authorization":"Bearer "+key,"content-type":"application/json",
   "Idempotency-Key":"litix-prepaid-receipt-"+hash(orderId).slice(0,36)},
  body:JSON.stringify({from,to:[to],subject:"Litix — AutoLikes prepaid order "+orderId,text}),
  redirect:"error",cache:"no-store",signal:AbortSignal.timeout(10000)})}catch{}
}
export async function POST(request){
 if(!prepaidAutoLikesEnabled())return reply({error:"Prepaid AutoLikes checkout unavailable. No charge attempted."},503);
 const origin=request.headers.get("origin");
 if(!origin||origin!==new URL(request.url).origin)return reply({error:"Invalid checkout origin"},403);
 let input;
 try{
  const raw=await request.text();if(raw.length>3600)throw Error();
  input=JSON.parse(raw);
 }catch{return reply({error:"Invalid checkout request"},400)}
 const email=String(input?.email||"").trim().toLowerCase();
 const paymentToken=String(input?.paymentToken||"");
 const requestKey=String(input?.requestKey||"");
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||
  !/^[0-9a-f-]{36}$/i.test(requestKey)||
  !/^[A-Za-z0-9_.-]{12,500}$/.test(paymentToken)||/^\d{12,19}$/.test(paymentToken)||
  input?.monitoringConsent!==true||input?.singlePaymentConsent!==true)
  return reply({error:"A valid contact, payment token and explicit one-time monitoring consent are required."},422);
 let quote,sql=boosteroSQL();
 try{
  const services=await boosteroProduction("services");
  quote=quotePrepaidAutoLikes({services,platform:input.platform,profile:input.profile,
   tierId:input.tierId,posts:input.posts});
  if(Number(input?.expectedAmountCents)!==quote.amountCents)
   return reply({error:"Price changed. Review an updated quote before payment. No charge attempted."},409);
  // Preflight all required durable ledgers before sending anything to the gateway.
  await sql.query("select id from public.litix_autolikes_prepaid_orders where false");
  const wallet=await boosteroProduction("balance");
  const reserved=await sql.query(
   "select coalesce(sum(wholesale_reserved_cents),0)::bigint cents from public.litix_autolikes_prepaid_orders where payment_status='PAID' and fulfillment_state IN('QUEUED','CLAIMED','SUBMITTED') and period_end>now()");
  const totalReserved=Number(reserved[0]?.cents||0);
  if(!Number.isFinite(Number(wallet.balance))||
   Number(wallet.balance)<(totalReserved+quote.wholesaleCents)/100)
   return reply({error:"Litix AutoLikes is temporarily unavailable. No payment attempted."},409);
 }catch{return reply({error:"Cannot confirm a safe AutoLikes purchase. No payment attempted."},503)}
 const id="alp_"+randomUUID();
 const token=randomUUID()+"-"+randomUUID();
 let created;
 try{
  created=await sql.query(
   "insert into public.litix_autolikes_prepaid_orders(id,idempotency_key,email,public_token_hash,platform,target_profile_url,target_handle,tier_id,service_id,likes_per_post,posts_limit,amount_cents,wholesale_reserved_cents,payment_status,fulfillment_state) values($1,$2::uuid,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'PROCESSING','AWAITING_PAYMENT') on conflict(idempotency_key) do nothing returning id",
   [id,requestKey,email,hash(token),quote.platform,quote.profileUrl,quote.username,
    quote.tierId,quote.supplierServiceId,quote.likesPerPost,quote.posts,quote.amountCents,quote.wholesaleCents]);
  if(!created.length)return reply({error:"This checkout request was already processed. No repeat charge attempted."},409);
 }catch{return reply({error:"Cannot reserve this payment safely. No charge attempted."},503)}
 let gateway;
 try{
  const response=await fetch("https://paykings.transactiongateway.com/api/transact.php",{
   method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},
   cache:"no-store",redirect:"error",signal:AbortSignal.timeout(18000),
   body:new URLSearchParams({security_key:process.env.NMI_SECURITY_KEY,type:"sale",
    payment_token:paymentToken,amount:(quote.amountCents/100).toFixed(2),orderid:id,email}).toString()
  });
  if(!response.ok)throw Error("gateway_http");
  gateway=Object.fromEntries(new URLSearchParams(await response.text()));
 }catch{
  await sql.query("update public.litix_autolikes_prepaid_orders set payment_status='REVIEW',error_code='PAYMENT_UNKNOWN',updated_at=now() where id=$1 and payment_status='PROCESSING'",[id]).catch(()=>{});
  return reply({orderId:id,payment:"review",message:"Payment status cannot be confirmed. Do not retry checkout; contact Litix support."},202);
 }
 if(String(gateway.response)==="1"&&String(gateway.response_code||"")!=="100"){
  // An approval-like response with incomplete fields is ambiguous, NOT a decline.
  await sql.query("update public.litix_autolikes_prepaid_orders set payment_status='REVIEW',error_code='PAYMENT_RESPONSE_REVIEW',updated_at=now() where id=$1 and payment_status='PROCESSING'",[id]).catch(()=>{});
  return reply({orderId:id,payment:"review",message:"Gateway approval needs verification. Do not submit another purchase."},202);
 }
 if(String(gateway.response)!=="1"){
  await sql.query("update public.litix_autolikes_prepaid_orders set payment_status='DECLINED',error_code='PAYMENT_DECLINED',updated_at=now() where id=$1 and payment_status='PROCESSING'",[id]).catch(()=>{});
  return reply({orderId:id,payment:"declined",message:"Payment not approved. No AutoLikes order submitted."},402);
 }
 const txn=String(gateway.transactionid||"");
 if(!/^[A-Za-z0-9-]{3,100}$/.test(txn)){
  await sql.query("update public.litix_autolikes_prepaid_orders set payment_status='REVIEW',error_code='PAYMENT_TXN_MISSING',updated_at=now() where id=$1",[id]).catch(()=>{});
  return reply({orderId:id,payment:"review",message:"Payment requires manual verification. No supplier order submitted."},202);
 }
 try{
  const paid=await sql.query(
   "update public.litix_autolikes_prepaid_orders set payment_status='PAID',payment_transaction_id=$2,paid_at=now(),period_end=now()+interval '30 days',fulfillment_state='QUEUED',updated_at=now() where id=$1 and payment_status='PROCESSING' returning id",
   [id,txn]);
  if(paid.length!==1)throw Error("paid_record_not_stored");
 }catch{
  await sql.query("update public.litix_autolikes_prepaid_orders set payment_status='REVIEW',error_code='PAYMENT_LEDGER_REVIEW',updated_at=now() where id=$1 and payment_status='PROCESSING'",[id]).catch(()=>{});
  return reply({orderId:id,payment:"review",message:"Payment was approved but fulfillment is held for ledger review. Do not pay again."},202);
 }
 let fulfillment="QUEUED";
 try{
  await dispatchPrepaidAutoLikes({sql,orderId:id,limit:1});
  const rows=await sql.query("select fulfillment_state from public.litix_autolikes_prepaid_orders where id=$1",[id]);
  fulfillment=String(rows[0]?.fulfillment_state||"QUEUED");
 }catch{fulfillment="QUEUED"}
 const portal=new URL("/autolikes/prepaid/manage",request.url);
 portal.searchParams.set("token",token);
 after(()=>emailReceipt(email,portal.toString(),id,quote.amountCents,quote.posts,quote.likesPerPost));
 return reply({orderId:id,privateTrackingUrl:portal.toString(),payment:"paid",
  fulfillment:fulfillment==="SUBMITTED"?"processing":fulfillment==="UNKNOWN_OUTCOME"?"review":
   fulfillment==="MANUAL_REVIEW"?"review":"pending",
  amountCents:quote.amountCents,posts:quote.posts,likesPerPost:quote.likesPerPost,
  message:fulfillment==="SUBMITTED"?"Payment accepted. Your Litix new-post monitoring is being set up.":
   "Payment accepted. Activation requires additional verification; do not place a duplicate order."},202);
}
