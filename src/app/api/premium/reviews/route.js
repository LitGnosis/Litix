import {reviewReady,reviewDb,submitReview} from "../../../../lib/premiumReviews.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const response=(body,status=200)=>Response.json(body,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
export async function GET(){
 if(!reviewReady())return response({reviews:[],available:false},200);
 try{
  const sql=reviewDb();
  const rows=await sql.query("select id,display_name,service_category,stars,body,image_url,verified_purchase,submitted_at from public.litix_premium_reviews where status='approved' order by submitted_at desc limit 30");
  return response({reviews:rows,available:true});
 }catch{return response({reviews:[],available:false},200)}
}
export async function POST(req){
 if(!reviewReady())return response({error:"Customer reviews temporarily unavailable"},503);
 const origin=req.headers.get("origin");
 if(!origin||origin!==new URL(req.url).origin)return response({error:"Invalid request origin"},403);
 let raw;try{raw=await req.text();if(raw.length>6000)return response({error:"Too much content"},413);
  const input=JSON.parse(raw);const result=await submitReview(input,{
   ip:req.headers.get("x-vercel-forwarded-for")?.split(",")[0]||req.headers.get("x-forwarded-for")?.split(",")[0]||"unknown",
   ua:req.headers.get("user-agent")||""});return response(result,202);
 }catch(e){
  const code=String(e.message||"");
  if(/invalid_review|review_spam|review_image_host/.test(code))return response({error:code},422);
  if(/duplicate key value|unique constraint/.test(code))return response({error:"Review already submitted today"},429);
  console.error("Review submission failure",{type:"review_store_unavailable"});
  return response({error:"Review submission temporarily unavailable"},503);
 }
}