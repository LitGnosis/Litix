import {createHash} from "node:crypto";

// Only dispatched for durable PAID AutoLikes records. Separate confirmations
// are independently idempotent and never trigger another payment or supplier order.
const digest=value=>createHash("sha256").update(String(value)).digest("hex").slice(0,40);
const usd=cents=>"$"+(Number(cents)/100).toFixed(2);

export function prepaidAutoLikesMessages({
 email,portal,orderId,amountCents,posts,likes,platform,fulfillment
}){
 if(!/^alp_[a-f0-9-]{36}$/i.test(String(orderId))||!Number.isSafeInteger(Number(amountCents))||
  Number(amountCents)<100||!Number.isSafeInteger(Number(posts))||Number(posts)<1||Number(posts)>10||
  !Number.isSafeInteger(Number(likes))||Number(likes)<1||
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email)))throw Error("invalid_paid_autolikes_notice");
 const link=new URL(portal);
 if(link.protocol!=="https:"||!["litix.net","www.litix.net"].includes(link.hostname)||
  link.pathname!=="/autolikes/prepaid/manage"||!link.searchParams.get("token"))
  throw Error("invalid_tracking_link");
 const reference=String(orderId),paid=usd(amountCents);
 const plan=`${Number(likes)} likes per future post, up to ${Number(posts)} posts within 30 days; one-time payment, no automatic renewal.`;
 const trackingStatus=fulfillment==="processing"?
  "Your package has been submitted for supplier monitoring; future posts may take time to appear.":
  "Your package is recorded. Activation is being verified; monitoring is not yet confirmed.";
 return [
  {kind:"payment",recipients:[email],
   subject:`Litix Payment Confirmation — ${reference}`,
   text:`Litix payment confirmation\n\nYour payment was accepted.\nOrder: ${reference}\nAmount paid: ${paid}\nPayment status: PAID\nPlatform: ${platform}\nPlan: ${plan}\n\nYour separate tracking email contains the private link. Keep it confidential.\nSupport: litixsocial@gmail.com\n`},
  {kind:"tracking",recipients:[email],
   subject:`Litix AutoLikes — Private Order Tracking ${reference}`,
   text:`Your private Litix AutoLikes tracking link\n\nOrder: ${reference}\nPayment status: PAID\n${trackingStatus}\n\nTrack your order here:\n${link.toString()}\n\nThis link allows private order access. Do not forward or publish it.\nOnly future public posts count toward your plan. Delivery depends on supplier availability.\nSupport: litixsocial@gmail.com\n`},
  {kind:"owner",recipients:["litixsocial@gmail.com","litgnosisllc@gmail.com"],
   subject:`Litix Owner Alert — Paid AutoLikes ${reference}`,
   text:`New verified paid Litix AutoLikes purchase\n\nOrder: ${reference}\nCustomer contact: ${email}\nAmount: ${paid}\nPayment status: PAID\nPlatform: ${platform}\nPlan: ${plan}\nActivation: ${fulfillment==="processing"?"Submitted for monitoring":"Pending review / verification"}\n\nCheck the protected order ledger before manually contacting the supplier. Do not re-charge or re-submit the supplier order without reconciliation.\n`}
 ];
}
export async function sendPrepaidAutoLikesNotifications(input,{
 fetcher=fetch,
 apiKey=process.env.RESEND_API_KEY||process.env.LITIX_RESEND_API_KEY,
 from=process.env.EMAIL_FROM||"Litix <orders@litix.net>"
}={}){
 const messages=prepaidAutoLikesMessages(input);
 if(!apiKey)throw Error("autolikes_email_not_configured");
 const outcomes=await Promise.all(messages.map(async message=>{
  const idempotency="litix-prepaid-"+message.kind+"-"+digest(input.orderId);
  // Two attempts only for clearly retriable provider/network failures;
  // same exact idempotency key prevents duplicate provider acceptance.
  for(let attempt=0;attempt<2;attempt++){
   try{
    const res=await fetcher("https://api.resend.com/emails",{
     method:"POST",headers:{"authorization":"Bearer "+apiKey,
      "content-type":"application/json","Idempotency-Key":idempotency},
     body:JSON.stringify({from,to:message.recipients,subject:message.subject,text:message.text}),
     redirect:"error",cache:"no-store",signal:AbortSignal.timeout(9000)
    });
    if(res.ok)return {kind:message.kind,queued:true};
    if(![408,429,500,502,503,504].includes(res.status)||attempt===1)
     return {kind:message.kind,queued:false,status:res.status};
   }catch{
    if(attempt===1)return {kind:message.kind,queued:false,status:"network"};
   }
  }
  return {kind:message.kind,queued:false,status:"retry-exhausted"};
 }));
 // Record only classification, NEVER customer email or the private token.
 for(const result of outcomes){
  if(!result.queued)console.error("litix_autolikes_email_delivery_failed",
   {kind:result.kind,status:result.status,orderId:input.orderId});
 }
 return outcomes;
}
