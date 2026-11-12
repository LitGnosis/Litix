// Owner-only transactional alerts for confirmed purchases; never collect or include card fields.
export const OWNER_ORDER_RECIPIENTS=Object.freeze(["litixsocial@gmail.com","litgnosisllc@gmail.com"]);
const resendKey=()=>process.env.RESEND_API_KEY||process.env.LITIX_RESEND_API_KEY||"";
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export async function sendOwnerPurchaseNotification({
 orderId,purchaseDate,customerEmail,serviceName,quantity,amountCents,paymentStatus,fulfillmentInstructions,customerProfile
}){
 if(!/^(?:ltx2_|lbg_)[a-f0-9-]{36}$/.test(String(orderId||"")))throw Error("Invalid owner notification order ID");
 if(!["paid","settled"].includes(paymentStatus))return false;
 if(!resendKey()){console.warn("Litix owner email unavailable: missing Resend key",{orderId});return false}
 const date=purchaseDate&&Number.isFinite(new Date(purchaseDate).getTime())?new Date(purchaseDate).toISOString():new Date().toISOString();
 const amount=Number(amountCents);
 if(!Number.isSafeInteger(amount)||amount<0)throw Error("Invalid owner notification amount");
 const fields=[
 ["Order ID",orderId],["Purchase date (UTC)",date],["Customer email",String(customerEmail||"").slice(0,254)],
 ["Service / bundle",String(serviceName||"Service").slice(0,200)],["Quantity / bundle totals",String(quantity??"").slice(0,300)],
 ["Total","USD $"+(amount/100).toFixed(2)],["Payment status",paymentStatus],
 ["Fulfillment instructions",String(fulfillmentInstructions||"Check owner order records").slice(0,1300)]
 ];
 if(customerProfile)fields.splice(3,0,["Customer profile",String(customerProfile).slice(0,150)]);
 const text=fields.map(([k,v])=>k+": "+v).join("\n")+"\n\nNo payment-card information is included.";
 const html="<div style=\"font-family:Arial,sans-serif\"><h2>Litix — Verified purchase</h2>"+
 fields.map(([k,v])=>"<p><strong>"+esc(k)+":</strong> "+esc(v)+"</p>").join("")+
 "<p>No payment-card information is included.</p></div>";
 const r=await fetch("https://api.resend.com/emails",{
  method:"POST",
  headers:{"Authorization":"Bearer "+resendKey(),"Content-Type":"application/json","Idempotency-Key":"litix-owner-confirmed/"+orderId},
  body:JSON.stringify({from:"Litix <orders@litix.net>",to:[...OWNER_ORDER_RECIPIENTS],subject:"LITIX paid order — "+orderId,text,html}),
  signal:AbortSignal.timeout(8000),cache:"no-store"
 });
 if(!r.ok)throw Error("Owner Resend notification HTTP "+r.status);
 return true;
}
