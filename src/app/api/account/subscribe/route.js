import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { authenticatedCustomer, customerAuthConfigured } from "../../../../lib/customerAuth.js";
import { accountDatabaseURL, fetchLikesServices, quoteMonthlyAutoLikes } from "../../../../lib/autolikes.mjs";
import { createRecurringForm, parseRecurringGatewayResponse } from "../../../../lib/nmiRecurring.mjs";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=30;
const respond=(body,status=200)=>Response.json(body,{status,headers:{"cache-control":"private, no-store","x-content-type-options":"nosniff"}});
const liveAllowed=()=>process.env.VERCEL_ENV==="production"
 &&process.env.LITIX_AUTOLIKES_LIVE_ENROLL_ENABLED==="true"
 &&process.env.LITIX_NMI_RECURRING_MERCHANT_APPROVED==="true"
 &&process.env.NMI_GATEWAY_MODE==="PRODUCTION"
 &&typeof process.env.NMI_SECURITY_KEY==="string"
 &&process.env.NMI_SECURITY_KEY.length>=16;
const sameOrigin=request=>{try{return new URL(request.headers.get("origin")).origin===new URL(request.url).origin}catch{return false}};

/**
 * Production-compatible Collect.js single-use-token enrollment.
 * IMPORTANT: Even an approved subscription does NOT activate likes delivery.
 * Verify independently recorded settled payment before marking ACTIVE_PAID.
 * Never retry an ambiguous gateway outcome or reuse a token.
 */
export async function POST(request){
 if(!sameOrigin(request))return respond({error:"Invalid origin"},403);
 if(!customerAuthConfigured())return respond({error:"Customer accounts not enabled"},503);
 const customer=await authenticatedCustomer();
 if(!customer)return respond({error:"Sign in with a verified email"},401);
 if(!liveAllowed())return respond({error:"Monthly AutoLikes enrollment is not enabled by the verified merchant configuration. No charge attempted."},503);
 if(Number(request.headers.get("content-length")||0)>2500)return respond({error:"Request too large"},413);
 let body;
 try{const raw=await request.text();if(raw.length>2500)throw Error("size");body=JSON.parse(raw)}catch{return respond({error:"Invalid request"},400)}
 const campaignId=String(body?.campaignId||"");
 const requestKey=String(body?.requestKey||"");
 const paymentToken=String(body?.paymentToken||"");
 if(!/^al_[a-f0-9]{40}$/.test(campaignId)||!/^[0-9a-f-]{36}$/i.test(requestKey))
   return respond({error:"Invalid campaign or enrollment reference"},400);
 if(body?.consent!==true||body?.consentVersion!=="autolikes-recurring-v1")
   return respond({error:"Explicit monthly recurring billing consent is required"},400);
 if(!/^[a-zA-Z0-9_.-]{12,300}$/.test(paymentToken)||/^[0-9]{12,19}$/.test(paymentToken))
   return respond({error:"A valid Collect.js single-use token is required"},400);
 if(!accountDatabaseURL())return respond({error:"Subscription ledger unavailable"},503);
 const sql=neon(accountDatabaseURL());
 try{
   const rows=await sql.query("select id,platform,account_ref,service_catalog_id,quantity_per_post,max_posts_per_month,status from litix_auto_boost_campaigns where id=$1 and customer_id=$2 limit 1",[campaignId,customer.id]);
   if(!rows.length)return respond({error:"Campaign not found"},404);
   const campaign=rows[0];
   if(!["draft","paused"].includes(campaign.status))return respond({error:"Campaign cannot be enrolled"},409);
   const services=await fetchLikesServices(campaign.platform);
   const service=services.find(s=>String(s.service)===String(campaign.service_catalog_id));
   if(!service)return respond({error:"Selected supplier Likes service is no longer available"},409);
   const quote=quoteMonthlyAutoLikes({service,platform:campaign.platform,quantityPerPost:campaign.quantity_per_post,maxPostsPerMonth:campaign.max_posts_per_month});
   // No price can be passed from the browser. An enrollment is bound to its server quote.
   const priceFingerprint=createHash("sha256").update([customer.id,campaignId,quote.serviceId,quote.quantityPerPost,quote.maxPostsPerMonth,quote.amountCents].join(":")).digest("hex");
   const id="ae_"+createHash("sha256").update(customer.id+":"+campaignId+":"+requestKey).digest("hex").slice(0,40);
   const admitted=await sql.query("insert into litix_autolikes_enrollment_attempts(id,customer_id,campaign_id,request_key,quoted_amount_cents,price_fingerprint,consent_at,consent_version,status) values($1,$2,$3,$4,$5,$6,now(),$7,'REQUESTED') on conflict do nothing returning id",
     [id,customer.id,campaignId,requestKey,quote.amountCents,priceFingerprint,"autolikes-recurring-v1"]);
   if(!admitted.length)return respond({error:"An enrollment already exists for this request. Review its status; do not resubmit a charge."},409);
   // NMI Classic tokenized subscription enrollment on the *existing* merchant gateway.
   // One request only. Unknown/timeout outcome ALWAYS needs manual reconciliation.
   const form=createRecurringForm({amountCents:quote.amountCents,dayOfMonth:Math.min(new Date().getUTCDate(),28),paymentToken,orderId:id},process.env.NMI_SECURITY_KEY);
   let result={approved:false,subscriptionId:null},state="UNKNOWN_OUTCOME";
   try{
     const response=await fetch("https://paykings.transactiongateway.com/api/transact.php",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:form,signal:AbortSignal.timeout(18000),cache:"no-store"});
     if(response.ok){
       const raw=await response.text();
       result=parseRecurringGatewayResponse(raw);
       state=result.approved&&result.subscriptionId?"GATEWAY_APPROVED_PENDING_VERIFICATION":result.approved?"UNKNOWN_OUTCOME":"DECLINED";
     }
   }catch{/* unknown outcome retained; NEVER resubmit or make a compensating charge */}
   await sql.query("update litix_autolikes_enrollment_attempts set status=$2,gateway_subscription_id=$3,response_code=$4,updated_at=now() where id=$1 and customer_id=$5",
     [id,state,result.subscriptionId||null,result.responseCode||null,customer.id]);
   if(state==="GATEWAY_APPROVED_PENDING_VERIFICATION")return respond({
     enrollmentId:id,subscriptionId:result.subscriptionId,status:state,
     monthlyAmountCents:quote.amountCents,
     message:"Gateway created a subscription. Delivery remains off until payment, consent and post-source verification finish."
   },202);
   if(state==="DECLINED")return respond({enrollmentId:id,status:state,error:"Gateway did not approve subscription setup. No automatic retry."},402);
   return respond({enrollmentId:id,status:"UNKNOWN_OUTCOME",error:"Gateway outcome requires reconciliation before any retry."},202);
 }catch{
   // Generic fail closed; some failures may occur after a ledger insert, so never auto retry.
   return respond({error:"Subscription enrollment needs manual verification before retry."},503);
 }
}
