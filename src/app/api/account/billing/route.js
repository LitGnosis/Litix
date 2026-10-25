import { neon } from "@neondatabase/serverless";
import { authenticatedCustomer, customerAuthConfigured } from "../../../../lib/customerAuth.js";
import { accountDatabaseURL } from "../../../../lib/autolikes.mjs";
import { nmiRecurringStatus } from "../../../../lib/nmiRecurring.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const respond=(data,status=200)=>Response.json(data,{status,headers:{"cache-control":"private, no-store","x-content-type-options":"nosniff"}});
export async function GET(){
 if(!customerAuthConfigured())return respond({error:"Customer accounts are not yet enabled."},503);
 const user=await authenticatedCustomer();
 if(!user)return respond({error:"Sign in with a verified email."},401);
 const connection=accountDatabaseURL();if(!connection)return respond({error:"Billing storage unavailable."},503);
 try{
  const sql=neon(connection);
  const subscriptionRows=await sql.query("select id,campaign_id,status,last_successful_payment_at,current_period_end,created_at from litix_recurring_subscriptions where customer_id=$1 order by created_at desc limit 50",[user.id]);
  const events=await sql.query(`select e.provider_event_id,e.event_type,e.verified_at,s.campaign_id
    from litix_autolikes_billing_events e
    join litix_recurring_subscriptions s on s.provider_subscription_item_id=e.provider_subscription_item_id
    where s.customer_id=$1 and e.signature_verified=true order by e.received_at desc limit 50`,[user.id]);
  return respond({subscriptions:subscriptionRows.map(r=>({id:r.id,campaignId:r.campaign_id||null,status:r.status,lastPaymentAt:r.last_successful_payment_at||null,currentPeriodEnd:r.current_period_end||null,createdAt:r.created_at})),
    history:events.map(e=>({id:e.provider_event_id,type:e.event_type,verifiedAt:e.verified_at,campaignId:e.campaign_id})),
    recurring:{enabled:false,liveMerchantConfirmed:false,testGatewayReady:nmiRecurringStatus().ready},
    message:"No new subscriptions, renewals or cancellations may be initiated until sandbox billing and merchant entitlement are verified."});
 }catch(e){console.error("Litix customer billing lookup failed",String(e?.message||"unavailable").slice(0,120));return respond({error:"Billing history temporarily unavailable."},503)}
}
export async function POST(){return respond({error:"AutoLikes recurring purchases are not enabled. No charge was attempted."},503)}
export async function PATCH(){return respond({error:"Recurring billing changes require verified provider authorization. No change was made."},503)}
