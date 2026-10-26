import { neon } from "@neondatabase/serverless";
import { createHash } from "node:crypto";
import { authenticatedCustomer, customerAuthConfigured } from "../../../../lib/customerAuth.js";
import { accountDatabaseURL, fetchLikesServices, presentLikesService, draftPayload } from "../../../../lib/autolikes.mjs";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=30;
const reply=(data,status=200)=>Response.json(data,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
const db=()=>neon(accountDatabaseURL());
async function identity(){
 if(!customerAuthConfigured())return {error:reply({error:"Customer login is not enabled."},503)};
 const user=await authenticatedCustomer();
 if(!user)return {error:reply({error:"Sign in with a verified email."},401)};
 if(!accountDatabaseURL())return {error:reply({error:"Campaign storage is unavailable."},503)};
 return {user};
}
function sameOrigin(req){
 const origin=req.headers.get("origin");
 if(!origin)return false;
 try{return new URL(origin).origin===new URL(req.url).origin}catch{return false}
}
async function payload(req){
 const size=Number(req.headers.get("content-length")||0);
 if(size>2500)return null;
 try{
  const raw=await req.text();
  if(raw.length>2500)return null;
  const p=JSON.parse(raw);
  return p&&typeof p==="object"&&!Array.isArray(p)?p:null;
 }catch{return null}
}
function view(row){
 return {id:row.id,platform:row.platform,target:row.account_ref||"",serviceId:row.service_catalog_id,quantityPerPost:Number(row.quantity_per_post),maxPostsPerMonth:Number(row.max_posts_per_month),status:row.status,createdAt:row.created_at,nextCheckAt:row.next_check_at,postsCompleted:Number(row.posts_processed_this_month||0),subscription:row.live_subscription||null};
}
export async function GET(req){
 const me=await identity();if(me.error)return me.error;
 const platform=new URL(req.url).searchParams.get("platform");
 try{
  if(platform){
   if(!["instagram","tiktok"].includes(platform))return reply({error:"Select a supported platform."},400);
   const choices=await fetchLikesServices(platform);
   return reply({platform,services:choices.slice(0,55).map(presentLikesService),purchaseEnabled:false,billingEnabled:false});
  }
  const sql=db();
  const rows=await sql.query(`select id,platform,account_ref,service_catalog_id,quantity_per_post,max_posts_per_month,status,created_at,next_check_at,posts_processed_this_month,
   (select jsonb_build_object('id',s.id,'status',s.status,'paymentStatus',s.payment_status,
     'postsRemaining',s.posts_remaining,'maxPosts',s.monthly_post_limit,
     'lastPaymentAt',s.last_paid_at,'billingCycleEnd',s.billing_cycle_end)
     from litix_autolikes_live_subscriptions s
     where s.campaign_id=litix_auto_boost_campaigns.id and s.subscriber_id=$1 limit 1) as live_subscription
   from litix_auto_boost_campaigns where customer_id=$1 order by created_at desc limit 30`,[me.user.id]);
  const enabled=process.env.VERCEL_ENV==="production" &&
    process.env.LITIX_AUTOLIKES_LIVE_ENROLL_ENABLED==="true" &&
    process.env.LITIX_NMI_RECURRING_MERCHANT_APPROVED==="true" &&
    process.env.LITIX_AUTOLIKES_SOURCE_VERIFIED==="true" &&
    process.env.LITIX_AUTOLIKES_DISPATCH_ENABLED==="true" &&
    Boolean(process.env.SMMGLOB_API_KEY);
  return reply({campaigns:rows.map(view),subscriptionEnabled:enabled,
    subscriptions:rows.filter(r=>r.live_subscription).map(r=>({campaignId:r.id,...r.live_subscription})),
    billingHistoryUrl:"/api/account/billing",
    message:enabled?"Monthly subscription checkout is available.":"Subscription purchases are unavailable until production provider checks pass."});
 }catch(e){
  console.error("Litix autolikes listing failed",String(e?.message||"unavailable").slice(0,120));
  return reply({error:"The campaign listing is temporarily unavailable."},503);
 }
}
export async function POST(req){
 if(!sameOrigin(req))return reply({error:"Invalid request origin."},403);
 const me=await identity();if(me.error)return me.error;
 const raw=await payload(req);if(!raw)return reply({error:"Invalid campaign request."},400);
 const requestKey=String(raw.requestKey||"");
 if(!/^[0-9a-f-]{36}$/i.test(requestKey))return reply({error:"A valid campaign request key is required."},400);
 if(!["instagram","tiktok"].includes(raw.platform))return reply({error:"Invalid platform."},400);
 let selected;
 try{selected=draftPayload(raw,await fetchLikesServices(raw.platform))}catch(e){return reply({error:"Cannot verify the current supplier services. Try again shortly."},503)}
 if(!selected.ok)return reply({error:selected.error},400);
 const id="al_"+createHash("sha256").update(me.user.id+":"+requestKey).digest("hex").slice(0,40);
 const sql=db();
 try{
  const prior=await sql.query("select id,customer_id,platform,account_ref,service_catalog_id,quantity_per_post,max_posts_per_month,status,created_at,next_check_at,posts_processed_this_month from litix_auto_boost_campaigns where id=$1",[id]);
  if(prior.length){
   if(prior[0].customer_id!==me.user.id)return reply({error:"Campaign access denied."},403);
   return reply({campaign:view(prior[0]),reused:true},200);
  }
  const counts=await sql.query("select count(*)::int as total from litix_auto_boost_campaigns where customer_id=$1 and status in ('draft','paused')",[me.user.id]);
  if(Number(counts[0]?.total||0)>=12)return reply({error:"There is a 12-draft limit for each account."},409);
  const created=await sql.query("insert into litix_auto_boost_campaigns (id,customer_id,email,platform,account_ref,service_catalog_id,quantity_per_post,max_posts_per_month,status,next_check_at,delivery_speed,fulfillment_mode) values($1,$2,$3,$4,$5,$6,$7,$8,'draft',null,'standard','instant') on conflict(id) do nothing returning id,platform,account_ref,service_catalog_id,quantity_per_post,max_posts_per_month,status,created_at,next_check_at,posts_processed_this_month",[id,me.user.id,me.user.email,selected.platform,selected.target,selected.serviceId,selected.quantityPerPost,selected.maxPostsPerMonth]);
  if(!created.length)return reply({error:"A concurrent campaign request is being processed. Refresh your drafts."},409);
  return reply({campaign:view(created[0]),oneTimeEstimateCents:selected.oneTimeEstimateCents,disclaimer:"Draft saved without payment, subscription or supplier fulfillment."},201);
 }catch(e){console.error("Litix draft creation failed",String(e?.message||"unavailable").slice(0,120));return reply({error:"Unable to save your draft."},503)}
}
export async function PATCH(req){
 if(!sameOrigin(req))return reply({error:"Invalid request origin."},403);
 const me=await identity();if(me.error)return me.error;
 const raw=await payload(req);if(!raw)return reply({error:"Invalid campaign request."},400);
 const id=String(raw.id||"");
 if(!/^al_[a-f0-9]{40}$/.test(id))return reply({error:"Invalid campaign ID."},400);
 const action=String(raw.action||"");
 if(!["pause","resume","cancel","edit"].includes(action))return reply({error:"Invalid campaign action."},400);
 const sql=db();
 try{
  const rows=await sql.query("select id,customer_id,platform,account_ref,service_catalog_id,quantity_per_post,max_posts_per_month,status from litix_auto_boost_campaigns where id=$1 and customer_id=$2",[id,me.user.id]);
  if(!rows.length)return reply({error:"Campaign not found."},404);
  const current=rows[0];
  if(!["draft","paused"].includes(current.status))return reply({error:"This campaign may have active billing. Contact support for subscription changes."},409);
  if(action==="edit"){
   const draft=draftPayload({platform:current.platform,target:raw.target??current.account_ref,serviceId:current.service_catalog_id,quantityPerPost:raw.quantityPerPost??current.quantity_per_post,maxPostsPerMonth:raw.maxPostsPerMonth??current.max_posts_per_month},await fetchLikesServices(current.platform));
   if(!draft.ok)return reply({error:draft.error},400);
   const updated=await sql.query("update litix_auto_boost_campaigns set account_ref=$3,quantity_per_post=$4,max_posts_per_month=$5,updated_at=now() where id=$1 and customer_id=$2 and status in ('draft','paused') returning id,platform,account_ref,service_catalog_id,quantity_per_post,max_posts_per_month,status,created_at,next_check_at,posts_processed_this_month",[id,me.user.id,draft.target,draft.quantityPerPost,draft.maxPostsPerMonth]);
   return updated.length?reply({campaign:view(updated[0]),oneTimeEstimateCents:draft.oneTimeEstimateCents}):reply({error:"Campaign changed; refresh to continue."},409);
  }
  // Resume means returning to an editable draft, never starting supplier fulfillment.
  const next=action==="cancel"?"cancelled":action==="pause"?"paused":"draft";
  const updated=await sql.query("update litix_auto_boost_campaigns set status=$3,next_check_at=null,updated_at=now() where id=$1 and customer_id=$2 and status in ('draft','paused') returning id,platform,account_ref,service_catalog_id,quantity_per_post,max_posts_per_month,status,created_at,next_check_at,posts_processed_this_month",[id,me.user.id,next]);
  return updated.length?reply({campaign:view(updated[0]),charged:false,fulfillmentTriggered:false}):reply({error:"Campaign changed; refresh to continue."},409);
 }catch(e){console.error("Litix draft update failed",String(e?.message||"unavailable").slice(0,120));return reply({error:"Unable to update your draft."},503)}
}
