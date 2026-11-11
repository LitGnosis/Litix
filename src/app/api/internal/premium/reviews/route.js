import {reviewReady,reviewDb,reviewAdmin} from "../../../../../lib/premiumReviews.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const send=(x,s=200)=>Response.json(x,{status:s,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
export async function GET(req){
 if(!reviewAdmin(req.headers.get("authorization")))return send({error:"Unauthorized"},401);
 if(!reviewReady())return send({error:"Review database not configured"},503);
 try{
  const rows=await reviewDb().query("select id,display_name,service_category,stars,body,image_url,verified_purchase,submitted_at,status from public.litix_premium_reviews where status='pending' order by submitted_at asc limit 100");
  return send({pending:rows});
 }catch{return send({error:"Review database unavailable"},503)}
}
export async function POST(req){
 if(!reviewAdmin(req.headers.get("authorization")))return send({error:"Unauthorized"},401);
 if(!reviewReady())return send({error:"Review database not configured"},503);
 const origin=req.headers.get("origin");if(origin&&origin!==new URL(req.url).origin)return send({error:"Invalid origin"},403);
 let raw;try{raw=await req.text();if(raw.length>1800)return send({error:"Too much content"},413)}catch{return send({error:"Invalid request"},400)}
 let body;try{body=JSON.parse(raw)}catch{return send({error:"Invalid JSON"},400)}
 const id=String(body.id||""),status=String(body.status||"");
 if(!/^[a-f0-9-]{36}$/.test(id)||!["approved","rejected"].includes(status))return send({error:"Invalid moderation"},422);
 try{
  const result=await reviewDb().query("update public.litix_premium_reviews set status=$2,moderated_at=now() where id=$1 and status='pending' returning id,status",[id,status]);
  return result.length?send({id,status}):send({error:"Review already moderated or missing"},409);
 }catch{return send({error:"Review database unavailable"},503)}
}