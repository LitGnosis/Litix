import {createHash,timingSafeEqual} from "node:crypto";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const digest=v=>createHash("sha256").update(String(v)).digest();
const authorized=req=>{
 const key=process.env.CRON_SECRET||process.env.LITIX_CRON_SECRET;
 const actual=(req.headers.get("authorization")||"").replace(/^Bearer\\s+/i,"");
 return Boolean(key&&actual)&&timingSafeEqual(digest(key),digest(actual));
};
// Operational status only: no secrets, charges, supplier calls, user PII, or database writes.
export async function GET(req){
 if(!authorized(req))return Response.json({error:"Unauthorized"},{status:401,headers:{"cache-control":"no-store"}});
 const env=process.env;
 const checks={
  production:env.VERCEL_ENV==="production",
  customerAuth:Boolean(env.LITIX_CUSTOMER_LOGIN_ENABLED==="true"&&env.AUTH0_DOMAIN&&env.AUTH0_CLIENT_ID&&env.AUTH0_CLIENT_SECRET&&env.AUTH0_SECRET&&env.APP_BASE_URL),
  liveGateway:Boolean(env.NMI_GATEWAY_MODE==="PRODUCTION"&&env.NMI_SECURITY_KEY&&env.NEXT_PUBLIC_PAYKINGS_NMI_COLLECT_PUBLIC_KEY),
  recurringMerchantApproved:env.LITIX_NMI_RECURRING_MERCHANT_APPROVED==="true",
  gatewayWebhook:Boolean(env.LITIX_NMI_WEBHOOK_SIGNING_KEY||env.NMI_WEBHOOK_SIGNING_KEY),
  subscriptionLedger:Boolean(env.LITIX_AUTOLIKES_DATABASE_URL),
  supplierKey:Boolean(env.SMMGLOB_API_KEY),
  signedPostSource:Boolean(env.LITIX_AUTOLIKES_SOURCE_VERIFIED==="true"&&env.LITIX_AUTOLIKES_EVENT_SECRET),
  ingestionEnabled:env.LITIX_AUTOLIKES_EVENT_INGEST_ENABLED==="true",
  dispatchEnabled:env.LITIX_AUTOLIKES_DISPATCH_ENABLED==="true",
  enrollmentEnabled:env.LITIX_AUTOLIKES_LIVE_ENROLL_ENABLED==="true",
  settlementReconciliationEnabled:env.LITIX_AUTOLIKES_BILLING_RECONCILE_ENABLED==="true"
 };
 return Response.json({checks,readyForLiveSubscriptionEnrollment:Object.values(checks).every(Boolean),note:"Environment presence only; does not establish provider authorization or successful fulfillment."},{headers:{"cache-control":"no-store"}});
}
