// Owner-only Resend purchase alerts. Called only after the canonical payment
// record is committed as paid/settled. No payment tokens or card data enter mail.
import {createHash} from "node:crypto";

export const OWNER_PURCHASE_RECIPIENTS=Object.freeze([
 "litixsocial@gmail.com","litgnosisllc@gmail.com"
]);
const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,c=>({
 "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[c]));
const safe=value=>String(value??"").replace(/[\x00-\x1f\x7f]/g," ").slice(0,450);
const usd=cents=>"USD $"+(Number(cents)/100).toFixed(2);
const createdDate=value=>{
 const date=new Date(value);
 return Number.isNaN(date.getTime())?"Not recorded":date.toISOString();
};

async function paidOrder(sql,kind,orderId){
 if(kind==="bundle"){
  const rows=await sql.query(
   "select id,email,profile_ref,platform,package_name,package_items,price_cents,payment_state,order_state,created_at from litix_growth_bundle_orders where id=$1 and payment_state='settled'",
   [orderId]);
  const o=rows[0];if(!o)return null;
  const items=o.package_items&&typeof o.package_items==="object"?o.package_items:{};
  const contents=Object.entries(items).filter(([k,v])=>/^(Likes|Views|Shares|Followers|Impressions|Saves|Reposts)$/.test(k)&&Number.isFinite(Number(v)))
   .map(([k,v])=>k+": "+Number(v).toLocaleString("en-US")).join("; ");
  return {
   orderId:o.id,kind,createdAt:createdDate(o.created_at),
   customerEmail:safe(o.email),customerContact:"Account/profile: "+safe(o.profile_ref||"Not supplied"),
   item:safe(o.platform)+" — "+safe(o.package_name),quantity:contents||"See package allocations",
   amount:usd(o.price_cents),paymentStatus:"settled",fulfillmentStatus:safe(o.order_state),
   instructions:"MANUAL FULFILLMENT ONLY. Await customer WhatsApp post links or screenshots, review them, collect valid public post URLs for approved allocations, and update the order in the owner bundle dashboard. Followers apply once to the customer's account. Do not automatically order from SMMGLOB or another supplier."
  };
 }
 if(kind==="service"){
  const rows=await sql.query(
   "select id,email,service_id,service_name,destination,quantity,amount_cents,payment_state,fulfillment_state,created_at from litix_v2_orders where id=$1 and payment_state='paid'",
   [orderId]);
  const o=rows[0];if(!o)return null;
  return {
   orderId:o.id,kind,createdAt:createdDate(o.created_at),
   customerEmail:safe(o.email),customerContact:"Destination: "+safe(o.destination),
   item:safe(o.service_name)+" (Service #"+safe(o.service_id)+")",
   quantity:Number(o.quantity).toLocaleString("en-US"),
   amount:usd(o.amount_cents),paymentStatus:"paid",fulfillmentStatus:safe(o.fulfillment_state),
   instructions:"Normal service order: follow the existing supplier dispatch and tracking workflow. If fulfillment is manual_review or needs attention, inspect and reconcile the order before acting. Never place a duplicate supplier order."
  };
 }
 throw Error("UNSUPPORTED_ORDER_KIND");
}

export async function notifyOwnersOfVerifiedPurchase({sql,kind,orderId}){
 if(!sql||typeof sql.query!=="function")throw Error("NOTIFICATION_DATABASE_UNAVAILABLE");
 if(!/^(?:ltx2_|lbg_)[a-f0-9-]{36}$/.test(String(orderId||"")))throw Error("INVALID_ORDER_ID");
 const key=process.env.RESEND_API_KEY||process.env.LITIX_RESEND_API_KEY;
 if(!key){console.warn("Litix owner notification unavailable: missing Resend configuration",{orderId});return false}
 const order=await paidOrder(sql,kind,orderId);
 if(!order)return false; // no email until success is verified in persisted DB
 const subject="Litix paid "+(kind==="bundle"?"Growth Bundle":"service")+" — "+order.orderId;
 const fields=[
  ["Order ID",order.orderId],["Purchase date (UTC)",order.createdAt],
  ["Customer email",order.customerEmail],["Customer contact",order.customerContact],
  ["Purchased service or bundle",order.item],["Quantity / package inclusions",order.quantity],
  ["Total",order.amount],["Payment status",order.paymentStatus],
  ["Fulfillment status",order.fulfillmentStatus],["Fulfillment instructions",order.instructions]
 ];
 const message=fields.map(([label,value])=>label+": "+value).join("\n");
 const html="<div style=\"font:14px Arial,sans-serif;color:#14263a\">"+
  "<h2>Litix verified purchase</h2>"+
  fields.map(([label,value])=>"<p><b>"+escapeHtml(label)+":</b> "+escapeHtml(value)+"</p>").join("")+
  "<p>No payment-card data is included.</p></div>";
 let allSent=true;
 for(const to of OWNER_PURCHASE_RECIPIENTS){
  // Unique primary key is the durable guard across retries, concurrent callbacks
  // and repeated admin/cron settlement checks. An uncertain send remains claimed.
  const claim=await sql.query(
   "insert into litix_owner_purchase_notices(order_id,recipient,event,status) values($1,$2,'verified_payment','claimed') on conflict(order_id,recipient,event) do nothing returning order_id",
   [order.orderId,to]);
  if(!claim.length)continue;
  const idem="litix-owner-payment/"+createHash("sha256").update(order.orderId+"|"+to).digest("hex");
  try{
   const res=await fetch("https://api.resend.com/emails",{
    method:"POST",
    headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json","Idempotency-Key":idem},
    body:JSON.stringify({from:"Litix <orders@litix.net>",to:[to],subject,text:message,html}),
    cache:"no-store",signal:AbortSignal.timeout(8000)
   });
   if(!res.ok)throw Error("Resend HTTP "+res.status);
   await sql.query(
    "update litix_owner_purchase_notices set status='sent',sent_at=now() where order_id=$1 and recipient=$2 and event='verified_payment' and status='claimed'",
    [order.orderId,to]);
  }catch(error){
   allSent=false;
   await sql.query(
    "update litix_owner_purchase_notices set status='delivery_uncertain' where order_id=$1 and recipient=$2 and event='verified_payment' and status='claimed'",
    [order.orderId,to]).catch(()=>{});
   console.error("Litix owner purchase notice needs review",{orderId:order.orderId,recipient:to,reason:String(error?.message||"unknown").slice(0,90)});
   // No blind resend on repeated callbacks: response could have been accepted.
  }
 }
 return allSent;
}
