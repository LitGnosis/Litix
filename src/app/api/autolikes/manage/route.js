import {createHash} from "node:crypto";
import {boosteroSQL} from "../../../../lib/boosteroFulfillment.mjs";
import {nmiAutoLikesCancellationForm,nmiAutoLikesCancel,autoLikesCancellationReady} from "../../../../lib/nmiAutoLikesRecurring.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=35;
const sha=s=>createHash("sha256").update(String(s)).digest("hex");
const send=(data,status=200)=>Response.json(data,{status,headers:{"cache-control":"no-store","referrer-policy":"no-referrer","x-content-type-options":"nosniff"}});
async function owner(req,db){
 const token=String(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 if(!/^[0-9a-f-]{73}$/i.test(token))return null;
 const rows=await db.query(
  "select s.id,s.subscriber_id,s.provider_subscription_id,s.platform,s.target_profile_url,s.max_likes_per_post,s.monthly_post_limit,s.amount_cents,s.status,s.payment_status,s.billing_cycle_end,s.last_paid_at from public.litix_autolikes_native_portal p join public.litix_autolikes_live_subscriptions s on s.id=p.subscription_id where p.token_sha256=$1 limit 1",
  [sha(token)]);
 return rows[0]||null;
}
export async function GET(req){
 let db,s;
 try{db=boosteroSQL();s=await owner(req,db)}
 catch{return send({error:"AutoLikes portal temporarily unavailable"},503)}
 if(!s)return send({error:"Invalid management link"},401);
 try{
  const cycles=await db.query(
   "select period_key,state,supplier_status,expires_at,created_at from public.litix_autolikes_native_cycles where subscription_id=$1 order by created_at desc limit 24",[s.id]);
  return send({subscription:{id:s.id,platform:s.platform,profile:s.target_profile_url,
   likesPerPost:s.max_likes_per_post,postsPerMonth:s.monthly_post_limit,
   monthlyAmountCents:Number(s.amount_cents),status:s.status,paymentStatus:s.payment_status,
   currentPeriodEnd:s.billing_cycle_end,lastPaymentAt:s.last_paid_at},
   cycles:cycles.map(c=>({period:c.period_key,state:c.state,status:c.supplier_status,expiresAt:c.expires_at})),
   cancellationAvailable:autoLikesCancellationReady()});
 }catch{return send({error:"Unable to retrieve subscription status"},503)}
}
export async function POST(req){
 const origin=req.headers.get("origin");
 if(!origin||origin!==new URL(req.url).origin)return send({error:"Invalid origin"},403);
 if(!autoLikesCancellationReady())return send({error:"Automated cancellation unavailable. Contact Litix support; do not initiate duplicate payment."},503);
 let input;
 try{const raw=await req.text();if(raw.length>1000)throw Error();input=JSON.parse(raw)}
 catch{return send({error:"Invalid cancellation request"},400)}
 if(input?.action!=="cancel"||input?.confirmCancel!==true)return send({error:"Explicit cancellation confirmation required"},422);
 let db,s;
 try{db=boosteroSQL();s=await owner(req,db)}catch{return send({error:"Portal storage unavailable"},503)}
 if(!s)return send({error:"Invalid management link"},401);
 if(s.status==="CANCELLED")return send({cancelled:true,alreadyCancelled:true});
 const cancelId="alcan_"+sha(s.id).slice(0,42);
 const claimed=await db.query(
  "insert into public.litix_autolikes_live_cancellations(id,subscription_id,subscriber_id,gateway_subscription_id,state) values($1,$2,$3,$4,'REQUESTED') on conflict(subscription_id) do nothing returning id",
  [cancelId,s.id,s.subscriber_id,s.provider_subscription_id]);
 if(!claimed.length)return send({state:"REVIEW_REQUIRED",message:"A cancellation was already requested. Contact support rather than submit another."},202);
 try{
  const result=await nmiAutoLikesCancel(nmiAutoLikesCancellationForm(s.provider_subscription_id));
  if(!result.approved)throw Error("nmi_cancel_not_confirmed");
  await db.query("update public.litix_autolikes_live_cancellations set state='CONFIRMED',updated_at=now() where id=$1 and state='REQUESTED'",[cancelId]);
  await db.query("update public.litix_autolikes_live_subscriptions set status='CANCELLED',updated_at=now() where id=$1",[s.id]);
  return send({cancelled:true,renewalStopped:true,
   note:"Future recurring charges stopped. Already-submitted paid-term supplier fulfillment may continue through its scheduled expiry."});
 }catch{
  await db.query("update public.litix_autolikes_live_cancellations set state='UNKNOWN_OUTCOME',updated_at=now() where id=$1 and state='REQUESTED'",[cancelId]).catch(()=>{});
  return send({state:"UNKNOWN_OUTCOME",message:"Cancellation outcome requires manual verification. Do not repeat this request; contact Litix support."},202);
 }
}
