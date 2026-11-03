import {boosteroProduction} from "../../../../../lib/boosteroReadOnly.mjs";
import {boosteroProductionReady} from "../../../../../lib/boosteroFulfillment.mjs";
import {quotePrepaidAutoLikes} from "../../../../../lib/litixPrepaidAutoLikes.mjs";
import {prepaidAutoLikesEnabled} from "../../../../../lib/litixPrepaidAutoLikesFulfillment.mjs";
export const runtime="nodejs";export const dynamic="force-dynamic";export const maxDuration=30;
const send=(o,s=200)=>Response.json(o,{status:s,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
export async function POST(req){
 const origin=req.headers.get("origin");if(origin&&origin!==new URL(req.url).origin)return send({error:"Invalid origin"},403);
 if(!boosteroProductionReady())return send({error:"Litix AutoLikes unavailable"},503);
 let input;
 try{const raw=await req.text();if(raw.length>2000)throw Error();input=JSON.parse(raw)}catch{return send({error:"Invalid quote request"},400)}
 try{
  const services=await boosteroProduction("services");
  const q=quotePrepaidAutoLikes({services,platform:input.platform,profile:input.profile,tierId:input.tierId,posts:input.posts});
  return send({eligible:true,checkoutEnabled:prepaidAutoLikesEnabled(),
   quote:{platform:q.platform,profile:q.profileUrl,plan:q.tierId,likesPerPost:q.likesPerPost,
    posts:q.posts,amountCents:q.amountCents,currency:"USD",durationDays:30,autoRenew:false},
   notice:"One charge. Future public posts only, up to the selected count or 30 days, whichever comes first."});
 }catch{return send({error:"Service, profile, quantity, or price could not be verified. No payment attempted."},409)}
}
