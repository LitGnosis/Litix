/** Resend owner alerts for a verified Boostero inventory-sync failure.
 * No customer PII, supplier API key, DB URL, or wholesale pricing is sent.
 * Best effort: a mail failure never conceals the failing sync HTTP response.
 */
export async function alertBoosteroInventorySync(errorClass,{fetchImpl=fetch,now=new Date()}={}){
 const code=String(errorClass||"").slice(0,80);
 if(!/^[a-z][a-z0-9_]{2,79}$/.test(code))return {sent:false,reason:"unsafe_error_code"};
 const key=process.env.RESEND_API_KEY||process.env.LITIX_RESEND_API_KEY;
 if(!key)return {sent:false,reason:"email_unconfigured"};
 if(process.env.VERCEL_ENV!=="production")return {sent:false,reason:"preview_no_owner_mail"};
 const date=new Date(now).toISOString().slice(0,10);
 try{
  const result=await fetchImpl("https://api.resend.com/emails",{
   method:"POST",redirect:"error",cache:"no-store",signal:AbortSignal.timeout(9000),
   headers:{"authorization":"Bearer "+key,"content-type":"application/json",
    "Idempotency-Key":"litix-boostero-inventory/"+date+"/"+code},
   body:JSON.stringify({
    from:"Litix <orders@litix.net>",
    to:["litixsocial@gmail.com","litgnosisllc@gmail.com"],
    subject:"Litix Boostero catalog synchronization requires review",
    text:"Litix Boostero-only catalog synchronization failed.\nDate (UTC): "+date+
      "\nSanitized failure code: "+code+
      "\nCustomer orders and payments were not changed by the inventory synchronizer.\n"+
      "Review the private Vercel logs and isolate the underlying issue before another sync."
   })
  });
  return {sent:result.ok,reason:result.ok?"owner_alert_accepted":"resend_unavailable"};
 }catch{return {sent:false,reason:"email_network_unavailable"}}
}
