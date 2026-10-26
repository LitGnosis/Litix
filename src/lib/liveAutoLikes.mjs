import { neon } from "@neondatabase/serverless";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const db = () => neon(process.env.LITIX_AUTOLIKES_DATABASE_URL || process.env.LITIX_V2_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL);
export const sha = value => createHash("sha256").update(String(value)).digest("hex");
export function equalMac(message, signature, key) {
  if (!key || !/^[a-f0-9]{64}$/i.test(signature || "")) return false;
  return timingSafeEqual(createHmac("sha256",key).update(message).digest(),Buffer.from(signature,"hex"));
}
export function cronAuth(req) {
  const provided=(req.headers.get("authorization") || "").replace(/^Bearer\s+/i,"");
  const expected=process.env.CRON_SECRET || process.env.LITIX_CRON_SECRET;
  return Boolean(provided && expected) && timingSafeEqual(Buffer.from(sha(provided),"hex"),Buffer.from(sha(expected),"hex"));
}
export function normalizedPost(raw,platform,handle) {
  try {
    const u=new URL(raw);
    if(u.protocol!=="https:" || u.username || u.password || u.port || u.search || u.hash) return null;
    const p=u.pathname, h=u.hostname.toLowerCase(), user=handle.toLowerCase();
    if(platform==="instagram" && ["instagram.com","www.instagram.com"].includes(h) && /^\/(p|reel|tv)\/[A-Za-z0-9_-]{5,40}\/?$/.test(p))return u.origin+p;
    if(platform==="tiktok" && ["tiktok.com","www.tiktok.com"].includes(h) && /^\/@[A-Za-z0-9._]+\/video\/\d{8,30}\/?$/.test(p) && p.split("/")[1].toLowerCase()==="@"+user)return u.origin+p;
  } catch {}
  return null;
}
function suppliers(row) {
  let mapping={};
  try{mapping=JSON.parse(process.env.LITIX_AUTOLIKES_FALLBACK_SERVICES_JSON||"{}");}catch{}
  return [
    {name:"SMMGLOB",url:"https://smmglob.com/api/v2",key:process.env.SMMGLOB_API_KEY,service:String(row.service_id)},
    {name:"SMMFOLLOWOM",url:"https://my.smmfollowom.com/api/v2",key:process.env.SMMFOLLOWOM_API_KEY,service:String(mapping[row.platform]||"")}
  ].filter(p=>p.key && /^\d+$/.test(p.service));
}
async function place(row) {
  const configured=suppliers(row);
  if(!configured.length)return {state:"DECLINED",reason:"NO_CONFIGURED_PROVIDER"};
  for(const p of configured) {
    let response;
    try {
      response=await fetch(p.url,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({key:p.key,action:"add",service:p.service,link:row.post_url,quantity:String(row.likes)}),cache:"no-store",signal:AbortSignal.timeout(17000)});
    }catch{return {state:"UNKNOWN_OUTCOME",supplier:p.name};}
    if(!response.ok) return {state:"UNKNOWN_OUTCOME",supplier:p.name};
    let body;
    try {body=await response.json();}catch{return {state:"UNKNOWN_OUTCOME",supplier:p.name};}
    if(/^\d+$/.test(String(body?.order||"")))return {state:"SUBMITTED",supplier:p.name,order:String(body.order)};
    // Explicit reject with an error means the provider did not accept an order.
    if(body && typeof body.error==="string")continue;
    return {state:"UNKNOWN_OUTCOME",supplier:p.name};
  }
  return {state:"DECLINED",reason:"ALL_PROVIDERS_REJECTED"};
}
export async function dispatchLivePost(postId) {
  const sql=db();
  const admitted=await sql.query("select * from litix_claim_autolikes_live_post($1)",[postId]);
  if(!admitted.length)return {claimed:false};
  const row=admitted[0];
  let state;
  try{state=await place(row);}catch{state={state:"UNKNOWN_OUTCOME"};}
  await sql.query("update litix_autolikes_live_posts set state=$2,supplier_name=$3,supplier_order_id=$4,finished_at=now() where id=$1 and state='CLAIMED'",
    [postId,state.state,state.supplier||null,state.order||null]);
  // Only an explicit rejection makes a second attempt safe, and this worker never resubmits automatically.
  if(state.state==="DECLINED")await sql.query(
    "update litix_autolikes_live_subscriptions set posts_remaining=least(posts_remaining+1,monthly_post_limit),updated_at=now() where id=(select subscription_id from litix_autolikes_live_posts where id=$1)",[postId]);
  return {claimed:true,state:state.state,supplier:state.supplier||null,orderId:state.order||null};
}
