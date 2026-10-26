import { neon } from "@neondatabase/serverless";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { fetchLikesServices } from "./autolikes.mjs";

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
export function supplierServiceAllows(row,catalog) {
  if(!Array.isArray(catalog)||!row||!["instagram","tiktok"].includes(String(row.platform).toLowerCase()))
    return false;
  const svc=catalog.find(s=>String(s.service)===String(row.service_id));
  const n=Number(row.likes);
  return Boolean(svc) && Number.isSafeInteger(n) &&
    n>=Number(svc.min) && n<=Number(svc.max) &&
    Number(svc.min)>=1 && Number(svc.max)>=Number(svc.min);
}
async function place(row) {
  // SMMGLOB is the only authorized supplier. Never cascade an ambiguous order.
  const key=process.env.SMMGLOB_API_KEY;
  if(!key)return {state:"DECLINED",reason:"SMMGLOB_NOT_CONFIGURED"};
  let url;
  try {
    url=new URL(process.env.SMMGLOB_API_URL||"https://smmglob.com/api/v2");
    if(url.protocol!=="https:" || !["smmglob.com","www.smmglob.com"].includes(url.hostname))
      return {state:"DECLINED",reason:"INVALID_SUPPLIER_HOST"};
  }catch {return {state:"DECLINED",reason:"INVALID_SUPPLIER_HOST"};}
  if(!/^[0-9]+$/.test(String(row.service_id||"")) ||
     !Number.isSafeInteger(Number(row.likes)) || Number(row.likes)<1)
    return {state:"DECLINED",reason:"INVALID_SUPPLIER_SERVICE"};
  // Validate the exact paid service against today's approved SMMGLOB Likes
  // catalog BEFORE any paid supplier action. A stale service ID or unsupported
  // quantity must never silently route to another provider or service.
  let catalog;
  try{catalog=await fetchLikesServices(row.platform);}
  catch{return {state:"DECLINED",reason:"SUPPLIER_CATALOG_UNAVAILABLE"};}
  if(!supplierServiceAllows(row,catalog))
    return {state:"DECLINED",reason:"SERVICE_OR_QUANTITY_NOT_AVAILABLE"};
  let response;
  try{
    response=await fetch(url.href,{
      method:"POST",
      headers:{"content-type":"application/x-www-form-urlencoded"},
      body:new URLSearchParams({
        key,action:"add",service:String(row.service_id),
        link:row.post_url,quantity:String(row.likes)
      }),
      cache:"no-store",signal:AbortSignal.timeout(17000)
    });
  }catch{return {state:"UNKNOWN_OUTCOME",supplier:"SMMGLOB"};}
  // A gateway error may happen AFTER order creation. Never auto-resubmit.
  if(!response.ok)return {state:"UNKNOWN_OUTCOME",supplier:"SMMGLOB"};
  let payload;
  try{payload=await response.json()}catch{return {state:"UNKNOWN_OUTCOME",supplier:"SMMGLOB"};}
  if(/^[0-9]+$/.test(String(payload?.order||"")))
    return {state:"SUBMITTED",supplier:"SMMGLOB",order:String(payload.order)};
  if(typeof payload?.error==="string" && payload.error.trim())
    return {state:"DECLINED",supplier:"SMMGLOB",reason:"SUPPLIER_REJECTED"};
  return {state:"UNKNOWN_OUTCOME",supplier:"SMMGLOB"};
}
export async function dispatchLivePost(postId) {
  // No external supplier operations from a Preview build or disabled production.
  if(process.env.VERCEL_ENV!=="production" || process.env.LITIX_AUTOLIKES_DISPATCH_ENABLED!=="true")
    return {claimed:false,state:"DISABLED"};
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
