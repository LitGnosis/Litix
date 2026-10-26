import {createHash,timingSafeEqual} from "node:crypto";
import {neon} from "@neondatabase/serverless";
import {notifyOwnersOfVerifiedPurchase} from "./ownerPurchaseNotifications.mjs";
export const bundleUrl=()=>process.env.LITIX_BUNDLES_DATABASE_URL||process.env.LITIX_AUTOLIKES_DATABASE_URL||process.env.LITIX_V2_DATABASE_URL;
export const bundleDB=()=>{if(!bundleUrl())throw Error("BUNDLE_DATABASE_MISSING");return neon(bundleUrl());};
export const hashToken=v=>createHash("sha256").update(String(v)).digest("hex");
export function safeEquals(a,b){
 const x=Buffer.from(hashToken(a),"hex"),y=Buffer.from(hashToken(b),"hex");
 return timingSafeEqual(x,y);
}
export const response=(v,status=200)=>Response.json(v,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
export const sameOrigin=req=>{
 try{return new URL(req.headers.get("origin")).origin===new URL(req.url).origin}catch{return false}
};
const tag=(body,t)=>{
 const m=new RegExp("<"+t+">([^<]{0,200})</"+t+">","i").exec(body);
 return m?.[1]?.trim()||"";
};
export async function verifyNmiSettlement({orderId,transactionId,priceCents}){
 // Read-only NMI Classic Query API; never equate an approved sale with settlement.
 if(!process.env.NMI_SECURITY_KEY||process.env.VERCEL_ENV!=="production"||process.env.NMI_GATEWAY_MODE!=="PRODUCTION")
  return {settled:false,reason:"NO_LIVE_QUERY"};
 if(!/^lbg_[0-9a-f-]{36}$/.test(orderId)||!/^\d{5,32}$/.test(String(transactionId||"")))
  return {settled:false,reason:"BAD_REFERENCE"};
 let raw;
 try{
  const r=await fetch("https://paykings.transactiongateway.com/api/query.php",{
   method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},
   body:new URLSearchParams({security_key:process.env.NMI_SECURITY_KEY,transaction_id:String(transactionId),report_type:"transaction"}),
   signal:AbortSignal.timeout(11000),cache:"no-store"
  });
  if(!r.ok)return {settled:false,reason:"QUERY_HTTP_ERROR"};
  raw=await r.text();
  if(raw.length>150000)return {settled:false,reason:"QUERY_OVERSIZE"};
 }catch{return {settled:false,reason:"QUERY_UNAVAILABLE"};}
 // Transaction ID, order ID, USD price, and exact settled condition must match.
 const transaction=/<transaction>([\s\S]*?)<\/transaction>/i.exec(raw)?.[1];
 if(!transaction)return {settled:false,reason:"QUERY_EMPTY"};
 const transactionAmount=tag(transaction,"amount");
 const actions=[...transaction.matchAll(/<action>([\s\S]*?)<\/action>/gi)].map(m=>m[1]);
 const settledSale=actions.some(a=>tag(a,"action_type")==="sale"&&tag(a,"success")==="1"&&tag(a,"response_code")==="100"&&Math.round(Number(tag(a,"amount"))*100)===priceCents);
 const settleAction=actions.some(a=>tag(a,"action_type")==="settle"&&tag(a,"success")==="1");
 const okay=tag(transaction,"transaction_id")===String(transactionId)&&
  tag(transaction,"order_id")===orderId&&tag(transaction,"condition")==="complete"&&
  (!tag(transaction,"currency")||tag(transaction,"currency")==="USD")&&settledSale&&settleAction;
 return {settled:okay,reason:okay?"SETTLED":"NOT_SETTLED_OR_MISMATCH"};
}
export async function sendBundleReceipt(order,sql){
 const key=process.env.RESEND_API_KEY||process.env.LITIX_RESEND_API_KEY;
 if(!key)return false;
 const text="Your LITIX Growth Bundle payment is settled.\nOrder: "+order.id+"\nPackage: "+order.package_name+
  "\nTotal: $"+(Number(order.price_cents)/100).toFixed(2)+
  "\nStatus: Awaiting WhatsApp Submission\n\nIMPORTANT: Contact LITIX using the official WhatsApp link on your private order status page and submit up to 10 post URLs or screenshots. You must provide public URLs before fulfillment. Quantities are package totals, not per post. LITIX must manually approve allocations before any supplier delivery.";
 let customerSent=false;
 // Persisted customer receipt claim prevents duplicate confirmations even if
 // a payment is checked again days later (beyond Resend's idempotency window).
 let customerClaimed=!sql;
 if(sql){
  try{
   const claimed=await sql.query(
    "insert into litix_owner_purchase_notices(order_id,recipient,event,status) values($1,$2,'bundle_customer_receipt','claimed') on conflict(order_id,recipient,event) do nothing returning order_id",
    [order.id,order.email]);
   customerClaimed=claimed.length>0;
  }catch(e){console.error("Bundle customer receipt claim failed",{orderId:order.id});}
 }
 if(customerClaimed)try{
  const r=await fetch("https://api.resend.com/emails",{
   method:"POST",
   headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json","Idempotency-Key":"litix-bundle-settled/"+order.id},
   body:JSON.stringify({from:"Litix <orders@litix.net>",to:[order.email],subject:"LITIX Growth Bundle — Payment confirmed: "+order.id,
    text:text+"\n\nPrivate status page (use the same browser as checkout): https://litix.net/bundles/confirmation?id="+encodeURIComponent(order.id)}),
   signal:AbortSignal.timeout(9000),cache:"no-store"
  });
  customerSent=r.ok;
 }catch{customerSent=false}
 if(sql&&customerClaimed)try{
  await sql.query(
   "update litix_owner_purchase_notices set status=$3,sent_at=case when $3='sent' then now() else sent_at end where order_id=$1 and recipient=$2 and event='bundle_customer_receipt' and status='claimed'",
   [order.id,order.email,customerSent?"sent":"delivery_uncertain"]);
 }catch(e){console.error("Bundle customer receipt status needs review",{orderId:order.id})}
 // Paid record is re-read and verified by the owner notifier. Only one email
 // per recipient/order, even when checkout, cron and admin reconcile repeatedly.
 if(sql)try{await notifyOwnersOfVerifiedPurchase({sql,kind:"bundle",orderId:order.id})}
 catch(e){console.error("Litix bundle owner notification unavailable",{orderId:order.id,error:String(e?.message||"send failed").slice(0,100)})}
 return customerSent;
}
