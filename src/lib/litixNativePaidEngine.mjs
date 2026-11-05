/**
 * Litix Native paid order engine. Never shares data or order IDs with Boostero.
 * Sale attempt happens at most once per unique requestId. On ambiguous gateway
 * outcomes, lock for manual reconciliation instead of risking a double charge.
 * Paid delivery happens only after a matching SETTLED NMI Query report.
 *
 * sql is an injected Neon query adapter. This module has no route by itself.
 */
import {randomUUID,createHash} from "node:crypto";
import {nativePaidQuote,nativeOrderToken,nativeTokenValid,nativeEmailValid,nativeRequestIdValid,verifyNativeNmiSettlement} from "./litixNativeCommercePolicy.mjs";

const sha=x=>createHash("sha256").update(String(x)).digest("hex");
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const safe=(code,http=409)=>({http,body:{error:code,charged:false,delivered:false}});
const dbAvailable=sql=>sql&&typeof sql.query==="function";
const paidEnabled=env=>env?.LITIX_NATIVE_PAID_ENABLED==="true"&&
 env?.LITIX_NATIVE_RELEASE_APPROVAL==="approved-native-pro30-v1"&&env?.VERCEL_ENV==="production";
const fixedGateway="https://paykings.transactiongateway.com/api/transact.php";
const fixedReport="https://paykings.transactiongateway.com/api/query.php";
const hostUrl=id=>/^[a-f0-9-]{36}$/i.test(id)?"https://www.litix.net/native/order?id="+encodeURIComponent(id):null;

async function nmiSale({token,price,orderId,email,env,fetcher}){
 let response;
 try{
  response=await fetcher(fixedGateway,{method:"POST",cache:"no-store",redirect:"error",
   headers:{"content-type":"application/x-www-form-urlencoded"},
   body:new URLSearchParams({security_key:env.NMI_SECURITY_KEY,type:"sale",
    payment_token:token,amount:(price/100).toFixed(2),orderid:orderId,email}),
   signal:AbortSignal.timeout(15000)});
  if(!response?.ok)throw Error("http_error");
  const body=await response.text();
  if(body.length>20000)throw Error("untrusted_response");
  const fields=Object.fromEntries(new URLSearchParams(body));
  if(fields.response==="1"&&/^[A-Za-z0-9-]{3,100}$/.test(String(fields.transactionid||"")))
   return {status:"APPROVED_UNVERIFIED",transactionId:fields.transactionid};
  if(fields.response==="1")return {status:"REVIEW"};
  if(["2","3"].includes(String(fields.response)))return {status:"DECLINED"};
  return {status:"REVIEW"};
 }catch{return {status:"REVIEW"};}
}
export async function nmiSettledFor({transactionId,orderId,amountCents,env,fetcher=fetch}={}){
 if(!env?.NMI_SECURITY_KEY||!/^[A-Za-z0-9-]{3,100}$/.test(String(transactionId||"")))return false;
 try{
  const r=await fetcher(fixedReport,{method:"POST",cache:"no-store",redirect:"error",
   headers:{"content-type":"application/x-www-form-urlencoded"},
   body:new URLSearchParams({security_key:env.NMI_SECURITY_KEY,transaction_id:transactionId}),
   signal:AbortSignal.timeout(10000)});
  if(!r?.ok)return false;
  const raw=await r.text();
  return verifyNativeNmiSettlement(raw,{transactionId,orderId,amountCents}).settled===true;
 }catch{return false;}
}

/** Return the original verified offer with no write and no charge. */
export function quoteNativeOffer({serviceId,brief,env}={}){
 try{
  const q=nativePaidQuote({serviceId,brief,env});
  return {http:200,body:{available:paidEnabled(env),serviceId:q.serviceId,
   priceCents:q.priceCents,currency:"USD",delivery:"verified-settlement-then-private-download",
   charged:false,paymentVerified:false}};
 }catch{return safe("NATIVE_PRICE_OR_FULFILLMENT_UNAVAILABLE",503);}
}

