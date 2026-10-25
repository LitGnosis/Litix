// PayKings/NMI Classic recurring adapter. No network or charges on import.
// Only usable in an explicitly enabled Preview sandbox with merchant-issued TEST credentials.
// Docs: https://support.nmi.com/hc/en-gb/articles/14525725002385-API-Recurring-Payments-and-Subscriptions
export function nmiRecurringStatus(env=process.env) {
 const sandbox=["preview","development"].includes(env.VERCEL_ENV);
 const enabled=env.LITIX_NMI_RECURRING_TEST_ENABLED==="true";
 const url=String(env.NMI_TEST_GATEWAY_URL||"");
 let target;
 try{
  const u=new URL(url);
  if(u.protocol==="https:"&&u.hostname==="sandbox.nmi.com"&&u.pathname==="/api/transact.php")target=u.href;
 }catch{}
 const credential=typeof env.NMI_TEST_SECURITY_KEY==="string"&&env.NMI_TEST_SECURITY_KEY.length>15;
 const collect=typeof env.NEXT_PUBLIC_PAYKINGS_NMI_TEST_COLLECT_PUBLIC_KEY==="string"&&env.NEXT_PUBLIC_PAYKINGS_NMI_TEST_COLLECT_PUBLIC_KEY.length>8;
 const ready=sandbox&&enabled&&Boolean(target)&&credential&&collect;
 return {ready,mode:sandbox?"sandbox":"production",enabled:enabled&&sandbox,
  missing:[...(!sandbox?["Vercel Preview environment"]:[]),...(!enabled?["Recurring test-mode authorization"]:[]),...(!target?["Dedicated NMI sandbox transaction endpoint"]:[]),...(!credential?["NMI TEST security key"]:[]),...(!collect?["NMI TEST Collect.js public key"]:[])],
  gateway:target||null};
}
export function validateRecurringRequest(input) {
 const amountCents=Number(input?.amountCents);
 const token=String(input?.paymentToken||"").trim();
 const dayOfMonth=Number(input?.dayOfMonth);
 if(!Number.isSafeInteger(amountCents)||amountCents<100||amountCents>2000000)throw Error("Invalid fixed monthly amount");
 if(!Number.isSafeInteger(dayOfMonth)||dayOfMonth<1||dayOfMonth>28)throw Error("Invalid billing day");
 if(!/^[a-zA-Z0-9_.-]{12,300}$/.test(token)||/^[0-9]{12,19}$/.test(token))throw Error("Expected a single-use gateway token, never a raw card number");
 return {amountCents,paymentToken:token,dayOfMonth};
}
export function createRecurringForm(input,securityKey) {
 if(typeof securityKey!=="string"||securityKey.length<16)throw Error("Missing dedicated test API key");
 const t=validateRecurringRequest(input);
 return new URLSearchParams({
  security_key:securityKey,
  recurring:"add_subscription",
  plan_payments:"0",
  plan_amount:(t.amountCents/100).toFixed(2),
  month_frequency:"1",
  day_of_month:String(t.dayOfMonth),
  payment_token:t.paymentToken
 });
}
export function cancelRecurringForm(subscriptionId,securityKey){
 if(typeof securityKey!=="string"||securityKey.length<16)throw Error("Missing dedicated test API key");
 if(!/^[0-9]{1,30}$/.test(String(subscriptionId)))throw Error("Invalid NMI subscription id");
 return new URLSearchParams({security_key:securityKey,recurring:"delete_subscription",subscription_id:String(subscriptionId)});
}
export function parseRecurringGatewayResponse(body){
 if(typeof body!=="string"||body.length>12000)throw Error("Invalid NMI gateway response");
 const params=new URLSearchParams(body);
 if(params.get("response")==="1"&&params.get("response_code")==="100"){
  const id=params.get("subscription_id")||params.get("subscriptionid");
  return {approved:true,subscriptionId:id&&/^[0-9]{1,30}$/.test(id)?id:null};
 }
 return {approved:false,subscriptionId:null,responseCode:String(params.get("response_code")||"").slice(0,10)};
}
