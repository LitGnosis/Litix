import {neon} from "@neondatabase/serverless";
import {createHash} from "node:crypto";
import {authenticatedCustomer,customerAuthConfigured} from "../../../../../lib/customerAuth.js";
import {accountDatabaseURL} from "../../../../../lib/autolikes.mjs";
import {normalizedPost,dispatchLivePost} from "../../../../../lib/liveAutoLikes.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const reply=(x,s=200)=>Response.json(x,{status:s,headers:{"cache-control":"private, no-store"}});
export async function POST(req){
 if(!customerAuthConfigured())return reply({error:"Customer login unavailable"},503);
 const customer=await authenticatedCustomer();
 if(!customer)return reply({error:"Sign in to submit a post"},401);
 const origin=req.headers.get("origin");
 try{if(!origin||new URL(origin).origin!==new URL(req.url).origin)return reply({error:"Invalid origin"},403)}catch{return reply({error:"Invalid origin"},403)}
 let data;try{const raw=await req.text();if(raw.length>2500)throw Error("too_large");data=JSON.parse(raw)}catch{return reply({error:"Invalid submission"},400)}
 const campaignId=String(data?.campaignId||"");
 if(!/^al_[a-f0-9]{40}$/.test(campaignId))return reply({error:"Invalid campaign"},422);
 if(!accountDatabaseURL())return reply({error:"Subscription storage unavailable"},503);
 const sql=neon(accountDatabaseURL());
 try{
  const rows=await sql.query(
   "select s.id,s.platform,s.target_handle from litix_autolikes_live_subscriptions s where s.campaign_id=$1 and s.subscriber_id=$2 and s.status='ACTIVE' and s.payment_status='PAID' and s.billing_cycle_end>now() and s.posts_remaining>0 limit 1",
   [campaignId,customer.id]);
  if(!rows.length)return reply({error:"An active paid subscription with available posts is required"},403);
  const sub=rows[0];
  const url=normalizedPost(data?.postUrl,sub.platform,sub.target_handle);
  if(!url)return reply({error:"The post URL does not match the selected platform"},422);
  const idPart=new URL(url).pathname.replace(/\/$/,"").split("/").pop();
  if(!idPart||idPart.length>80)return reply({error:"Invalid post ID"},422);
  const mediaId=(sub.platform==="instagram"?"ig_":"tt_")+idPart;
  const id="alp_"+createHash("sha256").update(sub.id+"|"+mediaId).digest("hex").slice(0,40);
  const added=await sql.query("insert into litix_autolikes_live_posts(id,subscription_id,platform,media_id,post_url) values($1,$2,$3,$4,$5) on conflict do nothing returning id",
   [id,sub.id,sub.platform,mediaId,url]);
  if(!added.length)return reply({ok:true,duplicate:true,message:"This post has already been submitted"},200);
  const result=await dispatchLivePost(id);
  return reply({ok:true,accepted:true,fulfillment:result.state||"QUEUED",message:result.state==="SUBMITTED"?"Post order accepted by supplier":"Post recorded; review fulfillment status before resubmitting"},202);
 }catch(e){console.error("AutoLikes post submission error",String(e?.code||"database"));return reply({error:"Unable to submit AutoLikes post"},503)}
}