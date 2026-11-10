// Transactional acknowledgement only after an owner's partner-inquiry email is
// accepted. No AI interpretation of untrusted inbound content or auto-sales.
const permittedTypes=new Set(["agency","affiliate","reviewer","business","publisher"]);
export function buildLeadAcknowledgement(type){
 if(!permittedTypes.has(type))throw Error("invalid_lead_type");
 const subject="Litix — We received your business inquiry";
 const text=[
  "Thanks for contacting Litix.",
  "",
  "Your inquiry has been received for manual review.",
  "A partnership, project quote, service appointment, price, customer account,",
  "or commission is not active merely because the form was submitted.",
  "If our current capabilities match your request, we will reply with next steps.",
  "",
  "While reviewing, you can explore:",
  "Business growth proposals: https://www.litix.net/agency-growth",
  "Current services: https://www.litix.net/shop",
  "Order support: https://www.litix.net/track",
  "",
  "This is a one-time acknowledgement, not a marketing subscription.",
  "If you did not request this, no action is required.",
  "Litix Support: litixsocial@gmail.com"
 ].join("\n");
 return Object.freeze({subject,text});
}
export async function sendLeadAcknowledgement({
 email,type,digest,apiKey,fetcher=fetch
}){
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))||
 !/^[a-f0-9]{64}$/i.test(String(digest))||typeof apiKey!=="string"||apiKey.length<10)
  return {queued:false,reason:"invalid"};
 const content=buildLeadAcknowledgement(type);
 try{
  const response=await fetcher("https://api.resend.com/emails",{
   method:"POST",
   headers:{"authorization":"Bearer "+apiKey,
    "content-type":"application/json",
    "Idempotency-Key":"litix-lead-ack-"+digest.slice(0,48)},
   body:JSON.stringify({
    from:"Litix <orders@litix.net>",
    to:[email],
    subject:content.subject,
    text:content.text,
    reply_to:"litixsocial@gmail.com"
   }),
   cache:"no-store",redirect:"error",
   signal:AbortSignal.timeout(8000)
  });
  return {queued:response.ok,reason:response.ok?"accepted":"provider_"+response.status};
 }catch{
  return {queued:false,reason:"network"};
 }
}
