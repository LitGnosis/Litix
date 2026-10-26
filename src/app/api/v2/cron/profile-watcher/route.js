import { neon } from "@neondatabase/serverless";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
const send=(body,status=200)=>Response.json(body,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
const db=()=>neon(process.env.LITIX_V2_DATABASE_URL||process.env.DATABASE_URL||process.env.POSTGRES_URL);
const enabled=()=>process.env.LITIX_AUTOLIKES_EVENT_INGEST_ENABLED==="true";
const equalHex=(given,expected)=>/^[a-f0-9]{64}$/i.test(given)&&timingSafeEqual(Buffer.from(given,"hex"),Buffer.from(expected,"hex"));
function cronAuthorized(req){
 const expected=process.env.LITIX_CRON_SECRET;
 const value=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 return Boolean(expected&&value)&&equalHex(createHash("sha256").update(value).digest("hex"),createHash("sha256").update(expected).digest("hex"));
}
function eventAuthorized(req,raw){
 const expected=process.env.LITIX_AUTOLIKES_EVENT_SECRET;
 const header=req.headers.get("x-litix-event-signature")||"";
 if(!expected||expected.length<32||!header.startsWith("sha256="))return false;
 return equalHex(header.slice(7),createHmac("sha256",expected).update(raw).digest("hex"));
}
export async function GET(req){
 if(!cronAuthorized(req))return send({error:"Unauthorized"},401);
 if(!enabled())return send({enabled:false,queued:0,mode:"AutoLikes event ingestion disabled pending recurring-billing authorization."},503);
 try{
  const rows=await db().query("select count(*)::int as queued from litix_profile_events where state='queued'");
  return send({ok:true,worker:"profile-watcher",queued:Number(rows[0]?.queued||0),mode:"queue inspection only; no supplier orders placed"});
 }catch{return send({error:"Worker storage unavailable"},503)}
}
export async function POST(req){
 if(!cronAuthorized(req))return send({error:"Unauthorized"},401);
 if(!enabled())return send({error:"AutoLikes event ingestion is disabled."},503);
 let raw;
 try{raw=await req.text();if(raw.length>4000)throw Error("oversized")}catch{return send({error:"Invalid event body"},400)}
 if(!eventAuthorized(req,raw))return send({error:"Invalid signed event"},401);
 let body;try{body=JSON.parse(raw)}catch{return send({error:"Invalid JSON"},400)}
 const eventId=String(body?.eventId||"").trim(),workspaceId=String(body?.workspaceId||"").trim(),
  platform=String(body?.platform||"").toLowerCase(),profile=String(body?.profile||"").trim(),
  postUrl=String(body?.postUrl||"").trim(),mediaHash=String(body?.mediaHash||"").trim();
 if(!/^[a-zA-Z0-9_-]{8,120}$/.test(eventId)||!/^[a-zA-Z0-9_-]{8,120}$/.test(workspaceId)||
  !["instagram","tiktok"].includes(platform)||!/^[a-zA-Z0-9@._]{2,80}$/.test(profile)||
  !/^[a-zA-Z0-9_-]{8,180}$/.test(mediaHash))return send({error:"Invalid event fields"},400);
 let url;try{url=new URL(postUrl)}catch{}
 const domains={instagram:["instagram.com","www.instagram.com"],tiktok:["tiktok.com","www.tiktok.com"]};
 if(!url||url.protocol!=="https:"||!domains[platform].includes(url.hostname.toLowerCase())||url.username||url.password||url.hash)
  return send({error:"Post URL does not match the selected platform"},400);
 try{
  // Require a current paid subscription for this specific campaign/customer/profile,
  // backed by independently verified payment-success evidence.
  const sql=db();
  const watchers=await sql.query(`
   select w.id,w.campaign_id from litix_profile_watchers w
   join litix_recurring_subscriptions s
    on s.workspace_id=w.workspace_id and s.campaign_id=w.campaign_id and s.customer_id=w.customer_id
   where w.workspace_id=$1 and w.platform=$2 and w.profile_handle=$3
    and w.enabled=true and w.consent_at is not null
    and s.provider='nmi' and s.status='ACTIVE_PAID'
    and s.last_successful_payment_at is not null and s.current_period_end>now()
    and exists(select 1 from litix_autolikes_billing_events e
      where e.provider='nmi' and e.provider_subscription_item_id=s.provider_subscription_item_id
      and e.event_type='PAYMENT_SUCCEEDED' and (e.signature_verified=true or e.verification_method='AUTHENTICATED_QUERY')
      and e.verified_at >= s.last_successful_payment_at-interval '5 minutes')
   limit 1`,[workspaceId,platform,profile]);
  if(!watchers.length)return send({error:"No verified paid campaign and consented watcher found"},403);
  const added=await sql.query(`
   insert into litix_profile_events(event_id,workspace_id,campaign_id,platform,profile_handle,post_url,media_hash,state,received_at)
   values($1,$2,$3,$4,$5,$6,$7,'queued',now()) on conflict do nothing returning event_id`,
   [eventId,workspaceId,watchers[0].campaign_id,platform,profile,url.toString(),mediaHash]);
  return send({ok:true,accepted:added.length===1,duplicate:added.length===0,fulfillment:"not triggered; no supplier order placed"});
 }catch(e){console.error("AutoLikes event recording failed",String(e?.message||"storage unavailable").slice(0,120));return send({error:"Profile event storage unavailable"},503)}
}
