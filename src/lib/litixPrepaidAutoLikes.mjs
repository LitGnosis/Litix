// Litix AutoLikes: one-time prepaid future-post packages, never recurring.
// Public competitor one-time price points verified 2026-11-01 ($4,7,10,15,24,40,70).
// Likes-per-post quantities below are Litix offerings, NOT claimed as competitor-equivalent.
import {eligibleNativeAutoLikes,nativeAutoLikesSupplierParams} from "./boosteroNativeAutoLikes.mjs";
import {litixRetailPer1000Cents,litixOrderCents} from "./litixRetail60.mjs";
import {boosteroProfile} from "./boosteroFulfillment.mjs";
export const PREPAID_POST_MAX=10;
export const PREPAID_PRICE_TIERS=Object.freeze([
 Object.freeze({id:"lite",likesPerPost:50,tenPostsCents:400}),
 Object.freeze({id:"start",likesPerPost:100,tenPostsCents:700}),
 Object.freeze({id:"rise",likesPerPost:150,tenPostsCents:1000}),
 Object.freeze({id:"grow",likesPerPost:250,tenPostsCents:1500}),
 Object.freeze({id:"prime",likesPerPost:400,tenPostsCents:2400}),
 Object.freeze({id:"power",likesPerPost:650,tenPostsCents:4000}),
 Object.freeze({id:"max",likesPerPost:1150,tenPostsCents:7000})
]);
export function prepaidNativeService(services,platform,quantity){
 if(!Array.isArray(services)||!["instagram","tiktok"].includes(platform))return null;
 return services.filter(s=>eligibleNativeAutoLikes(s,platform)&&
  Number(s.min)<=quantity&&Number(s.max)>=quantity)
  .sort((a,b)=>Number(a.rate)-Number(b.rate)||
   Number(a.service??a.id)-Number(b.service??b.id))[0]||null;
}
export function quotePrepaidAutoLikes({services,platform,profile,tierId,posts}){
 const tier=PREPAID_PRICE_TIERS.find(t=>t.id===tierId);
 const count=Number(posts);
 if(!tier||!Number.isSafeInteger(count)||count<1||count>PREPAID_POST_MAX)
  throw Error("prepaid_autolikes_plan_invalid");
 const canonical=boosteroProfile(profile,platform);
 if(!canonical)throw Error("prepaid_autolikes_profile_invalid");
 const supplier=prepaidNativeService(services,platform,tier.likesPerPost);
 if(!supplier)throw Error("prepaid_autolikes_service_unavailable");
 const rawRate=Number(supplier.rate);
 const retailPer1000=litixRetailPer1000Cents(rawRate,supplier);
 if(!Number.isSafeInteger(retailPer1000))throw Error("prepaid_autolikes_rate_invalid");
 const quantity=tier.likesPerPost;
 const minimumCents=litixOrderCents(retailPer1000,quantity)*count;
 const pricePointCents=Math.ceil(tier.tenPostsCents*count/10);
 const wholesaleCents=Math.ceil(rawRate*quantity*count/10-1e-8);
 const amountCents=Math.max(100,pricePointCents,minimumCents,Math.ceil(wholesaleCents*1.6-1e-8));
 if(!Number.isSafeInteger(amountCents)||amountCents>2000000||
  !Number.isSafeInteger(wholesaleCents)||wholesaleCents<1)
  throw Error("prepaid_autolikes_amount_invalid");
 return {
  platform,profileUrl:canonical,username:canonical.split("/").filter(Boolean).pop().replace(/^@/,""),
  tierId,likesPerPost:quantity,posts:count,amountCents,wholesaleCents,
  supplierServiceId:String(supplier.service??supplier.id),supplierRate:rawRate,
  currency:"USD",durationDays:30,autoRenew:false
 };
}
export function prepaidPeriodEnd(paidAt=new Date()){
 const start=new Date(paidAt);
 if(Number.isNaN(start.getTime()))throw Error("prepaid_autolikes_start_invalid");
 const end=new Date(start.getTime()+30*86400000);
 return end.toISOString();
}
export function prepaidNativeSupplierParams(quote,paidAt=new Date()){
 const end=prepaidPeriodEnd(paidAt);
 return nativeAutoLikesSupplierParams({quote:{
  serviceId:quote.supplierServiceId,username:quote.username,quantityPerPost:quote.likesPerPost,
  posts:quote.posts,delay:0
 },periodEnd:end,now:paidAt});
}
export const prepaidPublicPlan=p=>({
 id:p.id,likesPerPost:p.likesPerPost,tenPostPriceCents:p.tenPostsCents
});