/** Run only from a server POST with valid same-origin request and JSON caps. */
export async function checkoutNativePaid({data,env,sql,fetcher=fetch}={}){
 if(!paidEnabled(env))return safe("NATIVE_PAID_CHECKOUT_DISABLED",503);
 if(!dbAvailable(sql)||!env?.NMI_SECURITY_KEY||!env?.RESEND_API_KEY||
   !env?.LITIX_NATIVE_ORDER_SECRET||env.LITIX_NATIVE_ORDER_SECRET.length<32)
  return safe("NATIVE_PAYMENT_INFRASTRUCTURE_NOT_READY",503);
 if(!data||typeof data!=="object"||Array.isArray(data))return safe("INVALID_ORDER",422);
 const email=String(data.email||"").trim().toLowerCase();
 if(!nativeEmailValid(email)||!nativeRequestIdValid(data.requestId)||
  !/^[A-Za-z0-9_.:-]{10,500}$/.test(String(data.paymentToken||""))||
  /^\d{12,19}$/.test(String(data.paymentToken||"")))
  return safe("INVALID_CHECKOUT_INPUT",422);
 let q;
 try{q=nativePaidQuote({serviceId:data.serviceId,brief:data.brief,env});}
 catch{return safe("NATIVE_PRODUCT_NOT_APPROVED",503);}
 if(data.expectedAmountCents!==q.priceCents)return safe("NATIVE_PRICE_CHANGED",409);
 const orderId=randomUUID(),token=nativeOrderToken(orderId,env.LITIX_NATIVE_ORDER_SECRET);
 const tokenHash=sha(token);
 const idem=String(data.requestId);
 const values=[orderId,idem,email,q.serviceId,q.briefHash,q.priceCents,
  q.directCostCents+q.supportReserveCents,q.asset.filename,q.asset.mimeType,
  q.asset.sha256,q.asset.content,tokenHash];
 let rows;
 try{
  rows=await sql.query(
   "insert into public.litix_native_paid_orders(id,request_id,email,service_id,brief_hash,amount_cents,cost_budget_cents,filename,mime_type,sha256,content,token_hash,payment_state,delivery_state) values($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'PENDING','LOCKED') on conflict(request_id) do nothing returning id",
   values);
 }catch{return safe("NATIVE_ORDER_LEDGER_UNAVAILABLE",503);}
 // No second card charge, even if the original response was lost.
 if(rows?.length!==1)return safe("NATIVE_REQUEST_ALREADY_SUBMITTED_DO_NOT_RETRY",409);
 let claimed;
 try{claimed=await sql.query(
   "update public.litix_native_paid_orders set payment_state='PROCESSING',updated_at=now() where id=$1::uuid and payment_state='PENDING' returning id",
   [orderId]);}
 catch{return safe("NATIVE_PAYMENT_CLAIM_UNAVAILABLE",503);}
 if(claimed?.length!==1)return safe("NATIVE_PAYMENT_CLAIM_UNAVAILABLE",503);
 const answer=await nmiSale({token:data.paymentToken,price:q.priceCents,
  orderId,email,env,fetcher});
 try{
  await sql.query(
   "update public.litix_native_paid_orders set payment_state=$2,gateway_transaction_id=$3,updated_at=now() where id=$1::uuid and payment_state='PROCESSING'",
   [orderId,answer.status,answer.transactionId||null]);
 }catch{
  return {http:202,body:{orderId,payment:"REVIEW",delivered:false,
   message:"Outcome requires reconciliation. Do not place a second order."}};
 }
 return {http:answer.status==="DECLINED"?402:202,
  body:{orderId,token,payment:answer.status,
   charged:answer.status==="APPROVED_UNVERIFIED"?true:"unknown",
   delivered:false,privateStatusUrl:hostUrl(orderId)+"&token="+token,
   message:answer.status==="APPROVED_UNVERIFIED"
    ?"Payment approved; delivery awaits independent settlement verification."
    :answer.status==="DECLINED"?"Card was declined. No fulfillment was started."
    :"The payment outcome needs review. Do not submit another purchase."}};
}

