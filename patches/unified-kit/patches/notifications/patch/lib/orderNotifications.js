import {db} from './db';
import {createTrackingToken} from './paymentGateway';
const events=['created','paid','submitted','completed','attention'];
export async function queueOrderNotification(id,event){
 if(!/^ltx_[a-f0-9-]{36}$/i.test(id)||!events.includes(event))throw Error('Invalid notification');
 await db()`INSERT INTO litix_order_notifications(id,order_id,event_type) VALUES(${id+':'+event},${id},${event}) ON CONFLICT(order_id,event_type) DO NOTHING`;
}
export async function queueTrackingUpdates(){
 const orders=await db()`SELECT o.id,o.payment_status,o.fulfillment_status,o.provider_order_id FROM litix_supplier_orders o WHERE o.created_at>now()-interval '30 days' AND EXISTS(SELECT 1 FROM litix_order_notifications n WHERE n.order_id=o.id AND n.event_type='created') ORDER BY o.updated_at DESC LIMIT 150`;
 for(const o of orders){
  if(o.payment_status==='paid')await queueOrderNotification(o.id,'paid');
  if(o.payment_status==='paid'&&o.provider_order_id)await queueOrderNotification(o.id,'submitted');
  if(o.payment_status==='paid'&&o.fulfillment_status==='completed')await queueOrderNotification(o.id,'completed');
  if(['review','funding'].includes(o.fulfillment_status))await queueOrderNotification(o.id,'attention');
 }
}
export async function deliverOrderNotifications(id=null){
 const sql=db(),jobs=await sql`UPDATE litix_order_notifications SET status='sending',attempts=attempts+1,leased_at=now() WHERE id IN(SELECT id FROM litix_order_notifications WHERE (${id}::text IS NULL OR order_id=${id}) AND ((status IN ('pending','retry') AND next_attempt_at<=now()) OR (status='sending' AND leased_at<now()-interval '6 minutes')) ORDER BY created_at LIMIT 6 FOR UPDATE SKIP LOCKED) RETURNING id,order_id,event_type,attempts`;
 for(const j of jobs){
  try{
   const o=(await sql`SELECT * FROM litix_supplier_orders WHERE id=${j.order_id} LIMIT 1`)[0];
   if(!o)throw Error('Missing order');
   if(j.event_type!=='created'&&j.event_type!=='attention'&&o.payment_status!=='paid')throw Error('Awaiting payment');
   if(!process.env.RESEND_API_KEY||!process.env.EMAIL_FROM)throw Error('Email configuration missing');
   const labels={created:'Order received',paid:'Payment verified',submitted:'Delivery started',completed:'Delivery completed',attention:'Order needs review'};
   const details={created:'Order recorded. Payment has not yet been verified.',paid:'Payment verified.',submitted:'Supplier has accepted your order.',completed:'Supplier reports delivery complete.',attention:'Our team is reviewing this order.'};
   const url='https://www.litix.net/track?orderId='+encodeURIComponent(o.id)+'&token='+encodeURIComponent(createTrackingToken(o.id));
   const body=`${labels[j.event_type]}\nOrder: ${o.id}\nService: ${o.service_name}\nQuantity: ${o.quantity}\nAmount: $${(Number(o.retail_cents)/100).toFixed(2)}\n${details[j.event_type]}\nTrack: ${url}\nDo not submit a duplicate payment.`;
   const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),5000);let res;
   try{res=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':j.id},body:JSON.stringify({from:process.env.EMAIL_FROM,to:[o.customer_email],subject:'Litix — '+labels[j.event_type],text:body}),signal:ctl.signal})}finally{clearTimeout(timer)}
   const data=await res.json().catch(()=>({}));if(!res.ok||!data.id)throw Error('Resend returned '+res.status);
   await sql`UPDATE litix_order_notifications SET status='sent',sent_at=now(),provider_message_id=${data.id},leased_at=null,last_error=null WHERE id=${j.id}`;
  }catch(e){const delay=Math.min(3600,25*2**Math.min(j.attempts,6));await sql`UPDATE litix_order_notifications SET status=${j.attempts>=9?'dead':'retry'},next_attempt_at=now()+(${delay}*interval '1 second'),leased_at=null,last_error=${String(e.message).slice(0,200)} WHERE id=${j.id}`;console.error('order_email_retry',j.id,e.message)}
 }
 return {processed:jobs.length};
}
