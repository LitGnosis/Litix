// International E.164 phone normalization; never equate a phone number with WhatsApp enrollment.
export function normalizeOrderPhone(value){
 const raw=String(value??"").trim();
 if(!raw||raw.length>40||!/^\+?[\d\s().-]+$/.test(raw))return null;
 const digits=raw.replace(/\D/g,"");
 let e164=raw.startsWith("+")?"+"+digits:(digits.length===10?"+1"+digits:digits.length===11&&digits.startsWith("1")?"+".concat(digits):null);
 if(!e164||!/^\+[1-9]\d{7,14}$/.test(e164))return null;
 return e164;
}
export const smsProviderReady=()=>process.env.LITIX_BUNDLE_SMS_VERIFIED==="true"&&
 Boolean(process.env.TWILIO_ACCOUNT_SID?.match(/^AC[a-f\d]{32}$/i))&&
 Boolean(process.env.TWILIO_AUTH_TOKEN)&&
 Boolean(process.env.TWILIO_MESSAGING_SERVICE_SID?.match(/^MG[a-f\d]{32}$/i));
// Prepared Twilio transactional integration, disabled without explicit verified configuration.
// Only call on the first durable order insert and with separately recorded opt-in.
export async function sendPendingOrderSms({orderId,phone,bundleName,consented}){
 if(!consented||!normalizeOrderPhone(phone)||!smsProviderReady())return {sent:false,reason:"not_enabled"};
 const account=process.env.TWILIO_ACCOUNT_SID;
 const body=new URLSearchParams({
  To:normalizeOrderPhone(phone),
  MessagingServiceSid:process.env.TWILIO_MESSAGING_SERVICE_SID,
  Body:"Thank you for choosing LITIX! Your order "+orderId+" for "+bundleName+
   " has been placed. Payment awaits verification. Send your receipt and up to 10 post links/screenshots by WhatsApp, email (litixsocial@gmail.com), or Instagram @Litixsocial. Do not pay twice."
 });
 const auth=Buffer.from(account+":"+process.env.TWILIO_AUTH_TOKEN).toString("base64");
 try{
  const r=await fetch("https://api.twilio.com/2010-04-01/Accounts/"+account+"/Messages.json",{
   method:"POST",headers:{"authorization":"Basic "+auth,"content-type":"application/x-www-form-urlencoded"},
   body:body.toString(),signal:AbortSignal.timeout(9000),cache:"no-store"
  });
  return {sent:r.ok,reason:r.ok?"submitted":"provider_rejected"};
 }catch{return {sent:false,reason:"provider_unavailable"}}
}
