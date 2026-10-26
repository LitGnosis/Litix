import { neon } from "@neondatabase/serverless";
import { authenticatedCustomer, customerAuthConfigured } from "../../../../lib/customerAuth.js";
import { accountDatabaseURL } from "../../../../lib/autolikes.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const respond=(value,status=200)=>Response.json(value,{status,headers:{"cache-control":"private, no-store","x-content-type-options":"nosniff"}});
export async function GET(){
 if(!customerAuthConfigured())return respond({error:"Customer accounts are not enabled."},503);
 const customer=await authenticatedCustomer();
 if(!customer)return respond({error:"Sign in with your verified account."},401);
 if(!accountDatabaseURL())return respond({error:"Subscription database unavailable."},503);
 try{
  const sql=neon(accountDatabaseURL());
  const rows=await sql.query(
   "select id,campaign_id,status,payment_status,posts_remaining,monthly_post_limit,max_likes_per_post,last_paid_at,billing_cycle_end,created_at from litix_autolikes_live_subscriptions where subscriber_id=$1 order by created_at desc limit 50",
   [customer.id]);
  const history=await sql.query(
   "select e.event_id,e.event_type,e.received_at,s.campaign_id from litix_autolikes_live_gateway_events e join litix_autolikes_live_subscriptions s on s.provider_subscription_id=e.provider_subscription_id where s.subscriber_id=$1 order by e.received_at desc limit 100",
   [customer.id]);
  const deliveries=await sql.query(
   "select p.id,p.post_url,p.state,p.supplier_order_id,p.supplier_status,p.supplier_remains,p.created_at,s.campaign_id from litix_autolikes_live_posts p join litix_autolikes_live_subscriptions s on s.id=p.subscription_id where s.subscriber_id=$1 order by p.created_at desc limit 100",
   [customer.id]);
  const enabled=process.env.VERCEL_ENV==="production" &&
   process.env.LITIX_AUTOLIKES_LIVE_ENROLL_ENABLED==="true" &&
   process.env.LITIX_NMI_RECURRING_MERCHANT_APPROVED==="true";
  return respond({
   subscriptions:rows.map(r=>({
    id:r.id,campaignId:r.campaign_id,status:r.status,paymentStatus:r.payment_status,
    remainingPosts:Number(r.posts_remaining),monthlyPostLimit:Number(r.monthly_post_limit),
    likesPerPost:Number(r.max_likes_per_post),lastPaymentAt:r.last_paid_at,
    currentPeriodEnd:r.billing_cycle_end,createdAt:r.created_at
   })),
   history:history.map(e=>({id:e.event_id,type:e.event_type,verifiedAt:e.received_at,campaignId:e.campaign_id})),
   deliveries:deliveries.map(p=>({id:p.id,postUrl:p.post_url,state:p.state,
    supplierOrderId:p.supplier_order_id,supplierStatus:p.supplier_status,remainingLikes:p.supplier_remains,campaignId:p.campaign_id,createdAt:p.created_at})),
   recurring:{enabled,liveMerchantConfirmed:process.env.LITIX_NMI_RECURRING_MERCHANT_APPROVED==="true"}
  });
 }catch(e){
  console.error("AutoLikes customer billing query failed",String(e?.code||"db"));
  return respond({error:"Billing records temporarily unavailable."},503);
 }
}
export async function POST(){return respond({error:"Use the authorized subscription checkout to begin billing."},405);}
export async function PATCH(){return respond({error:"Use the authenticated subscription cancellation route."},405);}
