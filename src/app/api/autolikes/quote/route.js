import {boosteroProduction} from "../../../../lib/boosteroReadOnly.mjs";
import {boosteroProductionReady} from "../../../../lib/boosteroFulfillment.mjs";
import {nativeAutoLikesQuote} from "../../../../lib/boosteroNativeAutoLikes.mjs";
import {autoLikesRecurringCheckoutReady} from "../../../../lib/nmiAutoLikesRecurring.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=30;
const send=(data,status=200)=>Response.json(data,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
export async function POST(request){
 const origin=request.headers.get("origin");
 if(origin&&origin!==new URL(request.url).origin)return send({error:"Invalid origin"},403);
 if(!boosteroProductionReady())return send({error:"AutoLikes supplier unavailable"},503);
 let input;
 try{const raw=await request.text();if(raw.length>1800)throw Error();input=JSON.parse(raw)}
 catch{return send({error:"Invalid AutoLikes quote request"},400)}
 const id=String(input?.serviceId||"").replace(/^litix_/,"");
 if(!/^\d{1,12}$/.test(id)||!["instagram","tiktok"].includes(input?.platform))
  return send({error:"Choose a supported AutoLikes service"},422);
 try{
  const services=await boosteroProduction("services");
  const selected=services.find(x=>String(x.service??x.id)===id);
  const quote=nativeAutoLikesQuote({service:selected,platform:input.platform,
   profile:input.profile,quantityPerPost:input.quantityPerPost,posts:input.posts,delay:input.delay??0});
  return send({eligible:true,checkoutEnabled:autoLikesRecurringCheckoutReady(),
   quote:{serviceId:"litix_"+quote.serviceId,platform:quote.platform,profile:quote.profileUrl,
    likesPerPost:quote.quantityPerPost,postsPerMonth:quote.posts,delayMinutes:quote.delay,
    monthlyAmountCents:quote.totalCents,perPostCents:quote.perPostCents,currency:"USD"},
   notice:"Fixed monthly capacity; future posts start only after independently verified recurring payment."});
 }catch{return send({error:"Service, quantity or price cannot be verified; no payment attempted"},409)}
}
