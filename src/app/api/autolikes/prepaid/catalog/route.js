import {boosteroProduction} from "../../../../../lib/boosteroReadOnly.mjs";
import {boosteroProductionReady} from "../../../../../lib/boosteroFulfillment.mjs";
import {prepaidAutoLikesEnabled} from "../../../../../lib/litixPrepaidAutoLikesFulfillment.mjs";
import {PREPAID_PRICE_TIERS,quotePrepaidAutoLikes} from "../../../../../lib/litixPrepaidAutoLikes.mjs";
export const runtime="nodejs";export const dynamic="force-dynamic";export const maxDuration=30;
export async function GET(){
 if(!boosteroProductionReady())return Response.json({available:false,checkoutEnabled:false,platforms:[],message:"AutoLikes availability cannot be verified."},{status:503,headers:{"cache-control":"no-store"}});
 try{
  const services=await boosteroProduction("services");
  const platforms=["instagram","tiktok"].map(platform=>{
   const plans=PREPAID_PRICE_TIERS.flatMap(t=>{
    try{
     const q=quotePrepaidAutoLikes({services,platform,profile:platform==="instagram"?"@litixsocial":"@litixsocial",tierId:t.id,posts:10});
     return [{id:t.id,label:t.likesPerPost.toLocaleString()+" Likes / New Post",
      likesPerPost:q.likesPerPost,priceForTenPostsCents:q.amountCents}];
    }catch{return []}
   });
   return {platform,label:platform==="instagram"?"Instagram AutoLikes":"TikTok AutoLikes",plans};
  }).filter(x=>x.plans.length);
  return Response.json({available:platforms.length>0,checkoutEnabled:prepaidAutoLikesEnabled(),
   platforms,maxPosts:10,days:30,autoRenew:false,
   message:"One payment covers the selected number of new posts for 30 days. No automatic renewal. No social-media password required."},
   {headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
 }catch{return Response.json({available:false,checkoutEnabled:false,platforms:[],message:"AutoLikes options temporarily unavailable."},{status:503,headers:{"cache-control":"no-store"}})}
}
