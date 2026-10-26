import {randomUUID,randomBytes} from "node:crypto";
import {growthBundle} from "../../../../lib/growthBundles.mjs";
import {bundleCheckoutReady} from "../route.js";
import {bundleDB,hashToken,response,sameOrigin,verifyNmiSettlement,sendBundleReceipt} from "../../../../lib/bundleOrders.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=50;
export async function POST(req){
 if(!sameOrigin(req))return response({error:"Origin verification failed"},403);
 if(!await bundleCheckoutReady())return response({error:"Growth Bundle checkout is not yet enabled. No payment submitted."},503);
 let input;
 try{const raw=await req.text();if(raw.length>3500)throw Error("Too large");input=JSON.parse(raw);}catch{return response({error:"Invalid checkout request"},400);}
 const pkg=growthBundle(input?.packageId),email=String(input?.email||"").trim().toLowerCase(),
  profile=String(input?.profile||"").trim().slice(0,150),
  token=String(input?.paymentToken||"").trim(),idem=String(input?.idempotencyKey||"").trim();
 if(!pkg||!Number.isSafeInteger(input?.expectedAmountCents)||input.expectedAmountCents!==pkg.priceCents||
   !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||
   !/^[\w.@:/-]{2,150}$/.test(profile)||
   !/^[a-f0-9-]{36}$/i.test(idem)||token.length<10||token.length>500||input?.whatsappConsent!==true)
   return response({error:"Invalid package, account, email, consent or secure payment token"},422);
 const id="lbg_"+randomUUID(),secret=randomBytes(28).toString("base64url"),sql=bundleDB();
 try{
  const rows=await sql.query(
   "insert into litix_growth_bundle_orders(id,email,package_id,platform,package_name,price_cents,package_items,idempotency_key,tracking_token_hash,profile_ref,terms_accepted_at,payment_state) values($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,now(),'processing') on conflict(idempotency_key) do nothing returning id",
   [id,email,pkg.id,pkg.platform,pkg.name,pkg.priceCents,JSON.stringify(pkg.items),idem,hashToken(secret),profile]);
  if(!rows.length)return response({error:"This checkout was already submitted. Do not retry a payment without reconciling the original attempt."},409);
 }catch{return response({error:"Bundle order database unavailable. Payment not submitted."},503);}
 let pay;
 try{
  const r=await fetch("https://paykings.transactiongateway.com/api/transact.php",{
   method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},
   body:new URLSearchParams({
    security_key:process.env.NMI_SECURITY_KEY,type:"sale",payment_token:token,amount:(pkg.priceCents/100).toFixed(2),
    orderid:id,email,order_description:pkg.name
   }),cache:"no-store",signal:AbortSignal.timeout(18000)
  });
  if(!r.ok)throw Error("gateway unavailable");
  pay=Object.fromEntries(new URLSearchParams(await r.text()));
 }catch{
  await sql.query("update litix_growth_bundle_orders set payment_state='review',order_state='Needs Attention',updated_at=now() where id=$1",[id]).catch(()=>{});
  return response({orderId:id,trackingToken:secret,payment:"review",message:"Payment outcome uncertain. Do not resubmit; contact LITIX with the order number."},202);
 }
 if(String(pay.response)!=="1"||String(pay.response_code)!=="100"){
  await sql.query("update litix_growth_bundle_orders set payment_state='declined',updated_at=now() where id=$1",[id]).catch(()=>{});
  return response({error:"Payment declined. No supplier fulfillment was submitted."},402);
 }
 const transactionId=String(pay.transactionid||"");
 if(!/^\d{5,32}$/.test(transactionId)){
  await sql.query("update litix_growth_bundle_orders set payment_state='review',order_state='Needs Attention',updated_at=now() where id=$1",[id]).catch(()=>{});
  return response({orderId:id,trackingToken:secret,payment:"review",message:"Gateway approval requires independent reconciliation."},202);
 }
 try{await sql.query("update litix_growth_bundle_orders set payment_state='approved_pending_settlement',order_state='Awaiting WhatsApp Submission',gateway_transaction_id=$2,updated_at=now() where id=$1",[id,transactionId]);}
 catch{return response({orderId:id,trackingToken:secret,payment:"review",message:"Gateway result must be reconciled. Do not pay twice."},202);}
 const settled=await verifyNmiSettlement({orderId:id,transactionId,priceCents:pkg.priceCents});
 if(settled.settled){
  await sql.query("update litix_growth_bundle_orders set payment_state='settled',order_state='Awaiting WhatsApp Submission',settled_at=now(),updated_at=now() where id=$1 and payment_state='approved_pending_settlement'",[id]);
  await sendBundleReceipt({id,email,package_name:pkg.name,price_cents:pkg.priceCents},sql).catch(()=>false);
 }
 // Never call SMMGLOB in this route. Supplier dispatch can ONLY be admin-approved.
 return response({
  orderId:id,trackingToken:secret,payment:settled.settled?"settled":"approved_pending_settlement",
  status:"Awaiting WhatsApp Submission",
  message:settled.settled?"Payment settled. Contact LITIX on WhatsApp to submit up to 10 posts.":"PayKings approved your payment. Tap WhatsApp on your order confirmation to send the order number and post links. Fulfillment begins only after settlement verification and manual review. Do not pay again."
 },settled.settled?200:202);
}
