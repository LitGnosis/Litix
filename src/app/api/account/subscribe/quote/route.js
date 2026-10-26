import { authenticatedCustomer, customerAuthConfigured } from "../../../../../lib/customerAuth.js";
import { fetchLikesServices, quoteMonthlyAutoLikes } from "../../../../../lib/autolikes.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (value,status=200) => Response.json(value,{status,headers:{"cache-control":"private, no-store"}});
const sameOrigin = request => {
 try{return new URL(request.headers.get("origin")).origin === new URL(request.url).origin}catch{return false}
};

/** Quoting is read-only: no payments, subscriptions or supplier orders. */
export async function POST(request) {
 if(!sameOrigin(request))return json({error:"Invalid request origin"},403);
 if(!customerAuthConfigured())return json({error:"Account sign-in is not enabled"},503);
 const customer=await authenticatedCustomer();
 if(!customer)return json({error:"Sign in with verified email"},401);
 const size=Number(request.headers.get("content-length")||0);
 if(size>2000)return json({error:"Invalid quote request"},413);
 let payload;
 try{const raw=await request.text();if(raw.length>2000)throw Error("Too large");payload=JSON.parse(raw)}catch{return json({error:"Invalid JSON"},400)}
 const platform=String(payload?.platform||"").toLowerCase();
 if(!["instagram","tiktok"].includes(platform))return json({error:"Invalid platform"},400);
 try {
  const services=await fetchLikesServices(platform);
  const service=services.find(s=>String(s.service)===String(payload.serviceId));
  if(!service)return json({error:"Likes service is unavailable"},404);
  const quote=quoteMonthlyAutoLikes({
   service,platform,
   quantityPerPost:payload.quantityPerPost,
   maxPostsPerMonth:payload.maxPostsPerMonth,
   markupPercent:0
  });
  return json({quote,subscriptionCheckoutEnabled:false,
   message:"Price verified against the current supplier catalog. Subscription enrollment and recurring charges require separate activation."});
 }catch(e){
  if(/Invalid|exceeds|margin|not available/i.test(String(e?.message)))return json({error:String(e.message).slice(0,120)},400);
  return json({error:"Supplier pricing temporarily unavailable"},503);
 }
}
