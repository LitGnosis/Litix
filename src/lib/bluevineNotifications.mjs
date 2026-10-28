// Pending Bluevine orders are NOT paid purchases.
// Notify the customer and both owners once a pending record has been created.
import {OWNER_ORDER_RECIPIENTS} from "./ownerNotifications.mjs";
const key=()=>process.env.RESEND_API_KEY||process.env.LITIX_RESEND_API_KEY||"";
const send=async({to,subject,text,idempotencyKey})=>{
 const r=await fetch("https://api.resend.com/emails",{
  method:"POST",headers:{"Authorization":"Bearer "+key(),"Content-Type":"application/json","Idempotency-Key":idempotencyKey},
  body:JSON.stringify({from:"Litix <orders@litix.net>",to,subject,text}),
  cache:"no-store",signal:AbortSignal.timeout(9000)
 });
 return r.ok;
};
export async function notifyBluevineOrderPending({orderId,email,phone,profile,packageName,packageId,priceCents,createdAt,trackingToken}){
 if(!/^lbg_[a-f0-9-]{36}$/.test(orderId)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!Number.isSafeInteger(priceCents)||priceCents<1)
  throw Error("Invalid pending order information");
 if(!key())return {owner:false,customer:false,reason:"RESEND_NOT_CONFIGURED"};
 const amount="USD $"+(priceCents/100).toFixed(2);
 const when=new Date(createdAt||Date.now()).toISOString();
 const common="Order ID: "+orderId+"\nBundle: "+packageName+"\nAmount: "+amount+"\nPayment status: AWAITING PAYMENT VERIFICATION";
 const tracking="https://www.litix.net/bundles/confirmation?id="+encodeURIComponent(orderId)+
 (trackingToken?"&token="+encodeURIComponent(trackingToken):"");
 const submission="Choose any submission method after paying:\n"+
  "WhatsApp: Use the button on the LITIX order page to send your order number, bundle, platform and up to 10 post links/screenshots.\n"+
  "Email: litixsocial@gmail.com (attach receipt and screenshots).\n"+
  "Instagram: https://www.instagram.com/litixsocial/ (open the profile and DM your order number, receipt and posts).\n"+
  "Do not send card numbers. These submission options do not automatically mark a payment paid.";
 const ownerBody="A new Bluevine order was recorded. THIS IS NOT A PAID ORDER.\n"+common+
  "\nCreated UTC: "+when+"\nCustomer email: "+email+"\nCustomer phone (not necessarily WhatsApp): "+(phone||"Not provided")+
  "\nCustomer profile: "+profile+"\nPackage ID: "+packageId+
  "\n\nVerify independently in Bluevine before marking paid. Review up to 10 posts submitted by any of the three contact methods. MANUAL FULFILLMENT ONLY. Do not dispatch to a supplier automatically. No card information is included.";
 const customerBody="Thank you for choosing LITIX! Your order has been placed successfully but Bluevine payment is not yet verified.\n"+common+
  "\n\nAfter Bluevine checkout, open your PRIVATE order confirmation and tracking link: "+tracking+
  "\n"+submission+
  "\nLITIX will independently verify payment and send your paid confirmation. Do not pay twice because the order says pending. Keep this private tracking URL to yourself.";
 const delivered=await Promise.allSettled([
  send({to:[...OWNER_ORDER_RECIPIENTS],subject:"LITIX Bluevine pending order — NOT PAID — "+orderId,text:ownerBody,idempotencyKey:"litix-bluevine-owner-pending/"+orderId}),
  send({to:[email],subject:"LITIX — Your Bluevine bundle order is pending",text:customerBody,idempotencyKey:"litix-bluevine-customer-pending/"+orderId})
 ]);
 return {owner:delivered[0].status==="fulfilled"&&delivered[0].value,customer:delivered[1].status==="fulfilled"&&delivered[1].value};
}
