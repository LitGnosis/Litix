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
export async function notifyBluevineOrderPending({orderId,email,whatsapp,profile,packageName,packageId,priceCents,createdAt}){
 if(!/^lbg_[a-f0-9-]{36}$/.test(orderId)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!Number.isSafeInteger(priceCents)||priceCents<1)
  throw Error("Invalid pending order information");
 if(!key())return {owner:false,customer:false,reason:"RESEND_NOT_CONFIGURED"};
 const amount="USD $"+(priceCents/100).toFixed(2);
 const when=new Date(createdAt||Date.now()).toISOString();
 const common="Order ID: "+orderId+"\nBundle: "+packageName+"\nAmount: "+amount+"\nPayment status: AWAITING PAYMENT VERIFICATION";
 const tracking="https://www.litix.net/bundles/confirmation?id="+encodeURIComponent(orderId);
 const ownerBody="A new Bluevine order was recorded. THIS IS NOT A PAID ORDER.\n"+common+
  "\nCreated UTC: "+when+"\nCustomer email: "+email+"\nCustomer WhatsApp: "+whatsapp+
  "\nCustomer profile: "+profile+"\nPackage ID: "+packageId+
  "\n\nVerify the actual payment independently in Bluevine before marking it paid. Then review links or screenshots for up to 10 posts via WhatsApp; MANUAL FULFILLMENT ONLY. Do not dispatch to a supplier automatically. No card information is included.";
 const customerBody="Your LITIX Bluevine order has been saved as pending, not yet marked paid.\n"+common+
  "\n\nComplete payment at Bluevine. After payment, use the same browser for order tracking: "+tracking+
  "\nReturn to LITIX and send your order number, Instagram/TikTok account and up to 10 post links or screenshots via the WhatsApp button on your tracking page."+
  "\nLITIX will independently verify payment and then send your paid confirmation. Do not pay a second time just because your order still says pending. Do not share card details on WhatsApp.";
 const delivered=await Promise.allSettled([
  send({to:[...OWNER_ORDER_RECIPIENTS],subject:"LITIX Bluevine pending order — NOT PAID — "+orderId,text:ownerBody,idempotencyKey:"litix-bluevine-owner-pending/"+orderId}),
  send({to:[email],subject:"LITIX — Your Bluevine bundle order is pending",text:customerBody,idempotencyKey:"litix-bluevine-customer-pending/"+orderId})
 ]);
 return {owner:delivered[0].status==="fulfilled"&&delivered[0].value,customer:delivered[1].status==="fulfilled"&&delivered[1].value};
}
