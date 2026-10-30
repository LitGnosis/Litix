import {createHash,randomUUID} from "node:crypto";

// Outbox keys deduplicate supplier polls. Never include tracking tokens or card data.
export async function queueCustomerDeliveryChange({sql,orderId,supplierOrderId,previous,latest,state,quantity}){
 const old=String(previous?.status||"Pending").trim().toLowerCase();
 const fresh=String(latest?.status||"Unknown").trim().toLowerCase();
 const before=previous?.remains===null||previous?.remains===undefined?null:Number(previous.remains);
 const now=latest?.remains===null||latest?.remains===undefined?null:Number(latest.remains);
 const validNow=Number.isSafeInteger(now)&&now>=0&&now<=Number(quantity);
 const progressed=validNow&&Number.isSafeInteger(before)&&now<before;
 if(old===fresh&&!progressed&&state!=="COMPLETED"&&state!=="FAILED")return false;
 const label=state==="COMPLETED"?"Delivery completed":state==="FAILED"?"Delivery needs support":
  progressed?"Delivery progressing":fresh==="in progress"?"Processing":"Order update";
 const fingerprint=createHash("sha256")
  .update([supplierOrderId,state,fresh,validNow?now:"unknown"].join("|")).digest("hex");
 const payload={label,remaining:validNow?now:null,total:Number(quantity),
  updatedAt:new Date().toISOString()};
 const inserted=await sql.query(
  "insert into public.litix_customer_delivery_updates(id,order_id,fingerprint,payload) select $2,$1,$3,$4::jsonb from public.litix_v2_orders where id=$1 and payment_state='paid' on conflict(order_id,fingerprint) do nothing returning id",
  [orderId,randomUUID(),fingerprint,JSON.stringify(payload)]);
 return inserted.length===1;
}

// Claimed events survive a crashed cron invocation. Resend receives a stable
// Idempotency-Key per event so a retry cannot send a second customer email.
export async function sendCustomerDeliveryUpdates({sql,sendEmail,limit=12}){
 let claimed=0,sent=0,failed=0;
 for(let i=0;i<Math.min(15,Math.max(1,limit));i++){
  const candidates=await sql.query(
   "with chosen as (select id from public.litix_customer_delivery_updates where ((send_state='queued' and next_attempt_at<=now()) or (send_state='sending' and leased_at<now()-interval '12 minutes')) and attempts<5 order by created_at limit 1 for update skip locked) update public.litix_customer_delivery_updates n set send_state='sending',leased_at=now(),attempts=n.attempts+1 from chosen where n.id=chosen.id returning n.id,n.order_id,n.payload,n.attempts");
  if(candidates.length!==1)break;
  const event=candidates[0];claimed++;
  try{
   const orders=await sql.query(
    "select email,service_name,quantity,amount_cents from public.litix_v2_orders where id=$1 and payment_state='paid' and email is not null",
    [event.order_id]);
   if(orders.length!==1)throw Error("paid_customer_order_not_found");
   const o=orders[0],p=event.payload||{},label=String(p.label||"Order update");
   const trackUrl="https://www.litix.net/track?order="+encodeURIComponent(event.order_id);
   const remaining=p.remaining!==null&&p.remaining!==undefined&&Number.isSafeInteger(Number(p.remaining))?
    "Remaining to deliver: "+Number(p.remaining).toLocaleString("en-US")+" of "+Number(o.quantity).toLocaleString("en-US"):null;
   const message=[
    "Litix — Your delivery status has changed",
    "Litix Order: "+event.order_id,
    "Service: "+String(o.service_name||"Litix service"),
    "Status: "+label,remaining,
    "Payment: Paid · USD $"+(Number(o.amount_cents)/100).toFixed(2),
    "Track your order: "+trackUrl,
    "Open the page with your checkout email, or use the private tracking link in your original receipt.",
    "Need help? Contact Litix at litixsocial@gmail.com.",
    "Do not place or pay for a duplicate order while this order is processing."
   ].filter(Boolean).join("\n");
   await sendEmail({to:o.email,subject:"Litix — "+label+" · Order update",
    text:message,key:"litix-delivery-update/"+event.id});
   await sql.query(
    "update public.litix_customer_delivery_updates set send_state='sent',sent_at=now(),last_error=null where id=$1 and send_state='sending'",
    [event.id]);
   sent++;
  }catch(error){
   const terminal=Number(event.attempts)>=5;
   await sql.query(
    "update public.litix_customer_delivery_updates set send_state=$2,last_error=$3,next_attempt_at=now()+interval '15 minutes',leased_at=null where id=$1 and send_state='sending'",
    [event.id,terminal?"failed":"queued",String(error?.message||"email_send_unavailable").slice(0,85)]).catch(()=>{});
   failed++;
  }
 }
 return {claimed,sent,failed};
}
