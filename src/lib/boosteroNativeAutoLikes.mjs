// Boostero's native "Subscriptions" service type automatically handles future
// posts itself. Do not create another social-media scraper or poller.
// Official supplier API: https://boostero.com/api  (username,min,max,posts,old_posts,delay,expiry)
import {boosteroProfile} from "./boosteroFulfillment.mjs";
import {litixRetailPer1000Cents,litixOrderCents} from "./litixRetail60.mjs";
import {litixPlatform} from "./litixServiceClassify.mjs";
export const AUTOLIKES_POST_LIMIT=30;
export const AUTOLIKES_DELAYS=Object.freeze([0,5,10,15,20,30,40,50,60,90,120,150,180,210,240,270,300,360,420,480,540,600]);

export function eligibleNativeAutoLikes(raw,platform){
 const type=String(raw?.type||"").trim().toLowerCase();
 if(type!=="subscriptions"&&type!=="subscription")return false;
 if(!["instagram","tiktok"].includes(platform))return false;
 const title=String(raw?.name||"");
 const label=[title,raw?.category].map(String).join(" ");
 const target=litixPlatform(raw?.name,raw?.category).toLowerCase();
 if(target!==platform)return false;
 if(!/\blikes?\b/i.test(title)||/\b(?:followers?|views?|shares?|comments?|saves?|members?|reposts?|retweets?)\b/i.test(title))return false;
 const min=Number(raw?.min),max=Number(raw?.max),rate=Number(raw?.rate);
 return /^\d{1,12}$/.test(String(raw?.service??raw?.id??""))&&
  Number.isSafeInteger(min)&&min>=1&&Number.isSafeInteger(max)&&max>=min&&max<=1000000&&
  Number.isFinite(rate)&&rate>0&&rate<1000000;
}
export function nativeAutoLikesCatalog(services,platform){
 if(!Array.isArray(services))throw Error("supplier_catalog_invalid");
 return services.filter(s=>eligibleNativeAutoLikes(s,platform)).map(s=>({
  serviceId:String(s.service??s.id),name:String(s.name||"AutoLikes").slice(0,160),
  platform,minimum:Number(s.min),maximum:Number(s.max),
  retailPer1000Cents:litixRetailPer1000Cents(s.rate,s)
 })).sort((a,b)=>a.retailPer1000Cents-b.retailPer1000Cents||a.serviceId.localeCompare(b.serviceId));
}
export function nativeAutoLikesQuote({service,platform,profile,quantityPerPost,posts,delay=0}){
 if(!eligibleNativeAutoLikes(service,platform))throw Error("native_autolikes_service_unavailable");
 const canonical=boosteroProfile(profile,platform);
 if(!canonical)throw Error("native_autolikes_invalid_profile");
 const m=platform==="instagram"?canonical.match(/^https:\/\/www\.instagram\.com\/([\w.]+)\/$/):
  canonical.match(/^https:\/\/www\.tiktok\.com\/@([\w.]+)\/$/);
 if(!m)throw Error("native_autolikes_invalid_profile");
 const qty=Number(quantityPerPost),limit=Number(posts),delayMinutes=Number(delay);
 if(!Number.isSafeInteger(qty)||qty<Number(service.min)||qty>Number(service.max)||qty>1000000)
  throw Error("native_autolikes_quantity_out_of_range");
 if(!Number.isSafeInteger(limit)||limit<1||limit>AUTOLIKES_POST_LIMIT)
  throw Error("native_autolikes_post_limit_invalid");
 if(!AUTOLIKES_DELAYS.includes(delayMinutes))throw Error("native_autolikes_delay_invalid");
 const retailCentsPer1000=litixRetailPer1000Cents(service.rate,service);
 const perPostCents=litixOrderCents(retailCentsPer1000,qty);
 const totalCents=perPostCents*limit;
 const wholesaleCents=Math.ceil(Number(service.rate)*qty*limit/10-1e-8);
 if(!Number.isSafeInteger(totalCents)||totalCents<100||totalCents>2_000_000||
  !Number.isSafeInteger(wholesaleCents)||totalCents<Math.ceil(wholesaleCents*1.6-1e-8))
  throw Error("native_autolikes_price_invalid");
 return {serviceId:String(service.service??service.id),platform,username:m[1],
  profileUrl:canonical,quantityPerPost:qty,posts:limit,delay:delayMinutes,
  retailPer1000Cents:retailCentsPer1000,perPostCents,totalCents,wholesaleCents,currency:"USD"};
}
export function nativeAutoLikesExpiry(periodEnd,now=new Date()){
 const d=new Date(periodEnd),current=new Date(now);
 if(Number.isNaN(d.getTime())||Number.isNaN(current.getTime())||
  d.getTime()<=current.getTime()||d.getTime()>current.getTime()+40*86400000)
  throw Error("native_autolikes_expiry_invalid");
 // Supplier accepts d/m/Y. Never send an unlimited native subscription.
 return String(d.getUTCDate()).padStart(2,"0")+"/"+String(d.getUTCMonth()+1).padStart(2,"0")+"/"+d.getUTCFullYear();
}
export function nativeAutoLikesSupplierParams({quote,periodEnd,now=new Date()}){
 if(!quote||!/^\d{1,12}$/.test(String(quote.serviceId))||
  !/^[a-zA-Z0-9._]{1,30}$/.test(String(quote.username))||
  !Number.isSafeInteger(quote.quantityPerPost)||quote.quantityPerPost<1||quote.quantityPerPost>1000000||
  !Number.isSafeInteger(quote.posts)||quote.posts<1||quote.posts>AUTOLIKES_POST_LIMIT||
  !AUTOLIKES_DELAYS.includes(quote.delay))throw Error("native_autolikes_invalid_supplier_parameters");
 return {service:quote.serviceId,username:quote.username,
  min:String(quote.quantityPerPost),max:String(quote.quantityPerPost),
  posts:String(quote.posts),old_posts:"0",delay:String(quote.delay),expiry:nativeAutoLikesExpiry(periodEnd,now)};
}
