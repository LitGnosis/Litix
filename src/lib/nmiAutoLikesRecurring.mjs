// NMI/PayKings Classic recurring, isolated from Litix's working one-time checkout.
// Official NMI: https://support.nmi.com/hc/en-gb/articles/14525725002385-API-Recurring-Payments-and-Subscriptions
export const NMI_AUTOLIKES_GATEWAY="https://paykings.transactiongateway.com/api/transact.php";
const secureKey=()=>String(process.env.NMI_SECURITY_KEY||"");
export const autoLikesRecurringCheckoutReady=()=>process.env.VERCEL_ENV==="production"&&
 process.env.LITIX_AUTOLIKES_CHECKOUT_ENABLED==="true"&&
 process.env.LITIX_NMI_RECURRING_MERCHANT_APPROVED==="true"&&secureKey().length>15&&
 process.env.LITIX_BOOSTERO_ENABLED==="true"&&!!process.env.BOOSTERO_API_KEY;
const validToken=token=>typeof token==="string"&&/^[A-Za-z0-9_.-]{12,300}$/.test(token)&&
 !/^[0-9]{12,19}$/.test(token);
export function nmiAutoLikesEnrollmentForm({amountCents,paymentToken,dayOfMonth,orderId},key=secureKey()){
 if(!key||key.length<16)throw Error("nmi_recurring_key_missing");
 if(!Number.isSafeInteger(amountCents)||amountCents<100||amountCents>2000000||
  !Number.isSafeInteger(dayOfMonth)||dayOfMonth<1||dayOfMonth>28||
  !validToken(paymentToken)||!/^al_[a-f0-9]{40}$/.test(String(orderId)))
  throw Error("nmi_recurring_input_invalid");
 return new URLSearchParams({security_key:key,recurring:"add_subscription",
  plan_payments:"0",plan_amount:(amountCents/100).toFixed(2),month_frequency:"1",
  day_of_month:String(dayOfMonth),payment_token:paymentToken,orderid:orderId});
}
export function nmiAutoLikesCancellationForm(id,key=secureKey()){
 if(!key||key.length<16||!/^[0-9]{1,30}$/.test(String(id)))throw Error("nmi_subscription_id_invalid");
 return new URLSearchParams({security_key:key,recurring:"delete_subscription",subscription_id:String(id)});
}
export function nmiAutoLikesResult(text){
 if(typeof text!=="string"||text.length>12000)throw Error("nmi_recurring_response_invalid");
 const p=new URLSearchParams(text);
 const approved=p.get("response")==="1"&&p.get("response_code")==="100";
 const subscriptionId=p.get("subscription_id")||p.get("subscriptionid");
 return {approved,subscriptionId:subscriptionId&&/^[0-9]{1,30}$/.test(subscriptionId)?subscriptionId:null,
  responseCode:String(p.get("response_code")||"").slice(0,12)};
}
export async function nmiAutoLikesCall(form,{fetcher=fetch}={}){
 if(!autoLikesRecurringCheckoutReady())throw Error("nmi_recurring_not_enabled");
 let res;
 try{
  res=await fetcher(NMI_AUTOLIKES_GATEWAY,{
   method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},
   body:form.toString(),cache:"no-store",redirect:"error",signal:AbortSignal.timeout(15000)});
 }catch{throw Error("nmi_gateway_uncertain_outcome");}
 if(!res.ok)throw Error("nmi_gateway_http_uncertain_outcome");
 let raw;
 try{raw=await res.text()}catch{throw Error("nmi_gateway_body_uncertain_outcome");}
 return nmiAutoLikesResult(raw);
}
