// Transactional order notifications. Never include raw card data or log private tracking tokens.
const emailKey=()=>process.env.RESEND_API_KEY||process.env.LITIX_RESEND_API_KEY||"";
export const notificationsConfigured=()=>Boolean(emailKey());

const htmlEscape=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function safeTrackingURL(orderId,secret){
 if(!/^ltx2_[a-f0-9-]{36}$/.test(orderId)||!secret||secret.length>150)throw Error("Invalid tracking details");
 return "https://www.litix.net/?track="+encodeURIComponent(orderId)+"&token="+encodeURIComponent(secret);
}
async function deliver({key,to,subject,text,html}){
 const response=await fetch("https://api.resend.com/emails",{
  method:"POST",
  headers:{"Authorization":"Bearer "+emailKey(),"Content-Type":"application/json","Idempotency-Key":key},
  body:JSON.stringify({from:"Litix <orders@litix.net>",to:[to],subject,text,html}),
  signal:AbortSignal.timeout(8000),cache:"no-store"
 });
 if(!response.ok)throw Error("Resend returned HTTP "+response.status);
 return true;
}
/** Called after payment has been marked paid in the database. Email failures do not affect payments. */
export async function sendOrderEmails({orderId,secret,email,amountCents,quantity,serviceName,fulfillment}){
 if(!notificationsConfigured()){console.warn("Litix transactional email unavailable: missing Resend API key",{orderId});return false}
 const tracking=safeTrackingURL(orderId,secret);
 const amount=(Number(amountCents)/100).toFixed(2);
 const service=String(serviceName||"Social media service").slice(0,200);
 const state=String(fulfillment||"pending").replace(/_/g," ");
 const base="Order: "+orderId+"\nService: "+service+"\nQuantity: "+quantity+"\nTotal: USD $"+amount+"\nSupplier status: "+state;
 const orderEsc=htmlEscape(orderId),serviceEsc=htmlEscape(service),stateEsc=htmlEscape(state),trackEsc=htmlEscape(tracking);
 const details="<p><b>Order:</b> "+orderEsc+"</p><p><b>Service:</b> "+serviceEsc+"</p><p><b>Quantity:</b> "+htmlEscape(quantity)+"</p><p><b>Total:</b> USD $"+htmlEscape(amount)+"</p><p><b>Supplier status:</b> "+stateEsc+"</p>";
 const styles='style="font-family:Arial,sans-serif;background:#091926;color:#f2f7fa;padding:24px;border-radius:12px"';
 const receipt={
  key:"litix-payment/"+orderId,
  to:email,
  subject:"Litix — Payment confirmed",
  text:"Your Litix payment is confirmed.\n\n"+base+"\n\nPrivate order tracking: "+tracking+"\n\nDo not share the tracking link. No social account password is needed.",
  html:"<div "+styles+"><h1>Payment confirmed</h1><p>Thank you for your Litix purchase.</p>"+details+"<p><a href=\""+trackEsc+"\" style=\"color:#80d8ff\">View your order</a></p><p>Keep your tracking link private.</p></div>"
 };
 const trackingEmail={
  key:"litix-tracking/"+orderId,
  to:email,
  subject:"Litix — Your private tracking link",
  text:"Your Litix order has been sent for fulfillment.\n\n"+base+"\n\nTrack your order: "+tracking+"\n\nKeep this link private. Supplier processing times may vary.",
  html:"<div "+styles+"><h1>Track your Litix order</h1><p>Your order has been received for fulfillment.</p>"+details+"<p><a href=\""+trackEsc+"\" style=\"color:#80d8ff\">Track order progress</a></p><p>Keep this link private. Supplier processing times may vary.</p></div>"
 };
 const results=await Promise.allSettled([deliver(receipt),deliver(trackingEmail)]);
 const failures=results.filter(x=>x.status==="rejected");
 if(failures.length){
  console.error("Litix order notification delivery failed",{orderId,failed:failures.length,reasons:failures.map(x=>String(x.reason?.message||"Send failed").slice(0,80))});
  return false;
 }
 console.info("Litix order notifications accepted by Resend",{orderId,count:2});
 return true;
}