/** Verify only a bearer private token and charge evidence. No new sale requests. */
export async function statusNativePaid({orderId,token,env,sql,fetcher=fetch}={}){
 if(!UUID.test(String(orderId))||!nativeTokenValid(orderId,token,env?.LITIX_NATIVE_ORDER_SECRET))
  return safe("INVALID_PRIVATE_ORDER_LINK",403);
 if(!dbAvailable(sql))return safe("NATIVE_ORDER_LOOKUP_UNAVAILABLE",503);
 let rows;
 const query="select id,email,amount_cents,service_id,filename,mime_type,sha256,content,payment_state,delivery_state,gateway_transaction_id,updated_at from public.litix_native_paid_orders where id=$1::uuid and token_hash=$2";
 try{rows=await sql.query(query,[orderId,sha(token)]);}
 catch{return safe("NATIVE_ORDER_LOOKUP_UNAVAILABLE",503);}
 if(rows.length!==1)return safe("ORDER_NOT_FOUND",404);
 let order=rows[0];
 if(order.payment_state==="APPROVED_UNVERIFIED"&&
   Date.now()-new Date(order.updated_at).getTime()>30000){
  const settled=await nmiSettledFor({transactionId:order.gateway_transaction_id,
   orderId,amountCents:Number(order.amount_cents),env,fetcher});
  if(settled){
   try{
    await sql.query(
     "with confirmed as (update public.litix_native_paid_orders set payment_state='PAID',delivery_state='READY',updated_at=now() where id=$1::uuid and gateway_transaction_id=$2 and payment_state='APPROVED_UNVERIFIED' returning id) insert into public.litix_native_email_outbox(order_id,event,state) select id,'PAID_DELIVERY','PENDING' from confirmed on conflict(order_id,event) do nothing",
     [orderId,order.gateway_transaction_id]);
    const refreshed=await sql.query(query,[orderId,sha(token)]);
    if(refreshed.length===1)order=refreshed[0];
   }catch{return safe("NATIVE_SETTLEMENT_RECONCILIATION_REQUIRED",503);}
  }
 }
 const paid=order.payment_state==="PAID"&&order.delivery_state==="READY";
 if(!paid)return {http:202,body:{orderId,payment:order.payment_state,delivered:false,
   message:"No download until the matching transaction is settled."}};
 return {http:200,body:{orderId,payment:"PAID",delivered:true,serviceId:order.service_id,
  filename:order.filename,mimeType:order.mime_type,sha256:order.sha256,content:order.content}};
}

/** Send a delivery email once, only after PAID and ledger outbox claim. */
export async function sendNativePaidDelivery({orderId,env,sql,fetcher=fetch}={}){
 if(!dbAvailable(sql)||!env?.RESEND_API_KEY||!env?.LITIX_NATIVE_ORDER_SECRET)
  return {state:"NOT_READY"};
 let rows;
 try{
  rows=await sql.query(
   "with claimed as (update public.litix_native_email_outbox set state='SENDING',attempted_at=now() where order_id=$1::uuid and event='PAID_DELIVERY' and state='PENDING' returning order_id) select p.id,p.email,p.filename from public.litix_native_paid_orders p join claimed c on c.order_id=p.id where p.payment_state='PAID' and p.delivery_state='READY'",
   [orderId]);
 }catch{return {state:"LEDGER_UNAVAILABLE"};}
 if(rows.length!==1)return {state:"ALREADY_CLAIMED_OR_NOT_SETTLED"};
 const row=rows[0],token=nativeOrderToken(orderId,env.LITIX_NATIVE_ORDER_SECRET);
 const link=hostUrl(orderId)+"&token="+token;
 let status="REVIEW";
 try{
  const response=await fetcher("https://api.resend.com/emails",{
   method:"POST",cache:"no-store",redirect:"error",signal:AbortSignal.timeout(8000),
   headers:{"authorization":"Bearer "+env.RESEND_API_KEY,"content-type":"application/json",
    "Idempotency-Key":"litix-native-paid-delivery/"+orderId},
   body:JSON.stringify({from:"Litix <orders@litix.net>",to:[row.email],
    subject:"Litix Native — your digital order is ready",
    text:"Your settled Litix Native order is ready.\nFile: "+row.filename+
     "\nPrivate download: "+link+"\nKeep this link private. No social account passwords are needed."})});
  if(response.ok)status="SENT";
 }catch{/* Unknown send result: review manually; never blindly resend. */}
 try{await sql.query("update public.litix_native_email_outbox set state=$2,updated_at=now() where order_id=$1::uuid and event='PAID_DELIVERY' and state='SENDING'",[orderId,status]);}
 catch{return {state:"RECONCILIATION_REQUIRED"};}
 return {state:status};
}
