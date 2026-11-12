export const runtime="nodejs";
export const dynamic="force-dynamic";
/** Preserve existing subscription management; do not create new vendor-backed subscriptions. */
export async function POST(){
 return Response.json({
  error:"New AutoLikes subscriptions are paused until first-party post detection and delivery are verified.",
  code:"FIRST_PARTY_RECURRING_CAPACITY_UNVERIFIED",
  recurringSubscriptionCreated:false,chargeAttempted:false,externalSupplierApiCalls:0
 },{status:409,headers:{"cache-control":"no-store"}});
}
